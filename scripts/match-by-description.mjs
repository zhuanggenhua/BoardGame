import { readFileSync } from 'fs';

// 读取 Wiki 数据
const wikiData = JSON.parse(readFileSync('wiki-cards-with-descriptions.json', 'utf-8'));

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

// 读取代码中的卡牌（包含中文名）
function getCodeCardsWithNames(factionId) {
  const filePath = `src/games/smashup/data/factions/${factionId}.ts`;
  try {
    const content = readFileSync(filePath, 'utf-8');
    const cards = [];
    
    // 匹配卡牌定义块
    const cardBlockRegex = /\{[^}]*name:\s*'([^']+)'[^}]*nameEn:\s*'([^']+)'[^}]*count:\s*(\d+)[^}]*\}/g;
    let match;
    
    while ((match = cardBlockRegex.exec(content)) !== null) {
      cards.push({
        nameCn: match[1],
        nameEn: match[2],
        count: parseInt(match[3])
      });
    }
    
    return cards;
  } catch (error) {
    return null;
  }
}

// 对比有问题的派系
const problemFactions = {
  pirates: {
    missing: ['Saucy Wench'],
    extra: []
  },
  zombies: {
    missing: ["They're Coming To Get You"],
    extra: ["They're Coming to Get You"]
  },
  miskatonic: {
    missing: ['"Old Man Jenkins!?"', "That's So Crazy..."],
    extra: ['"Old Man Jenkins!?"']
  },
  frankenstein: {
    missing: ["IT'S ALIVE!"],
    extra: []
  }
};

console.log('# 根据效果描述核对卡牌\n');

for (const [factionId, issues] of Object.entries(problemFactions)) {
  console.log(`## ${factionId.toUpperCase()}\n`);
  
  const wikiCards = mergeWikiCards(wikiData[factionId]);
  const codeCards = getCodeCardsWithNames(factionId);
  
  // 显示"缺失"的卡牌及其描述
  if (issues.missing.length > 0) {
    console.log('### Wiki 中有但代码中"缺失"的卡牌：\n');
    for (const missingName of issues.missing) {
      const wikiCard = wikiCards.find(c => c.name === missingName);
      if (wikiCard) {
        console.log(`**${wikiCard.name}** (${wikiCard.count}x)`);
        console.log(`- 类型: ${wikiCard.type}`);
        if (wikiCard.power) {
          console.log(`- Power: ${wikiCard.power}`);
        }
        console.log(`- 描述: ${wikiCard.description.substring(0, 200)}...`);
        console.log();
      }
    }
  }
  
  // 显示代码中的所有卡牌
  console.log('### 代码中的所有卡牌：\n');
  codeCards.forEach(card => {
    console.log(`- ${card.count}x **${card.nameEn}** (${card.nameCn})`);
  });
  
  console.log('\n' + '='.repeat(80) + '\n');
}

console.log('\n💡 提示：请根据效果描述，找出代码中哪些卡牌对应 Wiki 上的"缺失"卡牌。');
console.log('可能的情况：');
console.log('1. 名称完全不同（如 Saucy Wench 可能在代码中叫其他名字）');
console.log('2. 大小写/标点符号差异（如 They\'re Coming to Get You）');
console.log('3. 引号类型差异（如 "Old Man Jenkins!?"）');
