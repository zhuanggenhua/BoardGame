# MongoDB 16MB 限制修复归档

本文记录传输层迁移前的一次历史存储问题。旧框架字段已不再代表当前结构；当前状态清理必须以现有 `StoredMatchState`、存储代码和真实数据库文档为准。本文保留当时的故障形状、修复思路和排查命令，避免清理时只剩一句摘要。

## 当时问题

当时对局运行中出现 MongoDB 单文档过大错误：

```text
MongoServerError: BSONObj size: 16818014 (0x1009F5E) is invalid.
Size must be between 0 and 16793600(16MB)
```

现实后果是某些对局状态无法继续保存，刷新、重连或恢复时可能读不到最新状态。

## 当时根因

旧文档记录的根因分三层：

- 状态清理路径访问错层：清理代码读取 `state.sys`，但旧结构里实际游戏系统状态在 `state.G.sys`，导致清理逻辑没有真正作用到日志和系统状态。
- 日志和快照持续增长：`sys.log.entries`、旧框架 `Match.log` / deltalog、undo 快照都会累积；快照还会复制整个状态。
- 大型事件 payload 进入存储：例如 `ABILITY_REPLACED` 保存完整 `AbilityDef`，`DECK_SHUFFLED` 保存完整牌库顺序。

这些结论只适用于当时结构；当前根因必须重新按现有代码确认。

## 当时修复

### 修正清理路径

当时的关键修复是从旧结构的 `G` 下取系统状态：

```ts
const G = (state as { G?: unknown }).G;
const sys = (G as { sys?: Record<string, unknown> }).sys;
```

### 限制持久化日志

旧文档记录曾用 MongoDB `$slice` 限制追加日志长度：

```ts
update.$push = { log: { $each: deltalog, $slice: -200 } };
```

后续又把部分持久化日志数量从 200 调低到 50。

### 缩小大型事件

旧方案把大型对象改成摘要：

- `ABILITY_REPLACED` 只保留能力 ID，不保存完整能力定义。
- `DECK_SHUFFLED` 只保留牌数，不保存完整牌库顺序。

### 清理旧框架字段

当时还清理过旧框架的 `plugins.log.data`、`_undo`、`_redo` 等顶层字段。当前自研传输层不应直接照搬这些字段名。

### 优化 undo 快照

旧文档记录过两个方向：

- 快照时裁剪日志，只保留最近少量记录。
- 减少快照数量，只支持必要的撤回窗口。

## 当时清理命令

旧文档记录的数据库清理入口：

```bash
npx tsx scripts/db/cleanup-db.ts
```

当时预期动作：

- 显示当前存储统计。
- 清理无玩家空房间。
- 清理 24 小时前旧房间。
- 再显示清理后的统计。

Mongo Shell 手动排查示例：

```js
use bordgame

db.matches.find({}, { matchID: 1 }).forEach(doc => {
  const size = Object.bsonsize(doc);
  if (size > 1024 * 1024) {
    print(doc.matchID + ": " + (size / 1024 / 1024).toFixed(2) + " MB");
  }
});

db.matches.deleteMany({
  updatedAt: { $lt: new Date(Date.now() - 24 * 60 * 60 * 1000) }
});
```

这些命令是否仍可用，要先看当前脚本、数据库名和 collection 结构。

## 当时监控

旧方案增加过状态大小诊断：

- 状态超过 1MB 时打印警告。
- 打印顶层字段大小，如 `G`、`ctx`、`plugins`、`_undo`、`_redo`。
- 打印 `G` 内部明细，如 `sys`、`core`、`undo`、`log`。
- 增加 `getStorageStats()` 查看房间大小。

当前若再遇到类似问题，现实验收不是“日志安静”，而是目标对局文档大小、保存成功率和恢复状态都正常。

## 当前排查口径

- 先确认当前对局真实存储结构和超大字段，不按旧字段名直接修。
- 先区分“单文档过大”“保存频率过高”“恢复状态错误”“旧房间堆积”四类问题。
- 大型 payload 应优先改成 ID、计数或摘要；不要把完整规则定义、全量牌库、完整日志塞进事件。
- 清理旧数据是恢复动作；如果代码仍持续写入超大字段，不能称为根因修复。

## 当时相关文件

- `src/server/storage/MongoStorage.ts`
- `scripts/db/cleanup-db.ts`
- `server.ts`
