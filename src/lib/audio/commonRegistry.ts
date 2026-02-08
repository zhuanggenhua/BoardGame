/**
 * 通用音频注册表加载器
 * 仅从 common/audio/registry.json 读取音效与 BGM 资源
 */
import { assetsPath } from '../../core/AssetLoader';
import type { AudioCategory, BgmDefinition, GameAudioConfig, SoundDefinition } from './types';

export interface AudioRegistryEntry {
    key: string;
    src: string;
    type: 'sfx' | 'bgm';
    category?: AudioCategory;
}

export interface AudioRegistryPayload {
    version: number;
    generatedAt: string;
    source: string;
    total: number;
    entries: AudioRegistryEntry[];
}

export const COMMON_AUDIO_BASE_PATH = 'common/audio';
const COMMON_AUDIO_REGISTRY_URL = `${COMMON_AUDIO_BASE_PATH}/registry.json`;

let registryPromise: Promise<AudioRegistryPayload> | null = null;
let configPromise: Promise<GameAudioConfig> | null = null;

const fetchJson = async <T,>(url: string): Promise<T> => {
    const res = await fetch(url);
    if (!res.ok) {
        throw new Error(`[AudioRegistry] 请求失败: ${res.status} ${res.statusText}`);
    }
    return res.json() as Promise<T>;
};

const extractNameFromSrc = (src: string): string => {
    const fileName = src.split('/').pop() ?? src;
    return fileName.replace(/\.[^.]+$/, '');
};

export const buildCommonAudioConfig = (registry: AudioRegistryPayload): GameAudioConfig => {
    const sounds: Record<string, SoundDefinition> = {};
    const bgm: BgmDefinition[] = [];

    for (const entry of registry.entries) {
        if (entry.type === 'bgm') {
            bgm.push({
                key: entry.key,
                name: extractNameFromSrc(entry.src),
                src: entry.src,
                category: entry.category,
            });
            continue;
        }
        sounds[entry.key] = {
            src: entry.src,
            category: entry.category,
        };
    }

    return {
        basePath: COMMON_AUDIO_BASE_PATH,
        sounds,
        bgm,
    };
};

export const loadCommonAudioRegistry = (): Promise<AudioRegistryPayload> => {
    if (!registryPromise) {
        registryPromise = fetchJson<AudioRegistryPayload>(assetsPath(COMMON_AUDIO_REGISTRY_URL))
            .catch((err) => {
                // 失败时清除缓存，允许下次重试
                registryPromise = null;
                throw err;
            });
    }
    return registryPromise;
};

export const getCommonAudioConfig = (): Promise<GameAudioConfig> => {
    if (!configPromise) {
        configPromise = loadCommonAudioRegistry().then(buildCommonAudioConfig);
    }
    return configPromise;
};
