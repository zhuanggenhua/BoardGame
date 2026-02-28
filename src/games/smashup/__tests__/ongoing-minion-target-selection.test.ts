/**
 * 测试 ongoing-minion 目标选择逻辑
 * 
 * 问题：月之触等 ongoingTarget='minion' 的行动卡无法选择随从
 * 根因：deployableBaseIndices 计算时没有检查基地上是否有随从
 * 修复：在 ongoing-minion 模式下，跳过没有随从的基地
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { clearRegistry } from '../domain/abilityRegistry';
import { clearBaseAbilityRegistry } from '../domain/baseAbilities';
import { clearOngoingEffectRegistry } from '../domain/ongoingEffects';
import { clearPowerModifierRegistry } from '../domain/ongoingModifiers';
import { clearInteractionHandlers } from '../domain/abilityInteractionHandlers';
import { initAllAbilities, resetAbilityInit } from '../abilities';
import type { SmashUpCore, CardInstance } from '../domain/types';
import { SU_COMMANDS } from '../domain/types';
import { validate } from '../domain/commands';
import { makePlayer, makeState, makeCard, makeMinion } from './helpers';
import type { MatchState } from '../../../engine/types';

beforeEach(() => {
    clearRegistry();
    clearBaseAbilityRegistry();
    clearOngoingEffectRegistry();
    clearPowerModifierRegistry();
    clearInteractionHandlers();
    resetAbilityInit();
    initAllAbilities();
});

afterEach(() => {
    clearRegistry();
    clearBaseAbilityRegistry();
    clearOngoingEffectRegistry();
    clearPowerModifierRegistry();
    clearInteractionHandlers();
    resetAbilityInit();
});

function makeMatchState(core: SmashUpCore): MatchState<SmashUpCore> {
    return {
        core,
        sys: {
            interaction: { queue: [], current: null, isBlocked: false },
            flow: { phase: core.phase, currentPlayerId: core.currentPlayerId },
            log: { entries: [] },
            eventStream: { entries: [] },
            responseWindow: { queue: [], current: null },
            gameover: null,
            phase: core.phase, // validate 函数从这里读取
        },
    };
}

describe('ongoing-minion 目标选择', () => {
    it('月之触可以附着到有随从的基地上的随从', () => {
        // 场景：base0 有随从，base1 没有随从
        const core = makeState({
            phase: 'playCards',
            currentPlayerId: '0',
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('c1', 'werewolf_moontouched', 'action', '0')],
                    actionsPlayed: 0,
                    actionLimit: 1,
                }),
                '1': makePlayer('1', {}),
            },
            bases: [
                {
                    defId: 'base_test_1',
                    minions: [makeMinion('m1', 'werewolf_howler', '0', 2)],
                    ongoingActions: [],
                },
                {
                    defId: 'base_test_2',
                    minions: [], // 没有随从
                    ongoingActions: [],
                },
            ],
        });

        const state = makeMatchState(core);

        // 验证：可以附着到 base0 的随从上
        const result1 = validate(state, {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: {
                cardUid: 'c1',
                targetBaseIndex: 0,
                targetMinionUid: 'm1',
            },
        } as any);
        expect(result1.valid).toBe(true);

        // 验证：不能附着到 base1（没有随从）
        const result2 = validate(state, {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: {
                cardUid: 'c1',
                targetBaseIndex: 1,
                targetMinionUid: 'nonexistent',
            },
        } as any);
        expect(result2.valid).toBe(false);
        expect(result2.error).toContain('基地上没有该随从');
    });

    it('月之触不能附着到基地上（必须选择随从）', () => {
        const core = makeState({
            phase: 'playCards',
            currentPlayerId: '0',
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('c1', 'werewolf_moontouched', 'action', '0')],
                    actionsPlayed: 0,
                    actionLimit: 1,
                }),
                '1': makePlayer('1', {}),
            },
            bases: [
                {
                    defId: 'base_test_1',
                    minions: [makeMinion('m1', 'werewolf_howler', '0', 2)],
                    ongoingActions: [],
                },
            ],
        });

        const state = makeMatchState(core);

        // 验证：不提供 targetMinionUid 时验证失败
        const result = validate(state, {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: {
                cardUid: 'c1',
                targetBaseIndex: 0,
                // 缺少 targetMinionUid
            },
        } as any);
        expect(result.valid).toBe(false);
        expect(result.error).toContain('需要选择目标随从');
    });

    it('狼群领袖可以附着到有随从的基地上的随从', () => {
        // 狼群领袖也是 ongoingTarget='minion'
        const core = makeState({
            phase: 'playCards',
            currentPlayerId: '0',
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('c1', 'werewolf_leader_of_the_pack', 'action', '0')],
                    actionsPlayed: 0,
                    actionLimit: 1,
                }),
                '1': makePlayer('1', {}),
            },
            bases: [
                {
                    defId: 'base_test_1',
                    minions: [makeMinion('m1', 'werewolf_howler', '0', 2)],
                    ongoingActions: [],
                },
            ],
        });

        const state = makeMatchState(core);

        const result = validate(state, {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: {
                cardUid: 'c1',
                targetBaseIndex: 0,
                targetMinionUid: 'm1',
            },
        } as any);
        expect(result.valid).toBe(true);
    });

    it('势不可挡可以附着到有随从的基地上的随从', () => {
        // 势不可挡也是 ongoingTarget='minion'
        const core = makeState({
            phase: 'playCards',
            currentPlayerId: '0',
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('c1', 'werewolf_unstoppable', 'action', '0')],
                    actionsPlayed: 0,
                    actionLimit: 1,
                }),
                '1': makePlayer('1', {}),
            },
            bases: [
                {
                    defId: 'base_test_1',
                    minions: [makeMinion('m1', 'werewolf_howler', '0', 2)],
                    ongoingActions: [],
                },
            ],
        });

        const state = makeMatchState(core);

        const result = validate(state, {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: {
                cardUid: 'c1',
                targetBaseIndex: 0,
                targetMinionUid: 'm1',
            },
        } as any);
        expect(result.valid).toBe(true);
    });

    it('月之触可以附着到有 play_action 限制的基地上的随从', () => {
        // 场景：恐怖眺望台（Dread Lookout）禁止打出行动卡
        // 但 ongoing-minion 模式下，行动卡是附着到随从上的，不受此限制
        const core = makeState({
            phase: 'playCards',
            currentPlayerId: '0',
            players: {
                '0': makePlayer('0', {
                    hand: [makeCard('c1', 'werewolf_moontouched', 'action', '0')],
                    actionsPlayed: 0,
                    actionLimit: 1,
                }),
                '1': makePlayer('1', {}),
            },
            bases: [
                {
                    defId: 'base_dread_lookout', // 恐怖眺望台：禁止打出行动卡
                    minions: [makeMinion('m1', 'werewolf_howler', '0', 2)],
                    ongoingActions: [],
                },
            ],
        });

        const state = makeMatchState(core);

        // 验证：可以附着到随从上（不受基地 play_action 限制）
        const result = validate(state, {
            type: SU_COMMANDS.PLAY_ACTION,
            playerId: '0',
            payload: {
                cardUid: 'c1',
                targetBaseIndex: 0,
                targetMinionUid: 'm1',
            },
        } as any);
        expect(result.valid).toBe(true);
    });
});
