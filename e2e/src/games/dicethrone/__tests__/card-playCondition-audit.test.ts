/**
 * 卡牌 playCondition 一致性审计
 *
 * 审查维度：
 * D2（边界完整）：所有限定条件是否全程约束
 * D3（数据流闭环）：定义→验证→UI 是否闭环
 * D10（元数据一致）：playCondition 与卡牌效果语义是否匹配
 *
 * 规则依据（§5.2）：
 * - 掷骰阶段行动卡（timing=roll）：可在任何人的投掷阶段打出
 * - 立即行动卡（timing=instant）：可在任何玩家的任何阶段打出
 * - 主要阶段行动卡（timing=main）：仅在自己的主要阶段打出
 *
 * 关键约束：
 * - target=opponent 且操作骰子的 roll 卡 → 必须有 requireIsNotRoller（不能操作自己的骰子给自己）
 * - target=self 且操作已有骰子的 roll 卡 → 必须有 requireDiceExists + requireHasRolled
 * - 攻击修正卡（效果 timing=withDamage）→ 不需要 requireDiceExists（自带投掷）
 */

import { describe, it, expect } from 'vitest';
import { COMMON_CARDS } from '../domain/commonCards';
import { MONK_CARDS } from '../heroes/monk/cards';
import { BARBARIAN_CARDS } from '../heroes/barbarian/cards';
import { PYROMANCER_CARDS } from '../heroes/pyromancer/cards';
import { PALADIN_CARDS } from '../heroes/paladin/cards';
import { MOON_ELF_CARDS } from '../heroes/moon_elf/cards';
import { SHADOW_THIEF_CARDS } from '../heroes/shadow_thief/cards';
import type { AbilityCard } from '../types';

/** 判断卡牌效果是否操作已有骰子（非自带投掷） */
const isExistingDiceManipulation = (card: AbilityCard): boolean => {
    const diceActionIds = [
        'modify-die-to-6', 'modify-die-copy', 'modify-die-any-1', 'modify-die-any-2',
        'modify-die-adjust-1', 'reroll-opponent-die-1', 'reroll-die-2', 'reroll-die-5',
        'shadow_thief-shadow-manipulation',
    ];
    return card.effects?.some(e =>
        e.action?.type === 'custom' && diceActionIds.includes(e.action.customActionId ?? '')
    ) ?? false;
};

/** 判断卡牌效果 target 是否为 opponent */
const hasOpponentDiceTarget = (card: AbilityCard): boolean => {
    return card.effects?.some(e =>
        e.action?.target === 'opponent' && isExistingDiceManipulation(card)
    ) ?? false;
};

/** 判断卡牌效果 target 是否为 self 且操作已有骰子 */
const hasSelfDiceTarget = (card: AbilityCard): boolean => {
    return card.effects?.some(e =>
        e.action?.target === 'self' && isExistingDiceManipulation(card)
    ) ?? false;
};

/** 
 * 判断是否为攻击修正卡
 * 攻击修正卡 = timing=roll 且效果中包含自带投掷（rollDie）或修改 pendingAttack 的 custom action
 * 这些卡不需要 requireDiceExists（它们自带投掷或不操作已有骰子）
 */
const isAttackModifier = (card: AbilityCard): boolean => {
    if (card.timing !== 'roll') return false;
    // 攻击修正卡的 custom action ID 列表（自带投掷或修改 pendingAttack.bonusDamage）
    const attackModifierActionIds = [
        'more-please-roll-damage',       // 狂战士：再来一次（投5骰加伤）
        'moon_elf-action-volley',        // 月精灵：齐射（投5骰加伤）
        'moon_elf-action-watch-out',     // 月精灵：看箭（投1骰加伤）
        'pyro-details-dmg-per-fm',       // 火法师：烈焰赤红（FM加伤）
        'pyro-get-fired-up-roll',        // 火法师：火之高兴（投1骰条件效果）
    ];
    return card.effects?.some(e =>
        e.action?.type === 'custom' && attackModifierActionIds.includes(e.action.customActionId ?? '')
    ) ?? false;
};

describe('卡牌 playCondition 一致性审计', () => {
    // 收集所有非升级卡
    const allHeroCards: { hero: string; cards: AbilityCard[] }[] = [
        { hero: 'common', cards: COMMON_CARDS },
        { hero: 'monk', cards: MONK_CARDS.filter(c => !COMMON_CARDS.some(cc => cc.id === c.id)) },
        { hero: 'barbarian', cards: BARBARIAN_CARDS.filter(c => !COMMON_CARDS.some(cc => cc.id === c.id)) },
        { hero: 'pyromancer', cards: PYROMANCER_CARDS.filter(c => !COMMON_CARDS.some(cc => cc.id === c.id)) },
        { hero: 'paladin', cards: PALADIN_CARDS.filter(c => !COMMON_CARDS.some(cc => cc.id === c.id)) },
        { hero: 'moon_elf', cards: MOON_ELF_CARDS.filter(c => !COMMON_CARDS.some(cc => cc.id === c.id)) },
        { hero: 'shadow_thief', cards: SHADOW_THIEF_CARDS.filter(c => !COMMON_CARDS.some(cc => cc.id === c.id)) },
    ];

    const actionCards = allHeroCards.flatMap(({ hero, cards }) =>
        cards.filter(c => c.type === 'action').map(c => ({ hero, card: c }))
    );

    describe('timing=roll 且 target=opponent 的骰子操作卡必须有 requireIsNotRoller', () => {
        const opponentDiceCards = actionCards.filter(({ card }) =>
            card.timing === 'roll' && hasOpponentDiceTarget(card)
        );

        it.each(opponentDiceCards.map(({ hero, card }) => [
            `[${hero}] ${card.id}`, card,
        ]))('%s', (_label, card) => {
            const c = card as AbilityCard;
            expect(c.playCondition?.requireIsNotRoller).toBe(true);
            expect(c.playCondition?.requireRollConfirmed).toBe(true);
            expect(c.playCondition?.requireHasRolled).toBe(true);
            expect(c.playCondition?.requireOpponentDiceExists).toBe(true);
        });
    });

    describe('timing=roll 且 target=self 的骰子操作卡（非攻击修正）必须有 requireDiceExists + requireHasRolled', () => {
        const selfDiceCards = actionCards.filter(({ card }) =>
            card.timing === 'roll' && hasSelfDiceTarget(card) && !isAttackModifier(card)
        );

        it.each(selfDiceCards.map(({ hero, card }) => [
            `[${hero}] ${card.id}`, card,
        ]))('%s', (_label, card) => {
            const c = card as AbilityCard;
            expect(c.playCondition?.requireDiceExists).toBe(true);
            expect(c.playCondition?.requireHasRolled).toBe(true);
        });
    });

    describe('timing=main 的卡牌不应有骰子相关 playCondition', () => {
        const mainCards = actionCards.filter(({ card }) => card.timing === 'main');

        it.each(mainCards.map(({ hero, card }) => [
            `[${hero}] ${card.id}`, card,
        ]))('%s', (_label, card) => {
            const c = card as AbilityCard;
            // main 阶段卡不应要求骰子相关条件
            expect(c.playCondition?.requireDiceExists).toBeFalsy();
            expect(c.playCondition?.requireHasRolled).toBeFalsy();
            expect(c.playCondition?.requireIsRoller).toBeFalsy();
            expect(c.playCondition?.requireIsNotRoller).toBeFalsy();
            expect(c.playCondition?.requireRollConfirmed).toBeFalsy();
        });
    });

    describe('所有卡牌的 playCondition 字段类型正确', () => {
        const allActionCards = actionCards.filter(({ card }) => card.playCondition);

        it.each(allActionCards.map(({ hero, card }) => [
            `[${hero}] ${card.id}`, card,
        ]))('%s playCondition 字段值类型正确', (_label, card) => {
            const c = card as AbilityCard;
            const cond = c.playCondition!;
            // 所有 boolean 字段必须是 true（不能是 false，false 等于没设置）
            if (cond.requireIsRoller !== undefined) expect(cond.requireIsRoller).toBe(true);
            if (cond.requireIsNotRoller !== undefined) expect(cond.requireIsNotRoller).toBe(true);
            if (cond.requireHasRolled !== undefined) expect(cond.requireHasRolled).toBe(true);
            if (cond.requireDiceExists !== undefined) expect(cond.requireDiceExists).toBe(true);
            if (cond.requireOpponentDiceExists !== undefined) expect(cond.requireOpponentDiceExists).toBe(true);
            if (cond.requireRollConfirmed !== undefined) expect(cond.requireRollConfirmed).toBe(true);
            if (cond.requireNotRollConfirmed !== undefined) expect(cond.requireNotRollConfirmed).toBe(true);
            if (cond.requireOwnTurn !== undefined) expect(cond.requireOwnTurn).toBe(true);
            if (cond.requireOpponentTurn !== undefined) expect(cond.requireOpponentTurn).toBe(true);
        });
    });

    describe('通用卡 playCondition 快照（防回归）', () => {
        it('card-give-hand 必须有完整的对手骰子操作限制', () => {
            const card = COMMON_CARDS.find(c => c.id === 'card-give-hand')!;
            expect(card.playCondition).toEqual({
                requireIsNotRoller: true,
                requireRollConfirmed: true,
                requireHasRolled: true,
                requireOpponentDiceExists: true,
            });
        });

        it('card-play-six 必须有骰子存在限制', () => {
            const card = COMMON_CARDS.find(c => c.id === 'card-play-six')!;
            expect(card.playCondition).toEqual({
                requireDiceExists: true,
                requireHasRolled: true,
            });
        });

        it('card-me-too 必须有最少骰子数量限制', () => {
            const card = COMMON_CARDS.find(c => c.id === 'card-me-too')!;
            expect(card.playCondition).toEqual({
                requireDiceExists: true,
                requireHasRolled: true,
                requireMinDiceCount: 2,
            });
        });

        it('card-unexpected 必须有最少骰子数量限制', () => {
            const card = COMMON_CARDS.find(c => c.id === 'card-unexpected')!;
            expect(card.playCondition).toEqual({
                requireDiceExists: true,
                requireHasRolled: true,
                requireMinDiceCount: 2,
            });
        });
    });
});
