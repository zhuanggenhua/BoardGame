import { describe, expect, it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { createInitialSystemState, executePipeline } from '../../../engine/pipeline';
import { createRespondToPromptCommand, getCurrentInteractionData, getCurrentInteractionSummary, getPromptOptions } from '../../../engine/testing/interactionTestFacade';
import type { MatchState, RandomFn } from '../../../engine/types';
import { engineConfig } from '../game';
import { QidahenDomain } from '../domain';
import { createInitialCore } from '../domain/initialCoreSetup';
import { getQidahenTurnResolutionFrame } from '../domain/turnResolutionOpportunities';
import type { QidahenCommand, QidahenCore } from '../domain/types';
import type { SimpleChoiceData } from '../../../engine/systems/InteractionSystem';
import { getQidahenDispatchSourcePieces } from '../domain/wheelDispatchDraft';
import { advanceQidahenTurnResolutionData } from '../domain/turnResolutionProgress';
import { reduceQidahenTurnResolutionFact } from '../domain/turnResolutionFacts';
import { buildQidahenUpkeepTasks } from '../domain/seasonTasks';
import type { QidahenTurnResolutionAppliedEvent } from '../domain/turnResolutionTypes';

const players = ['0', '1', '2'];
const random: RandomFn = { random: () => 0.5, d: sides => sides === 10 ? 10 : 1, range: min => min, shuffle: cards => [...cards] };
let naturalTrace: object[] | undefined;
function initial(firstChronology = 1303): MatchState<QidahenCore> {
    return { core: createInitialCore(players, 'post-sarhu-1619', true, undefined, false, undefined, undefined, cards => [firstChronology, ...cards.filter(id => id !== firstChronology)]), sys: createInitialSystemState(players, engineConfig.systems, 'qidahen-turn-frame') };
}
function run(state: MatchState<QidahenCore>, type: QidahenCommand['type'], payload: object, playerId = state.core.currentPlayer) {
    const result = executePipeline({ domain: QidahenDomain, systems: engineConfig.systems }, state, { type, playerId, payload, timestamp: 100 } as QidahenCommand, random, players);
    if (naturalTrace && result.success) naturalTrace.push({ type, playerId, payload, frame: getQidahenTurnResolutionFrame(state)?.metadata.qidahenTurn, interaction: getCurrentInteractionData(state), after: { playerId: result.state.core.currentPlayer, phase: result.state.core.turnPhase, mingHand: result.state.core.factions.ming.handCount } });
    return result;
}
function choose(state: MatchState<QidahenCore>, id: string | string[]): MatchState<QidahenCore> {
    const prompt = getCurrentInteractionSummary(state);
    const data = getCurrentInteractionData<SimpleChoiceData>(state);
    if (!prompt.playerId || !data) throw new Error('Expected an active choice prompt');
    const ids = Array.isArray(id) ? id : [id];
    const response = createRespondToPromptCommand(state, {
        playerId: prompt.playerId,
        ...(data.multi ? { optionIds: ids } : { optionId: ids[0] }),
    });
    const result = run(state, response.type as QidahenCommand['type'], response.payload, response.playerId);
    expect(result.success, result.success ? '' : JSON.stringify({ error: result.error, id, step: getQidahenTurnResolutionFrame(state)?.metadata.qidahenTurn })).toBe(true);
    return result.state;
}
const options = (state: MatchState<QidahenCore>) => getPromptOptions(state);

function finishWithoutHandAction(state: MatchState<QidahenCore>): MatchState<QidahenCore> {
    state = choose(state, 'finish-slot');
    while (getQidahenTurnResolutionFrame(state)) {
        const step = getQidahenTurnResolutionFrame(state)!.metadata.qidahenTurn.step;
        if (step === 'finish-hand') state = choose(state, 'skip-hand');
        else if (step === 'income-bonus') state = choose(state, 'decline-bonus');
        else throw new Error(`Unexpected step in a turn without hand action: ${step}`);
    }
    return state;
}

describe('真实管线的轮盘落点与季节事务', () => {
    it('同一次耗损同时弃牌和移除部队，两种贡献合计，不再重复要求支付', () => {
        const state = run(initial(), 'EXECUTE_WHEEL_MOVE', { moveId: 'move-1-free' }).state;
        const core = { ...state.core, regions: state.core.regions.map(region => region.id === 'city-region-15' ? { ...region, population: 1 } : region) };
        const task = buildQidahenUpkeepTasks(core).find(item => item.regionId === 'city-region-15')!;
        expect(task.required).toBe(2);
        const piece = getQidahenDispatchSourcePieces(core, 'ming', 'city-region-15')[0];
        const card = core.handCards.find(item => item.faction === 'ming')!;
        const event: QidahenTurnResolutionAppliedEvent = { type: 'TURN_RESOLUTION_APPLIED', timestamp: 1, payload: { frameId: 'test', factionId: 'ming', fromStep: 'upkeep', fact: { kind: 'upkeep', task, cardIds: [card.id], removedPieceIds: [piece.id] } } };
        const paid = reduceQidahenTurnResolutionFact(core, event);
        const data = { ...getQidahenTurnResolutionFrame(state)!.metadata.qidahenTurn, step: 'upkeep' as const, upkeepTasks: [task] };
        const advanced = advanceQidahenTurnResolutionData(paid, data, event);
        expect(advanced.upkeepIndex).toBe(1);
        expect(advanced.upkeepRemaining).toBeUndefined();
        expect(paid.pieces.some(item => item.id === piece.id)).toBe(false);
        expect(paid.handCards.some(item => item.id === card.id)).toBe(false);
    });
    it('先移动，后执行手牌与落点；移动不自动加兵、开垦或扣费', () => {
        let state = initial();
        expect(run(state, 'EXECUTE_SELECTED_ACTION', {}).success).toBe(false);
        const before = state.core;
        const moved = run(state, 'EXECUTE_WHEEL_MOVE', { moveId: 'move-1-free' });
        expect(moved.success).toBe(true);
        state = moved.state;
        expect(state.core.regions).toEqual(before.regions);
        expect(state.core.handCards).toEqual(before.handCards);
        expect(state.core.actionWheelPosition).toBe('wheel-reclaim');
        expect(state.core.wheelActionUsed).toBe(false);
        expect(getQidahenTurnResolutionFrame(state)?.metadata.qidahenTurn.step).toBe('menu');
        expect(options(state).map(option => option.id)).toEqual(expect.arrayContaining(['hand-action', 'reclaim', 'military-farm', 'finish-slot']));
        expect(run(state, 'EXECUTE_WHEEL_MOVE', { moveId: 'move-1-free' }).success).toBe(false);
        state = choose(state, 'hand-action');
        expect(getQidahenTurnResolutionFrame(state)?.metadata.qidahenTurn.step).toBe('await-hand');
        expect(getCurrentInteractionSummary(state).id).toBeUndefined();
    });
    it('普通开垦/军屯可各做一次；军屯真实抽2张并在明确目标建立1支等级2部队', () => {
        let state = run(initial(), 'EXECUTE_WHEEL_MOVE', { moveId: 'move-1-free' }).state;
        state = choose(state, 'reclaim');
        const targetId = options(state)[0].id;
        const population = state.core.regions.find(region => region.id === targetId)!.population;
        state = choose(state, [targetId]);
        expect(state.core.regions.find(region => region.id === targetId)!.population).toBe(population + 1);
        expect(options(state).map(option => option.id)).not.toContain('reclaim');
        expect(options(state).map(option => option.id)).toContain('military-farm');
        state = choose(state, 'military-farm');
        const farmId = options(state)[0].id;
        const before = state.core.regions.find(region => region.id === farmId)!.troops;
        const handBefore = state.core.factions.mongol.handCount;
        state = choose(state, farmId);
        expect(state.core.regions.find(region => region.id === farmId)!.troops).toBe(before + 1);
        expect(state.core.factions.mongol.handCount).toBe(handBefore + 2);
        expect(state.core.handCards.filter(card => card.faction === 'mongol')).toHaveLength(handBefore + 2);
        state = choose(state, 'finish-slot');
        state = choose(state, 'skip-hand');
        expect(state.core.wheelActionUsed).toBe(false);
        expect(state.sys.resolution).toBeUndefined();
        expect(state.core.currentPlayer).toBe('2');
    });
    it('从真实开局连续走过十格、年中与新年：逐项维护、真实支付、同分后顺位领取纪年、依新卡选人物', () => {
        let state = initial();
        let movementCount = 0;
        let maintenanceChoices = 0;
        let midyearReached = false;
        const initialMingHand = state.core.factions.ming.handCount;
        const visited: string[] = [];
        const trace: string[] = [];
        while (movementCount < 10 || getQidahenTurnResolutionFrame(state)) {
            const frame = getQidahenTurnResolutionFrame(state);
            if (!frame) {
                if (state.core.handLimitDiscardSelection) {
                    const selection = state.core.handLimitDiscardSelection;
                    state = choose(state, selection.candidateCardIds.slice(0, selection.requiredDiscardCount));
                }
                const result = run(state, 'EXECUTE_WHEEL_MOVE', { moveId: 'move-1-free' });
                expect(result.success, JSON.stringify({ error: result.error, trace })).toBe(true);
                state = result.state;
                movementCount += 1;
                visited.push(state.core.actionWheelPosition);
                continue;
            }
            const step = frame.metadata.qidahenTurn.step;
            trace.push(step);
            expect(trace.length).toBeLessThan(150);
            let id: string;
            if (step === 'menu') id = 'finish-slot';
            else if (step === 'finish-hand') id = 'skip-hand';
            else if (step === 'maintenance') { id = 'abandon'; maintenanceChoices += 1; }
            else if (step === 'upkeep') id = options(state)[0].id;
            else if (step === 'chronology') {
                expect(getCurrentInteractionSummary(state).playerId).toBe('0');
                id = 'claim';
            }
            else if (step === 'chronology-payment') id = options(state)[0].id;
            else if (step === 'year-characters') id = options(state)[0].id;
            else if (step === 'income-bonus') id = 'decline-bonus';
            else throw new Error(`Unexpected annual step ${step}: ${trace.join(',')}`);
            state = choose(state, id);
            if (visited.includes('wheel-midyear')) {
                midyearReached = true;
                expect(state.core.factions.ming.handCount).toBeGreaterThan(initialMingHand);
            }
        }
        expect(midyearReached).toBe(true);
        expect(maintenanceChoices).toBe(5);
        expect(state.core.fortifications.every(item => item.ruined)).toBe(true);
        expect(state.core.currentYearIndex).toBe(1);
        expect(state.core.chronology.currentCardId).toBe(1303);
        expect(state.core.chronology.drawPile).toHaveLength(11);
        expect(state.core.chronology.claimedCardIds.ming).toEqual([1301]);
        expect(state.core.factions.ming.vp).toBe(1);
        expect(state.core.factions.ming.characters.filter(character => character.inPlay).map(character => character.id)).toEqual(['ming-xiong-tingbi']);
        expect(state.core.currentFactionOrder).toEqual(['ming', 'mongol', 'jin']);
        expect(state.core.currentPlayer).toBe('0');
        for (const faction of Object.values(state.core.factions)) expect(faction.handCount).toBe(state.core.handCards.filter(card => card.faction === faction.id).length);
        expect(state.core.koreaDeckCount).toBe(state.core.koreaDrawPile.length);
        expect(state.sys.resolution).toBeUndefined();
    });
    it('正常前三轮扩军，年中后从辽北明确选择两支步兵和炮兵跨河进攻，实际打出鸳鸯阵并结算', () => {
        naturalTrace = [];
        let state = initial(1306);
        const send = (type: QidahenCommand['type'], payload: object, playerId?: string) => {
            const result = run(state, type, payload, playerId);
            expect(result.success, JSON.stringify(result.error)).toBe(true);
            state = result.state;
        };
        for (let turn = 0; turn < 2; turn += 1) {
            send('EXECUTE_WHEEL_MOVE', { moveId: 'move-1-free' });
            state = finishWithoutHandAction(state);
        }
        expect(state.core.currentPlayer).toBe('0');
        send('EXECUTE_WHEEL_MOVE', { moveId: 'move-1-free' });
        state = choose(state, 'hand-action');
        send('CONFIRM_PREVIEW_ACTION', { actionId: 'recruit' });
        const payment = state.core.handCards.find(card => card.faction === 'ming' && card.cardKind === 'silver')!;
        expect(payment).toBeDefined();
        send('SELECT_PAYMENT_CARD', { cardId: payment.id });
        send('EXECUTE_SELECTED_ACTION', {});
        send('SELECT_REGION', { regionId: 'city-region-15' });
        state = choose(state, 'level-2-troops');
        state = choose(state, 'military-farm');
        state = choose(state, 'city-region-15');
        state = choose(state, 'reclaim');
        state = choose(state, ['city-region-15-liaodong']);
        state = choose(state, 'finish-slot');
        for (let turn = 0; turn < 2; turn += 1) {
            send('EXECUTE_WHEEL_MOVE', { moveId: 'move-1-free' });
            state = finishWithoutHandAction(state);
        }
        const handLimit = state.core.handLimitDiscardSelection;
        const openingDiscardIds = handLimit?.candidateCardIds.filter(id => id !== 'hand-2' && id !== 'deck-ming-4').slice(0, handLimit.requiredDiscardCount) ?? [];
        if (handLimit) state = choose(state, openingDiscardIds);
        expect(state.core.currentPlayer).toBe('0');
        expect(state.core.actionWheelPosition).toBe('wheel-midyear');
        send('EXECUTE_WHEEL_MOVE', { moveId: 'move-1-free' });
        state = choose(state, 'hand-action');
        const tech = state.core.handCards.find(card => card.faction === 'ming' && card.armamentId === 'artillery-tech')!;
        expect(tech).toBeDefined();
        send('CONFIRM_PREVIEW_ACTION', { actionId: 'upgrade-armament', sourceHandCardId: tech.id });
        const techFee = state.core.handCards.find(card => card.faction === 'ming' && card.cardKind === 'silver')!;
        send('SELECT_PAYMENT_CARD', { cardId: techFee.id });
        send('EXECUTE_SELECTED_ACTION', {});
        expect(state.core.factions.ming.armaments.find(item => item.id === 'artillery-tech')?.level).toBe(2);
        expect(state.core.factions.ming.developedCards.some(card => card.id === tech.id)).toBe(true);
        state = choose(state, 'dispatch');
        const tactic = state.core.handCards.find(card => card.faction === 'ming' && card.cardDefId === 'qidahen-atlas05-1644-yuanyang-zhen')!;
        expect(tactic).toBeDefined();
        state = choose(state, options(state).find(option => option.id !== tactic.id)!.id);
        state = choose(state, 'city-region-15');
        const available = getQidahenDispatchSourcePieces(state.core, 'ming', 'city-region-15');
        const selected = [...available.filter(piece => piece.troopKind === 'infantry').slice(0, 2), ...available.filter(piece => piece.troopKind === 'artillery').slice(0, 1)].map(piece => piece.id);
        state = choose(state, selected);
        expect(options(state).map(option => option.id)).toContain('city-region-7');
        state = choose(state, 'city-region-7');
        expect(state.core.pendingTargetAction?.sourceRegionId).toBe('city-region-15');
        expect(state.core.pendingTargetAction?.forceCommitments?.[0].selectedSpecialPieceIds).toEqual(selected);
        expect(state.core.pendingTargetAction?.committedTroops).toBe(3);
        if (state.core.pendingTargetAction?.battleStep === 'defender-declaration') state = choose(state, 'defender-fight');
        send('PLAY_TACTIC_CARD', { cardId: tactic.id });
        state = choose(state, 'fight');
        const rolls = state.core.pendingTargetAction?.resolvedBattleRolls ?? state.core.postBattleSelection?.battleRolls;
        expect(rolls?.stages.some(stage => stage.attackerRolls.some(roll => roll.troopKind === 'artillery'))).toBe(true);
        expect(rolls?.stages.some(stage => stage.attackerRolls.some(roll => roll.troopKind === 'infantry' && roll.dieSides === 10))).toBe(true);
        expect(state.core.handCards.some(card => card.id === tactic.id)).toBe(false);
        expect(state.core.factions.ming.discardPile.some(card => card.id === tactic.id)).toBe(true);
        expect(state.core.postBattleSelection).not.toBeNull();
        const occupy = state.core.postBattleSelection!.choices.find(choice => choice.mode === 'occupy' && choice.plunderPopulation === 0)!;
        expect(occupy).toBeDefined();
        state = choose(state, occupy.id);
        expect(state.core.regions.find(region => region.id === 'city-region-7')?.controller).toBe('ming');
        expect(state.core.chronology.yearStats.ming.builtTroops).toBe(7);
        expect(state.core.chronology.yearStats.ming.victories).toBe(1);
        state = choose(state, 'finish-slot');
        for (let turn = 0; turn < 2; turn += 1) {
            if (state.core.handLimitDiscardSelection) state = choose(state, state.core.handLimitDiscardSelection.candidateCardIds.slice(0, state.core.handLimitDiscardSelection.requiredDiscardCount));
            send('EXECUTE_WHEEL_MOVE', { moveId: 'move-1-free' });
            state = finishWithoutHandAction(state);
        }
        send('EXECUTE_WHEEL_MOVE', { moveId: 'move-1-free' });
        state = choose(state, 'diplomacy');
        const diplomaticTarget = options(state).find(option => option.id !== 'finish-diplomacy')!.id;
        state = choose(state, diplomaticTarget);
        state = choose(state, 'finish-diplomacy');
        state = choose(state, 'hire');
        const hireFee = options(state).find(option => state.core.handCards.find(card => card.id === option.id)?.cardKind === 'silver')!.id;
        state = choose(state, hireFee);
        state = choose(state, 'city-region-15-liaodong');
        state = choose(state, 'finish-slot');
        state = choose(state, 'skip-hand');
        if (state.core.handLimitDiscardSelection) state = choose(state, state.core.handLimitDiscardSelection.candidateCardIds.slice(0, state.core.handLimitDiscardSelection.requiredDiscardCount));
        send('EXECUTE_WHEEL_MOVE', { moveId: 'move-1-free' });
        state = choose(state, 'finish-slot');
        const maintenancePayments: string[] = [];
        const upkeepPayments: string[] = [];
        const chronologyPayments: string[] = [];
        let count = 0;
        while (getQidahenTurnResolutionFrame(state)) {
            expect(count++).toBeLessThan(100);
            const data = getQidahenTurnResolutionFrame(state)!.metadata.qidahenTurn;
            if (data.step === 'maintenance') state = choose(state, state.core.fortifications[data.maintenanceIndex].id === 'shanhaiguan' ? 'maintain' : 'abandon');
            else if (data.step === 'maintenance-payment') { const id = options(state)[0].id; maintenancePayments.push(id); state = choose(state, id); }
            else if (data.step === 'upkeep') {
                const remaining = data.upkeepRemaining ?? data.upkeepTasks[data.upkeepIndex].required;
                const cards = options(state).filter(option => state.core.handCards.some(card => card.id === option.id));
                const isMing = getCurrentInteractionSummary(state).playerId === '0';
                const paidIds = cards.slice(0, Math.min(remaining, isMing ? Math.max(0, state.core.factions.ming.handCount - 3) : cards.length)).map(option => option.id);
                if (paidIds.length === 0) {
                    const pieces = options(state).filter(option => !state.core.handCards.some(card => card.id === option.id) && option.id !== selected[2]);
                    const removable = pieces[0];
                    paidIds.push(removable.id);
                }
                upkeepPayments.push(...paidIds); state = choose(state, paidIds);
            }
            else if (data.step === 'chronology') { expect(getCurrentInteractionSummary(state).playerId).toBe('0'); state = choose(state, 'claim'); }
            else if (data.step === 'chronology-payment') { const id = options(state)[0].id; chronologyPayments.push(id); state = choose(state, id); }
            else if (data.step === 'year-characters') state = choose(state, data.yearCharacterIndex === 0 ? 'mongol-gunchu-ketuji' : data.yearCharacterIndex === 1 ? 'ming-yang-gao' : 'jin-daisan');
            else if (data.step === 'finish-hand') state = choose(state, 'skip-hand');
            else throw new Error(`Unexpected final annual choice ${data.step}`);
        }
        expect(state.core.currentYearIndex).toBe(1);
        expect(state.core.chronology.claimedCardIds.ming).toEqual([1301]);
        expect(state.core.factions.ming.handCount).toBeGreaterThanOrEqual(1);
        send('EXECUTE_WHEEL_MOVE', { moveId: 'move-1-free' });
        state = finishWithoutHandAction(state);
        expect(state.core.currentPlayer).toBe('0');
        send('EXECUTE_WHEEL_MOVE', { moveId: 'move-1-free' });
        state = choose(state, 'recruit-train');
        const trainFee = state.core.handCards.find(card => card.faction === 'ming')!;
        send('SELECT_PAYMENT_CARD', { cardId: trainFee.id });
        send('CONFIRM_WHEEL_RECRUIT_TRAIN_PAYMENT', {});
        send('RESOLVE_WHEEL_RECRUIT_TRAIN_CHOICE', { choiceId: 'action:train' });
        const artillery = state.core.pieces.find(piece => piece.id === selected[2])!;
        const trainChoice = `train:${artillery.id}`;
        send('RESOLVE_WHEEL_RECRUIT_TRAIN_CHOICE', { choiceId: trainChoice });
        expect(state.core.pieces.find(piece => piece.id === artillery.id)?.level).toBe(2);
        send('RESOLVE_WHEEL_RECRUIT_TRAIN_CHOICE', { choiceId: 'finish' });
        writeFileSync('test-results/qidahen-annual-natural-command-trace.json', JSON.stringify(naturalTrace, null, 2));
        naturalTrace = undefined;
        writeFileSync('test-results/qidahen-annual-natural-battle-report.json', JSON.stringify({
            actor: state.core.currentPlayer, position: state.core.actionWheelPosition, mingHandCount: state.core.factions.ming.handCount,
            mingCards: state.core.handCards.filter(card => card.faction === 'ming').map(card => ({ id: card.id, definition: card.cardDefId, kind: card.cardKind })),
            pieces: selected, techCard: tech.id, techFee: techFee.id, occupyChoice: occupy.id, rolls, stats: state.core.chronology.yearStats,
            openingDiscardIds,
            diplomaticTarget, hireFee, maintenancePayments, upkeepPayments, chronologyPayments, trainFee: trainFee.id, trainChoice,
            map: state.core.regions.filter(region => !region.isLogicalRegion).map(region => ({ id: region.id, name: region.name, controller: region.controller, troops: region.troops, population: region.population })),
        }, null, 2));
    });
});
