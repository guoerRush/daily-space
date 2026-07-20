create table if not exists public.user_records (
  user_id uuid primary key references auth.users(id) on delete cascade,
  records jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_records enable row level security;

drop policy if exists "Users manage only their own records" on public.user_records;
create policy "Users manage only their own records"
on public.user_records
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- A short-lived code links one Feishu identity to one Daily Space account.
create table if not exists public.feishu_binding_codes (
  code text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists feishu_binding_codes_user_id_idx
on public.feishu_binding_codes (user_id);

create table if not exists public.feishu_bindings (
  open_id text primary key,
  user_id uuid not null unique references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.feishu_processed_messages (
  message_id text primary key,
  processed_at timestamptz not null default now()
);

alter table public.feishu_binding_codes enable row level security;
alter table public.feishu_bindings enable row level security;
alter table public.feishu_processed_messages enable row level security;

drop policy if exists "Users view their own Feishu binding codes" on public.feishu_binding_codes;
create policy "Users view their own Feishu binding codes"
on public.feishu_binding_codes
for select
to authenticated
using (auth.uid() = user_id);

-- Imported images are uploaded only by the server using the service role.
insert into storage.buckets (id, name, public)
values ('feishu-imports', 'feishu-imports', false)
on conflict (id) do update set public = false;
