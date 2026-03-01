import { readFileSync, writeFileSync } from 'fs';

// 修复丧尸
const zombiesPath = 'src/games/smashup/data/factions/zombies.ts';
let zombiesContent = readFileSync(zombiesPath, 'utf-8');
const zombiesBefore = zombiesContent;
zombiesContent = zombiesContent.replace(
  "nameEn: 'They're Coming to Get You',",
  "nameEn: \"They're Coming To Get You\","
);
if (zombiesContent !== zombiesBefore) {
  writeFileSync(zombiesPath, zombiesContent, 'utf-8');
  console.log('✅ zombies: 已修复大小写');
} else {
  console.log('⚠️  zombies: 未找到需要修改的内容');
}

// 修复米斯卡塔尼克
const miskatonicPath = 'src/games/smashup/data/factions/miskatonic.ts';
let miskatonicContent = readFileSync(miskatonicPath, 'utf-8');
const miskatonicBefore = miskatonicContent;

// 尝试多种可能的引号组合
const patterns = [
  { from: 'nameEn: \'"Old Man Jenkins!?"\',', to: 'nameEn: \'"Old Man Jenkins!?"\',', desc: '弯引号→直引号' },
  { from: 'nameEn: \'"Old Man Jenkins!?"\',', to: 'nameEn: \'"Old Man Jenkins!?"\',', desc: '已经是直引号' },
];

for (const pattern of patterns) {
  if (miskatonicContent.includes(pattern.from)) {
    miskatonicContent = miskatonicContent.replace(pattern.from, pattern.to);
    console.log(`✅ miskatonic: ${pattern.desc}`);
    break;
  }
}

if (miskatonicContent !== miskatonicBefore) {
  writeFileSync(miskatonicPath, miskatonicContent, 'utf-8');
} else {
  console.log('⚠️  miskatonic: 未找到需要修改的内容');
}

console.log('\n✅ 完成！');
