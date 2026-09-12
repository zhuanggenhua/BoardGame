#!/usr/bin/env node

import { createServer, request as httpRequest } from "node:http";
import {
  createReadStream,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  realpathSync,
  statSync,
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
const MAX_PORT_ATTEMPTS = 20;
const MAX_MEDIA_FILES = 1500;
const MAX_INDEX_FILES = 80;
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
  --port <端口>      本地查看器端口，默认 ${DEFAULT_PORT}
  --no-open          只启动 / 注册目录，不打开浏览器
  --reopen           即使该目录已打开过，也重新打开浏览器
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
    serve: false,
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

const resolveDirectoryFromKey = (key) => {
  if (!key || typeof key !== "string") {
    throw new Error("缺少目录 key");
  }
  const state = readState();
  const entry = Object.values(state.directories ?? {}).find((candidate) => candidate?.id === key);
  if (!entry?.path) {
    throw new Error(`找不到目录 key: ${key}`);
  }
  return resolveDirectory(entry.path);
};

const resolveDirectoryFromUrl = (url) => {
  const key = url.searchParams.get("key");
  if (key) return resolveDirectoryFromKey(key);
  return resolveDirectory(url.searchParams.get("dir"));
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

const resolveListingDirectory = (input) => {
  const requestedDirectory = resolveDirectory(input);
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

const buildViewerUrl = (port, dirPath, focus = null) => {
  const url = new URL(`http://127.0.0.1:${port}/`);
  url.searchParams.set("key", directoryId(dirPath));
  if (focus) url.searchParams.set("focus", focus);
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

const choosePort = async (preferredPort) => {
  for (let offset = 0; offset < MAX_PORT_ATTEMPTS; offset += 1) {
    const port = preferredPort + offset;
    const health = await probeViewer(port);
    if (health) return { port, health, alreadyRunning: true };
  }

  for (let offset = 0; offset < MAX_PORT_ATTEMPTS; offset += 1) {
    const port = preferredPort + offset;
    if (await canBindPort(port)) return { port, health: null, alreadyRunning: false };
  }
  throw new Error(`没有找到可用端口：从 ${preferredPort} 起尝试 ${MAX_PORT_ATTEMPTS} 个端口都失败`);
};

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
  const child = spawn(process.execPath, [fileURLToPath(import.meta.url), "--serve", "--port", String(port)], {
    cwd: PROJECT_ROOT,
    detached: true,
    stdio: ["ignore", out, out],
    windowsHide: true,
  });
  child.unref();
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
    server: {
      app: APP_NAME,
      projectRoot: PROJECT_ROOT,
      port,
      pid: process.pid,
      instanceId,
      startedAt,
      updatedAt: new Date().toISOString(),
    },
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

const collectMedia = (dirPath, mediaIndex) => {
  const results = [];
  const dirId = directoryId(dirPath);
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
  return results;
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

const serveMedia = (res, url) => {
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
  res.writeHead(200, {
    "content-type": MIME_TYPES.get(extension) ?? "application/octet-stream",
    "cache-control": "public, max-age=31536000, immutable",
  });
  createReadStream(real).pipe(res);
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
      const entry = updateDirectoryState(dirPath, port, {
        lastFocus: focus ? { relativePath: focus, updatedAt: new Date().toISOString() } : null,
      });
      jsonResponse(res, 200, { ok: true, ...entry });
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
      const listing = resolveListingDirectory(resolveDirectoryFromUrl(url));
      const directoryState = ensureDirectoryState(listing.directory, port);
      const mediaIndex = readMediaIndex(listing.directory);
      const items = collectMedia(listing.directory, mediaIndex);
      jsonResponse(res, 200, {
        ok: true,
        requestedDirectory: listing.requestedDirectory,
        directory: listing.directory,
        directoryTitle: mediaIndex.title || displayTitleForDirectory(listing.directory),
        indexMatchedCount: mediaIndex.matchedCount,
        autoSelectedDirectory: listing.autoSelected,
        selectedBy: listing.selectedBy,
        focus: directoryState?.lastFocus ?? null,
        maxFiles: MAX_MEDIA_FILES,
        truncated: items.length >= MAX_MEDIA_FILES,
        items,
      });
      return;
    }
    if (req.method === "GET" && url.pathname === "/media") {
      serveMedia(res, url);
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
  registerServerState(port);
  const server = createViewerServer(port);
  server.listen(port, "127.0.0.1", () => {
    console.log(`[${APP_NAME}] listening on http://127.0.0.1:${port}`);
  });
};

const launch = async (args) => {
  const dirPath = resolveDirectory(args.dir);
  const focus = resolveFocusFile(dirPath, args.focus);
  const key = directoryKey(dirPath);
  const stateBefore = readState();
  const selected = await choosePort(args.port);
  let health = selected.health;
  if (!selected.alreadyRunning) {
    startDetachedServer(selected.port);
    health = await waitForViewer(selected.port);
  }

  const url = buildViewerUrl(selected.port, dirPath, focus);
  await httpJson(selected.port, "/api/register", { method: "POST", body: { dir: dirPath, focus } });

  const previousEntry = stateBefore.directories?.[key];
  const alreadyOpen = Boolean(
    previousEntry?.lastBrowserOpenAt
      && previousEntry.serverPort === selected.port
      && previousEntry.serverInstanceId === health?.instanceId
      && !args.reopen,
  );

  if (args.noOpen) {
    console.log(`VIEWER_URL=${url}`);
    console.log(`OPEN_BROWSER=false`);
    console.log(`DIRECTORY_KEY=${key}`);
    return;
  }

  if (alreadyOpen) {
    console.log(`VIEWER_URL=${url}`);
    console.log(`ALREADY_OPEN=true`);
    console.log(`DIRECTORY_KEY=${key}`);
    return;
  }

  openBrowser(url);
  await httpJson(selected.port, "/api/mark-open", { method: "POST", body: { dir: dirPath } });
  console.log(`VIEWER_URL=${url}`);
  console.log(`OPENED_BROWSER=true`);
  console.log(`DIRECTORY_KEY=${key}`);
};

try {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    usage();
    process.exit(0);
  }
  if (args.serve) {
    await serve(args.port);
  } else {
    await launch(args);
  }
} catch (error) {
  console.error(`e2e-image-viewer 失败: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
