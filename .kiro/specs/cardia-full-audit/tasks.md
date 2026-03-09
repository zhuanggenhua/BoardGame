# Implementation Plan: Cardia 游戏全面审计

## Overview

本任务列表基于已完成的 requirements.md 和 design.md，按照 4 个阶段组织审计工作：

- **Phase 1: 静态检查**（1-2 天）：运行静态扫描工具，发现代码模式问题
- **Phase 2: 单元测试**（2-3 天）：运行 Property 测试和 GameTestRunner，验证单个能力正确性
- **Phase 3: 集成测试**（2-3 天）：运行组合场景测试，验证多机制协作
- **Phase 4: E2E 测试**（3-4 天）：运行完整流程测试，验证 UI 交互

每个阶段独立可验证，前一阶段完成后才能进入下一阶段。所有 P0 问题必须在进入下一阶段前修复。

## Tasks

### Phase 1: 静态检查（1-2 天）

- [x] 1. 创建静态扫描工具基础设施
  - [x] 1.1 创建 `scripts/audit/` 目录和工具模板
    - 创建 `scripts/audit/utils.mjs`（通用工具函数：文件扫描、问题生成、报告输出）
    - 创建 `scripts/audit/types.d.ts`（TypeScript 类型定义：Issue、ScanResult、AuditConfig）
    - _Requirements: 20.2_
  
  - [x] 1.2 创建 `check-displaymode.mjs` 静态扫描工具
    - 扫描所有 `createSimpleChoice` 调用
    - 检查是否显式声明 `displayMode: 'card' | 'button'`
    - 生成问题列表（维度 D46）
    - _Requirements: 15.1, 15.2, 15.3_
  
  - [x] 1.3 创建 `check-play-constraint.mjs` 静态扫描工具
    - 扫描所有 ongoing 行动卡定义
    - 检查是否有 `playConstraint` 声明（如果描述中有条件性打出目标）
    - 生成问题列表（维度 D2 子项）
    - _Requirements: 2.1, 2.2, 2.3_
  
  - [x] 1.4 创建 `check-grant-extra-payload.mjs` 静态扫描工具
    - 扫描所有 `grantExtraMinion`/`grantExtraAction` 调用
    - 检查 payload 是否包含完整的约束信息（targetType、playConstraint 等）
    - 生成问题列表（维度 D2 子项）
    - _Requirements: 2.1, 2.2, 2.4_
  
  - [x] 1.5 创建 `check-ability-tags.mjs` 静态扫描工具
    - 扫描所有卡牌定义的 `abilityTags`
    - 检查 `abilityTags: ['special']` 是否与实际触发机制一致
    - 主动激活能力应有 `special` 标签，被动触发器不应有
    - 生成问题列表（维度 D49）
    - _Requirements: 16.1, 16.2, 16.3_

- [x] 2. 运行静态扫描并生成初步问题列表
  - [x] 2.1 运行所有静态扫描工具
    - 执行 `node scripts/audit/check-displaymode.mjs > reports/audit-phase1-displaymode.json`
    - 执行 `node scripts/audit/check-play-constraint.mjs > reports/audit-phase1-play-constraint.json`
    - 执行 `node scripts/audit/check-grant-extra-payload.mjs > reports/audit-phase1-grant-extra.json`
    - 执行 `node scripts/audit/check-ability-tags.mjs > reports/audit-phase1-ability-tags.json`
    - _Requirements: 20.1, 20.2_
  
  - [x] 2.2 汇总问题列表并按优先级排序
    - 合并所有 JSON 报告
    - 按优先级排序（P0 > P1 > P2）
    - 生成 `reports/audit-phase1-issues.json`
    - _Requirements: 19.1_
  
  - [x] 2.3 生成 Phase 1 审计报告
    - 生成 `reports/audit-phase1-report.md`（Markdown 格式）
    - 包含问题列表、汇总统计、维度覆盖情况
    - _Requirements: 19.1, 19.2_

- [x] 3. 修复 Phase 1 发现的 P0 问题
  - [x] 3.1 审查所有 P0 问题
    - 人工审查每个 P0 问题，确认是否为真实问题
    - 标注误报（添加 `// audit-ignore` 注释）
    - _Requirements: 19.1_
  
  - [x] 3.2 修复所有 P0 问题
    - 逐个修复 P0 问题
    - 每个修复提交一个 commit（commit message 包含问题 ID）
    - _Requirements: 19.4_
  
  - [x] 3.3 验证 P0 问题修复
    - 重新运行静态扫描工具
    - 确认所有 P0 问题已修复
    - _Requirements: 19.4_

- [x] 4. Checkpoint - Phase 1 完成验证
  - 确认所有静态扫描工具运行成功
  - 确认所有 P0 问题已修复
  - 确认 Phase 1 报告已生成
  - 询问用户是否继续进入 Phase 2

### Phase 2: 单元测试（2-3 天）

- [x] 5. 运行 Property 测试验证注册表完整性
  - [x] 5.1 运行 `ability-registry-completeness.test.ts`
    - 验证所有能力都已注册到 `abilityRegistry`
    - 验证所有能力都有对应的执行器
    - _Requirements: 3.1, 3.3, 3.4_
  
  - [x] 5.2 运行 `verify-executors.test.ts`
    - 验证所有执行器都已注册到 `abilityExecutorRegistry`
    - 验证执行器签名与能力定义一致
    - _Requirements: 3.1, 3.3, 3.4_
  
  - [x] 5.3 修复注册表完整性问题
    - 补充缺失的能力注册
    - 补充缺失的执行器注册
    - _Requirements: 3.1_

- [x] 6. 运行 GameTestRunner 测试验证能力行为
  - [x] 6.1 运行所有 Cardia 单元测试
    - 执行 `npm run test:games -- cardia`
    - 记录所有失败的测试
    - _Requirements: 18.1_
  
  - [x] 6.2 检查测试覆盖率
    - 执行 `npm run test:coverage -- cardia`
    - 生成覆盖率报告（HTML 格式）
    - 确认行覆盖率 ≥ 80%
    - _Requirements: 18.1_
  
  - [x] 6.3 识别缺失的测试用例
    - 对照 D1-D49 维度，识别未覆盖的检查点
    - 对照 Deck I 卡牌清单，识别未测试的卡牌
    - 生成缺失测试清单
    - _Requirements: 18.1_

- [-] 7. 补充缺失的单元测试
  - [x] 7.1 补充描述→实现一致性测试（D1）
    - 为每张 Deck I 卡牌创建测试用例
    - 验证能力效果与描述一致（语义保真、实体筛选范围、替代/防止语义、力量修正主语）
    - _Requirements: 1.1, 1.2, 1.3_
  
  - [x] 7.2 补充验证-执行前置条件对齐测试（D2）
    - 验证验证层和执行层的前置条件一致
    - 验证边界完整、概念载体覆盖、打出约束、额度授予约束
    - _Requirements: 2.1, 2.2, 2.3, 2.4_
  
  - [x] 7.3 补充副作用传播完整性测试（D6）
    - 验证弃牌能力触发"弃牌时"触发器
    - 验证修正标记添加触发"影响力变化时"触发器
    - 验证印戒移动触发"印戒变化时"触发器
    - _Requirements: 5.1, 5.2_
  
  - [x] 7.4 补充验证层有效性门控测试（D7）
    - 验证有代价的能力在必然无效果时被拒绝
    - 验证 `quickCheck` 与 `customValidator` 前置条件对齐
    - _Requirements: 6.1, 6.2, 6.3, 6.4_
  
  - [x] 7.5 补充引擎批处理时序测试（D8）
    - 验证阶段结束技能时序（阶段结束时需要玩家确认的技能是否正确阻止阶段推进）
    - 验证事件产生门控普适性（门控函数是否对所有同类技能生效）
    - 验证写入-消费窗口对齐（状态写入时机是否在消费窗口内）
    - 验证交互解决后自动推进（交互解决后是否自动恢复流程推进）
    - _Requirements: 7.1, 7.2, 7.3, 7.4_
  
  - [x] 7.6 补充 Reducer 消耗路径测试（D11-D14）
    - 验证 Reducer 消耗路径（事件写入的资源/额度/状态在 reducer 消耗时走的分支是否正确）
    - 验证写入-消耗对称（能力/事件写入的字段在所有消费点是否被正确读取和消耗）
    - 验证多来源竞争（同一资源有多个写入来源时，消耗逻辑是否正确区分来源）
    - 验证回合清理完整（回合/阶段结束时临时状态是否全部正确清理）
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

- [ ] 8. 修复 Phase 2 发现的 P0/P1 问题
  - [x] 8.1 修复所有 P0 问题
    - 逐个修复 P0 问题
    - 每个修复提交一个 commit（commit message 包含问题 ID）
    - _Requirements: 19.4_
  
  - [x] 8.2 修复所有 P1 问题
    - 逐个修复 P1 问题
    - 每个修复提交一个 commit（commit message 包含问题 ID）
    - _Requirements: 19.4_
  
  - [x] 8.3 验证问题修复
    - 重新运行所有单元测试
    - 确认所有测试通过
    - 确认测试覆盖率 ≥ 80%
    - _Requirements: 19.4_

- [x] 9. 生成 Phase 2 审计报告
  - 生成 `reports/audit-phase2-report.md`（Markdown 格式）
  - 生成 `reports/audit-phase2-coverage.html`（测试覆盖率报告）
  - 生成 `reports/audit-phase2-issues.json`（新发现的问题列表）
  - _Requirements: 19.1, 19.2_

- [x] 10. Checkpoint - Phase 2 完成验证
  - 确认所有单元测试通过
  - 确认测试覆盖率 ≥ 80%
  - 确认所有 P0 问题已修复，P1 问题已记录
  - 询问用户是否继续进入 Phase 3

### Phase 3: 集成测试（2-3 天）

- [x] 11. 运行集成测试验证组合场景
  - [x] 11.1 运行 `integration-ongoing-abilities.test.ts`
    - 验证持续能力 + 修正标记的叠加效果
    - 验证多个持续能力同时生效的优先级
    - _Requirements: 10.1, 10.2_
  
  - [x] 11.2 运行 `integration-ability-copy.test.ts`
    - 验证复制能力 + 被复制能力的交互
    - 验证复制能力的上下文传递
    - _Requirements: 10.1, 10.2_
  
  - [x] 11.3 运行 `interaction.test.ts`
    - 验证交互链的创建、解决、上下文传递
    - 验证交互选项的动态刷新
    - _Requirements: 12.1, 12.2, 12.3, 12.4_
  
  - [x] 11.4 记录所有失败的测试
    - 记录失败详情（错误消息、堆栈跟踪）
    - 生成问题报告（标记为 P1/P2）
    - _Requirements: 19.1_

- [-] 12. 识别缺失的组合场景测试
  - [x] 12.1 识别持续能力组合场景
    - 持续能力 + 修正标记
    - 多个持续能力同时生效
    - 持续能力 + 印戒移动
    - _Requirements: 10.1, 10.2_
  
  - [x] 12.2 识别能力链式反应场景
    - 调解人移除印戒后触发其他效果
    - 弃牌能力触发"弃牌时"触发器
    - 修正标记添加触发"影响力变化时"触发器
    - _Requirements: 10.1, 10.2_
  
  - [x] 12.3 识别边界条件场景
    - 弃牌能力 + 牌库为空
    - 复制能力 + 无可复制目标
    - 修正能力 + 场上无卡牌
    - _Requirements: 10.1, 10.2, 10.5_

- [x] 13. 补充缺失的集成测试
  - [x] 13.1 补充持续能力组合测试
    - 创建 `integration-ongoing-modifiers.test.ts`
    - 测试持续能力 + 修正标记的叠加效果
    - 测试多个持续能力同时生效的优先级
    - _Requirements: 10.1, 10.2, 10.3_
  
  - [x] 13.2 补充能力链式反应测试
    - 创建 `integration-ability-chain.test.ts`
    - 测试调解人移除印戒后触发其他效果
    - 测试弃牌能力触发"弃牌时"触发器
    - _Requirements: 10.1, 10.2, 10.3_
  
  - [x] 13.3 补充边界条件测试
    - 创建 `integration-edge-cases.test.ts`
    - 测试弃牌能力 + 牌库为空
    - 测试复制能力 + 无可复制目标
    - _Requirements: 10.1, 10.2, 10.5_
  
  - [x] 13.4 补充交互链完整性测试
    - 补充 Handler 共返状态一致性测试（D24）
    - 补充交互上下文快照完整性测试（D35）
    - 补充延迟事件补发的健壮性测试（D36）
    - 补充交互选项动态刷新完整性测试（D37）
    - _Requirements: 12.1, 12.2, 12.3, 12.4_

- [x] 14. 修复 Phase 3 发现的 P1/P2 问题
  - [x] 14.1 修复所有 P1 问题
    - 逐个修复 P1 问题
    - 每个修复提交一个 commit（commit message 包含问题 ID）
    - _Requirements: 19.4_
  
  - [x] 14.2 修复所有 P2 问题
    - 逐个修复 P2 问题
    - 每个修复提交一个 commit（commit message 包含问题 ID）
    - _Requirements: 19.4_
  
  - [x] 14.3 验证问题修复
    - 重新运行所有集成测试
    - 确认所有测试通过
    - _Requirements: 19.4_

- [x] 15. 生成 Phase 3 审计报告
  - 生成 `reports/audit-phase3-report.md`（Markdown 格式）
  - 生成 `reports/audit-phase3-issues.json`（新发现的问题列表）
  - _Requirements: 19.1, 19.2_

- [x] 16. Checkpoint - Phase 3 完成验证
  - 确认所有集成测试通过
  - 确认关键组合场景已覆盖
  - 确认所有 P1 问题已修复，P2 问题已记录
  - 询问用户是否继续进入 Phase 4

### Phase 4: E2E 测试（3-4 天）

- [x] 17. 运行所有 E2E 测试
  - [x] 17.1 运行所有 Cardia E2E 测试
    - 执行 `npm run test:e2e -- cardia`
    - 记录所有失败的测试
    - 保存截图和视频
    - _Requirements: 17.1, 17.2, 17.3, 17.4_
  
  - [x] 17.2 检查 E2E 测试覆盖率
    - 对照 Deck I 卡牌清单，检查每张卡牌是否都有 E2E 测试
    - 对照关键交互路径，检查是否都有 E2E 测试覆盖
    - 生成缺失测试清单
    - _Requirements: 17.1, 17.2_
  
  - [x] 17.3 记录所有失败的测试
    - 记录失败详情（错误消息、堆栈跟踪、页面状态）
    - 生成问题报告（标记为 P1/P2）
    - _Requirements: 19.1_

- [-] 18. 补充缺失的 E2E 测试
  - [x] 18.1 补充 Deck I 卡牌 E2E 测试
    - 为每张 Deck I 卡牌创建至少一个 E2E 测试
    - 测试卡牌的核心功能（onPlay/onDestroy/响应窗口/交互链）
    - 使用 `GameTestContext` API 和状态注入方案
    - _Requirements: 17.1, 17.2, 17.3, 17.4_
  
  - [ ] 18.2 补充交互模式语义匹配测试（D5）
    - 验证所有"你可以"/"选择"等描述都有对应的 UI 交互
    - 验证交互类型（选择卡牌 vs 确认按钮）与描述一致
    - 验证交互选项的 `displayMode` 声明正确
    - _Requirements: 4.1, 4.2, 4.3, 4.4_
  
  - [ ] 18.3 补充 UI 状态同步测试（D15）
    - 验证 UI 展示的数值/状态与 core 状态一致
    - 验证 UI 计算参考点与描述语义一致
    - 验证 UI 交互门控与 validate 合法路径对齐
    - _Requirements: 9.1, 9.2, 9.3, 9.4_
  
  - [ ] 18.4 补充状态可观测性测试（D20）
    - 验证修正标记的来源可追溯
    - 验证持续能力的效果可见
    - 验证印戒的归属清晰
    - 验证影响力的计算过程可见
    - _Requirements: 11.1, 11.2, 11.3_

- [ ] 19. 修复 Phase 4 发现的 P1/P2 问题
  - [x] 19.1 修复所有 P1 问题
    - 逐个修复 P1 问题
    - 每个修复提交一个 commit（commit message 包含问题 ID）
    - _Requirements: 19.4_
  
  - [x] 19.2 修复所有 P2 问题
    - 逐个修复 P2 问题
    - 每个修复提交一个 commit（commit message 包含问题 ID）
    - _Requirements: 19.4_
  
  - [x] 19.3 验证问题修复
    - 重新运行所有 E2E 测试
    - 确认所有测试通过
    - _Requirements: 19.4_

- [x] 20. 生成 Phase 4 审计报告
  - 生成 `reports/audit-phase4-report.md`（Markdown 格式）
  - 生成 `reports/audit-phase4-issues.json`（新发现的问题列表）
  - _Requirements: 19.1, 19.2_

- [x] 21. Checkpoint - Phase 4 完成验证
  - 确认所有 E2E 测试通过
  - 确认所有 Deck I 卡牌都有 E2E 测试覆盖
  - 确认所有 P1 问题已修复，P2 问题已记录
  - 询问用户是否继续生成最终报告

### 最终报告与交付

- [x] 22. 生成最终审计报告
  - [x] 22.1 汇总所有阶段的问题列表
    - 合并 Phase 1-4 的问题列表
    - 去重（同一问题在多个阶段发现）
    - 按优先级和维度排序
    - _Requirements: 19.1_
  
  - [x] 22.2 生成审查矩阵
    - 创建 Markdown 表格（卡牌 × 维度）
    - 标注每个检查点的状态（✅/❌/⚠️/N/A）
    - _Requirements: 1.4, 19.2_
  
  - [x] 22.3 生成修复跟踪表
    - 创建 Markdown 表格（问题 ID × 状态）
    - 记录每个问题的修复进度（未修复/修复中/已修复/已验证）
    - _Requirements: 19.3_
  
  - [x] 22.4 生成最终审计报告
    - 创建 `reports/audit-final-report.md`
    - 包含执行摘要、维度覆盖情况、卡牌覆盖情况、问题列表、下一步行动
    - _Requirements: 19.1, 19.2_

- [x] 23. 运行回归测试验证修复效果
  - [ ] 23.1 运行全量单元测试
    - 执行 `npm run test:games -- cardia`
    - 确认所有测试通过
    - _Requirements: 19.4_
  
  - [ ] 23.2 运行全量集成测试、、、、、、、、、、、、、、、、、、
    - 执行 `npm run test:games -- cardia integration`
    - 确认所有测试通过
    - _Requirements: 19.4_
  
  - [ ] 23.3 运行全量 E2E 测试
    - 执行 `npm run test:e2e -- cardia`
    - 确认所有测试通过
    - _Requirements: 19.4_
  
  - [ ] 23.4 检查测试覆盖率
    - 执行 `npm run test:coverage -- cardia`
    - 确认行覆盖率 ≥ 80%
    - _Requirements: 18.1_

- [ ] 24. 创建自动化审计脚本
  - [ ] 24.1 创建 `scripts/audit/run-full-audit.sh`
    - 一键运行所有审计检查（Phase 1-4）
    - 自动生成报告
    - 自动检查 P0 问题并阻塞
    - _Requirements: 20.1_
  
  - [ ] 24.2 创建 `scripts/audit/generate-final-report.mjs`
    - 汇总所有阶段的报告
    - 生成最终审计报告
    - 生成审查矩阵和修复跟踪表
    - _Requirements: 19.1, 19.2, 19.3_
  
  - [ ] 24.3 创建 `scripts/audit/auto-fix-displaymode.mjs`
    - 自动修复简单问题（如缺少 displayMode）
    - 提供预览和确认机制
    - _Requirements: 20.2_

- [ ] 25. 更新文档
  - [ ] 25.1 更新 `docs/ai-rules/testing-audit.md`
    - 补充审计过程中发现的新维度和检查点
    - 补充常见问题和修复模式
    - _Requirements: 19.1_
  
  - [ ] 25.2 更新 `docs/automated-testing.md`
    - 补充审计工具使用指南
    - 补充测试工具选型建议
    - _Requirements: 18.1, 18.2, 18.3_
  
  - [ ] 25.3 更新 `src/games/cardia/README.md`
    - 补充审计流程和工具使用说明
    - 补充测试覆盖情况
    - _Requirements: 19.1_

- [ ] 26. Final Checkpoint - 审计完成验证
  - 确认所有测试通过（单元测试 + 集成测试 + E2E 测试）
  - 确认测试覆盖率 ≥ 80%
  - 确认所有 P0 和 P1 问题已修复
  - 确认最终审计报告已生成
  - 确认审查矩阵和修复跟踪表已生成
  - 确认自动化审计脚本已创建
  - 确认文档已更新

## Notes

- 任务标记 `*` 为可选任务，可根据实际情况跳过
- 每个任务引用具体的需求（_Requirements: X.Y_），便于追溯
- Checkpoint 任务确保每个阶段独立可验证
- 所有 P0 问题必须在进入下一阶段前修复
- 所有 P1 问题应在审计完成前修复
- P2 问题可延后修复，但必须记录在修复跟踪表中
- 使用 `GameTestContext` API 进行 E2E 测试（而非旧的 helper 函数）
- 所有 E2E 测试使用联机模式（`setupOnlineMatch`）
- 静态扫描工具输出 JSON 格式，便于后续处理
- 审计报告使用 Markdown + JSON 双格式
