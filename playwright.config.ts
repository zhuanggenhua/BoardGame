import { defineConfig, devices } from '@playwright/test';
import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file
dotenv.config();

const port = process.env.PW_PORT || process.env.E2E_PORT || '5173';
const baseURL = process.env.VITE_FRONTEND_URL || `http://localhost:${port}`;
const webServerConfig = process.env.PW_SKIP_WEB_SERVER
    ? undefined
    : {
        command: `npx vite --port ${port} --strictPort`,
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120000,
    };

export default defineConfig({
    testDir: './e2e',
    testMatch: '**/*.e2e.ts',
    timeout: 30000,
    expect: {
        timeout: 5000
    },
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: 0,
    workers: 1,
    reporter: 'list',
    use: {
        // Priority: ENV variable > configured port > Default localhost:5173
        baseURL,
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
    },
    ...(webServerConfig ? { webServer: webServerConfig } : {}),
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
    ],
});
