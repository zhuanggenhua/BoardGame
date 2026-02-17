import { defineConfig, devices } from '@playwright/test';
import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file
dotenv.config({ quiet: true });

// ============================================================================
// E2E 测试端口配置 - 完全隔离方案
// ============================================================================
// 
// 🎯 设计原则：测试环境与开发环境完全隔离
//
// 1. 开发环境（npm run dev）：
//    - 端口：3000, 18000, 18001
//    - 用途：日常开发、手动测试
//
// 2. E2E 测试环境（npm run test:e2e）：
//    - 端口：5173, 19000, 19001（完全不同的端口）
//    - 用途：自动化测试
//    - 隔离：不会与开发环境冲突
//
// 3. 并行测试环境（npm run test:e2e:parallel）：
//    - 端口：6000+, 20000+, 20001+（每个 worker 独立）
//    - 用途：大量并行测试
//
// ============================================================================

// E2E 测试使用独立的端口范围，与开发环境完全隔离
const E2E_PORTS = {
    frontend: 5173,      // Vite 默认端口，与开发环境的 3000 不同
    gameServer: 19000,   // 与开发环境的 18000 不同
    apiServer: 19001,    // 与开发环境的 18001 不同
};

const DEV_PORTS = {
    frontend: 3000,
    gameServer: 18000,
    apiServer: 18001,
};

// E2E 测试服务器启动策略
// 1. PW_START_SERVERS=true（CI 模式）：强制启动独立测试服务器
// 2. PW_USE_DEV_SERVERS=true：使用开发环境服务器（不推荐）
// 3. 默认：启动独立测试服务器
const forceStartServers = process.env.PW_START_SERVERS === 'true';
const useDevServers = process.env.PW_USE_DEV_SERVERS === 'true';
const shouldStartServers = forceStartServers || !useDevServers;

// 根据模式选择端口
const PORTS = useDevServers ? DEV_PORTS : E2E_PORTS;

// 设置环境变量，让测试代码能够读取正确的端口（必须在 getGameServerBaseURL 调用之前）
// 强制覆盖，确保测试使用正确的端口
process.env.GAME_SERVER_PORT = PORTS.gameServer.toString();
process.env.PW_GAME_SERVER_PORT = PORTS.gameServer.toString();
process.env.API_SERVER_PORT = PORTS.apiServer.toString();
process.env.PW_API_SERVER_PORT = PORTS.apiServer.toString();

const port = process.env.PW_PORT || process.env.E2E_PORT || PORTS.frontend.toString();
const baseURL = process.env.VITE_FRONTEND_URL || `http://localhost:${port}`;
const gameServerPort = PORTS.gameServer.toString();
const apiServerPort = PORTS.apiServer.toString();

// 日志：显示当前测试模式
if (useDevServers) {
    console.log('⚠️  E2E 测试模式：使用开发服务器（端口 3000/18000/18001）');
} else {
    console.log('✅ E2E 测试模式：独立测试环境（端口 5173/19000/19001）');
}

// WebServer 配置：默认启动独立的测试服务器（完全隔离）
const webServerConfig = shouldStartServers
    ? [
        {
            command: `npx vite --port ${port} --strictPort`,
            url: baseURL,
            reuseExistingServer: true,
            timeout: 120000,
        },
        {
            command: `cross-env USE_PERSISTENT_STORAGE=false GAME_SERVER_PORT=${gameServerPort} npm run dev:game`,
            url: `http://localhost:${gameServerPort}/games`,
            reuseExistingServer: true,
            timeout: 120000,
        },
        {
            command: `cross-env API_SERVER_PORT=${apiServerPort} npm run dev:api`,
            url: `http://localhost:${apiServerPort}/health`,
            reuseExistingServer: true,
            timeout: 120000,
        },
    ]
    : undefined;

export default defineConfig({
    testDir: './e2e',
    testMatch: '**/*.e2e.ts',
    timeout: 30000,
    expect: {
        timeout: 5000
    },
    // 串行执行（服务端无 per-test 状态隔离）
    fullyParallel: false,
    forbidOnly: !!process.env.CI,
    retries: 0,
    workers: 1,
    reporter: 'list',
    outputDir: './test-results',
    preserveOutput: 'always',
    use: {
        baseURL,
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
    },
    // 默认启动独立的测试服务器（完全隔离）
    webServer: webServerConfig,
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
    ],
});
