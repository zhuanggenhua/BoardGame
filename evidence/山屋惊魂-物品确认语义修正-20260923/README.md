# 山屋惊魂物品确认语义修正证据

日期：2026-09-23

## 原始问题

- “可能改写骰子结果的物品”不应因为未来存在改骰能力，就自动升级为全员确认。
- 当前物品发现展示只需要证明获得者能看清卡面，并在约三秒展示窗口后进入实际持有区。
- 多人确认只属于当前确实存在共同观看、响应、选择或授权窗口的结果，不属于物品能力分类标签。

## 直接证据

1. `01-急救包-三秒等待中.jpg`
   - 急救包处于 `确认 0/1` 的展示等待中。
2. `02-急救包-三秒后进入持有区.jpg`
   - 等待窗口结束，发现面板关闭，急救包已进入实际持有区。
3. `03-幸运硬币-三秒等待中.jpg`
   - 幸运硬币同样处于 `确认 0/1`，没有被错误扩大为 `确认 0/3`。
4. `04-幸运硬币-三秒后进入持有区.jpg`
   - 幸运硬币在没有其它玩家确认的情况下自动进入实际持有区。

## 历史证据降级

`evidence/山屋惊魂-全员确认与物理骰子-20260922/pass-manifest-20260922.json` 中“可能改写骰子结果的物品必须全员确认”的结论已被本轮规则修正覆盖。该条只能作为历史错误结论保存，不能继续作为当前 PASS 依据。

## 验证

- `npm run test:e2e:file -- e2e/betrayal/haunt-reveal-discovery-confirmation.e2e.ts --grep "普通物品停留三秒"`：1 passed
- `npx vitest run src/games/betrayal/__tests__/betrayal-possessions-and-recent-roll-rerolls.test.ts`：51 tests passed
- `npm run spec:lint`：spec-lint: OK

