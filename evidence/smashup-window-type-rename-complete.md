# 大杀四方响应窗口类型重命名完成

## 任务背景

用户反馈："beforeScoring干脆就叫meFirst，就特殊处理after"（将 beforeScoring 窗口类型重命名为 meFirst，只特殊处理 afterScoring）

## 修改内容

### 1. `src/games/smashup/domain/abilityHelpers.ts`

**修改函数**：`openMeFirstWindow`

**变更**：
- `windowId`: `beforeScoring_${triggerContext}_${now}` → `meFirst_${triggerContext}_${now}`
- `windowType`: `'beforeScoring'` → `'meFirst'`

**原因**：统一命名，`meFirst` 更符合游戏规则术语（Me First! 响应窗口）

### 2. `src/games/smashup/game.ts`

**修改位置**：`createResponseWindowSystem` 配置

**变更**：
- `commandWindowTypeConstraints`: `['beforeScoring', 'afterScoring']` → `['meFirst', 'afterScoring']`
- `responseAdvanceEvents`: `windowTypes: ['beforeScoring', 'afterScoring']` → `windowTypes: ['meFirst', 'afterScoring']`
- `hasRespondableContent`: 检查 `windowType !== 'beforeScoring'` → `windowType !== 'meFirst'`
- `hasRespondableContent`: 检查 `windowType === 'beforeScoring'` → `windowType === 'meFirst'`

**原因**：配置必须与窗口类型定义一致

### 3. `src/games/smashup/ui/MeFirstOverlay.tsx`

**状态**：✅ 已正确（无需修改）

**原因**：组件已经正确检查 `windowType === 'meFirst'` 和 `windowType === 'afterScoring'`

## 测试验证

### 单元测试

运行测试：`npm test -- src/games/smashup/__tests__/beforeScoring-window-stuck.test.ts`

**结果**：✅ 通过

**日志输出**：
```
[hasRespondableContent] Result: {
  playerId: '0',
  windowType: 'meFirst',
  hasSpecialAction: false,
  hasBeforeScoringMinion: false,
  result: false,
  handSize: 3
}
```

**验证点**：
- ✅ 窗口类型正确显示为 `meFirst`
- ✅ `hasRespondableContent` 正确检查 `meFirst` 窗口类型
- ✅ 响应窗口正常打开和关闭

## 架构一致性

### 窗口类型命名规范

| 窗口类型 | 用途 | 触发时机 |
|---------|------|---------|
| `meFirst` | Me First! 响应窗口（原 beforeScoring） | 基地计分前 |
| `afterScoring` | 计分后响应窗口 | 基地计分后 |

### 卡牌 `specialTiming` 字段

**注意**：卡牌定义中的 `specialTiming` 字段仍然使用 `'beforeScoring'` 和 `'afterScoring'`

**原因**：
- `specialTiming` 是卡牌的语义属性（"这张卡在什么时机打出"）
- `windowType` 是响应窗口的类型标识（"当前是什么窗口"）
- 两者概念不同，不需要强制一致

**映射关系**：
- `specialTiming: 'beforeScoring'` → 可在 `windowType: 'meFirst'` 窗口打出
- `specialTiming: 'afterScoring'` → 可在 `windowType: 'afterScoring'` 窗口打出

## 向后兼容性

### 破坏性变更

✅ 无破坏性变更

**原因**：
- `windowType` 是内部实现细节，不暴露给外部 API
- 卡牌定义的 `specialTiming` 字段保持不变
- UI 组件已经正确处理两种窗口类型

### 数据迁移

✅ 无需数据迁移

**原因**：
- 响应窗口状态是临时的（不持久化）
- 游戏状态中不存储窗口类型历史记录

## 总结

成功将 `beforeScoring` 窗口类型重命名为 `meFirst`，统一了命名规范，提高了代码可读性。所有相关代码已更新，测试通过，无破坏性变更。

**修改文件**：
- `src/games/smashup/domain/abilityHelpers.ts`
- `src/games/smashup/game.ts`

**测试文件**：
- `src/games/smashup/__tests__/beforeScoring-window-stuck.test.ts` ✅ 通过
