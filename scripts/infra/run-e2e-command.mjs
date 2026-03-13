import { spawnSync } from 'node:child_process';
import path from 'node:path';

const playwrightCli = path.resolve(process.cwd(), 'node_modules', 'playwright', 'cli.js');

function run(command, args, env) {
    const result = spawnSync(command, args, {
        stdio: 'inherit',
        env,
        shell: false,
    });

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

const mode = process.argv[2];
const extraArgs = process.argv.slice(3);

if (!mode) {
    console.error('用法: node scripts/infra/run-e2e-command.mjs <default|dev|isolated|ci|critical|parallel> [...playwrightArgs]');
    process.exit(1);
}

const modeEnv = (() => {
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
                PW_SERVER_RUNTIME: 'tsx',
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
})();

if (hasExplicitPlaywrightTarget(extraArgs)) {
    modeEnv.PW_HAS_EXPLICIT_TARGET = 'true';
}

run(process.execPath, ['scripts/infra/assert-child-process-support.mjs', 'E2E', '--probe-fork', '--probe-esbuild'], modeEnv);

if (mode === 'ci') {
    run(process.execPath, ['scripts/infra/cleanup_test_connections.js'], modeEnv);
}

run(process.execPath, ['scripts/infra/check-file-encoding.mjs'], modeEnv);

if (mode !== 'parallel') {
    run(process.execPath, ['scripts/infra/check-e2e-safety.js'], modeEnv);
}

const playwrightArgs = ['test'];

if (mode === 'critical') {
    playwrightArgs.push('e2e/smashup.e2e.ts', 'e2e/tictactoe-rematch.e2e.ts');
}

if (mode === 'parallel') {
    playwrightArgs.push('--config=playwright.config.parallel.ts');
}

playwrightArgs.push(...extraArgs);

run(process.execPath, [playwrightCli, ...playwrightArgs], modeEnv);
