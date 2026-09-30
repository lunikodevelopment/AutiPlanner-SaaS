# The AutiPlanner dashboard card

A Lovelace card for the hosted integration: it shows the routine for the day and
lets you change an item's outcome or add a new one without opening the web app.

The card is a **view over the integration**, not a second client. It reads the
agenda sensor the integration already polls and changes state through the
integration's actions, so no AutiPlanner credential ever reaches the browser and
the server keeps a single writer.

The card ships from its own repository,
[`AutiPlanner-Card`](https://github.com/lunikodevelopment/AutiPlanner-Card),
because a HACS repository is added with a single category and an integration and
a dashboard card are different categories. Its source is here, in `apps/card`,
and is published to that repository on release.

## Install

1. **HACS → ⋮ → Repositories → Add custom repository**.
2. Repository: `https://github.com/lunikodevelopment/AutiPlanner-Card`
3. **Category: Dashboard** — HACS calls plugins "Dashboard" in this list, even
   though the underlying category is `plugin`.
4. **Add**, then install **AutiPlanner card** from the **Dashboard** section.

This repository is added separately, as an **Integration**, for the integration
itself. Two repositories, two entries, no tricks.

HACS registers the card as a dashboard resource for you. If it cannot (a
YAML-mode dashboard, or a Lovelace that is not in storage mode) it says so in the
log; add the resource by hand under **Settings → Dashboards → ⋮ → Resources**:

```text
/url /hacsfiles/AutiPlanner-Card/autiplanner-card.js?v=1
```

The integration must be installed and set up first — see
[`HA_INTEGRATION.md`](HA_INTEGRATION.md). The card needs the integration's
agenda sensor to have something to draw.

## Add it to a dashboard

**Settings → Dashboards → Edit → Add card → AutiPlanner card**, which fills in the
sensor by itself, or in YAML:

```yaml
type: custom:autiplanner-card
entity: sensor.routine_agenda
```

## Options

| Option | Default | Meaning |
|---|---|---|
| `entity` | first `*_agenda` sensor | The agenda sensor to draw and to send actions to |
| `days` | `1` | How many days to show, starting today (1–7) |
| `show_add` | `true` | Show the add-item button and its form |
| `show_summary` | `true` | Show the per-day outcome counts |
| `title` | `AutiPlanner` | Card heading |

```yaml
type: custom:autiplanner-card
entity: sensor.routine_agenda
days: 3
title: Routine
```

More than one calendar means one card each, pointing at its own sensor.

## What it does

- **Outcomes.** A pending item offers ✓ completed, ✕ missed, and — skipped. A
  decided item offers only ↺ back to pending, because the four states are
  mutually exclusive and there is no "complete a missed item".
- **Add an item.** Title, day part, and optionally a date, a time, and whether
  it repeats. The date is optional and an empty one means **today**, which is
  where the web app puts an item too: it adds to the day you are looking at
  rather than asking. A time is stored as a floating local clock, so it follows
  the household's own timezone rather than the server's.
- **Repeat it.** **Repeats** offers *Just once*, *Every day*, and *Every week*.
  A weekly repeat lands on the weekday of the date you chose, so it needs no
  second question, and the form says which day that is. Either way the server
  stores a **rule**, not a pile of days, and expands it for whatever is being
  read. A day that repeats is marked with ↻.
- **Stop a repeat.** Tapping ↻ asks first, because removing a repeat removes
  every day it falls on, including the ones already recorded. One stray tap on a
  shared dashboard must not undo a routine. Tapping ↻ on a single day and
  recording an outcome there affects only that day.
- **Immediate.** Each action calls the integration, then asks the coordinator to
  poll now, so a change is on screen in about a second rather than at the next
  poll interval. The row updates optimistically first, and the local state is
  dropped as soon as the server's answer matches.
- **Honest about problems.** Import issues from the server are shown, and a
  failed action is reported in the card rather than failing silently.

Deleting an item is deliberately **not** on the card. One tap on a shared
dashboard should not be able to remove a routine item; `autiplanner_saas.delete`
remains available to automations.

## Accessibility

The product exists to reduce the load of deciding what is done, so the card is
built to be readable at a glance and usable by someone who is tired or
overstimulated:

- Status is a **glyph and a word** — `✓ Completed`, `✕ Missed` — never colour
  alone.
- Every button's accessible name includes the item, e.g. *"Mark Take medication
  completed"*, so a screen reader does not announce five identical buttons.
- Touch targets are at least 40 px, and the buttons are the full row height.
- Card colours come from the dashboard theme, so the card follows light and dark
  mode and the active theme.

## Troubleshooting

**The card is not offered when adding a card.** HACS did not install it as a
dashboard resource. Check **HACS → Dashboard** shows AutiPlanner, and check
**Settings → Dashboards → ⋮ → Resources** for the URL above. Hard-refresh the
browser afterwards.

**"No AutiPlanner agenda sensor found."** The integration is not set up, or the
`entity` in the YAML points at an entity that does not exist. The entity is
named after the calendar: `sensor.<calendar name>_agenda`. Leave `entity` out
and the card finds it.

**A tap does nothing.** The action failed and the card should say why. If it is
silent, check **Settings → System → Logs** for the integration, and that the
server is reachable — the same checks as
[the integration guide](HA_INTEGRATION.md#troubleshooting).

**Two cards show different data.** They point at different calendars, which is
correct if you have more than one. If not, one of them names the wrong `entity`.

## Working on the card

```bash
pnpm --filter @autiplanner/card test    # jsdom run of the real element
pnpm --filter @autiplanner/card build   # writes autiplanner-card.js
./tools/sync-card-repo.sh               # publishes it to AutiPlanner-Card
```

`autiplanner-card.js` at the repository root is build output that is committed:
it is the artifact compared against what `AutiPlanner-Card` serves, so CI fails
if the two differ. `apps/card/repo/` holds the card repository's own `hacs.json`,
`README.md`, and `LICENSE`; the sync script assembles those with the bundle and
pushes the result.
