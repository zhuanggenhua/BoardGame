import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname } from 'path';

const WIKI_DATA_CANDIDATES = [
  'temp/smashup/wiki-cards-with-descriptions.json',
  'evidence/smashup/wiki-comparison/wiki-cards-with-descriptions.json'
];
const REPORT_OUTPUT_PATH = 'evidence/smashup/wiki-comparison/WIKI-CODE-FINAL-COMPARISON.md';
const ISSUES_OUTPUT_PATH = 'evidence/smashup/wiki-comparison/wiki-code-issues.json';

// 读取 Wiki 数据
const wikiDataPath = WIKI_DATA_CANDIDATES.find((candidate) => existsSync(candidate));
if (!wikiDataPath) {
  throw new Error(`未找到 Wiki 数据，请先运行 scripts/scrape-wiki-with-descriptions.mjs，期望位置: ${WIKI_DATA_CANDIDATES.join(' 或 ')}`);
}
const wikiData = JSON.parse(readFileSync(wikiDataPath, 'utf-8'));

function ensureParentDir(filePath) {
  mkdirSync(dirname(filePath), { recursive: true });
}

// 读取代码中的卡牌
function getCodeCards(factionId) {
  const filePath = `src/games/smashup/data/factions/${factionId}.ts`;
  try {
    const content = readFileSync(filePath, 'utf-8');
    const cards = [];
    
    // 提取所有卡牌定义
    const cardRegex = /nameEn:\s*(["'])(.*?)\1[\s\S]*?count:\s*(\d+)/g;
    let match;
    
    while ((match = cardRegex.exec(content)) !== null) {
      cards.push({
        name: match[2].trim(),
        count: parseInt(match[3])
      });
    }
    
    return cards;
  } catch (error) {
    return null;
  }
}

function normalizeCardName(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[’‘`]/g, "'")
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '')
    .trim();
}

// 合并 Wiki 中的重复卡牌（取最大数量）
function mergeWikiCards(cards) {
  const cardMap = new Map();
  
  for (const card of cards) {
    const key = normalizeCardName(card.name);
    const existing = cardMap.get(key);
    if (!existing || card.count > existing.count) {
      cardMap.set(key, card);
    }
  }
  
  return Array.from(cardMap.values());
}

// 对比并生成报告
function compareAndReport() {
  let report = '# Wiki vs 代码卡牌数量最终对比\n\n';
  report += `生成时间: ${new Date().toLocaleString('zh-CN')}\n\n`;
  report += '> ⚠️ 本脚本只校验卡牌 `name/count` 对齐，不校验效果语义（description）。语义审计需单独执行。\n\n';
  
  const allIssues = [];
  
  for (const [factionId, wikiCards] of Object.entries(wikiData)) {
    const mergedWikiCards = mergeWikiCards(wikiCards);
    const codeCards = getCodeCards(factionId);
    
    if (!codeCards) {
      report += `## ${factionId}\n\n❌ 代码文件不存在\n\n---\n\n`;
      continue;
    }
    
    const wikiTotal = mergedWikiCards.reduce((sum, c) => sum + c.count, 0);
    const codeTotal = codeCards.reduce((sum, c) => sum + c.count, 0);
    
    report += `## ${factionId}\n\n`;
    report += `- Wiki: ${mergedWikiCards.length} 种卡牌，共 ${wikiTotal} 张\n`;
    report += `- 代码: ${codeCards.length} 种卡牌，共 ${codeTotal} 张\n\n`;
    
    // 创建映射
    const wikiMap = new Map(mergedWikiCards.map(c => [normalizeCardName(c.name), c]));
    const codeMap = new Map(codeCards.map(c => [normalizeCardName(c.name), c]));
    
    const issues = [];
    
    // 检查数量不匹配
    for (const [name, wikiCard] of wikiMap) {
      const codeCard = codeMap.get(name);
      if (!codeCard) {
        issues.push({
          type: 'missing',
          name,
          wikiCount: wikiCard.count,
          description: wikiCard.description
        });
      } else if (codeCard.count !== wikiCard.count) {
        issues.push({
          type: 'count_mismatch',
          name,
          codeCount: codeCard.count,
          wikiCount: wikiCard.count
        });
      }
    }
    
    // 检查代码中多余的卡
    for (const [name, codeCard] of codeMap) {
      if (!wikiMap.has(name)) {
        issues.push({
          type: 'extra',
          name,
          codeCount: codeCard.count
        });
      }
    }
    
    if (issues.length === 0) {
      report += `✅ **完全正确**\n\n`;
    } else {
      report += `❌ **发现 ${issues.length} 个问题**\n\n`;
      
      for (const issue of issues) {
        if (issue.type === 'missing') {
          report += `- ❌ 缺少: **${issue.name}** (Wiki: ${issue.wikiCount}x)\n`;
          if (issue.description) {
            report += `  - 描述: ${issue.description.substring(0, 100)}...\n`;
          }
        } else if (issue.type === 'count_mismatch') {
          report += `- ⚠️  数量错误: **${issue.name}** (代码: ${issue.codeCount}x, Wiki: ${issue.wikiCount}x)\n`;
        } else if (issue.type === 'extra') {
          report += `- ⚠️  多余: **${issue.name}** (代码: ${issue.codeCount}x, Wiki 中不存在)\n`;
        }
      }
      report += `\n`;
      
      allIssues.push({ factionId, issues });
    }
    
    report += `---\n\n`;
  }
  
  // 总结
  const correctFactions = Object.keys(wikiData).length - allIssues.length;
  report += `# 总结\n\n`;
  report += `- ✅ 完全正确: ${correctFactions} 个派系\n`;
  report += `- ❌ 有问题: ${allIssues.length} 个派系\n`;
  report += `- 总计: ${Object.keys(wikiData).length} 个派系\n\n`;
  
  // 保存报告
  ensureParentDir(REPORT_OUTPUT_PATH);
  writeFileSync(REPORT_OUTPUT_PATH, report);
  console.log(`✅ 最终对比报告已保存到 ${REPORT_OUTPUT_PATH}`);
  
  // 保存结构化数据
  ensureParentDir(ISSUES_OUTPUT_PATH);
  writeFileSync(ISSUES_OUTPUT_PATH, JSON.stringify(allIssues, null, 2));
  console.log(`✅ 问题清单已保存到 ${ISSUES_OUTPUT_PATH}`);
  
  // 打印统计
  console.log(`\n📊 统计：`);
  console.log(`- ✅ 正确: ${correctFactions} 个派系`);
  console.log(`- ❌ 有问题: ${allIssues.length} 个派系`);
  
  if (allIssues.length > 0) {
    console.log(`\n有问题的派系：`);
    allIssues.forEach(({ factionId, issues }) => {
      console.log(`  - ${factionId}: ${issues.length} 个问题`);
    });
  }
}

compareAndReport();
