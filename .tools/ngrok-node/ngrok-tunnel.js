/**
 * Keeps an ngrok TCP tunnel open to the local MySQL (127.0.0.1:3306) using the
 * official @ngrok/ngrok SDK (the standalone binary installed from winget is too
 * old for this account). Writes the public endpoint to ngrok-url.txt and
 * refreshes it if the tunnel is ever re-established, so the deploy process can
 * read it without scraping logs.
 *
 * Run from .tools/ngrok-node:  node ngrok-tunnel.js
 */
const fs = require('fs');
const path = require('path');
const ngrok = require('@ngrok/ngrok');

const TOKEN = process.env.NGROK_AUTHTOKEN;
const OUT = path.join(__dirname, 'ngrok-url.txt');

if (!TOKEN) {
  console.error('NGROK_AUTHTOKEN is not set');
  process.exit(1);
}

async function main() {
  const listener = await ngrok.forward({ addr: 3306, authtoken: TOKEN, proto: 'tcp' });
  const url = listener.url();
  fs.writeFileSync(OUT, url, 'utf8');
  console.log('TUNNEL UP: ' + url);

  const report = () => {
    try {
      const current = listener.url();
      if (current) fs.writeFileSync(OUT, current, 'utf8');
    } catch {
      /* listener closed — leave the last known URL in place */
    }
  };
  const timer = setInterval(report, 5000);

  process.on('SIGINT', () => {
    clearInterval(timer);
    listener.close();
    process.exit(0);
  });
}

main().catch((error) => {
  console.error('TUNNEL FAILED: ' + (error && error.message ? error.message : String(error)));
  process.exit(1);
});
