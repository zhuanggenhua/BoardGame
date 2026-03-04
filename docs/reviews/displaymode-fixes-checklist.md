# DisplayMode 修复确认清单

## 快速确认方法

```bash
# 查看所有修改的文件
git diff --stat src/games/smashup/abilities/

# 查看具体修改（按文件）
git diff src/games/smashup/abilities/wizards.ts
git diff src/games/smashup/abilities/aliens.ts
git diff src/games/smashup/abilities/zombies.ts
# ... 其他文件
```

---

## 修改文件清单（14 个文件，86 处修改）

### ✅ 1. wizards.ts（巫师）- 9 处
- [x] 聚集秘术：行动卡选项 → `displayMode: 'card'`
- [x] 传送门：随从选项 `'button'` → `'card'`（修正错误）
- [x] 传送门排序：卡牌选项 → `displayMode: 'card'`（3 处）
- [x] 占卜：行动卡选项 → `displayMode: 'card'`
- [x] InteractionHandler 中的 optionsGenerator（3 处）

### ✅ 2. aliens.ts（外星人）- 8 处
- [x] 至高霸主：跳过选项 → `displayMode: 'button'`
- [x] 收集者：跳过选项 → `displayMode: 'button'`
- [x] 探测：卡牌选项 → `displayMode: 'card'`（4 处）
- [x] 地球化：类型定义 + 跳过选项 + 随从选项（2 处）

### ✅ 3. zombies.ts（僵尸）- 15 处
- [x] 掘墓人：卡牌选项 + 跳过选项（2 处）
- [x] 掘墓人 optionsGenerator（2 处）
- [x] 盗墓：卡牌选项（2 处）
- [x] 伸出援手：卡牌选项（2 处）
- [x] 僵尸领主：卡牌选项 + 完成按钮（4 处）
- [x] 它们不断涌来：卡牌选项（2 处）
- [x] InteractionHandler（1 处）

### ✅ 4. cthulhu.ts（克苏鲁）- 6 处
- [x] 强制征召：跳过选项 → `displayMode: 'button'`
- [x] 再次降临：跳过选项 → `displayMode: 'button'`
- [x] 再次降临 optionsGenerator：跳过选项
- [x] 其他克苏鲁能力：卡牌选项（3 处）

### ✅ 5. ghosts.ts（幽灵）- 8 处
- [x] 跳过选项 → `displayMode: 'button'`（4 处）
- [x] 卡牌选项 → `displayMode: 'card'`（4 处）

### ✅ 6. ninjas.ts（忍者）- 10 处
- [x] 跳过选项 → `displayMode: 'button'`（4 处）
- [x] 卡牌选项 → `displayMode: 'card'`（6 处）

### ✅ 7. robots.ts（机器人）- 7 处
- [x] 微型机器人：卡牌选项 → `displayMode: 'card'`
- [x] 跳过选项 → `displayMode: 'button'`（6 处）

### ✅ 8. pirates.ts（海盗）- 5 处
- [x] 跳过选项 → `displayMode: 'button'`（4 处）
- [x] 完成按钮 → `displayMode: 'button'`（1 处）

### ✅ 9. miskatonic.ts（米斯卡托尼克）- 5 处
- [x] 跳过选项 → `displayMode: 'button'`（5 处）

### ✅ 10. giant_ants.ts（巨蚁）- 4 处
- [x] 确认按钮 → `displayMode: 'button'`（2 处）
- [x] 取消按钮 → `displayMode: 'button'`（2 处）

### ✅ 11. vampires.ts（吸血鬼）- 3 处
- [x] 跳过选项 → `displayMode: 'button'`（2 处）
- [x] 卡牌选项 → `displayMode: 'card'`（1 处）

### ✅ 12. killer_plants.ts（食人植物）- 3 处
- [x] 卡牌选项 → `displayMode: 'card'`（2 处）
- [x] 跳过选项 → `displayMode: 'button'`（1 处）

### ✅ 13. frankenstein.ts（弗兰肯斯坦）- 2 处
- [x] 卡牌选项 → `displayMode: 'card'`（1 处）
- [x] 停止按钮 → `displayMode: 'button'`（1 处）

### ✅ 14. elder_things.ts（远古之物）- 1 处
- [x] 卡牌选项 → `displayMode: 'card'`（1 处）

---

## 修改模式总结

### 模式 1：卡牌选项（56 处）
```typescript
// 修复前
value: { cardUid: c.uid, defId: c.defId }

// 修复后
value: { cardUid: c.uid, defId: c.defId }, displayMode: 'card' as const
```

### 模式 2：跳过/完成/取消按钮（30 处）
```typescript
// 修复前
value: { skip: true }  // 或 done: true, cancel: true

// 修复后
value: { skip: true }, displayMode: 'button' as const
```

---

## 验证步骤

### 1. 语法检查
```bash
npx eslint src/games/smashup/abilities/*.ts --max-warnings=999
# 预期：0 errors（warnings 是预期的 any 类型警告）
```

### 2. 检查遗漏
```bash
node scripts/check-displaymode.mjs
# 预期：仅 2-3 个误报（类型定义行）
```

### 3. 查看修改统计
```bash
git diff --stat src/games/smashup/abilities/
# 预期：14 个文件被修改
```

### 4. 查看具体修改
```bash
# 查看关键文件
git diff src/games/smashup/abilities/wizards.ts | grep displayMode
git diff src/games/smashup/abilities/aliens.ts | grep displayMode
git diff src/games/smashup/abilities/zombies.ts | grep displayMode
```

---

## 影响评估

### ✅ 安全性
- 只添加 UI 提示字段
- 不改变任何业务逻辑
- 不影响数据结构
- 不需要数据迁移

### ✅ 兼容性
- 向后兼容
- 不影响现有测试
- 不破坏现有功能

### ✅ 效果
- 卡牌选择交互正确显示卡牌预览
- 按钮交互正确显示按钮
- 与传送门修复保持一致

---

## 提交建议

```bash
git add src/games/smashup/abilities/
git commit -m "fix(smashup): 为所有能力交互添加 displayMode

- 卡牌选项添加 displayMode: 'card'（56 处）
- 跳过/完成/取消按钮添加 displayMode: 'button'（30 处）
- 修正传送门 displayMode 从 'button' 到 'card'
- 涉及 14 个派系文件，共 86 处修改

影响：所有卡牌选择交互现在正确显示卡牌预览而非按钮"
```

---

## 回滚方法（如需要）

```bash
# 回滚所有修改
git checkout src/games/smashup/abilities/

# 回滚单个文件
git checkout src/games/smashup/abilities/wizards.ts
```
