import { writeFileSync } from 'fs';
import https from 'https';

// 派系映射
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

// 使用 https 模块抓取页面
function fetchWikiPage(factionName) {
  return new Promise((resolve, reject) => {
    const url = `https://smashup.fandom.com/wiki/${factionName}`;
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html',
        'Connection': 'keep-alive'
      }
    };

    https.get(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

// 解析 Wiki HTML
function parseWikiCards(html) {
  const cards = [];
  
  function parseSection(sectionName, type) {
    // 查找章节（更宽松的匹配）
    const sectionRegex = new RegExp(`<h3[^>]*>.*?${sectionName}.*?</h3>([\\s\\S]*?)(?=<h3|<h2|<figure|$)`, 'i');
    const sectionMatch = html.match(sectionRegex);
    
    if (!sectionMatch) return;
    
    const sectionHtml = sectionMatch[1];
    
    // 匹配所有段落
    const paragraphs = sectionHtml.match(/<p>.*?<\/p>/gis) || [];
    
    for (const p of paragraphs) {
      // 提取数量
      const countMatch = p.match(/(\d+)x/);
      if (!countMatch) continue;
      
      // 提取名称
      const nameMatch = p.match(/<b>([^<]+)<\/b>/);
      if (!nameMatch) continue;
      
      // 提取 power
      const powerMatch = p.match(/power\s+(\d+)/i);
      
      // 提取描述（去除 HTML 标签）
      const descMatch = p.match(/<\/b><\/span>\s*-\s*(.+?)<\/p>/s);
      let description = '';
      if (descMatch) {
        description = descMatch[1]
          .replace(/<[^>]+>/g, '')
          .replace(/&[^;]+;/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
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
  
  parseSection('Minions', 'minion');
  parseSection('Actions', 'action');
  parseSection('Fusions', 'fusion');
  
  return cards;
}

// 抓取单个派系
async function fetchFactionCards(factionId) {
  const wikiName = FACTION_WIKI_NAMES[factionId];
  
  console.log(`正在抓取 ${factionId} (${wikiName})...`);
  
  try {
    const html = await fetchWikiPage(wikiName);
    const cards = parseWikiCards(html);
    
    const totalCount = cards.reduce((sum, c) => sum + c.count, 0);
    console.log(`✅ 找到 ${cards.length} 种卡牌，共 ${totalCount} 张`);
    
    return cards;
    
  } catch (error) {
    console.error(`❌ 抓取失败: ${error.message}`);
    return [];
  }
}

// 主函数
async function main() {
  console.log('开始从 Wiki 抓取所有派系的卡牌信息（包含效果描述）...\n');
  
  const allFactions = {};
  
  for (const factionId of Object.keys(FACTION_WIKI_NAMES)) {
    const cards = await fetchFactionCards(factionId);
    allFactions[factionId] = cards;
    
    // 避免请求过快
    await new Promise(resolve => setTimeout(resolve, 1500));
  }
  
  // 保存详细数据
  writeFileSync('wiki-cards-with-descriptions.json', JSON.stringify(allFactions, null, 2));
  console.log('\n✅ 详细数据已保存到 wiki-cards-with-descriptions.json');
  
  // 生成可读报告
  let report = '# Wiki 卡牌详细信息\n\n';
  report += `生成时间: ${new Date().toLocaleString('zh-CN')}\n\n`;
  
  for (const [factionId, cards] of Object.entries(allFactions)) {
    const totalCount = cards.reduce((sum, c) => sum + c.count, 0);
    report += `## ${factionId}\n\n`;
    report += `总计: ${cards.length} 种卡牌，共 ${totalCount} 张\n\n`;
    
    // 按类型分组
    const minions = cards.filter(c => c.type === 'minion' || c.type === 'fusion');
    const actions = cards.filter(c => c.type === 'action');
    
    if (minions.length > 0) {
      report += `### 随从 (Minions)\n\n`;
      for (const card of minions) {
        report += `- ${card.count}x **${card.name}**`;
        if (card.power !== undefined) {
          report += ` - Power ${card.power}`;
        }
        report += `\n`;
        if (card.description) {
          report += `  - ${card.description.substring(0, 150)}${card.description.length > 150 ? '...' : ''}\n`;
        }
        report += `\n`;
      }
    }
    
    if (actions.length > 0) {
      report += `### 行动 (Actions)\n\n`;
      for (const card of actions) {
        report += `- ${card.count}x **${card.name}**\n`;
        if (card.description) {
          report += `  - ${card.description.substring(0, 150)}${card.description.length > 150 ? '...' : ''}\n`;
        }
        report += `\n`;
      }
    }
    
    report += `---\n\n`;
  }
  
  writeFileSync('WIKI-CARDS-DETAILED-REPORT.md', report);
  console.log('✅ 可读报告已保存到 WIKI-CARDS-DETAILED-REPORT.md');
  
  // 打印统计
  console.log('\n📊 统计：');
  for (const [factionId, cards] of Object.entries(allFactions)) {
    const totalCount = cards.reduce((sum, c) => sum + c.count, 0);
    console.log(`${factionId}: ${cards.length} 种卡牌，共 ${totalCount} 张`);
  }
}

main().catch(console.error);
