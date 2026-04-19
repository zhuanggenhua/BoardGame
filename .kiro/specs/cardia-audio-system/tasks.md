# Implementation Plan: Cardia 音频系统

## Overview

本实现计划基于 Cardia 音频系统的需求和设计文档，按照项目音频架构规范实现事件驱动的音效和 BGM 系统。实现将遵循 `defineEvents()` 和 `feedbackResolver` 架构，确保音效与游戏事件自动关联，无需手动触发。

实现策略：
1. 先更新事件定义，使用 `defineEvents()` 定义音频策略
2. 创建音频配置文件，配置 BGM、预加载策略和事件音效解析器
3. 集成到游戏引擎，注册音频配置
4. 生成运行时精简注册表
5. 验证音效播放和 BGM 切换
6. 编写证据文档

## Tasks

- [x] 1. 更新事件定义使用 defineEvents()
  - 修改 `src/games/cardia/domain/events.ts`
  - 为所有事件定义音频策略（immediate/fx/silent）
  - 为 immediate 事件指定音效 key
  - 支持动态音效选择（如 MODIFIER_TOKEN_PLACED 根据正负值选择音效）
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 2. 创建音频配置文件
  - [x] 2.1 创建 `src/games/cardia/audio.config.ts`
    - 定义 BGM 常量（8 首曲目，分为 normal 和 battle 两组）
    - 配置 `criticalSounds` 列表（使用 `collectPreloadKeys()` 自动收集 + 手动补充高频音效）
    - 定义 `bgm` 数组（包含所有 BGM 的 key、name、volume、category）
    - 定义 `bgmGroups`（将 BGM 分为 normal 和 battle 两组）
    - 创建 `feedbackResolver`（使用 `createFeedbackResolver(CARDIA_EVENTS)`）
    - 定义 `bgmRules`（根据游戏阶段自动切换 BGM）
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 3.1, 3.2, 4.1, 4.2, 4.4, 6.1, 6.2, 6.3, 6.4, 6.5, 6.7_

  - [x] 2.2 编写单元测试验证配置正确性
    - 验证 `collectPreloadKeys()` 正确收集 immediate 音效
    - 验证 `feedbackResolver` 返回正确的音效 key
    - 验证动态选择逻辑（MODIFIER_TOKEN_PLACED 正负值、ENCOUNTER_RESOLVED 胜负）
    - 验证 silent 事件返回 null
    - 验证 `bgmRules` 根据游戏阶段返回正确的 BGM
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [x] 3. 集成音频系统到游戏引擎
  - 修改 `src/games/cardia/game.ts`
  - 导入 `CARDIA_AUDIO_CONFIG`
  - 在 `createGameEngine()` 中注册 `audioConfig`
  - _Requirements: 7.1, 7.2, 7.3, 7.4_

- [x] 4. Checkpoint - 确保配置正确且无编译错误
  - 运行 `npx eslint src/games/cardia/audio.config.ts src/games/cardia/domain/events.ts src/games/cardia/game.ts`
  - 运行 `npx tsc --noEmit` 确认无类型错误
  - 确保所有音效 key 在注册表中存在（通过 `/dev/audio` 页面验证）
  - 如有问题，询问用户

- [x] 5. 生成运行时精简注册表
  - 运行 `node scripts/audio/generate-slim-registry.mjs`
  - 确保 Cardia 使用的所有音效 key 包含在精简注册表中
  - _Requirements: 8.5_

- [x] 6. 编写 E2E 测试验证音效播放
  - 创建 `e2e/cardia-audio-system.e2e.ts`
  - 测试卡牌打出音效（CARD_PLAYED）
  - 测试印戒授予音效（SIGNET_GRANTED）
  - 测试修正标记放置音效（MODIFIER_TOKEN_PLACED，正负值）
  - 测试游戏胜利音效（GAME_WON）
  - 测试 BGM 切换（normal → battle → normal）
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

- [x] 7. 编写证据文档
  - 创建 `evidence/cardia-audio-system.md`
  - 说明 BGM 选择的理由和风格定位
  - 列出所有事件与音效的映射关系
  - 说明预加载策略的设计
  - 说明如何添加新的音效或 BGM
  - 附上关键截图（`/dev/audio` 页面、游戏内音效播放）
  - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

- [x] 8. Final checkpoint - 确保所有功能正常
  - 访问 `/dev/audio` 页面，验证所有 Cardia 使用的音效可预览
  - 启动游戏，验证音效正确播放
  - 验证 BGM 在不同阶段正确切换
  - 验证音效不重复播放
  - 如有问题，询问用户

## Notes

- 任务标记 `*` 为可选任务，可跳过以加快 MVP 交付
- 每个任务引用具体需求编号，确保可追溯性
- Checkpoint 任务确保增量验证，及时发现问题
- 音频配置文件禁止包含 `basePath` 或 `sounds` 字段（遵循项目规范）
- 所有音效 key 必须在现有音频注册表中存在，不新增音频文件
- 使用 `defineEvents()` 和 `feedbackResolver` 架构，确保音效与事件自动关联
