# Dice Throne AI pendingDamage Token 响应修复（2026-04-09）

> 2026-06-06 当前有效口径：本文只记录“`pendingDamage` 仍在但 `responseWindow` 已空时，AI token 响应分支失效”这一条历史专项修复，不是当前 DiceThrone 所有 AI token 响应、所有 pendingDamage 时序问题都已全面收口的证明，也不是新英雄补审出口。阅读时只能把它当作单问题修复记录。

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

---

**当前阅读说明**：本文只能证明 `pendingDamage + 空 responseWindow` 这条专项时序问题曾被修复，不能外推为当前所有 token 响应、所有 AI 响应时序或 DiceThrone 当前整体审计都已收口。
