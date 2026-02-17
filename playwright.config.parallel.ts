/**
 * Playwright 并行测试配置
 * 
 * 每个 worker 使用独立的端口范围，支持并行执行
 * 使用方式：npx playwright test --config=playwright.config.parallel.ts
 */

import { defineConfig, devices } from '@playwright/test';
import * as dotenv from 'dotenv';
import { allocatePorts, saveWorkerPorts, cleanupWorkerPorts } from './scripts/infra/port-allocator.js';

dotenv.config({ quiet: true });

// 并行 worker 数量（根据 CPU 核心数调整）
const workers = parseInt(process.env.PW_WORKERS || '3');

export default defineConfig({
    testDir: './e2e',
    testMatch: '**/*.e2e.ts',
    timeout: 30000,
    expect: {
        timeout: 5000
    },
    // 启用并行执行
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: 0,
    workers,
    reporter: 'list',
    outputDir: './test-results',
    
    // 全局 setup：为每个 worker 分配端口
    globalSetup: async () => {
        console.log(`\n🚀 启动 ${workers} 个并行 worker...\n`);
        for (let i = 0; i < workers; i++) {
            const ports = allocatePorts(i);
            saveWorkerPorts(i, ports);
            console.log(`Worker ${i}: Frontend=${ports.frontend}, GameServer=${ports.gameServer}, API=${ports.apiServer}`);
        }
    },
    
    // 全局 teardown：清理所有 worker 的端口
    globalTeardown: async () => {
        console.log('\n🧹 清理所有 worker 端口...\n');
        for (let i = 0; i < workers; i++) {
            cleanupWorkerPorts(i);
        }
    },
    
    use: {
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
    },
    
    projects: [
        {
            name: 'chromium',
            use: { 
                ...devices['Desktop Chrome'],
                // 每个测试从环境变量读取当前 worker 的端口
                // 在测试中通过 testInfo.project.use.baseURL 访问
            },
        },
    ],
});
