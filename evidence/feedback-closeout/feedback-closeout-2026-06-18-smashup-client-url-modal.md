# 线上反馈收口证据（2026-06-18）

## 口径

- 反馈来源：线上真实反馈接口 `https://api.easyboardgame.top/admin/feedback`
- 本地批次：`temp/feedback-closeout/2026-06-18T14-33-20-309Z/summary.json`
- 本地状态板：`temp/feedback-closeout/status-board.json`
- 处理时间：2026-06-18 23:55 +08:00

## 代表项结论

| 反馈 ID | 游戏/入口 | 结论 | 证据 |
| --- | --- | --- | --- |
| `6a33a09c5ed87cdca4f71449` | 大杀四方 | 已定位并修复 | 真实反馈命中“回手事件构造函数未定义”；当前代码补齐 `buildValidatedReturnEvents` 导入，并新增科学怪人“墓地情形”同基地己方随从被消灭时改为回手的回归测试。 |
| `6a33c0805ed87cdca4f71662` | 大杀四方 | 已定位并修复 | 真实反馈显示当前弹窗只有“时间旅行者跳跃者/让过”，但发送记录里的合法动作来自另一组候选，导致“无效选择”。当前代码改为优先使用当前 simple-choice 刷新选项，只有刷新为空才回退到 reaction live resolver，并新增 AI 选择一致性测试。 |
| `6a33f9495ed87cdca4f71950` | Dice Throne | 当前树已恢复 | 该组 67 条重复反馈都指向防御投掷阶段防御方推进阶段被拒绝。当前树已有服务端回归测试证明 defensiveRoll 阶段允许防御方执行 `ADVANCE_PHASE`；本轮未改 Dice Throne 代码。 |
| `6a33fa745ed87cdca4f7197c` | 客户端经典首页 `/?homeStyle=classic&game=dicethrone` | 仅修相关风险，反馈本体未复现 | 反馈只有压缩 React #185 堆栈，无状态快照、截图或可用 sourcemap。当前代码修复同一路由上的 URL 弹窗程序化重开误触发用户关闭语义，防止内部重开时误删 `game=dicethrone` 并打乱弹窗栈；新增 `useUrlModal` 回归测试。 |
| `6a33b1335ed87cdca4f71553` | 大杀四方对局页 | 证据不足 | 反馈只有 `Maximum call stack size exceeded` 压缩堆栈，无状态快照、操作日志或可注入现场；当前未找到能证明同根因的本地复现。 |
| `6a33f9815ed87cdca4f71958` | 大杀四方计分阶段 | 证据不足 | 反馈摘要显示当时存在“结束当前阶段”的可见合法动作，但缺少完整游戏状态，无法注入到当前树复现 `no_progress`。 |

## 验证

已通过：

```powershell
node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/abilities/frankenstein.test.ts -t "frankenstein_grave_situation 在同基地己方随从被消灭时，应改为回手" --configLoader native --pool forks --no-file-parallelism --maxWorkers 1
node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/aiReactionChoiceValidation.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1
node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/smashup.smoke.test.ts -t "smashup_reaction_choose 只剩 legacy 空壳 mirror 时，AI 仍应暴露 advance-phase" --configLoader native --pool forks --no-file-parallelism --maxWorkers 1
node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts -t "Dice Throne 服务端在 defensiveRoll 应允许防御方执行 ADVANCE_PHASE" --configLoader native --pool forks --no-file-parallelism --maxWorkers 1
node scripts/infra/vitest-cli-safe.mjs run src/lib/__tests__/homeV2Routing.test.ts src/hooks/routing/__tests__/useUrlModal.test.tsx --configLoader native --pool forks --no-file-parallelism --maxWorkers 1
npx eslint src/hooks/routing/useUrlModal.ts src/hooks/routing/__tests__/useUrlModal.test.tsx
```

验证限制：

- `npm run test:e2e:file -- e2e/_shared/lobby.e2e.ts --grep "Dice Throne 直达链接会直接打开详情弹窗"` 未进入业务测试，阻塞于本机全局重任务门禁：可用内存 `0.52GB < 1.5GB`。
- 线上 `index-Cwa4ezpp.js(.map)` 当前返回 SPA HTML fallback，不能用于压缩堆栈反查源码。

