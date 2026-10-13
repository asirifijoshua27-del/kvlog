import { test, expect, _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

// Starts the built KVLOG with an empty data folder, so tests never touch real data.
let app: ElectronApplication;
let page: Page;
let dataDir: string;

const nav = (name: string) => page.locator('.nav').getByRole('button', { name, exact: true });

test.beforeAll(async () => {
  dataDir = mkdtempSync(path.join(os.tmpdir(), 'kvlog-e2e-'));
  app = await electron.launch({
    args: [path.join(__dirname, '..', '..')],
    env: { ...process.env, KVLOG_USER_DATA: dataDir, KVLOG_NO_UPDATES: '1' }
  });
  page = await app.firstWindow();
  await page.waitForSelector('.app', { timeout: 30_000 });
});

test.afterAll(async () => {
  await app?.close();
  rmSync(dataDir, { recursive: true, force: true });
});

test('starts in Live Studio with the sample service', async () => {
  await expect(page.locator('.toolbar h1')).toHaveText('Live Studio');
  await expect(page.locator('.playlist-item').first()).toBeVisible();
});

test('creates a song and builds its slides', async () => {
  await nav('Presentation Studio').click();
  await page.getByTitle('New song', { exact: true }).click();
  const title = page.locator('.editor-panel input.input').first();
  await title.fill('E2E Test Song');
  await page.locator('.textarea-content').fill('[Verse 1]\n[G]First line\nSecond line\n\n[Chorus]\nChorus line');
  await expect(page.locator('.editor-panel')).toContainText('2 slides');
});

test('saves to disk automatically', async () => {
  await expect
    .poll(() => {
      try {
        return readFileSync(path.join(dataDir, 'kvlog-data.json'), 'utf8').includes('E2E Test Song');
      } catch {
        return false;
      }
    }, { timeout: 10_000 })
    .toBe(true);
});

test('goes live and blacks out', async () => {
  await nav('Live Studio').click();
  await page.locator('.toolbar-title').click();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('button', { name: 'Previous slide' })).toBeEnabled();
  await page.keyboard.press('b');
  await expect(page.getByRole('button', { name: 'Blackout' })).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('b');
  await expect(page.getByRole('button', { name: 'Blackout' })).toHaveAttribute('aria-pressed', 'false');
});

test('shows and hides an alert', async () => {
  await page.getByRole('button', { name: 'Alert', exact: true }).click();
  await page.locator('.alert-preset').first().click();
  await expect(page.locator('.alert-bar')).toBeVisible();
  await page.getByRole('button', { name: 'Hide alert' }).click();
  await expect(page.locator('.alert-bar')).toHaveCount(0);
});

test('opens the stage display', async () => {
  await nav('Display Manager').click();
  const [stage] = await Promise.all([app.waitForEvent('window'), page.getByRole('button', { name: 'Open stage display' }).click()]);
  await stage.waitForSelector('.stage');
  await expect(stage.locator('.stage-clock')).toBeVisible();
  await page.getByRole('button', { name: 'Close' }).last().click();
});

test('Settings shows backup, daily backups and updates', async () => {
  await nav('Settings').click();
  await expect(page.getByRole('button', { name: 'Back up now' })).toBeVisible();
  await expect(page.getByText('Daily backups')).toBeVisible();
  await expect(page.getByText('Updates are only checked in the installed app.')).toBeVisible();
});
