import { defineConfig, devices } from '@playwright/test';
import * as dotenv from 'dotenv';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { DEV_SERVER_PORTS, E2E_SINGLE_WORKER_PORTS } from './scripts/infra/e2e-port-config.js';
import { loadWorkerPorts, reserveAvailablePorts, reservePorts, saveWorkerPorts } from './scripts/infra/port-allocator.js';
import { ensureSharedTestApiToken } from './src/server/testApiToken';

dotenv.config({ quiet: true });

const configuredWorkers = Number.parseInt(process.env.PW_WORKERS || '1', 10);
const isMultiWorker = configuredWorkers > 1;

const SINGLE_WORKER_PORTS = E2E_SINGLE_WORKER_PORTS;
const DEV_PORTS = DEV_SERVER_PORTS;

const forceStartServers = process.env.PW_START_SERVERS === 'true';
const useDevServers = process.env.PW_USE_DEV_SERVERS === 'true';
const shouldStartServers = forceStartServers || !useDevServers;
const shouldReuseExistingServers = !forceStartServers && !process.env.CI;
const headedByEnv = process.env.PW_HEADED === 'true' || process.env.PWDEBUG === '1';
const headedByCli = process.argv.some(arg => arg === '--headed' || arg === '--debug' || arg === '--ui');
const headedMode = headedByEnv || headedByCli;
const allowFullRun = process.env.PW_ALLOW_FULL_RUN === 'true';
// 每次 Playwright 启动链都分配独立 scope，供 globalSetup/globalTeardown 和端口文件隔离。
const runtimeScope = process.env.PW_RUNTIME_SCOPE
    || `pw-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
process.env.PW_RUNTIME_SCOPE = runtimeScope;
process.env.PW_REUSE_EXISTING_SERVERS = shouldReuseExistingServers ? 'true' : 'false';
ensureSharedTestApiToken(process.env);

async function resolveSingleWorkerPorts() {
    const persisted = loadWorkerPorts(0);
    if (persisted) {
        try {
            await reservePorts(0, persisted, {
                scope: runtimeScope,
                ownerPid: process.pid,
                target: process.env.PW_TEST_TARGET || '',
            });
            return persisted;
        } catch (error) {
            console.warn(`⚠️ 复用单 worker 端口失败，将重新分配: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    try {
        const reserved = await reservePorts(0, SINGLE_WORKER_PORTS, {
            scope: runtimeScope,
            ownerPid: process.pid,
            target: process.env.PW_TEST_TARGET || '',
        });
        saveWorkerPorts(0, reserved);
        return reserved;
    } catch (error) {
        console.warn(`⚠️ 默认单 worker 端口不可用，改为动态分配: ${error instanceof Error ? error.message : String(error)}`);
    }

    const allocated = await reserveAvailablePorts(0, {
        scope: runtimeScope,
        ownerPid: process.pid,
        target: process.env.PW_TEST_TARGET || '',
    });
    saveWorkerPorts(0, allocated);
    return allocated;
}

const resolvedSingleWorkerPorts = !isMultiWorker && !useDevServers
    ? await resolveSingleWorkerPorts()
    : SINGLE_WORKER_PORTS;
const ports = useDevServers ? DEV_PORTS : resolvedSingleWorkerPorts;

function collectFrameworkBackedTests(rootDir: string): string[] {
    const matches: string[] = [];

    const walk = (currentDir: string) => {
        for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
            const absolutePath = path.join(currentDir, entry.name);

            if (entry.isDirectory()) {
                walk(absolutePath);
                continue;
            }

            if (!entry.isFile() || !entry.name.endsWith('.e2e.ts')) {
                continue;
            }

            const content = fs.readFileSync(absolutePath, 'utf-8');
            const usesFrameworkFixture =
                content.includes("from './framework'") ||
                content.includes('from "./framework"') ||
                content.includes("from '../framework'") ||
                content.includes('from "../framework"');

            if (!usesFrameworkFixture) {
                continue;
            }

            matches.push(path.relative(process.cwd(), absolutePath).replace(/\\/g, '/'));
        }
    };

    walk(rootDir);
    return matches;
}

if (!isMultiWorker) {
    process.env.GAME_SERVER_PORT = String(ports.gameServer);
    process.env.PW_GAME_SERVER_PORT = String(ports.gameServer);
    process.env.API_SERVER_PORT = String(ports.apiServer);
    process.env.PW_API_SERVER_PORT = String(ports.apiServer);
}

const frontendPort = process.env.PW_PORT || process.env.E2E_PORT || String(ports.frontend);
// Chromium 在 Windows 上可能优先解析 localhost -> ::1，而测试前端默认只监听 IPv4。
// 统一固定到 127.0.0.1，避免 page.goto 偶发 ERR_CONNECTION_REFUSED。
const singleWorkerBaseURL = process.env.VITE_FRONTEND_URL || `http://127.0.0.1:${frontendPort}`;
const multiWorkerSafeTests = collectFrameworkBackedTests(path.join(process.cwd(), 'e2e'));
const explicitTestMatch = process.env.PW_TEST_MATCH?.trim();

function hasExplicitPlaywrightTarget(argv: string[]): boolean {
    const args = argv.filter(arg => arg !== 'test');
    const targetFlags = new Set(['--grep', '-g', '--test-list']);

    for (let index = 0; index < args.length; index += 1) {
        const arg = args[index];

        if (targetFlags.has(arg)) {
            const next = args[index + 1];
            if (next && !next.startsWith('-')) {
                return true;
            }
            continue;
        }

        if (
            arg.startsWith('--grep=') ||
            arg.startsWith('--test-list=') ||
            arg === '--last-failed' ||
            arg.startsWith('--only-changed')
        ) {
            return true;
        }

        if (!arg.startsWith('-')) {
            return true;
        }
    }

    return false;
}

const hasExplicitTarget = process.env.PW_HAS_EXPLICIT_TARGET === 'true'
    || Boolean(explicitTestMatch)
    || hasExplicitPlaywrightTarget(process.argv.slice(2));

const LEGACY_DISCOVERY_BROKEN_TESTS = [
    '**/dicethrone-toggle-die-lock-in-response-window.e2e.ts',
    '**/ninja-hidden-ninja-skip-option.e2e.ts',
    '**/summonerwars-illusion-fix.e2e.ts',
];

if (isMultiWorker) {
    console.log(`✅ E2E 测试模式：多 worker 并行（${configuredWorkers} workers，隔离端口）`);
} else if (useDevServers) {
    console.log(`⚠️ E2E 测试模式：使用开发服务器（${DEV_PORTS.frontend}/${DEV_PORTS.gameServer}/${DEV_PORTS.apiServer}）`);
} else {
    console.log(`✅ E2E 测试模式：单 worker（${SINGLE_WORKER_PORTS.frontend}/${SINGLE_WORKER_PORTS.gameServer}/${SINGLE_WORKER_PORTS.apiServer}）`);
}

if (headedMode) {
    console.warn('⚠️ Playwright 当前将以可见浏览器模式运行。');
    if (headedByEnv && !headedByCli) {
        console.warn('   来源：检测到 PW_HEADED=true 或 PWDEBUG=1。');
        console.warn('   如果这是误触发，请清理终端环境变量后再运行测试。');
    }
}

if (!allowFullRun && !hasExplicitTarget) {
    throw new Error(
        [
            '已阻止无目标的全量 E2E 运行，避免直接跑完整套 Playwright 测试卡死机器。',
            '请改用以下任一方式：',
            '1. node scripts/infra/run-e2e-command.mjs ci e2e/<相关文件>.e2e.ts',
            '2. node scripts/infra/run-e2e-command.mjs ci --grep "<相关用例名>"',
            '3. 需要明确全量时，再显式使用 npm run test:e2e:all',
        ].join('\n'),
    );
}

const testMatch = explicitTestMatch
    ? explicitTestMatch
    : isMultiWorker && multiWorkerSafeTests.length > 0
        ? multiWorkerSafeTests
        : '**/*.e2e.ts';

export default defineConfig({
    testDir: './e2e',
    testMatch,
    testIgnore: LEGACY_DISCOVERY_BROKEN_TESTS,
    timeout: 30000,
    expect: {
        timeout: 5000,
    },
    fullyParallel: isMultiWorker,
    forbidOnly: !!process.env.CI,
    retries: 0,
    workers: configuredWorkers,
    reporter: 'list',
    outputDir: './test-results/playwright-artifacts',
    preserveOutput: 'failures-only',
    globalSetup: shouldStartServers ? './e2e/global-setup.ts' : undefined,
    globalTeardown: shouldStartServers ? './e2e/global-teardown.ts' : undefined,
    use: {
        ...(!isMultiWorker ? { baseURL: singleWorkerBaseURL } : {}),
        headless: !headedMode,
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
    },
    projects: [
        {
            name: 'chromium',
            use: {
                ...devices['Desktop Chrome'],
                viewport: { width: 1920, height: 1080 },
            },
        },
    ],
});
