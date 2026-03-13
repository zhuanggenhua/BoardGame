# Implementation Plan: 召唤师战争自定义牌组

## Overview

基于已批准的需求和设计文档，将自定义牌组功能拆分为增量式编码任务。从共享的验证逻辑和数据模型开始，逐步构建前端 UI 和后端 API，最后集成到游戏初始化流程。

## Tasks

- [x] 1. 卡牌注册表与验证引擎
  - [x] 1.1 创建卡牌注册表 `src/games/summonerwars/config/cardRegistry.ts`
    - 遍历所有阵营的 `createXxxDeck()` 提取全部卡牌（召唤师、冠军、普通、事件、建筑）
    - 导出 `buildCardRegistry(): Map<string, Card>` 和 `getCardPoolByFaction(factionId): Card[]`
    - 按类型分组的辅助函数 `groupCardsByType(cards: Card[])`
    - _Requirements: 2.2_

  - [x] 1.2 创建牌组验证引擎 `src/games/summonerwars/config/deckValidation.ts`
    - 实现 `validateDeck(deck: DeckDraft): DeckValidationResult`
    - 实现 `canAddCard(deck: DeckDraft, card: Card): { allowed: boolean; reason?: string }`
    - 实现 `getSymbolMatch(card: Card, summonerSymbols: string[]): boolean`
    - 定义 `DeckDraft`、`DeckValidationResult`、`DeckValidationError` 等类型
    - 验证规则：召唤师1、十生命城门1、五生命城门3、起始单位2、史诗事件2、标准事件6、冠军3、普通16、符号匹配
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 4.4, 4.5, 4.6, 3.5, 4.2_

  - [x] 1.3 创建序列化/反序列化函数 `src/games/summonerwars/config/deckSerializer.ts`
    - 实现 `serializeDeck(draft: DeckDraft): SerializedCustomDeck`
    - 实现 `deserializeDeck(data: SerializedCustomDeck, registry: CardRegistry): DeckDraft`
    - 定义 `SerializedCustomDeck`、`SerializedCardEntry` 类型
    - _Requirements: 8.1, 8.2_

  - [x]* 1.4 属性测试：验证引擎与序列化
    - **Property 1: 牌组验证完整性** — 生成随机 DeckDraft，验证 validateDeck 正确识别所有违规
    - **Property 3: 符号匹配正确性** — 生成随机卡牌+召唤师组合，验证 getSymbolMatch
    - **Property 4: 卡牌数量上限约束** — 生成达到上限的牌组，验证 canAddCard 拒绝
    - **Property 6: 序列化往返一致性** — 生成合法 CustomDeck，serialize → deserialize 等价
    - 使用 fast-check，每个属性 ≥100 次迭代
    - **Validates: Requirements 5.1-5.8, 3.5, 4.2, 4.4-4.6, 8.1-8.3**

- [x] 2. Checkpoint - 验证引擎测试通过
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. 后端 Custom Deck 模块
  - [x] 3.1 创建 MongoDB Schema `apps/api/src/modules/custom-deck/schemas/custom-deck.schema.ts`
    - 字段：ownerId、name、summonerId、summonerFaction、cards（SerializedCardEntry[]）
    - 索引：`{ ownerId: 1, updatedAt: -1 }`
    - _Requirements: 6.1_

  - [x] 3.2 创建 DTOs `apps/api/src/modules/custom-deck/dtos/`
    - `CreateCustomDeckDto`：name、summonerId、summonerFaction、cards
    - `UpdateCustomDeckDto`：同上（可选字段）
    - 使用 class-validator 进行输入校验
    - _Requirements: 6.1_

  - [x] 3.3 创建 Service `apps/api/src/modules/custom-deck/custom-deck.service.ts`
    - CRUD 方法：create、findAllByOwner、findById、update、delete
    - 权限检查：操作前验证 ownerId 匹配
    - 数量限制：每用户最多 20 个牌组
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [x] 3.4 创建 Controller `apps/api/src/modules/custom-deck/custom-deck.controller.ts`
    - 路由前缀 `/auth/custom-decks`，使用 JwtAuthGuard
    - GET / — 列表、GET /:id — 详情、POST / — 创建、PUT /:id — 更新、DELETE /:id — 删除
    - _Requirements: 6.1, 6.3, 6.5_

  - [x] 3.5 创建 Module 并注册到 AppModule
    - `apps/api/src/modules/custom-deck/custom-deck.module.ts`
    - 在 `apps/api/src/app.module.ts` 中 imports 添加 CustomDeckModule
    - _Requirements: 6.1_

  - [x]* 3.6 后端单元测试
    - 测试 Service 的 CRUD 逻辑（mock MongoDB）
    - 测试权限隔离（用户只能操作自己的牌组）
    - 测试数量上限
    - _Requirements: 6.1, 6.5_

- [x] 4. 前端 API 客户端
  - [x] 4.1 创建 API 客户端 `src/api/custom-deck.ts`
    - `listCustomDecks(token): Promise<SavedDeckSummary[]>`
    - `getCustomDeck(token, id): Promise<SerializedCustomDeck>`
    - `createCustomDeck(token, data): Promise<{ id: string }>`
    - `updateCustomDeck(token, id, data): Promise<void>`
    - `deleteCustomDeck(token, id): Promise<void>`
    - 遵循项目现有 API 调用模式（fetch + buildAuthHeaders）
    - _Requirements: 6.1, 6.3, 6.5_

- [x] 5. Checkpoint - 后端 API 就绪
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. 牌组构建 UI
  - [x] 6.1 创建 useDeckBuilder Hook `src/games/summonerwars/ui/deckbuilder/useDeckBuilder.ts`
    - 管理 DeckDraft 状态、召唤师选择、卡牌添加/移除
    - 调用 deckValidation 进行实时验证
    - 调用 API 客户端进行保存/加载/删除
    - 导出 `UseDeckBuilderReturn` 接口
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 4.1, 4.2, 4.3, 6.1, 6.3, 6.4, 6.5_

  - [x]* 6.2 属性测试：useDeckBuilder 核心逻辑
    - **Property 2: 召唤师选择自动填充** — 选择任意召唤师后验证 autoCards 正确
    - **Property 5: 添加/移除卡牌往返一致性** — addCard → removeCard 恢复原状态
    - 使用 fast-check，每个属性 ≥100 次迭代
    - **Validates: Requirements 3.1-3.4, 4.1, 4.3**

  - [x] 6.3 创建 FactionPanel `src/games/summonerwars/ui/deckbuilder/FactionPanel.tsx`
    - 展示所有可用阵营（复用 FACTION_CATALOG）
    - 点击阵营触发 `selectFaction` 回调
    - 高亮当前选中阵营
    - _Requirements: 2.1, 2.2_

  - [x] 6.4 创建 CardPoolPanel `src/games/summonerwars/ui/deckbuilder/CardPoolPanel.tsx`
    - 按类型分组展示卡牌（召唤师/冠军/普通/事件）
    - 每张卡牌显示名称、类型、费用、符号
    - 不满足符号匹配的卡牌灰显
    - 点击卡牌触发添加逻辑
    - _Requirements: 2.2, 2.3, 3.5, 4.1_

  - [x] 6.5 创建 MyDeckPanel `src/games/summonerwars/ui/deckbuilder/MyDeckPanel.tsx`
    - 展示已选卡牌及数量
    - 自动填充卡牌标记为不可移除
    - 显示验证状态摘要（缺失/超出信息）
    - 保存按钮（验证通过时启用）
    - 已保存牌组列表（加载/删除操作）
    - _Requirements: 2.4, 4.3, 5.9, 5.10, 6.1, 6.2, 6.4, 6.5_

  - [x] 6.6 创建 DeckBuilderDrawer `src/games/summonerwars/ui/DeckBuilderDrawer.tsx`
    - 底部抽屉容器，framer-motion 滑入/滑出动画
    - 三栏布局组合 FactionPanel + CardPoolPanel + MyDeckPanel
    - 点击外部区域或关闭按钮收起
    - 打开时加载已保存牌组列表
    - _Requirements: 2.1, 2.5, 6.3_

- [x] 7. 阵营选择界面集成
  - [x] 7.1 修改 FactionSelectionAdapter 添加自定义牌组入口
    - 在阵营网格末尾添加"自定义牌组"占位卡（仅已登录用户可见）
    - 占位卡显示已保存牌组数量
    - 点击打开 DeckBuilderDrawer
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [x] 7.2 实现自定义牌组选择确认流程
    - 在 DeckBuilderDrawer 中选择已保存牌组后确认
    - 将自定义牌组标记为玩家选择（扩展 selectedFactions 状态）
    - 玩家状态卡显示"自定义牌组"标识和召唤师信息
    - _Requirements: 7.1, 7.2_

- [x] 8. 游戏初始化集成
  - [x] 8.1 新增 SELECT_CUSTOM_DECK 命令
    - 在 `domain/types.ts` 添加 `SW_COMMANDS.SELECT_CUSTOM_DECK`
    - 在 `domain/validate.ts` 添加验证逻辑
    - 在 `domain/execute.ts` 添加执行逻辑（生成 FACTION_SELECTED 事件）
    - 在 `domain/reduce.ts` 处理自定义牌组的状态更新
    - 在 `game.ts` 的 commandTypes 中注册
    - _Requirements: 7.1, 7.3_

  - [x] 8.2 实现 buildGameDeckFromCustom 函数
    - 位置：`src/games/summonerwars/config/deckBuilder.ts`
    - 根据 SerializedCustomDeck 生成与 createDeckByFactionId 相同结构的牌组对象
    - 在 execute.ts 的 HOST_START_GAME 中，检测自定义牌组时调用此函数替代 createDeckByFactionId
    - _Requirements: 7.3_

  - [x]* 8.3 属性测试：游戏牌组生成
    - **Property 7: 自定义牌组生成游戏牌组结构等价性**
    - **Property 8: 阵营卡牌池完整性**
    - 使用 fast-check，每个属性 ≥100 次迭代
    - **Validates: Requirements 7.3, 2.2**

- [x] 9. i18n 文案
  - [x] 9.1 添加中英文文案
    - `public/locales/zh-CN/game-summonerwars.json` 添加 deckBuilder 命名空间下的文案
    - `public/locales/en/game-summonerwars.json` 同步添加英文文案
    - 覆盖：抽屉标题、面板标题、按钮文案、验证错误信息、提示文案
    - _Requirements: 全部 UI 相关需求_

- [x] 10. Final checkpoint - 全部测试通过
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- 验证引擎 (`deckValidation.ts`) 是纯函数，前后端均可复用
- 卡牌注册表从现有阵营数据构建，无需新增卡牌定义
- 序列化采用引用式（cardId + count），保证数据一致性
- Property tests use fast-check with minimum 100 iterations per property
