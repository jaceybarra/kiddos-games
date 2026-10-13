// Renders the app icon (original art, no text) to PNG with Playwright's Chromium.
// Usage: node garage/tools/make-icons.mjs
import { chromium } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
const ink = '#3a2618';
const svg = (pad) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#ffc94a"/>
  <circle cx="256" cy="230" r="${pad ? 190 : 230}" fill="#ffe08a"/>
  <g transform="translate(256 262) scale(${pad ? 0.78 : 1}) translate(-256 -262)">
    <path d="M86 340 L86 200 Q86 108 256 92 Q426 108 426 200 L426 340 Z" fill="#d39550" stroke="${ink}" stroke-width="12" stroke-linejoin="round"/>
    <path d="M130 340 L130 214 Q130 150 256 140 Q382 150 382 214 L382 340 Z" fill="#6b4a36" stroke="${ink}" stroke-width="10" stroke-linejoin="round"/>
    <rect x="40" y="336" width="432" height="40" rx="18" fill="#6db54c" stroke="${ink}" stroke-width="12"/>
    <path d="M150 306 L150 262 Q150 254 158 254 L230 254 L230 222 Q230 210 242 210 L300 210 Q312 210 318 220 L334 252 L366 258 Q378 260 378 272 L378 300 Q378 308 370 308 Z" fill="#e2493b" stroke="${ink}" stroke-width="10" stroke-linejoin="round"/>
    <path d="M244 220 L296 220 Q302 220 306 226 L318 252 L244 252 Z" fill="#a9e2fb" stroke="${ink}" stroke-width="7" stroke-linejoin="round"/>
    <path d="M158 270 L360 270" stroke="#fff" stroke-width="9" stroke-linecap="round" opacity="0.9"/>
    <circle cx="196" cy="318" r="42" fill="#2e2a2b" stroke="${ink}" stroke-width="10"/>
    <circle cx="196" cy="318" r="16" fill="#ffd23f" stroke="${ink}" stroke-width="6"/>
    <circle cx="330" cy="318" r="42" fill="#2e2a2b" stroke="${ink}" stroke-width="10"/>
    <circle cx="330" cy="318" r="16" fill="#ffd23f" stroke="${ink}" stroke-width="6"/>
    <path d="M226 150 L256 118 L286 150" fill="none" stroke="${ink}" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
  </g>
</svg>`;

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage();
for (const [name, size, pad] of [['icon-512.png', 512, false], ['icon-192.png', 192, false], ['apple-touch-icon.png', 180, false], ['icon-maskable-512.png', 512, true]]) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0">${svg(pad).replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`);
  await page.screenshot({ path: join(out, name), omitBackground: false, clip: { x: 0, y: 0, width: size, height: size } });
  console.log('wrote', name);
}
await browser.close();
