import type { DayPart, RoutineItem, RoutineStatus } from "./model.js";
import { weekdayName } from "./time.js";

/** Canonical glyphs. Status is never communicated by color alone. */
export const STATUS_SYMBOL: Readonly<Record<RoutineStatus, string>> = {
  pending: "○",
  completed: "✓",
  missed: "✕",
  skipped: "—",
};

/** Accessible names for the four outcomes. These are not a boolean. */
export const STATUS_ACCESSIBLE_LABEL: Readonly<Record<RoutineStatus, string>> = {
  pending: "Pending",
  completed: "Completed",
  missed: "Missed",
  skipped: "Skipped",
};

export const DAY_PART_HEADING: Readonly<Record<DayPart, string>> = {
  morning: "MORNING",
  afternoon: "AFTERNOON",
  evening: "EVENING",
  night: "NIGHT",
};

export const DAY_PART_LABEL: Readonly<Record<DayPart, string>> = {
  morning: "Morning",
  afternoon: "Afternoon",
  evening: "Evening",
  night: "Night",
};

export function statusAccessibleName(
  item: Pick<RoutineItem, "title" | "status">,
): string {
  return `${STATUS_ACCESSIBLE_LABEL[item.status]}: ${item.title}`;
}

export function itemAccessibleName(
  item: Pick<RoutineItem, "title" | "status" | "dayPart">,
): string {
  return `${DAY_PART_LABEL[item.dayPart]}, ${statusAccessibleName(item)}`;
}

/**
 * Renders the clock carried by a timestamp without converting zones.
 * UTC stays UTC. A floating local time stays an unzoned clock.
 */
export function formatClock(timestamp: string): string | undefined {
  const match =
    /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}):(\d{2})(Z|[+-]\d{2}:\d{2})?$/.exec(
      timestamp,
    );
  const clock = match?.[2];
  if (!clock) return undefined;
  const zone = match?.[4];
  if (zone === "Z") return `${clock} UTC`;
  if (zone) return `${clock} ${zone}`;
  return clock;
}

/**
 * The weekday in words, for a sentence rather than a heading.
 *
 * `weekdayName` returns the domain's enum form ("WEDNESDAY"); this is what a
 * person reads ("Wednesday").
 */
export function weekdayLabel(date: string): string | undefined {
  const name = weekdayName(date);
  if (name === undefined) return undefined;
  return name[0] + name.slice(1).toLowerCase();
}
