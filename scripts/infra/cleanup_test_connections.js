/**
 * 清理 E2E 测试遗留的 WebSocket 连接和端口占用。
 *
 * 默认只清理单 worker E2E 端口，避免误杀本地开发环境。
 */

import { execSync } from 'child_process';
import { DEV_SERVER_PORTS, E2E_SINGLE_WORKER_PORTS, toPortArray } from './e2e-port-config.js';

const DEV_PORTS = toPortArray(DEV_SERVER_PORTS);
const E2E_PORTS = toPortArray(E2E_SINGLE_WORKER_PORTS);

const args = process.argv.slice(2);
const cleanDev = args.includes('--dev');
const cleanE2E = args.includes('--e2e') || args.length === 0;

console.log('🧹 清理端口占用...\n');

if (cleanDev) {
  console.log(`清理开发环境端口 (${DEV_PORTS.join(', ')})...`);
  cleanPorts(DEV_PORTS);
}

if (cleanE2E) {
  console.log(`清理 E2E 测试环境端口 (${E2E_PORTS.join(', ')})...`);
  cleanPorts(E2E_PORTS);
}

function cleanPorts(ports) {
  if (process.platform === 'win32') {
    for (const port of ports) {
      try {
        console.log(`检查端口 ${port}...`);
        const result = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf-8' });
        if (!result) {
          console.log(`  端口 ${port} 未被占用`);
          continue;
        }

        const lines = result.trim().split(/\r?\n/);
        const pids = new Set();

        for (const rawLine of lines) {
          const line = rawLine.trim();
          if (!line) continue;

          const columns = line.split(/\s+/);
          if (columns[0] !== 'TCP') continue;

          const localAddress = columns[1];
          const state = columns[3];
          const pid = Number(columns[4]);

          if (!localAddress?.endsWith(`:${port}`)) continue;
          if (state !== 'LISTENING') continue;
          if (!Number.isInteger(pid) || pid <= 0) continue;

          pids.add(String(pid));
        }

        if (pids.size === 0) {
          console.log(`  端口 ${port} 未被占用`);
          continue;
        }

        for (const pid of pids) {
          try {
            console.log(`  终止进程 PID ${pid}`);
            execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' });
          } catch {
            console.log(`  进程 ${pid} 已不存在或无法终止`);
          }
        }
      } catch {
        console.log(`  端口 ${port} 未被占用`);
      }
    }
    return;
  }

  for (const port of ports) {
    try {
      console.log(`检查端口 ${port}...`);
      const result = execSync(`lsof -ti:${port}`, { encoding: 'utf-8' });
      if (!result) {
        console.log(`  端口 ${port} 未被占用`);
        continue;
      }

      const pids = result.trim().split('\n').filter(Boolean);
      if (pids.length === 0) {
        console.log(`  端口 ${port} 未被占用`);
        continue;
      }

      for (const pid of pids) {
        try {
          console.log(`  终止进程 PID ${pid}`);
          execSync(`kill -9 ${pid}`, { stdio: 'ignore' });
        } catch {
          console.log(`  进程 ${pid} 已不存在或无法终止`);
        }
      }
    } catch {
      console.log(`  端口 ${port} 未被占用`);
    }
  }
}

console.log('\n✅ 清理完成！');
console.log('\n💡 使用方式：');
console.log('  npm run test:e2e:cleanup              # 清理测试环境（默认）');
console.log('  npm run test:e2e:cleanup -- --dev     # 清理开发环境');
console.log('  npm run test:e2e:cleanup -- --e2e --dev  # 清理两个环境');
