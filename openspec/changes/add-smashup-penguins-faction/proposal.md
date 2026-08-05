# Change: 实装大杀四方企鹅派系

## Why

用户提供了企鹅（`penguins`）中文卡牌图集，并询问该种族是否能按图集实装到当前 Smash Up 项目中。

当前仓库已经存在 `penguins` faction id、企鹅 card/base atlas 预留、以及已单独实装的泰坦 `penguins_emperor_penguin`（企鹅帝皇），但没有完整企鹅派系的卡牌数据文件、能力文件、卡牌注册、资源接线、基地定义或真实入口验证。因此本 change 需要把“泰坦已存在、派系本体未完成”的半接入状态补成正式可选、可初始化、可结算的完整派系。

## Approval

- 当前状态：**已批准并完成玩法实现收口**。
- 2026-08-06 用户明确要求完成普通企鹅玩法实现并提 PR；企鹅图面素材已在本地资源链中存在，服务器素材主源上传不作为本玩法 PR 门禁。

## What Changes

- 新增/补齐 `PENGUINS` 作为独立 Smash Up 派系，进入派系选择、牌组构建、基地池和运行时卡牌注册。
- 接入用户提供的 4 x 4 企鹅卡牌图集，前 15 格作为唯一卡面，最后 1 格作为派系封面/非运行时手牌图，不注册成卡牌。
- 基于 TTS Workshop JSON 实测牌组构成录入 15 个唯一卡面、20 张实体牌：
  - 10 张随从：冲浪企鹅、跳舞企鹅、时髦企鹅、企鹅司令、乔装企鹅、反刍企鹅、企鹅宝宝 x4。
  - 10 张行动：秘密任务、破壳而出 x2、渴望飞翔的工作 x2、跳上船、我不能区分他们、水晶礼品、在冰下、冰滑道。
- 接入 2 张企鹅基地：浮冰（`Ice Floe`）与企鹅殖民地（`The Colony`），并锁定断点与 VP/正文后进入基地池。
- 复用现有 `penguins_emperor_penguin` 企鹅帝皇泰坦静态定义与能力实现；本 change 不重写泰坦逻辑，但必须验证完整企鹅派系选中后仍能关联该泰坦。
- 补齐 card/base 静态定义、locale 文案、faction metadata、critical image preload、ability 注册、targetType/generic 审计口径、Vitest、E2E 与 evidence。
- 按逐卡 effect atom 实现企鹅派系玩法，重点覆盖牌库顶打出/展示/抽取、额外随从、基地间移动、回牌库顶/底、洗牌、计分后/特殊/持续/天赋语义与基地能力。
- 资源链完成本地压缩与 manifest 接入；服务器素材主源上传按用户当前口径登记为本玩法 PR 范围外 scoped-debt，不作为普通企鹅玩法完成阻塞。

## Source Contract

- 主真相源（卡牌图集、中文图面、卡牌 row-major 顺序）：
  - 路径：`C:/Users/Dqm/Downloads/Smash Up! by Mervil (2833984701)-汉化版/Smash Up! by Mervil (2833984701)-汉化图/Mods/Images/httpssteamusercontentaakamaihdnetugc12525124226911050840CB5F786C1B581BD0042AFE893727307903CA6E7.png`
  - 尺寸：`2914 x 4096`
  - 文件大小：`26,245,540 bytes`
  - SHA-256：`B34AC6108260ECDCB21B3896A179438FA637FFF65B73535C3B1E0BD2868B22B7`
  - 用途：中文图面、中文名称、中文规则文本、card atlas row-major 顺序。
- 主真相源（TTS deck/base/titan 归属、实体重复数量、CardID、CustomDeck 元数据）：
  - 路径：`C:/Users/Dqm/Downloads/Smash Up! by Mervil (2833984701)-汉化版/Smash Up! by Mervil (2833984701)-汉化图/Mods/Workshop/2833984701.json`
  - 文件大小：`9,660,973 bytes`
  - SHA-256：`9CB9EC26259D8BF85BFB6FA84F9B14A7D32A6E21AD075B8B6C62757BD24CFF1D`
  - 用途：牌组构成、重复数量、基地归属、基地断点、泰坦归属、TTS `CardID` 对照。
- 主真相源（基地 atlas）：
  - 路径：`C:/Users/Dqm/Downloads/Smash Up! by Mervil (2833984701)-汉化版/Smash Up! by Mervil (2833984701)-汉化图/Mods/Images/httpssteamusercontentaakamaihdnetugc1252512422691112547E6A99450AAC345B602261AD2D192DA475B79A73A.png`
  - 尺寸：`2096 x 1492`
  - 文件大小：`4,443,493 bytes`
  - SHA-256：`6BEE13FE3B910D0A4DD48C0F260EBDD5D38C0A958D434C4BA0AC4BDF164619C2`
  - 用途：2 x 2 基地图集、浮冰与企鹅殖民地的正式运行时资源来源。
- 已存在运行时真相：
  - `src/games/smashup/data/titans.ts` 已存在 `penguins_emperor_penguin`（企鹅帝皇）。
  - `src/games/smashup/abilities/titans.ts` 已存在企鹅帝皇回合开始进场、持续主动能力、天赋与交互 handler。
  - 本 change 只做复用与派系整合验证，不把泰坦重新实现一遍。
- 对照源：
  - TTS 卡名/实体数与卡牌图面互相校验。
  - 如英文 canonical 正文或图面模糊字段需要补证，implementation 前使用项目约定的 Smash Up 对照/爬虫来源；不得凭记忆补写英文规则。

## Initial Card Matrix

| Row-major | English | 中文名 | Type | Power | Count | Status |
| --- | --- | --- | --- | --- | --- | --- |
| 0 | Surfing Penguin | 冲浪企鹅 | Minion | 3 | 1 | 待裁图锁全文 |
| 1 | Dancing Penguin | 跳舞企鹅 | Minion | 4 | 1 | 待裁图锁全文 |
| 2 | Snazzy Penguin | 时髦企鹅 | Minion | 3 | 1 | 待裁图锁全文 |
| 3 | Command Penguin | 企鹅司令 | Minion | 4 | 1 | 待裁图锁全文 |
| 4 | Disguise Penguin | 乔装企鹅 | Minion | 3 | 1 | 待裁图锁全文 |
| 5 | Secret Mission | 秘密任务 | Action | - | 1 | 待裁图锁全文 |
| 6 | The Hatching | 破壳而出 | Action | - | 2 | 待裁图锁全文 |
| 7 | Regurgitating Penguin | 反刍企鹅 | Minion | 2 | 1 | 待裁图锁全文 |
| 8 | Baby Penguin | 企鹅宝宝 | Minion | 2 | 4 | 待裁图锁全文 |
| 9 | A Wish for Wings That Work | 渴望飞翔的工作 | Action | - | 2 | 待裁图锁全文 |
| 10 | Leaping Aboard | 跳上船 | Action | - | 1 | 待裁图锁全文 |
| 11 | I Can't Tell Them Apart | 我不能区分他们 | Action | - | 1 | 待裁图锁全文 |
| 12 | Pebble Gift | 水晶礼品 | Action | - | 1 | 待裁图锁全文 |
| 13 | Under the Ice | 在冰下 | Action | - | 1 | 待裁图锁全文 |
| 14 | Ice Slide | 冰滑道 | Action | - | 1 | 待裁图锁全文 |
| 15 | Penguins | 企鹅 | Faction cover / non-card | - | 0 | 不注册成手牌 |

## Coordination

- 当前工作区有大量未提交历史/并行改动；实施时必须只增量修改企鹅相关文件，不回滚、不格式化、不重排其它任务改动。
- 当前 `SMASHUP_FACTION_IDS.PENGUINS`、`SMASHUP_ATLAS_IDS.PENGUINS_CARDS`、`SMASHUP_ATLAS_IDS.PENGUINS_BASES` 已存在，优先复用既有 id 合同。
- 现有 `SMASHUP_IN_PROGRESS_FACTION_IDS` 未列入企鹅；实施后要确保企鹅不只是“id 可见”，而是有卡牌/基地/metadata/玩法证据。
- 现有审计 `evidence/smashup/SMASHUP-CARD-COUNT-AUDIT.md` 标记企鹅未实现；实施完成后必须回写当前状态，不能让旧结论继续误导。
- 若运行时资源进入 `public/assets/**` 且被 `.gitignore` 忽略，当前玩法 PR 必须完成本地 manifest 验证；服务器素材主源发布需在后续发布环境明确要求时单独执行与回查，不能反向阻塞本次普通企鹅玩法 PR。

## Impact

- Affected specs:
  - 新增 `smashup-penguins-faction`
  - `smashup-faction-registry`
  - `game-asset-preloading`
  - `asset-manifest`
  - 关联现有 `smashup-titans` 复用验证
- Affected code and assets after approval:
  - `src/games/smashup/domain/ids.ts`
  - `src/games/smashup/domain/atlasCatalog.ts`
  - `src/games/smashup/data/factions/penguins.ts`
  - `src/games/smashup/data/cards.ts`
  - `src/games/smashup/abilities/penguins.ts`
  - `src/games/smashup/abilities/index.ts`
  - `src/games/smashup/ui/factionMeta.ts`
  - `src/games/smashup/criticalImageResolver.ts`
  - `public/locales/{zh-CN,en}/game-smashup.json`
  - `public/assets/i18n/zh-CN/smashup/cards/penguins.*`
  - `public/assets/i18n/zh-CN/smashup/base/penguins.*`
  - `public/assets/i18n/zh-CN/smashup/assets-manifest.json`
  - `public/assets/i18n/assets-manifest.json`
  - `src/games/smashup/__tests__/`
  - `e2e/smashup/`
  - `evidence/smashup/`
