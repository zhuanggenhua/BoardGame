import { readFileSync, writeFileSync } from 'fs';

// 修复 Bear Cavalry 的 You're Screwed
const bearCavFile = 'src/games/smashup/data/factions/bear_cavalry.ts';
let bearCavContent = readFileSync(bearCavFile, 'utf-8');
bearCavContent = bearCavContent.replace(
    /(id:\s*'bear_cavalry_youre_screwed'[\s\S]*?count:\s*)1/,
    '$12'
);
writeFileSync(bearCavFile, bearCavContent, 'utf-8');
console.log('✅ Bear Cavalry: You\'re Screwed count 1 → 2');

console.log('\n✅ 所有数量修复完成！');
console.log('\n现在开始验证修复结果...');
