/**
 * DiceThrone 卡牌交叉审计测试
 *
 * 覆盖人工审核中发现的三类 bug 模式：
 * 1. i18n 完整性：使用 cardText() 的卡牌必须在 zh-CN 和 en JSON 中有对应条目
 * 2. grantToken target 合理性：grantToken 不应使用 target:'select'（通常是 self/opponent）
 * 3. bonusCp 参数消费：ability 传了 params.bonusCp 的 custom action handler 必须实际读取它
 * 4. 技能 custom action 伤害计算中 bonusCp 一致性
 */

import { describe, it, expect } from 'vitest';
import type { AbilityCard } from '../domain/types';
import type { AbilityDef, AbilityEffect } from '../domain/combat';
import { CHARACTER_DATA_MAP } from '../domain/characters';
import { getCustomActionHandler } from '../domain/effects';

// 各英雄卡牌
import { MONK_CARDS } from '../heroes/monk/cards';
import { BARBARIAN_CARDS } from '../heroes/barbarian/cards';
import { PYROMANCER_CARDS } from '../heroes/pyromancer/cards';
import { SHADOW_THIEF_CARDS } from '../heroes/shadow_thief/cards';
import { MOON_ELF_CARDS } from '../heroes/moon_elf/cards';
import { PALADIN_CARDS } from '../heroes/paladin/cards';
import { GUNSLINGER_CARDS } from '../heroes/gunslinger/cards';
import { SAMURAI_CARDS } from '../heroes/samurai/cards';
import { COMMON_CARDS } from '../domain/commonCards';
import { DICETHRONE_CARD_ATLAS_IDS } from '../domain/ids';
import { getBaseAbilityId } from '../ui/abilitySlotMapping';

// i18n
import zhCN from '../../../../public/locales/zh-CN/game-dicethrone.json';
import en from '../../../../public/locales/en/game-dicethrone.json';

// ============================================================================
// 辅助
// ============================================================================

/** 所有英雄专属卡 + 通用卡（去重） */
function getAllUniqueCards(): AbilityCard[] {
    const seen = new Set<string>();
    const result: AbilityCard[] = [];
    const all = [
        ...MONK_CARDS, ...BARBARIAN_CARDS, ...PYROMANCER_CARDS,
        ...SHADOW_THIEF_CARDS, ...MOON_ELF_CARDS, ...PALADIN_CARDS,
        ...GUNSLINGER_CARDS, ...SAMURAI_CARDS,
        ...COMMON_CARDS,
    ];
    for (const card of all) {
        if (!seen.has(card.id)) {
            seen.add(card.id);
            result.push(card);
        }
    }
    return result;
}

/** 收集所有英雄的所有技能定义（含升级） */
function getAllAbilityEffectsFlat(): Array<{
    heroId: string;
    abilityId: string;
    variantId?: string;
    effect: AbilityEffect;
}> {
    const result: Array<{ heroId: string; abilityId: string; variantId?: string; effect: AbilityEffect }> = [];
    for (const [heroId, data] of Object.entries(CHARACTER_DATA_MAP)) {
        for (const ability of data.abilities as AbilityDef[]) {
            if (ability.effects) {
                for (const effect of ability.effects) {
                    result.push({ heroId, abilityId: ability.id, effect });
                }
            }
            if (ability.variants) {
                for (const variant of ability.variants) {
                    for (const effect of variant.effects) {
                        result.push({ heroId, abilityId: ability.id, variantId: variant.id, effect });
                    }
                }
            }
        }
    }
    return result;
}

// ============================================================================
// 1. i18n 完整性：使用 cardText() 的卡牌必须有 i18n 条目
// ============================================================================

describe('卡牌 i18n 完整性', () => {
    const allCards = getAllUniqueCards();
    const zhCards = (zhCN as Record<string, unknown>).cards as Record<string, { name?: string; description?: string }> ?? {};
    const enCards = (en as Record<string, unknown>).cards as Record<string, { name?: string; description?: string }> ?? {};

    /**
     * 检测使用 cardText() 的卡牌：
     * cardText() 生成 `cards.<id>.name` / `cards.<id>.description` 格式的 i18n key。
     * 如果 card.name 以 'cards.' 开头，说明使用了 cardText()。
     */
    function usesCardText(card: AbilityCard): boolean {
        return typeof card.name === 'string' && card.name.startsWith('cards.');
    }

    it('使用 cardText() 的卡牌在 zh-CN 中有对应条目', () => {
        const violations: string[] = [];
        for (const card of allCards) {
            if (!usesCardText(card)) continue;
            if (!zhCards[card.id]) {
                violations.push(`[${card.id}] 使用 cardText() 但 zh-CN cards 中无对应条目`);
            }
        }
        expect(violations).toEqual([]);
    });

    it('使用 cardText() 的卡牌在 en 中有对应条目', () => {
        const violations: string[] = [];
        for (const card of allCards) {
            if (!usesCardText(card)) continue;
            if (!enCards[card.id]) {
                violations.push(`[${card.id}] 使用 cardText() 但 en cards 中无对应条目`);
            }
        }
        expect(violations).toEqual([]);
    });

    it('i18n 条目必须同时包含 name 和 description', () => {
        const violations: string[] = [];
        for (const card of allCards) {
            if (!usesCardText(card)) continue;
            for (const [locale, cardsMap] of [['zh-CN', zhCards], ['en', enCards]] as const) {
                const entry = cardsMap[card.id];
                if (!entry) continue; // 缺失条目由上面的测试覆盖
                if (!entry.name) violations.push(`[${card.id}] ${locale} 缺少 name`);
                if (!entry.description) violations.push(`[${card.id}] ${locale} 缺少 description`);
            }
        }
        expect(violations).toEqual([]);
    });
});

describe('月精灵长弓文案一致性', () => {
    const zhAbilities = (zhCN as Record<string, unknown>).abilities as Record<string, { description?: string }> ?? {};
    const enAbilities = (en as Record<string, unknown>).abilities as Record<string, { description?: string }> ?? {};

    it('长弓 II / III 应明确使用相同数字文案', () => {
        expect(zhAbilities['longbow-2']?.description).toContain('相同数字');
        expect(zhAbilities['longbow-3']?.description).toContain('相同数字');
        expect(enAbilities['longbow-2']?.description).toContain('matching numbers');
        expect(enAbilities['longbow-3']?.description).toContain('matching numbers');
    });
});

describe('枪手 / 武士 token tooltip 文案完整性', () => {
    const zhTokens = (zhCN as Record<string, unknown>).tokens as Record<string, { name?: string; description?: string[] }> ?? {};
    const enTokens = (en as Record<string, unknown>).tokens as Record<string, { name?: string; description?: string[] }> ?? {};

    it('loaded / bounty / honor / shame / samurai_retribution 必须在中英文 locale 中有 tooltip 文案', () => {
        const tokenIds = ['loaded', 'bounty', 'honor', 'shame', 'samurai_retribution'];
        const violations: string[] = [];

        for (const tokenId of tokenIds) {
            for (const [locale, tokensMap] of [['zh-CN', zhTokens], ['en', enTokens]] as const) {
                const entry = tokensMap[tokenId];
                if (!entry) {
                    violations.push(`[${locale}/${tokenId}] 缺少 token locale 条目`);
                    continue;
                }
                if (!entry.name) {
                    violations.push(`[${locale}/${tokenId}] 缺少 token name`);
                }
                if (!Array.isArray(entry.description) || entry.description.length === 0) {
                    violations.push(`[${locale}/${tokenId}] 缺少 token description`);
                }
            }
        }

        expect(violations).toEqual([]);
    });

    it('武士新增 token 的中文文案不能退回成英文占位', () => {
        expect(zhTokens.honor?.name).toBe('荣誉');
        expect(zhTokens.shame?.name).toBe('耻辱');
        expect(zhTokens.samurai_retribution?.name).toBe('反击');
        expect(zhTokens.honor?.description?.[0]).toContain('荣誉');
        expect(zhTokens.shame?.description?.[0]).toContain('耻辱');
        expect(zhTokens.samurai_retribution?.description?.[0]).toContain('反击');
    });
});

describe('武僧拳术 III 文案一致性', () => {
    const zhAbilities = (zhCN as Record<string, unknown>).abilities as Record<string, { description?: string }> ?? {};
    const enAbilities = (en as Record<string, unknown>).abilities as Record<string, { description?: string }> ?? {};
    const zhCards = (zhCN as Record<string, unknown>).cards as Record<string, { description?: string }> ?? {};
    const enCards = (en as Record<string, unknown>).cards as Record<string, { description?: string }> ?? {};

    it('拳术 III 应明确使用 3/4/5 拳 与 4个相同数字击倒文案', () => {
        expect(zhAbilities['fist-technique-3']?.description).toContain('3/4/5拳');
        expect(zhAbilities['fist-technique-3']?.description).toContain('4个相同数字');
        expect(enAbilities['fist-technique-3']?.description).toContain('3/4/5 Fists');
        expect(enAbilities['fist-technique-3']?.description).toContain('Knockdown');
        expect(enAbilities['fist-technique-3']?.description).toContain('4 matching numbers');

        expect(zhCards['card-thrust-punch-3']?.description).toContain('3/4/5拳');
        expect(zhCards['card-thrust-punch-3']?.description).toContain('4个相同数字');
        expect(enCards['card-thrust-punch-3']?.description).toContain('3/4/5 Fists');
        expect(enCards['card-thrust-punch-3']?.description).toContain('4 matching numbers');
        expect(enCards['card-thrust-punch-3']?.description).not.toContain('Stun');
    });
});

describe('野蛮人符号计数文案一致性', () => {
    const zhAbilities = (zhCN as Record<string, unknown>).abilities as Record<string, { description?: string }> ?? {};
    const enAbilities = (en as Record<string, unknown>).abilities as Record<string, { description?: string }> ?? {};

    it('百折不挠 II 与重击 II/III 应显式描述 Hearts / Swords 触发及相同数字追加效果', () => {
        expect(zhAbilities['steadfast-2']?.description).toMatch(/3\/4\/5\s*心/);
        expect(zhAbilities['steadfast-2']?.description).toMatch(/3\s*个相同数字/);
        expect(enAbilities['steadfast-2']?.description).toContain('3/4/5 Hearts');
        expect(enAbilities['steadfast-2']?.description).toContain('3 matching numbers');

        expect(zhAbilities['slap-2']?.description).toMatch(/3\/4\/5\s*剑/);
        expect(zhAbilities['slap-2']?.description).toMatch(/4\s*个相同数字/);
        expect(zhAbilities['slap-3']?.description).toMatch(/3\/4\/5\s*剑/);
        expect(zhAbilities['slap-3']?.description).toMatch(/4\s*个相同数字/);
        expect(enAbilities['slap-2']?.description).toContain('3/4/5 Swords');
        expect(enAbilities['slap-2']?.description).toContain('4 matching numbers');
        expect(enAbilities['slap-3']?.description).toContain('3/4/5 Swords');
        expect(enAbilities['slap-3']?.description).toContain('4 matching numbers');
    });
});

describe('枪手 / 武士同点数文案一致性', () => {
    const zhAbilities = (zhCN as Record<string, unknown>).abilities as Record<string, { description?: string }> ?? {};
    const enAbilities = (en as Record<string, unknown>).abilities as Record<string, { description?: string }> ?? {};
    const zhCards = (zhCN as Record<string, unknown>).cards as Record<string, { description?: string }> ?? {};
    const enCards = (en as Record<string, unknown>).cards as Record<string, { description?: string }> ?? {};

    it('左轮手枪 II / 太刀斩 II-III 应显式描述相同数字阈值', () => {
        expect(zhCards['upgrade-revolver-2']?.description).toContain('相同');
        expect(zhCards['upgrade-revolver-2']?.description).toContain('数字');
        expect(enCards['upgrade-revolver-2']?.description).toContain('same number');

        expect(zhAbilities['katana-slice-2']?.description).toContain('相同');
        expect(zhAbilities['katana-slice-2']?.description).toContain('数字');
        expect(zhAbilities['katana-slice-3']?.description).toContain('相同');
        expect(zhAbilities['katana-slice-3']?.description).toContain('数字');
        expect(enAbilities['katana-slice-2']?.description).toContain('same number');
        expect(enAbilities['katana-slice-3']?.description).toContain('same number');
    });
});

// ============================================================================
// 2. grantToken target 合理性
// ============================================================================

describe('卡牌效果 target 合理性', () => {
    const allCards = getAllUniqueCards();

    it('grantToken 效果不应使用 target:select（应为 self 或 opponent）', () => {
        const violations: string[] = [];
        for (const card of allCards) {
            if (!card.effects) continue;
            for (const effect of card.effects) {
                if (!effect.action) continue;
                if (effect.action.type === 'grantToken' && effect.action.target === 'select') {
                    violations.push(
                        `[${card.id}] grantToken 使用 target:'select'（tokenId: ${effect.action.tokenId}）` +
                        `— grantToken 通常给自己(self)或对手(opponent)，select 会被解析为 defenderId`
                    );
                }
            }
        }
        expect(violations).toEqual([]);
    });

    it('grantStatus 效果不应使用 target:self（状态通常施加给对手）', () => {
        // 白名单：某些卡牌确实给自己施加状态（如自伤效果）
        const WHITELIST = new Set<string>([]);
        const violations: string[] = [];
        for (const card of allCards) {
            if (WHITELIST.has(card.id)) continue;
            if (!card.effects) continue;
            for (const effect of card.effects) {
                if (!effect.action) continue;
                if (effect.action.type === 'grantStatus' && effect.action.target === 'self') {
                    violations.push(
                        `[${card.id}] grantStatus 使用 target:'self'（statusId: ${effect.action.statusId}）` +
                        `— 状态通常施加给对手，请确认是否正确`
                    );
                }
            }
        }
        expect(violations).toEqual([]);
    });
});

describe('枪手 / 武士卡图接线一致性', () => {
    it('枪手专属卡应只保留真实手牌对象；slot-22/23/24 不得再把下半区录成独立 card', () => {
        const normalizedGunslingerRuntimeAtlasCards: Record<string, { runtimeIndex: number; sourceAtlasIndex?: number }> = {
            'upgrade-revolver-2': { runtimeIndex: 18, sourceAtlasIndex: 18 },
            'upgrade-bounty-hunter-2': { runtimeIndex: 19, sourceAtlasIndex: 19 },
            'upgrade-showdown-2': { runtimeIndex: 20, sourceAtlasIndex: 20 },
            'upgrade-showdown-3': { runtimeIndex: 21, sourceAtlasIndex: 21 },
            'upgrade-fan-the-hammer-2': { runtimeIndex: 22, sourceAtlasIndex: 22 },
            'upgrade-take-cover-2': { runtimeIndex: 23, sourceAtlasIndex: 23 },
            'upgrade-deadeye-2': { runtimeIndex: 24, sourceAtlasIndex: 24 },
            'upgrade-duel-2': { runtimeIndex: 25, sourceAtlasIndex: 25 },
            'upgrade-quick-draw': { runtimeIndex: 26, sourceAtlasIndex: 26 },
            'card-wanted': { runtimeIndex: 27, sourceAtlasIndex: 27 },
            'card-spin-the-chamber': { runtimeIndex: 28, sourceAtlasIndex: 28 },
            'card-high-noon': { runtimeIndex: 29, sourceAtlasIndex: 29 },
            'card-wild-west': { runtimeIndex: 30, sourceAtlasIndex: 30 },
            'card-eat-my-lead': { runtimeIndex: 31, sourceAtlasIndex: 31 },
        };

        for (const [cardId, { runtimeIndex, sourceAtlasIndex }] of Object.entries(normalizedGunslingerRuntimeAtlasCards)) {
            const card = GUNSLINGER_CARDS.find((item) => item.id === cardId);
            expect(card?.previewRef).toEqual({
                type: 'atlas',
                atlasId: DICETHRONE_CARD_ATLAS_IDS.GUNSLINGER,
                index: runtimeIndex,
            });
            if (typeof sourceAtlasIndex === 'number') {
                expect(card?.sourceAtlasIndex).toBe(sourceAtlasIndex);
            }
        }

        expect(GUNSLINGER_CARDS.some((card) => card.id === 'card-pistol-whip')).toBe(false);
        expect(GUNSLINGER_CARDS.some((card) => card.id === 'card-mark-the-target')).toBe(false);
        expect(GUNSLINGER_CARDS.some((card) => card.id === 'card-the-law')).toBe(false);

        const gunslingerCommonAtlasIndex: Record<string, number> = {
            'card-play-six': 17,
            'card-just-this': 16,
            'card-give-hand': 15,
            'card-i-can-again': 14,
            'card-me-too': 13,
            'card-surprise': 12,
            'card-worthy-of-me': 11,
            'card-unexpected': 10,
            'card-next-time': 9,
            'card-boss-generous': 8,
            'card-flick': 7,
            'card-bye-bye': 6,
            'card-double': 5,
            'card-super-double': 4,
            'card-get-away': 3,
            'card-one-throw-fortune': 2,
            'card-what-status': 1,
            'card-transfer-status': 0,
        };

        for (const [cardId, index] of Object.entries(gunslingerCommonAtlasIndex)) {
            const card = GUNSLINGER_CARDS.find((item) => item.id === cardId);
            expect(card?.previewRef).toEqual({
                type: 'atlas',
                atlasId: DICETHRONE_CARD_ATLAS_IDS.GUNSLINGER,
                index,
            });
        }
    });

    it('武士专属卡应直接使用 ability-cards atlas 索引，不能再走 hand atlas 或单卡图', () => {
        const samuraiAtlasCards: Record<string, number> = {
            'upgrade-katana-slice-2': 18,
            'upgrade-katana-slice-3': 19,
            'upgrade-wakizashi-2': 20,
            'upgrade-wakizashi-3': 21,
            'upgrade-solemnity-2': 22,
            'upgrade-budo-2': 23,
            'upgrade-masamune-2': 24,
            'upgrade-slot-06-2': 25,
            'upgrade-stand-tall-2': 26,
            'card-samurai-honor': 27,
            'card-you-should-be-ashamed': 28,
            'card-no-retreat': 29,
            'card-righteousness': 30,
            'card-zanshin': 31,
        };

        for (const [cardId, index] of Object.entries(samuraiAtlasCards)) {
            const card = SAMURAI_CARDS.find((item) => item.id === cardId);
            expect(card?.previewRef).toEqual({
                type: 'atlas',
                atlasId: DICETHRONE_CARD_ATLAS_IDS.SAMURAI,
                index,
            });
        }

        const samuraiCommonAtlasIndex: Record<string, number> = {
            'card-play-six': 17,
            'card-just-this': 16,
            'card-give-hand': 15,
            'card-i-can-again': 14,
            'card-me-too': 13,
            'card-surprise': 12,
            'card-worthy-of-me': 11,
            'card-unexpected': 10,
            'card-next-time': 9,
            'card-boss-generous': 8,
            'card-flick': 7,
            'card-bye-bye': 6,
            'card-double': 5,
            'card-super-double': 4,
            'card-get-away': 3,
            'card-one-throw-fortune': 2,
            'card-what-status': 1,
            'card-transfer-status': 0,
        };

        for (const [cardId, index] of Object.entries(samuraiCommonAtlasIndex)) {
            const card = SAMURAI_CARDS.find((item) => item.id === cardId);
            expect(card?.previewRef).toEqual({
                type: 'atlas',
                atlasId: DICETHRONE_CARD_ATLAS_IDS.SAMURAI,
                index,
            });
        }
    });

    it('所有英雄升级卡都必须命中基础技能，而不是技能变体或技能子集', () => {
        const verifyUpgradeTarget = (cards: AbilityCard[], heroId: string) => {
            const violations: string[] = [];

            for (const card of cards) {
                if (card.type !== 'upgrade' || !card.effects) continue;
                const replaceAction = card.effects.find((effect) => effect.action?.type === 'replaceAbility')?.action;
                if (replaceAction?.type !== 'replaceAbility') {
                    violations.push(`[${heroId}/${card.id}] 缺少 replaceAbility`);
                    continue;
                }

                const targetAbilityId = replaceAction.targetAbilityId;
                const newAbilityId = replaceAction.newAbilityDef?.id;
                if (!targetAbilityId || !newAbilityId) {
                    violations.push(`[${heroId}/${card.id}] 缺少 targetAbilityId 或 newAbilityDef.id`);
                    continue;
                }

                if (getBaseAbilityId(targetAbilityId) !== targetAbilityId) {
                    violations.push(`[${heroId}/${card.id}] targetAbilityId=${targetAbilityId} 不是基础技能 ID`);
                }
                if (newAbilityId !== targetAbilityId) {
                    violations.push(`[${heroId}/${card.id}] newAbilityDef.id=${newAbilityId} 与 targetAbilityId=${targetAbilityId} 不一致`);
                }
            }

            expect(violations).toEqual([]);
        };

        verifyUpgradeTarget(MONK_CARDS, 'monk');
        verifyUpgradeTarget(BARBARIAN_CARDS, 'barbarian');
        verifyUpgradeTarget(PYROMANCER_CARDS, 'pyromancer');
        verifyUpgradeTarget(SHADOW_THIEF_CARDS, 'shadow_thief');
        verifyUpgradeTarget(MOON_ELF_CARDS, 'moon_elf');
        verifyUpgradeTarget(PALADIN_CARDS, 'paladin');
        verifyUpgradeTarget(GUNSLINGER_CARDS, 'gunslinger');
        verifyUpgradeTarget(SAMURAI_CARDS, 'samurai');
    });

    it('所有英雄都必须区分 升级卡=替换技能 与 行动卡=直接结算效果', () => {
        const heroCardsMap: Record<string, AbilityCard[]> = {
            monk: MONK_CARDS,
            barbarian: BARBARIAN_CARDS,
            pyromancer: PYROMANCER_CARDS,
            shadow_thief: SHADOW_THIEF_CARDS,
            moon_elf: MOON_ELF_CARDS,
            paladin: PALADIN_CARDS,
            gunslinger: GUNSLINGER_CARDS,
            samurai: SAMURAI_CARDS,
        };

        const directEffectBaselines = [
            'monk/card-buddha-light',
            'monk/card-palm-strike',
            'shadow_thief/action-sneaky-sneaky',
            'shadow_thief/action-card-trick',
            'paladin/card-blessing-of-divinity',
        ];
        const upgradeBaselines = [
            'monk/card-thrust-punch-2',
            'barbarian/upgrade-slap-2',
            'paladin/upgrade-holy-defense-2',
        ];
        const violations: string[] = [];

        for (const [heroId, cards] of Object.entries(heroCardsMap)) {
            for (const card of cards) {
                const replaceEffects = card.effects?.filter((effect) => effect.action?.type === 'replaceAbility') ?? [];
                const nonReplaceEffects = card.effects?.filter((effect) => effect.action?.type !== 'replaceAbility') ?? [];

                if (card.type === 'upgrade') {
                    if (replaceEffects.length === 0) {
                        violations.push(
                            `[${heroId}/${card.id}] type=upgrade 但没有 replaceAbility；老派系升级基线=${upgradeBaselines.join(', ')}`
                        );
                    }
                    if (nonReplaceEffects.length > 0) {
                        violations.push(
                            `[${heroId}/${card.id}] type=upgrade 但混入了直接效果；老派系升级基线=${upgradeBaselines.join(', ')}`
                        );
                    }
                }

                if (card.type === 'action') {
                    if (replaceEffects.length > 0) {
                        violations.push(
                            `[${heroId}/${card.id}] type=action 却写成 replaceAbility；老派系直接结算基线=${directEffectBaselines.join(', ')}`
                        );
                    }
                    if (nonReplaceEffects.length === 0) {
                        violations.push(
                            `[${heroId}/${card.id}] type=action 但没有任何直接结算效果；老派系直接结算基线=${directEffectBaselines.join(', ')}`
                        );
                    }
                }
            }
        }

        expect(violations).toEqual([]);
    });

    it('枪手 / 武士每张升级卡都应逐张落在老派系升级合同上', () => {
        const oldHeroBaselines = {
            variantOffensive: ['monk/card-thrust-punch-2', 'barbarian/upgrade-slap-2', 'paladin/upgrade-righteous-combat-2'],
            pairedLevelUpgrade: ['monk/card-meditation-2', 'moon_elf/upgrade-exploding-arrow-2', 'paladin/upgrade-holy-defense-2'],
            defensiveUpgrade: ['monk/card-meditation-2', 'paladin/upgrade-holy-defense-2'],
            passiveOrUtilityUpgrade: ['barbarian/upgrade-thick-skin-2', 'paladin/upgrade-tithes-2'],
        } as const;

        const newHeroExpectations = [
            { heroId: 'gunslinger', cardId: 'upgrade-revolver-2', targetAbilityId: 'revolver', newAbilityId: 'revolver', level: 2, baseline: 'variantOffensive' },
            { heroId: 'gunslinger', cardId: 'upgrade-bounty-hunter-2', targetAbilityId: 'bounty-hunter', newAbilityId: 'bounty-hunter', level: 2, baseline: 'pairedLevelUpgrade' },
            { heroId: 'gunslinger', cardId: 'upgrade-showdown-2', targetAbilityId: 'showdown', newAbilityId: 'showdown', level: 2, baseline: 'pairedLevelUpgrade' },
            { heroId: 'gunslinger', cardId: 'upgrade-showdown-3', targetAbilityId: 'showdown', newAbilityId: 'showdown', level: 3, baseline: 'pairedLevelUpgrade' },
            { heroId: 'gunslinger', cardId: 'upgrade-fan-the-hammer-2', targetAbilityId: 'fan-the-hammer', newAbilityId: 'fan-the-hammer', level: 2, baseline: 'pairedLevelUpgrade' },
            { heroId: 'gunslinger', cardId: 'upgrade-take-cover-2', targetAbilityId: 'take-cover', newAbilityId: 'take-cover', level: 2, baseline: 'pairedLevelUpgrade' },
            { heroId: 'gunslinger', cardId: 'upgrade-deadeye-2', targetAbilityId: 'deadeye', newAbilityId: 'deadeye', level: 2, baseline: 'pairedLevelUpgrade' },
            { heroId: 'gunslinger', cardId: 'upgrade-duel-2', targetAbilityId: 'duel', newAbilityId: 'duel', level: 2, baseline: 'defensiveUpgrade' },
            { heroId: 'gunslinger', cardId: 'upgrade-quick-draw', targetAbilityId: 'quick-draw', newAbilityId: 'quick-draw', level: 2, baseline: 'passiveOrUtilityUpgrade' },
            { heroId: 'samurai', cardId: 'upgrade-katana-slice-2', targetAbilityId: 'katana-slice', newAbilityId: 'katana-slice', level: 2, baseline: 'variantOffensive' },
            { heroId: 'samurai', cardId: 'upgrade-katana-slice-3', targetAbilityId: 'katana-slice', newAbilityId: 'katana-slice', level: 3, baseline: 'variantOffensive' },
            { heroId: 'samurai', cardId: 'upgrade-wakizashi-2', targetAbilityId: 'wakizashi', newAbilityId: 'wakizashi', level: 2, baseline: 'pairedLevelUpgrade' },
            { heroId: 'samurai', cardId: 'upgrade-wakizashi-3', targetAbilityId: 'wakizashi', newAbilityId: 'wakizashi', level: 3, baseline: 'pairedLevelUpgrade' },
            { heroId: 'samurai', cardId: 'upgrade-solemnity-2', targetAbilityId: 'solemnity', newAbilityId: 'solemnity', level: 2, baseline: 'pairedLevelUpgrade' },
            { heroId: 'samurai', cardId: 'upgrade-budo-2', targetAbilityId: 'budo', newAbilityId: 'budo', level: 2, baseline: 'pairedLevelUpgrade' },
            { heroId: 'samurai', cardId: 'upgrade-masamune-2', targetAbilityId: 'masamune', newAbilityId: 'masamune', level: 2, baseline: 'variantOffensive' },
            { heroId: 'samurai', cardId: 'upgrade-slot-06-2', targetAbilityId: 'samurai-slot-06', newAbilityId: 'samurai-slot-06', level: 2, baseline: 'pairedLevelUpgrade' },
            { heroId: 'samurai', cardId: 'upgrade-stand-tall-2', targetAbilityId: 'stand-tall', newAbilityId: 'stand-tall', level: 2, baseline: 'defensiveUpgrade' },
        ] as const;

        const heroCardsMap: Record<string, AbilityCard[]> = {
            monk: MONK_CARDS,
            barbarian: BARBARIAN_CARDS,
            pyromancer: PYROMANCER_CARDS,
            shadow_thief: SHADOW_THIEF_CARDS,
            moon_elf: MOON_ELF_CARDS,
            paladin: PALADIN_CARDS,
            gunslinger: GUNSLINGER_CARDS,
            samurai: SAMURAI_CARDS,
        };

        const violations: string[] = [];

        for (const expectation of newHeroExpectations) {
            const card = heroCardsMap[expectation.heroId]?.find((item) => item.id === expectation.cardId);
            const replaceAction = card?.effects?.find((effect) => effect.action?.type === 'replaceAbility')?.action;
            if (replaceAction?.type !== 'replaceAbility') {
                violations.push(`[${expectation.heroId}/${expectation.cardId}] 缺少 replaceAbility；老派系参考=${oldHeroBaselines[expectation.baseline].join(', ')}`);
                continue;
            }

            if (replaceAction.targetAbilityId !== expectation.targetAbilityId) {
                violations.push(
                    `[${expectation.heroId}/${expectation.cardId}] targetAbilityId=${replaceAction.targetAbilityId}，期望=${expectation.targetAbilityId}；老派系参考=${oldHeroBaselines[expectation.baseline].join(', ')}`
                );
            }

            if (replaceAction.newAbilityDef.id !== expectation.newAbilityId) {
                violations.push(
                    `[${expectation.heroId}/${expectation.cardId}] newAbilityDef.id=${replaceAction.newAbilityDef.id}，期望=${expectation.newAbilityId}；老派系参考=${oldHeroBaselines[expectation.baseline].join(', ')}`
                );
            }

            if (replaceAction.newAbilityLevel !== expectation.level) {
                violations.push(
                    `[${expectation.heroId}/${expectation.cardId}] newAbilityLevel=${replaceAction.newAbilityLevel}，期望=${expectation.level}；老派系参考=${oldHeroBaselines[expectation.baseline].join(', ')}`
                );
            }
        }

        expect(violations).toEqual([]);
    });
});

// ============================================================================
// 3. 技能效果 target 合理性（abilities 层）
// ============================================================================

describe('技能效果 target 合理性', () => {
    const allEffects = getAllAbilityEffectsFlat();

    it('grantToken 效果不应使用 target:select', () => {
        const violations: string[] = [];
        for (const { heroId, abilityId, variantId, effect } of allEffects) {
            if (!effect.action) continue;
            if (effect.action.type === 'grantToken' && effect.action.target === 'select') {
                const label = variantId ? `${heroId}/${abilityId}/${variantId}` : `${heroId}/${abilityId}`;
                violations.push(
                    `[${label}] grantToken 使用 target:'select'（tokenId: ${effect.action.tokenId}）`
                );
            }
        }
        expect(violations).toEqual([]);
    });
});

// ============================================================================
// 4. bonusCp 参数一致性
// ============================================================================

describe('bonusCp 参数消费一致性', () => {
    const allEffects = getAllAbilityEffectsFlat();

    /**
     * 找出所有传了 params.bonusCp 的 custom action 效果，
     * 验证对应 handler 函数体中包含 bonusCp 读取逻辑。
     *
     * 检测方法：将 handler 函数转为字符串（Function.prototype.toString），
     * 检查是否包含 'bonusCp' 字样。这是一种轻量级的静态分析。
     */
    it('传递 params.bonusCp 的 custom action handler 必须读取 bonusCp', () => {
        const violations: string[] = [];

        for (const { heroId, abilityId, variantId, effect } of allEffects) {
            if (!effect.action) continue;
            if (effect.action.type !== 'custom') continue;

            const params = (effect.action as Record<string, unknown>).params as Record<string, unknown> | undefined;
            if (!params || params.bonusCp === undefined) continue;

            const actionId = effect.action.customActionId;
            if (!actionId) continue;

            const handler = getCustomActionHandler(actionId);
            if (!handler) {
                violations.push(
                    `[${heroId}/${abilityId}] customActionId="${actionId}" 传了 bonusCp=${params.bonusCp} 但 handler 未注册`
                );
                continue;
            }

            // 将 handler 函数转为字符串，检查是否读取了 bonusCp
            const handlerSource = handler.toString();
            if (!handlerSource.includes('bonusCp')) {
                const label = variantId ? `${heroId}/${abilityId}/${variantId}` : `${heroId}/${abilityId}`;
                violations.push(
                    `[${label}] customActionId="${actionId}" 接收 params.bonusCp=${params.bonusCp} 但 handler 函数体中未读取 bonusCp`
                );
            }
        }

        expect(violations).toEqual([]);
    });

    /**
     * 卡牌层同样检查：卡牌效果中传了 params.bonusCp 的 custom action
     */
    it('卡牌效果中传递 params.bonusCp 的 custom action handler 必须读取 bonusCp', () => {
        const violations: string[] = [];
        const allCards = getAllUniqueCards();

        for (const card of allCards) {
            if (!card.effects) continue;
            for (const effect of card.effects) {
                if (!effect.action || effect.action.type !== 'custom') continue;

                const params = (effect.action as Record<string, unknown>).params as Record<string, unknown> | undefined;
                if (!params || params.bonusCp === undefined) continue;

                const actionId = (effect.action as Record<string, unknown>).customActionId as string;
                if (!actionId) continue;

                const handler = getCustomActionHandler(actionId);
                if (!handler) continue; // handler 注册检查由 entity-chain-integrity 覆盖

                const handlerSource = handler.toString();
                if (!handlerSource.includes('bonusCp')) {
                    violations.push(
                        `[card:${card.id}] customActionId="${actionId}" 接收 params.bonusCp=${params.bonusCp} 但 handler 未读取 bonusCp`
                    );
                }
            }
        }

        expect(violations).toEqual([]);
    });
});
