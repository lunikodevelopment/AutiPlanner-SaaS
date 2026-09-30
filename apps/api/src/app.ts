import type http from "node:http";
import { AccountStore, normalizeEmail } from "./accounts.js";
import { CalendarStore, plusDays, type CommandInput, type CommandName } from "./calendar.js";
import type { Config } from "./config.js";
import { ApiError, badRequest, notFound, tooManyRequests, unauthorized } from "./errors.js";
import {
  bearerToken,
  clearedCookie,
  clientAddress,
  isSecureRequest,
  query,
  readJsonBody,
  sendJson,
  sendNoContent,
  sessionCookie,
} from "./http-util.js";
import { CalendarRegistry } from "./registry.js";
import { RateLimiter } from "./security.js";
import { serveStatic } from "./static.js";
import type { RoutineItem } from "@autiplanner/core";

export interface AppDependencies {
  readonly config: Config;
  readonly accounts: AccountStore;
  readonly calendars: CalendarRegistry;
}

const MAX_WINDOW_DAYS = 90;
const CALENDAR_ROUTE = /^\/api\/calendars\/([^/]+)$/;

/** Routes that require a session, matched before authentication. */
function isProtectedRoute(method: string, pathname: string): boolean {
  if (pathname === "/api/auth/logout") return method === "POST";
  if (pathname === "/api/me") return method === "GET";
  if (pathname === "/api/calendars") return method === "POST";
  if (CALENDAR_ROUTE.test(pathname)) return method === "DELETE";
  if (pathname === "/api/agenda") return method === "GET";
  if (pathname === "/api/sync") return method === "GET";
  if (pathname === "/api/command") return method === "POST";
  return false;
}

const COMMANDS: readonly CommandName[] = [
  "complete",
  "mark_missed",
  "skip",
  "reset",
  "create",
  "update",
  "delete",
];

export function createApp(dependencies: AppDependencies): http.RequestListener {
  const { config, accounts, calendars } = dependencies;
  const authLimiter = new RateLimiter(config.authRateLimit);

  return (request, response) => {
    handle(request, response).catch((error: unknown) => {
      if (response.headersSent) {
        response.end();
        return;
      }
      if (error instanceof ApiError) {
        sendJson(response, error.status, { error: { code: error.code, message: error.message } });
        return;
      }
      const rateLimited = error as { rateLimited?: boolean; retryAfterSeconds?: number };
      if (rateLimited.rateLimited === true) {
        const retry = rateLimited.retryAfterSeconds ?? 60;
        response.setHeader("retry-after", String(retry));
        sendJson(response, 429, {
          error: { code: "too_many_requests", message: `Too many attempts. Retry in ${retry}s.` },
        });
        return;
      }
      // Anything unexpected is a bug: log it, but do not leak it.
      console.error("[autiplanner] unhandled error", error);
      sendJson(response, 500, { error: { code: "internal_error", message: "Something went wrong" } });
    });
  };

  async function handle(request: http.IncomingMessage, response: http.ServerResponse): Promise<void> {
    const url = new URL(request.url ?? "/", "http://localhost");
    const pathname = url.pathname;
    const method = request.method ?? "GET";

    if (!pathname.startsWith("/api/")) {
      if (config.webRoot !== null && (method === "GET" || method === "HEAD")) {
        const served = await serveStatic(request, response, config.webRoot);
        if (served) return;
      }
      throw notFound();
    }

    if (pathname === "/api/health" && method === "GET") {
      sendJson(response, 200, { status: "ok", version: "0.1.0" });
      return;
    }

    if (pathname === "/api/auth/register" && method === "POST") {
      authLimiter.check(clientAddress(request));
      if (!config.allowRegistration) {
        throw new ApiError(403, "registration_closed", "This server is not accepting new accounts");
      }
      const body = await readJsonBody(request);
      const email = requireString(body, "email");
      const password = requireString(body, "password");
      const account = await accounts.register(email, password);
      const { token } = await accounts.issueToken(account.id, "signup");
      setSession(response, request, token, config.tokenTtlDays);
      const calendarId = account.calendars[0]?.id ?? null;
      sendJson(response, 201, {
        token,
        account: { id: account.id, email: account.email },
        calendarId,
      });
      return;
    }

    if (pathname === "/api/auth/login" && method === "POST") {
      authLimiter.check(clientAddress(request));
      const body = await readJsonBody(request);
      const email = requireString(body, "email");
      const password = requireString(body, "password");
      const account = await accounts.verifyCredentials(email, password);
      const { token } = await accounts.issueToken(account.id, "signin");
      setSession(response, request, token, config.tokenTtlDays);
      sendJson(response, 200, {
        token,
        account: { id: account.id, email: account.email },
        calendarId: account.calendars[0]?.id ?? null,
      });
      return;
    }

    const token = bearerToken(request);
    // An unknown route is a 404 whether or not the caller is signed in, so the
    // path is matched before authentication rather than after it.
    if (!isProtectedRoute(method, pathname)) {
      throw notFound();
    }
    const account = await accounts.authenticate(token);

    if (pathname === "/api/auth/logout" && method === "POST") {
      if (token !== null) await accounts.revokeToken(account.id, token);
      response.setHeader("set-cookie", clearedCookie());
      sendNoContent(response);
      return;
    }

    if (pathname === "/api/me" && method === "GET") {
      sendJson(response, 200, {
        account: { id: account.id, email: account.email, createdAt: account.createdAt },
        calendars: account.calendars,
      });
      return;
    }

    if (pathname === "/api/calendars" && method === "POST") {
      const body = await readJsonBody(request);
      const name = typeof body.name === "string" ? body.name : "";
      const calendar = await accounts.addCalendar(account.id, name);
      sendJson(response, 201, { calendar });
      return;
    }

    const calendarRoute = CALENDAR_ROUTE.exec(pathname);
    if (calendarRoute !== null && method === "DELETE") {
      const calendarId = calendarRoute[1] as string;
      await accounts.removeCalendar(account.id, calendarId);
      sendNoContent(response);
      return;
    }

    const store = await resolveStore(request, account.id);

    if (pathname === "/api/agenda" && method === "GET") {
      const { from, days } = readWindow(request);
      const agenda = await store.agenda(from, days);
      sendJson(response, 200, {
        items: agenda.items.map(itemPayload),
        revision: agenda.revision,
        issues: store.calendarIssues.map((issue) => `${issue.code}: ${issue.message}`),
      });
      return;
    }

    if (pathname === "/api/sync" && method === "GET") {
      const { from, days } = readWindow(request);
      const since = Number(query(request).get("since") ?? "0");
      const agenda = await store.agenda(from, days);
      if (Number.isFinite(since) && since === agenda.revision) {
        // Nothing changed since the client last synced.
        sendJson(response, 200, { changed: false, revision: agenda.revision, items: [] });
        return;
      }
      sendJson(response, 200, {
        changed: true,
        revision: agenda.revision,
        items: agenda.items.map(itemPayload),
      });
      return;
    }

    if (pathname === "/api/command" && method === "POST") {
      const body = await readJsonBody(request);
      const input = readCommand(body);
      const outcome = await store.apply(input);
      sendJson(response, 200, {
        item: outcome.item === null ? null : itemPayload(outcome.item),
        changed: outcome.changed,
        revision: outcome.revision,
      });
      return;
    }

    throw notFound();
  }

  async function resolveStore(request: http.IncomingMessage, accountId: string): Promise<CalendarStore> {
    const requested = query(request).get("calendarId");
    const calendarId = requested ?? (await accounts.defaultCalendarId(accountId));
    await accounts.requireCalendar(accountId, calendarId);
    return calendars.get(accountId, calendarId);
  }

  function setSession(
    response: http.ServerResponse,
    request: http.IncomingMessage,
    token: string,
    ttlDays: number,
  ): void {
    response.setHeader(
      "set-cookie",
      sessionCookie(token, isSecureRequest(request), ttlDays * 24 * 60 * 60),
    );
  }
}

function readWindow(request: http.IncomingMessage): { from: string; days: number } {
  const params = query(request);
  const from = params.get("from") ?? new Date().toISOString().slice(0, 10);
  const rawDays = Number(params.get("days") ?? "14");
  if (!Number.isInteger(rawDays) || rawDays < 1 || rawDays > MAX_WINDOW_DAYS) {
    throw badRequest("invalid_window", `days must be between 1 and ${MAX_WINDOW_DAYS}`);
  }
  // Validates the date format too.
  plusDays(from, 1);
  return { from, days: rawDays };
}

export function readCommand(body: Record<string, unknown>): CommandInput {
  const command = body.command;
  if (typeof command !== "string" || !COMMANDS.includes(command as CommandName)) {
    throw badRequest("invalid_command", `command must be one of ${COMMANDS.join(", ")}`);
  }
  const input: {
    command: CommandName;
    uid?: string;
    completedAt?: string;
    expectedRevision?: number;
    clientCommandId?: string;
    item?: RoutineItem;
    patch?: Record<string, unknown>;
  } = { command: command as CommandName };

  if (body.uid !== undefined) {
    if (typeof body.uid !== "string" || body.uid.length === 0) {
      throw badRequest("invalid_command", "uid must be a non-empty string");
    }
    input.uid = body.uid;
  }
  if (body.completedAt !== undefined) {
    if (typeof body.completedAt !== "string") {
      throw badRequest("invalid_command", "completedAt must be a string");
    }
    input.completedAt = normalizeTimestamp(body.completedAt);
  }
  if (body.expectedRevision !== undefined) {
    const revision = body.expectedRevision;
    if (typeof revision !== "number" || !Number.isInteger(revision) || revision < 0) {
      throw badRequest("invalid_command", "expectedRevision must be a non-negative integer");
    }
    input.expectedRevision = revision;
  }
  if (body.clientCommandId !== undefined) {
    if (typeof body.clientCommandId !== "string" || body.clientCommandId.length > 120) {
      throw badRequest("invalid_command", "clientCommandId must be a short string");
    }
    input.clientCommandId = body.clientCommandId;
  }
  if (body.item !== undefined) {
    if (body.item === null || typeof body.item !== "object" || Array.isArray(body.item)) {
      throw badRequest("invalid_command", "item must be an object");
    }
    input.item = body.item as RoutineItem;
  }
  if (body.patch !== undefined) {
    if (body.patch === null || typeof body.patch !== "object" || Array.isArray(body.patch)) {
      throw badRequest("invalid_command", "patch must be an object");
    }
    input.patch = body.patch as Record<string, unknown>;
  }
  return input as CommandInput;
}

/**
 * Truncates fractional seconds.
 *
 * iCalendar DATE-TIME has no fractional seconds, so a client that sends
 * `...:12.345Z` is producing something the profile cannot store. Truncating at
 * the boundary is friendlier than rejecting a request over a format detail, and
 * loses nothing that could have been persisted.
 */
export function normalizeTimestamp(value: string): string {
  return value.replace(/(\.\d+)(Z|[+-]\d{2}:\d{2})$/, "$2");
}

/** The client-facing item shape, shared with the Home Assistant integration. */
export function itemPayload(item: RoutineItem): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    uid: item.uid,
    title: item.title,
    date: item.date,
    dayPart: item.dayPart,
    status: item.status,
  };
  const optional: Record<string, unknown> = {
    description: item.description,
    start: item.start,
    due: item.due,
    timezone: item.timezone,
    completedAt: item.completedAt,
    order: item.order,
    routineId: item.routineId,
    revision: item.revision,
  };
  for (const [key, value] of Object.entries(optional)) {
    if (value !== undefined) payload[key] = value;
  }
  return payload;
}

function requireString(body: Record<string, unknown>, field: string): string {
  const value = body[field];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw badRequest("invalid_field", `${field} is required`);
  }
  return value.trim();
}

export { normalizeEmail, unauthorized };
