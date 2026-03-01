import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const factionsDir = 'src/games/smashup/data/factions';
const files = readdirSync(factionsDir).filter(f => f.endsWith('.ts') && f !== 'index.ts');

console.log('# 大杀四方派系卡牌数量验证\n');
console.log('| 派系文件 | 随从 | 行动 | 总计 | 状态 |');
console.log('|---------|------|------|------|------|');

const results = [];

for (const file of files) {
    const content = readFileSync(join(factionsDir, file), 'utf-8');
    
    // 提取所有 count 字段
    const counts = [...content.matchAll(/count:\s*(\d+)/g)].map(m => parseInt(m[1]));
    
    // 区分随从和行动（假设随从在前，行动在后）
    const minionMatch = content.match(/export const \w+_MINIONS.*?\[(.*?)\];/s);
    const actionMatch = content.match(/export const \w+_ACTIONS.*?\[(.*?)\];/s);
    
    let minionCount = 0;
    let actionCount = 0;
    
    if (minionMatch) {
        const minionCounts = [...minionMatch[1].matchAll(/count:\s*(\d+)/g)].map(m => parseInt(m[1]));
        minionCount = minionCounts.reduce((a, b) => a + b, 0);
    }
    
    if (actionMatch) {
        const actionCounts = [...actionMatch[1].matchAll(/count:\s*(\d+)/g)].map(m => parseInt(m[1]));
        actionCount = actionCounts.reduce((a, b) => a + b, 0);
    }
    
    const total = minionCount + actionCount;
    const status = total === 20 ? '✅' : total === 30 ? '⚠️ 特殊' : `❌ ${total}`;
    
    results.push({
        file,
        minionCount,
        actionCount,
        total,
        status
    });
    
    console.log(`| ${file.replace('.ts', '')} | ${minionCount} | ${actionCount} | ${total} | ${status} |`);
}

console.log('\n## 统计');
const correct = results.filter(r => r.total === 20).length;
const special = results.filter(r => r.total === 30).length;
const incorrect = results.filter(r => r.total !== 20 && r.total !== 30).length;

console.log(`- ✅ 正确（20张）: ${correct} 个派系`);
console.log(`- ⚠️ 特殊（30张）: ${special} 个派系`);
console.log(`- ❌ 错误: ${incorrect} 个派系`);
console.log(`- 总计: ${results.length} 个派系`);
