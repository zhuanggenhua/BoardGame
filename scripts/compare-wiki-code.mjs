import https from 'https';
import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';

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

function parseWikiCards(html) {
    const regex = /(\d+)x\s+<span[^>]*><b>([^<]+)<\/b><\/span>/g;
    const cards = [];
    let match;
    
    while ((match = regex.exec(html)) !== null) {
        cards.push({
            name: match[2],
            count: parseInt(match[1])
        });
    }
    
    return cards;
}

function getCodeCards(factionId) {
    const filePath = `src/games/smashup/data/factions/${factionId}.ts`;
    try {
        const content = readFileSync(filePath, 'utf-8');
        const cards = [];
        
        // 提取所有卡牌定义
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

function compareCards(wikiCards, codeCards, factionId) {
    const issues = [];
    const wikiMap = new Map(wikiCards.map(c => [c.name, c.count]));
    const codeMap = new Map(codeCards.map(c => [c.name, c.count]));
    
    // 检查数量不匹配
    for (const [name, wikiCount] of wikiMap) {
        const codeCount = codeMap.get(name);
        if (codeCount === undefined) {
            issues.push(`❌ 缺少: ${name} (Wiki: ${wikiCount}x)`);
        } else if (codeCount !== wikiCount) {
            issues.push(`❌ 数量错误: ${name} (代码: ${codeCount}x, Wiki: ${wikiCount}x)`);
        }
    }
    
    // 检查代码中多余的卡
    for (const [name, codeCount] of codeMap) {
        if (!wikiMap.has(name)) {
            issues.push(`⚠️  多余: ${name} (代码: ${codeCount}x, Wiki 中不存在)`);
        }
    }
    
    return issues;
}

async function main() {
    console.log('# 大杀四方卡牌数量核对报告\n');
    console.log('生成时间:', new Date().toLocaleString('zh-CN'), '\n');
    
    const results = [];
    
    for (const [factionId, wikiName] of Object.entries(factionMap)) {
        console.log(`\n## ${factionId} (${wikiName})`);
        console.log('正在获取 Wiki 数据...');
        
        try {
            const html = await fetchWikiPage(wikiName);
            const wikiCards = parseWikiCards(html);
            const codeCards = getCodeCards(factionId);
            
            if (!codeCards) {
                console.log('⚠️  代码文件不存在');
                continue;
            }
            
            console.log(`Wiki: ${wikiCards.length} 张卡`);
            console.log(`代码: ${codeCards.length} 张卡`);
            
            const issues = compareCards(wikiCards, codeCards, factionId);
            
            if (issues.length === 0) {
                console.log('✅ 完全正确');
                results.push({ factionId, status: '✅ 正确', issues: [] });
            } else {
                console.log(`❌ 发现 ${issues.length} 个问题:`);
                issues.forEach(issue => console.log('  ' + issue));
                results.push({ factionId, status: `❌ ${issues.length} 个问题`, issues });
            }
            
            // 避免请求过快
            await new Promise(resolve => setTimeout(resolve, 2000));
        } catch (error) {
            console.log('❌ 错误:', error.message);
            results.push({ factionId, status: '❌ 错误', issues: [error.message] });
        }
    }
    
    // 生成总结报告
    console.log('\n\n# 总结\n');
    const correct = results.filter(r => r.status === '✅ 正确').length;
    const incorrect = results.filter(r => r.status.startsWith('❌')).length;
    
    console.log(`- ✅ 正确: ${correct} 个派系`);
    console.log(`- ❌ 有问题: ${incorrect} 个派系`);
    console.log(`- 总计: ${results.length} 个派系`);
    
    // 保存详细报告
    writeFileSync('wiki-comparison-report.json', JSON.stringify(results, null, 2));
    console.log('\n✅ 详细报告已保存到 wiki-comparison-report.json');
}

main().catch(console.error);
