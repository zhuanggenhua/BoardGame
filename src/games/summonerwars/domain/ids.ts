/**
 * 召唤师战争 - 领域 ID 常量表
 *
 * 所有稳定 ID 在此定义（as const），禁止字符串字面量。
 * 包含事件卡 baseId、工具函数等。
 */

import type { FactionId, UnitTag } from './types';

// ============================================================================
// 阵营 ID
// ============================================================================

/** 所有合法阵营 ID（从 FactionId 类型派生） */
export const VALID_FACTION_IDS: readonly FactionId[] = [
  'necromancer', 'trickster', 'paladin', 'goblin', 'frost', 'barbaric', 'mogu', 'huijin', 'shouren', 'yongheng', 'shadow', 'zhongcai',
] as const;

// ============================================================================
// 事件卡 / 技能卡 baseId 常量
// ============================================================================

/** 亡灵法师 */
export const CARD_IDS = {
  // 亡灵法师事件卡
  NECRO_HELLFIRE_BLADE: 'necro-hellfire-blade',
  NECRO_FUNERAL_PYRE: 'necro-funeral-pyre',
  NECRO_ANNIHILATE: 'necro-annihilate',
  NECRO_BLOOD_SUMMON: 'necro-blood-summon',

  // 欺心巫族事件卡
  TRICKSTER_MIND_CONTROL: 'trickster-mind-control',
  TRICKSTER_STORM_ASSAULT: 'trickster-storm-assault',
  TRICKSTER_HYPNOTIC_LURE: 'trickster-hypnotic-lure',
  TRICKSTER_STUN: 'trickster-stun',

  // 圣堂骑士事件卡
  PALADIN_REKINDLE_HOPE: 'paladin-rekindle-hope',
  PALADIN_HOLY_JUDGMENT: 'paladin-holy-judgment',
  PALADIN_HOLY_PROTECTION: 'paladin-holy-protection',
  PALADIN_MASS_HEALING: 'paladin-mass-healing',

  // 洞穴地精事件卡
  GOBLIN_RELENTLESS: 'goblin-relentless',
  GOBLIN_SWARM: 'goblin-swarm',
  GOBLIN_FRENZY: 'goblin-frenzy',
  GOBLIN_SNEAK: 'goblin-sneak',

  // 极地矮人事件卡
  FROST_ICE_RAM: 'frost-ice-ram',
  FROST_GLACIAL_SHIFT: 'frost-glacial-shift',
  FROST_ICE_REPAIR: 'frost-ice-repair',
  FROST_PARAPET: 'frost-parapet',

  // 炽原精灵事件卡
  BARBARIC_CHANT_OF_WEAVING: 'barbaric-chant-of-weaving',
  BARBARIC_CHANT_OF_POWER: 'barbaric-chant-of-power',
  BARBARIC_CHANT_OF_GROWTH: 'barbaric-chant-of-growth',
  BARBARIC_CHANT_OF_ENTANGLEMENT: 'barbaric-chant-of-entanglement',
  BARBARIC_RALLYING_CRY: 'barbaric-rallying-cry',

  // 莫古事件卡
  MOGU_COMMAND: 'mogu-command',
  MOGU_SYMBIOTIC_SELF_HEALING: 'mogu-symbiotic-self-healing',
  MOGU_FANATICAL_FUNGUS: 'mogu-fanatical-fungus',
  MOGU_RELEASE_SPORES: 'mogu-release-spores',

  // 灰烬事件卡
  HUIJIN_DAZZLING_LIGHT: 'huijin-dazzling-light',
  HUIJIN_SCORCH: 'huijin-scorch',
  HUIJIN_DIVINE_REVENGE: 'huijin-divine-revenge',
  HUIJIN_PHOENIX_SOUL: 'huijin-phoenix-soul',

  // 冰苔兽人事件卡
  SHOUREN_FREEZE: 'shouren-freeze',
  SHOUREN_BRUTE_FORCE: 'shouren-brute-force',
  SHOUREN_PRIMAL_FURY: 'shouren-primal-fury',
  SHOUREN_SUPREME_GLORY: 'shouren-supreme-glory',

  // 永恒议会事件卡
  YONGHENG_LEARNING: 'yongheng-learning',
  YONGHENG_INSIGHT: 'yongheng-insight',
  YONGHENG_SEARCH: 'yongheng-search',
  YONGHENG_MENTAL_INVASION: 'yongheng-mental-invasion',

  // 暗影精灵事件卡
  SHADOW_HIDE_IN_DARKNESS: 'shadow-hide-in-darkness',
  SHADOW_MARL_GRIMOIRE: 'shadow-marl-grimoire',
  SHADOW_LIGHTNING_STEP: 'shadow-lightning-step',
  SHADOW_SHADOW_PULSE: 'shadow-shadow-pulse',

  // 仲裁事件卡
  ZHONGCAI_OBEDIENCE: 'zhongcai-obedience',
  ZHONGCAI_HOLY_DECREE: 'zhongcai-holy-decree',
  ZHONGCAI_LOYALTY_DECREE: 'zhongcai-loyalty-decree',
  ZHONGCAI_FREEDOM_DECREE: 'zhongcai-freedom-decree',
} as const;

// ============================================================================
// 工具函数
// ============================================================================

/**
 * 从带后缀的卡牌 ID 中提取 baseId
 *
 * 卡牌 ID 格式：`<baseId>-<playerId>-<index>` 或 `<baseId>-<playerId>`
 * 例：`necro-hellfire-blade-0-2` → `necro-hellfire-blade`
 */
export function getBaseCardId(id: string): string {
  // 先剥离 instanceId 后缀（如 frost-archer#3 → frost-archer）
  const withoutInstance = id.replace(/#\d+$/, '');
  return withoutInstance.replace(/-\d+-\d+$/, '').replace(/-\d+$/, '');
}

export function hasUnitTag(card: { cardType?: string; unitTags?: readonly UnitTag[] }, tag: UnitTag): boolean {
  if (card.cardType !== undefined && card.cardType !== 'unit') return false;
  return card.unitTags?.includes(tag) ?? false;
}

/** 判断卡牌是否有疫病体 / Carrier 单位标签。 */
export function isCarrierCard(card: { cardType?: string; unitTags?: readonly UnitTag[] }): boolean {
  return hasUnitTag(card, 'carrier');
}

/**
 * 兼容旧感染链命名：现实规则含义是“疫病体 / Carrier 标签”，不是亡灵法师阵营或卡名关键词。
 */
export function isPlagueZombieCard(card: { cardType?: string; unitTags?: readonly UnitTag[] }): boolean {
  return isCarrierCard(card);
}

/** 判断卡牌是否为莫古链路可消费的菌袍疫病体：莫古单位且带疫病体 / Carrier 标签。 */
export function isMoguSporePlagueBodyCard(card: { cardType?: string; faction?: string; unitTags?: readonly UnitTag[] }): boolean {
  return card.faction === 'mogu' && isCarrierCard(card);
}

/** 判断卡牌是否为莫古的菌化野兽 */
export function isMoguFungalBeastCard(card: { id: string; name: string; faction?: string }): boolean {
  return card.faction === 'mogu'
    && (getBaseCardId(card.id) === 'mogu-fungal-beast' || card.name.includes('菌化野兽'));
}

/** 判断卡牌是否有城塞 / Citadel 单位标签。 */
export function isFortressUnit(card: { cardType?: string; unitTags?: readonly UnitTag[] }): boolean {
  return hasUnitTag(card, 'citadel');
}

/**
 * 判断卡牌是否为亡灵单位
 *
 * 亡灵判定看卡牌自身种族语义，不等于整个亡灵法师阵营。
 * 地狱火教徒同属 necromancer，但不是复活死灵可选择的亡灵单位。
 */
export function isUndeadCard(card: { cardType: string; unitTags?: readonly UnitTag[] }): boolean {
  return hasUnitTag(card, 'undead');
}

