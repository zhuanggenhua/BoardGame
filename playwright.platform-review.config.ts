import { defineConfig } from '@playwright/test';

export default defineConfig({
    testDir: './e2e',
    testMatch: 'platform-rules-review.e2e.ts',
    outputDir: './.tmp/home-rules-review-playwright-artifacts',
    workers: 1,
    timeout: 120000,
    reporter: 'list',
    use: { baseURL: 'http://127.0.0.1:4273', actionTimeout: 15000, navigationTimeout: 30000 },
});
