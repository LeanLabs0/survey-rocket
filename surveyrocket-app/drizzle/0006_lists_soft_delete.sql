alter table surveys add column if not exists deleted_at timestamptz;
alter table surveys add column if not exists hs_signed_in_list_id text;
alter table surveys add column if not exists hs_completed_list_id text;
create index if not exists surveys_live_client_idx on surveys (client_id) where deleted_at is null;
alter table responses alter column completed_at drop not null;
