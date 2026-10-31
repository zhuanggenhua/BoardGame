import { addFactionHandCards, appendDrawnHandCards, discardQidahenHandCards, drawFromFactionPile } from './handCardState';
import { buildRegularTroopStack, buildMercenaryTroopStack } from './troopStacks';
import { addSpecialTroopStackToRegion, collapseCompatPiecesToSpecialTroopStacks, expandSpecialTroopStacksToCompatPieces } from './troopCompat';
import { materializeNonSiegedCityActionSourceRegion } from './actionSourceRegionState';
import { refreshRuntimeRegionRules } from './runtimeRegionRules';
import { syncQidahenCorePieceCollections } from './coreDerivedState';
import { getQidahenEffectiveTotalPopulation } from './populationRules';
import { getEffectiveKoreaTributeCardsForFaction } from './koreaTributeRules';
import { drawQidahenKoreaCards } from './koreaCardState';
import { buildWheelDispatchSelectionFromRegionSemantics } from './dispatchSelectionBuilders';
import { buildPendingTargetActionFromWheelDispatchChoice } from './actionWindowDispatch';
import { getQidahenDispatchDraftTargets, applyQidahenFriendlyDispatch } from './wheelDispatchDraft';
import { applyQidahenBattlePieceSelection } from './battlePieceSelection';
import { beginQidahenWheelRecruitTrain } from './wheelRecruitTrain';
import { applyQidahenWheelDiplomacy } from './wheelSlotActions';
import { advanceQidahenTurnIfReady } from './turnAdvance';
import { applyQidahenVictoryStatus } from './victoryResolution';
import { applyQidahenChronologyCharacter, applyQidahenChronologyTransition } from './chronologyResolution';
import { applyQidahenCharacterJudgement } from './characterJudgement';
import type { QidahenTurnResolutionAppliedEvent } from './turnResolutionTypes';
import type { QidahenCore, QidahenFactionId } from './types';

const draw = (core: QidahenCore, factionId: QidahenFactionId, count: number): QidahenCore => {
    const result = drawFromFactionPile(core.factions, factionId, count);
    const factions = addFactionHandCards(result.factions, factionId, result.drawnCards);
    return { ...core, factions, handCards: appendDrawnHandCards(core.handCards, result.cards, factionId), drawPileCount: factions.ming.drawPileCount, discardPileCount: factions.ming.discardPileCount };
};

/** 规则事实在正式管线归约；恢复游标由对应共享frame持有。 */
export function reduceQidahenTurnResolutionFact(core: QidahenCore, event: QidahenTurnResolutionAppliedEvent): QidahenCore {
    const { factionId, fact } = event.payload;
    let next = core;
    switch (fact.kind) {
        case 'skip-hand': next = { ...core, factionActionUsed: true, bonusFactionActionUsed: true }; break;
        case 'choose-action':
            if (fact.action === 'recruit-train') next = beginQidahenWheelRecruitTrain(core, 'wheel', event.timestamp);
            break;
        case 'reclaim': next = { ...core, regions: refreshRuntimeRegionRules(core.regions.filter(region => !region.isLogicalRegion).map(region => fact.regionIds.includes(region.id) ? { ...region, population: region.population + 1 } : region), core.fortifications) }; break;
        case 'military-farm': {
            const regions = core.regions.filter(region => !region.isLogicalRegion).map(region => {
                if (region.id !== fact.regionId) return region;
                const target = materializeNonSiegedCityActionSourceRegion(region);
                return addSpecialTroopStackToRegion({ ...target, troops: target.troops + 1 }, buildRegularTroopStack(factionId, `farm-${event.timestamp}`, 1));
            });
            next = draw({ ...core, regions: refreshRuntimeRegionRules(regions, core.fortifications) }, factionId, 2);
            break;
        }
        case 'diplomacy':
            for (const id of fact.regionIds) next = applyQidahenWheelDiplomacy(next, factionId, id);
            break;
        case 'pay-hire':
        case 'pay-dispatch': next = { ...core, ...discardQidahenHandCards(core, fact.cardIds) }; break;
        case 'hire': next = { ...core, regions: refreshRuntimeRegionRules(core.regions.filter(region => !region.isLogicalRegion).map(region => {
            if (region.id !== fact.regionId) return region;
            const target = materializeNonSiegedCityActionSourceRegion(region);
            return addSpecialTroopStackToRegion({ ...target, troops: target.troops + fact.troops }, buildMercenaryTroopStack(factionId, `hire-${event.timestamp}`, fact.troops));
        }), core.fortifications) }; break;
        case 'dispatch': {
            const target = getQidahenDispatchDraftTargets(core, factionId, fact.sourceRegionId, fact.pieceIds).find(item => item.regionId === fact.regionId);
            if (!target) throw new Error('Dispatch target was invalidated before commit');
            if (target.friendly) { next = applyQidahenFriendlyDispatch(core, factionId, fact.sourceRegionId, fact.pieceIds, fact.regionId); break; }
            const selection = buildWheelDispatchSelectionFromRegionSemantics(core, factionId, target.movementProfileId,
                { selectedTargetRegionId: fact.regionId, preferredSourceRegionId: fact.sourceRegionId, displayAnchorRegionId: fact.sourceRegionId });
            const candidate = selection?.candidates.find(item => item.targetRuntimeRegionId === fact.regionId);
            if (!selection || !candidate) throw new Error('Dispatch battle request does not match its selected source');
            const pending = applyQidahenBattlePieceSelection(core, buildPendingTargetActionFromWheelDispatchChoice(selection, candidate), fact.pieceIds);
            next = { ...core, pendingTargetAction: pending, selectedRegionId: fact.regionId, explicitRegionId: fact.regionId, turnPhase: 'resolve-pending', wheelDispatchProgress: null,
                regionFocusState: { ...core.regionFocusState, lockedSourceRegionId: fact.sourceRegionId, currentTargetRegionId: fact.regionId, displayAnchorRegionId: fact.regionId } };
            break;
        }
        case 'midyear-income': {
            for (const owner of core.currentFactionOrder) {
                const landTax = core.regions.filter(region => !region.isLogicalRegion && region.controller === owner && !region.siegeState
                    && getQidahenEffectiveTotalPopulation(region) > region.troops + (region.cityState?.troops ?? 0)).length;
                next = draw(next, owner, landTax);
                next = { ...next, factions: { ...next.factions, [owner]: { ...next.factions[owner], landTax: next.factions[owner].landTax + landTax } } };
            }
            if (!core.factions.ming.playerId.startsWith('qidahen-neutral-')) next = draw(next, 'ming', 5);
            break;
        }
        case 'income-bonus': next = draw(core, fact.factionId, fact.cards); break;
        case 'tribute':
            for (const owner of core.currentFactionOrder) {
                const count = core.regions.filter(region => !region.isLogicalRegion && region.controller === owner)
                    .reduce((sum, region) => sum + getEffectiveKoreaTributeCardsForFaction(core, owner, region.id), 0);
                next = drawQidahenKoreaCards(next, owner, count);
            }
            break;
        case 'maintenance': {
            next = { ...core, ...discardQidahenHandCards(core, fact.cardIds), fortifications: core.fortifications.map(item => item.id === fact.fortificationId ? { ...item, ruined: !fact.maintain } : item) };
            next = { ...next, regions: refreshRuntimeRegionRules(next.regions.filter(region => !region.isLogicalRegion), next.fortifications) };
            break;
        }
        case 'upkeep': {
            next = { ...core, ...discardQidahenHandCards(core, fact.cardIds) };
            if (fact.removedPieceIds.length > 0) {
                const regions = core.regions.filter(region => !region.isLogicalRegion).map(region => {
                    if (region.id !== fact.task.regionId) return region;
                    const remove = (force: { troops: number; specialTroops: typeof region.specialTroops }) => ({ ...force, troops: force.troops - fact.removedPieceIds.length,
                        specialTroops: collapseCompatPiecesToSpecialTroopStacks(expandSpecialTroopStacksToCompatPieces(force.specialTroops).filter(piece => !fact.removedPieceIds.includes(piece.id))) });
                    if (fact.task.location === 'city') return { ...region, cityState: { ...region.cityState!, ...remove(region.cityState!) } };
                    if (fact.task.location === 'siege') {
                        const result = remove({ troops: region.siegeState!.attackerTroops, specialTroops: region.siegeState!.attackerSpecialTroops });
                        return { ...region, siegeState: { ...region.siegeState!, attackerTroops: result.troops, attackerSpecialTroops: result.specialTroops } };
                    }
                    return { ...region, ...remove(region) };
                });
                next = { ...next, regions: refreshRuntimeRegionRules(regions, next.fortifications) };
            }
            break;
        }
        case 'judgement': next = applyQidahenCharacterJudgement(core, fact.task, fact.outcome); break;
        case 'chronology':
            if (fact.accept) next = { ...core, ...discardQidahenHandCards(core, fact.cardIds), factions: (() => {
                const paid = discardQidahenHandCards(core, fact.cardIds).factions;
                return { ...paid, [fact.factionId]: { ...paid[fact.factionId], vp: paid[fact.factionId].vp + 1 } };
            })(), chronology: { ...core.chronology, claimedCardIds: { ...core.chronology.claimedCardIds, [fact.factionId]: [...(core.chronology.claimedCardIds[fact.factionId] ?? []), core.chronology.currentCardId] } } };
            break;
        case 'year-transition': next = applyQidahenChronologyTransition(core); break;
        case 'character': next = applyQidahenChronologyCharacter(core, fact.factionId, fact.characterIds); break;
        case 'replace-character':
            if (fact.characterId) next = { ...core, factions: { ...core.factions, [fact.factionId]: { ...core.factions[fact.factionId], characters: core.factions[fact.factionId].characters.map(character => character.id === fact.characterId ? { ...character, inPlay: true } : character) } } };
            break;
        case 'finish-wheel': next = advanceQidahenTurnIfReady(applyQidahenVictoryStatus({ ...core, turnPhase: 'action-window', wheelActionUsed: true }, { allowHegemony: core.actionWheelPosition === 'wheel-new-year' }), event.timestamp); break;
        default: break;
    }
    return next === core ? core : syncQidahenCorePieceCollections(next);
}
