import {
  complete,
  create as createRoutineItem,
  expandSeries,
  markMissed,
  reset,
  skip,
  type RoutineItem,
} from "@autiplanner/core";
import { ApiError, isRetryable, type CommandResponse } from "./api.js";
import type { LocalState, LocalStore, PendingCommand } from "./store.js";

export interface Rejection {
  readonly command: PendingCommand;
  readonly message: string;
}

export interface FlushOutcome {
  readonly applied: readonly PendingCommand[];
  /** Commands the server will never accept, so they were dropped. */
  readonly rejected: readonly Rejection[];
  /** The server is ahead of this client; the user must decide what to keep. */
  readonly conflict: Rejection | null;
  /** A transient failure. The rest of the queue stays for the next attempt. */
  readonly failed: Rejection | null;
  readonly remaining: number;
}

/**
 * Replays the offline queue in order.
 *
 * The distinctions matter for an offline app: a conflict must stop and surface,
 * a transient failure must be retried later, and a permanent rejection must not
 * block every later command behind it.
 */
export async function flushPending(
  store: LocalStore,
  send: (command: PendingCommand) => Promise<CommandResponse>,
): Promise<FlushOutcome> {
  const pending = await store.listPending();
  const applied: PendingCommand[] = [];
  const rejected: Rejection[] = [];

  for (let index = 0; index < pending.length; index += 1) {
    const command = pending[index];
    if (command === undefined) continue;
    try {
      const response = await send(command);
      await store.removePending(command.id);
      applied.push(command);
      const state = await store.getState();
      if (state !== null) {
        await store.putState(mergeItem(state, response));
      }
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        return {
          applied,
          rejected,
          conflict: { command, message: error.message },
          failed: null,
          remaining: pending.length - index,
        };
      }
      if (isRetryable(error)) {
        return {
          applied,
          rejected,
          conflict: null,
          failed: { command, message: (error as Error).message },
          remaining: pending.length - index,
        };
      }
      // A permanent rejection: drop it so the queue can drain.
      await store.removePending(command.id);
      rejected.push({ command, message: (error as Error).message });
    }
  }

  return { applied, rejected, conflict: null, failed: null, remaining: 0 };
}

function mergeItem(state: LocalState, response: CommandResponse): LocalState {
  const items = [...state.items];
  if (response.item !== null) {
    const index = items.findIndex((item) => item.uid === response.item?.uid);
    if (index >= 0) {
      if (response.changed) items[index] = response.item;
    } else if (response.changed) {
      items.push(response.item);
    }
  }
  return { items, revision: response.revision, syncedAt: new Date().toISOString() };
}

/**
 * Applies a command to the local list so the interface responds with no network.
 *
 * The same core functions the server uses do the work, so an optimistic update
 * cannot invent a state the server would never store - a missed item stays
 * missed here too.
 *
 * `window` is the range the list covers. A repeating routine is expanded over
 * exactly that range, with the same function the server uses, so the days shown
 * offline are the days the server would send back.
 */
export function applyLocally(
  items: readonly RoutineItem[],
  command: PendingCommand,
  window?: { readonly from: string; readonly to: string },
): { items: readonly RoutineItem[]; item: RoutineItem | null } {
  try {
    switch (command.command) {
      case "complete": {
        if (command.uid === undefined || command.completedAt === undefined) break;
        const outcome = complete(items, command.uid, command.completedAt);
        return { items: outcome.items, item: outcome.result.item };
      }
      case "mark_missed": {
        if (command.uid === undefined) break;
        const outcome = markMissed(items, command.uid);
        return { items: outcome.items, item: outcome.result.item };
      }
      case "skip": {
        if (command.uid === undefined) break;
        const outcome = skip(items, command.uid);
        return { items: outcome.items, item: outcome.result.item };
      }
      case "reset": {
        if (command.uid === undefined) break;
        const outcome = reset(items, command.uid);
        return { items: outcome.items, item: outcome.result.item };
      }
      case "create": {
        if (command.item === undefined) break;
        // The core command refuses a duplicate uid, which is what we want here
        // too, so local and server behaviour cannot diverge.
        const outcome = createRoutineItem(items, command.item);
        return { items: outcome.items, item: outcome.result.item };
      }
      case "delete": {
        if (command.uid === undefined) break;
        return { items: items.filter((item) => item.uid !== command.uid), item: null };
      }
      case "add_series": {
        if (command.series === undefined) break;
        // Without a window there is nothing to expand into, and inventing one
        // would show days the server might not. The command still reaches the
        // server; only the preview waits for the answer.
        if (window === undefined) break;
        const occurrences = expandSeries(command.series, window.from, window.to, items);
        const byUid = new Map(items.map((item) => [item.uid, item]));
        for (const occurrence of occurrences) byUid.set(occurrence.uid, occurrence);
        return { items: [...byUid.values()], item: null };
      }
      default:
        break;
    }
  } catch (error) {
    console.warn("[autiplanner] could not apply locally", error);
  }
  return { items, item: null };
}
