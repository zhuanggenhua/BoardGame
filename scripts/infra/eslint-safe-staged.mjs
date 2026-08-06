import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();

function resolveEslintCli(startDir) {
    let currentDir = path.resolve(startDir);
    while (true) {
        const candidate = path.join(currentDir, 'node_modules', 'eslint', 'bin', 'eslint.js');
        if (fs.existsSync(candidate)) {
            return candidate;
        }
        const parentDir = path.dirname(currentDir);
        if (parentDir === currentDir) {
            throw new Error(`找不到 ESLint CLI：从 ${startDir} 向上查找 node_modules/eslint/bin/eslint.js 失败`);
        }
        currentDir = parentDir;
    }
}

const eslintCli = resolveEslintCli(rootDir);

const allFiles = process.argv.slice(2);
const STABLE_ESLINT_NODE_OPTIONS = '--max-old-space-size=8192';
const INITIAL_BATCH_SIZE = 5;

function mergeNodeOptions(extraOption, existingValue = process.env.NODE_OPTIONS) {
    const trimmedExtra = extraOption?.trim();
    const trimmedExisting = existingValue?.trim();
    if (!trimmedExtra) return trimmedExisting;
    if (!trimmedExisting) return trimmedExtra;
    return trimmedExisting.includes(trimmedExtra)
        ? trimmedExisting
        : `${trimmedExisting} ${trimmedExtra}`;
}

function chunkFiles(files, batchSize) {
    const batches = [];
    for (let index = 0; index < files.length; index += batchSize) {
        batches.push(files.slice(index, index + batchSize));
    }
    return batches;
}

function runEslint(files) {
    return new Promise((resolve) => {
        const child = spawn(
            process.execPath,
            [eslintCli, '--max-warnings', '999', ...files],
            {
                cwd: rootDir,
                env: {
                    ...process.env,
                    NODE_OPTIONS: mergeNodeOptions(STABLE_ESLINT_NODE_OPTIONS),
                },
                stdio: 'inherit',
            },
        );

        child.on('exit', (code, signal) => {
            resolve({
                code: code ?? 1,
                signal,
            });
        });
    });
}

async function runBatch(files) {
    if (files.length === 0) {
        return true;
    }

    const result = await runEslint(files);
    if (result.code === 0) {
        return true;
    }

    if (files.length === 1) {
        return false;
    }

    const midpoint = Math.ceil(files.length / 2);
    const leftOk = await runBatch(files.slice(0, midpoint));
    if (!leftOk) {
        return false;
    }
    return runBatch(files.slice(midpoint));
}

async function main() {
    for (const batch of chunkFiles(allFiles, INITIAL_BATCH_SIZE)) {
        const ok = await runBatch(batch);
        if (!ok) {
            process.exit(1);
        }
    }
}

await main();
