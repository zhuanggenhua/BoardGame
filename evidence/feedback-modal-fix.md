# 反馈弹窗修复 - attachLog/attachState 未定义错误

## 问题描述

用户点击反馈按钮时，控制台报错：
```
ReferenceError: attachLog is not defined
at FeedbackModal (FeedbackModal.tsx:293:42)
```

导致反馈功能完全无法使用。

## 根本原因

在之前的修改中，误删除了 `attachLog` 和 `attachState` 的 state 声明：
```typescript
// ❌ 被误删除
const [attachLog, setAttachLog] = useState(!!actionLogText);
const [attachState, setAttachState] = useState(!!stateSnapshot);
```

但使用这些变量的代码仍然存在（第 124、293、294 行），导致运行时错误。

## 修复方案

### 1. 恢复 state 声明

**文件**：`src/components/system/FeedbackModal.tsx`

```typescript
const [attachLog, setAttachLog] = useState(!!actionLogText);
const [attachState, setAttachState] = useState(!!stateSnapshot);
```

### 2. 添加测试覆盖

**文件**：`src/components/system/__tests__/FeedbackModal.test.tsx`

创建了 11 个测试用例，覆盖：
- ✅ 基本渲染
- ✅ actionLog 和 stateSnapshot 选项显示
- ✅ 默认勾选状态
- ✅ 取消勾选功能
- ✅ 提交时包含/不包含附件

**测试结果**：
```
✓ src/components/system/__tests__/FeedbackModal.test.tsx (11 tests) 1321ms
  ✓ FeedbackModal (11)
     ✓ 应该正常渲染反馈弹窗  320ms
     ✓ 应该在有 actionLogText 时显示"附带操作日志"选项 46ms
     ✓ 应该在有 stateSnapshot 时显示"附带状态快照"选项 43ms
     ✓ 应该默认勾选"附带操作日志" 40ms
     ✓ 应该默认勾选"附带状态快照" 55ms
     ✓ 应该允许取消勾选"附带操作日志" 60ms
     ✓ 应该允许取消勾选"附带状态快照" 37ms
     ✓ 应该在提交时包含勾选的 actionLog 240ms
     ✓ 应该在取消勾选后不包含 actionLog 158ms
     ✓ 应该在提交时包含勾选的 stateSnapshot 197ms
     ✓ 应该在取消勾选后不包含 stateSnapshot 124ms

Test Files  1 passed (1)
Tests  11 passed (11)
```

## 附加改进

### 管理后台状态压缩优化

**文件**：`src/pages/admin/Feedback.tsx`

优化了 `compressStateSnapshot` 函数：
- 事件数量从 5 条增加到 10 条
- 显示事件的关键参数（playerId、targetId、damage、cardDefId、abilityId）

**输出示例**：
```
--- 最近事件 ---
35: MINION_PLAYED P0 [ninja_acolyte]
36: ABILITY_TRIGGERED P0 {infiltrate}
37: CARD_DRAWN P0
38: DAMAGE_DEALT P1 →unit_123 dmg=3
39: STATUS_APPLIED P0 →unit_456 {stealth}
40: TURN_CHANGED P1
```

## 教训

1. **测试覆盖的重要性**：关键功能（如反馈系统）必须有测试覆盖，避免"连反馈都点不了"的尴尬情况
2. **修改前先搜索引用**：删除变量前必须搜索所有引用位置，确保没有遗漏
3. **本地验证**：修改后必须在本地测试基本功能，不能只靠"看代码"

## 验证清单

- [x] 修复 `attachLog` 和 `attachState` 未定义错误
- [x] 添加 11 个测试用例覆盖反馈功能
- [x] 所有测试通过
- [x] 优化管理后台状态压缩（10 条事件 + 关键参数）
- [x] 本地验证反馈弹窗可以正常打开和提交

## 影响范围

- ✅ 修复了反馈功能完全无法使用的严重 bug
- ✅ 添加了测试覆盖，防止未来回归
- ✅ 优化了管理后台的状态快照显示
