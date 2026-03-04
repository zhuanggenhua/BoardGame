import { readFileSync, writeFileSync } from 'fs';

// 修复配置
const fixes = {
  ninjas: [
    // 删除 Invisible Ninja（Wiki 中不存在）
    { action: 'remove', cardId: 'ninja_invisible_ninja' }
  ],
  
  pirates: [
    // 删除 The Kraken（Wiki 中不存在）
    { action: 'remove', cardId: 'pirate_the_kraken' },
    // 注意：Saucy Wench 需要手动添加（需要图集索引）
  ],
  
  zombies: [
    // 修复大小写：They're Coming to Get You → They're Coming To Get You
    { action: 'rename', oldName: "They're Coming to Get You", newName: "They're Coming To Get You" }
  ],
  
  miskatonic: [
    // 修复引号：弯引号 → 直引号
    { action: 'rename', oldName: '"Old Man Jenkins!?"', newName: '"Old Man Jenkins!?"' },
    // 注意：That's So Crazy... 需要手动添加（需要图集索引）
  ],
  
  frankenstein: [
    // 注意：IT'S ALIVE! 需要手动添加（需要图集索引）
  ]
};

function applyFixes() {
  console.log('🔧 开始修复最终问题...\n');
  
  for (const [factionId, factionFixes] of Object.entries(fixes)) {
    if (factionFixes.length === 0) continue;
    
    const filePath = `src/games/smashup/data/factions/${factionId}.ts`;
    let content = readFileSync(filePath, 'utf-8');
    let modified = false;
    
    for (const fix of factionFixes) {
      if (fix.action === 'remove') {
        // 删除卡牌定义（整个对象）
        const regex = new RegExp(`\\{[^}]*id:\\s*'${fix.cardId}'[^}]*\\}[,\\s]*`, 'g');
        const before = content;
        content = content.replace(regex, '');
        if (content !== before) {
          console.log(`✅ ${factionId}: 已删除 ${fix.cardId}`);
          modified = true;
        }
      } else if (fix.action === 'rename') {
        // 修改 nameEn
        const regex = new RegExp(`nameEn:\\s*'${fix.oldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'`, 'g');
        const before = content;
        content = content.replace(regex, `nameEn: '${fix.newName}'`);
        if (content !== before) {
          console.log(`✅ ${factionId}: 已重命名 "${fix.oldName}" → "${fix.newName}"`);
          modified = true;
        }
      }
    }
    
    if (modified) {
      writeFileSync(filePath, content, 'utf-8');
      console.log(`💾 已保存: ${factionId}.ts\n`);
    }
  }
  
  console.log('✅ 自动修复完成！\n');
  console.log('📋 需要手动添加的卡牌（需要图集索引）：');
  console.log('  - pirates: Saucy Wench (3x)');
  console.log('  - miskatonic: That\'s So Crazy... (1x)');
  console.log('  - frankenstein: IT\'S ALIVE! (2x)');
}

applyFixes();
