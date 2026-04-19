import type { MatchState, PlayerId } from '../../engine/types';
import type {
    AbilityTag,
    ActionCardDef,
    CardDef,
    MinionCardDef,
    SmashUpCore,
} from './domain/types';
import { getCardDef, getCardDefsByFaction } from './data/cards';

type SmashUpState = MatchState<SmashUpCore>;

export type SmashUpStrategyTag =
    | 'swarm'
    | 'action-chain'
    | 'engine'
    | 'burst-scoring'
    | 'tempo'
    | 'power-spike';

export interface SmashUpStrategyVector {
    swarm: number;
    actionChain: number;
    engine: number;
    burstScoring: number;
    tempo: number;
    powerSpike: number;
}

export interface SmashUpStrategyProfile {
    tags: SmashUpStrategyTag[];
    vector: SmashUpStrategyVector;
    summary: string[];
}

interface SmashUpFeatureCounts {
    totalCards: number;
    extraMinion: number;
    extraAction: number;
    ongoing: number;
    onPlay: number;
    scoringWindow: number;
    lowCurve: number;
    highPower: number;
}

type SmashUpPlayKind = 'minion' | 'action';

function normalize(value: number): number {
    return Number(Math.max(0, Math.min(1.6, value)).toFixed(3));
}

function hasTag(tags: AbilityTag[] | undefined, tag: AbilityTag): boolean {
    return Array.isArray(tags) && tags.includes(tag);
}

function collectFeatureCountsFromCardDef(def: CardDef, playKind?: SmashUpPlayKind): SmashUpFeatureCounts {
    const counts: SmashUpFeatureCounts = {
        totalCards: 1,
        extraMinion: 0,
        extraAction: 0,
        ongoing: 0,
        onPlay: 0,
        scoringWindow: 0,
        lowCurve: 0,
        highPower: 0,
    };

    const applyMinionFace = (minionDef: Pick<MinionCardDef, 'power' | 'abilityTags' | 'beforeScoringPlayable'>) => {
        if (hasTag(minionDef.abilityTags, 'extra')) counts.extraMinion += 1;
        if (hasTag(minionDef.abilityTags, 'ongoing')) counts.ongoing += 1;
        if (hasTag(minionDef.abilityTags, 'onPlay')) counts.onPlay += 1;
        if (minionDef.beforeScoringPlayable) counts.scoringWindow += 1;
        if (minionDef.power <= 2) counts.lowCurve += 1;
        if (minionDef.power >= 4) counts.highPower += 1;
    };

    const applyActionFace = (
        actionDef: Pick<ActionCardDef, 'subtype' | 'abilityTags' | 'specialTiming' | 'responseWindowTiming'>,
    ) => {
        if (hasTag(actionDef.abilityTags, 'extra')) counts.extraAction += 1;
        if (actionDef.subtype === 'ongoing' || hasTag(actionDef.abilityTags, 'ongoing')) counts.ongoing += 1;
        if (actionDef.subtype === 'special' || hasTag(actionDef.abilityTags, 'special')) counts.scoringWindow += 1;
        if (actionDef.specialTiming || actionDef.responseWindowTiming) counts.scoringWindow += 1;
    };

    if (def.type === 'minion') {
        applyMinionFace(def);
        return counts;
    }

    if (def.type === 'action') {
        applyActionFace(def);
        return counts;
    }

    if (def.type === 'fusion') {
        if (!playKind || playKind === 'minion') {
            applyMinionFace({
                power: def.minionPower,
                abilityTags: def.minionAbilityTags,
                beforeScoringPlayable: def.minionBeforeScoringPlayable,
            });
        }
        if (!playKind || playKind === 'action') {
            applyActionFace({
                subtype: def.actionSubtype,
                abilityTags: def.actionAbilityTags,
                specialTiming: def.actionSpecialTiming,
                responseWindowTiming: def.actionResponseWindowTiming,
            });
        }
        return counts;
    }

    return counts;
}

function mergeFeatureCounts(target: SmashUpFeatureCounts, current: SmashUpFeatureCounts): SmashUpFeatureCounts {
    return {
        totalCards: target.totalCards + current.totalCards,
        extraMinion: target.extraMinion + current.extraMinion,
        extraAction: target.extraAction + current.extraAction,
        ongoing: target.ongoing + current.ongoing,
        onPlay: target.onPlay + current.onPlay,
        scoringWindow: target.scoringWindow + current.scoringWindow,
        lowCurve: target.lowCurve + current.lowCurve,
        highPower: target.highPower + current.highPower,
    };
}

function buildProfileFromCounts(counts: SmashUpFeatureCounts): SmashUpStrategyProfile {
    const total = Math.max(1, counts.totalCards);
    const swarm = normalize((counts.extraMinion * 1.4 + counts.lowCurve * 0.9 + counts.onPlay * 0.3) / total);
    const actionChain = normalize((counts.extraAction * 1.7 + counts.onPlay * 0.35) / total);
    const engine = normalize((counts.ongoing * 1.6 + counts.extraAction * 0.2) / total);
    const burstScoring = normalize((counts.scoringWindow * 1.8 + counts.highPower * 0.4 + counts.extraAction * 0.2) / total);
    const tempo = normalize((counts.onPlay * 1.25 + counts.extraMinion * 0.5 + counts.extraAction * 0.35) / total);
    const powerSpike = normalize((counts.highPower * 1.4 + counts.scoringWindow * 0.2) / total);

    const vector: SmashUpStrategyVector = {
        swarm,
        actionChain,
        engine,
        burstScoring,
        tempo,
        powerSpike,
    };

    const tags: SmashUpStrategyTag[] = [];
    if (swarm >= 0.55) tags.push('swarm');
    if (actionChain >= 0.5) tags.push('action-chain');
    if (engine >= 0.4) tags.push('engine');
    if (burstScoring >= 0.42) tags.push('burst-scoring');
    if (tempo >= 0.48) tags.push('tempo');
    if (powerSpike >= 0.42) tags.push('power-spike');

    const summary = [
        swarm >= 0.55 ? '偏铺场/额外随从' : null,
        actionChain >= 0.5 ? '偏额外行动连锁' : null,
        engine >= 0.4 ? '偏持续引擎' : null,
        burstScoring >= 0.42 ? '偏计分窗口爆发' : null,
        tempo >= 0.48 ? '偏 on-play 节奏' : null,
        powerSpike >= 0.42 ? '偏高战力终结' : null,
    ].filter((item): item is string => Boolean(item));

    return { tags, vector, summary };
}

function buildProfileFromCardDefs(defs: CardDef[], playKind?: SmashUpPlayKind): SmashUpStrategyProfile {
    const counts = defs.reduce<SmashUpFeatureCounts>((acc, def) => {
        return mergeFeatureCounts(acc, collectFeatureCountsFromCardDef(def, playKind));
    }, {
        totalCards: 0,
        extraMinion: 0,
        extraAction: 0,
        ongoing: 0,
        onPlay: 0,
        scoringWindow: 0,
        lowCurve: 0,
        highPower: 0,
    });

    return buildProfileFromCounts(counts);
}

export function getFactionStrategyProfile(factionId: string): SmashUpStrategyProfile {
    return buildProfileFromCardDefs(getCardDefsByFaction(factionId));
}

export function getResolvedPlayerFactionIds(
    state: SmashUpState,
    playerId: PlayerId,
): string[] {
    const committedFactions = (state.core.players[playerId]?.factions ?? []).filter(Boolean);
    if (committedFactions.length > 0) {
        return [...new Set(committedFactions)];
    }

    const draftedFactions = (state.core.factionSelection?.playerSelections?.[playerId] ?? []).filter(Boolean);
    return [...new Set(draftedFactions)];
}

export function getPlayerStrategyProfile(
    state: SmashUpState,
    playerId: PlayerId,
): SmashUpStrategyProfile {
    const factionIds = getResolvedPlayerFactionIds(state, playerId);
    const defs = factionIds.flatMap((factionId) => getCardDefsByFaction(factionId));
    return buildProfileFromCardDefs(defs);
}

export function getCardStrategyTags(
    defId: string,
    playKind?: SmashUpPlayKind,
): string[] {
    const def = getCardDef(defId);
    if (!def) return [];
    const profile = buildProfileFromCardDefs([def], playKind);
    return profile.tags;
}

export function scoreFactionSynergy(
    selectedFactionIds: string[],
    candidateFactionId: string,
): { score: number; reason: string; profile: SmashUpStrategyProfile } {
    const candidate = getFactionStrategyProfile(candidateFactionId);
    if (selectedFactionIds.length === 0) {
        const baseScore = Number((
            candidate.vector.swarm * 14
            + candidate.vector.actionChain * 14
            + candidate.vector.engine * 10
            + candidate.vector.burstScoring * 12
            + candidate.vector.tempo * 8
            + candidate.vector.powerSpike * 6
        ).toFixed(3));
        return {
            score: baseScore,
            reason: candidate.summary[0] ?? '按派系牌组风格的基础强度排序',
            profile: candidate,
        };
    }

    const existing = buildProfileFromCardDefs(selectedFactionIds.flatMap((factionId) => getCardDefsByFaction(factionId)));
    const synergy = (
        Math.min(existing.vector.swarm, candidate.vector.actionChain) * 26
        + Math.min(existing.vector.actionChain, candidate.vector.swarm) * 24
        + Math.min(existing.vector.engine, candidate.vector.burstScoring) * 16
        + Math.min(existing.vector.burstScoring, candidate.vector.engine) * 14
        + Math.min(existing.vector.tempo, candidate.vector.powerSpike) * 10
        + Math.min(existing.vector.powerSpike, candidate.vector.tempo) * 8
        + Math.min(existing.vector.swarm, candidate.vector.swarm) * 8
        + Math.min(existing.vector.actionChain, candidate.vector.actionChain) * 6
    );

    const baseStrength = (
        candidate.vector.swarm * 6
        + candidate.vector.actionChain * 6
        + candidate.vector.engine * 5
        + candidate.vector.burstScoring * 6
        + candidate.vector.tempo * 4
        + candidate.vector.powerSpike * 3
    );

    const topReasons = [
        existing.vector.swarm > 0.45 && candidate.vector.actionChain > 0.45 ? '补足铺场后的额外行动连锁' : null,
        existing.vector.actionChain > 0.45 && candidate.vector.swarm > 0.45 ? '补足额外行动后的铺场密度' : null,
        existing.vector.engine > 0.35 && candidate.vector.burstScoring > 0.35 ? '持续引擎与计分窗口爆发互补' : null,
        existing.vector.burstScoring > 0.35 && candidate.vector.engine > 0.35 ? '爆发思路需要引擎支撑' : null,
        existing.vector.tempo > 0.35 && candidate.vector.powerSpike > 0.35 ? '前期节奏与高战力终结形成配合' : null,
        candidate.summary[0] ?? null,
    ].filter((item): item is string => Boolean(item));

    return {
        score: Number((synergy + baseStrength).toFixed(3)),
        reason: topReasons[0] ?? '按已选派系与候选派系的风格协同排序',
        profile: candidate,
    };
}

export function scoreActionAgainstPlayerProfile(args: {
    profile: SmashUpStrategyProfile;
    actionKind: string;
    cardTags: string[];
    phase: string | undefined;
    hasUrgentBasePressure: boolean;
}): { score: number; reason: string } | null {
    const { profile, actionKind, cardTags, phase, hasUrgentBasePressure } = args;
    if (cardTags.length === 0) return null;

    let score = 0;
    const reasons: string[] = [];

    if ((actionKind === 'play-minion' || actionKind === 'response-play-minion') && cardTags.includes('swarm')) {
        const swarmScore = profile.vector.swarm * 16 + profile.vector.actionChain * 6;
        if (swarmScore > 0) {
            score += swarmScore;
            reasons.push('当前牌组偏铺场/连锁，优先保留 swarm 节奏');
        }
    }

    if ((actionKind === 'play-action' || actionKind === 'response-play-action') && cardTags.includes('action-chain')) {
        const chainScore = profile.vector.actionChain * 18 + profile.vector.tempo * 5;
        if (chainScore > 0) {
            score += chainScore;
            reasons.push('当前牌组偏额外行动连锁，优先保留 action chain');
        }
    }

    if ((actionKind === 'play-action' || actionKind === 'play-minion') && cardTags.includes('engine') && !hasUrgentBasePressure) {
        const engineScore = profile.vector.engine * 16;
        if (engineScore > 0) {
            score += engineScore;
            reasons.push('非高压窗口时优先铺持续引擎');
        }
    }

    if ((actionKind === 'response-play-action' || actionKind === 'response-play-minion' || phase === 'scoreBases')
        && cardTags.includes('burst-scoring')) {
        const burstScore = profile.vector.burstScoring * 18;
        if (burstScore > 0) {
            score += burstScore;
            reasons.push('计分窗口内优先使用爆发组件');
        }
    }

    if ((actionKind === 'play-minion' || actionKind === 'response-play-minion') && cardTags.includes('power-spike')) {
        const spikeScore = profile.vector.powerSpike * 10;
        if (spikeScore > 0) {
            score += spikeScore;
            reasons.push('高战力组件更适合当前牌组的终结节奏');
        }
    }

    if (score === 0) return null;
    return {
        score: Number(score.toFixed(3)),
        reason: reasons[0] ?? '按当前牌组风格微调动作优先级',
    };
}
