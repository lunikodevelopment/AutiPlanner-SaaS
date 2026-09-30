import crypto from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(crypto.scrypt) as (
  password: crypto.BinaryLike,
  salt: crypto.BinaryLike,
  keylen: number,
  options: crypto.ScryptOptions,
) => Promise<Buffer>;

/** scrypt parameters. N is deliberately modest so a request stays responsive. */
const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64, maxmem: 64 * 1024 * 1024 } as const;

export interface PasswordHash {
  readonly algorithm: "scrypt";
  readonly salt: string;
  readonly hash: string;
  readonly N: number;
  readonly r: number;
  readonly p: number;
}

export async function hashPassword(password: string): Promise<PasswordHash> {
  assertPasswordAcceptable(password);
  const salt = crypto.randomBytes(16);
  const derived = await scrypt(password, salt, SCRYPT.keylen, {
    N: SCRYPT.N,
    r: SCRYPT.r,
    p: SCRYPT.p,
    maxmem: SCRYPT.maxmem,
  });
  return {
    algorithm: "scrypt",
    salt: salt.toString("hex"),
    hash: derived.toString("hex"),
    N: SCRYPT.N,
    r: SCRYPT.r,
    p: SCRYPT.p,
  };
}

export async function verifyPassword(password: string, stored: PasswordHash): Promise<boolean> {
  if (stored.algorithm !== "scrypt") return false;
  let derived: Buffer;
  try {
    derived = await scrypt(password, Buffer.from(stored.salt, "hex"), stored.hash.length / 2, {
      N: stored.N,
      r: stored.r,
      p: stored.p,
      maxmem: SCRYPT.maxmem,
    });
  } catch {
    return false;
  }
  return timingSafeEqual(derived, Buffer.from(stored.hash, "hex"));
}

export function assertPasswordAcceptable(password: string): void {
  if (typeof password !== "string" || password.length < 8) {
    throw new Error("password must be at least 8 characters");
  }
  if (password.length > 512) {
    throw new Error("password must be at most 512 characters");
  }
}

/** A random bearer token. The server never stores the token itself. */
export function createToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

/** Tokens are stored hashed so a leaked data file cannot be replayed. */
export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token, "utf8").digest("hex");
}

export function timingSafeEqual(a: Buffer, b: Buffer): boolean {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function constantTimeStringEqual(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

export function newId(bytes = 16): string {
  return crypto.randomBytes(bytes).toString("hex");
}

/**
 * A fixed-window rate limiter, per key (an address) and per bucket (a route
 * group). Used to make password guessing expensive without a dependency.
 */
export class RateLimiter {
  private readonly hits = new Map<string, { count: number; resetAt: number }>();

  constructor(
    private readonly limit: number,
    private readonly windowMs = 60_000,
    private readonly now: () => number = Date.now,
  ) {}

  /** Throws when the key is over its limit, otherwise records the hit. */
  check(key: string): void {
    const current = this.now();
    const entry = this.hits.get(key);
    if (entry === undefined || entry.resetAt <= current) {
      this.hits.set(key, { count: 1, resetAt: current + this.windowMs });
      return;
    }
    entry.count += 1;
    if (entry.count > this.limit) {
      const seconds = Math.max(1, Math.ceil((entry.resetAt - current) / 1000));
      throw Object.assign(new Error(`too many attempts, retry in ${seconds}s`), {
        rateLimited: true,
        retryAfterSeconds: seconds,
      });
    }
  }

  /** Drops expired windows so the map cannot grow without bound. */
  prune(): void {
    const current = this.now();
    for (const [key, entry] of this.hits) {
      if (entry.resetAt <= current) this.hits.delete(key);
    }
  }
}
