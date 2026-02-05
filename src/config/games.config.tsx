import type { ReactNode } from 'react';
import { ManifestGameThumbnail } from '../components/lobby/thumbnails';
import { GAME_CLIENT_MANIFEST } from '../games/manifest.client';
import type { GameCategory, GameManifestEntry } from '../games/manifest.types';
import { UGC_API_URL } from './server';
import type {
    UgcAssetManifestEntry,
    UgcAssetVariant,
    UgcPackageListResponse,
    UgcPackageManifest,
    UgcPackageSummary,
} from '../ugc/client/types';

export interface GameConfig extends GameManifestEntry {
    thumbnail: ReactNode;
    isUgc?: boolean;
}

const UGC_TAG = 'ugc';
const DEFAULT_UGC_CATEGORY: GameCategory = 'casual';
const DEFAULT_UGC_PLAYERS_KEY = 'games.ugc.players';
const DEFAULT_UGC_DESCRIPTION = 'UGC 游戏';

const registrySubscribers = new Set<() => void>();
const ugcGameIds = new Set<string>();
let ugcLoadingPromise: Promise<void> | null = null;

const buildGameRegistry = () => {
    const registry: Record<string, GameConfig> = {};
    for (const entry of GAME_CLIENT_MANIFEST) {
        const { manifest, thumbnail } = entry;
        if (!thumbnail) {
            throw new Error(`[GameManifest] 缺少缩略图配置: ${manifest.id}`);
        }
        registry[manifest.id] = {
            ...manifest,
            thumbnail,
            isUgc: false,
        };
    }
    return registry;
};

export const GAMES_REGISTRY: Record<string, GameConfig> = buildGameRegistry();

const notifyRegistryUpdate = () => {
    registrySubscribers.forEach((listener) => listener());
};

export const subscribeGameRegistry = (listener: () => void) => {
    registrySubscribers.add(listener);
    return () => registrySubscribers.delete(listener);
};

const clearUgcEntries = () => {
    for (const id of ugcGameIds) {
        delete GAMES_REGISTRY[id];
    }
    ugcGameIds.clear();
};

const addUgcEntries = (entries: GameConfig[]) => {
    clearUgcEntries();
    for (const entry of entries) {
        if (!entry?.id) continue;
        if (GAMES_REGISTRY[entry.id]) {
            console.warn(`[UGC] 游戏 ID 已存在，跳过 UGC 包: ${entry.id}`);
            continue;
        }
        GAMES_REGISTRY[entry.id] = entry;
        ugcGameIds.add(entry.id);
    }
    notifyRegistryUpdate();
};

const normalizeBaseUrl = (value: string) => value.replace(/\/+$/, '');

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

const fetchPublishedPackages = async () => {
    const baseUrl = normalizeBaseUrl(UGC_API_URL);
    const url = `${baseUrl}/packages?page=1&limit=20`;
    const data = await fetchJson<UgcPackageListResponse>(url);
    return data.items ?? [];
};

const fetchPublishedManifest = async (packageId: string): Promise<UgcPackageManifest | null> => {
    const baseUrl = normalizeBaseUrl(UGC_API_URL);
    const url = `${baseUrl}/packages/${encodeURIComponent(packageId)}/manifest`;
    try {
        const data = await fetchJson<{ manifest?: UgcPackageManifest }>(url);
        return data?.manifest ?? null;
    } catch (error) {
        console.warn(`[UGC] 获取清单失败 packageId=${packageId}`, error);
        return null;
    }
};

const parseNumberArray = (value: unknown): number[] | undefined => {
    if (!Array.isArray(value)) return undefined;
    const parsed = value
        .map((item) => (typeof item === 'number' ? item : Number(item)))
        .filter((item) => Number.isFinite(item) && item > 0);
    return parsed.length > 0 ? parsed : undefined;
};

const selectAssetVariant = (asset?: UgcAssetManifestEntry): UgcAssetVariant | undefined => {
    if (!asset?.variants || asset.variants.length === 0) return undefined;
    if (asset.primaryVariantId) {
        const primary = asset.variants.find((variant) => variant.id === asset.primaryVariantId);
        if (primary?.url) return primary;
    }
    const preferred = asset.variants.find((variant) => variant.format === 'webp' && variant.url)
        ?? asset.variants.find((variant) => variant.format === 'avif' && variant.url);
    return preferred ?? asset.variants.find((variant) => variant.url);
};

const resolveCoverUrl = (manifest: UgcPackageManifest | null, coverAssetId?: string): string | undefined => {
    if (!coverAssetId) return undefined;
    const asset = manifest?.assets?.[coverAssetId];
    const variant = selectAssetVariant(asset);
    return variant?.url;
};

const normalizeTags = (tags: string[] | undefined) => {
    const normalized = (tags ?? [])
        .map((tag) => String(tag).trim())
        .filter((tag) => tag.length > 0);
    const unique = new Set([UGC_TAG, ...normalized]);
    return Array.from(unique);
};

const buildUgcEntry = async (pkg: UgcPackageSummary): Promise<GameConfig | null> => {
    if (!pkg?.packageId) return null;
    const manifest = pkg.coverAssetId ? await fetchPublishedManifest(pkg.packageId) : null;
    const coverUrl = resolveCoverUrl(manifest, pkg.coverAssetId);
    const metadata = manifest?.metadata ?? {};
    const playerOptions = parseNumberArray((metadata as Record<string, unknown>).playerOptions);
    const bestPlayers = parseNumberArray((metadata as Record<string, unknown>).bestPlayers);
    const title = pkg.name?.trim() || `UGC ${pkg.packageId}`;
    const description = pkg.description?.trim() || DEFAULT_UGC_DESCRIPTION;

    const entry: GameManifestEntry = {
        id: pkg.packageId,
        type: 'game',
        enabled: true,
        titleKey: title,
        descriptionKey: description,
        category: DEFAULT_UGC_CATEGORY,
        playersKey: DEFAULT_UGC_PLAYERS_KEY,
        icon: '🧩',
        thumbnailPath: coverUrl,
        allowLocalMode: false,
        tags: normalizeTags(pkg.tags),
        ...(playerOptions ? { playerOptions } : {}),
        ...(bestPlayers ? { bestPlayers } : {}),
    };

    return {
        ...entry,
        thumbnail: <ManifestGameThumbnail manifest={entry} />,
        isUgc: true,
    };
};

export const refreshUgcGames = async () => {
    if (ugcLoadingPromise) return ugcLoadingPromise;
    ugcLoadingPromise = (async () => {
        try {
            const packages = await fetchPublishedPackages();
            const entries = await Promise.all(packages.map(buildUgcEntry));
            addUgcEntries(entries.filter((entry): entry is GameConfig => Boolean(entry)));
        } catch (error) {
            console.warn('[UGC] 加载发布包失败', error);
        } finally {
            ugcLoadingPromise = null;
        }
    })();
    return ugcLoadingPromise;
};

export const getAllGames = () => Object.values(GAMES_REGISTRY).filter(g => g.enabled);
export const getGameById = (id: string) => GAMES_REGISTRY[id];
export const getGamesByCategory = (category: string) => {
    const games = getAllGames();
    if (category === 'All') {
        // "全部游戏" 选项下不再显示工具类项目
        return games.filter(g => g.type !== 'tool');
    }
    return games.filter(g => !g.isUgc && g.category === category);
};

export default GAMES_REGISTRY;
