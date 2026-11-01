// La cottura (docs/motore.md "Caricamento a pezzi"): apre il gioco con ?cuoci, che legge tutti i pezzi e calcola con il suo stesso codice ciò che dipende dall'intera mappa, e ne salva il risultato.
//   node src/cuoci.mjs <url del sito> <cotta.json> <grande.webp>       la lancia src/pezzi.py
//   PLAYWRIGHT=<percorso di playwright/index.mjs> se non è installato qui; CHROME=<percorso di chrome.exe>
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
const [url, out, png] = process.argv.slice(2);
const { chromium } = await import(process.env.PLAYWRIGHT ? pathToFileURL(path.resolve(process.env.PLAYWRIGHT)).href : 'playwright');
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu'] });
const page = await browser.newPage({ viewport: { width: 640, height: 360 } }); let fallita = null;
page.on('pageerror', e => { fallita = e.stack || e.message; console.error('ERRORE', fallita); });
page.on('console', m => { if (m.type() === 'error' && !/404/.test(m.text())) console.error('console', m.text()); });
await page.goto(url + '?cuoci');
const t0 = Date.now();
while (!fallita && !(await page.evaluate(() => !!window.__COTTA_GRANDE))) { if (Date.now() - t0 > 600000) { fallita = 'tempo scaduto'; break; } await page.waitForTimeout(500); }
if (fallita) { await browser.close(); process.exit(1); }
fs.writeFileSync(out, await page.evaluate(() => window.__COTTA));
fs.writeFileSync(png, Buffer.from((await page.evaluate(() => window.__COTTA_GRANDE)).split(',')[1], 'base64'));
console.log('cottura', Math.round((Date.now() - t0) / 1000), 's', Math.round(fs.statSync(out).size / 1024), 'KB');
await browser.close();
