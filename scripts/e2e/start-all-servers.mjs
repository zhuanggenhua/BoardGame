#!/usr/bin/env node
/**
 * E2E 测试服务器启动脚本
 * 
 * 同时启动前端、游戏服务器和 API 服务器
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '../..');

// 从环境变量或默认值获取端口
const FRONTEND_PORT = process.env.PW_PORT || process.env.E2E_PORT || '5173';
const GAME_SERVER_PORT = process.env.GAME_SERVER_PORT || process.env.PW_GAME_SERVER_PORT || '19000';
const API_SERVER_PORT = process.env.API_SERVER_PORT || process.env.PW_API_SERVER_PORT || '19001';

console.log('🚀 启动 E2E 测试服务器...');
console.log(`   前端: http://localhost:${FRONTEND_PORT}`);
console.log(`   游戏服务器: http://localhost:${GAME_SERVER_PORT}`);
console.log(`   API 服务器: http://localhost:${API_SERVER_PORT}`);

const processes = [];

// 启动前端
const frontend = spawn('npx', ['vite', '--port', FRONTEND_PORT, '--strictPort'], {
    cwd: rootDir,
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, PORT: FRONTEND_PORT }
});
processes.push({ name: '前端', process: frontend });

// 启动游戏服务器（直接使用 tsx，不用 nodemon）
const gameServer = spawn('npx', ['tsx', 'server.ts'], {
    cwd: rootDir,
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, GAME_SERVER_PORT, USE_PERSISTENT_STORAGE: 'false' }
});
processes.push({ name: '游戏服务器', process: gameServer });

// 启动 API 服务器（直接使用 tsx）
const apiServer = spawn('npx', ['tsx', '--tsconfig', 'apps/api/tsconfig.json', 'apps/api/src/main.ts'], {
    cwd: rootDir,
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, API_SERVER_PORT }
});
processes.push({ name: 'API 服务器', process: apiServer });

// 处理进程退出
processes.forEach(({ name, process: proc }) => {
    proc.on('exit', (code) => {
        console.log(`❌ ${name} 退出，代码: ${code}`);
        // 如果任何一个进程退出，杀死所有进程
        processes.forEach(p => {
            try {
                p.process.kill();
            } catch (e) {
                // 忽略错误
            }
        });
        process.exit(code || 1);
    });
});

// 处理 Ctrl+C
process.on('SIGINT', () => {
    console.log('\n🛑 收到中断信号，关闭所有服务器...');
    processes.forEach(({ name, process: proc }) => {
        console.log(`   关闭 ${name}...`);
        try {
            proc.kill('SIGINT');
        } catch (e) {
            // 忽略错误
        }
    });
    process.exit(0);
});

// 保持进程运行
process.stdin.resume();

