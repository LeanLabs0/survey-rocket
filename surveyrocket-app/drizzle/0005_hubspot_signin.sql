alter table hubspot_connections add column if not exists signin_form_id text;
alter table respondents add column if not exists company text;
alter table respondents add column if not exists website text;
