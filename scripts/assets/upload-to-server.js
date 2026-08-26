/**
 * 发布 public/assets 到 BoardGame 服务器素材源。
 *
 * 使用方式：
 *   npm run assets:upload             — 增量发布
 *   npm run assets:upload:force       — 强制发布所有可发布文件
 *   npm run assets:check              — 只检查本地待发布文件
 *   npm run assets:sync               — 发布并刷新安卓素材包；不删除服务器历史 release
 *   node scripts/assets/upload-to-server.js --asset-prefix i18n/zh-CN/summonerwars/hero/mogu
 *   node scripts/assets/upload-to-server.js i18n/zh-CN/summonerwars/hero/mogu
 *                                      — 只检查/发布指定 public/assets 相对路径前缀
 *   node scripts/assets/upload-to-server.js --android-package-publish-plan <path...> — 预演安卓素材包刷新
 */

import { createHash } from 'crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { extname, join, relative, sep } from 'path';
import mime from 'mime-types';
import {
  fetchAssetPublishInventory,
  publishPrimaryAssetBatch,
  resolveAssetUploadUrl,
} from './publish-primary-assets.mjs';

const COMPRESSED_EXTS = new Set(['.ogg', '.webp']);
const COMPRESSED_DIR_NAME = 'compressed';
const DIRECT_ASSET_EXTS = new Set(['.svg']);
const PACKAGE_RUNTIME_CONFIG_EXTS = new Set(['.json']);
const AUDIO_DIR_NAMES = new Set(['sfx', 'bgm']);
const CACHE_CONTROL_MEDIA = 'public, max-age=31536000, immutable';

const forceUpload = process.env.FORCE_UPLOAD === '1' || process.argv.includes('--force-upload');
const checkOnly = process.env.CHECK_ONLY === '1' || process.argv.includes('--check');
const androidPackagePublishPlanArgIndex = process.argv.indexOf('--android-package-publish-plan');
const uploadBatchSize = Number.parseInt(process.env.ASSET_UPLOAD_BATCH_SIZE || '200', 10);
const npmLifecycleEvent = process.env.npm_lifecycle_event || process.env.NPM_LIFECYCLE_EVENT || '';

function readRepeatedArg(name) {
  const values = [];
  const flag = `--${name}`;
  for (let index = 0; index < process.argv.length; index += 1) {
    const arg = process.argv[index];
    if (arg === flag && process.argv[index + 1]) {
      values.push(process.argv[index + 1]);
      index += 1;
      continue;
    }
    if (arg.startsWith(`${flag}=`)) {
      values.push(arg.slice(flag.length + 1));
    }
  }
  return values;
}

function hasRepeatedArg(name) {
  const flag = `--${name}`;
  return process.argv.some((arg) => arg === flag || arg.startsWith(`${flag}=`));
}

function readPositionalAssetPrefixes() {
  const values = [];
  const args = process.argv.slice(2);

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--android-package-publish-plan') {
      break;
    }
    if (arg === '--asset-prefix') {
      index += 1;
      continue;
    }
    if (arg.startsWith('--asset-prefix=')) {
      continue;
    }
    if (arg.startsWith('--')) {
      continue;
    }
    values.push(arg);
  }

  return values;
}

function normalizeRelativePrefix(value) {
  return value
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
    .replace(/^public\/assets\//, '')
    .replace(/^official\//, '')
    .replace(/\/+$/, '');
}

const repeatedAssetPrefixes = readRepeatedArg('asset-prefix');
const positionalAssetPrefixes = readPositionalAssetPrefixes();
const assetPrefixes = Array.from(new Set([
  ...repeatedAssetPrefixes,
  ...positionalAssetPrefixes,
].map(normalizeRelativePrefix).filter(Boolean)));

function assertSafeNpmArgumentForwarding() {
  if (
    npmLifecycleEvent.startsWith('assets:upload')
    && positionalAssetPrefixes.length > 0
    && !hasRepeatedArg('asset-prefix')
  ) {
    throw new Error(
      '检测到 npm 未把 --asset-prefix/--check 正确传给上传脚本。'
      + ' 为避免误把检查命令变成真实发布，请改用: '
      + 'npm run assets:upload -- -- --check --asset-prefix <path>，'
      + '或直接运行 node scripts/assets/upload-to-server.js --check --asset-prefix <path>。',
    );
  }
}

function matchesAssetPrefix(relativePath) {
  if (assetPrefixes.length === 0) return true;
  const normalized = relativePath.replace(/\\/g, '/');
  const extension = extname(normalized);
  const normalizedWithoutExtension = extension ? normalized.slice(0, -extension.length) : normalized;
  return assetPrefixes.some((prefix) => (
    normalized === prefix
    || normalizedWithoutExtension === prefix
    || normalized.startsWith(`${prefix}/`)
  ));
}

function chunkArray(items, chunkSize) {
  const safeChunkSize = Number.isFinite(chunkSize) && chunkSize > 0 ? chunkSize : 200;
  const chunks = [];
  for (let index = 0; index < items.length; index += safeChunkSize) {
    chunks.push(items.slice(index, index + safeChunkSize));
  }
  return chunks;
}

function discoverPackageManagedGames() {
  const gamesRoot = join(process.cwd(), 'src', 'games');
  const gameIds = new Set();

  if (!existsSync(gamesRoot)) {
    return gameIds;
  }

  for (const entry of readdirSync(gamesRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const manifestPath = join(gamesRoot, entry.name, 'manifest.ts');
    if (!existsSync(manifestPath)) continue;

    const content = readFileSync(manifestPath, 'utf8');
    if (!/mode:\s*'package-managed'/.test(content)) continue;

    const idMatch = content.match(/id:\s*'([^']+)'/);
    const gameId = idMatch?.[1]?.trim();
    if (gameId) {
      gameIds.add(gameId);
    }
  }

  return gameIds;
}

function resolvePackageManagedGameId(relativePath, packageManagedGames) {
  const normalized = relativePath.replace(/\\/g, '/');
  const parts = normalized.split('/');

  if (parts[0] === 'atlas-configs' && packageManagedGames.has(parts[1])) {
    return parts[1];
  }

  if (parts[0] === 'i18n' && packageManagedGames.has(parts[2])) {
    return parts[2];
  }

  if (packageManagedGames.has(parts[0])) {
    return parts[0];
  }

  return null;
}

function isSharedAudioAsset(relativePath) {
  return relativePath.replace(/\\/g, '/').startsWith('common/audio/');
}

function normalizeUploadedAssetPath(inputPath) {
  const normalized = inputPath.replace(/\\/g, '/');
  const officialPrefix = 'official/';
  const assetsPrefix = 'public/assets/';

  if (normalized.startsWith(officialPrefix)) {
    return normalized.slice(officialPrefix.length);
  }

  if (normalized.startsWith(assetsPrefix)) {
    return normalized.slice(assetsPrefix.length);
  }

  return normalized.replace(/^\/+/, '');
}

function resolveAndroidPackagePublishPlan(relativePaths) {
  const packageManagedGames = discoverPackageManagedGames();
  const gameIds = new Set();
  let hasSharedAudioChanges = false;

  for (const relativePath of relativePaths) {
    const normalizedPath = normalizeUploadedAssetPath(relativePath);
    const gameId = resolvePackageManagedGameId(normalizedPath, packageManagedGames);
    if (gameId) {
      gameIds.add(gameId);
    }
    if (isSharedAudioAsset(normalizedPath)) {
      hasSharedAudioChanges = true;
    }
  }

  return {
    gameIds: Array.from(gameIds).sort((left, right) => left.localeCompare(right)),
    hasSharedAudioChanges,
  };
}

function printAndroidPackagePublishPlan(paths) {
  const plan = resolveAndroidPackagePublishPlan(paths);

  console.log('安卓素材包刷新预演');
  console.log(`游戏资源变更: ${plan.gameIds.length > 0 ? plan.gameIds.join(', ') : '无'}`);
  console.log(`共享音频变更: ${plan.hasSharedAudioChanges ? '是' : '否'}`);
  if (plan.gameIds.length === 0 && !plan.hasSharedAudioChanges) {
    console.log('服务器自动刷新: 无');
    return;
  }
  if (plan.hasSharedAudioChanges) {
    console.log('服务器自动刷新: 共享音频暂未接入自动刷新，正式发布会中断并要求走共享音频发布流程');
    return;
  }
  console.log('服务器自动刷新: 发布入口会在服务器 release 内刷新已有 channel 的 file-index/manifest/games latest');
}

function getAllFiles(dir, fileList = []) {
  const files = readdirSync(dir);

  for (const file of files) {
    const filePath = join(dir, file);
    const stat = statSync(filePath);

    if (stat.isDirectory()) {
      getAllFiles(filePath, fileList);
    } else {
      fileList.push(filePath);
    }
  }

  return fileList;
}

function resolveScanRoots(assetsDir) {
  if (assetPrefixes.length === 0) {
    return [assetsDir];
  }

  const roots = new Set();
  for (const prefix of assetPrefixes) {
    const segments = prefix.split('/').filter(Boolean);
    let candidate = join(assetsDir, ...segments);

    if (existsSync(candidate)) {
      roots.add(candidate);
      continue;
    }

    // Prefixes without an extension can target a single file stem.
    // Scan the nearest existing parent instead of the whole asset tree.
    while (segments.length > 0) {
      segments.pop();
      candidate = join(assetsDir, ...segments);
      if (existsSync(candidate)) {
        roots.add(candidate);
        break;
      }
    }
  }

  return roots.size > 0 ? Array.from(roots) : [assetsDir];
}

function getFilesFromScanRoot(scanRoot) {
  const stat = statSync(scanRoot);
  if (stat.isDirectory()) {
    return getAllFiles(scanRoot);
  }
  if (stat.isFile()) {
    return [scanRoot];
  }
  return [];
}

function shouldUpload(filePath, relativePath, packageManagedGames) {
  const ext = extname(filePath).toLowerCase();
  if (DIRECT_ASSET_EXTS.has(ext)) {
    return true;
  }
  if (PACKAGE_RUNTIME_CONFIG_EXTS.has(ext) && resolvePackageManagedGameId(relativePath, packageManagedGames)) {
    return true;
  }
  const parts = filePath.split(sep);
  if (ext === '.ogg' && parts.some((part) => AUDIO_DIR_NAMES.has(part))) {
    return true;
  }
  return parts.includes(COMPRESSED_DIR_NAME) && COMPRESSED_EXTS.has(ext);
}

function computeMD5(buffer) {
  return createHash('md5').update(buffer).digest('hex');
}

function computeSHA256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

async function main() {
  assertSafeNpmArgumentForwarding();

  if (androidPackagePublishPlanArgIndex >= 0) {
    const paths = process.argv.slice(androidPackagePublishPlanArgIndex + 1).filter((arg) => !arg.startsWith('--'));
    printAndroidPackagePublishPlan(paths);
    return;
  }

  const assetsDir = join(process.cwd(), 'public', 'assets');
  if (!existsSync(assetsDir)) {
    throw new Error(`本地素材目录不存在: ${assetsDir}`);
  }

  const packageManagedGames = discoverPackageManagedGames();
  const files = resolveScanRoots(assetsDir)
    .flatMap((scanRoot) => getFilesFromScanRoot(scanRoot))
    .filter((file) => matchesAssetPrefix(relative(assetsDir, file)))
    .filter((file) => shouldUpload(file, relative(assetsDir, file), packageManagedGames));
  const uploadedPackageManagedGames = new Set();
  let hasUploadedSharedAudioAssets = false;

  const uploadUrl = resolveAssetUploadUrl();
  const remoteInventory = uploadUrl
    ? await fetchAssetPublishInventory({
      uploadUrl,
    })
    : null;

  console.log(`找到 ${files.length} 个符合条件的本地文件`);
  if (remoteInventory) {
    console.log(`已获取服务器对象清单：${remoteInventory.size} 个 official 对象`);
  } else {
    console.log('当前使用 SSH 发布，跳过远端差异查询；将发布扫描到的全部对象');
  }
  if (forceUpload) {
    console.log('强制模式：计划发布所有本地文件');
  }
  if (checkOnly) {
    console.log('检查模式：只列出会发布到服务器的对象');
  }
  if (assetPrefixes.length > 0) {
    console.log(`路径过滤：${assetPrefixes.join(', ')}`);
  }

  const listExplicitCheckMatches = checkOnly && assetPrefixes.length > 0;
  const uploadPlan = [];
  let skippedUnchanged = 0;
  for (const file of files) {
    const relativePath = relative(assetsDir, file);
    const serverKey = `official/${relativePath.replace(/\\/g, '/')}`;
    const fileContent = readFileSync(file);
    const sha256 = computeSHA256(fileContent);
    const remoteObject = remoteInventory?.get(serverKey);
    if (
      !forceUpload
      && !listExplicitCheckMatches
      && remoteObject
      && remoteObject.size === fileContent.length
      && remoteObject.sha256 === sha256
    ) {
      skippedUnchanged += 1;
      continue;
    }
    uploadPlan.push({
      key: serverKey,
      body: fileContent,
      size: fileContent.length,
      contentType: mime.lookup(file) || 'application/octet-stream',
      cacheControl: CACHE_CONTROL_MEDIA,
      relativePath,
      md5: computeMD5(fileContent),
      sha256,
      packageManagedGameId: resolvePackageManagedGameId(relativePath, packageManagedGames),
    });
  }

  for (const entry of uploadPlan) {
    if (checkOnly) {
      console.log(`待发布: ${entry.key} (${entry.size} bytes, md5=${entry.md5})`);
    }
  }

  if (assetPrefixes.length > 0 && uploadPlan.length === 0) {
    throw new Error(`路径过滤没有匹配到可发布对象: ${assetPrefixes.join(', ')}`);
  }

  if (!checkOnly && uploadPlan.length > 0) {
    const uploadBatches = chunkArray(uploadPlan.map((entry) => ({
      key: entry.key,
      body: entry.body,
      size: entry.size,
      contentType: entry.contentType,
      cacheControl: entry.cacheControl,
    })), uploadBatchSize);
    console.log(`分批发布服务器对象：${uploadBatches.length} 批，每批最多 ${uploadBatchSize} 个`);
    for (let index = 0; index < uploadBatches.length; index += 1) {
      console.log(`发布服务器对象批次 ${index + 1}/${uploadBatches.length}: ${uploadBatches[index].length} 个`);
      await publishPrimaryAssetBatch(uploadBatches[index]);
    }
    for (const entry of uploadPlan) {
      console.log(`已发布: ${entry.key}`);
      if (entry.packageManagedGameId) {
        uploadedPackageManagedGames.add(entry.packageManagedGameId);
      }
      if (isSharedAudioAsset(entry.relativePath)) {
        hasUploadedSharedAudioAssets = true;
      }
    }
    if (uploadedPackageManagedGames.size > 0 || hasUploadedSharedAudioAssets) {
      console.log(
        '\n安卓素材包刷新交给服务器发布入口自动执行：'
        + `游戏=${uploadedPackageManagedGames.size > 0 ? [...uploadedPackageManagedGames].sort().join(',') : '无'} `
        + `共享音频=${hasUploadedSharedAudioAssets ? '是' : '否'}`,
      );
    }
  }

  if (checkOnly) {
    console.log(`检查完成：待发布 ${uploadPlan.length} 个对象，跳过未变化 ${skippedUnchanged} 个`);
  } else {
    console.log(`发布完成：服务器对象 ${uploadPlan.length} 个，跳过未变化 ${skippedUnchanged} 个`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
