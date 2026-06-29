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
export const DIST_I18N_JSON_RETAIN_RELATIVE_PATHS = [
  'assets-manifest.json',
  'zh-CN/dicethrone/assets-manifest.json',
  'zh-CN/dicethrone/images/artificial/status-icons-atlas.json',
  'zh-CN/dicethrone/images/barbarian/status-icons-atlas.json',
  'zh-CN/dicethrone/images/cursed/status-icons-atlas.json',
  'zh-CN/dicethrone/images/gunslinger/status-icons-atlas.json',
  'zh-CN/dicethrone/images/monk/status-icons-atlas.json',
  'zh-CN/dicethrone/images/moon_elf/status-icons-atlas.json',
  'zh-CN/dicethrone/images/ninja/status-icons-atlas.json',
  'zh-CN/dicethrone/images/paladin/status-icons-atlas.json',
  'zh-CN/dicethrone/images/pyromancer/status-icons-atlas.json',
  'zh-CN/dicethrone/images/samurai/status-icons-atlas.json',
  'zh-CN/dicethrone/images/shadow_thief/status-icons-atlas.json',
  'zh-CN/dicethrone/images/treant/status-icons-atlas.json',
  'zh-CN/dicethrone/images/zhanshujia/status-icons-atlas.json',
  'zh-CN/qidahen/assets-manifest.json',
  'zh-CN/smashup/assets-manifest.json',
  'zh-CN/splendor/assets-manifest.json',
  'zh-CN/tictactoe/assets-manifest.json',
];
export const DIST_COMMON_JSON_RETAIN_RELATIVE_PATHS = [
  'assets-manifest.json',
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
  },
  'android-embedded': {
    allowedLocaleDirs: ['zh-CN'],
  },
  'ios-embedded': {
    allowedLocaleDirs: ['zh-CN'],
  },
};

const formatMb = (bytes) => `${(bytes / 1024 / 1024).toFixed(2)} MB`;

const sizeOf = (targetPath) => {
  if (!fs.existsSync(targetPath)) return 0;
  let total = 0;
  const stack = [targetPath];

  while (stack.length > 0) {
    const currentPath = stack.pop();
    const stat = fs.statSync(currentPath);
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
  };

  pruneLocales(profile.allowedLocaleDirs, stats);
  removeDirectoryIfExists(distI18nDir, stats);
  removeDirectoryIfExists(distLogosDir, stats);

  for (const dirName of COMMON_ASSET_DIR_NAMES_TO_REMOVE) {
    removeDirectoryIfExists(path.join(distCommonDir, dirName), stats);
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
  console.log(`[web-dist-prune] dist/assets: ${formatMb(stats.beforeBytes)} -> ${formatMb(stats.afterBytes)}`);
}
