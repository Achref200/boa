import { describe, expect, it } from 'vitest';
import { describeDbTarget, mysqlConnectionOptions, resolveDbTarget } from '@/db/dsn';

/**
 * A managed MySQL host hands out a root password like `p@ss#word?1/2%3`. Every
 * one of those characters is significant to a URL parser, and the failure mode
 * is not a crash — it is `ER_ACCESS_DENIED` reported against a credential that
 * the dashboard swears is correct. These tests pin the characters down.
 */
describe('database target resolution', () => {
  it('keeps a password full of URL-special characters intact', () => {
    const target = resolveDbTarget({
      DATABASE_URL: 'mysql://root:p@ss#word?1/2@db.example.com:3306/boa',
    });

    expect(target.password).toBe('p@ss#word?1/2');
    expect(target.user).toBe('root');
    expect(target.host).toBe('db.example.com');
    expect(target.port).toBe(3306);
    expect(target.database).toBe('boa');
  });

  it('treats a trailing fragment as a fragment, not part of the password', () => {
    const target = resolveDbTarget({
      DATABASE_URL: 'mysql://root:secret@db.example.com:3306/boa#ignored',
    });

    expect(target.password).toBe('secret');
    expect(target.database).toBe('boa');
  });

  it('decodes a percent-encoded password that the vendor encoded', () => {
    // mysql2 and `new URL()` both decode; matching them keeps a paste from the
    // dashboard working, while DB_PASSWORD (below) stays verbatim.
    const target = resolveDbTarget({
      DATABASE_URL: 'mysql://root:p%40ss%23word@db.example.com:3306/boa',
    });

    expect(target.password).toBe('p@ss#word');
  });

  it('uses DB_PASSWORD verbatim, so no escaping is ever required', () => {
    const target = resolveDbTarget({
      DATABASE_URL: 'mysql://root:wrong@db.example.com:3306/boa',
      DB_PASSWORD: 'p%40ss#word?1',
    });

    expect(target.password).toBe('p%40ss#word?1');
  });

  it('lets discrete DB_* values override the URI field by field', () => {
    const target = resolveDbTarget({
      DATABASE_URL: 'mysql://root:secret@old-host:3306/old_db',
      DB_HOST: 'gateway01.eu-central-1.prod.aws.tidbcloud.com',
      DB_PORT: '4000',
      DB_NAME: 'boa_db',
    });

    expect(target.host).toBe('gateway01.eu-central-1.prod.aws.tidbcloud.com');
    expect(target.port).toBe(4000);
    expect(target.database).toBe('boa_db');
    // Untouched fields still come from the URI.
    expect(target.user).toBe('root');
    expect(target.password).toBe('secret');
  });

  it('requires TLS for a managed host even without a ssl parameter', () => {
    const managed = resolveDbTarget({
      DATABASE_URL: 'mysql://root:secret@gateway01.eu-central-1.prod.aws.tidbcloud.com:4000/boa',
    });
    const local = resolveDbTarget({
      DATABASE_URL: 'mysql://root:secret@localhost:3306/boa',
    });

    expect(managed.ssl).toBeTruthy();
    expect(local.ssl).toBeUndefined();
  });

  it('enables TLS when the URI asks for it', () => {
    const target = resolveDbTarget({
      DATABASE_URL: 'mysql://root:secret@db.example.com:3306/boa?sslaccept=1',
    });

    expect(target.ssl).toBeTruthy();
    // The parameter must not leak into the driver options as a stray key.
    expect(mysqlConnectionOptions({ DATABASE_URL: 'mysql://root:s@db.example.com/boa?sslaccept=1' })).not.toHaveProperty(
      'sslaccept',
    );
  });

  it('treats an empty variable as unset and names what is missing', () => {
    expect(() => resolveDbTarget({ DATABASE_URL: '   ' })).toThrow(/No database configured/);
    // A URI with no path segment names no database — the build must say so
    // rather than connect to whatever the server picks by default.
    expect(() => resolveDbTarget({ DATABASE_URL: 'mysql://root:secret@db.example.com:3306' })).toThrow(
      /No database name/,
    );
  });

  it('rejects a non-MySQL scheme instead of guessing', () => {
    expect(() => resolveDbTarget({ DATABASE_URL: 'postgres://root:secret@db.example.com/boa' })).toThrow(
      /mysql:\/\//,
    );
  });

  it('never prints the password when describing the target', () => {
    const target = resolveDbTarget({
      DATABASE_URL: 'mysql://root:p@ss#word@gateway01.eu-central-1.prod.aws.tidbcloud.com:4000/boa',
    });

    const described = describeDbTarget(target);
    expect(described).not.toContain('p@ss');
    expect(described).toContain('gateway01.eu-central-1.prod.aws.tidbcloud.com:4000/boa');
    expect(described).toContain('tls');
  });

  it('builds mysql2 options with discrete fields, never a uri', () => {
    const options = mysqlConnectionOptions({
      DATABASE_URL: 'mysql://root:p@ss@db.example.com:3306/boa',
    });

    expect(options).not.toHaveProperty('uri');
    expect(options.password).toBe('p@ss');
  });
});
