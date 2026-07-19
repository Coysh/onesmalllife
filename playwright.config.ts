import { defineConfig, devices } from '@playwright/test';

/**
 * A small number of end-to-end tests for the critical journeys (brief §27).
 * Runs against a live `php artisan serve` instance. Assets must be built first
 * (`npm run build`). Install the browser once with `npx playwright install chromium`.
 */
export default defineConfig({
    testDir: './tests/e2e',
    timeout: 30_000,
    fullyParallel: false,
    retries: 0,
    reporter: 'line',
    use: {
        baseURL: process.env.APP_URL ?? 'http://127.0.0.1:8000',
        trace: 'on-first-retry',
    },
    projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
    webServer: {
        command: 'php artisan serve --host=127.0.0.1 --port=8000',
        url: 'http://127.0.0.1:8000',
        reuseExistingServer: true,
        timeout: 30_000,
    },
});
