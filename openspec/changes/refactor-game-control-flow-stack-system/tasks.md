## 1. 引擎层统一控制流重构
- [x] 1.1 把 `src/engine/systems/resolutionStack.ts` 从 block gate 升级为真正的 resolution frame driver
- [x] 1.2 为 resolution frame 增加 parent/child 嵌套恢复、显式顺序、顺时针响应轮、deferred follow-up 所有权
- [x] 1.3 收紧 `InteractionSystem` / `ResponseWindowSystem` / `FlowSystem` 边界，使其围绕同一 frame 主链协作
- [x] 1.4 为 blocking UI 提供稳定 owner 映射，保证 modal foreground 与业务 owner 对齐

## 2. 大杀四方迁移
- [x] 2.1 用统一 frame driver 替换 `smashupReactionSession` / `smashupReactionStack` 的主链职责
- [x] 2.2 把计分链、嵌套本体恢复、强制触发排序、顺时针可选响应轮迁到统一控制流
- [x] 2.3 把 deferred post-scoring events / actions 收束到 frame 所有权
- [x] 2.4 修复“选择结算顺序”中的 stale trigger / stale target 仍可点击的问题

## 3. 王权骰铸对齐 + 历史反模式登记
- [x] 3.1 对齐王权骰铸 token response、selectPlayer、choice 等 blocking modal 的前台 ownership 与恢复顺序
- [x] 3.2 确保王权骰铸的业务续链不再依赖 modal close 作为收口信号
- [x] 3.3 在 spec / design 中把 SummonerWars 的 route / adapter 桥接登记为历史反模式与 deferred migration，不改实现

## 4. 验证与回归
- [x] 4.1 运行 OpenSpec 验证：`openspec validate refactor-game-control-flow-stack-system --strict --no-interactive`
- [x] 4.2 运行引擎层与定向逻辑测试，覆盖 resolution frame parent/child 恢复、SmashUp 复杂结算链、DiceThrone blocking modal ownership
- [x] 4.3 运行王权骰铸强制验收用例：`e2e/dicethrone/dicethrone-simple-start.e2e.ts` 中 The Law 4 人多目标场景，以及 `e2e/dicethrone-status-interaction-complete.e2e.ts` 的 modal stack / token response 场景
- [x] 4.4 运行大杀四方强制验收用例：`e2e/smashup/smashup-complex-multi-base-scoring.e2e.ts`、`e2e/smashup/smashup-afterscoring-simple-complete.e2e.ts`、`e2e/smashup/smashup-multi-base-scoring-complete.e2e.ts`
