import { readFileSync, writeFileSync } from 'fs';

// 从 Wiki 对比报告读取需要修复的问题
const report = JSON.parse(readFileSync('wiki-comparison-report.json', 'utf-8'));

// 定义所有需要修复的内容
const fixes = {
    'tricksters': [
        { type: 'count', nameEn: 'Disenchant', from: 1, to: 2 },
        { type: 'count', nameEn: 'Enshrouding Mist', from: 1, to: 2 },
        { type: 'count', nameEn: 'Flame Trap', from: 2, to: 1 },
        { type: 'count', nameEn: 'Pay the Piper', from: 2, to: 1 },
        { type: 'add', nameEn: 'Big Funny Giant', count: 1, cardType: 'minion', power: 5 }
    ],
    'wizards': [
        { type: 'add', nameEn: 'Arcane Protector', count: 1, cardType: 'action' }
    ],
    'zombies': [
        { type: 'count', nameEn: 'Grave Robbing', from: 1, to: 2 },
        { type: 'count', nameEn: 'Mall Crawl', from: 2, to: 1 }
    ],
    'dinosaurs': [
        { type: 'rename', oldNameEn: 'Tooth and Claw...and Guns', newNameEn: 'Tooth and Claw... and Guns' },
        { type: 'add', nameEn: 'Fort Titanosaurus', count: 1, cardType: 'action' }
    ],
    'bear_cavalry': [
        { type: 'count', nameEn: 'Bear Necessities', from: 2, to: 1 },
        { type: 'count', nameEn: 'Commission', from: 1, to: 2 },
        { type: 'count', nameEn: 'High Ground', from: 2, to: 1 },
        { type: 'count', nameEn: "You're Screwed", from: 1, to: 2 },
        { type: 'add', nameEn: 'Major Ursa', count: 1, cardType: 'minion', power: 5 }
    ],
    'ghosts': [
        { type: 'add', nameEn: 'Creampuff Man', count: 1, cardType: 'minion', power: 5 }
    ],
    'killer_plants': [
        { type: 'count', nameEn: 'Budding', from: 2, to: 1 },
        { type: 'count', nameEn: 'Sleep Spores', from: 1, to: 2 },
        { type: 'add', nameEn: 'Killer Kudzu', count: 1, cardType: 'minion', power: 5 }
    ],
    'steampunks': [
        { type: 'count', nameEn: 'Escape Hatch', from: 2, to: 1 },
        { type: 'count', nameEn: 'Zeppelin', from: 1, to: 2 }
    ],
    'elder_things': [
        { type: 'count', nameEn: 'Begin the Summoning', from: 1, to: 2 },
        { type: 'count', nameEn: 'Power of Madness', from: 1, to: 2 },
        { type: 'count', nameEn: 'Touch of Madness', from: 3, to: 1 }
    ],
    'innsmouth': [
        { type: 'add', nameEn: 'Dagon', count: 1, cardType: 'minion', power: 5 }
    ],
    'cthulhu': [
        { type: 'add', nameEn: 'Cthulhu', count: 1, cardType: 'minion', power: 5 }
    ],
    'miskatonic': [
        { type: 'rename', oldNameEn: 'Old Man Jenkins!?', newNameEn: '"Old Man Jenkins!?"' },
        { type: 'rename', oldNameEn: 'It Just Might Work', newNameEn: '... It Just Might Work' },
        { type: 'add', nameEn: "That's So Crazy...", count: 1, cardType: 'action' }
    ],
    'giant-ants': [
        { type: 'add', nameEn: 'Death on Six Legs', count: 1, cardType: 'minion', power: 5 }
    ],
    'vampires': [
        { type: 'add', nameEn: 'Ancient Lord', count: 1, cardType: 'minion', power: 5 }
    ],
    'werewolves': [
        { type: 'add', nameEn: 'Great Wolf Spirit', count: 1, cardType: 'minion', power: 5 }
    ],
    'frankenstein': [
        { type: 'add', nameEn: "IT'S ALIVE!", count: 2, cardType: 'action' },
        { type: 'add', nameEn: 'The Bride', count: 1, cardType: 'minion', power: 5 }
    ]
};

function applyCountFix(content, nameEn, from, to) {
    const regex = new RegExp(`(nameEn:\\s*'${nameEn.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'[\\s\\S]*?count:\\s*)${from}`, 'g');
    return content.replace(regex, `$1${to}`);
}

function applyRenameFix(content, oldNameEn, newNameEn) {
    const regex = new RegExp(`nameEn:\\s*'${oldNameEn.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'`, 'g');
    return content.replace(regex, `nameEn: '${newNameEn}'`);
}

console.log('开始批量修复派系卡牌数量...\n');

for (const [factionId, fixList] of Object.entries(fixes)) {
    const filePath = `src/games/smashup/data/factions/${factionId}.ts`;
    
    try {
        let content = readFileSync(filePath, 'utf-8');
        let modified = false;
        
        for (const fix of fixList) {
            if (fix.type === 'count') {
                const newContent = applyCountFix(content, fix.nameEn, fix.from, fix.to);
                if (newContent !== content) {
                    console.log(`✅ ${factionId}: ${fix.nameEn} count ${fix.from} → ${fix.to}`);
                    content = newContent;
                    modified = true;
                } else {
                    console.log(`⚠️  ${factionId}: ${fix.nameEn} 未找到匹配项`);
                }
            } else if (fix.type === 'rename') {
                const newContent = applyRenameFix(content, fix.oldNameEn, fix.newNameEn);
                if (newContent !== content) {
                    console.log(`✅ ${factionId}: 重命名 "${fix.oldNameEn}" → "${fix.newNameEn}"`);
                    content = newContent;
                    modified = true;
                } else {
                    console.log(`⚠️  ${factionId}: "${fix.oldNameEn}" 未找到匹配项`);
                }
            } else if (fix.type === 'add') {
                console.log(`⚠️  ${factionId}: 需要手动添加 "${fix.nameEn}" (${fix.cardType}, count: ${fix.count})`);
            }
        }
        
        if (modified) {
            writeFileSync(filePath, content, 'utf-8');
            console.log(`💾 已保存 ${filePath}\n`);
        }
    } catch (error) {
        console.error(`❌ ${factionId}: ${error.message}\n`);
    }
}

console.log('\n✅ 批量修复完成！');
console.log('\n⚠️  注意：以下卡牌需要手动添加（包括图集索引和中文翻译）：');
console.log('- Tricksters: Big Funny Giant (minion, power 5)');
console.log('- Wizards: Arcane Protector (action)');
console.log('- Dinosaurs: Fort Titanosaurus (action)');
console.log('- Bear Cavalry: Major Ursa (minion, power 5)');
console.log('- Ghosts: Creampuff Man (minion, power 5)');
console.log('- Killer Plants: Killer Kudzu (minion, power 5)');
console.log('- Innsmouth: Dagon (minion, power 5)');
console.log('- Minions of Cthulhu: Cthulhu (minion, power 5)');
console.log("- Miskatonic University: That's So Crazy... (action)");
console.log('- Giant Ants: Death on Six Legs (minion, power 5)');
console.log('- Vampires: Ancient Lord (minion, power 5)');
console.log('- Werewolves: Great Wolf Spirit (minion, power 5)');
console.log("- Mad Scientists: IT'S ALIVE! (action, count 2)");
console.log('- Mad Scientists: The Bride (minion, power 5)');
