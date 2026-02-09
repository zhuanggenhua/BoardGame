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
} as const;
