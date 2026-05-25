/**
 * 端到端诊断测试：vampire_buffet afterScoring 是否在完整计分管线中触发
 *
 * 场景：
 * - 基地达到临界点，P0 力量最高
 * - 真实走 playCards → scoreBases 响应窗
 * - 验证 vampire_buffet 在当前响应窗里能真实打出并写入 pendingAfterScoringSpecials
 * - 具体 afterScoring 放置指示物的结果由 newOngoingAbilities.test.ts 承接
 */

import { describe, expect, it } from 'vitest';
import { SmashUpDomain } from '../domain';
import type { SmashUpCore, SmashUpCommand } from '../domain/types';
import { SU_EVENTS } from '../domain/types';
import { smashUpSystemsForTest } from '../game';
import { getEventStreamEntries } from '../../../engine/systems/EventStreamSystem';
import type { MatchState } from '../../../engine/types';
import { createInitialSystemState, executePipeline, createSeededRandom } from '../../../engine/pipeline';

const PLAYER_IDS = ['0', '1'];
const systems = smashUpSystemsForTest;

describe('vampire_buffet 端到端计分流程', () => {
    it('赢家在当前计分响应窗打出 buffet 时，应真实离手并写入 pendingAfterScoringSpecials', () => {
        const serverRng = createSeededRandom('buffet-test');

        const core: SmashUpCore = {
            players: {
                '0': { id: '0', vp: 0, hand: [{ uid: 'buffet1', defId: 'vampire_buffet', type: 'action' as const, owner: '0' }], deck: Array.from({ length: 10 }, (_, i) => ({ uid: `deck0-${i}`, defId: 'test_card', type: 'minion' as const, owner: '0' })), discard: [], minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1, factions: ['vampires', 'dinosaurs'] },
                '1': { id: '1', vp: 0, hand: [], deck: Array.from({ length: 10 }, (_, i) => ({ uid: `deck1-${i}`, defId: 'test_card', type: 'minion' as const, owner: '1' })), discard: [], minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1, factions: ['pirates', 'ninjas'] },
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [
                {
                    defId: 'base_the_homeworld',
                    minions: [
                        // P0 的随从，有力量指示物（用于 We Are The Champions 转移）
                        { uid: 'm1', defId: 'test_a', controller: '0', owner: '0', basePower: 25, powerCounters: 3, powerModifier: 0, tempPowerModifier: 0, talentUsed: false, attachedActions: [] },
                        { uid: 'm2', defId: 'test_b', controller: '1', owner: '1', basePower: 5, powerCounters: 0, powerModifier: 0, tempPowerModifier: 0, talentUsed: false, attachedActions: [] },
                    ],
                    ongoingActions: [],
                },
                {
                    defId: 'base_central_brain',
                    minions: [
                        // P0 的第二个随从（作为转移目标）
                        { uid: 'm3', defId: 'test_c', controller: '0', owner: '0', basePower: 2, powerCounters: 0, powerModifier: 0, tempPowerModifier: 0, talentUsed: false, attachedActions: [] },
                    ],
                    ongoingActions: [],
                },
            ],
            baseDeck: ['base_haunted_house'],
            turnNumber: 1,
            nextUid: 100,
        } as any;

        const sys = createInitialSystemState(PLAYER_IDS, systems, undefined);
        sys.phase = 'playCards';
        const initialState: MatchState<SmashUpCore> = { core, sys };

        // Step 1: ADVANCE_PHASE → 从 playCards 推进（应该打开 Me First 窗口）
        const afterAdvance = executePipeline(
            { domain: SmashUpDomain, systems },
            initialState,
            { type: 'ADVANCE_PHASE', playerId: '0', payload: undefined, timestamp: 1 } as unknown as SmashUpCommand,
            serverRng, PLAYER_IDS,
        );
        expect(afterAdvance.success).toBe(true);

        // Step 2: P0 打出 vampire_buffet（选择基地 0）
        const afterBuffet = executePipeline(
            { domain: SmashUpDomain, systems },
            afterAdvance.state,
            {
                type: 'su:play_action', playerId: '0',
                payload: { cardUid: 'buffet1', targetBaseIndex: 0 },
                timestamp: 2,
            } as unknown as SmashUpCommand,
            serverRng, PLAYER_IDS,
        );
        expect(afterBuffet.success).toBe(true);

        // 检查 ARMED 事件
        const armedEntries = getEventStreamEntries(afterBuffet.state).filter(e => e.event.type === SU_EVENTS.SPECIAL_AFTER_SCORING_ARMED);
        expect(armedEntries.length).toBeGreaterThan(0);

        const player0 = afterBuffet.state.core.players['0'];
        expect(player0.hand.some(card => card.uid === 'buffet1')).toBe(false);
        expect(player0.discard.some(card => card.uid === 'buffet1')).toBe(true);
        expect(afterBuffet.state.core.pendingAfterScoringSpecials).toEqual([
            expect.objectContaining({
                sourceDefId: 'vampire_buffet',
                playerId: '0',
                baseIndex: 0,
                cardUid: 'buffet1',
            }),
        ]);

        const reactionPrompt = afterBuffet.state.sys.interaction?.current as any;
        expect(reactionPrompt?.data?.sourceId).toBe('smashup_reaction_choose');
    });

    it('P0 在 Me First! 窗口打出 we_are_the_champions 时应立即创建交互，而不是先写 ARMED', () => {
        const serverRng = createSeededRandom('champions-buffet');

        const core: SmashUpCore = {
            players: {
                '0': {
                    id: '0', vp: 0,
                    hand: [
                        { uid: 'champ1', defId: 'giant_ant_we_are_the_champions', type: 'action' as const, owner: '0' },
                    ],
                    deck: Array.from({ length: 10 }, (_, i) => ({ uid: `deck0-${i}`, defId: 'test_card', type: 'minion' as const, owner: '0' })),
                    discard: [], minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
                    factions: ['giant_ants', 'vampires'],
                },
                '1': {
                    id: '1', vp: 0, hand: [],
                    deck: Array.from({ length: 10 }, (_, i) => ({ uid: `deck1-${i}`, defId: 'test_card', type: 'minion' as const, owner: '1' })),
                    discard: [], minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1,
                    factions: ['pirates', 'ninjas'],
                },
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [
                {
                    defId: 'base_the_homeworld',
                    minions: [
                        { uid: 'm1', defId: 'giant_ant_worker', controller: '0', owner: '0', basePower: 25, powerCounters: 3, powerModifier: 2, tempPowerModifier: 0, talentUsed: false, attachedActions: [] },
                        { uid: 'm2', defId: 'test_b', controller: '1', owner: '1', basePower: 5, powerCounters: 0, powerModifier: 0, tempPowerModifier: 0, talentUsed: false, attachedActions: [] },
                    ],
                    ongoingActions: [],
                },
                {
                    defId: 'base_central_brain',
                    minions: [
                        { uid: 'm3', defId: 'giant_ant_worker', controller: '0', owner: '0', basePower: 2, powerCounters: 0, powerModifier: 0, tempPowerModifier: 0, talentUsed: false, attachedActions: [] },
                    ],
                    ongoingActions: [],
                },
            ],
            baseDeck: ['base_haunted_house'],
            turnNumber: 1,
            nextUid: 100,
        } as any;

        const sys = createInitialSystemState(PLAYER_IDS, systems, undefined);
        sys.phase = 'playCards';
        const initialState: MatchState<SmashUpCore> = { core, sys };

        // Step 1: ADVANCE_PHASE → 打开 Me First 窗口
        const afterAdvance = executePipeline(
            { domain: SmashUpDomain, systems },
            initialState,
            { type: 'ADVANCE_PHASE', playerId: '0', payload: undefined, timestamp: 1 } as unknown as SmashUpCommand,
            serverRng, PLAYER_IDS,
        );
        expect(afterAdvance.success).toBe(true);

        // Step 2: P0 打出 we_are_the_champions（选择基地 0）
        const afterChampions = executePipeline(
            { domain: SmashUpDomain, systems },
            afterAdvance.state,
            {
                type: 'su:play_action', playerId: '0',
                payload: { cardUid: 'champ1', targetBaseIndex: 0 },
                timestamp: 2,
            } as unknown as SmashUpCommand,
            serverRng, PLAYER_IDS,
        );
        expect(afterChampions.success).toBe(true);

        // 当前合同：在 afterScoring 响应窗口中应立即起交互，不先写 ARMED
        const armedEntries = afterChampions.events.filter(e => e.type === SU_EVENTS.SPECIAL_AFTER_SCORING_ARMED);
        expect(armedEntries.length).toBe(0);

        const interaction = afterChampions.state.sys.interaction?.current ?? afterChampions.state.sys.interaction?.queue?.[0];
        expect(interaction).toBeTruthy();
        expect([
            'giant_ant_we_are_the_champions_choose_source',
            'giant_ant_we_are_the_champions_choose_snapshot_source',
        ]).toContain((interaction as any)?.data?.sourceId);
    });
});
