import type { AiStrategyProfile } from '../../../engine/ai';
import type { FactionId, PlayerId, SummonerWarsCore } from '../domain/types';

export type SummonerWarsStrategyTag =
    | 'summoner-defense'
    | 'summoner-pressure'
    | 'board-control'
    | 'economy'
    | 'ability-tempo'
    | 'gate-push';

export type SummonerWarsEvaluationDimension =
    | 'summonerSafety'
    | 'threatAndKills'
    | 'magicEconomy'
    | 'positionControl'
    | 'tempo';

export interface SummonerWarsFactionAiProfile {
    factionId: FactionId | 'default';
    summary: readonly string[];
    strategyTagWeights: Partial<Record<SummonerWarsStrategyTag, number>>;
    evaluationWeights: Partial<Record<SummonerWarsEvaluationDimension, number>>;
}
const DEFAULT_PROFILE: SummonerWarsFactionAiProfile = {
    factionId: 'default',
    summary: ['均衡推进'],
    strategyTagWeights: {
        'summoner-defense': 1,
        'summoner-pressure': 1,
        'board-control': 1,
        economy: 1,
        'ability-tempo': 1,
        'gate-push': 1,
    },
    evaluationWeights: {
        summonerSafety: 1,
        threatAndKills: 1,
        magicEconomy: 1,
        positionControl: 1,
        tempo: 1,
    },
};

export const SUMMONER_WARS_FACTION_AI_PROFILES: Record<FactionId, SummonerWarsFactionAiProfile> = {
    necromancer: {
        factionId: 'necromancer',
        summary: ['亡灵持续施压', '重视弃牌堆与魔力循环'],
        strategyTagWeights: {
            'summoner-pressure': 1.18,
            economy: 1.2,
            'ability-tempo': 1.1,
            'board-control': 0.95,
        },
        evaluationWeights: {
            threatAndKills: 1.12,
            magicEconomy: 1.15,
            tempo: 1.05,
        },
    },
    frost: {
        factionId: 'frost',
        summary: ['冰霜控场', '重视冰墙与阻断路径'],
        strategyTagWeights: {
            'summoner-defense': 1.18,
            'board-control': 1.22,
            'gate-push': 0.92,
            'summoner-pressure': 0.88,
        },
        evaluationWeights: {
            summonerSafety: 1.1,
            positionControl: 1.22,
            tempo: 0.96,
        },
    },
    goblin: {
        factionId: 'goblin',
        summary: ['哥布林铺场前压', '寻找围攻与快速击杀窗口'],
        strategyTagWeights: {
            'summoner-pressure': 1.3,
            'board-control': 1.08,
            economy: 0.88,
            'gate-push': 1.08,
        },
        evaluationWeights: {
            threatAndKills: 1.2,
            positionControl: 1.08,
            magicEconomy: 0.9,
            tempo: 1.16,
        },
    },
    paladin: {
        factionId: 'paladin',
        summary: ['圣骑稳健推进', '优先保护召唤师与核心单位'],
        strategyTagWeights: {
            'summoner-defense': 1.25,
            'board-control': 1.08,
            'ability-tempo': 1.12,
            'summoner-pressure': 0.92,
        },
        evaluationWeights: {
            summonerSafety: 1.2,
            positionControl: 1.06,
            tempo: 1.04,
        },
    },
    barbaric: {
        factionId: 'barbaric',
        summary: ['蛮族高强度冲锋', '强化后兑现攻击'],
        strategyTagWeights: {
            'summoner-pressure': 1.24,
            'ability-tempo': 1.18,
            'board-control': 1.02,
            economy: 0.9,
        },
        evaluationWeights: {
            threatAndKills: 1.18,
            tempo: 1.12,
            magicEconomy: 0.92,
        },
    },
    trickster: {
        factionId: 'trickster',
        summary: ['诡术扰乱控制', '偏好换位和关键目标压制'],
        strategyTagWeights: {
            'ability-tempo': 1.28,
            'board-control': 1.12,
            'summoner-pressure': 1.04,
            economy: 0.96,
        },
        evaluationWeights: {
            positionControl: 1.16,
            tempo: 1.18,
            threatAndKills: 1.04,
        },
    },
    mogu: {
        factionId: 'mogu',
        summary: ['莫古充能联动', '重视充能与攻击窗口'],
        strategyTagWeights: {
            'ability-tempo': 1.24,
            'summoner-pressure': 1.12,
            'board-control': 1.06,
        },
        evaluationWeights: {
            tempo: 1.16,
            threatAndKills: 1.1,
            positionControl: 1.04,
        },
    },
    huijin: {
        factionId: 'huijin',
        summary: ['灰烬远程压制', '重视召唤师周边防守'],
        strategyTagWeights: {
            'summoner-defense': 1.16,
            'summoner-pressure': 1.1,
            'ability-tempo': 1.08,
            'board-control': 1.04,
        },
        evaluationWeights: {
            summonerSafety: 1.12,
            threatAndKills: 1.08,
            positionControl: 1.04,
        },
    },
    shouren: {
        factionId: 'shouren',
        summary: ['冰苔兽人推拉连击', '重视充能重掷与近战压迫'],
        strategyTagWeights: {
            'ability-tempo': 1.18,
            'board-control': 1.14,
            'summoner-pressure': 1.12,
            'summoner-defense': 1.04,
        },
        evaluationWeights: {
            threatAndKills: 1.14,
            positionControl: 1.1,
            tempo: 1.08,
        },
    },
    yongheng: {
        factionId: 'yongheng',
        summary: ['永恒议会资源滚动', '重视抓牌、充能和手牌节奏'],
        strategyTagWeights: {
            economy: 1.24,
            'ability-tempo': 1.18,
            'board-control': 1.08,
            'summoner-defense': 1.04,
        },
        evaluationWeights: {
            magicEconomy: 1.18,
            tempo: 1.12,
            positionControl: 1.06,
        },
    },
    shadow: {
        factionId: 'shadow',
        summary: ['暗影精灵离场与回收', '重视伤害充能和传送门周边压制'],
        strategyTagWeights: {
            'ability-tempo': 1.18,
            'board-control': 1.14,
            'summoner-defense': 1.08,
            economy: 1.02,
        },
        evaluationWeights: {
            positionControl: 1.12,
            tempo: 1.1,
            summonerSafety: 1.06,
        },
    },
};

export function getSummonerWarsFactionAiProfile(
    core: SummonerWarsCore,
    playerId: PlayerId,
): SummonerWarsFactionAiProfile {
    const selectedFaction = core.selectedFactions[playerId];
    if (selectedFaction && selectedFaction !== 'unselected') {
        return SUMMONER_WARS_FACTION_AI_PROFILES[selectedFaction] ?? DEFAULT_PROFILE;
    }

    return DEFAULT_PROFILE;
}

export function mergeSummonerWarsStrategyProfile(
    base: AiStrategyProfile<SummonerWarsStrategyTag>,
    factionProfile: SummonerWarsFactionAiProfile,
): AiStrategyProfile<SummonerWarsStrategyTag> {
    return {
        tags: [
            ...new Set([
                ...(base.tags ?? []),
                ...Object.entries(factionProfile.strategyTagWeights)
                    .filter(([, weight]) => typeof weight === 'number' && weight >= 1.05)
                    .map(([tag]) => tag as SummonerWarsStrategyTag),
            ]),
        ],
        tagWeights: {
            ...(base.tagWeights ?? {}),
            ...Object.fromEntries(
                Object.entries(factionProfile.strategyTagWeights).map(([tag, weight]) => [
                    tag,
                    Number((((base.tagWeights?.[tag as SummonerWarsStrategyTag] ?? 0) + (weight ?? 0))).toFixed(3)),
                ]),
            ),
        },
        summary: [
            ...(base.summary ?? []),
            ...factionProfile.summary,
        ],
    };
}
