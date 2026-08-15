import { mkdirSync, writeFileSync } from 'fs';
import { dirname } from 'path';
import https from 'https';

const DATA_OUTPUT_PATH = 'temp/smashup/wiki-cards-with-descriptions.json';
const REPORT_OUTPUT_PATH = 'evidence/smashup/wiki-comparison/WIKI-CARDS-DETAILED-REPORT.md';

function ensureParentDir(filePath) {
  mkdirSync(dirname(filePath), { recursive: true });
}

// 派系映射
const FACTION_WIKI_NAMES = {
  aliens: 'Aliens',
  ancient_egyptians: 'Ancient_Egyptians',
  cowboys: 'Cowboys',
  ninjas: 'Ninjas',
  pirates: 'Pirates',
  robots: 'Robots',
  skeletons: 'Skeletons',
  mermaids: 'Mermaids',
  world_champs: 'World_Champs',
  samurai: 'Samurai',
  tricksters: 'Tricksters',
  vikings: 'Vikings',
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
  frankenstein: 'Mad_Scientists',
  sharks: 'Sharks',
  tornados: 'Tornados',
  mythic_greeks: 'Mythic_Greeks'
};

// 使用 MediaWiki API 抓取页面（避免 Cloudflare JS 挑战）
function fetchWikiPage(factionName) {
  return new Promise((resolve, reject) => {
    const url = `https://smashup.fandom.com/api.php?action=parse&page=${encodeURIComponent(factionName)}&prop=wikitext&format=json`;
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
        'Connection': 'keep-alive'
      }
    };

    https.get(url, options, (res) => {
      if (res.statusCode && res.statusCode >= 400) {
        reject(new Error(`HTTP ${res.statusCode}`));
        res.resume();
        return;
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

// 解析 Wiki Wikitext
function parseWikiCards(raw) {
  const json = JSON.parse(raw);
  const wikitext = json?.parse?.wikitext?.['*'];
  if (!wikitext) {
    return [];
  }

  const cards = [];

  let currentType = null;

  const lines = wikitext.split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    const plainHeading = line.replace(/<[^>]+>/g, '');
    if (/^={3,}\s*Minions\s*={3,}$/i.test(plainHeading)) {
      currentType = 'minion';
      continue;
    }
    if (/^={3,}\s*Actions\s*={3,}$/i.test(plainHeading)) {
      currentType = 'action';
      continue;
    }
    if (/^={3,}\s*Fusions?\s*={3,}$/i.test(plainHeading)) {
      currentType = 'fusion';
      continue;
    }
    if (/^={2,}.*={2,}$/.test(plainHeading)) {
      currentType = null;
      continue;
    }

    if (!currentType) continue;
    if (line.includes('<s>') || line.includes('</s>')) continue;

    const cleanedLine = line.replace(/^(\*+\s*)?/, '');
    const cardMatch = cleanedLine.match(/^(\d+)x\s+.*?'''([^']+)'''(?:<[^>]+>)*\s*-\s*(.+)$/);
    if (!cardMatch) continue;

    const count = parseInt(cardMatch[1], 10);
    const name = cardMatch[2].trim();
    let rest = cardMatch[3];

    const powerMatch = rest.match(/power\s+(\d+)/i);
    const power = powerMatch ? parseInt(powerMatch[1], 10) : undefined;

    rest = rest
      .replace(/<sup>.*$/i, '')
      .replace(/''\([^)]*\)''/g, '')
      .replace(/''/g, '')
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    cards.push({
      name,
      count,
      type: currentType,
      power,
      description: rest
    });
  }

  return cards;
}

// 抓取单个派系
async function fetchFactionCards(factionId) {
  const wikiName = FACTION_WIKI_NAMES[factionId];
  
  console.log(`正在抓取 ${factionId} (${wikiName})...`);

  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const html = await fetchWikiPage(wikiName);
      const cards = parseWikiCards(html);
      if (!cards || cards.length === 0) {
        throw new Error('解析后卡牌数为 0');
      }

      const totalCount = cards.reduce((sum, c) => sum + c.count, 0);
      console.log(`✅ 找到 ${cards.length} 种卡牌，共 ${totalCount} 张`);
      return cards;
    } catch (error) {
      const suffix = attempt < maxAttempts ? `（第 ${attempt}/${maxAttempts} 次，准备重试）` : `（第 ${attempt}/${maxAttempts} 次）`;
      console.error(`❌ 抓取失败: ${error?.message || String(error)} ${suffix}`);
      if (attempt < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
  }
  return [];
}

// 主函数
async function main() {
  const requestedFactions = process.argv.slice(2);
  const factionIds = requestedFactions.length > 0
    ? requestedFactions
    : Object.keys(FACTION_WIKI_NAMES);

  const invalidFactionIds = factionIds.filter((factionId) => !FACTION_WIKI_NAMES[factionId]);
  if (invalidFactionIds.length > 0) {
    console.error(`❌ 未知派系: ${invalidFactionIds.join(', ')}`);
    console.error(`可用派系: ${Object.keys(FACTION_WIKI_NAMES).join(', ')}`);
    process.exit(1);
  }

  console.log(`开始从 Wiki 抓取卡牌信息（包含效果描述），目标派系：${factionIds.join(', ')}\n`);
  
  const allFactions = {};
  const emptyFactions = [];
  
  for (const factionId of factionIds) {
    const cards = await fetchFactionCards(factionId);
    allFactions[factionId] = cards;
    if (!cards || cards.length === 0) {
      emptyFactions.push(factionId);
    }
    
    // 避免请求过快
    await new Promise(resolve => setTimeout(resolve, 1500));
  }
  
  // 保存详细数据
  ensureParentDir(DATA_OUTPUT_PATH);
  writeFileSync(DATA_OUTPUT_PATH, JSON.stringify(allFactions, null, 2));
  console.log(`\n✅ 详细数据已保存到 ${DATA_OUTPUT_PATH}`);
  
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
  
  ensureParentDir(REPORT_OUTPUT_PATH);
  writeFileSync(REPORT_OUTPUT_PATH, report);
  console.log(`✅ 可读报告已保存到 ${REPORT_OUTPUT_PATH}`);
  
  // 打印统计
  console.log('\n📊 统计：');
  for (const [factionId, cards] of Object.entries(allFactions)) {
    const totalCount = cards.reduce((sum, c) => sum + c.count, 0);
    console.log(`${factionId}: ${cards.length} 种卡牌，共 ${totalCount} 张`);
  }

  if (emptyFactions.length > 0) {
    console.error(`\n❌ 以下派系抓取结果为空，请检查 Wiki 页面映射或解析逻辑：${emptyFactions.join(', ')}`);
    process.exit(2);
  }
}

main().catch(console.error);
