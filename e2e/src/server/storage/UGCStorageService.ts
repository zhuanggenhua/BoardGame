/**
 * UGC 资源存储服务
 * 支持两种模式：
 * 1. 本地存储（开发/小规模）
 * 2. 对象存储（生产/大规模）
 */

import { writeFileSync, mkdirSync, existsSync, unlinkSync } from 'fs';
import { dirname, join } from 'path';
import type { S3Client } from '@aws-sdk/client-s3';

export interface UploadOptions {
  userId: string;
  packageId: string;
  fileName: string;
  fileBuffer: Buffer;
  contentType: string;
}

export interface StorageConfig {
  mode: 'local' | 'object-storage';
  
  // 本地存储配置
  localPath?: string; // 默认 ./uploads
  
  // 对象存储配置（可选）
  s3Client?: S3Client;
  bucketName?: string;
  publicUrlBase?: string; // 如 https://assets.example.com
}

function normalizePublicUrlBase(value?: string): string {
  if (!value) return '/assets';
  const trimmed = value.trim().replace(/\/+$/, '');
  if (!trimmed) return '/assets';
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('/')) {
    return trimmed;
  }
  return `/${trimmed}`;
}

export class UGCStorageService {
  private config: StorageConfig;
  private publicUrlBase: string;
  
  constructor(config: StorageConfig) {
    this.config = config;
    this.publicUrlBase = normalizePublicUrlBase(config.publicUrlBase);
    
    // 本地模式：确保目录存在
    if (config.mode === 'local') {
      const uploadDir = config.localPath || join(process.cwd(), 'uploads');
      if (!existsSync(uploadDir)) {
        mkdirSync(uploadDir, { recursive: true });
      }
    }
  }
  
  /**
   * 上传 UGC 资源
   */
  async upload(options: UploadOptions): Promise<string> {
    const { userId, packageId, fileName, fileBuffer, contentType } = options;
    
    // 路径：ugc/<userId>/<packageId>/<fileName>
    const relativePath = `ugc/${userId}/${packageId}/${fileName}`;
    
    if (this.config.mode === 'local') {
      return this.uploadToLocal(relativePath, fileBuffer);
    } else {
      return this.uploadToObjectStorage(relativePath, fileBuffer, contentType);
    }
  }
  
  /**
   * 上传到本地文件系统
   */
  private async uploadToLocal(relativePath: string, fileBuffer: Buffer): Promise<string> {
    const uploadDir = this.config.localPath || join(process.cwd(), 'uploads');
    const fullPath = join(uploadDir, relativePath);
    
    // 确保父目录存在
    const dir = dirname(fullPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    
    writeFileSync(fullPath, fileBuffer);
    
    // 返回访问 URL（相对路径）
    return `${this.publicUrlBase}/${relativePath}`;
  }
  
  /**
   * 上传到对象存储
   */
  private async uploadToObjectStorage(
    relativePath: string,
    fileBuffer: Buffer,
    contentType: string
  ): Promise<string> {
    if (!this.config.s3Client || !this.config.bucketName) {
      throw new Error('对象存储未配置');
    }
    
    // 动态导入（避免未安装 SDK 时报错）
    const { PutObjectCommand } = await import('@aws-sdk/client-s3');
    
    const command = new PutObjectCommand({
      Bucket: this.config.bucketName,
      Key: relativePath,
      Body: fileBuffer,
      ContentType: contentType,
    });
    
    await this.config.s3Client.send(command);
    
    // 返回公开访问 URL
    return `${this.publicUrlBase}/${relativePath}`;
  }
  
  /**
   * 从 URL 提取相对路径
   * URL 格式：{publicUrlBase}/{relativePath}
   */
  private extractRelativePath(url: string): string {
    const prefix = `${this.publicUrlBase}/`;
    if (url.startsWith(prefix)) {
      return url.slice(prefix.length);
    }
    // 兼容只传 relativePath 的情况
    return url;
  }

  /**
   * 删除资源
   */
  async delete(url: string): Promise<void> {
    const relativePath = this.extractRelativePath(url);

    if (this.config.mode === 'local') {
      return this.deleteFromLocal(relativePath);
    } else {
      return this.deleteFromObjectStorage(relativePath);
    }
  }

  /** 从本地文件系统删除 */
  private async deleteFromLocal(relativePath: string): Promise<void> {
    const uploadDir = this.config.localPath || join(process.cwd(), 'uploads');
    const fullPath = join(uploadDir, relativePath);
    if (existsSync(fullPath)) {
      unlinkSync(fullPath);
    }
  }

  /** 从对象存储删除 */
  private async deleteFromObjectStorage(relativePath: string): Promise<void> {
    if (!this.config.s3Client || !this.config.bucketName) {
      throw new Error('对象存储未配置');
    }
    const { DeleteObjectCommand } = await import('@aws-sdk/client-s3');
    const command = new DeleteObjectCommand({
      Bucket: this.config.bucketName,
      Key: relativePath,
    });
    await this.config.s3Client.send(command);
  }
}

/**
 * 工厂函数：根据环境变量创建存储服务
 */
export function createUGCStorageService(): UGCStorageService {
  const mode = process.env.UGC_STORAGE_MODE as 'local' | 'object-storage' || 'local';
  const publicUrlBase = process.env.UGC_PUBLIC_URL_BASE;
  
  if (mode === 'local') {
    return new UGCStorageService({
      mode: 'local',
      localPath: process.env.UGC_LOCAL_PATH,
      publicUrlBase,
    });
  }
  
  // 对象存储模式（需要额外配置）
  // 示例：使用 R2/OSS/COS
  return new UGCStorageService({
    mode: 'object-storage',
    publicUrlBase,
    // s3Client: ... 需要根据实际服务配置
    // bucketName: process.env.UGC_BUCKET_NAME,
    // publicUrlBase: process.env.UGC_PUBLIC_URL_BASE,
  });
}
