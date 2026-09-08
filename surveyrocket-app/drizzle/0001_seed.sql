-- Seed Lean Labs + two sample surveys. Safe to run more than once.

insert into clients (slug, name, brand)
values ('lean-labs', 'Lean Labs', '{"color":"#00D492"}'::jsonb)
on conflict (slug) do nothing;

insert into surveys (client_id, public_id, slug, name, cadence, status, settings, provenance, definition)
select
  c.id,
  'lloutcomes',
  'client-outcomes',
  'Client outcomes',
  '90 day',
  'Active',
  '{"require_contact":false,"show_results":true,"review_ask":true,"review_links":{"google":"https://g.page/r/lean-labs/review"}}'::jsonb,
  '{"source":"template","drafted_by":null,"approved_by":"Ralph","approved_at":"2026-09-01"}'::jsonb,
  '{"schema_version":1,"id":"client-outcomes","name":"Client outcomes","cadence":"90 day","status":"Active","intro":null,"outro":null,"settings":{"require_contact":false,"show_results":true,"review_ask":true,"review_links":{"google":"https://g.page/r/lean-labs/review"}},"questions":[{"id":"service","type":"choice","q":"Which Lean Labs program are you on?","options":["AEO program","Website Launchpad","Growth retainer","Other"]},{"id":"leads","type":"number","q":"About how many qualified leads per month does your site produce now?","min":0,"max":10000},{"id":"pipeline","type":"choice","q":"Compared with before working with us, how has qualified pipeline changed?","options":["Down","Flat","Up to 25% up","26 to 75% up","More than 75% up"]},{"id":"changed","type":"text","optional":true,"q":"What changed most since we started? One sentence is plenty. Optional, type skip to move on."},{"id":"nps","type":"choice","nps":true,"q":"How likely are you to recommend Lean Labs to a peer?","options":["0","1","2","3","4","5","6","7","8","9","10"]}],"provenance":{"source":"template","drafted_by":null,"approved_by":"Ralph","approved_at":"2026-09-01"}}'::jsonb
from clients c
where c.slug = 'lean-labs'
  and not exists (select 1 from surveys s where s.client_id = c.id and s.slug = 'client-outcomes');

insert into surveys (client_id, public_id, slug, name, cadence, status, settings, provenance, definition)
select
  c.id,
  'llonboard1',
  'project-onboarding',
  'Project onboarding',
  'Day 30',
  'Active',
  '{"require_contact":false,"show_results":false,"review_ask":false,"review_links":{}}'::jsonb,
  '{"source":"template","drafted_by":null,"approved_by":"Ralph","approved_at":"2026-09-01"}'::jsonb,
  '{"schema_version":1,"id":"project-onboarding","name":"Project onboarding","cadence":"Day 30","status":"Active","intro":null,"outro":null,"settings":{"require_contact":false,"show_results":false,"review_ask":false,"review_links":{}},"questions":[{"id":"clarity","type":"choice","q":"How clear was the kickoff process?","options":["Very unclear","Unclear","Neutral","Clear","Very clear"]},{"id":"speed","type":"choice","q":"How was the pace of the first 30 days?","options":["Too slow","About right","Too fast"]},{"id":"wish","type":"text","optional":true,"q":"Anything you wish you had known on day one? Optional, type skip to move on."}],"provenance":{"source":"template","drafted_by":null,"approved_by":"Ralph","approved_at":"2026-09-01"}}'::jsonb
from clients c
where c.slug = 'lean-labs'
  and not exists (select 1 from surveys s where s.client_id = c.id and s.slug = 'project-onboarding');

insert into survey_publications (survey_id, version, definition)
select s.id, 1, s.definition
from surveys s
join clients c on c.id = s.client_id
where c.slug = 'lean-labs'
  and not exists (select 1 from survey_publications p where p.survey_id = s.id);
