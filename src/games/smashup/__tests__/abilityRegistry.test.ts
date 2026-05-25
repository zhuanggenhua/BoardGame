/**
 * 大杀四方 - 能力注册表测试
 *
 * 覆盖 Property 4: 能力注册表往返一致性
 * 覆盖 Property 5: onPlay 能力触发
 * 覆盖 Property 6: 天赋每回合一次
 */

import { describe, expect, it, beforeEach } from 'vitest';
import {
    requireAbilityDefinition,
    requireOnPlay,
    requireSpecial,
    registerAbility,
    registerAbilityProgram,
    registerSimpleAbility,
    resolveAbility,
    resolveAbilityDefinition,
    resolveOnPlay,
    resolveAbilityProgram,
    resolveTalent,
    resolveSpecial,
    hasAbility,
    clearRegistry,
    getRegistrySize,
} from '../domain/abilityRegistry';
import type { AbilityExecutor } from '../domain/abilityRegistry';
import { initAllAbilities, resetAbilityInit } from '../abilities';
import { appendResolvedActionAbility } from '../domain/externalActionPlay';
import { makeMatchState, makeState } from './helpers';
import { SU_EVENTS } from '../domain/types';
import { createEffectProgram } from '../domain/abilityRuntime';

describe('能力注册表', () => {
    beforeEach(() => {
        clearRegistry();
        resetAbilityInit();
    });

    // Property 4: 能力注册表往返一致性
    describe('Property 4: 注册与解析一致性', () => {
        it('注册后可通过相同 defId + tag 解析', () => {
            const executor: AbilityExecutor = () => ({ events: [] });
            registerAbility('test_card', 'onPlay', executor);

            const resolved = resolveAbility('test_card', 'onPlay');
            expect(resolved).toBeDefined();
        });

        it('未注册的 defId 解析返回 undefined', () => {
            expect(resolveAbility('nonexistent', 'onPlay')).toBeUndefined();
            expect(resolveOnPlay('nonexistent')).toBeUndefined();
            expect(resolveTalent('nonexistent')).toBeUndefined();
            expect(resolveSpecial('nonexistent')).toBeUndefined();
        });

        it('同一 defId 可注册多个 tag', () => {
            const onPlayFn: AbilityExecutor = () => ({ events: [] });
            const talentFn: AbilityExecutor = () => ({ events: [] });

            registerAbility('multi_tag', 'onPlay', onPlayFn);
            registerAbility('multi_tag', 'talent', talentFn);

            expect(resolveOnPlay('multi_tag')).toBeDefined();
            expect(resolveTalent('multi_tag')).toBeDefined();
        });

        it('hasAbility 正确检查', () => {
            registerAbility('has_test', 'onPlay', () => ({ events: [] }));

            expect(hasAbility('has_test', 'onPlay')).toBe(true);
            expect(hasAbility('has_test', 'talent')).toBe(false);
            expect(hasAbility('nonexistent', 'onPlay')).toBe(false);
        });

        it('clearRegistry 清空所有注册', () => {
            registerAbility('a', 'onPlay', () => ({ events: [] }));
            registerAbility('b', 'talent', () => ({ events: [] }));
            expect(getRegistrySize()).toBe(2);

            clearRegistry();
            expect(getRegistrySize()).toBe(0);
            expect(resolveOnPlay('a')).toBeUndefined();
        });

        it('快捷方法与 resolveAbility 一致', () => {
            const fn: AbilityExecutor = () => ({ events: [] });
            registerAbility('shortcut_test', 'onPlay', fn);
            registerAbility('shortcut_test', 'talent', fn);
            registerAbility('shortcut_test', 'special', fn);

            expect(resolveOnPlay('shortcut_test')).toBe(resolveAbility('shortcut_test', 'onPlay'));
            expect(resolveTalent('shortcut_test')).toBe(resolveAbility('shortcut_test', 'talent'));
            expect(resolveSpecial('shortcut_test')).toBe(resolveAbility('shortcut_test', 'special'));
        });

        it('program 注册成为唯一真相源，并可经统一解释器执行', () => {
            const program = createEffectProgram((ctx: any) => ({
                events: [{
                    type: 'test_program_event',
                    payload: { defId: ctx.defId, playerId: ctx.playerId },
                    timestamp: ctx.now,
                }] as any[],
            }));
            registerAbilityProgram('program_card', 'onPlay', { program });

            expect(resolveAbilityProgram('program_card', 'onPlay')).toBe(program);
            expect(resolveAbilityDefinition('program_card', 'onPlay')?.program).toBe(program);

            const resolved = resolveOnPlay('program_card');
            const result = resolved!({
                state: {} as any,
                matchState: {} as any,
                playerId: '0',
                cardUid: 'card-1',
                defId: 'program_card',
                baseIndex: 0,
                random: { random: () => 0.5, d: (_n: number) => 1, range: (a: number, _b: number) => a, shuffle: <T>(arr: T[]) => [...arr] },
                now: 42,
            });

            expect(result.events).toHaveLength(1);
            expect((result.events[0] as any).payload).toMatchObject({ defId: 'program_card', playerId: '0' });
        });

        it('simple ability 注册会显式编译为 effect program', () => {
            const executor: AbilityExecutor = (ctx) => ({
                events: [{
                    type: 'test_simple_event',
                    payload: { defId: ctx.defId, playerId: ctx.playerId },
                    timestamp: ctx.now,
                }] as any[],
            });
            registerSimpleAbility('simple_card', 'onPlay', executor);

            const definition = requireAbilityDefinition('simple_card', 'onPlay');
            expect(resolveAbilityProgram('simple_card', 'onPlay')).toBe(definition.program);

            const result = definition.execute({
                state: {} as any,
                matchState: {} as any,
                playerId: '0',
                cardUid: 'card-1',
                defId: 'simple_card',
                baseIndex: 0,
                random: { random: () => 0.5, d: (_n: number) => 1, range: (a: number, _b: number) => a, shuffle: <T>(arr: T[]) => [...arr] },
                now: 99,
            });

            expect(result.events).toHaveLength(1);
            expect((result.events[0] as any).payload).toMatchObject({ defId: 'simple_card', playerId: '0' });
        });

        it('require 系列在缺声明时直接报错', () => {
            expect(() => requireAbilityDefinition('missing_card', 'onPlay', 'test')).toThrowError(
                /SmashUp ability 缺少声明: missing_card::onPlay \(test\)/,
            );
            expect(() => requireOnPlay('missing_card', 'test_onplay')).toThrowError(
                /SmashUp ability 缺少声明: missing_card::onPlay \(test_onplay\)/,
            );
            expect(() => requireSpecial('missing_card', 'test_special')).toThrowError(
                /SmashUp ability 缺少声明: missing_card::special \(test_special\)/,
            );
        });

        it('显式追加外部标准行动能力时缺声明直接报错', () => {
            const state = makeMatchState(makeState());
            expect(() => appendResolvedActionAbility({
                state,
                events: [{
                    type: SU_EVENTS.ACTION_PLAYED,
                    payload: { playerId: '0', cardUid: 'missing-action-1', defId: 'missing_action_def' },
                    timestamp: 100,
                } as any],
                playerId: '0',
                cardUid: 'missing-action-1',
                defId: 'missing_action_def',
                random: { random: () => 0.5, d: () => 1, range: (min: number) => min, shuffle: <T>(items: T[]) => [...items] },
                timestamp: 100,
                baseIndex: 0,
            })).toThrowError(/SmashUp ability 缺少声明: missing_action_def::onPlay \(externalActionPlay\.appendResolvedActionAbility\)/);
        });

        it('显式追加外部持续行动能力时，若没有 onPlay 则按 no-op 处理', () => {
            const state = makeMatchState(makeState());
            const events = [{
                type: SU_EVENTS.ACTION_PLAYED,
                payload: { playerId: '0', cardUid: 'rotary-1', defId: 'steampunk_rotary_slug_thrower' },
                timestamp: 100,
            }, {
                type: SU_EVENTS.ONGOING_ATTACHED,
                payload: {
                    cardUid: 'rotary-1',
                    defId: 'steampunk_rotary_slug_thrower',
                    ownerId: '0',
                    targetType: 'base',
                    targetBaseIndex: 0,
                },
                timestamp: 100,
            }] as any[];

            expect(() => appendResolvedActionAbility({
                state,
                events,
                playerId: '0',
                cardUid: 'rotary-1',
                defId: 'steampunk_rotary_slug_thrower',
                random: { random: () => 0.5, d: () => 1, range: (min: number) => min, shuffle: <T>(items: T[]) => [...items] },
                timestamp: 100,
                baseIndex: 0,
            })).not.toThrow();

            const result = appendResolvedActionAbility({
                state,
                events,
                playerId: '0',
                cardUid: 'rotary-1',
                defId: 'steampunk_rotary_slug_thrower',
                random: { random: () => 0.5, d: () => 1, range: (min: number) => min, shuffle: <T>(items: T[]) => [...items] },
                timestamp: 100,
                baseIndex: 0,
            });

            expect(result.state).toBe(state);
            expect(result.events).toHaveLength(2);
        });
    });

    // Property 5: onPlay 能力触发
    describe('Property 5: onPlay 能力触发', () => {
        it('注册的 onPlay 能力被正确调用', () => {
            let called = false;
            const executor: AbilityExecutor = (ctx) => {
                called = true;
                return { events: [{ type: 'test_event', payload: { defId: ctx.defId }, timestamp: ctx.now }] as any };
            };
            registerAbility('test_onplay', 'onPlay', executor);

            const resolved = resolveOnPlay('test_onplay');
            expect(resolved).toBeDefined();

            const result = resolved!({
                state: {} as any,
                playerId: '0',
                cardUid: 'c1',
                defId: 'test_onplay',
                baseIndex: 0,
                random: { random: () => 0.5, d: (_n: number) => 1, range: (a: number, _b: number) => a, shuffle: <T>(arr: T[]) => [...arr] },
                now: 1000,
            });

            expect(called).toBe(true);
            expect(result.events.length).toBe(1);
        });
    });

    // 全派系注册验证
    describe('全派系注册', () => {
        it('initAllAbilities 注册所有基础派系能力', () => {
            initAllAbilities();
            expect(getRegistrySize()).toBeGreaterThan(0);

            // 外星人
            expect(hasAbility('alien_supreme_overlord', 'onPlay')).toBe(true);
            expect(hasAbility('alien_collector', 'onPlay')).toBe(true);
            expect(hasAbility('alien_invader', 'onPlay')).toBe(true);

            // 海盗
            expect(hasAbility('pirate_saucy_wench', 'onPlay')).toBe(true);

            // 忍者
            expect(hasAbility('ninja_master', 'onPlay')).toBe(true);
            expect(hasAbility('ninja_tiger_assassin', 'onPlay')).toBe(true);

            // 恐龙
            expect(hasAbility('dino_laser_triceratops', 'onPlay')).toBe(true);

            // 机器人
            expect(hasAbility('robot_microbot_guard', 'onPlay')).toBe(true);
            expect(hasAbility('robot_microbot_fixer', 'onPlay')).toBe(true);
            expect(hasAbility('robot_hoverbot', 'onPlay')).toBe(true);

            // 巫师
            expect(hasAbility('wizard_chronomage', 'onPlay')).toBe(true);
            expect(hasAbility('wizard_enchantress', 'onPlay')).toBe(true);
            expect(hasAbility('wizard_mystic_studies', 'onPlay')).toBe(true);
            expect(hasAbility('wizard_summon', 'onPlay')).toBe(true);
            expect(hasAbility('wizard_time_loop', 'onPlay')).toBe(true);

            // 诡术师
            expect(hasAbility('trickster_gnome', 'onPlay')).toBe(true);
        });

        it('initAllAbilities 幂等', () => {
            initAllAbilities();
            const size1 = getRegistrySize();
            initAllAbilities();
            const size2 = getRegistrySize();
            expect(size1).toBe(size2);
        });
    });
});
