-- Account settings: profile extras, notifications, sessions, passkeys.

alter table profiles add column if not exists avatar_url text;
alter table profiles add column if not exists theme text not null default 'dark';
alter table profiles add column if not exists locale text not null default 'en';
alter table profiles add column if not exists notify_reviews boolean not null default true;

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  href text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists notifications_client_idx on notifications (client_id, created_at desc);

create table if not exists notification_reads (
  notification_id uuid not null references notifications(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (notification_id, user_id)
);

create table if not exists user_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  token_hash text not null unique,
  user_agent text,
  ip text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz
);
create index if not exists user_sessions_user_idx on user_sessions (user_id, last_seen_at desc);

create table if not exists user_passkeys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  label text not null default 'Passkey',
  created_at timestamptz not null default now()
);

alter table notifications enable row level security;
alter table notification_reads enable row level security;
alter table user_sessions enable row level security;
alter table user_passkeys enable row level security;

drop policy if exists notifications_member on notifications;
create policy notifications_member on notifications for all
  using (public.member_of(client_id)) with check (public.member_of(client_id));

drop policy if exists notification_reads_self on notification_reads;
create policy notification_reads_self on notification_reads for all
  using (user_id = auth.uid() or public.is_superadmin())
  with check (user_id = auth.uid() or public.is_superadmin());

drop policy if exists user_sessions_self on user_sessions;
create policy user_sessions_self on user_sessions for all
  using (user_id = auth.uid() or public.is_superadmin())
  with check (user_id = auth.uid() or public.is_superadmin());

drop policy if exists user_passkeys_self on user_passkeys;
create policy user_passkeys_self on user_passkeys for all
  using (user_id = auth.uid() or public.is_superadmin())
  with check (user_id = auth.uid() or public.is_superadmin());
