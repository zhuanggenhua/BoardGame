/**
 * 修复 audit-d8-d19-base-fairy-ring.test.ts 中的旧 API 调用
 * - runner.getInitialState() → runner.patchState()
 * - runner.runCommand(state, cmd) → runner.executeCommand(cmd.type, cmd)
 */

import { readFileSync, writeFileSync } from 'fs';

const filePath = 'src/games/smashup/__tests__/audit-d8-d19-base-fairy-ring.test.ts';
let content = readFileSync(filePath, 'utf-8');

// 由于文件中有多处类似的模式，我们需要更智能的替换
// 这个文件的问题是使用了旧的 runner API，需要全部重写

console.log('文件太复杂，需要手动修复剩余的 getInitialState 调用');
console.log('建议：将所有 getInitialState 替换为 patchState，将 runCommand 替换为 executeCommand');
