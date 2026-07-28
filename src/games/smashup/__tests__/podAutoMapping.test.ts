import { describe, expect, it, afterEach } from 'vitest';
import { initAllAbilities, resetAbilityInit } from '../abilities';
import { validatePodAbilities } from '../abilities/podAutoMapping';
import { registerAbility } from '../domain/abilityRegistry';

afterEach(() => {
    resetAbilityInit();
});

describe('POD 能力完整性校验', () => {
    it('完整初始化后不报告 POD 变体绑定缺口', () => {
        resetAbilityInit();
        initAllAbilities();

        expect(validatePodAbilities()).toEqual([]);
    });

    it('共享经典能力缺少 POD 运行时绑定时会返回缺口', () => {
        resetAbilityInit();
        registerAbility('alien_invader', 'onPlay', () => ({ events: [] }));

        expect(validatePodAbilities()).toEqual([
            'POD 派系 aliens_pod 的共享 ability 缺少实现：alien_invader_pod 未覆盖经典 alien_invader 的 能力标签 onPlay',
        ]);
    });
});
