#!/usr/bin/env node
import { readFileSync } from 'fs';

// 读取测试文件
const testFile = 'src/games/smashup/__tests__/zombieInteractionChain.test.ts';
const content = readFileSync(testFile, 'utf-8');

// 查找测试用例
const testMatch = content.match(/it\('消耗正常随从额度'[\s\S]*?}\);/);
if (testMatch) {
    console.log('=== 测试用例 ===');
    console.log(testMatch[0]);
    
    // 检查使用的卡牌 defId
    const defIdMatch = testMatch[0].match(/defId:\s*'([^']+)'/g);
    console.log('\n=== 使用的卡牌 ===');
    defIdMatch?.forEach(m => console.log(m));
}

// 查找 zombie_theyre_coming_to_get_you 的定义
const zombieFile = 'src/games/smashup/abilities/zombies.ts';
const zombieContent = readFileSync(zombieFile, 'utf-8');
const zombieMatch = zombieContent.match(/registerDiscardPlayProvider\(\{[\s\S]*?id:\s*'zombie_theyre_coming_to_get_you'[\s\S]*?\}\);/);
if (zombieMatch) {
    console.log('\n=== zombie_theyre_coming_to_get_you 定义 ===');
    console.log(zombieMatch[0]);
}
