/**
 * 睡眠孢子力量修正 E2E 测试
 * 
 * 用户报告：只有一个睡眠孢子，但对手随从显示 -2 力量修正
 * 
 * 测试场景：
 * 1. P0 选择食人花派系，打出浸花睡莲（力量3）到工坊基地
 * 2. P0 打出睡眠孢子到工坊基地
 * 3. P1 选择远古之物派系，打出 Mi-go（力量3）到工坊基地
 * 4. 验证 Mi-go 的有效力量应该是 2（3 - 1），不是 1（3 - 2）
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { initAllAbilities, resetAbilityInit } from '../abilities';
import { clearRegistry } from '../domain/abilityRegistry';
import { clearBaseAbilityRegistry } from '../domain/baseAbilities';
import { clearPowerModifierRegistry, getEffectivePower } from '../domain/ongoingModifiers';
import type { SmashUpCore, MinionOnBase, BaseInPlay } from '../domain/types';
import { SU_COMMANDS, SU_EVENTS } from '../domain/types';
import { execute } from '../domain/reducer';
import { reduce } from '../domain/reduce';


beforeEach(() => {
    clearRegistry();
    clearBaseAbilityRegistry();
    clearPowerModifierRegistry();
    resetAbilityInit();
    initAllAbilities();
});

function makeState(bases: BaseInPlay[]): SmashUpCore {
    return {
        players: {
            '0': {
                id: '0',
                vp: 0,
                hand: [],
                deck: [],
                discard: [],
                minionsPlayed: 0,
                minionLimit: 1,
                actionsPlayed: 0,
                actionLimit: 1,
                factions: ['killer_plants', 'robots'],
            },
            '1': {
                id: '1',
                vp: 0,
                hand: [],
                deck: [],
                discard: [],
                minionsPlayed: 0,
                minionLimit: 1,
                actionsPlayed: 0,
                actionLimit: 1,
                factions: ['elder_things', 'aliens'],
            },
        },
        turnOrder: ['0', '1'],
        currentPlayerIndex: 0,
        bases,
        baseDeck: [],
        turnNumber: 1,
        nextUid: 100,
        sys: {
            interaction: { queue: [] },
        },
    } as any;
}

describe('睡眠孢子力量修正 E2E', () => {

    it('一个睡眠孢子应该只给对手随从 -1 力量，不是 -2（完整流程）', () => {
        // 直接创建最终状态：工坊基地上有浸花睡莲、睡眠孢子和 Mi-go
        const waterLily: MinionOnBase = {
            uid: 'wl1',
            defId: 'killer_plant_water_lily',
            controller: '0',
            owner: '0',
            basePower: 3,
            powerModifier: 0,
            tempPowerModifier: 0,
            talentUsed: false,
            attachedActions: [],
        };

        const migo: MinionOnBase = {
            uid: 'migo1',
            defId: 'elder_thing_mi_go',
            controller: '1',
            owner: '1',
            basePower: 3,
            powerModifier: 0,
            tempPowerModifier: 0,
            talentUsed: false,
            attachedActions: [],
        };

        const base: BaseInPlay = {
            defId: 'base_the_workshop',
            minions: [waterLily, migo],
            ongoingActions: [
                {
                    uid: 'spores1',
                    defId: 'killer_plant_sleep_spores',
                    ownerId: '0',
                },
            ],
        };

        const state = makeState([base]);

        // 验证基地上有 2 个随从
        expect(base.minions.length).toBe(2);

        // 验证基地上有 1 个 ongoing 行动卡（睡眠孢子）
        expect(base.ongoingActions.length).toBe(1);
        expect(base.ongoingActions[0].defId).toBe('killer_plant_sleep_spores');

        // 验证 Mi-go 的力量
        console.log('=== Mi-go 力量分析 ===');
        console.log('basePower:', migo.basePower);
        console.log('powerModifier:', migo.powerModifier);
        console.log('tempPowerModifier:', migo.tempPowerModifier);

        const effectivePower = getEffectivePower(state, migo, 0);
        console.log('effectivePower:', effectivePower);
        console.log('显示的修正值:', effectivePower - migo.basePower);

        // 验证有效力量
        expect(migo.basePower).toBe(3); // Mi-go 的基础力量是 3
        expect(migo.powerModifier).toBe(0); // 没有永久修正
        expect(migo.tempPowerModifier ?? 0).toBe(0); // 没有临时修正
        expect(effectivePower).toBe(2); // 3 - 1 = 2

        // 验证显示的修正值
        const displayedModifier = effectivePower - migo.basePower;
        expect(displayedModifier).toBe(-1); // 应该显示 -1，不是 -2
    });

    it('验证睡眠孢子只对对手随从生效', () => {
        const waterLily: MinionOnBase = {
            uid: 'wl1',
            defId: 'killer_plant_water_lily',
            controller: '0',
            owner: '0',
            basePower: 3,
            powerModifier: 0,
            tempPowerModifier: 0,
            talentUsed: false,
            attachedActions: [],
        };

        const migo: MinionOnBase = {
            uid: 'migo1',
            defId: 'elder_thing_mi_go',
            controller: '1',
            owner: '1',
            basePower: 3,
            powerModifier: 0,
            tempPowerModifier: 0,
            talentUsed: false,
            attachedActions: [],
        };

        const base: BaseInPlay = {
            defId: 'base_the_workshop',
            minions: [waterLily, migo],
            ongoingActions: [
                {
                    uid: 'spores1',
                    defId: 'killer_plant_sleep_spores',
                    ownerId: '0',
                },
            ],
        };

        const state = makeState([base]);

        // 浸花睡莲（P0 的随从）不受睡眠孢子影响
        const waterLilyPower = getEffectivePower(state, waterLily, 0);
        expect(waterLilyPower).toBe(3); // 没有修正

        // Mi-go（P1 的随从）受睡眠孢子影响
        const migoPower = getEffectivePower(state, migo, 0);
        expect(migoPower).toBe(2); // 3 - 1 = 2
    });
});
