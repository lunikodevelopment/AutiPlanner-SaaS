# AutiPlanner card

A Lovelace card for the AutiPlanner routine: see what the day holds, record an
item as completed, missed, or skipped, and add a new item without leaving the
dashboard.

This repository holds the built card. The source lives with the rest of the
project in
[AutiPlanner-SaaS](https://github.com/lunikodevelopment/AutiPlanner-SaaS), in
`apps/card`, and is published here on release.

## Install

1. **HACS → ⋮ → Repositories → Add custom repository**
2. Repository: `https://github.com/lunikodevelopment/AutiPlanner-Card`
3. **Category: Dashboard**
4. **Add**, then install **AutiPlanner card**

HACS registers the card as a dashboard resource. Then add it:

```yaml
type: custom:autiplanner-card
entity: sensor.routine_agenda
```

The card needs the **AutiPlanner (hosted)** integration to be installed and set
up, because it draws that integration's agenda sensor and acts through its
actions. It holds no AutiPlanner credential of its own.

Adding an item needs only a title and a day part: the date is optional and
defaults to today, and a time is optional too. **Repeats** offers *Just once*,
*Every day*, and *Every week*; a weekly repeat lands on the weekday of the date
you chose, and a repeating day is marked with ↻. Tapping ↻ asks before removing
the repeat, because that removes every day it falls on.

**Icons** offers a set of pictures drawn from
[Phosphor Icons](https://phosphoricons.com) — teeth, medication, meals, laundry,
the school run, appointments — with the meaning written on each so the choice is
what the household is trying to say rather than the name of a drawing. The icons
are built into this card and need nothing else installed.

Each routine also offers a remove control, which asks before it acts. Removing a
day of a repeat removes that day and leaves the rest of the repeat; the ↻ control
is the one that ends it.

| Option | Default | Meaning |
|---|---|---|
| `entity` | first `*_agenda` sensor | The agenda sensor to draw and send actions to |
| `days` | `1` | How many days to show, from today (1–7) |
| `show_add` | `true` | Show the add-item button and form |
| `show_summary` | `true` | Show the per-day outcome counts |
| `title` | `AutiPlanner` | Card heading |

Full guide, including accessibility notes and troubleshooting:
[`docs/HA_CARD.md`](https://github.com/lunikodevelopment/AutiPlanner-SaaS/blob/main/docs/HA_CARD.md).

MIT licensed, same as the project it belongs to.
