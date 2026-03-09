#!/usr/bin/env node
/**
 * 批量修改交互创建函数调用，添加 abilityId 参数
 */

import { readFileSync, writeFileSync } from 'fs';
import { glob } from 'glob';

const files = glob.sync('src/games/cardia/domain/abilities/**/*.ts');

for (const file of files) {
    let content = readFileSync(file, 'utf-8');
    let modified = false;

    // 修改 createCardSelectionInteraction 调用
    // 匹配模式：createCardSelectionInteraction(\n        `${ctx.abilityId}_...`,\n        ctx.playerId,
    const cardSelectionPattern = /(createCardSelectionInteraction\(\s*`\$\{ctx\.abilityId\}_[^`]+`,\s*)(ctx\.playerId,)/g;
    if (cardSelectionPattern.test(content)) {
        content = content.replace(cardSelectionPattern, '$1ctx.abilityId,\n        $2');
        modified = true;
    }

    // 修改 createFactionSelectionInteraction 调用
    const factionSelectionPattern = /(createFactionSelectionInteraction\(\s*`\$\{ctx\.abilityId\}_[^`]+`,\s*)(ctx\.playerId,)/g;
    if (factionSelectionPattern.test(content)) {
        content = content.replace(factionSelectionPattern, '$1ctx.abilityId,\n        $2');
        modified = true;
    }

    // 修改 createModifierSelectionInteraction 调用
    const modifierSelectionPattern = /(createModifierSelectionInteraction\(\s*`\$\{ctx\.abilityId\}_[^`]+`,\s*)(ctx\.playerId,)/g;
    if (modifierSelectionPattern.test(content)) {
        content = content.replace(modifierSelectionPattern, '$1ctx.abilityId,\n        $2');
        modified = true;
    }

    if (modified) {
        writeFileSync(file, content, 'utf-8');
        console.log(`✅ 已修改: ${file}`);
    }
}

console.log('\n✅ 批量修改完成');
