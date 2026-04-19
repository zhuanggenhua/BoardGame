/**
 * UGC 资产类型定义
 * 
 * 定义资产元数据与压缩变体结构（不保留原图）
 */

import type { PackageId } from '../sdk/types';

// ============================================================================
// 资产基础类型
// ============================================================================

/** 资产 ID */
export type AssetId = string;

/** 资产类型 */
export type AssetType = 'image' | 'audio' | 'video' | 'font' | 'json' | 'other';

/** 图片格式 */
export type ImageFormat = 'webp' | 'avif' | 'png' | 'jpeg' | 'gif' | 'svg';

/** 音频格式 */
export type AudioFormat = 'ogg' | 'mp3' | 'wav' | 'aac';

/** 压缩状态 */
export type CompressionStatus = 'pending' | 'processing' | 'completed' | 'skipped' | 'failed';

// ============================================================================
// 已压缩格式（跳过压缩）
// ============================================================================

/** 已压缩的图片格式（跳过压缩） */
export const COMPRESSED_IMAGE_FORMATS: ImageFormat[] = ['webp', 'avif'];

/** 已压缩的音频格式（跳过压缩） */
export const COMPRESSED_AUDIO_FORMATS: AudioFormat[] = ['ogg', 'mp3'];

/** 检查是否已是压缩格式 */
export function isAlreadyCompressed(format: string): boolean {
    const lower = format.toLowerCase();
    return COMPRESSED_IMAGE_FORMATS.includes(lower as ImageFormat) ||
           COMPRESSED_AUDIO_FORMATS.includes(lower as AudioFormat);
}

// ============================================================================
// 资产元数据
// ============================================================================

/** 图片元数据 */
export interface ImageMetadata {
    /** 宽度（像素） */
    width: number;
    /** 高度（像素） */
    height: number;
    /** 是否有透明通道 */
    hasAlpha: boolean;
}

/** 音频元数据 */
export interface AudioMetadata {
    /** 时长（秒） */
    duration: number;
    /** 采样率 */
    sampleRate: number;
    /** 声道数 */
    channels: number;
}

/** 资产元数据联合类型 */
export type AssetMetadata = ImageMetadata | AudioMetadata | Record<string, unknown>;

// ============================================================================
// 压缩变体
// ============================================================================

/** 压缩变体信息 */
export interface AssetVariant {
    /** 变体 ID */
    id: string;
    /** 格式 */
    format: string;
    /** 存储路径 */
    path: string;
    /** 文件大小（字节） */
    size: number;
    /** 内容哈希（用于缓存校验） */
    hash: string;
    /** 公开访问 URL */
    url: string;
}

// ============================================================================
// 资产记录（不保留原图）
// ============================================================================

/** 资产记录 */
export interface AssetRecord {
    /** 资产 ID */
    id: AssetId;
    /** 所属游戏包 ID */
    packageId: PackageId;
    /** 用户 ID */
    userId: string;
    /** 资产类型 */
    type: AssetType;
    /** 原始文件名 */
    originalFilename: string;
    /** 原始格式 */
    originalFormat: string;
    /** 原始文件大小（字节，仅记录，不存储原文件） */
    originalSize: number;
    /** 上传时间 */
    uploadedAt: string;
    /** 压缩状态 */
    compressionStatus: CompressionStatus;
    /** 压缩完成时间 */
    compressedAt?: string;
    /** 元数据（宽高/时长等） */
    metadata: AssetMetadata;
    /** 压缩变体列表（实际存储的文件） */
    variants: AssetVariant[];
    /** 主变体 ID（默认使用） */
    primaryVariantId: string;
}

// ============================================================================
// 上传配置
// ============================================================================

/** 图片压缩配置 */
export interface ImageCompressionConfig {
    /** 目标格式 */
    targetFormat: ImageFormat;
    /** 质量（0-100） */
    quality: number;
    /** 最大宽度 */
    maxWidth?: number;
    /** 最大高度 */
    maxHeight?: number;
}

/** 音频压缩配置 */
export interface AudioCompressionConfig {
    /** 目标格式 */
    targetFormat: AudioFormat;
    /** 比特率（kbps） */
    bitrate: number;
    /** 采样率 */
    sampleRate?: number;
}

/** 默认图片压缩配置 */
export const DEFAULT_IMAGE_COMPRESSION: ImageCompressionConfig = {
    targetFormat: 'webp',
    quality: 85,
    maxWidth: 2048,
    maxHeight: 2048,
};

/** 默认音频压缩配置 */
export const DEFAULT_AUDIO_COMPRESSION: AudioCompressionConfig = {
    targetFormat: 'ogg',
    bitrate: 128,
};

// ============================================================================
// 存储路径
// ============================================================================

/** 生成资产存储路径 */
export function generateAssetPath(
    userId: string,
    packageId: PackageId,
    assetId: AssetId,
    format: string
): string {
    return `ugc/${userId}/${packageId}/${assetId}.${format}`;
}

/** 生成资产公开 URL */
export function generateAssetUrl(
    baseUrl: string,
    path: string
): string {
    return `${baseUrl}/${path}`;
}

// ============================================================================
// 工厂函数
// ============================================================================

/** 创建资产记录 */
export function createAssetRecord(partial: Partial<AssetRecord> & {
    id: AssetId;
    packageId: PackageId;
    userId: string;
    type: AssetType;
    originalFilename: string;
    originalFormat: string;
    originalSize: number;
}): AssetRecord {
    return {
        ...partial,
        uploadedAt: partial.uploadedAt || new Date().toISOString(),
        compressionStatus: partial.compressionStatus || 'pending',
        metadata: partial.metadata || {},
        variants: partial.variants || [],
        primaryVariantId: partial.primaryVariantId || '',
    };
}

/** 添加变体到资产记录 */
export function addVariantToAsset(
    asset: AssetRecord,
    variant: AssetVariant,
    isPrimary: boolean = false
): AssetRecord {
    return {
        ...asset,
        variants: [...asset.variants, variant],
        primaryVariantId: isPrimary ? variant.id : asset.primaryVariantId,
    };
}

/** 获取主变体 */
export function getPrimaryVariant(asset: AssetRecord): AssetVariant | undefined {
    return asset.variants.find(v => v.id === asset.primaryVariantId);
}

/** 获取资产 URL */
export function getAssetUrl(asset: AssetRecord): string | undefined {
    const primary = getPrimaryVariant(asset);
    return primary?.url;
}
