import assert from "node:assert/strict";
import test, { describe } from "node:test";
import type { RoutineItem } from "@autiplanner/core";
import { ApiError, type CommandResponse } from "../src/api.js";
import { applyLocally, flushPending } from "../src/offline.js";
import { MemoryStore, type PendingCommand } from "../src/store.js";

function item(overrides: Partial<RoutineItem> = {}): RoutineItem {
  return {
    uid: "walk@autiplanner.local",
    title: "Morning walk",
    date: "2026-08-11",
    dayPart: "morning",
    status: "pending",
    ...overrides,
  };
}

/**
 * Builds a queued command.
 *
 * Optional fields are dropped rather than set to `undefined`, because
 * `exactOptionalPropertyTypes` treats those as different things.
 */
function command(
  overrides: Partial<PendingCommand> = {},
  drop: readonly (keyof PendingCommand)[] = [],
): PendingCommand {
  const base: Record<string, unknown> = {
    id: "cmd-1",
    command: "complete",
    uid: "walk@autiplanner.local",
    completedAt: "2026-08-11T09:05:00Z",
    queuedAt: "2026-08-11T09:06:00Z",
  };
  Object.assign(base, overrides);
  for (const key of drop) delete base[key];
  return base as unknown as PendingCommand;
}

const appliedTo = (entry: PendingCommand, revision = 1): CommandResponse => ({
  item: item({
    ...(entry.uid === undefined ? {} : { uid: entry.uid }),
    status: entry.command === "complete" ? "completed" : "pending",
    ...(entry.completedAt === undefined ? {} : { completedAt: entry.completedAt }),
  }),
  changed: true,
  revision,
});

describe("flushing the offline queue", () => {
  test("applies queued commands in the order they were made", async () => {
    const store = new MemoryStore();
    await store.putState({ items: [item()], revision: 0, syncedAt: null });
    await store.putPending(command({ id: "a", queuedAt: "2026-08-11T09:00:00Z" }));
    await store.putPending(command({ id: "b", queuedAt: "2026-08-11T09:01:00Z" }));

    const sent: string[] = [];
    const outcome = await flushPending(store, async (entry) => {
      sent.push(entry.id);
      return appliedTo(entry, sent.length);
    });

    assert.deepEqual(sent, ["a", "b"]);
    assert.equal(outcome.applied.length, 2);
    assert.equal(outcome.remaining, 0);
    assert.equal(outcome.conflict, null);
    assert.equal(outcome.failed, null);
    assert.deepEqual(await store.listPending(), []);
    assert.equal((await store.getState())?.revision, 2);
  });

  test("a conflict stops the flush and keeps the rest queued", async () => {
    const store = new MemoryStore();
    await store.putState({ items: [item()], revision: 0, syncedAt: null });
    await store.putPending(command({ id: "a", queuedAt: "2026-08-11T09:00:00Z" }));
    await store.putPending(command({ id: "b", queuedAt: "2026-08-11T09:01:00Z" }));

    const outcome = await flushPending(store, async (entry) => {
      if (entry.id === "a") return appliedTo(entry);
      throw new ApiError(409, "revision_conflict", "the calendar moved on");
    });

    assert.equal(outcome.applied.length, 1);
    assert.equal(outcome.conflict?.command.id, "b");
    assert.match(outcome.conflict?.message ?? "", /moved on/);
    // The conflicting command is still queued, so nothing is silently lost.
    assert.deepEqual(
      (await store.listPending()).map((entry) => entry.id),
      ["b"],
    );
  });

  test("a transient failure keeps the queue for the next attempt", async () => {
    const store = new MemoryStore();
    await store.putPending(command({ id: "a", queuedAt: "2026-08-11T09:00:00Z" }));

    const outcome = await flushPending(store, async () => {
      throw new TypeError("Failed to fetch");
    });

    assert.equal(outcome.failed?.command.id, "a");
    assert.equal(outcome.conflict, null);
    assert.equal((await store.listPending()).length, 1);
  });

  test("a server error is treated as transient", async () => {
    const store = new MemoryStore();
    await store.putPending(command({ id: "a", queuedAt: "2026-08-11T09:00:00Z" }));
    const outcome = await flushPending(store, async () => {
      throw new ApiError(503, "unavailable", "try later");
    });
    assert.equal(outcome.failed?.command.id, "a");
    assert.equal((await store.listPending()).length, 1);
  });

  test("a permanently rejected command is dropped so the queue can drain", async () => {
    const store = new MemoryStore();
    await store.putPending(
      command({ id: "a", queuedAt: "2026-08-11T09:00:00Z", uid: "gone@autiplanner.local" }),
    );
    await store.putPending(command({ id: "b", queuedAt: "2026-08-11T09:01:00Z" }));

    const outcome = await flushPending(store, async (entry) => {
      if (entry.uid === "gone@autiplanner.local") {
        throw new ApiError(404, "not_found", "no such item");
      }
      return appliedTo(entry);
    });

    assert.equal(outcome.rejected.length, 1);
    assert.equal(outcome.rejected[0]?.command.id, "a");
    assert.equal(outcome.applied.length, 1);
    assert.deepEqual(await store.listPending(), []);
  });

  test("an empty queue is a no-op", async () => {
    const store = new MemoryStore();
    const outcome = await flushPending(store, async () => {
      throw new Error("should not be called");
    });
    assert.equal(outcome.applied.length, 0);
    assert.equal(outcome.remaining, 0);
  });
});

describe("applying a command locally", () => {
  test("marking missed keeps the four states distinct", () => {
    const result = applyLocally(
      [item()],
      command({ command: "mark_missed" }, ["completedAt"]),
    );
    assert.equal(result.item?.status, "missed");
    // A missed item must never carry a completion timestamp.
    assert.equal(result.item?.completedAt, undefined);
    assert.equal(result.items[0]?.status, "missed");
  });

  test("completing records the timestamp", () => {
    const result = applyLocally([item()], command());
    assert.equal(result.item?.status, "completed");
    assert.equal(result.item?.completedAt, "2026-08-11T09:05:00Z");
  });

  test("skipping does not look like completion", () => {
    const result = applyLocally(
      [item({ status: "completed", completedAt: "2026-08-11T09:05:00Z" })],
      command({ command: "skip" }, ["completedAt"]),
    );
    assert.equal(result.item?.status, "skipped");
    assert.equal(result.item?.completedAt, undefined);
  });

  test("an unknown uid leaves the list untouched", () => {
    const before = [item()];
    const result = applyLocally(before, command({ uid: "nobody@autiplanner.local" }));
    assert.equal(result.item, null);
    assert.deepEqual(result.items, before);
  });

  test("a duplicate create is refused, matching the server", () => {
    const before = [item()];
    const result = applyLocally(
      before,
      command({ command: "create", item: item() }, ["uid", "completedAt"]),
    );
    assert.equal(result.item, null);
    assert.deepEqual(result.items, before);
  });

  test("creating adds the item", () => {
    const created = item({
      uid: "new@autiplanner.local",
      title: "Evening walk",
      dayPart: "evening",
      date: "2026-08-12",
    });
    const result = applyLocally(
      [],
      command({ command: "create", item: created }, ["uid", "completedAt"]),
    );
    assert.equal(result.items.length, 1);
    assert.equal(result.item?.uid, "new@autiplanner.local");
    assert.equal(result.item?.dayPart, "evening");
  });

  test("a malformed queued command is ignored rather than throwing", () => {
    const before = [item()];
    const result = applyLocally(before, command({}, ["uid"]));
    assert.deepEqual(result.items, before);
    assert.equal(result.item, null);
  });
});

describe("memory store", () => {
  test("pending commands come back oldest first", async () => {
    const store = new MemoryStore();
    await store.putPending(command({ id: "later", queuedAt: "2026-08-11T10:00:00Z" }));
    await store.putPending(command({ id: "earlier", queuedAt: "2026-08-11T09:00:00Z" }));
    assert.deepEqual(
      (await store.listPending()).map((entry) => entry.id),
      ["earlier", "later"],
    );
  });

  test("clear removes both the cache and the queue", async () => {
    const store = new MemoryStore();
    await store.putState({ items: [item()], revision: 3, syncedAt: null });
    await store.putPending(command());
    await store.clear();
    assert.equal(await store.getState(), null);
    assert.deepEqual(await store.listPending(), []);
  });
});
