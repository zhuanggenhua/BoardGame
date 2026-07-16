import type { AiLegalAction } from '../../../engine/ai';
import type { MatchState } from '../../../engine/types';
import {
    BOARD_COLS,
    BOARD_ROWS,
    getPlayerGates,
    getPlayerUnits,
    getStructureAt,
    getSummoner,
    getUnitAt,
    getValidAttackTargetsEnhanced,
    manhattanDistance,
} from '../domain/helpers';
import type {
    BoardStructure,
    BoardUnit,
    Card,
    CellCoord,
    PlayerId,
    SummonerWarsCore,
} from '../domain/types';
import {
    getSummonerWarsFactionAiProfile,
    type SummonerWarsEvaluationDimension,
    type SummonerWarsFactionAiProfile,
} from './factionProfiles';

export type { SummonerWarsEvaluationDimension };

export interface SummonerWarsEvaluationTerm {
    score: number;
    weight: number;
    weightedScore: number;
    reason: string;
    factors: Record<string, number | string | boolean>;
}
export interface SummonerWarsBoardEvaluation {
    total: number;
    breakdown: Record<SummonerWarsEvaluationDimension, SummonerWarsEvaluationTerm>;
    profile: {
        factionId: SummonerWarsFactionAiProfile['factionId'];
        summary: readonly string[];
    };
}

export interface SummonerWarsThreatEstimate {
    remainingLife: number;
    directThreatDamage: number;
    nearbyEnemyPressure: number;
    threateningEnemyIds: string[];
}

interface EvaluationArgs {
    state: MatchState<SummonerWarsCore>;
    playerId: PlayerId;
    legalActions?: readonly AiLegalAction[];
    profile?: SummonerWarsFactionAiProfile;
}

const DIMENSIONS: SummonerWarsEvaluationDimension[] = [
    'summonerSafety',
    'threatAndKills',
    'magicEconomy',
    'positionControl',
    'tempo',
];

export const getSummonerWarsEnemyPlayerId = (playerId: PlayerId): PlayerId => (playerId === '0' ? '1' : '0');

const finite = (value: number): number => Number.isFinite(value) ? value : 0;

const round = (value: number): number => Number(finite(value).toFixed(3));

export const getSummonerWarsCenterScore = (position: CellCoord): number => {
    const centerCol = Math.floor((BOARD_COLS - 1) / 2);
    return Math.max(0, 4 - Math.abs(position.col - centerCol));
};

export const getSummonerWarsFrontRowScore = (position: CellCoord, playerId: PlayerId): number => {
    return playerId === '0'
        ? (BOARD_ROWS - 1 - position.row)
        : position.row;
};

export function getSummonerWarsCardKeepValue(card: Card): number {
    if (card.cardType === 'unit') {
        return card.strength * 18 + card.life * 8 + card.cost * 6;
    }
    if (card.cardType === 'structure') {
        return 40 + card.life * 6 + card.cost * 5 + (card.isGate ? 10 : 0);
    }
    return 18 + card.cost * 6 + (card.isActive ? 8 : 0) + (card.playPhase === 'any' ? 4 : 0);
}

export function getSummonerWarsUnitValue(unit: BoardUnit): number {
    const remainingLife = Math.max(0, unit.card.life - unit.damage);
    const classBonus = unit.card.unitClass === 'summoner'
        ? 420
        : unit.card.unitClass === 'champion'
            ? 82
            : 28;
    return round(
        classBonus
        + unit.card.strength * 20
        + remainingLife * 12
        + unit.card.cost * 9
        + (unit.boosts ?? 0) * 8,
    );
}

function getStructureValue(structure: BoardStructure, owner: PlayerId): number {
    const remainingLife = Math.max(0, structure.card.life - structure.damage);
    const frontRowScore = getSummonerWarsFrontRowScore(structure.position, owner);
    return round(
        (structure.card.isGate ? 74 : 32)
        + remainingLife * 9
        + structure.card.cost * 7
        + (structure.card.isGate ? frontRowScore * 6 : 0),
    );
}

export function estimateSummonerWarsSummonerThreat(
    core: SummonerWarsCore,
    playerId: PlayerId,
): SummonerWarsThreatEstimate {
    const summoner = getSummoner(core, playerId);
    if (!summoner) {
        return {
            remainingLife: 0,
            directThreatDamage: 0,
            nearbyEnemyPressure: 0,
            threateningEnemyIds: [],
        };
    }

    const enemyUnits = getPlayerUnits(core, getSummonerWarsEnemyPlayerId(playerId));
    let directThreatDamage = 0;
    let nearbyEnemyPressure = 0;
    const threateningEnemyIds: string[] = [];

    for (const enemyUnit of enemyUnits) {
        const canHitSummonerNow = getValidAttackTargetsEnhanced(core, enemyUnit.position).some((target) => {
            return target.row === summoner.position.row && target.col === summoner.position.col;
        });
        if (canHitSummonerNow) {
            directThreatDamage += enemyUnit.card.strength;
            threateningEnemyIds.push(enemyUnit.instanceId);
        }

        const distance = manhattanDistance(enemyUnit.position, summoner.position);
        nearbyEnemyPressure += Math.max(0, 5 - distance) * Math.max(1, enemyUnit.card.strength);
    }

    return {
        remainingLife: Math.max(0, summoner.card.life - summoner.damage),
        directThreatDamage,
        nearbyEnemyPressure,
        threateningEnemyIds,
    };
}

function makeTerm(
    dimension: SummonerWarsEvaluationDimension,
    rawScore: number,
    profile: SummonerWarsFactionAiProfile,
    reason: string,
    factors: Record<string, number | string | boolean>,
): SummonerWarsEvaluationTerm {
    const profileWeight = profile.evaluationWeights[dimension] ?? 1;
    const weight = dimension === 'summonerSafety'
        ? Math.max(1, profileWeight)
        : profileWeight;
    return {
        score: round(rawScore),
        weight: round(weight),
        weightedScore: round(rawScore * weight),
        reason,
        factors,
    };
}

function evaluateSummonerSafety(
    core: SummonerWarsCore,
    playerId: PlayerId,
    profile: SummonerWarsFactionAiProfile,
): SummonerWarsEvaluationTerm {
    const ownSummoner = getSummoner(core, playerId);
    const threat = estimateSummonerWarsSummonerThreat(core, playerId);
    if (!ownSummoner) {
        return makeTerm('summonerSafety', -5000, profile, '己方召唤师不存在，局面接近失败', {
            missingSummoner: true,
        });
    }

    const alliedBlockers = getPlayerUnits(core, playerId)
        .filter((unit) => unit.instanceId !== ownSummoner.instanceId)
        .filter((unit) => manhattanDistance(unit.position, ownSummoner.position) <= 1).length;
    const remainingLifeRatio = ownSummoner.card.life > 0
        ? threat.remainingLife / ownSummoner.card.life
        : 0;
    const rawScore = threat.remainingLife * 42
        + remainingLifeRatio * 90
        + alliedBlockers * 18
        - threat.directThreatDamage * 58
        - threat.nearbyEnemyPressure * 5;

    return makeTerm('summonerSafety', rawScore, profile, '召唤师生命、直伤威胁和身边挡路单位', {
        remainingLife: threat.remainingLife,
        directThreatDamage: threat.directThreatDamage,
        nearbyEnemyPressure: round(threat.nearbyEnemyPressure),
        alliedBlockers,
    });
}

function evaluateThreatAndKills(
    core: SummonerWarsCore,
    playerId: PlayerId,
    profile: SummonerWarsFactionAiProfile,
): SummonerWarsEvaluationTerm {
    const enemyPlayerId = getSummonerWarsEnemyPlayerId(playerId);
    const enemySummoner = getSummoner(core, enemyPlayerId);
    let ownMaterial = 0;
    let enemyMaterial = 0;
    let killWindowValue = 0;
    let enemySummonerPressure = 0;

    for (const unit of getPlayerUnits(core, playerId)) {
        ownMaterial += getSummonerWarsUnitValue(unit);
        const attackTargets = getValidAttackTargetsEnhanced(core, unit.position);
        for (const target of attackTargets) {
            const targetUnit = getUnitAt(core, target);
            const targetStructure = targetUnit ? undefined : getStructureAt(core, target);
            const remainingLife = targetUnit
                ? targetUnit.card.life - targetUnit.damage
                : targetStructure
                    ? targetStructure.card.life - targetStructure.damage
                    : 99;
            const targetValue = targetUnit
                ? getSummonerWarsUnitValue(targetUnit)
                : targetStructure
                    ? getStructureValue(targetStructure, targetStructure.owner)
                    : 0;
            const lethalLikely = unit.card.strength >= remainingLife;
            killWindowValue += lethalLikely
                ? Math.min(220, targetValue * 0.36 + 55)
                : Math.max(0, 24 - Math.abs(remainingLife - unit.card.strength) * 4);
            if (enemySummoner && target.row === enemySummoner.position.row && target.col === enemySummoner.position.col) {
                enemySummonerPressure += 95 + unit.card.strength * 14;
            }
        }
    }

    for (const unit of getPlayerUnits(core, enemyPlayerId)) {
        enemyMaterial += getSummonerWarsUnitValue(unit);
    }

    for (const row of core.board) {
        for (const cell of row) {
            if (!cell.structure) continue;
            if (cell.structure.owner === playerId) {
                ownMaterial += getStructureValue(cell.structure, playerId);
            } else {
                enemyMaterial += getStructureValue(cell.structure, enemyPlayerId);
            }
        }
    }

    const rawScore = (ownMaterial - enemyMaterial) * 0.14 + killWindowValue + enemySummonerPressure;
    return makeTerm('threatAndKills', rawScore, profile, '己方材料、可确认击杀和敌方召唤师压力', {
        ownMaterial: round(ownMaterial),
        enemyMaterial: round(enemyMaterial),
        killWindowValue: round(killWindowValue),
        enemySummonerPressure: round(enemySummonerPressure),
    });
}

function evaluateMagicEconomy(
    core: SummonerWarsCore,
    playerId: PlayerId,
    profile: SummonerWarsFactionAiProfile,
): SummonerWarsEvaluationTerm {
    const enemyPlayerId = getSummonerWarsEnemyPlayerId(playerId);
    const player = core.players[playerId];
    const enemy = core.players[enemyPlayerId];
    const handKeepValue = player.hand.reduce((sum, card) => sum + getSummonerWarsCardKeepValue(card), 0);
    const lowKeepCards = player.hand.filter((card) => getSummonerWarsCardKeepValue(card) <= 55).length;
    const playableUnits = player.hand.filter((card) => card.cardType === 'unit' && card.cost <= player.magic).length;
    const magicOverflowPenalty = Math.max(0, player.magic - 12) * 18;
    const rawScore = player.magic * 22
        - enemy.magic * 10
        + playableUnits * 18
        + lowKeepCards * 11
        + Math.min(160, handKeepValue * 0.05)
        - magicOverflowPenalty;

    return makeTerm('magicEconomy', rawScore, profile, '魔力、可打牌曲线和低保留价值手牌', {
        magic: player.magic,
        enemyMagic: enemy.magic,
        handKeepValue: round(handKeepValue),
        lowKeepCards,
        playableUnits,
        magicOverflowPenalty,
    });
}

function evaluatePositionControl(
    core: SummonerWarsCore,
    playerId: PlayerId,
    profile: SummonerWarsFactionAiProfile,
): SummonerWarsEvaluationTerm {
    const enemyPlayerId = getSummonerWarsEnemyPlayerId(playerId);
    const ownUnits = getPlayerUnits(core, playerId);
    const enemyUnits = getPlayerUnits(core, enemyPlayerId);
    const ownCenter = ownUnits.reduce((sum, unit) => sum + getSummonerWarsCenterScore(unit.position), 0);
    const enemyCenter = enemyUnits.reduce((sum, unit) => sum + getSummonerWarsCenterScore(unit.position), 0);
    const ownFront = ownUnits.reduce((sum, unit) => sum + getSummonerWarsFrontRowScore(unit.position, playerId), 0);
    const enemyFront = enemyUnits.reduce((sum, unit) => sum + getSummonerWarsFrontRowScore(unit.position, enemyPlayerId), 0);
    const ownForwardGates = getPlayerGates(core, playerId)
        .filter((gate) => !gate.card.isStartingGate && getSummonerWarsFrontRowScore(gate.position, playerId) >= 3).length;
    const enemyForwardGates = getPlayerGates(core, enemyPlayerId)
        .filter((gate) => !gate.card.isStartingGate && getSummonerWarsFrontRowScore(gate.position, enemyPlayerId) >= 3).length;
    const rawScore = (ownCenter - enemyCenter) * 15
        + (ownFront - enemyFront) * 6
        + (ownForwardGates - enemyForwardGates) * 44;

    return makeTerm('positionControl', rawScore, profile, '中心控制、前线深度和前推城门', {
        ownCenter,
        enemyCenter,
        ownFront,
        enemyFront,
        ownForwardGates,
        enemyForwardGates,
    });
}

function evaluateTempo(
    core: SummonerWarsCore,
    legalActions: readonly AiLegalAction[] | undefined,
    profile: SummonerWarsFactionAiProfile,
): SummonerWarsEvaluationTerm {
    const actionCounts = new Map<string, number>();
    for (const action of legalActions ?? []) {
        actionCounts.set(action.kind, (actionCounts.get(action.kind) ?? 0) + 1);
    }

    const proactiveActions = [...actionCounts.entries()]
        .filter(([kind]) => kind !== 'advance-phase' && kind !== 'interaction-cancel')
        .reduce((sum, [, count]) => sum + count, 0);
    const phaseWeight = core.phase === 'attack'
        ? 22
        : core.phase === 'move'
            ? 18
            : core.phase === 'summon' || core.phase === 'build'
                ? 14
                : core.phase === 'magic'
                    ? 10
                    : 4;
    const rawScore = proactiveActions * phaseWeight
        + (actionCounts.get('activate-ability') ?? 0) * 18
        + (actionCounts.get('declare-attack') ?? 0) * 24
        + (actionCounts.get('summon-unit') ?? 0) * 12
        - (actionCounts.get('advance-phase') ?? 0) * (proactiveActions > 0 ? 18 : -8);

    return makeTerm('tempo', rawScore, profile, '当前阶段仍可兑现的动作窗口', {
        phase: core.phase,
        proactiveActions,
        attackActions: actionCounts.get('declare-attack') ?? 0,
        abilityActions: actionCounts.get('activate-ability') ?? 0,
        summonActions: actionCounts.get('summon-unit') ?? 0,
    });
}

export function evaluateSummonerWarsBoardState(args: EvaluationArgs): SummonerWarsBoardEvaluation {
    const profile = args.profile ?? getSummonerWarsFactionAiProfile(args.state.core, args.playerId);
    const breakdown: Record<SummonerWarsEvaluationDimension, SummonerWarsEvaluationTerm> = {
        summonerSafety: evaluateSummonerSafety(args.state.core, args.playerId, profile),
        threatAndKills: evaluateThreatAndKills(args.state.core, args.playerId, profile),
        magicEconomy: evaluateMagicEconomy(args.state.core, args.playerId, profile),
        positionControl: evaluatePositionControl(args.state.core, args.playerId, profile),
        tempo: evaluateTempo(args.state.core, args.legalActions, profile),
    };
    const total = DIMENSIONS.reduce((sum, dimension) => sum + breakdown[dimension].weightedScore, 0);

    return {
        total: round(total),
        breakdown,
        profile: {
            factionId: profile.factionId,
            summary: profile.summary,
        },
    };
}

export function buildSummonerWarsEvaluationDelta(
    before: SummonerWarsBoardEvaluation,
    after: SummonerWarsBoardEvaluation,
): Record<SummonerWarsEvaluationDimension, { before: number; after: number; delta: number }> {
    return Object.fromEntries(
        DIMENSIONS.map((dimension) => {
            const beforeScore = before.breakdown[dimension].weightedScore;
            const afterScore = after.breakdown[dimension].weightedScore;
            return [
                dimension,
                {
                    before: beforeScore,
                    after: afterScore,
                    delta: round(afterScore - beforeScore),
                },
            ];
        }),
    ) as Record<SummonerWarsEvaluationDimension, { before: number; after: number; delta: number }>;
}
