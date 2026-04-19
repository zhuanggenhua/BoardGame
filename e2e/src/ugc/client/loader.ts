/**
 * UGC 客户端加载器
 *
 * 拉取 manifest 并解析 rules/view 入口与运行态配置。
 */

import { UGC_API_URL, UGC_ASSET_BASE_URL } from '../../config/server';
import type { UgcPackageManifest } from './types';

export interface UgcRuntimeConfig {
    packageId: string;
    manifest: UgcPackageManifest;
    rulesUrl: string | null;
    viewUrl: string | null;
    commandTypes?: string[];
    minPlayers?: number;
    maxPlayers?: number;
}

const normalizeBaseUrl = (value: string) => value.replace(/\/+$/, '');

const isHttpUrl = (value: string) => /^https?:\/\//i.test(value);

const normalizePath = (value: string) => value.replace(/^\/+/, '');

const resolveEntryUrl = (entryPath?: string): string | null => {
    if (!entryPath || typeof entryPath !== 'string') return null;
    const trimmed = entryPath.trim();
    if (!trimmed) return null;
    if (isHttpUrl(trimmed)) return trimmed;

    const base = normalizeBaseUrl(UGC_ASSET_BASE_URL || '/assets');
    const normalizedEntry = normalizePath(trimmed);

    if (isHttpUrl(base)) {
        if (trimmed.startsWith(base)) return trimmed;
        return `${base}/${normalizedEntry}`;
    }

    const basePath = normalizePath(base);
    if (normalizedEntry.startsWith(`${basePath}/`)) {
        return `/${normalizedEntry}`;
    }

    return `${base}/${normalizedEntry}`;
};

const parseNumberArray = (value: unknown): number[] | undefined => {
    if (!Array.isArray(value)) return undefined;
    const parsed = value
        .map((item) => (typeof item === 'number' ? item : Number(item)))
        .filter((item) => Number.isFinite(item) && item > 0);
    return parsed.length > 0 ? parsed : undefined;
};

const normalizeCommandTypes = (value: unknown): string[] | undefined => {
    if (!Array.isArray(value)) return undefined;
    const normalized = value
        .map((item) => (typeof item === 'string' ? item.trim() : ''))
        .filter((item) => item.length > 0);
    return normalized.length > 0 ? normalized : undefined;
};

const fetchJson = async <T,>(url: string): Promise<T> => {
    const res = await fetch(url);
    if (!res.ok) {
        throw new Error(`[UGC] 请求失败: ${res.status} ${res.statusText}`);
    }
    const contentType = res.headers.get('content-type');
    if (!contentType?.includes('application/json')) {
        throw new Error(`[UGC] 响应不是 JSON 格式: ${contentType}`);
    }
    return res.json() as Promise<T>;
};

export const fetchUgcManifest = async (packageId: string): Promise<UgcPackageManifest> => {
    const baseUrl = normalizeBaseUrl(UGC_API_URL);
    const url = `${baseUrl}/packages/${encodeURIComponent(packageId)}/manifest`;
    const data = await fetchJson<{ manifest?: UgcPackageManifest }>(url);
    if (!data?.manifest) {
        throw new Error(`[UGC] 未找到清单: ${packageId}`);
    }
    return data.manifest;
};

export const loadUgcRuntimeConfig = async (packageId: string): Promise<UgcRuntimeConfig> => {
    const manifest = await fetchUgcManifest(packageId);
    const entryPoints = manifest.entryPoints ?? {};
    const metadata = manifest.metadata ?? {};
    const playerOptions = parseNumberArray((metadata as Record<string, unknown>).playerOptions);
    const commandTypes = normalizeCommandTypes(manifest.commandTypes);

    return {
        packageId,
        manifest,
        rulesUrl: resolveEntryUrl(entryPoints.rules),
        viewUrl: resolveEntryUrl(entryPoints.view),
        commandTypes,
        minPlayers: playerOptions ? Math.min(...playerOptions) : undefined,
        maxPlayers: playerOptions ? Math.max(...playerOptions) : undefined,
    };
};
