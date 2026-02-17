/**
 * 圣骑士 Token/状态效果 测试
 *
 * 覆盖范围：
 * 1. Token 定义完整性（crit、accuracy、protect、retribution、blessing_of_divinity）
 * 2. 初始状态验证
 * 3. 角色注册数据一致性
 * 4. 技能中 grantToken 引用一致性
 */

import { describe, it, expect } from 'vitest';
import { PALADIN_TOKENS, PALADIN_INITIAL_TOKENS } from '../heroes/paladin/tokens';
import { PALADIN_ABILITIES } from '../heroes/paladin/abilities';
import { getPaladinStartingDeck } from '../heroes/paladin/cards';
import { paladinDiceDefinition } from '../heroes/paladin/diceConfig';
import { CHARACTER_DATA_MAP } from '../domain/characters';
import { TOKEN_IDS, PALADIN_DICE_FACE_IDS } from '../domain/ids';

// ============================================================================
// 1. Token 定义完整性
// ============================================================================

describe('圣骑士 Token 定义', () => {
    it('应包含 Crit（暴击）— consumable, onOffensiveRollEnd, 伤害≥5时+4', () => {
        const crit = PALADIN_TOKENS.find(t => t.id === TOKEN_IDS.CRIT);
        expect(crit).toBeDefined();
        expect(crit!.category).toBe('consumable');
        expect(crit!.stackLimit).toBe(1);
        expect(crit!.activeUse).toBeDefined();
        expect(crit!.activeUse!.timing).toContain('onOffensiveRollEnd');
        expect(crit!.activeUse!.consumeAmount).toBe(1);
        expect(crit!.activeUse!.effect.type).toBe('modifyDamageDealt');
        expect(crit!.activeUse!.effect.value).toBe(4);
    });

    it('应包含 Accuracy（精准）— consumable, onOffensiveRollEnd, 不叠加', () => {
        const acc = PALADIN_TOKENS.find(t => t.id === TOKEN_IDS.ACCURACY);
        expect(acc).toBeDefined();
        expect(acc!.category).toBe('consumable');
        expect(acc!.stackLimit).toBe(1);
        expect(acc!.activeUse).toBeDefined();
        expect(acc!.activeUse!.timing).toContain('onOffensiveRollEnd');
    });

    it('应包含 Protect（守护）— consumable, beforeDamageReceived, 伤害减半', () => {
        const prot = PALADIN_TOKENS.find(t => t.id === TOKEN_IDS.PROTECT);
        expect(prot).toBeDefined();
        expect(prot!.category).toBe('consumable');
        expect(prot!.stackLimit).toBe(1);
        expect(prot!.activeUse).toBeDefined();
        expect(prot!.activeUse!.timing).toContain('beforeDamageReceived');
        expect(prot!.activeUse!.effect.type).toBe('modifyDamageReceived');
        expect(prot!.activeUse!.effect.value).toBe(0); // 动态计算减半
    });

    it('应包含 Retribution（神罚）— consumable, beforeDamageReceived, 不叠加', () => {
        const ret = PALADIN_TOKENS.find(t => t.id === TOKEN_IDS.RETRIBUTION);
        expect(ret).toBeDefined();
        expect(ret!.category).toBe('consumable');
        expect(ret!.stackLimit).toBe(1);
        expect(ret!.activeUse).toBeDefined();
        expect(ret!.activeUse!.timing).toContain('beforeDamageReceived');
    });

    it('应包含 Blessing of Divinity（神圣祝福）— consumable, onDamageReceived 被动触发', () => {
        const blessing = PALADIN_TOKENS.find(t => t.id === TOKEN_IDS.BLESSING_OF_DIVINITY);
        expect(blessing).toBeDefined();
        expect(blessing!.category).toBe('consumable');
        expect(blessing!.stackLimit).toBe(1);
        expect(blessing!.passiveTrigger).toBeDefined();
        expect(blessing!.passiveTrigger!.timing).toBe('onDamageReceived');
        expect(blessing!.passiveTrigger!.removable).toBe(false);
        expect(blessing!.passiveTrigger!.actions).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    type: 'custom',
                    customActionId: 'paladin-blessing-prevent',
                }),
            ])
        );
    });

    it('Token 数量应为 6', () => {
        expect(PALADIN_TOKENS).toHaveLength(6);
    });
});

// ============================================================================
// 2. 初始状态验证
// ============================================================================

describe('圣骑士初始 Token 状态', () => {
    it('所有状态初始值为 0', () => {
        expect(PALADIN_INITIAL_TOKENS[TOKEN_IDS.CRIT]).toBe(0);
        expect(PALADIN_INITIAL_TOKENS[TOKEN_IDS.ACCURACY]).toBe(0);
        expect(PALADIN_INITIAL_TOKENS[TOKEN_IDS.PROTECT]).toBe(0);
        expect(PALADIN_INITIAL_TOKENS[TOKEN_IDS.RETRIBUTION]).toBe(0);
        expect(PALADIN_INITIAL_TOKENS[TOKEN_IDS.BLESSING_OF_DIVINITY]).toBe(0);
    });

    it('初始状态键数量与 Token 定义一致', () => {
        expect(Object.keys(PALADIN_INITIAL_TOKENS)).toHaveLength(PALADIN_TOKENS.length);
    });
});

// ============================================================================
// 3. 角色注册数据一致性
// ============================================================================

describe('圣骑士角色注册', () => {
    it('CHARACTER_DATA_MAP 中 paladin 数据正确', () => {
        const data = CHARACTER_DATA_MAP.paladin;
        expect(data.id).toBe('paladin');
        expect(data.abilities).toBe(PALADIN_ABILITIES);
        expect(data.tokens).toBe(PALADIN_TOKENS);
        expect(data.initialTokens).toEqual(PALADIN_INITIAL_TOKENS);
        expect(data.diceDefinitionId).toBe('paladin-dice');
        expect(data.getStartingDeck).toBe(getPaladinStartingDeck);
    });

    it('技能等级初始值全为 1', () => {
        const data = CHARACTER_DATA_MAP.paladin;
        for (const level of Object.values(data.initialAbilityLevels)) {
            expect(level).toBe(1);
        }
    });

    it('技能等级映射覆盖所有技能', () => {
        const data = CHARACTER_DATA_MAP.paladin;
        const abilityIds = PALADIN_ABILITIES.map(a => a.id);
        const mappedIds = Object.keys(data.initialAbilityLevels);
        for (const id of abilityIds) {
            expect(mappedIds).toContain(id);
        }
    });
});


// ============================================================================
// 4. 骰子定义验证
// ============================================================================

describe('圣骑士骰子定义', () => {
    it('骰子 ID 为 paladin-dice', () => {
        expect(paladinDiceDefinition.id).toBe('paladin-dice');
    });

    it('应有 6 个骰面', () => {
        expect(paladinDiceDefinition.faces).toHaveLength(6);
    });

    it('骰面符号正确映射', () => {
        const faces = paladinDiceDefinition.faces;
        // 1, 2 → sword
        expect(faces[0].symbols).toContain(PALADIN_DICE_FACE_IDS.SWORD);
        expect(faces[1].symbols).toContain(PALADIN_DICE_FACE_IDS.SWORD);
        // 3, 4 → helm
        expect(faces[2].symbols).toContain(PALADIN_DICE_FACE_IDS.HELM);
        expect(faces[3].symbols).toContain(PALADIN_DICE_FACE_IDS.HELM);
        // 5 → heart
        expect(faces[4].symbols).toContain(PALADIN_DICE_FACE_IDS.HEART);
        // 6 → pray
        expect(faces[5].symbols).toContain(PALADIN_DICE_FACE_IDS.PRAY);
    });
});

// ============================================================================
// 5. 技能 grantToken 引用一致性
// ============================================================================

describe('圣骑士 - 技能 grantToken 引用验证', () => {
    /** 递归收集所有 effects 中的 grantToken tokenId */
    function collectGrantTokenIds(abilities: typeof PALADIN_ABILITIES): string[] {
        const ids: string[] = [];
        for (const ability of abilities) {
            const allEffects = [
                ...(ability.effects ?? []),
                ...(ability.variants?.flatMap(v => v.effects) ?? []),
            ];
            for (const effect of allEffects) {
                const action = effect.action as any;
                if (action.type === 'grantToken' && action.tokenId) {
                    ids.push(action.tokenId);
                }
                if (action.type === 'choice' && action.choiceOptions) {
                    for (const opt of action.choiceOptions) {
                        if (opt.tokenId) ids.push(opt.tokenId);
                    }
                }
            }
        }
        return [...new Set(ids)];
    }

    it('所有 grantToken 引用的 tokenId 都在 TOKEN_IDS 中', () => {
        const usedIds = collectGrantTokenIds(PALADIN_ABILITIES);
        const validIds = new Set(Object.values(TOKEN_IDS));
        for (const id of usedIds) {
            expect(validIds.has(id)).toBe(true);
        }
    });

    it('技能引用了 CRIT、ACCURACY、RETRIBUTION、BLESSING_OF_DIVINITY', () => {
        const usedIds = collectGrantTokenIds(PALADIN_ABILITIES);
        expect(usedIds).toContain(TOKEN_IDS.CRIT);
        expect(usedIds).toContain(TOKEN_IDS.ACCURACY);
        expect(usedIds).toContain(TOKEN_IDS.RETRIBUTION);
        expect(usedIds).toContain(TOKEN_IDS.BLESSING_OF_DIVINITY);
    });
});
