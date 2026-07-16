/**
 * 发布 public/assets 到 BoardGame 服务器素材源。
 *
 * 使用方式：
 *   npm run assets:upload             — 增量发布
 *   npm run assets:upload:force       — 强制发布所有可发布文件
 *   npm run assets:check              — 只检查本地待发布文件
 *   npm run assets:sync               — 发布并刷新安卓素材包；不删除服务器历史 release
 *   node scripts/assets/upload-to-server.js --asset-prefix i18n/zh-CN/summonerwars/hero/mogu
 *                                      — 只检查/发布指定 public/assets 相对路径前缀
 *   node scripts/assets/upload-to-server.js --android-package-publish-plan <path...> — 预演安卓素材包刷新
 */

import { createHash } from 'crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { extname, join, relative, sep } from 'path';
import { spawnSync } from 'child_process';
import mime from 'mime-types';
import { publishPrimaryAssetBatch } from './publish-primary-assets.mjs';

const COMPRESSED_EXTS = new Set(['.ogg', '.webp']);
const COMPRESSED_DIR_NAME = 'compressed';
const DIRECT_ASSET_EXTS = new Set(['.svg']);
const AUDIO_DIR_NAMES = new Set(['sfx', 'bgm']);
const CACHE_CONTROL_MEDIA = 'public, max-age=31536000, immutable';

const forceUpload = process.env.FORCE_UPLOAD === '1' || process.argv.includes('--force-upload');
const checkOnly = process.env.CHECK_ONLY === '1' || process.argv.includes('--check');
const skipAndroidPackagePublish = process.env.SKIP_ANDROID_PACKAGE_PUBLISH === '1' || process.argv.includes('--skip-android-package-publish');
const androidPackagePublishPlanArgIndex = process.argv.indexOf('--android-package-publish-plan');
const uploadBatchSize = Number.parseInt(process.env.ASSET_UPLOAD_BATCH_SIZE || '200', 10);

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

function normalizeRelativePrefix(value) {
  return value
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
    .replace(/^public\/assets\//, '')
    .replace(/^official\//, '')
    .replace(/\/+$/, '');
}

const assetPrefixes = readRepeatedArg('asset-prefix').map(normalizeRelativePrefix).filter(Boolean);

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

function formatAndroidPackagePublishCommands(plan) {
  if (plan.hasSharedAudioChanges) {
    return [
      `${process.execPath} scripts/mobile/publish-android-game-packages.mjs`,
    ];
  }

  return plan.gameIds.map((gameId) => (
    `${process.execPath} scripts/mobile/publish-android-game-packages.mjs --game ${gameId} --reuse-shared-audio --index-manifest-only`
  ));
}

function publishAndroidPackagesForUploadedAssets(gameIds, hasSharedAudioChanges) {
  if (skipAndroidPackagePublish || (gameIds.size === 0 && !hasSharedAudioChanges)) {
    return;
  }

  if (hasSharedAudioChanges) {
    console.log('\n检测到共享音频资源变更，刷新共享安卓素材包和全部游戏 manifest...');
    const result = spawnSync(
      process.execPath,
      ['scripts/mobile/publish-android-game-packages.mjs'],
      {
        cwd: process.cwd(),
        env: process.env,
        encoding: 'utf8',
        stdio: 'inherit',
      },
    );

    if (result.status !== 0) {
      throw new Error('共享安卓素材包发布失败');
    }
    return;
  }

  console.log(`\n检测到安卓素材包资源变更，刷新 ${gameIds.size} 个游戏 file-index/manifest 差异索引（不重发完整 ZIP）...`);

  const sortedGameIds = Array.from(gameIds).sort((left, right) => left.localeCompare(right));
  for (const gameId of sortedGameIds) {
    const result = spawnSync(
      process.execPath,
      ['scripts/mobile/publish-android-game-packages.mjs', '--game', gameId, '--reuse-shared-audio', '--index-manifest-only'],
      {
        cwd: process.cwd(),
        env: process.env,
        encoding: 'utf8',
        stdio: 'inherit',
      },
    );

    if (result.status !== 0) {
      throw new Error(`安卓素材包差异索引刷新失败: ${gameId}`);
    }
  }
}

function printAndroidPackagePublishPlan(paths) {
  const plan = resolveAndroidPackagePublishPlan(paths);
  const commands = formatAndroidPackagePublishCommands(plan);

  console.log('安卓素材包刷新预演');
  console.log(`游戏资源变更: ${plan.gameIds.length > 0 ? plan.gameIds.join(', ') : '无'}`);
  console.log(`共享音频变更: ${plan.hasSharedAudioChanges ? '是' : '否'}`);
  if (commands.length === 0) {
    console.log('刷新命令: 无');
    return;
  }

  console.log('刷新命令:');
  for (const command of commands) {
    console.log(`  ${command}`);
  }
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

function shouldUpload(filePath) {
  const ext = extname(filePath).toLowerCase();
  if (DIRECT_ASSET_EXTS.has(ext)) {
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

async function main() {
  if (androidPackagePublishPlanArgIndex >= 0) {
    const paths = process.argv.slice(androidPackagePublishPlanArgIndex + 1).filter((arg) => !arg.startsWith('--'));
    printAndroidPackagePublishPlan(paths);
    return;
  }

  const assetsDir = join(process.cwd(), 'public', 'assets');
  if (!existsSync(assetsDir)) {
    throw new Error(`本地素材目录不存在: ${assetsDir}`);
  }

  const files = getAllFiles(assetsDir)
    .filter((file) => matchesAssetPrefix(relative(assetsDir, file)))
    .filter(shouldUpload);
  const packageManagedGames = discoverPackageManagedGames();
  const uploadedPackageManagedGames = new Set();
  let hasUploadedSharedAudioAssets = false;

  console.log(`找到 ${files.length} 个符合条件的本地文件`);
  if (forceUpload) {
    console.log('强制模式：计划发布所有本地文件');
  }
  if (checkOnly) {
    console.log('检查模式：只列出会发布到服务器的对象');
  }
  if (assetPrefixes.length > 0) {
    console.log(`路径过滤：${assetPrefixes.join(', ')}`);
  }

  const uploadPlan = [];
  for (const file of files) {
    const relativePath = relative(assetsDir, file);
    const serverKey = `official/${relativePath.replace(/\\/g, '/')}`;
    const fileContent = readFileSync(file);
    uploadPlan.push({
      key: serverKey,
      body: fileContent,
      size: fileContent.length,
      contentType: mime.lookup(file) || 'application/octet-stream',
      cacheControl: CACHE_CONTROL_MEDIA,
      relativePath,
      md5: computeMD5(fileContent),
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
    publishAndroidPackagesForUploadedAssets(uploadedPackageManagedGames, hasUploadedSharedAudioAssets);
  }

  if (checkOnly) {
    console.log(`检查完成：待发布 ${uploadPlan.length} 个对象`);
  } else {
    console.log(`发布完成：服务器对象 ${uploadPlan.length} 个`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
