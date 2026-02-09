# Implementation Plan: 大杀四方教学系统

## Overview

基于已有的 TutorialManifest 框架，为大杀四方实现完整教学系统。实现分 5 个阶段：CheatSystem 集成 → Board UI 属性标注 → 教学 manifest 编写 → i18n 文案补全 → 测试覆盖。教学约 20 步，使用恐龙+海盗（玩家）vs 机器人+巫师（对手），通过 Cheat 命令和固定随机策略确保流程可控可复现。

## Tasks

- [x] 1. CheatSystem 集成
  - [x] 1.1 创建 SmashUp CheatResourceModifier (`src/games/smashup/cheatModifier.ts`)
    - 实现 `CheatResourceModifier<SmashUpCore>` 接口
    - `getResource`/`setResource`: 支持 `vp` 资源读写
    - `dealCardByIndex`: 按牌库索引将卡牌移到手牌（SmashUp 使用 `defId` 而非 `spriteIndex`）
    - 导出 `smashUpCheatModifier` 常量
    - _Requirements: 10.1, 10.2, 10.3_

  - [x] 1.2 注册 CheatSystem 到 game.ts (`src/games/smashup/game.ts`)
    - 导入 `createCheatSystem`、`CHEAT_COMMANDS` 和 `smashUpCheatModifier`
    - 在 `systems` 数组中添加 `createCheatSystem<SmashUpCore>(smashUpCheatModifier)`
    - 在 `commandTypes` 中添加 `CHEAT_COMMANDS.SET_RESOURCE`、`CHEAT_COMMANDS.DEAL_CARD_BY_INDEX`、`CHEAT_COMMANDS.SET_STATE`、`CHEAT_COMMANDS.MERGE_STATE`
    - _Requirements: 10.1, 10.2_

- [x] 2. Board UI data-tutorial-id 属性 (`src/games/smashup/Board.tsx` 及子组件)
  - [x] 2.1 添加 data-tutorial-id 属性到 Board.tsx
    - `su-base-area`: 基地滚动区域容器
    - `su-scoreboard`: 右上角记分板
    - `su-turn-tracker`: 左上角回合追踪器
    - `su-hand-area`: 底部手牌区容器
    - `su-end-turn-btn`: 结束回合按钮
    - _Requirements: 9.1, 9.2_

  - [x] 2.2 添加 data-tutorial-id 属性到子组件
    - `su-deck-discard`: DeckDiscardZone 组件（牌库/弃牌区）
    - `su-faction-select`: FactionSelection 组件（派系选择界面）
    - _Requirements: 9.1, 9.2_

- [x] 3. Checkpoint — CheatSystem 与 Board UI
  - 确保现有测试全部通过，CheatSystem 注册无报错，Board 渲染正常。
  - 确保所有测试通过，ask the user if questions arise.

- [x] 4. 教学 manifest 重写 (`src/games/smashup/tutorial.ts`)
  - [x] 4.1 重写 tutorial.ts 基础结构
    - 修改导入：从 `../../engine/types` 导入 `TutorialManifest`（替换 `../../contexts/TutorialContext`）
    - 导入 `SU_COMMANDS`、`SU_EVENTS`、`FLOW_COMMANDS`、`FLOW_EVENTS`、`CHEAT_COMMANDS`
    - 设置 `randomPolicy: { mode: 'fixed', values: [1] }`
    - 定义事件匹配器常量（`MATCH_PHASE_PLAY`、`MATCH_PHASE_DRAW` 等）
    - _Requirements: 1.4_

  - [x] 4.2 实现初始化步骤 (Step 0: setup)
    - aiActions: 自动选派系（恐龙+海盗 for P0，机器人+巫师 for P1）
    - aiActions: 对手 ready + 开始游戏
    - aiActions: MERGE_STATE 设置玩家手牌为教学指定卡牌
    - `requireAction: false`, `showMask: true`
    - _Requirements: 1.1, 1.2, 1.3_

  - [x] 4.3 实现 UI 介绍步骤 (Steps 1-5)
    - Step 1: 欢迎 + 高亮 `su-base-area`，blockedCommands 含 ADVANCE_PHASE
    - Step 2: 记分板介绍 + 高亮 `su-scoreboard`，blockedCommands 含 ADVANCE_PHASE
    - Step 3: 手牌介绍 + 高亮 `su-hand-area`，blockedCommands 含 ADVANCE_PHASE
    - Step 4: 回合追踪器 + 高亮 `su-turn-tracker`，blockedCommands 含 ADVANCE_PHASE
    - Step 5: 结束按钮 + 高亮 `su-end-turn-btn`，blockedCommands 含 ADVANCE_PHASE
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

  - [x] 4.4 实现出牌阶段教学步骤 (Steps 6-9)
    - Step 6: 出牌阶段说明（1 随从 + 1 行动）
    - Step 7: 打出随从 — `allowedCommands: [SU_COMMANDS.PLAY_MINION]`, `advanceOnEvents: [{ type: SU_EVENTS.MINION_PLAYED }]`
    - Step 8: 打出行动 — `allowedCommands: [SU_COMMANDS.PLAY_ACTION]`, `advanceOnEvents: [{ type: SU_EVENTS.ACTION_PLAYED }]`
    - Step 9: 结束出牌 — 引导点击结束按钮，`allowedCommands: [FLOW_COMMANDS.ADVANCE_PHASE]`
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [x] 4.5 实现记分与抽牌教学步骤 (Steps 10-14)
    - Step 10: 基地记分概念（临界点说明）
    - Step 11: VP 奖励说明（1st/2nd/3rd 排名）
    - Step 12: 记分阶段 AI 自动推进
    - Step 13: 抽牌阶段说明（每回合抽 2 张）
    - Step 14: 手牌上限说明（10 张上限 + 弃牌）
    - _Requirements: 4.1, 4.2, 4.3, 5.1, 5.2, 5.3_

  - [x] 4.6 实现对手回合与完成步骤 (Steps 15-18)
    - Step 15: 结束抽牌 — 引导推进阶段
    - Step 16: 对手回合 — AI 自动执行，显示等待消息，advanceOnEvents 监听回合切换
    - Step 17: 天赋能力说明
    - Step 18: 教学总结 + 完成
    - _Requirements: 6.1, 6.2, 6.3, 7.1, 7.2, 8.1, 8.2_

- [x] 5. 教学本地化文案 (i18n)
  - [x] 5.1 补全 zh-CN 教学文案 (`public/locales/zh-CN/game-smashup.json`)
    - 在 `tutorial` 对象下添加 `steps` 子对象
    - 包含所有步骤的中文文案：setup, welcome, scoreboard, handIntro, turnTracker, endTurnBtn, playCardsExplain, playMinion, playAction, talentIntro, endPlayCards, baseScoring, vpAwards, drawExplain, handLimit, endDraw, opponentTurn, turnCycle, summary, finish
    - _Requirements: 11.1, 11.2_

  - [x] 5.2 补全 en 教学文案 (`public/locales/en/game-smashup.json`)
    - 与 zh-CN 结构完全对应的英文文案
    - _Requirements: 11.1, 11.2_

- [x] 6. Checkpoint — 教学流程完整性
  - tutorial.ts 无类型错误 ✅
  - i18n 文件 JSON 格式正确 ✅
  - 所有 21 个 content key 在 zh-CN 和 en 中都有对应翻译 ✅
  - 单元测试全部通过 ✅

- [x]* 7. 单元测试
  - [x]* 7.1 Tutorial manifest 结构验证 (`src/games/smashup/__tests__/tutorial.test.ts`)
    - 验证每个步骤 id 唯一
    - 验证所有 content 字段匹配 `game-smashup:tutorial.*` 模式
    - 验证 setup 步骤包含 aiActions
    - 验证 randomPolicy 已设置
    - _Requirements: 1.4, 11.2_

  - [x]* 7.2 CheatModifier 功能测试 (`src/games/smashup/__tests__/cheatModifier.test.ts`)
    - 测试 `getResource`/`setResource` 对 vp 的读写
    - 测试 `dealCardByIndex` 正确移动卡牌（deck → hand）
    - 测试 `dealCardByIndex` 边界情况（无效索引、空牌库）
    - _Requirements: 10.1, 10.3_

  - [x]* 7.3 data-tutorial-id 存在性测试 (`src/games/smashup/__tests__/tutorialIds.test.ts`)
    - 验证 Board.tsx 源码中包含所有 7 个 `data-tutorial-id` 属性字符串
    - 属性列表：su-base-area, su-scoreboard, su-turn-tracker, su-hand-area, su-end-turn-btn, su-deck-discard, su-faction-select
    - _Requirements: 9.1, 9.2_

- [x]* 8. 属性测试
  - [x]* 8.1 Property 1: UI 介绍步骤阻止阶段推进
    - **Property 1: UI introduction steps block phase advancement**
    - 使用 fast-check 生成 manifest 步骤索引，验证所有 `requireAction: false` 且非 setup/finish 的步骤的 `blockedCommands` 包含 `ADVANCE_PHASE`
    - Tag: **Feature: smashup-tutorial, Property 1: UI introduction steps block phase advancement**
    - **Validates: Requirements 2.6**

  - [x]* 8.2 Property 2: Cheat dealCardByIndex 保持牌库完整性
    - **Property 2: Cheat dealCardByIndex preserves deck integrity**
    - 使用 fast-check 生成随机 SmashUpCore 状态和有效 deck index，执行 dealCardByIndex 后验证 deck.length 减 1、hand.length 加 1、移动的卡牌正确
    - Tag: **Feature: smashup-tutorial, Property 2: Cheat dealCardByIndex preserves deck integrity**
    - **Validates: Requirements 10.3**

  - [x]* 8.3 Property 3: 教学 i18n 完整性
    - **Property 3: Tutorial i18n completeness**
    - 遍历 manifest 所有步骤，验证 content 匹配 i18n key 模式且在 zh-CN 和 en locale 文件中都存在对应翻译
    - Tag: **Feature: smashup-tutorial, Property 3: Tutorial i18n completeness**
    - **Validates: Requirements 11.1, 11.2**

- [x]* 9. E2E 端到端测试 (`e2e/smashup-tutorial.e2e.ts`)
  - [x]* 9.1 教学初始化与 UI 介绍
    - 启动教学模式，验证自动派系选择完成
    - 验证 setup 步骤后进入游戏界面
    - 逐步点击 Next 通过 UI 介绍步骤
    - 验证高亮元素在对应步骤可见
    - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 2.4, 2.5_

  - [x]* 9.2 出牌阶段交互
    - 在出牌步骤打出随从和行动卡
    - 验证步骤自动推进（advanceOnEvents 触发）
    - 点击结束按钮推进阶段
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [x]* 9.3 完整教学流程
    - 从头到尾完成教学（包括对手 AI 回合）
    - 验证教学总结步骤显示
    - 验证教学完成后可继续或退出
    - _Requirements: 6.1, 6.2, 6.3, 8.1, 8.2_

- [x] 10. Final Checkpoint — 全量回归
  - 确保所有测试通过，ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- 教学使用恐龙+海盗（玩家）vs 机器人+巫师（对手），约 20 步
- CheatSystem 使用 `MERGE_STATE` 设置手牌（SmashUp 的 CardInstance 使用 defId 而非 spriteIndex）
- 参考实现：`src/games/summonerwars/tutorial.ts`（34 步完整教学）
- 属性测试使用 fast-check，每个属性至少 100 次迭代
- E2E 测试参考 `e2e/summonerwars-tutorial.e2e.ts` 的模式
