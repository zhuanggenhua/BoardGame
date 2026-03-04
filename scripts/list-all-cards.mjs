#!/usr/bin/env node
/**
 * 列出所有派系的卡牌详细信息
 * 用于手动核对 Wiki 数据
 */

import { readFileSync, readdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

const factionsDir = join(rootDir, 'src/games/smashup/data/factions');
const factionFiles = readdirSync(factionsDir)
  .filter(f => f.endsWith('.ts'))
  .map(f => `src/games/smashup/data/factions/${f}`);

console.log('# 大杀四方所有卡牌清单\n');

for (const file of factionFiles) {
  const factionId = file.split('/').pop().replace('.ts', '');
  const content = readFileSync(join(rootDir, file), 'utf-8');
  
  // 提取所有卡牌
  const cards = [];
  
  // 匹配随从卡
  const minionRegex = /{\s*id:\s*'([^']+)',\s*type:\s*'minion',\s*name:\s*'([^']+)',\s*nameEn:\s*'([^']+)',\s*faction:\s*'[^']+',\s*power:\s*(\d+),[\s\S]*?count:\s*(\d+)/g;
  let match;
  
  while ((match = minionRegex.exec(content)) !== null) {
    cards.push({
      id: match[1],
      type: 'minion',
      nameCn: match[2],
      nameEn: match[3],
      power: parseInt(match[4]),
      count: parseInt(match[5]),
    });
  }
  
  // 匹配行动卡
  const actionRegex = /{\s*id:\s*'([^']+)',\s*type:\s*'action',\s*subtype:\s*'([^']+)',\s*name:\s*'([^']+)',\s*nameEn:\s*'([^']+)',\s*faction:\s*'[^']+',[\s\S]*?count:\s*(\d+)/g;
  
  while ((match = actionRegex.exec(content)) !== null) {
    cards.push({
      id: match[1],
      type: 'action',
      subtype: match[2],
      nameCn: match[3],
      nameEn: match[4],
      count: parseInt(match[5]),
    });
  }
  
  if (cards.length === 0) {
    console.log(`## ${factionId}`);
    console.log('⚠️  未找到卡牌定义\n');
    continue;
  }
  
  // 按类型分组
  const minions = cards.filter(c => c.type === 'minion').sort((a, b) => b.power - a.power);
  const actions = cards.filter(c => c.type === 'action');
  
  const totalCards = cards.reduce((sum, c) => sum + c.count, 0);
  const totalMinions = minions.reduce((sum, c) => sum + c.count, 0);
  const totalActions = actions.reduce((sum, c) => sum + c.count, 0);
  
  console.log(`## ${factionId}`);
  console.log(`总计: ${totalCards} 张 (${totalMinions} 随从 + ${totalActions} 行动)\n`);
  
  if (minions.length > 0) {
    console.log('### 随从 (Minions)');
    for (const card of minions) {
      console.log(`- ${card.count}x **${card.nameEn}** (${card.nameCn}) - Power ${card.power}`);
    }
    console.log('');
  }
  
  if (actions.length > 0) {
    console.log('### 行动 (Actions)');
    for (const card of actions) {
      console.log(`- ${card.count}x **${card.nameEn}** (${card.nameCn}) - ${card.subtype}`);
    }
    console.log('');
  }
  
  console.log('---\n');
}
