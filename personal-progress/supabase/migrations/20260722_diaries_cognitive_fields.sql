-- A relational diary mirror for cognitive review. Run this in Supabase SQL
-- Editor, or through your existing migration pipeline. Existing diaries tables
-- are preserved and only receive the columns declared below.

create table if not exists public.diaries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  title text,
  content text not null default '',
  mood text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, date)
);

alter table public.diaries
  add column if not exists template text not null default 'free',
  add column if not exists touch_event text,
  add column if not exists touch_why text,
  add column if not exists touch_action text,
  add column if not exists review_desc text,
  add column if not exists review_analysis text,
  add column if not exists review_action text,
  add column if not exists linked_diary_ids uuid[] not null default '{}',
  add column if not exists meta_cognition jsonb not null default '{}'::jsonb;

create unique index if not exists diaries_user_date_key
  on public.diaries (user_id, date);

alter table public.diaries enable row level security;

drop policy if exists "Users manage only their own diaries" on public.diaries;
create policy "Users manage only their own diaries"
on public.diaries
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- Keep template data valid. PostgreSQL does not support ADD CONSTRAINT IF NOT EXISTS.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'diaries_template_check'
      and conrelid = 'public.diaries'::regclass
  ) then
    alter table public.diaries
      add constraint diaries_template_check
      check (template in ('free', 'touch', 'review'));
  end if;
end $$;

comment on column public.diaries.meta_cognition is
  'JSON object: isObjective, isAvoidingCoreIssue, isConfidentInAction';
