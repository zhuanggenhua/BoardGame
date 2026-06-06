import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { build as nativeBuild } from 'esbuild';
import { resolveWorkspaceNodeModuleFile } from './node-module-resolver.mjs';

const repoRoot = process.cwd();
const args = parseArgs(process.argv.slice(2));

const entry = requireArg(args, 'entry');
const outfile = requireArg(args, 'outfile');
const tsconfig = requireArg(args, 'tsconfig');
const label = args.label || path.basename(outfile);

function parseArgs(argv) {
    const parsed = {};
    for (let index = 0; index < argv.length; index += 1) {
        const token = argv[index];
        if (!token.startsWith('--')) {
            continue;
        }
        const key = token.slice(2);
        const value = argv[index + 1];
        parsed[key] = value;
        index += 1;
    }
    return parsed;
}

function requireArg(parsed, key) {
    const value = parsed[key];
    if (!value) {
        throw new Error(`missing required arg --${key}`);
    }
    return value;
}

function collectErrorMessages(error) {
    if (!error) {
        return [];
    }

    const messages = [];
    if (error instanceof Error && error.message) {
        messages.push(error.message);
    }

    if (typeof error === 'object' && error && 'errors' in error && Array.isArray(error.errors)) {
        for (const nested of error.errors) {
            if (nested && typeof nested === 'object' && 'text' in nested && typeof nested.text === 'string') {
                messages.push(nested.text);
            }
        }
    }

    return messages;
}

function isSpawnEpermError(error) {
    return collectErrorMessages(error).some((message) => message.includes('spawn EPERM'));
}

let wasmEsbuildPromise = null;

async function loadWasmEsbuild() {
    if (!wasmEsbuildPromise) {
        wasmEsbuildPromise = (async () => {
            const wasm = await import('esbuild-wasm');
            const wasmPath = resolveWorkspaceNodeModuleFile('esbuild-wasm/esbuild.wasm', {
                label: 'esbuild-wasm',
                cwd: repoRoot,
            }).filePath;
            await wasm.initialize({
                wasmURL: pathToFileURL(wasmPath).href,
                worker: false,
            });
            return wasm;
        })();
    }

    return wasmEsbuildPromise;
}

async function buildWithFallback(options) {
    try {
        return await nativeBuild(options);
    } catch (error) {
        const allowWasmFallback = process.env.BG_ESBUILD_WASM_FALLBACK !== 'false';
        if (!allowWasmFallback || !isSpawnEpermError(error)) {
            throw error;
        }

        const wasmEsbuild = await loadWasmEsbuild();
        console.warn(`[build-node-bundle] ${label} native esbuild unavailable, fallback to esbuild-wasm`);
        return wasmEsbuild.build(options);
    }
}

const absOutfile = path.resolve(repoRoot, outfile);
fs.mkdirSync(path.dirname(absOutfile), { recursive: true });

const startedAt = Date.now();
console.log(`[build-node-bundle] ${label} building ${entry} -> ${outfile}`);

await buildWithFallback({
    absWorkingDir: repoRoot,
    entryPoints: [entry],
    outfile,
    bundle: true,
    platform: 'node',
    format: 'esm',
    packages: 'external',
    sourcemap: true,
    logLevel: 'info',
    tsconfig,
});

console.log(`[build-node-bundle] ${label} done in ${Date.now() - startedAt}ms`);
