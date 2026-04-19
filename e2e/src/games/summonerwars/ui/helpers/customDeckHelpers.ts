/**
 * 自定义牌组选择界面辅助函数
 * 
 * 提供自定义牌组相关的工具函数，包括：
 * - 根据阵营 ID 获取召唤师精灵图 atlasId
 * - 判断选择字符串是否为自定义牌组
 * - 从选择字符串中提取自定义牌组 ID
 */

import type { FactionId } from '../../domain/types';
import { FACTION_CATALOG } from '../../config/factions';

/**
 * 根据阵营 ID 获取召唤师精灵图的 atlasId
 * 
 * @param factionId - 阵营 ID
 * @returns 精灵图 atlasId，格式为 "sw:{faction}:hero"
 * 
 * @example
 * getSummonerAtlasIdByFaction('necromancer') // => 'sw:necromancer:hero'
 * getSummonerAtlasIdByFaction('trickster') // => 'sw:trickster:hero'
 */
export function getSummonerAtlasIdByFaction(factionId: FactionId): string {
  const entry = FACTION_CATALOG.find(f => f.id === factionId);
  if (!entry) return '';
  
  // 从 heroImagePath 提取目录名
  // 例如: 'summonerwars/hero/Necromancer/hero' → 'necromancer'
  const match = entry.heroImagePath.match(/hero\/(\w+)\//);
  const dir = match?.[1] ?? 'Necromancer';
  
  return `sw:${dir.toLowerCase()}:hero`;
}

/**
 * 判断选择字符串是否为自定义牌组
 * 
 * 自定义牌组的选择字符串格式为 "custom:{deckId}"
 * 
 * @param selection - 选择字符串（可能是阵营 ID 或自定义牌组标识）
 * @returns 是否为自定义牌组选择
 * 
 * @example
 * isCustomDeckSelection('necromancer') // => false
 * isCustomDeckSelection('custom:deck-123') // => true
 * isCustomDeckSelection('unselected') // => false
 */
export function isCustomDeckSelection(selection: string): boolean {
  return selection.startsWith('custom:');
}

/**
 * 从选择字符串中提取自定义牌组 ID
 * 
 * @param selection - 选择字符串
 * @returns 牌组 ID，如果不是自定义牌组选择则返回 null
 * 
 * @example
 * extractCustomDeckId('custom:deck-123') // => 'deck-123'
 * extractCustomDeckId('necromancer') // => null
 * extractCustomDeckId('unselected') // => null
 */
export function extractCustomDeckId(selection: string): string | null {
  if (!isCustomDeckSelection(selection)) return null;
  return selection.replace('custom:', '');
}
