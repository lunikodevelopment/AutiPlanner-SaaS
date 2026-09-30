/**
 * Repeating routines through the real server.
 *
 * A series is a rule, not a pile of items: it is stored once, expanded for the
 * window a client asks for, and a recorded outcome belongs to one day. These
 * tests go through the HTTP contract because that is where the write path did
 * not exist: the expansion itself was already covered by the domain tests.
 */
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import fs from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { AccountStore } from "../src/accounts.js";
import { createApp } from "../src/app.js";
import type { Config } from "../src/config.js";
import { CalendarRegistry } from "../src/registry.js";

interface TestServer {
  base: string;
  close: () => Promise<void>;
}

async function raw(route: string, token?: string): Promise<{ status: number; text: string }> {
  const headers: Record<string, string> = {};
  if (token !== undefined) headers.authorization = `Bearer ${token}`;
  const response = await fetch(`${server.base}${route}`, { headers });
  return { status: response.status, text: await response.text() };
}

interface ApiResponse {
  status: number;
  body: any;
  headers: Headers;
}

let server: TestServer;
let dataDir: string;

function testConfig(dir: string): Config {
  return {
    host: "127.0.0.1",
    port: 0,
    dataDir: dir,
    webRoot: null,
    allowRegistration: true,
    tokenTtlDays: 365,
    authRateLimit: 1000,
  };
}

async function startServer(dir: string): Promise<TestServer> {
  const config = testConfig(dir);
  const accounts = new AccountStore(path.join(config.dataDir, "accounts.json"));
  const calendars = new CalendarRegistry(config.dataDir);
  const nodeServer = http.createServer(createApp({ config, accounts, calendars }));
  await new Promise<void>((resolve) => nodeServer.listen(0, "127.0.0.1", resolve));
  const address = nodeServer.address();
  const port = typeof address === "object" && address !== null ? address.port : 0;
  return {
    base: `http://127.0.0.1:${port}`,
    close: async () => {
      await new Promise<void>((resolve) => nodeServer.close(() => resolve()));
    },
  };
}

async function api(
  method: string,
  route: string,
  options: { token?: string; body?: unknown } = {},
): Promise<ApiResponse> {
  const headers: Record<string, string> = {};
  if (options.token !== undefined) headers.authorization = `Bearer ${options.token}`;
  if (options.body !== undefined) headers["content-type"] = "application/json";
  const response = await fetch(`${server.base}${route}`, {
    method,
    headers,
    ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
  });
  const text = await response.text();
  return {
    status: response.status,
    body: text.length > 0 ? JSON.parse(text) : null,
    headers: response.headers,
  };
}

before(async () => {
  dataDir = await fs.mkdtemp(path.join(os.tmpdir(), "autiplanner-series-"));
  server = await startServer(dataDir);
});

after(async () => {
  await server.close();
  await fs.rm(dataDir, { recursive: true, force: true });
});

describe("repeating routines", () => {
  let token: string;

  before(async () => {
    const registered = await api("POST", "/api/auth/register", {
      body: { email: "series@example.com", password: "a perfectly good password" },
    });
    token = registered.body.token;
  });

  test("a weekly routine is stored as a rule and expands inside the window", async () => {
    const created = await api("POST", "/api/command", {
      token,
      body: {
        command: "add_series",
        clientCommandId: "series-1",
        series: {
          uid: "swimming@example.com",
          title: "Swimming",
          date: "2026-09-30",
          dayPart: "afternoon",
          start: "2026-09-30T15:00:00",
          recurrence: { freq: "weekly", byDay: ["WE"] },
        },
      },
    });
    assert.equal(created.status, 200);
    assert.equal(created.body.changed, true);

    // Two weeks of Wednesdays, and nothing on the other days.
    const agenda = await api("GET", "/api/agenda?from=2026-09-30&days=15", { token });
    assert.equal(agenda.status, 200);
    const dates = agenda.body.items.map((item: { date: string }) => item.date);
    assert.deepEqual(dates, ["2026-09-30", "2026-10-07", "2026-10-14"]);
    for (const item of agenda.body.items) {
      assert.equal(item.title, "Swimming");
      assert.equal(item.dayPart, "afternoon");
      assert.equal(item.status, "pending");
      // The clock travels with each occurrence.
      assert.equal(item.start, `${item.date}T15:00:00`);
      // And the occurrence says which series it came from.
      assert.equal(item.routineId, "swimming@example.com");
    }
  });

  test("nothing about the future is written down, only the rule", async () => {
    // The stored file holds one master with an RRULE, not fifteen items.
    const root = path.join(dataDir, "calendars");
    let found = 0;
    for (const accountDir of await fs.readdir(root)) {
      const directory = path.join(root, accountDir);
      for (const file of await fs.readdir(directory)) {
        if (!file.endsWith(".ics")) continue;
        const contents = await fs.readFile(path.join(directory, file), "utf8");
        if (!contents.includes("swimming@example.com")) continue;
        found += 1;
        assert.equal((contents.match(/BEGIN:VTODO/g) ?? []).length, 1);
        assert.match(contents, /RRULE:FREQ=WEEKLY;BYDAY=WE/);
      }
    }
    assert.equal(found, 1, "the series should be stored in exactly one calendar");
  });

  test("a daily routine repeats every day", async () => {
    const created = await api("POST", "/api/command", {
      token,
      body: {
        command: "add_series",
        series: {
          uid: "medication@example.com",
          title: "Morning medication",
          date: "2026-09-30",
          dayPart: "morning",
          recurrence: { freq: "daily" },
        },
      },
    });
    assert.equal(created.status, 200);
    const agenda = await api("GET", "/api/agenda?from=2026-09-30&days=4", { token });
    const daily = agenda.body.items.filter(
      (item: { routineId?: string }) => item.routineId === "medication@example.com",
    );
    assert.deepEqual(
      daily.map((item: { date: string }) => item.date),
      ["2026-09-30", "2026-10-01", "2026-10-02", "2026-10-03"],
    );
  });

  test("recording an outcome on one occurrence leaves the other weeks alone", async () => {
    const completed = await api("POST", "/api/command", {
      token,
      body: {
        command: "complete",
        uid: "swimming@example.com:2026-10-07",
        completedAt: "2026-10-07T15:45:00Z",
      },
    });
    assert.equal(completed.status, 200);
    assert.equal(completed.body.item.status, "completed");
    // The day it was recorded on, not the series.
    assert.equal(completed.body.item.date, "2026-10-07");

    const agenda = await api("GET", "/api/agenda?from=2026-09-30&days=15", { token });
    const byDate = new Map(
      agenda.body.items
        .filter((item: { routineId?: string }) => item.routineId === "swimming@example.com")
        .map((item: { date: string; status: string }) => [item.date, item.status]),
    );
    assert.equal(byDate.get("2026-10-07"), "completed");
    assert.equal(byDate.get("2026-09-30"), "pending");
    assert.equal(byDate.get("2026-10-14"), "pending");
  });

  test("an outcome survives a reload of the file it was written to", async () => {
    // A second server over the same data directory: what the first wrote has to
    // be what the second reads back.
    const restarted = await startServer(dataDir);
    const other = server;
    server = restarted;
    try {
      const agenda = await api("GET", "/api/agenda?from=2026-10-05&days=7", { token });
      const occurrence = agenda.body.items.find(
        (item: { uid: string }) => item.uid === "swimming@example.com:2026-10-07",
      );
      assert.equal(occurrence?.status, "completed");
      assert.equal(occurrence?.completedAt, "2026-10-07T15:45:00Z");
    } finally {
      server = other;
      await restarted.close();
    }
  });

  test("removing the series removes its occurrences and leaves one-off items", async () => {
    const oneOff = await api("POST", "/api/command", {
      token,
      body: {
        command: "create",
        item: {
          uid: "dentist@example.com",
          title: "Dentist",
          date: "2026-10-07",
          dayPart: "morning",
          status: "pending",
        },
      },
    });
    assert.equal(oneOff.status, 200);

    const removed = await api("POST", "/api/command", {
      token,
      body: { command: "delete", uid: "swimming@example.com" },
    });
    assert.equal(removed.status, 200);

    const agenda = await api("GET", "/api/agenda?from=2026-09-30&days=30", { token });
    const uids = agenda.body.items.map((item: { uid: string }) => item.uid);
    assert.ok(!uids.includes("swimming@example.com:2026-10-07"), "the recorded day is gone");
    assert.ok(!uids.includes("swimming@example.com:2026-10-14"), "the repeat is gone");
    assert.ok(uids.includes("dentist@example.com"), "a one-off item is untouched");
    // The daily routine was never asked about, so it must still be there.
    assert.ok(uids.includes("medication@example.com:2026-10-01"));
  });

  test("an invalid rule is refused rather than stored and expanded later", async () => {
    const response = await api("POST", "/api/command", {
      token,
      body: {
        command: "add_series",
        series: {
          uid: "broken@example.com",
          title: "Broken",
          date: "2026-09-30",
          dayPart: "morning",
          recurrence: { freq: "weekly", byDay: ["XX"] },
        },
      },
    });
    assert.equal(response.status, 400);
    assert.ok(
      JSON.stringify(response.body.error).includes("unknown weekday"),
      "the reason should be reported",
    );

    const agenda = await api("GET", "/api/agenda?from=2026-09-30&days=7", { token });
    assert.ok(
      !agenda.body.items.some((item: { uid: string }) => item.uid.startsWith("broken@")),
      "a refused series must not appear on the agenda",
    );
  });

  test("a series uid cannot collide with an existing item", async () => {
    const response = await api("POST", "/api/command", {
      token,
      body: {
        command: "add_series",
        series: {
          uid: "dentist@example.com",
          title: "Clashing",
          date: "2026-09-30",
          dayPart: "morning",
          recurrence: { freq: "weekly" },
        },
      },
    });
    assert.equal(response.status, 409);
  });

  test("an add_series without a series is a bad request", async () => {
    const response = await api("POST", "/api/command", {
      token,
      body: { command: "add_series" },
    });
    assert.equal(response.status, 400);
  });

  test("the subscription feed lists every occurrence with its own outcome", async () => {
    // Not an RRULE: an occurrence carries an outcome, and a rule cannot say that
    // one Wednesday was missed and another was done. The feed therefore lists
    // each day it repeats on, with that day's outcome in the summary glyph.
    const created = await api("POST", "/api/command", {
      token,
      body: {
        command: "add_series",
        series: {
          uid: "feed-routine@example.com",
          title: "Feed routine",
          date: "2026-09-30",
          dayPart: "evening",
          recurrence: { freq: "weekly", byDay: ["WE"] },
        },
      },
    });
    assert.equal(created.status, 200);

    const missed = await api("POST", "/api/command", {
      token,
      body: {
        command: "mark_missed",
        uid: "feed-routine@example.com:2026-10-07",
      },
    });
    assert.equal(missed.status, 200);

    const me = await api("GET", "/api/me", { token });
    const feedPath = me.body.calendars[0].feedPath as string;
    assert.ok(feedPath.startsWith("/api/feed/"), `unexpected feed path: ${feedPath}`);

    const feed = await raw(feedPath);
    assert.equal(feed.status, 200);
    assert.match(feed.text, /BEGIN:VCALENDAR/);

    const events = feed.text.split("BEGIN:VEVENT").slice(1);
    const ours = events.filter((event) => event.includes("feed-routine@example.com"));
    assert.ok(ours.length >= 4, `expected the repeat to be listed, saw ${ours.length}`);
    // Every event keeps the four-state outcome rather than flattening to done.
    for (const event of ours) assert.match(event, /X-AUTIPLANNER-OUTCOME:(PENDING|COMPLETED|MISSED|SKIPPED)/);

    const anchor = ours.find((event) => event.includes("UID:feed-routine@example.com:2026-09-30"));
    const missedDay = ours.find((event) => event.includes("UID:feed-routine@example.com:2026-10-07"));
    assert.ok(anchor !== undefined, "the anchor date is listed");
    assert.match(anchor, /X-AUTIPLANNER-OUTCOME:PENDING/);
    assert.match(anchor, /SUMMARY:○/);
    assert.ok(missedDay !== undefined, "the missed week is listed");
    assert.match(missedDay, /X-AUTIPLANNER-OUTCOME:MISSED/);
    assert.match(missedDay, /SUMMARY:✕/);
  });
});

describe("removing routine items", () => {
  let token: string;

  before(async () => {
    const registered = await api("POST", "/api/auth/register", {
      body: { email: "removal@example.com", password: "a perfectly good password" },
    });
    token = registered.body.token;
  });

  test("an icon travels with the item it was stored on", async () => {
    const created = await api("POST", "/api/command", {
      token,
      body: {
        command: "create",
        item: {
          uid: "meds@example.com",
          title: "Take medication",
          date: "2026-09-30",
          dayPart: "morning",
          status: "pending",
          icon: "pill",
        },
      },
    });
    assert.equal(created.status, 200);
    assert.equal(created.body.item.icon, "pill");

    const agenda = await api("GET", "/api/agenda?from=2026-09-30&days=1", { token });
    assert.equal(agenda.body.items[0].icon, "pill");
  });

  test("an icon can be changed and cleared", async () => {
    const changed = await api("POST", "/api/command", {
      token,
      body: { command: "update", uid: "meds@example.com", patch: { icon: "hospital" } },
    });
    assert.equal(changed.status, 200);
    assert.equal(changed.body.item.icon, "hospital");

    const cleared = await api("POST", "/api/command", {
      token,
      body: { command: "update", uid: "meds@example.com", patch: { icon: null } },
    });
    assert.equal(cleared.status, 200);
    assert.equal(cleared.body.item.icon, undefined);
    // Clearing the picture must not disturb the routine.
    assert.equal(cleared.body.item.title, "Take medication");
  });

  test("an item can be removed", async () => {
    const removed = await api("POST", "/api/command", {
      token,
      body: { command: "delete", uid: "meds@example.com" },
    });
    assert.equal(removed.status, 200);
    const agenda = await api("GET", "/api/agenda?from=2026-09-30&days=1", { token });
    assert.deepEqual(agenda.body.items, []);
  });

  test("a repeating day is removed by excluding it, recorded or not", async () => {
    await api("POST", "/api/command", {
      token,
      body: {
        command: "add_series",
        series: {
          uid: "swim@example.com",
          title: "Swimming",
          date: "2026-09-30",
          dayPart: "afternoon",
          icon: "person-simple-walk",
          recurrence: { freq: "weekly", byDay: ["WE"] },
        },
      },
    });
    // One day is recorded, so it exists as a document; the other is only an
    // expansion. Removing both has to work.
    await api("POST", "/api/command", {
      token,
      body: { command: "complete", uid: "swim@example.com:2026-10-07", completedAt: "2026-10-07T15:00:00Z" },
    });

    const removedRecorded = await api("POST", "/api/command", {
      token,
      body: { command: "delete", uid: "swim@example.com:2026-10-07" },
    });
    assert.equal(removedRecorded.status, 200);

    const removedExpansion = await api("POST", "/api/command", {
      token,
      body: { command: "delete", uid: "swim@example.com:2026-10-14" },
    });
    assert.equal(removedExpansion.status, 200);

    const agenda = await api("GET", "/api/agenda?from=2026-09-30&days=30", { token });
    const dates = agenda.body.items.map((item: { date: string }) => item.date);
    // The anchor and the following week stay; the two removed days are gone.
    assert.deepEqual(dates, ["2026-09-30", "2026-10-21", "2026-10-28"]);
    // The repeat itself is intact.
    assert.ok(agenda.body.items.every((item: { routineId?: string }) => item.routineId === "swim@example.com"));
  });

  test("removing a day that is not there is still a not-found", async () => {
    const response = await api("POST", "/api/command", {
      token,
      body: { command: "delete", uid: "nobody@example.com" },
    });
    assert.equal(response.status, 404);
  });
});
