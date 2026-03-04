# 提交 6ea1f9f 问题执行摘要

## 🚨 严重性: 极高

**提交**: 6ea1f9f - "feat: add Smash Up POD faction support"
**状态**: ❌ **45 个测试失败**
**影响**: 所有 ongoing 力量修正卡牌功能异常

---

## 核心问题

### 1. Power Modifier 重复应用 🔴

**症状**: 
- 睡眠孢子应该 -1，实际 -2
- 旋转弹头发射器应该 +2，实际 +4
- 所有力量修正值都是预期的 2 倍

**影响**: 17 个 `ongoingModifiers.test.ts` 测试失败

**根因**: `reducer.ts` 中 5 处直接状态修改 (`state.sys =`)

---

### 2. 代码质量问题

- **8 处直接状态修改** - 违反不可变性
- **2 处未初始化字段** - 可能运行时崩溃
- **311 行净删除** - 可能遗漏关键逻辑

---

## 立即行动

### 1. 停止合并
❌ 不要合并任何基于此提交的代码

### 2. 修复或回滚
```bash
# 选项 A: 创建修复分支
git checkout -b hotfix/power-modifier-duplicate 6ea1f9f

# 选项 B: 回滚
git revert 6ea1f9f
```

### 3. 修复清单
- [ ] 修复 `reducer.ts` 中的 5 处 `state.sys =`
- [ ] 修复 `index.ts` 中的 2 处直接修改
- [ ] 初始化 `types.ts` 中的 2 个可选字段
- [ ] 验证 Power Modifier 不再重复应用
- [ ] 重新运行测试: `npm test -- smashup`

---

## 测试结果

```
Test Files: 13 failed | 117 passed | 9 skipped (139)
Tests:      45 failed | 1335 passed | 19 skipped (1399)
```

**失败率**: 3.2% (45/1399)
**主要失败**: ongoing 力量修正系统

---

## 详细报告

完整分析见: `tmp/6ea1f9f-bug-analysis-final.md`
