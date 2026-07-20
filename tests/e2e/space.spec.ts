import { test, expect, type Page } from '@playwright/test';

/**
 * Stage 6's core loop: build shipyards, take the helm, fly to a system, and
 * deal with what is there. Guards the parts that break silently — the helm
 * handing control to a ship, arrival charting a system, first contact seating
 * a power that exists in no data file, and settling acting on the system you
 * actually flew to.
 */
async function registerAndCreate(page: Page): Promise<string> {
    const email = `space+${Date.now()}-${Math.round(performance.now())}@example.com`;
    await page.goto('/register');
    await page.fill('#name', 'Space');
    await page.fill('#email', email);
    await page.fill('#password', 'password1234');
    await page.fill('#password_confirmation', 'password1234');
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page).toHaveURL(/\/dashboard/);
    await page.getByRole('link', { name: 'Begin a new lineage' }).first().click();
    await page.getByRole('button', { name: 'Begin your journey' }).click();
    await expect(page).toHaveURL(/\/play\//);
    return page.url().replace(/\?.*$/, '');
}

/** Boot Stage 6, build shipyards, take the helm and fly to Aurelia. */
async function flyToAurelia(page: Page): Promise<void> {
    await page.setViewportSize({ width: 1400, height: 880 });
    const playUrl = await registerAndCreate(page);
    await page.goto(`${playUrl}?stage=space`);
    await expect(page.locator('#game-canvas canvas')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('#game-loading')).toBeHidden({ timeout: 15_000 });

    const intro = page.locator('[data-overlay="stage-intro"]');
    if (await intro.isVisible().catch(() => false)) await intro.click();
    await expect(intro).toBeHidden({ timeout: 5_000 });
    const skip = page.locator('[data-onboarding="skip"]');
    if (await skip.isVisible().catch(() => false)) await skip.click();

    const bar = page.locator('[data-selection="bar"]');
    for (let i = 0; i < 5; i++) {
        await page.locator('[data-dev="grant"]').click().catch(() => {});
        await page.waitForTimeout(150);
    }

    // Shipyards gate both the helm and colonies; until built, the helm must
    // say WHY it is disabled rather than showing an affordable cost.
    await page.locator('[data-management="actions"] [data-action-id="shipyards"]').click();
    await page.waitForTimeout(800);
    const helm = bar.locator('[data-action-id="helm"]');
    await expect(helm).toBeDisabled();
    await expect(helm).toContainText('Locked');
    await bar.locator('[data-action-id="shipyards"]').click();
    await page.waitForTimeout(800);
    await expect(helm).toBeEnabled();

    await helm.click();
    await page.waitForTimeout(900);
    const overlay = page.locator('[data-overlay="event"]');
    await expect(overlay).toContainText('You have the helm');
    await overlay.getByRole('button', { name: 'Understood' }).click();
    await page.waitForTimeout(400);

    // Aurelia lies due east and slightly north. Fly until we make orbit, so
    // map size and ship speed can be retuned without breaking this.
    const log = page.locator('[data-management="log"]');
    await page.keyboard.down('d');
    await page.waitForTimeout(1500);
    await page.keyboard.down('w');
    await page.waitForTimeout(900);
    await page.keyboard.up('w');
    for (let i = 0; i < 40; i++) {
        if ((await log.innerText()).includes('made orbit')) break;
        await page.waitForTimeout(500);
    }
    await page.keyboard.up('d');
    await page.waitForTimeout(600);
    await expect(log).toContainText('made orbit', { timeout: 10_000 });
}

test('space: answering a native world seats them as a power you cannot settle', async ({ page }) => {
    test.setTimeout(180_000);
    await flyToAurelia(page);

    const encounter = page.locator('[data-overlay="event"]');
    await expect(encounter).toBeVisible({ timeout: 8_000 });
    await expect(encounter).toContainText('Life on');
    await encounter.getByRole('button', { name: 'Answer them' }).click();
    await page.waitForTimeout(600);
    await encounter.getByRole('button', { name: 'Continue' }).click();
    await page.waitForTimeout(600);

    // They join the map as a real power, generated in play.
    await expect(page.locator('[data-management="faction-list"]')).toContainText('Aurelia');

    // And their home is not ours to take.
    const bar = page.locator('[data-selection="bar"]');
    await expect(bar).toContainText('Home of');
    await expect(bar.locator('[data-action-id^="settle:"]')).toHaveCount(0);
});

test('space: an unclaimed world can be settled where you arrived', async ({ page }) => {
    test.setTimeout(180_000);
    await flyToAurelia(page);

    // Leave them undisturbed — the world stays unclaimed and settleable.
    const encounter = page.locator('[data-overlay="event"]');
    await expect(encounter).toBeVisible({ timeout: 8_000 });
    await encounter.getByRole('button', { name: 'Watch, and say nothing' }).click();
    await page.waitForTimeout(600);
    await encounter.getByRole('button', { name: 'Continue' }).click();
    await page.waitForTimeout(600);

    const bar = page.locator('[data-selection="bar"]');
    await expect(bar).toBeVisible();
    await expect(bar).toContainText('world');

    const settle = bar.locator('[data-action-id^="settle:"]').first();
    await expect(settle).toBeVisible();
    await settle.click();
    await page.waitForTimeout(1500);

    // It is now a colony, with its own actions.
    await expect(bar).toContainText('people');
    await expect(bar.locator('[data-action-id="col_expand"]')).toBeVisible();

    // Esc returns control to the chart.
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);
});
