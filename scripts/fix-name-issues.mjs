import { readFileSync, writeFileSync } from 'fs';

// 修复丧尸的大小写
const zombiesPath = 'src/games/smashup/data/factions/zombies.ts';
let zombiesContent = readFileSync(zombiesPath, 'utf-8');
zombiesContent = zombiesContent.replace(
  /nameEn:\s*'They're Coming to Get You'/g,
  "nameEn: \"They're Coming To Get You\""
);
writeFileSync(zombiesPath, zombiesContent, 'utf-8');
console.log('✅ 已修复 zombies: They\'re Coming to Get You → They\'re Coming To Get You');

// 修复米斯卡塔尼克的引号
const miskatonicPath = 'src/games/smashup/data/factions/miskatonic.ts';
let miskatonicContent = readFileSync(miskatonicPath, 'utf-8');
// 弯引号 → 直引号
miskatonicContent = miskatonicContent.replace(
  /nameEn:\s*'"Old Man Jenkins!\?"'/g,
  'nameEn: \'"Old Man Jenkins!?"\''
);
writeFileSync(miskatonicPath, miskatonicContent, 'utf-8');
console.log('✅ 已修复 miskatonic: 引号类型');

console.log('\n✅ 名称修复完成！');
console.log('\n📋 仍然缺少的卡牌（需要图集索引）：');
console.log('  - pirates: Saucy Wench (3x)');
console.log('  - miskatonic: That\'s So Crazy... (1x)');
console.log('  - frankenstein: IT\'S ALIVE! (2x)');
