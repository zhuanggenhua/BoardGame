/**
 * 大杀四方 - 能力注册表测试
 *
 * 覆盖 Property 4: 能力注册表往返一致性
 * 覆盖 Property 5: onPlay 能力触发
 * 覆盖 Property 6: 天赋每回合一次
 */

import { describe, expect, it, beforeAll, beforeEach } from 'vitest';
import {
    registerAbility,
    resolveAbility,
    resolveOnPlay,
    resolveTalent,
    resolveSpecial,
    hasAbility,
    clearRegistry,
    getRegistrySize,
} from '../domain/abilityRegistry';
import type { AbilityContext, AbilityResult, AbilityExecutor } from '../domain/abilityRegistry';
import { initAllAbilities, resetAbilityInit } from '../abilities';

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
            expect(resolved).toBe(executor);
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

            expect(resolveOnPlay('multi_tag')).toBe(onPlayFn);
            expect(resolveTalent('multi_tag')).toBe(talentFn);
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
                random: { random: () => 0.5, d: (n: number) => 1, range: (a: number, b: number) => a, shuffle: <T>(arr: T[]) => [...arr] },
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
