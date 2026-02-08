/**
 * 上传 public/assets 到 Cloudflare R2 对象存储
 * 
 * 使用方式：npm run assets:upload
 * 
 * 环境变量（在 .env 中配置）：
 * - R2_ACCOUNT_ID: Cloudflare 账户 ID
 * - R2_ACCESS_KEY_ID: R2 访问密钥 ID
 * - R2_SECRET_ACCESS_KEY: R2 访问密钥
 * - R2_BUCKET_NAME: R2 存储桶名称
 */

import 'dotenv/config';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative, extname, sep } from 'path';
import mime from 'mime-types';

// R2 配置
const R2_ENDPOINT = `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
const BUCKET_NAME = process.env.R2_BUCKET_NAME;
const ALLOWED_EXTS = new Set(['.ogg', '.webp', '.avif']);
const COMPRESSED_DIR_NAME = 'compressed';

// S3 客户端（R2 兼容 S3 API）
const s3Client = new S3Client({
  region: 'auto',
  endpoint: R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

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

function shouldUpload(filePath) {
  const parts = filePath.split(sep);
  if (!parts.includes(COMPRESSED_DIR_NAME)) {
    return false;
  }
  const ext = extname(filePath).toLowerCase();
  return ALLOWED_EXTS.has(ext);
}

// 上传单个文件
async function uploadFile(localPath, remotePath) {
  const fileContent = readFileSync(localPath);
  const contentType = mime.lookup(localPath) || 'application/octet-stream';
  
  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: remotePath,
    Body: fileContent,
    ContentType: contentType,
  });
  
  try {
    await s3Client.send(command);
    console.log(`✅ ${remotePath}`);
  } catch (error) {
    console.error(`❌ ${remotePath}: ${error.message}`);
  }
}

// 主函数
async function main() {
  const assetsDir = join(process.cwd(), 'public', 'assets');
  const files = getAllFiles(assetsDir).filter(shouldUpload);
  
  console.log(`📦 找到 ${files.length} 个文件，开始上传到 R2...\n`);
  
  for (const file of files) {
    // 计算相对路径
    const relativePath = relative(join(process.cwd(), 'public', 'assets'), file);
    
    // R2 存储路径：official/<gameId>/...
    const remotePath = `official/${relativePath.replace(/\\/g, '/')}`;
    
    await uploadFile(file, remotePath);
  }
  
  console.log(`\n✨ 上传完成！`);
}

main().catch(console.error);
