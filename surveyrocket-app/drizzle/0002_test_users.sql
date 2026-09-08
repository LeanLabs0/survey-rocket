-- Privileges for API roles, plus Lean Labs test accounts.
-- Run after 0000_init.sql / 0001_seed.sql, and after the two Auth users exist.

grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to postgres, anon, authenticated, service_role;
grant all on all sequences in schema public to postgres, anon, authenticated, service_role;
grant all on all functions in schema public to postgres, anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to postgres, anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to postgres, anon, authenticated, service_role;

insert into public.profiles (id, email, full_name, is_superadmin)
select
  u.id,
  u.email,
  coalesce(u.raw_user_meta_data->>'full_name', ''),
  u.email = 'edward+admin@lean-labs.com'
from auth.users u
where u.email in ('edward+admin@lean-labs.com', 'edward@lean-labs.com')
on conflict (id) do update
  set email = excluded.email,
      full_name = excluded.full_name,
      is_superadmin = excluded.is_superadmin;

insert into public.client_members (user_id, client_id, role)
select p.id, c.id, 'owner'
from public.profiles p
join public.clients c on c.slug = 'lean-labs'
where p.email = 'edward@lean-labs.com'
on conflict do nothing;
