/**
 * 验证基地计分事件在竞态条件下不被 waitConfirmWatermark 过滤
 *
 * 模拟场景（P1 客户端视角）：
 * 1. P1 收到 state:sync（EventStream 被 strip）
 * 2. 服务端执行 ADVANCE_PHASE → state:update 到达 P1（P1 无 pending）
 * 3. 服务端执行 P0 RESPONSE_PASS → state:update 到达 P1（P1 无 pending）
 * 4. P1 dispatch RESPONSE_PASS → processCommand 预测成功（wait-confirm）
 * 5. 服务端确认 P1 RESPONSE_PASS → state:update 到达 P1
 *    → reconcile → firstCommandConfirmed = true → watermark = null → BASE_SCORED 可见
 *
 * 竞态场景（P1 客户端视角）：
 * 1. P1 收到 state:sync
 * 2. 服务端执行 ADVANCE_PHASE → state:update 到达 P1
 * 3. P1 dispatch RESPONSE_PASS（此时 P0 的 RESPONSE_PASS 还没到达）
 *    → processCommand 预测成功（wait-confirm）→ waitConfirmWatermark 被设置
 * 4. P0 的 RESPONSE_PASS state:update 到达 P1
 *    → reconcile → stateID 匹配但 playerId 不匹配 → firstCommandConfirmed = false
 *    → replayPending 成功 → pendingCommands 不为空 → 返回重放后的预测状态
 * 5. P1 的 RESPONSE_PASS state:update 到达 P1
 *    → reconcile → predictedStateID 可能不匹配（因为 confirmedStateID 在 step 4 更新了）
 *    → firstCommandConfirmed = false → watermark = waitConfirmWatermark
 *    → filterPlayedEvents 可能过滤掉 BASE_SCORED！
 */

import { describe, expect, it, beforeAll } from 'vitest';
import { SmashUpDomain } from '../domain';
import { smashUpFlowHooks } from '../domain/index';
import { createFlowSystem, createBaseSystems } from '../../../engine';
import type { SmashUpCore, SmashUpCommand } from '../domain/types';
import { SU_EVENTS } from '../domain/types';
import { initAllAbilities } from '../abilities';
import { getEventStreamEntries } from '../../../engine/systems/EventStreamSystem';
import type { RandomFn, MatchState } from '../../../engine/types';
import { createInitialSystemState, executePipeline, createSeededRandom } from '../../../engine/pipeline';
import { createOptimisticEngine, filterPlayedEvents } from '../../../engine/transport/latency/optimisticEngine';
import { smashUpLatencyConfig } from '../latencyConfig';

const PLAYER_IDS = ['0', '1'];
const systems = [
    createFlowSystem<SmashUpCore>({ hooks: smashUpFlowHooks }),
    ...createBaseSystems<SmashUpCore>(),
];

beforeAll(() => { initAllAbilities(); });

describe('BASE_SCORED 竞态条件验证', () => {
    it('对手命令先到达时 BASE_SCORED 不被 waitConfirmWatermark 过滤', () => {
        // 使用 seeded random 模拟真实场景
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
        const stateAfterAdvance = afterAdvance.state;

        // ── 服务端执行 P0 RESPONSE_PASS（stateID: 2 → 3）──
        const afterP0Pass = executePipeline(
            { domain: SmashUpDomain, systems },
            stateAfterAdvance,
            { type: 'RESPONSE_PASS', playerId: '0', payload: undefined, timestamp: 2 } as unknown as SmashUpCommand,
            serverRng, PLAYER_IDS,
        );
        expect(afterP0Pass.success).toBe(true);
        const stateAfterP0Pass = afterP0Pass.state;

        // ── 创建 P1 的乐观引擎 ──
        const engine = createOptimisticEngine({
            pipelineConfig: {
                domain: SmashUpDomain,
                systems,
            },
            commandDeterminism: smashUpLatencyConfig.optimistic?.commandDeterminism ?? {},
            commandAnimationMode: smashUpLatencyConfig.optimistic?.animationMode ?? {},
            playerIds: PLAYER_IDS,
        });

        // 模拟 state:sync（strip EventStream）
        const syncState: MatchState<SmashUpCore> = {
            ...initialState,
            sys: {
                ...initialState.sys,
                eventStream: { entries: [], nextId: 1, maxEntries: 200 },
            },
        };
        engine.syncRandom('test-seed', 0);
        const syncResult = engine.reconcile(syncState, { stateID: 1 });
        console.log('state:sync reconcile:', { didRollback: syncResult.didRollback });

        // ── 模拟 state:update: ADVANCE_PHASE 确认（stateID: 2）──
        const reconcile1 = engine.reconcile(stateAfterAdvance, {
            stateID: 2,
            lastCommandPlayerId: '0',
        });
        console.log('ADVANCE_PHASE reconcile:', {
            didRollback: reconcile1.didRollback,
            watermark: reconcile1.optimisticEventWatermark,
        });
        const entriesAfterAdvance = getEventStreamEntries(reconcile1.stateToRender as MatchState<SmashUpCore>);
        console.log('ADVANCE_PHASE 后 entries:', entriesAfterAdvance.length, 'maxId:', entriesAfterAdvance.length > 0 ? entriesAfterAdvance[entriesAfterAdvance.length - 1].id : 'N/A');

        // ── 竞态：P1 在收到 P0 PASS 之前 dispatch RESPONSE_PASS ──
        // 此时 P1 的 confirmedStateID = 2（ADVANCE_PHASE 确认后）
        const processResult = engine.processCommand('RESPONSE_PASS', undefined, '1');
        console.log('P1 processCommand:', {
            stateToRender: processResult.stateToRender ? '有预测' : 'null',
            animationMode: processResult.animationMode,
        });

        // 检查预测状态是否包含 BASE_SCORED（wait-confirm 应该剥离）
        if (processResult.stateToRender) {
            const predictedEntries = getEventStreamEntries(processResult.stateToRender as MatchState<SmashUpCore>);
            const predictedScored = predictedEntries.filter(e => e.event.type === SU_EVENTS.BASE_SCORED);
            console.log('预测状态 entries:', predictedEntries.length, 'BASE_SCORED:', predictedScored.length);
        }

        // ── P0 RESPONSE_PASS 的 state:update 到达（stateID: 3）──
        // 此时 P1 有 pending RESPONSE_PASS，但这是 P0 的命令
        const reconcile2 = engine.reconcile(stateAfterP0Pass, {
            stateID: 3,
            lastCommandPlayerId: '0', // P0 的命令
        });
        console.log('P0 PASS reconcile:', {
            didRollback: reconcile2.didRollback,
            watermark: reconcile2.optimisticEventWatermark,
            hasPending: engine.hasPendingCommands(),
        });

        // ── 服务端执行 P1 RESPONSE_PASS（stateID: 3 → 4）──
        const afterP1Pass = executePipeline(
            { domain: SmashUpDomain, systems },
            stateAfterP0Pass,
            { type: 'RESPONSE_PASS', playerId: '1', payload: undefined, timestamp: 3 } as unknown as SmashUpCommand,
            serverRng, PLAYER_IDS,
        );
        expect(afterP1Pass.success).toBe(true);
        const stateAfterP1Pass = afterP1Pass.state;

        // 验证服务端状态包含 BASE_SCORED
        const serverEntries = getEventStreamEntries(stateAfterP1Pass);
        const serverScored = serverEntries.filter(e => e.event.type === SU_EVENTS.BASE_SCORED);
        console.log('服务端 entries:', serverEntries.length, 'BASE_SCORED:', serverScored.length);
        expect(serverScored.length).toBeGreaterThan(0);

        // ── P1 RESPONSE_PASS 的 state:update 到达（stateID: 4）──
        const reconcile3 = engine.reconcile(stateAfterP1Pass, {
            stateID: 4,
            lastCommandPlayerId: '1', // P1 的命令
        });
        console.log('P1 PASS reconcile:', {
            didRollback: reconcile3.didRollback,
            watermark: reconcile3.optimisticEventWatermark,
        });

        // 核心断言：reconcile 后的状态包含 BASE_SCORED
        let finalState = reconcile3.stateToRender as MatchState<SmashUpCore>;

        // 如果有回滚和水位线，应用 filterPlayedEvents
        if (reconcile3.didRollback && reconcile3.optimisticEventWatermark !== null) {
            console.log('应用 filterPlayedEvents，watermark:', reconcile3.optimisticEventWatermark);
            finalState = filterPlayedEvents(finalState, reconcile3.optimisticEventWatermark) as MatchState<SmashUpCore>;
        }

        const finalEntries = getEventStreamEntries(finalState);
        const finalScored = finalEntries.filter(e => e.event.type === SU_EVENTS.BASE_SCORED);
        console.log('最终 entries:', finalEntries.length, 'BASE_SCORED:', finalScored.length);
        console.log('所有事件类型:', [...new Set(finalEntries.map(e => e.event.type))]);

        // 核心断言：BASE_SCORED 必须存在
        expect(finalScored.length).toBeGreaterThan(0);

        // 模拟 useEventStreamCursor 消费
        // 假设 cursor 在 reconcile2 后指向 stateAfterP0Pass 的 maxEventId
        const entriesAfterP0Pass = getEventStreamEntries(reconcile2.stateToRender as MatchState<SmashUpCore>);
        const cursorAfterP0Pass = entriesAfterP0Pass.length > 0
            ? entriesAfterP0Pass[entriesAfterP0Pass.length - 1].id
            : -1;
        console.log('cursor after P0 PASS:', cursorAfterP0Pass);

        const newEntries = finalEntries.filter(e => e.id > cursorAfterP0Pass);
        const newScored = newEntries.filter(e => e.event.type === SU_EVENTS.BASE_SCORED);
        console.log('新事件:', newEntries.length, '新 BASE_SCORED:', newScored.length);

        // 核心断言：cursor 消费后能找到 BASE_SCORED
        expect(newScored.length).toBeGreaterThan(0);
    });
});
