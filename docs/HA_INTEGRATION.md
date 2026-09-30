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

> **HACS installs only this integration, not the server.** A custom integration
> is Python code inside Home Assistant; it cannot install or start a container.
> The server is a separate Home Assistant **app** that you install and start
> yourself, as below.

## Run the server

The integration is a client. A server must be running before you add it.

### On Home Assistant OS (the app)

Add this repository as an app repository, install the app, and **start it**:

[![Open your Home Assistant instance and show the app repository dialog with this repository pre-filled.](https://my.home-assistant.io/badges/supervisor_add_addon_repository.svg)](https://my.home-assistant.io/redirect/supervisor_add_addon_repository/?repository_url=https%3A%2F%2Fgithub.com%2Flunikodevelopment%2FAutiPlanner-SaaS)

1. **Settings → Apps → ⋮ → Repositories**, add
   `https://github.com/lunikodevelopment/AutiPlanner-SaaS`.
2. Install **AutiPlanner (hosted)**.
3. **Press Start.** A newly installed app stays stopped; it does not run by
   itself, and it only starts automatically at the next Home Assistant boot.

If the app is missing or stopped, the integration raises a **repair** that says
so, rather than leaving entities quietly stale.

### Anywhere else

Run the container with Docker (see the repository README) and point the
integration at its address.

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

To work through the routine from a dashboard rather than the web app, install
the card that ships in this same repository: see
[`HA_CARD.md`](HA_CARD.md). It reads the agenda sensor and acts through the
actions below.

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

The feed is a calendar-friendly projection: the server stores the routine as
`VTODO`, which Apple Calendar and Google Calendar do not draw in a subscription,
so the feed emits `VEVENT`s. The four-state outcome stays in
`X-AUTIPLANNER-OUTCOME` and in the summary glyph (`✓` completed, `○` pending,
`✕` missed, `—` skipped).

### Keeping it in sync

The refresh rate is the calendar app's, not the server's:

- **Apple Calendar (macOS)**: the subscription's **Auto-refresh** offers every
  **5 minutes** at the fastest; there is no one-minute option. Right-click the
  calendar → **Get Info** → **Auto-refresh**.
- **Apple Calendar (iPhone/iPad)**: no per-subscription interval; it follows
  **Settings → Calendar → Accounts → Fetch New Data** (15 minutes at the
  fastest, and battery-gated).
- **Google Calendar**: subscribed feeds refresh every **12–24 hours**, and this
  cannot be changed.

The server does its part: every request is revalidated with an `ETag`, and a
poll with no changes is a `304 Not Modified`, so even a client asking every
minute is cheap. The feed also advertises `REFRESH-INTERVAL;VALUE=DURATION:PT1M`,
which a few clients honour.

For updates inside Home Assistant within a minute, use the integration rather
than a subscription. It polls the API directly on **Poll interval** (default 60
seconds, minimum 15), so entities and automations see a change inside a minute.
Set it under **Settings → Devices & services → AutiPlanner (hosted) →
Configure**.

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

`create` takes the core contract in snake_case: `uid`, `title`, `date`,
`day_part`, and optionally `status`, `start`, `due`, `description`, `timezone`,
`order`. `uid` is required and must be unique in the calendar, so derive it
rather than counting.

```yaml
action: autiplanner_saas.create
target:
  entity_id: sensor.routine_agenda
data:
  uid: "medication-20260930@example"
  title: "Take morning medication"
  date: "2026-09-30"
  day_part: morning
  start: "2026-09-30T08:30:00"
```

A `start` or `due` with no offset is a floating local time: it is the
household's own clock, and travels correctly across a timezone change. Add
`timezone` only if the item really belongs to a named zone.

## Options

**Settings → Devices & services → AutiPlanner (hosted) → Configure** changes:

- **Days either side of today** — how much the agenda sensors cover (1–45).
- **Poll interval** — how often the server is asked for changes (15–3600s).
- **Calendar** — switch to another of your calendars, when you have more than one.

## When the session expires

The server can revoke a token. Home Assistant notices on the next poll and asks
for the password again; the entities keep their last known state until then.

## Troubleshooting

**I installed it through HACS and nothing runs.** HACS installs the integration
only, and it cannot start a container. Install and **start** the app, or run the
server elsewhere, then add the integration.

**The integration says "Could not reach the server".** The server is not
running, or the address is wrong. If you use the app, open **Settings → Apps →
AutiPlanner (hosted)** and press **Start**; if it stops straight away, check its
log.

**A repair says the server is unreachable.** The same cause. The repair clears
itself once a poll succeeds.

**A build fails with `qemu: uncaught target signal 4 (Illegal instruction)`.**
You are building the image for a different CPU than the machine you are on. The
app does not need a build; it pulls a published multi-architecture image. Pull
the matching architecture (`--platform linux/amd64`, or `linux/arm64` for a Pi)
instead, or run the build on a host with that CPU.

## Known limits

- The integration polls; it does not hold a push connection to the server.
- A conflict is not merged. The server is authoritative, so the action is
  rejected and must be retried with the current revision.
- There is no to-do entity. Home Assistant's to-do model can only store
  completed or not completed, which cannot express a missed or skipped routine.
