/**
 * 音频配置合并工具
 * 支持 common + game 分层合并，游戏层优先
 * @deprecated 已迁移到 registry.json + commonRegistry，待确认删除。
 */
import type { GameAudioConfig, SoundDefinition, BgmDefinition } from './types';

/**
 * 合并多个 GameAudioConfig，后者覆盖前者
 * @param configs 配置数组，按优先级从低到高排列（common 在前，game 在后）
 * @returns 合并后的配置
 */
export function mergeAudioConfigs(...configs: GameAudioConfig[]): GameAudioConfig {
    const result: GameAudioConfig = {
        sounds: {},
        bgm: [],
        feedbackResolver: () => null,
    };

    for (const config of configs) {
        // 合并 sounds（后者覆盖前者）
        if (config.sounds) {
            for (const [key, def] of Object.entries(config.sounds)) {
                result.sounds![key] = def as SoundDefinition;
            }
        }

        // 合并 BGM（按 key 去重，后者覆盖前者）
        if (config.bgm) {
            for (const bgmDef of config.bgm) {
                const existingIndex = result.bgm!.findIndex(b => b.key === bgmDef.key);
                if (existingIndex >= 0) {
                    result.bgm![existingIndex] = bgmDef as BgmDefinition;
                } else {
                    result.bgm!.push(bgmDef as BgmDefinition);
                }
            }
        }

        // 游戏层的 feedbackResolver/rules/triggers 直接覆盖（不做合并）
        if (config.feedbackResolver) {
            result.feedbackResolver = config.feedbackResolver;
        }
        if (config.bgmRules) {
            result.bgmRules = config.bgmRules;
        }
        if (config.stateTriggers) {
            result.stateTriggers = config.stateTriggers;
        }
        if (config.eventSelector) {
            result.eventSelector = config.eventSelector;
        }
        // basePath 取最后一个有值的（通常游戏层会覆盖）
        if (config.basePath !== undefined) {
            result.basePath = config.basePath;
        }
    }

    return result;
}

/**
 * 创建带 basePath 前缀的 sounds 副本
 * 用于将 common 配置的相对路径转换为绝对路径
 */
export function prefixSoundsSrc(
    sounds: Record<string, SoundDefinition>,
    basePath: string
): Record<string, SoundDefinition> {
    const result: Record<string, SoundDefinition> = {};
    const prefix = basePath.endsWith('/') ? basePath : `${basePath}/`;

    for (const [key, def] of Object.entries(sounds)) {
        const prefixedSrc = Array.isArray(def.src)
            ? def.src.map(s => `${prefix}${s}`)
            : `${prefix}${def.src}`;
        result[key] = { ...def, src: prefixedSrc };
    }

    return result;
}
