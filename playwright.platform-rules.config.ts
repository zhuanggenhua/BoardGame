import { defineConfig } from '@playwright/test';

// 复用已启动的任务隔离服务；测试文件会拒绝默认 Mongo 或非任务数据库。
export default defineConfig({
    testDir: './e2e',
    testMatch: 'platform-rules-upload.e2e.ts',
    outputDir: './.tmp/home-rules-upload-playwright-artifacts',
    workers: 1,
    timeout: 120000,
    reporter: 'list',
    use: { baseURL: 'http://127.0.0.1:4273' },
});
