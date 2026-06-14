import { syncQidahenSpecialRuleState } from './specialRuleState';
import {
    isQidahenKoreaRuntimeRegionId,
    isQidahenRuleRegionEquivalent,
    resolveQidahenRuleRegionConfig,
} from './regionConfig';
import type {
    QidahenCore,
    QidahenFactionId,
    QidahenVictoryStatus,
} from './types';

const QIDAHEN_VICTORY_FACTION_ORDER: readonly QidahenFactionId[] = ['ming', 'mongol', 'jin'];

const canApplyPrestigeCardBonus = (state: QidahenCore, regionId: string): boolean => {
    const unlockMode = resolveQidahenRuleRegionConfig(regionId).prestigeCardBonusUnlock;
    if (unlockMode === 'always') {
        return true;
    }
    if (unlockMode === 'after-initial-controller-lost' && isQidahenRuleRegionEquivalent(regionId, 'shou-cheng')) {
        return state.hanseongPrestigeUnlocked;
    }
    return unlockMode == null;
};

export const countQidahenControlledRuntimeRegions = (
    regions: QidahenCore['regions'],
    factionId: QidahenFactionId,
): number => (
    regions.filter((region) => !region.isLogicalRegion && !isQidahenKoreaRuntimeRegionId(region.id) && region.controller === factionId).length
);

export const getQidahenPrestigeBonusByFaction = (state: QidahenCore): Record<QidahenFactionId, number> => {
    const bonusByFaction: Record<QidahenFactionId, number> = { ming: 0, mongol: 0, jin: 0 };
    for (const region of state.regions) {
        if (region.isLogicalRegion || region.controller === 'neutral') {
            continue;
        }
        const bonus = resolveQidahenRuleRegionConfig(region.id).prestigeCardBonus;
        if (bonus <= 0 || !canApplyPrestigeCardBonus(state, region.id)) {
            continue;
        }
        bonusByFaction[region.controller] += bonus;
    }
    return bonusByFaction;
};

export const getQidahenEffectiveVpByFaction = (state: QidahenCore, factionId: QidahenFactionId): number => {
    const bonusByFaction = getQidahenPrestigeBonusByFaction(state);
    return state.factions[factionId].vp + bonusByFaction[factionId];
};

const findPrestigeWinner = (state: QidahenCore): QidahenVictoryStatus | null => {
    const bonusByFaction = getQidahenPrestigeBonusByFaction(state);
    for (const factionId of QIDAHEN_VICTORY_FACTION_ORDER) {
        const faction = state.factions[factionId];
        const effectiveVp = faction.vp + bonusByFaction[factionId];
        if (effectiveVp >= 3) {
            const bonusDetail = bonusByFaction[factionId] > 0
                ? `（含汉城等区域加成 ${bonusByFaction[factionId]}）`
                : '';
            return {
                winnerFactionId: factionId,
                winnerName: faction.name,
                condition: 'prestige',
                detail: `${faction.name} 已达到 ${effectiveVp} 点威望${bonusDetail}。`,
            };
        }
    }
    return null;
};

const findMilitaryWinner = (state: QidahenCore): QidahenVictoryStatus | null => {
    for (const region of state.regions) {
        if (region.isLogicalRegion || region.controller === 'neutral') {
            continue;
        }
        const capitalOwner = resolveQidahenRuleRegionConfig(region.id).capitalOf;
        if (!capitalOwner || region.controller === capitalOwner) {
            continue;
        }
        return {
            winnerFactionId: region.controller,
            winnerName: state.factions[region.controller].name,
            condition: 'military',
            detail: `${state.factions[region.controller].name} 已攻下 ${resolveQidahenRuleRegionConfig(region.id).name}（${state.factions[capitalOwner].name} 首都）。`,
        };
    }
    return null;
};

const findHegemonyWinner = (state: QidahenCore): QidahenVictoryStatus | null => {
    for (const factionId of QIDAHEN_VICTORY_FACTION_ORDER) {
        const controlled = countQidahenControlledRuntimeRegions(state.regions, factionId);
        if (controlled >= 16) {
            return {
                winnerFactionId: factionId,
                winnerName: state.factions[factionId].name,
                condition: 'hegemony',
                detail: `${state.factions[factionId].name} 在新年阶段控制 ${controlled} 个非朝鲜区域。`,
            };
        }
    }
    return null;
};

interface QidahenVictoryResolutionDependencies {
    syncSpecialRuleState: (
        state: QidahenCore,
    ) => QidahenCore;
}

export function applyQidahenVictoryStatus(
    state: QidahenCore,
    options: {
        allowHegemony?: boolean;
    } = {},
    dependencies: QidahenVictoryResolutionDependencies = {
        syncSpecialRuleState: syncQidahenSpecialRuleState,
    },
): QidahenCore {
    const nextState = dependencies.syncSpecialRuleState(state);
    if (nextState.victoryStatus) {
        return nextState;
    }
    const victoryStatus = findMilitaryWinner(nextState)
        ?? findPrestigeWinner(nextState)
        ?? (options.allowHegemony ? findHegemonyWinner(nextState) : null);
    return victoryStatus
        ? { ...nextState, victoryStatus }
        : nextState;
}
