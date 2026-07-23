import type { ActionCardDef, CardDef, MinionCardDef } from '../../domain/types';
import { SMASHUP_ATLAS_IDS, SMASHUP_FACTION_IDS } from '../../domain/ids';

const ZHONGGUO_ATLAS = SMASHUP_ATLAS_IDS.CARDS13;
const KUNG_FU_FIGHTERS_ATLAS = SMASHUP_ATLAS_IDS.KUNG_FU_FIGHTERS_POD_CARDS;

function minion(
    id: string,
    name: string,
    nameEn: string,
    faction: string,
    power: number,
    count: number,
    index: number,
    extras: Partial<MinionCardDef> = {},
): MinionCardDef {
    return {
        id,
        type: 'minion',
        name,
        nameEn,
        faction,
        power,
        count,
        previewRef: { type: 'atlas', atlasId: ZHONGGUO_ATLAS, index },
        ...extras,
    };
}

function action(
    id: string,
    name: string,
    nameEn: string,
    faction: string,
    count: number,
    index: number,
    extras: Partial<ActionCardDef> = {},
): ActionCardDef {
    return {
        id,
        type: 'action',
        subtype: 'standard',
        name,
        nameEn,
        faction,
        count,
        previewRef: { type: 'atlas', atlasId: ZHONGGUO_ATLAS, index },
        ...extras,
    };
}

function kungFuMinion(
    id: string,
    name: string,
    nameEn: string,
    power: number,
    count: number,
    index: number,
    extras: Partial<MinionCardDef> = {},
): MinionCardDef {
    return minion(id, name, nameEn, KUNG_FU_FIGHTERS, power, count, index, {
        previewRef: { type: 'atlas', atlasId: KUNG_FU_FIGHTERS_ATLAS, index },
        ...extras,
    });
}

function kungFuAction(
    id: string,
    name: string,
    nameEn: string,
    count: number,
    index: number,
    extras: Partial<ActionCardDef> = {},
): ActionCardDef {
    return action(id, name, nameEn, KUNG_FU_FIGHTERS, count, index, {
        previewRef: { type: 'atlas', atlasId: KUNG_FU_FIGHTERS_ATLAS, index },
        ...extras,
    });
}

const KUNG_FU_FIGHTERS = SMASHUP_FACTION_IDS.KUNG_FU_FIGHTERS;
const VIGILANTES = SMASHUP_FACTION_IDS.VIGILANTES;
const TRUCKERS = SMASHUP_FACTION_IDS.TRUCKERS;
const DISCO_DANCERS = SMASHUP_FACTION_IDS.DISCO_DANCERS;

export const KUNG_FU_FIGHTERS_CARDS: CardDef[] = [
    kungFuAction('kung_fu_fighters_fast_as_lightning', '快如闪电', 'Fast as Lightning', 2, 8, {
        abilityTags: ['onPlay'],
    }),
    kungFuMinion('kung_fu_fighters_dragon_warrior', '神龙武者', 'Dragon Warrior', 5, 1, 19, {
        abilityTags: ['ongoing', 'talent'],
    }),
    kungFuMinion('kung_fu_fighters_cricket', '蟋蟀', 'Cricket', 2, 4, 10, {
        abilityTags: ['onPlay'],
    }),
    kungFuAction('kung_fu_fighters_oh_hoh_hoh_hoah', '哦-厚-厚-厚-厚', 'Oh-hoh-hoh-hoah', 1, 7, {
        subtype: 'ongoing',
        ongoingTarget: 'base',
        playNeedsBase: true,
        abilityTags: ['ongoing'],
    }),
    kungFuAction('kung_fu_fighters_everybody_knew_their_part', '各尽其责', 'Everybody Knew Their Part', 1, 6, {
        abilityTags: ['onPlay'],
    }),
    kungFuAction('kung_fu_fighters_everybody_was_kung_fu_fighting', '人人都是功夫高手', 'Everybody was Kung Fu Fighting', 1, 0, {
        abilityTags: ['onPlay'],
    }),
    kungFuAction('kung_fu_fighters_expert_timing', '掌握时机', 'Expert Timing', 1, 1, {
        subtype: 'special',
        specialTiming: 'beforeScoring',
        abilityTags: ['onPlay', 'special'],
    }),
    kungFuAction('kung_fu_fighters_ancient_chinese_art', '古老的中国艺术', 'Ancient Chinese Art', 2, 2, {
        subtype: 'ongoing',
        ongoingTarget: 'base',
        playNeedsBase: true,
        abilityTags: ['ongoing', 'talent'],
    }),
    kungFuAction('kung_fu_fighters_a_little_bit_frightening', '有些胆寒', 'A Little Bit Frightening', 1, 4, {
        abilityTags: ['onPlay'],
    }),
    kungFuMinion('kung_fu_fighters_drunken_master', '醉酒宗师', 'Drunken Master', 3, 3, 14, {
        abilityTags: ['talent'],
    }),
    kungFuMinion('kung_fu_fighters_lady_whirlwind', '旋风女侠', 'Lady Whirlwind', 4, 2, 17, {
        abilityTags: ['talent'],
    }),
    kungFuAction('kung_fu_fighters_lets_get_it_on', '让我们躁起来', "Let's Get It On", 1, 5, {
        abilityTags: ['onPlay'],
    }),
];

export const VIGILANTES_CARDS: CardDef[] = [
    action('vigilantes_shrug_it_off', '不屑一顾', 'Shrug it Off', VIGILANTES, 1, 12, {
        subtype: 'ongoing',
        ongoingTarget: 'base',
        playNeedsBase: true,
        abilityTags: ['ongoing', 'talent'],
    }),
    action('vigilantes_scared_straight', '直面恐惧', 'Scared Straight', VIGILANTES, 1, 13, {
        abilityTags: ['onPlay'],
    }),
    action('vigilantes_who_loves_ya_baby', '谁爱你，小老弟？', 'Who Loves Ya, Baby?', VIGILANTES, 2, 14, {
        abilityTags: ['onPlay'],
    }),
    action('vigilantes_a_whole_lot_meaner', '凶恶百倍', 'A Whole Lot Meaner', VIGILANTES, 1, 15, {
        abilityTags: ['onPlay'],
    }),
    minion('vigilantes_death_wisher', '猛龙怪客', 'Death Wisher', VIGILANTES, 4, 1, 16, {
        abilityTags: ['ongoing'],
    }),
    action('vigilantes_tough_it_out', '咬紧牙关', 'Tough It Out', VIGILANTES, 2, 17, {
        subtype: 'ongoing',
        ongoingTarget: 'minion',
        abilityTags: ['ongoing'],
    }),
    action('vigilantes_the_revenge', '复仇', 'The Revenge', VIGILANTES, 1, 18, {
        subtype: 'special',
        specialTiming: 'afterScoring',
        specialNeedsBase: true,
        abilityTags: ['special'],
    }),
    minion('vigilantes_brojak', '神探布洛杰克', 'Brojak', VIGILANTES, 4, 1, 19, {
        abilityTags: ['ongoing'],
    }),
    minion('vigilantes_stoneford', '破萝飞龙', 'Stoneford', VIGILANTES, 4, 1, 20, {
        abilityTags: ['onPlay'],
    }),
    minion('vigilantes_jacky_bill', '杰基比尔', 'Jacky Bill', VIGILANTES, 4, 1, 21, {
        abilityTags: ['ongoing'],
    }),
    action('vigilantes_make_my_day', '一天的快乐', 'Make My Day', VIGILANTES, 1, 22, {
        abilityTags: ['onPlay'],
    }),
    action('vigilantes_street_justice', '街头正义', 'Street Justice', VIGILANTES, 1, 23, {
        subtype: 'ongoing',
        ongoingTarget: 'base',
        playNeedsBase: true,
        abilityTags: ['ongoing'],
    }),
    minion('vigilantes_shift', '铁杆神探', 'Shift', VIGILANTES, 4, 1, 24, {
        abilityTags: ['onPlay'],
    }),
    minion('vigilantes_dusty_henry', '瞌睡的亨利', 'Dusty Henry', VIGILANTES, 4, 1, 25, {
        abilityTags: ['onPlay'],
    }),
    action('vigilantes_knocked_into_next_week', '打到穿越', 'Knocked into Next Week', VIGILANTES, 1, 26, {
        abilityTags: ['onPlay'],
    }),
    action('vigilantes_feeling_lucky', '觉得运气不错？', 'Feeling Lucky?', VIGILANTES, 1, 27, {
        subtype: 'ongoing',
        ongoingTarget: 'minion',
        abilityTags: ['ongoing'],
    }),
    action('vigilantes_lets_finish_this', '做个了断吧', "Let's Finish This", VIGILANTES, 1, 28, {
        subtype: 'ongoing',
        ongoingTarget: 'base',
        playNeedsBase: true,
        abilityTags: ['ongoing'],
    }),
    minion('vigilantes_foxy_green', '狐狸翠', 'Foxy Green', VIGILANTES, 4, 1, 29, {
        abilityTags: ['ongoing'],
    }),
];

export const TRUCKERS_CARDS: CardDef[] = [
    action('truckers_fixin_to_fix_it', '修理', "Fixin' to Fix It", TRUCKERS, 1, 30, {
        abilityTags: ['onPlay'],
    }),
    action('truckers_dekotora', '暴走卡车', 'Dekotora', TRUCKERS, 1, 31, {
        subtype: 'ongoing',
        ongoingTarget: 'base',
        playNeedsBase: true,
        abilityTags: ['ongoing', 'talent'],
    }),
    action('truckers_high_speed_chase', '高速追逐战', 'High-Speed Chase', TRUCKERS, 1, 32, {
        subtype: 'ongoing',
        ongoingTarget: 'base',
        playNeedsBase: true,
        abilityTags: ['ongoing', 'talent'],
    }),
    minion('truckers_rubber_chicken', '橡皮鸡', 'Rubber Chicken', TRUCKERS, 4, 2, 33, {
        abilityTags: ['ongoing'],
    }),
    action('truckers_hotwire', '短路点火', 'Hotwire', TRUCKERS, 1, 34, {
        abilityTags: ['onPlay'],
    }),
    minion('truckers_skinny_minnie', '皮包骨米妮', 'Skinny Minnie', TRUCKERS, 3, 3, 35, {
        abilityTags: ['talent'],
    }),
    minion('truckers_el_bandido', '埃尔班迪多', 'El Bandido', TRUCKERS, 5, 1, 36, {
        abilityTags: ['onPlay', 'talent'],
    }),
    action('truckers_rally', '车友聚会', 'Rally', TRUCKERS, 1, 37, {
        subtype: 'special',
        specialTiming: 'beforeScoring',
        specialNeedsBase: true,
        abilityTags: ['special'],
    }),
    minion('truckers_good_buddy', '好伙伴', 'Good Buddy', TRUCKERS, 2, 4, 38, {
        abilityTags: ['onPlay'],
    }),
    action('truckers_convoy', '车队', 'Convoy', TRUCKERS, 2, 39, {
        subtype: 'ongoing',
        ongoingTarget: 'base',
        playNeedsBase: true,
        abilityTags: ['ongoing'],
    }),
    action('truckers_cab_over_pete', '平头彼特', 'Cab-over Pete', TRUCKERS, 1, 40, {
        subtype: 'ongoing',
        ongoingTarget: 'base',
        playNeedsBase: true,
        abilityTags: ['ongoing', 'talent'],
    }),
    action('truckers_armored_truck', '装甲卡车', 'Armored Truck', TRUCKERS, 1, 41, {
        subtype: 'ongoing',
        ongoingTarget: 'base',
        playNeedsBase: true,
        abilityTags: ['ongoing'],
    }),
    action('truckers_turn_the_beat_around', '节拍一转', 'Turn The Beat Around', TRUCKERS, 1, 42, {
        subtype: 'special',
        specialTiming: 'beforeScoring',
        specialNeedsBase: true,
        abilityTags: ['onPlay', 'special'],
    }),
];

export const DISCO_DANCERS_CARDS: CardDef[] = [
    minion('disco_dancers_diva', '主唱', 'Diva', DISCO_DANCERS, 3, 3, 43, {
        abilityTags: ['ongoing'],
    }),
    action('disco_dancers_get_down_tonight', '就在今晚', 'Get Down Tonight', DISCO_DANCERS, 2, 44, {
        abilityTags: ['onPlay'],
    }),
    minion('disco_dancers_ul_disco_lou', '迪斯科·卢', 'UL Disco Lou', DISCO_DANCERS, 4, 2, 45, {
        abilityTags: ['onPlay', 'extra'],
    }),
    action('disco_dancers_we_are_family', '我们是一家人', 'We Are Family', DISCO_DANCERS, 1, 46, {
        subtype: 'ongoing',
        ongoingTarget: 'minion',
        abilityTags: ['ongoing'],
    }),
    action('disco_dancers_disco_inferno', '迪斯科地狱', 'Disco Inferno', DISCO_DANCERS, 1, 47, {
        abilityTags: ['onPlay'],
    }),
    minion('disco_dancers_roller', '轮滑舞娘', 'Roller', DISCO_DANCERS, 2, 4, 48, {
        abilityTags: ['ongoing'],
    }),
    action('disco_dancers_celebration', '庆祝', 'Celebration', DISCO_DANCERS, 1, 49, {
        abilityTags: ['onPlay', 'extra'],
    }),
    action('disco_dancers_i_will_survive', '我会活下去', 'I Will Survive', DISCO_DANCERS, 1, 50, {
        subtype: 'special',
        specialTiming: 'afterScoring',
        specialNeedsBase: true,
        abilityTags: ['special'],
    }),
    action('disco_dancers_its_raining_men', '男人雨', "It's Raining Men", DISCO_DANCERS, 1, 51, {
        abilityTags: ['onPlay', 'extra'],
    }),
    minion('disco_dancers_dancing_king', '舞王', 'Dancing King', DISCO_DANCERS, 5, 1, 52, {
        abilityTags: ['ongoing'],
    }),
    action('disco_dancers_im_so_excited', '我很亢奋', "I'm So Excited", DISCO_DANCERS, 1, 53, {
        abilityTags: ['onPlay'],
    }),
    action('disco_dancers_last_dance', '最后的舞曲', 'Last Dance', DISCO_DANCERS, 1, 54, {
        abilityTags: ['onPlay'],
    }),
    action('disco_dancers_stayin_alive', '活着', "Stayin' Alive", DISCO_DANCERS, 1, 55, {
        abilityTags: ['onPlay'],
    }),
];
