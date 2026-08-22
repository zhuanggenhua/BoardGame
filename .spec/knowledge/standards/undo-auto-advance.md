---
name: undo-auto-advance
description: 撤回与自动推进标准：撤回窗口、自动阶段和状态恢复——改 undo 或自动推进时查
metadata:
  type: doc
  status: 已交付
---

# 撤回后自动推进规范

撤回是恢复到过去某个时刻，不是产生新的游戏进程。撤回后必须停留在恢复阶段，等待玩家下一次手动操作。

## 核心规则

- 撤回后不得自动推进到下一阶段。
- 撤回后不得自动执行抽牌、结算、阶段切换或其它游戏逻辑。
- 撤回恢复状态后，`onAutoContinueCheck` 不得立即触发自动推进。
- UI 必须显示恢复后的阶段和状态，并等待玩家手动命令。

## 权威机制

- 引擎层 UndoSystem 恢复快照时设置 `state.sys.undo.restoredRandomCursor`。
- FlowSystem 在 `afterEvents` 中看到该标记时，直接跳过自动推进检查。
- UndoSystem 在下一个会产生快照的命令执行前清理该标记。
- 游戏层 `onAutoContinueCheck` 不需要也不应该重复检查撤回标记。

## 职责边界

- 该守卫属于引擎层通用能力，不是每个游戏的私有逻辑。
- 游戏层只写正常流程的自动推进条件。
- 如果某个游戏在 `onAutoContinueCheck` 里手写撤回标记判断，应视为历史重复逻辑；改相关区域时优先删除或迁回引擎合同。
- UndoSystem 不能阻止其它系统的 `afterEvents` 执行；可靠拦截点在 FlowSystem。

## 测试门槛

改 undo、FlowSystem、自动推进或阶段恢复时，至少覆盖：

- 撤回到玩家操作阶段后，不自动推进。
- 撤回到自动阶段后，不自动推进。
- 撤回到战斗、选择、setup 或等价阻塞阶段后，不自动推进。
- 撤回后执行下一条普通命令时，`restoredRandomCursor` 被清理。
- 清理后，正常自动推进逻辑恢复。

测试断言看现实结果：撤回后的阶段、当前玩家、活动 interaction / response window 和 undo 标记状态。不要只断言命令通过。

## 排查口径

- 如果撤回后发生自动推进，先查 FlowSystem 是否绕过了 `restoredRandomCursor`。
- 如果撤回后永远不再自动推进，先查下一条快照命令前标记是否被清理。
- 如果只有某个游戏异常，先查该游戏是否在自动推进 hook 中复制了撤回守卫、手工改 sys，或把流程控制状态塞进业务数据。

## 相关入口

- [`e2e-verification`](e2e-verification.md)：撤回相关真实入口验收。
- [`engine-systems`](engine-systems.md)：Flow / Undo / 系统状态边界。
- `src/engine/systems/UndoSystem.ts`：撤回标记设置与清理。
- `src/engine/systems/FlowSystem.ts`：自动推进拦截点。
