import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

/**
 * Serialises asynchronous work.
 *
 * Every calendar mutation runs inside `run`, so two requests can never
 * interleave a read-modify-write on the same file.
 */
export class Mutex {
  private tail: Promise<unknown> = Promise.resolve();

  run<T>(work: () => Promise<T>): Promise<T> {
    const result = this.tail.then(work, work);
    // Keep the chain alive even when a caller rejects.
    this.tail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }
}

/**
 * Writes a file by replacing it, so a crash mid-write cannot leave a truncated
 * file behind. The temporary file is created in the same directory to keep the
 * rename on one filesystem.
 */
export async function writeFileAtomic(target: string, contents: string): Promise<void> {
  const directory = path.dirname(target);
  await fs.mkdir(directory, { recursive: true });
  const temporary = path.join(
    directory,
    `.${path.basename(target)}.${crypto.randomBytes(6).toString("hex")}.tmp`,
  );
  let handle: fs.FileHandle | undefined;
  try {
    handle = await fs.open(temporary, "w", 0o600);
    await handle.writeFile(contents, "utf8");
    await handle.sync();
    await handle.close();
    handle = undefined;
    await fs.rename(temporary, target);
  } catch (error) {
    await handle?.close().catch(() => undefined);
    await fs.rm(temporary, { force: true }).catch(() => undefined);
    throw error;
  }
}

export async function readJsonFile<T>(file: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(file, "utf8");
    return JSON.parse(raw) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

export async function writeJsonFile(file: string, value: unknown): Promise<void> {
  await writeFileAtomic(file, `${JSON.stringify(value, null, 2)}\n`);
}

export async function fileExists(file: string): Promise<boolean> {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}
