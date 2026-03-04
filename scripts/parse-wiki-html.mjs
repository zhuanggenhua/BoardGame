import { writeFileSync } from 'fs';

// 派系映射（代码 ID -> Wiki 页面名）
const FACTION_WIKI_NAMES = {
  aliens: 'Aliens',
  ninjas: 'Ninjas',
  pirates: 'Pirates',
  robots: 'Robots',
  tricksters: 'Tricksters',
  wizards: 'Wizards',
  zombies: 'Zombies',
  dinosaurs: 'Dinosaurs',
  bear_cavalry: 'Bear_Cavalry',
  ghosts: 'Ghosts',
  killer_plants: 'Killer_Plants',
  steampunks: 'Steampunks',
  elder_things: 'Elder_Things',
  innsmouth: 'Innsmouth',
  cthulhu: 'Minions_of_Cthulhu',
  miskatonic: 'Miskatonic_University',
  'giant-ants': 'Giant_Ants',
  vampires: 'Vampires',
  werewolves: 'Werewolves',
  frankenstein: 'Mad_Scientists'
};

// 从 Wiki HTML 解析卡牌信息
async function fetchAndParseWikiCards(factionId) {
  const wikiName = FACTION_WIKI_NAMES[factionId];
  const url = `https://smashup.fandom.com/wiki/${wikiName}`;
  
  console.log(`正在抓取 ${factionId} (${wikiName})...`);
  
  try {
    const response = await fetch(url);
    const html = await response.text();
    
    // 使用正则表达式解析（不依赖 JSDOM）
    const cards = [];
    
    // 通用解析函数
    function parseSection(sectionName, type) {
      // 查找章节标题
      const sectionRegex = new RegExp(`<h3[^>]*>.*?${sectionName}.*?</h3>([\\s\\S]*?)(?=<h3|<h2|<figure)`, 'i');
      const sectionMatch = html.match(sectionRegex);
      
      if (!sectionMatch) return;
      
      const sectionHtml = sectionMatch[1];
      
      // 匹配所有段落中的卡牌
      // 格式：<p>1x <span id="..."><b>Name</b></span> - power X - Description</p>
      // 或：<p>1x <span id="..."><b>Name</b></span> - Description</p>
      const paragraphs = sectionHtml.match(/<p>.*?<\/p>/gi) || [];
      
      for (const p of paragraphs) {
        // 提取数量
        const countMatch = p.match(/(\d+)x/);
        if (!countMatch) continue;
        
        // 提取名称
        const nameMatch = p.match(/<b>([^<]+)<\/b>/);
        if (!nameMatch) continue;
        
        // 提取 power（如果有）
        const powerMatch = p.match(/power\s+(\d+)/i);
        
        // 提取描述（去除所有 HTML 标签）
        const descMatch = p.match(/<\/b><\/span>\s*-\s*(.+?)<\/p>/);
        let description = '';
        if (descMatch) {
          description = descMatch[1]
            .replace(/<[^>]+>/g, '')  // 移除 HTML 标签
            .replace(/&[^;]+;/g, '')  // 移除 HTML 实体
            .trim()
            .substring(0, 200);
        }
        
        cards.push({
          name: nameMatch[1].trim(),
          count: parseInt(countMatch[1]),
          type: type,
          power: powerMatch ? parseInt(powerMatch[1]) : undefined,
          description: description
        });
      }
    }
    
    // 解析各个部分
    parseSection('Minions', 'minion');
    parseSection('Actions', 'action');
    parseSection('Fusions', 'fusion');
    
    console.log(`✅ 找到 ${cards.length} 张卡`);
    return cards;
    
  } catch (error) {
    console.error(`❌ 抓取失败: ${error.message}`);
    return [];
  }
}

// 主函数
async function main() {
  console.log('开始从 Wiki 抓取所有派系的卡牌信息...\n');
  
  const allFactions = {};
  
  for (const factionId of Object.keys(FACTION_WIKI_NAMES)) {
    const cards = await fetchAndParseWikiCards(factionId);
    allFactions[factionId] = cards;
    
    // 避免请求过快
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // 保存结果
  writeFileSync('wiki-cards-detailed.json', JSON.stringify(allFactions, null, 2));
  console.log('\n✅ 所有数据已保存到 wiki-cards-detailed.json');
  
  // 打印统计
  console.log('\n📊 统计：');
  for (const [factionId, cards] of Object.entries(allFactions)) {
    const totalCount = cards.reduce((sum, card) => sum + card.count, 0);
    console.log(`${factionId}: ${cards.length} 种卡牌，共 ${totalCount} 张`);
  }
}

main().catch(console.error);
