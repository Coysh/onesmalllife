import { test, expect, type Page } from '@playwright/test';

/**
 * The whole arc, played for real: register → shape a cell → advance through
 * every stage via the actual stage-complete → "Continue the lineage" flow →
 * reach the ending. This is the integration test the `?stage=` smokes can't be:
 * it exercises real transitions, per-stage scene boots, the diet gate, and the
 * ending. Reduced motion skips the between-stage cinematics for determinism.
 */
test.use({ reducedMotion: 'reduce' });

async function dismiss(page: Page, selector: string): Promise<void> {
    const el = page.locator(selector);
    if (await el.isVisible().catch(() => false)) {
        await el.click().catch(() => {});
    }
}

/** Complete the current stage via the dev toolbar and advance to the next. */
async function winAndContinue(page: Page): Promise<void> {
    await page.locator('[data-dev="complete"]').click(); // the "win" dev button

    const cont = page.getByRole('button', { name: 'Continue the lineage' });
    await expect(cont).toBeVisible({ timeout: 10_000 });
    await cont.click();
}

test('a lineage can be played all the way from a cell to the ending', async ({ page }) => {
    test.setTimeout(120_000);
    const email = `arc+${Date.now()}@example.com`;
    await page.goto('/register');
    await page.fill('#name', 'Arc'); await page.fill('#email', email);
    await page.fill('#password', 'password1234'); await page.fill('#password_confirmation', 'password1234');
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page).toHaveURL(/\/dashboard/);
    await page.getByRole('link', { name: 'Begin a new lineage' }).first().click();
    await page.getByRole('button', { name: 'Begin your journey' }).click();
    await expect(page).toHaveURL(/\/play\//);

    // Stage 1 — Cell.
    await expect(page.locator('#game-loading')).toBeHidden({ timeout: 15_000 });
    await dismiss(page, '[data-overlay="stage-intro"]');
    await winAndContinue(page);

    // Stage 2 — Creature: pick a diet, clear coach marks, then win.
    await expect(page.locator('#game-loading')).toBeHidden({ timeout: 15_000 });
    await dismiss(page, '[data-overlay="stage-intro"]');
    await page.locator('[data-overlay="diet"] [data-diet="herbivore"]').click();
    await dismiss(page, '[data-onboarding="skip"]');
    await winAndContinue(page);

    // Stages 3–6 — strategic: clear intro + coach marks, then win.
    for (const label of ['Tribe', 'Civilisation', 'Planetary', 'Space']) {
        await expect(page.locator('#game-loading')).toBeHidden({ timeout: 15_000 });
        await dismiss(page, '[data-overlay="stage-intro"]');
        await dismiss(page, '[data-onboarding="skip"]');
        await expect(page.locator('[data-management="title"]')).toContainText(label, { timeout: 10_000 });
        await winAndContinue(page);
    }

    // Past Space → the ending screen for the finished lineage.
    await expect(page).toHaveURL(/\/ending/, { timeout: 15_000 });
    await expect(page.locator('[aria-label="Species portrait"]')).toBeVisible();
});
