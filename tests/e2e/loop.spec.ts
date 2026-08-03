import { test, expect } from '@playwright/test';

const SAVE_KEY = 'merchantnext.save.v1';
const HOUR = 3_600_000;

function saveWithHeroDispatched(startedAgoMs: number) {
  return {
    version: 1,
    heroes: [
      {
        id: 'hero_1', name: 'Bryn', level: 1, xp: 0, skills: [],
        trinket: null, pack: [],
        assignment: {
          missionId: 'tuvale_gather',
          startedAt: Date.now() - startedAgoMs,
          repeat: true,
          blockedAt: null,
        },
      },
      { id: 'hero_2', name: 'Corvin', level: 1, xp: 0, skills: [],
        trinket: null, pack: [], assignment: null },
      { id: 'hero_3', name: 'Maela', level: 1, xp: 0, skills: [],
        trinket: null, pack: [], assignment: null },
    ],
    warehouse: [],
    completions: {},
    rng: { seed: 12345, cursor: 0 },
    lastResolvedAt: Date.now() - startedAgoMs,
  };
}

test('a fresh game shows three idle heroes and only the starting mission', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('hero-card')).toHaveCount(3);
  await expect(page.getByTestId('hero-status').first()).toHaveText('Idle — send him somewhere');
  await expect(page.getByTestId('dispatch-tuvale_gather')).toBeVisible();
  await expect(page.getByTestId('dispatch-tuvale_thicket')).toHaveCount(0);
});

test('dispatching a hero puts them to work', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('dispatch-tuvale_gather').click();
  await expect(page.getByTestId('hero-status').first()).toContainText('Gather by the Roadside');
  await expect(page.getByTestId('hero-status').first()).toContainText('left');
});

test('an offline gap resolves on boot and collects to the warehouse', async ({ page }) => {
  await page.addInitScript(
    ([key, save]) => window.localStorage.setItem(key as string, save as string),
    [SAVE_KEY, JSON.stringify(saveWithHeroDispatched(HOUR))],
  );

  await page.goto('/');

  // The boot resolution reports the absence.
  await expect(page.getByTestId('welcome-back')).toBeVisible();
  await expect(page.getByTestId('welcome-back')).toContainText('missions completed');

  // The hero holds loot and has stopped with a full pack.
  await expect(page.getByTestId('hero-pack').first()).not.toContainText('Pack 0 /');

  // The welcome dialog is a modal scrim over the board — dismiss it before interacting further.
  await page.getByTestId('welcome-back').getByRole('button', { name: 'Nice, continue' }).click();

  await page.getByTestId('collect-all').click();
  await expect(page.getByTestId('hero-pack').first()).toContainText('Pack 0 /');
  await expect(page.getByTestId('warehouse-total')).not.toHaveText('0 items');
});

test('completing the starting mission unlocks the next one', async ({ page }) => {
  await page.addInitScript(
    ([key, save]) => window.localStorage.setItem(key as string, save as string),
    [SAVE_KEY, JSON.stringify(saveWithHeroDispatched(HOUR))],
  );

  await page.goto('/');
  await expect(page.getByTestId('dispatch-tuvale_thicket')).toBeVisible();
});

test('progress survives a reload without rerolling loot', async ({ page }) => {
  await page.addInitScript(
    ([key, save]) => {
      if (!window.localStorage.getItem(key as string)) {
        window.localStorage.setItem(key as string, save as string);
      }
    },
    [SAVE_KEY, JSON.stringify(saveWithHeroDispatched(HOUR))],
  );

  await page.goto('/');

  // The welcome dialog is a modal scrim over the board — dismiss it before interacting further.
  await page.getByTestId('welcome-back').getByRole('button', { name: 'Nice, continue' }).click();

  await page.getByTestId('collect-all').click();
  const before = await page.getByTestId('warehouse-total').textContent();

  // Wait past the autosave debounce, then reload.
  await page.waitForTimeout(1_500);
  await page.reload();

  await expect(page.getByTestId('warehouse-total')).toHaveText(before ?? '');
});

test('Camp Board design tokens are loaded', async ({ page }) => {
  await page.goto('/');
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(bg).toBe('rgb(245, 234, 216)'); // --color-bg: #f5ead8
});

test('desktop layout shows the full dashboard with no bottom tabs', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/');
  await expect(page.getByTestId('mobile-tab-heroes')).toHaveCount(0);
  await expect(page.getByTestId('hero-card')).toHaveCount(3);
  await expect(page.getByTestId('dispatch-tuvale_gather')).toBeVisible();
  await expect(page.getByTestId('warehouse-total')).toBeVisible();
});

test('mobile layout shows one tab at a time via the bottom nav', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');

  await expect(page.getByTestId('mobile-tab-heroes')).toBeVisible();
  await expect(page.getByTestId('hero-card')).toHaveCount(3);
  await expect(page.getByTestId('dispatch-tuvale_gather')).toHaveCount(0);

  await page.getByTestId('mobile-tab-quests').click();
  await expect(page.getByTestId('dispatch-tuvale_gather')).toBeVisible();
  await expect(page.getByTestId('hero-card')).toHaveCount(0);

  await page.getByTestId('mobile-tab-warehouse').click();
  await expect(page.getByTestId('warehouse-total')).toBeVisible();
  await expect(page.getByTestId('dispatch-tuvale_gather')).toHaveCount(0);
});
