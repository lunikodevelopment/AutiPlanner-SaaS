import {
  addSeries,
  complete,
  create,
  deleteItem,
  deleteSeries,
  expandSeries,
  isCalendarDate,
  markMissed,
  occurrenceForUid,
  reset,
  RoutineCommandError,
  skip,
  update,
  type RoutineItem,
  type RoutineItemPatch,
  type RoutineStatus,
  type RoutineTemplate,
} from "@autiplanner/core";
import { parseCalendar, serializeCalendar, type IcsIssue } from "@autiplanner/ics";
import fs from "node:fs/promises";
import path from "node:path";
import { ApiError, badRequest, conflict, notFound } from "./errors.js";
import { createToken } from "./security.js";
import { Mutex, writeFileAtomic } from "./storage.js";

export interface CalendarMeta {
  /** Monotonic counter across every change to this calendar. */
  revision: number;
  updatedAt: string;
  /**
   * Idempotency keys already applied. An offline client may retry a command it
   * never saw acknowledged; the key stops it being applied twice.
   */
  appliedCommands: string[];
  /**
   * Secret for the read-only ``.ics`` subscription feed that Google Calendar and
   * Apple Calendar can add by URL. Absent until the feed is first requested, so
   * an existing calendar is not given one behind the household's back.
   */
  feedToken?: string;
}

/** Bounds the idempotency ledger so it cannot grow without limit. */
const MAX_APPLIED_COMMANDS = 500;

export interface AgendaResult {
  readonly items: readonly RoutineItem[];
  readonly revision: number;
}

export type CommandName =
  | "complete"
  | "mark_missed"
  | "skip"
  | "reset"
  | "create"
  | "update"
  | "delete"
  | "add_series";

/** Commands that record an outcome and so may target a series occurrence. */
const STATUS_COMMANDS: ReadonlySet<CommandName> = new Set([
  "complete",
  "mark_missed",
  "skip",
  "reset",
]);

export interface CommandInput {
  readonly command: CommandName;
  readonly uid?: string;
  readonly completedAt?: string;
  readonly expectedRevision?: number;
  /** A stable key supplied by the client so a retry is not applied twice. */
  readonly clientCommandId?: string;
  readonly item?: RoutineItem;
  /** A repeating template, for `add_series`. Completion never belongs on it. */
  readonly series?: RoutineTemplate;
  readonly patch?: RoutineItemPatch;
}

export interface CommandOutcome {
  readonly item: RoutineItem | null;
  readonly changed: boolean;
  readonly revision: number;
}

/**
 * A single calendar file, owned by one account.
 *
 * The four-state outcomes and the iCalendar round trip come from the shared
 * packages, so the hosted service cannot drift from the Home Assistant
 * integration: a missed item is never rewritten as completed here either.
 */
export class CalendarStore {
  private readonly lock = new Mutex();
  private items: RoutineItem[] = [];
  private series: RoutineTemplate[] = [];
  private preserved: string[] = [];
  private issues: IcsIssue[] = [];
  private meta: CalendarMeta = { revision: 0, updatedAt: new Date(0).toISOString(), appliedCommands: [] };
  private loaded = false;

  constructor(
    private readonly icsPath: string,
    private readonly metaPath: string,
  ) {}

  get revision(): number {
    return this.meta.revision;
  }

  get calendarIssues(): readonly IcsIssue[] {
    return this.issues;
  }

  /** The subscription token, or null when no feed has been requested yet. */
  get feedToken(): string | null {
    return this.meta.feedToken ?? null;
  }

  /** Returns the feed token, creating it on first use. */
  async ensureFeedToken(): Promise<string> {
    await this.ensureLoaded();
    return this.lock.run(async () => {
      if (this.meta.feedToken) return this.meta.feedToken;
      const token = createToken();
      this.meta.feedToken = token;
      await this.persistMetaUnlocked();
      return token;
    });
  }

  /** Replaces the feed token. The previous subscription URL stops working. */
  async rotateFeedToken(): Promise<string> {
    await this.ensureLoaded();
    return this.lock.run(async () => {
      const token = createToken();
      this.meta.feedToken = token;
      await this.persistMetaUnlocked();
      return token;
    });
  }

  /**
   * Items overlapping ``[from, to)`` with series expanded, for the subscription
   * feed.
   *
   * Reuses the range logic the agenda endpoint uses, so the feed and an agenda
   * read never disagree about which occurrences exist.
   */
  async feedItems(from: string, to: string): Promise<RoutineItem[]> {
    await this.ensureLoaded();
    return this.lock.run(async () => this.itemsForRange(from, to));
  }

  async ensureLoaded(): Promise<void> {
    if (this.loaded) return;
    await this.lock.run(async () => {
      if (this.loaded) return;
      await this.loadUnlocked();
      this.loaded = true;
    });
  }

  /** Items overlapping [from, from + days), with series expanded. */
  async agenda(from: string, days: number): Promise<AgendaResult> {
    await this.ensureLoaded();
    return this.lock.run(async () => {
      const end = plusDays(from, days);
      return { items: this.itemsForRange(from, end), revision: this.meta.revision };
    });
  }

  async apply(input: CommandInput): Promise<CommandOutcome> {
    await this.ensureLoaded();
    return this.lock.run(async () => {
      const key = input.clientCommandId;
      if (key !== undefined && this.meta.appliedCommands.includes(key)) {
        // Already applied. Return the current item so a retry is a no-op.
        return {
          item: input.uid !== undefined ? this.find(input.uid) : null,
          changed: false,
          revision: this.meta.revision,
        };
      }

      // Optimistic concurrency is checked against the calendar revision, which
      // is the value `GET /api/agenda` hands the client. The per-record
      // revision in the ICS is internal metadata and is not the client's token.
      if (input.expectedRevision !== undefined && input.expectedRevision !== this.meta.revision) {
        throw conflict(
          `the calendar is at revision ${this.meta.revision}, not ${input.expectedRevision}`,
          "revision_conflict",
        );
      }

      const before = this.items;
      // Series can change too, so they are part of the rollback: restoring only
      // the items would leave a rule in memory that the file never received.
      const beforeSeries = this.series;
      const result = this.mutate(input);
      if (!result.changed) {
        return { item: result.item, changed: false, revision: this.meta.revision };
      }

      this.meta.revision += 1;
      this.meta.updatedAt = new Date().toISOString();
      if (key !== undefined) {
        this.meta.appliedCommands.push(key);
        if (this.meta.appliedCommands.length > MAX_APPLIED_COMMANDS) {
          this.meta.appliedCommands.splice(0, this.meta.appliedCommands.length - MAX_APPLIED_COMMANDS);
        }
      }
      try {
        await this.persistUnlocked();
      } catch (error) {
        // A failed write must not leave the in-memory state ahead of the file.
        this.items = before;
        this.series = beforeSeries;
        this.meta.revision -= 1;
        if (key !== undefined) this.meta.appliedCommands.pop();
        throw error;
      }
      return { item: result.item, changed: true, revision: this.meta.revision };
    });
  }

  private mutate(input: CommandInput): { item: RoutineItem | null; changed: boolean } {
    try {
      // An outcome recorded against a repeating routine targets a day, not the
      // stored list: the occurrence does not exist as a document until something
      // is said about it. Writing it here means the day it was recorded on is
      // the only day that changes.
      if (STATUS_COMMANDS.has(input.command) && input.uid !== undefined) {
        this.materializeSeriesOccurrence(input.uid);
      }
      switch (input.command) {
        case "add_series": {
          if (!input.series) throw badRequest("invalid_command", "add_series requires series");
          const outcome = addSeries(this.items, this.series, input.series);
          this.series = [...outcome.series];
          return { item: null, changed: outcome.result.changed };
        }
        case "complete": {
          requireUid(input);
          if (!input.completedAt) {
            throw badRequest("invalid_command", "complete requires completedAt");
          }
          const outcome = complete(this.items, input.uid, input.completedAt);
          this.items = [...outcome.items];
          return { item: outcome.result.item, changed: outcome.result.changed };
        }
        case "mark_missed": {
          requireUid(input);
          const outcome = markMissed(this.items, input.uid);
          this.items = [...outcome.items];
          return { item: outcome.result.item, changed: outcome.result.changed };
        }
        case "skip": {
          requireUid(input);
          const outcome = skip(this.items, input.uid);
          this.items = [...outcome.items];
          return { item: outcome.result.item, changed: outcome.result.changed };
        }
        case "reset": {
          requireUid(input);
          const outcome = reset(this.items, input.uid);
          this.items = [...outcome.items];
          return { item: outcome.result.item, changed: outcome.result.changed };
        }
        case "create": {
          if (!input.item) throw badRequest("invalid_command", "create requires item");
          const outcome = create(this.items, input.item);
          this.items = [...outcome.items];
          return { item: outcome.result.item, changed: outcome.result.changed };
        }
        case "update": {
          requireUid(input);
          if (!input.patch) throw badRequest("invalid_command", "update requires patch");
          const outcome = update(this.items, input.uid, input.patch);
          this.items = [...outcome.items];
          return { item: outcome.result.item, changed: outcome.result.changed };
        }
        case "delete": {
          requireUid(input);
          // A repeating routine is removed by its own uid, as in the on-device
          // integration. Its recorded occurrences go with it.
          if (this.series.some((template) => template.uid === input.uid)) {
            const outcome = deleteSeries(this.items, this.series, input.uid);
            this.items = [...outcome.items];
            this.series = [...outcome.series];
            return { item: null, changed: outcome.changed };
          }
          const outcome = deleteItem(this.items, input.uid);
          this.items = [...outcome.items];
          return { item: outcome.item, changed: outcome.changed };
        }
        default: {
          const exhaustive: never = input.command;
          throw badRequest("invalid_command", `unknown command ${String(exhaustive)}`);
        }
      }
    } catch (error) {
      if (error instanceof RoutineCommandError) throw translate(error);
      throw error;
    }
  }

  private itemsForRange(from: string, to: string): RoutineItem[] {
    const direct = this.items.filter((item) => item.date >= from && item.date < to);
    const seen = new Set(direct.map((item) => item.uid));
    const expanded: RoutineItem[] = [];
    for (const template of this.series) {
      for (const occurrence of expandSeries(template, from, to, this.items)) {
        if (seen.has(occurrence.uid)) continue;
        seen.add(occurrence.uid);
        expanded.push(occurrence);
      }
    }
    return [...direct, ...expanded].sort(compareItems);
  }

  private find(uid: string): RoutineItem | null {
    return this.items.find((item) => item.uid === uid) ?? null;
  }

  /**
   * Adds the pending occurrence a series uid names.
   *
   * Nothing is written for a day until something is said about it, so the
   * occurrence has to exist as a document here before its outcome can be stored.
   * The rule itself is untouched: only that day changes.
   */
  private materializeSeriesOccurrence(uid: string): void {
    if (this.items.some((item) => item.uid === uid)) return;
    const occurrence = occurrenceForUid(this.series, uid);
    if (occurrence === null) return;
    this.items = [...this.items, occurrence];
  }

  private async loadUnlocked(): Promise<void> {
    const raw = await fs.readFile(this.icsPath, "utf8").catch((error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") return null;
      throw error;
    });
    if (raw === null) {
      this.items = [];
      this.series = [];
      this.preserved = [];
      this.issues = [];
    } else {
      const parsed = parseCalendar(raw);
      this.items = [...parsed.items];
      this.series = [...parsed.series];
      this.preserved = [...parsed.preserved];
      this.issues = [...parsed.issues];
    }

    const meta = await fs
      .readFile(this.metaPath, "utf8")
      .then((text) => JSON.parse(text) as CalendarMeta)
      .catch((error: NodeJS.ErrnoException) => {
        if (error.code === "ENOENT") return null;
        throw error;
      });
    this.meta = meta ?? { revision: 0, updatedAt: new Date().toISOString(), appliedCommands: [] };
    if (!Array.isArray(this.meta.appliedCommands)) this.meta.appliedCommands = [];
  }

  private async persistMetaUnlocked(): Promise<void> {
    await writeFileAtomic(this.metaPath, `${JSON.stringify(this.meta, null, 2)}\n`);
  }

  private async persistUnlocked(): Promise<void> {
    const ics = serializeCalendar({
      items: this.items,
      series: this.series,
      preserved: this.preserved,
    });
    await writeFileAtomic(this.icsPath, ics);
    await writeFileAtomic(this.metaPath, `${JSON.stringify(this.meta, null, 2)}\n`);
    await fs.mkdir(path.dirname(this.icsPath), { recursive: true });
  }
}

function requireUid(input: CommandInput): asserts input is CommandInput & { uid: string } {
  if (!input.uid) throw badRequest("invalid_command", `${input.command} requires uid`);
}

/** Maps a domain error onto the HTTP contract. */
function translate(error: RoutineCommandError): ApiError {
  switch (error.code) {
    case "not-found":
      return notFound(error.message);
    case "conflict":
      return conflict(error.message, "revision_conflict");
    case "duplicate-uid":
      return conflict(error.message, "duplicate_uid");
    case "series-completion":
      return conflict(error.message, "series_completion");
    default:
      return badRequest("invalid_command", error.details.length > 0 ? error.details.join("; ") : error.message);
  }
}

function compareItems(a: RoutineItem, b: RoutineItem): number {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  const orderA = a.order ?? Number.POSITIVE_INFINITY;
  const orderB = b.order ?? Number.POSITIVE_INFINITY;
  if (orderA !== orderB) return orderA - orderB;
  if (a.title !== b.title) return a.title < b.title ? -1 : 1;
  return a.uid < b.uid ? -1 : a.uid > b.uid ? 1 : 0;
}

export function plusDays(date: string, days: number): string {
  if (!isCalendarDate(date)) throw badRequest("invalid_date", "from must be YYYY-MM-DD");
  const [year, month, day] = date.split("-").map(Number) as [number, number, number];
  const utc = new Date(Date.UTC(year, month - 1, day));
  utc.setUTCDate(utc.getUTCDate() + days);
  return utc.toISOString().slice(0, 10);
}

export const STATUSES: readonly RoutineStatus[] = ["pending", "completed", "missed", "skipped"];
