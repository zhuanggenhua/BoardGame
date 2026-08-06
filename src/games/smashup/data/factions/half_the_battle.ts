import type { ActionCardDef, BaseCardDef, CardDef, FusionCardDef, MinionCardDef } from '../../domain/types';
import { SMASHUP_ATLAS_IDS, SMASHUP_FACTION_IDS } from '../../domain/ids';

const GECKOS = SMASHUP_FACTION_IDS.ADOLESCENT_EPIC_GECKOS;
const GI_GERALD = SMASHUP_FACTION_IDS.GI_GERALD;
const COSMOS = SMASHUP_FACTION_IDS.RULERS_OF_THE_COSMOS;
const PEARL_IMAGES = SMASHUP_FACTION_IDS.PEARL_AND_THE_IMAGES;

const GECKOS_ATLAS = SMASHUP_ATLAS_IDS.HALF_THE_BATTLE_GECKOS_CARDS;
const GI_GERALD_ATLAS = SMASHUP_ATLAS_IDS.HALF_THE_BATTLE_GERALD_CARDS;
const COSMOS_ATLAS = SMASHUP_ATLAS_IDS.HALF_THE_BATTLE_COSMOS_CARDS;
const PEARL_IMAGES_ATLAS = SMASHUP_ATLAS_IDS.HALF_THE_BATTLE_PEARL_IMAGES_CARDS;
const BASE_ATLAS = SMASHUP_ATLAS_IDS.HALF_THE_BATTLE_BASES;

export const ADOLESCENT_EPIC_GECKOS_MINIONS: MinionCardDef[] = [
    { id: 'geckos_hokusai', type: 'minion', name: '北斋', nameEn: 'Hokusai', faction: GECKOS, power: 4, abilityTags: ['onPlay', 'talent'], count: 1, previewRef: { type: 'atlas', atlasId: GECKOS_ATLAS, index: 0 } },
    { id: 'geckos_kandinsky', type: 'minion', name: '康定斯基', nameEn: 'Kandinsky', faction: GECKOS, power: 4, abilityTags: ['onPlay', 'talent'], count: 1, previewRef: { type: 'atlas', atlasId: GECKOS_ATLAS, index: 1 } },
    { id: 'geckos_monet', type: 'minion', name: '莫奈', nameEn: 'Monet', faction: GECKOS, power: 4, abilityTags: ['onPlay', 'ongoing'], count: 1, previewRef: { type: 'atlas', atlasId: GECKOS_ATLAS, index: 2 } },
    { id: 'geckos_van_gogh', type: 'minion', name: '梵高', nameEn: 'Van Gogh', faction: GECKOS, power: 4, abilityTags: ['onPlay', 'ongoing'], count: 1, previewRef: { type: 'atlas', atlasId: GECKOS_ATLAS, index: 3 } },
    { id: 'geckos_june', type: 'minion', name: '爱普莉尔·奥尼尔', nameEn: 'June', faction: GECKOS, power: 2, abilityTags: ['onPlay'], count: 4, previewRef: { type: 'atlas', atlasId: GECKOS_ATLAS, index: 4 } },
];

export const ADOLESCENT_EPIC_GECKOS_ACTIONS: ActionCardDef[] = [
    { id: 'geckos_breaking_news', type: 'action', subtype: 'standard', name: '爆炸新闻', nameEn: 'Breaking News', faction: GECKOS, abilityTags: ['onPlay', 'extra'], count: 1, previewRef: { type: 'atlas', atlasId: GECKOS_ATLAS, index: 8 } },
    { id: 'geckos_flip_kick', type: 'action', subtype: 'standard', name: '回旋踢', nameEn: 'Flip Kick', faction: GECKOS, abilityTags: ['onPlay', 'extra'], count: 1, previewRef: { type: 'atlas', atlasId: GECKOS_ATLAS, index: 9 } },
    { id: 'geckos_gecko_blimp', type: 'action', subtype: 'standard', name: '壁虎飞艇', nameEn: 'Gecko Blimp', faction: GECKOS, abilityTags: ['onPlay', 'extra'], count: 1, previewRef: { type: 'atlas', atlasId: GECKOS_ATLAS, index: 10 } },
    { id: 'geckos_gecko_power', type: 'action', subtype: 'ongoing', name: '壁虎力量', nameEn: 'Gecko Power', faction: GECKOS, abilityTags: ['talent'], ongoingTarget: 'minion', playNeedsMinion: true, playTargetMinionController: 'any', count: 1, previewRef: { type: 'atlas', atlasId: GECKOS_ATLAS, index: 11 } },
    { id: 'geckos_gecko_rap', type: 'action', subtype: 'standard', name: '壁虎说唱', nameEn: 'Gecko Rap', faction: GECKOS, abilityTags: ['onPlay', 'extra'], count: 1, previewRef: { type: 'atlas', atlasId: GECKOS_ATLAS, index: 12 } },
    { id: 'geckos_lasagna_party', type: 'action', subtype: 'standard', name: '千层饼派对', nameEn: 'Lasagna Party', faction: GECKOS, abilityTags: ['onPlay', 'extra'], count: 2, previewRef: { type: 'atlas', atlasId: GECKOS_ATLAS, index: 13 } },
    { id: 'geckos_now_you_know_bullying', type: 'action', subtype: 'special', name: '现在你知道：校园暴力', nameEn: 'Now You Know: Bullying', faction: GECKOS, abilityTags: ['onPlay', 'special'], specialTiming: 'afterScoring', count: 1, previewRef: { type: 'atlas', atlasId: GECKOS_ATLAS, index: 15 } },
    { id: 'geckos_masters_teachings', type: 'action', subtype: 'standard', name: '大师的教学', nameEn: "The Master's Teachings", faction: GECKOS, abilityTags: ['onPlay', 'extra'], count: 2, previewRef: { type: 'atlas', atlasId: GECKOS_ATLAS, index: 16 } },
];

export const ADOLESCENT_EPIC_GECKOS_FUSIONS: FusionCardDef[] = [
    {
        id: 'geckos_kc_smith',
        type: 'fusion',
        name: '凯西·琼斯',
        nameEn: 'K.C. Smith',
        faction: GECKOS,
        count: 2,
        previewRef: { type: 'atlas', atlasId: GECKOS_ATLAS, index: 18 },
        minionPower: 3,
        minionAbilityTags: ['extra'],
        actionSubtype: 'standard',
        actionAbilityTags: ['extra'],
    },
];

export const GI_GERALD_MINIONS: MinionCardDef[] = [
    { id: 'gi_gerald_viscount', type: 'minion', name: '子爵', nameEn: 'Viscount', faction: GI_GERALD, power: 5, abilityTags: ['ongoing'], count: 1, previewRef: { type: 'atlas', atlasId: GI_GERALD_ATLAS, index: 0 } },
];

export const GI_GERALD_ACTIONS: ActionCardDef[] = [
    { id: 'gi_gerald_go_gerald', type: 'action', subtype: 'standard', name: '出发，杰拉尔德！', nameEn: 'Go, Gerald!', faction: GI_GERALD, abilityTags: ['onPlay'], count: 1, previewRef: { type: 'atlas', atlasId: GI_GERALD_ATLAS, index: 1 } },
    { id: 'gi_gerald_now_you_know_home_safety', type: 'action', subtype: 'special', name: '现在你知道：家庭安全', nameEn: 'Now You Know: Home Safety', faction: GI_GERALD, abilityTags: ['onPlay', 'special', 'extra'], specialTiming: 'beforeScoring', specialNeedsBase: true, count: 1, previewRef: { type: 'atlas', atlasId: GI_GERALD_ATLAS, index: 2 } },
];

export const GI_GERALD_FUSIONS: FusionCardDef[] = [
    { id: 'gi_gerald_mowat', type: 'fusion', name: '卡车式火炮', nameEn: 'M.O.W.A.T.', faction: GI_GERALD, count: 1, previewRef: { type: 'atlas', atlasId: GI_GERALD_ATLAS, index: 3 }, minionPower: 2, minionAbilityTags: ['onPlay'], actionSubtype: 'standard', actionAbilityTags: ['onPlay'] },
    { id: 'gi_gerald_obstruction', type: 'fusion', name: '路霸', nameEn: 'Obstruction', faction: GI_GERALD, count: 1, previewRef: { type: 'atlas', atlasId: GI_GERALD_ATLAS, index: 4 }, minionPower: 2, minionAbilityTags: ['onPlay'], actionSubtype: 'standard', actionAbilityTags: ['onPlay'] },
    { id: 'gi_gerald_sawbones', type: 'fusion', name: '外科医生', nameEn: 'Sawbones', faction: GI_GERALD, count: 1, previewRef: { type: 'atlas', atlasId: GI_GERALD_ATLAS, index: 5 }, minionPower: 2, minionAbilityTags: ['onPlay'], actionSubtype: 'standard', actionAbilityTags: ['onPlay'] },
    { id: 'gi_gerald_ski_lift', type: 'fusion', name: '滑雪缆车', nameEn: 'Ski Lift', faction: GI_GERALD, count: 1, previewRef: { type: 'atlas', atlasId: GI_GERALD_ATLAS, index: 6 }, minionPower: 2, minionAbilityTags: ['onPlay'], actionSubtype: 'standard', actionAbilityTags: ['onPlay'] },
    { id: 'gi_gerald_can_do', type: 'fusion', name: '偏激者', nameEn: 'Can-Do', faction: GI_GERALD, count: 2, previewRef: { type: 'atlas', atlasId: GI_GERALD_ATLAS, index: 7 }, minionPower: 4, minionAbilityTags: ['onPlay', 'extra'], actionSubtype: 'standard', actionAbilityTags: ['extra'] },
    { id: 'gi_gerald_mabel_lean', type: 'fusion', name: '封面女郎', nameEn: 'Mabel Lean', faction: GI_GERALD, count: 2, previewRef: { type: 'atlas', atlasId: GI_GERALD_ATLAS, index: 9 }, minionPower: 2, minionAbilityTags: ['onPlay'], actionSubtype: 'standard', actionAbilityTags: ['extra'] },
    { id: 'gi_gerald_shellback', type: 'fusion', name: '老水手', nameEn: 'Shellback', faction: GI_GERALD, count: 2, previewRef: { type: 'atlas', atlasId: GI_GERALD_ATLAS, index: 11 }, minionPower: 2, minionAbilityTags: ['onPlay'], actionSubtype: 'standard', actionAbilityTags: ['onPlay'] },
    { id: 'gi_gerald_dice_ninja', type: 'fusion', name: '骰子忍者', nameEn: 'Dice Ninja', faction: GI_GERALD, count: 3, previewRef: { type: 'atlas', atlasId: GI_GERALD_ATLAS, index: 13 }, minionPower: 2, minionAbilityTags: ['onPlay'], actionSubtype: 'standard', actionAbilityTags: ['onPlay'] },
    { id: 'gi_gerald_rosie', type: 'fusion', name: '罗西', nameEn: 'Rosie', faction: GI_GERALD, count: 4, previewRef: { type: 'atlas', atlasId: GI_GERALD_ATLAS, index: 16 }, minionPower: 2, minionAbilityTags: ['onPlay'], actionSubtype: 'standard', actionAbilityTags: ['onPlay'] },
];

export const RULERS_OF_THE_COSMOS_MINIONS: MinionCardDef[] = [
    { id: 'rulers_cosmos_gal_woman', type: 'minion', name: '希瑞', nameEn: 'Gal-Woman', faction: COSMOS, power: 5, abilityTags: ['talent', 'extra'], count: 1, previewRef: { type: 'atlas', atlasId: COSMOS_ATLAS, index: 0 } },
    { id: 'rulers_cosmos_guy_man', type: 'minion', name: '希曼', nameEn: 'Guy-Man', faction: COSMOS, power: 5, abilityTags: ['talent'], count: 1, previewRef: { type: 'atlas', atlasId: COSMOS_ATLAS, index: 1 } },
    { id: 'rulers_cosmos_andko', type: 'minion', name: '奥克', nameEn: 'Andko', faction: COSMOS, power: 3, abilityTags: ['talent', 'extra'], count: 2, previewRef: { type: 'atlas', atlasId: COSMOS_ATLAS, index: 2 } },
    { id: 'rulers_cosmos_man_with_arms', type: 'minion', name: '邓肯武士', nameEn: 'Man with Arms', faction: COSMOS, power: 3, abilityTags: ['talent', 'ongoing'], count: 2, previewRef: { type: 'atlas', atlasId: COSMOS_ATLAS, index: 4 } },
    { id: 'rulers_cosmos_frogga', type: 'minion', name: '蛙人', nameEn: 'Frogga', faction: COSMOS, power: 2, abilityTags: ['onPlay', 'ongoing'], count: 2, previewRef: { type: 'atlas', atlasId: COSMOS_ATLAS, index: 6 } },
    { id: 'rulers_cosmos_young_noble', type: 'minion', name: '年轻的贵族', nameEn: 'Young Noble', faction: COSMOS, power: 2, abilityTags: ['talent'], count: 2, previewRef: { type: 'atlas', atlasId: COSMOS_ATLAS, index: 8 } },
];

export const RULERS_OF_THE_COSMOS_ACTIONS: ActionCardDef[] = [
    { id: 'rulers_cosmos_armor_of_battle', type: 'action', subtype: 'ongoing', name: '战斗盔甲', nameEn: 'Armor of Battle', faction: COSMOS, abilityTags: ['ongoing'], ongoingTarget: 'minion', playNeedsMinion: true, playTargetMinionController: 'any', count: 1, previewRef: { type: 'atlas', atlasId: COSMOS_ATLAS, index: 10 } },
    { id: 'rulers_cosmos_dolts_halfwits_fools_morons', type: 'action', subtype: 'standard', name: '傻瓜们！', nameEn: 'Dolts, Halfwits, Fools, Morons!', faction: COSMOS, abilityTags: ['onPlay'], count: 1, previewRef: { type: 'atlas', atlasId: COSMOS_ATLAS, index: 11 } },
    { id: 'rulers_cosmos_fearless_friend', type: 'action', subtype: 'ongoing', name: '无畏的伙伴', nameEn: 'Fearless Friend', faction: COSMOS, abilityTags: ['ongoing'], ongoingTarget: 'minion', playNeedsMinion: true, playTargetMinionController: 'self', count: 2, previewRef: { type: 'atlas', atlasId: COSMOS_ATLAS, index: 12 } },
    { id: 'rulers_cosmos_magic_weapon', type: 'action', subtype: 'ongoing', name: '魔法武器', nameEn: 'Magic Weapon', faction: COSMOS, abilityTags: ['ongoing'], ongoingTarget: 'minion', playNeedsMinion: true, playTargetMinionController: 'any', count: 1, previewRef: { type: 'atlas', atlasId: COSMOS_ATLAS, index: 14 } },
    { id: 'rulers_cosmos_myaaah', type: 'action', subtype: 'standard', name: '玛雅!', nameEn: 'MYAAAH!', faction: COSMOS, abilityTags: ['onPlay', 'extra'], count: 1, previewRef: { type: 'atlas', atlasId: COSMOS_ATLAS, index: 15 } },
    { id: 'rulers_cosmos_mystic_transference', type: 'action', subtype: 'ongoing', name: '神秘转移', nameEn: 'Mystic Transference', faction: COSMOS, abilityTags: ['ongoing', 'talent'], ongoingTarget: 'minion', playNeedsMinion: true, playTargetMinionController: 'self', count: 1, previewRef: { type: 'atlas', atlasId: COSMOS_ATLAS, index: 16 } },
    { id: 'rulers_cosmos_now_you_know_toxic_waste', type: 'action', subtype: 'special', name: '现在你知道：有毒废弃物', nameEn: 'Now You Know: Toxic Waste', faction: COSMOS, abilityTags: ['onPlay', 'special'], specialTiming: 'beforeScoring', specialNeedsBase: true, count: 1, previewRef: { type: 'atlas', atlasId: COSMOS_ATLAS, index: 17 } },
    { id: 'rulers_cosmos_powerful_sword', type: 'action', subtype: 'ongoing', name: '魔法之剑', nameEn: 'Powerful Sword', faction: COSMOS, abilityTags: ['ongoing', 'talent'], ongoingTarget: 'minion', playNeedsMinion: true, playTargetMinionController: 'self', count: 1, previewRef: { type: 'atlas', atlasId: COSMOS_ATLAS, index: 18 } },
    { id: 'rulers_cosmos_sword_thats_powerful', type: 'action', subtype: 'ongoing', name: '力量之剑', nameEn: "Sword That's Powerful", faction: COSMOS, abilityTags: ['ongoing'], ongoingTarget: 'minion', playNeedsMinion: true, playTargetMinionController: 'self', count: 1, previewRef: { type: 'atlas', atlasId: COSMOS_ATLAS, index: 19 } },
];

export const PEARL_AND_THE_IMAGES_MINIONS: MinionCardDef[] = [
    { id: 'pearl_images_pearl', type: 'minion', name: '珍珠', nameEn: 'Pearl', faction: PEARL_IMAGES, power: 5, abilityTags: ['talent'], count: 1, previewRef: { type: 'atlas', atlasId: PEARL_IMAGES_ATLAS, index: 0 } },
    { id: 'pearl_images_crystal', type: 'minion', name: '水晶', nameEn: 'Crystal', faction: PEARL_IMAGES, power: 4, abilityTags: ['talent'], count: 2, previewRef: { type: 'atlas', atlasId: PEARL_IMAGES_ATLAS, index: 1 } },
    { id: 'pearl_images_ruby', type: 'minion', name: '红宝石', nameEn: 'Ruby', faction: PEARL_IMAGES, power: 2, abilityTags: ['onPlay'], count: 3, previewRef: { type: 'atlas', atlasId: PEARL_IMAGES_ATLAS, index: 3 } },
    { id: 'pearl_images_topaz', type: 'minion', name: '黄玉', nameEn: 'Topaz', faction: PEARL_IMAGES, power: 2, abilityTags: ['ongoing'], count: 4, previewRef: { type: 'atlas', atlasId: PEARL_IMAGES_ATLAS, index: 6 } },
];

export const PEARL_AND_THE_IMAGES_ACTIONS: ActionCardDef[] = [
    { id: 'pearl_images_alls_right_with_the_world', type: 'action', subtype: 'ongoing', name: '世界一切安好', nameEn: "All's Right with the World", faction: PEARL_IMAGES, abilityTags: ['talent'], ongoingTarget: 'base', playNeedsBase: true, count: 1, previewRef: { type: 'atlas', atlasId: PEARL_IMAGES_ATLAS, index: 10 } },
    { id: 'pearl_images_dressing_room', type: 'action', subtype: 'standard', name: '化妆间', nameEn: 'Dressing Room', faction: PEARL_IMAGES, abilityTags: ['onPlay'], count: 1, previewRef: { type: 'atlas', atlasId: PEARL_IMAGES_ATLAS, index: 11 } },
    { id: 'pearl_images_jam_all_night_long', type: 'action', subtype: 'ongoing', name: '玩乐一整夜', nameEn: 'Jam All Night Long', faction: PEARL_IMAGES, abilityTags: ['talent', 'extra'], ongoingTarget: 'base', playNeedsBase: true, count: 2, previewRef: { type: 'atlas', atlasId: PEARL_IMAGES_ATLAS, index: 12 } },
    { id: 'pearl_images_love_unites_us', type: 'action', subtype: 'standard', name: '爱联结我们', nameEn: 'Love Unites Us', faction: PEARL_IMAGES, abilityTags: ['onPlay'], count: 1, previewRef: { type: 'atlas', atlasId: PEARL_IMAGES_ATLAS, index: 14 } },
    { id: 'pearl_images_now_you_know_bike_safety', type: 'action', subtype: 'special', name: '现在你知道：自行车安全', nameEn: 'Now You Know: Bike Safety', faction: PEARL_IMAGES, abilityTags: ['onPlay', 'special'], specialTiming: 'beforeScoring', specialNeedsBase: true, count: 1, previewRef: { type: 'atlas', atlasId: PEARL_IMAGES_ATLAS, index: 15 } },
    { id: 'pearl_images_shes_got_the_power', type: 'action', subtype: 'ongoing', name: '她得到的力量', nameEn: "She's Got the Power", faction: PEARL_IMAGES, abilityTags: ['ongoing'], ongoingTarget: 'minion', playNeedsMinion: true, playTargetMinionController: 'any', count: 2, previewRef: { type: 'atlas', atlasId: PEARL_IMAGES_ATLAS, index: 16 } },
    { id: 'pearl_images_truly_outstanding', type: 'action', subtype: 'standard', name: '杰出表彰', nameEn: 'Truly Outstanding', faction: PEARL_IMAGES, abilityTags: ['onPlay'], count: 1, previewRef: { type: 'atlas', atlasId: PEARL_IMAGES_ATLAS, index: 18 } },
    { id: 'pearl_images_were_up_youre_down', type: 'action', subtype: 'special', name: '我们上，你们下', nameEn: "We're Up, You're Down", faction: PEARL_IMAGES, abilityTags: ['onPlay', 'special'], specialTiming: 'beforeScoring', specialNeedsBase: true, count: 1, previewRef: { type: 'atlas', atlasId: PEARL_IMAGES_ATLAS, index: 19 } },
];

export const ADOLESCENT_EPIC_GECKOS_CARDS: CardDef[] = [
    ...ADOLESCENT_EPIC_GECKOS_MINIONS,
    ...ADOLESCENT_EPIC_GECKOS_ACTIONS,
    ...ADOLESCENT_EPIC_GECKOS_FUSIONS,
];

export const GI_GERALD_CARDS: CardDef[] = [
    ...GI_GERALD_MINIONS,
    ...GI_GERALD_ACTIONS,
    ...GI_GERALD_FUSIONS,
];

export const RULERS_OF_THE_COSMOS_CARDS: CardDef[] = [
    ...RULERS_OF_THE_COSMOS_MINIONS,
    ...RULERS_OF_THE_COSMOS_ACTIONS,
];

export const PEARL_AND_THE_IMAGES_CARDS: CardDef[] = [
    ...PEARL_AND_THE_IMAGES_MINIONS,
    ...PEARL_AND_THE_IMAGES_ACTIONS,
];

export const HALF_THE_BATTLE_CARDS: CardDef[] = [
    ...ADOLESCENT_EPIC_GECKOS_CARDS,
    ...GI_GERALD_CARDS,
    ...RULERS_OF_THE_COSMOS_CARDS,
    ...PEARL_AND_THE_IMAGES_CARDS,
];

export const HALF_THE_BATTLE_BASES: BaseCardDef[] = [
    { id: 'base_sewer_hideout', name: '下水道隐蔽处', nameEn: 'Sewer Hideout', breakpoint: 21, vpAwards: [4, 2, 1], faction: GECKOS, previewRef: { type: 'atlas', atlasId: BASE_ATLAS, index: 0 } },
    { id: 'base_technoball', name: '科技球', nameEn: 'Technoball', breakpoint: 22, vpAwards: [4, 2, 1], faction: GECKOS, previewRef: { type: 'atlas', atlasId: BASE_ATLAS, index: 1 } },
    { id: 'base_gi_geralds_base', name: '杰拉尔德基地', nameEn: "G.I. Gerald's Base", breakpoint: 22, vpAwards: [5, 3, 2], faction: GI_GERALD, previewRef: { type: 'atlas', atlasId: BASE_ATLAS, index: 2 } },
    { id: 'base_uss_banner', name: '美国海军旗帜号', nameEn: 'USS Banner', breakpoint: 20, vpAwards: [4, 2, 1], faction: GI_GERALD, previewRef: { type: 'atlas', atlasId: BASE_ATLAS, index: 3 } },
    { id: 'base_power_castle', name: '力量城堡', nameEn: 'Power Castle', breakpoint: 20, vpAwards: [4, 2, 1], faction: COSMOS, previewRef: { type: 'atlas', atlasId: BASE_ATLAS, index: 4 } },
    { id: 'base_slime_pool', name: '粘液池', nameEn: 'Slime Pool', breakpoint: 20, vpAwards: [3, 2, 1], faction: COSMOS, previewRef: { type: 'atlas', atlasId: BASE_ATLAS, index: 5 } },
    { id: 'base_concert_venue', name: '音乐会场地', nameEn: 'Concert Venue', breakpoint: 20, vpAwards: [3, 1, 1], faction: PEARL_IMAGES, previewRef: { type: 'atlas', atlasId: BASE_ATLAS, index: 6 } },
    { id: 'base_recording_studio', name: '录音室', nameEn: 'Recording Studio', breakpoint: 23, vpAwards: [4, 2, 1], faction: PEARL_IMAGES, previewRef: { type: 'atlas', atlasId: BASE_ATLAS, index: 7 } },
];
