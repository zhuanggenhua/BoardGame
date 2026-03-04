#!/usr/bin/env node
/**
 * 分析每个派系使用的图集索引范围
 * 帮助确定缺失卡牌应该使用哪个索引
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { glob } from 'glob';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

// 读取所有派系文件
const factionFiles = glob.sync('src/games/smashup/data/factions/*.ts', { cwd: rootDir });

console.log('# 大杀四方图集索引使用分析\n');

for (const file of factionFiles) {
  const factionId = file.split('/').pop().replace('.ts', '');
  const content = readFileSync(join(rootDir, file), 'utf-8');
  
  // 提取所有 previewRef 的 atlasId 和 index
  const atlasRefs = [];
  const regex = /previewRef:\s*{\s*type:\s*'atlas',\s*atlasId:\s*SMASHUP_ATLAS_IDS\.(\w+),\s*index:\s*(\d+)\s*}/g;
  let match;
  
  while ((match = regex.exec(content)) !== null) {
    atlasRefs.push({
      atlasId: match[1],
      index: parseInt(match[2], 10),
    });
  }
  
  if (atlasRefs.length === 0) {
    console.log(`## ${factionId}`);
    console.log('⚠️  未找到图集引用\n');
    continue;
  }
  
  // 按图集分组
  const byAtlas = {};
  for (const ref of atlasRefs) {
    if (!byAtlas[ref.atlasId]) {
      byAtlas[ref.atlasId] = [];
    }
    byAtlas[ref.atlasId].push(ref.index);
  }
  
  console.log(`## ${factionId}`);
  console.log(`总卡牌数: ${atlasRefs.length} 张\n`);
  
  for (const [atlasId, indices] of Object.entries(byAtlas)) {
    indices.sort((a, b) => a - b);
    const min = Math.min(...indices);
    const max = Math.max(...indices);
    const range = max - min + 1;
    const missing = [];
    
    // 检查范围内是否有缺失的索引
    for (let i = min; i <= max; i++) {
      if (!indices.includes(i)) {
        missing.push(i);
      }
    }
    
    console.log(`### ${atlasId}`);
    console.log(`- 使用索引: ${indices.join(', ')}`);
    console.log(`- 范围: ${min}-${max} (跨度 ${range})`);
    console.log(`- 实际使用: ${indices.length} 个索引`);
    
    if (missing.length > 0) {
      console.log(`- ⚠️  范围内缺失索引: ${missing.join(', ')}`);
    }
    
    // 如果卡牌数少于 20，推测下一个可用索引
    if (atlasRefs.length < 20) {
      const nextIndex = max + 1;
      const needed = 20 - atlasRefs.length;
      console.log(`- 💡 建议下一个索引: ${nextIndex} (还需 ${needed} 张卡)`);
    }
    
    console.log('');
  }
  
  console.log('');
}
