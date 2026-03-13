/**
 * E2E 测试安全检查
 *
 * 验证测试环境与开发环境是否真正隔离。
 */

import { execSync } from 'child_process';
import { DEV_SERVER_PORTS, E2E_SINGLE_WORKER_PORTS } from './e2e-port-config.js';
import { assertChildProcessSupport } from './assert-child-process-support.mjs';

await assertChildProcessSupport('E2E 测试环境检查', { probeFork: true, probeEsbuild: true });

const DEV_PORTS = DEV_SERVER_PORTS;
const E2E_PORTS = E2E_SINGLE_WORKER_PORTS;

console.log('📳 E2E 测试环境检查...\n');

const useDevServers = process.env.PW_USE_DEV_SERVERS === 'true';
const forceStartServers = process.env.PW_START_SERVERS === 'true';
const headedByEnv = process.env.PW_HEADED === 'true' || process.env.PWDEBUG === '1';

const testModeLabel = useDevServers
  ? '⚠️ 使用开发服务器（不推荐）'
  : forceStartServers
    ? '✅ 独立测试环境（强制新起服务）'
    : '✅ 独立测试环境（推荐）';

console.log(`测试模式: ${testModeLabel}`);

if (headedByEnv) {
  console.log('\n⚠️ 警告：检测到可见浏览器模式环境变量');
  console.log(`   PW_HEADED=${process.env.PW_HEADED ?? '<unset>'}`);
  console.log(`   PWDEBUG=${process.env.PWDEBUG ?? '<unset>'}`);
  console.log('   这会让 Playwright 打开可见浏览器窗口；多页或多 worker 用例会一次性弹出很多窗口。');
  console.log('\n   清除方法：');
  console.log('   - PowerShell: Remove-Item Env:PW_HEADED -ErrorAction SilentlyContinue; Remove-Item Env:PWDEBUG -ErrorAction SilentlyContinue');
  console.log('   - Bash: unset PW_HEADED; unset PWDEBUG');
  console.log('   - 或直接使用项目脚本：npm run test:e2e（默认会强制无头运行）\n');
}

if (useDevServers) {
  console.log('\n⚠️ 警告：检测到 PW_USE_DEV_SERVERS=true');
  console.log('   这会导致测试使用开发服务器，而不是独立测试环境');
  console.log(`   测试会连接到开发环境的服务器（${DEV_PORTS.frontend}/${DEV_PORTS.gameServer}/${DEV_PORTS.apiServer}）`);
  console.log('\n   清除方法：');
  console.log('   - PowerShell: $env:PW_USE_DEV_SERVERS = $null');
  console.log('   - Bash: unset PW_USE_DEV_SERVERS');
  console.log('   - 或运行: npx cross-env PW_USE_DEV_SERVERS=false npm run test:e2e\n');
} else {
  console.log('\n✅ 测试环境完全隔离');
  console.log(`   测试端口: ${E2E_PORTS.frontend}, ${E2E_PORTS.gameServer}, ${E2E_PORTS.apiServer}`);
  console.log(`   开发端口: ${DEV_PORTS.frontend}, ${DEV_PORTS.gameServer}, ${DEV_PORTS.apiServer}`);
  console.log('   → 测试不会影响开发环境\n');
}

const checkPort = (port) => {
  try {
    if (process.platform === 'win32') {
      const result = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf-8' });
      const lines = result.trim().split(/\r?\n/);

      return lines.some((rawLine) => {
        const line = rawLine.trim();
        if (!line) return false;

        const columns = line.split(/\s+/);
        if (columns[0] !== 'TCP') return false;

        const localAddress = columns[1];
        const state = columns[3];
        const pid = Number(columns[4]);

        return localAddress?.endsWith(`:${port}`) && state === 'LISTENING' && Number.isFinite(pid) && pid > 0;
      });
    }
    const result = execSync(`lsof -nP -iTCP:${port} -sTCP:LISTEN -t`, { encoding: 'utf-8' });
    return result.trim().length > 0;
  } catch {
    return false;
  }
};

console.log('开发环境端口占用:');
let devServersRunning = 0;
for (const [name, port] of Object.entries(DEV_PORTS)) {
  const occupied = checkPort(port);
  console.log(`  ${occupied ? '✅' : '○'} ${name} (${port}): ${occupied ? '已占用' : '空闲'}`);
  if (occupied) devServersRunning++;
}

console.log('\nE2E 测试环境端口占用:');
let e2eServersRunning = 0;
for (const [name, port] of Object.entries(E2E_PORTS)) {
  const occupied = checkPort(port);
  console.log(`  ${occupied ? '✅' : '○'} ${name} (${port}): ${occupied ? '已占用' : '空闲'}`);
  if (occupied) e2eServersRunning++;
}

console.log('\n状态分析:');
if (!useDevServers) {
  console.log('  ✅ 完全隔离模式');
  console.log(`  → 开发环境: ${devServersRunning}/3 个服务运行中`);
  console.log(`  → 测试环境: ${e2eServersRunning}/3 个服务运行中`);
  if (forceStartServers) {
    if (e2eServersRunning === 0) {
      console.log('  → Playwright 将强制启动一套全新的测试服务器');
    } else {
      console.log('  ⚠️ 强制新起服务模式下，测试端口启动前应为空');
      console.log('  → 建议先执行 npm run test:e2e:cleanup，再重新运行测试');
    }
  } else if (e2eServersRunning === 0) {
    console.log('  → Playwright 会自动启动测试服务器');
  } else if (e2eServersRunning === 3) {
    console.log('  → Playwright 会复用已有测试服务器');
  } else {
    console.log('  ⚠️ 部分测试端口被占用，可能需要清理');
  }
  console.log('  → 测试不会影响开发环境 ✅');
} else {
  console.log('  ⚠️ 使用开发服务器模式');
  if (devServersRunning === 3) {
    console.log('  → 测试会直接连接开发服务器');
    console.log('  → 可能影响开发环境状态');
  } else {
    console.log('  → 开发服务器未完全启动');
    console.log('  → 测试可能失败');
  }
}

console.log('\n✅ 检查完成\n');
console.log('提示:');
console.log('  - 推荐使用完全隔离模式（默认）');
console.log('  - 清理测试端口: npm run test:e2e:cleanup');
console.log('  - 清理开发端口: npm run clean:ports');
