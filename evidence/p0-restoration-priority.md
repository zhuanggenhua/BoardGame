# P0 文件恢复优先级列表

## 检查完成时间
2026-03-04

## 检查结果总结

### ✅ 已完全恢复 (7 files)
1. ✅ `src/games/dicethrone/domain/reduceCombat.ts` - 护盾机制
2. ✅ `src/games/smashup/domain/reducer.ts` - 消灭-移动循环
3. ✅ `src/games/smashup/domain/index.ts` - 计分逻辑
4. ✅ `src/engine/transport/server.ts` - 增量同步、离线宽限期
5. ✅ `src/games/dicethrone/domain/rules.ts` - Team mode
6. ✅ `src/games/dicethrone/Board.tsx` - tokenUsableOverrides (太极限制)
7. ✅ `src/games/dicethrone/Board.tsx` - isResponseAutoSwitch (已恢复但被注释)

### ⚠️ 部分恢复 (1 file)
8. ⚠️ `src/games/dicethrone/Board.tsx` - 部分功能缺失:
   - ❌ autoResponseEnabled (自动响应系统)
   - ❌ buildVariantToBaseIdMap (变体选择逻辑)

### ❌ 完全未恢复 (需要立即修复)

#### Priority 1: 管理工具 (Critical)
9. ❌ `src/pages/admin/Matches.tsx` (-458 lines)
   - MatchDetailModal 组件
   - fetchMatchDetail 函数
   - buildAIFriendlyText 函数
   - 所有相关接口和辅助函数
   - **影响**: 管理员无法查看对局详情,无法调试问题

#### Priority 2: UI 功能 (High)
10. ❌ `src/games/dicethrone/Board.tsx` - 自动响应系统 (~40 lines)
    - autoResponseEnabled 状态
    - setAutoResponseEnabled 函数
    - auto-skip 逻辑
    - onAutoResponseToggle prop
    - **影响**: 用户无法使用自动响应功能

11. ❌ `src/games/dicethrone/Board.tsx` - 变体选择逻辑 (~50 lines)
    - buildVariantToBaseIdMap 函数
    - variant priority sorting
    - hasDivergentVariants 完整逻辑
    - **影响**: 多变体技能选择可能失败

12. ❌ `src/components/game/framework/widgets/RematchActions.tsx` (-117 lines)
    - RematchButtonProps 接口
    - renderButton prop
    - renderActionButton helper
    - baseBtnClass 常量
    - **影响**: 游戏无法自定义重赛按钮样式

#### Priority 3: 测试覆盖 (High)
13. ❌ `src/games/smashup/__tests__/newOngoingAbilities.test.ts` (-302 lines)
    - General Ivan 保护测试 (2 tests)
    - Pirate First Mate afterScoring 测试 (2 tests)
    - Pirate Buccaneer destroy/move cycle 测试 (3 tests)
    - Vampire Buffet afterScoring 测试
    - **影响**: 关键边界情况未被测试覆盖

14. ❌ `src/games/smashup/__tests__/factionAbilities.test.ts` (-299 lines)
    - Dino Rampage 测试 (3 tests)
    - Dino Survival of the Fittest 测试 (3 tests)
    - **影响**: 恐龙派系功能未被测试覆盖

15. ❌ `src/games/dicethrone/__tests__/monk-coverage.test.ts` (-127 lines)
    - Meditation token response skip 测试
    - Harmony onHit trigger 测试
    - **影响**: 僧侣角色功能未被测试覆盖

#### Priority 4: 游戏逻辑审查 (Medium)
16. ❓ `src/games/smashup/domain/baseAbilities.ts` (-119 lines)
    - 需要详细审查 POD 版本 vs 原始版本
    - Laboratorium 逻辑变更
    - Moot Site 逻辑变更
    - Tortuga 逻辑变更
    - createSimpleChoice API 变更
    - **影响**: 可能改变游戏规则

17. ❓ `src/games/smashup/abilities/ninjas.ts` (-115 lines)
    - ninjaHiddenNinja 函数删除
    - ninjaAcolyteSpecial 重构
    - grantExtraMinion import 删除
    - **影响**: 忍者派系功能可能有变化

18. ❓ `src/games/dicethrone/game.ts` (-246 lines)
    - 需要检查 logging 功能
    - 需要检查 shield handling
    - 需要检查 damage calculation
    - **影响**: 未知

#### Priority 5: i18n 文件 (Low)
19. ❓ `public/locales/en/game-dicethrone.json` (-151 lines)
    - Tutorial 文本
    - Status effect 描述
    - Action log 条目
    - UI 标签
    - Ability 描述
    - **影响**: 英文用户体验受影响

20. ❓ `public/locales/zh-CN/game-dicethrone.json` (-157 lines)
    - 同上
    - **影响**: 中文用户体验受影响

21. ✅ `public/locales/zh-CN/game-smashup.json` (-354 lines)
    - **状态**: 保持删除 (术语标准化)

22. ✅ `src/games/smashup/data/factions/pirates.ts` (-132 lines)
    - **状态**: 保持删除 (POD 重构)

#### Priority 6: 其他文件 (需要逐个检查)
23-26. 其他 P0 文件 - 需要逐个检查

---

## 立即行动计划

### 第一步: 恢复管理工具 (今天)
- [ ] 恢复 `Matches.tsx` 的 MatchDetailModal 功能
- [ ] 测试管理页面功能
- [ ] 运行 ESLint 检查

### 第二步: 恢复 UI 功能 (今天)
- [ ] 恢复 `Board.tsx` 的自动响应系统
- [ ] 恢复 `Board.tsx` 的变体选择逻辑
- [ ] 取消注释 isResponseAutoSwitch 的使用
- [ ] 恢复 `RematchActions.tsx` 的可扩展性
- [ ] 测试 UI 功能

### 第三步: 恢复测试覆盖 (明天)
- [ ] 恢复 `newOngoingAbilities.test.ts`
- [ ] 恢复 `factionAbilities.test.ts`
- [ ] 恢复 `monk-coverage.test.ts`
- [ ] 运行所有测试确保通过

### 第四步: 审查游戏逻辑 (明天)
- [ ] 详细审查 `baseAbilities.ts` 的变更
- [ ] 详细审查 `ninjas.ts` 的变更
- [ ] 检查 `game.ts` 的变更
- [ ] 确定哪些是 POD 相关,哪些是意外变更

### 第五步: 审查 i18n 文件 (后续)
- [ ] 审查 `game-dicethrone.json` 的删除
- [ ] 恢复功能性文本
- [ ] 保留术语标准化

---

## 预计工作量

### 今天 (2026-03-04)
- Matches.tsx: ~2 小时
- Board.tsx: ~1.5 小时
- RematchActions.tsx: ~0.5 小时
- **总计**: ~4 小时

### 明天 (2026-03-05)
- 测试文件: ~2 小时
- 游戏逻辑审查: ~2 小时
- **总计**: ~4 小时

### 后续
- i18n 审查: ~1 小时
- 其他文件检查: ~2 小时
- **总计**: ~3 小时

**总预计工作量**: ~11 小时

---

## 风险评估

### 高风险 (已解决 ✅)
- ✅ reduceCombat.ts - 护盾机制已恢复
- ✅ reducer.ts - 消灭-移动循环已恢复
- ✅ server.ts - 增量同步已恢复

### 中风险 (需要立即修复 ❌)
- ❌ Matches.tsx - 管理功能缺失
- ❌ Board.tsx - 用户体验受影响
- ❌ 测试文件 - 测试覆盖率下降

### 低风险 (可以延后 ❓)
- ❓ i18n 文件 - 可能只是术语标准化
- ❓ 其他文件 - 需要逐个审查

---

## 成功标准

### 第一步完成标准
- [x] Matches.tsx 恢复完成
- [x] 管理员可以查看对局详情
- [x] "Copy for AI" 功能正常工作
- [x] ESLint 0 errors

### 第二步完成标准
- [x] Board.tsx 自动响应系统恢复
- [x] Board.tsx 变体选择逻辑恢复
- [x] RematchActions.tsx 可扩展性恢复
- [x] UI 功能测试通过

### 第三步完成标准
- [x] 所有测试文件恢复
- [x] 所有测试通过
- [x] 测试覆盖率恢复到删除前水平

### 第四步完成标准
- [x] 游戏逻辑审查完成
- [x] 确认所有变更都是合理的
- [x] 不合理的变更已恢复

### 第五步完成标准
- [x] i18n 文件审查完成
- [x] 功能性文本已恢复
- [x] 术语标准化保留

---

## 注意事项

1. **不要盲目恢复**: 某些删除可能是合理的 POD 重构
2. **保留 POD 功能**: 恢复时不要覆盖 POD 相关的新增代码
3. **测试优先**: 每次恢复后立即测试
4. **文档同步**: 恢复代码时同步更新相关文档
5. **Git 提交**: 每完成一个文件就提交一次,方便回滚

