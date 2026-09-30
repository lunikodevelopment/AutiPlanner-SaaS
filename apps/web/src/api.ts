import type { RoutineItem } from "@autiplanner/core";

/** An error returned by the API, with the status so callers can branch on it. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export type CommandName =
  | "complete"
  | "mark_missed"
  | "skip"
  | "reset"
  | "create"
  | "update"
  | "delete";

export interface CommandRequest {
  readonly command: CommandName;
  readonly uid?: string;
  readonly completedAt?: string;
  readonly expectedRevision?: number;
  /** Stable key so a retried offline command is applied only once. */
  readonly clientCommandId?: string;
  readonly item?: RoutineItem;
  readonly patch?: Record<string, unknown>;
}

export interface AgendaResponse {
  readonly items: readonly RoutineItem[];
  readonly revision: number;
}

export interface CommandResponse {
  readonly item: RoutineItem | null;
  readonly changed: boolean;
  readonly revision: number;
}

export interface Session {
  readonly email: string;
  readonly calendarId: string | null;
}

export interface CalendarRecord {
  readonly id: string;
  readonly name: string;
  /** Path of the read-only .ics feed, once the server has minted a token. */
  readonly feedPath?: string;
}

export interface MeResponse {
  readonly account: { readonly id: string; readonly email: string };
  readonly calendars: readonly CalendarRecord[];
}

export interface Feed {
  readonly path: string;
}

export interface Api {
  register(email: string, password: string): Promise<Session>;
  login(email: string, password: string): Promise<Session>;
  logout(): Promise<void>;
  agenda(from: string, days: number): Promise<AgendaResponse>;
  command(request: CommandRequest): Promise<CommandResponse>;
  me(): Promise<MeResponse>;
  rotateFeed(calendarId: string): Promise<Feed>;
}

/**
 * Talks to the hosted API.
 *
 * Authentication is an HttpOnly session cookie, so the page never stores a
 * token. That requires the PWA and the API to share an origin, which is how the
 * server is packaged.
 */
export class HttpApi implements Api {
  constructor(
    private readonly baseUrl = "",
    private readonly fetcher: typeof fetch = globalThis.fetch.bind(globalThis),
  ) {}

  register(email: string, password: string): Promise<Session> {
    return this.post<Session>("/api/auth/register", { email, password });
  }

  login(email: string, password: string): Promise<Session> {
    return this.post<Session>("/api/auth/login", { email, password });
  }

  async logout(): Promise<void> {
    await this.request("POST", "/api/auth/logout");
  }

  async agenda(from: string, days: number): Promise<AgendaResponse> {
    const response = await this.request(
      "GET",
      `/api/agenda?from=${encodeURIComponent(from)}&days=${days}`,
    );
    const body = (await response.json()) as { items: RoutineItem[]; revision: number };
    return { items: body.items, revision: body.revision };
  }

  async command(request: CommandRequest): Promise<CommandResponse> {
    const response = await this.request("POST", "/api/command", request);
    return (await response.json()) as CommandResponse;
  }

  async me(): Promise<MeResponse> {
    const response = await this.request("GET", "/api/me");
    return (await response.json()) as MeResponse;
  }

  async rotateFeed(calendarId: string): Promise<Feed> {
    const response = await this.request(
      "POST",
      `/api/calendars/${encodeURIComponent(calendarId)}/feed/rotate`,
    );
    const body = (await response.json()) as { feed: Feed };
    return body.feed;
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    const response = await this.request("POST", path, body);
    return (await response.json()) as T;
  }

  private async request(method: string, path: string, body?: unknown): Promise<Response> {
    const response = await this.fetcher(`${this.baseUrl}${path}`, {
      method,
      credentials: "same-origin",
      headers: body === undefined ? {} : { "content-type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if (!response.ok) {
      throw await toApiError(response);
    }
    return response;
  }
}

async function toApiError(response: Response): Promise<ApiError> {
  const fallback = `Request failed with status ${response.status}`;
  try {
    const body = (await response.json()) as { error?: { code?: string; message?: string } };
    return new ApiError(
      response.status,
      body.error?.code ?? "unknown",
      body.error?.message ?? fallback,
    );
  } catch {
    return new ApiError(response.status, "unknown", fallback);
  }
}

/** True when the failure is transient and the command should be retried later. */
export function isRetryable(error: unknown): boolean {
  if (error instanceof ApiError) return error.status >= 500 || error.status === 429;
  // A network failure arrives as a TypeError from fetch.
  return true;
}
