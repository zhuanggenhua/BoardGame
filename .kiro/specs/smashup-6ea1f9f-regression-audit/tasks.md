# Tasks: Commit 6ea1f9f 全面审计

## Task 1: 验证已知问题修复状态 ⏳
**优先级**: P0  
**预计时间**: 30 分钟  
**负责人**: AI Agent

### 目标
验证已知的两个关键 bug 的修复状态：
1. Killer Queen talent 过滤条件
2. ResponseWindowSystem 配置

### 步骤
1. 读取 `src/games/smashup/abilities/giant_ants.ts` 确认 Killer Queen 修复
2. 读取 `src/games/smashup/game.ts` 确认 ResponseWindowSystem 配置
3. 运行相关测试验证修复有效性
4. 记录修复状态

### 验收标准
- [ ] Killer Queen talent 包含 `playedThisTurn` 过滤条件
- [ ] Killer Queen talent 包含 `uid !== ctx.cardUid` 过滤条件
- [ ] ResponseWindowSystem 包含 `'su:play_minion'` 在 `allowedCommands` 中
- [ ] ResponseWindowSystem 包含 `'su:play_minion': ['meFirst']` 在 `commandWindowTypeConstraints` 中
- [ ] ResponseWindowSystem 包含 `{ eventType: 'su:minion_played', windowTypes: ['meFirst'] }` 在 `responseAdvanceEvents` 中
- [ ] `hasRespondableContent` 检查 `beforeScoringPlayable` 随从
- [ ] `newFactionAbilities.test.ts` 中的 Killer Queen 测试通过
- [ ] `meFirst.test.ts` 测试通过

### 输出
- 已知问题修复状态报告（`tmp/task1-known-issues-status.md`）

---

## Task 2: 全面检查 powerCounters vs powerModifier ⏳
**优先级**: P1  
**预计时间**: 1 小时  
**负责人**: AI Agent

### 目标
检查所有 ability 文件中是否存在 `powerCounters` 错误替换为 `powerModifier` 的问题。

### 步骤
1. 运行 `grep -rn "powerModifier" src/games/smashup/abilities/` 搜索所有使用
2. 对比原始正确版本（commit 232214d）确认哪些是错误替换
3. 读取每个有问题的文件确认当前状态
4. 记录所有问题和修复状态
5. 对于未修复的问题，使用 `strReplace` 修复

### 已知问题文件
- `src/games/smashup/abilities/giant_ants.ts` - 兵蚁 talent、雄蜂 protection
- `src/games/smashup/abilities/ongoing_modifiers.ts` - 如同魔法、我们将震撼你、承受压力、我们乃最强

### 验收标准
- [ ] 所有应该使用 `powerCounters` 的地方都使用了正确的字段名
- [ ] 没有错误使用 `powerModifier` 的地方（除非是临时力量修正）
- [ ] 所有相关测试通过

### 输出
- 字段名错误清单和修复状态报告（`tmp/task2-field-name-audit.md`）

---

## Task 3: 全面检查过滤条件 ⏳
**优先级**: P1  
**预计时间**: 2 小时  
**负责人**: AI Agent

### 目标
检查所有 ability 文件中的过滤条件是否完整，是否有误删除的关键条件。

### 步骤
1. 运行 `git diff 232214d^..6ea1f9f -- src/games/smashup/abilities/ | grep -B5 -A5 "\.filter"` 获取所有 filter 变更
2. 对每个变更的 filter 调用：
   - 确认是否删除了 `playedThisTurn` 检查
   - 确认是否删除了 `controller` 检查
   - 确认是否删除了 `uid !== xxx` 检查
   - 确认是否删除了其他关键条件
3. 读取当前代码确认修复状态
4. 对于未修复的问题，使用 `strReplace` 修复

### 检查范围
所有 ability 文件：
- `aliens.ts`
- `bear_cavalry.ts`
- `cthulhu.ts`
- `dinosaurs.ts`
- `elder_things.ts`
- `frankenstein.ts`
- `ghosts.ts`
- `giant_ants.ts` (已知问题)
- `innsmouth.ts`
- `miskatonic.ts`
- `ninjas.ts`
- `ongoing_modifiers.ts`
- `pirates.ts`
- `robots.ts`
- `steampunks.ts`
- `tricksters.ts`
- `vampires.ts`
- `zombies.ts`

### 验收标准
- [ ] 所有 filter 调用都包含必要的过滤条件
- [ ] 没有误删除的关键条件
- [ ] 所有相关测试通过

### 输出
- 过滤条件缺失清单和修复状态报告（`tmp/task3-filter-audit.md`）

---

## Task 4: 检查验证逻辑 ⏳
**优先级**: P2  
**预计时间**: 1.5 小时  
**负责人**: AI Agent

### 目标
检查所有 ability 文件中的 `validate` 函数是否完整，是否有误删除的前置条件检查。

### 步骤
1. 运行 `git diff 232214d^..6ea1f9f -- src/games/smashup/abilities/ | grep -B10 -A10 "validate:"` 获取所有 validate 变更
2. 对每个变更的 validate 函数：
   - 确认是否删除了前置条件检查
   - 确认是否删除了资源检查
   - 确认是否删除了目标有效性检查
3. 读取当前代码确认修复状态
4. 对于未修复的问题，使用 `strReplace` 修复

### 验收标准
- [ ] 所有 validate 函数都包含必要的前置条件检查
- [ ] 没有误删除的检查逻辑
- [ ] 所有相关测试通过

### 输出
- 验证逻辑问题清单和修复状态报告（`tmp/task4-validation-audit.md`）

---

## Task 5: 检查事件处理 ⏳
**优先级**: P2  
**预计时间**: 1.5 小时  
**负责人**: AI Agent

### 目标
检查所有 ability 文件中的事件处理是否正确，是否有错误的事件类型或缺失的事件。

### 步骤
1. 运行 `git diff 232214d^..6ea1f9f -- src/games/smashup/abilities/ | grep -B5 -A5 "eventType:"` 获取所有事件变更
2. 对每个变更的事件：
   - 确认事件类型是否正确
   - 确认事件 payload 是否完整
   - 确认是否缺少必要的事件
3. 读取当前代码确认修复状态
4. 对于未修复的问题，使用 `strReplace` 修复

### 验收标准
- [ ] 所有事件类型正确
- [ ] 所有事件 payload 完整
- [ ] 没有缺失的必要事件
- [ ] 所有相关测试通过

### 输出
- 事件处理问题清单和修复状态报告（`tmp/task5-event-audit.md`）

---

## Task 6: 检查测试覆盖 ⏳
**优先级**: P3  
**预计时间**: 1 小时  
**负责人**: AI Agent

### 目标
检查测试文件的变更，确认是否有删除的关键测试用例，测试断言是否正确。

### 步骤
1. 运行 `git diff 232214d^..6ea1f9f --stat -- src/games/smashup/__tests__/` 获取测试文件变更统计
2. 运行 `git diff 232214d^..6ea1f9f -- src/games/smashup/__tests__/ | grep -E "^-.*test\(|^-.*it\("` 查找删除的测试
3. 对每个有大量删除的测试文件：
   - 确认删除的测试是否关键
   - 确认是否有替代的测试覆盖
4. 记录测试覆盖问题

### 检查范围
所有测试文件，重点关注：
- `factionAbilities.test.ts` (301 +-----------------)
- `newOngoingAbilities.test.ts` (303 +-------------------)
- `specialInteractionChain.test.ts` (172 +----------)
- `zombieInteractionChain.test.ts` (70 +----)

### 验收标准
- [ ] 没有删除关键测试用例
- [ ] 所有测试断言正确
- [ ] 测试覆盖完整

### 输出
- 测试覆盖问题清单（`tmp/task6-test-coverage-audit.md`）

---

## Task 7: 检查领域层文件 ⏳
**优先级**: P2  
**预计时间**: 1 小时  
**负责人**: AI Agent

### 目标
检查领域层文件（`domain/*.ts`）的变更，确认类型定义、工具函数、Reducer 逻辑是否正确。

### 步骤
1. 对每个领域层文件：
   - 读取 git diff 确认变更内容
   - 确认类型定义是否正确
   - 确认工具函数是否正确
   - 确认 Reducer 逻辑是否正确
2. 记录发现的问题

### 检查范围
- `domain/abilityHelpers.ts`
- `domain/abilityInteractionHandlers.ts`
- `domain/abilityRegistry.ts`
- `domain/baseAbilities.ts`
- `domain/baseAbilities_expansion.ts`
- `domain/commands.ts`
- `domain/events.ts`
- `domain/ids.ts`
- `domain/index.ts`
- `domain/ongoingEffects.ts`
- `domain/ongoingModifiers.ts`
- `domain/reduce.ts`
- `domain/reducer.ts`
- `domain/systems.ts`
- `domain/types.ts`

### 验收标准
- [ ] 所有类型定义正确
- [ ] 所有工具函数正确
- [ ] 所有 Reducer 逻辑正确
- [ ] 没有引入新的 bug

### 输出
- 领域层问题清单（`tmp/task7-domain-audit.md`）

---

## Task 8: 运行所有测试 ⏳
**优先级**: P0  
**预计时间**: 30 分钟  
**负责人**: AI Agent

### 目标
运行所有 SmashUp 测试，确认所有修复有效，没有回归问题。

### 步骤
1. 运行 `npm test -- smashup` 运行所有 SmashUp 测试
2. 记录测试结果
3. 对于失败的测试，分析原因并修复

### 验收标准
- [ ] 所有 SmashUp 测试通过（或只有已知的 skipped 测试）
- [ ] 没有新的测试失败
- [ ] 所有修复的 bug 都有测试覆盖

### 输出
- 测试结果报告（`tmp/task8-test-results.md`）

---

## Task 9: 编写审计总结报告 ⏳
**优先级**: P0  
**预计时间**: 30 分钟  
**负责人**: AI Agent

### 目标
编写完整的审计报告，总结所有发现的问题、修复状态、测试结果。

### 步骤
1. 汇总所有任务的输出
2. 编写审计总结报告，包括：
   - 审计范围
   - 发现的问题清单
   - 修复状态
   - 测试结果
   - 遗留问题（如果有）
   - 建议和改进措施
3. 更新 spec 状态为 completed

### 验收标准
- [ ] 审计报告完整
- [ ] 所有问题都有记录
- [ ] 所有修复都有验证
- [ ] 没有遗漏的回归问题

### 输出
- 审计总结报告（`tmp/6ea1f9f-audit-final-report.md`）

---

## 进度跟踪

| Task | 状态 | 开始时间 | 完成时间 | 备注 |
|------|------|----------|----------|------|
| Task 1 | ⏳ 待开始 | - | - | 验证已知问题修复状态 |
| Task 2 | ⏳ 待开始 | - | - | 检查 powerCounters vs powerModifier |
| Task 3 | ⏳ 待开始 | - | - | 检查过滤条件 |
| Task 4 | ⏳ 待开始 | - | - | 检查验证逻辑 |
| Task 5 | ⏳ 待开始 | - | - | 检查事件处理 |
| Task 6 | ⏳ 待开始 | - | - | 检查测试覆盖 |
| Task 7 | ⏳ 待开始 | - | - | 检查领域层文件 |
| Task 8 | ⏳ 待开始 | - | - | 运行所有测试 |
| Task 9 | ⏳ 待开始 | - | - | 编写审计总结报告 |

## 依赖关系

```
Task 1 (P0) ─┐
             ├─→ Task 8 (P0) ─→ Task 9 (P0)
Task 2 (P1) ─┤
Task 3 (P1) ─┤
Task 4 (P2) ─┤
Task 5 (P2) ─┤
Task 6 (P3) ─┤
Task 7 (P2) ─┘
```

- Task 1-7 可以并行执行（但建议按优先级顺序）
- Task 8 依赖 Task 1-7 的修复完成
- Task 9 依赖 Task 8 的测试结果

## 风险和缓解

### 风险 1：审计时间超出预期
- **影响**：可能无法在预期时间内完成
- **缓解**：优先完成 P0 和 P1 任务，P2/P3 任务可以延后

### 风险 2：发现大量未知问题
- **影响**：修复工作量增加
- **缓解**：记录所有问题，优先修复 P0/P1 问题，P2/P3 问题可以后续处理

### 风险 3：修复引入新问题
- **影响**：测试失败，需要额外调试
- **缓解**：每次修复后立即运行相关测试，及时发现问题

### 风险 4：原始正确版本难以确定
- **影响**：无法判断某些变更是否为 bug
- **缓解**：使用 commit 232214d 作为基准，必要时追溯更早的版本或查看 git blame