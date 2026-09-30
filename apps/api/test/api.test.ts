import assert from "node:assert/strict";
import fs from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import test, { after, before, describe } from "node:test";
import { AccountStore } from "../src/accounts.js";
import { createApp } from "../src/app.js";
import type { Config } from "../src/config.js";
import { CalendarRegistry } from "../src/registry.js";

interface TestServer {
  readonly base: string;
  close(): Promise<void>;
}

interface ApiResponse {
  readonly status: number;
  readonly body: any;
  readonly headers: Headers;
}

let dataDir: string;
let server: TestServer;

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
    close: () =>
      new Promise<void>((resolve) => {
        nodeServer.close(() => resolve());
      }),
  };
}

async function api(
  method: string,
  route: string,
  options: { token?: string; cookie?: string; body?: unknown } = {},
): Promise<ApiResponse> {
  const headers: Record<string, string> = {};
  if (options.token !== undefined) headers.authorization = `Bearer ${options.token}`;
  if (options.cookie !== undefined) headers.cookie = options.cookie;
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
  dataDir = await fs.mkdtemp(path.join(os.tmpdir(), "autiplanner-api-"));
  server = await startServer(dataDir);
});

after(async () => {
  await server.close();
  await fs.rm(dataDir, { recursive: true, force: true });
});

describe("server basics", () => {
  test("health needs no authentication", async () => {
    const response = await api("GET", "/api/health");
    assert.equal(response.status, 200);
    assert.equal(response.body.status, "ok");
  });

  test("an unknown api route is a 404", async () => {
    const response = await api("GET", "/api/does-not-exist");
    assert.equal(response.status, 404);
  });

  test("a protected route without a token is a 401", async () => {
    const response = await api("GET", "/api/agenda");
    assert.equal(response.status, 401);
  });
});

describe("accounts", () => {
  test("register returns a token and a default calendar", async () => {
    const response = await api("POST", "/api/auth/register", {
      body: { email: "House@Example.com", password: "correct horse battery" },
    });
    assert.equal(response.status, 201);
    assert.ok(typeof response.body.token === "string" && response.body.token.length > 20);
    assert.equal(response.body.account.email, "house@example.com");
    assert.ok(typeof response.body.calendarId === "string");
    // The session cookie is HttpOnly so scripts cannot read the token.
    const cookie = response.headers.get("set-cookie") ?? "";
    assert.match(cookie, /HttpOnly/);
    assert.match(cookie, /SameSite=Lax/);
  });

  test("the same email cannot register twice", async () => {
    await api("POST", "/api/auth/register", {
      body: { email: "dupe@example.com", password: "another good password" },
    });
    const second = await api("POST", "/api/auth/register", {
      body: { email: "dupe@example.com", password: "another good password" },
    });
    assert.equal(second.status, 409);
    assert.equal(second.body.error.code, "email_taken");
  });

  test("a short password is rejected", async () => {
    const response = await api("POST", "/api/auth/register", {
      body: { email: "short@example.com", password: "abc" },
    });
    assert.equal(response.status, 400);
    assert.equal(response.body.error.code, "invalid_password");
  });

  test("an invalid email is rejected", async () => {
    const response = await api("POST", "/api/auth/register", {
      body: { email: "not-an-email", password: "a perfectly good password" },
    });
    assert.equal(response.status, 400);
    assert.equal(response.body.error.code, "invalid_email");
  });

  test("login works and a wrong password is a 401", async () => {
    await api("POST", "/api/auth/register", {
      body: { email: "login@example.com", password: "a perfectly good password" },
    });
    const ok = await api("POST", "/api/auth/login", {
      body: { email: "login@example.com", password: "a perfectly good password" },
    });
    assert.equal(ok.status, 200);
    assert.ok(ok.body.token);

    const bad = await api("POST", "/api/auth/login", {
      body: { email: "login@example.com", password: "wrong password entirely" },
    });
    assert.equal(bad.status, 401);
  });

  test("the session cookie authenticates without a bearer header", async () => {
    const registered = await api("POST", "/api/auth/register", {
      body: { email: "cookie@example.com", password: "a perfectly good password" },
    });
    const raw = registered.headers.get("set-cookie") ?? "";
    const cookie = raw.split(";")[0] as string;
    const me = await api("GET", "/api/me", { cookie });
    assert.equal(me.status, 200);
    assert.equal(me.body.account.email, "cookie@example.com");
  });

  test("logout revokes the token", async () => {
    const registered = await api("POST", "/api/auth/register", {
      body: { email: "logout@example.com", password: "a perfectly good password" },
    });
    const token = registered.body.token as string;
    assert.equal((await api("GET", "/api/me", { token })).status, 200);
    assert.equal((await api("POST", "/api/auth/logout", { token })).status, 204);
    assert.equal((await api("GET", "/api/me", { token })).status, 401);
  });
});

describe("routine lifecycle", () => {
  let token: string;
  let accountId: string;
  let calendarId: string;

  before(async () => {
    const registered = await api("POST", "/api/auth/register", {
      body: { email: "routine@example.com", password: "a perfectly good password" },
    });
    token = registered.body.token;
    accountId = registered.body.account.id;
    calendarId = registered.body.calendarId;
  });

  test("an empty calendar reads back as an empty agenda", async () => {
    const response = await api("GET", "/api/agenda?from=2026-08-11&days=7", { token });
    assert.equal(response.status, 200);
    assert.deepEqual(response.body.items, []);
    assert.equal(response.body.revision, 0);
  });

  test("create stores an item and bumps the revision", async () => {
    const response = await api("POST", "/api/command", {
      token,
      body: {
        command: "create",
        clientCommandId: "cmd-create-1",
        item: {
          uid: "walk@autiplanner.local",
          title: "Morning walk",
          date: "2026-08-11",
          dayPart: "morning",
          status: "pending",
        },
      },
    });
    assert.equal(response.status, 200);
    assert.equal(response.body.changed, true);
    assert.equal(response.body.revision, 1);
    assert.equal(response.body.item.status, "pending");
    assert.equal(response.body.item.dayPart, "morning");
  });

  test("the agenda returns the item with the four-state fields", async () => {
    const response = await api("GET", "/api/agenda?from=2026-08-11&days=7", { token });
    assert.equal(response.status, 200);
    const item = response.body.items[0];
    assert.equal(item.uid, "walk@autiplanner.local");
    assert.equal(item.status, "pending");
    assert.equal(item.dayPart, "morning");
    assert.equal(item.completedAt, undefined);
  });

  test("mark_missed is stored as missed and never as completed", async () => {
    const response = await api("POST", "/api/command", {
      token,
      body: { command: "mark_missed", uid: "walk@autiplanner.local" },
    });
    assert.equal(response.status, 200);
    assert.equal(response.body.item.status, "missed");
    assert.equal(response.body.item.completedAt, undefined);

    const file = path.join(dataDir, "calendars", accountId, `${calendarId}.ics`);
    const ics = await fs.readFile(file, "utf8");
    assert.match(ics, /X-AUTIPLANNER-OUTCOME:MISSED/);
    assert.doesNotMatch(ics, /STATUS:COMPLETED/);
    assert.doesNotMatch(ics, /\r\nCOMPLETED:/);
  });

  test("complete records a timestamp and is idempotent", async () => {
    const first = await api("POST", "/api/command", {
      token,
      body: {
        command: "complete",
        uid: "walk@autiplanner.local",
        completedAt: "2026-08-11T09:05:00Z",
      },
    });
    assert.equal(first.status, 200);
    assert.equal(first.body.item.status, "completed");
    assert.equal(first.body.item.completedAt, "2026-08-11T09:05:00Z");

    const again = await api("POST", "/api/command", {
      token,
      body: {
        command: "complete",
        uid: "walk@autiplanner.local",
        completedAt: "2026-08-11T09:05:00Z",
      },
    });
    assert.equal(again.body.changed, false);
    assert.equal(again.body.revision, first.body.revision);
  });

  test("a stale expectedRevision conflicts and writes nothing", async () => {
    const current = await api("GET", "/api/agenda?from=2026-08-11&days=7", { token });
    const revision = current.body.revision as number;

    const stale = await api("POST", "/api/command", {
      token,
      body: {
        command: "mark_missed",
        uid: "walk@autiplanner.local",
        expectedRevision: revision - 1,
      },
    });
    assert.equal(stale.status, 409);
    assert.equal(stale.body.error.code, "revision_conflict");

    const after = await api("GET", "/api/agenda?from=2026-08-11&days=7", { token });
    assert.equal(after.body.revision, revision);
    assert.equal(after.body.items[0].status, "completed");
  });

  test("a repeated clientCommandId is applied once", async () => {
    const before = await api("GET", "/api/agenda?from=2026-08-11&days=7", { token });
    const body = {
      command: "skip",
      uid: "walk@autiplanner.local",
      clientCommandId: "retry-me-1",
    };
    const first = await api("POST", "/api/command", { token, body });
    assert.equal(first.body.changed, true);
    assert.equal(first.body.item.status, "skipped");

    const second = await api("POST", "/api/command", { token, body });
    assert.equal(second.status, 200);
    assert.equal(second.body.changed, false);
    assert.equal(second.body.revision, first.body.revision);
    assert.ok(before.body.revision < first.body.revision);
  });

  test("a timestamp with fractional seconds is truncated, not rejected", async () => {
    // iCalendar DATE-TIME has no fractional seconds, so a client that produces
    // `toISOString()` output is normalized at the boundary rather than refused
    // over a detail the profile cannot store.
    const created = await api("POST", "/api/command", {
      token,
      body: {
        command: "create",
        item: {
          uid: "fractional@autiplanner.local",
          title: "Fractional",
          date: "2026-08-11",
          dayPart: "night",
          status: "pending",
        },
      },
    });
    assert.equal(created.status, 200);

    const response = await api("POST", "/api/command", {
      token,
      body: {
        command: "complete",
        uid: "fractional@autiplanner.local",
        completedAt: "2026-08-11T09:05:00.123Z",
      },
    });
    assert.equal(response.status, 200);
    assert.equal(response.body.item.completedAt, "2026-08-11T09:05:00Z");
  });

  test("a timestamp without an offset is still rejected", async () => {
    const response = await api("POST", "/api/command", {
      token,
      body: {
        command: "complete",
        uid: "fractional@autiplanner.local",
        completedAt: "2026-08-11T09:05:00",
      },
    });
    assert.equal(response.status, 400);
  });

  test("an unknown uid is a 404", async () => {
    const response = await api("POST", "/api/command", {
      token,
      body: { command: "reset", uid: "nobody@autiplanner.local" },
    });
    assert.equal(response.status, 404);
  });

  test("an unknown command is rejected", async () => {
    const response = await api("POST", "/api/command", {
      token,
      body: { command: "launch", uid: "walk@autiplanner.local" },
    });
    assert.equal(response.status, 400);
  });

  test("sync reports no change when the revision matches", async () => {
    const current = await api("GET", "/api/agenda?from=2026-08-11&days=7", { token });
    const response = await api(
      "GET",
      `/api/sync?since=${current.body.revision}&from=2026-08-11&days=7`,
      { token },
    );
    assert.equal(response.status, 200);
    assert.equal(response.body.changed, false);
    assert.deepEqual(response.body.items, []);

    const stale = await api("GET", "/api/sync?since=0&from=2026-08-11&days=7", { token });
    assert.equal(stale.body.changed, true);
    assert.ok(stale.body.items.length > 0);
  });

  test("an out-of-range window is rejected", async () => {
    for (const days of ["0", "365", "abc"]) {
      const response = await api("GET", `/api/agenda?from=2026-08-11&days=${days}`, { token });
      assert.equal(response.status, 400, `days=${days} should be rejected`);
    }
  });

  test("an invalid date is rejected", async () => {
    const response = await api("GET", "/api/agenda?from=2026-13-45&days=7", { token });
    assert.equal(response.status, 400);
  });
});

describe("persistence and isolation", () => {
  test("state survives a restart", async () => {
    const registered = await api("POST", "/api/auth/register", {
      body: { email: "restart@example.com", password: "a perfectly good password" },
    });
    const token = registered.body.token as string;
    await api("POST", "/api/command", {
      token,
      body: {
        command: "create",
        item: {
          uid: "keep@autiplanner.local",
          title: "Keep me",
          date: "2026-09-01",
          dayPart: "evening",
          status: "pending",
        },
      },
    });
    const before = await api("GET", "/api/agenda?from=2026-09-01&days=2", { token });

    // A second server on the same data directory stands in for a restart.
    const restarted = await startServer(dataDir);
    const original = server;
    server = restarted;
    try {
      const login = await api("POST", "/api/auth/login", {
        body: { email: "restart@example.com", password: "a perfectly good password" },
      });
      const after = await api("GET", "/api/agenda?from=2026-09-01&days=2", {
        token: login.body.token,
      });
      assert.equal(after.body.items[0].uid, "keep@autiplanner.local");
      assert.equal(after.body.revision, before.body.revision);
    } finally {
      server = original;
      await restarted.close();
    }
  });

  test("one account cannot touch another account's calendar", async () => {
    const alice = await api("POST", "/api/auth/register", {
      body: { email: "alice@example.com", password: "a perfectly good password" },
    });
    const bob = await api("POST", "/api/auth/register", {
      body: { email: "bob@example.com", password: "a perfectly good password" },
    });
    assert.notEqual(alice.body.account.id, bob.body.account.id);

    // Bob names Alice's calendar id explicitly.
    const response = await api(
      "GET",
      `/api/agenda?from=2026-08-11&days=7&calendarId=${alice.body.calendarId}`,
      { token: bob.body.token },
    );
    assert.equal(response.status, 404);

    // And a command against it is refused too.
    const command = await api("POST", "/api/command", {
      token: bob.body.token,
      body: { command: "reset", uid: "walk@autiplanner.local", calendarId: alice.body.calendarId },
    });
    assert.equal([400, 404].includes(command.status), true);
  });

  test("an item created in one account does not appear in another", async () => {
    const alice = await api("POST", "/api/auth/register", {
      body: { email: "alice2@example.com", password: "a perfectly good password" },
    });
    await api("POST", "/api/command", {
      token: alice.body.token,
      body: {
        command: "create",
        item: {
          uid: "private@autiplanner.local",
          title: "Private",
          date: "2026-10-01",
          dayPart: "night",
          status: "pending",
        },
      },
    });
    const bob = await api("POST", "/api/auth/register", {
      body: { email: "bob2@example.com", password: "a perfectly good password" },
    });
    const response = await api("GET", "/api/agenda?from=2026-10-01&days=2", {
      token: bob.body.token,
    });
    assert.deepEqual(response.body.items, []);
  });

  test("passwords and tokens are never written in clear", async () => {
    const registered = await api("POST", "/api/auth/register", {
      body: { email: "secret@example.com", password: "a very secret password" },
    });
    const token = registered.body.token as string;
    const accounts = await fs.readFile(path.join(dataDir, "accounts.json"), "utf8");
    assert.doesNotMatch(accounts, /a very secret password/);
    assert.doesNotMatch(accounts, new RegExp(token));
    assert.match(accounts, /"algorithm": "scrypt"/);
  });
});

describe("subscription feed", () => {
  async function feed(
    route: string,
  ): Promise<{ status: number; text: string; contentType: string | null }> {
    const response = await fetch(`${server.base}${route}`);
    return {
      status: response.status,
      text: await response.text(),
      contentType: response.headers.get("content-type"),
    };
  }

  async function setupCalendar(email: string): Promise<{ token: string; calendarId: string }> {
    const registered = await api("POST", "/api/auth/register", {
      body: { email, password: "a perfectly good password" },
    });
    const token = registered.body.token as string;
    const calendarId = registered.body.calendarId as string;
    await api("POST", "/api/command", {
      token,
      body: {
        command: "create",
        item: {
          uid: "feed-item@autiplanner.local",
          title: "Feed item",
          date: "2026-10-05",
          dayPart: "morning",
          status: "pending",
        },
      },
    });
    return { token, calendarId };
  }

  test("a calendar can be subscribed to by URL without a token header", async () => {
    const { token, calendarId } = await setupCalendar("feed@example.com");
    const me = await api("GET", "/api/me", { token });
    const record = me.body.calendars.find((cal: any) => cal.id === calendarId);
    assert.ok(record.feedPath.startsWith(`/api/feed/${calendarId}/`), record.feedPath);
    assert.ok(record.feedPath.endsWith(".ics"), record.feedPath);

    const response = await feed(record.feedPath as string);
    assert.equal(response.status, 200);
    assert.match(response.contentType ?? "", /text\/calendar/);
    assert.match(response.text, /^BEGIN:VCALENDAR/);
    assert.match(response.text, /feed-item@autiplanner\.local/);
    // The AutiPlanner extensions must survive the round trip through the feed.
    assert.match(response.text, /X-AUTIPLANNER-/);
  });

  test("the feed path is stable across reads", async () => {
    const { token, calendarId } = await setupCalendar("feed-stable@example.com");
    const first = await api("GET", `/api/calendars/${calendarId}/feed`, { token });
    const second = await api("GET", `/api/calendars/${calendarId}/feed`, { token });
    assert.equal(first.body.feed.path, second.body.feed.path);
  });

  test("a wrong or missing feed token is a 404", async () => {
    const { token, calendarId } = await setupCalendar("feed-wrong@example.com");
    const me = await api("GET", "/api/me", { token });
    const record = me.body.calendars.find((cal: any) => cal.id === calendarId);
    const path = record.feedPath as string;

    const wrong = path.replace(/[^/]+\.ics$/, "not-the-token.ics");
    assert.equal((await feed(wrong)).status, 404);
    assert.equal((await feed(`/api/feed/${calendarId}/missing.ics`)).status, 404);
    assert.equal((await feed(`/api/feed/no-such-calendar/anything.ics`)).status, 404);
  });

  test("rotating the feed invalidates the previous URL", async () => {
    const { token, calendarId } = await setupCalendar("feed-rotate@example.com");
    const me = await api("GET", "/api/me", { token });
    const oldPath = me.body.calendars.find((cal: any) => cal.id === calendarId).feedPath as string;
    assert.equal((await feed(oldPath)).status, 200);

    const rotated = await api("POST", `/api/calendars/${calendarId}/feed/rotate`, { token });
    const newPath = rotated.body.feed.path as string;
    assert.notEqual(newPath, oldPath);
    assert.equal((await feed(oldPath)).status, 404);
    assert.equal((await feed(newPath)).status, 200);
  });

  test("the subscription feed needs no session, minting one does", async () => {
    const { token, calendarId } = await setupCalendar("feed-auth@example.com");
    const me = await api("GET", "/api/me", { token });
    const path = me.body.calendars.find((cal: any) => cal.id === calendarId).feedPath as string;
    // The feed URL works with no cookie and no bearer token.
    assert.equal((await feed(path)).status, 200);
    // Reading or rotating the URL still requires being signed in.
    assert.equal((await api("GET", `/api/calendars/${calendarId}/feed`)).status, 401);
    assert.equal((await api("POST", `/api/calendars/${calendarId}/feed/rotate`)).status, 401);
  });
});
