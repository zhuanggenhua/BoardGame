# Change: 实装大杀四方迷你萌宠与时间旅行者 POD 版

## Why

当前项目已经实装迷你萌宠（`itty_critters`）与时间旅行者（`time_travelers`）基础版的静态数据、玩法能力、基地和泰坦，但还没有对应的独立 POD 派系 ID、POD 卡牌 ID 与用户提供的 POD 图集接线。

用户提供的两张源图均为 `1876 x 2100`、`4 x 5` 的完整 20 张物理牌组。图面规则与当前基础版玩法一致，因此本次应新增两个可独立选择的 POD 变体，复用已经验证的玩法链，而不是复制或改写基础版逻辑。

## What Changes

- 新增独立派系 `ITTY_CRITTERS_POD` 与 `TIME_TRAVELERS_POD`，所有派系卡牌和基地使用独立 `_pod` ID。
- 接入用户提供的两张 `4 x 5` POD 卡牌图集，按图面 row-major 顺序映射 20 张物理卡牌；重复卡共用同一运行时定义的 `count`，预览索引指向对应首个图格。
- 完整定义两个 POD 派系的静态卡牌数据，不从基础版数据对象隐式继承；玩法能力、交互、持续效果、力量修正、基地能力和泰坦通过明确的共享变体关系复用基础版实现。
- 为迷你萌宠 POD 注册 `base_critter_combat_club_pod`、`base_itty_city_pod`，为时间旅行者 POD 注册对应的两个 `_pod` 基地 ID。由于本轮没有提供 POD 基地图，基地卡图明确复用现有基础版资源，不生成或猜测新素材。
- 迷你萌宠 POD 复用彩虹鸟（`itty_critters_rainboroc`），时间旅行者 POD 复用时间盒子（`time_travelers_time_box`），不复制新的 `_pod` 泰坦对象。
- 补齐 faction metadata、双语 locale、关键图片预加载、manifest、R2/CDN 发布与远端回查。
- 为两个 POD 派系建立逐对象 intake、规则子句、共享链判等、L0-L4 审计与真实入口 E2E evidence。

## Source Contract

- 迷你萌宠 POD 图集：
  - 路径：`D:/共享/game/Smash Up! by Mervil (2833984701)/Mods/Images/httpssteamusercontentaakamaihdnetugc1587471759034604409022E3B40EC5D2F2E68709C548E467CF40A69F80C9.png`
  - SHA-256：`B6650817DAD672723AADCC792D6D8AF5EC07F4891760715B5300F9A1FE17DE19`
- 时间旅行者 POD 图集：
  - 路径：`D:/共享/game/Smash Up! by Mervil (2833984701)/Mods/Images/httpssteamusercontentaakamaihdnetugc1029163221107618800862560B0150B183EBCFC653E87B4B545A0DE26D05.png`
  - SHA-256：`1793E25B548566F6A8973BA8D09D9C824DC94E593FDF5A7E8963CCA979DDA200`
- 两张源图均为用户指定的本轮卡图真相源；当前基础版数据、能力实现与既有 evidence 仅作为玩法语义和共享链对照源。

## Coordination

- 活跃 change `refactor-smashup-variant-binding-metadata` 正在定义经典版/POD 显式变体绑定真相源，并与本次派系注册、能力别名和基地池 surface 重叠。
- 本 change 不得重新引入“未声明即自动继承”的新依赖：若该重构在本 change 实施前落地，两个新 POD family 必须声明为 `shared`；若尚未落地，实施时必须同时留下可迁移的共享关系测试，并把两个 family 纳入该重构的迁移清单。

## Impact

- Affected specs:
  - `smashup-faction-registry`
  - `game-asset-preloading`
  - `asset-manifest`
- Affected code and assets:
  - `src/games/smashup/domain/ids.ts`
  - `src/games/smashup/domain/atlasCatalog.ts`
  - `src/games/smashup/data/factions/`
  - `src/games/smashup/data/cards.ts`
  - `src/games/smashup/abilities/`
  - `src/games/smashup/data/titans.ts`
  - `src/games/smashup/ui/factionMeta.ts`
  - `src/games/smashup/criticalImageResolver.ts`
  - `public/locales/{zh-CN,en}/game-smashup.json`
  - `public/assets/i18n/zh-CN/smashup/`
  - `src/games/smashup/__tests__/`
  - `e2e/smashup/`
  - `evidence/smashup/`
