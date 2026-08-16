import type { RandomFn } from '../../../engine/types';
import { getNonSiegedCityActionSourceSnapshot } from './actionSourceRegionState';
import { getQidahenTroopDieSides } from './attackRules';
import { getArmamentLevel } from './armamentStateAccessors';
import { hasArmamentSourceCard } from './armamentStateAccessors';
import { getQidahenBattleForceCommitments } from './battleForceCommitments';
import { hasActiveCharacter } from './characterPresenceAccessors';
import {
    getEffectivePendingDefenderTroops,
    getPendingActionDefenderForceSnapshot,
    getPendingActionSourceForceSnapshot,
    getRegionSiegeAttackerForceSnapshot,
    resolvePendingBattleMode,
} from './battleState';
import {
    collapseCompatPiecesToSpecialTroopStacks,
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
    QidahenBattleTacticModifier,
    QidahenBattleRoll,
    QidahenBattleRollPhase,
    QidahenBattleRolls,
    QidahenCore,
    QidahenFactionId,
    QidahenPendingTargetAction,
    QidahenSpecialTroopStack,
    QidahenTroopClass,
    QidahenTroopKind,
} from './types';

type QidahenCombatUnit = {
    level: number;
    count: number;
    troopKind: QidahenTroopKind;
    troopClass: QidahenTroopClass;
    factionId: QidahenFactionId | null;
    structured: boolean;
    pieceIds: string[];
    appliedTacticModifierIds?: string[];
};

type QidahenBattleUnitSide = 'attacker' | 'defender';

type QidahenStructuredBattleRollOptions = {
    defenderSortieBattle: boolean;
    defenderHoldCity: boolean;
    defenderCavalryEvasion: boolean;
    attackerCavalryPlunder: boolean;
};

const RED_COAT_CANNON_CARD_DEF_ID = 'qidahen-atlas05-1634-red-coat-cannon';
const FINE_STEEL_SABER_CARD_DEF_ID = 'qidahen-atlas05-1616-fine-steel-saber';
const CAVALRY_FIREARM_CARD_DEF_ID = 'qidahen-atlas05-1639-cavalry-firearm';
const LINKED_MUSKETS_CARD_DEF_ID = 'qidahen-atlas05-1646-linked-muskets';

const isTacticModifierActive = (
    pendingTargetAction: QidahenPendingTargetAction,
    modifier: QidahenBattleTacticModifier,
): boolean => {
    const sourceCardDefId = modifier.sourceCardDefId;
    if (!sourceCardDefId) {
        return true;
    }

    return !(pendingTargetAction.tacticModifiers ?? []).some((cancellingModifier) => {
        if (
            cancellingModifier.side === modifier.side
            || !cancellingModifier.cancelEnemyTacticSourceCardDefIds?.includes(sourceCardDefId)
        ) {
            return false;
        }

        const cancellingSourceCardDefId = cancellingModifier.sourceCardDefId;
        const mutuallyCancel = !!cancellingSourceCardDefId
            && modifier.cancelEnemyTacticSourceCardDefIds?.includes(cancellingSourceCardDefId) === true;
        if (!mutuallyCancel) {
            return true;
        }
        if (modifier.playedAt == null || cancellingModifier.playedAt == null) {
            return true;
        }
        return cancellingModifier.playedAt > modifier.playedAt;
    });
};

const controlsOrdosRegion = (state: QidahenCore, factionId: QidahenFactionId): boolean => (
    state.regions.some((region) => (
        !region.isLogicalRegion
        && region.id === 'city-region-26'
        && region.controller === factionId
    ))
);

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
    let levelOverride: number | null = null;
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
        if (!isTacticModifierActive(pendingTargetAction, modifier)) {
            continue;
        }
        const targetsUnit = modifier.targetPieceId
            ? unit.pieceIds.includes(modifier.targetPieceId)
            : modifier.targetTokenId
                ? unit.appliedTacticModifierIds?.includes(modifier.id) === true
                : true;
        if (modifier.side === side && modifier.troopKind === unit.troopKind && targetsUnit) {
            if (modifier.levelOverride !== undefined) {
                levelOverride = modifier.levelOverride;
            }
            nextLevel = clampTroopLevel(nextLevel + modifier.levelBonus);
        }
    }
    return levelOverride === null
        ? nextLevel
        : clampTroopLevel(levelOverride);
};

const getBattleRollTacticDiceCountBonus = (
    pendingTargetAction: QidahenPendingTargetAction,
    unit: QidahenCombatUnit,
    side: QidahenBattleUnitSide,
): number => (
    (pendingTargetAction.tacticModifiers ?? [])
        .filter((modifier) => (
            isTacticModifierActive(pendingTargetAction, modifier)
            && modifier.side === side
            && modifier.troopKind === unit.troopKind
            && (
                modifier.targetPieceId
                    ? unit.pieceIds.includes(modifier.targetPieceId)
                    : modifier.targetTokenId
                        ? unit.appliedTacticModifierIds?.includes(modifier.id) === true
                        : true
            )
        ))
        .reduce((total, modifier) => total + (modifier.diceCountBonus ?? 0), 0)
);

const getBattleRollTacticValueDivisor = (
    pendingTargetAction: QidahenPendingTargetAction,
    unit: QidahenCombatUnit,
    side: QidahenBattleUnitSide,
): number => (
    (pendingTargetAction.tacticModifiers ?? [])
        .filter((modifier) => (
            isTacticModifierActive(pendingTargetAction, modifier)
            && modifier.side === side
            && modifier.troopKind === unit.troopKind
            && (
                modifier.targetPieceId
                    ? unit.pieceIds.includes(modifier.targetPieceId)
                    : modifier.targetTokenId
                        ? unit.appliedTacticModifierIds?.includes(modifier.id) === true
                        : true
            )
        ))
        .reduce((maxDivisor, modifier) => Math.max(maxDivisor, modifier.rollValueDivisor ?? 1), 1)
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
    if (phase === 'artillery' && unit.troopKind === 'artillery') {
        const artilleryTechBonus = getArmamentLevel(state, unit.factionId, 'artillery-tech') > 0 ? 1 : 0;
        const redCoatCannonBonus = hasArmamentSourceCard(
            state,
            unit.factionId,
            'artillery-tech',
            RED_COAT_CANNON_CARD_DEF_ID,
        )
            ? cityBattle && side === 'attacker'
                ? 2
                : !cityBattle && side === 'defender'
                    ? 1
                    : 0
            : 0;
        return artilleryTechBonus + redCoatCannonBonus;
    }
    if (!cityBattle && phase === 'cavalry' && unit.troopKind === 'cavalry') {
        const hasCavalryFirearmSource = hasArmamentSourceCard(
            state,
            unit.factionId,
            'cavalry-firearm',
            CAVALRY_FIREARM_CARD_DEF_ID,
        );
        const hasFineSteelSaberSource = hasArmamentSourceCard(
            state,
            unit.factionId,
            'cavalry-firearm',
            FINE_STEEL_SABER_CARD_DEF_ID,
        );
        const hasLegacyCavalryFirearm = getArmamentLevel(state, unit.factionId, 'cavalry-firearm') > 0
            && !hasFineSteelSaberSource;
        return hasCavalryFirearmSource
            || hasLegacyCavalryFirearm
            || (hasFineSteelSaberSource && controlsOrdosRegion(state, unit.factionId))
            ? 1
            : 0;
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
            piece.troopClass,
            level.toString(),
        ].join('\u0000');
        const previous = grouped.get(key);
        if (previous) {
            previous.count += 1;
            previous.pieceIds.push(piece.id);
            continue;
        }
        grouped.set(key, {
            level,
            count: 1,
            troopKind: piece.troopKind,
            troopClass: piece.troopClass,
            factionId: piece.faction,
            structured: true,
            pieceIds: [piece.id],
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
                troopClass: 'regular' as const,
                factionId: region.controller === 'neutral' ? null : region.controller,
                structured: false,
                pieceIds: [],
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

const splitBattleUnitsByTransferredCount = (
    units: QidahenCombatUnit[],
    troopKind: QidahenTroopKind,
    transferCount: number,
    targetTroopClass?: QidahenTroopClass,
    targetPieceId?: string,
): { remainingUnits: QidahenCombatUnit[]; transferredUnits: QidahenCombatUnit[] } => {
    let remainingTransferCount = Math.max(0, transferCount);
    const remainingUnits: QidahenCombatUnit[] = [];
    const transferredUnits: QidahenCombatUnit[] = [];

    for (const unit of units) {
        const matchesPiece = targetPieceId == null || unit.pieceIds.includes(targetPieceId);
        const matchesTroopClass = targetTroopClass == null || unit.troopClass === targetTroopClass;
        if (
            unit.troopKind !== troopKind
            || !matchesTroopClass
            || !matchesPiece
            || remainingTransferCount <= 0
        ) {
            remainingUnits.push(unit);
            continue;
        }
        const transferredCount = targetPieceId == null
            ? Math.min(unit.count, remainingTransferCount)
            : 1;
        remainingTransferCount -= transferredCount;
        if (unit.count > transferredCount) {
            remainingUnits.push({
                ...unit,
                count: unit.count - transferredCount,
                pieceIds: targetPieceId == null
                    ? unit.pieceIds.slice(transferredCount)
                    : unit.pieceIds.filter((pieceId) => pieceId !== targetPieceId),
            });
        }
        transferredUnits.push({
            ...unit,
            count: transferredCount,
            pieceIds: targetPieceId == null
                ? unit.pieceIds.slice(0, transferredCount)
                : [targetPieceId],
        });
    }

    return { remainingUnits, transferredUnits };
};

const applyTacticUnitTransfers = (
    pendingTargetAction: QidahenPendingTargetAction,
    attackerUnits: QidahenCombatUnit[],
    defenderUnits: QidahenCombatUnit[],
): { attackerUnits: QidahenCombatUnit[]; defenderUnits: QidahenCombatUnit[] } => {
    let nextAttackerUnits = attackerUnits;
    let nextDefenderUnits = defenderUnits;
    for (const modifier of pendingTargetAction.tacticModifiers ?? []) {
        if (!isTacticModifierActive(pendingTargetAction, modifier)) {
            continue;
        }
        const transferCount = modifier.convertEnemyTroopCount ?? 0;
        if (transferCount <= 0 || modifier.side !== 'attacker') {
            continue;
        }
        const transferResult = splitBattleUnitsByTransferredCount(
            nextDefenderUnits,
            modifier.troopKind,
            transferCount,
            modifier.targetTroopClass,
            modifier.targetPieceId,
        );
        nextDefenderUnits = transferResult.remainingUnits;
        nextAttackerUnits = [
            ...nextAttackerUnits,
            ...transferResult.transferredUnits.map((unit) => ({
                ...unit,
                factionId: pendingTargetAction.attackerFactionId,
            })),
        ];
    }
    return { attackerUnits: nextAttackerUnits, defenderUnits: nextDefenderUnits };
};

const applyTacticUnitKindOverrides = (
    pendingTargetAction: QidahenPendingTargetAction,
    side: QidahenBattleUnitSide,
    units: QidahenCombatUnit[],
): QidahenCombatUnit[] => units.map((unit) => {
    const override = (pendingTargetAction.tacticModifiers ?? []).find((modifier) => (
        isTacticModifierActive(pendingTargetAction, modifier)
        && modifier.side === side
        && modifier.targetTroopClass === unit.troopClass
        && modifier.treatAsTroopKind != null
    ));
    return override?.treatAsTroopKind
        ? {
            ...unit,
            troopKind: override.treatAsTroopKind,
        }
        : unit;
});

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
                troopClass: 'regular' as const,
                factionId: sourceRegion.controller === 'neutral' ? null : sourceRegion.controller,
                structured: false,
                pieceIds: [],
            }]
            : []),
    ];
    return takeBattleUnits(units, maxNonArtilleryTroops);
};

const buildCommittedBattleUnitsFromForceCommitments = (
    state: QidahenCore,
    pendingTargetAction: QidahenPendingTargetAction,
    maxNonArtilleryTroops: number,
): QidahenCombatUnit[] => {
    const units = getQidahenBattleForceCommitments(pendingTargetAction)
        .flatMap((commitment): QidahenCombatUnit[] => {
            const sourceRegion = state.regions.find((region) => (
                !region.isLogicalRegion
                && region.id === commitment.sourceRegionId
            )) ?? null;
            const sourceSnapshot = sourceRegion
                ? getRegionSiegeAttackerForceSnapshot(
                    sourceRegion,
                    pendingTargetAction.attackerFactionId,
                ) ?? getNonSiegedCityActionSourceSnapshot(sourceRegion)
                : null;
            if (!sourceSnapshot) {
                return [];
            }
            const hasExactSelection = commitment.selectedSpecialPieceIds != null
                || commitment.selectedGenericTroops != null;
            const committedSpecialTroops = hasExactSelection
                ? collapseCompatPiecesToSpecialTroopStacks(
                    expandSpecialTroopStacksToCompatPieces(sourceSnapshot.specialTroops)
                        .filter((piece) => commitment.selectedSpecialPieceIds?.includes(piece.id)),
                )
                : takeCommittedSpecialTroopStacks(
                    sourceSnapshot,
                    commitment.committedTroops,
                    commitment.movementProfileId,
                );
            const committedSpecialCount = getSpecialTroopCount({
                specialTroops: committedSpecialTroops,
            });
            const committedGenericTroops = hasExactSelection
                ? Math.max(
                    0,
                    commitment.selectedGenericTroops
                        ?? commitment.committedTroops - committedSpecialCount,
                )
                : Math.max(0, commitment.committedTroops - committedSpecialCount);
            return [
                ...buildStructuredCombatUnitsFromStacks(committedSpecialTroops).map((unit) => ({
                    ...unit,
                    level: clampTroopLevel(unit.level),
                })),
                ...(committedGenericTroops > 0
                    ? [{
                        level: 2,
                        count: committedGenericTroops,
                        troopKind: 'infantry' as const,
                        troopClass: 'regular' as const,
                        factionId: pendingTargetAction.attackerFactionId,
                        structured: false,
                        pieceIds: [],
                    }]
                    : []),
            ];
        });
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
        const adjustedValue = cityBattle && phase === 'melee' && unit.troopKind === 'cavalry'
            ? Math.max(0, armoredValue - 1)
            : armoredValue;
        const tacticValueDivisor = getBattleRollTacticValueDivisor(pendingTargetAction, unit, side);
        const value = tacticValueDivisor > 1
            ? Math.floor(adjustedValue / tacticValueDivisor)
            : adjustedValue;
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

const getTacticPriorityPhase = (
    pendingTargetAction: QidahenPendingTargetAction,
    attackerUnits: QidahenCombatUnit[],
    defenderUnits: QidahenCombatUnit[],
    cityBattle: boolean,
): {
    phase: Extract<QidahenBattleRollPhase, 'artillery' | 'cavalry' | 'infantry'>;
    side: QidahenBattleUnitSide;
    note: string;
} | null => {
    if (cityBattle) {
        return null;
    }
    const priorityModifier = (pendingTargetAction.tacticModifiers ?? [])
        .find((modifier) => (
            isTacticModifierActive(pendingTargetAction, modifier)
            && modifier.priorityRoll
            && !(pendingTargetAction.tacticModifiers ?? []).some((cancellingModifier) => (
                isTacticModifierActive(pendingTargetAction, cancellingModifier)
                && cancellingModifier.side !== modifier.side
                && cancellingModifier.cancelEnemyPrioritySourceCardDefIds?.includes(modifier.sourceCardDefId ?? '')
            ))
            && modifier.troopKind !== 'artillery'
            && (modifier.side === 'attacker'
                ? attackerUnits.some((unit) => unit.troopKind === modifier.troopKind)
                    && defenderUnits.some((unit) => unit.troopKind === modifier.troopKind)
                : defenderUnits.some((unit) => unit.troopKind === modifier.troopKind)
                    && attackerUnits.some((unit) => unit.troopKind === modifier.troopKind))
        ));
    if (!priorityModifier) {
        return null;
    }
    return {
        phase: priorityModifier.troopKind,
        side: priorityModifier.side,
        note: `${priorityModifier.label}指定${getQidahenTroopKindLabel(priorityModifier.troopKind)}先掷`,
    };
};

const isPrioritySourceCancelledByEnemyModifier = (
    pendingTargetAction: QidahenPendingTargetAction,
    side: QidahenBattleUnitSide,
    sourceCardDefId: string,
): boolean => (pendingTargetAction.tacticModifiers ?? []).some((modifier) => (
    isTacticModifierActive(pendingTargetAction, modifier)
    && modifier.side !== side
    && modifier.cancelEnemyPrioritySourceCardDefIds?.includes(sourceCardDefId)
));

const isRollAsPhaseSourceCancelledByEnemyModifier = (
    pendingTargetAction: QidahenPendingTargetAction,
    side: QidahenBattleUnitSide,
    sourceCardDefId: string,
): boolean => (pendingTargetAction.tacticModifiers ?? []).some((modifier) => (
    isTacticModifierActive(pendingTargetAction, modifier)
    && modifier.side !== side
    && modifier.cancelEnemyRollAsPhaseSourceCardDefIds?.includes(sourceCardDefId)
));

const hasCavalryFirearmPriority = (
    state: QidahenCore,
    units: QidahenCombatUnit[],
): boolean => units.some((unit) => (
    unit.structured
    && unit.factionId
    && unit.troopKind === 'cavalry'
    && (
        hasArmamentSourceCard(
            state,
            unit.factionId,
            'cavalry-firearm',
            CAVALRY_FIREARM_CARD_DEF_ID,
        )
        || (
            getArmamentLevel(state, unit.factionId, 'cavalry-firearm') > 0
            && !hasArmamentSourceCard(
                state,
                unit.factionId,
                'cavalry-firearm',
                FINE_STEEL_SABER_CARD_DEF_ID,
            )
        )
    )
));

const hasLinkedMusketsPriority = (
    state: QidahenCore,
    units: QidahenCombatUnit[],
): boolean => units.some((unit) => (
    unit.structured
    && unit.factionId
    && unit.troopKind === 'infantry'
    && (
        hasArmamentSourceCard(
            state,
            unit.factionId,
            'long-barreled-musket',
            LINKED_MUSKETS_CARD_DEF_ID,
        )
        || getArmamentLevel(state, unit.factionId, 'long-barreled-musket') > 0
    )
));

const getArmamentPriorityPhase = (
    state: QidahenCore,
    pendingTargetAction: QidahenPendingTargetAction,
    attackerUnits: QidahenCombatUnit[],
    defenderUnits: QidahenCombatUnit[],
    cityBattle: boolean,
): {
    phase: Extract<QidahenBattleRollPhase, 'artillery' | 'cavalry' | 'infantry'>;
    side: QidahenBattleUnitSide;
    note: string;
} | null => {
    if (cityBattle) {
        return null;
    }
    const bothSidesHaveCavalry = attackerUnits.some((unit) => unit.troopKind === 'cavalry')
        && defenderUnits.some((unit) => unit.troopKind === 'cavalry');
    if (
        bothSidesHaveCavalry
        && hasCavalryFirearmPriority(state, attackerUnits)
        && !isPrioritySourceCancelledByEnemyModifier(pendingTargetAction, 'attacker', CAVALRY_FIREARM_CARD_DEF_ID)
    ) {
        return {
            phase: 'cavalry',
            side: 'attacker',
            note: '骑兵火器指定骑兵先掷',
        };
    }
    if (
        bothSidesHaveCavalry
        && hasCavalryFirearmPriority(state, defenderUnits)
        && !isPrioritySourceCancelledByEnemyModifier(pendingTargetAction, 'defender', CAVALRY_FIREARM_CARD_DEF_ID)
    ) {
        return {
            phase: 'cavalry',
            side: 'defender',
            note: '骑兵火器指定骑兵先掷',
        };
    }
    const bothSidesHaveInfantry = attackerUnits.some((unit) => unit.troopKind === 'infantry')
        && defenderUnits.some((unit) => unit.troopKind === 'infantry');
    if (
        bothSidesHaveInfantry
        && hasLinkedMusketsPriority(state, attackerUnits)
        && !isPrioritySourceCancelledByEnemyModifier(pendingTargetAction, 'attacker', LINKED_MUSKETS_CARD_DEF_ID)
    ) {
        return {
            phase: 'infantry',
            side: 'attacker',
            note: '连环火铳指定步兵先掷',
        };
    }
    if (
        bothSidesHaveInfantry
        && hasLinkedMusketsPriority(state, defenderUnits)
        && !isPrioritySourceCancelledByEnemyModifier(pendingTargetAction, 'defender', LINKED_MUSKETS_CARD_DEF_ID)
    ) {
        return {
            phase: 'infantry',
            side: 'defender',
            note: '连环火铳指定步兵先掷',
        };
    }
    return null;
};

const getTacticRollAsPhaseModifiers = (
    pendingTargetAction: QidahenPendingTargetAction,
    side: QidahenBattleUnitSide,
    troopKind?: QidahenTroopKind,
    phase?: QidahenBattleRollPhase,
) => (
    (pendingTargetAction.tacticModifiers ?? [])
        .filter((modifier) => (
            isTacticModifierActive(pendingTargetAction, modifier)
            && modifier.side === side
            && (!troopKind || modifier.troopKind === troopKind)
            && modifier.rollAsPhase
            && modifier.rollAsPhase !== modifier.troopKind
            && (!phase || modifier.rollAsPhase === phase)
            && !isRollAsPhaseSourceCancelledByEnemyModifier(
                pendingTargetAction,
                side,
                modifier.sourceCardDefId ?? '',
            )
        ))
);

const buildBattleStageUnits = (
    pendingTargetAction: QidahenPendingTargetAction,
    units: QidahenCombatUnit[],
    phase: QidahenBattleRollPhase,
    side: QidahenBattleUnitSide,
    cityBattle: boolean,
): QidahenCombatUnit[] => {
    const acceptsNativePhase = (unit: QidahenCombatUnit) => (
        phase === 'melee'
            ? unit.troopKind === 'cavalry' || unit.troopKind === 'infantry'
            : unit.troopKind === phase
    );
    let nativeUnits = units.filter(acceptsNativePhase);
    if (cityBattle || phase === 'melee') {
        return nativeUnits;
    }

    for (const modifier of getTacticRollAsPhaseModifiers(pendingTargetAction, side, phase)) {
        nativeUnits = splitBattleUnitsByTransferredCount(
            nativeUnits,
            phase,
            Math.max(1, modifier.rollUnitCount ?? 1),
            undefined,
            modifier.targetPieceId,
        ).remainingUnits;
    }

    let availableRollAsUnits = units;
    const rollAsUnits = getTacticRollAsPhaseModifiers(pendingTargetAction, side, undefined, phase)
        .flatMap((modifier) => {
            const split = splitBattleUnitsByTransferredCount(
                availableRollAsUnits,
                modifier.troopKind,
                Math.max(1, modifier.rollUnitCount ?? 1),
                undefined,
                modifier.targetPieceId,
            );
            availableRollAsUnits = split.remainingUnits;
            return split.transferredUnits.map((unit) => ({
                ...unit,
                appliedTacticModifierIds: [
                    ...(unit.appliedTacticModifierIds ?? []),
                    modifier.id,
                ],
            }));
        });

    return [...nativeUnits, ...rollAsUnits];
};

const rollBattleStage = (
    random: RandomFn,
    state: QidahenCore,
    pendingTargetAction: QidahenPendingTargetAction,
    phase: QidahenBattleRollPhase,
    attackerUnits: QidahenCombatUnit[],
    defenderUnits: QidahenCombatUnit[],
    cityBattle: boolean,
    battlePriority: ReturnType<typeof getEiduPriorityPhase>,
) => {
    const stageAttackerUnits = buildBattleStageUnits(pendingTargetAction, attackerUnits, phase, 'attacker', cityBattle);
    const stageDefenderUnits = buildBattleStageUnits(pendingTargetAction, defenderUnits, phase, 'defender', cityBattle);
    let attackerRolls: QidahenBattleRoll[] = [];
    let defenderRolls: QidahenBattleRoll[] = [];

    if (battlePriority?.phase === phase) {
        if (battlePriority.side === 'attacker') {
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
        priorityNote: battlePriority?.phase === phase ? battlePriority.note : null,
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
    const baseAttackerUnits = pendingTargetAction.forceCommitments?.length
        ? buildCommittedBattleUnitsFromForceCommitments(
            state,
            pendingTargetAction,
            pendingTargetAction.attackPressure || pendingTargetAction.battleWidth,
        )
        : buildCommittedBattleUnits(
            sourceRegion,
            pendingTargetAction.committedTroops,
            pendingTargetAction.attackPressure || pendingTargetAction.battleWidth,
            pendingTargetAction.movementProfileId,
        );
    const baseDefenderUnits = takeBattleUnits(buildCombatUnits(targetBattleRegion), defenderPressure);
    const transferredUnits = applyTacticUnitTransfers(
        pendingTargetAction,
        baseAttackerUnits,
        baseDefenderUnits,
    );
    const attackerUnits = applyTacticUnitKindOverrides(
        pendingTargetAction,
        'attacker',
        transferredUnits.attackerUnits,
    );
    const defenderUnits = applyTacticUnitKindOverrides(
        pendingTargetAction,
        'defender',
        transferredUnits.defenderUnits,
    );
    if (attackerUnits.length === 0 && defenderUnits.length === 0) {
        return null;
    }

    const cityBattle = battleMode === 'city';
    const phases: QidahenBattleRollPhase[] = cityBattle
        ? ['artillery', 'melee']
        : ['artillery', 'cavalry', 'infantry'];
    const battlePriority = getTacticPriorityPhase(pendingTargetAction, attackerUnits, defenderUnits, cityBattle)
        ?? getArmamentPriorityPhase(state, pendingTargetAction, attackerUnits, defenderUnits, cityBattle)
        ?? getEiduPriorityPhase(state, attackerUnits, defenderUnits, cityBattle);
    const stages = phases
        .map((phase) => rollBattleStage(random, state, pendingTargetAction, phase, attackerUnits, defenderUnits, cityBattle, battlePriority))
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
