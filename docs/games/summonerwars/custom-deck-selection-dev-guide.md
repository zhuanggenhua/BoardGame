# 召唤师战争自定义牌组开发索引

本文只保留当前实现入口和维护边界；不复制组件 props、API 代码或旧贡献模板。

## 当前入口

| 目标 | 文件 |
| --- | --- |
| 用户说明 | [custom-deck-selection-user-guide.md](custom-deck-selection-user-guide.md) |
| API 客户端 | [src/api/custom-deck.ts](../../../src/api/custom-deck.ts) |
| 牌组构建配置 | [deckBuilder.ts](../../../src/games/summonerwars/config/deckBuilder.ts) |
| 序列化 / 反序列化 | [deckSerializer.ts](../../../src/games/summonerwars/config/deckSerializer.ts) |
| 牌组抽屉 UI | [DeckBuilderDrawer.tsx](../../../src/games/summonerwars/ui/DeckBuilderDrawer.tsx) |
| 自定义牌组卡片 | [CustomDeckCard.tsx](../../../src/games/summonerwars/ui/CustomDeckCard.tsx) |
| 牌组 helper | [customDeckHelpers.ts](../../../src/games/summonerwars/ui/helpers/customDeckHelpers.ts) |

## 数据流

1. 已登录用户进入阵营选择。
2. 前端通过 `listCustomDecks` 读取可用自定义牌组摘要。
3. 用户选择某个自定义牌组后，通过 `getCustomDeck` 读取完整牌组。
4. 选择结果进入 `SELECT_CUSTOM_DECK` 命令或等价选择回调。
5. 游戏启动时由 `buildGameDeckFromCustom` 转成运行时牌组。

## 维护边界

- 牌组合法性、卡牌数量、阵营归属和序列化字段以 `config/` 与领域类型为准。
- UI 只负责选择、编辑入口、占用状态和预览；不得把牌组合法性写成第二套 UI 判断。
- API 文档以源码和服务端路由为准；本文不维护复制版接口说明。
- 测试应覆盖序列化、构筑规则、UI 卡片、抽屉交互和实际选牌进入游戏的合同。

## 相关测试

- [deckBuilder.test.ts](../../../src/games/summonerwars/__tests__/deckBuilder.test.ts)
- [deck-builder.property.test.ts](../../../src/games/summonerwars/__tests__/deck-builder.property.test.ts)
- [deck-validation.property.test.ts](../../../src/games/summonerwars/__tests__/deck-validation.property.test.ts)
- [deck-game.property.test.ts](../../../src/games/summonerwars/__tests__/deck-game.property.test.ts)
- [CustomDeckCard.test.tsx](../../../src/games/summonerwars/ui/__tests__/CustomDeckCard.test.tsx)
- [CardPoolPanel.test.tsx](../../../src/games/summonerwars/ui/deckbuilder/__tests__/CardPoolPanel.test.tsx)
