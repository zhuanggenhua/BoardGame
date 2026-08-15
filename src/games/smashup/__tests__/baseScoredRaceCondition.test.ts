/**
 * 验证基地计分事件在竞态条件下不被 waitConfirmWatermark 过滤
 *
 * 模拟场景（P1 客户端视角）：
 * 1. P1 收到 state:sync（EventStream 被 strip）
 * 2. 服务端执行 ADVANCE_PHASE → state:update 到达 P1（P1 无 pending）
 * 3. 服务端执行 P0 su:reaction_pass → state:update 到达 P1（P1 无 pending）
 * 4. P1 dispatch su:reaction_pass → processCommand 预测成功（wait-confirm）
 * 5. 服务端确认 P1 su:reaction_pass → state:update 到达 P1
 *    → reconcile → firstCommandConfirmed = true → watermark = null → BASE_SCORED 可见
 *
 * 竞态场景（P1 客户端视角）：
 * 1. P1 收到 state:sync
 * 2. 服务端执行 ADVANCE_PHASE → state:update 到达 P1
 * 3. P1 dispatch su:reaction_pass（此时 P0 的 su:reaction_pass 还没到达）
 *    → 本地验证失败，不预测，也不加入 pending
 * 4. P0 的 su:reaction_pass state:update 到达 P1
 *    → P1 现在成为当前响应者
 * 5. P1 再 dispatch su:reaction_pass
 *    → processCommand 预测成功，BASE_SCORED 可见
 * 6. P1 的 su:reaction_pass state:update 到达 P1
 *    → reconcile 后 BASE_SCORED 仍可见
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

describe('BASE_SCORED 竞态条件验证', () => {
    it('对手命令先到达时 BASE_SCORED 不被 waitConfirmWatermark 过滤', () => {
        // 使用 seeded random 模拟真实场景
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
        const stateAfterAdvance = afterAdvance.state;

        // ── 服务端执行 P0 su:reaction_pass（stateID: 2 → 3）──
        const afterP0Pass = executePipeline(
            { domain: SmashUpDomain, systems },
            stateAfterAdvance,
            { type: SU_COMMANDS.REACTION_PASS, playerId: '0', payload: { reason: 'player_pass' }, timestamp: 2 } as unknown as SmashUpCommand,
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
        engine.reconcile(syncState, { stateID: 1 });

        // ── 模拟 state:update: ADVANCE_PHASE 确认（stateID: 2）──
        engine.reconcile(stateAfterAdvance, {
            stateID: 2,
            lastCommandPlayerId: '0',
        });

        // ── 竞态：P1 在收到 P0 PASS 之前 dispatch su:reaction_pass ──
        // 此时 P1 的 confirmedStateID = 2（ADVANCE_PHASE 确认后）
        const prematureProcessResult = engine.processCommand(SU_COMMANDS.REACTION_PASS, { reason: 'player_pass' }, '1');
        expect(prematureProcessResult.stateToRender).toBeNull();
        expect(prematureProcessResult.animationMode).toBe('wait-confirm');

        // ── P0 su:reaction_pass 的 state:update 到达（stateID: 3）──
        // 此时没有 pending 提前 pass，确认状态直接让 P1 成为当前响应者
        const reconcile2 = engine.reconcile(stateAfterP0Pass, {
            stateID: 3,
            lastCommandPlayerId: '0', // P0 的命令
        });

        // ── P1 收到 P0 PASS 后再次 dispatch su:reaction_pass，现已合法可预测 ──
        const processResult = engine.processCommand(SU_COMMANDS.REACTION_PASS, { reason: 'player_pass' }, '1');
        expect(processResult.stateToRender).toBeTruthy();

        const predictedEntries = getEventStreamEntries(processResult.stateToRender as MatchState<SmashUpCore>);
        const predictedScored = predictedEntries.filter(e => e.event.type === SU_EVENTS.BASE_SCORED);
        expect(predictedScored.length).toBeGreaterThan(0);

        // ── 服务端执行 P1 su:reaction_pass（stateID: 3 → 4）──
        const afterP1Pass = executePipeline(
            { domain: SmashUpDomain, systems },
            stateAfterP0Pass,
            { type: SU_COMMANDS.REACTION_PASS, playerId: '1', payload: { reason: 'player_pass' }, timestamp: 3 } as unknown as SmashUpCommand,
            serverRng, PLAYER_IDS,
        );
        expect(afterP1Pass.success).toBe(true);
        const stateAfterP1Pass = afterP1Pass.state;

        // 验证服务端状态包含 BASE_SCORED
        const serverEntries = getEventStreamEntries(stateAfterP1Pass);
        const serverScored = serverEntries.filter(e => e.event.type === SU_EVENTS.BASE_SCORED);
        expect(serverScored.length).toBeGreaterThan(0);

        // ── P1 su:reaction_pass 的 state:update 到达（stateID: 4）──
        const reconcile3 = engine.reconcile(stateAfterP1Pass, {
            stateID: 4,
            lastCommandPlayerId: '1', // P1 的命令
        });

        // 核心断言：reconcile 后的状态包含 BASE_SCORED
        let finalState = reconcile3.stateToRender as MatchState<SmashUpCore>;

        // 如果有回滚和水位线，应用 filterPlayedEvents
        if (reconcile3.didRollback && reconcile3.optimisticEventWatermark !== null) {
            finalState = filterPlayedEvents(finalState, reconcile3.optimisticEventWatermark) as MatchState<SmashUpCore>;
        }

        const finalEntries = getEventStreamEntries(finalState);
        const finalScored = finalEntries.filter(e => e.event.type === SU_EVENTS.BASE_SCORED);

        // 核心断言：BASE_SCORED 必须存在
        expect(finalScored.length).toBeGreaterThan(0);

        // 模拟 useEventStreamCursor 消费
        // 假设 cursor 在 reconcile2 后指向 stateAfterP0Pass 的 maxEventId
        const entriesAfterP0Pass = getEventStreamEntries(reconcile2.stateToRender as MatchState<SmashUpCore>);
        const cursorAfterP0Pass = entriesAfterP0Pass.length > 0
            ? entriesAfterP0Pass[entriesAfterP0Pass.length - 1].id
            : -1;

        const newEntries = finalEntries.filter(e => e.id > cursorAfterP0Pass);
        const newScored = newEntries.filter(e => e.event.type === SU_EVENTS.BASE_SCORED);

        // 核心断言：BASE_SCORED 必须存在（可能在 P0 PASS 后已进入 EventStream）
        if (newScored.length === 0) {
            const scoredBeforeCursor = finalEntries.filter(
                e => e.id <= cursorAfterP0Pass && e.event.type === SU_EVENTS.BASE_SCORED,
            );
            expect(scoredBeforeCursor.length).toBeGreaterThan(0);
        } else {
            expect(newScored.length).toBeGreaterThan(0);
        }
    });
});
