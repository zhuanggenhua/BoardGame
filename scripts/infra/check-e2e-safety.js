/**
 * E2E 测试安全检查
 * 
 * 验证测试环境与开发环境完全隔离
 */

import { execSync } from 'child_process';

// 开发环境端口
const DEV_PORTS = {
  frontend: 3000,
  gameServer: 18000,
  apiServer: 18001,
};

// E2E 测试环境端口（完全隔离）
const E2E_PORTS = {
  frontend: 5173,
  gameServer: 19000,
  apiServer: 19001,
};

console.log('🔍 E2E 测试环境检查...\n');

// 检查环境变量
const useDevServers = process.env.PW_USE_DEV_SERVERS === 'true';
console.log(`测试模式: ${useDevServers ? '⚠️  使用开发服务器（不推荐）' : '✅ 独立测试环境（推荐）'}`);

if (useDevServers) {
  console.log('\n⚠️  警告：检测到 PW_USE_DEV_SERVERS=true');
  console.log('   这会导致测试使用开发服务器而不是独立测试环境');
  console.log('   测试会连接到开发环境的服务器（3000/18000/18001）');
  console.log('\n   清除方法：');
  console.log('   - PowerShell: $env:PW_USE_DEV_SERVERS = $null');
  console.log('   - Bash: unset PW_USE_DEV_SERVERS');
  console.log('   - 或运行: npx cross-env PW_USE_DEV_SERVERS=false npm run test:e2e\n');
} else {
  console.log(`\n✅ 测试环境完全隔离`);
  console.log(`   测试端口: ${E2E_PORTS.frontend}, ${E2E_PORTS.gameServer}, ${E2E_PORTS.apiServer}`);
  console.log(`   开发端口: ${DEV_PORTS.frontend}, ${DEV_PORTS.gameServer}, ${DEV_PORTS.apiServer}`);
  console.log(`   → 测试不会影响开发环境\n`);
}

// 检查端口占用情况
const checkPort = (port) => {
  try {
    let result;
    if (process.platform === 'win32') {
      result = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf-8' });
    } else {
      result = execSync(`lsof -ti:${port}`, { encoding: 'utf-8' });
    }
    return result.trim().length > 0;
  } catch {
    return false;
  }
};

console.log('开发环境端口占用:');
let devServersRunning = 0;
for (const [name, port] of Object.entries(DEV_PORTS)) {
  const occupied = checkPort(port);
  console.log(`  ${occupied ? '✓' : '○'} ${name} (${port}): ${occupied ? '已占用' : '空闲'}`);
  if (occupied) devServersRunning++;
}

console.log('\nE2E 测试环境端口占用:');
let e2eServersRunning = 0;
for (const [name, port] of Object.entries(E2E_PORTS)) {
  const occupied = checkPort(port);
  console.log(`  ${occupied ? '✓' : '○'} ${name} (${port}): ${occupied ? '已占用' : '空闲'}`);
  if (occupied) e2eServersRunning++;
}

// 给出建议
console.log('\n状态分析:');
if (!useDevServers) {
  console.log('  ✅ 完全隔离模式');
  console.log(`  → 开发环境: ${devServersRunning}/3 服务运行中`);
  console.log(`  → 测试环境: ${e2eServersRunning}/3 服务运行中`);
  if (e2eServersRunning === 0) {
    console.log('  → Playwright 会自动启动测试服务器');
  } else if (e2eServersRunning === 3) {
    console.log('  → Playwright 会复用已有测试服务器');
  } else {
    console.log('  ⚠️  部分测试端口被占用，可能需要清理');
  }
  console.log('  → 测试不会影响开发环境 ✓');
} else {
  console.log('  ⚠️  使用开发服务器模式');
  if (devServersRunning === 3) {
    console.log('  → 测试会连接到开发服务器');
    console.log('  → 可能影响开发环境');
  } else {
    console.log('  → 开发服务器未完全启动');
    console.log('  → 测试可能失败');
  }
}

console.log('\n✅ 检查完成\n');
console.log('提示:');
console.log('  - 推荐使用完全隔离模式（默认）');
console.log('  - 清理测试端口: npm run test:e2e:cleanup');
console.log('  - 清理开发端口: 手动停止 npm run dev\n');
