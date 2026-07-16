import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..', '..');
const distAssetsDir = path.join(repoRoot, 'dist', 'assets');
const distLocalesDir = path.join(repoRoot, 'dist', 'locales');
const distLogosDir = path.join(repoRoot, 'dist', 'logos');
const publicAssetsDir = path.join(repoRoot, 'public', 'assets');
const publicLogosDir = path.join(repoRoot, 'public', 'logos');
const distI18nDir = path.join(distAssetsDir, 'i18n');
const distCommonDir = path.join(distAssetsDir, 'common');
const publicI18nDir = path.join(publicAssetsDir, 'i18n');
const publicCommonDir = path.join(publicAssetsDir, 'common');
const COMMON_ASSET_DIR_NAMES_TO_REMOVE = ['images', 'logos', 'audio'];
export const WEB_LEGACY_GAME_ASSET_DIR_NAMES_TO_REMOVE = ['betrayal', 'rules', 'smashup', 'splendor'];
export const CLOUDFLARE_PAGES_MAX_FILE_BYTES = 25 * 1024 * 1024;
export const DIST_I18N_JSON_RETAIN_RELATIVE_PATHS = [
  'assets-manifest.json',
  'zh-CN/dicethrone/assets-manifest.json',
  // Android 测试壳/首装场景还没有下载 package-managed 游戏包；
  // 首页书页缩略图必须保留最小压缩产物，不能把 DiceThrone 大图整包塞回内置资源。
  'zh-CN/dicethrone/thumbnails/compressed/fengm.webp',
  'zh-CN/qidahen/assets-manifest.json',
  // Android 测试壳/首装场景可能尚未安装七大恨游戏包；
  // 主地图是进入对局后的关键首屏资产，只保留压缩版作为离线兜底。
  'zh-CN/qidahen/board/compressed/qidahen-main-map.webp',
  'zh-CN/smashup/assets-manifest.json',
  'zh-CN/splendor/assets-manifest.json',
  'zh-CN/tictactoe/assets-manifest.json',
];
export const DIST_COMMON_JSON_RETAIN_RELATIVE_PATHS = [
  'assets-manifest.json',
  // V2 书本首页首屏背景是 Android 壳根路由的关键图片；
  // 生产包必须保留本地副本，不能依赖 CDN 单点可用性。
  'images/home-v2/book-catalog-wide/1.png',
];
export const DIST_LOGOS_RETAIN_RELATIVE_PATHS = [
  'weixin.jpg',
  'zhifubao.jpg',
];
const DIST_I18N_JSON_RETAIN_RELATIVE_PATH_SET = new Set(DIST_I18N_JSON_RETAIN_RELATIVE_PATHS);
const DIST_COMMON_JSON_RETAIN_RELATIVE_PATH_SET = new Set(DIST_COMMON_JSON_RETAIN_RELATIVE_PATHS);
const DIST_LOGOS_RETAIN_RELATIVE_PATH_SET = new Set(DIST_LOGOS_RETAIN_RELATIVE_PATHS);
const DIST_PRUNE_PROFILES = {
  web: {
    allowedLocaleDirs: null,
    maxAssetFileBytes: CLOUDFLARE_PAGES_MAX_FILE_BYTES,
    assetDirNamesToRemove: WEB_LEGACY_GAME_ASSET_DIR_NAMES_TO_REMOVE,
  },
  'android-embedded': {
    allowedLocaleDirs: ['zh-CN'],
    maxAssetFileBytes: null,
    assetDirNamesToRemove: [],
  },
  'ios-embedded': {
    allowedLocaleDirs: ['zh-CN'],
    maxAssetFileBytes: null,
    assetDirNamesToRemove: [],
  },
};

const formatMb = (bytes) => `${(bytes / 1024 / 1024).toFixed(2)} MB`;

const sizeOf = (targetPath) => {
  if (!fs.existsSync(targetPath)) return 0;
  let total = 0;
  const stack = [targetPath];

  while (stack.length > 0) {
    const currentPath = stack.pop();
    let stat;
    try {
      stat = fs.statSync(currentPath);
    } catch (error) {
      if (error?.code === 'ENOENT') {
        continue;
      }
      throw error;
    }
    if (stat.isFile()) {
      total += stat.size;
      continue;
    }

    for (const entry of fs.readdirSync(currentPath, { withFileTypes: true })) {
      stack.push(path.join(currentPath, entry.name));
    }
  }

  return total;
};

const ensureParentDir = (targetPath) => {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
};

const toRepoRelativePath = (targetPath) => path.relative(repoRoot, targetPath).replace(/\\/g, '/');

const copyRetainedFile = (sourceRoot, targetRoot, relativePath) => {
  const sourcePath = path.join(sourceRoot, relativePath);
  if (!fs.existsSync(sourcePath)) {
    return;
  }

  const targetPath = path.join(targetRoot, relativePath);
  ensureParentDir(targetPath);
  fs.copyFileSync(sourcePath, targetPath);
};

const removeDirectoryIfExists = (targetPath, stats) => {
  if (!fs.existsSync(targetPath)) {
    return;
  }

  stats.removedPaths.push(toRepoRelativePath(targetPath));
  fs.rmSync(targetPath, { recursive: true, force: true });
};

const removeOversizedFiles = (targetPath, maxFileBytes, stats) => {
  if (!Number.isFinite(maxFileBytes) || !fs.existsSync(targetPath)) {
    return;
  }

  const stack = [targetPath];
  while (stack.length > 0) {
    const currentPath = stack.pop();
    let stat;
    try {
      stat = fs.statSync(currentPath);
    } catch (error) {
      if (error?.code === 'ENOENT') {
        continue;
      }
      throw error;
    }

    if (stat.isFile()) {
      if (stat.size <= maxFileBytes) {
        continue;
      }

      const relativePath = toRepoRelativePath(currentPath);
      stats.removedPaths.push(relativePath);
      stats.removedOversizedFiles.push({
        path: relativePath,
        bytes: stat.size,
      });
      fs.rmSync(currentPath, { force: true });
      continue;
    }

    for (const entry of fs.readdirSync(currentPath, { withFileTypes: true })) {
      stack.push(path.join(currentPath, entry.name));
    }
  }
};

const pruneLocales = (allowedLocaleDirs, stats) => {
  if (!Array.isArray(allowedLocaleDirs) || !fs.existsSync(distLocalesDir)) {
    return;
  }

  const allowed = new Set(allowedLocaleDirs);
  for (const entry of fs.readdirSync(distLocalesDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || allowed.has(entry.name)) {
      continue;
    }
    removeDirectoryIfExists(path.join(distLocalesDir, entry.name), stats);
  }
};

export const isRetainedDistI18nFile = (relativePath) => DIST_I18N_JSON_RETAIN_RELATIVE_PATH_SET.has(relativePath);
export const isRetainedDistCommonFile = (relativePath) => DIST_COMMON_JSON_RETAIN_RELATIVE_PATH_SET.has(relativePath);
export const isRetainedDistLogoFile = (relativePath) => DIST_LOGOS_RETAIN_RELATIVE_PATH_SET.has(relativePath);
export const isCloudflarePagesFileSizeAllowed = (bytes) => bytes <= CLOUDFLARE_PAGES_MAX_FILE_BYTES;
export const isRemovedWebLegacyGameAssetDir = (dirName) => WEB_LEGACY_GAME_ASSET_DIR_NAMES_TO_REMOVE.includes(dirName);

export function pruneDistAssets(target = 'web') {
  const profile = DIST_PRUNE_PROFILES[target];
  if (!profile) {
    throw new Error(`未知裁剪目标: ${target}`);
  }

  if (!fs.existsSync(distAssetsDir)) {
    return {
      skipped: true,
      target,
      beforeBytes: 0,
      afterBytes: 0,
      removedPaths: [],
    };
  }

  const beforeBytes = sizeOf(distAssetsDir);
  const stats = {
    skipped: false,
    target,
    beforeBytes,
    afterBytes: beforeBytes,
    removedPaths: [],
    removedOversizedFiles: [],
  };

  pruneLocales(profile.allowedLocaleDirs, stats);
  removeDirectoryIfExists(distI18nDir, stats);
  removeDirectoryIfExists(distLogosDir, stats);

  for (const dirName of COMMON_ASSET_DIR_NAMES_TO_REMOVE) {
    removeDirectoryIfExists(path.join(distCommonDir, dirName), stats);
  }

  for (const dirName of profile.assetDirNamesToRemove) {
    removeDirectoryIfExists(path.join(distAssetsDir, dirName), stats);
  }

  for (const relativePath of DIST_I18N_JSON_RETAIN_RELATIVE_PATHS) {
    copyRetainedFile(publicI18nDir, distI18nDir, relativePath);
  }

  for (const relativePath of DIST_COMMON_JSON_RETAIN_RELATIVE_PATHS) {
    copyRetainedFile(publicCommonDir, distCommonDir, relativePath);
  }

  for (const relativePath of DIST_LOGOS_RETAIN_RELATIVE_PATHS) {
    copyRetainedFile(publicLogosDir, distLogosDir, relativePath);
  }

  removeOversizedFiles(distAssetsDir, profile.maxAssetFileBytes, stats);

  stats.afterBytes = sizeOf(distAssetsDir);
  return stats;
}

const readCliTarget = () => {
  const directArg = process.argv.find((arg) => arg.startsWith('--target='));
  if (directArg) {
    return directArg.slice('--target='.length).trim() || 'web';
  }

  const targetIndex = process.argv.findIndex((arg) => arg === '--target');
  if (targetIndex >= 0) {
    return process.argv[targetIndex + 1]?.trim() || 'web';
  }

  return 'web';
};

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  const target = readCliTarget();
  const stats = pruneDistAssets(target);
  if (stats.skipped) {
    console.warn(`[web-dist-prune] 未找到 dist/assets，跳过（target=${target}）`);
    process.exit(0);
  }

  console.log(`[web-dist-prune] target=${target}`);
  console.log(`[web-dist-prune] 已清理目录 ${stats.removedPaths.length} 处`);
  if (stats.removedPaths.length > 0) {
    console.log(`[web-dist-prune] 清理目标: ${stats.removedPaths.join(', ')}`);
  }
  if (stats.removedOversizedFiles.length > 0) {
    const removedOversizedFiles = stats.removedOversizedFiles
      .map((file) => `${file.path}(${formatMb(file.bytes)})`)
      .join(', ');
    console.log(`[web-dist-prune] 超限文件: ${removedOversizedFiles}`);
  }
  console.log(`[web-dist-prune] dist/assets: ${formatMb(stats.beforeBytes)} -> ${formatMb(stats.afterBytes)}`);
}
