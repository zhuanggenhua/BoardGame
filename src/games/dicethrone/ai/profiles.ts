import type { PlayerId } from '../../../engine/types';
import type { DiceThroneCore, SelectableCharacterId } from '../domain/types';

export type DiceThroneHeroStrategyProfile = {
    chaseAmbition: number;
    protectFallback: number;
    resourceLeverage: number;
    summary: string;
};

export const DEFAULT_DICETHRONE_HERO_STRATEGY_PROFILE: DiceThroneHeroStrategyProfile = {
    chaseAmbition: 1,
    protectFallback: 1,
    resourceLeverage: 1,
    summary: '平衡打法',
};

export const DICETHRONE_HERO_STRATEGY_PROFILES: Partial<Record<SelectableCharacterId, DiceThroneHeroStrategyProfile>> = {
    barbarian: {
        chaseAmbition: 1.18,
        protectFallback: 0.88,
        resourceLeverage: 0.95,
        summary: '爆发压血',
    },
    pyromancer: {
        chaseAmbition: 1.16,
        protectFallback: 0.9,
        resourceLeverage: 1,
        summary: '高伤压制',
    },
    gunslinger: {
        chaseAmbition: 1.12,
        protectFallback: 0.95,
        resourceLeverage: 1.08,
        summary: '资源转爆发',
    },
    samurai: {
        chaseAmbition: 1.12,
        protectFallback: 0.96,
        resourceLeverage: 1.02,
        summary: '稳定输出',
    },
    monk: {
        chaseAmbition: 0.96,
        protectFallback: 1.12,
        resourceLeverage: 1.08,
        summary: '稳健控场',
    },
    paladin: {
        chaseAmbition: 0.92,
        protectFallback: 1.18,
        resourceLeverage: 1.04,
        summary: '保底防守',
    },
    treant: {
        chaseAmbition: 0.9,
        protectFallback: 1.2,
        resourceLeverage: 1.05,
        summary: '续航防守',
    },
    shadow_thief: {
        chaseAmbition: 1.02,
        protectFallback: 1,
        resourceLeverage: 1.18,
        summary: '资源偷取',
    },
};

export const getDiceThroneHeroStrategyProfile = (
    core: DiceThroneCore,
    playerId: PlayerId,
): DiceThroneHeroStrategyProfile => {
    const characterId = core.players[playerId]?.characterId;
    if (!characterId || characterId === 'unselected') {
        return DEFAULT_DICETHRONE_HERO_STRATEGY_PROFILE;
    }

    return DICETHRONE_HERO_STRATEGY_PROFILES[characterId as SelectableCharacterId]
        ?? DEFAULT_DICETHRONE_HERO_STRATEGY_PROFILE;
};
