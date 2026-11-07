import fs from 'fs';
import path from 'path';
// Senza CHROME: il chromium più recente tra quelli di Playwright (PLAYWRIGHT_BROWSERS_PATH o la cartella predefinita), altrimenti lascia scegliere a Playwright
export function trovaChrome() {
  const ms = process.env.PLAYWRIGHT_BROWSERS_PATH || (process.platform === 'win32' ? path.join(process.env.LOCALAPPDATA || '', 'ms-playwright') : path.join(process.env.HOME || '', process.platform === 'darwin' ? 'Library/Caches/ms-playwright' : '.cache/ms-playwright'));
  if (!fs.existsSync(ms)) return undefined;
  const exe = process.platform === 'win32' ? ['chrome-win64/chrome.exe', 'chrome-win/chrome.exe'] : process.platform === 'darwin' ? [] : ['chrome-linux64/chrome', 'chrome-linux/chrome'];
  const v = fs.readdirSync(ms).filter(d => /^chromium-\d+$/.test(d)).sort((a, b) => +b.slice(9) - +a.slice(9));
  for (const d of v) for (const e of exe) { const f = path.join(ms, d, e); if (fs.existsSync(f)) return f; }
  return undefined;
}
