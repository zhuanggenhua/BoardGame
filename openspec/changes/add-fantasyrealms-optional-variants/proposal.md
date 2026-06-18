# Change: 幻想国度可选规则与新花色扩展

## Why
- `fantasyrealms` 当前已经支持基础版多人流程与双人变体核心回合，但房间层还不能显式选择“二人变体”或“新花色扩展”。
- 现状导致大厅建房、本地测试入口、服务端人数校验与领域规则分支之间没有统一 setup 真相，无法稳定表达“开启二人变体后只能 2 人”“开启新花色后改用扩展牌组与阈值”。
- 官方 `Cursed Hoard` 实际包含两层能力：`新花色扩展（building / outsider / undead）` 与 `诅咒物品（cursed items）`。后者带独立时机与动作语义，不适合在本轮混做。

## What Changes
- 新增 `fantasyrealms-variant-setup` capability，定义幻想国度房间 setup 的可选规则、默认值、公开摘要与人数联动。
- 新增 `fantasyrealms-cursed-hoard-suits` capability，定义仅包含 `building / outsider / undead` 的新花色扩展牌组、替换牌、手牌上限、双人/多人终局阈值与计分语义。
- 为幻想国度增加两个 setup 入口：
  - `规则模式`：基础版多人 / 双人变体
  - `扩展内容`：基础版 / 新花色扩展
- 当选择双人变体时，建房人数 MUST 收窄为 `2`，本地页、测试页与服务端校验都必须使用同一口径。
- 当启用新花色扩展时，运行时 MUST 改用扩展牌组与替换牌，并切换到扩展手牌上限与终局阈值。

## Impact
- Affected specs:
  - `fantasyrealms-variant-setup`
  - `fantasyrealms-cursed-hoard-suits`
- Affected code:
  - `src/games/fantasyrealms/manifest.ts`
  - `src/games/fantasyrealms/roomSetup.ts`
  - `src/games/fantasyrealms/foundation.ts`
  - `src/games/fantasyrealms/data/cards.ts`
  - `src/games/fantasyrealms/domain/**`
  - `src/games/serverLobbySummary.ts`
  - `src/components/lobby/CreateRoomModal.tsx`
  - `src/pages/LocalMatchRoom.tsx`
  - `src/pages/TestMatchRoom.tsx`
  - `src/engine/ai/**`
  - `server.ts`
  - `public/locales/**/game-fantasyrealms.json`

## Scope Notes
- 本 change 只接入 `Cursed Hoard` 的 `ch_suits`，不接 `ch_items`。
- 本 change 不新增诅咒物品 UI、抽取时机、替换回合动作或物品牌堆。
- 本 change 不补扩展卡图 atlas；无现成卡图时允许继续走结构化 fallback 卡面。
