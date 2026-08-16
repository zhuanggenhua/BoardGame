import fs from 'node:fs';
import path from 'node:path';
import { runE2ECommand } from './run-e2e-command.mjs';

const VALID_MODES = new Set(['default', 'ci', 'isolated', 'critical']);
const DEFAULT_BATCH_SIZE = 5;

function normalizeE2EPath(value) {
    return value.trim().replace(/\\/g, '/');
}

function printUsage() {
    console.error([
        '用法:',
        '  node scripts/infra/run-e2e-batch.mjs <default|ci|isolated|critical> --dir e2e/<game> [--batch-size 5] [--batch-index 1] [--recursive]',
        '  node scripts/infra/run-e2e-batch.mjs ci --files e2e/a.e2e.ts e2e/b.e2e.ts',
    ].join('\n'));
}

function parsePositiveInt(value, fallback, label) {
    const parsed = Number.parseInt(String(value ?? '').trim(), 10);
    if (Number.isInteger(parsed) && parsed > 0) {
        return parsed;
    }
    if (fallback !== undefined) {
        return fallback;
    }
    throw new Error(`${label} 必须是正整数。`);
}

function collectE2EFiles(rootDir, { recursive }) {
    const normalizedRoot = normalizeE2EPath(rootDir);
    const absoluteRoot = path.resolve(normalizedRoot);
    if (!fs.existsSync(absoluteRoot) || !fs.statSync(absoluteRoot).isDirectory()) {
        throw new Error(`E2E 目录不存在: ${normalizedRoot}`);
    }

    const files = [];
    const walk = (currentDir) => {
        for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
            const absolutePath = path.join(currentDir, entry.name);
            if (entry.isDirectory()) {
                if (recursive) {
                    walk(absolutePath);
                }
                continue;
            }
            if (entry.isFile() && entry.name.endsWith('.e2e.ts')) {
                files.push(path.relative(process.cwd(), absolutePath).replace(/\\/g, '/'));
            }
        }
    };

    walk(absoluteRoot);
    return files.sort((left, right) => left.localeCompare(right));
}

function parseArgs(argv) {
    let mode = 'ci';
    let index = 0;
    if (argv[0] && VALID_MODES.has(argv[0])) {
        mode = argv[0];
        index = 1;
    }

    let dir = '';
    let recursive = false;
    let batchSize = DEFAULT_BATCH_SIZE;
    let batchIndex = 1;
    let filesMode = false;
    const explicitFiles = [];
    const positionalArgs = [];
    const playwrightArgs = [];

    for (; index < argv.length; index += 1) {
        const arg = argv[index];

        if (arg === '--dir') {
            dir = normalizeE2EPath(argv[index + 1] ?? '');
            index += 1;
            continue;
        }
        if (arg.startsWith('--dir=')) {
            dir = normalizeE2EPath(arg.slice('--dir='.length));
            continue;
        }
        if (arg === '--recursive') {
            recursive = true;
            continue;
        }
        if (arg === '--batch-size') {
            batchSize = parsePositiveInt(argv[index + 1], undefined, '--batch-size');
            index += 1;
            continue;
        }
        if (arg.startsWith('--batch-size=')) {
            batchSize = parsePositiveInt(arg.slice('--batch-size='.length), undefined, '--batch-size');
            continue;
        }
        if (arg === '--batch-index') {
            batchIndex = parsePositiveInt(argv[index + 1], undefined, '--batch-index');
            index += 1;
            continue;
        }
        if (arg.startsWith('--batch-index=')) {
            batchIndex = parsePositiveInt(arg.slice('--batch-index='.length), undefined, '--batch-index');
            continue;
        }
        if (arg === '--files') {
            filesMode = true;
            continue;
        }
        if (arg === '--') {
            playwrightArgs.push(...argv.slice(index + 1));
            break;
        }
        if (filesMode && !arg.startsWith('-')) {
            explicitFiles.push(normalizeE2EPath(arg));
            continue;
        }
        if (!arg.startsWith('-')) {
            positionalArgs.push(arg);
            continue;
        }
        playwrightArgs.push(arg);
    }

    if (!dir && explicitFiles.length === 0 && positionalArgs[0]) {
        dir = normalizeE2EPath(positionalArgs[0]);
    }
    if (positionalArgs[1]) {
        batchSize = parsePositiveInt(positionalArgs[1], undefined, 'batchSize');
    }
    if (positionalArgs[2]) {
        batchIndex = parsePositiveInt(positionalArgs[2], undefined, 'batchIndex');
    }

    if (!dir && explicitFiles.length === 0) {
        printUsage();
        process.exit(1);
    }

    return {
        mode,
        dir,
        recursive,
        batchSize,
        batchIndex,
        files: explicitFiles,
        playwrightArgs,
    };
}

function shouldRunPerFile() {
    return process.env.BG_E2E_BATCH_PER_FILE === '1';
}

function hasFailureLimit(args) {
    return args.some((arg) => (
        arg === '--max-failures'
        || arg.startsWith('--max-failures=')
        || arg === '-x'
    ));
}

function isPlaywrightListMode(args) {
    return args.some((arg) => arg === '--list');
}

async function main() {
    const options = parseArgs(process.argv.slice(2));
    const allFiles = options.files.length > 0
        ? options.files
        : collectE2EFiles(options.dir, { recursive: options.recursive });
    const start = (options.batchIndex - 1) * options.batchSize;
    const selectedFiles = allFiles.slice(start, start + options.batchSize);

    if (selectedFiles.length === 0) {
        throw new Error(`批次为空: batchIndex=${options.batchIndex}, batchSize=${options.batchSize}, total=${allFiles.length}`);
    }

    console.log([
        `[test:e2e:${options.mode}:batch] 总文件数=${allFiles.length}`,
        `批次=${options.batchIndex}`,
        `批次大小=${options.batchSize}`,
        `本批=${selectedFiles.length}`,
        `recursive=${options.recursive}`,
    ].join(' | '));
    for (const file of selectedFiles) {
        console.log(`  - ${file}`);
    }

    if (!shouldRunPerFile()) {
        process.exitCode = 0;
        const failureLimitArgs = hasFailureLimit(options.playwrightArgs) || isPlaywrightListMode(options.playwrightArgs)
            ? []
            : ['--max-failures=1'];
        console.log(`\n[test:e2e:${options.mode}:batch] 合并执行 ${selectedFiles.length} 个文件，首个失败即停止`);
        await runE2ECommand({
            mode: options.mode,
            extraArgs: [...selectedFiles, ...failureLimitArgs, ...options.playwrightArgs],
            envOverrides: {
                PW_E2E_SERVICE_REUSE: process.env.PW_E2E_SERVICE_REUSE ?? 'shared-single',
                PW_SERVER_WATCH: process.env.PW_SERVER_WATCH ?? 'false',
            },
            entrypoint: 'run-e2e-batch',
        });

        const exitCode = Number(process.exitCode || 0);
        if (exitCode !== 0) {
            console.error(`[test:e2e:${options.mode}:batch] 失败后停止: exitCode=${exitCode}`);
            process.exit(exitCode);
        }

        console.log(`[test:e2e:${options.mode}:batch] 本批通过: ${selectedFiles.length}/${selectedFiles.length}`);
        return;
    }

    console.log('[test:e2e:batch] BG_E2E_BATCH_PER_FILE=1，使用旧逐文件执行模式。');
    for (let fileIndex = 0; fileIndex < selectedFiles.length; fileIndex += 1) {
        const file = selectedFiles[fileIndex];
        process.exitCode = 0;
        console.log(`\n[test:e2e:${options.mode}:batch] (${fileIndex + 1}/${selectedFiles.length}) ${file}`);
        await runE2ECommand({
            mode: options.mode,
            extraArgs: [file, ...options.playwrightArgs],
            envOverrides: {
                PW_E2E_SERVICE_REUSE: process.env.PW_E2E_SERVICE_REUSE ?? 'shared-single',
                PW_SERVER_WATCH: process.env.PW_SERVER_WATCH ?? 'false',
            },
            entrypoint: 'run-e2e-batch',
        });

        const exitCode = Number(process.exitCode || 0);
        if (exitCode !== 0) {
            console.error(`[test:e2e:${options.mode}:batch] 失败后停止: ${file}, exitCode=${exitCode}`);
            process.exit(exitCode);
        }
    }

    console.log(`[test:e2e:${options.mode}:batch] 本批通过: ${selectedFiles.length}/${selectedFiles.length}`);
}

await main();
