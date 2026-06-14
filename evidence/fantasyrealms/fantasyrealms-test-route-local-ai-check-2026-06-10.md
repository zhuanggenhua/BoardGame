# Fantasy Realms 合法测试入口 local AI 页面证据（2026-06-10）

## 目标

证明合法测试入口 `/play/fantasyrealms` 已经能承载 `local AI seat` 页面态，而不是只在已判废的 `/play/:gameId/local` 上成立。

## 本轮验证

- 页面入口：
  - `/play/fantasyrealms?players=2&playerID=0&seat1=local-ai`
- 自动化：
  - `npx vitest run src/pages/__tests__/TestMatchRoom.test.tsx` -> `2 passed`
  - `node scripts/infra/run-e2e-command.mjs ci e2e/fantasyrealms/fantasyrealms-test-route-local-ai.e2e.ts` -> `1 passed`

## 关键截图

- `D:\gongzuo\webgame\BoardGame\.worktrees\fantasyrealms\test-results\evidence-screenshots\_shared\fantasyrealms-test-route-local-ai.e2e\合法测试入口里-human-首手后，seat1-local-ai-会真实接手并把回合交回\合法测试入口里-human-首手后，seat1-local-ai-会真实接手并把回合交回-test-route-local-ai-roundtrip-back-to-human.png`

## 看图结论

- 左上牌库、顶部中轴状态、右上分数摘要、右侧主按钮和底部手牌都还在，说明这条链跑的确实是当前 live 测试页，不是退回到别的壳层。
- 截图时页面已经回到 `你的回合 / 抓一张牌`，右侧主按钮重新可操作，说明 `seat1 local-ai` 已完成自己那手并把回合交回 human。
- 中央公开区当前有两张牌，符合 `human` 先弃一张、随后 `seat1 local-ai` 再完成一手后的页面结果；这不是只证明“AI 曾被配置过”，而是证明它在合法入口上真实推进了页面态。

## 本轮结论

- 当前缺口已从“合法测试入口不承载 local AI seat 页面态”推进到“合法入口上已有真实页面级证据”。
- 后续若再补 `local AI` 页面链，应继续基于 `/play/:gameId` 测试入口，而不是回到被门禁禁止的 `/play/:gameId/local`。
