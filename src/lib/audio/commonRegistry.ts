/**
 * 通用音频注册表加载器
 * 直接 import src/ 下的 JSON（Vite 会在构建时打包）
 */
import type { AudioCategory, BgmDefinition, GameAudioConfig, SoundDefinition } from './types';
// 直接 import src/ 下的 JSON，Vite 会自动处理
import registryData from '../../assets/audio/registry.json';

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

let configPromise: Promise<GameAudioConfig> | null = null;

/**
 * 直接使用静态 import 的 JSON
 * Vite 会在构建时将 JSON 打包到产物中
 * 修改 registry.json 后刷新页面即可生效，无需上传 CDN
 */
export const loadCommonAudioRegistry = (): Promise<AudioRegistryPayload> => {
    return Promise.resolve(registryData as AudioRegistryPayload);
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
        feedbackResolver: () => null,
    };
};

export const getCommonAudioConfig = (): Promise<GameAudioConfig> => {
    if (!configPromise) {
        configPromise = loadCommonAudioRegistry().then(buildCommonAudioConfig);
    }
    return configPromise;
};
