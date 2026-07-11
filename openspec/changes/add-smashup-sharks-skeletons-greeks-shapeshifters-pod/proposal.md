# Change: 实装大杀四方鲨鱼、骷髅、希腊神话与变形者 POD 版

## Why

用户提供了鲨鱼、骷髅、希腊神话、变形者与龙五张 POD 卡图。龙族已由活跃 change `add-smashup-dragons-superheroes-magical-girls-mega-troopers-pod` 承载，本 change 只新增其余四个尚无独立注册的 POD 派系，避免重复规格。

四张新增图均为 `4 x 5` 的完整 20 张物理牌组，图面规则与当前基础版玩法一致，因此应创建独立卡牌/基地身份并通过显式 `shared` 变体绑定复用现有能力。

## What Changes

- 新增鲨鱼、骷髅、希腊神话与变形者 POD 派系 ID、完整静态卡牌定义、独立 `_pod` 卡牌 ID 与 `4 x 5` 图集。
- 为四个 POD 派系生成独立 `_pod` 基地身份，复用当前基础基地图片和能力。
- 将四族加入显式变体绑定、派系选择、双语派系文案和关键图片预加载。
- 复制用户原图到英语正式资源目录，生成压缩 WebP 并更新资源清单。
- 与已有龙族 POD change 协调，在同一集成测试中验证五张用户卡图。

## Source Contract

详见 `evidence/smashup/2026-07-10-sharks-skeletons-greeks-shapeshifters-dragons-pod-intake.md`。

## Impact

- Affected specs:
  - `smashup-faction-registry`
  - `game-asset-preloading`
  - `asset-manifest`
- Affected code:
  - `src/games/smashup/domain/ids.ts`
  - `src/games/smashup/domain/atlasCatalog.ts`
  - `src/games/smashup/domain/variantBindings.ts`
  - `src/games/smashup/data/factions/`
  - `src/games/smashup/data/cards.ts`
  - `src/games/smashup/data/englishAtlasMap.json`
  - `src/games/smashup/ui/factionMeta.ts`
  - `public/locales/{zh-CN,en}/game-smashup.json`
  - `public/assets/i18n/en/smashup/cards/`
  - `src/games/smashup/__tests__/`
