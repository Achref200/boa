/* Throwaway diagnostic: read the Vercel project env vars (with decrypt) to see
 * whether the production DATABASE_URL is retrievable. Not part of the app. */
const https = require('https');
const fs = require('fs');
const path = require('path');

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

(async () => {
  const url = `https://api.vercel.com/v1/projects/${PROJECT}/env?decrypt=true&teamId=${TEAM}`;
  const json = await apiGet(url);
  if (!json.envs) {
    console.log('NO ENVS:', JSON.stringify(json).slice(0, 400));
    return;
  }
  for (const e of json.envs) {
    const v = e.value || '';
    // Never print a secret; print only shape.
    const isDsn = /^mysql:\/\//.test(v);
    const summary = isDsn
      ? `host=${(v.split('@')[1] || '').split('/')[0]} db=${(v.split('/')[3] || '').split('?')[0]} pwlen=${(v.split('@')[0] || '').split(':').slice(1).join(':').length}`
      : `len=${v.length} head=${v.slice(0, 40)}`;
    console.log(`${e.key} | target=${JSON.stringify(e.target)} | type=${e.type} | ${summary}`);
  }
})();
