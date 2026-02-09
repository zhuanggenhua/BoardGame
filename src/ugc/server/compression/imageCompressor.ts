/**
 * UGC 图片压缩器
 * 
 * 使用 sharp 库将图片压缩为 WebP 格式（不保留原图）
 */

import type {
    AssetVariant,
    ImageCompressionConfig,
    ImageMetadata,
} from '../../assets/types';
import {
    DEFAULT_IMAGE_COMPRESSION,
    COMPRESSED_IMAGE_FORMATS,
    generateAssetPath,
} from '../../assets/types';

// ============================================================================
// 类型定义
// ============================================================================

/** 压缩输入 */
export interface ImageCompressionInput {
    /** 原始文件 Buffer */
    buffer: Buffer;
    /** 原始文件名 */
    filename: string;
    /** 原始格式 */
    format: string;
    /** 用户 ID */
    userId: string;
    /** 游戏包 ID */
    packageId: string;
    /** 资产 ID */
    assetId: string;
}

/** 压缩输出 */
export interface ImageCompressionOutput {
    /** 是否成功 */
    success: boolean;
    /** 错误信息 */
    error?: string;
    /** 是否跳过（已是压缩格式） */
    skipped: boolean;
    /** 压缩后的 Buffer */
    compressedBuffer?: Buffer;
    /** 变体信息 */
    variant?: AssetVariant;
    /** 元数据 */
    metadata?: ImageMetadata;
}

// ============================================================================
// 图片压缩器
// ============================================================================

export class ImageCompressor {
    private config: ImageCompressionConfig;

    constructor(config: Partial<ImageCompressionConfig> = {}) {
        this.config = { ...DEFAULT_IMAGE_COMPRESSION, ...config };
    }

    /** 检查是否需要压缩 */
    shouldCompress(format: string): boolean {
        const lower = format.toLowerCase().replace('.', '');
        return !COMPRESSED_IMAGE_FORMATS.includes(lower as typeof COMPRESSED_IMAGE_FORMATS[number]);
    }

    /** 压缩图片 */
    async compress(input: ImageCompressionInput): Promise<ImageCompressionOutput> {
        const formatLower = input.format.toLowerCase().replace('.', '');

        // 已是压缩格式，跳过
        if (!this.shouldCompress(formatLower)) {
            return {
                success: true,
                skipped: true,
                compressedBuffer: input.buffer,
                variant: {
                    id: `${input.assetId}-original`,
                    format: formatLower,
                    path: generateAssetPath(input.userId, input.packageId, input.assetId, formatLower),
                    size: input.buffer.length,
                    hash: this.generateHash(input.buffer),
                    url: '',
                },
                metadata: await this.extractMetadata(input.buffer),
            };
        }

        try {
            // 动态导入 sharp（避免在未安装时报错）
            const sharp = await this.loadSharp();
            if (!sharp) {
                // 如果 sharp 不可用，返回原图
                return {
                    success: true,
                    skipped: true,
                    compressedBuffer: input.buffer,
                    error: 'sharp 库未安装，跳过压缩',
                };
            }

            // 获取原始图片信息
            const image = sharp(input.buffer);
            const originalMeta = await image.metadata();

            // 计算目标尺寸（保持宽高比）
            let width = originalMeta.width || 0;
            let height = originalMeta.height || 0;

            if (this.config.maxWidth && width > this.config.maxWidth) {
                height = Math.round(height * (this.config.maxWidth / width));
                width = this.config.maxWidth;
            }
            if (this.config.maxHeight && height > this.config.maxHeight) {
                width = Math.round(width * (this.config.maxHeight / height));
                height = this.config.maxHeight;
            }

            // 压缩为 WebP
            const compressedBuffer = await image
                .resize(width, height, { fit: 'inside', withoutEnlargement: true })
                .webp({ quality: this.config.quality })
                .toBuffer();

            const targetFormat = this.config.targetFormat;
            const variantPath = generateAssetPath(input.userId, input.packageId, input.assetId, targetFormat);

            return {
                success: true,
                skipped: false,
                compressedBuffer,
                variant: {
                    id: `${input.assetId}-${targetFormat}`,
                    format: targetFormat,
                    path: variantPath,
                    size: compressedBuffer.length,
                    hash: this.generateHash(compressedBuffer),
                    url: '',
                },
                metadata: {
                    width,
                    height,
                    hasAlpha: originalMeta.hasAlpha || false,
                },
            };
        } catch (error) {
            return {
                success: false,
                skipped: false,
                error: error instanceof Error ? error.message : '图片压缩失败',
            };
        }
    }

    /** 提取图片元数据（不使用 sharp） */
    private async extractMetadata(buffer: Buffer): Promise<ImageMetadata> {
        // 简单的 PNG/JPEG 尺寸提取
        try {
            // PNG
            if (buffer[0] === 0x89 && buffer[1] === 0x50) {
                const width = buffer.readUInt32BE(16);
                const height = buffer.readUInt32BE(20);
                return { width, height, hasAlpha: true };
            }
            // JPEG
            if (buffer[0] === 0xff && buffer[1] === 0xd8) {
                // 简化处理，返回默认值
                return { width: 0, height: 0, hasAlpha: false };
            }
        } catch {
            // 忽略错误
        }
        return { width: 0, height: 0, hasAlpha: false };
    }

    /** 生成内容哈希 */
    private generateHash(buffer: Buffer): string {
        // 简单的哈希实现（生产环境应使用 crypto）
        let hash = 0;
        for (let i = 0; i < Math.min(buffer.length, 1000); i++) {
            hash = ((hash << 5) - hash + buffer[i]) | 0;
        }
        return Math.abs(hash).toString(36);
    }

    /** 动态加载 sharp */
    private async loadSharp(): Promise<((input: Buffer) => any) | null> {
        try {
            const mod = await import('sharp');
            return (mod as { default?: (input: Buffer) => any }).default ?? (mod as any);
        } catch {
            console.warn('sharp 库未安装，图片压缩功能不可用');
            return null;
        }
    }
}

// ============================================================================
// 工厂函数
// ============================================================================

/** 创建图片压缩器 */
export function createImageCompressor(config?: Partial<ImageCompressionConfig>): ImageCompressor {
    return new ImageCompressor(config);
}
