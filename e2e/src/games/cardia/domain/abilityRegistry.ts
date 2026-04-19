/**
 * Cardia 能力注册表
 * 使用引擎层 ability.ts 框架
 */

import { createAbilityRegistry } from '../../../engine/primitives/ability';
import type { AbilityDef } from '../../../engine/primitives/ability';
import { ABILITY_IDS } from './ids';

/**
 * 能力触发时机
 */
export type AbilityTrigger = 
    | 'onLose'      // 失败时触发（默认）
    | 'onWin'       // 胜利时触发
    | 'onPlay'      // 打出时触发
    | 'ongoing';    // 持续效果

/**
 * 能力效果类型
 */
export type AbilityEffectType =
    | 'discardBothCards'       // 弃掉本牌和相对的牌
    | 'removeAllMarkers'       // 移除所有修正标记和持续标记
    | 'modifyInfluence'        // 修改影响力
    | 'forceTie'               // 强制平局
    | 'discardFromDeck'        // 从牌库顶弃牌
    | 'revealFirst'            // 对手先揭示
    | 'conditionalInfluence'   // 条件影响力（派系选择）
    | 'winTies'                // 赢得所有平局
    | 'discardByFaction'       // 派系弃牌
    | 'replaceOpponentCard'    // 替换对手卡牌
    | 'modifyMultipleCards'    // 修改多张牌
    | 'extraSignet'            // 额外印戒
    | 'recycleCard'            // 回收卡牌
    | 'copyAbility'            // 复制能力
    | 'win'                    // 直接胜利
    | 'draw'                   // 抽牌
    | 'discard'                // 弃牌
    | 'shuffle'                // 混洗牌库
    | 'conditionalDiscard'     // 条件弃牌
    | 'delayedModify'          // 延迟修改
    | 'conditionalWin';        // 条件胜利

/**
 * 能力效果定义
 */
export interface CardiaAbilityEffect {
    type: AbilityEffectType;
    value?: number;                    // 数值
    target?: 'self' | 'opponent' | 'any'; // 目标
    modifierValue?: number;            // 修正标记值
    requiresChoice?: boolean;          // 是否需要玩家选择
    factionFilter?: boolean;           // 是否按派系过滤
    condition?: string;                // 条件描述
}

/**
 * Cardia 能力定义
 */
export interface CardiaAbilityDef extends AbilityDef<CardiaAbilityEffect, AbilityTrigger> {
    isInstant: boolean;     // 是否为即时能力
    isOngoing: boolean;     // 是否为持续能力
    requiresMarker: boolean; // 是否需要持续标记
}

/**
 * 创建能力注册表
 */
export const abilityRegistry = createAbilityRegistry<CardiaAbilityDef>();

/**
 * ========================================
 * I 牌组能力（16 张）
 * ========================================
 */

// 影响力 1：雇佣剑士 - 弃掉本牌和相对的牌
abilityRegistry.register({
    id: ABILITY_IDS.MERCENARY_SWORDSMAN,
    name: 'abilities.mercenary_swordsman.name',
    description: 'abilities.mercenary_swordsman.description',
    trigger: 'onLose',
    isInstant: true,
    isOngoing: false,
    requiresMarker: false,
    effects: [
        { type: 'discardBothCards' }
    ],
});

// 影响力 2：虚空法师 - 从任一张牌上弃掉所有修正标记和持续标记
abilityRegistry.register({
    id: ABILITY_IDS.VOID_MAGE,
    name: 'abilities.void_mage.name',
    description: 'abilities.void_mage.description',
    trigger: 'onLose',
    isInstant: true,
    isOngoing: false,
    requiresMarker: false,
    effects: [
        { type: 'removeAllMarkers', target: 'any', requiresChoice: true }
    ],
});

// 影响力 3：外科医生 - 为你一张打出的牌添加+5影响力
abilityRegistry.register({
    id: ABILITY_IDS.SURGEON,
    name: 'abilities.surgeon.name',
    description: 'abilities.surgeon.description',
    trigger: 'onLose',
    isInstant: true,
    isOngoing: false,
    requiresMarker: false,
    effects: [
        { type: 'modifyInfluence', target: 'self', modifierValue: 5, requiresChoice: true }
    ],
});

// 影响力 4：调停者 - 🔄 这次遭遇为平局
abilityRegistry.register({
    id: ABILITY_IDS.MEDIATOR,
    name: 'abilities.mediator.name',
    description: 'abilities.mediator.description',
    trigger: 'ongoing',
    isInstant: false,
    isOngoing: true,
    requiresMarker: true,
    effects: [
        { type: 'forceTie' }
    ],
});

// 影响力 5：破坏者 - 你的对手弃掉他牌库的2张顶牌
abilityRegistry.register({
    id: ABILITY_IDS.SABOTEUR,
    name: 'abilities.saboteur.name',
    description: 'abilities.saboteur.description',
    trigger: 'onLose',
    isInstant: true,
    isOngoing: false,
    requiresMarker: false,
    effects: [
        { type: 'discardFromDeck', target: 'opponent', value: 2 }
    ],
});

// 影响力 6：占卜师 - 下一次遭遇中，你的对手必须在你之前朝上打出牌
abilityRegistry.register({
    id: ABILITY_IDS.DIVINER,
    name: 'abilities.diviner.name',
    description: 'abilities.diviner.description',
    trigger: 'onLose',
    isInstant: true,
    isOngoing: false,
    requiresMarker: false,
    effects: [
        { type: 'revealFirst', target: 'opponent' }
    ],
});

// 影响力 7：宫廷卫士 - 你选择一个派系，你的对手可以选择弃掉一张该派系的手牌，否则本牌添加+7影响力
abilityRegistry.register({
    id: ABILITY_IDS.COURT_GUARD,
    name: 'abilities.court_guard.name',
    description: 'abilities.court_guard.description',
    trigger: 'onLose',
    isInstant: true,
    isOngoing: false,
    requiresMarker: false,
    effects: [
        { type: 'conditionalInfluence', modifierValue: 7, factionFilter: true, requiresChoice: true }
    ],
});

// 影响力 8：审判官 - 🔄 你赢得所有平局，包括之后的遭遇。平局不会触发能力
abilityRegistry.register({
    id: ABILITY_IDS.MAGISTRATE,
    name: 'abilities.judge.name',
    description: 'abilities.judge.description',
    trigger: 'ongoing',
    isInstant: false,
    isOngoing: true,
    requiresMarker: true,
    effects: [
        { type: 'winTies' }
    ],
});

// 影响力 9：伏击者 - 选择一个派系，你的对手弃掉所有该派系的手牌
abilityRegistry.register({
    id: ABILITY_IDS.AMBUSHER,
    name: 'abilities.ambusher.name',
    description: 'abilities.ambusher.description',
    trigger: 'onLose',
    isInstant: true,
    isOngoing: false,
    requiresMarker: false,
    effects: [
        { type: 'discardByFaction', target: 'opponent', factionFilter: true, requiresChoice: true }
    ],
});

// 影响力 10：傀儡师 - 弃掉相对的牌，替换为你从对手手牌随机抽取的一张牌。对方的能力不会被触发
abilityRegistry.register({
    id: ABILITY_IDS.PUPPETEER,
    name: 'abilities.puppeteer.name',
    description: 'abilities.puppeteer.description',
    trigger: 'onLose',
    isInstant: true,
    isOngoing: false,
    requiresMarker: false,
    effects: [
        { type: 'replaceOpponentCard' }
    ],
});

// 影响力 11：钟表匠 - 添加+3影响力到你上一个遭遇的牌和你下一次打出的牌
abilityRegistry.register({
    id: ABILITY_IDS.CLOCKMAKER,
    name: 'abilities.clockmaker.name',
    description: 'abilities.clockmaker.description',
    trigger: 'onLose',
    isInstant: true,
    isOngoing: false,
    requiresMarker: false,
    effects: [
        { type: 'modifyMultipleCards', modifierValue: 3, condition: 'previous_and_next' }
    ],
});

// 影响力 12：财务官 - 🔄 上个遭遇获胜的牌额外获得1枚印戒
abilityRegistry.register({
    id: ABILITY_IDS.TREASURER,
    name: 'abilities.treasurer.name',
    description: 'abilities.treasurer.description',
    trigger: 'ongoing',
    isInstant: false,
    isOngoing: true,
    requiresMarker: true,
    effects: [
        { type: 'extraSignet', condition: 'on_any_winner' }
    ],
});

// 影响力 13：沼泽守卫 - 拿取一张你之前打出的牌回到手上，并弃掉其相对的牌
abilityRegistry.register({
    id: ABILITY_IDS.SWAMP_GUARD,
    name: 'abilities.swamp_guard.name',
    description: 'abilities.swamp_guard.description',
    trigger: 'onLose',
    isInstant: true,
    isOngoing: false,
    requiresMarker: false,
    effects: [
        { type: 'recycleCard', target: 'self', requiresChoice: true },
        { type: 'discard', target: 'opponent', condition: 'opposite_card' }
    ],
});

// 影响力 14：女导师 - 复制并发动你的一张影响力不小于本牌的已打出牌的即时能力
abilityRegistry.register({
    id: ABILITY_IDS.GOVERNESS,
    name: 'abilities.governess.name',
    description: 'abilities.governess.description',
    trigger: 'onLose',
    isInstant: true,
    isOngoing: false,
    requiresMarker: false,
    effects: [
        { type: 'copyAbility', target: 'self', requiresChoice: true, condition: 'influence_gte_14' }
    ],
});

// 影响力 15：发明家 - 添加+3影响力到任一张牌，并添加-3影响力到另外任一张牌
abilityRegistry.register({
    id: ABILITY_IDS.INVENTOR,
    name: 'abilities.inventor.name',
    description: 'abilities.inventor.description',
    trigger: 'onLose',
    isInstant: true,
    isOngoing: false,
    requiresMarker: false,
    effects: [
        { type: 'modifyInfluence', target: 'any', modifierValue: 3, requiresChoice: true },
        { type: 'modifyInfluence', target: 'any', modifierValue: -3, requiresChoice: true }
    ],
});

// 影响力 16：精灵 - 你赢得游戏
abilityRegistry.register({
    id: ABILITY_IDS.ELF,
    name: 'abilities.elf.name',
    description: 'abilities.elf.description',
    trigger: 'onLose',
    isInstant: true,
    isOngoing: false,
    requiresMarker: false,
    effects: [
        { type: 'win', target: 'self' }
    ],
});

/**
 * ========================================
 * II 牌组能力（16 张）
 * ========================================
 */

// 影响力 1：毒师 - 降低相对的牌的影响力直到当前遭遇为平局
abilityRegistry.register({
    id: ABILITY_IDS.POISONER,
    name: 'abilities.poisoner.name',
    description: 'abilities.poisoner.description',
    trigger: 'onLose',
    isInstant: true,
    isOngoing: false,
    requiresMarker: false,
    effects: [
        { type: 'modifyInfluence', target: 'opponent', condition: 'force_tie' }
    ],
});

// 影响力 2：念动力法师 - 从你的一张牌移动所有修正标记和持续标记到你的另一张牌
abilityRegistry.register({
    id: ABILITY_IDS.TELEKINETIC_MAGE,
    name: 'abilities.telekinetic_mage.name',
    description: 'abilities.telekinetic_mage.description',
    trigger: 'onLose',
    isInstant: true,
    isOngoing: false,
    requiresMarker: false,
    effects: [
        { type: 'modifyMultipleCards', condition: 'move_markers', requiresChoice: true }
    ],
});

// 影响力 3：使者 - 添加-3影响力到任一张牌或你下一张打出的牌
abilityRegistry.register({
    id: ABILITY_IDS.MESSENGER,
    name: 'abilities.messenger.name',
    description: 'abilities.messenger.description',
    trigger: 'onLose',
    isInstant: true,
    isOngoing: false,
    requiresMarker: false,
    effects: [
        { type: 'modifyInfluence', target: 'any', modifierValue: -3, requiresChoice: true, condition: 'current_or_next' }
    ],
});

// 影响力 4：税务官 - 添加+4影响力到本牌
abilityRegistry.register({
    id: ABILITY_IDS.TAX_COLLECTOR,
    name: 'abilities.tax_collector.name',
    description: 'abilities.tax_collector.description',
    trigger: 'onLose',
    isInstant: true,
    isOngoing: false,
    requiresMarker: false,
    effects: [
        { type: 'modifyInfluence', target: 'self', modifierValue: 4 }
    ],
});

// 影响力 5：革命者 - 你的对手弃掉2张手牌，然后抽取2张牌
abilityRegistry.register({
    id: ABILITY_IDS.REVOLUTIONARY,
    name: 'abilities.revolutionary.name',
    description: 'abilities.revolutionary.description',
    trigger: 'onLose',
    isInstant: true,
    isOngoing: false,
    requiresMarker: false,
    effects: [
        { type: 'discard', target: 'opponent', value: 2, requiresChoice: true },
        { type: 'draw', target: 'opponent', value: 2 }
    ],
});

// 影响力 6：图书管理员 - 在你下一次打出牌并揭示后，添加+2或-2影响力到那张牌上
abilityRegistry.register({
    id: ABILITY_IDS.LIBRARIAN,
    name: 'abilities.librarian.name',
    description: 'abilities.librarian.description',
    trigger: 'onLose',
    isInstant: true,
    isOngoing: false,
    requiresMarker: false,
    effects: [
        { type: 'delayedModify', target: 'self', value: 2, requiresChoice: true, condition: 'next_card' }
    ],
});

// 影响力 7：天才 - 添加+3影响力到你的一张不大于8影响力的牌上
abilityRegistry.register({
    id: ABILITY_IDS.GENIUS,
    name: 'abilities.genius.name',
    description: 'abilities.genius.description',
    trigger: 'onLose',
    isInstant: true,
    isOngoing: false,
    requiresMarker: false,
    effects: [
        { type: 'modifyInfluence', target: 'self', modifierValue: 3, requiresChoice: true, condition: 'influence_lte_8' }
    ],
});

// 影响力 8：贵族 - 如果本牌赢得遭遇，获得额外1枚印戒
abilityRegistry.register({
    id: ABILITY_IDS.ARISTOCRAT,
    name: 'abilities.aristocrat.name',
    description: 'abilities.aristocrat.description',
    trigger: 'onWin',
    isInstant: true,
    isOngoing: false,
    requiresMarker: false,
    effects: [
        { type: 'extraSignet', target: 'self' }
    ],
});

// 影响力 9：勒索者 - 选择一个派系，如果你的对手下一张牌没有打出该派系，则在揭示那张牌后弃掉2张手牌
abilityRegistry.register({
    id: ABILITY_IDS.EXTORTIONIST,
    name: 'abilities.extortionist.name',
    description: 'abilities.extortionist.description',
    trigger: 'onLose',
    isInstant: true,
    isOngoing: false,
    requiresMarker: false,
    effects: [
        { type: 'conditionalDiscard', target: 'opponent', value: 2, factionFilter: true, requiresChoice: true, condition: 'next_card_not_faction' }
    ],
});

// 影响力 10：幻术师 - 发动你一张输掉的牌的能力
abilityRegistry.register({
    id: ABILITY_IDS.ILLUSIONIST,
    name: 'abilities.illusionist.name',
    description: 'abilities.illusionist.description',
    trigger: 'onLose',
    isInstant: true,
    isOngoing: false,
    requiresMarker: false,
    effects: [
        { type: 'copyAbility', target: 'self', requiresChoice: true, condition: 'lost_card' }
    ],
});

// 影响力 11：工程师 - 下一次遭遇发动能力阶段后，添加+5影响力到你打出的牌上
abilityRegistry.register({
    id: ABILITY_IDS.ENGINEER,
    name: 'abilities.engineer.name',
    description: 'abilities.engineer.description',
    trigger: 'onLose',
    isInstant: true,
    isOngoing: false,
    requiresMarker: false,
    effects: [
        { type: 'delayedModify', target: 'self', modifierValue: 5, condition: 'next_encounter_after_ability' }
    ],
});

// 影响力 12：顾问 - 🔄 上一个遭遇中，你的牌获胜且你对手的牌失败
abilityRegistry.register({
    id: ABILITY_IDS.ADVISOR,
    name: 'abilities.advisor.name',
    description: 'abilities.advisor.description',
    trigger: 'ongoing',
    isInstant: false,
    isOngoing: true,
    requiresMarker: true,
    effects: [
        { type: 'extraSignet', condition: 'previous_win_opponent_lose' }
    ],
});

// 影响力 13：巫王 - 选择一个派系，你的对手从手牌和牌库弃掉所有该派系的牌，然后混洗他的牌库
abilityRegistry.register({
    id: ABILITY_IDS.WITCH_KING,
    name: 'abilities.witch_king.name',
    description: 'abilities.witch_king.description',
    trigger: 'onLose',
    isInstant: true,
    isOngoing: false,
    requiresMarker: false,
    effects: [
        { type: 'discardByFaction', target: 'opponent', factionFilter: true, requiresChoice: true, condition: 'hand_and_deck' },
        { type: 'shuffle', target: 'opponent' }
    ],
});

// 影响力 14：元素师 - 弃掉你一张具有即时能力的手牌，复制并发动该能力，然后抽一张牌
abilityRegistry.register({
    id: ABILITY_IDS.ELEMENTALIST,
    name: 'abilities.elementalist.name',
    description: 'abilities.elementalist.description',
    trigger: 'onLose',
    isInstant: true,
    isOngoing: false,
    requiresMarker: false,
    effects: [
        { type: 'discard', target: 'self', value: 1, requiresChoice: true, condition: 'instant_ability' },
        { type: 'copyAbility', target: 'self' },
        { type: 'draw', target: 'self', value: 1 }
    ],
});

// 影响力 15：机械精灵 - 🔄 如果你赢得下一个遭遇，你赢得游戏
abilityRegistry.register({
    id: ABILITY_IDS.MECHANICAL_SPIRIT,
    name: 'abilities.mechanical_spirit.name',
    description: 'abilities.mechanical_spirit.description',
    trigger: 'ongoing',
    isInstant: false,
    isOngoing: true,
    requiresMarker: true,
    effects: [
        { type: 'conditionalWin', condition: 'next_encounter_win' }
    ],
});

// 影响力 16：继承者 - 你的对手保留2张手牌，弃掉其他所有手牌和他的整个牌库
abilityRegistry.register({
    id: ABILITY_IDS.HEIR,
    name: 'abilities.heir.name',
    description: 'abilities.heir.description',
    trigger: 'onLose',
    isInstant: true,
    isOngoing: false,
    requiresMarker: false,
    effects: [
        { type: 'discard', target: 'opponent', value: 2, requiresChoice: true, condition: 'keep_2_discard_rest' }
    ],
});

/**
 * 导出能力注册表
 */
export default abilityRegistry;
