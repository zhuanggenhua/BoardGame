/**
 * 端到端诊断测试：vampire_buffet afterScoring 是否在完整计分管线中触发
 *
 * 场景：
 * - 基地上有 vampire_buffet ongoing 卡（owner=P0）
 * - 基地达到临界点，P0 力量最高（赢家）
 * - 完整走 playCards → scoreBases 流程（Me First 响应 → 计分）
 * - 验证 POWER_COUNTER_ADDED 事件是否产生
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
    it('赢家在 Me First! 打出 buffet 时，计分后产生 POWER_COUNTER_ADDED', () => {
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
                        { uid: 'm1', defId: 'test_a', controller: '0', owner: '0', basePower: 25, powerModifier: 0, tempPowerModifier: 0, talentUsed: false, attachedActions: [] },
                        { uid: 'm2', defId: 'test_b', controller: '1', owner: '1', basePower: 5, powerModifier: 0, tempPowerModifier: 0, talentUsed: false, attachedActions: [] },
                    ],
                    ongoingActions: [],
                },
                {
                    defId: 'base_central_brain',
                    minions: [
                        { uid: 'm3', defId: 'test_c', controller: '0', owner: '0', basePower: 2, powerModifier: 0, tempPowerModifier: 0, talentUsed: false, attachedActions: [] },
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

        // Step 3: P1 RESPONSE_PASS → 应该触发计分
        const rw = afterBuffet.state.sys.responseWindow?.current;
        let finalState: MatchState<SmashUpCore>;
        if (rw) {
            const afterP1Pass = executePipeline(
                { domain: SmashUpDomain, systems },
                afterBuffet.state,
                { type: 'RESPONSE_PASS', playerId: rw.responderQueue[rw.currentResponderIndex], payload: undefined, timestamp: 3 } as unknown as SmashUpCommand,
                serverRng, PLAYER_IDS,
            );
            expect(afterP1Pass.success).toBe(true);
            finalState = afterP1Pass.state;
        } else {
            finalState = afterBuffet.state;
        }

        const allEntries = getEventStreamEntries(finalState);

        // 核心断言：vampire_buffet 应该产生 POWER_COUNTER_ADDED
        const pcAdded = allEntries.filter(e => e.event.type === SU_EVENTS.POWER_COUNTER_ADDED);
        expect(pcAdded.length).toBeGreaterThan(0);

        // 检查 BASE_SCORED
        const scored = allEntries.filter(e => e.event.type === SU_EVENTS.BASE_SCORED);
        expect(scored.length).toBeGreaterThan(0);
    });

    it('P0 打出 we_are_the_champions，P1 pass 后触发计分和 ARMED 效果', () => {
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
                        { uid: 'm1', defId: 'giant_ant_worker', controller: '0', owner: '0', basePower: 25, powerModifier: 2, tempPowerModifier: 0, talentUsed: false, attachedActions: [] },
                        { uid: 'm2', defId: 'test_b', controller: '1', owner: '1', basePower: 5, powerModifier: 0, tempPowerModifier: 0, talentUsed: false, attachedActions: [] },
                    ],
                    ongoingActions: [],
                },
                {
                    defId: 'base_central_brain',
                    minions: [
                        { uid: 'm3', defId: 'giant_ant_worker', controller: '0', owner: '0', basePower: 2, powerModifier: 0, tempPowerModifier: 0, talentUsed: false, attachedActions: [] },
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

        // 检查 ARMED 事件
        const armedEntries = getEventStreamEntries(afterChampions.state).filter(e => e.event.type === SU_EVENTS.SPECIAL_AFTER_SCORING_ARMED);
        expect(armedEntries.length).toBeGreaterThan(0);

        // Step 3: 依次 pass 直到窗口关闭（触发计分）
        let currentState = afterChampions.state;
        let ts = 3;
        while (currentState.sys.responseWindow?.current) {
            const rw = currentState.sys.responseWindow.current;
            const responderId = rw.responderQueue[rw.currentResponderIndex];
            const passResult = executePipeline(
                { domain: SmashUpDomain, systems },
                currentState,
                { type: 'RESPONSE_PASS', playerId: responderId, payload: undefined, timestamp: ts++ } as unknown as SmashUpCommand,
                serverRng, PLAYER_IDS,
            );
            expect(passResult.success).toBe(true);
            currentState = passResult.state;
        }

        const allEntries = getEventStreamEntries(currentState);

        // 核心断言：计分发生
        const scored = allEntries.filter(e => e.event.type === SU_EVENTS.BASE_SCORED);
        expect(scored.length).toBeGreaterThan(0);

        // We Are The Champions 应该创建选择来源随从的交互
        const interaction = currentState.sys.interaction?.current;
        expect(interaction).toBeTruthy();
        expect((interaction as any)?.data?.sourceId).toBe('giant_ant_we_are_the_champions_choose_source');
    });
});
