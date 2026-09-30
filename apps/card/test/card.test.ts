/**
 * Tests for the AutiPlanner dashboard card.
 *
 * The card runs in the Home Assistant frontend, so the harness boots a DOM,
 * defines the element, and drives it the way Lovelace does: `setConfig`, then
 * `hass`. jsdom has no Home Assistant, so a small fake supplies `states` and
 * records every service call.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { JSDOM } from "jsdom";
// Type-only: importing the card for its types must not boot it, since the DOM
// globals are installed just below.
import type { AutiPlannerCard, HomeAssistantLike } from "../src/index.js";
import { addDays, weekdayCodeOf, weekdayLabel } from "@autiplanner/core";
import { ROUTINE_ICONS } from "@autiplanner/icons";

interface ServiceCall {
  readonly domain: string;
  readonly service: string;
  readonly data: Record<string, unknown>;
}

interface EntityStateLike {
  readonly state: string;
  readonly attributes: Readonly<Record<string, unknown>>;
  readonly last_updated?: string;
}

class FakeHass implements HomeAssistantLike {
  states: Record<string, EntityStateLike> = {};
  config: { time_zone: string } = { time_zone: "UTC" };
  calls: ServiceCall[] = [];

  async callService(
    domain: string,
    service: string,
    data: Record<string, unknown> = {},
  ): Promise<unknown> {
    this.calls.push({ domain, service, data });
    return undefined;
  }
}

const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" });

interface GlobalTarget {
  [key: string]: unknown;
}
function define(name: string, value: unknown): void {
  Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
}
for (const name of [
  "window",
  "document",
  "navigator",
  "customElements",
  "HTMLElement",
  "HTMLFormElement",
  "Element",
  "Node",
  "FormData",
  "Event",
]) {
  define(name, (dom.window as unknown as GlobalTarget)[name]);
}

// Booting the card: importing it defines the custom element.
const { actionsFor, findAgendaEntity, localToday } = await import("../src/index.js");

const AGENDA = "sensor.routine_agenda";

function item(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    uid: "breakfast@example",
    title: "Eat breakfast",
    date: localToday("UTC"),
    dayPart: "morning",
    status: "pending",
    ...overrides,
  };
}

function agendaState(items: readonly unknown[]): EntityStateLike {
  return {
    state: String(items.length),
    attributes: { items, revision: 7, autiplanner_issues: [] },
    last_updated: "2026-09-30T08:00:00.000Z",
  };
}

function mount(hass: FakeHass, config: Record<string, unknown> = {}): AutiPlannerCard {
  const element = document.createElement("autiplanner-card");
  element.setConfig({ type: "custom:autiplanner-card", entity: AGENDA, ...config });
  document.body.append(element);
  element.hass = hass;
  return element;
}

async function settle(ticks = 8): Promise<void> {
  for (let index = 0; index < ticks; index += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

function click(card: AutiPlannerCard, selector: string): void {
  const node = card.shadowRoot?.querySelector(selector);
  assert.ok(node !== null && node !== undefined, `expected ${selector} to be rendered`);
  node.dispatchEvent(new (dom.window.Event)("click", { bubbles: true, cancelable: true }));
}

function text(card: AutiPlannerCard): string {
  return card.shadowRoot?.textContent ?? "";
}

test("renders each day part with its heading and the items", () => {
  const hass = new FakeHass();
  hass.states[AGENDA] = agendaState([
    item({ uid: "a@example", title: "Take medication", dayPart: "morning" }),
    item({ uid: "b@example", title: "Evening walk", dayPart: "evening" }),
  ]);
  const card = mount(hass);

  const rendered = text(card);
  assert.match(rendered, /MORNING/);
  assert.match(rendered, /EVENING/);
  assert.match(rendered, /Take medication/);
  assert.match(rendered, /Evening walk/);
  // A day part with nothing in it is not shown.
  assert.doesNotMatch(rendered, /AFTERNOON/);
});

test("the outcome is shown as a glyph and a word, never colour alone", () => {
  const hass = new FakeHass();
  hass.states[AGENDA] = agendaState([item({ status: "missed" })]);
  const card = mount(hass);

  assert.match(text(card), /✕/);
  assert.match(text(card), /Missed/);
});

test("tapping complete calls the action and updates the entity", async () => {
  const hass = new FakeHass();
  hass.states[AGENDA] = agendaState([item()]);
  const card = mount(hass);

  click(card, '[data-act="complete"]');
  await settle();

  assert.deepEqual(hass.calls[0], {
    domain: "autiplanner_saas",
    service: "complete",
    data: { entity_id: AGENDA, uid: "breakfast@example" },
  });
  // The coordinator is asked to poll now, so the change is not a poll away.
  assert.ok(
    hass.calls.some(
      (call) => call.domain === "homeassistant" && call.service === "update_entity",
    ),
    "expected the entity to be refreshed",
  );
  // The row shows the new outcome straight away, before the server answers.
  assert.match(text(card), /✓/);
  assert.match(text(card), /completed/);
});

test("a decided item offers only the way back to pending", async () => {
  const hass = new FakeHass();
  hass.states[AGENDA] = agendaState([item({ status: "completed" })]);
  const card = mount(hass);

  assert.equal(card.shadowRoot?.querySelector('[data-act="complete"]'), null);
  assert.ok(card.shadowRoot?.querySelector('[data-act="reset"]') !== null);

  click(card, '[data-act="reset"]');
  await settle();
  assert.equal(hass.calls[0]?.service, "reset");
});

test("marking missed and skipping are separate outcomes", async () => {
  const hass = new FakeHass();
  hass.states[AGENDA] = agendaState([
    item({ uid: "morning@example", title: "Morning" }),
    item({ uid: "evening@example", title: "Evening" }),
  ]);
  const card = mount(hass);

  click(card, '[data-act="mark_missed"][data-uid="morning@example"]');
  await settle();
  click(card, '[data-act="skip"][data-uid="evening@example"]');
  await settle();

  assert.deepEqual(
    hass.calls
      .filter((call) => call.domain === "autiplanner_saas")
      .map((call) => call.service),
    ["mark_missed", "skip"],
  );
  // Each row settles on its own outcome.
  const rows = [...(card.shadowRoot?.querySelectorAll("li.item") ?? [])].map((row) =>
    row.getAttribute("data-status"),
  );
  assert.deepEqual(rows, ["missed", "skipped"]);
});

test("adding an item sends the core contract, with the day part explicit", async () => {
  const hass = new FakeHass();
  hass.states[AGENDA] = agendaState([]);
  const card = mount(hass);

  click(card, '[data-act="toggle-add"]');
  const form = card.shadowRoot?.querySelector<HTMLFormElement>("form[data-form]");
  assert.ok(form !== null && form !== undefined, "the add form should open");

  (card.shadowRoot?.querySelector("#ap-title") as HTMLInputElement).value = "Brush teeth";
  (card.shadowRoot?.querySelector("#ap-time") as HTMLInputElement).value = "08:15";
  const select = card.shadowRoot?.querySelector<HTMLSelectElement>("select[name='dayPart']");
  assert.ok(select !== null && select !== undefined);
  select.value = "evening";

  form.dispatchEvent(new (dom.window.Event)("submit", { bubbles: true, cancelable: true }));
  await settle();

  const call = hass.calls.find((candidate) => candidate.service === "create");
  assert.ok(call !== undefined, "expected a create call");
  assert.equal(call.domain, "autiplanner_saas");
  assert.equal(call.data["entity_id"], AGENDA);
  assert.equal(call.data["title"], "Brush teeth");
  assert.equal(call.data["day_part"], "evening");
  assert.equal(call.data["status"], "pending");
  assert.equal(call.data["start"], `${localToday("UTC")}T08:15:00`);
  assert.match(String(call.data["uid"]), /^ha-/);
  // The editor closes once the item is stored.
  assert.equal(card.shadowRoot?.querySelector("form[data-form]"), null);
});

test("a day with nothing planned says so", () => {
  const hass = new FakeHass();
  hass.states[AGENDA] = agendaState([]);
  const card = mount(hass, { days: 2 });
  assert.match(text(card), /Nothing planned/);
  assert.match(text(card), /Tomorrow/);
});

test("a missing sensor explains itself instead of rendering empty", () => {
  const hass = new FakeHass();
  const card = mount(hass);
  assert.match(text(card), /No AutiPlanner agenda sensor found/);
});

test("calendar issues from the server are surfaced", () => {
  const hass = new FakeHass();
  hass.states[AGENDA] = {
    state: "0",
    attributes: { items: [], revision: 1, autiplanner_issues: ["malformed-line: ignored"] },
  };
  const card = mount(hass);
  assert.match(text(card), /Calendar issues/);
  assert.match(text(card), /malformed-line/);
});

test("a failing action reports the error in the card", async () => {
  const hass = new FakeHass();
  hass.states[AGENDA] = agendaState([item()]);
  hass.callService = async (): Promise<unknown> => {
    throw new Error("revision_conflict: the calendar moved on");
  };
  const card = mount(hass);

  click(card, '[data-act="complete"]');
  await settle();
  assert.match(text(card), /revision_conflict/);
});

test("every action button has an accessible name that includes the item", () => {
  const hass = new FakeHass();
  hass.states[AGENDA] = agendaState([item()]);
  const card = mount(hass);
  const labels = [...(card.shadowRoot?.querySelectorAll(".act") ?? [])].map(
    (node) => node.getAttribute("aria-label") ?? "",
  );
  assert.deepEqual(labels, [
    "Mark Eat breakfast completed",
    "Mark Eat breakfast missed",
    "Mark Eat breakfast skipped",
    // Removing is offered on every row, and asks before it acts.
    "Remove Eat breakfast",
  ]);
});

test("card titles are escaped rather than injected", () => {
  const hass = new FakeHass();
  hass.states[AGENDA] = agendaState([item({ title: "<img src=x onerror=alert(1)>" })]);
  const card = mount(hass);
  assert.equal(card.shadowRoot?.querySelector("img"), null);
  assert.match(text(card), /<img src=x onerror=alert\(1\)>/);
});

test("the date is optional and an empty one means today", async () => {
  const hass = new FakeHass();
  hass.states[AGENDA] = agendaState([]);
  const card = mount(hass);

  click(card, '[data-act="toggle-add"]');
  const form = card.shadowRoot?.querySelector<HTMLFormElement>("form[data-form]");
  assert.ok(form !== null && form !== undefined, "the add form should open");

  (card.shadowRoot?.querySelector("#ap-title") as HTMLInputElement).value = "Brush teeth";
  // Cleared, not filled in: the household is adding something for now.
  const date = card.shadowRoot?.querySelector("#ap-date") as HTMLInputElement;
  assert.equal(date.required, false, "the date must not be a required field");
  date.value = "";

  form.dispatchEvent(new (dom.window.Event)("submit", { bubbles: true, cancelable: true }));
  await settle();

  const call = hass.calls.find((candidate) => candidate.service === "create");
  assert.ok(call !== undefined, "expected a create call");
  assert.equal(call.data["date"], localToday("UTC"));
});

test("a time without a date still lands on today", async () => {
  const hass = new FakeHass();
  hass.states[AGENDA] = agendaState([]);
  const card = mount(hass);

  click(card, '[data-act="toggle-add"]');
  const form = card.shadowRoot?.querySelector<HTMLFormElement>("form[data-form]");
  assert.ok(form !== null && form !== undefined);

  (card.shadowRoot?.querySelector("#ap-title") as HTMLInputElement).value = "Stand up";
  (card.shadowRoot?.querySelector("#ap-date") as HTMLInputElement).value = "";
  (card.shadowRoot?.querySelector("#ap-time") as HTMLInputElement).value = "07:45";

  form.dispatchEvent(new (dom.window.Event)("submit", { bubbles: true, cancelable: true }));
  await settle();

  const call = hass.calls.find((candidate) => candidate.service === "create");
  assert.ok(call !== undefined);
  // A time with no date must not become a timestamp with an empty date, which
  // the API rejects.
  assert.equal(call.data["start"], `${localToday("UTC")}T07:45:00`);
});

test("a day that does not exist is discarded by the field, so the item lands on today", async () => {
  const hass = new FakeHass();
  hass.states[AGENDA] = agendaState([]);
  const card = mount(hass);

  click(card, '[data-act="toggle-add"]');
  const form = card.shadowRoot?.querySelector<HTMLFormElement>("form[data-form]");
  assert.ok(form !== null && form !== undefined);

  (card.shadowRoot?.querySelector("#ap-title") as HTMLInputElement).value = "Impossible";
  const date = card.shadowRoot?.querySelector("#ap-date") as HTMLInputElement;
  date.value = "2026-02-31";
  // The browser empties a day that does not exist rather than handing the card
  // a broken value, which is why this is today rather than a rejection.
  assert.equal(date.value, "");

  form.dispatchEvent(new (dom.window.Event)("submit", { bubbles: true, cancelable: true }));
  await settle();

  const call = hass.calls.find((candidate) => candidate.service === "create");
  assert.ok(call !== undefined, "the item is still added");
  assert.equal(call.data["date"], localToday("UTC"));
});

test("a weekly repeat is sent as a rule anchored on the chosen weekday", async () => {
  const hass = new FakeHass();
  hass.states[AGENDA] = agendaState([]);
  const card = mount(hass);

  click(card, '[data-act="toggle-add"]');
  const form = card.shadowRoot?.querySelector<HTMLFormElement>("form[data-form]");
  assert.ok(form !== null && form !== undefined);
  (card.shadowRoot?.querySelector("#ap-title") as HTMLInputElement).value = "Swimming";
  // A Wednesday, so the repeat should anchor on WE.
  (card.shadowRoot?.querySelector("#ap-date") as HTMLInputElement).value = "2026-09-30";
  const part = card.shadowRoot?.querySelector<HTMLSelectElement>("#ap-part");
  assert.ok(part !== null && part !== undefined);
  part.value = "afternoon";
  const repeat = card.shadowRoot?.querySelector<HTMLSelectElement>("#ap-repeat");
  assert.ok(repeat !== null && repeat !== undefined);
  repeat.value = "weekly";
  (card.shadowRoot?.querySelector("#ap-time") as HTMLInputElement).value = "15:00";

  form.dispatchEvent(new (dom.window.Event)("submit", { bubbles: true, cancelable: true }));
  await settle();

  const call = hass.calls.find((candidate) => candidate.service === "add_series");
  assert.ok(call !== undefined, "a repeating item uses add_series, not create");
  assert.equal(call.data["uid"]?.toString().startsWith("ha-"), true);
  assert.deepEqual(call.data["recurrence"], { freq: "weekly", byDay: ["WE"] });
  assert.equal(call.data["date"], "2026-09-30");
  assert.equal(call.data["day_part"], "afternoon");
  assert.equal(call.data["start"], "2026-09-30T15:00:00");
  // A template carries no outcome: completion belongs to a day.
  assert.equal(call.data["status"], undefined);
  assert.equal(hass.calls.some((candidate) => candidate.service === "create"), false);
});

test("every day is a daily rule rather than seven items", async () => {
  const hass = new FakeHass();
  hass.states[AGENDA] = agendaState([]);
  const card = mount(hass);

  click(card, '[data-act="toggle-add"]');
  const form = card.shadowRoot?.querySelector<HTMLFormElement>("form[data-form]");
  assert.ok(form !== null && form !== undefined);
  (card.shadowRoot?.querySelector("#ap-title") as HTMLInputElement).value = "Morning medication";
  (card.shadowRoot?.querySelector("#ap-repeat") as HTMLSelectElement).value = "daily";

  form.dispatchEvent(new (dom.window.Event)(("submit"), { bubbles: true, cancelable: true }));
  await settle();

  const call = hass.calls.find((candidate) => candidate.service === "add_series");
  assert.ok(call !== undefined);
  assert.deepEqual(call.data["recurrence"], { freq: "daily" });
  assert.equal(hass.calls.filter((c) => c.service === "create").length, 0);
});

test("the default stays a one-off", async () => {
  const hass = new FakeHass();
  hass.states[AGENDA] = agendaState([]);
  const card = mount(hass);

  click(card, '[data-act="toggle-add"]');
  const form = card.shadowRoot?.querySelector<HTMLFormElement>("form[data-form]");
  assert.ok(form !== null && form !== undefined);
  (card.shadowRoot?.querySelector("#ap-title") as HTMLInputElement).value = "Dentist";
  assert.equal(
    (card.shadowRoot?.querySelector("#ap-repeat") as HTMLSelectElement).value,
    "none",
  );

  form.dispatchEvent(new (dom.window.Event)("submit", { bubbles: true, cancelable: true }));
  await settle();

  assert.equal(hass.calls.some((candidate) => candidate.service === "add_series"), false);
  assert.ok(hass.calls.some((candidate) => candidate.service === "create"));
});

test("the weekday wording follows the date as it is edited", () => {
  const hass = new FakeHass();
  hass.states[AGENDA] = agendaState([]);
  const card = mount(hass);
  click(card, '[data-act="toggle-add"]');

  const date = card.shadowRoot?.querySelector("#ap-date") as HTMLInputElement;
  const repeat = card.shadowRoot?.querySelector("#ap-repeat") as HTMLSelectElement;
  const select = card.shadowRoot?.querySelector("#ap-repeat-weekly");

  // 2026-09-30 is a Wednesday, 2026-10-05 a Monday.
  date.value = "2026-09-30";
  date.dispatchEvent(new (dom.window.Event)("change", { bubbles: true }));
  assert.equal(select?.textContent, "Every Wednesday");

  date.value = "2026-10-05";
  date.dispatchEvent(new (dom.window.Event)("change", { bubbles: true }));
  assert.equal(select?.textContent, "Every Monday");

  repeat.value = "weekly";
  repeat.dispatchEvent(new (dom.window.Event)("change", { bubbles: true }));
  const note = card.shadowRoot?.querySelector(".repeat-note");
  assert.equal(note?.textContent, "Repeats every Monday");
  assert.equal(note?.hasAttribute("hidden"), false);
});

test("a repeating day is marked, and stopping it asks first", async () => {
  const hass = new FakeHass();
  const today = localToday("UTC");
  hass.states[AGENDA] = agendaState([
    item({ uid: `swimming@example:${today}`, routineId: "swimming@example", title: "Swimming" }),
  ]);
  const card = mount(hass);

  const marker = card.shadowRoot?.querySelector('[data-act="stop-repeat"]');
  assert.ok(marker !== null && marker !== undefined, "a repeating day is marked");
  assert.equal(marker.getAttribute("data-series"), "swimming@example");

  // The first tap must not remove anything.
  click(card, '[data-act="stop-repeat"]');
  await settle();
  assert.equal(
    hass.calls.some((call) => call.service === "delete"),
    false,
    "one tap must not remove a routine",
  );
  assert.match(text(card), /Stop repeating\?/);

  // Cancelling puts the usual buttons back.
  click(card, '[data-act="stop-repeat-no"]');
  await settle();
  assert.equal(card.shadowRoot?.querySelector('[data-act="stop-repeat-yes"]'), null);
  assert.ok(card.shadowRoot?.querySelector('[data-act="complete"]') !== null);
});

test("confirming removes the whole repeat by its series uid", async () => {
  const hass = new FakeHass();
  const today = localToday("UTC");
  hass.states[AGENDA] = agendaState([
    item({ uid: `swimming@example:${today}`, routineId: "swimming@example", title: "Swimming" }),
  ]);
  const card = mount(hass);

  click(card, '[data-act="stop-repeat"]');
  await settle();
  click(card, '[data-act="stop-repeat-yes"]');
  await settle();

  const call = hass.calls.find((candidate) => candidate.service === "delete");
  assert.ok(call !== undefined, "the series is deleted");
  // Not the occurrence: the whole repeat goes.
  assert.equal(call.data["uid"], "swimming@example");
});

test("every weekday maps to its own code, Monday first", () => {
  // 2026-09-28 is a Monday. The mapping is the one thing here that cannot be
  // reasoned about from the outside, and getting it wrong silently moves every
  // weekly routine to the wrong day.
  const week = ["2026-09-28", "2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04"];
  assert.deepEqual(week.map((date) => weekdayCodeOf(date)), ["MO", "TU", "WE", "TH", "FR", "SA", "SU"]);
  assert.deepEqual(week.map((date) => weekdayLabel(date)), [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
  ]);
});

test("helpers", () => {
  assert.deepEqual(
    actionsFor("pending").map((button) => button.action),
    ["complete", "mark_missed", "skip"],
  );
  assert.deepEqual(
    actionsFor("skipped").map((button) => button.next),
    ["pending"],
  );
  assert.equal(addDays("2026-02-28", 1), "2026-03-01");
  assert.equal(localToday("UTC"), new Date().toISOString().slice(0, 10));

  const hass = new FakeHass();
  hass.states["sensor.routine_today"] = { state: "1", attributes: { items: [] } };
  hass.states[AGENDA] = agendaState([]);
  assert.equal(findAgendaEntity(hass), AGENDA);
});
test("the picker offers exactly the routine icon set, and nothing else", async () => {
  const hass = new FakeHass();
  hass.states[AGENDA] = agendaState([]);
  const card = mount(hass);
  click(card, '[data-act="toggle-add"]');

  const choices = [...(card.shadowRoot?.querySelectorAll('[data-act="pick-icon"]') ?? [])];
  const names = choices.map((choice) => choice.getAttribute("data-icon"));
  // One for "no icon", then the set itself in order. Only these.
  assert.equal(names[0], "");
  assert.deepEqual(names.slice(1), ROUTINE_ICONS.map((icon) => icon.name));
  assert.equal(names.length, ROUTINE_ICONS.length + 1);

  // Each choice is named by what it means, and the state is reported rather
  // than carried by the highlight alone.
  const labelled = choices.filter((choice) => choice.getAttribute("data-icon") !== "");
  for (const choice of labelled) {
    assert.ok((choice.getAttribute("aria-label") ?? "").length > 0);
    assert.equal(choice.getAttribute("role"), "radio");
    assert.ok(choice.querySelector("svg") !== null, "each choice should draw its icon");
  }
  assert.equal(choices[0]?.getAttribute("aria-label"), "No icon");
});

test("choosing an icon sends it with the item", async () => {
  const hass = new FakeHass();
  hass.states[AGENDA] = agendaState([]);
  const card = mount(hass);
  click(card, '[data-act="toggle-add"]');
  (card.shadowRoot?.querySelector("#ap-title") as HTMLInputElement).value = "Take medication";

  click(card, '[data-act="pick-icon"][data-icon="pill"]');
  await settle();

  // The chosen one is reported as checked, and the hidden field carries it.
  const chosen = card.shadowRoot?.querySelector('[data-icon="pill"]');
  assert.equal(chosen?.getAttribute("aria-checked"), "true");
  assert.equal(
    (card.shadowRoot?.querySelector('input[name="icon"]') as HTMLInputElement).value,
    "pill",
  );

  const form = card.shadowRoot?.querySelector<HTMLFormElement>("form[data-form]");
  form?.dispatchEvent(new (dom.window.Event)("submit", { bubbles: true, cancelable: true }));
  await settle();

  const call = hass.calls.find((candidate) => candidate.service === "create");
  assert.equal(call?.data["icon"], "pill");
});

test("an icon reaches a repeating routine too", async () => {
  const hass = new FakeHass();
  hass.states[AGENDA] = agendaState([]);
  const card = mount(hass);
  click(card, '[data-act="toggle-add"]');
  (card.shadowRoot?.querySelector("#ap-title") as HTMLInputElement).value = "Swimming";
  (card.shadowRoot?.querySelector("#ap-repeat") as HTMLSelectElement).value = "weekly";
  click(card, '[data-act="pick-icon"][data-icon="person-simple-walk"]');
  await settle();

  const form = card.shadowRoot?.querySelector<HTMLFormElement>("form[data-form]");
  form?.dispatchEvent(new (dom.window.Event)("submit", { bubbles: true, cancelable: true }));
  await settle();

  const call = hass.calls.find((candidate) => candidate.service === "add_series");
  assert.equal(call?.data["icon"], "person-simple-walk");
});

test("no icon chosen sends no icon field at all", async () => {
  const hass = new FakeHass();
  hass.states[AGENDA] = agendaState([]);
  const card = mount(hass);
  click(card, '[data-act="toggle-add"]');
  (card.shadowRoot?.querySelector("#ap-title") as HTMLInputElement).value = "Dentist";
  const form = card.shadowRoot?.querySelector<HTMLFormElement>("form[data-form]");
  form?.dispatchEvent(new (dom.window.Event)("submit", { bubbles: true, cancelable: true }));
  await settle();

  const call = hass.calls.find((candidate) => candidate.service === "create");
  assert.equal("icon" in (call?.data ?? {}), false, "absent, not an empty string");
});

test("an item draws the icon it was given", async () => {
  const hass = new FakeHass();
  hass.states[AGENDA] = agendaState([item({ icon: "pill" })]);
  const card = mount(hass);

  const icon = card.shadowRoot?.querySelector(".item .icon svg");
  assert.ok(icon !== null && icon !== undefined, "the row should draw its icon");
  assert.match(icon.outerHTML, /<path d="M/);
  // Decoration: the routine's own words are what is read out.
  assert.equal(icon.getAttribute("aria-hidden"), "true");
  // Titled by what the icon means, so hovering explains the picture: the pill
  // icon is offered as "Take medication".
  assert.equal(
    card.shadowRoot?.querySelector(".item .icon")?.getAttribute("title"),
    "Take medication",
  );
});

test("an unknown or absent icon draws nothing rather than an empty box", async () => {
  const hass = new FakeHass();
  hass.states[AGENDA] = agendaState([
    item({ uid: "a@example", icon: "from-a-newer-release" }),
    item({ uid: "b@example", title: "No icon" }),
  ]);
  const card = mount(hass);
  assert.equal(card.shadowRoot?.querySelector(".item .icon"), null);
});

test("an item can be removed, and it asks first", async () => {
  const hass = new FakeHass();
  hass.states[AGENDA] = agendaState([item()]);
  const card = mount(hass);

  click(card, '[data-act="remove-item"]');
  await settle();
  // One stray tap on a shared dashboard must not remove a routine item.
  assert.equal(
    hass.calls.some((call) => call.service === "delete"),
    false,
    "one tap must not remove anything",
  );
  assert.match(text(card), /Remove\?/);

  click(card, '[data-act="remove-item-no"]');
  await settle();
  assert.equal(card.shadowRoot?.querySelector('[data-act="remove-item-yes"]'), null);
  assert.ok(card.shadowRoot?.querySelector('[data-act="complete"]') !== null);

  click(card, '[data-act="remove-item"]');
  await settle();
  click(card, '[data-act="remove-item-yes"]');
  await settle();

  const call = hass.calls.find((candidate) => candidate.service === "delete");
  assert.equal(call?.data["uid"], "breakfast@example");
});

test("removing one day of a repeat removes that day, not the routine", async () => {
  const hass = new FakeHass();
  const today = localToday("UTC");
  hass.states[AGENDA] = agendaState([
    item({ uid: `swimming@example:${today}`, routineId: "swimming@example", title: "Swimming" }),
  ]);
  const card = mount(hass);

  click(card, '[data-act="remove-item"]');
  await settle();
  click(card, '[data-act="remove-item-yes"]');
  await settle();

  const call = hass.calls.find((candidate) => candidate.service === "delete");
  // The occurrence uid, which the server turns into an excluded date. The ↻
  // control is the one that removes the whole routine.
  assert.equal(call?.data["uid"], `swimming@example:${today}`);
  assert.equal(
    hass.calls.some((c) => c.data["uid"] === "swimming@example"),
    false,
    "removing a day must not delete the series",
  );
});

test("icons can be turned off, for a card that is only words", async () => {
  const hass = new FakeHass();
  hass.states[AGENDA] = agendaState([item({ icon: "pill" })]);
  const card = mount(hass, { show_icons: false });

  assert.equal(card.shadowRoot?.querySelector(".item .icon"), null);
  // The routine is still fully readable; only the picture is gone.
  assert.match(text(card), /Eat breakfast/);
  assert.ok(card.shadowRoot?.querySelector('[data-act="complete"]') !== null);
  // And the picker is still offered in the form, since that is about adding.
  click(card, '[data-act="toggle-add"]');
  assert.ok(card.shadowRoot?.querySelector('[data-act="pick-icon"][data-icon="pill"]') !== null);
});
