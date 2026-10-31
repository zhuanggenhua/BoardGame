import type { ChoiceRequestCandidate } from '../../../engine/ChoiceRequest';
import { hasRemainingFactionAction, computeQidahenSelectedPaymentValue, getQidahenHandCardPaymentValue } from './factionActionWindow';
import { hasActiveCharacter } from './characterPresenceAccessors';
import { getQidahenPopulationCap } from './populationRules';
import { getQidahenFarmTargets, getQidahenHireTargets, getQidahenWheelDiplomacyTargets, getQidahenWheelSlotActions } from './wheelSlotActions';
import { getQidahenDispatchDraftTargets, getQidahenDispatchSourcePieces, getQidahenDispatchSourceRegionIds } from './wheelDispatchDraft';
import { getQidahenCharacterCommittedTroopLimit } from './pendingBattleCommittedTroops';
import { canMaintainQidahenFortification, getQidahenFortificationMaintenanceCost, getQidahenUpkeepForce } from './seasonTasks';
import { expandSpecialTroopStacksToCompatPieces } from './troopCompat';
import { getQidahenChronologyCharacterCandidates, getQidahenEunuchCandidates } from './chronologyResolution';
import type { QidahenCore, QidahenFactionId } from './types';
import type { QidahenTurnResolutionData, QidahenTurnResolutionFact } from './turnResolutionTypes';

export interface QidahenTurnChoice {
    title: string;
    factionId: QidahenFactionId;
    candidates: ChoiceRequestCandidate[];
    min?: number;
    max?: number;
    resolve: (ids: string[]) => QidahenTurnResolutionFact;
}

export function isQidahenTurnChoiceSelectionValid(core: QidahenCore, data: QidahenTurnResolutionData, playerId: string, ids: string[]): boolean {
    const choice = buildQidahenTurnChoice(core, data);
    if (!choice || playerId !== core.factions[choice.factionId].playerId || ids.length < (choice.min ?? 1)
        || ids.length > Math.min(choice.max ?? 1, choice.candidates.length) || new Set(ids).size !== ids.length
        || ids.some(id => !choice.candidates.some(candidate => candidate.id === id && !candidate.disabled))) return false;
    return data.step !== 'dispatch-troops' || getQidahenDispatchDraftTargets(core, data.factionId, data.sourceRegionId!, ids).length > 0;
}

const LABELS = { reclaim: '开垦', 'military-farm': '军屯', diplomacy: '外交', hire: '雇佣', dispatch: '调度／进攻', 'play-character': '打出人物', 'recruit-train': '征兵／训练' };
const option = (id: string, label: string, value: QidahenTurnResolutionFact): ChoiceRequestCandidate<QidahenTurnResolutionFact> => ({ id, label, value, displayMode: 'button' });

export function buildQidahenTurnChoice(core: QidahenCore, data: QidahenTurnResolutionData): QidahenTurnChoice | null {
    const factionId = data.factionId;
    const cards = (owner: QidahenFactionId) => core.handCards.filter(card => card.faction === owner && card.status !== 'disabled');
    const button = (title: string, candidates: ChoiceRequestCandidate<QidahenTurnResolutionFact>[], owner = factionId): QidahenTurnChoice => ({ title, candidates, factionId: owner,
        resolve: ids => candidates.find(candidate => candidate.id === ids[0])!.value! });
    const regions = (title: string, candidates: QidahenCore['regions'], resolve: QidahenTurnChoice['resolve'], min = 1, max = 1): QidahenTurnChoice => ({
        title, factionId, candidates: candidates.map(region => ({ id: region.id, label: region.name, value: region.id, metadata: { regionId: region.id } })), min, max, resolve,
    });
    const cardChoices = (title: string, owner: QidahenFactionId, resolve: QidahenTurnChoice['resolve'], excluded: string[] = []): QidahenTurnChoice => ({
        title, factionId: owner, candidates: cards(owner).filter(card => !excluded.includes(card.id)).map(card => ({
            id: card.id, label: card.label, value: card.id, displayMode: 'card', metadata: { cardId: card.id, previewRef: card.previewRef },
        })), resolve,
    });
    switch (data.step) {
        case 'finish-hand': return button('手牌行动', [...(cards(factionId).length ? [option('hand-action', '执行手牌行动', { kind: 'choose-hand' })] : []), option('skip-hand', '不执行手牌行动', { kind: 'skip-hand' })]);
        case 'menu': {
            const available = getQidahenWheelSlotActions(data.positionId).filter(action => (
                (action === 'hire' || !data.completedSubactions.includes(action))
                && (!data.season || data.completedSubactions.length === 0 || (action === 'hire' && data.action === 'hire'))
                && (action !== 'military-farm' || getQidahenFarmTargets(core, factionId).length > 0)
                && (action !== 'hire' || cards(factionId).length > 0 && getQidahenHireTargets(core, factionId).length > 0)
                && (action !== 'dispatch' || cards(factionId).length > 0 && getQidahenDispatchSourceRegionIds(core, factionId).length > 0)
                && (action !== 'recruit-train' || cards(factionId).length > 0)
                && (action !== 'play-character' || getQidahenChronologyCharacterCandidates(core, factionId).length > 0)
            ));
            return button('轮盘行动', [
                ...(hasRemainingFactionAction(core) && cards(factionId).length ? [option('hand-action', '先执行手牌行动', { kind: 'choose-hand' })] : []),
                ...available.map(action => option(action, LABELS[action], { kind: 'choose-action', action })),
                option('finish-slot', data.season ? '进入结算' : '结束轮盘行动', { kind: 'finish-slot' }),
            ]);
        }
        case 'reclaim-targets': return regions('选择开垦区域（最多5处）', core.regions.filter(region => !region.isLogicalRegion && region.controller === factionId && !region.siegeState
            && region.population + (region.cityState?.population ?? 0) < getQidahenPopulationCap(region.id)), ids => ({ kind: 'reclaim', regionIds: ids }), 0, 5);
        case 'farm-target': return regions('选择军屯区域', getQidahenFarmTargets(core, factionId), ids => ({ kind: 'military-farm', regionId: ids[0] }));
        case 'diplomacy-targets': return button(`外交（还可影响${3 - data.diplomacyRegionIds.length}处）`, [
            ...getQidahenWheelDiplomacyTargets(core, factionId).filter(region => !data.diplomacyRegionIds.includes(region.id)).map(region => option(region.id, region.name, { kind: 'diplomacy', regionIds: [region.id] })),
            option('finish-diplomacy', '结束外交', { kind: 'finish-diplomacy' }),
        ]);
        case 'hire-payment': return cardChoices('弃1张手牌雇佣部队', factionId, ids => ({ kind: 'pay-hire', cardIds: ids }));
        case 'hire-target': return regions('选择雇佣军建立区域', getQidahenHireTargets(core, factionId), ids => ({ kind: 'hire', regionId: ids[0], troops: data.hireExecutions === 0 ? 2 : 1 }));
        case 'dispatch-payment': return cardChoices('弃1张手牌，指挥至多6支部队', factionId, ids => ({ kind: 'pay-dispatch', cardIds: ids }));
        case 'dispatch-source': return regions('选择出兵来源', core.regions.filter(region => getQidahenDispatchSourceRegionIds(core, factionId).includes(region.id)), ids => ({ kind: 'select-dispatch-source', regionId: ids[0] }));
        case 'dispatch-troops': return {
            title: '选择出动部队', factionId, min: 1, max: getQidahenCharacterCommittedTroopLimit(core, factionId, 'wheel-dispatch') ?? 6,
            candidates: getQidahenDispatchSourcePieces(core, factionId, data.sourceRegionId!).map(piece => ({ id: piece.id, label: `${piece.label} · 等级${piece.level}`, value: piece.id })),
            resolve: ids => ({ kind: 'select-dispatch-troops', pieceIds: ids }),
        };
        case 'dispatch-target': {
            const targets = getQidahenDispatchDraftTargets(core, factionId, data.sourceRegionId!, data.selectedPieceIds!);
            return button('选择目标', [
                ...targets.map(target => option(target.regionId, core.regions.find(region => region.id === target.regionId)!.name,
                    { kind: 'dispatch', regionId: target.regionId, sourceRegionId: data.sourceRegionId!, pieceIds: data.selectedPieceIds! })),
                option('back', '重新选择部队', { kind: 'cancel-selection' }),
            ]);
        }
        case 'slot-character':
        case 'year-characters': {
            const owner = data.step === 'slot-character' ? factionId : core.currentFactionOrder[data.yearCharacterIndex];
            if (!owner) return null;
            return button('打出人物', [
                ...getQidahenChronologyCharacterCandidates(core, owner).map(character => option(character.id, character.name, { kind: 'character', factionId: owner, characterIds: [character.id] })),
                option('skip-character', '不打出人物', { kind: 'character', factionId: owner, characterIds: [] }),
            ], owner);
        }
        case 'maintenance': {
            const fortification = core.fortifications[data.maintenanceIndex];
            if (!fortification) return null;
            const cost = getQidahenFortificationMaintenanceCost(core, fortification.id);
            const payable = computeQidahenSelectedPaymentValue(cards('ming'), cards('ming').map(card => card.id)) >= cost;
            return button(`维护${fortification.label}`, [
                ...(canMaintainQidahenFortification(core, fortification.id) && payable ? [option('maintain', `弃${cost}张手牌维护`, { kind: 'begin-maintenance' })] : []),
                option('abandon', '放弃维护', { kind: 'maintenance', fortificationId: fortification.id, cardIds: [], maintain: false }),
            ], 'ming');
        }
        case 'maintenance-payment': return cardChoices(`选择维护手牌（已选${computeQidahenSelectedPaymentValue(cards('ming'), data.paymentCardIds)}）`, 'ming', ids => ({ kind: 'select-payment-card', cardId: ids[0] }), data.paymentCardIds);
        case 'upkeep': {
            const task = data.upkeepTasks[data.upkeepIndex];
            if (!task) return null;
            const force = getQidahenUpkeepForce(core, task);
            const payableCards = !hasActiveCharacter(core, task.factionId, 'ming-wei-zhongxian') ? cards(task.factionId) : [];
            const removable = expandSpecialTroopStacksToCompatPieces(force.specialTroops);
            return { title: `${core.regions.find(region => region.id === task.regionId)!.name} · 尚需支持${data.upkeepRemaining ?? task.required}支部队`,
                factionId: task.factionId, min: 1, max: data.upkeepRemaining ?? task.required,
                candidates: [
                    ...payableCards.map(card => ({ id: card.id, label: card.label, value: card.id, displayMode: 'card' as const })),
                    ...removable.map(piece => ({ id: piece.id, label: `${piece.label} · 等级${piece.level}`, value: piece.id })),
                ], resolve: ids => ({ kind: 'upkeep', task, cardIds: ids.filter(id => payableCards.some(card => card.id === id)), removedPieceIds: ids.filter(id => removable.some(piece => piece.id === id)) }) };
        }
        case 'chronology': {
            const owner = data.chronologyCandidates[data.chronologyIndex];
            if (!owner) return null;
            return button('取得本年纪年卡', [option('claim', `弃${Math.ceil(core.factions[owner].handCount / 2)}张手牌取得`, { kind: 'begin-chronology' }),
                option('decline', '放弃，资格顺延', { kind: 'chronology', factionId: owner, cardIds: [], accept: false })], owner);
        }
        case 'chronology-payment': {
            const owner = data.chronologyCandidates[data.chronologyIndex];
            return cardChoices(`选择弃牌（${data.paymentCardIds.length}/${Math.ceil(core.factions[owner].handCount / 2)}）`, owner, ids => ({ kind: 'select-payment-card', cardId: ids[0] }), data.paymentCardIds);
        }
        case 'character-judgement': {
            const task = data.judgementTasks[data.judgementIndex];
            const character = task && core.factions[task.factionId].characters.find(item => item.id === task.characterId && item.inPlay);
            if (!task || !character) return null;
            return button(`${character.name} · 人物判定`, [option('roll', `投掷d${character.number}`, { kind: 'judgement', task, rawRoll: 0, outcome: 'none' })], task.factionId);
        }
        case 'income-bonus': {
            const task = data.incomeBonusTasks[data.incomeBonusIndex];
            if (!task) return null;
            return button(task.label, [option('draw-bonus', `抽${task.cards}张`, { kind: 'income-bonus', factionId: task.factionId, cards: task.cards }),
                option('decline-bonus', '不额外抽牌', { kind: 'income-bonus', factionId: task.factionId, cards: 0 })], task.factionId);
        }
        case 'character-conflict':
        case 'wei-extra-character': {
            const owner = data.characterReplacementFactionId!;
            const candidates = getQidahenEunuchCandidates(core, owner);
            return button(data.step === 'character-conflict' ? '党争：改出一名阉党人物' : '魏忠贤：额外打出一名阉党人物', candidates.length > 0
                ? candidates.map(character => option(character.id, character.name, { kind: 'replace-character', factionId: owner, characterId: character.id }))
                : [option('no-character', '无可出场人物', { kind: 'replace-character', factionId: owner, characterId: null })], owner);
        }
        default: return null;
    }
}
