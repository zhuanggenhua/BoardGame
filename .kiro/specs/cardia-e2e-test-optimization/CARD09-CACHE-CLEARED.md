# Card09 伏击者 - 缓存清理完成

## ✅ 已完成的步骤

### 1. 清理 Vite 缓存

```bash
rm -rf node_modules/.vite
```

**结果**：✅ Vite 缓存已清理

### 2. 重新启动开发服务器

```bash
npm run dev
```

**结果**：✅ 开发服务器已启动并运行正常

服务器信息：
- Frontend: http://localhost:3000/
- Game Server: 运行中
- API Server: http://localhost:18001/

## 📋 下一步操作

### 手动测试（推荐）

1. **打开浏览器**（建议使用无痕模式或硬刷新）
   - Chrome/Edge: Ctrl+Shift+N（无痕模式）或 Ctrl+Shift+R（硬刷新）
   - Mac: Cmd+Shift+N（无痕模式）或 Cmd+Shift+R（硬刷新）

2. **访问游戏**
   - URL: http://localhost:3000/play/cardia/match/<matchId>?playerID=0
   - 或者从大厅创建新房间

3. **使用调试面板注入测试状态**
   - 打开调试面板（右上角按钮）
   - 切换到 "State" 标签
   - 点击 "Toggle Input"
   - 粘贴 `.kiro/specs/cardia-e2e-test-optimization/CARD09-INJECT-STATE.json` 的内容
   - 点击 "Apply State"

4. **测试伏击者能力**
   - 点击能力按钮
   - 选择 Academy 派系
   - **查看浏览器控制台**，搜索 `[CardiaEventSystem]` 日志
   - 验证 P2 的 Academy 派系手牌是否被弃掉

5. **检查日志**
   - 如果看到 `[CardiaEventSystem]` 日志，说明代码已重新加载 ✅
   - 如果没有看到日志，说明代码仍未加载 ❌

### E2E 测试

```bash
npm run test:e2e -- cardia-deck1-card09-ambusher.e2e.ts
```

**注意**：E2E 测试使用独立的测试环境（端口 5173/19000/19001），会自动启动新的服务器实例，应该会使用最新的代码。

## 🔍 预期结果

### 如果修复生效

**浏览器控制台应该显示**：
```
[CardiaEventSystem] afterEvents called: { eventsCount: 1, eventTypes: ['SYS_INTERACTION_RESOLVED'] }
[CardiaEventSystem] INTERACTION_RESOLVED: { sourceId: 'ability_i_ambusher', ... }
[CardiaEventSystem] Handler found: true
[CardiaEventSystem] Handler result: { hasResult: true, eventsCount: 1, events: ['CARDS_DISCARDED'] }
[CardiaEventSystem] Applying event: CARDS_DISCARDED { playerId: '1', cardIds: [...], from: 'hand' }
[CardiaEventSystem] Returning modified state: { appliedEventsCount: 1, appliedEventTypes: ['CARDS_DISCARDED'], ... }
```

**游戏状态应该变化**：
- P2 的 2 张 Academy 派系手牌被弃掉
- P2 的弃牌堆增加 2 张
- P2 的手牌只剩 1 张（Guild 派系）

### 如果修复仍未生效

**浏览器控制台没有 `[CardiaEventSystem]` 日志**：
- 说明代码仍未被重新加载
- 可能需要：
  1. 完全关闭浏览器，重新打开
  2. 清理浏览器缓存（设置 → 隐私 → 清除浏览数据）
  3. 检查是否有 Service Worker 缓存（开发者工具 → Application → Service Workers）

**有日志但功能仍不生效**：
- 说明修复方向不对
- 需要重新分析问题根因

## 📊 测试清单

- [ ] 手动测试：能力按钮显示
- [ ] 手动测试：派系选择弹窗显示
- [ ] 手动测试：选择派系后弹窗关闭
- [ ] 手动测试：浏览器控制台有 `[CardiaEventSystem]` 日志
- [ ] 手动测试：P2 的 Academy 派系手牌被弃掉
- [ ] E2E 测试：测试通过

## 相关文档

- `CARD09-FINAL-STATUS.md` - 最终状态总结
- `CARD09-INJECT-STATE.json` - 测试状态 JSON
- `CARD09-DEBUG-GUIDE.md` - 手动调试指南
- `e2e/cardia-deck1-card09-ambusher.e2e.ts` - E2E 测试文件
- `src/games/cardia/domain/systems.ts` - 修复的代码文件
