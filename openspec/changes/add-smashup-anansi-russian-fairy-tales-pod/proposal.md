# Change: 实装阿南西传说与俄罗斯童话 POD 版

## Why

用户提供了 Anansi Tales 与 Russian Fairy Tales 的两张官方英文 POD 卡牌图集。当前主线已经登记了两个 `4 x 5` atlas ID，但没有独立 POD 派系、卡牌定义、玩法绑定、双语文案与正式资源文件，因此图集仍不可从真实派系选择与运行时链路使用。

两张图各包含 20 张实体牌，卡面规则与当前经典版逐项一致；本次应新增独立 POD faction/card IDs，并通过显式 variant profile 共享经典版能力。用户未提供 POD 基地图，因此基地池必须共享经典版基地，不能虚构 `_pod` 基地或替换经典版资源。

## What Changes

- 新增 `ANANSI_TALES_POD` 与 `RUSSIAN_FAIRY_TALES_POD` 两个可选派系，以及 29 个独立 `_pod` 卡牌定义。
- 按用户图集的 `1876 x 2100`、`4 x 5` row-major 槽位映射 40 张实体牌；重复牌由 `count` 表达。
- 为两个 POD family 显式声明 ability、interaction、ongoing、baseAbility、powerModifier 与 basePool 均为 `shared`。
- 注册 faction metadata、双语 faction/card locale、关键图片预加载与图集解析。
- 将两张源 PNG 与压缩 WebP 接入 `en`、`zh-CN` 正式资源树，更新 manifest、发布到服务器素材主源并远端回查。
- 新增逐对象 intake/implementation evidence 与集成测试，证明静态字段、槽位、能力别名、真实执行和共享基地池。

## Source Contract

- Anansi Tales POD：`image-1.png`，`6213661` bytes，`1876 x 2100`，`4 x 5`。
- Russian Fairy Tales POD：`image-2.png`，`6438382` bytes，`1876 x 2100`，`4 x 5`。
- 用户附件是图片与槽位的主真相源；当前经典版卡牌定义、双语文案与能力实现只作为规则一致性对照源。

## Coordination

- 活跃 change `refactor-smashup-variant-binding-metadata` 已在当前主线提供 `variantBindings.ts`，本 change 直接添加两个显式 profile，不恢复未声明的隐式继承。
- 当前 atlas catalog 已存在两个目标 atlas ID；本 change 复用这些稳定 ID，不重复定义。
- 不修改经典版 `anansi_tales`、`russian_fairy_tales` 的 faction metadata、卡图或基地语义。

## Impact

- Affected specs: `smashup-faction-registry`, `game-asset-preloading`, `asset-manifest`
- Affected code/assets:
  - `src/games/smashup/domain/ids.ts`
  - `src/games/smashup/domain/variantBindings.ts`
  - `src/games/smashup/data/factions/`
  - `src/games/smashup/data/cards.ts`
  - `src/games/smashup/ui/factionMeta.ts`
  - `src/games/smashup/criticalImageResolver.ts`
  - `public/locales/{en,zh-CN}/game-smashup.json`
  - `public/assets/i18n/{en,zh-CN}/smashup/`
  - `src/games/smashup/__tests__/`
  - `evidence/smashup/`
