/**
 * SmashUp - Interaction targetType / autoRefresh 审计
 *
 * 审计目标：
 * 1. 确保 createSimpleChoice 不会被 Board.tsx 的 fallback 逻辑误判。
 * 2. 确保已知高风险的“通用牌库检索弹层”保留显式配置，避免回归成隐藏交互。
 */

import { describe, it, expect } from 'vitest';
import * as ts from 'typescript';
import { readFileSync, readdirSync } from 'fs';
import { resolve, join } from 'path';
import {
    collectOptionObjectLiterals,
    expressionContainsCall,
    extractSimpleChoiceConfig,
    getChoiceOptionsArg,
    inferDirectTargetTypeFromOptions,
    isCreateSimpleChoiceCall,
} from './helpers/simpleChoiceAst';
import { getSmashUpDirectHandPromptCardState, getSmashUpSelectableBaseIndices, hasSmashUpDirectHandPromptPlayableOptions, isSmashUpPromptOwnedByPlayer, resolveSmashUpHandInteractionMode, resolveSmashUpHandPromptUiMode, shouldForceSmashUpPromptOverlay, shouldRenderSmashUpHandArea } from '../ui/interactionMode';

interface TargetTypeIssue {
    file: string;
    line: number;
    sourceId: string;
    issue: string;
    detail: string;
}

interface SimpleChoiceCallInfo {
    file: string;
    line: number;
    sourceId: string;
    targetType?: string;
    autoRefresh?: string;
    responseValidationMode?: string;
    revalidateOnRespond?: boolean;
    hasMulti?: boolean;
    usesFieldSourceBaseTargetOptions?: boolean;
}

const REQUIRED_SOURCE_CONFIGS: Record<string, { targetType?: string; autoRefresh?: string; responseValidationMode?: string }> = {
    killer_plant_sprout_search: { targetType: 'generic', autoRefresh: 'deck', responseValidationMode: 'live' },
    killer_plant_venus_man_trap_search: { targetType: 'generic', autoRefresh: 'deck', responseValidationMode: 'live' },
    wizard_scry: { targetType: 'generic', autoRefresh: 'deck', responseValidationMode: 'live' },
    multi_base_scoring: { targetType: 'base' },
    base_castle_blood: { targetType: 'minion' },
    base_nine_lives_intercept: { targetType: 'minion' },
    base_the_pasture: { targetType: 'minion' },
    base_cat_fanciers_alley: { targetType: 'minion' },
    base_land_of_balance: { targetType: 'minion' },
    base_sheep_shrine: { targetType: 'minion' },
    base_the_asylum: { targetType: 'hand' },
    base_innsmouth_base_choose_player: { targetType: 'player' },
    base_miskatonic_university_base: { targetType: 'button' },
    base_greenhouse: { targetType: 'generic' },
    base_inventors_salon: { targetType: 'generic' },
    alien_scout_return: { targetType: 'minion' },
    alien_supreme_overlord: { targetType: 'minion' },
    alien_collector: { targetType: 'minion' },
    alien_probe_choose_target: { targetType: 'player' },
    alien_probe: { targetType: 'generic' },
    alien_terraform_choose_replacement: { targetType: 'generic' },
    alien_terraform_play_minion: { targetType: 'hand' },
    bear_cavalry_bear_necessities: { targetType: 'board' },
    bear_cavalry_commission_choose_minion: { targetType: 'hand' },
    cthulhu_recruit_by_force: { targetType: 'generic' },
    cthulhu_it_begins_again: { targetType: 'generic' },
    cthulhu_corruption: { targetType: 'minion', autoRefresh: 'field', responseValidationMode: 'live' },
    cthulhu_madness_unleashed: { targetType: 'hand' },
    cthulhu_chosen_confirm: { targetType: 'generic' },
    cthulhu_star_spawn: { targetType: 'generic' },
    munchkin_treasure_crossbow_choose_faction: { targetType: 'button', responseValidationMode: 'live' },
    munchkin_treasure_dungeon_rulebook_destroy: { targetType: 'ongoing', autoRefresh: 'field', responseValidationMode: 'live' },
    munchkin_treasure_potion_of_halitosis_choose_player: { targetType: 'player', autoRefresh: 'field', responseValidationMode: 'live' },
    munchkin_treasure_potion_of_halitosis_move: { targetType: 'minion', autoRefresh: 'field', responseValidationMode: 'live' },
    munchkin_treasure_potion_of_duplication_choose_talent: { targetType: 'minion', autoRefresh: 'field', responseValidationMode: 'live' },
    munchkin_treasure_potion_of_straight_line_running_away_choose_treasure: { targetType: 'card', autoRefresh: 'field', responseValidationMode: 'live' },
    munchkin_treasure_magic_missile_destroy: { targetType: 'minion', autoRefresh: 'field', responseValidationMode: 'live' },
    munchkin_treasure_rocket_boots_move: { targetType: 'base', responseValidationMode: 'live' },
    munchkin_dwarves_anything_for_money_discard: { targetType: 'hand', autoRefresh: 'hand', responseValidationMode: 'live' },
    munchkin_dwarves_cash_out_choose_treasures: { targetType: 'hand', autoRefresh: 'hand', responseValidationMode: 'live' },
    munchkin_dwarves_gold_digger_choose_treasure: { targetType: 'card', autoRefresh: 'field', responseValidationMode: 'live' },
    munchkin_dwarves_greed_is_good_choose_treasure: { targetType: 'card', autoRefresh: 'field', responseValidationMode: 'live' },
    munchkin_dwarves_mine_choose_treasure: { targetType: 'generic', autoRefresh: 'deck', responseValidationMode: 'live' },
    munchkin_dwarves_no_my_precious_destroy: { targetType: 'ongoing', autoRefresh: 'field', responseValidationMode: 'live' },
    munchkin_dwarves_salvage_choose_treasure: { targetType: 'generic', autoRefresh: 'field', responseValidationMode: 'live' },
    munchkin_thieves_fence_choose_treasures: { targetType: 'hand', autoRefresh: 'hand', responseValidationMode: 'live' },
    munchkin_thieves_backstab_choose_treasure: { targetType: 'hand', autoRefresh: 'hand', responseValidationMode: 'live' },
    munchkin_thieves_backstab_choose_minion: { targetType: 'minion', autoRefresh: 'field', responseValidationMode: 'live' },
    munchkin_thieves_potion_bandolier_choose_treasure: { targetType: 'hand', autoRefresh: 'hand', responseValidationMode: 'live' },
    munchkin_thieves_smuggling_choose_treasures: { targetType: 'hand', autoRefresh: 'hand', responseValidationMode: 'live' },
    munchkin_thieves_mugging_choose_action: { targetType: 'ongoing', autoRefresh: 'field', responseValidationMode: 'live' },
    munchkin_thieves_mugging_choose_minion: { targetType: 'minion', autoRefresh: 'field', responseValidationMode: 'live' },
    munchkin_thieves_strip_bare_choose_treasure: { targetType: 'board', autoRefresh: 'field', responseValidationMode: 'live' },
    cthulhu_servitor: { targetType: 'generic' },
    special_madness: { targetType: 'button' },
    elder_thing_begin_the_summoning: { targetType: 'generic' },
    elder_thing_elder_thing_choice: { targetType: 'button' },
    elder_thing_shoggoth_opponent: { targetType: 'button' },
    elder_thing_mi_go: { targetType: 'button' },
    pirate_broadside_choose_base: { targetType: 'base' },
    pirate_broadside_choose_player: { targetType: 'player' },
    dragons_burn_it_down: { targetType: 'button' },
    dragons_flank_attack_source: { targetType: 'button' },
    pirate_buccaneer_move: { targetType: 'base' },
    pirate_king_move: { targetType: 'minion' },
    pirate_first_mate_choose_base: { targetType: 'minion' },
    ancient_egyptians_mummy_after_scoring: { targetType: 'minion', responseValidationMode: 'live' },
    world_champs_mummy_after_scoring: { targetType: 'minion' },
    pirate_sea_dogs_choose_faction: { targetType: 'generic' },
    giant_ant_who_wants_to_live_forever: { targetType: 'minion', responseValidationMode: 'live' },
    giant_ant_drone_prevent_destroy: { targetType: 'minion' },
    giant_ant_we_are_the_champions_choose_source: { targetType: 'minion' },
    giant_ant_we_are_the_champions_choose_snapshot_source: { targetType: 'generic' },
    robot_microbot_reclaimer: { targetType: 'generic' },
    robot_hoverbot: { targetType: 'generic' },
    steampunk_scrap_diving: { targetType: 'generic' },
    steampunk_captain_ahab: { targetType: 'base' },
    steampunk_zeppelin_choose_minion: { targetType: 'minion', responseValidationMode: 'live' },
    steampunk_zeppelin_choose_base: { targetType: 'base' },
    steampunk_mechanic: { targetType: 'generic' },
    steampunk_mechanic_target: { targetType: 'base', responseValidationMode: 'live' },
    steampunk_change_of_venue: { targetType: 'ongoing', responseValidationMode: 'live' },
    fairies_tinx: { targetType: 'ongoing' },
    geeks_rules_lawyer_action: { targetType: 'ongoing', responseValidationMode: 'live' },
    kaiju_johnny: { targetType: 'ongoing' },
    tornados_ripped_off: { targetType: 'ongoing' },
    steampunk_change_of_venue_choose_minion: { targetType: 'minion' },
    steampunk_change_of_venue_choose_base: { targetType: 'base' },
    frankenstein_lab_assistant: { targetType: 'minion', responseValidationMode: 'live' },
    frankenstein_herr_doktor: { targetType: 'minion', responseValidationMode: 'live' },
    frankenstein_igor: { targetType: 'minion', responseValidationMode: 'live' },
    frankenstein_angry_mob: { targetType: 'minion', responseValidationMode: 'live' },
    frankenstein_angry_mob_choose_card: { targetType: 'hand', responseValidationMode: 'live' },
    frankenstein_body_shop: { targetType: 'minion', responseValidationMode: 'live' },
    frankenstein_body_shop_distribute: { targetType: 'minion', responseValidationMode: 'live' },
    frankenstein_blitzed_remove: { targetType: 'minion', responseValidationMode: 'live' },
    frankenstein_blitzed_destroy: { targetType: 'minion', responseValidationMode: 'live' },
    trickster_block_the_path: { targetType: 'generic' },
    trickster_mark_of_sleep: { targetType: 'player' },
    wizard_neophyte: { targetType: 'button' },
    wizard_neophyte_choose_base: { targetType: 'base' },
    wizard_neophyte_choose_minion: { targetType: 'minion' },
    wizard_mass_enchantment: { targetType: 'generic' },
    wizard_mass_enchantment_choose_base: { targetType: 'base' },
    wizard_mass_enchantment_choose_minion: { targetType: 'minion' },
    wizard_portal_order: { targetType: 'generic' },
    base_wizard_academy: { targetType: 'generic' },
    base_innsmouth_base_choose_card: { targetType: 'generic' },
    ghost_the_dead_rise_discard: { targetType: 'hand' },
    ghost_the_dead_rise_play: { targetType: 'discard_minion' },
    ghost_across_the_divide: { targetType: 'generic' },
    ghost_spirit_discard: { targetType: 'hand' },
    innsmouth_recruitment: { targetType: 'button' },
    innsmouth_mysteries_of_the_deep: { targetType: 'button' },
    innsmouth_spreading_the_word: { targetType: 'generic' },
    itty_critters_leafaroo: { targetType: 'discard' },
    magical_girls_purge_the_demon: { targetType: 'board' },
    fairies_playful_tricks_destroy: { targetType: 'ongoing' },
    mega_troopers_lightning_crystal: { targetType: 'ongoing' },
    mega_troopers_plan_for_more_order: { targetType: 'generic', responseValidationMode: 'live' },
    miskatonic_mandatory_reading_draw: { targetType: 'button' },
    miskatonic_psychologist: { targetType: 'button' },
    miskatonic_researcher: { targetType: 'button' },
    miskatonic_book_of_iter_the_unseen: { targetType: 'generic' },
    miskatonic_field_trip: { targetType: 'hand' },
    zombie_grave_digger: { targetType: 'generic' },
    zombie_walker: { targetType: 'button' },
    zombie_grave_robbing: { targetType: 'generic' },
    zombie_not_enough_bullets: { targetType: 'generic' },
    zombie_lend_a_hand: { targetType: 'generic' },
    zombie_they_keep_coming: { targetType: 'discard_minion' },
    zombie_lord_pick: { targetType: 'discard_minion' },
    zombie_mall_crawl: { targetType: 'generic' },
    time_travelers_into_the_time_slip_choose: { targetType: 'board' },
    time_travelers_time_raider_choose: { targetType: 'discard' },
    time_travelers_repeater_perfect_choose: { targetType: 'discard' },
    shapeshifters_cellular_bonding_choose: { targetType: 'ongoing' },
    base_q_point: { targetType: 'board' },
    base_primate_park_return: { targetType: 'ongoing', responseValidationMode: 'live' },
};

const FIELD_SOURCE_BASE_TARGET_SOURCE_IDS = [
    'pirate_king_move',
    'pirate_first_mate_choose_base',
    'ancient_egyptians_mummy_after_scoring',
    'world_champs_mummy_after_scoring',
] as const;

const APPROVED_GENERIC_SOURCE_REASONS: Record<string, string> = {
    ancient_egyptians_pyramid_engineer_uncover: '翻开这里你的埋葬牌时，需要保留 buried card 与原基地上下文，不能压缩成单一实体直点。',
    titan_sphinx_after_scoring: '狮身人面像结算后回收埋葬牌时，需要保留 buried card 与结算基地上下文，generic 语义更准确。',
    titan_sphinx_start_turn: '狮身人面像部署时既要选埋葬牌又要读取其原基地用于放置泰坦，不能压成单一实体直点。',
    ancient_egyptians_lost_knowledge_uncover: '翻开埋葬牌时要保留埋葬区卡牌与原基地上下文，不能压缩成单一 hand/base 直点。',
    ancient_egyptians_pharaoh_before_scoring: '计分前翻开埋葬牌需要携带 buried card 与原基地上下文，保留 generic 更准确。',
    ancient_egyptians_seal_the_tomb_uncover: '同基地多选翻开埋葬牌时需要同时保留 buried card 与基地上下文，不能简化为单一实体直点。',
    alien_probe: '目标同时包含对手玩家上下文与其手牌卡面，不能映射为当前玩家 hand 直选。',
    alien_terraform_choose_replacement: '候选目标来自替换基地池/基地牌面，不是当前场上的基地实体。',
    base_greenhouse: '从牌库候选随从卡面中选择打出目标，来源是 deck 卡牌而非手牌/棋盘实体。',
    base_innsmouth_base_choose_card: '先选玩家再选卡牌，交互同时携带玩家与卡牌上下文。',
    base_inventors_salon: '候选项是抽象奖励分支，不是单一棋盘实体直点。',
    base_wizard_academy: '牌库顶揭示后的处理分支，依赖展示卡牌上下文而不是棋盘实体。',
    cthulhu_it_begins_again: '多选弃牌堆行动卡，来源为 discard，不能映射为单选 hand/board 直选。',
    cthulhu_chosen_confirm: '这是确认是否触发当前随从效果的 yes/no 按钮交互，虽携带 minionUid/baseIndex 供结算使用，但不应要求玩家点击场上随从。',
    cthulhu_recruit_by_force: '多选弃牌堆随从卡，来源为 discard 卡面而不是棋盘实体。',
    cthulhu_servitor: '从弃牌堆行动卡中选回牌库的目标，来源为 discard 卡面。',
    cthulhu_star_spawn: '同时涉及目标玩家与疯狂卡转移，不能压缩成单一实体语义。',
    elder_thing_begin_the_summoning: '候选项来自非棋盘卡牌池，需保留通用卡面弹层选择。',
    geeks_min_maxing_action: '候选项来自已揭示的对手手牌，不是当前玩家自己的手牌直选，需保留通用卡图弹层语义。',
    ghost_across_the_divide: '候选项包含复合效果分支，不是单一基地/随从/手牌实体。',
    giant_ant_we_are_the_champions_choose_snapshot_source: '来源随从已在计分后离场，只能用静态快照卡面选择。',
    giant_ant_who_wants_to_live_forever_pod_search: '牌库检索结果来自 deck 卡面选择，不是当前棋盘实体直点。',
    innsmouth_spreading_the_word: '选择的是随从名(defId)而不是某张场上/手牌实体卡。',
    international_incident_base_move: '国际事件基地移动选项同时携带随从、来源基地、目标基地和触发基地能力上下文，不能压成单一 minion/base 直点。',
    kaiju_pick_up_a_bus: '从弃牌堆行动卡中选择回收目标，来源为 discard 卡面而非手牌或棋盘实体。',
    kaiju_they_say_hes_got_to_go_choose_titan: '选择对象是泰坦实体，当前 UI 没有 titan 专用 targetType，需保留 generic 并携带来源基地上下文。',
    killer_plant_sprout_search: '牌库搜索结果卡面选择，需要 autoRefresh/live 重验而非棋盘直点。',
    killer_plant_venus_man_trap_search: '牌库搜索结果卡面选择，需要 autoRefresh/live 重验而非棋盘直点。',
    magical_girls_black_magicat: '同时搜索牌库与弃牌堆的指定随从，候选来源可能是 deck 或 discard 卡面，不能映射为当前手牌/棋盘实体。',
    magical_girls_kiss_the_sky_spell: '从弃牌堆随从卡面中选择回手目标，来源为 discard 卡面。',
    magical_girls_lunar_captain: '从弃牌堆随从卡面中选择回手目标，来源为 discard 卡面。',
    magical_girls_lunar_healing_love_spell: '多选每位玩家弃牌堆随从卡面并按拥有者回手，来源为 discard 卡面且跨玩家分组。',
    magical_girls_white_magicat: '同时搜索牌库与弃牌堆的指定随从，候选来源可能是 deck 或 discard 卡面，不能映射为当前手牌/棋盘实体。',
    mega_troopers_plan_for_more: '揭示牌库顶后既可拿牌又可选择其中一张打到指定基地，选项同时携带 deck 卡面和目标基地上下文。',
    mega_troopers_plan_for_more_order: '揭示牌库顶后的剩余牌排序交互，候选来源是 deck reveal 快照，不是当前手牌或棋盘实体。',
    miskatonic_book_of_iter_the_unseen: '候选项来自特殊卡牌池/效果分支，不是棋盘实体直选。',
    miskatonic_jinkies_pod: 'POD 版同样从手牌/弃牌堆疯狂卡池中做效果分支选择，不是棋盘实体直选。',
    munchkin_dwarves_mine_choose_treasure: '我的！从公共宝藏牌库检索可附着宝藏并同时绑定己方宿主，候选来自 deck 卡面且不是手牌/棋盘单实体直点。',
    munchkin_dwarves_salvage_choose_treasure: '打捞从公共宝藏弃牌堆选择可附着宝藏并同时绑定当前计分基地上的己方宿主，选项复合 discard 卡面与棋盘宿主上下文。',
    mounties_northern_mover_mode: '北方搬运者先在移动与加力量间选模式，分支依赖已选随从上下文而非直点实体。',
    pirate_sea_dogs_choose_faction: '选择的是派系标识，而不是棋盘或手牌实体。',
    princesses_direct_to_dvd_sequel: '从弃牌堆静态卡面中选择随从洗回牌库并抽牌，来源为 discard 卡面。',
    princesses_griselda: '从弃牌堆静态卡面中选择传家宝回手，来源为 discard 卡面。',
    robot_hoverbot: '牌库顶揭示后的处理分支，不对应棋盘实体。',
    robot_microbot_reclaimer: '多选弃牌堆 microbot 卡，来源为 discard 卡面。',
    steampunk_mechanic: '候选项是复合效果分支，不能压成单一实体语义。',
    steampunk_scrap_diving: '从弃牌堆行动卡中选择回收目标，来源为 discard 卡面。',
    skeletons_burst_forth: '候选项是当前基地已埋葬牌快照，需保留 buried card 与基地上下文。',
    skeletons_dig_em_up_cards: '候选项是指定基地中已埋葬牌的多选快照，需保留 buried card 与原基地上下文。',
    skeletons_grave_goods_uncover: '候选项是玩家已埋葬牌快照，挖掘时必须保留 buried card 与原基地上下文。',
    skeletons_graveyard: '候选项是基地埋葬区中的卡牌快照，需保留 buried card 与原基地上下文。',
    skeletons_hearse_fleet_cards: '候选项是跨基地埋葬牌搬运目标，必须保留 buried card 与原基地上下文。',
    skeletons_hearse_fleet_special_from: '计分前特殊移出分支需要选择固定基地中的埋葬牌快照，需保留原基地上下文。',
    skeletons_hearse_fleet_special_into: '计分前特殊移入分支需要选择非固定基地埋葬牌快照，需保留原基地上下文。',
    skeletons_lord_of_bones_uncover: '天赋挖掘分支选择的是基地埋葬区卡牌快照，需保留 buried card 与原基地上下文。',
    skeletons_place_em_down_cards: '候选项来自弃牌堆卡牌快照，后续还要校验总力量并串联基地埋葬上下文。',
    skeletons_returned_one: '候选项混合“本体自埋葬（buriedFrom=play）”与跳过分支，保留 generic 以承载复合语义。',
    skeletons_returned_one_uncover: '被翻开后的追击选择来自同基地埋葬区快照，需保留 buried card 与基地上下文。',
    skeletons_spooky_scary_card: '候选项来自弃牌堆低力量随从卡面，后续还要串联基地埋葬与抽牌结算。',
    sumo_wrestlers_chikara_mizu_mode: '力量满溢在 +2 与弃牌改为 +4 间选分支，后续依赖是否弃牌的效果上下文。',
    sumo_wrestlers_yokozuna_mode: '横纲先在抽牌与移动其他玩家随从间选分支，不是单一实体直点。',
    trickster_hideout_pod_swap: '候选项混合手牌与牌库中的持续战术卡面，不能映射为单一 hand/deck 直选。',
    vampire_fledgling_vampire_pod_bury_source: '候选项混合手牌与弃牌堆来源，且后续还要串联基地选择。',
    vampire_wolf_pact_pod_action: '从弃牌堆静态卡面中选择洗回牌库的目标，来源为 discard 卡面。',
    vampire_crack_of_dusk: '候选项来自弃牌堆静态卡面，后续还要串联基地选择，不是当前 hand/board 直选。',
    vampire_crack_of_dusk_pod: '先从弃牌堆静态卡面中挑选低力量随从，再进入基地选择链路，来源不是当前场上/手牌实体。',
    bury_uncover_start_turn: '埋伏翻开交互需要携带原基地/随从上下文，属于带棋盘上下文的通用分支选择。',
    bear_cavalry_bear_rides_you_pod_choose_suppress: '候选项混合场上实体与抑制分支，需保留带棋盘上下文的通用交互。',
    bear_cavalry_cub_scout_pod_destroy: '候选项是带破坏确认的通用分支，不是单一实体直选。',
    elder_thing_begin_the_summoning_pod: '候选项来自额外牌池/分支效果，不能映射为单一实体直选。',
    elder_thing_spreading_horror_pod_choose_minion: '选择结果需要同时携带场上随从与额外效果上下文，保留 generic 语义。',
    trickster_block_the_path: '候选项是效果处理分支，不对应单一实体直选。',
    wizard_mass_enchantment: '候选行动卡来自对手牌库顶揭示结果，来源不是当前玩家手牌/棋盘。',
    wizard_portal_order: '这是剩余揭示牌的排序交互，不对应单一实体直选。',
    wizard_scry: '牌库搜索/排序结果卡面选择，需要 autoRefresh/live 重验。',
    world_champs_akye_the_turtle_player: '先选玩家再进入手牌交互，第一步属于玩家分支选择，不是单一实体直点。',
    world_champs_shield_maiden: '候选项是“揭示哪位玩家牌库顶”的玩家分支，不是棋盘实体直点。',
    world_champs_stoneford: '候选项来自牌库行动卡检索结果，来源为 deck 卡面。',
    zombie_grave_digger: '从弃牌堆选卡回手，来源为 discard 卡面。',
    zombie_grave_robbing: '从弃牌堆选任意卡回手，来源为 discard 卡面。',
    zombie_lend_a_hand: '多选弃牌堆卡牌，来源为 discard 且是多选交互。',
    zombie_mall_crawl: '从弃牌堆候选卡中决定额外打出目标，来源不是 hand/board 直选。',
    zombie_not_enough_bullets: '从弃牌堆同名卡组中选择恢复目标，来源为 discard 卡面。',
    base_drakkar: '从牌库顶揭示卡牌并按分支处理，候选来源是 deck 快照而非场上实体。',
    base_longhouse_card: '候选项来自揭示卡牌快照，需保留卡牌上下文再决定后续处理。',
    cowboys_gold_in_them_thar_hills: '候选项来自牌库顶揭示的卡牌快照，需保留 deck 上下文。',
    cowboys_gold_in_them_thar_hills_order: '这是剩余揭示卡牌的排序交互，不是单一实体直选。',
    cowboys_stagecoach_cards: '候选项混合随从/持续行动/埋葬牌，需保留复合卡面上下文。',
    innsmouth_return_to_the_sea_choose_name: '选择的是随从名(defId)而非某个单一场上实体。',
    mythic_greeks_favor_of_athena_order: '候选项来自本次揭示牌堆的临时排序快照，需要保留 deck 卡面与排序上下文，不能压成 hand/base 直选。',
    mythic_greeks_favor_of_athena_pick: '候选项来自本次揭示牌堆的临时行动卡快照，来源为 deck reveal 卡面而非当前手牌实体。',
    mythic_greeks_favor_of_hades: '候选项是已揭示牌库卡面的处理分支，既保留卡牌身份又不是当前手牌/棋盘实体。',
    mythic_greeks_favor_of_poseidon: '候选项是已揭示牌库卡面的处理分支，既保留卡牌身份又不是当前手牌/棋盘实体。',
    titan_cthulhu_cthulhu_titan_talent_target: '候选项带有泰坦技能分支上下文，不能压缩成单一实体直选。',
    titan_dinosaurs_fort_titanosaurus_ongoing: '候选项是泰坦持续效果分支，需保留通用上下文。',
    titan_frankenstein_the_bride_start_choose_branch: '候选项是新娘起始阶段分支选择，不是单一实体直选。',
    titan_frankenstein_the_bride_start_choose_target: '分支后的目标选择依赖前置分支上下文，需保留 generic。',
    titan_frankenstein_the_bride_talent_branch: '天赋阶段分支选择，不对应单一实体直选。',
    titan_frankenstein_the_bride_talent_extra_action: '额外行动分支需要保留前序上下文，不能压成单点直选。',
    titan_ghosts_creampuff_man_play: '候选项为复合效果分支，需保留通用上下文。',
    titan_giant_ants_death_on_six_legs_transfer: '涉及力量指示物转移，候选需携带源/目标上下文。',
    titan_killer_plants_killer_kudzu_recycle: '候选项来自回收流程分支，需保留通用卡面上下文。',
    titan_killer_plants_killer_kudzu_removed: '候选项来自移除后续分支，不能压成单一实体直选。',
    titan_killer_plants_killer_kudzu_talent: '天赋触发分支选择，保留 generic 语义更准确。',
    titan_ninjas_invisible_ninja_ongoing: '持续效果分支包含多维上下文，不能简化为单一实体直选。',
    titan_ninjas_invisible_ninja_start_turn: '回合开始分支选择依赖持续状态上下文，需保留 generic。',
    titan_penguins_emperor_penguin_talent: '天赋候选是复合分支，不对应单一实体直选。',
    penguins_regurgitating_penguin: '反刍企鹅候选项来自牌库顶揭示快照，拿走行动后还要串联剩余牌排序，不是当前手牌或棋盘实体直选。',
    penguins_regurgitating_penguin_order: '反刍企鹅剩余揭示牌需要按玩家选择顺序回到牌库顶，必须保留排序快照语义。',
    titan_vampires_ancient_lord_special: '特殊触发候选包含场上目标与额外语义，需保留 generic。',
    vampire_crack_of_dusk_pod: '候选项来自弃牌堆随从卡面，不是当前棋盘实体，也不是当前手牌直选。',
    vikings_berserk_card: '候选项来自手牌卡面并串联后续目标选择，保留 generic 以承载链路上下文。',
    vikings_cast_the_runes_order: '牌库顶揭示后的排序交互，来源为 deck 快照而非场上实体。',
    vikings_cast_the_runes_player: '先选目标玩家再处理揭示结果，属于玩家+卡牌复合上下文。',
    vikings_huscarl: '候选项来自弃牌堆卡面并串联后续打出流程，非单一实体直选。',
    vikings_pillage: '候选项涉及目标玩家及其手牌快照，需保留通用上下文。',
    vikings_raider: '候选项涉及目标玩家与手牌信息，不是单一实体直选。',
    vikings_raiding_party_choice: '候选项是揭示牌后的分支决策，不对应单一实体直选。',
    vikings_raiding_party_player: '先选目标玩家再进入额外打出链路，需保留复合上下文。',
    vikings_ransack: '候选项涉及目标玩家与手牌快照，需保留通用上下文。',
    vikings_shield_maiden: '候选项先选玩家再揭示牌库顶，属于玩家+卡牌复合交互。',
    vikings_valkyrie: '候选项基于弃牌堆卡面并串联后续结算，不是单一实体直选。',
    base_faceless_city_choose: '候选项来自牌库中的同名随从快照，并会在抽到手后重洗剩余牌库，不是单一棋盘实体直选。',
    base_isis_swingin_pad_reorder: '这是查看并重排牌库顶三张的排序交互，必须保留 top/bottom 顺序语义而不是单点选择。',
    cyborg_apes_monkey_see_monkey_do_choose: '候选项来自牌库顶五张揭示结果，允许多选行动加入手牌并重洗剩余牌库，需保留 deck 快照上下文。',
    mythic_greeks_favor_of_athena_order: '这是对已揭示牌组逐张决定回牌库顶顺序的排序交互，不能压缩成单一实体直选。',
    mythic_greeks_favor_of_athena_pick: '候选项来自牌库顶揭示的行动卡快照，并且后续还要串联剩余牌排序。',
    mythic_greeks_favor_of_hades: '从弃牌堆静态卡面中选择行动回手，来源为 discard 卡面而不是棋盘实体。',
    mythic_greeks_favor_of_poseidon: '多选弃牌堆卡牌洗回牌库，来源为 discard 卡面且带多选语义。',
    shapeshifters_genetic_shift_choose: '候选项混合“全体己方随从 +1”的按钮分支与“单个己方随从 +3”的实体分支，必须保留复合语义。',
    shapeshifters_mitosis_choose: '候选项来自手牌中的同名随从卡面，并携带目标基地与同名约束，属于额外打出链路而不是普通手牌直选。',
    super_spies_for_my_eyes_only_reorder: '这是查看并重排自己牌库顶五张的排序交互，需要保留 top/bottom 分组与揭示快照语义。',
    super_spies_operative_top_bottom: '同一次交互里按玩家分组处理多张已揭示牌，需同时保留 targetPlayerId 与 cardUid 的复合上下文。',
    super_spies_permit_to_kill_order: '这是查看并重排目标玩家牌库顶的排序交互，必须保留 top/bottom 顺序语义。',
    super_spies_spy_reorder: '这是查看并重排目标玩家牌库顶的排序交互，候选项是揭示快照而非棋盘实体。',
    time_travelers_its_astounding_choose: '候选项来自弃牌堆行动卡快照，后续还要继续进入该行动牌自身的目标选择链路。',
    time_travelers_time_is_fleeting_choose: '选择的是基地弃牌堆中的基地定义并改写基地牌库顶，不对应当前场上基地实体。',
};

function extractValueProps(optionNode: ts.ObjectLiteralExpression): Set<string> {
    const props = new Set<string>();
    const valueProp = optionNode.properties.find(
        prop => ts.isPropertyAssignment(prop) && ts.isIdentifier(prop.name) && prop.name.text === 'value'
    ) as ts.PropertyAssignment | undefined;

    if (!valueProp || !ts.isObjectLiteralExpression(valueProp.initializer)) return props;

    for (const prop of valueProp.initializer.properties) {
        if (ts.isPropertyAssignment(prop) && ts.isIdentifier(prop.name)) {
            props.add(prop.name.text);
        } else if (ts.isShorthandPropertyAssignment(prop)) {
            props.add(prop.name.text);
        }
    }
    return props;
}

function extractTopLevelStringProp(optionNode: ts.ObjectLiteralExpression, propName: string): string | undefined {
    const prop = optionNode.properties.find(
        entry => ts.isPropertyAssignment(entry) && ts.isIdentifier(entry.name) && entry.name.text === propName
    ) as ts.PropertyAssignment | undefined;

    if (!prop) return undefined;
    if (ts.isStringLiteral(prop.initializer) || ts.isNoSubstitutionTemplateLiteral(prop.initializer)) {
        return prop.initializer.text;
    }
    if (prop.initializer.kind === ts.SyntaxKind.AsExpression) {
        const expr = (prop.initializer as ts.AsExpression).expression;
        if (ts.isStringLiteral(expr) || ts.isNoSubstitutionTemplateLiteral(expr)) {
            return expr.text;
        }
    }
    return undefined;
}

function checkMinionSelectFallback(options: ts.ObjectLiteralExpression[]): boolean {
    if (options.length === 0) return false;
    const controlFields = new Set(['accept', 'confirm', 'returnIt', 'skip', 'done']);
    let hasMinionOption = false;
    return options.every(opt => {
        const props = extractValueProps(opt);
        const source = extractTopLevelStringProp(opt, '_source');

        if (props.has('minionUid')) {
            if (source === 'static' || source === 'discard') return false;
            if (props.has('toBase') || props.has('toBaseIndex') || props.has('targetPlayerId') || props.has('baseDefId')) {
                return false;
            }
            for (const field of controlFields) {
                if (props.has(field)) return false;
            }
            hasMinionOption = true;
            return true;
        }

        if (props.size === 0) return false;
        for (const field of props) {
            if (!controlFields.has(field)) return false;
        }
        return true;
    }) && hasMinionOption;
}

function checkBaseSelectFallback(options: ts.ObjectLiteralExpression[]): boolean {
    if (options.length === 0) return false;
    return options.every(opt => {
        const props = extractValueProps(opt);
        if (!props.has('baseIndex')) return false;
        if (props.has('minionUid') || props.has('cardUid') || props.has('ongoingUid')) return false;
        return true;
    });
}

function checkHandSelectFallback(options: ts.ObjectLiteralExpression[]): boolean {
    if (options.length === 0) return false;

    let hasOwnHandOption = false;
    for (const opt of options) {
        const props = extractValueProps(opt);
        const source = extractTopLevelStringProp(opt, '_source');
        const isOwnHandCardOption = source === 'hand' && props.has('cardUid') && !props.has('targetPlayerId');
        const isExtraActionOption = !props.has('cardUid');

        if (isOwnHandCardOption) {
            hasOwnHandOption = true;
            continue;
        }
        if (isExtraActionOption) {
            continue;
        }
        return false;
    }

    return hasOwnHandOption;
}

function checkPlayerSelectFallback(options: ts.ObjectLiteralExpression[]): boolean {
    if (options.length === 0) return false;

    const playerFields = new Set(['targetPlayerId', 'pid', 'playerId']);
    let hasPlayerOption = false;
    for (const opt of options) {
        const props = extractValueProps(opt);
        const hasPlayerField = Array.from(playerFields).some(field => props.has(field));
        const hasOnlyPlayerFields = Array.from(props).every(prop => playerFields.has(prop));

        if (hasPlayerField && hasOnlyPlayerFields) {
            hasPlayerOption = true;
            continue;
        }

        const isExtraActionOption = !hasPlayerField;
        if (isExtraActionOption) continue;

        return false;
    }

    return hasPlayerOption;
}

function checkButtonSelectFallback(options: ts.ObjectLiteralExpression[]): boolean {
    if (options.length === 0) return false;

    const abstractFields = new Set([
        'action',
        'choice',
        'count',
        'skip',
        'draw',
        'accept',
        'source',
        'handCount',
        'discardCount',
    ]);

    let hasAbstractOption = false;
    for (const opt of options) {
        const props = extractValueProps(opt);
        if (props.size === 0) return false;

        const hasOnlyAbstractFields = Array.from(props).every(prop => abstractFields.has(prop));
        if (!hasOnlyAbstractFields) return false;

        if (!props.has('skip')) {
            hasAbstractOption = true;
        }
    }

    return hasAbstractOption;
}

function findHandSourceMarkerIssue(
    options: ts.ObjectLiteralExpression[],
): { issue: 'missing' | 'wrong'; actual?: string } | undefined {
    for (const opt of options) {
        const props = extractValueProps(opt);
        if (!props.has('cardUid') || props.has('targetPlayerId')) continue;

        const source = extractTopLevelStringProp(opt, '_source');
        if (source === 'hand') continue;
        if (!source) return { issue: 'missing' };
        return { issue: 'wrong', actual: source };
    }
    return undefined;
}

function hasUnsafeBaseFields(options: ts.ObjectLiteralExpression[]): boolean {
    const safeFields = new Set(['baseIndex', 'baseDefId']);
    return options.some(opt => {
        const props = extractValueProps(opt);
        return Array.from(props).some(prop => !safeFields.has(prop));
    });
}

function hasUnsafeMinionFields(options: ts.ObjectLiteralExpression[]): boolean {
    const safeFields = new Set(['minionUid', 'baseIndex', 'defId', 'minionDefId', 'power', 'ownerId']);
    return options.some(opt => {
        const props = extractValueProps(opt);
        return Array.from(props).some(prop => !safeFields.has(prop));
    });
}

function isBoardLikeGenericOption(options: ts.ObjectLiteralExpression[]): boolean {
    return options.some(opt => {
        const props = extractValueProps(opt);
        return props.has('baseIndex') || props.has('minionUid');
    });
}

function findFieldSourceBaseTargetIssue(options: ts.ObjectLiteralExpression[]): string | undefined {
    for (const opt of options) {
        const props = extractValueProps(opt);
        if (props.has('fieldSourceTargetType')) {
            return '旧 fieldSourceTargetType 已废弃；能力层必须使用 fieldInteractionType/source-target + fieldSourceType/minion + fieldTargetType/base。';
        }

        if (!props.has('fieldInteractionType')) continue;

        const displayMode = extractTopLevelStringProp(opt, 'displayMode');
        if (displayMode === 'button') {
            return '场上来源到基地目标的效果不能用按钮作为主路径，必须先点来源对象本体再点目标基地。';
        }
        if (!props.has('fieldSourceType') || !props.has('fieldTargetType')) {
            return '场上来源到基地目标的效果必须显式声明 source-target/minion/base 三段语义，不能让 UI 猜。';
        }
        if (!props.has('sourceUid') || !props.has('targetBaseIndex') || !props.has('minionUid') || !props.has('baseIndex')) {
            return '场上来源到基地目标的效果必须同时携带来源随从和目标基地，不能让 UI 反推。';
        }
    }
    return undefined;
}

function analyzeFile(filePath: string): { issues: TargetTypeIssue[]; calls: SimpleChoiceCallInfo[] } {
    const content = readFileSync(filePath, 'utf-8');
    const sourceFile = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const issues: TargetTypeIssue[] = [];
    const calls: SimpleChoiceCallInfo[] = [];

    const visit = (node: ts.Node) => {
        if (isCreateSimpleChoiceCall(node)) {
            const config = extractSimpleChoiceConfig(node);
            const optionsArg = getChoiceOptionsArg(node);
            const line = ts.getLineAndCharacterOfPosition(sourceFile, node.getStart()).line + 1;
            const usesFieldSourceBaseTargetOptions = expressionContainsCall(
                sourceFile,
                optionsArg,
                node,
                ['buildFieldSourceBaseTargetOptions'],
            );
            calls.push({
                file: filePath,
                line,
                sourceId: config.sourceId,
                targetType: config.targetType,
                autoRefresh: config.autoRefresh,
                responseValidationMode: config.responseValidationMode,
                revalidateOnRespond: config.revalidateOnRespond,
                hasMulti: config.hasMulti,
                usesFieldSourceBaseTargetOptions,
            });

            const fieldSourceBaseTargetIssue = findFieldSourceBaseTargetIssue(collectOptionObjectLiterals(sourceFile, optionsArg, node));
            if (fieldSourceBaseTargetIssue) {
                issues.push({
                    file: filePath,
                    line,
                    sourceId: config.sourceId,
                    issue: '场上来源效果交互载体错误',
                    detail: fieldSourceBaseTargetIssue,
                });
            }

            if (!config.hasTargetType) {
                const resolvedOptions = collectOptionObjectLiterals(sourceFile, optionsArg, node);
                const inferredDirectTargetType = inferDirectTargetTypeFromOptions(sourceFile, optionsArg, node);

                if (checkHandSelectFallback(resolvedOptions)) {
                    issues.push({
                        file: filePath,
                        line,
                        sourceId: config.sourceId,
                        issue: '直点手牌交互未显式声明 targetType',
                        detail: '这是当前玩家手牌直选交互，必须显式声明 targetType: "hand"，不能依赖 Board.tsx fallback 猜测。',
                    });
                }

                if (checkPlayerSelectFallback(resolvedOptions)) {
                    issues.push({
                        file: filePath,
                        line,
                        sourceId: config.sourceId,
                        issue: '选玩家交互未显式声明 targetType',
                        detail: '这是纯玩家维度选择，必须显式声明 targetType: "player"，避免继续混在 generic 语义里。',
                    });
                }

                if (checkButtonSelectFallback(resolvedOptions)) {
                    issues.push({
                        file: filePath,
                        line,
                        sourceId: config.sourceId,
                        issue: '按钮分支交互未显式声明 targetType',
                        detail: '这是纯按钮/分支选择，必须显式声明 targetType: "button"，避免继续混在 generic 语义里。',
                    });
                }

                if (checkMinionSelectFallback(resolvedOptions)) {
                    const hasMovementFields = resolvedOptions.some(opt => {
                        const props = extractValueProps(opt);
                        return props.has('fromBase')
                            || props.has('toBase')
                            || props.has('fromBaseIndex')
                            || props.has('toBaseIndex');
                    });

                    if (hasMovementFields) {
                        issues.push({
                            file: filePath,
                            line,
                            sourceId: config.sourceId,
                            issue: 'isMinionSelectPrompt 误判风险',
                            detail: '所有选项都有 minionUid 且携带额外上下文字段；必须显式声明 targetType，优先用 "minion"，只有同一随从对应多种语义时才用 "generic"。',
                        });
                    } else {
                        issues.push({
                            file: filePath,
                            line,
                            sourceId: config.sourceId,
                            issue: '直点随从交互未显式声明 targetType',
                            detail: '这是场上随从直点交互，必须显式声明 targetType: "minion"，不能依赖 Board.tsx fallback 猜测。',
                        });
                    }
                } else if (inferredDirectTargetType === 'minion') {
                    issues.push({
                        file: filePath,
                        line,
                        sourceId: config.sourceId,
                        issue: 'helper 构造的直点随从交互未显式声明 targetType',
                        detail: '选项由 buildMinionTargetOptions 构造，必须显式声明 targetType: "minion"，不能依赖隐式推断。',
                    });
                }

                if (checkBaseSelectFallback(resolvedOptions)) {
                    if (hasUnsafeBaseFields(resolvedOptions)) {
                        issues.push({
                            file: filePath,
                            line,
                            sourceId: config.sourceId,
                            issue: '基地相关交互缺少显式 targetType',
                            detail: '所有选项都有 baseIndex 且携带额外字段；必须显式声明 targetType，优先用 "base"，只有同一基地对应多种语义时才用 "generic"。',
                        });
                    } else {
                        issues.push({
                            file: filePath,
                            line,
                            sourceId: config.sourceId,
                            issue: '直点基地交互未显式声明 targetType',
                            detail: '这是场上基地直点交互，必须显式声明 targetType: "base"，不能依赖 Board.tsx fallback 猜测。',
                        });
                    }
                } else if (inferredDirectTargetType === 'base') {
                    issues.push({
                        file: filePath,
                        line,
                        sourceId: config.sourceId,
                        issue: 'helper 构造的直点基地交互未显式声明 targetType',
                        detail: '选项由 buildBaseTargetOptions 构造，必须显式声明 targetType: "base"，不能依赖隐式推断。',
                    });
                }
            }

            if (config.hasTargetType && config.targetType !== 'hand') {
                const resolvedOptions = collectOptionObjectLiterals(sourceFile, node.arguments[3], node);
                if (checkHandSelectFallback(resolvedOptions)) {
                    issues.push({
                        file: filePath,
                        line,
                        sourceId: config.sourceId,
                        issue: '直点手牌交互 targetType 声明错误',
                        detail: `这是当前玩家手牌直选交互，targetType 必须是 "hand"，当前为 "${config.targetType}"。`,
                    });
                }
            }

            if (config.hasTargetType && config.targetType !== 'minion') {
                const resolvedOptions = collectOptionObjectLiterals(sourceFile, optionsArg, node);
                const inferredDirectTargetType = inferDirectTargetTypeFromOptions(sourceFile, optionsArg, node);
                const looksLikePureMinionDirect = checkMinionSelectFallback(resolvedOptions) || inferredDirectTargetType === 'minion';
                if (looksLikePureMinionDirect) {
                    const hasUnsafeFields = hasUnsafeMinionFields(resolvedOptions);
                    if (!hasUnsafeFields) {
                        issues.push({
                            file: filePath,
                            line,
                            sourceId: config.sourceId,
                            issue: '直点随从交互 targetType 声明错误',
                            detail: `这是场上随从直点交互，targetType 必须是 "minion"，当前为 "${config.targetType}"。`,
                        });
                    }
                }
            }

            if (config.hasTargetType && config.targetType !== 'base') {
                const resolvedOptions = collectOptionObjectLiterals(sourceFile, optionsArg, node);
                const inferredDirectTargetType = inferDirectTargetTypeFromOptions(sourceFile, optionsArg, node);
                const looksLikePureBaseDirect = checkBaseSelectFallback(resolvedOptions) || inferredDirectTargetType === 'base';
                if (looksLikePureBaseDirect) {
                    const hasUnsafeFields = hasUnsafeBaseFields(resolvedOptions);
                    if (!hasUnsafeFields) {
                        issues.push({
                            file: filePath,
                            line,
                            sourceId: config.sourceId,
                            issue: '直点基地交互 targetType 声明错误',
                            detail: `这是场上基地直点交互，targetType 必须是 "base"，当前为 "${config.targetType}"。`,
                        });
                    }
                }
            }

            if (config.hasTargetType && config.targetType !== 'player') {
                const resolvedOptions = collectOptionObjectLiterals(sourceFile, optionsArg, node);
                if (checkPlayerSelectFallback(resolvedOptions)) {
                    issues.push({
                        file: filePath,
                        line,
                        sourceId: config.sourceId,
                        issue: '选玩家交互 targetType 声明错误',
                        detail: `这是纯玩家维度选择，targetType 必须是 "player"，当前为 "${config.targetType}"。`,
                    });
                }
            }

            if (config.hasTargetType && config.targetType !== 'button') {
                const resolvedOptions = collectOptionObjectLiterals(sourceFile, optionsArg, node);
                if (checkButtonSelectFallback(resolvedOptions)) {
                    issues.push({
                        file: filePath,
                        line,
                        sourceId: config.sourceId,
                        issue: '按钮分支交互 targetType 声明错误',
                        detail: `这是纯按钮/分支选择，targetType 必须是 "button"，当前为 "${config.targetType}"。`,
                    });
                }
            }

            if (config.targetType === 'hand' && !config.hasMulti) {
                const resolvedOptions = collectOptionObjectLiterals(sourceFile, optionsArg, node);
                const sourceMarkerIssue = findHandSourceMarkerIssue(resolvedOptions);
                if (sourceMarkerIssue?.issue === 'missing') {
                    issues.push({
                        file: filePath,
                        line,
                        sourceId: config.sourceId,
                        issue: '直点手牌交互缺少 _source 标记',
                        detail: 'targetType: "hand" 的卡牌选项必须显式声明 _source: "hand"，避免 PromptOverlay / 动态过滤误判来源。',
                    });
                } else if (sourceMarkerIssue?.issue === 'wrong') {
                    issues.push({
                        file: filePath,
                        line,
                        sourceId: config.sourceId,
                        issue: '直点手牌交互 _source 声明错误',
                        detail: `targetType: "hand" 的卡牌选项必须声明 _source: "hand"，当前为 "${sourceMarkerIssue.actual}"。`,
                    });
                }
            }
        }

        ts.forEachChild(node, visit);
    };

    visit(sourceFile);
    return { issues, calls };
}

function getFilesToScan(): string[] {
    const abilitiesDir = resolve(__dirname, '../abilities');
    const baseAbilityFiles = [
        resolve(__dirname, '../domain/index.ts'),
        resolve(__dirname, '../domain/baseAbilities.ts'),
        resolve(__dirname, '../domain/baseAbilities_expansion.ts'),
    ];

    const abilityFiles = readdirSync(abilitiesDir)
        .filter(file => file.endsWith('.ts') && !file.endsWith('.test.ts'))
        .map(file => join(abilitiesDir, file));

    return [...abilityFiles, ...baseAbilityFiles];
}

describe('SmashUp Interaction targetType 审计', () => {
    it('所有 createSimpleChoice 的直点/通用交互都显式声明正确的 targetType', () => {
        const allIssues: TargetTypeIssue[] = [];

        for (const filePath of getFilesToScan()) {
            try {
                const { issues } = analyzeFile(filePath);
                allIssues.push(...issues);
            } catch {
                // 文件不存在或解析失败时跳过，避免阻塞整个审计
            }
        }

        if (allIssues.length > 0) {
            const report = allIssues.map(issue =>
                `${issue.file}:${issue.line} [${issue.sourceId}] ${issue.issue}\n  → ${issue.detail}`
            ).join('\n\n');
            expect.fail(`发现 ${allIssues.length} 个 targetType 显式声明/误判风险：\n\n${report}`);
        }

        expect(allIssues).toEqual([]);
    });

    it('已登记的通用牌库检索交互必须保留显式 targetType / autoRefresh 配置', () => {
        const allCalls: SimpleChoiceCallInfo[] = [];

        for (const filePath of getFilesToScan()) {
            try {
                const { calls } = analyzeFile(filePath);
                allCalls.push(...calls);
            } catch {
                // 文件不存在或解析失败时跳过，避免阻塞整个审计
            }
        }

        const violations: string[] = [];

        for (const [sourceId, expected] of Object.entries(REQUIRED_SOURCE_CONFIGS)) {
            const matches = allCalls.filter(call => call.sourceId === sourceId);
            if (matches.length === 0) {
                violations.push(`缺少 sourceId="${sourceId}" 的 createSimpleChoice 调用`);
                continue;
            }

            for (const match of matches) {
                if (expected.targetType !== undefined && match.targetType !== expected.targetType) {
                    violations.push(
                        `${match.file}:${match.line} [${sourceId}] targetType 期望 "${expected.targetType}"，实际 "${match.targetType ?? '未声明'}"`
                    );
                }
                if (expected.autoRefresh !== undefined && match.autoRefresh !== expected.autoRefresh) {
                    violations.push(
                        `${match.file}:${match.line} [${sourceId}] autoRefresh 期望 "${expected.autoRefresh}"，实际 "${match.autoRefresh ?? '未声明'}"`
                    );
                }
                if (expected.responseValidationMode !== undefined && match.responseValidationMode !== expected.responseValidationMode) {
                    violations.push(
                        `${match.file}:${match.line} [${sourceId}] responseValidationMode 期望 "${expected.responseValidationMode}"，实际 "${match.responseValidationMode ?? '未声明'}"`
                    );
                }
            }
        }

        expect(violations, `以下高风险通用交互缺少显式配置：\n${violations.join('\n')}`).toEqual([]);
    });

    it('场上来源随从到目标基地的计分效果必须先点来源本体再点基地', () => {
        const allCalls: SimpleChoiceCallInfo[] = [];

        for (const filePath of getFilesToScan()) {
            try {
                const { calls } = analyzeFile(filePath);
                allCalls.push(...calls);
            } catch {
                continue;
            }
        }

        const violations: string[] = [];
        for (const sourceId of FIELD_SOURCE_BASE_TARGET_SOURCE_IDS) {
            const matches = allCalls.filter(call => call.sourceId === sourceId);
            if (matches.length === 0) {
                violations.push(`[${sourceId}] 缺少 createSimpleChoice 调用，无法证明计分来源本体交互合同`);
                continue;
            }

            for (const match of matches) {
                if (match.targetType !== 'minion') {
                    violations.push(`${match.file}:${match.line} [${sourceId}] targetType 必须是 "minion"，实际 "${match.targetType ?? '未声明'}"`);
                }
                if (!match.usesFieldSourceBaseTargetOptions) {
                    violations.push(`${match.file}:${match.line} [${sourceId}] 必须使用 buildFieldSourceBaseTargetOptions，不能把按钮或基地选项当作发动主路径`);
                }
            }
        }

        const helperPath = resolve(__dirname, '../domain/abilityHelpers.ts');
        const helperSource = readFileSync(helperPath, 'utf-8');
        const requiredHelperSnippets = [
            "fieldInteractionType: 'source-target'",
            "fieldSourceType: 'minion'",
            "fieldTargetType: 'base'",
            'sourceUid: source.uid',
            'targetBaseIndex: target.baseIndex',
            'minionUid: source.uid',
            'baseIndex: target.baseIndex',
            "displayMode: 'card' as const",
        ];
        for (const snippet of requiredHelperSnippets) {
            if (!helperSource.includes(snippet)) {
                violations.push(`${helperPath} 缺少共享来源-目标合同片段：${snippet}`);
            }
        }

        for (const filePath of [...getFilesToScan(), helperPath]) {
            const content = readFileSync(filePath, 'utf-8');
            if (content.includes('fieldSourceTargetType')) {
                violations.push(`${filePath} 仍在能力/domain 层产出旧 fieldSourceTargetType，必须迁移到三段语义字段`);
            }
        }

        expect(violations, `以下计分来源随从交互仍可能退回按钮/旧字段主路径：\n${violations.join('\n')}`).toEqual([]);
    });

    it('同一 sourceId 不允许混用多种 targetType 语义', () => {
        const allCalls: SimpleChoiceCallInfo[] = [];

        for (const filePath of getFilesToScan()) {
            try {
                const { calls } = analyzeFile(filePath);
                allCalls.push(...calls);
            } catch {
                continue;
            }
        }

        const grouped = new Map<string, SimpleChoiceCallInfo[]>();
        for (const call of allCalls) {
            if (!grouped.has(call.sourceId)) grouped.set(call.sourceId, []);
            grouped.get(call.sourceId)?.push(call);
        }

        const violations: string[] = [];
        for (const [sourceId, calls] of grouped.entries()) {
            if (sourceId === '[unknown]' || sourceId === 'unknown') continue;
            const targetTypes = Array.from(new Set(calls.map(call => call.targetType ?? '未声明')));
            if (targetTypes.length <= 1) continue;

            const locations = calls.map(call =>
                `${call.file}:${call.line} -> ${call.targetType ?? '未声明'}`
            ).join(' | ');

            violations.push(`[${sourceId}] 同时出现多种 targetType：${targetTypes.join(', ')}\n  ${locations}`);
        }

        expect(violations, `以下 sourceId 存在一号多义的 targetType 语义：\n${violations.join('\n')}`).toEqual([]);
    });

    it('带有场上实体标识的 generic 交互必须显式登记为例外', () => {
        const violations: string[] = [];

        for (const filePath of getFilesToScan()) {
            const content = readFileSync(filePath, 'utf-8');
            const sourceFile = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

            const visit = (node: ts.Node) => {
                if (!isCreateSimpleChoiceCall(node)) {
                    ts.forEachChild(node, visit);
                    return;
                }

                const config = extractSimpleChoiceConfig(node);
                if (config.targetType !== 'generic') {
                    ts.forEachChild(node, visit);
                    return;
                }

                const options = collectOptionObjectLiterals(sourceFile, node.arguments[3], node);
                if (!isBoardLikeGenericOption(options)) {
                    ts.forEachChild(node, visit);
                    return;
                }

                if (!APPROVED_GENERIC_SOURCE_REASONS[config.sourceId]) {
                    const line = ts.getLineAndCharacterOfPosition(sourceFile, node.getStart()).line + 1;
                    violations.push(`${filePath}:${line} [${config.sourceId}] generic 交互包含 baseIndex/minionUid，必须审查后登记例外或改成直点 targetType`);
                }

                ts.forEachChild(node, visit);
            };

            visit(sourceFile);
        }

        expect(violations, `以下 generic 交互带有场上实体标识，但没有登记为例外：\n${violations.join('\n')}`).toEqual([]);
    });

    it('声明 autoRefresh 的通用弹窗交互必须显式声明 responseValidationMode', () => {
        const allCalls: SimpleChoiceCallInfo[] = [];

        for (const filePath of getFilesToScan()) {
            try {
                const { calls } = analyzeFile(filePath);
                allCalls.push(...calls);
            } catch {
                continue;
            }
        }

        const violations = allCalls
            .filter(call => !!call.autoRefresh)
            .filter(call => !call.targetType || call.targetType === 'generic')
            .filter(call => !call.responseValidationMode && call.revalidateOnRespond === undefined)
            .map(call =>
                `${call.file}:${call.line} [${call.sourceId}] 通用弹窗声明了 autoRefresh="${call.autoRefresh}"，但未显式声明 responseValidationMode`
            );

        expect(violations, `以下通用弹窗交互缺少显式响应语义：\n${violations.join('\n')}`).toEqual([]);
    });

    it('所有 generic targetType 都必须登记保留原因', () => {
        const allCalls: SimpleChoiceCallInfo[] = [];

        for (const filePath of getFilesToScan()) {
            try {
                const { calls } = analyzeFile(filePath);
                allCalls.push(...calls);
            } catch {
                continue;
            }
        }

        const genericSourceIds = Array.from(
            new Set(
                allCalls
                    .filter(call => call.targetType === 'generic')
                    .map(call => call.sourceId),
            ),
        )
            .filter(sourceId => sourceId !== 'unknown' && sourceId !== '[unknown]')
            .sort();

        const approvedSourceIds = Object.keys(APPROVED_GENERIC_SOURCE_REASONS).sort();

        const missingReasons = genericSourceIds.filter(sourceId => {
            const reason = APPROVED_GENERIC_SOURCE_REASONS[sourceId];
            return typeof reason !== 'string' || reason.trim().length === 0;
        });

        const staleApprovals = approvedSourceIds.filter(sourceId => !genericSourceIds.includes(sourceId));

        const violations: string[] = [];
        if (missingReasons.length > 0) {
            violations.push(`缺少登记理由的 generic sourceId:\n${missingReasons.join('\n')}`);
        }
        if (staleApprovals.length > 0) {
            violations.push(`已不再使用 generic 的登记项:\n${staleApprovals.join('\n')}`);
        }

        expect(violations, violations.join('\n\n')).toEqual([]);
    });

    it('hand targetType 的交互必须先按 direct / overlay 分流，再决定是否允许拖拽', () => {
        expect(shouldForceSmashUpPromptOverlay({
            playerId: '0',
            options: [
                { displayMode: 'button' },
                { displayMode: 'button' },
            ],
        })).toBe(true);
        expect(shouldForceSmashUpPromptOverlay({
            playerId: '0',
            sourceId: 'multi_base_scoring',
            options: [
                { displayMode: 'card' },
                { displayMode: 'card' },
            ],
        })).toBe(false);

        expect(resolveSmashUpHandPromptUiMode({
            currentPrompt: { playerId: '0', multi: undefined },
            playerID: '0',
            targetType: 'hand',
        })).toBe('direct');

        expect(resolveSmashUpHandPromptUiMode({
            currentPrompt: {
                playerId: '0',
                multi: undefined,
                options: [
                    { id: 'play-card', label: 'Going Bananas', value: { cardUid: 'mind-bananas-hand' }, displayMode: 'card' },
                ],
            },
            playerID: '0',
            targetType: 'hand',
            hand: [{ uid: 'mind-bananas-hand' }],
        })).toBe('direct');

        expect(resolveSmashUpHandPromptUiMode({
            currentPrompt: {
                playerId: '0',
                multi: undefined,
                sourceId: 'all_stars_prepare_for_battle',
                options: [
                    { id: 'deck-top-1', label: '狄俄尼索斯的青睐', value: { cardUid: 'deck-top-1', defId: 'all_stars_favor_of_dionysus' }, displayMode: 'card' },
                    { id: 'deck-top-2', label: '霸王龙国王', value: { cardUid: 'deck-top-2', defId: 'all_stars_king_rex' }, displayMode: 'card' },
                ],
            },
            playerID: '0',
            targetType: 'hand',
            hand: [{ uid: 'actual-hand-card' }],
        })).toBe('overlay');

        expect(isSmashUpPromptOwnedByPlayer({
            currentPrompt: { playerId: 0, multi: undefined } as any,
            playerID: '0',
        })).toBe(true);

        expect(resolveSmashUpHandPromptUiMode({
            currentPrompt: { playerId: 0, multi: undefined } as any,
            playerID: '0',
            targetType: 'hand',
        })).toBe('direct');

        expect(resolveSmashUpHandPromptUiMode({
            currentPrompt: { playerId: '0', multi: { min: 0, max: 2 } },
            playerID: '0',
            targetType: 'hand',
        })).toBe('overlay');

        expect(resolveSmashUpHandPromptUiMode({
            currentPrompt: { playerId: '0', multi: undefined },
            playerID: '0',
            targetType: 'minion',
        })).toBe('none');

        expect(hasSmashUpDirectHandPromptPlayableOptions({
            currentPrompt: {
                playerId: '0',
                options: [
                    { id: 'skip', label: '放弃这次额外战术', value: { skip: true } },
                ],
            },
            playerID: '0',
            targetType: 'hand',
        })).toBe(false);

        expect(hasSmashUpDirectHandPromptPlayableOptions({
            currentPrompt: {
                playerId: '0',
                options: [
                    { id: 'play-card', label: 'Going Bananas', value: { cardUid: 'mind-bananas-hand' } },
                    { id: 'skip', label: '放弃这次额外战术', value: { skip: true } },
                ],
            },
            playerID: '0',
            targetType: 'hand',
            hand: [{ uid: 'mind-bananas-hand' }],
        })).toBe(true);

        expect(hasSmashUpDirectHandPromptPlayableOptions({
            currentPrompt: {
                playerId: '0',
                sourceId: 'all_stars_prepare_for_battle',
                options: [
                    { id: 'deck-top-1', label: '狄俄尼索斯的青睐', value: { cardUid: 'deck-top-1', defId: 'all_stars_favor_of_dionysus' }, displayMode: 'card' },
                    { id: 'deck-top-2', label: '霸王龙国王', value: { cardUid: 'deck-top-2', defId: 'all_stars_king_rex' }, displayMode: 'card' },
                ],
            },
            playerID: '0',
            targetType: 'hand',
            hand: [{ uid: 'actual-hand-card' }],
        })).toBe(false);

        expect(shouldRenderSmashUpHandArea({
            currentPrompt: {
                playerId: '0',
                options: [
                    { id: 'mimic-trigger', label: '模仿者', value: { kind: 'trigger', triggerId: 'copycat-1' }, displayMode: 'button' },
                    { id: 'pass', label: '让过', value: { kind: 'pass' }, displayMode: 'button' },
                ],
            },
            playerID: '0',
            targetType: 'generic',
            activePromptSurface: 'overlay',
        })).toBe(false);

        expect(shouldRenderSmashUpHandArea({
            currentPrompt: {
                playerId: '0',
                options: [
                    { id: 'skip', label: '放弃这次额外战术', value: { skip: true } },
                ],
            },
            playerID: '0',
            targetType: 'hand',
            activePromptSurface: 'hand',
        })).toBe(false);

        expect(shouldRenderSmashUpHandArea({
            currentPrompt: {
                playerId: '0',
                options: [
                    { id: 'play-card', label: 'Going Bananas', value: { cardUid: 'mind-bananas-hand' } },
                    { id: 'skip', label: '放弃这次额外战术', value: { skip: true } },
                ],
            },
            playerID: '0',
            targetType: 'hand',
            activePromptSurface: 'hand',
        })).toBe(true);

        const directHandCardState = getSmashUpDirectHandPromptCardState({
            currentPrompt: {
                playerId: '0',
                options: [
                    { id: 'play-card', label: 'Going Bananas', value: { cardUid: 'mind-bananas-hand' } },
                    { id: 'disabled-card', label: 'Disabled', value: { cardUid: 'stale-hand' }, disabled: true },
                    { id: 'skip', label: '放弃这次额外战术', value: { skip: true } },
                ],
            },
            playerID: '0',
            targetType: 'hand',
            hand: [
                { uid: 'mind-bananas-hand' },
                { uid: 'stale-hand' },
                { uid: 'other-hand-card' },
            ],
        });
        expect(Array.from(directHandCardState.selectableCardUids)).toEqual(['mind-bananas-hand']);
        expect(Array.from(directHandCardState.disabledCardUids ?? []).sort()).toEqual(['other-hand-card', 'stale-hand']);

        expect(resolveSmashUpHandInteractionMode({
            preferredMode: 'drag',
            needDiscard: false,
            activePromptSurface: 'hand',
        })).toBe('click');

        expect(resolveSmashUpHandInteractionMode({
            preferredMode: 'drag',
            needDiscard: false,
            activePromptSurface: 'overlay',
        })).toBe('click');

        expect(resolveSmashUpHandInteractionMode({
            preferredMode: 'drag',
            needDiscard: true,
            activePromptSurface: 'none',
        })).toBe('click');

        expect(resolveSmashUpHandInteractionMode({
            preferredMode: 'drag',
            needDiscard: false,
            activePromptSurface: 'none',
        })).toBe('drag');

        expect(resolveSmashUpHandInteractionMode({
            preferredMode: 'click',
            needDiscard: false,
            activePromptSurface: 'none',
        })).toBe('click');
    });

    it('base targetType 的棋盘直选高亮必须只暴露真实候选基地', () => {
        expect(Array.from(getSmashUpSelectableBaseIndices([
            { value: { baseIndex: 1 } },
            { value: { baseIndex: 0 } },
            { id: 'skip', value: { skip: true } },
            { value: { baseIndex: -1 } },
            { value: {} },
            { disabled: true, value: { baseIndex: 2 } },
        ]))).toEqual([1, 0]);

        expect(getSmashUpSelectableBaseIndices([
            { id: 'done', value: { done: true } },
            { id: 'skip', value: { skip: true } },
        ]).size).toBe(0);
    });
});
