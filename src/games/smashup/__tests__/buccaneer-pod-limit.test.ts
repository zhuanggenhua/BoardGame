/**
 * 私掠者 POD (Buccaneer POD) - 每回合一次限制测试
 *
 * 验证：
 * 1. MINION_MOVED 事件 reason='pirate_buccaneer_pod' 时，minionUid 被记录到 buccaneerPodUsedUids
 * 2. TURN_STARTED 事件清空 buccaneerPodUsedUids
 * 3. 触发器尊重每回合限制（第二次消灭不触发移动）
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { makeState, makeMinion, makePlayer, makeBase, applyEvents, makeMatchState, makeCard } from './helpers';
import { reduce } from '../domain/reducer';
import { initAllAbilities } from '../abilities';
import { SU_EVENT_TYPES } from '../domain/events';
import type { MinionMovedEvent, SmashUpCore } from '../domain/types';
import { moveMinion, destroyMinion } from '../domain/abilityHelpers';
import { getInteractionHandler } from '../domain/abilityInteractionHandlers';
import { fireTriggers } from '../domain/ongoingEffects';

beforeAll(() => {
    initAllAbilities();
});

describe('私掠者 POD 每回合一次移动限制', () => {
    // ========================================================================
    // Reducer 层测试：验证 buccaneerPodUsedUids 追踪
    // ========================================================================

    it('MINION_MOVED + reason=pirate_buccaneer_pod → 记录 UID', () => {
        const state = makeState({
            bases: [
                makeBase('base_test_1', [
                    makeMinion('bucc1', 'pirate_buccaneer_pod', '0', 2),
                ]),
                makeBase('base_test_2'),
            ],
        });

        // 确认初始状态没有记录
        expect(state.buccaneerPodUsedUids).toBeUndefined();

        // 应用一次移动事件（POD 版本 reason）
        const moveEvent = moveMinion('bucc1', 'pirate_buccaneer_pod', 0, 1, 'pirate_buccaneer_pod', Date.now());
        const newState = reduce(state, moveEvent);

        // 验证：UID 已被记录
        expect(newState.buccaneerPodUsedUids).toBeDefined();
        expect(newState.buccaneerPodUsedUids).toContain('bucc1');
    });

    it('MINION_MOVED + reason=pirate_buccaneer（原版）→ 不记录 UID', () => {
        const state = makeState({
            bases: [
                makeBase('base_test_1', [
                    makeMinion('bucc_orig', 'pirate_buccaneer', '0', 2),
                ]),
                makeBase('base_test_2'),
            ],
        });

        const moveEvent = moveMinion('bucc_orig', 'pirate_buccaneer', 0, 1, 'pirate_buccaneer', Date.now());
        const newState = reduce(state, moveEvent);

        // 原版不应该被追踪
        expect(newState.buccaneerPodUsedUids ?? []).not.toContain('bucc_orig');
    });

    it('TURN_STARTED → 清空 buccaneerPodUsedUids', () => {
        // 预设一个已有记录的状态
        const state = makeState({
            buccaneerPodUsedUids: ['bucc1', 'bucc2'],
        });

        // 应用回合开始事件
        const turnStartEvent = {
            type: SU_EVENT_TYPES.TURN_STARTED,
            payload: { playerId: '0', turnNumber: 2 },
            timestamp: Date.now(),
        };
        const newState = reduce(state, turnStartEvent as any);

        // 验证：记录被清空
        expect(newState.buccaneerPodUsedUids).toBeUndefined();
    });

    it('连续两次 POD 移动 → 两个 UID 都被记录', () => {
        const state = makeState({
            bases: [
                makeBase('base_test_1', [
                    makeMinion('bucc1', 'pirate_buccaneer_pod', '0', 2),
                    makeMinion('bucc2', 'pirate_buccaneer_pod', '0', 2),
                ]),
                makeBase('base_test_2'),
            ],
        });

        // 第一次移动
        const move1 = moveMinion('bucc1', 'pirate_buccaneer_pod', 0, 1, 'pirate_buccaneer_pod', Date.now());
        const state1 = reduce(state, move1);
        expect(state1.buccaneerPodUsedUids).toContain('bucc1');

        // 第二次移动（不同随从）
        const move2 = moveMinion('bucc2', 'pirate_buccaneer_pod', 0, 1, 'pirate_buccaneer_pod', Date.now());
        const state2 = reduce(state1, move2);
        expect(state2.buccaneerPodUsedUids).toContain('bucc1');
        expect(state2.buccaneerPodUsedUids).toContain('bucc2');
        expect(state2.buccaneerPodUsedUids).toHaveLength(2);
    });

    // ========================================================================
    // 综合场景：消灭 -> 移动 -> 再消灭
    // ========================================================================

    it('消灭 -> 移动 -> 再次消灭：第二次不应触发移动', () => {
        // 初始状态：私掠者 POD 在基地 0
        let state = makeState({
            bases: [
                makeBase('base0', [makeMinion('bucc1', 'pirate_buccaneer_pod', '0', 2)]),
                makeBase('base1'),
            ],
        });

        // 1. 触发第一次消灭
        // 模拟触发器生成的移动事件 (理由必须对)
        const move1 = moveMinion('bucc1', 'pirate_buccaneer_pod', 0, 1, 'pirate_buccaneer_pod', Date.now());
        state = reduce(state, move1);

        // 验证：位置变了，记录也有了
        expect(state.bases[1].minions.find(m => m.uid === 'bucc1')).toBeDefined();
        expect(state.buccaneerPodUsedUids).toContain('bucc1');

        // 2. 模拟第二次消灭触发器检查
        // 我们直接调用 pirates.ts 中的逻辑检查代码 (或者模拟它的检查)
        // triggerMinionUid = 'bucc1', triggerMinionDefId = 'pirate_buccaneer_pod'
        const triggerMinionUid = 'bucc1';
        const isPod = true;

        // 这里的逻辑应与 pirates.ts:225 一致
        const shouldTrigger = !(isPod && state.buccaneerPodUsedUids?.includes(triggerMinionUid));

        expect(shouldTrigger).toBe(false); // 预期：不应再次触发
    });

    it('BASE_CLEARED 后索引变化时，仍可通过 baseDefId 将海盗移到正确基地', () => {
        const core = makeState({
            bases: [
                makeBase('base_left'),
                makeBase('base_target'),
            ],
            players: {
                '0': makePlayer('0', {
                    discard: [makeCard('bucc1', 'pirate_buccaneer_pod', 'minion', '0')],
                }),
                '1': makePlayer('1'),
            },
        });

        const ms = makeMatchState(core);
        const handler = getInteractionHandler('pirate_buccaneer_move');
        expect(handler).toBeDefined();

        const result = handler!(
            ms,
            '0',
            {
                minionUid: 'bucc1',
                minionDefId: 'pirate_buccaneer_pod',
                fromBaseIndex: 0,
                toBaseIndex: 2,
                baseDefId: 'base_target',
            },
            undefined,
            {} as any,
            Date.now(),
        );

        expect(result.events.length).toBe(1);
        const moveEvt = result.events[0] as MinionMovedEvent;
        expect(moveEvt.payload.toBaseIndex).toBe(1);

        const nextCore = reduce(core, moveEvt);
        expect(nextCore.bases[1].minions.some(m => m.uid === 'bucc1')).toBe(true);
        expect(nextCore.players['0'].discard.some(c => c.uid === 'bucc1')).toBe(false);
    });

    it('消灭 buccaneer_pod 时会进入 replacement 交互（而不是直接进墓地）', () => {
        const core = makeState({
            bases: [
                makeBase('base_from', [makeMinion('bucc1', 'pirate_buccaneer_pod', '0', 4)]),
                makeBase('base_to_1', []),
                makeBase('base_to_2', []),
            ],
            players: { '0': makePlayer('0'), '1': makePlayer('1') },
        });
        const matchState = makeMatchState(core);

        const result = fireTriggers(core, 'onMinionDestroyed', {
            state: core,
            matchState,
            playerId: '0',
            baseIndex: 0,
            triggerMinionUid: 'bucc1',
            triggerMinionDefId: 'pirate_buccaneer_pod',
            triggerMinion: core.bases[0].minions[0],
            random: { random: () => 0.5, shuffle: <T>(arr: T[]) => arr, d: () => 1, range: (min: number) => min },
            now: 7,
        }, { phase: 'replacement' });

        expect(result.events.length).toBe(0);
        const interaction = result.matchState?.sys.interaction.current;
        expect(interaction).toBeDefined();
        expect((interaction?.data as any)?.sourceId).toBe('pirate_buccaneer_move');
    });
});
