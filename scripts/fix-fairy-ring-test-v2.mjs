#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'fs';

const filePath = 'src/games/smashup/__tests__/audit-d8-d19-base-fairy-ring.test.ts';
let content = readFileSync(filePath, 'utf-8');

// 1. 修复导入
content = content.replace(
    "import { SU_COMMANDS } from '../domain/commands';",
    "import { SU_COMMANDS } from '../domain/types';"
);
content = content.replace(
    "import { SU_EVENTS } from '../domain/events';",
    "import { SU_EVENTS } from '../domain/types';"
);

// 2. 删除所有 getInitialState 和 new GameTestRunner 的重复创建
// 将所有 const runner = new GameTestRunner<...>(...); 替换为 const runner = createRunner();
content = content.replace(
    /const runner = new GameTestRunner<SmashUpCore, SmashUpCommand, SmashUpEvent>\(\{\s+domain: SmashUpDomain,\s+systems: \[\s+createFlowSystem<SmashUpCore>\(\{ hooks: smashUpFlowHooks \}\),\s+\.\.\.createBaseSystems<SmashUpCore>\(\),\s+\],\s+playerIds: PLAYER_IDS,\s+silent: true,\s+\}\);/g,
    'const runner = createRunner();'
);

// 3. 将所有 getInitialState 调用替换为 patchState
// 简单替换：const initialState = runner.getInitialState({ → runner.patchState({ core: {
content = content.replace(/const initialState = runner\.getInitialState\(\{/g, 'runner.patchState({ core: {');

// 4. 将所有 runner.runCommand(initialState, { type: SU_COMMANDS.XXX, ... }) 替换为 runner.dispatch(SU_COMMANDS.XXX, { ... })
content = content.replace(
    /runner\.runCommand\(initialState, \{\s*type: (SU_COMMANDS\.\w+),\s*playerId: '([^']+)',\s*([^}]+)\}\)/g,
    (match, cmdType, playerId, rest) => `runner.dispatch(${cmdType}, { playerId: '${playerId}', ${rest}})`
);

// 5. 将所有 runner.runCommand(state\d+, { type: SU_COMMANDS.XXX, ... }) 替换为 runner.dispatch(SU_COMMANDS.XXX, { ... })
content = content.replace(
    /runner\.runCommand\(state\d+, \{\s*type: (SU_COMMANDS\.\w+),\s*playerId: '([^']+)',\s*([^}]+)\}\)/g,
    (match, cmdType, playerId, rest) => `runner.dispatch(${cmdType}, { playerId: '${playerId}', ${rest}})`
);

// 6. 将所有 runner.executeCommand(SU_COMMANDS.XXX, { ... }) 保持不变（这个 API 存在）

writeFileSync(filePath, content, 'utf-8');
console.log('✅ 修复完成');
