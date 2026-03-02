#!/usr/bin/env node
/**
 * 修复 robot-hoverbot-chain.test.ts 的 runCommand 调用签名
 * 
 * 问题：测试使用旧的 4 参数签名 runCommand(ms, commandType, playerId, payload)
 * 修复：改为新的 3 参数签名 runCommand(ms, { type, playerId, payload })
 */

import { readFileSync, writeFileSync } from 'fs';

const filePath = 'src/games/smashup/__tests__/robot-hoverbot-chain.test.ts';
let content = readFileSync(filePath, 'utf-8');

// 替换所有 runCommand 调用
// 模式：runCommand(ms, SU_COMMANDS.XXX, '0', { ... })
// 替换为：runCommand(ms, { type: SU_COMMANDS.XXX, playerId: '0', payload: { ... } })

// 第一个调用：PLAY_MINION
content = content.replace(
    /ms = runCommand\(ms, SU_COMMANDS\.PLAY_MINION, '0', \{ cardUid: 'hoverbot-1', baseIndex: 0 \}\);/,
    "ms = runCommand(ms, { type: SU_COMMANDS.PLAY_MINION, playerId: '0', payload: { cardUid: 'hoverbot-1', baseIndex: 0 } }).finalState;"
);

// 第二个调用：SYS_INTERACTION_RESPOND
content = content.replace(
    /ms = runCommand\(ms, 'SYS_INTERACTION_RESPOND', '0', \{ optionId: 'play' \}\);/,
    "ms = runCommand(ms, { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: 'play' } }).finalState;"
);

// 第三个调用：PLAY_MINION（第二个测试）
content = content.replace(
    /ms = runCommand\(ms, SU_COMMANDS\.PLAY_MINION, '0', \{ cardUid: 'hoverbot-1', baseIndex: 0 \}\);/,
    "ms = runCommand(ms, { type: SU_COMMANDS.PLAY_MINION, playerId: '0', payload: { cardUid: 'hoverbot-1', baseIndex: 0 } }).finalState;"
);

// 第四个调用：runCommand with expectError
content = content.replace(
    /const result = runCommand\(ms, 'SYS_INTERACTION_RESPOND', '0', \{ optionId: 'play' \}, \{ expectError: true \}\);/,
    "const result = runCommand(ms, { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: { optionId: 'play' } });"
);

// 修复 result.success 和 result.state 的访问
content = content.replace(
    /expect\(result\.success\)\.toBe\(false\);/,
    "expect(result.success).toBe(false);"
);

content = content.replace(
    /const coreFinal = result\.state\.core as SmashUpCore;/,
    "const coreFinal = result.finalState.core as SmashUpCore;"
);

writeFileSync(filePath, content, 'utf-8');
console.log('✅ 已修复 robot-hoverbot-chain.test.ts');
