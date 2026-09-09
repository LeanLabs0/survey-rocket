-- Wipe all clients, surveys, answers, and users except edward+admin@lean-labs.com.
-- Run in the Supabase SQL editor. This cannot be undone.

begin;

do $$
declare
  keep_id uuid;
begin
  select id into keep_id
  from auth.users
  where email = 'edward+admin@lean-labs.com';

  if keep_id is null then
    raise exception 'No auth user edward+admin@lean-labs.com — aborting so we do not wipe everyone.';
  end if;

  update public.profiles
  set is_superadmin = true
  where id = keep_id;

  -- publication_id has no ON DELETE; clear it before dropping surveys.
  update public.responses set publication_id = null, respondent_id = null;

  delete from public.answers;
  delete from public.responses;
  delete from public.survey_publications;
  delete from public.surveys;
  delete from public.respondents;
  delete from public.scans;
  delete from public.notification_reads;
  delete from public.notifications;
  delete from public.hubspot_connections;
  delete from public.client_members;
  delete from public.clients;

  delete from public.user_sessions where user_id <> keep_id;
  delete from public.user_passkeys where user_id <> keep_id;
  delete from public.profiles where id <> keep_id;
  delete from auth.users where id <> keep_id;
end $$;

commit;
