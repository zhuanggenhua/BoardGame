import { QIDAHEN_ORDINARY_CHRONOLOGY_CARDS, buildQidahenActualYearCardSlots, buildQidahenYearStats, type QidahenChronologyCharacterRule } from './chronologyCards';
import { filterFactionOrderForScenario } from './factionTurnOrder';
import { getYearLabelByIndex } from './characterChronologyConfig';
import { countQidahenControlledRuntimeRegions } from './victoryResolution';
import { resolveJinDaisanConflict, resolveJinHuangtaijiConflict, resolveMingCharacterConflict, resolveNurhaciRemovedByYuanChonghuan } from './characterConflictState';
import type { QidahenCore, QidahenFactionId } from './types';

const GROUPS: Record<'taiji' | 'beile' | 'donglin' | 'eunuch', readonly string[]> = {
    taiji: ['mongol-choghtu-taiji', 'mongol-oba-taiji', 'mongol-gunchu-ketuji'],
    beile: ['jin-daisan', 'jin-amin', 'jin-manggultai', 'jin-huangtaiji'],
    donglin: ['ming-xiong-tingbi', 'ming-sun-chengzong', 'ming-sun-yuanhua', 'ming-yuan-chonghuan'],
    eunuch: ['ming-mao-wenlong', 'ming-yang-gao', 'ming-wei-zhongxian', 'ming-gao-di', 'ming-wang-huazhen'],
};

export const getQidahenEunuchCandidates = (core: QidahenCore, factionId: QidahenFactionId) => core.factions[factionId].characters.filter(character => !character.inPlay && !character.removedFromGame && GROUPS.eunuch.includes(character.id));

export function getQidahenChronologyCharacterCandidates(core: QidahenCore, factionId: QidahenFactionId) {
    const cardId = core.chronology.currentCardId;
    let rule: QidahenChronologyCharacterRule;
    if (cardId === 1301) rule = factionId === 'ming' ? 'any' : factionId === 'mongol' ? 'none' : ['jin-manggultai', 'jin-daisan', 'jin-amin'];
    else if (cardId === 1300 || cardId === 1302) rule = factionId === 'ming' ? 'none' : factionId === 'mongol' ? 'taiji' : 'any';
    else {
        const card = QIDAHEN_ORDINARY_CHRONOLOGY_CARDS.find(item => item.cardId === cardId);
        if (!card) throw new Error(`Starting chronology character rule not loaded: ${cardId}`);
        rule = card.characterRules[factionId];
    }
    const eligibleIds = typeof rule === 'string' && rule !== 'any' && rule !== 'none' ? GROUPS[rule] : rule;
    const donglinPresent = Object.values(core.factions).some(faction => faction.characters.some(character => character.inPlay && GROUPS.donglin.includes(character.id)));
    return core.factions[factionId].characters.filter(character => !character.inPlay && !character.removedFromGame
        && rule !== 'none' && (rule === 'any' || eligibleIds.includes(character.id))
        && (!['ming-sun-yuanhua', 'ming-yuan-chonghuan'].includes(character.id) || donglinPresent));
}

export function getQidahenChronologyClaimOrder(core: QidahenCore): QidahenFactionId[] {
    const nextCard = QIDAHEN_ORDINARY_CHRONOLOGY_CARDS.find(card => card.cardId === core.chronology.drawPile[0]);
    if (!nextCard) return [];
    const score = (id: QidahenFactionId): number => {
        const stats = core.chronology.yearStats[id];
        switch (nextCard.score) {
            case 'built-troops': return stats.builtTroops;
            case 'victories': return stats.victories;
            case 'hand-cards': return core.factions[id].handCount;
            case 'controlled-growth': return countQidahenControlledRuntimeRegions(core.regions, id) - stats.controlledAtStart;
            case 'population-growth': return core.regions.filter(region => !region.isLogicalRegion && region.controller === id)
                .reduce((sum, region) => sum + region.population + (region.cityState?.population ?? 0), 0) - stats.populationAtStart;
            default: throw new Error('Ordinary chronology requires a score condition');
        }
    };
    return [...core.currentFactionOrder].sort((left, right) => score(right) - score(left)
        || core.currentFactionOrder.indexOf(right) - core.currentFactionOrder.indexOf(left));
}

export function applyQidahenChronologyTransition(core: QidahenCore): QidahenCore {
    const nextCard = QIDAHEN_ORDINARY_CHRONOLOGY_CARDS.find(card => card.cardId === core.chronology.drawPile[0]);
    if (!nextCard) return core;
    const regions = nextCard.clearsDrought && core.scenarioId !== 'dingmao-rebellion-1627'
        ? core.regions.map(region => ({ ...region, eventMarkers: region.eventMarkers.filter(marker => marker.kind !== 'drought') })) : core.regions;
    const chronology = { ...core.chronology, currentCardId: nextCard.cardId, drawPile: core.chronology.drawPile.slice(1), yearStats: buildQidahenYearStats({ regions }) };
    return { ...core, regions, chronology, currentYearIndex: core.currentYearIndex + 1, currentYear: getYearLabelByIndex(core.currentYearIndex + 1),
        currentFactionOrder: filterFactionOrderForScenario(core.scenarioId, nextCard.factionOrder), yearCards: buildQidahenActualYearCardSlots(chronology) };
}

export function applyQidahenChronologyCharacter(core: QidahenCore, factionId: QidahenFactionId, characterIds: string[]): QidahenCore {
    const eligible = getQidahenChronologyCharacterCandidates(core, factionId);
    if (characterIds.some(id => !eligible.some(character => character.id === id))) return core;
    let factions = { ...core.factions, [factionId]: { ...core.factions[factionId], characters: core.factions[factionId].characters.map(character => characterIds.includes(character.id) ? { ...character, inPlay: true } : character) } };
    for (const resolve of [resolveMingCharacterConflict, resolveJinDaisanConflict, resolveJinHuangtaijiConflict, resolveNurhaciRemovedByYuanChonghuan]) factions = resolve(factions).factions;
    return { ...core, factions };
}
