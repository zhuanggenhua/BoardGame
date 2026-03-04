import { readFileSync } from 'fs';

// 读取 Wiki 数据
const wikiData = JSON.parse(readFileSync('wiki-cards-with-descriptions.json', 'utf-8'));

// 读取代码
const content = readFileSync('src/games/smashup/data/factions/frankenstein.ts', 'utf-8');

// 提取代码中的卡牌名称（处理包含引号的名称）
const cardRegex = /nameEn:\s*(["'])([^\1]*?)\1/g;
let match;
const codeNames = [];

while ((match = cardRegex.exec(content)) !== null) {
  codeNames.push(match[2]);
}

// 合并 Wiki 卡牌
function mergeWikiCards(cards) {
  const cardMap = new Map();
  for (const card of cards) {
    const existing = cardMap.get(card.name);
    if (!existing || card.count > existing.count) {
      cardMap.set(card.name, card);
    }
  }
  return Array.from(cardMap.values());
}

const wikiCards = mergeWikiCards(wikiData.frankenstein);
const wikiNames = wikiCards.map(c => c.name);

console.log('Wiki 卡牌名称:');
wikiNames.forEach((name, i) => {
  console.log(`${i + 1}. "${name}" (长度: ${name.length}, 字符码: ${Array.from(name).map(c => c.charCodeAt(0)).join(',')})`);
});

console.log('\n代码卡牌名称:');
codeNames.forEach((name, i) => {
  console.log(`${i + 1}. "${name}" (长度: ${name.length}, 字符码: ${Array.from(name).map(c => c.charCodeAt(0)).join(',')})`);
});

console.log('\n对比 IT\'S ALIVE!:');
const wikiAlive = wikiNames.find(n => n.includes('ALIVE'));
const codeAlive = codeNames.find(n => n.includes('ALIVE'));

if (wikiAlive && codeAlive) {
  console.log(`Wiki: "${wikiAlive}"`);
  console.log(`代码: "${codeAlive}"`);
  console.log(`相等: ${wikiAlive === codeAlive}`);
  console.log(`Wiki 字符码: ${Array.from(wikiAlive).map(c => c.charCodeAt(0)).join(',')}`);
  console.log(`代码字符码: ${Array.from(codeAlive).map(c => c.charCodeAt(0)).join(',')}`);
}
