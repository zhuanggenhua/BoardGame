/**
 * 召唤师战争 - 派系索引
 */

export * from './necromancer';
export * from './trickster';
export * from './paladin';
export { DECK_SYMBOLS } from '../symbols'; // 导出公共符号常量

// 派系 ID 常量
export const FACTION_IDS = {
  NECROMANCER: 'necromancer',
  TRICKSTER: 'trickster',
  PALADIN: 'paladin',
  // 后续扩展其他派系
  // BARBARIC: 'barbaric',      // 野蛮部落
  // FROST: 'frost',            // 极地矮人
  // GOBLIN: 'goblin',          // 地精
} as const;

export type FactionId = typeof FACTION_IDS[keyof typeof FACTION_IDS];
