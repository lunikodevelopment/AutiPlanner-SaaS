import path from "node:path";

export interface Config {
  readonly host: string;
  readonly port: number;
  /** Where accounts and calendars are stored. */
  readonly dataDir: string;
  /** Directory of the built PWA. Served when present. */
  readonly webRoot: string | null;
  /** Registration is open by default; a private deployment can close it. */
  readonly allowRegistration: boolean;
  readonly tokenTtlDays: number;
  /** Requests per minute allowed against the auth endpoints, per address. */
  readonly authRateLimit: number;
}

function flag(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === "") return fallback;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

function int(value: string | undefined, fallback: number): number {
  if (value === undefined || value.trim() === "") return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`expected a non-negative number, received ${JSON.stringify(value)}`);
  }
  return Math.trunc(parsed);
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const repoRoot = path.resolve(import.meta.dirname, "../../..");
  const webRoot = env.WEB_ROOT ?? path.join(repoRoot, "apps", "web", "dist");
  return {
    host: env.HOST ?? "0.0.0.0",
    port: int(env.PORT, 8080),
    dataDir: path.resolve(env.DATA_DIR ?? path.join(repoRoot, "data")),
    webRoot: env.SERVE_WEB === "false" ? null : path.resolve(webRoot),
    allowRegistration: flag(env.ALLOW_REGISTRATION, true),
    tokenTtlDays: int(env.TOKEN_TTL_DAYS, 365),
    authRateLimit: int(env.AUTH_RATE_LIMIT_PER_MINUTE, 20),
  };
}
