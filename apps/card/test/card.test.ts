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
const { actionsFor, addDays, findAgendaEntity, localToday } = await import("../src/index.js");

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