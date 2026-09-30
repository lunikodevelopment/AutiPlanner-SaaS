/**
 * AutiPlanner dashboard card for Home Assistant.
 *
 * The card is a view over the integration rather than a second client: it reads
 * the agenda sensor the integration already polls, and it changes state through
 * the integration's actions. Nothing is fetched directly from the AutiPlanner
 * API and no credential ever reaches the browser, so the server stays
 * single-writer.
 *
 * Outcome and day part come from `@autiplanner/core`, the same package the PWA
 * and the integration use, so the four states cannot drift apart here.
 */
import {
  DAY_PART_HEADING,
  DAY_PARTS,
  STATUS_ACCESSIBLE_LABEL,
  STATUS_SYMBOL,
  WEEKDAY_CODES,
  formatClock,
  isCalendarDate,
  type DayPart,
  type RoutineItem,
  type RoutineStatus,
} from "@autiplanner/core";

const DOMAIN = "autiplanner_saas";
const CARD_TAG = "autiplanner-card";
const STATUSES: readonly string[] = ["pending", "completed", "missed", "skipped"];
const MAX_DAYS = 7;

interface EntityState {
  readonly state: string;
  readonly attributes: Readonly<Record<string, unknown>>;
  readonly last_updated?: string;
}

/** The slice of the Home Assistant frontend object this card uses. */
export interface HomeAssistantLike {
  readonly states: Readonly<Record<string, EntityState>>;
  readonly config: { readonly time_zone?: string | undefined };
  callService(
    domain: string,
    service: string,
    data?: Record<string, unknown>,
  ): Promise<unknown>;
}

interface ActionButton {
  readonly action: string;
  readonly next: RoutineStatus;
  readonly glyph: string;
  readonly word: string;
}

interface CardConfig {
  entity: string;
  days: number;
  showAdd: boolean;
  showSummary: boolean;
  title: string | null;
}

interface Draft {
  title: string;
  date: string;
  dayPart: DayPart;
  time: string;
  repeat: RepeatChoice;
}

/** What the add form offers. `none` keeps an item a one-off occurrence. */
export type RepeatChoice = "none" | "daily" | "weekly";

const REPEAT_LABEL: Readonly<Record<RepeatChoice, string>> = {
  none: "Just once",
  daily: "Every day",
  weekly: "Every week",
};

export class AutiPlannerCard extends HTMLElement {
  #root: ShadowRoot;
  #config: CardConfig = { entity: "", days: 1, showAdd: true, showSummary: true, title: null };
  #hass: HomeAssistantLike | null = null;
  /** Outcomes applied locally, so a tap feels immediate while the poll catches up. */
  #optimistic = new Map<string, RoutineStatus>();
  #signature = "";
  #busy = false;
  #message = "";
  #messageIsError = false;
  #editorOpen = false;
  #draft: Draft = { title: "", date: "", dayPart: "morning", time: "", repeat: "none" };
  /** The series whose removal is waiting to be confirmed, if any. */
  #confirmStop: string | null = null;

  constructor() {
    super();
    this.#root = this.attachShadow({ mode: "open" });
    this.#root.addEventListener("click", (event) => this.#onClick(event));
    this.#root.addEventListener("submit", (event) => this.#onSubmit(event));
    // Only `change`, not `input`: it fires when a field settles, which is when
    // the weekday sentence needs to catch up. Redrawing the whole form on every
    // keystroke would take the cursor out of the title field mid-word.
    this.#root.addEventListener("change", (event) => this.#onChange(event));
  }

  static getStubConfig(hass: HomeAssistantLike | undefined): Record<string, unknown> {
    return {
      type: `custom:${CARD_TAG}`,
      entity: (hass === undefined ? undefined : findAgendaEntity(hass)) ?? "sensor.routine_agenda",
      days: 1,
    };
  }

  static getConfigElement(): HTMLElement {
    // The YAML editor is the default; this keeps Lovelace from offering an
    // empty element picker for a card that has no custom config UI.
    const element = document.createElement("div");
    return element;
  }

  getCardSize(): number {
    return this.#config.showAdd ? 5 : 3;
  }

  setConfig(config: Record<string, unknown>): void {
    const days = typeof config["days"] === "number" ? Math.round(config["days"]) : 1;
    const title = config["title"];
    this.#config = {
      entity: typeof config["entity"] === "string" ? config["entity"].trim() : "",
      days: Math.min(Math.max(days, 1), MAX_DAYS),
      showAdd: config["show_add"] !== false,
      showSummary: config["show_summary"] !== false,
      title: typeof title === "string" && title.trim() !== "" ? title : null,
    };
  }

  set hass(hass: HomeAssistantLike) {
    this.#hass = hass;
    const signature = this.#signatureOf(hass);
    // Home Assistant sets `hass` on every state change, so only redraw when the
    // agenda we render from has actually moved.
    if (signature !== this.#signature) {
      this.#signature = signature;
      this.#render();
    }
  }

  // ------------------------------------------------------------- rendering

  #entityId(): string {
    if (this.#config.entity !== "") return this.#config.entity;
    return this.#hass === null ? "" : (findAgendaEntity(this.#hass) ?? "");
  }

  #signatureOf(hass: HomeAssistantLike): string {
    const entity = this.#config.entity;
    const found = entity === "" ? undefined : hass.states[entity];
    if (found === undefined) return `${entity}|missing`;
    const items = found.attributes["items"];
    const revision = found.attributes["revision"];
    return `${entity}|${found.state}|${String(revision)}|${Array.isArray(items) ? items.length : -1}`;
  }

  #render(): void {
    const hass = this.#hass;
    const entity = this.#entityId();
    const state = hass === null ? undefined : hass.states[entity];
    const items = readItems(state);
    this.#syncOptimistic(items);

    const today = localToday(hass?.config.time_zone);
    const days = Array.from({ length: this.#config.days }, (_, offset) => addDays(today, offset));
    const effective = items.map((item) => {
      const override = this.#optimistic.get(item.uid);
      return override === undefined ? item : { ...item, status: override };
    });

    const body =
      state === undefined
        ? `<div class="notice">No AutiPlanner agenda sensor found. Add the
             <strong>AutiPlanner (hosted)</strong> integration, then point this card at
             its agenda sensor.</div>`
        : days.map((date, index) => this.#renderDay(date, index, effective)).join("");

    const message = this.#message
      ? `<div class="message${this.#messageIsError ? " error" : ""}" role="status">${escape(this.#message)}</div>`
      : "";

    const issues = readIssues(state);
    const issuesHtml =
      issues.length === 0
        ? ""
        : `<div class="notice warn">Calendar issues: ${escape(issues.join(", "))}</div>`;

    this.#root.innerHTML = `
      <style>${STYLES}</style>
      <ha-card>
        <div class="bar">
          <div class="title">${escape(this.#config.title ?? "AutiPlanner")}</div>
          <div class="tools">
            <button type="button" class="tool" data-act="refresh" aria-label="Refresh the agenda">&#10227;</button>
            ${this.#config.showAdd ? `<button type="button" class="tool" data-act="toggle-add" aria-label="Add a routine item" aria-expanded="${this.#editorOpen}">&#65291;</button>` : ""}
          </div>
        </div>
        ${message}
        ${issuesHtml}
        ${this.#editorOpen ? this.#renderEditor(today) : ""}
        <div class="body">${body}</div>
      </ha-card>`;
  }

  #renderDay(date: string, index: number, items: readonly RoutineItem[]): string {
    const forDay = items.filter((item) => item.date === date);
    const summary = this.#config.showSummary ? renderSummary(forDay) : "";
    const parts = DAY_PARTS.map((dayPart) =>
      this.#renderPart(dayPart, forDay.filter((item) => item.dayPart === dayPart)),
    ).join("");
    const empty = forDay.length === 0 ? `<div class="empty">Nothing planned</div>` : "";
    return `<section class="day">
      <div class="day-bar">
        <span class="day-name">${escape(dayName(date, index))}</span>
        ${summary}
      </div>
      ${parts}
      ${empty}
    </section>`;
  }

  #renderPart(dayPart: DayPart, items: readonly RoutineItem[]): string {
    if (items.length === 0) return "";
    const rows = items.map((item) => this.#renderItem(item)).join("");
    return `<div class="part">
      <div class="part-label">${escape(DAY_PART_HEADING[dayPart])}</div>
      <ul class="items">${rows}</ul>
    </div>`;
  }

  #renderItem(item: RoutineItem): string {
    const status = item.status;
    const clock = formatClock(item.start ?? item.due ?? "");
    const meta = [STATUS_ACCESSIBLE_LABEL[status], clock].filter((part) => part !== undefined && part !== "").join(" · ");
    const disabled = this.#busy ? " disabled" : "";
    const buttons = actionsFor(status)
      .map(
        (button) =>
          `<button type="button" class="act" data-act="${button.action}" data-uid="${escape(item.uid)}"${disabled}
             aria-label="Mark ${escape(item.title)} ${escape(button.word)}">${button.glyph}</button>`,
      )
      .join("");
    const repeat =
      item.routineId === undefined
        ? ""
        : `<button type="button" class="repeat" data-act="stop-repeat" data-series="${escape(item.routineId)}"
             aria-label="Stop repeating ${escape(item.title)}">&#8635;</button>`;
    // Stopping a repeat removes every day it falls on, so the first tap only
    // asks. One stray tap on a shared dashboard must not undo a routine.
    const acts =
      item.routineId !== undefined && this.#confirmStop === item.routineId
        ? `<span class="confirm" role="status">
             <span class="confirm-text">Stop repeating?</span>
             <button type="button" class="act" data-act="stop-repeat-yes" data-series="${escape(item.routineId)}" aria-label="Yes, stop repeating ${escape(item.title)}">Yes</button>
             <button type="button" class="act" data-act="stop-repeat-no" aria-label="Keep repeating ${escape(item.title)}">No</button>
           </span>`
        : `<span class="acts">${buttons}</span>`;
    return `<li class="item" data-status="${status}"${item.routineId === undefined ? "" : ` data-series="${escape(item.routineId)}"`}>
      <span class="glyph" aria-hidden="true">${STATUS_SYMBOL[status]}</span>
      <span class="main">
        <span class="name">${escape(item.title)}${repeat}</span>
        <span class="meta">${escape(meta)}</span>
      </span>
      ${acts}
    </li>`;
  }

  #renderEditor(today: string): string {
    const draft = this.#draft;
    const date = draft.date === "" ? today : draft.date;
    const options = DAY_PARTS.map(
      (dayPart) =>
        `<option value="${dayPart}"${dayPart === draft.dayPart ? " selected" : ""}>${escape(DAY_PART_HEADING[dayPart])}</option>`,
    ).join("");
    const repeats = (Object.keys(REPEAT_LABEL) as RepeatChoice[])
      .map((choice) => {
        // The weekly option names the weekday it would land on, from the date
        // the form is showing. `#onChange` keeps that word current as the date
        // is edited, without redrawing the form under the household's cursor.
        const label =
          choice === "weekly" ? `Every ${weekdayName(isCalendarDate(date) ? date : today)}` : REPEAT_LABEL[choice];
        return `<option value="${choice}"${choice === draft.repeat ? " selected" : ""}${choice === "weekly" ? ' id="ap-repeat-weekly"' : ""}>${escape(label)}</option>`;
      })
      .join("");
    // The weekday a weekly repeat lands on comes from the date, so the sentence
    // under the form says which day that is rather than asking again.
    const note =
      draft.repeat === "weekly"
        ? `Repeats every ${weekdayName(isCalendarDate(date) ? date : today)}`
        : draft.repeat === "daily"
          ? "Repeats every day"
          : "";
    return `<form class="add" data-form="add">
      <label for="ap-title">New routine item</label>
      <input id="ap-title" name="title" value="${escape(draft.title)}" required maxlength="120" placeholder="Take medication" />
      <div class="grid">
        <div>
          <label for="ap-date">Date <span class="hint">(today if left empty)</span></label>
          <input id="ap-date" name="date" type="date" value="${escape(date)}" />
        </div>
        <div>
          <label for="ap-part">Day part</label>
          <select id="ap-part" name="dayPart">${options}</select>
        </div>
        <div>
          <label for="ap-time">Time (optional)</label>
          <input id="ap-time" name="time" type="time" value="${escape(draft.time)}" />
        </div>
        <div>
          <label for="ap-repeat">Repeats</label>
          <select id="ap-repeat" name="repeat">${repeats}</select>
        </div>
      </div>
      <p class="repeat-note"${note === "" ? " hidden" : ""}>${escape(note)}</p>
      <button type="submit"${this.#busy ? " disabled" : ""}>Add item</button>
    </form>`;
  }

  // --------------------------------------------------------------- events

  #onClick(event: Event): void {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const trigger = target.closest<HTMLElement>("[data-act]");
    if (trigger === null) return;
    const action = trigger.dataset["act"];
    const uid = trigger.dataset["uid"];
    const series = trigger.dataset["series"];
    if (action === "toggle-add") {
      this.#editorOpen = !this.#editorOpen;
      this.#render();
      return;
    }
    if (action === "refresh") {
      void this.#refresh();
      return;
    }
    if (action === "stop-repeat") {
      // Asks first; see the confirm strip in the row.
      this.#confirmStop = series ?? null;
      this.#render();
      return;
    }
    if (action === "stop-repeat-no") {
      this.#confirmStop = null;
      this.#render();
      return;
    }
    if (action === "stop-repeat-yes") {
      if (series !== undefined) void this.#stopRepeating(series);
      return;
    }
    if (uid === undefined) return;
    const button = actionsFor(findStatus(trigger.closest("li"), this.#optimistic)).find(
      (candidate) => candidate.action === action,
    );
    if (button === undefined) return;
    void this.#act(uid, button);
  }

  #onSubmit(event: Event): void {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const form = target.closest<HTMLFormElement>("form[data-form]");
    if (form === null) return;
    event.preventDefault();
    void this.#create(form);
  }

  /**
   * Keeps the weekday wording in step with the date, in place.
   *
   * The repeat select and the sentence under the form both name the weekday a
   * weekly routine would land on, and that word comes from the date field. Only
   * that text is rewritten: re-rendering the form here would drop focus.
   */
  #onChange(event: Event): void {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const form = target.closest<HTMLFormElement>("form[data-form='add']");
    if (form === null) return;
    const data = new FormData(form);
    const chosen = String(data.get("date") ?? "").trim();
    const date = chosen === "" ? localToday(this.#hass?.config.time_zone) : chosen;
    const repeat = String(data.get("repeat") ?? "none");
    const weekday = isCalendarDate(date) ? weekdayName(date) : "";

    const weekly = form.querySelector("#ap-repeat-weekly");
    if (weekly !== null && weekday !== "") {
      weekly.textContent = `Every ${weekday}`;
    }
    const note = form.querySelector(".repeat-note");
    if (note !== null) {
      const text =
        repeat === "weekly" && weekday !== ""
          ? `Repeats every ${weekday}`
          : repeat === "daily"
            ? "Repeats every day"
            : "";
      note.textContent = text;
      if (text === "") note.setAttribute("hidden", "");
      else note.removeAttribute("hidden");
    }
  }

  async #act(uid: string, button: ActionButton): Promise<void> {
    if (this.#busy) return;
    this.#busy = true;
    this.#message = "";
    this.#messageIsError = false;
    try {
      await this.#service(button.action, { uid });
      this.#optimistic.set(uid, button.next);
      await this.#refresh();
    } catch (error) {
      this.#message = errorText(error);
      this.#messageIsError = true;
    } finally {
      this.#busy = false;
      this.#render();
    }
  }

  async #create(form: HTMLFormElement): Promise<void> {
    const data = new FormData(form);
    const title = String(data.get("title") ?? "").trim();
    const chosen = String(data.get("date") ?? "").trim();
    const dayPart = String(data.get("dayPart") ?? "morning");
    const time = String(data.get("time") ?? "").trim();
    const repeat = String(data.get("repeat") ?? "none");

    if (title === "" || !isDayPart(dayPart)) {
      this.#message = "A title and a day part are required.";
      this.#messageIsError = true;
      this.#render();
      return;
    }

    // The date is optional in the form and defaults to today, the way the web
    // app adds to the day you are looking at. An item still carries a date: the
    // domain rejects an item without one.
    //
    // A native date field cannot hold a day that does not exist; it empties
    // itself instead, so a mistyped 31 February is indistinguishable here from
    // clearing the field and both land on today, which is what the field already
    // showed. The check below is a backstop for a value that came from
    // somewhere other than the field.
    const date = chosen === "" ? localToday(this.#hass?.config.time_zone) : chosen;
    if (!isCalendarDate(date)) {
      this.#message = "That date is not a real day.";
      this.#messageIsError = true;
      this.#render();
      return;
    }

    const uid = `ha-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const start = time === "" ? undefined : `${date}T${time}:00`;

    this.#busy = true;
    this.#message = "";
    this.#messageIsError = false;
    try {
      if (repeat === "none") {
        const payload: Record<string, unknown> = {
          uid,
          title,
          date,
          day_part: dayPart,
          status: "pending",
        };
        if (start !== undefined) payload["start"] = start;
        await this.#service("create", payload);
      } else {
        // A repeating routine is stored as a rule, not as a pile of days: the
        // server expands it for whatever window a reader asks for.
        const payload: Record<string, unknown> = {
          uid,
          title,
          date,
          day_part: dayPart,
          recurrence:
            repeat === "weekly"
              ? // The weekday comes from the date the household chose, which is
                // what "the same day every week" means on the form.
                { freq: "weekly", byDay: [weekdayCode(date)] }
              : { freq: "daily" },
        };
        if (start !== undefined) payload["start"] = start;
        await this.#service("add_series", payload);
      }
      this.#draft = { title: "", date, dayPart, time, repeat: "none" };
      this.#editorOpen = false;
      await this.#refresh();
    } catch (error) {
      this.#message = errorText(error);
      this.#messageIsError = true;
    } finally {
      this.#busy = false;
      this.#render();
    }
  }

  /** Removes a whole repeating routine, once the household has said so. */
  async #stopRepeating(series: string): Promise<void> {
    if (this.#busy) return;
    this.#busy = true;
    this.#message = "";
    this.#messageIsError = false;
    try {
      // The series is removed by its own uid, which is what each occurrence
      // carries as routineId. Every day it falls on goes with it.
      await this.#service("delete", { uid: series });
      this.#confirmStop = null;
      await this.#refresh();
    } catch (error) {
      this.#message = errorText(error);
      this.#messageIsError = true;
    } finally {
      this.#busy = false;
      this.#render();
    }
  }

  async #service(action: string, data: Record<string, unknown>): Promise<void> {
    const hass = this.#hass;
    const entity = this.#entityId();
    if (hass === null) return;
    await hass.callService(DOMAIN, action, { entity_id: entity, ...data });
  }

  async #refresh(): Promise<void> {
    const hass = this.#hass;
    const entity = this.#entityId();
    if (hass === null || entity === "") return;
    try {
      // Asks the integration's coordinator to poll now, so a change shows up in
      // seconds instead of waiting for the next interval.
      await hass.callService("homeassistant", "update_entity", { entity_id: entity });
    } catch {
      // A failed refresh is not worth surfacing; the next poll still catches up.
    }
  }

  /** Drops local overrides the server has caught up with. */
  #syncOptimistic(items: readonly RoutineItem[]): void {
    for (const item of items) {
      const override = this.#optimistic.get(item.uid);
      if (override !== undefined && override === item.status) {
        this.#optimistic.delete(item.uid);
      }
    }
  }
}

// ------------------------------------------------------------- pure helpers

/** Buttons offered for one outcome. Pending is a choice; the rest is a reset. */
export function actionsFor(status: RoutineStatus): readonly ActionButton[] {
  if (status === "pending") {
    return [
      { action: "complete", next: "completed", glyph: "✓", word: "completed" },
      { action: "mark_missed", next: "missed", glyph: "✕", word: "missed" },
      { action: "skip", next: "skipped", glyph: "—", word: "skipped" },
    ];
  }
  return [{ action: "reset", next: "pending", glyph: "↺", word: "pending again" }];
}

export function renderSummary(items: readonly RoutineItem[]): string {
  const counts = new Map<RoutineStatus, number>();
  for (const item of items) counts.set(item.status, (counts.get(item.status) ?? 0) + 1);
  const parts: string[] = [];
  for (const status of ["pending", "completed", "missed", "skipped"] as const) {
    const count = counts.get(status);
    if (count === undefined || count === 0) continue;
    parts.push(
      `<span class="chip" data-status="${status}"><span aria-hidden="true">${STATUS_SYMBOL[status]}</span> ${escape(STATUS_ACCESSIBLE_LABEL[status])} ${count}</span>`,
    );
  }
  return `<span class="chips">${parts.join("")}</span>`;
}

export function findAgendaEntity(hass: HomeAssistantLike): string | null {
  // The integration names the entity after the calendar it belongs to, so the id
  // varies per household (`sensor.routine_agenda`, `sensor.kids_agenda`, ...).
  // The trailing `_agenda` and the `items` list are the stable part.
  for (const [entityId, state] of Object.entries(hass.states)) {
    if (!entityId.startsWith("sensor.") || !entityId.endsWith("_agenda")) continue;
    if (Array.isArray(state.attributes["items"])) return entityId;
  }
  return null;
}

export function readItems(state: EntityState | undefined): RoutineItem[] {
  const raw = state?.attributes["items"];
  if (!Array.isArray(raw)) return [];
  const items: RoutineItem[] = [];
  for (const entry of raw) {
    if (isRoutineItem(entry)) items.push(entry);
  }
  return items;
}

export function readIssues(state: EntityState | undefined): string[] {
  const raw = state?.attributes["autiplanner_issues"];
  if (!Array.isArray(raw)) return [];
  return raw.filter((issue): issue is string => typeof issue === "string");
}

export function isDayPart(value: string): value is DayPart {
  return (DAY_PARTS as readonly string[]).includes(value);
}

function isRoutineItem(value: unknown): value is RoutineItem {
  if (typeof value !== "object" || value === null) return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item["uid"] === "string" &&
    typeof item["title"] === "string" &&
    typeof item["date"] === "string" &&
    typeof item["dayPart"] === "string" &&
    isDayPart(item["dayPart"]) &&
    typeof item["status"] === "string" &&
    STATUSES.includes(item["status"])
  );
}

function findStatus(row: Element | null, optimistic: ReadonlyMap<string, RoutineStatus>): RoutineStatus {
  const element = row instanceof HTMLElement ? row : null;
  const status = element?.dataset["status"];
  return status !== undefined && STATUSES.includes(status) ? (status as RoutineStatus) : "pending";
}

export function addDays(date: string, delta: number): string {
  const [year, month, day] = date.split("-").map(Number) as [number, number, number];
  const utc = new Date(Date.UTC(year, month - 1, day));
  utc.setUTCDate(utc.getUTCDate() + delta);
  return utc.toISOString().slice(0, 10);
}

export function localToday(timeZone: string | undefined): string {
  const now = new Date();
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(now);
    const values: Record<string, string> = {};
    for (const part of parts) {
      if (part.type !== "literal") values[part.type] = part.value;
    }
    const year = values["year"];
    const month = values["month"];
    const day = values["day"];
    if (year !== undefined && month !== undefined && day !== undefined) {
      return `${year}-${month}-${day}`;
    }
  } catch {
    // An unusable timezone falls back to UTC rather than failing the card.
  }
  return now.toISOString().slice(0, 10);
}

export function dayName(date: string, index: number): string {
  if (index === 0) return "Today";
  if (index === 1) return "Tomorrow";
  const [year, month, day] = date.split("-").map(Number) as [number, number, number];
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

/**
 * The iCalendar weekday code for a day.
 *
 * A weekly repeat is anchored on the weekday of the date the household picked,
 * so "every week on the same day" needs no second question on the form.
 *
 * `WEEKDAY_CODES` starts at Monday; `getUTCDay` starts at Sunday. The shift is
 * what makes a Wednesday come out as WE rather than TH.
 */
export function weekdayCode(date: string): string {
  const [year, month, day] = date.split("-").map(Number) as [number, number, number];
  const sundayFirst = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return WEEKDAY_CODES[(sundayFirst + 6) % 7] ?? "MO";
}

/** The same weekday in words, for the sentence under the form. */
export function weekdayName(date: string): string {
  const [year, month, day] = date.split("-").map(Number) as [number, number, number];
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    weekday: "long",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

function escape(value: string): string {
  const entities: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };
  return value.replace(/[&<>"']/g, (character) => entities[character] ?? character);
}

function errorText(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

const STYLES = `
  ha-card { padding: 12px 16px 16px; }
  .bar { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .title { font-size: 1.15rem; font-weight: 600; color: var(--primary-text-color, #212121); }
  .tools { display: flex; gap: 4px; }
  .tool { background: none; border: none; color: var(--primary-text-color, #212121);
          font-size: 1.1rem; cursor: pointer; min-width: 40px; min-height: 40px; border-radius: 8px; }
  .tool:hover { background: var(--secondary-background-color, #e0e0e0); }
  .day { margin-top: 14px; }
  .day-bar { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
  .day-name { font-weight: 600; color: var(--primary-text-color, #212121); }
  .chips { display: flex; flex-wrap: wrap; gap: 6px; }
  .chip { font-size: 0.78rem; color: var(--primary-text-color, #212121); opacity: 0.85; }
  .part { margin-top: 8px; }
  .part-label { font-size: 0.72rem; letter-spacing: 0.08em; text-transform: uppercase;
                color: var(--secondary-text-color, #727272); }
  .items { list-style: none; margin: 4px 0 0; padding: 0; display: flex; flex-direction: column; gap: 2px; }
  .item { display: flex; align-items: center; gap: 8px; padding: 6px 8px; border-radius: 10px;
          background: var(--card-background-color, #fff); }
  .item[data-status="completed"] { opacity: 0.65; }
  .glyph { font-size: 1rem; width: 1.2em; text-align: center; }
  .main { display: flex; flex-direction: column; flex: 1 1 auto; min-width: 0; }
  .name { color: var(--primary-text-color, #212121); overflow-wrap: anywhere; }
  .meta { font-size: 0.76rem; color: var(--secondary-text-color, #727272); }
  .acts { display: flex; gap: 2px; }
  .act { min-width: 40px; min-height: 40px; border-radius: 10px; cursor: pointer;
         font-size: 1rem; color: var(--primary-text-color, #212121);
         background: var(--secondary-background-color, #ececec); border: none; }
  .act:hover { background: var(--primary-color, #03a9f4); color: #fff; }
  .act:disabled { opacity: 0.5; cursor: default; }
  .repeat { background: none; border: none; cursor: pointer; padding: 0 4px; font-size: 0.9rem;
            color: var(--secondary-text-color, #727272); min-width: 32px; min-height: 32px; }
  .repeat:hover { color: var(--primary-color, #03a9f4); }
  .confirm { display: flex; align-items: center; gap: 4px; }
  .confirm-text { font-size: 0.78rem; color: var(--secondary-text-color, #727272); white-space: nowrap; }
  .add .repeat-note { margin: 0; font-size: 0.78rem; color: var(--secondary-text-color, #727272); }
  .empty { font-size: 0.85rem; color: var(--secondary-text-color, #727272); padding: 4px 8px; }
  .message, .notice { margin-top: 10px; font-size: 0.85rem; padding: 8px 10px; border-radius: 8px;
                      background: var(--secondary-background-color, #ececec);
                      color: var(--primary-text-color, #212121); }
  .message.error, .notice.warn { background: var(--error-color, #db4437); color: #fff; }
  .add { margin-top: 12px; display: flex; flex-direction: column; gap: 6px; }
  .add label { font-size: 0.78rem; color: var(--secondary-text-color, #727272); }
  .add .hint { font-weight: 400; opacity: 0.75; }
  .add input, .add select { width: 100%; box-sizing: border-box; padding: 8px;
      border-radius: 8px; border: 1px solid var(--divider-color, #e0e0e0);
      background: var(--card-background-color, #fff); color: var(--primary-text-color, #212121);
      font-size: 0.95rem; min-height: 40px; }
  .add .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 8px; }
  .add button { align-self: flex-start; min-height: 40px; padding: 0 16px; border-radius: 8px;
      border: none; cursor: pointer; font-size: 0.95rem;
      background: var(--primary-color, #03a9f4); color: #fff; }
`;

declare global {
  interface HTMLElementTagNameMap {
    "autiplanner-card": AutiPlannerCard;
  }
}

if (typeof customElements !== "undefined" && customElements.get(CARD_TAG) === undefined) {
  customElements.define(CARD_TAG, AutiPlannerCard);
}

if (typeof window !== "undefined") {
  const registry = window as unknown as {
    customCards?: { type: string; name: string; description: string; preview?: boolean }[];
  };
  registry.customCards = [
    ...(registry.customCards ?? []),
    {
      type: CARD_TAG,
      name: "AutiPlanner card",
      description: "View and change routine items, and add new ones.",
      preview: false,
    },
  ];
}

export default AutiPlannerCard;