#!/usr/bin/env node
/**
 * 修复 audit-d8-d19-base-fairy-ring.test.ts 中的 API 调用
 * - runCommand() → dispatch()
 * - getInitialState() → patchState()
 */

import { readFileSync, writeFileSync } from 'fs';

const filePath = 'src/games/smashup/__tests__/audit-d8-d19-base-fairy-ring.test.ts';
let content = readFileSync(filePath, 'utf-8');

// 1. 替换 runCommand 为 dispatch
// runner.runCommand({ type: SU_COMMANDS.XXX, playerId: '0', ... })
// → runner.dispatch(SU_COMMANDS.XXX, { playerId: '0', ... })
content = content.replace(
    /runner\.runCommand\(\s*\{\s*type:\s*([^,]+),\s*playerId:\s*'([^']+)',\s*([^}]+)\}\s*\)/g,
    (match, cmdType, playerId, rest) => {
        return `runner.dispatch(${cmdType}, { playerId: '${playerId}', ${rest}})`;
    }
);

// 2. 替换带 state 参数的 runCommand
// runner.runCommand(state1, { type: SU_COMMANDS.XXX, playerId: '0', ... })
// → runner.dispatch(SU_COMMANDS.XXX, { playerId: '0', ... })
content = content.replace(
    /runner\.runCommand\([^,]+,\s*\{\s*type:\s*([^,]+),\s*playerId:\s*'([^']+)',\s*([^}]+)\}\s*\)/g,
    (match, cmdType, playerId, rest) => {
        return `runner.dispatch(${cmdType}, { playerId: '${playerId}', ${rest}})`;
    }
);

// 3. 删除所有 getInitialState 调用和 const initialState = 赋值
// 将 const initialState = runner.getInitialState({ ... }); 替换为 runner.patchState({ core: { ... } });
content = content.replace(
    /const initialState = runner\.getInitialState\(\{([^}]+(?:\{[^}]*\}[^}]*)*)\}\);/gs,
    (match, innerContent) => {
        return `runner.patchState({ core: {${innerContent}} });`;
    }
);

// 4. 替换所有使用 initialState 的 runCommand 调用为直接使用 runner
content = content.replace(/runner\.runCommand\(initialState,/g, 'runner.dispatch(');

// 5. 删除 new GameTestRunner 的重复创建（保留 createRunner()）
content = content.replace(
    /const runner = new GameTestRunner<SmashUpCore, SmashUpCommand, SmashUpEvent>\(\{\s*domain: SmashUpDomain,\s*systems: \[\s*createFlowSystem<SmashUpCore>\(\{ hooks: smashUpFlowHooks \}\),\s*\.\.\.createBaseSystems<SmashUpCore>\(\),\s*\],\s*playerIds: PLAYER_IDS,\s*silent: true,\s*\}\);/g,
    'const runner = createRunner();'
);

writeFileSync(filePath, content, 'utf-8');
console.log('✅ 修复完成');
