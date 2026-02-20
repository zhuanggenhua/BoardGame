/**
 * 验证基地计分事件在乐观引擎 wait-confirm 模式下能正确传递到客户端
 *
 * 模拟完整流程：
 * 1. 客户端 dispatch RESPONSE_PASS → 乐观引擎判定为非确定性 → 不预测
 * 2. 服务端执行命令 → 产生 BASE_SCORED 事件 → broadcastState（保留 EventStream）
 * 3. 客户端 reconcile → 返回 serverState（含 EventStream entries）
 * 4. useEventStreamCursor 消费新事件 → 找到 BASE_SCORED
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
import { createInitialSystemState, executePipeline } from '../../../engine/pipeline';
import { createOptimisticEngine } from '../../../engine/transport/latency/optimisticEngine';
import { smashUpLatencyConfig } from '../latencyConfig';

const PLAYER_IDS = ['0', '1'];
const systems = [
    createFlowSystem<SmashUpCore>({ hooks: smashUpFlowHooks }),
    ...createBaseSystems<SmashUpCore>(),
];
const rng: RandomFn = {
    random: () => 0.5,
    d: (max: number) => Math.ceil(max / 2),
    range: (min: number, max: number) => Math.floor((min + max) / 2),
    shuffle: <T>(arr: T[]) => [...arr],
};

beforeAll(() => { initAllAbilities(); });

describe('BASE_SCORED 乐观引擎传递验证', () => {
    it('wait-confirm 模式下 reconcile 后 EventStream 包含 BASE_SCORED', () => {
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

        // ── Step 1: ADVANCE_PHASE → scoreBases（打开 Me First! 响应窗口）──
        let serverState = executePipeline(
            { domain: SmashUpDomain, systems },
            initialState,
            { type: 'ADVANCE_PHASE', playerId: '0', payload: undefined, timestamp: 1 } as unknown as SmashUpCommand,
            rng, PLAYER_IDS,
        ).state;

        // ── Step 2: P0 PASS ──
        serverState = executePipeline(
            { domain: SmashUpDomain, systems },
            serverState,
            { type: 'RESPONSE_PASS', playerId: '0', payload: undefined, timestamp: 2 } as unknown as SmashUpCommand,
            rng, PLAYER_IDS,
        ).state;

        // ── 创建乐观引擎（模拟客户端）──
        const engine = createOptimisticEngine({
            pipelineConfig: {
                domain: SmashUpDomain,
                systems,
            },
            commandDeterminism: smashUpLatencyConfig.optimistic?.commandDeterminism ?? {},
            commandAnimationMode: smashUpLatencyConfig.optimistic?.animationMode ?? {},
            playerIds: PLAYER_IDS,
        });

        // 模拟客户端首次收到服务端状态（P0 已 PASS，等待 P1 PASS）
        const firstReconcile = engine.reconcile(serverState);
        const clientStateBeforeP1Pass = firstReconcile.stateToRender;
        const entriesBefore = getEventStreamEntries(clientStateBeforeP1Pass as MatchState<SmashUpCore>);
        console.log('reconcile 后 entries 数量（P1 PASS 前）:', entriesBefore.length);

        // ── Step 3: 客户端 dispatch P1 RESPONSE_PASS ──
        const processResult = engine.processCommand('RESPONSE_PASS', undefined, '1');
        console.log('processCommand 结果:', {
            stateToRender: processResult.stateToRender ? '有预测' : 'null（未预测）',
            shouldSend: processResult.shouldSend,
            animationMode: processResult.animationMode,
        });

        // 在测试环境中，rng 是确定性的，所以 Random Probe 不会检测到随机调用
        // 命令会被预测，但 animationMode 是 wait-confirm（因为 RESPONSE_PASS 不在 animationMode 配置中）
        // 在真实游戏中，如果有触发器使用 random，则不会被预测
        console.log('预测状态是否为 null:', processResult.stateToRender === null);
        console.log('animationMode:', processResult.animationMode);

        // RESPONSE_PASS 由引擎层内置 'optimistic' 默认值（见 optimisticEngine.ts getAnimationMode）
        // 游戏层未在 animationMode 中显式声明 RESPONSE_PASS，所以走引擎内置值
        expect(processResult.animationMode).toBe('optimistic');

        // 如果被预测了，检查预测状态的 EventStream（wait-confirm 模式会剥离新事件）
        if (processResult.stateToRender) {
            const predictedEntries = getEventStreamEntries(processResult.stateToRender as MatchState<SmashUpCore>);
            const predictedScored = predictedEntries.filter(e => e.event.type === SU_EVENTS.BASE_SCORED);
            console.log('预测状态 EventStream entries:', predictedEntries.length);
            console.log('预测状态 BASE_SCORED 数量:', predictedScored.length);
            // wait-confirm 模式下，预测状态的 EventStream 应该是 previousState 的（不含 BASE_SCORED）
            console.log('预测状态 BASE_SCORED 应为 0（wait-confirm 剥离）:', predictedScored.length === 0);
        }

        // ── Step 4: 服务端执行 P1 RESPONSE_PASS → 产生 BASE_SCORED ──
        const serverResult = executePipeline(
            { domain: SmashUpDomain, systems },
            serverState,
            { type: 'RESPONSE_PASS', playerId: '1', payload: undefined, timestamp: 3 } as unknown as SmashUpCommand,
            rng, PLAYER_IDS,
        );
        expect(serverResult.success).toBe(true);

        // 验证服务端状态包含 BASE_SCORED
        const serverEntries = getEventStreamEntries(serverResult.state);
        const serverScored = serverEntries.filter(e => e.event.type === SU_EVENTS.BASE_SCORED);
        console.log('服务端 EventStream entries:', serverEntries.length);
        console.log('服务端 BASE_SCORED 数量:', serverScored.length);
        expect(serverScored.length).toBeGreaterThan(0);

        // ── Step 5: 客户端 reconcile 服务端状态 ──
        const reconcileResult = engine.reconcile(serverResult.state);
        console.log('reconcile 结果:', {
            didRollback: reconcileResult.didRollback,
            optimisticEventWatermark: reconcileResult.optimisticEventWatermark,
        });

        // 验证 reconcile 返回的状态包含 BASE_SCORED
        const clientEntries = getEventStreamEntries(reconcileResult.stateToRender as MatchState<SmashUpCore>);
        const clientScored = clientEntries.filter(e => e.event.type === SU_EVENTS.BASE_SCORED);
        console.log('客户端 reconcile 后 entries:', clientEntries.length);
        console.log('客户端 BASE_SCORED 数量:', clientScored.length);

        // 核心断言：客户端 reconcile 后能看到 BASE_SCORED 事件
        expect(clientScored.length).toBeGreaterThan(0);

        // ── Step 6: 模拟 useEventStreamCursor 消费 ──
        // 模拟首次调用（跳过历史）
        let cursor = -1;
        const entriesBeforeCommand = getEventStreamEntries(clientStateBeforeP1Pass as MatchState<SmashUpCore>);
        if (entriesBeforeCommand.length > 0) {
            cursor = entriesBeforeCommand[entriesBeforeCommand.length - 1].id;
        }
        console.log('cursor 初始值（跳过历史后）:', cursor);

        // 模拟 reconcile 后的消费
        const newEntries = clientEntries.filter(e => e.id > cursor);
        const newScored = newEntries.filter(e => e.event.type === SU_EVENTS.BASE_SCORED);
        console.log('新事件数量:', newEntries.length);
        console.log('新 BASE_SCORED 数量:', newScored.length);
        console.log('新事件类型:', [...new Set(newEntries.map(e => e.event.type))]);

        // 核心断言：cursor 消费后能找到 BASE_SCORED
        expect(newScored.length).toBeGreaterThan(0);
    });
});
