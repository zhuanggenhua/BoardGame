# DiceThrone AI 右侧奖励骰确认卡死修复证据（2026-08-15）

## 结论等级

- 结论：`代表性在线链路已验证`
- 对象：DiceThrone AI 面对右侧 2D 奖励骰盘 `dt:bonus-dice` 等待普通确认时的自动收口。
- 当前边界：本轮验证到本地 AI legal actions、在线共享视角、服务端 watchdog 候选和 1 条浏览器 E2E；不代表已部署生产，也不代表所有 DiceThrone AI 长链都已全量重跑。

## 原始症状

- 用户原话目标：AI 现在不会确认奖励骰，直接卡死。
- 保真断言：当奖励骰已经停在右侧骰盘等待普通确认时，AI 应执行“确认奖励骰”结算命令；不能把该交互当成未知交互取消，也不能返回空动作停住。

## 根因分层

| 层级 | 本轮证据 |
| --- | --- |
| 现实故障现象 | AI 面对右侧奖励骰确认态无法继续，玩家看到流程停在奖励骰待确认。 |
| 直接触发条件 | `sys.interaction.current.kind === 'dt:bonus-dice'` 时，AI 和在线 watchdog 都会先看到一个当前交互。 |
| 错误执行动作 | 本地 AI 曾把 `dt:bonus-dice` 当成未支持交互；在线 watchdog 又会在“禁止强制确认奖励骰”的保护返回空后停止，不再落到 DiceThrone 专用合法确认。 |
| 根本机制 | 右侧奖励骰从中间特写迁移到右侧普通确认后，玩家 UI 合同变了，但 AI/自动玩家闭环没有同步更新：本地 AI 的 interaction 分流没把 `dt:bonus-dice` 转给奖励骰确认动作，在线恢复链也没在 visible interaction 不可强制时继续走 seat legal-only 的 `SKIP_BONUS_DICE_REROLL`。 |

## 本轮改动

| 文件 | 改动 | 现实效果 |
| --- | --- | --- |
| `.spec/skills/game-ai-adaptation/SKILL.md` | 增加“UI 交互合同变更必须同步审查 AI 闭环”原则。 | 后续确认入口、结果层或 UI 承载物迁移时，不能只证明真人能点。 |
| `.spec/knowledge/standards/ui-change-gates.md` | UI 覆盖矩阵增加 `AI / 自动玩家是否受影响` 要求。 | UI 门禁负责把交互变化路由到 AI workflow。 |
| `src/games/dicethrone/ai.ts` | `dt:bonus-dice` 当前交互改走奖励骰动作构造；在线决策者/可见性识别共享态奖励骰确认。 | AI 能枚举并执行 `SKIP_BONUS_DICE_REROLL`，不会被 stale private overlay 挡住。 |
| `src/engine/transport/onlineAiRecovery.ts` | visible interaction 无法生成强制恢复命令时，继续尝试游戏配置的 seat legal-only recovery。 | `dt:bonus-dice` 不会被错误强制取消，但 displayOnly 普通确认仍能由 DiceThrone 专用合法命令收口。 |
| `src/engine/transport/__tests__/server.test.ts` | 新增 visible displayOnly `dt:bonus-dice` watchdog 回归测试，并让测试 helper 实际写入 pending settlement。 | 锁住“可见右侧奖励骰确认态 -> 服务端生成合法确认候选”的服务端层行为。 |
| `src/pages/__tests__/matchSeatValidation.test.ts` | 新增在线共享态 + stale private overlay 下的 AI 决策测试。 | 锁住在线 AI 不因旧私有视图卡死，能基于共享态确认奖励骰。 |
| `e2e/dicethrone/dicethrone-ai-response-window.e2e.ts` | 新增浏览器 E2E：注入右侧奖励骰确认态，等待在线 AI 自动确认并清理 pending / interaction；构造态清空手牌/牌库避免主阶段牌污染目标。 | 从真实页面和在线服务端循环验证 AI 确认右侧奖励骰后，骰盘进入 settled replay 状态。 |

## AI-only guard

- 只在当前交互属于该 AI seat 后处理：`current.playerId === playerId`。
- 奖励骰动作仍复用领域校验：pending settlement 必须存在、必须是当前奖励骰、命令玩家必须是 `settlement.attackerId`。
- `displayOnly: false` 的可重掷奖励骰仍不走 watchdog 强制确认，避免把可选择重掷的窗口静默跳过。
- 若同一状态仍有响应窗口或 token 响应，AI 仍先走响应动作，不提前确认奖励骰。
- 服务端候选检查只对 AI seat 生效；human seat 不会被 watchdog 代点确认。

## 首跑失败证据

- 本地 AI 首跑失败：`dt:bonus-dice` 只产出 `interaction-cancel` / `SYS_INTERACTION_CANCEL`，没有产出 `skip-bonus-dice-reroll` / `SKIP_BONUS_DICE_REROLL`。
- 浏览器 E2E 首跑失败：在线 AI 没有清理 `pendingBonusDiceSettlement` 和 `sys.interaction.current`，右侧奖励骰确认态保持 `open`。
- E2E 构造态二次修正：第一次 E2E 修复后曾被 Monk 初始手牌中的 `card-enlightenment` 污染，AI 抢先执行普通主阶段牌并生成另一颗奖励骰；已将代表态手牌/牌库/弃牌堆清空，让该用例只验证右侧奖励骰确认。

## 验证证据

- 命令：`npx vitest run src/games/dicethrone/__tests__/basic-commands-coverage.test.ts -t "奖励骰|bonus|右侧奖励骰|displayOnly"`
  - 结果：`7 passed`。
- 命令：`npx vitest run src/engine/transport/__tests__/server.test.ts -t "displayOnly dt:bonus-dice|可见 dt:bonus-dice|displayOnly pendingBonusDiceSettlement|遗留 AI displayOnly"`
  - 结果：`5 passed`。
- 命令：`npx vitest run src/pages/__tests__/matchSeatValidation.test.ts -t "DiceThrone 右侧奖励骰普通确认应允许在线 AI 基于共享状态收口"`
  - 结果：`1 passed`。
- 命令：`$env:PW_E2E_SERVICE_REUSE='isolated'; node scripts/infra/run-e2e-command.mjs ci e2e/dicethrone/dicethrone-ai-response-window.e2e.ts -g "在线 AI: 右侧奖励骰确认态应自动确认并释放交互"`
  - 结果：`1 passed`。
- 命令：`npx eslint src/games/dicethrone/ai.ts src/engine/transport/onlineAiRecovery.ts src/engine/transport/__tests__/server.test.ts src/pages/__tests__/matchSeatValidation.test.ts e2e/dicethrone/dicethrone-ai-response-window.e2e.ts`
  - 结果：`0 errors`；该 E2E 文件仍有既有 warning。
- 命令：`npx tsc --noEmit --pretty false --incremental false`
  - 结果：通过。
- 命令：`npm run spec:lint`
  - 结果：`spec-lint: OK`。

## 同类扩审记录

- 搜索入口：`rg "dt:bonus-dice|pendingBonusDiceSettlement|SKIP_BONUS_DICE_REROLL|buildBonusDiceActions" src/games/dicethrone e2e/dicethrone`
- 命中判断：
  - 真人右侧确认入口走 `Board.tsx` 的 `settleRightTrayBonusDice()`，本来就是 `SKIP_BONUS_DICE_REROLL`。
  - 领域执行与校验已支持 `SKIP_BONUS_DICE_REROLL` 清理奖励骰和当前交互。
  - 失效点集中在 AI/在线恢复消费者：`dt:bonus-dice` 被 interaction 分流和 watchdog 强制恢复保护挡住。
- 本轮覆盖：
  - 本地 AI：`basic-commands-coverage.test.ts`。
  - 在线共享态：`matchSeatValidation.test.ts`。
  - 服务端 watchdog：`server.test.ts`。
  - 浏览器代表链：`dicethrone-ai-response-window.e2e.ts`。

## 对外口径

- 允许说：AI 右侧奖励骰确认卡死点已修复；本地 AI、在线共享态、服务端 watchdog 和代表性浏览器 E2E 均已通过。
- 禁止说：DiceThrone 所有 AI / 所有奖励骰 / 所有临时骰 / 生产反馈已经全量收口；本轮只覆盖右侧奖励骰确认这条代表链和直接相邻消费者。
