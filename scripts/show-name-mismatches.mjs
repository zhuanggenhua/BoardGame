import { readFileSync } from 'fs';

// 读取 Wiki 数据
const wikiData = JSON.parse(readFileSync('wiki-cards-with-descriptions.json', 'utf-8'));

// 读取代码中的卡牌
function getCodeCards(factionId) {
  const filePath = `src/games/smashup/data/factions/${factionId}.ts`;
  try {
    const content = readFileSync(filePath, 'utf-8');
    const cards = [];
    
    const cardRegex = /nameEn:\s*'([^']+)'[\s\S]*?count:\s*(\d+)/g;
    let match;
    
    while ((match = cardRegex.exec(content)) !== null) {
      cards.push({
        name: match[1],
        count: parseInt(match[2])
      });
    }
    
    return cards;
  } catch (error) {
    return null;
  }
}

// 合并 Wiki 中的重复卡牌
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

// 显示有问题的派系
const problemFactions = ['ninjas', 'pirates', 'zombies', 'miskatonic', 'frankenstein'];

for (const factionId of problemFactions) {
  const wikiCards = mergeWikiCards(wikiData[factionId]);
  const codeCards = getCodeCards(factionId);
  
  console.log(`\n## ${factionId.toUpperCase()}`);
  console.log(`\nWiki (${wikiCards.length} 种):`);
  wikiCards.forEach(c => console.log(`  ${c.count}x ${c.name}`));
  
  console.log(`\n代码 (${codeCards.length} 种):`);
  codeCards.forEach(c => console.log(`  ${c.count}x ${c.name}`));
  
  // 找出不匹配的
  const wikiNames = new Set(wikiCards.map(c => c.name));
  const codeNames = new Set(codeCards.map(c => c.name));
  
  const onlyInWiki = wikiCards.filter(c => !codeNames.has(c.name));
  const onlyInCode = codeCards.filter(c => !wikiNames.has(c.name));
  
  if (onlyInWiki.length > 0 || onlyInCode.length > 0) {
    console.log(`\n❌ 不匹配:`);
    if (onlyInWiki.length > 0) {
      console.log(`  Wiki 中有但代码中没有:`);
      onlyInWiki.forEach(c => console.log(`    - ${c.count}x ${c.name}`));
    }
    if (onlyInCode.length > 0) {
      console.log(`  代码中有但 Wiki 中没有:`);
      onlyInCode.forEach(c => console.log(`    - ${c.count}x ${c.name}`));
    }
  }
  
  console.log('\n' + '='.repeat(60));
}
