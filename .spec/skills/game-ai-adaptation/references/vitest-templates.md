# Game AI Adaptation 测试合同

本文件只列 AI 修复必须锁住的测试事实。新增测试优先补到现有相关文件，不新建散落模板文件：

- 引擎 watchdog：按行为合同选择 `src/engine/transport/__tests__/onlineAiWatchdog*.test.ts`、`src/engine/transport/__tests__/onlineAiImmediateServerAi.test.ts` 或 `src/engine/transport/__tests__/onlineAiUnsatisfiableInteractionRecovery.test.ts`。
- 游戏基础命令：`src/games/<gameId>/__tests__/basic-commands-coverage.test.ts`。
- 交互 / 响应窗口：对应游戏现有 prompt / response / interaction 测试。
- 阶段链路：对应游戏现有 flow / phase / command-chain 测试。

## 必测场景

| 场景 | 构造事实 | 必须断言 |
| --- | --- | --- |
| human 当前回合 | 当前玩家是 human，human 处在自己的响应或选择窗口 | watchdog 不发 `RESPONSE_PASS`、`SYS_RESPONSE_WINDOW_FORCE_CLOSE`、`ADVANCE_PHASE`；不记录 AI 误报 |
| AI 当前阶段 + human responder | active player 是 AI，response window 当前 responder 是 human，human 有真实可响应场景 | 先 `SYS_RESPONSE_WINDOW_FORCE_CLOSE`，后续才允许 advance / end-phase；不得替 human 发 `RESPONSE_PASS` |
| AI 自己是 responder | 当前 responder 是 AI，存在合法响应或可跳过 | AI 只发合法响应或 `RESPONSE_PASS`；response window 最终关闭或推进 |
| 并列合法动作 | 同一规则状态下同时存在介入动作和确认 / 跳过 / done 收口动作 | AI legal actions 同时保留两类动作；去掉介入条件后只移除介入动作，不移除合法收口 |
| 已确认阶段 | AI 已确认或应等待下一阶段 | legal actions 不再包含会重开上一阶段窗口的动作；若应推进，得到 advance / end-phase |
| 无解交互 | options 为空、全部 disabled、`min` 不可达或目标失效 | AI 返回 cancel / pass / skip 之一，并带 `empty-options`、`all-options-disabled` 或 `min-selection-unreachable` 诊断 |
| 重复动作循环 | 最近动作形成 repeat / alternating pattern，当前 seat 是 AI | guard / watchdog 给出正确打断原因，并推进离开当前卡死状态；不影响 human seat |
| hidden interaction | shared state 没有 `interaction.current`，但 AI seat 的 `playerView` 有 current 或 `isBlocked` | 没有 seat view 时识别不到；有 seat view 时能诊断并产生合法收口 |

## E2E 升级条件

以下风险不能只靠单测收口，必须补代表性真实入口 E2E：

- 页面消费路径可能和领域测试不同。
- hidden interaction 只在特定 seat view 下出现。
- response-window 会影响真人 / AI 权限边界。
- 用户原始问题是卡死、重复窗口、让过后重触发或 AI 行动节奏异常。

E2E 前态必须显示真实玩家可理解的响应入口、选择入口或等待状态；后态必须同时证明窗口消失、阶段推进或控制权交还。只断言内部状态字段不够。

## 禁止

- 用 UI 按钮数量当 AI legal actions 真相。
- 用真人 E2E 能点替代 AI 合法动作枚举。
- 用空 options 场景通过证明真实可响应场景安全。
- 用 watchdog 强推通过掩盖事件源或 AI 决策层的无解交互。
