# SmashUp 巫师空牌库抽牌/揭示反馈收口证据

## 范围

- 反馈：`69feac13f0a61f28ba015c93`
- 游戏：`smashup`
- 线上局：`7_Og5zZYd40`
- 问题：玩家牌库为空、弃牌堆有牌时，巫师抽牌/看牌库顶链路没有正确把弃牌堆洗回牌库后继续，表现为“抽牌法师随从不抽牌”。

## 线上现场

生产 Mongo 快照显示：

- 当前阶段：`playCards`
- 玩家 0 牌库：空
- 玩家 0 当前手牌：`alien_invasion_pod`、`alien_disintegrator_pod`、`alien_scout_pod`
- 玩家 0 弃牌堆：26 张，包括 `wizard_neophyte_pod`、`wizard_scry_pod`、`wizard_mystic_studies_pod`、`wizard_enchantress_pod` 等
- Action Log 中先后出现：
  - `随从登场： 学徒 -> 家园` 后记录 `牌库为空`
  - `随从登场： 女巫 -> 家园` 后记录 `抽1张牌`
- 关键矛盾：女巫日志已记录抽牌，但快照里玩家 0 手牌仍只有原 3 张，说明旧实现只发了抽牌日志/事件，没有让洗回弃牌堆后的牌真正进入手牌。

## 修复

- `wizard_neophyte` 能力在没有 `deck[0]` 时改走通用 `peekDeckTop`。
- `peekDeckTop` 已实现“look/reveal/search/draw 需要牌库顶而牌库为空时，将弃牌堆洗回牌库并继续”的规则。
- 因 POD 能力通过别名复用 `wizard_neophyte` 程序，`wizard_neophyte_pod` 同步生效。
- `wizard_enchantress` 与 `wizard_mystic_studies` 改为复用 `buildStandardDrawEvents`。
  - 旧逻辑直接调用 `drawCards()` 后只发 `CARDS_DRAWN`。
  - 当 deck 为空时，`drawCards()` 计算出的 `drawnUids` 来自洗回后的 discard，但 reducer 在旧空 deck 中找不到这些 uid，最终不会进手牌。
  - 标准事件链会先发 `DECK_RESHUFFLED`，再发 `CARDS_DRAWN`，reducer 能按同批事件顺序把卡真正抽入手牌。
- `wizard_sacrifice` 的按力量抽牌也同步改走 `buildStandardDrawEvents`，避免同类空牌库假抽牌。

## 验证

- `npx eslint src/games/smashup/abilities/wizards.ts src/games/smashup/__tests__/factionAbilities.test.ts`
  - 结果：0 errors，11 个既有 warnings。
- `npx vitest run src/games/smashup/__tests__/factionAbilities.test.ts -t "69feac13"`
  - 结果：3 passed。
  - 覆盖：
    - `wizard_neophyte_pod`：牌库空、弃牌堆非空时产生 `DECK_REORDERED` + `REVEAL_DECK_TOP`，并打开 `wizard_neophyte` 选项。
    - `wizard_enchantress`：牌库空、弃牌堆非空时产生 `DECK_RESHUFFLED` + `CARDS_DRAWN`，抽到的牌实际进入手牌。
    - `wizard_mystic_studies`：牌库空、弃牌堆非空时产生 `DECK_RESHUFFLED` + `CARDS_DRAWN`，两张牌实际进入手牌。
- `npx vitest run src/games/smashup/__tests__/factionAbilities.test.ts`
  - 结果：46 passed。
