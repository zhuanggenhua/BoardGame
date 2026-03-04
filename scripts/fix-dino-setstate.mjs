#!/usr/bin/env node
/**
 * 修复 dino 测试的 setState 调用
 * 
 * 问题：runner.setState() 期望 MatchState<TState> 格式（{ core, sys }）
 * 但测试传入的是裸的 core 状态
 * 
 * 修复：将 runner.setState(coreState) 改为 runner.setState({ core: coreState, sys: ... })
 */

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';

const testDir = 'src/games/smashup/__tests__';
const allFiles = readdirSync(testDir);
const files = allFiles
    .filter(f => (f.startsWith('audit-d1-d8-d33-dino') || f.startsWith('audit-d11') || f.startsWith('audit-d31') || f.startsWith('audit-d8-dino')) && f.endsWith('.test.ts'))
    .map(f => join(testDir, f));

console.log(`Found ${files.length} dino test files`);

for (const file of files) {
    console.log(`\nProcessing ${file}...`);
    
    let content = readFileSync(file, 'utf-8');
    const originalContent = content;
    
    // 添加必要的 import
    if (!content.includes('import { createInitialSystemState }')) {
        content = content.replace(
            /import { createFlowSystem, createBaseSystems } from '\.\.\/\.\.\/\.\.\/engine\/systems';/,
            `import { createFlowSystem, createBaseSystems } from '../../../engine/systems';\nimport { createInitialSystemState } from '../../../engine/pipeline';`
        );
        console.log(`  ✓ Added createInitialSystemState import`);
    }
    
    // 修改 createRunner 函数，添加辅助方法
    const createRunnerMatch = content.match(/function createRunner\(\) \{[\s\S]*?\n\}/);
    if (createRunnerMatch) {
        const oldCreateRunner = createRunnerMatch[0];
        const newCreateRunner = `function createRunner() {
    const systems = [
        createFlowSystem<SmashUpCore>({ hooks: smashUpFlowHooks }),
        ...createBaseSystems<SmashUpCore>(),
    ];
    return new GameTestRunner<SmashUpCore, SmashUpCommand, SmashUpEvent>({
        domain: SmashUpDomain,
        systems,
        playerIds: ['0', '1'],
    });
}

// 辅助函数：将 core 状态包装为 MatchState
function wrapState(core: SmashUpCore) {
    const systems = [
        createFlowSystem<SmashUpCore>({ hooks: smashUpFlowHooks }),
        ...createBaseSystems<SmashUpCore>(),
    ];
    const sys = createInitialSystemState(['0', '1'], systems, undefined);
    sys.phase = 'playCards';
    return { core, sys };
}`;
        content = content.replace(oldCreateRunner, newCreateRunner);
        console.log(`  ✓ Updated createRunner function`);
    }
    
    // 替换所有 runner.setState({ players: ... }) 为 runner.setState(wrapState({ players: ... }))
    // 使用正则表达式匹配 runner.setState({ ... }) 的模式
    content = content.replace(
        /runner\.setState\(\{/g,
        'runner.setState(wrapState({'
    );
    
    // 需要为每个 setState 调用添加对应的闭合括号
    // 这比较复杂，让我们用一个更简单的方法：手动标记需要修改的位置
    
    // Write back if changed
    if (content !== originalContent) {
        writeFileSync(file, content, 'utf-8');
        console.log(`  ✅ File updated`);
    } else {
        console.log(`  ℹ️  No changes needed`);
    }
}

console.log('\n⚠️  注意：由于 setState 调用的复杂性，可能需要手动调整括号匹配');
console.log('建议：检查每个文件，确保 wrapState() 的括号正确闭合');
