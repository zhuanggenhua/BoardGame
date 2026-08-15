# Change: 实装大杀四方 Kaiju POD 版

## Why

项目已有 Kaiju（`kaiju`）的完整静态数据、玩法能力、基地和泰坦，但尚无独立的 POD 派系身份与用户提供的 POD 卡图接线。

用户提供的源图为 `1876 x 2100`、`4 x 5` 的完整 20 张物理牌组。图面对象与当前 Kaiju 玩法对象逐项对应，因此本次应新增可独立选择的 `kaiju_pod` 变体，通过显式变体绑定复用已经验证的玩法链，而不是复制或改写普通 Kaiju 逻辑。

## What Changes

- 新增独立派系 `KAIJU_POD`，14 个唯一卡牌定义全部使用 `_pod` ID，`count` 合计为 20。
- 接入用户提供的 `4 x 5` Kaiju POD 卡牌图集，并按 row-major 顺序锁定每个对象的首个实体格。
- 新增独立的 POD 静态卡牌定义；能力、交互、持续效果、力量修正和基地能力通过 `variantBindings.ts` 显式复用普通 Kaiju。
- 由现有 POD 基地 skeleton 机制生成 `base_tokyo_pod` 与 `base_kaiju_island_pod`；因未提供 POD 基地图，继续复用普通基地美术，不猜造新素材。
- 继续复用 `kaiju_gorgodzolla`，不新增 `_pod` 泰坦。
- 补齐 faction metadata、双语 locale、关键图片预加载、两层 manifest、定向上传、测试、E2E 与 evidence。
- 用户明确要求图集进入 PR，因此仅对 Kaiju POD 的源 PNG 与运行时 WebP 使用强制 Git 纳入，不扩大到其他忽略资源。

## Source Contract

- 源图：`C:/Users/Dqm/.codex/attachments/f382a7f0-a7a3-4b3d-857e-6c0a6659df1c/image-1.png`
- SHA-256：`887F27DDE9579B9BA77E1C67653F9F29A2DA33F76899CBBC479419AD52C901E3`
- 文件大小：`5,928,968` 字节
- 像素尺寸：`1876 x 2100`
- 网格：`4 x 5`，20 格均为有效卡牌正面
- 图片是本轮卡图、对象名称、实体数量与 atlas slot 的主真相源；普通 Kaiju 数据与能力实现是玩法共享链的对照源。

## Impact

- Affected specs:
  - `smashup-faction-registry`
  - `game-asset-preloading`
  - `asset-manifest`
- Affected code and assets:
  - `src/games/smashup/domain/ids.ts`
  - `src/games/smashup/domain/atlasCatalog.ts`
  - `src/games/smashup/domain/variantBindings.ts`
  - `src/games/smashup/data/factions/kaiju_pod.ts`
  - `src/games/smashup/data/cards.ts`
  - `src/games/smashup/ui/factionMeta.ts`
  - `public/locales/{zh-CN,en}/game-smashup.json`
  - `public/assets/i18n/zh-CN/smashup/cards/{kaiju_pod.png,compressed/kaiju_pod.webp}`
  - `public/assets/i18n/{zh-CN/smashup/,}assets-manifest.json`
  - `src/games/smashup/__tests__/`
  - `e2e/smashup/`
  - `evidence/smashup/`
