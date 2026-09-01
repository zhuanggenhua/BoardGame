/**
 * 圣骑士技能定义测试
 *
 * 覆盖范围：
 * 1. 基础技能定义完整性
 * 2. 升级技能定义完整性
 * 3. 技能触发条件验证
 * 4. 技能效果验证
 */

import { describe, it, expect } from 'vitest';
import {
    PALADIN_ABILITIES,
    RIGHTEOUS_COMBAT_2,
    RIGHTEOUS_COMBAT_3,
    BLESSING_OF_MIGHT_2,
    VENGEANCE_2,
    RIGHTEOUS_PRAYER_2,
    HOLY_STRIKE_2,
    HOLY_DEFENSE_2,
    HOLY_DEFENSE_3,
} from '../heroes/paladin/abilities';
import { TOKEN_IDS, PALADIN_DICE_FACE_IDS as FACES } from '../domain/ids';

describe('圣骑士技能定义', () => {
    describe('基础技能', () => {
        it('应有 8 个基础技能', () => {
            expect(PALADIN_ABILITIES).toHaveLength(8);
        });

        it('技能 ID 唯一', () => {
            const ids = PALADIN_ABILITIES.map(a => a.id);
            expect(new Set(ids).size).toBe(ids.length);
        });

        it('正义冲击 - 3 Sword + 2 Helm 触发', () => {
            const ability = PALADIN_ABILITIES.find(a => a.id === 'righteous-combat');
            expect(ability).toBeDefined();
            expect(ability!.type).toBe('offensive');
            expect(ability!.trigger).toEqual({
                type: 'diceSet',
                faces: { [FACES.SWORD]: 3, [FACES.HELM]: 2 },
            });
            // 应有 2 个效果：伤害 + rollDie
            expect(ability!.effects).toHaveLength(2);
            expect(ability!.effects![0].action.type).toBe('damage');
            expect(ability!.effects![0].action.value).toBe(5);
            expect(ability!.effects![1].action.type).toBe('rollDie');
        });

        it('神力信徒 - 3 Sword + 1 Pray 触发，不可防御', () => {
            const ability = PALADIN_ABILITIES.find(a => a.id === 'blessing-of-might');
            expect(ability).toBeDefined();
            expect(ability!.trigger).toEqual({
                type: 'diceSet',
                faces: { [FACES.SWORD]: 3, [FACES.PRAY]: 1 },
            });
            // 效果：3 伤害(不可防御) + 暴击 + 精准
            expect(ability!.effects).toHaveLength(3);
            expect(ability!.effects![0].action.tags).toContain('unblockable');
            expect(ability!.effects![1].action.tokenId).toBe(TOKEN_IDS.CRIT);
            expect(ability!.effects![2].action.tokenId).toBe(TOKEN_IDS.ACCURACY);
        });

        it('神圣冲击 - 小顺/大顺变体', () => {
            const ability = PALADIN_ABILITIES.find(a => a.id === 'holy-strike');
            expect(ability).toBeDefined();
            expect(ability!.variants).toHaveLength(2);
            // 小顺变体
            expect(ability!.variants![0].trigger.type).toBe('smallStraight');
            expect(ability!.variants![0].effects).toHaveLength(2); // heal + damage
            expect(ability!.variants![0].effects[0].action.value).toBe(1);
            expect(ability!.variants![0].effects[1].action.value).toBe(6);
            // 大顺变体
            expect(ability!.variants![1].trigger.type).toBe('largeStraight');
            expect(ability!.variants![1].effects).toHaveLength(2);
            expect(ability!.variants![1].effects[0].action.value).toBe(2);
            expect(ability!.variants![1].effects[1].action.value).toBe(8);
        });

        it('圣光 - 2 Heart 触发', () => {
            const ability = PALADIN_ABILITIES.find(a => a.id === 'holy-light');
            expect(ability).toBeDefined();
            expect(ability!.trigger).toEqual({
                type: 'diceSet',
                faces: { [FACES.HEART]: 2 },
            });
            expect(ability!.effects).toHaveLength(2); // heal + custom roll
        });

        it('复仇 - 3 Helm + 1 Pray 触发', () => {
            const ability = PALADIN_ABILITIES.find(a => a.id === 'vengeance');
            expect(ability).toBeDefined();
            expect(ability!.trigger).toEqual({
                type: 'diceSet',
                faces: { [FACES.HELM]: 3, [FACES.PRAY]: 1 },
            });
            // 效果：获得神罚 + 获得 CP
            expect(ability!.effects).toHaveLength(2);
            expect(ability!.effects![0].action.tokenId).toBe(TOKEN_IDS.RETRIBUTION);
            expect(ability!.effects![1].action.params.amount).toBe(3);
        });

        it('正义祈祷 - 4 Pray 触发', () => {
            const ability = PALADIN_ABILITIES.find(a => a.id === 'righteous-prayer');
            expect(ability).toBeDefined();
            expect(ability!.trigger).toEqual({
                type: 'diceSet',
                faces: { [FACES.PRAY]: 4 },
            });
            // 效果：8 伤害 + 暴击 + 2 CP
            expect(ability!.effects).toHaveLength(3);
            expect(ability!.effects![0].action.value).toBe(8);
            expect(ability!.effects![2].action.type).toBe('custom');
            expect(ability!.effects![2].action.customActionId).toBe('gain-cp');
            expect(ability!.effects![2].action.params.amount).toBe(2);
        });

        it('神圣防御 - 防御技能，3 骰', () => {
            const ability = PALADIN_ABILITIES.find(a => a.id === 'holy-defense');
            expect(ability).toBeDefined();
            expect(ability!.type).toBe('defensive');
            expect(ability!.trigger).toEqual({
                type: 'phase',
                phaseId: 'defensiveRoll',
                diceCount: 3,
            });
        });

        it('坚毅信念 - 终极技能，5 Pray 触发', () => {
            const ability = PALADIN_ABILITIES.find(a => a.id === 'unyielding-faith');
            expect(ability).toBeDefined();
            expect(ability!.tags).toContain('ultimate');
            expect(ability!.trigger).toEqual({
                type: 'diceSet',
                faces: { [FACES.PRAY]: 5 },
            });
            // 效果：治疗 5 + 10 伤害(不可防御) + 神圣祝福
            expect(ability!.effects).toHaveLength(3);
            expect(ability!.effects![0].action.value).toBe(5); // heal
            expect(ability!.effects![1].action.value).toBe(10); // damage
            expect(ability!.effects![1].action.tags).toContain('unblockable');
            expect(ability!.effects![2].action.tokenId).toBe(TOKEN_IDS.BLESSING_OF_DIVINITY);
        });
    });

    describe('升级技能', () => {
        it('正义冲击 II - 仅保留主技能，不应混入 III 级执着变体', () => {
            expect(RIGHTEOUS_COMBAT_2.id).toBe('righteous-combat');
            expect(RIGHTEOUS_COMBAT_2.variants).toBeUndefined();
            expect(RIGHTEOUS_COMBAT_2.trigger).toEqual({
                type: 'diceSet',
                faces: { [FACES.SWORD]: 3, [FACES.HELM]: 2 },
            });
            expect(RIGHTEOUS_COMBAT_2.effects).toHaveLength(2);
            expect(RIGHTEOUS_COMBAT_2.effects![0].action.value).toBe(5);
            expect(RIGHTEOUS_COMBAT_2.effects![1].action.type).toBe('rollDie');
            expect(RIGHTEOUS_COMBAT_2.effects![1].action.diceCount).toBe(3);
        });

        it('正义冲击 III - 执着变体保留在 III 级', () => {
            expect(RIGHTEOUS_COMBAT_3.id).toBe('righteous-combat');
            expect(RIGHTEOUS_COMBAT_3.variants).toHaveLength(2);
            const tenacity = RIGHTEOUS_COMBAT_3.variants![0];
            expect(tenacity.trigger).toEqual({
                type: 'diceSet',
                faces: { [FACES.SWORD]: 2, [FACES.HELM]: 1 },
            });
            const main = RIGHTEOUS_COMBAT_3.variants![1];
            expect(main.trigger).toEqual({
                type: 'diceSet',
                faces: { [FACES.SWORD]: 3, [FACES.HELM]: 2 },
            });
            expect(main.effects[0].action.value).toBe(6);
        });

        it('神力信徒 II - 新增进攻姿态变体', () => {
            expect(BLESSING_OF_MIGHT_2.variants).toHaveLength(2);
            // 进攻姿态: 2 Sword + 1 Pray
            const stance = BLESSING_OF_MIGHT_2.variants![0];
            expect(stance.trigger).toEqual({
                type: 'diceSet',
                faces: { [FACES.SWORD]: 2, [FACES.PRAY]: 1 },
            });
            // 应有选择效果（暴击或精准）
            const choiceEffect = stance.effects.find(e => e.action.type === 'choice');
            expect(choiceEffect).toBeDefined();
        });

        it('神圣冲击 II - 伤害提升', () => {
            expect(HOLY_STRIKE_2.variants).toHaveLength(2);
            // 小顺伤害 7 > I 级 6
            expect(HOLY_STRIKE_2.variants![0].effects[1].action.value).toBe(7);
            // 大顺伤害 9 > I 级 8
            expect(HOLY_STRIKE_2.variants![1].effects[1].action.value).toBe(9);
        });

        it('反击 II - 新增复仇变体 + 玩家选择交互', () => {
            expect(VENGEANCE_2.variants).toHaveLength(2);
            // 混合变体: 4 种不同符号
            expect(VENGEANCE_2.variants![0].trigger.type).toBe('allSymbolsPresent');
            // 主变体: 3 Helm + 1 Pray，使用 custom action 生成玩家选择交互
            expect(VENGEANCE_2.variants![1].trigger).toEqual({
                type: 'diceSet',
                faces: { [FACES.HELM]: 3, [FACES.PRAY]: 1 },
            });
            // 第一个效果应该是 custom action（玩家选择）
            expect(VENGEANCE_2.variants![1].effects[0].action.type).toBe('custom');
            expect(VENGEANCE_2.variants![1].effects[0].action.customActionId).toBe('paladin-vengeance-select-player');
        });

        it('正义祈祷 II - 新增繁盛变体', () => {
            expect(RIGHTEOUS_PRAYER_2.variants).toHaveLength(2);
            // 繁盛: 3 Pray
            expect(RIGHTEOUS_PRAYER_2.variants![0].trigger).toEqual({
                type: 'diceSet',
                faces: { [FACES.PRAY]: 3 },
            });
        });

        it('神圣防御 II - 骰子数量提升到 4', () => {
            expect(HOLY_DEFENSE_2.trigger).toEqual({
                type: 'phase',
                phaseId: 'defensiveRoll',
                diceCount: 4,
            });
        });

        it('神圣防御 III - 骰子数量保持 4', () => {
            expect(HOLY_DEFENSE_3.trigger).toEqual({
                type: 'phase',
                phaseId: 'defensiveRoll',
                diceCount: 4,
            });
        });

        it('圣光术基础版应掷 2 颗奖励骰', () => {
            const holyLight = PALADIN_ABILITIES.find(ability => ability.id === 'holy-light');
            const bonusRoll = holyLight?.effects.find(effect => effect.action.type === 'rollDie');
            expect(bonusRoll?.action).toMatchObject({
                type: 'rollDie',
                diceCount: 2,
            });
        });
    });
});
