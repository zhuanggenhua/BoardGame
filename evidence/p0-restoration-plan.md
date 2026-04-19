# P0 审计结果修复计划

## 执行时间
2026-03-04

## 审计结果总结

根据 `evidence/p0-audit-complete.md`,P0 审计发现:
- **已审计**: 21/26 文件 (81%)
- **需要恢复**: 18/21 文件 (86%)
- **保持删除**: 3/21 文件 (14%)
- **预计恢复行数**: ~3,761 行

## 当前状态检查

### 已自动恢复的文件 (在后续提交中已恢复)
1. ✅ `src/games/smashup/domain/reducer.ts` - 关键函数已恢复
   - `processDestroyMoveCycle` ✅
   - `filterProtectedReturnEvents` ✅
   - `filterProtectedDeckBottomEvents` ✅
   - `ACTIVATE_SPECIAL` 命令处理器 ✅

### 仍需手动恢复的文件

#### 优先级 1: 关键功能 (立即修复)
1. ❌ `src/pages/admin/Matches.tsx` (-458 行)
   - MatchDetailModal 组件及相关功能
   - 状态: 未恢复

#### 优先级 2: 测试覆盖 (重要)
2. ❌ `src/games/smashup/__tests__/newOngoingAbilities.test.ts` (-302 行)
3. ❌ `src/games/smashup/__tests__/factionAbilities.test.ts` (-299 行)
4. ❌ `src/games/dicethrone/__tests__/monk-coverage.test.ts` (-127 行)

#### 优先级 3: UI 组件 (重要)
5. ❌ `src/games/dicethrone/Board.tsx` (-133 行)
   - Auto-response 系统
   - Variant selection 逻辑
   - Response window auto-switch
   - Taiji token limit

6. ❌ `src/components/game/framework/widgets/RematchActions.tsx` (-117 行)
   - renderButton prop
   - 可扩展性功能

#### 优先级 4: 游戏逻辑 (需要审查)
7. ❌ `src/games/smashup/domain/baseAbilities.ts` (-119 行)
   - 需要仔细审查 POD 版本 vs 原始版本
   - Laboratorium/Moot Site/Tortuga 逻辑变更

#### 优先级 5: i18n 文件 (需要审查)
8. ❌ `public/locales/en/game-dicethrone.json` (-151 行)
9. ❌ `public/locales/zh-CN/game-dicethrone.json` (-157 行)

## 执行策略

### 阶段 1: 验证当前状态 ✅
- [x] 检查哪些文件已在后续提交中恢复
- [x] 确认仍需手动恢复的文件列表

### 阶段 2: 恢复关键功能 (进行中)
- [ ] 恢复 `Matches.tsx` 的 MatchDetailModal
- [ ] 验证功能正常工作

### 阶段 3: 恢复测试覆盖
- [ ] 恢复所有被删除的测试文件
- [ ] 运行测试确保通过

### 阶段 4: 恢复 UI 组件
- [ ] 恢复 Board.tsx 的功能
- [ ] 恢复 RematchActions.tsx 的可扩展性

### 阶段 5: 审查游戏逻辑变更
- [ ] 仔细审查 baseAbilities.ts 的变更
- [ ] 确定哪些是 POD 相关,哪些是意外变更

### 阶段 6: 审查 i18n 变更
- [ ] 审查 i18n 文件的删除
- [ ] 恢复功能性文本

## 风险评估

### 高风险
- `reducer.ts` - 已恢复 ✅
- `Matches.tsx` - 管理功能缺失

### 中风险
- 测试文件 - 测试覆盖率下降
- Board.tsx - 用户体验受影响

### 低风险
- i18n 文件 - 可能只是术语标准化

## 下一步行动

1. 立即恢复 `Matches.tsx` 的 MatchDetailModal
2. 运行 ESLint 和 TypeScript 检查
3. 测试管理页面功能
4. 继续恢复其他文件

## 注意事项

1. **不要盲目恢复**: 某些删除可能是合理的 POD 重构
2. **保留 POD 功能**: 恢复时不要覆盖 POD 相关的新增代码
3. **测试优先**: 每次恢复后立即测试
4. **文档同步**: 恢复代码时同步更新相关文档
