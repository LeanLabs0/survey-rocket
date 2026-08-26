# Survey Rocket: HubSpot portal setup

**For:** the HubSpot admin at the client (NFI first).
**Date:** 2026-08-26.

Nothing in Survey Rocket works until every box below is ticked. Work top to bottom. Fifteen steps, about half an hour.

## Before anything else

**1. Confirm the portal has Marketing Hub Professional or Enterprise.**
Without it there are no workflows, so there is no goal, so there is no way to stop the reminder emails automatically. Ralph can check this from the token once step 5 is done.

**2. Confirm the reminders are built as a workflow, not a Sales Hub sequence.**
A sequence has no goal concept. It unenrolls on reply, bounce, or a booked meeting, and there is no way to say "this person answered, stop emailing them". If the reminders are a sequence today, they have to be rebuilt as a workflow. **This is the single biggest risk to the launch date, so answer it first.**

## The private app

**3.** Settings, then Integrations, then Private Apps, then Create a private app. Name it `Survey Rocket`.

**4.** Grant exactly these scopes and no others:

- `crm.objects.contacts.read`
- `crm.objects.contacts.write`
- `crm.schemas.contacts.write`
- `crm.objects.notes.write`

The third one lets the backend create a completion property per survey instead of you hand-creating one every time. Skip it only if you will hand-create every property below and only ever run one survey. The fourth is needed only if you want the answers to appear in the contact's timeline.

**5.** Copy the token. HubSpot shows it once. Send it to Ralph through 1Password or a Slack DM. **Never paste it into a ClickUp task, a shared doc, or an email.**

## The properties

Settings, then Properties, then Contact properties, then Create property. Put them in the Contact information group.

| # | Internal name | Label | Field type |
|---|---|---|---|
| 6 | `sr_survey_url` | Survey Rocket survey link | Single-line text |
| 7 | `sr_last_survey_id` | Survey Rocket last survey | Single-line text |
| 8 | `sr_last_completed_at` | Survey Rocket last completed | Date picker |
| 9 | `sr_response_id` | Survey Rocket last response ID | Single-line text |
| 10 | `sr_quote_permission` | Survey Rocket quote permission | Dropdown select |
| 11 | `sr_completed__<survey>` | Survey Rocket completed: \<name\> | **Date picker** |

For step 10, the dropdown options are exactly these four, lowercase: `approved`, `declined`, `private feedback`, `none`.

For step 11, repeat once per survey, using the exact internal name Ralph gives you. **One property per survey, not one shared flag.** A shared flag breaks the moment a customer is enrolled in a second survey: they would meet the second survey's goal at the instant they are enrolled, drop straight out, and never receive the email. It looks like "the second survey just doesn't send" and it takes a day to find.

## The workflow

**12. Set the goal.** Open the reminder workflow, then Settings, then Goal, then "Contacts who meet these filters". Choose `Survey Rocket completed: <survey name>` and the operator **is known**. Save.

Use `is known`, not `equals`. It is idempotent, needs no value parsing, and is the hardest version to misconfigure.

**13. Add the same filter as an unenrollment trigger.** Enrollment triggers, then Unenrollment and suppression, then "Unenroll contacts when they meet these filters", same filter. The goal is the main mechanism; this covers the case where someone answers while an email is already sitting in a delay step.

**14. Point the survey button at the property, not at a URL.** In the invite email and every reminder, the button links to `{{ contact.sr_survey_url }}`.

**This one matters.** A hardcoded URL means every recipient submits as whichever contact the link was made for. Everyone's answers land on one person and the reminders never stop for anybody else.

## Before you send

**15. Ralph runs the mint job** so `sr_survey_url` is filled in on every enrolled contact. Any contact with a blank `sr_survey_url` gets a broken link. Spot-check five contacts before the first send.

## If something looks wrong

- **Reminders keep sending after someone answered.** Check the goal filter is on the right property, and that the property is a Date picker rather than text.
- **Everyone's answers land on one contact.** Step 14 was missed. The email is using a hardcoded URL.
- **The link says the survey is not valid.** That contact's `sr_survey_url` is blank, or the token has expired. Ask Ralph to re-mint.
