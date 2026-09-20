/*
 * Throwaway diagnostic: verify the TiDB credential that Vercel actually stores.
 *
 * Reads the project env vars with decrypt=true, then attempts a real MySQL
 * connection for each DATABASE_URL target we can read. Never prints a password
 * or a full DSN — only host, db, password length and the server's answer.
 *
 * Not part of the app; delete after the deploy is green.
 */
const https = require('https');
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const authPath = path.join(process.env.APPDATA, 'com.vercel.cli', 'Data', 'auth.json');
const token = JSON.parse(fs.readFileSync(authPath, 'utf8')).token;

const PROJECT = 'prj_tzLq5DYczQ02atncsVJAMlsYybtY';
const TEAM = 'team_rh3fHOu9KT1vk7rMnC1ajS4v';

function apiGet(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { Authorization: 'Bearer ' + token } })
      .on('response', (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch {
            resolve({ raw: data.slice(0, 400) });
          }
        });
      })
      .on('error', reject);
  });
}

/** Hand parser: last '@' splits auth from host; first ':' splits user from password. */
function parseMysqlUrl(uri) {
  const schemeEnd = uri.indexOf('://');
  const rest = uri.slice(schemeEnd + 3);
  const at = rest.lastIndexOf('@');
  const auth = rest.slice(0, at);
  const after = rest.slice(at + 1);
  const colon = auth.indexOf(':');
  const user = auth.slice(0, colon);
  const password = auth.slice(colon + 1);
  const slash = after.indexOf('/');
  const hostPort = slash === -1 ? after : after.slice(0, slash);
  const database = slash === -1 ? '' : after.slice(slash + 1).split('?')[0];
  const lastColon = hostPort.lastIndexOf(':');
  const host = lastColon === -1 ? hostPort : hostPort.slice(0, lastColon);
  const port = lastColon === -1 ? 3306 : Number(hostPort.slice(lastColon + 1)) || 3306;
  return { host, port, user, password, database };
}

/** What mysql2's own URL parser would extract — the value the old code used. */
function urlParserView(uri) {
  try {
    const u = new URL(uri);
    return {
      host: u.hostname,
      port: Number(u.port) || 3306,
      user: decodeURIComponent(u.username),
      password: decodeURIComponent(u.password),
      database: u.pathname.replace(/^\//, ''),
    };
  } catch (e) {
    return { error: e.code || e.message };
  }
}

async function tryConnect(label, dsn) {
  const t = parseMysqlUrl(dsn);
  console.log(`\n--- ${label} ---`);
  console.log(`  target      : ${t.user}@${t.host}:${t.port}/${t.database}`);
  console.log(`  password len: ${t.password.length}`);

  // Show which characters would have been mangled by `new URL()`.
  const viaUrl = urlParserView(dsn);
  if (viaUrl.error) {
    console.log(`  URL parser  : THROWS (${viaUrl.error})  <-- old code crashed here`);
  } else if (viaUrl.password !== t.password || viaUrl.host !== t.host) {
    console.log(
      `  URL parser  : MANGLES  pw ${viaUrl.password.length} vs ${t.password.length}, host "${viaUrl.host}"  <-- old bug`,
    );
  } else {
    console.log('  URL parser  : agrees (no special characters in password)');
  }

  for (const mode of ['plain', 'tls']) {
    try {
      const conn = await mysql.createConnection({
        host: t.host,
        port: t.port,
        user: t.user,
        password: t.password,
        database: t.database,
        connectTimeout: 15000,
        ...(mode === 'tls' ? { ssl: { rejectUnauthorized: true } } : {}),
      });
      const [rows] = await conn.query('SELECT COUNT(*) AS tables FROM information_schema.tables WHERE table_schema = ?', [
        t.database,
      ]);
      console.log(`  ${mode.padEnd(5)}       : OK — ${rows[0].tables} tables in ${t.database}`);
      await conn.end();
    } catch (e) {
      console.log(`  ${mode.padEnd(5)}       : FAIL — ${e.code} ${String(e.message).slice(0, 120)}`);
    }
  }
}

(async () => {
  const json = await apiGet(`https://api.vercel.com/v1/projects/${PROJECT}/env?decrypt=true&teamId=${TEAM}`);
  if (!json.envs) {
    console.log('NO ENVS:', JSON.stringify(json).slice(0, 400));
    return;
  }

  const dbEnvs = json.envs.filter((e) => e.key === 'DATABASE_URL');
  console.log('DATABASE_URL entries found:', dbEnvs.length);
  for (const e of dbEnvs) {
    console.log(`  target=${JSON.stringify(e.target)} type=${e.type} valueLen=${(e.value || '').length}`);
  }

  for (const e of dbEnvs) {
    const v = e.value || '';
    if (!v.startsWith('mysql://')) {
      console.log(`\n--- ${JSON.stringify(e.target)} --- value not readable or not a mysql:// DSN`);
      continue;
    }
    await tryConnect(String(e.target), v);
  }

  // Also report any discrete DB_* vars that would override the DSN.
  const discrete = json.envs.filter((e) => /^DB_/.test(e.key));
  console.log('\nDiscrete DB_* overrides present:', discrete.length);
  for (const e of discrete) console.log(`  ${e.key} target=${JSON.stringify(e.target)} valueLen=${(e.value || '').length}`);
})();
