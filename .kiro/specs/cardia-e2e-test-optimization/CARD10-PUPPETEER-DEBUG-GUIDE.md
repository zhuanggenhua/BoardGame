# Card10 傀儡师能力调试指南

## 问题描述
傀儡师（card10）能力激活时前端显示 "pipeline error"，后台日志显示状态对象但没有错误堆栈。

## 已应用的修复

### 修复 1：`reduceCardReplaced` 中使用正确的状态对象
**文件**：`src/games/cardia/domain/reduce.ts` 第 1048 行

**问题**：印戒转移逻辑使用了旧的 `core` 对象而不是更新后的 `newCore`
```typescript
// ❌ 错误
const puppeteerOwnerId = getOpponentId(core, playerId);

// ✅ 正确
const puppeteerOwnerId = getOpponentId(newCore, playerId);
```

**状态**：✅ 已修复

### 修复 2：添加详细的错误日志
**文件**：`src/games/cardia/domain/reduce.ts` 第 809-1120 行

**添加内容**：
- try-catch 包裹整个 `reduceCardReplaced` 函数
- 捕获并打印详细的错误信息（错误对象、堆栈、事件、Core 状态）
- 重新抛出错误以便上层捕获

**状态**：✅ 已添加

## 调试步骤

### 步骤 1：重启服务器
服务端代码（`reduce.ts`）的更改需要重启服务器才能生效。

```bash
# 停止当前服务器（Ctrl+C）
# 重新启动
npm run dev
```

### 步骤 2：清除浏览器缓存
前端代码已重新构建，但浏览器可能缓存了旧版本。

1. 打开浏览器开发者工具（F12）
2. 右键点击刷新按钮
3. 选择"清空缓存并硬性重新加载"

### 步骤 3：重现问题并查看日志

#### 前端日志（浏览器控制台）
1. 打开浏览器开发者工具（F12）
2. 切换到 Console 标签
3. 激活傀儡师能力
4. 查找以下日志：
   - `[Puppeteer] 能力执行器被调用`
   - `[Puppeteer] 准备替换卡牌`
   - `[reduceCardReplaced] 开始处理卡牌替换事件`
   - `[reduceCardReplaced] 发生错误` （如果有错误）

#### 后端日志（终端）
查看运行 `npm run dev` 的终端窗口，查找：
- `[Puppeteer]` 开头的日志
- `[reduceCardReplaced]` 开头的日志
- 错误堆栈信息

#### 生产日志文件
如果在生产环境，查看日志文件：
```bash
# 查看最新的错误日志
tail -100 logs/error-2026-03-04.log

# 查看应用日志
tail -100 logs/app-2026-03-04.log

# 搜索特定关键词
grep -A 20 "puppeteer\|CARD_REPLACED" logs/app-2026-03-04.log
```

### 步骤 4：分析错误信息

#### 如果看到 `[reduceCardReplaced] 发生错误`
错误日志会包含：
1. 错误对象和消息
2. 完整的错误堆栈
3. 触发错误的事件 payload
4. 当前 Core 状态（playerOrder 和 players）

根据错误信息定位问题：
- **TypeError: Cannot read property 'X' of undefined** → 某个对象为 undefined
- **RangeError** → 数组索引越界
- **其他错误** → 查看堆栈定位具体代码行

#### 如果没有看到错误日志
可能的原因：
1. 服务器没有重启（旧代码仍在运行）
2. 浏览器缓存了旧版本前端代码
3. 错误发生在其他地方（不在 `reduceCardReplaced` 中）

### 步骤 5：检查其他可能的问题

#### 检查 1：验证修复是否生效
```bash
# 检查 reduce.ts 中的修复
grep -n "getOpponentId(newCore, playerId)" src/games/cardia/domain/reduce.ts

# 应该看到第 1048 行
```

#### 检查 2：验证能力执行器
```bash
# 检查傀儡师能力执行器是否正确注册
grep -A 10 "ABILITY_IDS.PUPPETEER" src/games/cardia/domain/abilities/group6-special.ts
```

#### 检查 3：验证事件定义
```bash
# 检查 CARD_REPLACED 事件是否正确定义
grep "CARD_REPLACED" src/games/cardia/domain/events.ts
```

## 预期行为

### 正常流程
1. 玩家激活傀儡师能力
2. 前端发送 `cardia:activate_ability` 命令
3. 服务端执行能力执行器
4. 生成 `CARD_REPLACED` 事件
5. `reduceCardReplaced` 处理事件
6. 更新状态并返回
7. 前端收到更新后的状态
8. UI 显示卡牌替换和印戒转移

### 日志输出（正常情况）
```
[Puppeteer] 能力执行器被调用
[Puppeteer] 准备替换卡牌: { oldCard: {...}, newCard: {...}, encounterIndex: 3 }
[reduceCardReplaced] 开始处理卡牌替换事件: { oldCardId: '...', newCardId: '...', ... }
[reduceCardReplaced] 找到卡牌: { oldCard: {...}, newCard: {...} }
[reduceCardReplaced] 查找遭遇记录: { ... }
[reduceCardReplaced] 遭遇结果变化: { oldWinnerId: '1', newWinnerId: '0', ... }
[reduceCardReplaced] 替换完成: { ... }
[reduceCardReplaced] 检查印戒转移条件: { ... }
[reduceCardReplaced] 检测到遭遇结果变化，转移印戒: { ... }
[reduceCardReplaced] 新获胜者是傀儡师的主人: { puppeteerOwnerId: '0', puppeteerCardId: '...' }
[reduceCardReplaced] 印戒转移完成: { toCardId: '...', toPlayerId: '0', signetsAdded: 1, newSignets: 1 }
```

## 如果问题仍然存在

### 收集完整信息
1. 前端控制台的完整日志（截图或复制）
2. 后端终端的完整日志（截图或复制）
3. 生产日志文件的相关部分
4. 游戏状态（使用调试面板导出）

### 可能的其他问题
1. **事件 payload 格式不正确**：检查 `group6-special.ts` 中生成的事件
2. **状态不一致**：检查游戏状态是否符合预期（双方都有卡牌、对手有手牌等）
3. **类型错误**：检查 TypeScript 编译是否有警告
4. **并发问题**：检查是否有多个命令同时执行

### 联系开发者
如果以上步骤都无法解决问题，请提供：
- 完整的错误日志
- 游戏状态快照
- 重现步骤
- 浏览器和操作系统信息
