/**
 * 动态端口分配器 - 支持并行测试
 * 
 * 为每个 worker 分配独立的端口范围，避免冲突
 * 测试结束后自动清理该 worker 的端口
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

// 基础端口配置
const BASE_PORTS = {
  frontend: 3000,
  gameServer: 18000,
  apiServer: 18001,
};

// 每个 worker 的端口偏移量（支持最多 10 个并行 worker）
const PORT_OFFSET = 100;

/**
 * 为指定 worker 分配端口
 * @param {number} workerId - Worker ID (0-based)
 * @returns {{ frontend: number, gameServer: number, apiServer: number }}
 */
export function allocatePorts(workerId) {
  const offset = workerId * PORT_OFFSET;
  return {
    frontend: BASE_PORTS.frontend + offset,
    gameServer: BASE_PORTS.gameServer + offset,
    apiServer: BASE_PORTS.apiServer + offset,
  };
}

/**
 * 检查端口是否被占用
 * @param {number} port
 * @returns {boolean}
 */
export function isPortInUse(port) {
  try {
    if (process.platform === 'win32') {
      const result = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf-8' });
      return result.trim().length > 0;
    } else {
      const result = execSync(`lsof -ti:${port}`, { encoding: 'utf-8' });
      return result.trim().length > 0;
    }
  } catch {
    return false;
  }
}

/**
 * 获取占用指定端口的进程 PID 列表
 * @param {number} port
 * @returns {string[]}
 */
export function getPortPids(port) {
  try {
    if (process.platform === 'win32') {
      const result = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf-8' });
      const pids = new Set();
      const lines = result.trim().split('\n');
      for (const line of lines) {
        const match = line.match(/\s+(\d+)\s*$/);
        if (match) pids.add(match[1]);
      }
      return Array.from(pids);
    } else {
      const result = execSync(`lsof -ti:${port}`, { encoding: 'utf-8' });
      return result.trim().split('\n').filter(Boolean);
    }
  } catch {
    return [];
  }
}

/**
 * 终止指定 PID 的进程
 * @param {string} pid
 * @returns {boolean} 是否成功
 */
export function killProcess(pid) {
  try {
    if (process.platform === 'win32') {
      execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' });
    } else {
      execSync(`kill -9 ${pid}`, { stdio: 'ignore' });
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * 清理指定 worker 的所有端口
 * @param {number} workerId
 */
export function cleanupWorkerPorts(workerId) {
  const ports = allocatePorts(workerId);
  const allPorts = Object.values(ports);
  
  console.log(`[Worker ${workerId}] 清理端口: ${allPorts.join(', ')}`);
  
  for (const port of allPorts) {
    const pids = getPortPids(port);
    if (pids.length === 0) {
      console.log(`  端口 ${port}: 未被占用`);
      continue;
    }
    
    console.log(`  端口 ${port}: 发现 ${pids.length} 个进程`);
    for (const pid of pids) {
      const success = killProcess(pid);
      console.log(`    PID ${pid}: ${success ? '已终止' : '终止失败'}`);
    }
  }
}

/**
 * 等待端口释放
 * @param {number} port
 * @param {number} timeoutMs
 * @returns {Promise<boolean>}
 */
export async function waitForPortFree(port, timeoutMs = 5000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (!isPortInUse(port)) return true;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  return false;
}

/**
 * 保存 worker 端口信息到临时文件（用于测试间共享）
 * @param {number} workerId
 * @param {{ frontend: number, gameServer: number, apiServer: number }} ports
 */
export function saveWorkerPorts(workerId, ports) {
  const tmpDir = path.join(process.cwd(), '.tmp');
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, { recursive: true });
  }
  
  const filePath = path.join(tmpDir, `worker-${workerId}-ports.json`);
  fs.writeFileSync(filePath, JSON.stringify({ workerId, ports, pid: process.pid }, null, 2));
}

/**
 * 读取 worker 端口信息
 * @param {number} workerId
 * @returns {{ frontend: number, gameServer: number, apiServer: number } | null}
 */
export function loadWorkerPorts(workerId) {
  const filePath = path.join(process.cwd(), '.tmp', `worker-${workerId}-ports.json`);
  try {
    const data = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(data).ports;
  } catch {
    return null;
  }
}

/**
 * 清理所有 worker 端口信息文件
 */
export function cleanupAllWorkerPortFiles() {
  const tmpDir = path.join(process.cwd(), '.tmp');
  if (!fs.existsSync(tmpDir)) return;
  
  const files = fs.readdirSync(tmpDir);
  for (const file of files) {
    if (file.startsWith('worker-') && file.endsWith('-ports.json')) {
      fs.unlinkSync(path.join(tmpDir, file));
    }
  }
}

// CLI 模式：清理指定 worker 的端口
if (import.meta.url === `file://${process.argv[1]}`) {
  const workerId = parseInt(process.argv[2]);
  if (isNaN(workerId)) {
    console.error('用法: node port-allocator.js <workerId>');
    process.exit(1);
  }
  
  cleanupWorkerPorts(workerId);
  console.log(`\n✅ Worker ${workerId} 端口清理完成`);
}
