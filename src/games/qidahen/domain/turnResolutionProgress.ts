import { computeQidahenSelectedPaymentValue, getQidahenHandCardPaymentValue, hasRemainingFactionAction } from './factionActionWindow';
import { getQidahenChronologyClaimOrder } from './chronologyResolution';
import { buildQidahenCharacterJudgementTasks, isQidahenCharacterJudgementTaskActive } from './characterJudgement';
import { buildQidahenUpkeepTasks, getQidahenFortificationMaintenanceCost } from './seasonTasks';
import { hasActiveCharacter } from './characterPresenceAccessors';
import { getQidahenEffectiveTotalPopulation } from './populationRules';
import { QIDAHEN_HAN_RUNTIME_REGION_IDS } from './regionEthnicity';
import type { QidahenCore } from './types';
import type { QidahenTurnResolutionAppliedEvent, QidahenTurnResolutionData, QidahenTurnResolutionFact } from './turnResolutionTypes';

function completeSubaction(data: QidahenTurnResolutionData): QidahenTurnResolutionData {
    return { ...data, step: 'menu', completedSubactions: data.action && !data.completedSubactions.includes(data.action) ? [...data.completedSubactions, data.action] : data.completedSubactions };
}

function incomeBonusTasks(core: QidahenCore): QidahenTurnResolutionData['incomeBonusTasks'] {
    const tasks: QidahenTurnResolutionData['incomeBonusTasks'] = [];
    if (hasActiveCharacter(core, 'ming', 'ming-wei-zhongxian')) {
        if (core.regions.some(region => !region.isLogicalRegion && region.controller === 'ming' && !region.siegeState && getQidahenEffectiveTotalPopulation(region) > region.troops + (region.cityState?.troops ?? 0))) tasks.push({ factionId: 'ming', cards: 2, label: '土地税赋额外抽2张' });
        tasks.push({ factionId: 'ming', cards: 2, label: '江南漕运额外抽2张' });
    }
    for (const factionId of core.currentFactionOrder) {
        if (hasActiveCharacter(core, factionId, 'jin-fan-wencheng')) {
            const cards = core.regions.filter(region => !region.isLogicalRegion && region.controller === factionId && QIDAHEN_HAN_RUNTIME_REGION_IDS.has(region.id)).length * 2;
            if (cards > 0) tasks.push({ factionId, cards, label: `范文程额外抽${cards}张` });
        }
    }
    return tasks;
}

export function advanceQidahenTurnResolutionData(core: QidahenCore, data: QidahenTurnResolutionData, event: QidahenTurnResolutionAppliedEvent): QidahenTurnResolutionData {
    const { fact, fromStep } = event.payload;
    switch (fact.kind) {
        case 'choose-hand': return { ...data, step: 'await-hand', handReturnStep: fromStep === 'finish-hand' ? 'complete' : 'menu' };
        case 'skip-hand': return { ...data, step: 'complete' };
        case 'choose-action': return { ...data, action: fact.action, step: ({ reclaim: 'reclaim-targets', 'military-farm': 'farm-target', diplomacy: 'diplomacy-targets', hire: 'hire-payment', dispatch: 'dispatch-payment', 'play-character': 'slot-character', 'recruit-train': 'await-child' } as const)[fact.action] };
        case 'cancel-selection': return { ...data, step: fromStep === 'dispatch-target' ? 'dispatch-troops' : fromStep === 'dispatch-troops' ? 'dispatch-source' : 'menu' };
        case 'finish-slot': return { ...data, step: data.season === 'midyear' ? 'midyear-income' : data.season === 'new-year' ? 'tribute' : 'complete' };
        case 'reclaim':
        case 'military-farm': return completeSubaction(data);
        case 'diplomacy': {
            const ids = [...data.diplomacyRegionIds, ...fact.regionIds];
            const advanced = { ...data, diplomacyRegionIds: ids };
            return ids.length >= 3 ? completeSubaction(advanced) : { ...advanced, step: 'diplomacy-targets' };
        }
        case 'finish-diplomacy': return completeSubaction(data);
        case 'pay-hire': return { ...data, step: 'hire-target' };
        case 'hire': return completeSubaction({ ...data, hireExecutions: data.hireExecutions + 1 });
        case 'pay-dispatch': return { ...data, step: 'dispatch-source' };
        case 'select-dispatch-source': return { ...data, sourceRegionId: fact.regionId, selectedPieceIds: [], step: 'dispatch-troops' };
        case 'select-dispatch-troops': return { ...data, selectedPieceIds: fact.pieceIds, step: 'dispatch-target' };
        case 'dispatch': return core.pendingTargetAction ? { ...data, step: 'await-child' } : completeSubaction(data);
        case 'midyear-income': return { ...data, step: 'income-bonus', incomeBonusIndex: 0, incomeBonusTasks: incomeBonusTasks(core) };
        case 'income-bonus': return { ...data, step: 'income-bonus', incomeBonusIndex: data.incomeBonusIndex + 1 };
        case 'tribute': return { ...data, step: 'maintenance', maintenanceIndex: 0 };
        case 'begin-maintenance': return { ...data, step: 'maintenance-payment', paymentCardIds: [] };
        case 'select-payment-card': return { ...data, step: fromStep, paymentCardIds: [...data.paymentCardIds, fact.cardId] };
        case 'maintenance': return { ...data, step: 'maintenance', maintenanceIndex: data.maintenanceIndex + 1, paymentCardIds: [] };
        case 'upkeep': {
            const contribution = fact.cardIds.reduce((sum, id) => {
                // 付款后实体已进弃牌堆，仍按同一张实体读取资源值。
                const card = [...core.factions[fact.task.factionId].discardPile, ...core.koreaDiscardPile].find(item => item.id === id);
                return sum + (card ? getQidahenHandCardPaymentValue({ ...card, faction: fact.task.factionId }) : 1);
            }, 0) + fact.removedPieceIds.length;
            const remaining = Math.max(0, (data.upkeepRemaining ?? fact.task.required) - contribution);
            return { ...data, step: 'upkeep', upkeepIndex: remaining === 0 ? data.upkeepIndex + 1 : data.upkeepIndex, upkeepRemaining: remaining === 0 ? undefined : remaining };
        }
        case 'begin-chronology': return { ...data, step: 'chronology-payment', paymentCardIds: [] };
        case 'chronology': return { ...data, step: fact.accept ? 'year-characters' : 'chronology', chronologyIndex: fact.accept ? data.chronologyIndex : data.chronologyIndex + 1, paymentCardIds: [], yearCharacterIndex: -1 };
        case 'year-transition': return { ...data, step: 'year-characters', yearCharacterIndex: 0 };
        case 'character': {
            const weiSelected = fact.characterIds.includes('ming-wei-zhongxian');
            const next = fromStep === 'slot-character' ? completeSubaction(data) : { ...data, step: 'year-characters' as const, yearCharacterIndex: data.yearCharacterIndex + 1 };
            return weiSelected ? { ...next, characterReplacementFactionId: fact.factionId, characterReturnStep: fromStep === 'slot-character' ? 'slot-character' : 'year-characters', step: 'wei-extra-character' } : next;
        }
        case 'replace-character': return { ...data, step: fromStep === 'character-conflict' && fact.characterId === 'ming-wei-zhongxian' ? 'wei-extra-character' : data.characterReturnStep === 'character-judgement' ? 'character-judgement' : data.characterReturnStep === 'slot-character' ? 'menu' : 'year-characters' };
        case 'judgement': return { ...data, judgementIndex: data.judgementIndex + 1, step: fact.outcome === 'party-conflict' ? 'character-conflict' : 'character-judgement', characterReplacementFactionId: fact.task.factionId, characterReturnStep: 'character-judgement' };
        case 'finish-wheel': return { ...data, step: 'complete' };
        default: return data;
    }
}

/** 无选择的推进只更新共享frame游标；任何对局变化仍须另发正式事实。 */
export function normalizeQidahenTurnResolutionData(core: QidahenCore, data: QidahenTurnResolutionData): QidahenTurnResolutionData {
    if ((data.step === 'await-child' || data.step === 'await-hand') && core.turnPhase === 'action-window' && !core.pendingTargetAction && !core.postBattleSelection && !core.wheelRecruitTrainProgress
        && (data.step !== 'await-hand' || !hasRemainingFactionAction(core))) return data.step === 'await-hand' ? { ...data, step: data.handReturnStep ?? 'menu' } : completeSubaction(data);
    if (data.step === 'complete' && hasRemainingFactionAction(core)) return { ...data, step: 'finish-hand' };
    if (data.step === 'income-bonus' && data.incomeBonusIndex >= data.incomeBonusTasks.length) return { ...data, step: 'character-judgement', judgementTasks: buildQidahenCharacterJudgementTasks(core), judgementIndex: 0 };
    if (data.step === 'character-judgement') {
        let index = data.judgementIndex;
        while (index < data.judgementTasks.length && !isQidahenCharacterJudgementTaskActive(core, data.judgementTasks[index])) index += 1;
        if (index >= data.judgementTasks.length) return { ...data, judgementIndex: index, step: 'complete' };
        if (index !== data.judgementIndex) return { ...data, judgementIndex: index };
    }
    if (data.step === 'maintenance' && data.maintenanceIndex >= core.fortifications.length) return { ...data, step: 'upkeep', upkeepTasks: buildQidahenUpkeepTasks(core), upkeepIndex: 0 };
    if (data.step === 'upkeep' && data.upkeepIndex >= data.upkeepTasks.length) return { ...data, step: 'chronology', chronologyCandidates: getQidahenChronologyClaimOrder(core), chronologyIndex: 0 };
    if (data.step === 'chronology' && data.chronologyIndex >= data.chronologyCandidates.length) return { ...data, step: 'year-characters', yearCharacterIndex: -1 };
    if (data.step === 'year-characters' && data.yearCharacterIndex >= core.currentFactionOrder.length) return { ...data, step: 'complete' };
    return data;
}

export function getQidahenAutomaticTurnFact(core: QidahenCore, data: QidahenTurnResolutionData): QidahenTurnResolutionFact | null {
    if (data.step === 'midyear-income') return { kind: 'midyear-income' };
    if (data.step === 'tribute') return { kind: 'tribute' };
    if (data.step === 'complete') return { kind: 'finish-wheel' };
    if (data.step === 'year-characters' && data.yearCharacterIndex < 0) return { kind: 'year-transition' };
    if (data.step === 'maintenance-payment') {
        const fortification = core.fortifications[data.maintenanceIndex];
        if (computeQidahenSelectedPaymentValue(core.handCards, data.paymentCardIds) >= getQidahenFortificationMaintenanceCost(core, fortification.id)) return { kind: 'maintenance', fortificationId: fortification.id, cardIds: data.paymentCardIds, maintain: true };
    }
    if (data.step === 'chronology-payment') {
        const factionId = data.chronologyCandidates[data.chronologyIndex];
        if (data.paymentCardIds.length >= Math.ceil(core.factions[factionId].handCount / 2)) return { kind: 'chronology', factionId, cardIds: data.paymentCardIds, accept: true };
    }
    return null;
}
