/**
 * 清理 E2E 测试遗留的 WebSocket 连接和端口占用
 * 
 * 使用场景：
 * - E2E 测试异常退出后端口被占用
 * - 游戏服务器连接数过多导致性能下降
 * - 需要完全重置测试环境
 */

import { execSync } from 'child_process';

// 开发环境端口
const DEV_PORTS = [3000, 18000, 18001];

// E2E 测试环境端口（完全隔离）
const E2E_PORTS = [5173, 19000, 19001];

// 从命令行参数读取要清理的环境
const args = process.argv.slice(2);
const cleanDev = args.includes('--dev');
const cleanE2E = args.includes('--e2e') || args.length === 0; // 默认清理测试环境

console.log('🧹 清理端口占用...\n');

if (cleanDev) {
  console.log('清理开发环境端口 (3000, 18000, 18001)...');
  cleanPorts(DEV_PORTS);
}

if (cleanE2E) {
  console.log('清理 E2E 测试环境端口 (5173, 19000, 19001)...');
  cleanPorts(E2E_PORTS);
}

function cleanPorts(ports) {
  // Windows 平台
  if (process.platform === 'win32') {
    for (const port of ports) {
      try {
        console.log(`检查端口 ${port}...`);
        const result = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf-8' });
        
        if (result) {
          const lines = result.trim().split('\n');
          const pids = new Set();
          
          for (const line of lines) {
            const match = line.match(/\s+(\d+)\s*$/);
            if (match) {
              pids.add(match[1]);
            }
          }
          
          for (const pid of pids) {
            try {
              console.log(`  终止进程 PID ${pid}`);
              execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' });
            } catch {
              console.log(`  进程 ${pid} 已不存在或无法终止`);
            }
          }
        } else {
          console.log(`  端口 ${port} 未被占用`);
        }
      } catch (error) {
        console.log(`  端口 ${port} 未被占用`);
      }
    }
  } else {
    // Unix/Linux/macOS
    for (const port of ports) {
      try {
        console.log(`检查端口 ${port}...`);
        const result = execSync(`lsof -ti:${port}`, { encoding: 'utf-8' });
        
        if (result) {
          const pids = result.trim().split('\n');
          for (const pid of pids) {
            try {
              console.log(`  终止进程 PID ${pid}`);
              execSync(`kill -9 ${pid}`, { stdio: 'ignore' });
            } catch {
              console.log(`  进程 ${pid} 已不存在或无法终止`);
            }
          }
        } else {
          console.log(`  端口 ${port} 未被占用`);
        }
      } catch (error) {
        console.log(`  端口 ${port} 未被占用`);
      }
    }
  }
}

console.log('\n✅ 清理完成！');
console.log('\n💡 使用方式：');
console.log('  npm run test:e2e:cleanup        # 清理测试环境（默认）');
console.log('  npm run test:e2e:cleanup -- --dev   # 清理开发环境');
console.log('  npm run test:e2e:cleanup -- --e2e --dev  # 清理两个环境');
