import { newId, createToken, hashToken, hashPassword, verifyPassword, type PasswordHash } from "./security.js";
import { readJsonFile, writeJsonFile, Mutex } from "./storage.js";
import { ApiError, badRequest, conflict, notFound, unauthorized } from "./errors.js";

export interface TokenRecord {
  /** Only the hash is stored, so a leaked data file cannot be replayed. */
  readonly hash: string;
  readonly name: string;
  readonly createdAt: string;
}

export interface CalendarRecord {
  readonly id: string;
  readonly name: string;
  readonly createdAt: string;
}

export interface AccountRecord {
  readonly id: string;
  readonly email: string;
  readonly password: PasswordHash;
  readonly createdAt: string;
  tokens: TokenRecord[];
  calendars: CalendarRecord[];
}

interface AccountsFile {
  version: 1;
  accounts: AccountRecord[];
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export const DEFAULT_CALENDAR_NAME = "Routine";

/**
 * Accounts, tokens, and the list of calendars each account owns.
 *
 * Kept in one JSON document because the scale is a household, and written
 * atomically so a crash cannot corrupt it.
 */
export class AccountStore {
  private readonly lock = new Mutex();
  private accounts: AccountRecord[] = [];
  private loaded = false;

  constructor(private readonly file: string) {}

  private async ensureLoaded(): Promise<void> {
    if (this.loaded) return;
    await this.lock.run(async () => {
      if (this.loaded) return;
      const file = await readJsonFile<AccountsFile>(this.file);
      this.accounts = file?.accounts ?? [];
      this.loaded = true;
    });
  }

  private async persist(): Promise<void> {
    await writeJsonFile(this.file, { version: 1, accounts: this.accounts } satisfies AccountsFile);
  }

  async register(email: string, password: string): Promise<AccountRecord> {
    const normalized = normalizeEmail(email);
    if (!EMAIL_PATTERN.test(normalized)) {
      throw badRequest("invalid_email", "Enter a valid email address");
    }
    let hashed: PasswordHash;
    try {
      hashed = await hashPassword(password);
    } catch (error) {
      throw badRequest("invalid_password", (error as Error).message);
    }

    await this.ensureLoaded();
    return this.lock.run(async () => {
      if (this.accounts.some((account) => account.email === normalized)) {
        throw conflict("An account with that email already exists", "email_taken");
      }
      const now = new Date().toISOString();
      const account: AccountRecord = {
        id: newId(),
        email: normalized,
        password: hashed,
        createdAt: now,
        tokens: [],
        calendars: [{ id: newId(), name: DEFAULT_CALENDAR_NAME, createdAt: now }],
      };
      this.accounts.push(account);
      await this.persist();
      return account;
    });
  }

  async verifyCredentials(email: string, password: string): Promise<AccountRecord> {
    await this.ensureLoaded();
    const account = this.accounts.find((candidate) => candidate.email === normalizeEmail(email));
    // Hash even when the account is unknown so timing does not reveal existence.
    if (account === undefined) {
      await hashPassword(password).catch(() => undefined);
      throw unauthorized("Email or password is incorrect");
    }
    const ok = await verifyPassword(password, account.password);
    if (!ok) throw unauthorized("Email or password is incorrect");
    return account;
  }

  async issueToken(accountId: string, name = "device"): Promise<{ token: string; account: AccountRecord }> {
    await this.ensureLoaded();
    return this.lock.run(async () => {
      const account = this.findOrThrow(accountId);
      const token = createToken();
      account.tokens.push({ hash: hashToken(token), name, createdAt: new Date().toISOString() });
      await this.persist();
      return { token, account };
    });
  }

  async authenticate(token: string | null): Promise<AccountRecord> {
    if (!token) throw unauthorized();
    await this.ensureLoaded();
    const wanted = hashToken(token);
    const account = this.accounts.find((candidate) =>
      candidate.tokens.some((record) => record.hash === wanted),
    );
    if (account === undefined) throw unauthorized("That session is no longer valid");
    return account;
  }

  async revokeToken(accountId: string, token: string): Promise<void> {
    await this.ensureLoaded();
    await this.lock.run(async () => {
      const account = this.findOrThrow(accountId);
      const wanted = hashToken(token);
      const before = account.tokens.length;
      account.tokens = account.tokens.filter((record) => record.hash !== wanted);
      if (account.tokens.length !== before) await this.persist();
    });
  }

  async addCalendar(accountId: string, name: string): Promise<CalendarRecord> {
    const trimmed = name.trim();
    if (trimmed.length === 0) throw badRequest("invalid_name", "Enter a calendar name");
    if (trimmed.length > 80) throw badRequest("invalid_name", "Calendar name is too long");
    await this.ensureLoaded();
    return this.lock.run(async () => {
      const account = this.findOrThrow(accountId);
      const calendar: CalendarRecord = { id: newId(), name: trimmed, createdAt: new Date().toISOString() };
      account.calendars.push(calendar);
      await this.persist();
      return calendar;
    });
  }

  async removeCalendar(accountId: string, calendarId: string): Promise<void> {
    await this.ensureLoaded();
    await this.lock.run(async () => {
      const account = this.findOrThrow(accountId);
      const before = account.calendars.length;
      account.calendars = account.calendars.filter((calendar) => calendar.id !== calendarId);
      if (account.calendars.length === before) throw notFound("No such calendar");
      await this.persist();
    });
  }

  async requireCalendar(accountId: string, calendarId: string): Promise<CalendarRecord> {
    await this.ensureLoaded();
    const account = this.findOrThrow(accountId);
    const calendar = account.calendars.find((candidate) => candidate.id === calendarId);
    if (calendar === undefined) throw notFound("No such calendar");
    return calendar;
  }

  async defaultCalendarId(accountId: string): Promise<string> {
    await this.ensureLoaded();
    const account = this.findOrThrow(accountId);
    const first = account.calendars[0];
    if (first === undefined) throw new ApiError(500, "no_calendar", "Account has no calendar");
    return first.id;
  }

  private findOrThrow(accountId: string): AccountRecord {
    const account = this.accounts.find((candidate) => candidate.id === accountId);
    if (account === undefined) throw notFound("No such account");
    return account;
  }
}
