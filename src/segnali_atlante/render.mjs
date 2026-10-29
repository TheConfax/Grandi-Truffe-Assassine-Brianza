import { chromium } from 'file:///C:/Users/theco/AppData/Local/Temp/claude/c--Users-theco-GitHub-GTA-Brianza/21666fae-28c6-4a4b-9f2d-4a980fee79f6/scratchpad/node_modules/playwright/index.mjs';
import fs from 'fs';
const b = await chromium.launch({ executablePath: 'C:/Users/theco/AppData/Local/ms-playwright/chromium-1223/chrome-win64/chrome.exe' });
const p = await b.newPage({ viewport: { width: 600, height: 600 } });
fs.mkdirSync('png', { recursive: true });
for (const f of fs.readdirSync('svg')) {
  const svg = fs.readFileSync('svg/' + f).toString('base64');
  await p.setContent(`<body style="margin:0;background:transparent"><img id=i src="data:image/svg+xml;base64,${svg}" style="width:512px;display:block"></body>`);
  await p.waitForFunction(() => document.getElementById('i').complete);
  await (await p.$('#i')).screenshot({ path: 'png/' + f.replace('.svg', '.png'), omitBackground: true });
}
await b.close();
