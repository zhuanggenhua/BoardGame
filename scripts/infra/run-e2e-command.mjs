import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { withWindowsHide } from './windows-hide.js';
import { assertChildProcessSupport } from './assert-child-process-support.mjs';
import { runEncodingCheck } from './check-file-encoding.mjs';
import { runE2ESafetyCheck } from './check-e2e-safety.js';
import { cleanupTestConnections } from './cleanup_test_connections.js';
import { allocateAvailablePorts } from './port-allocator.js';

const playwrightCli = path.resolve(process.cwd(), 'node_modules', 'playwright', 'cli.js');
const runtimeNode = process.env.PW_NODE_BINARY || process.execPath;

function run(command, args, env) {
    const result = spawnSync(command, args, withWindowsHide({
        stdio: 'inherit',
        env,
        shell: false,
    }, env));

    if (result.error) {
        throw result.error;
    }

    if (typeof result.status === 'number' && result.status !== 0) {
        process.exit(result.status);
    }
}

function createEnv(overrides = {}) {
    return {
        ...process.env,
        PW_HEADED: 'false',
        PWDEBUG: '0',
        ...overrides,
    };
}

function hasExplicitPlaywrightTarget(args) {
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

function createModeEnv(mode) {
    switch (mode) {
        case 'default':
            return createEnv();
        case 'dev':
            return createEnv({
                PW_USE_DEV_SERVERS: 'true',
                PW_WORKERS: '1',
            });
        case 'isolated':
            return createEnv({
                PW_USE_DEV_SERVERS: 'false',
            });
        case 'ci':
            return createEnv({
                NODE_OPTIONS: '--max-old-space-size=4096',
                PW_START_SERVERS: 'true',
                PW_SERVER_WATCH: 'false',
            });
        case 'critical':
            return createEnv();
        case 'parallel':
            return createEnv({
                PW_ALLOW_FULL_RUN: 'true',
            });
        default:
            console.error(`未知模式: ${mode}`);
            process.exit(1);
    }
}

function getExplicitTargetPath(args) {
    for (const arg of args) {
        if (typeof arg === 'string' && !arg.startsWith('-') && /\.e2e\.[cm]?tsx?$/i.test(arg)) {
            return arg;
        }
    }

    return '';
}

export async function runE2ECommand({ mode, extraArgs = [], envOverrides = {} } = {}) {
    if (!mode) {
        console.error('用法: node scripts/infra/run-e2e-command.mjs <default|dev|isolated|ci|critical|parallel> [...playwrightArgs]');
        process.exit(1);
    }

    const modeEnv = {
        ...createModeEnv(mode),
        ...envOverrides,
    };

    const explicitTargetPath = getExplicitTargetPath(extraArgs);
    if (hasExplicitPlaywrightTarget(extraArgs)) {
        modeEnv.PW_HAS_EXPLICIT_TARGET = 'true';
    }
    if (explicitTargetPath) {
        modeEnv.PW_TEST_TARGET = explicitTargetPath;
    }

    const shouldPreferIsolatedPorts = (
        mode !== 'dev'
        && mode !== 'parallel'
        && modeEnv.PW_HAS_EXPLICIT_TARGET === 'true'
        && !process.env.PW_WORKERS
        && !envOverrides.PW_WORKERS
        && !process.env.PW_USE_DEV_SERVERS
    );

    if (shouldPreferIsolatedPorts) {
        const ports = await allocateAvailablePorts(0);
        modeEnv.PW_ISOLATE_PORTS = 'true';
        modeEnv.PW_PORT = String(ports.frontend);
        modeEnv.PW_GAME_SERVER_PORT = String(ports.gameServer);
        modeEnv.GAME_SERVER_PORT = String(ports.gameServer);
        modeEnv.PW_API_SERVER_PORT = String(ports.apiServer);
        modeEnv.API_SERVER_PORT = String(ports.apiServer);
        console.log(`🧭 Explicit target detected; using isolated single-run ports: frontend=${ports.frontend}, game=${ports.gameServer}, api=${ports.apiServer}`);
    }

    await assertChildProcessSupport('E2E', { probeFork: true, probeEsbuild: true });

    if (mode === 'ci') {
        await cleanupTestConnections([]);
    }

    runEncodingCheck([]);

    if (mode !== 'parallel') {
        await runE2ESafetyCheck(modeEnv);
    }

    const playwrightArgs = ['test'];

    if (mode === 'critical') {
        playwrightArgs.push('e2e/smashup.e2e.ts', 'e2e/tictactoe-rematch.e2e.ts');
    }

    if (mode === 'parallel') {
        playwrightArgs.push('--config=playwright.config.parallel.ts');
    }

    playwrightArgs.push(...extraArgs);

    run(runtimeNode, [playwrightCli, ...playwrightArgs], modeEnv);
}

const isDirectExecution = process.argv[1]
    ? path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
    : false;

if (isDirectExecution) {
    await runE2ECommand({
        mode: process.argv[2],
        extraArgs: process.argv.slice(3),
    });
}
