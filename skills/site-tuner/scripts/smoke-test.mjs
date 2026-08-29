import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/Patricio Cañete/.codex/skills/reference-to-astro/node_modules/playwright');

const project = path.resolve(import.meta.dirname, '..');
const approvedFile = path.join(project, 'src/config/tuning.values.json');
const initialApproved = JSON.parse(fs.readFileSync(approvedFile, 'utf8'));
const originalWidth = initialApproved.values['hero-copy-width'];
const testWidth = originalWidth === 475 ? 480 : 475;
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(`console: ${message.text()}`);
});
page.on('pageerror', (error) => errors.push(`page: ${error.message}`));

await page.goto('http://127.0.0.1:4321/?tune=1', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('[data-visual-tuner]');

const controls = await page.locator('[data-control-id]').count();
if (controls !== 32) throw new Error(`Expected 32 controls, found ${controls}`);

const groups = await page.locator('[data-tuner-group]').count();
if (groups !== 8) throw new Error(`Expected 8 groups, found ${groups}`);

const openGroups = await page.locator('[data-tuner-group][open]').count();
if (openGroups !== 1) throw new Error(`Expected one initially open group, found ${openGroups}`);

const waitForApprovedValue = async (expected) => {
  const timeoutAt = Date.now() + 4000;
  while (Date.now() < timeoutAt) {
    const current = JSON.parse(fs.readFileSync(approvedFile, 'utf8'));
    if (current.values['hero-copy-width'] === expected) return current;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for approved hero-copy-width ${expected}`);
};

const width = page.locator('[data-control-id="hero-copy-width"]');
await width.fill(String(testWidth));
await width.dispatchEvent('input');
const cssValue = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--hero-copy-width').trim());
if (cssValue !== `${testWidth}px`) throw new Error(`Expected live CSS value ${testWidth}px, found ${cssValue}`);

await page.locator('[data-preset-name]').fill('QA temporal');
await page.locator('[data-preset-save]').click();
if (!await page.locator('[data-preset-list] option', { hasText: 'QA temporal' }).count()) {
  throw new Error('Named preset was not persisted in the local preset list');
}

await page.locator('[data-tuner-apply]').click();
await page.waitForFunction(() => document.querySelector('[data-tuner-status]')?.textContent?.includes('aplic'));
await waitForApprovedValue(testWidth);

await width.fill(String(originalWidth));
await width.dispatchEvent('input');
await page.locator('[data-tuner-apply]').click();
await waitForApprovedValue(originalWidth);

await page.screenshot({ path: path.join(project, 'qa/tuner-generic-desktop.png'), fullPage: true });
await browser.close();

if (errors.length) throw new Error(errors.join('\n'));
console.log(JSON.stringify({ panel: true, groups, openGroups, controls, liveCss: cssValue, preset: true, applyAndRestore: true, consoleErrors: 0 }, null, 2));
