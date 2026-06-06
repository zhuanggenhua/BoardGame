import { execSync } from 'node:child_process';
import { createServer } from 'node:net';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { E2E_MULTI_WORKER_BASE_PORTS } from './e2e-port-config.js';
import { listActiveRuntimes } from './e2e-runtime-registry.js';
import { withWindowsHide } from './windows-hide.js';

export const BASE_PORTS = {
  ...E2E_MULTI_WORKER_BASE_PORTS,
};

const PORT_OFFSET = 100;
const PORT_SCAN_RANGE = 200;
const RESERVATION_LOCK_TIMEOUT_MS = 10000;
const RESERVATION_LOCK_RETRY_MS = 100;
const RESERVATION_STALE_MS = 30000;
const SHARED_RUNTIME_DIR = 'boardgame-e2e';
const PORT_RESERVATION_DIR = 'port-reservations';
const PORT_RESERVATION_LOCK = 'port-reservations.lock';
const WINDOWS_NETSTAT_CACHE_TTL_MS = 500;

let windowsNetstatCache = {
  lines: null,
  capturedAt: 0,
};

function execHidden(command, options = {}) {
  return execSync(command, withWindowsHide(options));
}

function runGit(command, cwd = process.cwd()) {
  try {
    return execHidden(command, {
      cwd,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return '';
  }
}

function getWorktreeRoot(cwd = process.cwd()) {
  const raw = runGit('git rev-parse --show-toplevel', cwd);
  return raw ? path.resolve(cwd, raw) : path.resolve(cwd);
}

function isGitWorktreeCheckout(cwd = process.cwd()) {
  const gitPath = path.join(getWorktreeRoot(cwd), '.git');
  try {
    return fs.statSync(gitPath).isFile();
  } catch {
    return false;
  }
}

function resolveGitCommonDirCandidate(candidate) {
  if (!candidate) {
    return '';
  }

  try {
    const stats = fs.statSync(candidate);
    if (stats.isDirectory()) {
      return candidate;
    }

    if (!stats.isFile()) {
      return candidate;
    }

    const gitPointer = fs.readFileSync(candidate, 'utf-8').trim();
    const match = gitPointer.match(/^gitdir:\s*(.+)$/i);
    if (!match?.[1]) {
      return candidate;
    }

    const worktreeGitDir = path.resolve(path.dirname(candidate), match[1].trim());
    const commonDirFile = path.join(worktreeGitDir, 'commondir');
    if (fs.existsSync(commonDirFile)) {
      const commonDirRelative = fs.readFileSync(commonDirFile, 'utf-8').trim();
      return path.resolve(worktreeGitDir, commonDirRelative);
    }

    return worktreeGitDir;
  } catch {
    return candidate;
  }
}

function getGitCommonDir(cwd = process.cwd()) {
  const worktreeRoot = getWorktreeRoot(cwd);
  const raw = runGit('git rev-parse --git-common-dir', cwd);
  const candidate = raw ? path.resolve(worktreeRoot, raw) : path.join(worktreeRoot, '.git');
  return resolveGitCommonDirCandidate(candidate);
}

function getRuntimeScope(scope = process.env.PW_RUNTIME_SCOPE) {
  const normalized = String(scope ?? 'default').trim().replace(/[^a-zA-Z0-9_-]/g, '_');
  return normalized || 'default';
}

function getWorkerPortFilePath(workerId, scope = process.env.PW_RUNTIME_SCOPE) {
  return path.join(process.cwd(), '.tmp', `worker-${getRuntimeScope(scope)}-${workerId}-ports.json`);
}

function getSharedReservationDir(cwd = process.cwd()) {
  if (isGitWorktreeCheckout(cwd)) {
    const worktreeFallback = path.join(getWorktreeRoot(cwd), '.tmp', SHARED_RUNTIME_DIR, PORT_RESERVATION_DIR);
    fs.mkdirSync(worktreeFallback, { recursive: true });
    return worktreeFallback;
  }

  const sharedRuntimeDir = (() => {
    const commonDir = getGitCommonDir(cwd);
    const sharedDir = path.join(commonDir, SHARED_RUNTIME_DIR);

    try {
      fs.mkdirSync(sharedDir, { recursive: true });
      return sharedDir;
    } catch {
      const worktreeFallback = path.join(getWorktreeRoot(cwd), '.tmp', SHARED_RUNTIME_DIR);
      fs.mkdirSync(worktreeFallback, { recursive: true });
      return worktreeFallback;
    }
  })();

  return path.join(sharedRuntimeDir, PORT_RESERVATION_DIR);
}

function getReservationLockPath(cwd = process.cwd()) {
  return path.join(getSharedReservationDir(cwd), PORT_RESERVATION_LOCK);
}

function getReservationFilePath(workerId, scope = process.env.PW_RUNTIME_SCOPE, cwd = process.cwd()) {
  return path.join(getSharedReservationDir(cwd), `${getRuntimeScope(scope)}-worker-${workerId}.json`);
}

function clearWindowsNetstatCache() {
  windowsNetstatCache = {
    lines: null,
    capturedAt: 0,
  };
}

function getWindowsNetstatLines() {
  if (
    Array.isArray(windowsNetstatCache.lines)
    && (Date.now() - windowsNetstatCache.capturedAt) <= WINDOWS_NETSTAT_CACHE_TTL_MS
  ) {
    return windowsNetstatCache.lines;
  }

  try {
    const result = execHidden('netstat -ano -p tcp', { encoding: 'utf-8' });
    const lines = result.split(/\r?\n/).filter(Boolean);
    windowsNetstatCache = {
      lines,
      capturedAt: Date.now(),
    };
    return lines;
  } catch {
    windowsNetstatCache = {
      lines: [],
      capturedAt: Date.now(),
    };
    return windowsNetstatCache.lines;
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

function isPidAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) {
    return false;
  }

  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code === 'EPERM';
  }
}

function ensureSharedReservationDir(cwd = process.cwd()) {
  fs.mkdirSync(getSharedReservationDir(cwd), { recursive: true });
}

function flattenPorts(ports) {
  return normalizePortsInput(ports)
    .map(port => Number(port))
    .filter(Number.isFinite);
}

function readReservation(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return null;
  }
}

function listReservationFiles(cwd = process.cwd()) {
  const reservationDir = getSharedReservationDir(cwd);
  if (!fs.existsSync(reservationDir)) {
    return [];
  }

  return fs.readdirSync(reservationDir)
    .filter(file => file.endsWith('.json'))
    .map(file => path.join(reservationDir, file));
}

function isReservationStale(reservation) {
  const ownerPid = Number(reservation?.ownerPid);
  if (!Number.isInteger(ownerPid) || ownerPid <= 0) {
    return true;
  }

  return !isPidAlive(ownerPid);
}

function pruneStaleReservations(cwd = process.cwd()) {
  for (const filePath of listReservationFiles(cwd)) {
    const reservation = readReservation(filePath);
    if (!reservation || isReservationStale(reservation)) {
      try {
        fs.unlinkSync(filePath);
      } catch {
        // ignore
      }
    }
  }
}

function listActiveReservations(cwd = process.cwd()) {
  pruneStaleReservations(cwd);

  return listReservationFiles(cwd)
    .map(filePath => readReservation(filePath))
    .filter(Boolean);
}

function getReservedPortSet(cwd = process.cwd(), options = {}) {
  const ignoreScope = options.ignoreScope ? getRuntimeScope(options.ignoreScope) : null;
  const ignoreWorkerId = Number.isInteger(options.ignoreWorkerId) ? options.ignoreWorkerId : null;
  const reservations = listActiveReservations(cwd);
  const ports = new Set();

  for (const reservation of reservations) {
    const sameReservation = (
      ignoreScope !== null
      && reservation.scope === ignoreScope
      && ignoreWorkerId !== null
      && Number(reservation.workerId) === ignoreWorkerId
    );
    if (sameReservation) {
      continue;
    }

    for (const port of flattenPorts(reservation.ports)) {
      ports.add(port);
    }
  }

  return ports;
}

function getRuntimeReservedPortSet(cwd = process.cwd(), options = {}) {
  const ignoreScope = options.ignoreScope ? getRuntimeScope(options.ignoreScope) : null;
  const ports = new Set();
  const activeRuntimes = listActiveRuntimes(cwd);

  for (const runtime of activeRuntimes) {
    if (ignoreScope !== null && runtime.scope === ignoreScope) {
      continue;
    }

    for (const port of flattenPorts(runtime.ports)) {
      ports.add(port);
    }
  }

  return ports;
}

async function acquireReservationLock(cwd = process.cwd()) {
  const lockPath = getReservationLockPath(cwd);
  ensureSharedReservationDir(cwd);
  const startedAt = Date.now();

  while (Date.now() - startedAt < RESERVATION_LOCK_TIMEOUT_MS) {
    try {
      const fd = fs.openSync(lockPath, 'wx');
      fs.writeFileSync(fd, JSON.stringify({
        ownerPid: process.pid,
        createdAt: new Date().toISOString(),
      }, null, 2));

      return () => {
        try {
          fs.closeSync(fd);
        } catch {
          // ignore
        }
        try {
          fs.unlinkSync(lockPath);
        } catch {
          // ignore
        }
      };
    } catch (error) {
      if (error?.code !== 'EEXIST') {
        throw error;
      }

      try {
        const stats = fs.statSync(lockPath);
        if (Date.now() - stats.mtimeMs > RESERVATION_STALE_MS) {
          fs.unlinkSync(lockPath);
          continue;
        }
      } catch {
        continue;
      }

      await new Promise(resolve => setTimeout(resolve, RESERVATION_LOCK_RETRY_MS));
    }
  }

  throw new Error(`获取 E2E 端口保留锁超时: ${lockPath}`);
}

async function withReservationLock(fn, cwd = process.cwd()) {
  const release = await acquireReservationLock(cwd);
  try {
    return await fn();
  } finally {
    release();
  }
}

export async function canBindPort(port, host = '0.0.0.0') {
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
      clearWindowsNetstatCache();
      return parseWindowsPortPids(port).length > 0;
    }

    const result = execHidden(`lsof -ti:${port}`, { encoding: 'utf-8' });
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

export async function findAvailablePort(startPort, options = {}) {
  const reservedPorts = options.reservedPorts ?? new Set();
  const scanRange = Number(options.range);
  const maxRange = Number.isFinite(scanRange) && scanRange > 0 ? scanRange : PORT_SCAN_RANGE;
  const host = options.host ?? '0.0.0.0';

  for (let port = startPort; port < startPort + maxRange; port++) {
    if (reservedPorts.has(port)) {
      continue;
    }
    // Windows 上某些 127.0.0.1 监听端口仍可能被 createServer(...exclusive) 误判为可绑定；
    // 端口扫描阶段额外跳过 netstat 已在监听的端口，避免 isolated runtime 又抢回共享固定端口。
    if (isPortInUse(port)) {
      continue;
    }
    if (await canBindPort(port, host)) {
      return port;
    }
  }

  throw new Error(`未找到可绑定端口，起始端口 ${startPort}，扫描范围 ${maxRange}`);
}

export async function allocateAvailablePorts(workerId, options = {}) {
  const preferred = allocatePorts(workerId);
  const reservedPorts = new Set([
    ...getReservedPortSet(process.cwd(), options),
    ...getRuntimeReservedPortSet(process.cwd(), options),
  ]);
  return {
    frontend: await findAvailablePort(preferred.frontend, { reservedPorts }),
    gameServer: await findAvailablePort(preferred.gameServer, { reservedPorts }),
    apiServer: await findAvailablePort(preferred.apiServer, { reservedPorts }),
  };
}

export async function allocateAvailablePortSet(preferredPorts, options = {}) {
  const reservedPorts = new Set([
    ...getReservedPortSet(process.cwd(), options),
    ...getRuntimeReservedPortSet(process.cwd(), options),
  ]);
  return {
    frontend: await findAvailablePort(Number(preferredPorts.frontend), { reservedPorts }),
    gameServer: await findAvailablePort(Number(preferredPorts.gameServer), { reservedPorts }),
    apiServer: await findAvailablePort(Number(preferredPorts.apiServer), { reservedPorts }),
  };
}

export async function reservePorts(workerId, ports, options = {}) {
  const cwd = options.cwd ?? process.cwd();
  const scope = getRuntimeScope(options.scope);
  const ownerPid = Number(options.ownerPid ?? process.pid);
  const worktreeRoot = getWorktreeRoot(cwd);

  return await withReservationLock(async () => {
    pruneStaleReservations(cwd);

    const reservedPorts = getReservedPortSet(cwd, {
      ignoreScope: scope,
      ignoreWorkerId: workerId,
    });
    const requestedPorts = flattenPorts(ports);
    const conflicts = requestedPorts.filter(port => reservedPorts.has(port));
    if (conflicts.length > 0) {
      throw new Error(`E2E 端口已被其他 worktree/runtime 保留: ${conflicts.join(', ')}`);
    }

    const bindable = await arePortsBindable(ports);
    if (!bindable) {
      throw new Error(`E2E 端口当前不可绑定: ${requestedPorts.join(', ')}`);
    }

    const filePath = getReservationFilePath(workerId, scope, cwd);
    const record = {
      scope,
      workerId,
      ownerPid,
      ports,
      target: options.target ?? '',
      worktreeRoot,
      worktreeName: path.basename(worktreeRoot),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    ensureSharedReservationDir(cwd);
    fs.writeFileSync(filePath, JSON.stringify(record, null, 2));
    return ports;
  }, cwd);
}

export async function reserveAvailablePorts(workerId, options = {}) {
  const cwd = options.cwd ?? process.cwd();
  const scope = getRuntimeScope(options.scope);

  return await withReservationLock(async () => {
    pruneStaleReservations(cwd);
    const reservedPorts = new Set([
      ...getReservedPortSet(cwd, {
        ignoreScope: scope,
        ignoreWorkerId: workerId,
      }),
      ...getRuntimeReservedPortSet(cwd, {
        ignoreScope: scope,
      }),
    ]);
    const preferred = allocatePorts(workerId);
    const ports = {
      frontend: await findAvailablePort(preferred.frontend, { reservedPorts }),
      gameServer: await findAvailablePort(preferred.gameServer, { reservedPorts }),
      apiServer: await findAvailablePort(preferred.apiServer, { reservedPorts }),
    };

    const filePath = getReservationFilePath(workerId, scope, cwd);
    const worktreeRoot = getWorktreeRoot(cwd);
    const record = {
      scope,
      workerId,
      ownerPid: Number(options.ownerPid ?? process.pid),
      ports,
      target: options.target ?? '',
      worktreeRoot,
      worktreeName: path.basename(worktreeRoot),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    ensureSharedReservationDir(cwd);
    fs.writeFileSync(filePath, JSON.stringify(record, null, 2));
    return ports;
  }, cwd);
}

export function releaseReservedPorts(workerId, scope = process.env.PW_RUNTIME_SCOPE, cwd = process.cwd()) {
  const filePath = getReservationFilePath(workerId, scope, cwd);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

export function releaseReservedPortsForScope(scope = process.env.PW_RUNTIME_SCOPE, cwd = process.cwd()) {
  const normalizedScope = getRuntimeScope(scope);
  for (const filePath of listReservationFiles(cwd)) {
    const reservation = readReservation(filePath);
    if (reservation?.scope === normalizedScope) {
      try {
        fs.unlinkSync(filePath);
      } catch {
        // ignore
      }
    }
  }
}

export function getPortPids(port) {
  try {
    if (process.platform === 'win32') {
      return parseWindowsPortPids(port);
    }

    const result = execHidden(`lsof -ti:${port}`, { encoding: 'utf-8' });
    return result.trim().split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

export function killProcess(pid) {
  try {
    if (process.platform === 'win32') {
      execHidden(`taskkill /F /T /PID ${pid}`, { stdio: 'ignore' });
    } else {
      execHidden(`kill -9 ${pid}`, { stdio: 'ignore' });
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

  const filePath = getWorkerPortFilePath(workerId);
  fs.writeFileSync(filePath, JSON.stringify({ workerId, ports, pid: process.pid }, null, 2));
}

export function loadWorkerPorts(workerId) {
  const filePath = getWorkerPortFilePath(workerId);
  try {
    const data = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(data).ports;
  } catch {
    return null;
  }
}

export function removeWorkerPortFile(workerId) {
  const filePath = getWorkerPortFilePath(workerId);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

export function cleanupWorkerPorts(workerId) {
  const ports = loadWorkerPorts(workerId) ?? allocatePorts(workerId);
  cleanupPorts(ports, `Worker ${workerId}`);
  releaseReservedPorts(workerId);
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

  const scopePrefix = `worker-${getRuntimeScope()}-`;
  for (const file of fs.readdirSync(tmpDir)) {
    if (file.startsWith(scopePrefix) && file.endsWith('-ports.json')) {
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
