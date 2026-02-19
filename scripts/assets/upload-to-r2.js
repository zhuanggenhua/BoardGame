/**
 * 上传 public/assets 到 Cloudflare R2 对象存储
 * 
 * 使用方式：
 *   npm run assets:upload             — 增量上传（仅上传新增或变更的文件）
 *   npm run assets:upload:force       — 强制上传所有文件（跳过变更检测，用于更新 Cache-Control 等元数据）
 *   npm run assets:check              — 只检查差异，不上传
 *   npm run assets:sync               — 同步（上传新增/变更 + 删除远程多余文件）
 * 
 * 环境变量（在 .env 中配置）：
 * - R2_ACCOUNT_ID: Cloudflare 账户 ID
 * - R2_ACCESS_KEY_ID: R2 访问密钥 ID
 * - R2_SECRET_ACCESS_KEY: R2 访问密钥
 * - R2_BUCKET_NAME: R2 存储桶名称
 */

import 'dotenv/config';
import { S3Client, PutObjectCommand, ListObjectsV2Command, DeleteObjectsCommand } from '@aws-sdk/client-s3';
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative, extname, sep } from 'path';
import { createHash } from 'crypto';
import mime from 'mime-types';

// R2 配置
const R2_ENDPOINT = `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
const BUCKET_NAME = process.env.R2_BUCKET_NAME;
const COMPRESSED_EXTS = new Set(['.ogg', '.webp']);
const COMPRESSED_DIR_NAME = 'compressed';
const DATA_EXTS = new Set(['.json', '.svg']);
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

// 压缩媒体 + 数据文件（注册表、svg 等，但不包括 atlas.json）+ 音频文件
function shouldUpload(filePath) {
  const ext = extname(filePath).toLowerCase();
  // atlas.json 配置文件从本地加载，不上传到 CDN
  if (filePath.endsWith('.atlas.json')) {
    return false;
  }
  if (DATA_EXTS.has(ext)) {
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
// - 资源路径不含 content hash，同一路径内容可能更新
// - CDN 边缘缓存 1 天（s-maxage），更新后最多 24h 全网生效
// - 浏览器缓存也是 1 天（max-age），确保用户能及时拿到新资源
const CACHE_CONTROL_MEDIA = 'public, max-age=86400, s-maxage=86400';
// JSON/SVG 等数据文件可能更新较频繁，缓存 1 小时
const CACHE_CONTROL_DATA = 'public, max-age=3600, s-maxage=3600';

/** 根据文件类型返回合适的 Cache-Control */
function getCacheControl(localPath) {
  const ext = extname(localPath).toLowerCase();
  if (DATA_EXTS.has(ext)) return CACHE_CONTROL_DATA;
  return CACHE_CONTROL_MEDIA;
}

// 上传单个文件
async function uploadFile(fileContent, remotePath, localPath) {
  const contentType = mime.lookup(localPath) || 'application/octet-stream';
  
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: remotePath,
    Body: fileContent,
    ContentType: contentType,
    CacheControl: getCacheControl(localPath),
  });
  
  await s3Client.send(command);
}

// 主函数
async function main() {
  const assetsDir = join(process.cwd(), 'public', 'assets');
  const files = getAllFiles(assetsDir).filter(shouldUpload);
  
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
      console.log(`\n🗑️  删除远程多余文件 ${toDelete.length} 个...`);
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
    console.log(`\n✨ 上传完成！上传 ${uploaded}，跳过 ${skipped}（未变更），删除 ${deleted}，失败 ${failed}`);
  }
}

main().catch(console.error);
