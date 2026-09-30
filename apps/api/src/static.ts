import fs from "node:fs/promises";
import path from "node:path";
import type http from "node:http";

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
  ".map": "application/json; charset=utf-8",
};

/**
 * Serves the built PWA.
 *
 * The app shell and the service worker are served `no-cache` so a deploy is
 * picked up immediately; icons may be cached because they rarely change.
 * Unknown paths fall back to index.html so client-side routes deep-link.
 */
export async function serveStatic(
  request: http.IncomingMessage,
  response: http.ServerResponse,
  root: string,
): Promise<boolean> {
  const url = new URL(request.url ?? "/", "http://localhost");
  const requested = decodeURIComponent(url.pathname);
  const relative = requested === "/" ? "index.html" : requested.replace(/^\/+/, "");

  let file = path.resolve(root, relative);
  // Never serve outside the web root.
  if (!isInside(root, file)) {
    response.writeHead(403).end("Forbidden");
    return true;
  }

  if (!(await isFile(file))) {
    // A path without an extension is a client route; anything else is missing.
    if (path.extname(relative) !== "") return false;
    file = path.resolve(root, "index.html");
    if (!isInside(root, file) || !(await isFile(file))) return false;
  }

  const body = await fs.readFile(file);
  const extension = path.extname(file).toLowerCase();
  const immutable = extension === ".png" || extension === ".ico" || extension === ".svg";
  response.writeHead(200, {
    "content-type": MIME[extension] ?? "application/octet-stream",
    "content-length": body.length,
    "cache-control": immutable ? "public, max-age=86400" : "no-cache",
  });
  response.end(body);
  return true;
}

function isInside(root: string, candidate: string): boolean {
  const base = path.resolve(root);
  return candidate === base || candidate.startsWith(`${base}${path.sep}`);
}

async function isFile(file: string): Promise<boolean> {
  try {
    return (await fs.stat(file)).isFile();
  } catch {
    return false;
  }
}
