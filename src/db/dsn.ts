/**
 * One tolerant place where "which database am I talking to?" is answered.
 *
 * Why this exists rather than handing the URI straight to `mysql2`:
 *
 *  1. **Passwords with URL-special characters break URL parsing.** A managed
 *     host generates passwords like `p@ss#word/1?x`. `new URL()` reads `#` as a
 *     fragment delimiter and silently truncates the password, so the server
 *     answers `ER_ACCESS_DENIED` even though the credential in the dashboard is
 *     correct. We parse the URI by hand (last `@` splits auth from host, first
 *     `:` splits user from password) so any character survives.
 *  2. **Escaping is a trap.** Telling an operator to percent-encode a secret
 *     before pasting it into a dashboard is a bug waiting to ship. The discrete
 *     `DB_*` variables below are used verbatim — no encoding, ever.
 *
 * Resolution order, most explicit wins:
 *
 *   DB_HOST / DB_PORT / DB_USER / DB_PASSWORD / DB_NAME   (verbatim values)
 *     over
 *   DATABASE_URL                                          (parsed, then decoded)
 *
 * So a deployment can keep its existing `DATABASE_URL` and override only the
 * password with `DB_PASSWORD` — the smallest possible change that makes a
 * special-character password work.
 *
 * This module deliberately has no `server-only` import and no schema library,
 * so `scripts/*.ts` (which run outside Next) can use the exact same rules as the
 * app. A CLI that resolves the target differently from production is how you get
 * "it worked locally" bug reports.
 */
import type { PoolOptions } from 'mysql2';

export type DbSource = Record<string, string | undefined>;

export type DbTarget = {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  /** `undefined` means plaintext. Set for any host that requires TLS. */
  ssl: PoolOptions['ssl'];
};

/** Hosts that reject unencrypted connections. */
const MANAGED_HOST =
  /(^|\.)(tidbcloud\.com|aivencloud\.com|psdbcloud\.com|rds\.amazonaws\.com|database\.azure\.com|cleardb\.net|db\.ondigitalocean\.com|neon\.tech)$/i;

/** Query parameters that request TLS rather than name a driver option. */
const TLS_PARAMS = ['sslaccept', 'sslmode', 'ssl-mode', 'ssl', 'tls'];

/** Treat an empty string as "not configured" — an empty var is a paste mistake. */
function read(source: DbSource, key: string): string | undefined {
  const raw = source[key];
  if (raw === undefined) return undefined;
  const trimmed = raw.trim();
  return trimmed === '' ? undefined : trimmed;
}

/**
 * Percent-decode only when the value actually contains an escape, and never
 * throw: a literal `%` in a password is legal and `decodeURIComponent` rejects
 * it as malformed.
 */
function decode(value: string): string {
  if (!value.includes('%')) return value;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

type ParsedUrl = Omit<DbTarget, 'ssl'> & { tlsRequested: boolean };

/** Split `user:password@host:port/database?query#fragment` from the right places. */
function parseMysqlUrl(uri: string): ParsedUrl {
  const schemeEnd = uri.indexOf('://');
  const scheme = schemeEnd === -1 ? '' : uri.slice(0, schemeEnd).toLowerCase();
  if (scheme !== 'mysql' && scheme !== 'mariadb') {
    throw new Error(
      `DATABASE_URL must start with mysql:// or mariadb:// (got "${scheme || uri.slice(0, 12)}").`,
    );
  }

  const rest = uri.slice(schemeEnd + 3);

  // Split credentials off *first*, before looking for a query or fragment. A
  // password may contain '@', '?' and '#'; a hostname may contain none of them.
  // Searching for '#' or '?' first would silently truncate `p@ss#word?1` — the
  // exact ER_ACCESS_DENIED this module exists to prevent.
  let credentials = '';
  let hostPart = rest;
  const at = rest.lastIndexOf('@');
  if (at !== -1) {
    credentials = rest.slice(0, at);
    hostPart = rest.slice(at + 1);
  }

  // Only the host half can carry a fragment or query string.
  const hash = hostPart.indexOf('#');
  if (hash !== -1) hostPart = hostPart.slice(0, hash);

  let query = '';
  const q = hostPart.indexOf('?');
  if (q !== -1) {
    query = hostPart.slice(q + 1);
    hostPart = hostPart.slice(0, q);
  }

  const params = new URLSearchParams(query);
  const tlsRequested = TLS_PARAMS.some((key) => params.has(key));

  let user = '';
  let password = '';
  if (credentials) {
    const colon = credentials.indexOf(':');
    if (colon === -1) {
      user = decode(credentials);
    } else {
      user = decode(credentials.slice(0, colon));
      password = decode(credentials.slice(colon + 1));
    }
  }

  let database = '';
  const slash = hostPart.indexOf('/');
  if (slash !== -1) {
    database = decode(hostPart.slice(slash + 1));
    hostPart = hostPart.slice(0, slash);
  }

  let host = hostPart;
  let port = 3306;
  if (hostPart.startsWith('[')) {
    // IPv6 literal, e.g. [::1]:3306
    const close = hostPart.indexOf(']');
    host = hostPart.slice(0, close + 1);
    const after = hostPart.slice(close + 1);
    if (after.startsWith(':')) port = Number(after.slice(1)) || 3306;
  } else {
    const lastColon = hostPart.lastIndexOf(':');
    if (lastColon !== -1) {
      const maybePort = hostPart.slice(lastColon + 1);
      if (/^\d+$/.test(maybePort)) {
        port = Number(maybePort);
        host = hostPart.slice(0, lastColon);
      }
    }
  }

  if (!host) throw new Error('DATABASE_URL is missing a host.');

  return { host, port, user, password, database, tlsRequested };
}
function isEmptyUrl(value: string | undefined): boolean {
  return value === undefined || value.trim() === '';
}

/**
 * Resolve the target from the environment. Discrete `DB_*` values win over the
 * URI, field by field, so a single override is enough.
 */
export function resolveDbTarget(source: DbSource = process.env): DbTarget {
  const url = read(source, 'DATABASE_URL');
  const host = read(source, 'DB_HOST');
  const user = read(source, 'DB_USER');
  const database = read(source, 'DB_NAME') ?? read(source, 'DB_DATABASE');

  if (isEmptyUrl(url) && (!host || !user || !database)) {
    throw new Error(
      'No database configured. Set DATABASE_URL, or set DB_HOST, DB_USER and DB_NAME together ' +
        '(plus DB_PASSWORD). See .env.example.',
    );
  }

  const parsed: ParsedUrl = isEmptyUrl(url)
    ? { host: '', port: 3306, user: '', password: '', database: '', tlsRequested: false }
    : parseMysqlUrl(url as string);

  const portRaw = read(source, 'DB_PORT');

  const target: Omit<DbTarget, 'ssl'> = {
    host: host ?? parsed.host,
    port: portRaw ? Number(portRaw) : parsed.port,
    user: user ?? parsed.user,
    // Read verbatim — never decoded, never re-encoded.
    password: read(source, 'DB_PASSWORD') ?? parsed.password,
    database: database ?? parsed.database,
  };

  if (!target.host) throw new Error('No database host resolved.');
  if (!target.user) throw new Error('No database user resolved.');
  if (!target.database) {
    throw new Error('No database name resolved. Add it to DATABASE_URL, or set DB_NAME.');
  }
  if (!Number.isInteger(target.port) || target.port <= 0) {
    throw new Error(`Invalid database port: ${String(portRaw ?? parsed.port)}.`);
  }

  const wantsTls = parsed.tlsRequested || MANAGED_HOST.test(target.host);
  return { ...target, ssl: wantsTls ? { rejectUnauthorized: true } : undefined };
}

/**
 * Connection options for `mysql2`. Discrete fields, not `uri` — that is the
 * whole point: nothing re-parses the password.
 */
export function mysqlConnectionOptions(source: DbSource = process.env) {
  const target = resolveDbTarget(source);
  return {
    host: target.host,
    port: target.port,
    user: target.user,
    password: target.password,
    database: target.database,
    ...(target.ssl ? { ssl: target.ssl } : {}),
  };
}

/** Same as {@link mysqlConnectionOptions}, typed for `createPool`. */
export function mysqlPoolOptions(source: DbSource = process.env): PoolOptions {
  return mysqlConnectionOptions(source);
}

/** Never log a password. Used by every script that announces its target. */
export function describeDbTarget(target: DbTarget): string {
  const tls = target.ssl ? ' tls' : '';
  return `${target.user}@${target.host}:${target.port}/${target.database}${tls}`;
}


