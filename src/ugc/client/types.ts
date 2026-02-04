/**
 * UGC 客户端 API 类型定义
 */

export interface UgcPackageSummary {
    packageId: string;
    name: string;
    description?: string;
    tags?: string[];
    version?: string;
    gameId?: string;
    coverAssetId?: string;
    status: 'draft' | 'published';
    publishedAt?: string | null;
    updatedAt?: string;
}

export interface UgcPackageListResponse {
    items: UgcPackageSummary[];
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
}

export interface UgcAssetVariant {
    id: string;
    format?: string;
    path?: string;
    size?: number;
    hash?: string;
    url: string;
}

export interface UgcAssetManifestEntry {
    type?: string;
    primaryVariantId?: string;
    variants?: UgcAssetVariant[];
    metadata?: Record<string, unknown>;
}

export interface UgcPackageManifest {
    metadata?: Record<string, unknown>;
    assets?: Record<string, UgcAssetManifestEntry>;
}
