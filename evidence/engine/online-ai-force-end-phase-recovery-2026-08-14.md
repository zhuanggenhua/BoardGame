# Online AI 强制恢复入口与即时兜底证据 - 2026-08-14

## 原始症状

- 在线 DiceThrone 房间里，房主看不到“强制结束 AI 阶段/回合”按钮。
- AI 没有继续动作时，自动结束 AI 回合也没有及时触发，玩家会看到房间停在 AI 阶段。

## 本轮处理对象

- 用户可见入口：在线房间页全局 HUD 的强制结束 AI 阶段按钮。
- 服务端恢复链：在线 AI 即时执行拿不到合法动作时，是否进入 watchdog 恢复序列。
- 真相来源：当前源码、服务端 transport 单测、房间页 React 集成测试。

## 已确认机制

- 按钮消失的直接机制：房间页 HUD adapter 之前没有把强制恢复 handler 接到 HUD，且在线座位桥接层没有向房间页注册服务端恢复请求 handler。
- 自动恢复缺口：服务端即时 AI 链路在拿不到合法动作时会退出；现在只在明确安全的恢复候选上立即进入恢复序列。
- 防误伤收窄：普通 active-turn 没有合法动作时，不再默认强制 `ADVANCE_PHASE`。必须满足以下任一条件才允许即时强制恢复：
  - 当前是可恢复的 visible interaction、hidden interaction、response window 或 response loop。
  - 当前候选明确带有 `allowForceCommandAfterLegalActionExhausted`。
  - 游戏配置 `onlineAiRecovery.allowForceCommandAfterLegalActionExhausted(...)` 明确允许。

## 可见动作清单

- 可见动作：房主看到并点击强制结束 AI 阶段按钮；AI 防御骰掷骰、确认和阶段交还；玩家看到行动权回到可继续状态。
- 静默动作：客户端向服务端发送强制恢复请求；服务端 ack；watchdog 内部诊断、合法动作缺失判定、无表现变化的阶段推进。
- 下一步提示：恢复成功后由权威状态广播驱动 HUD/棋盘刷新，玩家不需要猜测是否轮到自己。
- 卡死风险：如果按钮入口缺失或即时恢复无授权退出，玩家会留在“等待 AI”状态。

## AI-only 与真人保护

- UI 只在房主且房间存在 AI seat 时显示强制恢复入口。
- 服务端手动强制恢复要求请求者是真人，并校验房主权限。
- 服务端恢复候选只对非真人 seat 生效。
- 即时 fallback 检测到响应队列中有真人 responder 时不会强制推进。
- 普通准备选择、旧浏览器代理 AI 命令、真人目标 seat 都由回归测试覆盖，不允许被即时 fallback 误推进。

## 验证

- `npx vitest run src/pages/__tests__/MatchRoom.onlineIdentity.test.tsx -t "在线 AI 房房主应看到强制结束 AI 阶段按钮" --configLoader native`
  - 结果：1 passed。
- `npx vitest run src/engine/transport/__tests__/server.test.ts -t "非房主不能请求|服务端拒绝不属于|旧浏览器的 __manualAiSeatId|房主点击强制结束 AI 阶段|即时服务端 AI 执行拿不到合法动作且游戏允许" --configLoader native`
  - 结果：5 passed。
- `npx vitest run src/engine/transport/__tests__/server.test.ts -t "DiceThrone 在线普通 AI 应在人类回合 defensiveRoll|即时服务端 AI 执行拿不到合法动作且游戏允许" --configLoader native`
  - 结果：2 passed。
- `npx eslint src/engine/transport/server.ts src/pages/useMatchRoomPageRuntimeModel.ts src/engine/transport/__tests__/server.test.ts src/pages/__tests__/MatchRoom.onlineIdentity.test.tsx`
  - 结果：0 errors。
- `npm run typecheck`
  - 结果：passed。
- `npm run test:ai:decision-view`
  - 结果：4 files passed, 456 tests passed。

## 同类扩审

- 已覆盖房间页 HUD 入口、客户端 transport request、React context、服务端 socket handler、手动强制恢复权限、即时 AI fallback 和 DiceThrone defensiveRoll 自动接续。
- 已验证普通人工准备选择、非房主、真人目标 seat 和旧浏览器代理 AI 命令不会被新的恢复入口越权执行。
