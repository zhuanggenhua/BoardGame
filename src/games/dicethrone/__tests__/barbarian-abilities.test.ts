/**
 * 狂战士技能定义测试
 *
 * 覆盖范围：
 * 1. 基础技能定义完整性
 * 2. 升级技能定义完整性
 * 3. 技能触发条件验证
 * 4. 技能效果验证（伤害/治疗/状态）
 */

import { describe, it, expect } from 'vitest';
import {
    BARBARIAN_ABILITIES,
    SLAP_2,
    SLAP_3,
    ALL_OUT_STRIKE_2,
    ALL_OUT_STRIKE_3,
    POWERFUL_STRIKE_2,
    VIOLENT_ASSAULT_2,
    STEADFAST_2,
    SUPPRESS_2,
    RECKLESS_STRIKE_2,
    THICK_SKIN_2,
} from '../heroes/barbarian/abilities';
import { BARBARIAN_DICE_FACE_IDS as FACES, STATUS_IDS } from '../domain/ids';

describe('狂战士技能定义', () => {
    describe('基础技能', () => {
        it('应有 8 个基础技能', () => {
            expect(BARBARIAN_ABILITIES).toHaveLength(8);
        });

        it('技能 ID 唯一', () => {
            const ids = BARBARIAN_ABILITIES.map(a => a.id);
            expect(new Set(ids).size).toBe(ids.length);
        });

        it('巴掌 - 3/4/5 Sword 变体', () => {
            const ability = BARBARIAN_ABILITIES.find(a => a.id === 'slap');
            expect(ability).toBeDefined();
            expect(ability!.type).toBe('offensive');
            expect(ability!.variants).toHaveLength(3);
            // 3 Sword = 4 伤害
            expect(ability!.variants![0].trigger).toEqual({
                type: 'diceSet',
                faces: { [FACES.SWORD]: 3 },
            });
            expect(ability!.variants![0].effects[0].action.value).toBe(4);
            // 4 Sword = 6 伤害
            expect(ability!.variants![1].effects[0].action.value).toBe(6);
            // 5 Sword = 8 伤害
            expect(ability!.variants![2].effects[0].action.value).toBe(8);
        });

        it('全力一击 - 2 Sword + 2 Strength，不可防御', () => {
            const ability = BARBARIAN_ABILITIES.find(a => a.id === 'all-out-strike');
            expect(ability).toBeDefined();
            expect(ability!.trigger).toEqual({
                type: 'diceSet',
                faces: { [FACES.SWORD]: 2, [FACES.STRENGTH]: 2 },
            });
            expect(ability!.tags).toContain('unblockable');
            expect(ability!.effects![0].action.value).toBe(4);
        });

        it('强力打击 - 小顺触发', () => {
            const ability = BARBARIAN_ABILITIES.find(a => a.id === 'powerful-strike');
            expect(ability).toBeDefined();
            expect(ability!.trigger!.type).toBe('smallStraight');
            expect(ability!.effects![0].action.value).toBe(9);
        });

        it('暴力突袭 - 4 Strength，施加眩晕', () => {
            const ability = BARBARIAN_ABILITIES.find(a => a.id === 'violent-assault');
            expect(ability).toBeDefined();
            expect(ability!.trigger).toEqual({
                type: 'diceSet',
                faces: { [FACES.STRENGTH]: 4 },
            });
            expect(ability!.tags).toContain('unblockable');
            // 第一个效果：施加眩晕
            expect(ability!.effects![0].action.type).toBe('grantStatus');
            expect(ability!.effects![0].action.statusId).toBe(STATUS_IDS.STUN);
            // 第二个效果：5 伤害
            expect(ability!.effects![1].action.value).toBe(5);
        });

        it('坚韧 - 3/4/5 Heart 变体，治疗', () => {
            const ability = BARBARIAN_ABILITIES.find(a => a.id === 'steadfast');
            expect(ability).toBeDefined();
            expect(ability!.variants).toHaveLength(3);
            // 3 Heart = 治疗 4
            expect(ability!.variants![0].effects[0].action.type).toBe('heal');
            expect(ability!.variants![0].effects[0].action.value).toBe(4);
            // 4 Heart = 治疗 5
            expect(ability!.variants![1].effects[0].action.value).toBe(5);
            // 5 Heart = 治疗 6
            expect(ability!.variants![2].effects[0].action.value).toBe(6);
        });

        it('压制 - 2 Sword + 2 Strength，自定义投骰', () => {
            const ability = BARBARIAN_ABILITIES.find(a => a.id === 'suppress');
            expect(ability).toBeDefined();
            expect(ability!.effects![0].action.type).toBe('custom');
            expect(ability!.effects![0].action.customActionId).toBe('barbarian-suppress-roll');
        });

        it('鲁莽打击 - 终极技能，大顺触发', () => {
            const ability = BARBARIAN_ABILITIES.find(a => a.id === 'reckless-strike');
            expect(ability).toBeDefined();
            expect(ability!.tags).toContain('ultimate');
            expect(ability!.trigger!.type).toBe('largeStraight');
            // 15 伤害 + 自伤 4
            expect(ability!.effects![0].action.value).toBe(15);
            expect(ability!.effects![1].action.type).toBe('damage');
            expect(ability!.effects![1].action.target).toBe('self');
            expect(ability!.effects![1].action.value).toBe(4);
            expect(ability!.effects![1].timing).toBe('postDamage');
            expect(ability!.effects![1].condition).toEqual({ type: 'onHit' });
        });

        it('厚皮 - 防御技能，3 骰', () => {
            const ability = BARBARIAN_ABILITIES.find(a => a.id === 'thick-skin');
            expect(ability).toBeDefined();
            expect(ability!.type).toBe('defensive');
            expect(ability!.trigger).toEqual({
                type: 'phase',
                phaseId: 'defensiveRoll',
                diceCount: 3,
            });
        });
    });

    describe('升级技能', () => {
        it('巴掌 II - 伤害提升，4/5 Sword 不可防御', () => {
            expect(SLAP_2.variants).toHaveLength(3);
            // 3 Sword = 5 伤害（I 级 4）
            expect(SLAP_2.variants![0].effects[0].action.value).toBe(5);
            // 4 Sword = 7 伤害，不可防御
            expect(SLAP_2.variants![1].effects[0].action.value).toBe(7);
            expect(SLAP_2.variants![1].tags).toContain('unblockable');
            // 5 Sword = 9 伤害，不可防御
            expect(SLAP_2.variants![2].effects[0].action.value).toBe(9);
            expect(SLAP_2.variants![2].tags).toContain('unblockable');
        });

        it('巴掌 III - 伤害进一步提升', () => {
            expect(SLAP_3.variants).toHaveLength(3);
            expect(SLAP_3.variants![0].effects[0].action.value).toBe(6);
            expect(SLAP_3.variants![1].effects[0].action.value).toBe(8);
            expect(SLAP_3.variants![2].effects[0].action.value).toBe(10);
        });

        it('全力一击 II - 伤害提升到 5', () => {
            expect(ALL_OUT_STRIKE_2.effects![0].action.value).toBe(5);
            expect(ALL_OUT_STRIKE_2.tags).toContain('unblockable');
        });

        it('全力一击 III - 伤害提升到 6', () => {
            expect(ALL_OUT_STRIKE_3.effects![0].action.value).toBe(6);
        });

        it('强力打击 II - 不可防御', () => {
            expect(POWERFUL_STRIKE_2.trigger!.type).toBe('smallStraight');
            expect(POWERFUL_STRIKE_2.effects![0].action.value).toBe(8);
            expect(POWERFUL_STRIKE_2.tags).toContain('unblockable');
        });

        it('暴力突袭 II - 新增碾压变体', () => {
            expect(VIOLENT_ASSAULT_2.variants).toHaveLength(2);
            // 碾压: 3 Strength → 脑震荡 + 2 伤害
            const crush = VIOLENT_ASSAULT_2.variants![0];
            expect(crush.trigger).toEqual({
                type: 'diceSet',
                faces: { [FACES.STRENGTH]: 3 },
            });
            expect(crush.effects[0].action.statusId).toBe(STATUS_IDS.CONCUSSION);
            // 震荡: 4 Strength → 眩晕 + 7 伤害
            const shake = VIOLENT_ASSAULT_2.variants![1];
            expect(shake.effects[0].action.statusId).toBe(STATUS_IDS.STUN);
            expect(shake.effects[1].action.value).toBe(7);
        });

        it('坚韧 II - 治疗提升 + 移除状态', () => {
            expect(STEADFAST_2.variants).toHaveLength(3);
            // 3 Heart = 治疗 5 + 移除状态
            expect(STEADFAST_2.variants![0].effects[0].action.value).toBe(5);
            expect(STEADFAST_2.variants![0].effects).toHaveLength(2);
            expect(STEADFAST_2.variants![0].effects[1].action.customActionId).toBe('remove-status-self');
        });

        it('压制 II - 新增战吼变体', () => {
            expect(SUPPRESS_2.variants).toHaveLength(2);
            // 战吼: 2 Sword + 2 Heart → 治疗 2 + 2 伤害(不可防御)
            const battleCry = SUPPRESS_2.variants![0];
            expect(battleCry.trigger).toEqual({
                type: 'diceSet',
                faces: { [FACES.SWORD]: 2, [FACES.HEART]: 2 },
            });
            expect(battleCry.tags).toContain('unblockable');
        });

        it('鲁莽打击 II - 伤害提升到 20，自伤 5', () => {
            expect(RECKLESS_STRIKE_2.effects![0].action.value).toBe(20);
            expect(RECKLESS_STRIKE_2.effects![1].action.value).toBe(5);
        });

        it('厚皮 II - 骰子数量提升到 4', () => {
            expect(THICK_SKIN_2.trigger).toEqual({
                type: 'phase',
                phaseId: 'defensiveRoll',
                diceCount: 4,
            });
        });
    });
});
