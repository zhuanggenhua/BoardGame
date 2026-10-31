import { describe, expect, it } from 'vitest';
import { createInitialSystemState, executePipeline } from '../../../engine/pipeline';
import { createRespondToPromptCommand, getCurrentInteractionData, getCurrentInteractionSummary } from '../../../engine/testing/interactionTestFacade';
import type { MatchState, RandomFn } from '../../../engine/types';
import type { SimpleChoiceData } from '../../../engine/systems/InteractionSystem';
import { QidahenDomain } from '../domain';
import { engineConfig } from '../game';
import { createInitialCore } from '../domain/initialCoreSetup';
import { getQidahenDispatchSourcePieces } from '../domain/wheelDispatchDraft';
import type { QidahenCommand, QidahenCore } from '../domain/types';

const players = ['0', '1', '2'];
function normalGame() {
    let diceCalls = 0;
    const random: RandomFn = { random: () => 0.5, d: () => { diceCalls++; return 1; }, range: min => min, shuffle: cards => [...cards] };
    let state: MatchState<QidahenCore> = { core: createInitialCore(players, 'post-sarhu-1619', true), sys: createInitialSystemState(players, engineConfig.systems, 'normal-opening-branches') };
    const attempt = (type: QidahenCommand['type'], payload: object, playerId = state.core.currentPlayer) => executePipeline({ domain: QidahenDomain, systems: engineConfig.systems }, state, { type, playerId, payload, timestamp: 100 } as QidahenCommand, random, players);
    const send = (type: QidahenCommand['type'], payload: object, playerId?: string) => {
        const result = attempt(type, payload, playerId);
        expect(result.success, JSON.stringify(result.error)).toBe(true); state = result.state;
    };
    const choose = (id: string | string[]) => {
        const prompt = getCurrentInteractionSummary(state);
        const data = getCurrentInteractionData<SimpleChoiceData>(state);
        if (!prompt.playerId || !data) throw new Error('Expected an active opening prompt');
        const ids = Array.isArray(id) ? id : [id];
        const response = createRespondToPromptCommand(state, {
            playerId: prompt.playerId,
            ...(data.multi ? { optionIds: ids } : { optionId: ids[0] }),
        });
        send(response.type as QidahenCommand['type'], response.payload, response.playerId);
    };
    const skip = () => { send('EXECUTE_WHEEL_MOVE', { moveId: 'move-1-free' }); choose('finish-slot'); choose('skip-hand'); };
    return { get state() { return state; }, get diceCalls() { return diceCalls; }, attempt, send, choose, skip };
}

describe('正式入门同源的正常对局选择分支', () => {
    // 完整年度与教程绑定由annualTutorialFlow/turnResolution覆盖，不保留旧八格、突袭先选目标或midgame QA夹具。
    it.each([['level-2-troops', 6, 2], ['level-4-chuanbing', 2, 4]] as const)('大明征召%s在付款后选择顺天，实际建立%d支等级%d部队', (id, count, level) => {
        const game = normalGame();
        game.skip(); game.skip();
        game.send('EXECUTE_WHEEL_MOVE', { moveId: 'move-1-free' });
        game.choose('hand-action');
        const before = game.state.core.regions.find(region => region.id === 'city-region-28')!.troops;
        game.send('CONFIRM_PREVIEW_ACTION', { actionId: 'recruit' });
        const card = game.state.core.handCards.find(card => card.faction === 'ming' && card.cardKind === 'silver')!;
        game.send('SELECT_PAYMENT_CARD', { cardId: card.id });
        game.send('EXECUTE_SELECTED_ACTION', {});
        game.send('SELECT_REGION', { regionId: 'city-region-28' });
        game.choose(id);
        const region = game.state.core.regions.find(region => region.id === 'city-region-28')!;
        expect(region.troops).toBe(before + count);
        expect(region.specialTroops.filter(stack => stack.level === level).reduce((sum, stack) => sum + stack.count, 0)).toBeGreaterThanOrEqual(count);
        expect(game.state.core.handCards.some(item => item.id === card.id)).toBe(false);
        game.choose('finish-slot');
        expect(game.state.core.currentPlayer).toBe('1');
    });

    it.each([2, 1])('实际出动%d骑兵和炮兵时，战败方自行选择溃退，保留同一骰果和未参战部队', cavalryCount => {
        const game = normalGame();
        for (let turn = 0; turn < 5; turn++) game.skip();
        if (game.state.core.handLimitDiscardSelection) {
            const selection = game.state.core.handLimitDiscardSelection;
            game.choose(selection.candidateCardIds.slice(0, selection.requiredDiscardCount));
        }
        game.send('EXECUTE_WHEEL_MOVE', { moveId: 'move-1-free' });
        game.choose('dispatch');
        game.choose(game.state.core.handCards.find(card => card.faction === 'ming')!.id);
        game.choose('city-region-15');
        const pieces = getQidahenDispatchSourcePieces(game.state.core, 'ming', 'city-region-15');
        const selected = [...pieces.filter(piece => piece.troopKind === 'cavalry').slice(0, cavalryCount), ...pieces.filter(piece => piece.troopKind === 'artillery')].map(piece => piece.id);
        game.choose(selected);
        game.choose('city-region-7');
        const beforeDice = game.diceCalls;
        expect(game.attempt('RESOLVE_PENDING_ACTION', {}, '0').success).toBe(false);
        expect(game.diceCalls).toBe(beforeDice);
        game.choose('defender-fight');
        game.choose('fight');
        const rolls = game.state.core.pendingTargetAction!.resolvedBattleRolls!;
        expect(game.state.core.pendingTargetAction?.battleStep).toBe('retreat');
        expect(getCurrentInteractionSummary(game.state).playerId).toBe(cavalryCount === 2 ? '1' : '0');
        const afterDice = game.diceCalls;
        game.choose('rout');
        expect(game.diceCalls).toBe(afterDice);
        if (cavalryCount === 2) {
            expect(game.state.core.postBattleSelection?.battleRolls).toEqual(rolls);
            expect(game.state.core.postBattleSelection?.committedTroops).toBe(3);
        } else {
            expect(game.state.core.regions.find(region => region.id === 'city-region-15')?.troops).toBe(1);
            expect(game.state.core.pieces.some(piece => selected.includes(piece.id))).toBe(false);
        }
    });
});
