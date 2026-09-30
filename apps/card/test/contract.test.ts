/**
 * The card against a real agenda sensor state.
 *
 * The fixture is not hand-written. It is produced by the integration's own
 * `item_to_attributes` (see tests_ha/test_card_contract.py, which regenerates
 * and checks it), so this is the shape a Home Assistant user actually gets,
 * optional fields and all, rather than the shape this card hoped for. A change
 * to either side that the other does not expect fails here.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { JSDOM } from "jsdom";
import type { HomeAssistantLike } from "../src/index.js";

interface EntityStateLike {
  readonly state: string;
  readonly attributes: Readonly<Record<string, unknown>>;
  readonly last_updated?: string;
}

class FakeHass implements HomeAssistantLike {
  states: Record<string, EntityStateLike> = {};
  config: { time_zone: string } = { time_zone: "UTC" };
  calls: { domain: string; service: string; data: Record<string, unknown> }[] = [];

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
  Object.defineProperty(globalThis, name, {
    value: (dom.window as unknown as GlobalTarget)[name],
    configurable: true,
    writable: true,
  });
}

const { localToday } = await import("../src/index.js");

const AGENDA = "sensor.routine_agenda";

interface Fixture {
  readonly state: string;
  readonly attributes: {
    readonly items: readonly Record<string, unknown>[];
    readonly revision: number;
    readonly autiplanner_issues: readonly string[];
  };
}

async function loadFixture(): Promise<Fixture> {
  const file = path.join(import.meta.dirname, "fixtures", "agenda-state.json");
  return JSON.parse(await readFile(file, "utf8")) as Fixture;
}

/**
 * The fixture as the sensor would report it today: same attributes, same item
 * shapes, with the dates moved onto today so the card shows the day.
 */
function agendaFromFixture(fixture: Fixture): EntityStateLike {
  const today = localToday("UTC");
  const items: Record<string, unknown>[] = fixture.attributes.items.map((item) => ({
    ...item,
    date: today,
  }));
  return {
    state: String(items.length),
    attributes: { ...fixture.attributes, items },
  };
}

function mount(hass: FakeHass): HTMLElement {
  const element = document.createElement("autiplanner-card");
  element.setConfig({ type: "custom:autiplanner-card", entity: AGENDA });
  document.body.append(element);
  element.hass = hass;
  return element;
}

async function settle(ticks = 8): Promise<void> {
  for (let index = 0; index < ticks; index += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

function text(card: HTMLElement): string {
  return card.shadowRoot?.textContent ?? "";
}

test("renders every item from a real sensor state, none dropped", async () => {
  const fixture = await loadFixture();
  const hass = new FakeHass();
  hass.states[AGENDA] = agendaFromFixture(fixture);
  const card = mount(hass);

  const items = fixture.attributes.items;
  const rendered = text(card);
  for (const item of items) {
    assert.match(rendered, new RegExp(escapeRegExp(String(item["title"]))));
  }
  // One row per item, and the four outcomes are all legible.
  assert.equal(card.shadowRoot?.querySelectorAll("li.item").length, items.length);
  assert.match(rendered, /MORNING/);
  assert.match(rendered, /AFTERNOON/);
  assert.match(rendered, /EVENING/);
  assert.match(rendered, /NIGHT/);
  assert.match(rendered, /Pending 1/);
  assert.match(rendered, /Completed 1/);
  assert.match(rendered, /Missed 1/);
  assert.match(rendered, /Skipped 1/);
  // The clock the server sent is shown in the household's own terms.
  assert.match(rendered, /08:30/);
});

test("an item is offered exactly the actions its outcome allows", async () => {
  const fixture = await loadFixture();
  const hass = new FakeHass();
  hass.states[AGENDA] = agendaFromFixture(fixture);
  const card = mount(hass);

  const rows = [...(card.shadowRoot?.querySelectorAll("li.item") ?? [])];
  const actionsForRow = (row: Element): string[] =>
    [...row.querySelectorAll("button[data-act]")].map(
      (button) => button.getAttribute("data-act") ?? "",
    );

  const byStatus = new Map<string, string[]>();
  for (const row of rows) {
    byStatus.set(row.getAttribute("data-status") ?? "", actionsForRow(row));
  }
  assert.deepEqual(byStatus.get("pending"), ["complete", "mark_missed", "skip"]);
  for (const status of ["completed", "missed", "skipped"]) {
    assert.deepEqual(byStatus.get(status), ["reset"], `${status} should only offer reset`);
  }
});

test("acting on a real item sends the uid the server knows", async () => {
  const fixture = await loadFixture();
  const hass = new FakeHass();
  hass.states[AGENDA] = agendaFromFixture(fixture);
  const card = mount(hass);

  const uid = String(fixture.attributes.items[0]?.["uid"]);
  const button = card.shadowRoot?.querySelector<HTMLButtonElement>(
    `button[data-act="complete"][data-uid="${uid}"]`,
  );
  assert.ok(button !== null && button !== undefined, "the pending item offers complete");
  button.dispatchEvent(new (dom.window.Event)("click", { bubbles: true, cancelable: true }));
  await settle();

  assert.deepEqual(hass.calls[0], {
    domain: "autiplanner_saas",
    service: "complete",
    data: { entity_id: AGENDA, uid },
  });
  // And the row shows the new outcome before the server has answered.
  assert.match(text(card), /Completed 2/);
});

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
