import https from 'https';
import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';

// 获取已实现的派系列表
const factionsDir = 'src/games/smashup/data/factions';
const factionFiles = readdirSync(factionsDir)
    .filter(f => f.endsWith('.ts') && f !== 'index.ts' && f !== 'madness.ts');

// 派系 ID 到 Wiki 页面名称的映射
const factionNameMap = {
    'aliens': 'Aliens',
    'bear_cavalry': 'Bear_Cavalry',
    'cthulhu': 'Minions_of_Cthulhu',
    'dinosaurs': 'Dinosaurs',
    'elder_things': 'Elder_Things',
    'frankenstein': 'Mad_Scientists', // 猜测
    'ghosts': 'Ghosts',
    'giant-ants': 'Giant_Ants',
    'innsmouth': 'Innsmouth',
    'killer_plants': 'Killer_Plants',
    'miskatonic': 'Miskatonic_University',
    'ninjas': 'Ninjas',
    'pirates': 'Pirates',
    'robots': 'Robots',
    'steampunks': 'Steampunks',
    'tricksters': 'Tricksters',
    'vampires': 'Vampires',
    'werewolves': 'Werewolves',
    'wizards': 'Wizards',
    'zombies': 'Zombies'
};

// 从 Wiki 获取页面内容
function fetchWikiPage(factionName) {
    return new Promise((resolve, reject) => {
        const url = `https://smashup.fandom.com/wiki/${factionName}`;
        const options = {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1'
            }
        };

        https.get(url, options, (res) => {
            if (res.statusCode === 403) {
                reject(new Error(`403 Forbidden: ${url}`));
                return;
            }

            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(data));
        }).on('error', reject);
    });
}

// 解析 Wiki 页面，提取卡牌列表
function parseCardList(html) {
    const cards = { minions: [], actions: [] };
    
    // 提取随从列表（在 "Minions" 标题之后）
    const minionMatch = html.match(/Minions<\/span><\/h2>(.*?)<h2/s);
    if (minionMatch) {
        // 匹配类似 "1x Power 5: Card Name" 或 "Card Name (2x)" 的模式
        const minionLines = minionMatch[1].match(/(\d+)x\s+(?:Power\s+\d+:\s*)?([^<\n]+)|([^<\n]+)\s+\((\d+)x\)/g);
        if (minionLines) {
            minionLines.forEach(line => {
                const match1 = line.match(/(\d+)x\s+(?:Power\s+\d+:\s*)?(.+)/);
                const match2 = line.match(/(.+)\s+\((\d+)x\)/);
                if (match1) {
                    cards.minions.push({ name: match1[2].trim(), count: parseInt(match1[1]) });
                } else if (match2) {
                    cards.minions.push({ name: match2[1].trim(), count: parseInt(match2[2]) });
                }
            });
        }
    }
    
    // 提取行动列表（在 "Actions" 标题之后）
    const actionMatch = html.match(/Actions<\/span><\/h2>(.*?)(?:<h2|$)/s);
    if (actionMatch) {
        const actionLines = actionMatch[1].match(/(\d+)x\s+([^<\n]+)|([^<\n]+)\s+\((\d+)x\)/g);
        if (actionLines) {
            actionLines.forEach(line => {
                const match1 = line.match(/(\d+)x\s+(.+)/);
                const match2 = line.match(/(.+)\s+\((\d+)x\)/);
                if (match1) {
                    cards.actions.push({ name: match1[2].trim(), count: parseInt(match1[1]) });
                } else if (match2) {
                    cards.actions.push({ name: match2[1].trim(), count: parseInt(match2[2]) });
                }
            });
        }
    }
    
    return cards;
}

// 主函数
async function main() {
    console.log('开始爬取 Smash Up Wiki...\n');
    
    const results = {};
    
    for (const file of factionFiles) {
        const factionId = file.replace('.ts', '');
        const wikiName = factionNameMap[factionId];
        
        if (!wikiName) {
            console.log(`⚠️  跳过 ${factionId}（未找到 Wiki 映射）`);
            continue;
        }
        
        console.log(`正在获取 ${factionId} (${wikiName})...`);
        
        try {
            const html = await fetchWikiPage(wikiName);
            const cards = parseCardList(html);
            
            results[factionId] = {
                wikiName,
                cards,
                totalMinions: cards.minions.reduce((sum, c) => sum + c.count, 0),
                totalActions: cards.actions.reduce((sum, c) => sum + c.count, 0)
            };
            
            console.log(`✅ ${factionId}: ${results[factionId].totalMinions} 随从 + ${results[factionId].totalActions} 行动`);
            
            // 避免请求过快
            await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
            console.error(`❌ ${factionId}: ${error.message}`);
            results[factionId] = { error: error.message };
        }
    }
    
    // 保存结果
    writeFileSync('wiki-faction-data.json', JSON.stringify(results, null, 2));
    console.log('\n✅ 数据已保存到 wiki-faction-data.json');
}

main().catch(console.error);
