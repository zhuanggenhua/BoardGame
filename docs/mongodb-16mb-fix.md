# MongoDB 16MB 限制修复说明

## 问题描述

游戏运行时遇到 MongoDB 错误：
```
MongoServerError: BSONObj size: 16818014 (0x1009F5E) is invalid. 
Size must be between 0 and 16793600(16MB)
```

这是因为单个 Match 文档超过了 MongoDB 的 16MB 文档大小限制。

## 根本原因

1. **状态清理路径错误**：`MongoStorage.sanitizeStateForStorage` 访问的是 `state.sys`，但 boardgame.io 的 State 结构是 `{ G, ctx, ... }`，实际游戏状态在 `state.G.sys`，导致清理逻辑完全失效。

2. **日志无限增长**：
   - `sys.log.entries` 默认保留 200 条，每个日志条目包含完整事件对象
   - `Match.log` (boardgame.io 的 deltalog) 没有任何限制，持续累积
   - Undo 快照虽然限制数量，但每个快照都深拷贝整个状态（包括日志）

3. **大型事件对象**：
   - `ABILITY_REPLACED` 事件包含完整的 `AbilityDef` 对象（包含 effects、variants 等）
   - `DECK_SHUFFLED` 事件包含完整的牌库顺序数组

## 修夏方案

### 1. 修正清理路径 ✅

```typescript
// 之前（错误）
const sys = (state as { sys?: ... }).sys;

// 现在（正确）
const G = (state as { G?: ... }).G;
const sys = G.sys as Record<string, unknown>;
```

### 2. 限制 Match.log 大小 ✅

```typescript
// 使用 MongoDB 的 $slice 操作符限制数组大小
update.$push = { log: { $each: deltalog, $slice: -200 } };
```

### 3. 清理大型事件 payload ✅

```typescript
// ABILITY_REPLACED: 只保留 ID
if (event.type === 'ABILITY_REPLACED') {
  cleanedPayload.newAbilityDef = { id: abilityDef.id };
}

// DECK_SHUFFLED: 只保留数量
if (event.type === 'DECK_SHUFFLED') {
  cleanedPayload.deckCardCount = deckCardIds.length;
  delete cleanedPayload.deckCardIds;
}
```

### 4. 清理 boardgame.io 顶层字段 ✅

```typescript
// 清理 plugins.log.data
if (plugins.log?.data?.length > 50) {
  plugins.log.data = plugins.log.data.slice(-50);
}

// 清空 _undo/_redo
state._undo = [];
state._redo = [];
```

### 5. 优化 Undo 快照 ✅

```typescript
// 快照时裁剪日志
stateToSave.sys.log.entries = state.sys.log.entries.slice(-20);

// 保留 1 个快照，支持一次撤销
createUndoSystem({ maxSnapshots: 1 })
```

### 6. 减少持久化日志数量 ✅

从 200 条减少到 50 条

### 7. 添加详细诊断 ✅

- 状态大小超过 1MB 时打印警告日志
- 显示所有顶层字段大小 (G, ctx, plugins, _undo, _redo 等)
- 显示 G 内部明细 (sys, core, undo, log)
- 添加 `getStorageStats()` 方法查看所有房间大小
- 添加清理脚本

## 如何使用

### 立即清理现有数据库

```bash
# 运行清理脚本
npx tsx scripts/db/cleanup-db.ts
```

这将：
1. 显示当前存储统计
2. 清理所有空房间（无玩家）
3. 清理 24 小时前的旧房间
4. 显示清理后的统计

### 手动清理（Mongo Shell）

```javascript
// 连接到数据库
use boardgame

// 查看大型文档
db.matches.find({}, { matchID: 1 }).forEach(doc => {
  const size = Object.bsonsize(doc);
  if (size > 1024 * 1024) {
    print(doc.matchID + ": " + (size / 1024 / 1024).toFixed(2) + " MB");
  }
});

// 删除旧房间（超过 24 小时）
db.matches.deleteMany({
  updatedAt: { $lt: new Date(Date.now() - 24 * 60 * 60 * 1000) }
});
```

## 预防措施

### 服务器端

服务器已启用定时清理任务（每 5 分钟）：

```typescript
setInterval(async () => {
  await mongoStorage.cleanupEmptyMatches();
}, 5 * 60 * 1000);
```

### 游戏设计建议

1. **避免在事件 payload 中存储大型对象**
   - 使用 ID 引用而不是完整对象
   - 将大型数据存储在状态中，事件只记录变化

2. **合理设置 TTL**
   - 开发/测试房间设置短 TTL（如 1 小时）
   - 正式对局可设置长 TTL（如 7 天）

3. **定期清理**
   - 手动运行清理脚本
   - 或在 CI/CD 中添加定时任务

## 监控

### 查看状态大小

修复后，当状态超过 1MB 时会自动打印警告：

```
[MongoStorage] 状态过大: matchID=abc123, size=1.23MB
```

### 获取统计信息

```typescript
// 在服务器代码中
const stats = await mongoStorage.getStorageStats();
console.log(stats);
```

## 验证

修复后重新运行游戏，确认：

1. ✅ 不再出现 16MB 错误
2. ✅ 状态大小保持在合理范围（< 2MB）
3. ✅ 游戏功能正常（日志、撤销等）
4. ✅ 旧房间自动清理

## 后续优化（可选）

如果仍有性能问题，可考虑：

1. **分离大型数据**：将卡牌数据、技能定义等移到独立集合
2. **压缩存储**：使用 BSON 压缩或 gzip
3. **增量状态**：只存储 delta 而不是完整状态
4. **使用 GridFS**：对超大文档使用 GridFS 存储

## 相关文件

- `src/server/storage/MongoStorage.ts` - 存储实现
- `scripts/db/cleanup-db.ts` - 清理脚本
- `server.ts` - 服务器入口（定时清理）
