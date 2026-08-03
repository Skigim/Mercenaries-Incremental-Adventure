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
  await expect(page.getByTestId('hero-status').first()).toHaveText('Idle');
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
