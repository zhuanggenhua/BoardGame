import type { AiLegalAction } from '../../../engine/ai';
import type { MatchState, PlayerId } from '../../../engine/types';
import {
    getMageWarsSpellCardFromConfig,
} from '../data/configPackage';
import {
    getMageWarsObjectAttackProfiles,
    resolveMageWarsObjectEffectiveArmor,
    resolveMageWarsObjectEffectiveLife,
    getMageWarsZoneDistance,
    isMageWarsObjectAttackTargetInRange,
} from '../domain/spellRules';
import type { MageWarsArenaObjectState, MageWarsCore } from '../domain/types';
import {
    doesMageWarsWallBlockLineOfSight,
    getOpponentId,
} from '../domain/utils';

export type MageWarsEvaluationDimension =
    | 'mageSafety'
    | 'material'
    | 'mana'
    | 'position'
    | 'tempo';

export interface MageWarsEvaluationTerm {
    score: number;
    weightedScore: number;
    reason: string;
    factors: Record<string, number | string | boolean>;
}

export interface MageWarsBoardEvaluation {
    total: number;
    breakdown: Record<MageWarsEvaluationDimension, MageWarsEvaluationTerm>;
}

interface MageWarsEvaluationArgs {
    state: MatchState<MageWarsCore>;
    playerId: PlayerId;
    legalActions?: readonly AiLegalAction[];
}

const round = (value: number): number => Number((Number.isFinite(value) ? value : 0).toFixed(3));

const getRemainingLife = (life: number, damage: number): number => Math.max(0, life - damage);

export function getMageWarsObjectValue(
    core: MageWarsCore,
    object: MageWarsArenaObjectState,
): number {
    const remainingLife = getRemainingLife(
        resolveMageWarsObjectEffectiveLife(core, object),
        object.damage,
    );
    const attackProfiles = getMageWarsObjectAttackProfiles(object);
    const bestAttack = attackProfiles.reduce((best, profile) => {
        const expectedDamage = profile.diceCount * 2 * Math.max(1, profile.strikeCount);
        return Math.max(best, expectedDamage + profile.pierce * 1.5);
    }, 0);
    const kindBase = object.kind === 'creature'
        ? 56
        : object.kind === 'conjuration'
            ? 42
            : object.kind === 'equipment'
                ? 34
                : 20;

    return round(
        kindBase
        + remainingLife * 8
        + resolveMageWarsObjectEffectiveArmor(core, object) * 9
        + bestAttack * (object.kind === 'creature' ? 10 : 4)
        + (object.guarding ? 12 : 0)
        + (object.actionReady ? 8 : 0),
    );
}

export function getMageWarsTargetValue(
    core: MageWarsCore,
    targetObjectId?: string,
    targetPlayerId?: PlayerId,
): number {
    if (targetPlayerId) {
        const player = core.players[targetPlayerId];
        if (!player) return 0;
        return round(360 + getRemainingLife(player.life, player.damage) * 10);
    }
    if (targetObjectId) {
        const object = core.objects[targetObjectId];
        return object ? getMageWarsObjectValue(core, object) : 0;
    }
    return 0;
}

export function getMageWarsAttackPotential(
    core: MageWarsCore,
    attacker: MageWarsArenaObjectState,
    targetObject?: MageWarsArenaObjectState,
): number {
    const targetArmor = targetObject
        ? resolveMageWarsObjectEffectiveArmor(core, targetObject)
        : 0;
    return getMageWarsObjectAttackProfiles(attacker).reduce((best, profile) => {
        const expectedDamage = profile.diceCount * 2 * Math.max(1, profile.strikeCount);
        return Math.max(best, Math.max(0, expectedDamage - targetArmor + profile.pierce));
    }, 0);
}

function evaluateMageSafety(
    core: MageWarsCore,
    playerId: PlayerId,
): MageWarsEvaluationTerm {
    const player = core.players[playerId];
    const enemyId = getOpponentId(core, playerId);
    const enemy = core.players[enemyId];
    if (!player || !enemy) {
        return {
            score: -5000,
            weightedScore: -5000,
            reason: '法师状态缺失，局面接近失败',
            factors: { missingPlayer: true },
        };
    }

    let directThreat = 0;
    let nearbyPressure = 0;
    const enemyMageZone = player.mageZoneId;
    for (const object of Object.values(core.objects)) {
        if (object.ownerId !== enemyId || object.kind !== 'creature') continue;
        const distance = getMageWarsZoneDistance(core, object.zoneId, enemyMageZone);
        if (distance !== undefined) {
            nearbyPressure += Math.max(0, 5 - distance) * Math.max(1, getMageWarsAttackPotential(core, object));
        }
        for (const profile of getMageWarsObjectAttackProfiles(object)) {
            if (!isMageWarsObjectAttackTargetInRange(core, object.zoneId, enemyMageZone, profile)) continue;
            if (
                profile.rangeKind === 'ranged'
                && doesMageWarsWallBlockLineOfSight(core, object.zoneId, enemyMageZone)
            ) {
                continue;
            }
            directThreat += Math.max(0, object.damage + getMageWarsAttackPotential(core, object) - player.life + player.damage);
            break;
        }
    }

    const remainingLife = getRemainingLife(player.life, player.damage);
    const lifeRatio = player.life > 0 ? remainingLife / player.life : 0;
    const score = remainingLife * 22
        + lifeRatio * 90
        - directThreat * 48
        - nearbyPressure * 1.8
        + (player.guarding ? 24 : 0);

    return {
        score: round(score),
        weightedScore: round(score * 1.25),
        reason: directThreat > 0
            ? '法师当前受到可兑现的攻击威胁'
            : '法师生命、守卫和附近威胁',
        factors: {
            remainingLife,
            directThreat,
            nearbyPressure: round(nearbyPressure),
            guarding: player.guarding,
        },
    };
}

function evaluateMaterial(
    core: MageWarsCore,
    playerId: PlayerId,
): MageWarsEvaluationTerm {
    const enemyId = getOpponentId(core, playerId);
    const ownMaterial = Object.values(core.objects)
        .filter((object) => object.ownerId === playerId)
        .reduce((total, object) => total + getMageWarsObjectValue(core, object), 0);
    const enemyMaterial = Object.values(core.objects)
        .filter((object) => object.ownerId === enemyId)
        .reduce((total, object) => total + getMageWarsObjectValue(core, object), 0);
    const enemyMage = core.players[enemyId];
    const ownMage = core.players[playerId];
    const mageDelta = ownMage && enemyMage
        ? getRemainingLife(ownMage.life, ownMage.damage) - getRemainingLife(enemyMage.life, enemyMage.damage)
        : 0;
    const score = (ownMaterial - enemyMaterial) * 0.42 + mageDelta * 8;

    return {
        score: round(score),
        weightedScore: round(score),
        reason: '场上单位价值和双方法师生命差',
        factors: {
            ownMaterial: round(ownMaterial),
            enemyMaterial: round(enemyMaterial),
            mageLifeDelta: mageDelta,
        },
    };
}

function evaluateMana(
    core: MageWarsCore,
    playerId: PlayerId,
): MageWarsEvaluationTerm {
    const enemyId = getOpponentId(core, playerId);
    const player = core.players[playerId];
    const enemy = core.players[enemyId];
    const ownReadySources = Object.values(core.objects)
        .filter((object) => object.ownerId === playerId && object.actionReady)
        .length;
    const score = (player?.mana ?? 0) * 2.2
        - (enemy?.mana ?? 0) * 1.1
        + (player?.channeling ?? 0) * 3
        + ownReadySources * 5;

    return {
        score: round(score),
        weightedScore: round(score),
        reason: '法力、导能和可继续行动的施法来源',
        factors: {
            ownMana: player?.mana ?? 0,
            enemyMana: enemy?.mana ?? 0,
            ownChanneling: player?.channeling ?? 0,
            ownReadySources,
        },
    };
}

function evaluatePosition(
    core: MageWarsCore,
    playerId: PlayerId,
): MageWarsEvaluationTerm {
    const enemyId = getOpponentId(core, playerId);
    const ownMage = core.players[playerId];
    const enemyMage = core.players[enemyId];
    if (!ownMage || !enemyMage) {
        return {
            score: 0,
            weightedScore: 0,
            reason: '没有足够的区域信息',
            factors: { missingMage: true },
        };
    }

    const ownForwardPressure = Object.values(core.objects)
        .filter((object) => object.ownerId === playerId && object.kind === 'creature')
        .reduce((total, object) => {
            const distance = getMageWarsZoneDistance(core, object.zoneId, enemyMage.mageZoneId) ?? 6;
            return total + Math.max(0, 6 - distance) * Math.max(1, getMageWarsAttackPotential(core, object));
        }, 0);
    const enemyForwardPressure = Object.values(core.objects)
        .filter((object) => object.ownerId === enemyId && object.kind === 'creature')
        .reduce((total, object) => {
            const distance = getMageWarsZoneDistance(core, object.zoneId, ownMage.mageZoneId) ?? 6;
            return total + Math.max(0, 6 - distance) * Math.max(1, getMageWarsAttackPotential(core, object));
        }, 0);
    const score = (ownForwardPressure - enemyForwardPressure) * 1.5;

    return {
        score: round(score),
        weightedScore: round(score),
        reason: '己方攻击压力和敌方逼近压力',
        factors: {
            ownForwardPressure: round(ownForwardPressure),
            enemyForwardPressure: round(enemyForwardPressure),
        },
    };
}

function evaluateTempo(
    core: MageWarsCore,
    playerId: PlayerId,
    legalActions: readonly AiLegalAction[] | undefined,
): MageWarsEvaluationTerm {
    const actionCounts = new Map<string, number>();
    for (const action of legalActions ?? []) {
        actionCounts.set(action.kind, (actionCounts.get(action.kind) ?? 0) + 1);
    }
    const proactiveActions = [...actionCounts.entries()]
        .filter(([kind]) => kind !== 'advance-phase' && !kind.startsWith('interaction-'))
        .reduce((total, [, count]) => total + count, 0);
    const own = core.players[playerId];
    const score = proactiveActions * 3
        + (own?.actionReady ? 12 : 0)
        + (own?.quickcastReady ? 6 : 0)
        - (actionCounts.get('advance-phase') ?? 0) * (proactiveActions > 0 ? 8 : -4);

    return {
        score: round(score),
        weightedScore: round(score),
        reason: '当前阶段还剩多少可兑现的主动动作',
        factors: {
            proactiveActions,
            actionReady: own?.actionReady === true,
            quickcastReady: own?.quickcastReady === true,
        },
    };
}

export function evaluateMageWarsBoardState(
    args: MageWarsEvaluationArgs,
): MageWarsBoardEvaluation {
    const breakdown = {
        mageSafety: evaluateMageSafety(args.state.core, args.playerId),
        material: evaluateMaterial(args.state.core, args.playerId),
        mana: evaluateMana(args.state.core, args.playerId),
        position: evaluatePosition(args.state.core, args.playerId),
        tempo: evaluateTempo(args.state.core, args.playerId, args.legalActions),
    };
    return {
        total: round(Object.values(breakdown).reduce((total, term) => total + term.weightedScore, 0)),
        breakdown,
    };
}

export function buildMageWarsEvaluationDelta(
    before: MageWarsBoardEvaluation,
    after: MageWarsBoardEvaluation,
): Record<MageWarsEvaluationDimension, { before: number; after: number; delta: number }> {
    return Object.fromEntries(
        (Object.keys(before.breakdown) as MageWarsEvaluationDimension[]).map((dimension) => ({
            dimension,
            before: before.breakdown[dimension].weightedScore,
            after: after.breakdown[dimension].weightedScore,
            delta: round(after.breakdown[dimension].weightedScore - before.breakdown[dimension].weightedScore),
        })).map((entry) => [
            entry.dimension,
            {
                before: entry.before,
                after: entry.after,
                delta: entry.delta,
            },
        ]),
    ) as Record<MageWarsEvaluationDimension, { before: number; after: number; delta: number }>;
}

export function getMageWarsSpellPlanningValue(
    spellCardId: number,
    core: MageWarsCore,
    playerId: PlayerId,
): number {
    const spell = getMageWarsSpellCardFromConfig(spellCardId);
    if (!spell) return 0;
    const player = core.players[playerId];
    const enemyId = getOpponentId(core, playerId);
    const enemy = core.players[enemyId];
    const text = `${spell.spellType} ${spell.typeLine ?? ''} ${spell.attackOrTraitLine ?? ''} ${spell.rulesText ?? ''}`;
    let score = 10 - (spell.manaCost ?? 0) * 0.4;
    if (text.includes('生物')) score += 36;
    if (text.includes('攻击') || text.includes('伤害')) score += 32;
    if (text.includes('治疗')) score += (player && player.damage > 0 ? 34 : 8);
    if (text.includes('防御') || text.includes('护甲')) score += 18;
    if (text.includes('召唤')) score += 18;
    if (text.includes('快速')) score += 8;
    if (enemy && enemy.damage > 0 && (text.includes('攻击') || text.includes('伤害'))) score += 8;
    return round(score);
}
