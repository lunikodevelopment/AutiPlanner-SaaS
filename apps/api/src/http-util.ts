import type http from "node:http";
import { ApiError, badRequest } from "./errors.js";

/** Bodies are small: a routine item, not an upload. */
const MAX_BODY_BYTES = 256 * 1024;

export async function readJsonBody(request: http.IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = chunk as Buffer;
    size += buffer.length;
    if (size > MAX_BODY_BYTES) {
      throw Object.assign(badRequest("body_too_large", "Request body is too large"), {
        status: 413,
      });
    }
    chunks.push(buffer);
  }
  if (size === 0) return {};
  const text = Buffer.concat(chunks).toString("utf8");
  try {
    const parsed: unknown = JSON.parse(text);
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw badRequest("invalid_body", "Body must be a JSON object");
    }
    return parsed as Record<string, unknown>;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw badRequest("invalid_json", "Body is not valid JSON");
  }
}

export function sendJson(response: http.ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(payload),
    "cache-control": "no-store",
  });
  response.end(payload);
}

export function sendNoContent(response: http.ServerResponse): void {
  response.writeHead(204, { "cache-control": "no-store" });
  response.end();
}

export function parseCookies(header: string | undefined): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!header) return cookies;
  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator <= 0) continue;
    const key = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    if (key) cookies[key] = decodeURIComponent(value);
  }
  return cookies;
}

export function bearerToken(request: http.IncomingMessage): string | null {
  const header = request.headers.authorization;
  if (typeof header === "string" && header.toLowerCase().startsWith("bearer ")) {
    const token = header.slice(7).trim();
    if (token.length > 0) return token;
  }
  const cookies = parseCookies(request.headers.cookie);
  return cookies[TOKEN_COOKIE] ?? null;
}

export const TOKEN_COOKIE = "autiplanner_session";

/**
 * The session cookie is HttpOnly so page scripts cannot read it, and SameSite
 * lax so a cross-site form post does not carry it.
 */
export function sessionCookie(token: string, secure: boolean, maxAgeSeconds: number): string {
  const parts = [
    `${TOKEN_COOKIE}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAgeSeconds}`,
  ];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

export function clearedCookie(): string {
  return `${TOKEN_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export function clientAddress(request: http.IncomingMessage): string {
  // Behind a reverse proxy the socket address is the proxy, so prefer the
  // forwarded header when the deployment sets it.
  const forwarded = request.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) {
    const first = forwarded.split(",")[0];
    if (first) return first.trim();
  }
  return request.socket.remoteAddress ?? "unknown";
}

export function isSecureRequest(request: http.IncomingMessage): boolean {
  const proto = request.headers["x-forwarded-proto"];
  if (typeof proto === "string") return proto.split(",")[0]?.trim() === "https";
  return false;
}

export function query(request: http.IncomingMessage): URLSearchParams {
  const url = new URL(request.url ?? "/", "http://localhost");
  return url.searchParams;
}
