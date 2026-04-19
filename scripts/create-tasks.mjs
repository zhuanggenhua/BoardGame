import { writeFileSync } from 'fs';

const tasksContent = `# Implementation Plan: Smash Up E2E 测试框架迁移

## Overview

本计划将 73 个 Smash Up E2E 测试从旧框架迁移到新框架（"三板斧"模式：新框架 + 专用测试模式 + 状态注入）。

**当前进度**：5/73（7%）已完成
**需要迁移**：68 个测试

**迁移策略**：
- 渐进式迁移，按优先级分批进行
- 每批 2-3 个测试，确保质量
- 迁移完成并验证通过后再删除旧代码

**优先级**：
1. 核心交互测试（8 个）- 验证关键游戏机制
2. 半迁移测试清理（7 个）- 消除旧代码痕迹
3. 旧 Fixture 测试迁移（18 个）- 统一测试风格
4. 直接操作 TestHarness 的测试迁移（22 个）- 提高代码可读性
5. 页面流测试（4 个）- 保持原样，不迁移

## Tasks

- [ ] 1. Phase 1: 核心交互测试迁移（Week 1）
  - 迁移 8 个核心交互测试，建立标准模板
  - _Requirements: 1.1-1.10_

  - [ ] 1.1 迁移忍者渗透测试
    - 迁移 \`smashup-ninja-infiltrate.e2e.ts\`
    - 使用 \`game.setupScene()\` 构建忍者渗透场景
    - 验证测试通过且截图清晰
    - _Requirements: 1.1, 1.9, 1.10_

  - [ ] 1.2 迁移法师传送门测试
    - 迁移 \`smashup-wizard-portal.e2e.ts\`
    - 使用 \`game.setupScene()\` 构建法师传送门场景
    - 验证测试通过且截图清晰
    - _Requirements: 1.2, 1.9, 1.10_

  - [ ] 1.3 迁移多基地计分完整测试
    - 迁移 \`smashup-multi-base-scoring-complete.e2e.ts\`
    - 使用 \`game.setupScene()\` 构建多基地计分场景
    - 验证测试通过且截图清晰
    - _Requirements: 1.3, 1.9, 1.10_

  - [ ] 1.4 迁移多基地计分简化测试
    - 迁移 \`smashup-multi-base-scoring-simple.e2e.ts\`
    - 使用 \`game.setupScene()\` 构建简化多基地计分场景
    - 验证测试通过且截图清晰
    - _Requirements: 1.4, 1.9, 1.10_

  - [ ] 1.5 迁移海盗湾计分 bug 测试
    - 迁移 \`smashup-pirate-cove-scoring-bug.e2e.ts\`
    - 使用 \`game.setupScene()\` 构建海盗湾计分场景
    - 验证测试通过且截图清晰
    - _Requirements: 1.5, 1.9, 1.10_

  - [ ] 1.6 迁移印斯茅斯本地人展示测试
    - 迁移 \`smashup-innsmouth-locals-reveal.e2e.ts\`
    - 使用 \`game.setupScene()\` 构建印斯茅斯本地人展示场景
    - 验证测试通过且截图清晰
    - _Requirements: 1.6, 1.9, 1.10_

  - [ ] 1.7 迁移基地随从选择测试
    - 迁移 \`smashup-base-minion-selection.e2e.ts\`
    - 使用 \`game.setupScene()\` 构建基地随从选择场景
    - 验证测试通过且截图清晰
    - _Requirements: 1.7, 1.9, 1.10_

  - [ ] 1.8 清理 afterscoring 简单完整测试
    - 清理 \`smashup-afterscoring-simple-complete.e2e.ts\` 中的旧代码痕迹
    - 确保使用纯三板斧模式
    - 验证测试通过且截图清晰
    - _Requirements: 1.8, 1.9, 1.10_

- [ ] 2. Checkpoint - Phase 1 验证
  - 确保所有 Phase 1 测试通过，截图清晰，无超时错误

- [ ] 3. Phase 2: 半迁移测试清理（Week 2）
  - 清理 7 个半迁移测试，消除旧代码痕迹
  - _Requirements: 2.1-2.7_

  - [ ] 3.1 清理机器人悬浮机器人链测试
    - 清理 \`smashup-robot-hoverbot-chain.e2e.ts\`
    - 移除所有 \`harness.state.patch()\` 直接调用
    - 统一使用 \`game.setupScene()\`
    - _Requirements: 2.1, 2.7_

  - [ ] 3.2 清理僵尸领主测试
    - 清理 \`smashup-zombie-lord.e2e.ts\`
    - 移除所有旧 API 调用
    - 统一使用 \`game.setupScene()\`
    - _Requirements: 2.2, 2.7_

  - [ ] 3.3 清理复杂多基地计分测试
    - 清理 \`smashup-complex-multi-base-scoring.e2e.ts\`
    - 统一使用 \`game.setupScene()\`
    - 移除旧代码痕迹
    - _Requirements: 2.3, 2.7_

  - [ ] 3.4 清理阶段转换简单测试
    - 清理 \`smashup-phase-transition-simple.e2e.ts\`
    - 移除旧 helper 函数调用
    - 统一使用 \`game.setupScene()\`
    - _Requirements: 2.4, 2.7_

  - [ ] 3.5 清理响应窗口通过测试
    - 清理 \`smashup-response-window-pass-test.e2e.ts\`
    - 使用 \`game.screenshot()\` 替代手动截图
    - 移除旧代码痕迹
    - _Requirements: 2.5, 2.7_

  - [ ] 3.6 清理机器人悬浮机器人新测试
    - 清理 \`smashup-robot-hoverbot-new.e2e.ts\`
    - 确保使用纯三板斧模式
    - 移除旧代码痕迹
    - _Requirements: 2.6, 2.7_

- [ ] 4. Checkpoint - Phase 2 验证
  - 确保所有 Phase 2 测试通过，无旧代码痕迹

- [ ] 5. Phase 3: 旧 Fixture 测试迁移（Week 3）
  - 迁移 18 个旧 Fixture 测试，统一测试风格
  - _Requirements: 3.1-3.6_

  - [ ] 5.1 识别旧 Fixture 测试
    - 搜索 \`import { test } from './fixtures'\` 和 \`smashupMatch\` fixture
    - 创建旧 Fixture 测试清单
    - _Requirements: 3.1_

  - [ ] 5.2 迁移旧 Fixture 测试（批次 1：6 个）
    - 替换为 \`import { test } from './framework'\`
    - 移除 \`smashupMatch\` fixture 使用
    - 使用 \`game.setupScene()\` 替代旧状态构建方式
    - 验证测试通过且无旧 API 调用
    - _Requirements: 3.2, 3.3, 3.4, 3.5_

  - [ ] 5.3 迁移旧 Fixture 测试（批次 2：6 个）
    - 替换为 \`import { test } from './framework'\`
    - 移除 \`smashupMatch\` fixture 使用
    - 使用 \`game.setupScene()\` 替代旧状态构建方式
    - 验证测试通过且无旧 API 调用
    - _Requirements: 3.2, 3.3, 3.4, 3.5_

  - [ ] 5.4 迁移旧 Fixture 测试（批次 3：6 个）
    - 替换为 \`import { test } from './framework'\`
    - 移除 \`smashupMatch\` fixture 使用
    - 使用 \`game.setupScene()\` 替代旧状态构建方式
    - 验证测试通过且无旧 API 调用
    - _Requirements: 3.2, 3.3, 3.4, 3.5_

- [ ] 6. Checkpoint - Phase 3 验证
  - 确保所有 Phase 3 测试通过，无旧 API 调用

- [ ] 7. Phase 4: 直接操作 TestHarness 的测试迁移（Week 4）
  - 迁移 22 个直接操作 TestHarness 的测试，提高代码可读性
  - _Requirements: 4.1-4.5_

  - [ ] 7.1 识别直接操作 TestHarness 的测试
    - 搜索 \`window.__BG_TEST_HARNESS__\` 和 \`harness.state.patch()\`
    - 创建直接操作 TestHarness 的测试清单
    - _Requirements: 4.1_

  - [ ] 7.2 迁移直接操作 TestHarness 的测试（批次 1：8 个）
    - 使用 \`game.setupScene()\` 替代 \`harness.state.patch()\`
    - 使用 \`game.screenshot()\` 替代手动截图
    - 使用 \`game.waitForTestHarness()\` 替代手动等待
    - 验证测试通过且代码可读性提高
    - _Requirements: 4.2, 4.3, 4.4, 4.5_

  - [ ] 7.3 迁移直接操作 TestHarness 的测试（批次 2：8 个）
    - 使用 \`game.setupScene()\` 替代 \`harness.state.patch()\`
    - 使用 \`game.screenshot()\` 替代手动截图
    - 使用 \`game.waitForTestHarness()\` 替代手动等待
    - 验证测试通过且代码可读性提高
    - _Requirements: 4.2, 4.3, 4.4, 4.5_

  - [ ] 7.4 迁移直接操作 TestHarness 的测试（批次 3：6 个）
    - 使用 \`game.setupScene()\` 替代 \`harness.state.patch()\`
    - 使用 \`game.screenshot()\` 替代手动截图
    - 使用 \`game.waitForTestHarness()\` 替代手动等待
    - 验证测试通过且代码可读性提高
    - _Requirements: 4.2, 4.3, 4.4, 4.5_

- [ ] 8. Checkpoint - Phase 4 验证
  - 确保所有 Phase 4 测试通过，代码可读性提高

- [ ] 9. 建立迁移检查清单和模板
  - 创建标准迁移模板和检查清单
  - _Requirements: 5.1-5.5, 8.1-8.5_

  - [ ] 9.1 创建代码质量检查清单
    - 使用新框架
    - 无旧 API
    - 无直接操作 TestHarness
    - _Requirements: 5.1_

  - [ ] 9.2 创建测试质量检查清单
    - 测试通过
    - 截图清晰
    - 时间 < 60 秒
    - 无 flaky 行为
    - _Requirements: 5.2_

  - [ ] 9.3 创建文档检查清单
    - 测试名称清晰
    - 有注释
    - 截图有描述性文件名
    - _Requirements: 5.3_

  - [ ] 9.4 创建标准迁移模板
    - 包含导入、导航、等待、状态注入、测试逻辑、截图
    - _Requirements: 8.1_

  - [ ] 9.5 整理参考示例
    - 列出已完成的纯三板斧测试作为参考
    - _Requirements: 8.2_

- [ ] 10. 进度追踪和问题记录
  - 在 \`evidence/smashup/smashup-e2e-migration-progress.md\` 中追踪进度
  - _Requirements: 9.1-9.5_

  - [ ] 10.1 记录总体进度
    - 已完成/总数、百分比
    - _Requirements: 9.1_

  - [ ] 10.2 记录每个优先级的迁移状态
    - 第一优先级、第二优先级、第三优先级、第四优先级
    - _Requirements: 9.2_

  - [ ] 10.3 记录每日进度
    - 日期、完成的测试、遇到的问题
    - _Requirements: 9.3_

  - [ ] 10.4 记录遇到的问题和解决方案
    - 问题描述、解决方法、结果
    - _Requirements: 9.4_

  - [ ] 10.5 记录下一步行动
    - 立即开始、今天目标、本周目标
    - _Requirements: 9.5_

- [ ] 11. Phase 5: 清理和验证（Week 5）
  - 删除旧代码，运行所有测试，更新文档
  - _Requirements: 6.1-6.5_

  - [ ] 11.1 删除旧 Fixture 目录
    - 删除 \`e2e/fixtures/\` 目录
    - _Requirements: 6.1, 3.6_

  - [ ] 11.2 删除旧 Helper 函数
    - 删除 \`e2e/helpers/smashup.ts\` 中的旧函数
    - 删除 \`setupSmashUpOnlineMatch\`、\`readCoreState\`、\`applyCoreState\`
    - _Requirements: 6.2_

  - [ ] 11.3 运行所有测试
    - 运行 \`npm run test:e2e:ci\`
    - 验证所有测试通过
    - 检查测试时间
    - _Requirements: 6.5_

  - [ ] 11.4 更新文档
    - 更新 \`docs/automated-testing.md\`
    - 更新 \`evidence/smashup/smashup-e2e-migration-progress.md\`
    - 创建迁移总结文档
    - _Requirements: 6.3, 6.4_

- [ ] 12. Final Checkpoint - 迁移完成验证
  - 确保所有测试通过，旧代码已删除，文档已更新

## Notes

- 任务标记 \`*\` 为可选任务，可以跳过以加快 MVP
- 每个任务引用具体需求以便追溯
- Checkpoint 任务确保增量验证
- 迁移策略：渐进式迁移，按优先级分批进行
- 页面流测试（4 个）保持原样，不迁移
- 迁移完成后，所有 Smash Up E2E 测试将使用新框架
`;

writeFileSync('.kiro/specs/smashup-e2e-migration/tasks.md', tasksContent, 'utf-8');
console.log('✅ tasks.md 创建成功');
