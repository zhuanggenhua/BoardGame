#!/usr/bin/env node

/**
 * 独立测试 Vite - 不通过 npm 运行
 * 
 * 用途：排除 npm/concurrently 的干扰，直接测试 Vite 是否稳定
 */

import { spawn } from 'child_process';

console.log('=== 独立测试 Vite ===');
console.log('启动时间:', new Date().toISOString());
console.log('Node 版本:', process.version);
console.log('工作目录:', process.cwd());

const vite = spawn('node', [
  '--max-old-space-size=4096',
  'node_modules/vite/bin/vite.js',
  '--port', '5173',
  '--host', '0.0.0.0'
], {
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_ENV: 'development',
  },
});

let startTime = Date.now();

vite.on('spawn', () => {
  console.log(`\n[${new Date().toISOString()}] Vite 进程已启动 (PID: ${vite.pid})`);
});

vite.on('exit', (code, signal) => {
  const runtime = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`\n[${new Date().toISOString()}] Vite 进程退出`);
  console.log(`运行时间: ${runtime} 秒`);
  console.log(`退出码: ${code}`);
  console.log(`信号: ${signal}`);
  
  if (code !== 0 && code !== null) {
    console.log('\n❌ 异常退出！');
    console.log('可能的原因:');
    console.log('1. 端口被占用');
    console.log('2. 文件监听器达到上限');
    console.log('3. 内存不足');
    console.log('4. 杀毒软件干扰');
    console.log('5. 其他进程干扰');
  } else {
    console.log('\n✅ 正常退出');
  }
  
  process.exit(code || 0);
});

vite.on('error', (error) => {
  console.error(`\n[${new Date().toISOString()}] Vite 进程错误:`, error.message);
  process.exit(1);
});

// 捕获 Ctrl+C
process.on('SIGINT', () => {
  console.log('\n\n收到 SIGINT，正在关闭 Vite...');
  vite.kill('SIGINT');
});

// 每 10 秒输出一次运行时间
const timer = setInterval(() => {
  const runtime = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`[${new Date().toISOString()}] Vite 运行中... (${runtime} 秒)`);
}, 10000);

vite.on('exit', () => {
  clearInterval(timer);
});
