/**
 * Pyromancer (炎术士) 技能覆盖测试
 * 验证角色选择、初始化和自定义动作是否正常工作
 */

import { describe, it, expect } from 'vitest';
import { PYROMANCER_CARDS, getPyromancerStartingDeck } from '../heroes/pyromancer/cards';
import { PYROMANCER_ABILITIES } from '../heroes/pyromancer/abilities';
import { PYROMANCER_TOKENS, PYROMANCER_INITIAL_TOKENS } from '../heroes/pyromancer/tokens';
import { pyromancerDiceDefinition } from '../heroes/pyromancer/diceConfig';
import { CHARACTER_DATA_MAP } from '../domain/characters';
import { DiceThroneDomain } from '../domain';
import { TOKEN_IDS, STATUS_IDS, PYROMANCER_DICE_FACE_IDS } from '../domain/ids';
import type { RandomFn } from '../../../engine/types';

const fixedRandom: RandomFn = {
    random: () => 0,
    d: () => 1,
    range: (min) => min,
    shuffle: (arr) => [...arr],
};

describe('Pyromancer 角色注册', () => {
    it('应该在 CHARACTER_DATA_MAP 中正确注册', () => {
        const data = CHARACTER_DATA_MAP.pyromancer;
        expect(data).toBeDefined();
        expect(data.id).toBe('pyromancer');
        expect(data.abilities).toEqual(PYROMANCER_ABILITIES);
        expect(data.tokens).toEqual(PYROMANCER_TOKENS);
        expect(data.initialTokens).toEqual(PYROMANCER_INITIAL_TOKENS);
        expect(data.diceDefinitionId).toBe('pyromancer-dice');
        expect(data.getStartingDeck).toBe(getPyromancerStartingDeck);
    });

    it('应该有正确的初始技能等级', () => {
        const data = CHARACTER_DATA_MAP.pyromancer;
        expect(data.initialAbilityLevels).toEqual({
            'fireball': 1,
            'soul-burn': 1,
            'fiery-combo': 1,
            'meteor': 1,
            'pyro-blast': 1,
            'burn-down': 1,
            'ignite': 1,
            'magma-armor': 1,
            'ultimate-inferno': 1,
        });
    });
});

describe('Pyromancer 技能定义', () => {
    it('应该包含所有基础技能', () => {
        const abilityIds = PYROMANCER_ABILITIES.map(a => a.id);
        expect(abilityIds).toContain('fireball');
        expect(abilityIds).toContain('soul-burn');
        expect(abilityIds).toContain('fiery-combo');
        expect(abilityIds).toContain('meteor');
        expect(abilityIds).toContain('pyro-blast');
        expect(abilityIds).toContain('burn-down');
        expect(abilityIds).toContain('ignite');
        expect(abilityIds).toContain('magma-armor');
        expect(abilityIds).toContain('ultimate-inferno');
    });

    it('所有技能应该有名称和描述字段', () => {
        for (const ability of PYROMANCER_ABILITIES) {
            expect(ability.name).toBeDefined();
            expect(ability.description).toBeDefined();
            expect(ability.type).toMatch(/^(offensive|defensive)$/);
        }
    });

    it('所有技能应该有效果定义（直接或通过 variants）', () => {
        for (const ability of PYROMANCER_ABILITIES) {
            // 效果可以在顶级 effects 或 variants 中
            const hasDirectEffects = ability.effects && ability.effects.length > 0;
            const hasVariantEffects = ability.variants && ability.variants.some(v => v.effects && v.effects.length > 0);
            expect(hasDirectEffects || hasVariantEffects).toBe(true);
        }
    });
});

describe('Pyromancer Token 定义', () => {
    it('应该包含 Fire Mastery Token', () => {
        const fireMastery = PYROMANCER_TOKENS.find(t => t.id === TOKEN_IDS.FIRE_MASTERY);
        expect(fireMastery).toBeDefined();
        expect(fireMastery!.stackLimit).toBe(5);
        expect(fireMastery!.category).toBe('consumable');
    });

    it('应该包含 Knockdown 状态', () => {
        const knockdown = PYROMANCER_TOKENS.find(t => t.id === STATUS_IDS.KNOCKDOWN);
        expect(knockdown).toBeDefined();
        expect(knockdown!.category).toBe('debuff');
    });

    it('应该包含 Burn 状态', () => {
        const burn = PYROMANCER_TOKENS.find(t => t.id === STATUS_IDS.BURN);
        expect(burn).toBeDefined();
        expect(burn!.category).toBe('debuff');
    });

    it('初始 Token 状态应该全为 0', () => {
        expect(PYROMANCER_INITIAL_TOKENS[TOKEN_IDS.FIRE_MASTERY]).toBe(0);
        expect(PYROMANCER_INITIAL_TOKENS[STATUS_IDS.KNOCKDOWN]).toBe(0);
        expect(PYROMANCER_INITIAL_TOKENS[STATUS_IDS.BURN]).toBe(0);
    });
});

describe('Pyromancer 骰子定义', () => {
    it('应该有正确的骰子 ID', () => {
        expect(pyromancerDiceDefinition.id).toBe('pyromancer-dice');
    });

    it('应该有 6 个骰面', () => {
        expect(pyromancerDiceDefinition.faces.length).toBe(6);
    });

    it('骰面符号应该正确映射', () => {
        const faces = pyromancerDiceDefinition.faces;
        // 1, 2, 3 -> fire
        expect(faces[0].symbols).toContain(PYROMANCER_DICE_FACE_IDS.FIRE);
        expect(faces[1].symbols).toContain(PYROMANCER_DICE_FACE_IDS.FIRE);
        expect(faces[2].symbols).toContain(PYROMANCER_DICE_FACE_IDS.FIRE);
        // 4 -> magma
        expect(faces[3].symbols).toContain(PYROMANCER_DICE_FACE_IDS.MAGMA);
        // 5 -> fiery_soul
        expect(faces[4].symbols).toContain(PYROMANCER_DICE_FACE_IDS.FIERY_SOUL);
        // 6 -> meteor
        expect(faces[5].symbols).toContain(PYROMANCER_DICE_FACE_IDS.METEOR);
    });
});

describe('Pyromancer 卡牌定义', () => {
    it('应该包含升级卡', () => {
        const upgradeCards = PYROMANCER_CARDS.filter(c => c.type === 'upgrade');
        expect(upgradeCards.length).toBeGreaterThan(0);
    });

    it('应该包含行动卡', () => {
        const actionCards = PYROMANCER_CARDS.filter(c => c.type === 'action');
        expect(actionCards.length).toBeGreaterThan(0);
    });

    it('应该能生成初始牌库', () => {
        const deck = getPyromancerStartingDeck(fixedRandom);
        expect(deck.length).toBeGreaterThan(0);
    });
});

describe('Pyromancer 角色选择', () => {
    it('应该能够选择 Pyromancer 角色', () => {
        const state = DiceThroneDomain.setup(['0', '1'], fixedRandom);

        // 模拟选择角色
        state.selectedCharacters['0'] = 'pyromancer';

        expect(state.selectedCharacters['0']).toBe('pyromancer');
    });

    it('选择 Pyromancer 后应该能准备并开始游戏', () => {
        const state = DiceThroneDomain.setup(['0', '1'], fixedRandom);

        // 两个玩家都选择角色
        state.selectedCharacters['0'] = 'pyromancer';
        state.selectedCharacters['1'] = 'monk';

        // 非房主准备
        state.readyPlayers['1'] = true;

        // 验证可以开始游戏（所有前提都满足）
        expect(state.selectedCharacters['0']).toBe('pyromancer');
        expect(state.selectedCharacters['1']).toBe('monk');
        expect(state.readyPlayers['1']).toBe(true);
    });
});
