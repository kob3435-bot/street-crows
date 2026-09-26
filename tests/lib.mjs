import { chromium, devices } from 'playwright-core';
export const BASE = process.env.BASE_URL || 'http://127.0.0.1:8090/';
export const SHOTS = new URL('../screenshots/', import.meta.url).pathname;
export async function launch() {
  return chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true,
    args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required', '--enable-webgl'] });
}
export async function open(browser, query = '', opts = {}) {
  const ctx = await browser.newContext(opts.mobile ? { ...devices['Pixel 7'] } : { viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  const logs = [];
  page.on('console', m => { if (m.type() === 'error') logs.push('console: ' + m.text()); });
  page.on('pageerror', e => logs.push('pageerror: ' + e.message));
  page.on('requestfailed', r => logs.push('reqfail: ' + r.url()));
  const sep = BASE.includes('?') ? '&' : '?';
  await page.goto(BASE + (query ? sep + query : ''), { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => window.__game && window.__game.ready, null, { timeout: 60000 });
  return { ctx, page, logs };
}
export const g = (page, fn, arg) => page.evaluate(fn, arg);
export const dbg = (page, name, ...args) => page.evaluate(([n, a]) => window.__game.debug[n](...a), [name, args]);
export const state = (page) => dbg(page, 'state');
export function check(results, name, ok, info = '') { results.push({ name, ok: !!ok, info }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? '  — ' + info : ''}`); }
export async function shot(page, name) { await page.screenshot({ path: SHOTS + name + '.png' }); return SHOTS + name + '.png'; }
export const sleep = (ms) => new Promise(r => setTimeout(r, ms));
