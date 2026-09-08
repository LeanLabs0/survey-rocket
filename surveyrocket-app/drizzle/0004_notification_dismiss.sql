alter table notification_reads add column if not exists dismissed_at timestamptz;
