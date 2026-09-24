#!/usr/bin/env node

import { createServer, request as httpRequest } from "node:http";
import {
  closeSync,
  createReadStream,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";

const TOOL_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(TOOL_DIR, "..", "..");
const WEB_DIR = path.join(TOOL_DIR, "web");
const EVIDENCE_ROOT = path.join(PROJECT_ROOT, "test-results", "evidence-screenshots");
const STATE_PATH = path.join(PROJECT_ROOT, "test-results", "evidence-screenshots", ".e2e-image-viewer-state.json");
const LOG_PATH = path.join(PROJECT_ROOT, "logs", "e2e-image-viewer.log");
const APP_NAME = "boardgame-e2e-image-viewer";
const DEFAULT_PORT = 4867;
const MAX_MEDIA_FILES = 1500;
const MAX_INDEX_FILES = 80;
const MAX_KEY_LOOKUP_DIRECTORIES = 20000;
const OFFLINE_VIEWER_FILE_NAME = "index.html";
const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp", ".avif"]);
const VIDEO_EXTENSIONS = new Set([".mp4", ".webm", ".mov", ".m4v", ".mkv"]);
const MEDIA_EXTENSIONS = new Set([...IMAGE_EXTENSIONS, ...VIDEO_EXTENSIONS]);
const MIME_TYPES = new Map([
  [".html", "text/html; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".webp", "image/webp"],
  [".gif", "image/gif"],
  [".bmp", "image/bmp"],
  [".avif", "image/avif"],
  [".mp4", "video/mp4"],
  [".webm", "video/webm"],
  [".mov", "video/quicktime"],
  [".m4v", "video/x-m4v"],
  [".mkv", "video/x-matroska"],
]);

const instanceId = randomUUID();
const startedAt = new Date().toISOString();

const usage = () => {
  console.log(`用法:
  node .tools/e2e-image-viewer/server.mjs --dir <端到端证据目录>
  node .tools/e2e-image-viewer/server.mjs --dir <端到端证据目录> --no-open
  node .tools/e2e-image-viewer/server.mjs --dir <端到端证据目录> --reopen

选项:
  --dir <目录>       要查看的证据目录，必须在当前仓库内
  --focus <文件>     打开后定位到目录内的指定图片 / 视频
  --files <文件...>  只展示这些目录内的图片 / 视频；用于 PASS 后精确交付
  --port <端口>      本地查看器端口，默认 ${DEFAULT_PORT}
  --no-open          只启动 / 注册目录，不打开浏览器
  --reopen           即使该目录已打开过，也重新打开浏览器
  --status           查看指定端口上的查看器状态
  --stop             停止指定端口上的查看器服务
  --serve            内部参数：启动 HTTP 服务
  --help             显示帮助
`);
};

const parseArgs = (argv) => {
  const parsed = {
    dir: null,
    port: DEFAULT_PORT,
    noOpen: false,
    reopen: false,
    focus: null,
    files: [],
    serve: false,
    status: false,
    stop: false,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    if (current === "--help" || current === "-h") {
      parsed.help = true;
      continue;
    }
    if (current === "--serve") {
      parsed.serve = true;
      continue;
    }
    if (current === "--status") {
      parsed.status = true;
      continue;
    }
    if (current === "--stop") {
      parsed.stop = true;
      continue;
    }
    if (current === "--no-open") {
      parsed.noOpen = true;
      continue;
    }
    if (current === "--reopen" || current === "--force-reopen") {
      parsed.reopen = true;
      continue;
    }
    if (current === "--dir") {
      const value = argv[index + 1];
      if (!value) throw new Error("--dir 缺少取值");
      parsed.dir = value;
      index += 1;
      continue;
    }
    if (current === "--focus") {
      const value = argv[index + 1];
      if (!value) throw new Error("--focus 缺少取值");
      parsed.focus = value;
      index += 1;
      continue;
    }
    if (current === "--files") {
      while (argv[index + 1] && !argv[index + 1].startsWith("--")) {
        parsed.files.push(argv[index + 1]);
        index += 1;
      }
      if (parsed.files.length === 0) throw new Error("--files 缺少取值");
      continue;
    }
    if (current === "--port") {
      const value = Number(argv[index + 1]);
      if (!Number.isInteger(value) || value < 1 || value > 65535) {
        throw new Error("--port 必须是 1-65535 的整数");
      }
      parsed.port = value;
      index += 1;
      continue;
    }
    if (!parsed.dir) {
      parsed.dir = current;
      continue;
    }
    throw new Error(`无法识别的参数: ${current}`);
  }

  if (!parsed.dir && process.env.npm_config_dir) {
    parsed.dir = process.env.npm_config_dir;
  }
  if (!parsed.noOpen && (process.env.npm_config_no_open === "true" || process.env.npm_config_open === "false")) {
    parsed.noOpen = true;
  }
  if (!parsed.reopen && (process.env.npm_config_reopen === "true" || process.env.npm_config_force_reopen === "true")) {
    parsed.reopen = true;
  }
  if (parsed.port === DEFAULT_PORT && process.env.npm_config_port) {
    const value = Number(process.env.npm_config_port);
    if (Number.isInteger(value) && value >= 1 && value <= 65535) {
      parsed.port = value;
    }
  }
  if (!parsed.focus && process.env.npm_config_focus) {
    parsed.focus = process.env.npm_config_focus;
  }
  if ((parsed.status || parsed.stop) && parsed.dir) {
    throw new Error("--status/--stop 不需要 --dir");
  }
  if ((parsed.status || parsed.stop) && parsed.serve) {
    throw new Error("--status/--stop 不能和 --serve 同时使用");
  }

  return parsed;
};

const jsonResponse = (res, statusCode, payload) => {
  const body = JSON.stringify(payload, null, 2);
  res.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  res.end(body);
};

const textResponse = (res, statusCode, message) => {
  res.writeHead(statusCode, {
    "content-type": "text/plain; charset=utf-8",
    "cache-control": "no-store",
  });
  res.end(message);
};

const readJsonBody = async (req) => {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
};

const readState = () => {
  if (!existsSync(STATE_PATH)) return { version: 1, directories: {} };
  try {
    return JSON.parse(readFileSync(STATE_PATH, "utf8"));
  } catch {
    return { version: 1, directories: {} };
  }
};

const writeState = (nextState) => {
  mkdirSync(path.dirname(STATE_PATH), { recursive: true });
  writeFileSync(STATE_PATH, JSON.stringify(nextState, null, 2), "utf8");
};

const isProcessAlive = (pid) => {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

const serverStateFor = (port) => ({
  app: APP_NAME,
  projectRoot: PROJECT_ROOT,
  port,
  pid: process.pid,
  instanceId,
  startedAt,
  updatedAt: new Date().toISOString(),
});

const clearServerState = ({ port = null, pid = null, instanceId: expectedInstanceId = null } = {}) => {
  const state = readState();
  const server = state.server;
  if (!server) return false;
  if (port !== null && server.port !== port) return false;
  if (
    pid !== null
    && server.pid !== pid
    && server.instanceId !== expectedInstanceId
    && isProcessAlive(server.pid)
  ) return false;
  if (
    expectedInstanceId !== null
    && server.instanceId !== expectedInstanceId
    && server.pid !== pid
    && isProcessAlive(server.pid)
  ) return false;

  const nextState = { ...state };
  delete nextState.server;
  writeState({
    ...nextState,
    version: 1,
    directories: state.directories ?? {},
  });
  return true;
};

const directoryKey = (dirPath) => realpathSync.native(dirPath).toLowerCase();

const directoryId = (dirPath) => createHash("sha1").update(directoryKey(dirPath)).digest("hex").slice(0, 12);

const comparablePathKey = (targetPath) => path.normalize(path.resolve(targetPath)).toLowerCase();

const comparableDirectoryKeys = (dirPath) => {
  const keys = new Set([comparablePathKey(dirPath)]);
  if (existsSync(dirPath)) {
    try {
      keys.add(directoryKey(dirPath));
    } catch {
      // A stale index path must not break the current screenshot directory.
    }
  }
  return keys;
};

const sharesAnyKey = (left, right) => {
  for (const key of left) {
    if (right.has(key)) return true;
  }
  return false;
};

const isPathInside = (parent, child) => {
  const relative = path.relative(parent, child);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
};

const assertInsideProject = (targetPath) => {
  const relative = path.relative(PROJECT_ROOT, targetPath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`目录不在当前仓库内: ${targetPath}`);
  }
};

const resolveDirectory = (input) => {
  if (!input || typeof input !== "string") {
    throw new Error("缺少证据目录");
  }
  const resolved = path.resolve(PROJECT_ROOT, input);
  if (!existsSync(resolved)) {
    throw new Error(`证据目录不存在: ${resolved}`);
  }
  const real = realpathSync.native(resolved);
  assertInsideProject(real);
  const stats = statSync(real);
  if (!stats.isDirectory()) {
    throw new Error(`目标不是目录: ${real}`);
  }
  return real;
};

const resolveFocusFile = (dirPath, focus) => {
  if (!focus || typeof focus !== "string") return null;
  const target = path.isAbsolute(focus) ? focus : path.resolve(dirPath, focus);
  const real = realpathSync.native(target);
  const relative = path.relative(dirPath, real);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`焦点文件不在截图目录内: ${focus}`);
  }
  if (relative.includes(path.sep)) {
    throw new Error(`焦点文件必须是当前截图目录的直接文件: ${focus}`);
  }
  if (!statSync(real).isFile() || !MEDIA_EXTENSIONS.has(path.extname(real).toLowerCase())) {
    throw new Error(`焦点文件不是支持的图片或视频: ${focus}`);
  }
  return relative;
};

const resolveMediaSelection = (dirPath, files) => {
  if (!Array.isArray(files) || files.length === 0) return [];
  const selection = [];
  const seen = new Set();
  for (const file of files) {
    const relative = resolveFocusFile(dirPath, file);
    if (!relative || seen.has(relative)) continue;
    selection.push(relative);
    seen.add(relative);
  }
  return selection;
};

const resolveDirectoryFromKey = (key) => {
  if (!key || typeof key !== "string") {
    throw new Error("缺少目录 key");
  }
  const state = readState();
  const entry = Object.values(state.directories ?? {}).find((candidate) => candidate?.id === key);
  if (entry?.path) {
    return resolveDirectory(entry.path);
  }

  const lookupRoots = [
    EVIDENCE_ROOT,
    path.join(PROJECT_ROOT, "evidence"),
    path.join(PROJECT_ROOT, "artifacts"),
  ].filter((root, index, roots) => roots.indexOf(root) === index && existsSync(root));
  const matches = [];
  let scanned = 0;
  const walk = (currentDir) => {
    if (matches.length > 1 || scanned >= MAX_KEY_LOOKUP_DIRECTORIES) return;
    let entries;
    try {
      entries = readdirSync(currentDir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const child of entries) {
      if (matches.length > 1 || scanned >= MAX_KEY_LOOKUP_DIRECTORIES) return;
      if (!child.isDirectory()) continue;
      const candidate = path.join(currentDir, child.name);
      scanned += 1;
      try {
        if (directoryId(candidate) === key) {
          matches.push(realpathSync.native(candidate));
          continue;
        }
      } catch {
        continue;
      }
      walk(candidate);
    }
  };
  for (const root of lookupRoots) walk(root);

  if (matches.length > 1) {
    throw new Error(`目录 key 不唯一: ${key}`);
  }
  if (matches.length === 1) {
    return resolveDirectory(matches[0]);
  }
  throw new Error(`找不到目录 key: ${key}`);
};

const resolveDirectoryFromUrl = (url) => {
  const key = url.searchParams.get("key");
  if (key) return resolveDirectoryFromKey(key);
  return resolveDirectory(url.searchParams.get("dir"));
};

const registeredFocusForDirectory = (dirPath) => {
  const state = readState();
  const focus = state.directories?.[directoryKey(dirPath)]?.lastFocus?.relativePath;
  if (!focus || typeof focus !== "string") return null;
  try {
    return resolveFocusFile(dirPath, focus);
  } catch {
    return null;
  }
};

const registeredMediaSelectionForDirectory = (dirPath) => {
  const state = readState();
  const files = state.directories?.[directoryKey(dirPath)]?.lastMediaSelection?.relativePaths;
  if (!Array.isArray(files) || files.length === 0) return [];
  try {
    return resolveMediaSelection(dirPath, files);
  } catch {
    return [];
  }
};

const isInsideEvidenceRoot = (dirPath) => existsSync(EVIDENCE_ROOT) && isPathInside(realpathSync.native(EVIDENCE_ROOT), dirPath);

const hasDirectMedia = (dirPath) => readdirSync(dirPath, { withFileTypes: true }).some((entry) => (
  entry.isFile() && MEDIA_EXTENSIONS.has(path.extname(entry.name).toLowerCase())
));

const evidenceRelativeParts = (dirPath) => {
  if (!existsSync(EVIDENCE_ROOT) || !isInsideEvidenceRoot(dirPath)) return [];
  return path.relative(realpathSync.native(EVIDENCE_ROOT), dirPath).split(path.sep).filter(Boolean);
};

const isBroadEvidenceDirectory = (dirPath) => evidenceRelativeParts(dirPath).length <= 2;

const findLatestMediaDirectory = (dirPath, { includeStartDirectory = true } = {}) => {
  let latest = null;
  let scanned = 0;

  const walk = (currentDir) => {
    if (scanned >= MAX_MEDIA_FILES) return;
    const entries = readdirSync(currentDir, { withFileTypes: true })
      .sort((left, right) => left.name.localeCompare(right.name, "zh-CN", { numeric: true }));

    for (const entry of entries) {
      if (scanned >= MAX_MEDIA_FILES) return;
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
        continue;
      }
      if (!entry.isFile()) continue;
      if (!includeStartDirectory && currentDir === dirPath) continue;
      if (!MEDIA_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) continue;

      scanned += 1;
      const stats = statSync(fullPath);
      if (!latest || stats.mtimeMs > latest.modifiedMs) {
        latest = {
          directory: path.dirname(fullPath),
          modifiedMs: stats.mtimeMs,
          file: fullPath,
        };
      }
    }
  };

  walk(dirPath);
  return latest;
};

const resolveListingDirectory = (input, { focus = null } = {}) => {
  const requestedDirectory = resolveDirectory(input);
  const requestedFocus = resolveFocusFile(requestedDirectory, focus);
  if (requestedFocus) {
    return {
      requestedDirectory,
      directory: requestedDirectory,
      autoSelected: false,
      selectedBy: "requested-focus",
    };
  }

  const registeredFocus = registeredFocusForDirectory(requestedDirectory);
  if (registeredFocus) {
    return {
      requestedDirectory,
      directory: requestedDirectory,
      autoSelected: false,
      selectedBy: "registered-focus",
    };
  }

  if (!isInsideEvidenceRoot(requestedDirectory)) {
    return {
      requestedDirectory,
      directory: requestedDirectory,
      autoSelected: false,
    };
  }

  if (hasDirectMedia(requestedDirectory) && !isBroadEvidenceDirectory(requestedDirectory)) {
    return {
      requestedDirectory,
      directory: requestedDirectory,
      autoSelected: false,
    };
  }

  const latest = findLatestMediaDirectory(requestedDirectory, {
    includeStartDirectory: !isBroadEvidenceDirectory(requestedDirectory),
  });
  if (!latest) {
    return {
      requestedDirectory,
      directory: requestedDirectory,
      autoSelected: false,
    };
  }

  return {
    requestedDirectory,
    directory: latest.directory,
    autoSelected: latest.directory !== requestedDirectory,
    selectedBy: "latest-media",
  };
};

const cleanTitlePart = (value) => value
  .replace(/\.[^.]+$/, "")
  .replace(/[_]+/g, " ")
  .replace(/\s*[-–—]\s*/g, " · ")
  .replace(/\s+/g, " ")
  .trim();

const displayTitleForFile = (relativePath) => {
  const base = path.basename(relativePath);
  const title = cleanTitlePart(base);
  return title || base;
};

const relativeEvidencePath = (dirPath) => {
  if (!existsSync(EVIDENCE_ROOT)) return path.basename(dirPath);
  const root = realpathSync.native(EVIDENCE_ROOT);
  if (!isPathInside(root, dirPath)) return path.basename(dirPath);
  const relative = path.relative(root, dirPath);
  return relative || "端到端截图";
};

const displayTitleForDirectory = (dirPath) => relativeEvidencePath(dirPath)
  .split(path.sep)
  .filter(Boolean)
  .map(cleanTitlePart)
  .filter(Boolean)
  .join(" / ");

const sequencePrefix = (fileName) => {
  const match = path.basename(fileName).match(/^(\d+[A-Za-z]?)(?:[-_.]|$)/);
  return match?.[1]?.toLowerCase() ?? "";
};

const candidateIndexRoots = (dirPath) => {
  const roots = [dirPath];
  if (isInsideEvidenceRoot(dirPath)) {
    const parts = path.relative(realpathSync.native(EVIDENCE_ROOT), dirPath).split(path.sep).filter(Boolean);
    if (parts.length > 0) {
      roots.push(path.join(EVIDENCE_ROOT, parts[0]));
    }
  }
  return [...new Set(roots.map((root) => realpathSync.native(root)))];
};

const findIndexFiles = (dirPath) => {
  const results = [];
  const acceptedNames = new Set([".e2e-image-index.json", "image-index.json", "label-source-manifest.json"]);

  const walk = (currentDir) => {
    if (results.length >= MAX_INDEX_FILES) return;
    for (const entry of readdirSync(currentDir, { withFileTypes: true })) {
      if (results.length >= MAX_INDEX_FILES) return;
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "_labeled-for-pureref") continue;
        walk(fullPath);
        continue;
      }
      if (entry.isFile() && acceptedNames.has(entry.name)) {
        results.push(fullPath);
      }
    }
  };

  for (const root of candidateIndexRoots(dirPath)) {
    if (path.basename(root) === "_labeled-for-pureref") continue;
    walk(root);
  }
  return [...new Set(results)];
};

const normalizeIndexItems = (rawIndex) => {
  if (Array.isArray(rawIndex)) return { title: "", items: rawIndex };
  if (!rawIndex || typeof rawIndex !== "object") return { title: "", items: [] };
  return {
    title: typeof rawIndex.title === "string" ? rawIndex.title : "",
    items: Array.isArray(rawIndex.items) ? rawIndex.items : [],
  };
};

const indexSourceCandidates = (sourcePath, indexPath, dirPath) => {
  if (path.isAbsolute(sourcePath)) return [sourcePath];
  const candidates = [
    path.resolve(path.dirname(indexPath), sourcePath),
    path.resolve(PROJECT_ROOT, sourcePath),
    path.resolve(dirPath, sourcePath),
  ];
  return [...new Set(candidates.map((candidate) => path.normalize(candidate)))];
};

const findIndexSourceForDirectory = (sourcePath, indexPath, dirPath, dirKeys) => {
  for (const candidate of indexSourceCandidates(sourcePath, indexPath, dirPath)) {
    const parentDir = path.dirname(candidate);
    const parentKeys = comparableDirectoryKeys(parentDir);
    if (sharesAnyKey(parentKeys, dirKeys)) {
      return candidate;
    }
  }
  return null;
};

const readMediaIndex = (dirPath) => {
  const exact = new Map();
  const byPrefix = new Map();
  const ambiguousPrefixes = new Set();
  let title = "";
  let matchedCount = 0;
  const dirKeys = comparableDirectoryKeys(dirPath);

  for (const indexPath of findIndexFiles(dirPath)) {
    let rawIndex;
    try {
      rawIndex = JSON.parse(readFileSync(indexPath, "utf8"));
    } catch {
      continue;
    }

    const normalized = normalizeIndexItems(rawIndex);
    if (!title && normalized.title) {
      title = normalized.title;
    }

    for (const rawItem of normalized.items) {
      if (!rawItem || typeof rawItem !== "object") continue;
      const sourcePath = rawItem.path ?? rawItem.file ?? rawItem.relativePath ?? rawItem.image;
      if (!sourcePath || typeof sourcePath !== "string") continue;
      const matchedPath = findIndexSourceForDirectory(sourcePath, indexPath, dirPath, dirKeys);
      if (!matchedPath) continue;

      const fileName = path.basename(matchedPath);
      const label = rawItem.label ?? rawItem.title ?? rawItem.name ?? "";
      const description = rawItem.transition ?? rawItem.description ?? rawItem.note ?? "";
      if (!label && !description) continue;

      const entry = {
        displayTitle: String(label || displayTitleForFile(fileName)),
        description: String(description || ""),
      };
      exact.set(fileName, entry);
      matchedCount += 1;

      const prefix = sequencePrefix(fileName);
      if (!prefix) continue;
      if (byPrefix.has(prefix) && byPrefix.get(prefix)?.displayTitle !== entry.displayTitle) {
        ambiguousPrefixes.add(prefix);
        byPrefix.delete(prefix);
        continue;
      }
      if (!ambiguousPrefixes.has(prefix)) {
        byPrefix.set(prefix, entry);
      }
    }
  }

  return { title, exact, byPrefix, matchedCount };
};

const mediaIndexEntryFor = (mediaIndex, relativePath) => {
  const fileName = path.basename(relativePath);
  return mediaIndex.exact.get(fileName) ?? mediaIndex.byPrefix.get(sequencePrefix(fileName)) ?? null;
};

const buildViewerUrl = (port, dirPath, focus = null, files = []) => {
  const url = new URL(`http://127.0.0.1:${port}/`);
  url.searchParams.set("key", directoryId(dirPath));
  if (focus) url.searchParams.set("focus", focus);
  for (const file of files) {
    url.searchParams.append("show", file);
  }
  return url.toString();
};

const buildStableViewerUrl = (port, dirPath) => {
  const url = new URL(`http://127.0.0.1:${port}/`);
  url.searchParams.set("key", directoryId(dirPath));
  return url.toString();
};

const httpJson = (port, pathname, { method = "GET", body = null, timeoutMs = 1200 } = {}) => new Promise((resolve, reject) => {
  const requestBody = body ? JSON.stringify(body) : null;
  const req = httpRequest({
    hostname: "127.0.0.1",
    port,
    path: pathname,
    method,
    timeout: timeoutMs,
    headers: requestBody
      ? {
          "content-type": "application/json",
          "content-length": Buffer.byteLength(requestBody),
        }
      : undefined,
  }, (res) => {
    const chunks = [];
    res.on("data", (chunk) => chunks.push(chunk));
    res.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if ((res.statusCode ?? 500) >= 400) {
        reject(new Error(raw || `HTTP ${res.statusCode}`));
        return;
      }
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (error) {
        reject(error);
      }
    });
  });
  req.on("timeout", () => {
    req.destroy(new Error("请求本地查看器超时"));
  });
  req.on("error", reject);
  if (requestBody) req.write(requestBody);
  req.end();
});

const probeViewer = async (port) => {
  try {
    const health = await httpJson(port, "/api/health", { timeoutMs: 500 });
    if (health?.app === APP_NAME && health?.projectRoot === PROJECT_ROOT) {
      return health;
    }
    return null;
  } catch {
    return null;
  }
};

const canBindPort = (port) => new Promise((resolve) => {
  const server = createServer();
  server.once("error", () => resolve(false));
  server.once("listening", () => {
    server.close(() => resolve(true));
  });
  server.listen(port, "127.0.0.1");
});

const waitForViewer = async (port) => {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    const health = await probeViewer(port);
    if (health) return health;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error(`本地查看器启动超时，日志: ${LOG_PATH}`);
};

const startDetachedServer = (port) => {
  mkdirSync(path.dirname(LOG_PATH), { recursive: true });
  const out = openSync(LOG_PATH, "a");
  try {
    const child = spawn(process.execPath, [fileURLToPath(import.meta.url), "--serve", "--port", String(port)], {
      cwd: PROJECT_ROOT,
      detached: true,
      stdio: ["ignore", out, out],
      windowsHide: true,
    });
    child.unref();
  } finally {
    closeSync(out);
  }
};

const openBrowser = (url) => {
  if (process.platform === "win32") {
    const result = spawnSync("powershell", [
      "-NoProfile",
      "-Command",
      "$target = $env:BG_E2E_IMAGE_VIEWER_URL; if (-not $target) { throw '缺少 BG_E2E_IMAGE_VIEWER_URL' }; Start-Process $target",
    ], {
      env: { ...process.env, BG_E2E_IMAGE_VIEWER_URL: url },
      encoding: "utf8",
      stdio: "pipe",
    });
    if (result.error) throw result.error;
    if (result.status !== 0) {
      throw new Error(result.stderr?.trim() || result.stdout?.trim() || `打开浏览器失败: ${result.status}`);
    }
    return;
  }

  const command = process.platform === "darwin" ? "open" : "xdg-open";
  const child = spawn(command, [url], { detached: true, stdio: "ignore" });
  child.unref();
};

const registerServerState = (port) => {
  const state = readState();
  writeState({
    ...state,
    version: 1,
    server: serverStateFor(port),
    directories: state.directories ?? {},
  });
};

const updateDirectoryState = (dirPath, port, patch = {}) => {
  const state = readState();
  const key = directoryKey(dirPath);
  const id = directoryId(dirPath);
  const previous = state.directories?.[key] ?? {};
  const url = buildViewerUrl(port, dirPath);
  writeState({
    ...state,
    version: 1,
    server: serverStateFor(port),
    directories: {
      ...(state.directories ?? {}),
      [key]: {
        ...previous,
        id,
        key,
        path: dirPath,
        url,
        serverPort: port,
        serverInstanceId: instanceId,
        lastRegisteredAt: new Date().toISOString(),
        ...patch,
      },
    },
  });
  return { id, key, url };
};

const ensureDirectoryState = (dirPath, port) => {
  const state = readState();
  const key = directoryKey(dirPath);
  if (state.directories?.[key]?.id === directoryId(dirPath)) {
    return state.directories[key];
  }
  return updateDirectoryState(dirPath, port, { registeredBy: "auto-selected-listing" });
};

const mediaKind = (filePath) => VIDEO_EXTENSIONS.has(path.extname(filePath).toLowerCase()) ? "video" : "image";

const collectMedia = (dirPath, mediaIndex, selectedFiles = []) => {
  const results = [];
  const dirId = directoryId(dirPath);
  const selectedOrder = new Map(selectedFiles.map((file, index) => [file, index]));
  const entries = readdirSync(dirPath, { withFileTypes: true })
    .sort((left, right) => left.name.localeCompare(right.name, "zh-CN", { numeric: true }));

  for (const entry of entries) {
    if (results.length >= MAX_MEDIA_FILES) break;
    if (!entry.isFile()) continue;
    const fullPath = path.join(dirPath, entry.name);
    const extension = path.extname(entry.name).toLowerCase();
    if (!MEDIA_EXTENSIONS.has(extension)) continue;
    const stats = statSync(fullPath);
    const relativePath = entry.name;
    if (selectedOrder.size > 0 && !selectedOrder.has(relativePath)) continue;
    const indexEntry = mediaIndexEntryFor(mediaIndex, relativePath);
    results.push({
      relativePath,
      displayTitle: indexEntry?.displayTitle ?? displayTitleForFile(relativePath),
      description: indexEntry?.description ?? "",
      absolutePath: fullPath,
      kind: mediaKind(fullPath),
      size: stats.size,
      modifiedAt: new Date(stats.mtimeMs).toISOString(),
      url: `/media?key=${encodeURIComponent(dirId)}&file=${encodeURIComponent(relativePath)}&v=${encodeURIComponent(`${stats.size}-${Math.trunc(stats.mtimeMs)}`)}`,
    });
  }
  if (selectedOrder.size > 0) {
    results.sort((left, right) => selectedOrder.get(left.relativePath) - selectedOrder.get(right.relativePath));
  }
  return results;
};

const escapeHtml = (value) => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#39;");

const writeOfflineViewerFile = (dirPath) => {
  const mediaIndex = readMediaIndex(dirPath);
  const items = collectMedia(dirPath, mediaIndex).map((item) => ({
    relativePath: item.relativePath,
    displayTitle: item.displayTitle,
    description: item.description,
    kind: item.kind,
  }));
  const title = mediaIndex.title || displayTitleForDirectory(dirPath) || "端到端截图";
  const serializedItems = JSON.stringify(items).replaceAll("<", "\\u003c");
  const markup = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta http-equiv="refresh" content="5" />
  <title>${escapeHtml(title)}</title>
  <style>
    :root { color-scheme: dark; font-family: "Segoe UI", "Microsoft YaHei", sans-serif; }
    body { margin: 0; background: #111827; color: #e5e7eb; }
    header { position: sticky; top: 0; z-index: 1; padding: 16px 20px; background: #1f2937; border-bottom: 1px solid #374151; }
    h1 { margin: 0 0 4px; font-size: 20px; }
    p { margin: 0; color: #9ca3af; font-size: 13px; }
    main { display: grid; gap: 18px; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); padding: 20px; }
    figure { margin: 0; padding: 12px; background: #1f2937; border: 1px solid #374151; border-radius: 12px; }
    img { display: block; width: 100%; height: auto; border-radius: 8px; background: #030712; }
    figcaption { padding-top: 10px; }
    strong { display: block; font-size: 15px; }
    span { display: block; margin-top: 4px; color: #9ca3af; font-size: 13px; line-height: 1.5; }
    .empty { padding: 24px; color: #fca5a5; }
  </style>
</head>
<body>
  <header>
    <h1>${escapeHtml(title)}</h1>
    <p>这个文件固定在截图目录内；刷新页面会读取该目录当前文件。</p>
  </header>
  <main id="gallery"></main>
  <script>
    const items = ${serializedItems};
    const gallery = document.querySelector("#gallery");
    const cacheBust = Date.now();
    if (items.length === 0) {
      gallery.innerHTML = '<div class="empty">当前目录还没有截图。</div>';
    } else {
      for (const item of items) {
        const figure = document.createElement("figure");
        const image = document.createElement("img");
        image.alt = item.displayTitle;
        image.src = "./" + encodeURIComponent(item.relativePath) + "?updated=" + cacheBust;
        const caption = document.createElement("figcaption");
        const label = document.createElement("strong");
        label.textContent = item.displayTitle;
        caption.append(label);
        if (item.description) {
          const description = document.createElement("span");
          description.textContent = item.description;
          caption.append(description);
        }
        figure.append(image, caption);
        gallery.append(figure);
      }
    }
  </script>
</body>
</html>
`;
  const target = path.join(dirPath, OFFLINE_VIEWER_FILE_NAME);
  const temp = path.join(dirPath, `.${OFFLINE_VIEWER_FILE_NAME}.${process.pid}.tmp`);
  writeFileSync(temp, markup, "utf8");
  try {
    unlinkSync(target);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  renameSync(temp, target);
  return target;
};

const serveStatic = (res, relativePath) => {
  const target = path.join(WEB_DIR, relativePath);
  const real = realpathSync.native(target);
  const relative = path.relative(WEB_DIR, real);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    textResponse(res, 403, "禁止访问");
    return;
  }
  const extension = path.extname(real).toLowerCase();
  res.writeHead(200, {
    "content-type": MIME_TYPES.get(extension) ?? "application/octet-stream",
    "cache-control": "no-store",
  });
  createReadStream(real).pipe(res);
};

const serveMedia = (req, res, url) => {
  const mediaKey = url.searchParams.get("key");
  const dirPath = mediaKey ? resolveDirectoryFromKey(mediaKey) : resolveDirectory(url.searchParams.get("dir"));
  const relativeFile = url.searchParams.get("file");
  if (!relativeFile) throw new Error("缺少媒体文件路径");
  const target = path.resolve(dirPath, relativeFile);
  const real = realpathSync.native(target);
  const relative = path.relative(dirPath, real);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`媒体文件不在证据目录内: ${relativeFile}`);
  }
  if (!existsSync(real) || !statSync(real).isFile()) {
    throw new Error(`媒体文件不存在: ${relativeFile}`);
  }
  const extension = path.extname(real).toLowerCase();
  if (!MEDIA_EXTENSIONS.has(extension)) {
    throw new Error(`不支持的媒体格式: ${relativeFile}`);
  }
  const stats = statSync(real);
  const totalSize = stats.size;
  const rangeHeader = req.headers.range;
  const commonHeaders = {
    "content-type": MIME_TYPES.get(extension) ?? "application/octet-stream",
    "cache-control": "public, max-age=31536000, immutable",
    "accept-ranges": "bytes",
    "last-modified": stats.mtime.toUTCString(),
  };

  if (!rangeHeader) {
    res.writeHead(200, {
      ...commonHeaders,
      "content-length": totalSize,
    });
    if (req.method !== "HEAD") {
      createReadStream(real).pipe(res);
      return;
    }
    res.end();
    return;
  }

  const match = /^bytes=(\d*)-(\d*)$/i.exec(rangeHeader.trim());
  if (!match) {
    res.writeHead(416, {
      ...commonHeaders,
      "content-range": `bytes */${totalSize}`,
    });
    res.end();
    return;
  }

  const requestedStart = match[1] ? Number(match[1]) : null;
  const requestedEnd = match[2] ? Number(match[2]) : null;
  let start;
  let end;

  if (requestedStart !== null) {
    start = requestedStart;
    end = requestedEnd !== null ? requestedEnd : totalSize - 1;
  } else if (requestedEnd !== null) {
    const suffixLength = requestedEnd;
    start = Math.max(0, totalSize - suffixLength);
    end = totalSize - 1;
  } else {
    start = 0;
    end = totalSize - 1;
  }

  if (
    !Number.isSafeInteger(start)
    || !Number.isSafeInteger(end)
    || start < 0
    || end < start
    || start >= totalSize
  ) {
    res.writeHead(416, {
      ...commonHeaders,
      "content-range": `bytes */${totalSize}`,
    });
    res.end();
    return;
  }

  end = Math.min(end, totalSize - 1);
  const contentLength = end - start + 1;
  res.writeHead(206, {
    ...commonHeaders,
    "content-length": contentLength,
    "content-range": `bytes ${start}-${end}/${totalSize}`,
  });
  if (req.method !== "HEAD") {
    createReadStream(real, { start, end }).pipe(res);
    return;
  }
  res.end();
};

const createViewerServer = (port) => createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", `http://127.0.0.1:${port}`);
    if (req.method === "GET" && url.pathname === "/api/health") {
      jsonResponse(res, 200, { ok: true, app: APP_NAME, projectRoot: PROJECT_ROOT, port, pid: process.pid, instanceId, startedAt });
      return;
    }
    if (req.method === "POST" && url.pathname === "/api/register") {
      const body = await readJsonBody(req);
      const dirPath = resolveDirectory(body.dir);
      const focus = resolveFocusFile(dirPath, body.focus);
      const files = resolveMediaSelection(dirPath, body.files);
      const entry = updateDirectoryState(dirPath, port, {
        lastFocus: focus ? { relativePath: focus, updatedAt: new Date().toISOString() } : null,
        lastMediaSelection: files.length > 0 ? { relativePaths: files, updatedAt: new Date().toISOString() } : null,
      });
      const offlineViewerFile = writeOfflineViewerFile(dirPath);
      jsonResponse(res, 200, { ok: true, offlineViewerFile, ...entry });
      return;
    }
    if (req.method === "POST" && url.pathname === "/api/mark-open") {
      const body = await readJsonBody(req);
      const dirPath = resolveDirectory(body.dir);
      const entry = updateDirectoryState(dirPath, port, { lastBrowserOpenAt: new Date().toISOString() });
      jsonResponse(res, 200, { ok: true, ...entry });
      return;
    }
    if (req.method === "GET" && url.pathname === "/api/list") {
      const listing = resolveListingDirectory(resolveDirectoryFromUrl(url), { focus: url.searchParams.get("focus") });
      const directoryState = ensureDirectoryState(listing.directory, port);
      const mediaIndex = readMediaIndex(listing.directory);
      const requestedSelection = resolveMediaSelection(listing.directory, url.searchParams.getAll("show"));
      const selectedFiles = requestedSelection.length > 0 ? requestedSelection : registeredMediaSelectionForDirectory(listing.directory);
      const items = collectMedia(listing.directory, mediaIndex, selectedFiles);
      const offlineViewerFile = writeOfflineViewerFile(listing.directory);
      jsonResponse(res, 200, {
        ok: true,
        offlineViewerFile,
        requestedDirectory: listing.requestedDirectory,
        directory: listing.directory,
        directoryTitle: mediaIndex.title || displayTitleForDirectory(listing.directory),
        indexMatchedCount: mediaIndex.matchedCount,
        autoSelectedDirectory: listing.autoSelected,
        selectedBy: listing.selectedBy,
        focus: directoryState?.lastFocus ?? null,
        selectedFiles,
        maxFiles: MAX_MEDIA_FILES,
        truncated: items.length >= MAX_MEDIA_FILES,
        items,
      });
      return;
    }
    if ((req.method === "GET" || req.method === "HEAD") && url.pathname === "/media") {
      serveMedia(req, res, url);
      return;
    }
    if (req.method === "GET" && url.pathname === "/") {
      serveStatic(res, "index.html");
      return;
    }
    if (req.method === "GET" && url.pathname === "/app.js") {
      serveStatic(res, "app.js");
      return;
    }
    if (req.method === "GET" && url.pathname === "/styles.css") {
      serveStatic(res, "styles.css");
      return;
    }
    textResponse(res, 404, "未找到");
  } catch (error) {
    textResponse(res, 400, error instanceof Error ? error.message : String(error));
  }
});

const serve = async (port) => {
  const server = createViewerServer(port);
  let shuttingDown = false;
  await new Promise((resolve, reject) => {
    const onError = (error) => {
      server.removeListener("listening", onListening);
      reject(error);
    };
    const onListening = () => {
      server.removeListener("error", onError);
      try {
        registerServerState(port);
        console.log(`[${APP_NAME}] listening on http://127.0.0.1:${port}`);
        resolve();
      } catch (error) {
        server.close(() => reject(error));
      }
    };
    server.once("error", onError);
    server.once("listening", onListening);
    server.listen(port, "127.0.0.1");
  });

  const shutdown = () => {
    if (shuttingDown) return;
    shuttingDown = true;
    server.close(() => {
      clearServerState({ port, pid: process.pid, instanceId });
      process.exit(0);
    });
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
};

const startupLockPath = (port) => path.join(EVIDENCE_ROOT, `.e2e-image-viewer-start-${port}.lock`);

const acquireStartupLock = (port) => {
  const lockPath = startupLockPath(port);
  mkdirSync(path.dirname(lockPath), { recursive: true });
  const lock = JSON.stringify({
    pid: process.pid,
    port,
    startedAt: new Date().toISOString(),
  });

  try {
    writeFileSync(lockPath, lock, { encoding: "utf8", flag: "wx" });
    return { lockPath, owner: true };
  } catch (error) {
    if (error?.code !== "EEXIST") throw error;
  }

  let ownerPid = null;
  try {
    ownerPid = JSON.parse(readFileSync(lockPath, "utf8")).pid;
  } catch {
  }
  if (isProcessAlive(ownerPid)) {
    return { lockPath, owner: false };
  }

  try {
    unlinkSync(lockPath);
  } catch {
  }
  writeFileSync(lockPath, lock, { encoding: "utf8", flag: "wx" });
  return { lockPath, owner: true };
};

const releaseStartupLock = (lock) => {
  if (!lock?.owner) return;
  try {
    unlinkSync(lock.lockPath);
  } catch {
  }
};

const ensureViewer = async (port) => {
  const existing = await probeViewer(port);
  if (existing) return { health: existing, alreadyRunning: true };

  const lock = acquireStartupLock(port);
  try {
    if (!lock.owner) {
      return { health: await waitForViewer(port), alreadyRunning: true };
    }

    const raced = await probeViewer(port);
    if (raced) return { health: raced, alreadyRunning: true };
    if (!(await canBindPort(port))) {
      throw new Error(`端口 ${port} 在启动过程中被其它服务占用`);
    }
    startDetachedServer(port);
    return { health: await waitForViewer(port), alreadyRunning: false };
  } finally {
    releaseStartupLock(lock);
  }
};

const printStatus = async (port) => {
  const health = await probeViewer(port);
  if (!health) {
    const state = readState();
    if (state.server?.port === port && !isProcessAlive(state.server.pid)) {
      clearServerState({ port, pid: state.server.pid, instanceId: state.server.instanceId });
    }
    console.log(`VIEWER_STATUS=DOWN`);
    console.log(`VIEWER_PORT=${port}`);
    return;
  }
  console.log(`VIEWER_STATUS=RUNNING`);
  console.log(`VIEWER_PORT=${port}`);
  console.log(`VIEWER_PID=${health.pid}`);
  console.log(`VIEWER_INSTANCE_ID=${health.instanceId}`);
  console.log(`VIEWER_STARTED_AT=${health.startedAt}`);
};

const stopViewer = async (port) => {
  const health = await probeViewer(port);
  if (!health) {
    const state = readState();
    if (state.server?.port === port && !isProcessAlive(state.server.pid)) {
      clearServerState({ port, pid: state.server.pid, instanceId: state.server.instanceId });
    }
    console.log(`VIEWER_STOPPED=false`);
    console.log(`VIEWER_PORT=${port}`);
    return;
  }

  if (process.platform === "win32") {
    const result = spawnSync("taskkill", ["/F", "/T", "/PID", String(health.pid)], {
      encoding: "utf8",
      stdio: "pipe",
      windowsHide: true,
    });
    if (result.status !== 0) {
      throw new Error(result.stderr?.trim() || result.stdout?.trim() || `停止查看器失败: ${result.status}`);
    }
  } else {
    process.kill(health.pid, "SIGTERM");
  }

  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    if (!(await probeViewer(port))) {
      clearServerState({ port, pid: health.pid, instanceId: health.instanceId });
      console.log(`VIEWER_STOPPED=true`);
      console.log(`VIEWER_PORT=${port}`);
      console.log(`VIEWER_PID=${health.pid}`);
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`查看器停止超时: ${port}`);
};

const launch = async (args) => {
  const dirPath = resolveDirectory(args.dir);
  const focus = resolveFocusFile(dirPath, args.focus);
  const files = resolveMediaSelection(dirPath, args.files);
  const key = directoryKey(dirPath);
  const selected = await ensureViewer(args.port);
  const health = selected.health;

  const url = buildStableViewerUrl(args.port, dirPath);
  const registration = await httpJson(args.port, "/api/register", { method: "POST", body: { dir: dirPath, focus, files } });
  const offlineViewerFile = registration.offlineViewerFile ?? path.join(dirPath, OFFLINE_VIEWER_FILE_NAME);
  const stableDirectoryKey = directoryId(dirPath);
  const mediaCount = collectMedia(dirPath, readMediaIndex(dirPath), files).length;

  const stateAfterRegistration = readState();
  const previousEntry = stateAfterRegistration.directories?.[key];
  const alreadyOpen = Boolean(
    previousEntry?.lastBrowserOpenAt
      && previousEntry.serverPort === args.port
      && previousEntry.serverInstanceId === health?.instanceId
      && !args.reopen,
  );

  if (args.noOpen) {
    console.log(`MEDIA_COUNT=${mediaCount}`);
    console.log(`VIEWER_URL=${url}`);
    console.log(`OFFLINE_VIEWER_FILE=${offlineViewerFile}`);
    console.log(`OPEN_BROWSER=false`);
    console.log(`DIRECTORY_KEY=${stableDirectoryKey}`);
    console.log(`DIRECTORY_PATH=${dirPath}`);
    return;
  }

  if (alreadyOpen) {
    console.log(`MEDIA_COUNT=${mediaCount}`);
    console.log(`VIEWER_URL=${url}`);
    console.log(`OFFLINE_VIEWER_FILE=${offlineViewerFile}`);
    console.log(`ALREADY_OPEN=true`);
    console.log(`DIRECTORY_KEY=${stableDirectoryKey}`);
    console.log(`DIRECTORY_PATH=${dirPath}`);
    return;
  }

  openBrowser(url);
  await httpJson(args.port, "/api/mark-open", { method: "POST", body: { dir: dirPath } });
  console.log(`MEDIA_COUNT=${mediaCount}`);
  console.log(`VIEWER_URL=${url}`);
  console.log(`OFFLINE_VIEWER_FILE=${offlineViewerFile}`);
  console.log(`OPENED_BROWSER=true`);
  console.log(`DIRECTORY_KEY=${stableDirectoryKey}`);
  console.log(`DIRECTORY_PATH=${dirPath}`);
};

try {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    usage();
    process.exit(0);
  }
  if (args.status) {
    await printStatus(args.port);
  } else if (args.stop) {
    await stopViewer(args.port);
  } else if (args.serve) {
    await serve(args.port);
  } else {
    await launch(args);
  }
} catch (error) {
  console.error(`e2e-image-viewer 失败: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
