# Change: 实装大杀四方动作英雄 POD 版

## Why

用户提供了动作英雄（Action Heroes）的完整 POD 卡图。当前主线已经具备动作英雄基础版的卡牌、能力、基地与本地化，但尚未注册可独立选择的 POD 派系和对应 `4 x 5` 卡牌图集。

图面规则与现有基础版玩法一致，因此本 change 只新增完整 `_pod` 静态卡牌身份、独立图集和变体注册，通过显式 `shared` 关系复用现有能力；基地池使用自动生成的独立 `_pod` 基地身份。

## What Changes

- 新增动作英雄 POD 派系 ID、17 个唯一卡牌定义、20 张物理牌组和独立 `4 x 5` 图集。
- 将动作英雄基础版与 POD 版加入显式变体绑定，复用能力、交互、持续效果、基地能力和力量修正，保持基地池独立。
- 注册派系元数据、双语派系文案、关键图片预加载与定向接入测试。
- 将用户原图放入英语正式资源命名空间，生成不缩放 WebP、更新增量资源清单并发布运行时对象。
- 在 `evidence/smashup/` 留存来源哈希、槽位映射、验证与远端发布证据。

## Source Contract

- Source SHA-256: `EDA3C17D9C5483E0930AB5D8CDFB3AE632C6D1004699C98B79298302D21954BC`
- Source dimensions: `1876 x 2100`
- Grid: `4 rows x 5 columns`, row-major, nominal slot size `1876/5 x 2100/4 ≈ 375.2 x 525 px`
- Physical deck: 14 actions + 6 minions = 20 cards

完整槽位契约与验收证据记录于 `evidence/smashup/2026-08-10-action-heroes-pod-intake.md`。

## Impact

- Affected specs:
  - `smashup-faction-registry`
  - `game-asset-preloading`
  - `asset-manifest`
- Affected code:
  - `src/games/smashup/domain/ids.ts`
  - `src/games/smashup/domain/atlasCatalog.ts`
  - `src/games/smashup/domain/variantBindings.ts`
  - `src/games/smashup/data/factions/action_heroes_pod.ts`
  - `src/games/smashup/data/cards.ts`
  - `src/games/smashup/ui/factionMeta.ts`
  - `public/locales/{zh-CN,en}/game-smashup.json`
  - `public/assets/i18n/en/smashup/cards/`
  - `src/games/smashup/__tests__/actionHeroesPodIntegration.test.ts`
