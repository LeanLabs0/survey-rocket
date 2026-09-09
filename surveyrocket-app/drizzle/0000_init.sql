-- Survey Rocket schema. Apply with: npm run db:push
-- or: psql "$DATABASE_URL" -f drizzle/0000_init.sql

create extension if not exists pgcrypto;
create extension if not exists citext;

create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  logo_url text,
  brand jsonb not null default '{}'::jsonb,
  review_links jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  is_superadmin boolean not null default false
);

create table if not exists client_members (
  user_id uuid not null references profiles(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  role text not null default 'member',
  primary key (user_id, client_id)
);

create table if not exists surveys (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  public_id text not null unique,
  slug text not null,
  name text not null,
  cadence text,
  status text not null default 'Draft',
  intro text,
  outro text,
  settings jsonb not null default '{}'::jsonb,
  provenance jsonb not null default '{}'::jsonb,
  definition jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  hs_signed_in_list_id text,
  hs_completed_list_id text,
  unique (client_id, slug)
);
create index if not exists surveys_client_idx on surveys (client_id);
create index if not exists surveys_live_client_idx on surveys (client_id) where deleted_at is null;

create table if not exists survey_publications (
  id uuid primary key default gen_random_uuid(),
  survey_id uuid not null references surveys(id) on delete cascade,
  version integer not null,
  definition jsonb not null,
  published_at timestamptz not null default now(),
  published_by uuid,
  unique (survey_id, version)
);

create table if not exists respondents (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  email text not null,
  name text,
  company text,
  website text,
  hubspot_contact_id text,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (client_id, email)
);
create index if not exists respondents_client_idx on respondents (client_id);

create table if not exists responses (
  id text primary key,
  client_id uuid not null references clients(id) on delete cascade,
  survey_id uuid not null references surveys(id) on delete cascade,
  publication_id uuid references survey_publications(id),
  respondent_id uuid references respondents(id),
  client_response_id text not null,
  source text not null default 'share',
  started_at timestamptz,
  completed_at timestamptz,
  duration_ms integer,
  country text,
  ip_hash text,
  user_agent text,
  review_asked boolean not null default false,
  review_outcome text not null default 'not_asked',
  quote jsonb not null default '{}'::jsonb,
  hubspot_status text not null default 'skipped',
  hubspot_written_at timestamptz,
  hubspot_error text,
  record jsonb not null default '{}'::jsonb,
  unique (survey_id, client_response_id)
);
create index if not exists responses_survey_idx on responses (survey_id);
create index if not exists responses_client_idx on responses (client_id);
create index if not exists responses_hubspot_status_idx on responses (hubspot_status);

create table if not exists answers (
  id uuid primary key default gen_random_uuid(),
  response_id text not null references responses(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  survey_id uuid not null references surveys(id) on delete cascade,
  question_key text not null,
  question_text text,
  type text not null,
  nps boolean not null default false,
  value_text text,
  value_number integer,
  value_list jsonb,
  skipped boolean not null default false
);
create index if not exists answers_survey_question_idx on answers (survey_id, question_key);
create index if not exists answers_response_idx on answers (response_id);

create table if not exists scans (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  url text not null,
  target_stat text,
  status text not null default 'pending',
  gaps jsonb not null default '[]'::jsonb,
  created_by uuid,
  created_at timestamptz not null default now()
);
create index if not exists scans_client_idx on scans (client_id);

create table if not exists hubspot_connections (
  client_id uuid primary key references clients(id) on delete cascade,
  portal_id text,
  portal_name text,
  refresh_token_enc text,
  access_token_enc text,
  expires_at timestamptz,
  scopes text,
  survey_object_type_id text,
  signin_form_id text,
  status text not null default 'disconnected',
  connected_by uuid,
  connected_at timestamptz
);

-- New auth users get a profiles row.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, coalesce(new.email, ''), coalesce(new.raw_user_meta_data->>'full_name', ''))
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

alter table clients enable row level security;
alter table profiles enable row level security;
alter table client_members enable row level security;
alter table surveys enable row level security;
alter table survey_publications enable row level security;
alter table respondents enable row level security;
alter table responses enable row level security;
alter table answers enable row level security;
alter table scans enable row level security;
alter table hubspot_connections enable row level security;

create or replace function public.is_superadmin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select is_superadmin from profiles where id = auth.uid()), false);
$$;

create or replace function public.member_of(cid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_superadmin()
    or exists (select 1 from client_members where user_id = auth.uid() and client_id = cid);
$$;

drop policy if exists profiles_self on profiles;
create policy profiles_self on profiles for select using (id = auth.uid() or public.is_superadmin());
drop policy if exists profiles_update_self on profiles;
create policy profiles_update_self on profiles for update using (id = auth.uid());

drop policy if exists clients_member on clients;
create policy clients_member on clients for select using (public.member_of(id) or public.is_superadmin());

drop policy if exists members_read on client_members;
create policy members_read on client_members for select using (public.member_of(client_id));

drop policy if exists surveys_member on surveys;
create policy surveys_member on surveys for all using (public.member_of(client_id)) with check (public.member_of(client_id));

drop policy if exists pubs_member on survey_publications;
create policy pubs_member on survey_publications for all
  using (exists (select 1 from surveys s where s.id = survey_id and public.member_of(s.client_id)))
  with check (exists (select 1 from surveys s where s.id = survey_id and public.member_of(s.client_id)));

drop policy if exists respondents_member on respondents;
create policy respondents_member on respondents for all using (public.member_of(client_id)) with check (public.member_of(client_id));

drop policy if exists responses_member on responses;
create policy responses_member on responses for all using (public.member_of(client_id)) with check (public.member_of(client_id));

drop policy if exists answers_member on answers;
create policy answers_member on answers for all using (public.member_of(client_id)) with check (public.member_of(client_id));

drop policy if exists scans_member on scans;
create policy scans_member on scans for all using (public.member_of(client_id)) with check (public.member_of(client_id));

drop policy if exists hs_member on hubspot_connections;
create policy hs_member on hubspot_connections for all using (public.member_of(client_id)) with check (public.member_of(client_id));

grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to postgres, anon, authenticated, service_role;
grant all on all sequences in schema public to postgres, anon, authenticated, service_role;
grant all on all functions in schema public to postgres, anon, authenticated, service_role;
