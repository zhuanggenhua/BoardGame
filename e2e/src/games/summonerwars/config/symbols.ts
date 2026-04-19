/**
 * 召唤师战争 - 牌组符号常量（全局共享）
 * 
 * 用于牌组构建验证：卡牌必须至少有1个符号与召唤师匹配
 * 
 * 重要规则：
 * - 每个阵营有 2 种专属牌组符号
 * - 召唤师卡上显示 3 个图标：双斧（通用）+ 阵营的2种符号
 * - 卡牌上的符号用于牌组构建验证
 */

/** 
 * 召唤师战争牌组符号
 * 
 * 通用符号：
 * - DOUBLE_AXE（双斧）- 所有召唤师都有
 * 
 * 每个阵营 2 种专属符号：
 * - 堕落王国：FLAME（火焰）、MOON（新月）
 * - 欺心巫族：EYE（眼睛）、WAVE（波浪）
 * - 先锋军团：SHIELD（盾牌）、DIAMOND（钻石）
 * - 洞穴地精：CLAW（爪子）、MASK（面具）
 * - 极地矮人：SNOWFLAKE（雪花）、DROPLET（水滴）
 * - 炽原精灵：STAR（星形）、RHOMBUS（菱形）
 */
export const DECK_SYMBOLS = {
  // 通用符号（所有召唤师都有）
  DOUBLE_AXE: 'double_axe',  // ⚔️ 双斧
  
  // 堕落王国符号 (Fallen Kingdom / Necromancer)
  FLAME: 'flame',    // 🔥 火焰
  MOON: 'moon',      // 🌙 新月
  
  // 欺心巫族符号 (Trickster Clan)
  EYE: 'eye',        // 👁️ 眼睛
  WAVE: 'wave',      // 🌊 波浪
  
  // 先锋军团符号 (Vanguard / Paladin)
  SHIELD: 'shield',  // 🛡️ 盾牌
  DIAMOND: 'diamond', // 💎 钻石
  
  // 洞穴地精符号 (Cave Goblins / Goblin)
  CLAW: 'claw',      // 🐾 爪子
  MASK: 'mask',      // 🎭 面具
  
  // 极地矮人符号 (Frost Dwarves / Frost)
  SNOWFLAKE: 'snowflake', // ❄️ 雪花
  DROPLET: 'droplet',     // 💧 水滴
  
  // 炽原精灵符号 (Savanna Elves / Barbaric)
  STAR: 'star',           // ✧ 星形
  RHOMBUS: 'rhombus',     // 🔶 菱形
} as const;

export type DeckSymbol = typeof DECK_SYMBOLS[keyof typeof DECK_SYMBOLS];

/**
 * 阵营标识（非牌组符号，仅用于视觉识别）
 * 
 * 这些图标出现在召唤师卡的左上角，用于标识阵营，不参与牌组构建验证
 */
export const FACTION_ICONS = {
  NECROMANCER: 'skull',    // 💀 骷髅 - 堕落王国
  TRICKSTER: 'spiral',     // 🔮 螺旋 - 欺心巫族
  PALADIN: 'cross',        // ✝️ 十字 - 先锋军团
  GOBLIN: 'claw',          // 🐾 爪子 - 洞穴地精
  FROST: 'claw',           // 🐾 爪子 - 极地矮人
  BARBARIC: 'totem',       // 🔱 图腾 - 炽原精灵
} as const;
