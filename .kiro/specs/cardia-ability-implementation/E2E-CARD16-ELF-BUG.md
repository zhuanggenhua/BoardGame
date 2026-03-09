# Card16 (Elf) E2E Test - Bug Report

## 测试状态
❌ **失败** - 能力触发正确，但游戏未结束

## Bug 描述

### 症状
- 精灵能力按钮正确出现（`trigger: 'onLose'` 触发条件正确）
- 点击按钮后，`GAME_WON` 事件被发射
- 但游戏没有结束（`sys.gameover.isGameOver` 仍为 `undefined`）

### 根本原因
精灵能力的实现存在架构不一致：

1. **能力执行器**（`abilities/group6-special.ts`）：
   ```typescript
   abilityExecutorRegistry.register(ABILITY_IDS.ELF, (ctx) => {
       return {
           events: [
               {
                   type: CARDIA_EVENTS.GAME_WON,
                   payload: { winnerId: ctx.playerId, reason: 'elf' },
               }
           ],
       };
   });
   ```
   - 发射 `GAME_WON` 事件

2. **Reducer**（`domain/reduce.ts`）：
   ```typescript
   case CARDIA_EVENTS.GAME_WON:
       return reduceGameWon(core, event);
   
   function reduceGameWon(core, event) {
       // 游戏胜利事件不改变核心状态
       // 游戏结束由 sys.gameover 系统处理
       return core;
   }
   ```
   - `GAME_WON` 事件不修改 core 状态
   - 注释说"由 sys.gameover 系统处理"

3. **系统层**（`domain/systems.ts`）：
   - ❌ **没有任何系统处理 `GAME_WON` 事件**
   - 没有将 `GAME_WON` 事件转换为 `sys.gameover` 状态

4. **isGameOver 函数**（`domain/index.ts`）：
   ```typescript
   // 精灵能力：如果激活了精灵能力且有5个印戒，立即获胜
   const hasElfAbility = core.ongoingAbilities.some(
       a => a.abilityId === ABILITY_IDS.ELF && a.playerId === playerId
   );
   if (hasElfAbility && totalSignets >= 5) {
       return { winner: playerId };
   }
   ```
   - ❌ **逻辑错误**：精灵是即时能力（`isInstant: true`），不会被添加到 `core.ongoingAbilities`
   - ❌ **条件错误**：精灵能力是"失败时直接获胜"（`trigger: 'onLose'`），不需要5个印戒

### 能力定义（正确）
```typescript
// domain/abilityRegistry.ts
abilityRegistry.register({
    id: ABILITY_IDS.ELF,
    name: 'abilities.elf.name',
    description: 'abilities.elf.description',
    trigger: 'onLose',  // ✅ 失败时触发
    isInstant: true,    // ✅ 即时能力
    requiresMarker: false,
    effects: [
        { type: 'win', target: 'self' }  // ✅ 直接获胜
    ],
});
```

## 修复方案

### 方案 1：添加 GameOverSystem（推荐）
在 `domain/systems.ts` 中添加一个系统处理 `GAME_WON` 事件：

```typescript
export function createGameOverSystem(): EngineSystem<CardiaCore> {
    return {
        id: 'cardia-gameover-system',
        name: 'Cardia 游戏结束处理',
        priority: 100, // 高优先级，确保最后执行

        afterEvents: ({ state, events }): HookResult<CardiaCore> | void => {
            for (const event of events) {
                if (event.type === CARDIA_EVENTS.GAME_WON) {
                    const payload = event.payload as { winnerId: string; reason: string };
                    
                    // 设置 sys.gameover
                    return {
                        halt: false,
                        state: {
                            ...state,
                            sys: {
                                ...state.sys,
                                gameover: {
                                    isGameOver: true,
                                    winnerId: payload.winnerId,
                                    reason: payload.reason,
                                },
                            },
                        },
                        events: [],
                    };
                }
            }
        },
    };
}
```

然后在 `game.ts` 中注册：
```typescript
systems: [
    createCardiaEventSystem(),
    createGameOverSystem(),  // 新增
],
```

### 方案 2：修改 isGameOver 函数
删除精灵能力的检查逻辑（因为精灵能力通过 `GAME_WON` 事件处理，不需要在 `isGameOver` 中检查）。

## 测试场景

### 当前测试（正确）
1. P1 打出精灵（影响力16）
2. P2 打出影响力1 + 修正标记+20（实际影响力21）
3. P1 失败（16 < 21）
4. 精灵能力按钮出现 ✅
5. 点击激活精灵能力 ✅
6. `GAME_WON` 事件发射 ✅
7. 游戏结束，P1 获胜 ❌（当前失败）

### 预期行为
- P1 失败后激活精灵能力
- 游戏立即结束，P1 获胜
- 不需要任何印戒条件

## 相关文件
- `src/games/cardia/domain/abilities/group6-special.ts` - 精灵能力执行器
- `src/games/cardia/domain/abilityRegistry.ts` - 精灵能力定义
- `src/games/cardia/domain/reduce.ts` - `GAME_WON` 事件 reducer
- `src/games/cardia/domain/systems.ts` - 系统配置（缺少 GameOverSystem）
- `src/games/cardia/domain/index.ts` - `isGameOver` 函数（逻辑错误）
- `e2e/cardia-deck1-card16-elf.e2e.ts` - E2E 测试

## 下一步
1. 实现方案 1（添加 GameOverSystem）
2. 或者向用户报告此 bug，等待修复后再继续测试
3. 继续审计其他 E2E 测试（card07, card09, card02）
