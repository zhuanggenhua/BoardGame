/**
 * 为指定 worker 启动独立的服务器实例
 * 
 * 用法：node start-worker-servers.js <workerId>
 * 
 * 启动三个服务：
 * - 前端开发服务器（Vite）
 * - 游戏服务器
 * - API 服务器
 */

import { spawn } from 'child_process';
import { allocatePorts, saveWorkerPorts, isPortInUse, waitForPortFree } from './port-allocator.js';

const workerId = parseInt(process.argv[2]);
if (isNaN(workerId)) {
  console.error('用法: node start-worker-servers.js <workerId>');
  process.exit(1);
}

const ports = allocatePorts(workerId);
console.log(`\n🚀 启动 Worker ${workerId} 的服务器...`);
console.log(`  前端: http://localhost:${ports.frontend}`);
console.log(`  游戏服务器: http://localhost:${ports.gameServer}`);
console.log(`  API 服务器: http://localhost:${ports.apiServer}\n`);

// 检查端口是否已被占用
const busyPorts = [];
for (const [name, port] of Object.entries(ports)) {
  if (isPortInUse(port)) {
    busyPorts.push(`${name}(${port})`);
  }
}

if (busyPorts.length > 0) {
  console.error(`❌ 以下端口已被占用: ${busyPorts.join(', ')}`);
  console.error(`   请先运行: node scripts/infra/port-allocator.js ${workerId}`);
  process.exit(1);
}

// 保存端口配置
saveWorkerPorts(workerId, ports);

// 启动前端服务器
const frontend = spawn('npx', ['vite', '--port', ports.frontend.toString(), '--strictPort'], {
  stdio: 'inherit',
  shell: true,
  env: {
    ...process.env,
    VITE_DEV_PORT: ports.frontend.toString(),
    GAME_SERVER_PORT: ports.gameServer.toString(),
    API_SERVER_PORT: ports.apiServer.toString(),
  },
});

// 启动游戏服务器
const gameServer = spawn('tsx', ['server.ts'], {
  stdio: 'inherit',
  shell: true,
  env: {
    ...process.env,
    GAME_SERVER_PORT: ports.gameServer.toString(),
    USE_PERSISTENT_STORAGE: 'false',
  },
});

// 启动 API 服务器
const apiServer = spawn('tsx', ['--tsconfig', 'apps/api/tsconfig.json', 'apps/api/src/main.ts'], {
  stdio: 'inherit',
  shell: true,
  env: {
    ...process.env,
    API_SERVER_PORT: ports.apiServer.toString(),
  },
});

// 处理进程退出
const cleanup = () => {
  console.log(`\n🛑 停止 Worker ${workerId} 的服务器...`);
  frontend.kill();
  gameServer.kill();
  apiServer.kill();
  process.exit(0);
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

// 监听子进程退出
frontend.on('exit', (code) => {
  if (code !== 0) {
    console.error(`❌ 前端服务器异常退出 (code ${code})`);
    cleanup();
  }
});

gameServer.on('exit', (code) => {
  if (code !== 0) {
    console.error(`❌ 游戏服务器异常退出 (code ${code})`);
    cleanup();
  }
});

apiServer.on('exit', (code) => {
  if (code !== 0) {
    console.error(`❌ API 服务器异常退出 (code ${code})`);
    cleanup();
  }
});

console.log(`\n✅ Worker ${workerId} 服务器已启动`);
console.log(`   按 Ctrl+C 停止所有服务\n`);
