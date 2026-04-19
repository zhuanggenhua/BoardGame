# Implementation Plan: Cardia 行为日志系统

## Overview

本任务列表基于已完成的需求文档和设计文档，按照实现顺序组织任务：基础设施 → 核心功能 → 系统集成 → 国际化 → 测试 → 验证。每个任务都是独立可验证的，粒度适中（1-3 小时完成）。

## Tasks

- [x] 1. 创建基础设施和辅助函数
  - [x] 1.1 创建卡牌预览辅助函数
    - 创建 `src/games/cardia/ui/cardPreviewHelper.ts`
    - 实现 `getCardiaCardPreviewMeta` 函数（从 cardRegistry 查询卡牌定义）
    - 实现 `getCardiaCardPreviewRef` 函数（返回 CardPreviewRef）
    - 处理卡牌不存在的情况（返回 null）
    - _Requirements: 12.1, 12.2, 12.3, 12.4_

  - [ ]* 1.2 编写卡牌预览辅助函数单元测试
    - 测试有效卡牌 ID 返回正确的 name 和 previewRef
    - 测试无效卡牌 ID 返回 null
    - 测试 previewRef 结构正确性
    - _Requirements: 15.1, 15.2_

- [x] 2. 实现核心格式化函数
  - [x] 2.1 创建 actionLog.ts 文件并定义白名单
    - 创建 `src/games/cardia/actionLog.ts`
    - 定义 `ACTION_ALLOWLIST`（包含 PLAY_CARD, ACTIVATE_ABILITY, SKIP_ABILITY, END_TURN, ADD_MODIFIER, REMOVE_MODIFIER, RESPOND）
    - 定义 `UNDO_ALLOWLIST`（包含 PLAY_CARD, ACTIVATE_ABILITY, ADD_MODIFIER, REMOVE_MODIFIER）
    - 定义常量 `CARDIA_NS = 'game-cardia'`
    - _Requirements: 1.3, 1.4, 10.1, 10.2, 10.3, 10.4, 10.5, 14.1, 14.3_

  - [x] 2.2 实现 segment 工厂函数
    - 实现 `i18nSeg` 工厂函数（创建 i18n segment）
    - 实现 `textSegment` 工厂函数（创建 text segment）
    - 实现 `buildCardSegment` 函数（创建 card segment，处理 i18n key 和 previewRef）
    - _Requirements: 4.1, 4.4, 5.1, 5.2, 13.4, 13.5_

  - [x] 2.3 实现命令格式化逻辑
    - 实现 `formatCardiaActionEntry` 函数框架
    - 实现 PLAY_CARD 命令格式化（包含卡牌名称和遭遇位置）
    - 实现 ACTIVATE_ABILITY 命令格式化（包含能力名称和卡牌）
    - 实现 SKIP_ABILITY 命令格式化
    - 实现 END_TURN 命令格式化
    - 实现 ADD_MODIFIER 命令格式化（包含卡牌和数值）
    - 实现 REMOVE_MODIFIER 命令格式化（包含卡牌）
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 8.3, 8.4, 13.1, 13.2, 13.3_

  - [x] 2.4 实现交互事件格式化逻辑
    - 实现 RESPOND 命令的事件处理框架
    - 实现 CARD_REPLACED 事件格式化（包含位置、旧卡牌、新卡牌）
    - 实现 FACTION_SELECTED 事件格式化（包含派系）
    - 处理多个事件的时间戳递增（使用偏移量）
    - _Requirements: 2.5, 3.11, 3.12, 11.2, 11.4_

  - [ ]* 2.5 编写格式化函数单元测试
    - 测试 PLAY_CARD 命令生成正确的日志条目
    - 测试 ACTIVATE_ABILITY 命令生成正确的日志条目
    - 测试 i18n segment 包含正确的 ns 和 key
    - 测试 card segment 包含正确的 previewRef
    - 测试命令不在白名单时返回 null
    - 测试事件缺失关键字段时返回 null
    - _Requirements: 15.1, 15.3, 15.4_

- [x] 3. Checkpoint - 核心功能验证
  - 确保所有单元测试通过，询问用户是否有问题

- [x] 4. 集成到游戏系统
  - [x] 4.1 在 game.ts 中集成 ActionLogSystem
    - 导入 `createActionLogSystem`、`ACTION_ALLOWLIST`、`formatCardiaActionEntry`
    - 在 systems 数组中添加 ActionLogSystem（配置 commandAllowlist 和 formatEntry）
    - 在 systems 数组中添加 UndoSystem（配置 commandAllowlist 为 UNDO_ALLOWLIST）
    - _Requirements: 1.1, 1.2, 1.5, 14.2_

  - [x] 4.2 注册卡牌预览函数到全局注册表
    - 导入 `registerCardPreviewGetter` 和 `getCardiaCardPreviewRef`
    - 在 game.ts 中调用 `registerCardPreviewGetter('cardia', getCardiaCardPreviewRef)`
    - _Requirements: 12.5, 14.2_

  - [ ]* 4.3 编写系统集成测试
    - 验证 ACTION_ALLOWLIST 包含所有必需的命令类型
    - 验证 UNDO_ALLOWLIST 包含正确的命令类型
    - 验证 formatCardiaActionEntry 函数导出
    - 验证 getCardiaCardPreviewRef 函数导出
    - _Requirements: 15.1, 15.2_

- [x] 5. 添加国际化文案
  - [x] 5.1 添加中文文案
    - 在 `public/locales/zh-CN/game-cardia.json` 中添加 `actionLog` 部分
    - 包含所有命令和事件的文案（playCard, toSlot, activateAbility, skipAbility, endTurn, addModifier, removeModifier, cardReplaced, factionSelected 等）
    - _Requirements: 4.1, 4.2, 4.3, 14.4_

  - [x] 5.2 添加英文文案
    - 在 `public/locales/en/game-cardia.json` 中添加 `actionLog` 部分
    - 包含所有命令和事件的英文翻译
    - _Requirements: 4.1, 4.2, 4.3, 14.4_

- [x] 6. Checkpoint - 集成验证
  - 确保所有测试通过，询问用户是否有问题

- [x] 7. 编写属性测试
  - [x]* 7.1 编写 Property 1: 命令记录完整性测试
    - **Property 1: 命令记录完整性**
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 8.3, 8.4**
    - 生成随机命令（白名单中的类型）
    - 验证生成的日志条目 kind 与命令类型一致

  - [x]* 7.2 编写 Property 3: i18n Segment 正确性测试
    - **Property 3: i18n Segment 正确性**
    - **Validates: Requirements 4.1, 4.2**
    - 生成随机命令和事件
    - 验证所有文本片段使用 i18n segment
    - 验证 ns 字段为 'game-cardia'

  - [x]* 7.3 编写 Property 4: 卡牌 Segment 正确性测试
    - **Property 4: 卡牌 Segment 正确性**
    - **Validates: Requirements 4.4, 5.1, 5.2, 5.3**
    - 生成随机卡牌相关事件
    - 验证卡牌片段使用 card segment
    - 验证包含 cardId、previewText、previewRef
    - 验证 i18n key 时设置 previewTextNs

  - [x]* 7.4 编写 Property 6: 卡牌预览函数正确性测试
    - **Property 6: 卡牌预览函数正确性**
    - **Validates: Requirements 12.2, 12.3**
    - 生成随机卡牌 ID（包括有效和无效）
    - 验证函数返回值结构正确
    - 验证不存在的卡牌返回 null

  - [x]* 7.5 编写 Property 8: 时间戳单调性测试
    - **Property 8: 时间戳单调性**
    - **Validates: Requirements 11.1, 11.2, 11.4**
    - 生成随机命令和多个事件
    - 验证事件时间戳 >= 命令时间戳
    - 验证多个事件时间戳递增

  - [x]* 7.6 编写 Property 9: 条目 ID 唯一性测试
    - **Property 9: 条目 ID 唯一性**
    - **Validates: Requirements 13.6**
    - 生成多个随机命令
    - 验证所有生成的日志条目 ID 不重复

- [x] 8. 编写 E2E 测试
  - [x]* 8.1 编写日志面板显示测试
    - 创建 `e2e/cardia-action-log.e2e.ts`
    - 验证 ActionLogPanel 组件正确渲染
    - 验证日志条目按时间倒序显示
    - _Requirements: 15.5_

  - [x]* 8.2 编写卡牌预览交互测试
    - 悬停卡牌名称时显示预览
    - 预览内容包含卡牌图片和描述
    - _Requirements: 15.5_

  - [x]* 8.3 编写国际化切换测试
    - 切换语言后日志文本正确翻译
    - 卡牌名称正确翻译
    - _Requirements: 15.5_

- [x] 9. Final checkpoint - 完整验证
  - 确保所有测试通过，询问用户是否有问题

## Notes

- 任务标记 `*` 为可选任务，可以跳过以加快 MVP 交付
- 每个任务都引用了具体的需求编号，确保可追溯性
- Checkpoint 任务确保增量验证，及时发现问题
- 属性测试验证通用规则在所有输入下的正确性
- E2E 测试验证关键用户交互流程
- 所有测试任务都是可选的，核心实现任务必须完成
