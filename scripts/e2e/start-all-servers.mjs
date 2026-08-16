#!/usr/bin/env node
/**
 * E2E 测试服务器启动脚本
 *
 * 同时启动前端、游戏服务器和 API 服务器
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { E2E_SINGLE_WORKER_PORTS } from '../infra/e2e-port-config.js';
import { withE2ELocalAssetEnv } from '../infra/e2e-local-assets-env.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '../..');

const FRONTEND_PORT = process.env.PW_PORT || process.env.E2E_PORT || String(E2E_SINGLE_WORKER_PORTS.frontend);
const GAME_SERVER_PORT = process.env.GAME_SERVER_PORT || process.env.PW_GAME_SERVER_PORT || String(E2E_SINGLE_WORKER_PORTS.gameServer);
const API_SERVER_PORT = process.env.API_SERVER_PORT || process.env.PW_API_SERVER_PORT || String(E2E_SINGLE_WORKER_PORTS.apiServer);

console.log('🚀 启动 E2E 测试服务器...');
console.log(`   前端: http://localhost:${FRONTEND_PORT}`);
console.log(`   游戏服务器: http://localhost:${GAME_SERVER_PORT}`);
console.log(`   API 服务器: http://localhost:${API_SERVER_PORT}`);

const processes = [];

const frontend = spawn('npx', ['vite', '--port', FRONTEND_PORT, '--strictPort'], {
    cwd: rootDir,
    stdio: 'inherit',
    shell: true,
    env: withE2ELocalAssetEnv({ ...process.env, PORT: FRONTEND_PORT }),
});
processes.push({ name: '前端', process: frontend });

const gameServer = spawn('node', [
    'scripts/infra/dev-bundle-runner.mjs',
    '--label', 'e2e-game',
    '--entry', 'server.ts',
    '--outfile', 'temp/dev-bundles/e2e-game/server.mjs',
    '--tsconfig', 'tsconfig.server.json',
], {
    cwd: rootDir,
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, NODE_ENV: 'test', GAME_SERVER_PORT, USE_PERSISTENT_STORAGE: 'false' },
});
processes.push({ name: '游戏服务器', process: gameServer });

const apiServer = spawn('node', [
    'scripts/infra/dev-bundle-runner.mjs',
    '--label', 'e2e-api',
    '--entry', 'apps/api/src/main.ts',
    '--outfile', 'temp/dev-bundles/e2e-api/main.mjs',
    '--tsconfig', 'apps/api/tsconfig.json',
], {
    cwd: rootDir,
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, API_SERVER_PORT },
});
processes.push({ name: 'API 服务器', process: apiServer });

processes.forEach(({ name, process: proc }) => {
    proc.on('exit', (code) => {
        console.log(`❌ ${name} 退出，代码: ${code}`);
        processes.forEach((item) => {
            try {
                item.process.kill();
            } catch {
            }
        });
        process.exit(code || 1);
    });
});

process.on('SIGINT', () => {
    console.log('\n🛑 收到中断信号，关闭所有服务器...');
    processes.forEach(({ name, process: proc }) => {
        console.log(`   关闭 ${name}...`);
        try {
            proc.kill('SIGINT');
        } catch {
        }
    });
    process.exit(0);
});

process.stdin.resume();
