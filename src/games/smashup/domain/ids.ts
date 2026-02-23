/**
 * 大杀四方 (Smash Up) - ID 常量定义
 */

export const SMASHUP_ATLAS_IDS = {
    BASE1: 'smashup:base1',
    BASE2: 'smashup:base2',
    BASE3: 'smashup:base3',
    BASE4: 'smashup:base4',
    CARDS1: 'smashup:cards1',
    CARDS2: 'smashup:cards2',
    CARDS3: 'smashup:cards3',
    CARDS4: 'smashup:cards4',
    CARDS5: 'smashup:cards5',
} as const;

export const SMASHUP_CARD_BACK = {
    type: 'atlas',
    atlasId: SMASHUP_ATLAS_IDS.CARDS2,
    index: 55, // 用户指出 cards2 最后一个索引是卡背 (7x8=56)
} as const;

export const SMASHUP_FACTION_IDS = {
    ALIENS: 'aliens',
    DINOSAURS: 'dinosaurs',
    GHOSTS: 'ghosts',
    NINJAS: 'ninjas',
    PIRATES: 'pirates',
    ROBOTS: 'robots',
    TRICKSTERS: 'tricksters',
    WIZARDS: 'wizards',
    ZOMBIES: 'zombies',
    BEAR_CAVALRY: 'bear_cavalry',
    STEAMPUNKS: 'steampunks',
    KILLER_PLANTS: 'killer_plants',
    MINIONS_OF_CTHULHU: 'minions_of_cthulhu',
    ELDER_THINGS: 'elder_things',
    INNSMOUTH: 'innsmouth',
    MISKATONIC_UNIVERSITY: 'miskatonic_university',
    MADNESS: 'madness',
    FRANKENSTEIN: 'frankenstein',
    WEREWOLVES: 'werewolves',
    VAMPIRES: 'vampires',
    GIANT_ANTS: 'giant_ants',
} as const;

/** 派系中文显示名（domain 层使用，避免依赖 i18n） */
export const FACTION_DISPLAY_NAMES: Record<string, string> = {
    [SMASHUP_FACTION_IDS.PIRATES]: '海盗',
    [SMASHUP_FACTION_IDS.NINJAS]: '忍者',
    [SMASHUP_FACTION_IDS.DINOSAURS]: '恐龙',
    [SMASHUP_FACTION_IDS.ALIENS]: '外星人',
    [SMASHUP_FACTION_IDS.ROBOTS]: '机器人',
    [SMASHUP_FACTION_IDS.ZOMBIES]: '丧尸',
    [SMASHUP_FACTION_IDS.WIZARDS]: '巫师',
    [SMASHUP_FACTION_IDS.TRICKSTERS]: '捣蛋鬼',
    [SMASHUP_FACTION_IDS.STEAMPUNKS]: '蒸汽朋克',
    [SMASHUP_FACTION_IDS.GHOSTS]: '幽灵',
    [SMASHUP_FACTION_IDS.KILLER_PLANTS]: '食人花',
    [SMASHUP_FACTION_IDS.BEAR_CAVALRY]: '熊骑兵',
    [SMASHUP_FACTION_IDS.MINIONS_OF_CTHULHU]: '克苏鲁仆从',
    [SMASHUP_FACTION_IDS.ELDER_THINGS]: '远古物种',
    [SMASHUP_FACTION_IDS.INNSMOUTH]: '印斯茅斯',
    [SMASHUP_FACTION_IDS.MISKATONIC_UNIVERSITY]: '米斯卡塔尼克',
    [SMASHUP_FACTION_IDS.MADNESS]: '疯狂',
    [SMASHUP_FACTION_IDS.FRANKENSTEIN]: '科学怪人',
    [SMASHUP_FACTION_IDS.WEREWOLVES]: '狼人',
    [SMASHUP_FACTION_IDS.VAMPIRES]: '吸血鬼',
    [SMASHUP_FACTION_IDS.GIANT_ANTS]: '巨蚁',
};
