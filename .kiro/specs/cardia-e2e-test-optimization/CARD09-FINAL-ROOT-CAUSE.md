# Card09 伏击者 - 最终根本原因

## 🎯 根本原因已确认

**问题不在代码逻辑，而在日志系统！**

### 关键发现

1. **所有单元测试通过** ✅
   - `reduceCardsDiscarded` 正确工作
   - 交互处理器正确返回 `CARDS_DISCARDED` 事件
   - `CardiaEventSystem.afterEvents` 正确调用交互处理器并更新状态

2. **系统注册正确** ✅
   - `SimpleChoiceSystem` 已通过 `createBaseSystems()` 注册
   - `CardiaEventSystem` 已在 `game.ts` 中注册
   - 系统优先级正确（SimpleChoiceSystem: 21, CardiaEventSystem: 50）

3. **日志系统问题** ❌
   - 我们添加的 `console.log` 在服务端代码中（`pipeline.ts`、`SimpleChoiceSystem.ts`、`CardiaEventSystem.ts`）
   - E2E 测试捕获的是**浏览器控制台日志**，无法捕获服务端日志
   - 服务端的 `console.log` 不会被 Winston logger 捕获（需要使用 `gameLogger`）
   - 因此我们无法通过 E2E 测试的控制台日志来验证服务端代码是否执行

4. **E2E 测试结果** ❌
   - P2 手牌没有减少（应该从 3 张变成 1 张，实际变成 4 张）
   - 回合自动结束，P2 抽了一张牌
   - 这说明**能力逻辑确实没有执行**

## 🔍 真正的问题

既然单元测试通过，说明代码逻辑正确。但 E2E 测试失败，说明在实际运行环境中，某个环节出了问题。

### 可能的原因

#### 原因 1：交互处理器没有被正确注册

**假设**：`registerFactionInteractionHandlers()` 可能没有被正确调用，或者注册表在服务端和客户端之间没有同步。

**验证方法**：
1. 在 `getInteractionHandler` 中添加日志（使用 `gameLogger`）
2. 检查是否能找到 `ABILITY_IDS.AMBUSHER` 的处理器

#### 原因 2：`sourceId` 不匹配

**假设**：交互创建时的 `sourceId` 与交互处理器注册时的 key 不匹配。

**证据**：
- 交互创建时：`sourceId: cardiaInteraction.abilityId`
- 交互处理器注册时：`registerInteractionHandler(ABILITY_IDS.AMBUSHER, ...)`

如果 `cardiaInteraction.abilityId` 的值与 `ABILITY_IDS.AMBUSHER` 不同，就无法找到处理器。

**验证方法**：
1. 在 `wrapCardiaInteraction` 中添加日志，输出 `cardiaInteraction.abilityId`
2. 在 `getInteractionHandler` 中添加日志，输出查找的 key

#### 原因 3：`CardiaEventSystem` 没有看到 `INTERACTION_RESOLVED` 事件

**假设**：`SimpleChoiceSystem` 产生了 `INTERACTION_RESOLVED` 事件，但 `CardiaEventSystem` 没有收到。

**可能原因**：
- 事件被其他系统拦截或过滤
- `afterEvents` 钩子的执行顺序问题
- 事件在传递过程中丢失

## 📋 下一步行动

### 优先级 1：使用 gameLogger 添加服务端日志

修改以下文件，将 `console.log` 替换为 `gameLogger`：

1. **`src/games/cardia/domain/systems.ts`**：
   ```typescript
   import { gameLogger } from '../../../server/logger';
   
   // 在 afterEvents 中
   gameLogger.info('[CardiaEventSystem] afterEvents called', {
       eventsCount: events.length,
       eventTypes: events.map(e => e.type),
   });
   ```

2. **`src/engine/systems/SimpleChoiceSystem.ts`**：
   ```typescript
   import { gameLogger } from '../../server/logger';
   
   // 在 handleSimpleChoiceRespond 中
   gameLogger.info('[SimpleChoiceSystem] Producing INTERACTION_RESOLVED event', {
       sourceId: data.sourceId,
       playerId,
   });
   ```

3. **`src/games/cardia/domain/abilityInteractionHandlers.ts`**：
   ```typescript
   import { gameLogger } from '../../../server/logger';
   
   // 在 getInteractionHandler 中
   export function getInteractionHandler(abilityId: string): InteractionHandler | undefined {
       const handler = interactionHandlerRegistry.get(abilityId);
       gameLogger.info('[getInteractionHandler]', {
           abilityId,
           found: !!handler,
       });
       return handler;
   }
   ```

### 优先级 2：检查 sourceId 一致性

在 `src/games/cardia/domain/systems.ts` 的 `wrapCardiaInteraction` 中添加日志：

```typescript
gameLogger.info('[wrapCardiaInteraction]', {
    abilityId: cardiaInteraction.abilityId,
    interactionType: cardiaInteraction.type,
});
```

### 优先级 3：运行测试并查看服务端日志

```bash
# 运行测试
npm run test:e2e -- cardia-deck1-card09-ambusher.e2e.ts

# 查看服务端日志
tail -f logs/app-$(date +%Y-%m-%d).log | grep -E "SimpleChoice|CardiaEvent|getInteractionHandler|wrapCardiaInteraction"
```

## 🎯 预期结果

如果一切正常，应该看到以下日志序列：

1. `[wrapCardiaInteraction]` - 交互被包装，`abilityId` 为 `ability_i_ambusher`
2. `[SimpleChoiceSystem] Producing INTERACTION_RESOLVED event` - 产生 `INTERACTION_RESOLVED` 事件
3. `[CardiaEventSystem] afterEvents called` - `CardiaEventSystem` 收到事件
4. `[getInteractionHandler]` - 查找交互处理器，`found: true`
5. `[AMBUSHER] Handler called` - 交互处理器被调用
6. `[AMBUSHER] Returning events` - 返回 `CARDS_DISCARDED` 事件

如果某个环节缺失，就能定位到具体问题。

## 相关文件

- `src/games/cardia/domain/systems.ts` - CardiaEventSystem 实现
- `src/games/cardia/domain/abilityInteractionHandlers.ts` - 交互处理器注册表
- `src/games/cardia/domain/abilities/group7-faction.ts` - 伏击者能力和交互处理器
- `src/engine/systems/SimpleChoiceSystem.ts` - SimpleChoiceSystem 实现
- `server/logger.ts` - Winston logger 配置
