-- Additive migration: preserves user_records, backups and older clients.
begin;

create or replace function public.daily_space_sync_parts(p_records jsonb)
returns jsonb language plpgsql immutable set search_path = '' as $$
declare
  result jsonb := coalesce(p_records, '{}'::jsonb);
  journals jsonb;
  entry jsonb;
  seen text[] := array[]::text[];
  day text;
begin
  if not (result ? 'daily-space:journals') then return result; end if;
  begin
    journals := (result ->> 'daily-space:journals')::jsonb;
    if jsonb_typeof(journals) <> 'array' then return result; end if;
    for entry in select value from jsonb_array_elements(journals) loop
      day := entry ->> 'date';
      if day is null or day !~ '^\d{4}-\d{2}-\d{2}$' or day = any(seen) then return p_records; end if;
      seen := array_append(seen, day);
    end loop;
    result := (result - 'daily-space:journals') || jsonb_build_object('__journal_container__', '[]');
    for entry in select value from jsonb_array_elements(journals) loop
      result := result || jsonb_build_object('__journal_date__:' || (entry ->> 'date'), entry::text);
    end loop;
  exception when invalid_text_representation then return p_records;
  end;
  return result;
end;
$$;

create or replace function public.daily_space_join_parts(p_parts jsonb)
returns jsonb language plpgsql immutable set search_path = '' as $$
declare result jsonb := coalesce(p_parts, '{}'::jsonb); journals jsonb;
begin
  if result ? '__journal_container__' then
    select coalesce(jsonb_agg((value #>> '{}')::jsonb order by key desc), '[]'::jsonb)
      into journals from jsonb_each(result) where left(key, 17) = '__journal_date__:';
    result := result || jsonb_build_object('daily-space:journals', journals::text);
  end if;
  select coalesce(jsonb_object_agg(key, value), '{}'::jsonb) into result
    from jsonb_each(result) where key <> '__journal_container__' and left(key, 17) <> '__journal_date__:';
  return result;
end;
$$;

create or replace function public.daily_space_read_changes(p_version timestamptz default null, p_known jsonb default '{}'::jsonb)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare
  snapshot public.user_records%rowtype;
  parts jsonb;
  fingerprints jsonb;
  changes jsonb;
  hashes jsonb;
  present boolean;
begin
  if auth.uid() is null then raise insufficient_privilege using message = 'Authentication required'; end if;
  if jsonb_typeof(p_known) is distinct from 'object' then raise invalid_parameter_value; end if;
  select * into snapshot from public.user_records where user_id = auth.uid();
  present := found;
  if present and snapshot.updated_at = p_version then
    return jsonb_build_object('exists', true, 'updated_at', snapshot.updated_at, 'changes', '{}'::jsonb, 'hashes', '{}'::jsonb);
  end if;
  parts := public.daily_space_sync_parts(coalesce(snapshot.records, '{}'::jsonb));
  select coalesce(jsonb_object_agg(key, encode(sha256(convert_to(value, 'UTF8')), 'hex')), '{}'::jsonb)
    into fingerprints from jsonb_each_text(parts);
  with keys as (select jsonb_object_keys(parts) as key union select jsonb_object_keys(p_known)),
    changed as (select key from keys where fingerprints -> key is distinct from p_known -> key)
  select coalesce(jsonb_object_agg(key, parts -> key), '{}'::jsonb),
    coalesce(jsonb_object_agg(key, fingerprints -> key), '{}'::jsonb) into changes, hashes from changed;
  return jsonb_build_object('exists', present, 'updated_at', snapshot.updated_at, 'changes', changes, 'hashes', hashes);
end;
$$;

create or replace function public.daily_space_write_changes(p_expected timestamptz, p_changes jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  snapshot public.user_records%rowtype;
  parts jsonb;
  pair record;
  present boolean;
  saved_at timestamptz;
  fingerprints jsonb;
begin
  if auth.uid() is null then raise insufficient_privilege using message = 'Authentication required'; end if;
  if jsonb_typeof(p_changes) is distinct from 'object' or exists
    (select 1 from jsonb_each(p_changes) where jsonb_typeof(value) not in ('string', 'null')) then
    raise invalid_parameter_value using message = 'Invalid record changes';
  end if;
  -- Serialize first inserts too; concurrent devices cannot replace each other.
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text, 0));
  select * into snapshot from public.user_records where user_id = auth.uid() for update;
  present := found;
  if (present and snapshot.updated_at is distinct from p_expected) or (not present and p_expected is not null) then
    return jsonb_build_object('conflict', true);
  end if;
  parts := public.daily_space_sync_parts(coalesce(snapshot.records, '{}'::jsonb));
  for pair in select * from jsonb_each(p_changes) loop
    if pair.value = 'null'::jsonb then parts := parts - pair.key;
    else parts := parts || jsonb_build_object(pair.key, pair.value); end if;
  end loop;
  if present then
    update public.user_records set records = public.daily_space_join_parts(parts), updated_at = clock_timestamp()
      where user_id = auth.uid() returning updated_at into saved_at;
  else
    insert into public.user_records(user_id, records, updated_at)
      values(auth.uid(), public.daily_space_join_parts(parts), clock_timestamp()) returning updated_at into saved_at;
  end if;
  -- Return only fingerprints of uploaded keys, never the user's entire history.
  parts := public.daily_space_sync_parts(public.daily_space_join_parts(parts));
  select coalesce(jsonb_object_agg(key, case when not (parts ? key) then null
    else encode(sha256(convert_to(parts ->> key, 'UTF8')), 'hex') end), '{}'::jsonb)
    into fingerprints from jsonb_each(p_changes);
  return jsonb_build_object('conflict', false, 'updated_at', saved_at, 'hashes', fingerprints);
end;
$$;

revoke all on function public.daily_space_sync_parts(jsonb), public.daily_space_join_parts(jsonb),
  public.daily_space_read_changes(timestamptz,jsonb), public.daily_space_write_changes(timestamptz,jsonb) from public, anon;
grant execute on function public.daily_space_sync_parts(jsonb), public.daily_space_join_parts(jsonb),
  public.daily_space_read_changes(timestamptz,jsonb), public.daily_space_write_changes(timestamptz,jsonb) to authenticated;

notify pgrst, 'reload schema';
commit;
