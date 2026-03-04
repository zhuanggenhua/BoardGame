# Implementation Tasks

## Phase 1: Critical Issues (Priority: Highest)

### Task 1.1: 太极回合限制逻辑恢复
- [ ] 1.1.1 使用 grepSearch 搜索 "太极" 或 "taichi" 定位相关代码
- [ ] 1.1.2 使用 `git show 6ea1f9f^:src/games/dicethrone/domain/characters.ts` 查看删除前的代码
- [ ] 1.1.3 对比当前代码，确认回合限制逻辑是否被删除
- [ ] 1.1.4 恢复被删除的回合限制逻辑到正确位置
- [ ] 1.1.5 使用 GameTestRunner 编写测试验证修复（测试太极技能在同一回合内的使用限制）
- [ ] 1.1.6 运行测试确认修复正确

### Task 1.2: 响应窗口视角自动切换恢复
- [ ] 1.2.1 使用 grepSearch 搜索 "responseWindow" 和 "viewMode" 定位相关代码
- [ ] 1.2.2 使用 git diff 查看 6ea1f9f 前后的变更
- [ ] 1.2.3 确认视角切换逻辑是否被删除（可能在 GameHUD.tsx 或 ResponseWindowSystem.ts）
- [ ] 1.2.4 恢复被删除的视角切换逻辑
- [ ] 1.2.5 使用 E2E 测试验证修复（测试响应窗口触发时视角自动切换）
- [ ] 1.2.6 运行测试确认修复正确

### Task 1.3: 变体排序逻辑恢复
- [ ] 1.3.1 使用 grepSearch 搜索 "variant" 和 "sort" 定位相关代码
- [ ] 1.3.2 使用 git show 查看 6ea1f9f 之前的排序逻辑
- [ ] 1.3.3 确认排序逻辑是否被删除（可能在大厅或游戏选择组件）
- [ ] 1.3.4 恢复被删除的排序逻辑
- [ ] 1.3.5 手动测试验证修复（检查变体列表显示顺序）
- [ ] 1.3.6 记录修复结果到 tmp/phase1-critical-fixes.md

## Phase 2: DiceThrone Module Audit (106 files)

### Task 2.1: 测试文件删除审计
- [ ] 2.1.1 审计 monk-coverage.test.ts（127 行被删除）
  - [ ] 使用 `git show 6ea1f9f^:src/games/dicethrone/__tests__/monk-coverage.test.ts` 查看原内容
  - [ ] 确认测试是否仍然需要
  - [ ] 如需要则恢复，否则记录删除理由
- [ ] 2.1.2 审计 shield-cleanup.test.ts（188 行被删除）
  - [ ] 使用 git show 查看原内容
  - [ ] 确认测试是否仍然需要
  - [ ] 如需要则恢复，否则记录删除理由
- [ ] 2.1.3 审计 viewMode.test.ts（81 行被删除）
  - [ ] 使用 git show 查看原内容
  - [ ] 确认测试是否仍然需要
  - [ ] 如需要则恢复，否则记录删除理由
- [ ] 2.1.4 审计 actionLogFormat.test.ts（45 行被删除）
  - [ ] 使用 git show 查看原内容
  - [ ] 确认测试是否仍然需要
  - [ ] 如需要则恢复，否则记录删除理由
- [ ] 2.1.5 记录审计结果到 tmp/phase2-dicethrone-tests.md

### Task 2.2: 功能代码删除审计
- [ ] 2.2.1 审计 debug-config.tsx（77 行被删除）
  - [ ] 使用 git show 查看原内容
  - [ ] 确认功能是否仍然需要
  - [ ] 如需要则恢复，否则记录删除理由
- [ ] 2.2.2 审计 domain/characters.ts（29 行被删除）
  - [ ] 使用 git show 查看原内容
  - [ ] 确认是否与太极回合限制相关
  - [ ] 如需要则恢复，否则记录删除理由
- [ ] 2.2.3 记录审计结果到 tmp/phase2-dicethrone-code.md

### Task 2.3: Board.tsx 变更审计
- [ ] 2.3.1 使用 `git diff 6ea1f9f^..6ea1f9f -- src/games/dicethrone/Board.tsx` 查看变更
- [ ] 2.3.2 逐段审查 161 行变更，确认每个删除是否合理
- [ ] 2.3.3 使用 grepSearch 查找被删除代码的引用
- [ ] 2.3.4 恢复必要的代码或记录删除理由
- [ ] 2.3.5 运行 DiceThrone E2E 测试验证无回归
- [ ] 2.3.6 记录审计结果到 tmp/phase2-dicethrone-board.md

### Task 2.4: 其他 DiceThrone 文件审计
- [ ] 2.4.1 列出所有 DiceThrone 相关文件变更（使用 git diff --name-status）
- [ ] 2.4.2 按优先级排序（删除行数多的优先）
- [ ] 2.4.3 逐个审计剩余文件
- [ ] 2.4.4 记录审计结果到 tmp/phase2-dicethrone-other.md

## Phase 3: Engine Layer Audit (10+ files)

### Task 3.1: pipeline.ts 审计（111 行变更）
- [x] 3.1.1 使用 git diff 查看 pipeline.ts 的变更
- [x] 3.1.2 识别所有删除的代码段
- [x] 3.1.3 使用 grepSearch 查找被删除代码的引用
- [x] 3.1.4 确认每个删除是否影响命令执行流程
- [ ] 3.1.5 运行所有游戏的测试验证无回归
- [x] 3.1.6 记录审计结果到 tmp/phase3-engine-pipeline.md

### Task 3.2: useEventStreamCursor.ts 审计（107 行变更）
- [ ] 3.2.1 使用 git diff 查看变更
- [ ] 3.2.2 确认事件流游标逻辑是否受影响
- [ ] 3.2.3 运行事件流相关测试
- [ ] 3.2.4 记录审计结果到 tmp/phase3-engine-eventstream.md

### Task 3.3: actionLogHelpers.ts 审计（204 行变更）
- [x] 3.3.1 使用 git diff 查看变更
- [x] 3.3.2 确认日志格式化逻辑是否受影响
- [x] 3.3.3 检查是否影响伤害来源标注
- [ ] 3.3.4 运行日志相关测试
- [x] 3.3.5 记录审计结果到 tmp/phase3-engine-actionlog.md

### Task 3.4: transport/server.ts 审计（247 行变更）
- [x] 3.4.1 使用 git diff 查看变更
- [x] 3.4.2 确认传输层逻辑是否受影响
- [x] 3.4.3 检查 WebSocket 通信是否正常
- [ ] 3.4.4 运行联机模式测试
- [x] 3.4.5 记录审计结果到 tmp/phase3-engine-transport-server.md

### Task 3.5: FlowSystem.ts 审计（7 行删除）
- [ ] 3.5.1 使用 git diff 查看删除的代码
- [ ] 3.5.2 确认流程控制逻辑是否受影响
- [ ] 3.5.3 运行流程相关测试
- [ ] 3.5.4 记录审计结果到 tmp/phase3-engine-flow.md

### Task 3.6: 其他引擎层文件审计
- [ ] 3.6.1 列出所有引擎层文件变更
- [ ] 3.6.2 逐个审计剩余文件
- [ ] 3.6.3 记录审计结果到 tmp/phase3-engine-other.md

## Phase 4: Framework Layer Audit

### Task 4.1: GameHUD.tsx 审计（118 行变更）
- [x] 4.1.1 使用 git diff 查看变更
- [x] 4.1.2 确认 HUD 显示逻辑是否受影响
- [x] 4.1.3 检查是否与响应窗口视角切换相关
- [x] 4.1.4 运行所有游戏的 E2E 测试验证 HUD 显示
- [x] 4.1.5 记录审计结果到 tmp/phase4-framework-hud.md

### Task 4.2: RematchActions.tsx 审计（177 行变更）
- [x] 4.2.1 使用 git diff 查看变更
- [x] 4.2.2 确认重赛逻辑是否受影响
- [x] 4.2.3 测试重赛功能
- [x] 4.2.4 记录审计结果到 tmp/phase4-framework-rematch.md

### Task 4.3: useAutoSkipPhase.ts 审计（24 行变更）
- [x] 4.3.1 使用 git diff 查看变更
- [x] 4.3.2 确认自动跳过阶段逻辑是否受影响
- [x] 4.3.3 测试自动跳过功能
- [x] 4.3.4 记录审计结果到 tmp/phase4-framework-autoskip.md

### Task 4.4: 其他框架层文件审计
- [x] 4.4.1 列出所有框架层文件变更
- [x] 4.4.2 逐个审计剩余文件
- [x] 4.4.3 记录审计结果到 tmp/phase4-framework-other.md

## Phase 5: SummonerWars Module Audit (18 files)

### Task 5.1: SummonerWars 文件变更列表
- [ ] 5.1.1 使用 git diff 列出所有 SummonerWars 文件变更
- [ ] 5.1.2 按变更行数排序
- [ ] 5.1.3 记录到 tmp/phase5-summonerwars-list.md

### Task 5.2: SummonerWars 系统性审计
- [ ] 5.2.1 逐个审计 18 个文件的变更
- [ ] 5.2.2 确认无功能缺失
- [ ] 5.2.3 运行 SummonerWars 测试套件
- [ ] 5.2.4 记录审计结果到 tmp/phase5-summonerwars-audit.md

## Phase 6: Other Modules Audit

### Task 6.1: i18n 文件审计（16 个文件）
- [ ] 6.1.1 列出所有 i18n 文件变更
- [ ] 6.1.2 验证翻译完整性（中英文对照）
- [ ] 6.1.3 确认无翻译缺失
- [ ] 6.1.4 记录审计结果到 tmp/phase6-i18n.md

### Task 6.2: 通用组件审计
- [ ] 6.2.1 列出所有通用组件变更
- [ ] 6.2.2 确认组件功能完整性
- [ ] 6.2.3 测试组件在各游戏中的使用
- [ ] 6.2.4 记录审计结果到 tmp/phase6-components.md

### Task 6.3: Context 层审计
- [ ] 6.3.1 列出所有 Context 变更
- [ ] 6.3.2 确认全局状态管理正常
- [ ] 6.3.3 测试 Context 功能
- [ ] 6.3.4 记录审计结果到 tmp/phase6-contexts.md

### Task 6.4: 大厅/社交系统审计
- [ ] 6.4.1 列出大厅和社交系统变更
- [ ] 6.4.2 确认功能完整性
- [ ] 6.4.3 测试大厅和社交功能
- [ ] 6.4.4 记录审计结果到 tmp/phase6-lobby-social.md

## Phase 7: Cross-Module Integration Testing

### Task 7.1: 跨游戏功能测试
- [ ] 7.1.1 运行所有游戏的完整测试套件
- [ ] 7.1.2 记录测试结果（通过率、失败用例）
- [ ] 7.1.3 修复发现的问题
- [ ] 7.1.4 记录到 tmp/phase7-cross-game-tests.md

### Task 7.2: 引擎层影响范围测试
- [ ] 7.2.1 测试命令执行流程（所有游戏）
- [ ] 7.2.2 测试事件流系统（所有游戏）
- [ ] 7.2.3 测试状态管理（所有游戏）
- [ ] 7.2.4 记录到 tmp/phase7-engine-impact.md

### Task 7.3: 框架层向后兼容性测试
- [ ] 7.3.1 测试 GameHUD 在所有游戏中的显示
- [ ] 7.3.2 测试重赛功能在所有游戏中的行为
- [ ] 7.3.3 测试自动跳过功能在所有游戏中的行为
- [ ] 7.3.4 记录到 tmp/phase7-framework-compat.md

## Phase 8: Documentation and Cleanup

### Task 8.1: 汇总审计发现
- [x] 8.1.1 收集所有 tmp/ 目录下的审计报告
- [x] 8.1.2 生成综合审计报告
- [x] 8.1.3 列出所有已修复的问题
- [x] 8.1.4 列出所有确认删除的代码及理由
- [x] 8.1.5 保存到 tmp/final-audit-report.md

### Task 8.2: 更新相关文档
- [x] 8.2.1 更新 AGENTS.md（如有架构变更）
- [x] 8.2.2 更新游戏规则文档（如有规则变更）
- [x] 8.2.3 更新测试文档（如有测试策略变更）

### Task 8.3: 清理临时文件
- [x] 8.3.1 审查 tmp/ 目录下的所有文件
- [x] 8.3.2 保留有价值的审计报告
- [x] 8.3.3 删除临时工作文件
- [x] 8.3.4 提交最终审计报告到 git

## Completion Criteria

所有任务完成后，应满足以下条件：

1. ✅ 3 个严重问题已修复并通过测试
2. ✅ 所有 379 个文件的变更已被审计
3. ✅ 所有被删除的代码要么已恢复，要么有明确的删除理由
4. ✅ 所有游戏的测试套件通过率不低于审计前
5. ✅ 综合审计报告已生成并保存
6. ✅ 相关文档已更新
