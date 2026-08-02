# Change: 实装大杀四方企鹅派系

## Why

用户提供了企鹅（Penguins）的中文卡牌图集，并要求将该种族实装到当前 Smash Up 项目中，做到可以游玩，同时把图集一起提交、推送并打开 PR 给作者。

当前仓库已经存在 `PENGUINS` 派系 id、企鹅泰坦 `企鹅帝皇`、企鹅卡牌/基地 atlas id 的部分预留，但普通 20 张派系牌、2 张基地、卡牌图集资源和多数“从牌库顶打出随从”玩法尚未作为可选派系接入。本变更把这条半接入状态补成正式可玩。

## Approval

- 当前状态：**用户已直接要求实施并重试**。
- 本 proposal 保留范围、来源、冲突裁决和门禁记录；在本轮直接进入实现、验证、上传与 PR。

## What Changes

- 新增 `PENGUINS` 作为可选择、可初始化、可结算的 Smash Up 派系。
- 将用户提供的中文卡牌图集接入正式资源路径，保留源 PNG 与压缩 WebP，刷新 asset manifest。
- 接入企鹅基地 atlas；修正其 atlas catalog 为实际 `2 x 2` 网格，并用非重复槽位映射两张基地。
- 录入 15 个唯一卡面，按官方牌张数量构成 20 张牌：企鹅宝宝 4，破壳而出 2，渴望飞翔的工作 2，其余唯一牌各 1。
- 录入 2 个基地：浮冰、殖民地。
- 补齐 card/base 静态定义、locale 文案、faction metadata、ability 注册、关键图片预加载路径、测试与 evidence。
- 按用户中文图集实现旧版文本语义；当新版官方 rulebook 与用户图集存在勘误差异时，以用户图集为玩法真相源，官方页面只用于数量、基地存在性和“从牌库顶打出”通用规则对照。
- 资源链完成 manifest、服务器素材主源上传与代表 URL `HEAD 200` 回查；若环境阻塞，必须明确列出未上传对象和运行态风险。
- 最终提交、推送并打开 PR，PR 范围包含本轮代码、OpenSpec/evidence、卡牌/基地 atlas 源图、压缩产物和 manifest 改动。

## Source Contract

- 主真相源（用户卡牌图集）：
  - 路径：`C:/Users/Dqm/.codex/attachments/aad75450-1739-4012-80ae-505dc015b5bc/image-1.png`
  - 尺寸：`2914 x 4096`
  - 文件大小：`26,245,540 bytes`
  - SHA-256：`B34AC6108260ECDCB21B3896A179438FA637FFF65B73535C3B1E0BD2868B22B7`
  - 用途：中文图面、中文名称、中文规则文本、card atlas row-major 顺序。
- 企鹅基地 atlas：
  - 路径：`public/assets/i18n/zh-CN/smashup/base/penguins.png`
  - 尺寸：`2096 x 1492`
  - 文件大小：`4,443,493 bytes`
  - SHA-256：`6BEE13FE3B910D0A4DD48C0F260EBDD5D38C0A958D434C4BA0AC4BDF164619C2`
  - 用途：浮冰、殖民地中文图面与基地 row-major 槽位；该图集实际为 `2 x 2`，两张基地各重复一次。
- 对照源：
  - AEG Smash Up rulebook: `https://smashup-rulebook.alderac.com/wiki/Penguins`
  - AEG Penguins insert PDF: `https://www.alderac.com/wp-content/uploads/2020/02/SU-WTEventKit-AEG5557-InsertSheet-copy.pdf`
  - 用途：官方牌张数量、基地名/数值、泰坦存在性、“Play X off the top of your deck”通用规则与新旧文本冲突标注。
- 初步 atlas 合同：
  - 卡牌图集：`rows=4, cols=4`，row-major 槽位 `0-14` 为 15 张唯一卡面，槽位 `15` 为 logo，不注册为卡。
  - 基地图集：`rows=2, cols=2`，row-major 槽位 `0=浮冰`、`2=殖民地`；槽位 `1/3` 是重复卡面，不注册为独立基地。

## Impact

- Affected specs:
  - 新增 `smashup-penguins-faction`
  - `smashup-faction-registry`
  - `smashup-ability-runtime`
  - `game-asset-preloading`
  - `asset-manifest`
- Affected code and assets:
  - `src/games/smashup/domain/atlasCatalog.ts`
  - `src/games/smashup/data/factions/penguins.ts`
  - `src/games/smashup/data/cards.ts`
  - `src/games/smashup/abilities/penguins.ts`
  - `src/games/smashup/abilities/index.ts`
  - `src/games/smashup/ui/factionMeta.ts`
  - `public/locales/{zh-CN,en}/game-smashup.json`
  - `public/assets/i18n/zh-CN/smashup/cards/penguins.*`
  - `public/assets/i18n/zh-CN/smashup/base/penguins.*`
  - `public/assets/i18n/zh-CN/smashup/assets-manifest.json`
  - `public/assets/i18n/assets-manifest.json`
  - `src/games/smashup/__tests__/*penguins*`
  - `evidence/smashup/*penguins*`
