/**
 * 通用音频注册表加载器
 * 
 * 运行时使用精简版 registry-slim.json（~69KB，仅含代码引用的条目）
 * 全量 registry.json（~3MB，10000+ 条）仅供 AudioBrowser 开发工具使用
 * 
 * 精简版由 scripts/audio/generate-slim-registry.mjs 生成
 */
import type { BgmDefinition, GameAudioConfig, SoundDefinition } from './types';
import registryData from '../../assets/audio/registry-slim.json';

export interface AudioRegistryEntry {
    key: string;
    src: string;
    type: 'sfx' | 'bgm';
    category: { group: string; sub: string };
}

export interface AudioRegistryPayload {
    version: number;
    source: string;
    total: number;
    entries: AudioRegistryEntry[];
}

export const COMMON_AUDIO_BASE_PATH = 'common/audio';

let configPromise: Promise<GameAudioConfig> | null = null;

/**
 * 加载精简版注册表（~69KB，静态 import，零延迟）
 * 全量版由 AudioBrowser 单独动态加载
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
            });
            continue;
        }
        sounds[entry.key] = {
            src: entry.src,
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
