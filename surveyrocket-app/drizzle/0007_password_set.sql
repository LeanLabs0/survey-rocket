-- Pending invites create an auth user so we can email them. Accepted means they
-- chose a password. Clicking the email link alone must not count as accepted.
alter table profiles add column if not exists password_set_at timestamptz;

-- People who already signed in through the app have a password.
update profiles p
set password_set_at = s.first_seen
from (
  select user_id, min(created_at) as first_seen
  from user_sessions
  group by user_id
) s
where s.user_id = p.id
  and p.password_set_at is null;

-- Invited users have no password hash. Anyone who does already finished setup.
update profiles p
set password_set_at = coalesce(u.last_sign_in_at, now())
from auth.users u
where u.id = p.id
  and p.password_set_at is null
  and coalesce(u.encrypted_password, '') <> '';
