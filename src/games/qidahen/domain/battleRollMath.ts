import type { RandomFn } from '../../../engine/types';
import { getQidahenTroopDieSides } from './attackRules';
import { getArmamentLevel } from './armamentStateAccessors';
import { hasActiveCharacter } from './characterPresenceAccessors';
import {
    getEffectivePendingDefenderTroops,
    getPendingActionDefenderForceSnapshot,
    getPendingActionSourceForceSnapshot,
    resolvePendingBattleMode,
} from './battleState';
import {
    expandSpecialTroopStacksToCompatPieces,
    getSpecialTroopCount,
} from './troopCompat';
import {
    takeCommittedSpecialTroopStacks,
} from './movementProfileTroopSelection';
import {
    clampTroopLevel,
    getQidahenTroopKindLabel,
} from './troopStacks';
import type {
    QidahenBattleRoll,
    QidahenBattleRollPhase,
    QidahenBattleRolls,
    QidahenCore,
    QidahenFactionId,
    QidahenPendingTargetAction,
    QidahenSpecialTroopStack,
    QidahenTroopKind,
} from './types';

type QidahenCombatUnit = {
    level: number;
    count: number;
    troopKind: QidahenTroopKind;
    factionId: QidahenFactionId | null;
    structured: boolean;
};

type QidahenBattleUnitSide = 'attacker' | 'defender';

type QidahenStructuredBattleRollOptions = {
    defenderSortieBattle: boolean;
    defenderHoldCity: boolean;
    defenderCavalryEvasion: boolean;
    attackerCavalryPlunder: boolean;
};

const getBattleRollArmamentBonus = (
    state: QidahenCore,
    unit: QidahenCombatUnit,
): number => {
    if (!unit.structured) {
        return 0;
    }
    if (unit.troopKind === 'infantry') {
        return getArmamentLevel(state, unit.factionId, 'infantry-armor');
    }
    if (unit.troopKind === 'cavalry') {
        return getArmamentLevel(state, unit.factionId, 'cavalry-armor');
    }
    return 0;
};

const getBattleRollCharacterBonus = (
    state: QidahenCore,
    unit: QidahenCombatUnit,
): number => {
    if (
        unit.structured
        && unit.factionId === 'ming'
        && unit.troopKind === 'artillery'
        && hasActiveCharacter(state, 'ming', 'ming-sun-yuanhua')
        && hasActiveCharacter(state, 'ming', 'ming-yuan-chonghuan')
    ) {
        return 2;
    }
    return 0;
};

const getEffectiveCombatUnitLevel = (
    state: QidahenCore,
    pendingTargetAction: QidahenPendingTargetAction,
    unit: QidahenCombatUnit,
    side: QidahenBattleUnitSide,
): number => {
    let nextLevel = clampTroopLevel(unit.level);
    if (
        unit.structured
        && unit.factionId === 'jin'
        && unit.troopKind === 'infantry'
        && hasActiveCharacter(state, 'jin', 'jin-nurhaci')
    ) {
        nextLevel = clampTroopLevel(nextLevel + 1);
    }
    if (
        side === 'attacker'
        && unit.factionId === 'mongol'
        && unit.troopKind === 'cavalry'
        && hasActiveCharacter(state, 'mongol', 'mongol-qisai-noyan')
    ) {
        nextLevel = clampTroopLevel(nextLevel + 1);
    }
    for (const modifier of pendingTargetAction.tacticModifiers ?? []) {
        if (modifier.side === side && modifier.troopKind === unit.troopKind) {
            nextLevel = clampTroopLevel(nextLevel + modifier.levelBonus);
        }
    }
    return nextLevel;
};

const getBattleRollTacticDiceCountBonus = (
    pendingTargetAction: QidahenPendingTargetAction,
    unit: QidahenCombatUnit,
    side: QidahenBattleUnitSide,
): number => (
    (pendingTargetAction.tacticModifiers ?? [])
        .filter((modifier) => modifier.side === side && modifier.troopKind === unit.troopKind)
        .reduce((total, modifier) => total + (modifier.diceCountBonus ?? 0), 0)
);

const getBattleRollArmamentDiceCountBonus = (
    state: QidahenCore,
    unit: QidahenCombatUnit,
    phase: QidahenBattleRollPhase,
    cityBattle: boolean,
    side: QidahenBattleUnitSide,
): number => {
    if (!unit.structured || !unit.factionId) {
        return 0;
    }
    if (!cityBattle && phase === 'cavalry' && unit.troopKind === 'cavalry') {
        return getArmamentLevel(state, unit.factionId, 'cavalry-firearm') > 0 ? 1 : 0;
    }
    if (!cityBattle && phase === 'infantry' && unit.troopKind === 'infantry') {
        return getArmamentLevel(state, unit.factionId, 'long-barreled-musket') > 0 ? 1 : 0;
    }
    if (cityBattle && side === 'defender' && getArmamentLevel(state, unit.factionId, 'western-bastion') > 0) {
        return 1;
    }
    return 0;
};

const buildStructuredCombatUnitsFromStacks = (
    stacks: readonly QidahenSpecialTroopStack[],
): QidahenCombatUnit[] => {
    const grouped = new Map<string, QidahenCombatUnit>();
    for (const piece of expandSpecialTroopStacksToCompatPieces([...stacks])) {
        const level = Math.max(1, piece.level);
        const key = [
            piece.faction,
            piece.troopKind,
            level.toString(),
        ].join('\u0000');
        const previous = grouped.get(key);
        if (previous) {
            previous.count += 1;
            continue;
        }
        grouped.set(key, {
            level,
            count: 1,
            troopKind: piece.troopKind,
            factionId: piece.faction,
            structured: true,
        });
    }
    return Array.from(grouped.values()).filter((unit) => unit.count > 0);
};

const buildCombatUnits = (
    region: Pick<QidahenCore['regions'][number], 'controller' | 'troops' | 'specialTroops'>,
): QidahenCombatUnit[] => {
    const specialUnits = buildStructuredCombatUnitsFromStacks(region.specialTroops);
    const genericTroops = Math.max(0, region.troops - getSpecialTroopCount(region));
    return [
        ...specialUnits,
        ...(genericTroops > 0
            ? [{
                level: 2,
                count: genericTroops,
                troopKind: 'infantry' as const,
                factionId: region.controller === 'neutral' ? null : region.controller,
                structured: false,
            }]
            : []),
    ].filter((unit) => unit.count > 0);
};

const takeBattleUnits = (
    units: QidahenCombatUnit[],
    maxNonArtilleryTroops: number,
): QidahenCombatUnit[] => {
    const artilleryUnits = units
        .filter((unit) => unit.troopKind === 'artillery')
        .map((unit) => ({ ...unit, level: clampTroopLevel(unit.level) }));
    let remainingNonArtillery = Math.max(0, maxNonArtilleryTroops);
    const nonArtilleryUnits: QidahenCombatUnit[] = [];

    for (const unit of units
        .filter((item) => item.troopKind !== 'artillery')
        .sort((left, right) => right.level - left.level)) {
        if (remainingNonArtillery <= 0) {
            break;
        }
        const used = Math.min(unit.count, remainingNonArtillery);
        if (used > 0) {
            nonArtilleryUnits.push({
                ...unit,
                count: used,
                level: clampTroopLevel(unit.level),
            });
            remainingNonArtillery -= used;
        }
    }

    return [...artilleryUnits, ...nonArtilleryUnits].filter((unit) => unit.count > 0);
};

const buildCommittedBattleUnits = (
    sourceRegion: Pick<QidahenCore['regions'][number], 'controller' | 'troops' | 'specialTroops'>,
    committedTroops: number,
    maxNonArtilleryTroops: number,
    movementProfileId?: string | null,
): QidahenCombatUnit[] => {
    const committedSpecialTroops = takeCommittedSpecialTroopStacks(sourceRegion, committedTroops, movementProfileId);
    const committedSpecialCount = getSpecialTroopCount({ specialTroops: committedSpecialTroops });
    const committedGenericTroops = Math.max(0, committedTroops - committedSpecialCount);
    const units = [
        ...buildStructuredCombatUnitsFromStacks(committedSpecialTroops).map((unit) => ({
            ...unit,
            level: clampTroopLevel(unit.level),
        })),
        ...(committedGenericTroops > 0
            ? [{
                level: 2,
                count: committedGenericTroops,
                troopKind: 'infantry' as const,
                factionId: sourceRegion.controller === 'neutral' ? null : sourceRegion.controller,
                structured: false,
            }]
            : []),
    ];
    return takeBattleUnits(units, maxNonArtilleryTroops);
};

const rollCombatUnit = (
    random: RandomFn,
    state: QidahenCore,
    pendingTargetAction: QidahenPendingTargetAction,
    unit: QidahenCombatUnit,
    phase: QidahenBattleRollPhase,
    cityBattle: boolean,
    side: QidahenBattleUnitSide,
): QidahenBattleRoll[] => {
    const rolls: QidahenBattleRoll[] = [];
    const effectiveLevel = getEffectiveCombatUnitLevel(state, pendingTargetAction, unit, side);
    const diceCountBonus = getBattleRollTacticDiceCountBonus(pendingTargetAction, unit, side)
        + getBattleRollArmamentDiceCountBonus(state, unit, phase, cityBattle, side);
    const rollCount = unit.count * Math.max(1, 1 + diceCountBonus);
    for (let index = 0; index < rollCount; index += 1) {
        const dieSides = getQidahenTroopDieSides(effectiveLevel);
        const raw = random.d(dieSides);
        const armamentBonus = getBattleRollArmamentBonus(state, unit);
        const characterBonus = getBattleRollCharacterBonus(state, unit);
        const armoredValue = raw + armamentBonus + characterBonus;
        const value = cityBattle && phase === 'melee' && unit.troopKind === 'cavalry'
            ? Math.max(0, armoredValue - 1)
            : armoredValue;
        rolls.push({
            troopKind: unit.troopKind,
            level: effectiveLevel,
            dieSides,
            raw,
            value,
        });
    }
    return rolls;
};

const formatBattleRolls = (rolls: QidahenBattleRoll[]): string => (
    rolls.length > 0
        ? rolls.map((roll) => roll.raw === roll.value ? String(roll.value) : `${roll.raw}->${roll.value}`).join('/')
        : '-'
);

const battlePhaseLabelById: Record<QidahenBattleRollPhase, string> = {
    artillery: '炮兵',
    cavalry: '骑兵',
    infantry: '步兵',
    melee: '骑步',
};

const trimBattleUnitsBeforeCounterRoll = (
    units: QidahenCombatUnit[],
    preventedCount: number,
): QidahenCombatUnit[] => {
    let remainingPreventedCount = Math.max(0, preventedCount);
    return units
        .slice()
        .sort((left, right) => left.level - right.level)
        .map((unit) => {
            if (remainingPreventedCount <= 0) {
                return unit;
            }
            const prevented = Math.min(unit.count, remainingPreventedCount);
            remainingPreventedCount -= prevented;
            return {
                ...unit,
                count: unit.count - prevented,
            };
        })
        .filter((unit) => unit.count > 0);
};

const getEiduPriorityPhase = (
    state: QidahenCore,
    attackerUnits: QidahenCombatUnit[],
    defenderUnits: QidahenCombatUnit[],
    cityBattle: boolean,
): {
    phase: Extract<QidahenBattleRollPhase, 'artillery' | 'cavalry' | 'infantry'>;
    side: QidahenBattleUnitSide;
    note: string;
} | null => {
    const attackerHasEidu = attackerUnits.some((unit) => unit.factionId === 'jin') && hasActiveCharacter(state, 'jin', 'jin-eidu');
    const defenderHasEidu = defenderUnits.some((unit) => unit.factionId === 'jin') && hasActiveCharacter(state, 'jin', 'jin-eidu');
    if (!attackerHasEidu && !defenderHasEidu) {
        return null;
    }

    const prioritySide: QidahenBattleUnitSide = attackerHasEidu ? 'attacker' : 'defender';
    const ownUnits = prioritySide === 'attacker' ? attackerUnits : defenderUnits;
    const enemyUnits = prioritySide === 'attacker' ? defenderUnits : attackerUnits;
    const candidatePhases: Array<Extract<QidahenBattleRollPhase, 'artillery' | 'cavalry' | 'infantry'>> = cityBattle
        ? ['artillery']
        : ['artillery', 'cavalry', 'infantry'];

    const bestCandidate = candidatePhases
        .map((phase) => {
            const ownPower = ownUnits
                .filter((unit) => unit.troopKind === phase)
                .reduce((sum, unit) => sum + unit.level * unit.count, 0);
            const enemyPower = enemyUnits
                .filter((unit) => unit.troopKind === phase)
                .reduce((sum, unit) => sum + unit.level * unit.count, 0);
            return { phase, ownPower, enemyPower };
        })
        .filter((candidate) => candidate.ownPower > 0 && candidate.enemyPower > 0)
        .sort((left, right) => (
            (right.ownPower * 100 + right.enemyPower) - (left.ownPower * 100 + left.enemyPower)
        ))[0];

    if (!bestCandidate) {
        return null;
    }

    return {
        phase: bestCandidate.phase,
        side: prioritySide,
        note: `额亦都指定${getQidahenTroopKindLabel(bestCandidate.phase)}先掷`,
    };
};

const rollBattleStage = (
    random: RandomFn,
    state: QidahenCore,
    pendingTargetAction: QidahenPendingTargetAction,
    phase: QidahenBattleRollPhase,
    attackerUnits: QidahenCombatUnit[],
    defenderUnits: QidahenCombatUnit[],
    cityBattle: boolean,
    eiduPriority: ReturnType<typeof getEiduPriorityPhase>,
) => {
    const accepts = (unit: QidahenCombatUnit) => (
        phase === 'melee'
            ? unit.troopKind === 'cavalry' || unit.troopKind === 'infantry'
            : unit.troopKind === phase
    );
    const stageAttackerUnits = attackerUnits.filter(accepts);
    const stageDefenderUnits = defenderUnits.filter(accepts);
    let attackerRolls: QidahenBattleRoll[] = [];
    let defenderRolls: QidahenBattleRoll[] = [];

    if (eiduPriority?.phase === phase && phase !== 'melee') {
        if (eiduPriority.side === 'attacker') {
            attackerRolls = stageAttackerUnits.flatMap((unit) => rollCombatUnit(random, state, pendingTargetAction, unit, phase, cityBattle, 'attacker'));
            const preventedDefenderUnits = trimBattleUnitsBeforeCounterRoll(
                stageDefenderUnits,
                Math.floor(attackerRolls.reduce((sum, roll) => sum + roll.value, 0) / 3),
            );
            defenderRolls = preventedDefenderUnits.flatMap((unit) => rollCombatUnit(random, state, pendingTargetAction, unit, phase, cityBattle, 'defender'));
        } else {
            defenderRolls = stageDefenderUnits.flatMap((unit) => rollCombatUnit(random, state, pendingTargetAction, unit, phase, cityBattle, 'defender'));
            const preventedAttackerUnits = trimBattleUnitsBeforeCounterRoll(
                stageAttackerUnits,
                Math.floor(defenderRolls.reduce((sum, roll) => sum + roll.value, 0) / 3),
            );
            attackerRolls = preventedAttackerUnits.flatMap((unit) => rollCombatUnit(random, state, pendingTargetAction, unit, phase, cityBattle, 'attacker'));
        }
    } else {
        attackerRolls = stageAttackerUnits
            .flatMap((unit) => rollCombatUnit(random, state, pendingTargetAction, unit, phase, cityBattle, 'attacker'));
        defenderRolls = stageDefenderUnits
            .flatMap((unit) => rollCombatUnit(random, state, pendingTargetAction, unit, phase, cityBattle, 'defender'));
    }
    const attackerTotal = attackerRolls.reduce((sum, roll) => sum + roll.value, 0);
    const defenderTotal = defenderRolls.reduce((sum, roll) => sum + roll.value, 0);

    return {
        phase,
        attackerRolls,
        defenderRolls,
        attackerTotal,
        defenderTotal,
        attackerDamage: Math.floor(attackerTotal / 3),
        defenderDamage: Math.floor(defenderTotal / 3),
        priorityNote: eiduPriority?.phase === phase ? eiduPriority.note : null,
    };
};

const buildBattleRollSummary = (stages: ReturnType<typeof rollBattleStage>[], cityBattle: boolean): string => {
    const stageTexts = stages.map((stage) => (
        `${battlePhaseLabelById[stage.phase]}${stage.priorityNote ? `(${stage.priorityNote})` : ''} 攻${formatBattleRolls(stage.attackerRolls)}=${stage.attackerTotal}/守${formatBattleRolls(stage.defenderRolls)}=${stage.defenderTotal}`
    ));
    const attackerDamage = stages.reduce((sum, stage) => sum + stage.attackerDamage, 0);
    const defenderDamage = stages.reduce((sum, stage) => sum + stage.defenderDamage, 0);
    return `战斗掷骰（${cityBattle ? '城战' : '野战'}）：${stageTexts.join('；')}。攻方造成 ${attackerDamage} 损伤，守方造成 ${defenderDamage} 损伤。`;
};

export const computeQidahenCavalryPlunderCounterPower = (
    targetRegion: Pick<QidahenCore['regions'][number], 'controller' | 'troops' | 'specialTroops'>,
): number => buildCombatUnits(targetRegion)
    .filter((unit) => unit.troopKind === 'artillery' || unit.troopKind === 'cavalry')
    .reduce((sum, unit) => sum + unit.level * unit.count, 0);

export const createQidahenStructuredBattleRolls = (
    state: QidahenCore,
    pendingTargetAction: QidahenPendingTargetAction,
    random: RandomFn,
    options: QidahenStructuredBattleRollOptions,
): QidahenBattleRolls | null => {
    if (options.defenderHoldCity || options.defenderCavalryEvasion || options.attackerCavalryPlunder) {
        return null;
    }
    if (pendingTargetAction.actionId !== 'raid' && pendingTargetAction.actionId !== 'wheel-dispatch' && pendingTargetAction.actionId !== 'drive-tiger') {
        return null;
    }

    const sourceRegion = getPendingActionSourceForceSnapshot(state, pendingTargetAction);
    const targetRegion = state.regions.find((region) => !region.isLogicalRegion && region.id === pendingTargetAction.targetRuntimeRegionId) ?? null;
    if (!sourceRegion || !targetRegion) {
        return null;
    }

    const battleMode = resolvePendingBattleMode(pendingTargetAction, targetRegion, options);
    const targetBattleRegion = getPendingActionDefenderForceSnapshot(targetRegion, pendingTargetAction, battleMode);
    const hasStructuredTroops = sourceRegion.specialTroops.length > 0 || targetBattleRegion.specialTroops.length > 0;
    if (!hasStructuredTroops) {
        return null;
    }

    const effectiveDefenderTroops = getEffectivePendingDefenderTroops(targetRegion, pendingTargetAction, battleMode);
    const defenderPressure = Math.max(1, Math.min(effectiveDefenderTroops, pendingTargetAction.battleWidth));
    const attackerUnits = buildCommittedBattleUnits(
        sourceRegion,
        pendingTargetAction.committedTroops,
        pendingTargetAction.attackPressure || pendingTargetAction.battleWidth,
        pendingTargetAction.movementProfileId,
    );
    const defenderUnits = takeBattleUnits(buildCombatUnits(targetBattleRegion), defenderPressure);
    if (attackerUnits.length === 0 && defenderUnits.length === 0) {
        return null;
    }

    const cityBattle = battleMode === 'city';
    const phases: QidahenBattleRollPhase[] = cityBattle
        ? ['artillery', 'melee']
        : ['artillery', 'cavalry', 'infantry'];
    const eiduPriority = getEiduPriorityPhase(state, attackerUnits, defenderUnits, cityBattle);
    const stages = phases
        .map((phase) => rollBattleStage(random, state, pendingTargetAction, phase, attackerUnits, defenderUnits, cityBattle, eiduPriority))
        .filter((stage) => stage.attackerRolls.length > 0 || stage.defenderRolls.length > 0);
    const attackerDamage = stages.reduce((sum, stage) => sum + stage.attackerDamage, 0);
    const defenderDamage = stages.reduce((sum, stage) => sum + stage.defenderDamage, 0);

    return {
        cityBattle,
        stages,
        attackerDamage,
        defenderDamage,
        summary: buildBattleRollSummary(stages, cityBattle),
    };
};
