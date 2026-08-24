/**
 * MySQL 8 returns a JSON column already parsed; MariaDB stores JSON as LONGTEXT
 * and returns a string. Hostinger ships MariaDB on most plans and MySQL on
 * others, so every JSON read goes through here rather than assuming an engine.
 */
export function parseJson<T>(value: unknown, fallback: T): T {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  return value as T;
}

/** JSON columns are written as a string so both engines accept the same insert. */
export const toJsonColumn = (value: unknown): string => JSON.stringify(value ?? null);
