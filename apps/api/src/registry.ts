import path from "node:path";
import { CalendarStore } from "./calendar.js";

/**
 * Keeps exactly one CalendarStore per calendar file.
 *
 * This matters for correctness, not just for caching: each store owns the
 * mutex that serialises writes to its file. Two store instances for the same
 * file would mutex against themselves and could interleave a
 * read-modify-write, losing an update.
 */
export class CalendarRegistry {
  private readonly stores = new Map<string, CalendarStore>();

  constructor(private readonly dataDir: string) {}

  get(accountId: string, calendarId: string): CalendarStore {
    const key = `${accountId}/${calendarId}`;
    const existing = this.stores.get(key);
    if (existing !== undefined) return existing;

    const directory = path.join(this.dataDir, "calendars", accountId);
    const store = new CalendarStore(
      path.join(directory, `${calendarId}.ics`),
      path.join(directory, `${calendarId}.meta.json`),
    );
    this.stores.set(key, store);
    return store;
  }
}
