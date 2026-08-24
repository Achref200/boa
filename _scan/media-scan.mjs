import { chromium, devices } from 'playwright';

const BASE = 'http://127.0.0.1:3000';
const ROUTES = [
  '/fr', '/fr/soins', '/fr/soins/cheveux', '/fr/soins/visage',
  '/fr/produits/boa-shampoo', '/fr/produits/boa-masque-cheveux',
  '/fr/rituels', '/fr/rituels/rituel-reparation',
  '/fr/services', '/fr/services/diagnostic-cheveux',
  '/fr/reserver/diagnostic-cheveux',
  '/fr/maison-boa', '/fr/professionnels', '/fr/contact',
  '/fr/panier', '/fr/commande', '/fr/suivi',
  '/fr/connexion', '/fr/inscription',
  '/en', '/ar',
];

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'fr-FR' });
const page = await ctx.newPage();
const consoleErrors = [];
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
const failed = [];
page.on('response', (r) => { if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`); });

for (const route of ROUTES) {
  consoleErrors.length = 0; failed.length = 0;
  const res = await page.goto(BASE + route, { waitUntil: 'networkidle' }).catch((e) => ({ err: e.message }));
  const status = res?.err ? 'NAV-ERR ' + res.err : res.status();
  await page.waitForTimeout(400);
  const report = await page.evaluate(() => {
    const imgs = [...document.querySelectorAll('img')].map((i) => {
      const r = i.getBoundingClientRect();
      return { alt: i.alt, nat: i.naturalWidth + 'x' + i.naturalHeight,
               box: Math.round(r.width) + 'x' + Math.round(r.height),
               broken: i.complete && i.naturalWidth === 0,
               collapsed: r.width < 2 || r.height < 2,
               src: (i.currentSrc || i.src).slice(-70) };
    });
    return {
      imgs,
      pending: [...document.querySelectorAll('.media-pending')].map((e) => e.textContent.trim().slice(0, 60)),
      h1: document.querySelector('h1')?.textContent?.trim().slice(0, 60) ?? '(no h1)',
    };
  });
  const bad = report.imgs.filter((i) => i.broken || i.collapsed);
  console.log(`\n${route}  [${status}]  h1="${report.h1}"`);
  console.log(`   images=${report.imgs.length}  broken/collapsed=${bad.length}  placeholders=${report.pending.length}`);
  for (const b of bad) console.log(`   !! ${b.broken ? 'BROKEN' : 'COLLAPSED'} box=${b.box} nat=${b.nat} alt="${b.alt}" src=${b.src}`);
  for (const p of report.pending) console.log(`   ~~ PLACEHOLDER: ${p.replace(/\s+/g, ' ')}`);
  for (const f of failed.slice(0, 5)) console.log(`   >> HTTP ${f}`);
  for (const c of consoleErrors.slice(0, 3)) console.log(`   >> CONSOLE ${c.slice(0, 140)}`);
}
await browser.close();
