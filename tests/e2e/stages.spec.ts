import { test, expect, type Page } from '@playwright/test';

/**
 * Per-stage boot smoke: every scene must boot to a live canvas with its HUD
 * and no console errors. Uses the dev-only ?stage= jump (local env) so one
 * campaign can visit any stage.
 */

async function registerAndCreate(page: Page): Promise<string> {
    const email = `e2e-stages+${Date.now()}@example.com`;
    await page.goto('/register');
    await page.fill('#name', 'Stage Smoke');
    await page.fill('#email', email);
    await page.fill('#password', 'password1234');
    await page.fill('#password_confirmation', 'password1234');
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page).toHaveURL(/\/dashboard/);
    await page.getByRole('link', { name: 'Begin a new lineage' }).first().click();
    await expect(page.getByText('Shape your first cell')).toBeVisible();

    // The part-based creator: pick a few non-default parts; the preview and
    // stat bars must react.
    await page.locator('input[name="movement"][value="jet"] + span').click();
    await page.locator('input[name="defense"][value="spines"] + span').click();
    await expect(page.locator('[data-stat-value="attack"]')).toHaveText('18');

    await page.getByRole('button', { name: 'Begin your journey' }).click();
    await expect(page).toHaveURL(/\/play\//);
    return page.url().replace(/\?.*$/, '');
}

/**
 * The intro card is shown once per campaign+stage and remembered after that,
 * so tests must not assume it is present.
 */
async function dismissIntro(page: Page): Promise<void> {
    const intro = page.locator('[data-overlay="stage-intro"]');
    if (await intro.isVisible().catch(() => false)) {
        await intro.click().catch(() => {});
    }
    await expect(intro).toBeHidden({ timeout: 5_000 });
}

test('every stage boots a live scene with its HUD', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(String(err)));
    page.on('console', (msg) => {
        if (msg.type() === 'error') errors.push(msg.text());
    });

    const playUrl = await registerAndCreate(page);

    // Direct-control stages show the vitals HUD + a stage intro card.
    for (const stage of ['cell', 'creature']) {
        await page.goto(`${playUrl}?stage=${stage}`);
        await expect(page.locator('#game-canvas canvas')).toBeVisible({ timeout: 15_000 });
        await expect(page.locator('#game-loading')).toBeHidden({ timeout: 15_000 });
        await expect(page.locator('[data-hud="species"]')).toBeVisible();
        await dismissIntro(page);
    }

    // Returning to a stage must not replay its intro card.
    await page.goto(`${playUrl}?stage=creature`);
    await expect(page.locator('#game-loading')).toBeHidden({ timeout: 15_000 });
    await expect(page.locator('[data-overlay="stage-intro"]')).toBeHidden();

    // The dev toolbar (local env) can instantly complete a direct stage.
    await page.goto(`${playUrl}?stage=cell`);
    await expect(page.locator('#game-loading')).toBeHidden({ timeout: 15_000 });
    await dismissIntro(page);
    await page.locator('[data-dev="complete"]').click();
    await expect(page.locator('[data-overlay="stage-complete"]')).toBeVisible({ timeout: 8_000 });

    // Strategic stages show the management panel with rivals + decisions.
    for (const stage of ['tribe', 'civilisation', 'planetary', 'space']) {
        await page.goto(`${playUrl}?stage=${stage}`);
        await expect(page.locator('#game-canvas canvas')).toBeVisible({ timeout: 15_000 });
        await expect(page.locator('#game-loading')).toBeHidden({ timeout: 15_000 });
        // Dismiss the intro card so it doesn't intercept map/HUD clicks.
        await dismissIntro(page);
        await expect(page.locator('[data-management="title"]')).toContainText('Stage');
        await expect(page.locator('[data-management="actions"] button').first()).toBeVisible();
        // At least one rival card (every stage starts with a visible rival
        // except space, which shows the hidden-powers hint instead).
        await expect(page.locator('[data-management="faction-list"] > *').first()).toBeVisible();
        // Map zoom controls are present on strategic stages.
        await expect(page.locator('[data-zoom="1"]')).toBeVisible();
        await page.locator('[data-zoom="-1"]').click();
    }

    // Ignore benign warnings; fail on real runtime errors.
    const real = errors.filter((e) => !/favicon|Autoplay|AudioContext/i.test(e));
    expect(real).toEqual([]);
});

test('tribe decisions can be taken from the contextual map bar', async ({ page }) => {
    const playUrl = await registerAndCreate(page);
    await page.goto(`${playUrl}?stage=tribe`);
    await expect(page.locator('#game-canvas canvas')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('#game-loading')).toBeHidden({ timeout: 15_000 });

    // Clear the intro card, then the onboarding coach-marks (they sit near the
    // bottom and would otherwise cover the contextual bar).
    await dismissIntro(page);
    const skip = page.locator('[data-onboarding="skip"]');
    await skip.click();
    await expect(page.locator('[data-overlay="onboarding"]')).toBeHidden({ timeout: 5_000 });

    // The panel lists abstract decisions (Send scouts) *and* located ones, so
    // nothing is hidden behind knowing where to click — located entries are
    // labelled with where they happen and travel there instead of acting.
    const panel = page.locator('[data-management="actions"]');
    await expect(panel).toContainText('Send scouts');
    await expect(panel).toContainText('Build huts');
    await expect(panel.locator('[data-action-id="huts"]')).toContainText('at your settlement');

    // Clicking the settlement (canvas centre — the camera starts on home)
    // fills the contextual bar with its build actions.
    const bar = page.locator('[data-selection="bar"]');
    await expect(bar).toBeHidden();
    await page.locator('#game-canvas canvas').click();
    await expect(bar).toBeVisible({ timeout: 5_000 });
    await expect(bar).toContainText('Your settlement');

    // Take "Build huts" from the bar. It is repeatable, so it resolves to a
    // count and re-prices rather than reading "Done" after one use.
    const huts = bar.locator('[data-action-id="huts"]');
    await expect(huts).toBeVisible();
    await huts.click();
    await expect(huts).toContainText('×1', { timeout: 5_000 });

    // Closing the bar clears the selection.
    await page.locator('[data-selection="close"]').click();
    await expect(bar).toBeHidden();
});

test('the Creature stage opens with a diet choice, then coach marks', async ({ page }) => {
    const playUrl = await registerAndCreate(page);
    await page.goto(`${playUrl}?stage=creature`);
    await expect(page.locator('#game-canvas canvas')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('#game-loading')).toBeHidden({ timeout: 15_000 });
    await dismissIntro(page);

    const diet = page.locator('[data-overlay="diet"]');
    await expect(diet).toBeVisible({ timeout: 8_000 });
    await expect(diet).toContainText('Herbivore');
    await expect(diet).toContainText('Carnivore');
    await diet.locator('[data-diet="carnivore"]').click();
    await expect(diet).toBeHidden();

    // Then "shape your creature": one free adaptation, carried on from the cell.
    const adapt = page.locator('[data-overlay="adapt"]');
    await expect(adapt).toBeVisible({ timeout: 8_000 });
    await adapt.locator('[data-adapt-id]').first().click();
    await expect(adapt).toBeHidden();

    // Only then do the stage-2 coach marks appear.
    await expect(page.locator('[data-overlay="onboarding"]')).toBeVisible({ timeout: 5_000 });
});

test('failing the Cell stage shows a death moment, then retry restarts it', async ({ page }) => {
    const playUrl = await registerAndCreate(page);
    await page.goto(`${playUrl}?stage=cell`);
    await expect(page.locator('#game-canvas canvas')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('#game-loading')).toBeHidden({ timeout: 15_000 });
    await dismissIntro(page);

    // Trigger failure via the local-only dev toolbar.
    const death = page.locator('[data-overlay="death"]');
    await expect(death).toBeHidden();
    await page.locator('[data-dev="die"]').click();
    await expect(death).toBeVisible({ timeout: 8_000 });
    await expect(death).toContainText('The lineage falters');

    // Retry clears the overlay and the stage is playable again.
    await page.locator('[data-action="retry"]').click();
    await expect(death).toBeHidden({ timeout: 5_000 });
    await expect(page.locator('[data-hud="objective-label"]')).toContainText('0/');
});

test('civilisation build actions are anchored to the capital on the bar', async ({ page }) => {
    const playUrl = await registerAndCreate(page);
    await page.goto(`${playUrl}?stage=civilisation`);
    await expect(page.locator('#game-canvas canvas')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('#game-loading')).toBeHidden({ timeout: 15_000 });

    await dismissIntro(page);
    await page.locator('[data-onboarding="skip"]').click();
    await expect(page.locator('[data-overlay="onboarding"]')).toBeHidden({ timeout: 5_000 });

    // Selecting the capital (canvas centre) fills the bar with its buildings;
    // choosing one enters the city-grid placement flow (CityScene).
    const bar = page.locator('[data-selection="bar"]');
    await expect(bar).toBeHidden();
    await page.locator('#game-canvas canvas').click();
    await expect(bar).toBeVisible({ timeout: 5_000 });
    await expect(bar).toContainText('Your settlement');
    await expect(bar.locator('[data-action-id="farms"]')).toBeVisible();
});
