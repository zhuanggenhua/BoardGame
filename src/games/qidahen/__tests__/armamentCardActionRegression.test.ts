import { describe, expect, it } from 'vitest';
import { createInitialSystemState, executePipeline } from '../../../engine/pipeline';
import { createRespondToPromptCommand, getCurrentInteractionData, getCurrentInteractionSummary } from '../../../engine/testing/interactionTestFacade';
import type { MatchState, RandomFn } from '../../../engine/types';
import type { SimpleChoiceData } from '../../../engine/systems/InteractionSystem';
import { QidahenDomain } from '../domain';
import { engineConfig } from '../game';
import { buildQidahenTutorialSetupData } from '../tutorialSetup';
import { resolveQidahenAtlas05OrdinaryHandCardIdentity } from '../domain/handCardIdentity';
import type { QidahenArmamentId, QidahenCore } from '../domain/types';

const players = ['0', '1', '2'];
const random: RandomFn = { random: () => 0, d: () => 1, range: min => min, shuffle: cards => [...cards] };
function opening(index: number, level: number, payWithArmament = false, sourceVariant: 'normal' | 'korea' | 'legacy-red' = 'normal') {
    let state: MatchState<QidahenCore> = { core: QidahenDomain.setup(players, random, buildQidahenTutorialSetupData('basic-opening')!.setupData),
        sys: createInitialSystemState(players, engineConfig.systems, 'armament-action') };
    const send = (type: string, payload: object, playerId = state.core.currentPlayer) => {
        const result = executePipeline({ domain: QidahenDomain, systems: engineConfig.systems }, state,
            { type, payload, playerId, timestamp: 100 } as never, random, players);
        if (result.success) state = result.state;
        return result;
    };
    const choose = (id: string) => {
        const summary = getCurrentInteractionSummary(state);
        const data = getCurrentInteractionData<SimpleChoiceData>(state)!;
        const command = createRespondToPromptCommand(state, { playerId: summary.playerId!,
            ...(data.multi ? { optionIds: [id] } : { optionId: id }) });
        const result = send(command.type, command.payload as object, command.playerId);
        expect(result.success, JSON.stringify(result.error)).toBe(true);
    };
    for (let i = 0; i < 2; i++) { expect(send('EXECUTE_WHEEL_MOVE', { moveId: 'move-1-free' }).success).toBe(true); choose('finish-slot'); choose('skip-hand'); }
    const identity = resolveQidahenAtlas05OrdinaryHandCardIdentity(index)!;
    const ids = state.core.handCards.filter(card => card.faction === 'ming').slice(0, 2).map(card => card.id);
    const feeIdentity = payWithArmament ? resolveQidahenAtlas05OrdinaryHandCardIdentity(index === 3 ? 10 : 3)! : null;
    state = { ...state, core: { ...state.core,
        handCards: state.core.handCards.map(card => card.id === ids[0] ? { ...card, ...identity, label: `研发${index}`,
            ...(sourceVariant === 'korea' ? { originDeck: 'korea' as const, cardDefId: 'qidahen-korea-1702' } : {}),
            ...(sourceVariant === 'legacy-red' ? { armamentId: 'artillery-tech' as const } : {}) }
            : card.id === ids[1] && feeIdentity ? { ...card, ...feeIdentity, label: '费用军备' } : card),
        factions: { ...state.core.factions, ming: { ...state.core.factions.ming,
            armaments: state.core.factions.ming.armaments.map(item => item.id === identity.armamentId ? { ...item, level }
                : item.id === 'artillery-tech' ? { ...item, level: 2 } : item) } } } };
    expect(send('EXECUTE_WHEEL_MOVE', { moveId: 'move-1-free' }).success).toBe(true);
    choose(`hand-card:${ids[0]}`);
    return { get state() { return state; }, send, ids, identity };
}

describe('军备以选择的实体卡为研发对象', () => {
    it.each([[3, 'infantry-armor'], [10, 'cavalry-armor'], [17, 'horse-breeding'], [26, 'artillery-tech'],
        [34, 'red-coat-cannon'], [39, 'cavalry-firearm'], [42, 'western-bastion'], [46, 'long-barreled-musket'],
        [16, 'fine-steel-saber']] as Array<[number, QidahenArmamentId]>)('卡面 %i 的 %s 可从 0 开发且不串类', (index, id) => {
        const run = opening(index, 0, true);
        const before = run.state.core.factions.ming.armaments.map(item => ({ ...item }));
        expect(run.send('EXECUTE_SELECTED_ACTION', {}).success).toBe(false);
        expect(run.state.core.handCards.some(card => card.id === run.ids[0])).toBe(true);
        expect(run.send('SELECT_PAYMENT_CARD', { cardId: run.ids[1] }).success).toBe(true);
        const result = run.send('EXECUTE_SELECTED_ACTION', {});
        expect(result.success, JSON.stringify(result.error)).toBe(true);
        const faction = run.state.core.factions.ming;
        const target = faction.armaments.find(item => item.id === id)!;
        expect(target.level).toBe(1);
        expect(target.sourceCardDefIds).toContain(run.identity.cardDefId);
        for (const prior of before.filter(item => item.id !== id)) expect(faction.armaments.find(item => item.id === prior.id)?.level).toBe(prior.level);
        expect(faction.developedCards.some(card => card.id === run.ids[0])).toBe(true);
        expect(faction.discardPile.some(card => card.id === run.ids[1])).toBe(true);
        expect(faction.discardPile.some(card => card.id === run.ids[0])).toBe(false);
    });

    it('同类等级 2 可再增加一张，并保留实际来源', () => {
        const run = opening(3, 2);
        expect(run.send('SELECT_PAYMENT_CARD', { cardId: run.ids[1] }).success).toBe(true);
        expect(run.send('EXECUTE_SELECTED_ACTION', {}).success).toBe(true);
        const infantry = run.state.core.factions.ming.armaments.find(item => item.id === 'infantry-armor')!;
        expect(infantry.level).toBe(3);
        expect(infantry.sourceCardDefIds).toContain(run.identity.cardDefId);
    });

    it('朝鲜火炮牌打出后进朝鲜弃牌堆，效果保留；费用牌进入所属势力弃牌堆', () => {
        const run = opening(26, 1, false, 'korea');
        const beforeKorea = run.state.core.koreaDiscardPile.length;
        expect(run.send('SELECT_PAYMENT_CARD', { cardId: run.ids[1] }).success).toBe(true);
        expect(run.send('EXECUTE_SELECTED_ACTION', {}).success).toBe(true);
        expect(run.state.core.koreaDiscardPile).toHaveLength(beforeKorea + 1);
        expect(run.state.core.koreaDiscardPile.some(card => card.id === run.ids[0])).toBe(true);
        expect(run.state.core.factions.ming.developedCards.some(card => card.id === run.ids[0])).toBe(false);
        expect(run.state.core.factions.ming.discardPile.some(card => card.id === run.ids[1])).toBe(true);
        expect(run.state.core.factions.ming.armaments.find(item => item.id === 'artillery-tech')?.sourceCardDefIds).toContain('qidahen-korea-1702');
    });

    it('旧存档中手牌仍标旧类别时按红衣大炮的 cardDefId 研发，已有在场错误状态不猜测迁移', () => {
        const run = opening(34, 0, false, 'legacy-red');
        expect(run.send('SELECT_PAYMENT_CARD', { cardId: run.ids[1] }).success).toBe(true);
        expect(run.send('EXECUTE_SELECTED_ACTION', {}).success).toBe(true);
        expect(run.state.core.factions.ming.armaments.find(item => item.id === 'red-coat-cannon')?.level).toBe(1);
        expect(run.state.core.factions.ming.armaments.find(item => item.id === 'artillery-tech')?.level).toBe(2);
    });
});
