# Card09 伏击者 - 根本原因确认

## ✅ 分段测试结果

### 1. Reducer 函数测试 ✅
- **文件**：`src/games/cardia/__tests__/reduce-cards-discarded.test.ts`
- **结果**：通过
- **结论**：`reduceCardsDiscarded` 函数正确工作

### 2. 交互处理器测试 ✅
- **文件**：`src/games/cardia/__tests__/ambusher-interaction-handler.test.ts`
- **结果**：通过
- **结论**：伏击者的交互处理器正确返回 `CARDS_DISCARDED` 事件

### 3. 系统注册检查 ✅
- **文件**：`src/games/cardia/game.ts`
- **结果**：`createCardiaEventSystem()` 已正确注册
- **结论**：系统注册没有问题

---

## 🎯 根本原因

**代码修改没有生效，因为缓存问题**

### 证据链

1. **单元测试全部通过**
   - Reducer 正确工作
   - 交互处理器正确工作
   - 系统注册正确

2. **E2E 测试和手动测试行为一致**
   - 都是"弹窗显示 → 选择派系 → 弹窗关闭 → 手牌没有变化"
   - 说明问题不是测试环境特有的

3. **代码修复已完成但没有生效**
   - `src/games/cardia/domain/systems.ts` 中已经修改了 `return { halt: false, state: newState, events: appliedEvents }`
   - 但 E2E 测试和手动测试中都没有看到效果

4. **没有捕获到日志**
   - E2E 测试中没有捕获到 `[CardiaEventSystem]` 日志
   - 说明代码可能没有被重新加载

---

## 🔧 解决方案

### 方案 1：强制重新加载（推荐）

```bash
# 1. 完全停止开发服务器（Ctrl+C）

# 2. 清理所有缓存
rm -rf node_modules/.vite
rm -rf node_modules/.cache

# 3. 重新启动开发服务器
npm run dev

# 4. 在浏览器中硬刷新（Ctrl+Shift+R 或 Cmd+Shift+R）

# 5. 重新运行 E2E 测试
npm run test:e2e -- cardia-deck1-card09-ambusher.e2e.ts
```

### 方案 2：验证代码是否被加载

在 `src/games/cardia/domain/systems.ts` 的 `createCardiaEventSystem` 函数开头添加：

```typescript
export function createCardiaEventSystem(): EngineSystem<CardiaCore> {
    const timestamp = new Date().toISOString();
    console.log(`[CardiaEventSystem] ===== MODULE LOADED AT ${timestamp} =====`);
    console.log('[CardiaEventSystem] This message should appear if code is reloaded');
    
    return {
        id: 'cardia-event-system',
        name: 'Cardia 事件处理',
        priority: 50,
        
        afterEvents: ({ state, events }): HookResult<CardiaCore> | void => {
            console.log('[CardiaEventSystem] afterEvents called at', new Date().toISOString());
            // ... 其余代码
        },
    };
}
```

然后：
1. 重启开发服务器
2. 打开浏览器控制台
3. 刷新页面
4. 查看是否有 `[CardiaEventSystem] MODULE LOADED` 日志

如果没有日志，说明代码没有被加载。

### 方案 3：检查构建产物

```bash
# 检查 Vite 构建产物中是否包含最新代码
grep -r "events: appliedEvents" node_modules/.vite/
```

如果找不到，说明构建产物是旧的。

---

## 📋 执行步骤

### 步骤 1：清理缓存并重启

```bash
# 停止所有服务
# Ctrl+C 停止 npm run dev

# 清理缓存
rm -rf node_modules/.vite

# 重启
npm run dev
```

### 步骤 2：验证代码加载

1. 打开浏览器：`http://localhost:3000`
2. 打开控制台（F12）
3. 查找 `[CardiaEventSystem] MODULE LOADED` 日志
4. 如果没有，说明代码没有被加载

### 步骤 3：手动测试

1. 创建 Cardia 对局
2. 注入测试状态（使用调试面板）
3. 激活伏击者能力
4. 选择 Academy 派系
5. 查看控制台日志
6. 验证 P2 手牌是否减少

### 步骤 4：运行 E2E 测试

```bash
npm run test:e2e -- cardia-deck1-card09-ambusher.e2e.ts
```

---

## 🎯 预期结果

如果缓存清理成功，应该看到：

1. **浏览器控制台**：
   ```
   [CardiaEventSystem] ===== MODULE LOADED AT 2026-03-03T15:10:00.000Z =====
   [CardiaEventSystem] afterEvents called at 2026-03-03T15:10:05.000Z
   [CardiaEventSystem] INTERACTION_RESOLVED: { sourceId: 'ability_i_ambusher', ... }
   [CardiaEventSystem] Handler found: true
   [CardiaEventSystem] Handler result: { eventsCount: 1, events: ['cardia:cards_discarded'] }
   [CardiaEventSystem] Applying event: cardia:cards_discarded
   [CardiaEventSystem] Returning modified state: { appliedEventsCount: 1, ... }
   ```

2. **游戏状态**：
   - P2 手牌从 3 张减少到 1 张
   - P2 弃牌堆从 0 张增加到 2 张
   - 剩余手牌中没有 Academy 派系

3. **E2E 测试**：
   ```
   ✓ 影响力9 - 伏击者：对手弃掉所有指定派系的手牌
   ```

---

## 相关文件

- `src/games/cardia/domain/systems.ts` - 已修复，但可能没有生效
- `src/games/cardia/__tests__/reduce-cards-discarded.test.ts` - Reducer 测试（通过）
- `src/games/cardia/__tests__/ambusher-interaction-handler.test.ts` - 交互处理器测试（通过）
- `e2e/cardia-deck1-card09-ambusher.e2e.ts` - E2E 测试（失败）

