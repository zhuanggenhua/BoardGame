import type { QidahenPendingTargetChoiceValue } from './interactionContracts';
import type {
    QidahenPlunderSource,
    ResolvePendingActionCommand,
} from './types';

export const buildPendingTargetRearGuardChoiceValue = (): QidahenPendingTargetChoiceValue => ({
    choiceId: 'rear-guard',
    retreatLossMode: 'rear-guard',
});

export const buildPendingTargetRoutChoiceValue = (): QidahenPendingTargetChoiceValue => ({
    choiceId: 'rout',
    retreatLossMode: 'rout',
});

export const buildPendingTargetDefenderHoldCityChoiceValue = (): QidahenPendingTargetChoiceValue => ({
    choiceId: 'defender-hold-city',
    retreatLossMode: 'rear-guard',
    defenderHoldCity: true,
});

export const buildPendingTargetDefenderSortieChoiceValue = (): QidahenPendingTargetChoiceValue => ({
    choiceId: 'defender-sortie',
    retreatLossMode: 'rear-guard',
    defenderSortieBattle: true,
});

export const buildPendingTargetAttackerCavalryPlunderChoiceValue = (
    source: QidahenPlunderSource,
): QidahenPendingTargetChoiceValue => ({
    choiceId: source === 'defender' ? 'cavalry-plunder-defender' : 'cavalry-plunder-attacker',
    retreatLossMode: 'rear-guard',
    attackerCavalryPlunder: true,
    attackerCavalryPlunderSource: source,
});

export const buildPendingTargetDefenderCavalryEvasionChoiceValue = (
    regionId: string,
): QidahenPendingTargetChoiceValue => ({
    choiceId: `cavalry-evasion:${regionId}`,
    retreatLossMode: 'rear-guard',
    defenderCavalryEvasion: true,
    defenderCavalryEvasionRegionId: regionId,
});

export const normalizePendingTargetInteractionPayload = (
    value: unknown,
): ResolvePendingActionCommand['payload'] => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return {};
    }
    const record = value as Record<string, unknown>;
    return {
        ...(typeof record.committedTroops === 'number' && Number.isFinite(record.committedTroops) && record.committedTroops > 0
            ? { committedTroops: record.committedTroops }
            : {}),
        ...(record.retreatLossMode === 'rear-guard' || record.retreatLossMode === 'rout'
            ? { retreatLossMode: record.retreatLossMode }
            : {}),
        ...(record.defenderSortieBattle === true ? { defenderSortieBattle: true } : {}),
        ...(record.defenderHoldCity === true ? { defenderHoldCity: true } : {}),
        ...(record.defenderCavalryEvasion === true ? { defenderCavalryEvasion: true } : {}),
        ...(typeof record.defenderCavalryEvasionRegionId === 'string'
            ? { defenderCavalryEvasionRegionId: record.defenderCavalryEvasionRegionId }
            : {}),
        ...(record.attackerCavalryPlunder === true ? { attackerCavalryPlunder: true } : {}),
        ...(record.attackerCavalryPlunderSource === 'attacker' || record.attackerCavalryPlunderSource === 'defender'
            ? { attackerCavalryPlunderSource: record.attackerCavalryPlunderSource }
            : {}),
        ...(record.attackerCasualtyPriority === 'highest-level' || record.attackerCasualtyPriority === 'lowest-level'
            ? { attackerCasualtyPriority: record.attackerCasualtyPriority }
            : {}),
        ...(record.defenderCasualtyPriority === 'highest-level' || record.defenderCasualtyPriority === 'lowest-level'
            ? { defenderCasualtyPriority: record.defenderCasualtyPriority }
            : {}),
    };
};
