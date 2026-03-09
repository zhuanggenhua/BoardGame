# 重启服务器并测试 Card09

## 步骤 1：停止当前服务器

在终端中按 `Ctrl+C` 停止当前运行的 `npm run dev`

## 步骤 2：清理端口（如果需要）

如果端口被占用，运行：

```bash
npm run test:e2e:cleanup
```

## 步骤 3：重新启动服务器

```bash
npm run dev
```

等待服务器启动完成（看到 "ready in" 或类似消息）

## 步骤 4：测试 Card09

1. 打开两个浏览器窗口
2. 创建在线对局
3. 使用调试面板注入 `CARD09-INJECT-STATE.json` 的状态
4. P1 打出伏击者（影响力 9）
5. P2 打出傀儡师（影响力 10）
6. P1 激活伏击者能力
7. P1 选择 Academy 派系
8. **观察**：
   - 弹窗是否关闭？
   - P2 的 Academy 派系手牌是否被弃掉？
   - 是否有重复弹窗？

## 步骤 5：检查日志

### 浏览器控制台日志

打开浏览器控制台（F12），查找以下日志：

```
[CardiaEventSystem] afterEvents called
[CardiaEventSystem] INTERACTION_RESOLVED
[CardiaEventSystem] Handler found
[CardiaEventSystem] Handler result
[CardiaEventSystem] Applying event
[CardiaEventSystem] Returning modified state
[SimpleChoiceSystem] handleSimpleChoiceRespond
```

### 服务端日志

在项目根目录运行：

```bash
# 查看最新的日志
tail -f logs/app-$(date +%Y-%m-%d).log

# 或者过滤关键词
tail -f logs/app-$(date +%Y-%m-%d).log | grep -E "CardiaEventSystem|SimpleChoiceSystem|INTERACTION_RESOLVED|Ambusher"
```

## 预期结果

### 如果修复成功

**浏览器控制台**：
```
[CardiaEventSystem] afterEvents called: { eventsCount: 1, eventTypes: ['SYS_INTERACTION_RESOLVED'], hasCurrentInteraction: false, ... }
[CardiaEventSystem] INTERACTION_RESOLVED: { sourceId: 'ability_i_ambusher', ... }
[CardiaEventSystem] Handler found: true
[CardiaEventSystem] Handler result: { hasResult: true, eventsCount: 1, events: ['CARDS_DISCARDED'], hasInteraction: false }
[CardiaEventSystem] Applying event: CARDS_DISCARDED { playerId: '1', cardIds: [...], from: 'hand' }
[CardiaEventSystem] Returning modified state: { appliedEventsCount: 1, hasCurrentInteraction: false, ... }
```

**游戏状态**：
- P2 手牌数量：1 张（只剩 Guild 派系的雇佣剑士）
- P2 弃牌堆数量：2 张（审判官、女导师）
- `sys.interaction.current`: `null` 或 `undefined`

**行为**：
- 弹窗关闭
- 不再重复弹出
- P2 的 Academy 派系手牌被弃掉

### 如果问题仍然存在

**症状**：
- 弹窗不断弹出
- P2 的手牌没有被弃掉
- 后台报错：`请先完成当前选择`

**需要的信息**：
1. 浏览器控制台的完整日志（所有 `[CardiaEventSystem]` 和 `[SimpleChoiceSystem]` 日志）
2. 服务端日志中包含 `CardiaEventSystem`、`SimpleChoiceSystem`、`INTERACTION_RESOLVED` 的行
3. 游戏状态（调试面板中的 State）

## 如果日志中没有 CardiaEventSystem

这说明代码没有被重新加载。可能的原因：

1. **Vite 没有检测到文件变化**
   - 解决方案：手动保存 `src/games/cardia/domain/systems.ts` 文件（添加一个空行然后保存）

2. **nodemon 没有重启服务器**
   - 解决方案：完全停止服务器（Ctrl+C），然后重新运行 `npm run dev`

3. **浏览器缓存**
   - 解决方案：硬刷新浏览器（Ctrl+Shift+R 或 Cmd+Shift+R）

## 调试命令

### 检查服务器是否运行

```bash
ps aux | grep -E "node|vite|tsx" | grep -v grep
```

### 检查端口占用

```bash
# macOS
lsof -i :3000  # Vite 前端
lsof -i :18000 # 游戏服务器
lsof -i :18001 # API 服务器

# 或使用
netstat -an | grep -E "3000|18000|18001"
```

### 清理所有测试端口

```bash
npm run test:e2e:cleanup
```

### 查看最新日志

```bash
# 查看最后 100 行
tail -100 logs/app-$(date +%Y-%m-%d).log

# 实时查看
tail -f logs/app-$(date +%Y-%m-%d).log

# 搜索特定内容
grep -i "ambusher" logs/app-$(date +%Y-%m-%d).log
grep -i "interaction" logs/app-$(date +%Y-%m-%d).log
```

## 下一步

根据测试结果：

1. **如果修复成功**：
   - 运行 E2E 测试：`npm run test:e2e -- cardia-deck1-card09-ambusher.e2e.ts`
   - 测试其他受影响的卡牌（Card10, Card14, Card07）

2. **如果问题仍然存在**：
   - 收集上述所有日志和状态信息
   - 分析日志找出问题根因
   - 可能需要进一步调试或修改代码

