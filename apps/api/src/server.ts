import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { AccountStore } from "./accounts.js";
import { createApp } from "./app.js";
import { loadConfig } from "./config.js";
import { CalendarRegistry } from "./registry.js";

async function main(): Promise<void> {
  const config = loadConfig();
  await fs.mkdir(config.dataDir, { recursive: true });

  const accounts = new AccountStore(path.join(config.dataDir, "accounts.json"));
  const calendars = new CalendarRegistry(config.dataDir);
  const server = http.createServer(createApp({ config, accounts, calendars }));

  await new Promise<void>((resolve) => server.listen(config.port, config.host, resolve));
  const address = server.address();
  const port = typeof address === "object" && address !== null ? address.port : config.port;
  console.log(`[autiplanner] listening on http://${config.host}:${port}`);
  console.log(`[autiplanner] data directory: ${config.dataDir}`);
  console.log(
    config.webRoot === null
      ? "[autiplanner] serving API only (SERVE_WEB=false)"
      : `[autiplanner] serving the PWA from ${config.webRoot}`,
  );

  const shutdown = (signal: string): void => {
    console.log(`[autiplanner] ${signal} received, closing`);
    server.close(() => process.exit(0));
    // Do not hang forever on a stuck connection.
    setTimeout(() => process.exit(0), 5000).unref();
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

main().catch((error: unknown) => {
  console.error("[autiplanner] failed to start", error);
  process.exit(1);
});
