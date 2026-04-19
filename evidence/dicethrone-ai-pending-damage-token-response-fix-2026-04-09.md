# Dice Throne AI pendingDamage Token 响应修复（2026-04-09）

## 反馈
- feedbackId: `69d3572da812935931090493`
- 标题：`AI强制接受不了回合`

## 结论
- 这是一个真实 bug。
- 根因是本地 AI 的响应动作生成同时依赖 `responseWindow.current` 与 `pendingDamage`，但其中一处直接读取了 `responseWindow.windowType`。
- 当线上状态出现“`pendingDamage` 仍在，但 `responseWindow.current` 已空”的时序时，AI 本应继续生成 `USE_TOKEN / SKIP_TOKEN_RESPONSE`，却会因为空值访问导致该分支失效，进而出现不会接受/不会跳过响应、回合推进异常。

## 修复
- 文件：`src/games/dicethrone/ai.ts`
- 修复点：把
  - `responseWindow.windowType`
  改为
  - `responseWindow?.windowType`
- 结果：AI 在仅剩 `pendingDamage` 的响应阶段仍可继续生成 token 响应动作，不会错误退回普通阶段动作。

## 验证
1. `npx eslint src/games/dicethrone/ai.ts src/games/dicethrone/__tests__/basic-commands-coverage.test.ts`
2. `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/basic-commands-coverage.test.ts --configLoader native`

## 验证结果
- 上述命令通过。
- `basic-commands-coverage.test.ts` 共 `54 passed`。
- 已覆盖“`pendingDamage` 仍存在但 `responseWindow` 已空时，本地 AI 仍应生成 token 响应动作 / 优先 skip-token-response 而不是普通阶段动作”。
