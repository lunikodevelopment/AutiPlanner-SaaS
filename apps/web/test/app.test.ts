/**
 * Integration test for the PWA.
 *
 * This boots the real application code in a DOM, drives the actual buttons, and
 * takes it through an offline cycle. The unit tests cover the queue rules in
 * isolation; this covers the wiring: that a tap while offline is applied
 * locally, queued, shown as unsynced, and then sent once the network returns.
 *
 * jsdom has no IndexedDB and no service worker, so it also exercises the
 * documented fallback to an in-memory store.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { JSDOM } from "jsdom";

interface FakeItem {
  uid: string;
  title: string;
  date: string;
  dayPart: string;
  status: string;
  completedAt?: string;
}

interface Call {
  method: string;
  path: string;
  body: Record<string, unknown> | undefined;
}

class FakeApi {
  items: FakeItem[] = [];
  revision = 0;
  authenticated = false;
  /** When true, every request fails the way fetch does with no network. */
  offline = false;
  readonly calls: Call[] = [];
  private readonly applied = new Set<string>();

  async fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const url = new URL(String(input), "http://localhost");
    const method = init?.method ?? "GET";
    const body =
      typeof init?.body === "string" ? (JSON.parse(init.body) as Record<string, unknown>) : undefined;
    this.calls.push({ method, path: url.pathname, body });

    if (this.offline) throw new TypeError("Failed to fetch");

    if (url.pathname === "/api/auth/register" || url.pathname === "/api/auth/login") {
      this.authenticated = true;
      return json(201, {
        token: "test-token",
        account: { id: "acc", email: String(body?.email ?? "") },
        calendarId: "cal",
      });
    }
    if (url.pathname === "/api/auth/logout") {
      this.authenticated = false;
      return new Response(null, { status: 204 });
    }
    if (!this.authenticated) {
      return json(401, { error: { code: "unauthorized", message: "Not signed in" } });
    }
    if (url.pathname === "/api/agenda") {
      const from = url.searchParams.get("from") ?? "";
      const days = Number(url.searchParams.get("days") ?? "14");
      const to = addDays(from, days);
      return json(200, {
        items: this.items.filter((item) => item.date >= from && item.date < to),
        revision: this.revision,
      });
    }
    if (url.pathname === "/api/command") {
      return this.command(body ?? {});
    }
    if (url.pathname === "/api/me") {
      return json(200, {
        account: { id: "acc", email: "house@example.com" },
        calendars: [{ id: "cal", name: "Routine", feedPath: "/api/feed/cal/token.ics" }],
      });
    }
    if (url.pathname.endsWith("/feed/rotate")) {
      return json(200, { feed: { path: "/api/feed/cal/rotated.ics" } });
    }
    return json(404, { error: { code: "not_found", message: "no such route" } });
  }

  private command(body: Record<string, unknown>): Response {
    const key = body.clientCommandId;
    if (typeof key === "string" && this.applied.has(key)) {
      return json(200, { item: null, changed: false, revision: this.revision });
    }
    const expected = body.expectedRevision;
    if (typeof expected === "number" && expected !== this.revision) {
      return json(409, {
        error: { code: "revision_conflict", message: "the calendar moved on" },
      });
    }

    const name = String(body.command);
    if (name === "create") {
      const item = body.item as FakeItem;
      this.items.push({ ...item });
      this.revision += 1;
      if (typeof key === "string") this.applied.add(key);
      return json(200, { item, changed: true, revision: this.revision });
    }

    const item = this.items.find((candidate) => candidate.uid === body.uid);
    if (item === undefined) {
      return json(404, { error: { code: "not_found", message: "no such item" } });
    }
    const status: Record<string, string> = {
      complete: "completed",
      mark_missed: "missed",
      skip: "skipped",
      reset: "pending",
    };
    const next = status[name];
    if (next === undefined) {
      return json(400, { error: { code: "invalid_command", message: `unknown ${name}` } });
    }
    const changed = item.status !== next;
    item.status = next;
    if (next === "completed") {
      item.completedAt = String(body.completedAt ?? "");
    } else {
      delete item.completedAt;
    }
    if (changed) this.revision += 1;
    if (typeof key === "string") this.applied.add(key);
    return json(200, { item, changed, revision: this.revision });
  }
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function addDays(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number) as [number, number, number];
  const utc = new Date(Date.UTC(year, month - 1, day));
  utc.setUTCDate(utc.getUTCDate() + days);
  return utc.toISOString().slice(0, 10);
}

// ------------------------------------------------------------------ harness

const api = new FakeApi();

/** Anything the app logs as an error while handling the offline cycle. */
const installedErrors: string[] = [];
/** Warnings, which is where the app reports a command it could not apply. */
const installedWarnings: string[] = [];

function installDom(): JSDOM {
  const html = readFileSync(path.join(import.meta.dirname, "..", "public", "index.html"), "utf8");
  const dom = new JSDOM(html, { url: "http://127.0.0.1:8099/", pretendToBeVisual: true });
  const define = (name: string, value: unknown) =>
    Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });

  define("window", dom.window);
  define("document", dom.window.document);
  define("navigator", dom.window.navigator);
  // Node's FormData cannot read a form element; the app uses the DOM one.
  define("FormData", dom.window.FormData);
  define("HTMLElement", dom.window.HTMLElement);
  define("fetch", api.fetch.bind(api));
  // In a browser `globalThis` *is* the window, so the app registers its
  // online/offline listeners on it. Node's globalThis is not an EventTarget, so
  // the three methods are bound to the jsdom window before the app is imported.
  define("addEventListener", dom.window.addEventListener.bind(dom.window));
  define("removeEventListener", dom.window.removeEventListener.bind(dom.window));
  define("dispatchEvent", dom.window.dispatchEvent.bind(dom.window));
  return dom;
}

// A thrown error inside the app would otherwise only show up as a failed
// assertion much later, or not at all.
const originalConsoleError = console.error.bind(console);
console.error = (...args: unknown[]) => {
  installedErrors.push(args.map((value) => String(value)).join(" "));
  originalConsoleError(...args);
};
const originalConsoleWarn = console.warn.bind(console);
console.warn = (...args: unknown[]) => {
  installedWarnings.push(args.map((value) => String(value)).join(" "));
  originalConsoleWarn(...args);
};

function setOnline(dom: JSDOM, online: boolean): void {
  Object.defineProperty(dom.window.navigator, "onLine", { value: online, configurable: true });
  globalThis.dispatchEvent(new dom.window.Event(online ? "online" : "offline"));
}

async function settle(ticks = 12): Promise<void> {
  for (let index = 0; index < ticks; index += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

async function until(predicate: () => boolean, label: string, attempts = 60): Promise<void> {
  for (let index = 0; index < attempts; index += 1) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  throw new Error(`timed out waiting for ${label}`);
}

const dom = installDom();
// Boots the application; `start()` runs on import. The bare `.js` specifier is
// resolved to the TypeScript source by tsx, matching the rest of the codebase.
await import("../src/main.js");

function el<T extends HTMLElement>(id: string): T {
  const found = dom.window.document.getElementById(id);
  if (found === null) throw new Error(`missing #${id}`);
  return found as unknown as T;
}

function buttonWithLabel(prefix: string): HTMLButtonElement | undefined {
  return [...dom.window.document.querySelectorAll("button")].find((button) =>
    (button.getAttribute("aria-label") ?? "").startsWith(prefix),
  ) as HTMLButtonElement | undefined;
}

// -------------------------------------------------------------------- tests

test("shows sign in when there is no session", async () => {
  await settle();
  assert.equal(el("auth").hidden, false, "auth panel should be visible");
  assert.equal(el("planner").hidden, true, "planner should be hidden");
  // The 401 from /api/agenda is how the app discovers it is signed out.
  assert.ok(api.calls.some((call) => call.path === "/api/agenda"));
});

test("signing in shows the planner", async () => {
  const email = dom.window.document.getElementById("email") as HTMLInputElement;
  const password = dom.window.document.getElementById("password") as HTMLInputElement;
  email.value = "house@example.com";
  password.value = "correct horse battery";
  el<HTMLButtonElement>("create-account").click();
  await until(() => el("planner").hidden === false, "the planner to appear");
  assert.equal(api.authenticated, true);
});

test("shows the calendar subscription URL", async () => {
  await until(() => el<HTMLInputElement>("feed-url").value !== "", "the feed URL to load");
  assert.equal(
    el<HTMLInputElement>("feed-url").value,
    "http://127.0.0.1:8099/api/feed/cal/token.ics",
  );
});

test("adding an item renders it in the right day part", async () => {
  const title = dom.window.document.getElementById("new-title") as HTMLInputElement;
  const dayPart = dom.window.document.getElementById("new-daypart") as HTMLSelectElement;
  title.value = "Morning walk";
  dayPart.value = "morning";
  el<HTMLFormElement>("add-form").dispatchEvent(
    new dom.window.Event("submit", { bubbles: true, cancelable: true }),
  );
  await until(() => api.items.length === 1, "the item to reach the server");
  await settle();

  const heading = dom.window.document.querySelector(".day-part h2");
  assert.equal(heading?.textContent, "MORNING");
  const row = dom.window.document.querySelector(".item[data-status='pending']");
  // Include what did render, so a failure here is diagnosable.
  const rendered = el("agenda").textContent ?? "";
  assert.ok(row !== null, `a pending row should be rendered; agenda shows: ${rendered}`);
  assert.match(row.textContent ?? "", /Morning walk/);
  // Status is a word as well as a glyph, never colour alone.
  assert.match(row.textContent ?? "", /Pending/);
});

test("an offline change is applied locally and queued, not sent", async () => {
  const before = api.calls.filter((call) => call.path === "/api/command").length;

  setOnline(dom, false);
  await settle();

  // The app must believe it is offline before anything is tapped, otherwise
  // this test would silently be exercising the online path.
  assert.equal(el("connection").hidden, false, "the offline banner should appear");
  assert.match(el("connection").textContent ?? "", /Offline/);

  const complete = buttonWithLabel("Mark completed: Morning walk");
  assert.ok(complete !== undefined, "the complete control should exist");
  complete.click();
  await settle();

  // The row reflects the change straight away, with no network.
  const row = dom.window.document.querySelector(".item");
  assert.equal(
    row?.getAttribute("data-status"),
    "completed",
    `warnings: ${installedWarnings.join(" | ")}`,
  );
  assert.match(row?.textContent ?? "", /not synced/);

  // And the banner explains what will happen.
  const banner = el("connection");
  assert.equal(banner.hidden, false);
  assert.match(banner.textContent ?? "", /Offline/);
  assert.match(banner.textContent ?? "", /will sync when you are back online/);

  // The server never heard about it.
  const after = api.calls.filter((call) => call.path === "/api/command").length;
  assert.equal(after, before, "no command should have been sent while offline");
});

test("coming back online flushes the queue", async () => {
  setOnline(dom, true);
  await until(
    () =>
      el("connection").hidden === true,
    "the offline banner to clear",
  );
  await settle();

  assert.equal(api.items[0]?.status, "completed", "the server should have the change");
  assert.equal(api.items[0]?.completedAt !== undefined, true);
  assert.equal(api.revision, 2);
  const row = dom.window.document.querySelector(".item");
  assert.equal(row?.getAttribute("data-status"), "completed");
  assert.doesNotMatch(row?.textContent ?? "", /not synced/);
});

test("a conflict is surfaced and the server version is shown", async () => {
  // Someone else changed the calendar while this client was away.
  api.revision = 99;

  setOnline(dom, false);
  await settle();

  const reset = buttonWithLabel("Reset to pending: Morning walk");
  assert.ok(reset !== undefined, "the reset control should exist");
  reset.click();
  await settle();
  // Optimistically pending, still queued.
  assert.equal(dom.window.document.querySelector(".item")?.getAttribute("data-status"), "pending");

  setOnline(dom, true);
  await until(() => el("conflict").hidden === false, "the conflict banner");
  await settle();

  const banner = el("conflict");
  assert.match(banner.textContent ?? "", /server is shown below/);
  // The stored version wins, so the row goes back to completed.
  assert.equal(dom.window.document.querySelector(".item")?.getAttribute("data-status"), "completed");
});

test("nothing was written to the console as an error", async () => {
  // A console error here would mean the app threw while handling the offline
  // cycle, which the visible assertions above would not necessarily catch.
  assert.equal(installedErrors.length, 0, `console errors: ${installedErrors.join(" | ")}`);
});
