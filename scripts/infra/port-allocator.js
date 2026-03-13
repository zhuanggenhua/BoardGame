import { execSync } from 'node:child_process';
import { createServer } from 'node:net';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { E2E_MULTI_WORKER_BASE_PORTS } from './e2e-port-config.js';

export const BASE_PORTS = {
  ...E2E_MULTI_WORKER_BASE_PORTS,
};

const PORT_OFFSET = 100;
const PORT_SCAN_RANGE = 20;

function getWindowsNetstatLines() {
  try {
    const result = execSync('netstat -ano -p tcp', { encoding: 'utf-8' });
    return result.split(/\r?\n/).filter(Boolean);
  } catch {
    return [];
  }
}

function parseWindowsPortPids(port) {
  const portPattern = new RegExp(`^\\s*TCP\\s+\\S+:${port}\\s+\\S+\\s+LISTENING\\s+(\\d+)\\s*$`, 'i');
  const pids = new Set();

  for (const line of getWindowsNetstatLines()) {
    const match = line.match(portPattern);
    if (match?.[1] && match[1] !== '0') {
      pids.add(match[1]);
    }
  }

  return Array.from(pids);
}

function normalizePortsInput(ports) {
  if (Array.isArray(ports)) {
    return ports;
  }

  if (ports && typeof ports === 'object') {
    return Object.values(ports);
  }

  return [];
}

async function canBindPort(port, host = '0.0.0.0') {
  return await new Promise(resolve => {
    const server = createServer();
    let settled = false;

    const finalize = result => {
      if (settled) {
        return;
      }

      settled = true;
      server.removeAllListeners();

      try {
        server.close(() => resolve(result));
      } catch {
        resolve(result);
      }
    };

    server.once('error', () => finalize(false));
    server.once('listening', () => finalize(true));
    server.listen({ port, host, exclusive: true });
  });
}

export function allocatePorts(workerId) {
  const offset = workerId * PORT_OFFSET;
  return {
    frontend: BASE_PORTS.frontend + offset,
    gameServer: BASE_PORTS.gameServer + offset,
    apiServer: BASE_PORTS.apiServer + offset,
  };
}

export function isPortInUse(port) {
  try {
    if (process.platform === 'win32') {
      return parseWindowsPortPids(port).length > 0;
    }

    const result = execSync(`lsof -ti:${port}`, { encoding: 'utf-8' });
    return result.trim().length > 0;
  } catch {
    return false;
  }
}

export async function arePortsBindable(ports) {
  const values = normalizePortsInput(ports);
  const results = await Promise.all(values.map(port => canBindPort(Number(port))));
  return results.every(Boolean);
}

async function findAvailablePort(startPort) {
  for (let port = startPort; port < startPort + PORT_SCAN_RANGE; port++) {
    if (await canBindPort(port)) {
      return port;
    }
  }

  throw new Error(`未找到可绑定端口，起始端口 ${startPort}，扫描范围 ${PORT_SCAN_RANGE}`);
}

export async function allocateAvailablePorts(workerId) {
  const preferred = allocatePorts(workerId);
  return {
    frontend: await findAvailablePort(preferred.frontend),
    gameServer: await findAvailablePort(preferred.gameServer),
    apiServer: await findAvailablePort(preferred.apiServer),
  };
}

export function getPortPids(port) {
  try {
    if (process.platform === 'win32') {
      return parseWindowsPortPids(port);
    }

    const result = execSync(`lsof -ti:${port}`, { encoding: 'utf-8' });
    return result.trim().split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

export function killProcess(pid) {
  try {
    if (process.platform === 'win32') {
      execSync(`taskkill /F /T /PID ${pid}`, { stdio: 'ignore' });
    } else {
      execSync(`kill -9 ${pid}`, { stdio: 'ignore' });
    }

    return true;
  } catch {
    return false;
  }
}

export function cleanupPorts(ports, label = 'Ports') {
  const allPorts = [...new Set(normalizePortsInput(ports).map(port => Number(port)).filter(Number.isFinite))];

  console.log(`[${label}] 清理端口: ${allPorts.join(', ')}`);

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

export function saveWorkerPorts(workerId, ports) {
  const tmpDir = path.join(process.cwd(), '.tmp');
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, { recursive: true });
  }

  const filePath = path.join(tmpDir, `worker-${workerId}-ports.json`);
  fs.writeFileSync(filePath, JSON.stringify({ workerId, ports, pid: process.pid }, null, 2));
}

export function loadWorkerPorts(workerId) {
  const filePath = path.join(process.cwd(), '.tmp', `worker-${workerId}-ports.json`);
  try {
    const data = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(data).ports;
  } catch {
    return null;
  }
}

export function removeWorkerPortFile(workerId) {
  const filePath = path.join(process.cwd(), '.tmp', `worker-${workerId}-ports.json`);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

export function cleanupWorkerPorts(workerId) {
  const ports = loadWorkerPorts(workerId) ?? allocatePorts(workerId);
  cleanupPorts(ports, `Worker ${workerId}`);
}

export async function waitForPortFree(port, timeoutMs = 5000) {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    if (await canBindPort(Number(port))) {
      return true;
    }

    await new Promise(resolve => setTimeout(resolve, 100));
  }

  return false;
}

export async function waitForPortsFree(ports, timeoutMs = 5000) {
  const allPorts = [...new Set(normalizePortsInput(ports).map(port => Number(port)).filter(Number.isFinite))];
  const results = await Promise.all(allPorts.map(port => waitForPortFree(port, timeoutMs)));
  return results.every(Boolean);
}

export function cleanupAllWorkerPortFiles() {
  const tmpDir = path.join(process.cwd(), '.tmp');
  if (!fs.existsSync(tmpDir)) {
    return;
  }

  for (const file of fs.readdirSync(tmpDir)) {
    if (file.startsWith('worker-') && file.endsWith('-ports.json')) {
      fs.unlinkSync(path.join(tmpDir, file));
    }
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const workerId = Number.parseInt(process.argv[2] ?? '', 10);
  if (Number.isNaN(workerId)) {
    console.error('用法: node port-allocator.js <workerId>');
    process.exit(1);
  }

  cleanupWorkerPorts(workerId);
  removeWorkerPortFile(workerId);
  console.log(`\n✅ Worker ${workerId} 端口清理完成`);
}
