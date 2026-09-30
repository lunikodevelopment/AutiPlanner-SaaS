import {
  DAY_PART_HEADING,
  DAY_PART_LABEL,
  STATUS_ACCESSIBLE_LABEL,
  STATUS_SYMBOL,
  formatClock,
  groupAgenda,
  type DayPart,
  type RoutineItem,
  type RoutineStatus,
} from "@autiplanner/core";

// Date arithmetic lives in the domain package: the card needs it too, and a
// second copy is how the two would drift.
export { addDays } from "@autiplanner/core";

export interface RenderInput {
  readonly items: readonly RoutineItem[];
  readonly selectedDate: string;
  /** uids with a change still waiting to reach the server. */
  readonly queuedUids: ReadonlySet<string>;
}

export interface DaySection {
  readonly dayPart: DayPart;
  readonly heading: string;
  readonly items: readonly RoutineItem[];
}

/** Builds the four day-part sections for one date, empty ones included. */
export function sectionsFor(
  items: readonly RoutineItem[],
  date: string,
): readonly DaySection[] {
  const forDate = items.filter((item) => item.date === date);
  const grouped = groupAgenda(forDate, { includeEmpty: true });
  const day = grouped[0];
  if (day === undefined) {
    // groupAgenda returns nothing for a date with no items, so build the
    // headings here rather than duplicating how grouping works.
    return (["morning", "afternoon", "evening", "night"] as const).map((dayPart) => ({
      dayPart,
      heading: DAY_PART_HEADING[dayPart],
      items: [],
    }));
  }
  return day.sections.map((section) => ({
    dayPart: section.dayPart,
    heading: section.heading,
    items: section.items,
  }));
}

export function summaryOf(items: readonly RoutineItem[]): Record<RoutineStatus, number> {
  const summary: Record<RoutineStatus, number> = {
    pending: 0,
    completed: 0,
    missed: 0,
    skipped: 0,
  };
  for (const item of items) summary[item.status] += 1;
  return summary;
}

export function formatDayHeading(date: string, today: string): string {
  if (date === today) return "Today";
  const [year, month, day] = date.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
}


export function todayIso(): string {
  const now = new Date();
  // Local calendar day, not the UTC one.
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

export function clockOf(item: RoutineItem): string | undefined {
  const timestamp = item.start ?? item.due;
  if (timestamp === undefined) return undefined;
  return formatClock(timestamp);
}

export type ItemAction = "complete" | "mark_missed" | "skip" | "reset";

/** The single tap action for a row, or null when there is nothing sensible. */
export function primaryAction(status: RoutineStatus): ItemAction | null {
  if (status === "completed") return "reset";
  if (status === "pending") return "complete";
  // Missed and skipped were deliberate; tapping again returns to pending.
  return "reset";
}

export interface RowHandlers {
  readonly onAction: (item: RoutineItem, action: ItemAction) => void;
}

/**
 * Renders one row.
 *
 * Status is always a glyph *and* a word, so it never depends on colour. Each
 * control carries an accessible name that includes the item title.
 */
export function renderRow(
  item: RoutineItem,
  queued: boolean,
  handlers: RowHandlers,
  document_: Document = document,
): HTMLLIElement {
  const row = document_.createElement("li");
  row.className = "item";
  row.dataset.status = item.status;

  const glyph = document_.createElement("span");
  glyph.className = "glyph";
  glyph.setAttribute("aria-hidden", "true");
  glyph.textContent = STATUS_SYMBOL[item.status];
  row.append(glyph);

  const main = document_.createElement("span");
  const title = document_.createElement("span");
  title.className = "title";
  title.textContent = item.title;
  main.append(title);

  const meta = document_.createElement("span");
  meta.className = "item-quiet";
  const words = STATUS_ACCESSIBLE_LABEL[item.status];
  const clock = clockOf(item);
  meta.textContent = clock === undefined ? words : `${words} · ${clock}`;
  main.append(document_.createElement("br"), meta);
  row.append(main);

  if (queued) {
    const pending = document_.createElement("span");
    pending.className = "queued";
    pending.textContent = "not synced";
    pending.title = "This change has not reached the server yet";
    row.append(pending);
  } else {
    row.append(document_.createElement("span"));
  }

  const actions = document_.createElement("span");
  actions.className = "actions";

  const primary = primaryAction(item.status);
  if (primary !== null) {
    actions.append(actionButton(document_, item, primary, handlers.onAction, true));
  }

  const menuWrap = document_.createElement("span");
  const menu = document_.createElement("select");
  menu.setAttribute("aria-label", `More outcomes for ${item.title}`);
  const placeholder = document_.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "More";
  menu.append(placeholder);
  for (const action of ["complete", "mark_missed", "skip", "reset"] as const) {
    if (action === primary) continue;
    const option = document_.createElement("option");
    option.value = action;
    option.textContent = labelFor(action);
    menu.append(option);
  }
  menu.addEventListener("change", () => {
    const value = menu.value as ItemAction | "";
    menu.value = "";
    if (value !== "") handlers.onAction(item, value);
  });
  menuWrap.append(menu);
  actions.append(menuWrap);
  row.append(actions);

  return row;
}

export function labelFor(action: ItemAction): string {
  switch (action) {
    case "complete":
      return "Mark completed";
    case "mark_missed":
      return "Mark missed";
    case "skip":
      return "Mark skipped";
    case "reset":
      return "Reset to pending";
  }
}

function actionButton(
  document_: Document,
  item: RoutineItem,
  action: ItemAction,
  onAction: RowHandlers["onAction"],
  primary: boolean,
): HTMLButtonElement {
  const button = document_.createElement("button");
  button.type = "button";
  button.className = primary ? "" : "secondary";
  const label = labelFor(action);
  button.textContent = primary ? STATUS_SYMBOL[item.status === "pending" ? "completed" : "pending"] : "•";
  button.setAttribute("aria-label", `${label}: ${item.title}`);
  button.title = label;
  button.addEventListener("click", () => onAction(item, action));
  return button;
}

export function dayPartLabel(dayPart: DayPart): string {
  return DAY_PART_LABEL[dayPart];
}
