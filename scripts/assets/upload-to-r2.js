/**
 * 上传 public/assets 到 Cloudflare R2 对象存储
 * 
 * 使用方式：
 *   npm run assets:upload             — 增量上传（仅上传新增或变更的文件）
 *   npm run assets:upload:force       — 强制上传所有文件（跳过变更检测，用于更新 Cache-Control 等元数据）
 *   npm run assets:check              — 只检查差异，不上传
 *   npm run assets:sync               — 同步（上传新增/变更 + 列出远程多余文件，不删除）
 *   npm run assets:sync -- --confirm  — 同步 + 删除远程多余文件（≤50 个时）
 *   npm run assets:sync -- --confirm --force-delete — 同步 + 强制删除（超过 50 个时）
 *   node scripts/assets/upload-to-r2.js --android-package-publish-plan <path...> — 预演给定上传路径会刷新哪些安卓素材包
 * 
 * 环境变量（在 .env 中配置）：
 * - R2_ACCOUNT_ID: Cloudflare 账户 ID
 * - R2_ACCESS_KEY_ID: R2 访问密钥 ID
 * - R2_SECRET_ACCESS_KEY: R2 访问密钥
 * - R2_BUCKET_NAME: R2 存储桶名称
 */

import { config } from 'dotenv';
import { existsSync } from 'fs';
import { S3Client, PutObjectCommand, ListObjectsV2Command, DeleteObjectsCommand } from '@aws-sdk/client-s3';
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative, extname, sep } from 'path';
import { createHash } from 'crypto';
import { spawnSync } from 'child_process';
import mime from 'mime-types';

// 加载环境变量：先读 .env，再用 .env.example 补齐缺失键
if (existsSync('.env')) {
  config({ path: '.env', override: false });
}
if (existsSync('.env.example')) {
  config({ path: '.env.example', override: false });
}

// R2 配置
const R2_ENDPOINT = `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
const BUCKET_NAME = process.env.R2_BUCKET_NAME;
const COMPRESSED_EXTS = new Set(['.ogg', '.webp']);
const COMPRESSED_DIR_NAME = 'compressed';
const DIRECT_ASSET_EXTS = new Set(['.svg']);
const AUDIO_DIR_NAMES = new Set(['sfx', 'bgm']);

// S3 客户端
const s3Client = new S3Client({
  region: 'auto',
  endpoint: R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

// 支持环境变量（npm 脚本传参）和 CLI 参数两种方式
const forceUpload = process.env.FORCE_UPLOAD === '1' || process.argv.includes('--force-upload');
const checkOnly = process.env.CHECK_ONLY === '1' || process.argv.includes('--check');
const syncMode = process.env.SYNC_MODE === '1' || process.argv.includes('--sync');
const confirmDelete = process.argv.includes('--confirm');
const forceDelete = process.argv.includes('--force-delete');
const skipAndroidPackagePublish = process.env.SKIP_ANDROID_PACKAGE_PUBLISH === '1' || process.argv.includes('--skip-android-package-publish');
const androidPackagePublishPlanArgIndex = process.argv.indexOf('--android-package-publish-plan');
const DELETE_THRESHOLD = 50; // 超过此数量需要 --force-delete

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
    console.log('\n📱 检测到共享音频资源变更，刷新共享安卓素材包和全部游戏 manifest...');
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

  console.log(`\n📱 检测到安卓素材包资源变更，刷新 ${gameIds.size} 个游戏 file-index/manifest 差异索引（不重发完整 ZIP）...`);

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

  console.log('📱 安卓素材包刷新预演');
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

// 递归获取所有文件
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

// 压缩媒体 + SVG + 音频文件（JSON 配置文件从本地加载，不上传到 CDN）
function shouldUpload(filePath) {
  const ext = extname(filePath).toLowerCase();
  if (DIRECT_ASSET_EXTS.has(ext)) {
    return true;
  }
  const parts = filePath.split(sep);
  // 音频目录（sfx/、bgm/）下的 .ogg 直接上传
  if (ext === '.ogg' && parts.some(p => AUDIO_DIR_NAMES.has(p))) {
    return true;
  }
  return parts.includes(COMPRESSED_DIR_NAME) && COMPRESSED_EXTS.has(ext);
}

// 计算文件内容的 MD5 哈希
function computeMD5(buffer) {
  return createHash('md5').update(buffer).digest('hex');
}

// 获取远程所有对象的 ETag 映射
async function listRemoteObjects(prefix) {
  const remoteMap = new Map();
  let continuationToken;
  
  do {
    const command = new ListObjectsV2Command({
      Bucket: BUCKET_NAME,
      Prefix: prefix,
      ContinuationToken: continuationToken,
    });
    const response = await s3Client.send(command);
    
    if (response.Contents) {
      for (const obj of response.Contents) {
        // R2 ETag 是 MD5 哈希值（带引号），例如 "abc123def456"
        const etag = obj.ETag?.replace(/"/g, '');
        remoteMap.set(obj.Key, etag);
      }
    }
    
    continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
  } while (continuationToken);
  
  return remoteMap;
}

// 静态资源缓存策略：
// - 运行时 URL 会自动追加 ?v=<content-hash>，内容变更后 URL 立刻变化。
// - 因此媒体资源（webp、ogg、svg）可以安全使用长期 immutable 缓存。
// - 如需仅更新对象元数据（例如 Cache-Control），使用 npm run assets:upload:force。
const CACHE_CONTROL_MEDIA = 'public, max-age=31536000, immutable';

// 上传单个文件
async function uploadFile(fileContent, remotePath, localPath) {
  const contentType = mime.lookup(localPath) || 'application/octet-stream';
  
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: remotePath,
    Body: fileContent,
    ContentType: contentType,
    CacheControl: CACHE_CONTROL_MEDIA,
  });
  
  await s3Client.send(command);
}

// 主函数
async function main() {
  if (androidPackagePublishPlanArgIndex >= 0) {
    const paths = process.argv.slice(androidPackagePublishPlanArgIndex + 1).filter((arg) => !arg.startsWith('--'));
    printAndroidPackagePublishPlan(paths);
    return;
  }

  const assetsDir = join(process.cwd(), 'public', 'assets');
  const files = getAllFiles(assetsDir).filter(shouldUpload);
  const packageManagedGames = discoverPackageManagedGames();
  const uploadedPackageManagedGames = new Set();
  let hasUploadedSharedAudioAssets = false;
  
  console.log(`📦 找到 ${files.length} 个符合条件的本地文件`);
  
  // 获取远程文件列表
  let remoteMap = new Map();
  if (!forceUpload) {
    console.log('🔍 获取远程文件列表进行变更检测...');
    remoteMap = await listRemoteObjects('official/');
    console.log(`   远程共 ${remoteMap.size} 个文件\n`);
  } else {
    console.log('⚡ 强制模式：跳过变更检测，上传所有文件\n');
  }
  
  if (checkOnly) {
    console.log('📋 检查模式：仅对比本地与远程差异\n');
  }
  
  let uploaded = 0;
  let skipped = 0;
  let failed = 0;
  let newFiles = 0;
  let changed = 0;
  
  for (const file of files) {
    const relativePath = relative(join(process.cwd(), 'public', 'assets'), file);
    const remotePath = `official/${relativePath.replace(/\\/g, '/')}`;
    const packageManagedGameId = resolvePackageManagedGameId(relativePath, packageManagedGames);
    
    try {
      const fileContent = readFileSync(file);
      const localMD5 = computeMD5(fileContent);
      const localSize = fileContent.length;
      
      if (!forceUpload) {
        const remoteETag = remoteMap.get(remotePath);
        
        if (!remoteETag) {
          // 新文件
          newFiles++;
          if (checkOnly) {
            console.log(`🆕 ${remotePath}  (${localSize} bytes, md5=${localMD5})`);
            continue;
          }
        } else if (remoteETag === localMD5) {
          // 未变更
          skipped++;
          continue;
        } else {
          // 内容变更
          changed++;
          if (checkOnly) {
            console.log(`🔄 ${remotePath}`);
            console.log(`   本地 md5=${localMD5}  远程 etag=${remoteETag}`);
            continue;
          }
        }
      }
      
      await uploadFile(fileContent, remotePath, file);
      console.log(`✅ ${remotePath}`);
      uploaded++;
      if (packageManagedGameId) {
        uploadedPackageManagedGames.add(packageManagedGameId);
      }
      if (isSharedAudioAsset(relativePath)) {
        hasUploadedSharedAudioAssets = true;
      }
    } catch (error) {
      console.error(`❌ ${remotePath}: ${error.message}`);
      failed++;
    }
  }
  
  // 同步模式：删除远程多余的文件
  let deleted = 0;
  if (syncMode && !checkOnly) {
    const localKeys = new Set(files.map(f => {
      const rel = relative(join(process.cwd(), 'public', 'assets'), f);
      return `official/${rel.replace(/\\/g, '/')}`;
    }));
    
    const toDelete = [];
    for (const remoteKey of remoteMap.keys()) {
      if (!localKeys.has(remoteKey)) {
        toDelete.push(remoteKey);
      }
    }
    
    if (toDelete.length > 0) {
      console.log(`\n⚠️  发现 ${toDelete.length} 个远程多余文件：`);
      for (const key of toDelete.slice(0, 20)) {
        console.log(`   ${key}`);
      }
      if (toDelete.length > 20) {
        console.log(`   ... 还有 ${toDelete.length - 20} 个`);
      }

      // 保护层 1：必须 --confirm 才真删
      if (!confirmDelete) {
        console.log(`\n🛡️  安全保护：这些文件可能是其他合作者上传的。`);
        console.log(`   如确认要删除，请加 --confirm 参数：npm run assets:sync -- --confirm`);
        console.log(`   跳过删除，仅上传已完成。`);
      }
      // 保护层 2：超过阈值需要 --force-delete
      else if (toDelete.length > DELETE_THRESHOLD && !forceDelete) {
        console.log(`\n🚨  删除数量 ${toDelete.length} 超过安全阈值 ${DELETE_THRESHOLD}，可能存在本地资源缺失。`);
        console.log(`   请先运行 npm run assets:download 补齐本地资源，或确认后加 --force-delete：`);
        console.log(`   npm run assets:sync -- --confirm --force-delete`);
        console.log(`   跳过删除，仅上传已完成。`);
      }
      else {
        console.log(`\n🗑️  正在删除...`);
        // 批量删除（每次最多 1000 个）
        for (let i = 0; i < toDelete.length; i += 1000) {
          const batch = toDelete.slice(i, i + 1000);
          const command = new DeleteObjectsCommand({
            Bucket: BUCKET_NAME,
            Delete: { Objects: batch.map(Key => ({ Key })) },
          });
          await s3Client.send(command);
          deleted += batch.length;
          for (const key of batch) {
            console.log(`🗑️  ${key}`);
          }
        }
      }
    }
  } else if (checkOnly) {
    // 检查模式下也列出远程多余的文件
    const localKeys = new Set(files.map(f => {
      const rel = relative(join(process.cwd(), 'public', 'assets'), f);
      return `official/${rel.replace(/\\/g, '/')}`;
    }));
    
    const orphaned = [];
    for (const remoteKey of remoteMap.keys()) {
      if (!localKeys.has(remoteKey)) {
        orphaned.push(remoteKey);
      }
    }
    
    if (orphaned.length > 0) {
      console.log(`\n🗑️  远程多余文件（本地不存在）：${orphaned.length} 个`);
      for (const key of orphaned.slice(0, 20)) {
        console.log(`   ${key}`);
      }
      if (orphaned.length > 20) {
        console.log(`   ... 还有 ${orphaned.length - 20} 个`);
      }
    }
  }
  
  if (checkOnly) {
    console.log(`\n📋 检查完成！新增 ${newFiles}，变更 ${changed}，未变更 ${skipped}`);
  } else {
    if (failed === 0) {
      publishAndroidPackagesForUploadedAssets(uploadedPackageManagedGames, hasUploadedSharedAudioAssets);
    } else if (uploadedPackageManagedGames.size > 0 || hasUploadedSharedAudioAssets) {
      console.log('\n⚠️  存在上传失败，跳过安卓素材包刷新，避免发布不完整素材包。');
    }
    console.log(`\n✨ 上传完成！上传 ${uploaded}，跳过 ${skipped}（未变更），删除 ${deleted}，失败 ${failed}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
