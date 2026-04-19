/**
 * 领域 ID 常量表
 * 所有稳定 ID 必须在此定义，禁止字符串字面量
 */

/**
 * 派系 ID
 */
export const FACTION_IDS = {
    SWAMP: 'swamp',
    ACADEMY: 'academy',
    GUILD: 'guild',
    DYNASTY: 'dynasty',
} as const;

export type FactionId = typeof FACTION_IDS[keyof typeof FACTION_IDS];

/**
 * 阶段 ID
 */
export const PHASE_IDS = {
    PLAY: 'play',           // 阶段1：打出卡牌
    ABILITY: 'ability',     // 阶段2：激活能力
    END: 'end',             // 阶段3：回合结束
} as const;

export type PhaseId = typeof PHASE_IDS[keyof typeof PHASE_IDS];

/**
 * 牌组变体 ID
 */
export const DECK_VARIANT_IDS = {
    I: 'I',
    II: 'II',
} as const;

export type DeckVariantId = typeof DECK_VARIANT_IDS[keyof typeof DECK_VARIANT_IDS];

/**
 * 能力 ID - I 牌组
 */
export const ABILITY_IDS_DECK_I = {
    // 影响力 1-4
    MERCENARY_SWORDSMAN: 'ability_i_mercenary_swordsman',  // 雇佣剑士：弃掉本牌和相对的牌
    VOID_MAGE: 'ability_i_void_mage',                      // 虚空法师：从任一张牌上弃掉所有修正标记和持续标记
    SURGEON: 'ability_i_surgeon',                          // 外科医生：为你下一张打出的牌添加-5影响力
    MEDIATOR: 'ability_i_mediator',                        // 调停者：🔄 这次遭遇为平局
    
    // 影响力 5-8
    SABOTEUR: 'ability_i_saboteur',                        // 破坏者：你的对手弃掉他牌库的2张顶牌
    DIVINER: 'ability_i_diviner',                          // 占卜师：下一次遭遇中，你的对手必须在你之前朝上打出牌
    COURT_GUARD: 'ability_i_court_guard',                  // 宫廷卫士：你选择一个派系，你的对手可以选择弃掉一张该派系的手牌，否则本牌添加+7影响力
    MAGISTRATE: 'ability_i_magistrate',                    // 审判官：🔄 你赢得所有平局，包括之后的遭遇。平局不会触发能力
    
    // 影响力 9-12
    AMBUSHER: 'ability_i_ambusher',                        // 伏击者：选择一个派系，你的对手弃掉所有该派系的手牌
    PUPPETEER: 'ability_i_puppeteer',                      // 傀儡师：弃掉相对的牌，替换为你从对手手牌随机抽取的一张牌。对方的能力不会被触发
    CLOCKMAKER: 'ability_i_clockmaker',                    // 钟表匠：添加+3影响力到你上一个遭遇的牌和你下一次打出的牌
    TREASURER: 'ability_i_treasurer',                      // 财务官：🔄 上个遭遇获胜的牌额外获得1枚印戒
    
    // 影响力 13-16
    SWAMP_GUARD: 'ability_i_swamp_guard',                  // 沼泽守卫：拿取一张你之前打出的牌回到手上，并弃掉其相对的牌
    GOVERNESS: 'ability_i_governess',                      // 女导师：复制并发动你的一张影响力不小于本牌的已打出牌的即时能力
    INVENTOR: 'ability_i_inventor',                        // 发明家：添加+3影响力到任一张牌，并添加-3影响力到另外任一张牌
    ELF: 'ability_i_elf',                                  // 精灵：你赢得游戏
} as const;

/**
 * 能力 ID - II 牌组
 */
export const ABILITY_IDS_DECK_II = {
    // 影响力 1-4
    POISONER: 'ability_ii_poisoner',             // 毒师：降低相对的牌的影响力直到当前遭遇为平局
    TELEKINETIC_MAGE: 'ability_ii_telekinetic_mage', // 念动力法师：从你的一张牌移动所有修正标记和持续标记到你的另一张牌
    MESSENGER: 'ability_ii_messenger',           // 使者：添加-3影响力到任一张牌或你下一张打出的牌
    TAX_COLLECTOR: 'ability_ii_tax_collector',   // 税务官：添加+4影响力到本牌
    
    // 影响力 5-8
    REVOLUTIONARY: 'ability_ii_revolutionary',   // 革命者：你的对手弃掉2张手牌，然后抽取2张牌
    LIBRARIAN: 'ability_ii_librarian',           // 图书管理员：在你下一次打出牌并揭示后，添加+2或-2影响力到那张牌上
    GENIUS: 'ability_ii_genius',                 // 天才：添加+3影响力到你的一张不大于8影响力的牌上
    ARISTOCRAT: 'ability_ii_aristocrat',         // 贵族：如果本牌赢得遭遇，获得额外1枚印戒
    
    // 影响力 9-11
    EXTORTIONIST: 'ability_ii_extortionist',     // 勒索者：选择一个派系，如果你的对手下一张牌没有打出该派系，则在揭示那张牌后弃掉2张手牌
    ILLUSIONIST: 'ability_ii_illusionist',       // 幻术师：发动你一张输掉的牌的能力
    ENGINEER: 'ability_ii_engineer',             // 工程师：下一次遭遇发动能力阶段后，添加+5影响力到你打出的牌上
    
    // 影响力 12-16
    ADVISOR: 'ability_ii_advisor',               // 顾问：🔄 你赢的上一次遭遇，即使是平局
    WITCH_KING: 'ability_ii_witch_king',         // 巫王：选择一个派系，你的对手从手牌和牌库弃掉所有该派系的牌，然后混洗他的牌库
    ELEMENTALIST: 'ability_ii_elementalist',     // 元素师：弃掉你一张具有即时能力的手牌，复制并发动该能力，然后抽一张牌
    MECHANICAL_SPIRIT: 'ability_ii_mechanical_spirit', // 机械精灵：🔄 如果你赢得下一个遭遇，你赢得游戏
    HEIR: 'ability_ii_heir',                     // 继承者：你的对手保留2张手牌，弃掉其他所有手牌和他的整个牌库
} as const;

/**
 * 所有能力 ID
 */
export const ABILITY_IDS = {
    ...ABILITY_IDS_DECK_I,
    ...ABILITY_IDS_DECK_II,
} as const;

export type AbilityId = typeof ABILITY_IDS[keyof typeof ABILITY_IDS];

/**
 * 卡牌 ID - I 牌组
 */
export const CARD_IDS_DECK_I = {
    CARD_01: 'deck_i_card_01', // 雇佣剑士
    CARD_02: 'deck_i_card_02', // 虚空法师
    CARD_03: 'deck_i_card_03', // 外科医生
    CARD_04: 'deck_i_card_04', // 调停者
    CARD_05: 'deck_i_card_05', // 破坏者
    CARD_06: 'deck_i_card_06', // 占卜师
    CARD_07: 'deck_i_card_07', // 宫廷卫士
    CARD_08: 'deck_i_card_08', // 审判官
    CARD_09: 'deck_i_card_09', // 伏击者
    CARD_10: 'deck_i_card_10', // 傀儡师
    CARD_11: 'deck_i_card_11', // 钟表匠
    CARD_12: 'deck_i_card_12', // 财务官
    CARD_13: 'deck_i_card_13', // 沼泽守卫
    CARD_14: 'deck_i_card_14', // 女导师
    CARD_15: 'deck_i_card_15', // 发明家
    CARD_16: 'deck_i_card_16', // 精灵
} as const;

/**
 * 卡牌 ID - II 牌组
 */
export const CARD_IDS_DECK_II = {
    CARD_01: 'deck_ii_card_01', // 毒师
    CARD_02: 'deck_ii_card_02', // 念动力法师
    CARD_03: 'deck_ii_card_03', // 使者
    CARD_04: 'deck_ii_card_04', // 税务官
    CARD_05: 'deck_ii_card_05', // 革命者
    CARD_06: 'deck_ii_card_06', // 图书管理员
    CARD_07: 'deck_ii_card_07', // 天才
    CARD_08: 'deck_ii_card_08', // 贵族
    CARD_09: 'deck_ii_card_09', // 勒索者
    CARD_10: 'deck_ii_card_10', // 幻术师
    CARD_11: 'deck_ii_card_11', // 工程师
    CARD_12: 'deck_ii_card_12', // 顾问
    CARD_13: 'deck_ii_card_13', // 巫王
    CARD_14: 'deck_ii_card_14', // 元素师
    CARD_15: 'deck_ii_card_15', // 机械精灵
    CARD_16: 'deck_ii_card_16', // 继承者
} as const;

/**
 * 所有卡牌 ID
 */
export const CARD_IDS = {
    ...CARD_IDS_DECK_I,
    ...CARD_IDS_DECK_II,
} as const;

export type CardId = typeof CARD_IDS[keyof typeof CARD_IDS];

/**
 * 修正标记 ID
 */
export const MODIFIER_TOKEN_IDS = {
    PLUS_1: 'modifier_plus_1',
    PLUS_3: 'modifier_plus_3',
    PLUS_5: 'modifier_plus_5',
    MINUS_1: 'modifier_minus_1',
    MINUS_3: 'modifier_minus_3',
    MINUS_5: 'modifier_minus_5',
} as const;

export type ModifierTokenId = typeof MODIFIER_TOKEN_IDS[keyof typeof MODIFIER_TOKEN_IDS];
