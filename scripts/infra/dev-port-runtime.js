import fs from 'node:fs';
import path from 'node:path';

const DEV_RUNTIME_PORTS_FILE = process.env.BG_DEV_RUNTIME_PORTS_FILE?.trim()
  || path.join(process.cwd(), '.tmp', 'dev-runtime-ports.json');

function normalizePort(value) {
  const port = Number(value);
  return Number.isFinite(port) && port > 0 ? port : null;
}

function normalizeOwnerPid(value) {
  const pid = Number(value);
  return Number.isInteger(pid) && pid > 0 ? pid : null;
}

function normalizePortsRecord(ports) {
  if (!ports || typeof ports !== 'object') {
    return null;
  }

  const frontend = normalizePort(ports.frontend);
  const gameServer = normalizePort(ports.gameServer);
  const apiServer = normalizePort(ports.apiServer);
  if (!frontend || !gameServer || !apiServer) {
    return null;
  }

  return { frontend, gameServer, apiServer };
}

function readRuntimeDescriptor() {
  try {
    const raw = fs.readFileSync(DEV_RUNTIME_PORTS_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    const ports = normalizePortsRecord(parsed?.ports);
    if (!ports) {
      return null;
    }

    return {
      ports,
      ownerPid: normalizeOwnerPid(parsed?.ownerPid),
      updatedAt: typeof parsed?.updatedAt === 'string' ? parsed.updatedAt : null,
    };
  } catch {
    return null;
  }
}

function isProcessAlive(pid) {
  if (!normalizeOwnerPid(pid)) {
    return false;
  }

  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function createDevRuntimeEnv(ports, extraEnv = {}) {
  const normalized = normalizePortsRecord(ports);
  if (!normalized) {
    throw new Error('开发运行时端口无效，无法生成统一环境');
  }

  return {
    ...extraEnv,
    VITE_DEV_PORT: String(normalized.frontend),
    GAME_SERVER_PORT: String(normalized.gameServer),
    API_SERVER_PORT: String(normalized.apiServer),
    GAME_SERVER_PROXY_TARGET: `http://127.0.0.1:${normalized.gameServer}`,
    API_SERVER_PROXY_TARGET: `http://127.0.0.1:${normalized.apiServer}`,
  };
}

export function saveDevRuntimePorts(ports) {
  const normalized = normalizePortsRecord(ports);
  if (!normalized) {
    throw new Error('开发端口记录无效，无法写入运行时文件');
  }

  fs.mkdirSync(path.dirname(DEV_RUNTIME_PORTS_FILE), { recursive: true });
  fs.writeFileSync(
    DEV_RUNTIME_PORTS_FILE,
    JSON.stringify(
      {
        ports: normalized,
        ownerPid: process.pid,
        updatedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
  );

  return normalized;
}

export function loadDevRuntimePorts(options = {}) {
  const descriptor = readRuntimeDescriptor();
  if (!descriptor) {
    return null;
  }

  const requireLiveOwner = options.requireLiveOwner ?? true;
  if (requireLiveOwner && !isProcessAlive(descriptor.ownerPid)) {
    return null;
  }

  return descriptor.ports;
}

export function removeDevRuntimePorts(options = {}) {
  if (!fs.existsSync(DEV_RUNTIME_PORTS_FILE)) {
    return false;
  }

  const descriptor = readRuntimeDescriptor();
  const force = options.force === true;
  if (
    !force
    && descriptor?.ownerPid
    && descriptor.ownerPid !== process.pid
    && isProcessAlive(descriptor.ownerPid)
  ) {
    return false;
  }

  try {
    fs.unlinkSync(DEV_RUNTIME_PORTS_FILE);
    return true;
  } catch {
    return false;
  }
}
