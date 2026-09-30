# Home Assistant integration (hosted API)

This is the client integration for the **hosted** AutiPlanner. It talks to the
AutiPlanner API over HTTP; it does not own a calendar file.

There are two sibling setups, and they are different on purpose:

| | Owns the data | Talks to | Repository |
|---|---|---|---|
| `custom_components/autiplanner` | a local `.ics` file | nothing | [AutiPlanner](../AutiPlanner) |
| `custom_components/autiplanner_saas` (this) | no | the hosted API | [AutiPlanner-SaaS](https://github.com/lunikodevelopment/AutiPlanner-SaaS) |

Both expose the same domain contract: a routine item belongs to a day and a day
part and has one of four outcomes — `pending`, `completed`, `missed`, `skipped`.
A missed item is never stored as completed on either side.

## Install

### With HACS

1. **HACS → ⋮ → Custom repositories**, add
   `https://github.com/lunikodevelopment/AutiPlanner-SaaS` as **Integration**.
2. Search HACS for **AutiPlanner (hosted)** and download it.
3. **Restart Home Assistant.**

### Without HACS

```bash
# Replace /config with your Home Assistant config directory
cp -r custom_components/autiplanner_saas /config/custom_components/autiplanner_saas
```

The result must be
`/config/custom_components/autiplanner_saas/manifest.json`.

## Run the server

Either run the server somewhere of your own (see the repository README), or
install the companion Home Assistant app, which runs it on your Home Assistant
box. The app is the easiest option; see
[`../autiplanner_saas/DOCS.md`](../autiplanner_saas/DOCS.md).

## Add the integration

1. **Settings → Devices & services → Add integration.**
2. Search for **AutiPlanner (hosted)**.
3. Choose **Sign in to an existing account** or **Create a new account**.
4. Enter the server address, email, and password. The address is where the API
   is served, for example `http://homeassistant.local:8080` for the app.
5. If the account has more than one calendar, choose which one this entry
   should track.

The sign-in is verified before the entry is created, so a wrong address or
password is a form error rather than a broken entry. Adding the integration again
for another calendar is allowed.

## Entities

Replace `routine` with the slug of the calendar name you chose.

| Entity | Purpose |
|---|---|
| `calendar.routine` | Standard calendar view of the routine |
| `sensor.routine_today` | Today's items |
| `sensor.routine_agenda` | The agenda across the poll window |
| `sensor.routine_calendar_issues` | Import problems from the server, `0` when clean |

On the agenda sensors the **state is the number of items** and `items` is the
full list. Each entry carries a `dayPart` and one of the four `status` values.
The `calendar.routine` entity also exposes the read-only subscription URL as
`feed_url` (see below).

## Subscribe in Google Calendar or Apple Calendar

The server publishes a read-only `.ics` feed per calendar.

- **Google Calendar**: **Other calendars → + → From URL**, paste the `feed_url`.
- **Apple Calendar**: **File → New Calendar Subscription**, paste the `feed_url`.

Copy `feed_url` from the calendar entity:

```jinja
{{ state_attr('calendar.routine', 'feed_url') }}
```

The URL embeds a secret token. Rotating it (in the web app, or
`POST /api/calendars/<id>/feed/rotate`) invalidates the old URL, so re-add it
wherever it was used.

## Actions

The integration registers these actions, named as in the on-device integration.

| Action | Purpose |
|---|---|
| `autiplanner_saas.complete` | Mark an item completed |
| `autiplanner_saas.mark_missed` | Record that an item was not done |
| `autiplanner_saas.skip` | Record that an item was intentionally skipped |
| `autiplanner_saas.reset` | Return an item to pending |
| `autiplanner_saas.create` | Add a routine item |
| `autiplanner_saas.update` | Patch a routine item |
| `autiplanner_saas.delete` | Remove a routine item |

Every action accepts an optional `expected_revision`. When it does not match the
server's, the call fails with a conflict and nothing is written. Read the
current revision from the `revision` attribute of either agenda sensor.

```yaml
action: autiplanner_saas.mark_missed
target:
  entity_id: sensor.routine_today
data:
  uid: "exercise-20260811@example"
  expected_revision: 12
```

## Options

**Settings → Devices & services → AutiPlanner (hosted) → Configure** changes:

- **Days either side of today** — how much the agenda sensors cover (1–45).
- **Poll interval** — how often the server is asked for changes (15–3600s).
- **Calendar** — switch to another of your calendars, when you have more than one.

## When the session expires

The server can revoke a token. Home Assistant notices on the next poll and asks
for the password again; the entities keep their last known state until then.

## Known limits

- The integration polls; it does not hold a push connection to the server.
- A conflict is not merged. The server is authoritative, so the action is
  rejected and must be retried with the current revision.
- There is no to-do entity. Home Assistant's to-do model can only store
  completed or not completed, which cannot express a missed or skipped routine.
