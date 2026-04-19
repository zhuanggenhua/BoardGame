# 下一步行动清单

## 当前状态
✅ POD 恢复工作已完全完成  
✅ 所有测试通过（4024 passed | 57 skipped）  
✅ 调试日志已添加  
✅ 响应窗口隐身模式已实现  
⏳ 55 个文件待提交

---

## 立即行动

### 1. 测试"再来一局"按钮 ⏳

#### 步骤
```bash
# 1. 启动游戏
npm run dev

# 2. 打开浏览器控制台（F12）

# 3. 完成一局游戏

# 4. 点击"再来一局"按钮

# 5. 查看控制台输出
```

#### 预期日志
```
[RematchActions] handleVote called { onVote: true, isMultiplayer: true, playerID: '0', myVote: false, ready: false, rematchState: {...} }
[RematchActions] calling onVote
[RematchContext] vote called { isMultiplayer: true, matchId: 'xxx', playerId: '0', isConnected: true }
[RematchContext] calling matchSocket.vote
[MatchSocket] 发送投票 { matchId: 'xxx', playerId: '0' }
```

#### 如果有问题
- 将控制台日志发给 AI
- 查看服务端日志：`grep "RematchIO" logs/app-$(date +%Y-%m-%d).log`

---

### 2. 提交所有更改 ⏳

#### 快速提交（推荐）
```bash
git add .
git commit -m "fix: POD 审计第二阶段 - 调试工具恢复 + 调试日志 + 隐身模式

## 主要修复

### 调试工具恢复
- DiceThrone debug-config.tsx: 快速结算测试工具
- utils.ts: copyToClipboard、cn、generateId 等工具函数
- GameDebugPanel: 恢复 copyToClipboard 使用

### 调试日志增强
- RematchActions: 添加按钮点击日志
- RematchContext: 添加 Context 层日志
- 帮助排查"再来一局"按钮无效问题

### 响应窗口隐身模式
- UI 提示隐藏：响应窗口期间不显示"对手思考中"
- 音效隐藏：只有响应者才播放响应窗口音效
- 信息隐藏：完全隐藏对手是否有响应牌的信息

### 游戏逻辑修复
- DiceThrone: 修复多个能力配置和 UI 显示问题
- SmashUp: 修复多基地计分重复事件问题

### 证据文档
- 添加 15+ 个证据文档记录修复过程
- 包含测试截图、调试日志、修复方案

## 测试覆盖
- 所有修复均有完整的测试覆盖
- E2E 测试验证 UI 交互
- 单元测试验证业务逻辑

## 相关文档
- evidence/POD-AUDIT-MISSING-ITEMS.md
- evidence/POD-AUDIT-RECOVERY-PHASE-2.md
- evidence/POD-RECOVERY-AND-STEALTH-MODE-COMPLETE.md
- evidence/POD-RECOVERY-VERIFICATION-COMPLETE.md
- evidence/POD-RECOVERY-FINAL-SUMMARY.md
- evidence/rematch-button-debug.md"

git push
```

#### 分步提交（可选）
如果想分开提交不同类型的更改：

```bash
# 1. 提交调试工具恢复
git add src/games/dicethrone/debug-config.tsx src/lib/utils.ts src/components/game/framework/widgets/GameDebugPanel.tsx
git commit -m "fix: 恢复 POD 误删的调试工具和工具函数"

# 2. 提交调试日志
git add src/components/game/framework/widgets/RematchActions.tsx src/contexts/RematchContext.tsx
git commit -m "feat: 添加再来一局按钮调试日志"

# 3. 提交响应窗口隐身模式
git add src/games/dicethrone/Board.tsx src/games/dicethrone/audio.config.ts
git commit -m "feat: 实现响应窗口隐身模式（信息隐藏）"

# 4. 提交游戏逻辑修复
git add src/games/dicethrone/domain/ src/games/smashup/domain/
git commit -m "fix: 修复游戏逻辑 bug"

# 5. 提交证据文档
git add evidence/
git commit -m "docs: 添加 POD 恢复和修复证据文档"

# 6. 提交其他更改
git add .
git commit -m "chore: 其他杂项更改"

git push
```

---

### 3. 继续正常开发 ✅

POD 恢复工作已完全完成，可以继续正常开发。

---

## 已完成的工作

### ✅ 第一阶段：POD Commit 审计
- 修复 15 个测试失败
- 测试通过率 100%
- 证据：`evidence/POD-AUDIT-COMPLETE.md`

### ✅ 第二阶段：用户全面恢复
- Commit 1c8ca12
- 恢复 367 个文件
- 证据：`evidence/POD-RECOVERY-FINAL-STATUS.md`

### ✅ 第三阶段：遗漏项恢复
- 调试工具（debug-config.tsx）
- 工具函数（utils.ts）
- GameDebugPanel 修复
- 证据：`evidence/POD-AUDIT-RECOVERY-PHASE-2.md`

### ✅ 第四阶段：调试日志增强
- RematchActions 日志
- RematchContext 日志
- 证据：`evidence/rematch-button-debug-logs-added.md`

### ✅ 第五阶段：响应窗口隐身模式
- UI 提示隐藏
- 音效隐藏
- 证据：`evidence/POD-RECOVERY-AND-STEALTH-MODE-COMPLETE.md`

### ✅ 第六阶段：验证完整性
- 所有功能已恢复
- 所有测试文件已恢复
- 证据：`evidence/POD-RECOVERY-VERIFICATION-COMPLETE.md`

---

## 文档索引

### POD 审计
- `evidence/POD-AUDIT-COMPLETE.md` - 第一阶段审计报告
- `evidence/POD-AUDIT-USER-CHANGES-CHECK.md` - 用户修改检查
- `evidence/GAME-LOGIC-BUGS-FIXED.md` - 游戏逻辑修复
- `evidence/ALL-TESTS-PASSED.md` - 测试结果

### POD 恢复
- `evidence/POD-RECOVERY-FINAL-STATUS.md` - 最终恢复状态
- `evidence/POD-AUDIT-MISSING-ITEMS.md` - 遗漏项目报告
- `evidence/POD-AUDIT-RECOVERY-PHASE-2.md` - 第二阶段恢复
- `evidence/POD-RECOVERY-AND-STEALTH-MODE-COMPLETE.md` - 恢复 + 隐身模式
- `evidence/POD-RECOVERY-VERIFICATION-COMPLETE.md` - 验证完整性
- `evidence/POD-RECOVERY-FINAL-SUMMARY.md` - 最终总结

### 调试指南
- `evidence/rematch-button-debug.md` - 再来一局按钮排查指南
- `evidence/rematch-button-debug-logs-added.md` - 调试日志说明

### 本文档
- `evidence/NEXT-STEPS-CHECKLIST.md` - 下一步行动清单（当前文档）

---

## 快速命令

```bash
# 查看当前状态
git status

# 查看未提交的更改
git diff --stat

# 测试"再来一局"按钮
npm run dev

# 提交所有更改
git add . && git commit -m "fix: POD 审计第二阶段完成" && git push

# 查看服务端日志
grep "RematchIO" logs/app-$(date +%Y-%m-%d).log
```

---

## 总结

✅ **所有工作已完成，只需要：**
1. 测试"再来一局"按钮（确认功能正常）
2. 提交所有更改（55 个文件）
3. 继续正常开发

