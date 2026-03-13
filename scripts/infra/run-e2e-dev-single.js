import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { assertChildProcessSupport } from './assert-child-process-support.mjs';

await assertChildProcessSupport('E2E 单文件调试运行', { probeFork: true, probeEsbuild: true });

function parseArgs(argv) {
    let match = process.env.PW_TEST_MATCH?.trim();
    const playwrightArgs = [];

    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];

        if (arg === '--match') {
            match = argv[index + 1]?.trim();
            index += 1;
            continue;
        }

        if (arg.startsWith('--match=')) {
            match = arg.slice('--match='.length).trim();
            continue;
        }

        if (!arg.startsWith('-') && !match) {
            match = arg.trim();
            continue;
        }

        playwrightArgs.push(arg);
    }

    return { match, playwrightArgs };
}

function run(command, args, env) {
    const result = spawnSync(command, args, {
        stdio: 'inherit',
        env,
        shell: false,
    });

    if (typeof result.status === 'number' && result.status !== 0) {
        process.exit(result.status);
    }

    if (result.error) {
        throw result.error;
    }
}

const { match, playwrightArgs } = parseArgs(process.argv.slice(2));

if (!match) {
    console.error('用法: npm run test:e2e:dev:file -- <e2e文件路径>');
    console.error('示例: npm run test:e2e:dev:file -- e2e/smashup-4p-layout-test.e2e.ts');
    process.exit(1);
}

const env = {
    ...process.env,
    PW_HEADED: 'false',
    PWDEBUG: '0',
    PW_USE_DEV_SERVERS: 'true',
    PW_WORKERS: '1',
    PW_TEST_MATCH: match,
};

const playwrightCli = path.resolve(process.cwd(), 'node_modules', 'playwright', 'cli.js');

console.log(`[test:e2e:dev:file] 复用现服单文件运行: ${match}`);

run(process.execPath, ['scripts/infra/check-file-encoding.mjs'], env);
run(process.execPath, ['scripts/infra/check-e2e-safety.js'], env);
run(process.execPath, [playwrightCli, 'test', ...playwrightArgs], env);
