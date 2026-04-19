import { runE2ECommand } from './run-e2e-command.mjs';

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

const { match, playwrightArgs } = parseArgs(process.argv.slice(2));

if (!match) {
    console.error('用法: npm run test:e2e:dev:file -- <e2e文件路径>');
    console.error('示例: npm run test:e2e:dev:file -- e2e/smashup/smashup-4p-layout-test.e2e.ts');
    process.exit(1);
}

console.log(`[test:e2e:dev:file] 复用现服单文件运行: ${match}`);

await runE2ECommand({
    mode: 'dev',
    extraArgs: [match, ...playwrightArgs],
    entrypoint: 'run-e2e-dev-single',
});
