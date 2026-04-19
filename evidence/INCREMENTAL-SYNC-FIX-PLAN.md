# 增量同步系统修复计划

**发现时间**: 2026-03-04  
**状态**: ✅ 已确认问题，准备修复

---

## 🎯 问题确认

### 当前状态

1. **字段存在**：`lastBroadcastedViews: Map<string, unknown>` 字段已恢复
2. **部分逻辑存在**：
   - ✅ `emitStateToSockets` 函数中的 diff 计算逻辑已恢复
   - ✅ `computeDiff` import 已恢复
   - ✅ `injectState` 中的 `clear()` 已恢复
   - ✅ `handleDisconnect` 中的 `delete()` 已恢复
   - ✅ 撤回后的 `clear()` 已恢复
3. **缺失逻辑**：
   - ❌ `handleSync` 中的缓存写入逻辑缺失
   - ❌ 旁观者断开时的缓存清理逻辑缺失

### 测试失败原因

所有 3 个测试失败都是因为 `handleSync` 没有写入缓存：

1. **`handleSync writes cache so subsequent broadcastState uses diff`**
   - 期望：`handleSync` 写入缓存 → `broadcastState` 使用 diff → 发送 `state:patch`
   - 实际：`handleSync` 没写缓存 → `broadcastState` 无缓存 → 发送 `state:update`

2. **`first connection sends full state:sync and writes to cache`**
   - 期望：首次连接 → `handleSync` 写入缓存 → 后续命令发送 `state:patch`
   - 实际：`handleSync` 没写缓存 → 后续命令发送 `state:update`

3. **`last spectator disconnect cleans spectator cache`**
   - 期望：旁观者连接 → `handleSync` 写入缓存 → 断开 → 清理缓存 → 重连发送 `state:sync`
   - 实际：`handleSync` 没写缓存 → 无缓存可清理 → 测试失败

---

## 🔧 修复方案

### 修复 1：恢复 handleSync 中的缓存写入

**位置**：`src/engine/transport/server.ts` 第 ~565 行（`handleSync` 函数末尾）

**当前代码**：
```typescript
socket.emit('state:sync', matchID, viewState, matchPlayers, {
    seed: match.randomSeed,
    cursor: match.getRandomCursor(),
});

// 通知其他玩家（旁观者不触发玩家连接事件）
if (playerID !== null) {
    socket.to(`game:${matchID}`).emit('player:connected', matchID, playerID);
}
```

**修复后**：
```typescript
socket.emit('state:sync', matchID, viewState, matchPlayers, {
    seed: match.randomSeed,
    cursor: match.getRandomCursor(),
});

// 写入缓存，确保后续走 diff 基准正确
// JSON round-trip 消除 undefined 值的 key，确保缓存结构与客户端（经 socket.io JSON 序列化）一致。
// 否则 fast-json-patch 的 compare 会对 { key: undefined } → { key: value } 生成 replace 而非 add，
// 导致客户端 patch 应用失败（路径不存在）。
match.lastBroadcastedViews.set(playerID ?? 'spectator', JSON.parse(JSON.stringify(viewState)));

// 通知其他玩家（旁观者不触发玩家连接事件）
if (playerID !== null) {
    socket.to(`game:${matchID}`).emit('player:connected', matchID, playerID);
}
```

**关键点**：
- 使用 `JSON.parse(JSON.stringify(viewState))` 消除 `undefined` 值
- 旁观者使用 `'spectator'` 作为 cacheKey
- 必须在 `emit('state:sync')` 之后写入缓存

---

### 修复 2：恢复旁观者断开时的缓存清理

**位置**：`src/engine/transport/server.ts` 第 ~1045 行（`handleDisconnect` 函数中）

**当前代码**：
```typescript
if (info.playerID === null) {
    match.spectatorSockets.delete(socketId);
    return;
}
```

**修复后**：
```typescript
if (info.playerID === null) {
    match.spectatorSockets.delete(socketId);
    // 最后一个旁观者断开时清理缓存
    if (match.spectatorSockets.size === 0) {
        match.lastBroadcastedViews.delete('spectator');
    }
    return;
}
```

**关键点**：
- 只在最后一个旁观者断开时清理缓存
- 使用 `'spectator'` 作为 cacheKey（与 handleSync 一致）

---

## 📊 预期结果

修复后，所有 3 个测试应该通过：

1. ✅ `handleSync writes cache so subsequent broadcastState uses diff`
   - `handleSync` 写入缓存 → `broadcastState` 使用 diff → 发送 `state:patch`

2. ✅ `first connection sends full state:sync and writes to cache`
   - 首次连接 → `handleSync` 写入缓存 → 后续命令发送 `state:patch`

3. ✅ `last spectator disconnect cleans spectator cache`
   - 旁观者连接 → `handleSync` 写入缓存 → 断开 → 清理缓存 → 重连发送 `state:sync`

---

## 🎓 教训

### 发现 1：部分恢复比完全删除更危险

**问题**：
- POD commit 删除了整个增量同步系统
- 后续某个提交部分恢复了系统（字段 + 部分逻辑）
- 但没有恢复完整的缓存写入逻辑
- 导致系统"看起来存在"但实际不工作

**教训**：
- 部分恢复比完全删除更难发现
- 必须运行测试验证功能完整性
- 代码审查要关注"逻辑完整性"而非"代码存在性"

---

### 发现 2：测试是功能完整性的守护者

**问题**：
- 如果没有测试，部分恢复的问题可能永远不会被发现
- 系统会"静默失败"：不报错，但功能不工作

**教训**：
- 测试不仅验证功能正确性，还验证功能完整性
- 集成测试可以发现"部分实现"的问题
- 测试失败是最后一道防线

---

### 发现 3：审计方法的局限性

**问题**：
- 原审计方法只看 `git show 6ea1f9f` 的 diff
- 没有检查当前代码库的实际状态
- 导致误判"增量同步系统被删除"
- 实际上系统被部分恢复，但不完整

**教训**：
- 审计必须结合历史 diff 和当前状态
- 不能只看"删除了什么"，还要看"恢复了什么"
- 测试是验证当前状态的最可靠方法

---

## 📝 下一步

1. ✅ 应用修复 1：恢复 handleSync 中的缓存写入
2. ✅ 应用修复 2：恢复旁观者断开时的缓存清理
3. ✅ 运行测试：`npm run test -- patch-integration.test.ts`
4. ✅ 验证所有 3 个测试通过
5. ✅ 更新审计文档，记录"部分恢复"的发现

---

**创建时间**: 2026-03-04  
**状态**: ✅ 准备修复  
**预计工作量**: ~10 行代码，5 分钟

