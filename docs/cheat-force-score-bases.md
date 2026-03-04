# 调试功能：强制有随从的基地立即结算

## 功能说明

这个调试功能可以将所有有随从的基地分上限临时设为 0，从而触发立即结算。这对于测试基地结算逻辑非常有用。

## 使用方法

### 在代码中使用

```typescript
import { CHEAT_COMMANDS } from '../../engine/systems/CheatSystem';

// 在游戏中分发命令
dispatch({
    type: CHEAT_COMMANDS.FORCE_SCORE_BASES_WITH_MINIONS,
    playerId: '0', // 任意玩家 ID
    payload: {},
});
```

### 在调试面板中使用

如果你的游戏有调试面板 UI，可以添加一个按钮：

```tsx
<button
    onClick={() => {
        dispatch({
            type: CHEAT_COMMANDS.FORCE_SCORE_BASES_WITH_MINIONS,
            playerId: currentPlayerId,
            payload: {},
        });
    }}
>
    强制结算有随从的基地
</button>
```

## 工作原理

1. 遍历所有基地
2. 对于每个有随从的基地：
   - 获取基地的原始分上限（breakpoint）
   - 在 `tempBreakpointModifiers` 中设置修正值 = -breakpoint
   - 这样基地的有效分上限就变成了 0
3. 点击"结束回合"后，游戏会自动检测到基地达标并触发结算

## 示例

假设场上有 3 个基地：

- 基地 0：丛林绿洲（breakpoint=12），无随从 → 不修改
- 基地 1：焦油坑（breakpoint=16），有 1 个随从 → 设置 modifier = -16
- 基地 2：忍者道场（breakpoint=18），有 2 个随从 → 设置 modifier = -18

执行命令后，基地 1 和基地 2 的有效分上限都变成 0，点击结束回合即可触发结算。

## 注意事项

- 这个功能只修改 `tempBreakpointModifiers`，不会永久改变基地定义
- 修正值会保留到下次刷新基地或游戏重置
- 只影响有随从的基地，空基地不受影响
- 可以与其他调试命令组合使用

## 测试

测试文件：`src/games/smashup/__tests__/force-score-bases-cheat.test.ts`

运行测试：
```bash
npx vitest run src/games/smashup/__tests__/force-score-bases-cheat.test.ts
```
