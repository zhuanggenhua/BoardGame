# POD 提交恢复状态检查

**检查时间**: 2026-03-04  
**目标**: 检查 P0 恢复计划中的文件，哪些已恢复，哪些仍需恢复

---

## 检查方法

对每个文件执行：
1. 检查 POD 提交（6ea1f9f）删除了什么
2. 检查当前 HEAD 状态（是否已恢复）
3. 检查后续提交历史（是否有手动修改）
4. 给出恢复策略（直接恢复 vs 智能合并）

---

## 优先级 1: 关键功能

### 1. `src/pages/admin/Matches.tsx` (-458 行)

**POD 删除内容**: MatchDetailModal 组件及相关功能

**当前状态**: ✅ 已恢复
- `MatchDetailModal` 函数存在（第 435 行）
- 在 53da949 提交中恢复

**后续修改**: 有（53da949 提交添加了对局详情弹窗）

**恢复策略**: ✅ 无需操作（已恢复）

---

## 优先级 2: 测试覆盖

### 2. `src/games/smashup/__tests__/newOngoingAbilities.test.ts` (-302 行)

**当前状态**: ✅ 文件存在

**需要检查**: 文件内容是否完整（POD 删除了 302 行）

### 3. `src/games/smashup/__tests__/factionAbilities.test.ts` (-299 行)

**当前状态**: ✅ 文件存在

**需要检查**: 文件内容是否完整（POD 删除了 299 行）

### 4. `src/games/dicethrone/__tests__/monk-coverage.test.ts` (-127 行)

**当前状态**: ✅ 文件存在

**需要检查**: 文件内容是否完整（POD 删除了 127 行）

---

## 优先级 3: UI 组件

### 5. `src/games/dicethrone/Board.tsx` (-133 行)

**POD 删除内容**: 
- Auto-response 系统
- Variant selection 逻辑
- Response window auto-switch
- Taiji token limit

**需要检查**: 这些功能是否已恢复

### 6. `src/components/game/framework/widgets/RematchActions.tsx` (-117 行)

**POD 删除内容**: renderButton prop

**当前状态**: ✅ 已恢复
- `renderButton` prop 存在（第 46 行）
- 自定义按钮渲染插槽功能完整

**恢复策略**: ✅ 无需操作（已恢复）

---

## 优先级 4: 游戏逻辑

### 7. `src/games/smashup/domain/baseAbilities.ts` (-119 行)

**检查中...**

---

## 优先级 5: i18n 文件

### 8. `public/locales/en/game-dicethrone.json` (-151 行)

**检查中...**

### 9. `public/locales/zh-CN/game-dicethrone.json` (-157 行)

**检查中...**

---

**检查进度**: 1/9 完成

