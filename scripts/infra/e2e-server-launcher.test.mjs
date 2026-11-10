import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { spawnNodeScript, spawnTsLoaderEntry } from './e2e-server-launcher.js';

test('服务子进程使用指定源码目录而管理进程留在原目录', async () => {
    const sourceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-source-root-'));
    const originalCwd = process.cwd();
    fs.writeFileSync(path.join(sourceRoot, 'child.mjs'), 'console.log(process.cwd())');
    try {
        const child = spawnNodeScript('child.mjs', process.env, [], { cwd: sourceRoot, stdio: ['ignore', 'pipe', 'pipe'] });
        let stdout = '';
        let stderr = '';
        child.stdout.on('data', chunk => { stdout += chunk; });
        child.stderr.on('data', chunk => { stderr += chunk; });
        const code = await new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', resolve); });
        assert.equal(code, 0, stderr);
        assert.equal(path.resolve(stdout.trim()), path.resolve(sourceRoot));
        assert.equal(process.cwd(), originalCwd);
    } finally { fs.rmSync(sourceRoot, { recursive: true, force: true }); }
});

test('ts-loader 的源码目录和 tsconfig 均来自指定根目录', async () => {
    const sourceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-loader-root-'));
    fs.mkdirSync(path.join(sourceRoot, 'scripts', 'infra'), { recursive: true });
    fs.writeFileSync(path.join(sourceRoot, 'scripts', 'infra', 'ts-runtime-loader.mjs'), 'export async function resolve(s,c,n){return n(s,c)}');
    fs.writeFileSync(path.join(sourceRoot, 'child.mjs'), 'console.log(JSON.stringify({cwd:process.cwd(),config:process.env.TS_RUNTIME_TSCONFIG}))');
    try {
        const child = spawnTsLoaderEntry({ entry: 'child.mjs', tsconfig: 'tsconfig.json', env: process.env,
            spawnOptions: { cwd: sourceRoot, stdio: ['ignore', 'pipe', 'pipe'] } });
        let stdout = '';
        let stderr = '';
        child.stdout.on('data', chunk => { stdout += chunk; });
        child.stderr.on('data', chunk => { stderr += chunk; });
        const code = await new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', resolve); });
        assert.equal(code, 0, stderr);
        const result = JSON.parse(stdout);
        assert.equal(path.resolve(result.cwd), path.resolve(sourceRoot));
        assert.equal(result.config, path.join(sourceRoot, 'tsconfig.json'));
    } finally { fs.rmSync(sourceRoot, { recursive: true, force: true }); }
});
