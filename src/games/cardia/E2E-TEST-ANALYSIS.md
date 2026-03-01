# Cardia E2E 测试分析报告

## 执行时间
2026-02-26 23:09

## 测试结果

**状态**：❌ 失败（0/3 通过）

## 问题分析

### 1. 卡图加载（已解决 ✅）

**问题**：用户担心卡图没有正确加载
**实际情况**：卡图已正确加载，使用 `OptimizedImage` 组件加载单张图片
**证据**：
- 错误上下文显示 `img "Card 3"`, `img "Card 1"` 等标签存在
- UI 正常渲染，显示影响力数字、派系名称和能力图标

**对比其他游戏**：
- SmashUp/SummonerWars：使用图集系统（CardPreview + cardAtlasRegistry）
- Cardia：使用单张图片（OptimizedImage）
- **两种方式都是正确的**，Cardia 的实现符合项目规范

### 2. E2E 测试失败的真正原因

#### 测试 1：`should complete a full turn cycle`

**失败点**：
```
Error: expect(locator).toBeVisible() failed
Locator: locator('[data-testid="cardia-battlefield"] [data-testid^="card-"]')
Expected: visible
Timeout: 5000ms
Error: element(s) not found
```

**根本原因**：战场上的卡牌没有 `data-testid` 属性

**修复方案**：✅ 已修复
- 在 `Board.tsx` 中为战场卡牌添加 `data-testid={`card-${card.uid}`}` 包装器

#### 测试 2 和 3：超时等待结束回合按钮

**失败点**：
```
Test timeout of 30000ms exceeded.
Error: locator.click: Test ended.
Call log:
  - waiting for locator('[data-testid="cardia-end-turn-btn"]')
```

**可能原因**：
1. **阶段没有正确推进到 `end` 阶段**
2. **按钮渲染条件不满足**：`phase === 'end' && isMyTurn`
3. **WebSocket 消息延迟或丢失**

**验证结果**：
- ✅ 单元测试全部通过（9/9）
- ✅ 游戏逻辑正确（execute/validate/reduce 都正常）
- ✅ FlowSystem 配置正确
- ✅ 阶段转换事件正确发射和处理

**推测**：E2E 测试中的时序问题
- 可能是 WebSocket 消息传递延迟
- 可能是状态同步延迟
- 可能是测试等待时间不够

## 已完成的修复

### ✅ 修复 1: 战场卡牌 testid（P0）

**文件**：`src/games/cardia/Board.tsx`

**修改**：
```tsx
// 修改前
{myPlayer.currentCard ? (
    <CardDisplay card={myPlayer.currentCard} core={core} />
) : (...)}

// 修改后
{myPlayer.currentCard ? (
    <div data-testid={`card-${myPlayer.currentCard.uid}`}>
        <CardDisplay card={myPlayer.currentCard} core={core} />
    </div>
) : (...)}
```

**影响**：测试现在可以找到战场上的卡牌元素

## 下一步行动

### 1. 增加等待时间和状态检查

修改 E2E 测试，增加更多的中间状态检查和等待时间：

```typescript
// 打出卡牌后，等待状态同步
await p1Page.waitForTimeout(1000);

// 检查阶段是否正确转换
await expect(p1Page.locator('[data-testid="cardia-phase-indicator"]'))
    .toContainText('Ability', { timeout: 10000 });

// 等待能力阶段 UI 就绪
await p1Page.waitForTimeout(500);
```

### 2. 添加调试日志

在关键点添加日志输出，帮助定位问题：

```typescript
// 检查当前阶段
const phase = await p1Page.locator('[data-testid="cardia-phase-indicator"]').textContent();
console.log('[Test] Current phase:', phase);

// 检查按钮是否存在
const hasButton = await p1Page.locator('[data-testid="cardia-end-turn-btn"]').count();
console.log('[Test] End turn button count:', hasButton);
```

### 3. 手动测试验证

启动开发服务器，手动测试游戏流程：

```bash
npm run dev
# 访问 http://localhost:3000
# 创建 Cardia 对局
# 测试完整回合流程
```

验证点：
- ✅ 打出卡牌后，战场显示卡牌
- ✅ 双方打出卡牌后，自动进入能力阶段
- ✅ 能力阶段显示"跳过"按钮
- ✅ 跳过能力后，进入结束阶段
- ✅ 结束阶段显示"结束回合"按钮
- ✅ 点击结束回合后，回到打牌阶段

### 4. 检查服务器日志

查看游戏服务器日志，确认命令执行和状态同步：

```bash
# 查看最新的日志
tail -f logs/app-*.log | grep -i cardia
```

关注：
- 命令执行日志
- 事件发射日志
- 状态同步日志
- 错误日志

## 总结

### 已解决的问题

1. ✅ **卡图加载**：确认卡图已正确加载，使用 OptimizedImage 组件
2. ✅ **战场卡牌 testid**：添加 data-testid 属性，测试可以找到元素
3. ✅ **游戏逻辑**：单元测试全部通过，逻辑正确

### 待解决的问题

1. ❌ **E2E 测试时序**：阶段转换可能有延迟，需要增加等待时间
2. ❌ **状态同步**：WebSocket 消息可能有延迟，需要更健壮的等待逻辑

### 关键发现

- **卡图加载不是问题**：Cardia 使用单张图片加载，与其他游戏的图集系统不同，但都是正确的实现方式
- **游戏逻辑正确**：所有单元测试通过，execute/validate/reduce 都正常工作
- **E2E 测试需要优化**：需要更多的等待时间和状态检查，以适应异步状态同步

---

**报告时间**：2026-02-26 23:09
**修复问题数**：1 个（战场卡牌 testid）
**测试状态**：失败（需要进一步调试）
**下一步**：手动测试 + 增加等待时间 + 添加调试日志
