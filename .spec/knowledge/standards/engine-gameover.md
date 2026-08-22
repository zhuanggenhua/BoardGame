---
name: engine-gameover
description: 游戏结束标准：胜负判定、终局状态和传输收口——改 gameover 流程时查
metadata:
  type: doc
  status: 已交付
---

# 游戏结束检测规范

## 目标

游戏结束结果统一由管线写入 `sys.gameover`。Board、服务端、测试和交互裁决都读取这个字段，不再各自重新判断终局。

## 合同

- 每次命令成功执行后，`executePipeline` 调用 `domain.isGameOver(core)`。
- 检测结果写入 `state.sys.gameover`；未结束时保持 undefined。
- `GameOverResult` 至少能表达单胜者、多胜者、平局和分数。
- 服务端只读取管线结果；检测到新终局后更新 match metadata、持久化并触发终局回调。

## 各层读取

| 层 | 正确来源 | 禁止 |
| --- | --- | --- |
| Board | `G.sys.gameover` | `G.core.gameover`、`ctx.gameover` |
| 服务端 | `result.state.sys.gameover` | 再次调用 `isGameOver()` |
| 测试 | `state.sys.gameover` | `state.core.gameover` |
| 交互裁决 | `state.sys.gameover` | 私读 core 里的终局字段 |

## 游戏层职责

每个游戏只在 `DomainCore.isGameOver` 中实现胜负检测，返回终局结果或 undefined。core 可以保留 `gameResult` 等中间字段供检测函数读取，但 UI、服务端和测试不得把它们当最终终局来源。

## 禁止项

- 禁止在 core 状态中新增名为 `gameover` 的最终字段。
- 禁止 Board 或服务端绕过 `sys.gameover` 自己判定终局。
- 禁止用 UI 弹窗、日志或胜利文案替代 metadata 和 `sys.gameover` 验收。
