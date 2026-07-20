import { defineConfig, devices } from '@playwright/test';

/**
 * A small number of end-to-end tests for the critical journeys (brief §27).
 * Assets must be built first (`npm run build`). Install the browser once with
 * `npx playwright install chromium`.
 *
 * Two ways to run:
 *  - Against an already-served app (DDEV):
 *      APP_URL=https://onesmalllife.ddev.site npm run test:e2e
 *    No local server is started, and the self-signed cert is accepted.
 *  - Against a plain `php artisan serve` (only works where the DB host
 *    resolves from the host machine): npm run test:e2e
 */
const baseURL = process.env.APP_URL ?? 'http://127.0.0.1:8000';

/** Only manage a server ourselves when pointed at the default local one. */
const managesServer = baseURL.startsWith('http://127.0.0.1:8000');

export default defineConfig({
    testDir: './tests/e2e',
    timeout: 30_000,
    fullyParallel: false,
    retries: 0,
    reporter: 'line',
    use: {
        baseURL,
        // DDEV serves over HTTPS with a locally-signed certificate.
        ignoreHTTPSErrors: true,
        trace: 'on-first-retry',
    },
    projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
    ...(managesServer
        ? {
            webServer: {
                command: 'php artisan serve --host=127.0.0.1 --port=8000',
                url: 'http://127.0.0.1:8000',
                reuseExistingServer: true,
                timeout: 30_000,
            },
        }
        : {}),
});
