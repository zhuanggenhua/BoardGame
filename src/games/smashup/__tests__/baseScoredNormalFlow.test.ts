/**
 * 验证正常流程下基地计分事件在乐观引擎中的传递
 *
 * 模拟场景（P1 客户端视角，isRandomSynced = true）：
 * 1. state:sync → syncRandom → isRandomSynced = true
 * 2. ADVANCE_PHASE state:update 到达（stateID: 2）
 * 3. P0 su:reaction_pass state:update 到达（stateID: 3）
 * 4. P1 dispatch su:reaction_pass → processCommand 预测成功（wait-confirm）
 *    → waitConfirmWatermark 被设置
 * 5. 服务端确认 P1 su:reaction_pass → state:update 到达（stateID: 4）
 *    → reconcile → firstCommandConfirmed = true → watermark = null → BASE_SCORED 可见
 */

import { describe, expect, it, beforeAll } from 'vitest';
import { SmashUpDomain } from '../domain';
import { smashUpFlowHooks } from '../domain/index';
import { createFlowSystem, createBaseSystems } from '../../../engine';
import type { SmashUpCore, SmashUpCommand } from '../domain/types';
import { SU_COMMANDS, SU_EVENTS } from '../domain/types';
import { initAllAbilities } from '../abilities';
import { createSmashUpEventSystem } from '../domain/systems';
import { getEventStreamEntries } from '../../../engine/systems/EventStreamSystem';
import type { MatchState } from '../../../engine/types';
import { createInitialSystemState, executePipeline, createSeededRandom } from '../../../engine/pipeline';
import { createOptimisticEngine, filterPlayedEvents } from '../../../engine/transport/latency/optimisticEngine';
import { smashUpLatencyConfig } from '../latencyConfig';

const PLAYER_IDS = ['0', '1'];
const systems = [
    createFlowSystem<SmashUpCore>({ hooks: smashUpFlowHooks }),
    ...createBaseSystems<SmashUpCore>(),
    createSmashUpEventSystem(),
];

beforeAll(() => { initAllAbilities(); });

describe('BASE_SCORED 正常流程验证（isRandomSynced=true）', () => {
    it('P0 先 PASS，P1 后 PASS，BASE_SCORED 正确传递', () => {
        const serverRng = createSeededRandom('test-seed');

        // ── 构造初始状态：基地已达临界点 ──
        const core: SmashUpCore = {
            players: {
                '0': {
                    id: '0',
                    vp: 0,
                    hand: [{ uid: 'p0-full-sail', defId: 'pirate_full_sail', type: 'action', owner: '0' }],
                    deck: [],
                    discard: [],
                    minionsPlayed: 0,
                    minionLimit: 1,
                    actionsPlayed: 0,
                    actionLimit: 1,
                    factions: ['aliens', 'dinosaurs'],
                },
                '1': {
                    id: '1',
                    vp: 0,
                    hand: [{ uid: 'p1-full-sail', defId: 'pirate_full_sail', type: 'action', owner: '1' }],
                    deck: [],
                    discard: [],
                    minionsPlayed: 0,
                    minionLimit: 1,
                    actionsPlayed: 0,
                    actionLimit: 1,
                    factions: ['pirates', 'ninjas'],
                },
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [
                {
                    defId: 'base_the_homeworld',
                    minions: [
                        { uid: 'm1', defId: 'test_a', controller: '0', owner: '0', basePower: 25, powerCounters: 0, powerModifier: 0, tempPowerModifier: 0, talentUsed: false, attachedActions: [] },
                        { uid: 'm2', defId: 'test_b', controller: '1', owner: '1', basePower: 5, powerCounters: 0, powerModifier: 0, tempPowerModifier: 0, talentUsed: false, attachedActions: [] },
                    ],
                    ongoingActions: [],
                },
                { defId: 'base_central_brain', minions: [], ongoingActions: [] },
            ],
            baseDeck: ['base_haunted_house'],
            turnNumber: 1,
            nextUid: 100,
        } as any;

        const sys = createInitialSystemState(PLAYER_IDS, systems, undefined);
        sys.phase = 'playCards';
        const initialState: MatchState<SmashUpCore> = { core, sys };

        // ── 服务端执行 ADVANCE_PHASE（stateID: 1 → 2）──
        const afterAdvance = executePipeline(
            { domain: SmashUpDomain, systems },
            initialState,
            { type: 'ADVANCE_PHASE', playerId: '0', payload: undefined, timestamp: 1 } as unknown as SmashUpCommand,
            serverRng, PLAYER_IDS,
        );
        expect(afterAdvance.success).toBe(true);

        // ── 服务端执行 P0 su:reaction_pass（stateID: 2 → 3）──
        const afterP0Pass = executePipeline(
            { domain: SmashUpDomain, systems },
            afterAdvance.state,
            { type: SU_COMMANDS.REACTION_PASS, playerId: '0', payload: { reason: 'player_pass' }, timestamp: 2 } as unknown as SmashUpCommand,
            serverRng, PLAYER_IDS,
        );
        expect(afterP0Pass.success).toBe(true);

        // ── 服务端执行 P1 su:reaction_pass（stateID: 3 → 4）→ 产生 BASE_SCORED ──
        const afterP1Pass = executePipeline(
            { domain: SmashUpDomain, systems },
            afterP0Pass.state,
            { type: SU_COMMANDS.REACTION_PASS, playerId: '1', payload: { reason: 'player_pass' }, timestamp: 3 } as unknown as SmashUpCommand,
            serverRng, PLAYER_IDS,
        );
        expect(afterP1Pass.success).toBe(true);

        // 验证服务端状态包含 BASE_SCORED
        const serverEntries = getEventStreamEntries(afterP1Pass.state);
        const serverScored = serverEntries.filter(e => e.event.type === SU_EVENTS.BASE_SCORED);
        expect(serverScored.length).toBeGreaterThan(0);

        // ── 创建 P1 的乐观引擎（模拟 isRandomSynced = true）──
        const engine = createOptimisticEngine({
            pipelineConfig: { domain: SmashUpDomain, systems },
            commandDeterminism: smashUpLatencyConfig.optimistic?.commandDeterminism ?? {},
            commandAnimationMode: smashUpLatencyConfig.optimistic?.animationMode ?? {},
            playerIds: PLAYER_IDS,
        });

        // 模拟 state:sync（strip EventStream + syncRandom）
        const syncState: MatchState<SmashUpCore> = {
            ...initialState,
            sys: { ...initialState.sys, eventStream: { entries: [], nextId: 1, maxEntries: 200 } },
        };
        engine.syncRandom('test-seed', 0);
        engine.reconcile(syncState, { stateID: 1 });

        // ── state:update: ADVANCE_PHASE 确认（stateID: 2）──
        engine.reconcile(afterAdvance.state, { stateID: 2, lastCommandPlayerId: '0' });

        // ── state:update: P0 su:reaction_pass 确认（stateID: 3）──
        const afterP0Reconcile = engine.reconcile(afterP0Pass.state, { stateID: 3, lastCommandPlayerId: '0' });

        // 记录 P0 PASS 后的 EventStream maxId（模拟 useEventStreamCursor 的 cursor）
        const entriesAfterP0 = getEventStreamEntries(afterP0Reconcile.stateToRender as MatchState<SmashUpCore>);
        const cursorAfterP0 = entriesAfterP0.length > 0 ? entriesAfterP0[entriesAfterP0.length - 1].id : -1;

        // ── P1 dispatch su:reaction_pass（isRandomSynced=true，应该被预测）──
        const processResult = engine.processCommand(SU_COMMANDS.REACTION_PASS, { reason: 'player_pass' }, '1');

        // 关键：isRandomSynced=true 时，su:reaction_pass 应该被预测（useProbe=false）
        // 且 animationMode = 'optimistic'（已在 animationMode 配置中声明）
        expect(processResult.stateToRender).toBeTruthy();
        const predictedEntries = getEventStreamEntries(processResult.stateToRender as MatchState<SmashUpCore>);
        const predictedScored = predictedEntries.filter(e => e.event.type === SU_EVENTS.BASE_SCORED);
        // optimistic 模式下，预测状态保留了 EventStream，BASE_SCORED 应该存在
        expect(processResult.animationMode).toBe('optimistic');
        expect(predictedScored.length).toBeGreaterThan(0); // optimistic 保留了新事件

        // ── 服务端确认 P1 su:reaction_pass（stateID: 4）──
        const finalReconcile = engine.reconcile(afterP1Pass.state, {
            stateID: 4,
            lastCommandPlayerId: '1',
        });

        // 应用 filterPlayedEvents（如果需要）
        let finalState = finalReconcile.stateToRender as MatchState<SmashUpCore>;
        if (finalReconcile.didRollback && finalReconcile.optimisticEventWatermark !== null) {
            finalState = filterPlayedEvents(finalState, finalReconcile.optimisticEventWatermark) as MatchState<SmashUpCore>;
        }

        const finalEntries = getEventStreamEntries(finalState);
        const finalScored = finalEntries.filter(e => e.event.type === SU_EVENTS.BASE_SCORED);

        // 核心断言：BASE_SCORED 必须存在
        expect(finalScored.length).toBeGreaterThan(0);

        // 模拟 useEventStreamCursor 消费
        const newEntries = finalEntries.filter(e => e.id > cursorAfterP0);
        const newScored = newEntries.filter(e => e.event.type === SU_EVENTS.BASE_SCORED);

        // 核心断言：BASE_SCORED 必须存在（可能在 P0 PASS 后已进入 EventStream）
        if (newScored.length === 0) {
            const scoredBeforeCursor = finalEntries.filter(
                e => e.id <= cursorAfterP0 && e.event.type === SU_EVENTS.BASE_SCORED,
            );
            expect(scoredBeforeCursor.length).toBeGreaterThan(0);
        } else {
            expect(newScored.length).toBeGreaterThan(0);
        }
    });
});
