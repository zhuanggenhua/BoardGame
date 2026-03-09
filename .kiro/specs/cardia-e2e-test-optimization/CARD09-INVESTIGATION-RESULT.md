# Card09 伏击者 - 调查结果

## 🔍 关键发现

### 1. 没有捕获到日志

**E2E 测试结果**：
```
=== 捕获的浏览器控制台日志 ===
❌ 没有捕获到 [CardiaEventSystem] 日志
```

**原因分析**：
1. `console.log` 在服务端执行，不会输出到浏览器控制台
2. E2E 测试启动的是独立的测试服务器（端口 19000/19001），我们看不到它的终端输出
3. Winston logger 不会捕获 `console.log`，只捕获通过 `logger.info/error` 等方法记录的日志

### 2. 单元测试全部通过

✅ **Reducer 测试通过**：`reduceCardsDiscarded` 函数正确工作
✅ **交互处理器测试通过**：返回正确的 `CARDS_DISCARDED` 事件
✅ **系统注册正确**：`CardiaEventSystem` 已在 `game.ts` 中注册

### 3. E2E 测试失败

❌ **P2 手牌没有减少**：应该从 3 张变成 1 张，实际变成 4 张（回合结束抽了一张牌）
❌ **弃牌堆没有增加**：应该从 0 张变成 2 张，实际仍然是 0 张

## 🎯 问题定位

### 可能的原因

#### 原因 1：交互处理器没有被调用 ⚠️

**假设**：`CardiaEventSystem.afterEvents` 被调用了，但 `getInteractionHandler` 返回 `undefined`

**验证方法**：
1. 在 `getInteractionHandler` 中添加日志
2. 在交互处理器中添加日志（已完成）
3. 使用 Winston logger 而不是 `console.log`

#### 原因 2：`sourceId` 不匹配 ⚠️

**假设**：`INTERACTION_RESOLVED` 事件的 `payload.sourceId` 与注册的 handler ID 不匹配

**验证方法**：
1. 在 `CardiaEventSystem.afterEvents` 中打印 `payload.sourceId`
2. 在 `registerInteractionHandler` 中打印注册的 ID
3. 对比两者是否一致

#### 原因 3：事件没有被广播 ⚠️

**假设**：`CardiaEventSystem` 返回的事件没有被正确广播到客户端

**验证方法**：
1. 在 `GameTransportServer.broadcastState` 中添加日志
2. 检查服务端状态是否正确更新
3. 检查客户端是否接收到状态更新

## 📋 下一步行动

### 方案 A：使用 Winston Logger（推荐）

修改 `src/games/cardia/domain/systems.ts` 和 `src/games/cardia/domain/abilities/group7-faction.ts`，使用 Winston logger：

```typescript
import { gameLogger } from '../../../server/logger';

export function createCardiaEventSystem(): EngineSystem<CardiaCore> {
    return {
        id: 'cardia-event-system',
        name: 'Cardia 事件处理',
        priority: 50,

        afterEvents: ({ state, events }): HookResult<CardiaCore> | void => {
            gameLogger.info('[CardiaEventSystem] afterEvents called', {
                eventsCount: events.length,
                eventTypes: events.map(e => e.type),
            });
            
            // ... 其余代码
        },
    };
}
```

然后查看 `logs/app-2026-03-03.log` 文件。

### 方案 B：手动测试并查看服务端终端输出

1. 启动开发服务器：`npm run dev`
2. 在浏览器中打开游戏
3. 手动执行伏击者能力
4. 查看服务端终端输出（`npm run dev` 的终端）

### 方案 C：简化测试（推荐）

创建一个最小化的单元测试，直接测试 `CardiaEventSystem.afterEvents` 钩子：

```typescript
import { describe, it, expect } from 'vitest';
import { createCardiaEventSystem } from '../domain/systems';
import { INTERACTION_EVENTS } from '../../../engine/systems/InteractionSystem';
import { ABILITY_IDS } from '../domain/ids';

describe('CardiaEventSystem.afterEvents', () => {
    it('应该调用交互处理器并返回事件', () => {
        const system = createCardiaEventSystem();
        
        const state = {
            core: {
                // ... 测试状态
            },
            sys: {
                interaction: { current: null, queue: [] },
                gameover: null,
            },
        };
        
        const events = [
            {
                type: INTERACTION_EVENTS.RESOLVED,
                payload: {
                    sourceId: ABILITY_IDS.AMBUSHER,
                    playerId: '0',
                    value: { faction: 'academy' },
                },
                timestamp: Date.now(),
            },
        ];
        
        const result = system.afterEvents!({
            state,
            events,
            command: { type: 'SYS_INTERACTION_RESPOND', playerId: '0', payload: {} },
            random: { /* ... */ },
            playerIds: ['0', '1'],
        });
        
        expect(result).toBeDefined();
        expect(result!.events).toBeDefined();
        expect(result!.events!.length).toBeGreaterThan(0);
    });
});
```

## 🎯 推荐方案

**优先级 1**：方案 C（简化测试）
- 最快验证问题
- 不需要修改日志系统
- 可以直接调试

**优先级 2**：方案 B（手动测试）
- 可以看到完整的执行流程
- 可以看到服务端终端输出
- 可以验证客户端-服务端同步

**优先级 3**：方案 A（Winston Logger）
- 需要修改多个文件
- 需要重启服务器
- 日志可能很多，难以定位

## 相关文件

- `src/games/cardia/domain/systems.ts` - CardiaEventSystem 实现
- `src/games/cardia/domain/abilities/group7-faction.ts` - 伏击者能力和交互处理器（已添加日志）
- `src/games/cardia/domain/abilityInteractionHandlers.ts` - 交互处理器注册机制
- `e2e/cardia-deck1-card09-ambusher.e2e.ts` - E2E 测试

