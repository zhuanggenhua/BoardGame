#!/usr/bin/env node

import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { assertChildProcessSupport } from './assert-child-process-support.mjs';
import { installViteWindowsNetUseBypass } from './vite-windows-net-use-bypass.mjs';
import { resolveWorkspaceNodeModuleFile } from './node-module-resolver.mjs';

const installBrokenPipeGuard = (stream) => {
    stream.on('error', (error) => {
        if (error?.code === 'EPIPE') {
            process.exit(0);
            return;
        }
        setImmediate(() => {
            throw error;
        });
    });
};

installBrokenPipeGuard(process.stdout);
installBrokenPipeGuard(process.stderr);

const readCliFlagValue = (flagName) => {
    const exactFlag = `--${flagName}`;
    const prefix = `${exactFlag}=`;

    for (let index = 2; index < process.argv.length; index += 1) {
        const arg = process.argv[index];
        if (arg === exactFlag) {
            const next = process.argv[index + 1];
            return next && !next.startsWith('-') ? next : undefined;
        }

        if (arg.startsWith(prefix)) {
            return arg.slice(prefix.length);
        }
    }

    return undefined;
};

const shouldProbeFork = () => {
    const pool = readCliFlagValue('pool');
    return pool == null || pool === 'forks' || pool === 'vmForks';
};

installViteWindowsNetUseBypass();
await assertChildProcessSupport('Vitest CLI', {
    probeEsbuild: true,
    probeFork: shouldProbeFork(),
});

const vitestPackageInfo = resolveWorkspaceNodeModuleFile('vitest/package.json', {
    label: 'Vitest package',
    cwd: process.cwd(),
});
const vitestRootUrl = pathToFileURL(path.dirname(vitestPackageInfo.filePath) + path.sep);
const legacyEntryUrl = new URL('vitest.mjs', vitestRootUrl);

if (existsSync(fileURLToPath(legacyEntryUrl))) {
    await import(legacyEntryUrl);
} else {
    const vitestChunksDir = fileURLToPath(new URL('dist/chunks/', vitestRootUrl));
    const chunkNames = readdirSync(vitestChunksDir);
    const resolveChunkUrl = (prefix) => {
        const chunkName = chunkNames.find((name) => name.startsWith(prefix) && name.endsWith('.js'));
        if (!chunkName) {
            throw new Error(`Vitest CLI 入口不存在：${prefix}*（目录：${vitestChunksDir}）`);
        }
        return pathToFileURL(`${vitestChunksDir}\\${chunkName}`).href;
    };

    const [{ p: parseCLI }, cliApiModule] = await Promise.all([
        import(resolveChunkUrl('cac.')),
        import(resolveChunkUrl('cli-api.')),
    ]);

    const cliApi = cliApiModule.q ?? {};
    const startVitest = cliApi.startVitest ?? cliApiModule.s;
    if (typeof parseCLI !== 'function' || typeof startVitest !== 'function') {
        throw new Error('Vitest CLI 兼容加载失败：未找到 parseCLI 或 startVitest');
    }

    const args = process.argv.slice(2);
    const subcommand = args[0];
    const mode = subcommand === 'bench' || subcommand === 'benchmark' ? 'benchmark' : 'test';
    const { filter, options } = parseCLI(['vitest', ...args]);
    const ctx = await startVitest(mode, filter, options);
    if (ctx && typeof ctx.shouldKeepServer === 'function' && !ctx.shouldKeepServer()) {
        await ctx.exit();
    }
}
