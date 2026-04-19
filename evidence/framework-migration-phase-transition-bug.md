# 框架迁移 - 阶段转换 Bug 发现

## 问题描述

使用新的测试框架（`game.setupScene()`）注入状态后，点击"结束回合"按钮无法触发阶段转换。

## 测试结果

```
[TEST] 初始阶段: playCards
[TEST] 点击"结束回合"按钮
[TEST] 点击后阶段: playCards
[TEST] ❌ 阶段没有改变，仍然是 playCards
```

## 测试代码

```typescript
await game.setupScene({
    gameId: 'smashup',
    player0: { 
        hand: [
            { uid: 'card-1', defId: 'wizard_portal', type: 'action' }
        ],
    },
    player1: {},
    bases: [
        { breakpoint: 25, power: 0 }, // 空基地，不会触发计分
    ],
    currentPlayer: '0',
    phase: 'playCards',
});
```

## 根本原因（待确认）

可能的原因：
1. **状态注入不完整**：`game.setupScene()` 可能没有正确设置所有必要的状态字段
2. **阶段转换条件不满足**：SmashUp 的阶段转换可能依赖某些未被注入的状态
3. **命令分发问题**：点击按钮后的命令可能没有正确分发到游戏引擎

## 下一步

1. 检查 SmashUp 的 `FINISH_TURN` 命令处理逻辑
2. 检查 `game.setupScene()` 是否正确设置了所有必要字段
3. 添加日志查看命令分发和阶段转换的详细过程

## 测试文件

- `e2e/smashup-phase-transition-simple.e2e.ts`

## 截图

![初始状态](../test-results/smashup-phase-transition-simple.e2e.ts-简单阶段转换---点击结束回合-chromium/01-initial-state.png)

初始状态显示游戏已正确加载，有 3 个基地和 1 张手牌。

![点击后状态](../test-results/smashup-phase-transition-simple.e2e.ts-简单阶段转换---点击结束回合-chromium/02-after-finish-turn.png)

点击"结束回合"按钮后，阶段仍然是 `playCards`，没有发生转换。
