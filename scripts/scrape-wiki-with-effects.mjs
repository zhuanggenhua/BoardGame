#!/usr/bin/env node
/**
 * 从 Wiki 抓取卡牌名称和效果描述
 * 用于根据效果匹配代码中的卡牌
 */

import https from 'https';
import { writeFileSync } from 'fs';

const factionMap = {
    'aliens': 'Aliens',
    'ninjas': 'Ninjas',
    'pirates': 'Pirates',
    'robots': 'Robots',
    'tricksters': 'Tricksters',
    'wizards': 'Wizards',
    'zombies': 'Zombies',
    'dinosaurs': 'Dinosaurs',
    'bear_cavalry': 'Bear_Cavalry',
    'ghosts': 'Ghosts',
    'killer_plants': 'Killer_Plants',
    'steampunks': 'Steampunks',
    'elder_things': 'Elder_Things',
    'innsmouth': 'Innsmouth',
    'cthulhu': 'Minions_of_Cthulhu',
    'miskatonic': 'Miskatonic_University',
    'giant-ants': 'Giant_Ants',
    'vampires': 'Vampires',
    'werewolves': 'Werewolves',
    'frankenstein': 'Mad_Scientists'
};

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

function parseWikiCardsWithEffects(html) {
    const cards = [];
    
    // 匹配卡牌条目：数量 + 名称 + 可能的效果描述
    // 格式：<li>1x <span><b>Card Name</b></span> - Effect description</li>
    const regex = /<li[^>]*>(\d+)x\s+<span[^>]*><b>([^<]+)<\/b><\/span>([^<]*(?:<[^>]+>[^<]*)*?)<\/li>/g;
    let match;
    
    while ((match = regex.exec(html)) !== null) {
        const count = parseInt(match[1]);
        const name = match[2].trim();
        let effect = match[3].trim();
        
        // 清理 HTML 标签
        effect = effect.replace(/<[^>]+>/g, '').trim();
        // 移除开头的破折号和空格
        effect = effect.replace(/^[-–—]\s*/, '').trim();
        
        cards.push({
            name,
            count,
            effect: effect || '(无描述)'
        });
    }
    
    return cards;
}

async function scrapeAllFactions() {
    const results = {};
    
    for (const [factionId, wikiName] of Object.entries(factionMap)) {
        console.log(`正在抓取 ${factionId} (${wikiName})...`);
        
        try {
            const html = await fetchWikiPage(wikiName);
            const cards = parseWikiCardsWithEffects(html);
            
            results[factionId] = {
                wikiName,
                totalCards: cards.reduce((sum, c) => sum + c.count, 0),
                cards
            };
            
            console.log(`  ✅ 找到 ${cards.length} 种卡牌，共 ${results[factionId].totalCards} 张`);
            
            // 避免请求过快
            await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
            console.error(`  ❌ 失败: ${error.message}`);
            results[factionId] = { error: error.message };
        }
    }
    
    return results;
}

// 执行抓取
console.log('开始从 Wiki 抓取卡牌信息（包含效果描述）...\n');

scrapeAllFactions().then(results => {
    const outputFile = 'wiki-cards-with-effects.json';
    writeFileSync(outputFile, JSON.stringify(results, null, 2), 'utf-8');
    console.log(`\n✅ 数据已保存到 ${outputFile}`);
    
    // 输出统计
    console.log('\n📊 统计：');
    for (const [factionId, data] of Object.entries(results)) {
        if (data.error) {
            console.log(`  ${factionId}: ❌ ${data.error}`);
        } else {
            console.log(`  ${factionId}: ${data.totalCards} 张卡`);
        }
    }
}).catch(error => {
    console.error('抓取失败:', error);
    process.exit(1);
});
