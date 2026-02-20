/**
 * 验证正常流程下基地计分事件在乐观引擎中的传递
 *
 * 模拟场景（P1 客户端视角，isRandomSynced = true）：
 * 1. state:sync → syncRandom → isRandomSynced = true
 * 2. ADVANCE_PHASE state:update 到达（stateID: 2）
 * 3. P0 RESPONSE_PASS state:update 到达（stateID: 3）
 * 4. P1 dispatch RESPONSE_PASS → processCommand 预测成功（wait-confirm）
 *    → waitConfirmWatermark 被设置
 * 5. 服务端确认 P1 RESPONSE_PASS → state:update 到达（stateID: 4）
 *    → reconcile → firstCommandConfirmed = true → watermark = null → BASE_SCORED 可见
 */

import { describe, expect, it, beforeAll } from 'vitest';
import { SmashUpDomain } from '../domain';
import { smashUpFlowHooks } from '../domain/index';
import { createFlowSystem, createBaseSystems } from '../../../engine';
import type { SmashUpCore, SmashUpCommand } from '../domain/types';
import { SU_EVENTS } from '../domain/types';
import { initAllAbilities } from '../abilities';
import { getEventStreamEntries } from '../../../engine/systems/EventStreamSystem';
import type { MatchState } from '../../../engine/types';
import { createInitialSystemState, executePipeline, createSeededRandom } from '../../../engine/pipeline';
import { createOptimisticEngine, filterPlayedEvents } from '../../../engine/transport/latency/optimisticEngine';
import { smashUpLatencyConfig } from '../latencyConfig';

const PLAYER_IDS = ['0', '1'];
const systems = [
    createFlowSystem<SmashUpCore>({ hooks: smashUpFlowHooks }),
    ...createBaseSystems<SmashUpCore>(),
];

beforeAll(() => { initAllAbilities(); });

describe('BASE_SCORED 正常流程验证（isRandomSynced=true）', () => {
    it('P0 先 PASS，P1 后 PASS，BASE_SCORED 正确传递', () => {
        const serverRng = createSeededRandom('test-seed');

        // ── 构造初始状态：基地已达临界点 ──
        const core: SmashUpCore = {
            players: {
                '0': { id: '0', vp: 0, hand: [], deck: [], discard: [], minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1, factions: ['aliens', 'dinosaurs'] },
                '1': { id: '1', vp: 0, hand: [], deck: [], discard: [], minionsPlayed: 0, minionLimit: 1, actionsPlayed: 0, actionLimit: 1, factions: ['pirates', 'ninjas'] },
            },
            turnOrder: ['0', '1'],
            currentPlayerIndex: 0,
            bases: [
                {
                    defId: 'base_the_homeworld',
                    minions: [
                        { uid: 'm1', defId: 'test_a', controller: '0', owner: '0', basePower: 25, powerModifier: 0, talentUsed: false, attachedActions: [] },
                        { uid: 'm2', defId: 'test_b', controller: '1', owner: '1', basePower: 5, powerModifier: 0, talentUsed: false, attachedActions: [] },
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

        // ── 服务端执行 P0 RESPONSE_PASS（stateID: 2 → 3）──
        const afterP0Pass = executePipeline(
            { domain: SmashUpDomain, systems },
            afterAdvance.state,
            { type: 'RESPONSE_PASS', playerId: '0', payload: undefined, timestamp: 2 } as unknown as SmashUpCommand,
            serverRng, PLAYER_IDS,
        );
        expect(afterP0Pass.success).toBe(true);

        // ── 服务端执行 P1 RESPONSE_PASS（stateID: 3 → 4）→ 产生 BASE_SCORED ──
        const afterP1Pass = executePipeline(
            { domain: SmashUpDomain, systems },
            afterP0Pass.state,
            { type: 'RESPONSE_PASS', playerId: '1', payload: undefined, timestamp: 3 } as unknown as SmashUpCommand,
            serverRng, PLAYER_IDS,
        );
        expect(afterP1Pass.success).toBe(true);

        // 验证服务端状态包含 BASE_SCORED
        const serverEntries = getEventStreamEntries(afterP1Pass.state);
        const serverScored = serverEntries.filter(e => e.event.type === SU_EVENTS.BASE_SCORED);
        expect(serverScored.length).toBeGreaterThan(0);
        console.log('服务端 BASE_SCORED 数量:', serverScored.length, 'IDs:', serverScored.map(e => e.id));

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

        // ── state:update: P0 RESPONSE_PASS 确认（stateID: 3）──
        const afterP0Reconcile = engine.reconcile(afterP0Pass.state, { stateID: 3, lastCommandPlayerId: '0' });
        console.log('P0 PASS reconcile:', { didRollback: afterP0Reconcile.didRollback });

        // 记录 P0 PASS 后的 EventStream maxId（模拟 useEventStreamCursor 的 cursor）
        const entriesAfterP0 = getEventStreamEntries(afterP0Reconcile.stateToRender as MatchState<SmashUpCore>);
        const cursorAfterP0 = entriesAfterP0.length > 0 ? entriesAfterP0[entriesAfterP0.length - 1].id : -1;
        console.log('P0 PASS 后 cursor:', cursorAfterP0, 'entries:', entriesAfterP0.length);

        // ── P1 dispatch RESPONSE_PASS（isRandomSynced=true，应该被预测）──
        const processResult = engine.processCommand('RESPONSE_PASS', undefined, '1');
        console.log('P1 processCommand:', {
            stateToRender: processResult.stateToRender ? '有预测' : 'null',
            animationMode: processResult.animationMode,
            shouldSend: processResult.shouldSend,
        });

        // 关键：isRandomSynced=true 时，RESPONSE_PASS 应该被预测（useProbe=false）
        // 且 animationMode = 'optimistic'（已在 animationMode 配置中声明）
        if (processResult.stateToRender) {
            console.log('✅ 命令被预测了（isRandomSynced=true）');
            const predictedEntries = getEventStreamEntries(processResult.stateToRender as MatchState<SmashUpCore>);
            const predictedScored = predictedEntries.filter(e => e.event.type === SU_EVENTS.BASE_SCORED);
            console.log('预测状态 entries:', predictedEntries.length, 'BASE_SCORED:', predictedScored.length);
            // optimistic 模式下，预测状态保留了 EventStream，BASE_SCORED 应该存在
            expect(processResult.animationMode).toBe('optimistic');
            expect(predictedScored.length).toBeGreaterThan(0); // optimistic 保留了新事件
        } else {
            console.log('❌ 命令未被预测（可能 pipeline 失败）');
        }

        // ── 服务端确认 P1 RESPONSE_PASS（stateID: 4）──
        const finalReconcile = engine.reconcile(afterP1Pass.state, {
            stateID: 4,
            lastCommandPlayerId: '1',
        });
        console.log('P1 PASS reconcile:', {
            didRollback: finalReconcile.didRollback,
            watermark: finalReconcile.optimisticEventWatermark,
            hasPending: engine.hasPendingCommands(),
        });

        // 应用 filterPlayedEvents（如果需要）
        let finalState = finalReconcile.stateToRender as MatchState<SmashUpCore>;
        if (finalReconcile.didRollback && finalReconcile.optimisticEventWatermark !== null) {
            console.log('⚠️ 应用 filterPlayedEvents，watermark:', finalReconcile.optimisticEventWatermark);
            finalState = filterPlayedEvents(finalState, finalReconcile.optimisticEventWatermark) as MatchState<SmashUpCore>;
        }

        const finalEntries = getEventStreamEntries(finalState);
        const finalScored = finalEntries.filter(e => e.event.type === SU_EVENTS.BASE_SCORED);
        console.log('最终 entries:', finalEntries.length, 'BASE_SCORED:', finalScored.length);

        // 核心断言：BASE_SCORED 必须存在
        expect(finalScored.length).toBeGreaterThan(0);

        // 模拟 useEventStreamCursor 消费
        const newEntries = finalEntries.filter(e => e.id > cursorAfterP0);
        const newScored = newEntries.filter(e => e.event.type === SU_EVENTS.BASE_SCORED);
        console.log('cursor 消费后新事件:', newEntries.length, '新 BASE_SCORED:', newScored.length);

        // 核心断言：cursor 消费后能找到 BASE_SCORED
        expect(newScored.length).toBeGreaterThan(0);
    });
});
