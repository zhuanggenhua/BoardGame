// Feature: smashup-full-faction-audit, Property 3: 描述关键词→注册表行为一致性
/**
 * 大杀四方 - 描述关键词→注册表行为一致性属性测试
 *
 * **Validates: Requirements 1.1-1.8, 2.1-2.4, 3.1-3.4, 4.1-4.4, 11.1-11.3**
 *
 * Property 3: 描述关键词→注册表行为一致性
 * 对于任意卡牌，如果其 i18n 描述文本包含特定能力关键词（如"回合开始时抽"→ onTurnStart 触发器、
 * "不能被消灭"→ protection 注册、"+N力量"→ powerModifier 注册），
 * 则对应的注册表中必须存在匹配的条目。
 */

import { describe, it, expect, beforeAll } from 'vitest';
import * as fc from 'fast-check';
import {
    getAllCardDefs,
    getCardDescriptionText,
    validateKeywordRegistration,
    type KeywordMatchResult,
} from './helpers/auditUtils';
import { initAllAbilities, resetAbilityInit } from '../abilities';
import type { CardDef } from '../domain/types';

// ============================================================================
// 初始化：注册所有能力
// ============================================================================

beforeAll(() => {
    resetAbilityInit();
    initAllAbilities();
});

// ============================================================================
// 白名单：已知的误报（描述含关键词但不需要对应注册表条目）
// ============================================================================

/**
 * 关键词匹配误报白名单。
 *
 * 某些卡牌的描述文本包含 KEYWORD_BEHAVIOR_MAP 中的关键词，
 * 但实际上不需要对应的注册表条目。原因包括：
 * - 临时效果（"直到回合结束"）通过事件实现，非 ongoingModifiers
 * - 力量指示物（"+1力量指示物"）通过 counter 系统实现，非 powerModifier
 * - 非 ongoing 卡的保护效果通过能力执行器内联实现
 * - 特殊语境下的关键词（如"特殊"作为标签前缀而非独立含义）
 *
 * 格式：Map<defId, Set<behaviorKey>>
 * behaviorKey 对应 KEYWORD_BEHAVIOR_MAP 中的 key
 */
const KEYWORD_WHITELIST: Map<string, Set<string>> = new Map();

/**
 * 辅助函数：向白名单添加条目
 */
function addToWhitelist(defId: string, ...behaviorKeys: string[]): void {
    if (!KEYWORD_WHITELIST.has(defId)) {
        KEYWORD_WHITELIST.set(defId, new Set());
    }
    for (const key of behaviorKeys) {
        KEYWORD_WHITELIST.get(defId)!.add(key);
    }
}

// ── 力量修正误报：临时效果（"直到回合结束"）通过事件实现 ──
// 这些卡的 "+N力量" 是临时 buff，不需要 ongoingModifiers.power 注册
addToWhitelist('dino_howl', 'powerModifier');              // 每个你的随从获得+1力量直到回合结束
addToWhitelist('dino_augmentation', 'powerModifier');      // 一个随从获得+4力量直到回合结束
addToWhitelist('pirate_swashbuckling', 'powerModifier');   // 你的每个随从获得+1力量直到回合结束
addToWhitelist('innsmouth_the_deep_ones', 'powerModifier'); // 每个你的力量为2或以下的随从获得+1力量直到回合结束
addToWhitelist('miskatonic_psychological_profiling', 'powerModifier'); // 你的每个随从获得+1力量直到回合结束
addToWhitelist('miskatonic_it_might_just_work', 'powerModifier');     // 弃掉疯狂卡使随从获得+1力量直到回合结束
addToWhitelist('werewolf_frenzy', 'powerModifier');        // 每个力量为4或更高的随从获得+1力量直到回合结束
addToWhitelist('werewolf_howler', 'powerModifier');        // 本随从获得+2力量直到回合结束
addToWhitelist('werewolf_teenage_wolf', 'powerModifier');  // 天赋：本随从获得+1力量直到回合结束
addToWhitelist('werewolf_loup_garou', 'powerModifier');    // 异能：本随从获得+2力量直到回合结束
addToWhitelist('werewolf_pack_alpha', 'powerModifier');    // 异能：每个你在这里的随从获得+1力量直到回合结束
addToWhitelist('cthulhu_chosen', 'powerModifier');         // 特殊：该随从获得+2力量直到回合结束

// ── 力量修正误报：力量指示物（+1力量指示物）通过 counter 系统实现 ──
// 注意：大部分 "+1力量指示物" 误报已由 filterWhitelistedMissing 中的系统性过滤处理。
// 以下仅保留描述中同时包含"力量指示物"和真实力量修正的特殊情况。

// ── 力量修正误报：ongoing 随从的力量修正通过 trigger 实现 ──
addToWhitelist('frankenstein_german_engineering', 'powerModifier'); // 通过 onMinionPlayed trigger 放指示物
addToWhitelist('frankenstein_uberserum', 'powerModifier');         // 通过 onTurnStart trigger 放指示物

// ── 力量修正误报：非 ongoing 行动卡的临时力量修正 ──
addToWhitelist('killer_plant_weed_eater', 'powerModifier'); // 随从自身打出回合-2力量（非 ongoing modifier）

// ── 力量修正误报：ongoing 效果通过 dunwich_horror 特殊机制实现 ──
addToWhitelist('elder_thing_dunwich_horror', 'powerModifier'); // 打到随从上+5力量，回合结束消灭（通过 ongoing trigger 实现）

// ── 力量修正误报：特殊计分前临时效果 ──
addToWhitelist('elder_thing_the_price_of_power', 'powerModifier'); // 特殊：计分前临时+2力量
addToWhitelist('miskatonic_mandatory_reading', 'powerModifier');   // 特殊：计分前临时+2力量

// ── 保护效果误报：非 ongoing 卡的内联保护 ──
addToWhitelist('elder_thing_elder_thing', 'ongoingProtection'); // 随从自身"不受对手卡牌的影响"，通过能力执行器实现

// ── 特殊标签误报：描述以"特殊："开头但通过 ongoingEffects.trigger 或其他机制实现 ──
// 这些卡的"特殊"能力通过 beforeScoring/afterScoring trigger 或 beforeScoringPlayable 标记实现，
// 而非 abilityRegistry 的 special 标签。两种实现路径都是合理的。
// 注意：以下卡牌已移除 abilityTags: ['special']，因为它们是被动触发的，不需要主动激活
// - alien_scout: afterScoring trigger（计分后返回手牌）
// - pirate_king: beforeScoring trigger（计分前移动到计分基地）
// - pirate_buccaneer: onMinionDestroyed trigger（被消灭时移动）
// - pirate_first_mate: afterScoring trigger（计分后移动）
// - cthulhu_chosen: beforeScoring trigger（计分前抽疯狂卡+力量）
// - ninja_shinobi: beforeScoringPlayable 标记（Me First! 窗口打出）
// - ninja_hidden_ninja: Me First! 窗口打出的行动卡
// - vampire_buffet: afterScoring trigger（计分后放指示物）

// ── 特殊标签误报：描述含"基地计分前/后"但通过 beforeScoring/afterScoring trigger 实现 ──
// "异能"类卡牌的计分前/后效果通过 trigger 注册，不需要 abilityRegistry::special
addToWhitelist('werewolf_loup_garou', 'special');   // beforeScoring trigger：计分前+2力量
addToWhitelist('werewolf_pack_alpha', 'special');   // beforeScoring trigger：计分前全体+1力量

// ── ongoingTrigger 误报：非 ongoing 卡描述中提到触发时机 ──
addToWhitelist('vampire_summon_wolves', 'powerModifier'); // 通过 onTurnStart trigger 放指示物（在卡上）

// ── 持续效果中的力量修正通过 trigger+counter 实现而非静态 powerModifier ──
addToWhitelist('giant_ant_the_show_must_go_on', 'powerModifier'); // 保护有指示物的随从，非静态 powerModifier
addToWhitelist('giant_ant_the_show_must_go_on', 'ongoingProtection'); // 保护效果通过 trigger 实现
addToWhitelist('giant_ant_we_will_rock_you', 'powerModifier'); // 基于力量指示物数量的临时+力量，通过 addTempPower 事件实现

// ── ongoingTrigger_minionDestroyed 误报：描述中"被消灭后"指自身被消灭（onDestroy），非其他随从 ──
// 这些随从的"被消灭后"效果通过 abilityRegistry::onDestroy 实现，
// 而非 ongoingEffects.trigger::onMinionDestroyed
addToWhitelist('trickster_gremlin', 'ongoingTrigger_minionDestroyed');  // "在这个随从被消灭后" → onDestroy
addToWhitelist('robot_nukebot', 'ongoingTrigger_minionDestroyed');     // "在本随从被消灭后" → onDestroy
addToWhitelist('frankenstein_igor', 'ongoingTrigger_minionDestroyed'); // "在本随从被消灭或者被弃掉之后" → onDestroy trigger

// ── 爆破点修正误报：通过 trigger + modifyBreakpoint 事件实现，非 ongoingModifiers.breakpoint ──
addToWhitelist('werewolf_marking_territory', 'breakpointModifier'); // 回合开始时通过 trigger 降低爆破点
addToWhitelist('killer_plant_overgrowth', 'breakpointModifier');    // 回合开始时通过 trigger 降低爆破点
addToWhitelist('dino_rampage', 'breakpointModifier');               // 非 ongoing 行动卡，临时降低爆破点

// ============================================================================
// 数据准备：收集所有有非空描述的卡牌
// ============================================================================

interface CardWithDescription {
    defId: string;
    cardType: 'minion' | 'action';
    faction: string;
    descriptionText: string;
}

/**
 * 收集所有有非空 i18n 描述的卡牌。
 * 只保留描述文本非空的卡牌（无描述的卡牌无法进行关键词匹配）。
 */
function collectCardsWithDescriptions(): CardWithDescription[] {
    const allCards = getAllCardDefs();
    const cards: CardWithDescription[] = [];

    for (const card of allCards) {
        const descText = getCardDescriptionText(card.id, card.type);
        if (!descText) continue;

        cards.push({
            defId: card.id,
            cardType: card.type,
            faction: card.faction,
            descriptionText: descText,
        });
    }

    return cards;
}

/**
 * 过滤掉白名单中的误报匹配项。
 * 同时过滤掉已知的系统性误报模式。
 */
function filterWhitelistedMissing(
    defId: string,
    descriptionText: string,
    missing: KeywordMatchResult[],
): KeywordMatchResult[] {
    const whitelistedKeys = KEYWORD_WHITELIST.get(defId);
    return missing.filter(m => {
        // 白名单过滤
        if (whitelistedKeys?.has(m.behaviorKey)) return false;

        // 系统性误报过滤 1："+N力量指示物/标记" 不是静态 powerModifier，是 counter 系统
        // 正则 [+＋]\d+力量 会匹配 "+1力量指示物" 和 "+1力量标记"，但这不需要 ongoingModifiers.power
        if (m.behaviorKey === 'powerModifier') {
            const counterPattern = /[+＋]\d+力量(?:指示物|标记)/g;
            if (counterPattern.test(descriptionText)) {
                // 如果描述中只有"力量指示物/标记"形式的力量提及，则为误报
                const textWithoutCounters = descriptionText.replace(/[+＋]\d+力量(?:指示物|标记)/g, '');
                const hasRealPowerMod = /[+＋]\d+力量|力量[+＋]\d+|-\d+力量/.test(textWithoutCounters);
                if (!hasRealPowerMod) return false;
            }
        }

        // 系统性误报过滤 2：ongoing 行动卡描述中"被消灭后"指其他随从被消灭（trigger），
        // 而非卡牌自身被消灭（onDestroy abilityTag）。
        // 模式："当...随从...被消灭后" / "在...随从...被消灭后" → onMinionDestroyed trigger
        if (m.behaviorKey === 'onDestroy' && /持续/.test(descriptionText)) {
            // 持续效果中的"被消灭后"通常指其他随从被消灭的触发器
            if (/当.*随从.*被消灭|在.*随从.*被消灭/.test(descriptionText)) return false;
        }

        return true;
    });
}

// ============================================================================
// 属性测试
// ============================================================================

describe('Property 3: 描述关键词→注册表行为一致性', () => {
    it('所有卡牌描述中的能力关键词在对应注册表中有匹配条目', () => {
        const cards = collectCardsWithDescriptions();

        // 确保有足够的测试数据
        expect(cards.length).toBeGreaterThan(0);

        fc.assert(
            fc.property(
                fc.constantFrom(...cards),
                (card: CardWithDescription) => {
                    const allMissing = validateKeywordRegistration(
                        card.defId,
                        card.descriptionText,
                    );

                    // 过滤白名单中的已知误报
                    const missing = filterWhitelistedMissing(card.defId, card.descriptionText, allMissing);

                    // 属性：过滤白名单后不应有未注册的关键词匹配
                    expect(
                        missing,
                        `卡牌 [${card.defId}] (派系: ${card.faction}, 类型: ${card.cardType}) ` +
                        `描述中的关键词未在对应注册表中找到匹配：\n` +
                        missing
                            .map(
                                m =>
                                    `  - 关键词 "${m.behaviorKey}" (匹配: ${m.matchedKeyword}) ` +
                                    `→ 预期注册表: ${m.expectedRegistry}` +
                                    (m.expectedTag ? ` (tag: ${m.expectedTag})` : '') +
                                    (m.expectedTiming ? ` (timing: ${m.expectedTiming})` : ''),
                            )
                            .join('\n') +
                        `\n  描述: ${card.descriptionText.slice(0, 100)}...`,
                    ).toHaveLength(0);
                },
            ),
            { numRuns: 100 },
        );
    });
});
