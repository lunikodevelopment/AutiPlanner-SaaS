/**
 * Storing, resolving, and removing a repeating routine.
 *
 * The expansion itself is covered in recurrence.test.ts. What is covered here is
 * the write path that was missing: a series can be added, its occurrences can be
 * recorded against, and removing the series removes both the rule and everything
 * recorded on it.
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  RoutineCommandError,
  addSeries,
  complete,
  create,
  deleteSeries,
  update,
} from "./commands.js";
import { materializeOccurrence, occurrenceForUid, type RoutineTemplate } from "./recurrence.js";
import { validateRecurrence, validateTemplate } from "./recurrence.js";
import type { RoutineItem } from "./model.js";

function weekly(overrides: Partial<RoutineTemplate> = {}): RoutineTemplate {
  return {
    uid: "swimming@example",
    title: "Swimming",
    dayPart: "afternoon",
    date: "2026-09-30",
    start: "2026-09-30T15:00:00",
    recurrence: { freq: "weekly", byDay: ["WE"] },
    ...overrides,
  };
}

function oneOff(overrides: Partial<RoutineItem> = {}): RoutineItem {
  return {
    uid: "dentist@example",
    title: "Dentist",
    date: "2026-09-30",
    dayPart: "morning",
    status: "pending",
    ...overrides,
  };
}

test("a weekly series can be stored against an empty calendar", () => {
  const outcome = addSeries([], [], weekly());
  assert.equal(outcome.series.length, 1);
  assert.equal(outcome.result.changed, true);
  assert.equal(outcome.series[0]?.recurrence.freq, "weekly");
  assert.deepEqual(outcome.series[0]?.recurrence.byDay, ["WE"]);
});

test("a daily series stores the same way, so a routine can repeat every day", () => {
  const outcome = addSeries([], [], weekly({ recurrence: { freq: "daily" } }));
  assert.equal(outcome.series[0]?.recurrence.freq, "daily");
});

test("a stored series is a copy, not the caller's object", () => {
  const template = weekly();
  const outcome = addSeries([], [], template);
  // A later edit in the calling process must not change a stored rule.
  (template.recurrence as { freq: string }).freq = "daily";
  template.title = "Changed";
  assert.equal(outcome.series[0]?.recurrence.freq, "weekly");
  assert.equal(outcome.series[0]?.title, "Swimming");
});

test("a series and an item cannot share a uid", () => {
  const existing = oneOff({ uid: "swimming@example" });
  assert.throws(
    () => addSeries([existing], [], weekly()),
    (error: unknown) =>
      error instanceof RoutineCommandError && error.code === "duplicate-uid",
  );
  assert.throws(
    () => addSeries([], [weekly()], weekly()),
    (error: unknown) =>
      error instanceof RoutineCommandError && error.code === "duplicate-uid",
  );
});

test("an invalid rule is refused with the reason, before it is stored", () => {
  const bad = weekly({ recurrence: { freq: "weekly", byDay: ["XX" as never] } });
  assert.throws(
    () => addSeries([], [], bad),
    (error: unknown) =>
      error instanceof RoutineCommandError &&
      error.code === "invalid-template" &&
      error.details.some((detail) => detail.includes("unknown weekday")),
  );
  const noTitle = weekly({ title: "   " });
  assert.throws(
    () => addSeries([], [], noTitle),
    (error: unknown) =>
      error instanceof RoutineCommandError && error.code === "invalid-template",
  );
  const badDate = weekly({ date: "2026-02-31" });
  assert.throws(
    () => addSeries([], [], badDate),
    (error: unknown) => error instanceof RoutineCommandError,
  );
});

test("validation names what is wrong instead of throwing during expansion", () => {
  assert.deepEqual(validateRecurrence({ freq: "weekly", byDay: ["MO", "TU"] }), []);
  assert.deepEqual(validateRecurrence({ freq: "daily", interval: 2 }), []);
  const errors = validateRecurrence({ freq: "daily", byDay: ["MO"] });
  assert.ok(errors.some((error) => error.includes("only supported for weekly")));
  assert.deepEqual(validateTemplate(weekly()), []);
  assert.deepEqual(validateTemplate({ ...weekly(), exdates: ["2026-10-07"] }), []);
  assert.ok(
    validateTemplate({ ...weekly(), exdates: ["nonsense"] }).some((error) =>
      error.includes("exdates"),
    ),
  );
});

test("an occurrence uid resolves to the occurrence the calendar shows", () => {
  const series = [weekly()];
  const resolved = occurrenceForUid(series, "swimming@example:2026-10-07");
  assert.equal(resolved?.date, "2026-10-07");
  assert.equal(resolved?.uid, "swimming@example:2026-10-07");
  assert.equal(resolved?.routineId, "swimming@example");
  // The clock travels with the occurrence rather than staying on the anchor.
  assert.equal(resolved?.start, "2026-10-07T15:00:00");
  assert.equal(resolved?.status, "pending");

  assert.equal(occurrenceForUid(series, "swimming@example"), null);
  assert.equal(occurrenceForUid(series, "swimming@example:nonsense"), null);
  assert.equal(occurrenceForUid(series, "other@example:2026-10-07"), null);
  // Before the series starts is not part of the series.
  assert.equal(occurrenceForUid(series, "swimming@example:2026-09-23"), null);
});

test("a series uid containing a colon still resolves its occurrences", () => {
  const awkward = weekly({ uid: "odd:uid@example" });
  const resolved = occurrenceForUid([awkward], "odd:uid@example:2026-10-07");
  assert.equal(resolved?.date, "2026-10-07");
});

test("recording an outcome on an occurrence stores only that day", () => {
  const series = [weekly()];
  const occurrence = occurrenceForUid(series, "swimming@example:2026-10-07");
  assert.ok(occurrence !== null);
  // The occurrence is written as a document in its own right, which is what
  // replaces the generated one for that date and leaves the other weeks alone.
  const recorded = complete([occurrence], occurrence.uid, "2026-10-07T15:45:00Z");
  assert.equal(recorded.result.item.status, "completed");
  assert.equal(recorded.items.length, 1);
  assert.equal(recorded.items[0]?.date, "2026-10-07");
  assert.equal(recorded.items[0]?.routineId, "swimming@example");
});

test("removing a series also removes what was recorded on it", () => {
  const series = [weekly()];
  const monday = materializeOccurrence(series[0]!, "2026-10-07");
  const separate = oneOff();
  const outcome = deleteSeries([monday, separate], series, "swimming@example");

  assert.equal(outcome.series.length, 0);
  assert.equal(outcome.template.uid, "swimming@example");
  // The recorded occurrence goes with the series: left behind it would look like
  // a one-off item on a day the routine no longer repeats.
  assert.deepEqual(
    outcome.items.map((item) => item.uid),
    ["dentist@example"],
  );
});

test("removing an unknown series is a not-found, not an empty success", () => {
  assert.throws(
    () => deleteSeries([], [weekly()], "nosuch@example"),
    (error: unknown) =>
      error instanceof RoutineCommandError && error.code === "not-found",
  );
});

test("a repeating routine's title can be corrected without losing the rule", () => {
  // The occurrence carries the title, so an ordinary update still applies to the
  // day it was recorded on; the series itself is the thing that repeats.
  const occurrence = materializeOccurrence(weekly(), "2026-10-07");
  const changed = update([occurrence], occurrence.uid, { title: "Swimming lesson" });
  assert.equal(changed.result.item.title, "Swimming lesson");
  assert.equal(changed.result.item.routineId, "swimming@example");
});

test("an icon is carried on an item, a template, and their occurrences", () => {
  const withIcon = oneOff({ icon: "pill" });
  const outcome = create([], withIcon);
  assert.equal(outcome.result.item.icon, "pill");

  // A series carries it, and every occurrence inherits it, so the drawing does
  // not depend on which day is being looked at.
  const template = weekly({ icon: "person-simple-walk" });
  const stored = addSeries([], [], template);
  assert.equal(stored.series[0]?.icon, "person-simple-walk");
  const occurrence = occurrenceForUid(stored.series, "swimming@example:2026-10-07");
  assert.equal(occurrence?.icon, "person-simple-walk");
});

test("an icon can be corrected or cleared without touching the routine", () => {
  const outcome = create([], oneOff({ icon: "pill" }));
  const changed = update(outcome.items, "dentist@example", { icon: "hospital" });
  assert.equal(changed.result.item.icon, "hospital");
  // Clearing it is a real state, not a missing patch.
  const cleared = update(changed.items, "dentist@example", { icon: null });
  assert.equal(cleared.result.item.icon, undefined);
  assert.equal(cleared.result.item.title, "Dentist");
});

test("an icon name of the wrong shape is refused, an unknown one is not", () => {
  // Shape is the domain's business; whether a name exists is the icon set's.
  assert.throws(
    () => create([], oneOff({ icon: "Pill With Spaces" })),
    (error: unknown) =>
      error instanceof RoutineCommandError &&
      error.code === "invalid-item" &&
      error.details.some((detail) => detail.includes("icon")),
  );

  // A name from a newer release loads; it simply draws nothing.
  const future = create([], oneOff({ icon: "some-future-icon" }));
  assert.equal(future.result.item.icon, "some-future-icon");
});

test("a stored template copies its icon rather than sharing the caller's", () => {
  const template = weekly({ icon: "repeat" });
  const stored = addSeries([], [], template);
  template.icon = "flag";
  assert.equal(stored.series[0]?.icon, "repeat");
});
