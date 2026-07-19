import { test, expect } from '@playwright/test';

/**
 * Critical journey (brief §27): register → dashboard → create a lineage →
 * enter the Cell stage → the game boots. Uses a unique email per run so it can
 * run repeatedly against the dev database.
 */
test('a new player can register and reach a playable Cell stage', async ({ page }) => {
    const email = `e2e+${Date.now()}@example.com`;

    // Landing → register
    await page.goto('/');
    await expect(page.getByText('From a single cell to the stars', { exact: false })).toBeVisible();

    await page.goto('/register');
    await page.fill('#name', 'E2E Player');
    await page.fill('#email', email);
    await page.fill('#password', 'password1234');
    await page.fill('#password_confirmation', 'password1234');
    await page.getByRole('button', { name: 'Create account' }).click();

    // Dashboard → new lineage setup
    await expect(page).toHaveURL(/\/dashboard/);
    await page.getByRole('link', { name: 'Begin a new lineage' }).first().click();
    await expect(page.getByText('Shape your first cell')).toBeVisible();

    // Begin → the game shell loads with the Phaser canvas + HUD
    await page.getByRole('button', { name: 'Begin your journey' }).click();
    await expect(page).toHaveURL(/\/play\//);
    await expect(page.locator('#game-canvas canvas')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('[data-hud="species"]')).toBeVisible();

    // The loading overlay clears once booted.
    await expect(page.locator('#game-loading')).toBeHidden({ timeout: 15_000 });

    // The stage must NOT auto-complete: overlay hidden, objective still at 0.
    await expect(page.locator('[data-overlay="stage-complete"]')).toBeHidden();
    await expect(page.locator('[data-hud="objective-label"]')).toContainText('0/');
});
