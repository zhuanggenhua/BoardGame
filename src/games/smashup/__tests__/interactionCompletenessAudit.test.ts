/**
 * 大杀四方 - 交互完整性审计测试
 *
 * 验证 Interaction 链的完整性：
 * 1. Handler 注册覆盖 — 所有能力创建的 sourceId 都有对应 handler
 * 2. 链式完整性 — handler 产出的后续 sourceId 也有对应 handler
 * 3. 孤儿 Handler — 注册了 handler 但无能力引用
 *
 * 使用引擎层 interactionCompletenessAudit 工厂函数。
 */

import type {
  AuditableInteractionSource,
  HandlerChainLink,
} from '../../../engine/testing/interactionCompletenessAudit';
import { createInteractionCompletenessAuditSuite } from '../../../engine/testing/interactionCompletenessAudit';
import { initAllAbilities, resetAbilityInit } from '../abilities';
import { clearRegistry } from '../domain/abilityRegistry';
import { clearBaseAbilityRegistry } from '../domain/baseAbilities';
import { getRegisteredInteractionHandlerIds, clearInteractionHandlers } from '../domain/abilityInteractionHandlers';

// ============================================================================
// 初始化
// ============================================================================

let _initialized = false;

function ensureInit(): void {
  if (_initialized) return;
  _initialized = true;
  clearRegistry();
  clearBaseAbilityRegistry();
  clearInteractionHandlers();
  resetAbilityInit();
  initAllAbilities();
}

function getHandlerIds(): Set<string> {
  ensureInit();
  return getRegisteredInteractionHandlerIds();
}

// ============================================================================
// 交互源声明
//
// 每个条目声明一个能力/卡牌创建的 Interaction sourceId。
// 从代码中提取：createSimpleChoice(..., sourceId) 的第 5 个参数。
// 新增派系/能力时必须同步更新此列表。
//
// 注意：sourceId 是 handler 注册表的 key，不是 createSimpleChoice 的第 1 个参数（那个带时间戳）。
// ============================================================================

const INTERACTION_SOURCES: AuditableInteractionSource[] = [
  // ── 外星人 ──
  { id: 'alien_supreme_overlord', name: '最高指挥官', interactionSourceIds: ['alien_supreme_overlord'] },
  { id: 'alien_collector', name: '收集者', interactionSourceIds: ['alien_collector'] },
  { id: 'alien_invasion', name: '入侵', interactionSourceIds: ['alien_invasion_choose_minion', 'alien_invasion_choose_base'] },
  { id: 'alien_disintegrator', name: '分解者', interactionSourceIds: ['alien_disintegrator'] },
  { id: 'alien_beam_up', name: '光束捕捉', interactionSourceIds: ['alien_beam_up'] },
  { id: 'alien_crop_circles', name: '麦田怪圈', interactionSourceIds: ['alien_crop_circles', 'alien_crop_circles_choose_minion'] },
  { id: 'alien_probe', name: '探究', interactionSourceIds: ['alien_probe', 'alien_probe_choose_target'] },
  { id: 'alien_terraform', name: '适居化', interactionSourceIds: ['alien_terraform', 'alien_terraform_choose_replacement', 'alien_terraform_play_minion'] },
  { id: 'alien_scout', name: '侦察兵', interactionSourceIds: ['alien_scout_return'] },
  { id: 'alien_abduction', name: '绑架', interactionSourceIds: ['alien_abduction'] },

  // ── 海盗 ──
  { id: 'pirate_saucy_wench', name: '泼辣女海盗', interactionSourceIds: ['pirate_saucy_wench'] },
  { id: 'pirate_broadside', name: '舷炮齐射', interactionSourceIds: ['pirate_broadside'] },
  { id: 'pirate_cannon', name: '大炮', interactionSourceIds: ['pirate_cannon_choose_first'] },
  { id: 'pirate_full_sail', name: '全速前进', interactionSourceIds: ['pirate_full_sail_choose_minion'] },
  { id: 'pirate_dinghy', name: '小艇', interactionSourceIds: ['pirate_dinghy_choose_first'] },
  { id: 'pirate_shanghai', name: '拉壮丁', interactionSourceIds: ['pirate_shanghai_choose_minion'] },
  { id: 'pirate_sea_dogs', name: '海狗', interactionSourceIds: ['pirate_sea_dogs_choose_faction'] },
  { id: 'pirate_powderkeg', name: '火药桶', interactionSourceIds: ['pirate_powderkeg'] },

  // ── 忍者 ──
  { id: 'ninja_master', name: '忍者大师', interactionSourceIds: ['ninja_master'] },
  { id: 'ninja_tiger_assassin', name: '虎爪刺客', interactionSourceIds: ['ninja_tiger_assassin'] },
  { id: 'ninja_seeing_stars', name: '眼冒金星', interactionSourceIds: ['ninja_seeing_stars'] },
  { id: 'ninja_disguise', name: '伪装', interactionSourceIds: ['ninja_disguise_choose_base', 'ninja_disguise_choose_minions'] },
  { id: 'ninja_hidden_ninja', name: '隐忍', interactionSourceIds: ['ninja_hidden_ninja'] },
  { id: 'ninja_way_of_deception', name: '欺诈之道', interactionSourceIds: ['ninja_way_of_deception_choose_minion'] },

  // ── 恐龙 ──
  { id: 'dino_laser_triceratops', name: '激光三角龙', interactionSourceIds: ['dino_laser_triceratops'] },
  { id: 'dino_augmentation', name: '增强', interactionSourceIds: ['dino_augmentation'] },
  { id: 'dino_natural_selection', name: '物竞天择', interactionSourceIds: ['dino_natural_selection_choose_mine'] },
  { id: 'dino_survival_tiebreak', name: '适者生存（平局选择）', interactionSourceIds: ['dino_survival_tiebreak'] },
  { id: 'dino_rampage', name: '狂暴', interactionSourceIds: ['dino_rampage'] },

  // ── 机器人 ──
  { id: 'robot_microbot_guard', name: '微型机守护者', interactionSourceIds: ['robot_microbot_guard'] },
  { id: 'robot_tech_center', name: '技术中心', interactionSourceIds: ['robot_tech_center'] },
  { id: 'robot_zapbot', name: '高速机器人', interactionSourceIds: ['robot_zapbot'] },
  { id: 'robot_hoverbot', name: '盘旋机器人', interactionSourceIds: ['robot_hoverbot'] },

  // ── 法师 ──
  { id: 'wizard_neophyte', name: '学徒', interactionSourceIds: ['wizard_neophyte'] },
  { id: 'wizard_mass_enchantment', name: '聚集秘术', interactionSourceIds: ['wizard_mass_enchantment'] },
  { id: 'wizard_scry', name: '占卜', interactionSourceIds: ['wizard_scry'] },
  { id: 'wizard_sacrifice', name: '献祭', interactionSourceIds: ['wizard_sacrifice'] },
  { id: 'wizard_portal', name: '传送', interactionSourceIds: ['wizard_portal_pick', 'wizard_portal_order'] },

  // ── 僵尸 ──
  { id: 'zombie_grave_digger', name: '掘墓者', interactionSourceIds: ['zombie_grave_digger'] },
  { id: 'zombie_walker', name: '行尸', interactionSourceIds: ['zombie_walker'] },
  { id: 'zombie_grave_robbing', name: '掘墓', interactionSourceIds: ['zombie_grave_robbing'] },
  { id: 'zombie_not_enough_bullets', name: '子弹不够', interactionSourceIds: ['zombie_not_enough_bullets'] },
  { id: 'zombie_lord', name: '僵尸领主', interactionSourceIds: ['zombie_lord_pick'] },
  { id: 'zombie_outbreak', name: '爆发', interactionSourceIds: ['zombie_outbreak_choose_base', 'zombie_outbreak_choose_minion'] },
  { id: 'zombie_mall_crawl', name: '进发商场', interactionSourceIds: ['zombie_mall_crawl'] },
  { id: 'zombie_lend_a_hand', name: '借把手', interactionSourceIds: ['zombie_lend_a_hand'] },
  { id: 'zombie_they_keep_coming', name: '它们不断来临', interactionSourceIds: ['zombie_they_keep_coming'] },
  // zombie_theyre_coming_to_get_you 和 zombie_tenacious_z 现在通过 DiscardPlayProvider 实现，不再使用交互
  // ghost_spectre 同上

  // ── 诡术师 ──
  { id: 'trickster_gnome', name: '侏儒', interactionSourceIds: ['trickster_gnome'] },
  { id: 'trickster_disenchant', name: '幻想破碎', interactionSourceIds: ['trickster_disenchant'] },
  { id: 'trickster_mark_of_sleep', name: '沉睡印记', interactionSourceIds: ['trickster_mark_of_sleep'] },
  { id: 'trickster_block_the_path', name: '封路', interactionSourceIds: ['trickster_block_the_path'] },

  // ── 幽灵 ──
  { id: 'ghost_ghost', name: '幽灵', interactionSourceIds: ['ghost_ghost'] },
  { id: 'ghost_spirit', name: '灵魂', interactionSourceIds: ['ghost_spirit'] },
  { id: 'ghost_make_contact', name: '交朋友', interactionSourceIds: ['ghost_make_contact'] },
  { id: 'ghost_the_dead_rise', name: '亡者复苏', interactionSourceIds: ['ghost_the_dead_rise_discard'] },
  { id: 'ghost_across_the_divide', name: '跨越鸿沟', interactionSourceIds: ['ghost_across_the_divide'] },
  // ghost_spectre 现在通过 DiscardPlayProvider 实现，不再使用交互

  // ── 熊骑兵 ──
  { id: 'bear_cavalry_bear_cavalry', name: '熊骑兵', interactionSourceIds: ['bear_cavalry_bear_cavalry_choose_minion'] },
  { id: 'bear_cavalry_bear_necessities', name: '熊之必需', interactionSourceIds: ['bear_cavalry_bear_necessities'] },
  { id: 'bear_cavalry_youre_screwed', name: '你完了', interactionSourceIds: ['bear_cavalry_youre_screwed_choose_base'] },
  { id: 'bear_cavalry_bear_rides_you', name: '熊骑你', interactionSourceIds: ['bear_cavalry_bear_rides_you_choose_minion'] },
  { id: 'bear_cavalry_borscht', name: '罗宋汤', interactionSourceIds: ['bear_cavalry_borscht_choose_from'] },

  // ── 蒸汽朋克 ──
  { id: 'steampunk_scrap_diving', name: '废品潜水', interactionSourceIds: ['steampunk_scrap_diving'] },
  { id: 'steampunk_mechanic', name: '机械师', interactionSourceIds: ['steampunk_mechanic'] },
  { id: 'steampunk_change_of_venue', name: '换场', interactionSourceIds: ['steampunk_change_of_venue'] },
  { id: 'steampunk_zeppelin', name: '飞艇', interactionSourceIds: ['steampunk_zeppelin'] },

  // ── 杀手植物 ──
  { id: 'killer_plant_venus_man_trap', name: '捕蝇草', interactionSourceIds: ['killer_plant_venus_man_trap_search'] },
  { id: 'killer_plant_sprout', name: '嫩芽', interactionSourceIds: ['killer_plant_sprout_search'] },
  { id: 'killer_plant_budding', name: '萌芽', interactionSourceIds: ['killer_plant_budding_choose'] },

  // ── 印斯茅斯 ──
  { id: 'innsmouth_mysteries_of_the_deep', name: '深海之谜', interactionSourceIds: ['innsmouth_mysteries_of_the_deep'] },

  // ── 米斯卡托尼克 ──
  { id: 'miskatonic_it_might_just_work', name: '也许行得通', interactionSourceIds: ['miskatonic_it_might_just_work'] },
  { id: 'miskatonic_book_of_iter', name: '旅行之书', interactionSourceIds: ['miskatonic_book_of_iter_choose_opponent'] },
  { id: 'miskatonic_mandatory_reading', name: '强制阅读', interactionSourceIds: ['miskatonic_mandatory_reading'] },
  { id: 'miskatonic_those_meddling_kids', name: '多管闲事的小鬼', interactionSourceIds: ['miskatonic_those_meddling_kids'] },
  { id: 'miskatonic_field_trip', name: '实地考察', interactionSourceIds: ['miskatonic_field_trip'] },

  // ── 克苏鲁 ──
  { id: 'cthulhu_corruption', name: '腐化', interactionSourceIds: ['cthulhu_corruption'] },
  { id: 'cthulhu_servitor', name: '仆从', interactionSourceIds: ['cthulhu_servitor'] },
  { id: 'cthulhu_star_spawn', name: '星之眷族', interactionSourceIds: ['cthulhu_star_spawn'] },
  { id: 'cthulhu_madness_unleashed', name: '疯狂释放', interactionSourceIds: ['cthulhu_madness_unleashed'] },
  { id: 'special_madness', name: '疯狂', interactionSourceIds: ['special_madness'] },

  // ── 远古之物 ──
  { id: 'elder_thing_begin_the_summoning', name: '开始召唤', interactionSourceIds: ['elder_thing_begin_the_summoning'] },
  { id: 'elder_thing_elder_thing_choice', name: '远古之物选择', interactionSourceIds: ['elder_thing_elder_thing_choice'] },
  { id: 'elder_thing_shoggoth', name: '修格斯', interactionSourceIds: ['elder_thing_shoggoth_opponent'] },
  { id: 'elder_thing_unfathomable_goals', name: '深不可测的目的', interactionSourceIds: ['elder_thing_unfathomable_goals'] },

  // ── 基地能力 ──
  { id: 'base_cave_of_shinies', name: '闪光洞穴', interactionSourceIds: [] },
  { id: 'base_tar_pits', name: '沥青坑', interactionSourceIds: [] },
  { id: 'base_the_workshop', name: '工坊', interactionSourceIds: [] },
  { id: 'base_pirate_cove', name: '海盗湾', interactionSourceIds: ['base_pirate_cove', 'base_pirate_cove_choose_base'] },
  { id: 'base_ninja_dojo', name: '忍者道场', interactionSourceIds: ['base_ninja_dojo'] },
  { id: 'base_stadium', name: '体育场', interactionSourceIds: [] },
  { id: 'base_wizard_academy', name: '法师学院', interactionSourceIds: ['base_wizard_academy'] },
  { id: 'base_mushroom_kingdom', name: '蘑菇王国', interactionSourceIds: ['base_mushroom_kingdom'] },
  { id: 'base_the_asylum', name: '疯人院', interactionSourceIds: ['base_the_asylum'] },
  { id: 'base_innsmouth_base', name: '印斯茅斯基地', interactionSourceIds: ['base_innsmouth_base'] },
  { id: 'base_miskatonic_university_base', name: '米斯卡托尼克大学', interactionSourceIds: ['base_miskatonic_university_base'] },
  { id: 'base_plateau_of_leng', name: '冷原高原', interactionSourceIds: ['base_plateau_of_leng'] },
  { id: 'base_greenhouse', name: '温室', interactionSourceIds: ['base_greenhouse'] },
  { id: 'base_inventors_salon', name: '发明家沙龙', interactionSourceIds: ['base_inventors_salon'] },
  { id: 'base_cat_fanciers_alley', name: '猫咪巷', interactionSourceIds: ['base_cat_fanciers_alley'] },
  { id: 'base_land_of_balance', name: '平衡之地', interactionSourceIds: ['base_land_of_balance'] },
  { id: 'base_sheep_shrine', name: '绵羊神社', interactionSourceIds: ['base_sheep_shrine'] },
  { id: 'base_the_pasture', name: '牧场', interactionSourceIds: ['base_the_pasture'] },

  // ── 多基地计分 ──
  { id: 'multi_base_scoring', name: '多基地计分', interactionSourceIds: ['multi_base_scoring'] },
];

// ============================================================================
// 链式交互声明
//
// handler 内部创建后续 Interaction 的映射。
// ============================================================================

const HANDLER_CHAINS: HandlerChainLink[] = [
  // 僵尸爆发：选基地 → 选随从
  { sourceId: 'zombie_outbreak_choose_base', producesSourceIds: ['zombie_outbreak_choose_minion'] },
  // 海盗大炮：选第一个 → 选第二个
  { sourceId: 'pirate_cannon_choose_first', producesSourceIds: ['pirate_cannon_choose_second'] },
  // 海盗全速前进：选随从 → 选基地（循环直到完成）
  { sourceId: 'pirate_full_sail_choose_minion', producesSourceIds: ['pirate_full_sail_choose_base'] },
  { sourceId: 'pirate_full_sail_choose_base', producesSourceIds: ['pirate_full_sail_choose_minion'] },
  // 海盗湾：选随从 → 选目标基地
  { sourceId: 'base_pirate_cove', producesSourceIds: ['base_pirate_cove_choose_base'] },
  // 海盗小艇：选第一个 → 选基地 → 选第二个 → 选基地
  { sourceId: 'pirate_dinghy_choose_first', producesSourceIds: ['pirate_dinghy_first_choose_base'] },
  { sourceId: 'pirate_dinghy_first_choose_base', producesSourceIds: ['pirate_dinghy_choose_second'] },
  { sourceId: 'pirate_dinghy_choose_second', producesSourceIds: ['pirate_dinghy_second_choose_base'] },
  // 海盗拉壮丁：选随从 → 选基地
  { sourceId: 'pirate_shanghai_choose_minion', producesSourceIds: ['pirate_shanghai_choose_base'] },
  // 海盗海狗：选派系 → 选来源基地 → 选目标基地
  { sourceId: 'pirate_sea_dogs_choose_faction', producesSourceIds: ['pirate_sea_dogs_choose_from'] },
  { sourceId: 'pirate_sea_dogs_choose_from', producesSourceIds: ['pirate_sea_dogs_choose_to'] },
  // 忍者欺诈之道：选随从 → 选基地
  { sourceId: 'ninja_way_of_deception_choose_minion', producesSourceIds: ['ninja_way_of_deception_choose_base'] },
  // 忍者伪装：选基地 → 选随从 → 选打出1 → 选打出2
  { sourceId: 'ninja_disguise_choose_base', producesSourceIds: ['ninja_disguise_choose_minions'] },
  { sourceId: 'ninja_disguise_choose_minions', producesSourceIds: ['ninja_disguise_choose_play1'] },
  { sourceId: 'ninja_disguise_choose_play1', producesSourceIds: ['ninja_disguise_choose_play2'] },
  // 恐龙自然选择：选己方 → 选目标
  { sourceId: 'dino_natural_selection_choose_mine', producesSourceIds: ['dino_natural_selection_choose_target'] },
  // 外星人入侵：选随从 → 选基地
  { sourceId: 'alien_invasion_choose_minion', producesSourceIds: ['alien_invasion_choose_base'] },
  // 麦田怪圈：选基地 → 选随从（可循环）
  { sourceId: 'alien_crop_circles', producesSourceIds: ['alien_crop_circles_choose_minion'] },
  { sourceId: 'alien_crop_circles_choose_minion', producesSourceIds: ['alien_crop_circles_choose_minion'] },
  // 外星人探测：选对手 → 牌库顶/底选择
  { sourceId: 'alien_probe_choose_target', producesSourceIds: ['alien_probe'] },
  // 地形改造：选基地 → 选替换基地 →（可选）选手牌随从打到新基地
  { sourceId: 'alien_terraform', producesSourceIds: ['alien_terraform_choose_replacement'] },
  { sourceId: 'alien_terraform_choose_replacement', producesSourceIds: ['alien_terraform_play_minion'] },
  // 侦察兵：逐个确认是否回手（可循环）
  { sourceId: 'alien_scout_return', producesSourceIds: ['alien_scout_return'] },
  // 亡者复苏：弃牌 → 打出 → 选基地
  { sourceId: 'ghost_the_dead_rise_discard', producesSourceIds: ['ghost_the_dead_rise_play'] },
  { sourceId: 'ghost_the_dead_rise_play', producesSourceIds: ['ghost_the_dead_rise_base'] },
  // 灵魂：选目标 → 弃牌确认/力量0确认
  { sourceId: 'ghost_spirit', producesSourceIds: ['ghost_spirit_discard', 'ghost_spirit_confirm'] },
  // 高速机器人：选随从 → 选基地
  { sourceId: 'robot_zapbot', producesSourceIds: ['robot_zapbot_base'] },
  // 盘旋机器人：确认打出 → 选基地
  { sourceId: 'robot_hoverbot', producesSourceIds: ['robot_hoverbot_base'] },
  // 熊骑兵：选随从 → 选基地
  { sourceId: 'bear_cavalry_bear_cavalry_choose_minion', producesSourceIds: ['bear_cavalry_bear_cavalry_choose_base'] },
  // 你完了：选基地 → 选随从 → 选目的地
  { sourceId: 'bear_cavalry_youre_screwed_choose_base', producesSourceIds: ['bear_cavalry_youre_screwed_choose_minion'] },
  { sourceId: 'bear_cavalry_youre_screwed_choose_minion', producesSourceIds: ['bear_cavalry_youre_screwed_choose_dest'] },
  // 熊骑你：选随从 → 选基地
  { sourceId: 'bear_cavalry_bear_rides_you_choose_minion', producesSourceIds: ['bear_cavalry_bear_rides_you_choose_base'] },
  // 罗宋汤：选来源 → 选目的地
  { sourceId: 'bear_cavalry_borscht_choose_from', producesSourceIds: ['bear_cavalry_borscht_choose_dest'] },
  // 多基地计分继续（同一个 handler 循环使用）
  { sourceId: 'multi_base_scoring', producesSourceIds: ['multi_base_scoring'] },
  // 传送：选随从 → 排序循环
  { sourceId: 'wizard_portal_pick', producesSourceIds: ['wizard_portal_order'] },
  { sourceId: 'wizard_portal_order', producesSourceIds: ['wizard_portal_order'] },
  // 它们不断来临：选随从 → 选基地
  { sourceId: 'zombie_they_keep_coming', producesSourceIds: ['zombie_they_keep_coming_choose_base'] },
];

// ============================================================================
// 白名单
// ============================================================================

/** 由特殊系统处理的 handler（不由能力直接创建） */
const ORPHAN_WHITELIST = new Set([
  'pirate_dinghy_choose_second', // 链式中间步骤（由 pirate_dinghy_first_choose_base 产出）
  'pirate_sea_dogs_choose_from', // 链式中间步骤（由 pirate_sea_dogs_choose_faction 产出）
  'pirate_sea_dogs_choose_to', // 链式中间步骤（由 pirate_sea_dogs_choose_from 产出）
  'ninja_disguise_choose_play1', // 链式中间步骤（由 ninja_disguise_choose_minions 产出）
  'ninja_disguise_choose_play2', // 链式中间步骤（由 ninja_disguise_choose_play1 产出）
  'zombie_they_keep_coming_choose_base', // 链式中间步骤（由 zombie_they_keep_coming 产出）
  'base_haunted_house_al9000', // 扩展包基地 handler
  'base_rlyeh', // 扩展包基地 handler
  'base_the_mothership', // 扩展包基地 handler
  'base_tortuga', // 扩展包基地 handler
  'base_nine_lives_intercept', // 由 onMinionDestroyed trigger 内部创建交互，非标准能力源
]);

// ============================================================================
// 测试套件
// ============================================================================

ensureInit();

createInteractionCompletenessAuditSuite({
  suiteName: 'SmashUp 交互完整性',
  sources: INTERACTION_SOURCES,
  registeredHandlerIds: getHandlerIds(),
  chains: HANDLER_CHAINS,
  orphanWhitelist: ORPHAN_WHITELIST,
});
