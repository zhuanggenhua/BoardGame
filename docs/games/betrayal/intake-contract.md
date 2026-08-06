# 山屋惊魂 3 版首轮录入合同

## 1. 问题对象

- 游戏：山屋惊魂第三版 / `betrayal`
- 用户素材根目录：`D:\gongzuo\webgame\gameasset\山屋惊魂(小黑屋)第三版（渣图汉化自用)\Mods`
- 本轮目标：把本地素材转成后续易读、易实现、易索引的 intake 结果，而不是现在就完成玩法实现。

### 1.1 2026-07-29 整牌库接续裁定

本文件是首轮素材 intake 合同；整牌库发现牌的当前 S0 主合同已经迁到 `evidence/betrayal/full-audit/full-deck-data-intake-contract.md`。后续引用本文件时必须按下面口径过滤旧结论：

| 口径 | 当前裁定 |
| --- | --- |
| 官方基础游戏牌库 | 74 张游戏牌：43 张事件、22 张物品、9 张预兆 |
| 当前整牌库主真相源 | 用户本地 TTS/Mod 图包、项目正式 atlas、完整裁图和 `full-deck-data-intake-contract.md`；百度、搜索结果、Wiki、旧 E2E、旧截图和当前运行池不能锁定逐卡字段 |
| 事件 atlas | 已锁 43 张正面 + 1 个空黑格 + 1 张背面；E43「最深的壁橱」来自 frame 42，旧 TTS manifest 的 42 候选是旧 `ContainedObjects` 扫描口径，不是图包缺素材 |
| 物品 atlas | 已锁 22 张正面 + 1 个空黑格 + 1 张背面；官方运行物品唯一覆盖 item frame 0-21 |
| 物品 alias | `flashlight / lantern` 共用 frame 8，`map / notebook / journal / manuscript` 共用 frame 16；`lantern / notebook / journal / manuscript` 只作为 legacy / duplicate alias，不计入官方 22 张独立牌 |
| 预兆 atlas | 已锁 9 张正面 frame 0-8；其它格子是牌背/非正面，不是第 10 张预兆 |
| 当前状态 | S0 对象/素材/atlas 数量已闭合；整牌库仍为 `in_progress / downstream-blocked`，含义是可继续补合同和证据，但不能宣称整牌库完成，也不能进入 Board/UI、E2E 或截图验收 |

若本文件下方首轮条目与上述裁定冲突，以 `full-deck-data-intake-contract.md` 的 6.15 合同层队列收口审计为准。

## 2. 真相源与对照源

| 类型 | 现实含义 | 路径/链接 | 本轮角色 | 当前状态 |
| --- | --- | --- | --- | --- |
| 本地图片 | 用户现有汉化图片、牌图、标记图、拼版图 | `Mods\Images` | 主真相源 | 已完成尺寸盘点、缩略图索引、首轮命名 |
| 本地 PDF | 用户现有规则/剧本扫描件 | `Mods\PDF` | 主真相源的补充来源 | 都是扫描型 PDF，当前自动抽取为空 |
| 官方说明页 | 官方组件与下载入口说明 | `https://instructions.hasbro.com/en-ca/instruction/avalon-hill-betrayal-at-house-on-the-hill-3rd-edition-cooperative-board-game-for-ages-12-and-up-for-3-6-players` | 英文对照源 | 已确认可访问 |
| 英文规则书镜像 | 英文规则参考 | `https://www.qugs.org/rules/r358504.pdf` | 英文对照源 | 已确认存在，未并入本地资源树 |
| 英文规则书文本 | 上一条镜像的可读 Markdown | `docs/games/betrayal/sources/official/betrayal-3e-rulebook-en.md` | 英文对照源 | 已抽取成 13 页文本 |
| 英文求生者剧本书 | 求生者侧剧本文档 | `docs/games/betrayal/sources/official/betrayal-3e-secrets-of-survival-en.md` | 英文对照源 | 已抽取成 60 页文本 |
| 英文叛徒剧本书 | 叛徒侧剧本文档 | `docs/games/betrayal/sources/official/betrayal-3e-traitors-tome-en.md` | 英文对照源 | 已抽取成 60 页文本 |
| 中文规则 PDF | 用户补充的 `小黑屋规则翻译v1.1.pdf` 转换结果 | `src/games/betrayal/rule/legacy-zh/betrayal-2e-rulebook-zh-v1.1/betrayal-2e-rulebook-zh-v1.1.md`；归档镜像在 `docs/games/betrayal/sources/legacy-zh/` | 旧版中文对照源 | 有中文文本层与 24 页页面图，出现“第二版工作人员”，不作为 3e 权威源 |
| 中文求生者 Word | 用户补充的 `求生秘诀_原版v1.2.docx` 转换结果 | `src/games/betrayal/rule/legacy-zh/betrayal-legacy-secrets-of-survival-zh-v1.2.md`；归档镜像在 `docs/games/betrayal/sources/legacy-zh/` | 旧版 / 基础版作祟对照源 | 第 1 剧本是“木乃伊横行”，不对应 3e 作祟 1 |
| 中文叛徒 Word | 用户补充的 `奸徒手册_基础版精编校对v1.0.docx` 转换结果 | `src/games/betrayal/rule/legacy-zh/betrayal-legacy-traitors-tome-zh-v1.0.md`；归档镜像在 `docs/games/betrayal/sources/legacy-zh/` | 旧版 / 基础版作祟对照源 | 第 1 剧本是“木乃伊横行”，不对应 3e 作祟 1 |

## 3. PDF 处理结论

| 序号 | 原始文件 | 大小 | 抽取结果 | 结论 |
| --- | --- | ---: | --- | --- |
| 01 | `httpssteamusercontent...AC91.PDF` | 22.50 MB | `pdf-01.md` 为空 | 扫描型，待 OCR |
| 02 | `httpssteamusercontent...5477.PDF` | 48.07 MB | `pdf-02.md` 为空 | 扫描型，待 OCR |
| 03 | `httpssteamusercontent...68AC8.PDF` | 48.52 MB | `pdf-03.md` 为空 | 扫描型，待 OCR |
| 04 | `httpssteamusercontent...770E.PDF` | 20.71 MB | `pdf-04.md` 为空 | 扫描型，待 OCR |
| 05 | `httpssteamusercontent...9460.PDF` | 5.11 MB | `pdf-05.md` 为空 | 扫描型，待 OCR |
| 06 | `httpssteamusercontent...317E.PDF` | 9.24 MB | `pdf-06.md` 为空 | 扫描型，待 OCR |
| 07 | `httpssteamusercontent...1EDD.PDF` | 9.34 MB | `pdf-07.md` 为空 | 扫描型，待 OCR |
| 08 | `httpssteamusercontent...DC2F.PDF` | 6.22 MB | `pdf-08.md` 为空 | 扫描型，待 OCR |

当前结论：早期本地 PDF 不能直接转成可读规则文本，后续应走 OCR 或人工录入，不允许把空 Markdown 当规则真相源。用户后续补充的中文 PDF 已可读，但版本口径是旧版中文对照，不覆盖当前 3e 官方规则源。

补充：英文规则书、求生者剧本书、叛徒剧本书都已经转成可读 Markdown，可作为当前对照源；Hasbro 说明页的文本镜像抓取仍被对端拒绝，暂不影响本轮 intake 结论。

## 4. 图片盘点结果

- 总图片数：172
- 尺寸组：56
- 主要高频组：
  - `384x336`：51 张，主要是头像、怪物 token、状态 / 符文小图；山屋 0/1/2 骰子不在这组图片索引里
  - `450x450`：28 张，主要是数字标记与状态标记
  - `675x1275`：14 张，主要是牌背与参考卡
  - `1270x1289`：10 张，主要是探索者角色牌

辅助索引位置：

- `docs/games/betrayal/sources/image-index/images-manifest.csv`
- `docs/games/betrayal/sources/image-index/images-dimension-summary.json`
- `docs/games/betrayal/sources/image-index/contact-*.jpg`
- `docs/games/betrayal/sources/image-index/all-by-size-*.jpg`

## 5. 运行时资源白名单

本轮只允许以下素材进入正式运行时资源树；当前候选文件虽然已经暂存到 `public/assets/betrayal/`，但正式落点应为 `public/assets/i18n/zh-CN/betrayal/`：

| 类别 | 数量 | 现实含义 |
| --- | ---: | --- |
| `ui` | 2 | 标题横幅、0-9 轨道 |
| `thumbnails` | 1 | 大厅封面候选 |
| `cards` | 12 | 牌背、玩家参考卡、中文参考卡 |
| `explorers` | 13 | 已识别探索者角色牌 |
| `monsters` | 3 | 已识别怪物/特殊角色卡 |
| `tokens/explorers` | 4 | 已确认地图玩家指示物，来自 `384x336` 组；Rebecca / Darryl 已从旧错图纠正 |
| `tokens/monsters` | 43 | 已确认地图怪物 token：31 张用户点名的 3e 怪物 / Stunned token，以及小型怪物 1-6 双面图和正面裁片 |
| `markers` | 28 | 数字、状态、资源标记 |

资源映射真相源：`docs/games/betrayal/sources/image-index/runtime-resource-map.json`

补充结论：

- `public/assets/betrayal/` 只是当前 worktree 里的 intake 暂存目录，不是正式运行时合同目录。
- 正式资源合同应对齐：
  - 缩略图：`public/assets/i18n/zh-CN/betrayal/thumbnails/cover.png`
  - 运行时图片：`public/assets/i18n/zh-CN/betrayal/<category>/...`
- 依据来自项目现有 `create-new-game` skill 6.6、`ManifestGameThumbnail` 测试和 `AssetLoader` 的本地化资源解析合同。
- 当前本地素材包里已确认 `Item` 正面 atlas 与 `Omen` 正面 atlas；此前把一张无关拼页误登记成 `Omen` 正面 atlas，这个判断已撤销，并已被 `candidate-06` 真图替换：
  - `public/assets/i18n/zh-CN/betrayal/cards/item-front-atlas.jpg` 来自原始大图 `httpssteamusercontentaakamaihdnetugc1925869443038951545DB35BA7304F2999D84979FFC9FDC379603C70853.jpg`；
  - 当前已确认 `rope / 兔脚` 使用该 atlas 第 `21` 格，运行时持有区必须显示该正面裁片；`rope` 是当前保留的 legacy id；
  - 旧的 `public/assets/i18n/zh-CN/betrayal/cards/omen-front-atlas.png` 已核图确认不是预兆牌正面拼页，不能继续使用；
  - 现已确认真正的预兆正面 atlas 为 `public/assets/i18n/zh-CN/betrayal/cards/omen-front-atlas.jpg`，来源是 `temp/betrayal-omen-source-audit/copies/candidate-06.jpg`；
  - 该 atlas 当前可明确识别为 `2x5` 排列，其中 `9` 格是预兆正面，右下最后 `1` 格是预兆牌背；
  - 该 atlas 现已可按格位明确读出 `9` 张真实预兆：`omen-book / 书本`、`dog / 狗`、`mask / 面具`、`skull / 头骨`、`holy-symbol / 圣符`、`dagger / 匕首`、`ring / 指环`、`armor / 盔甲`、`idol / 雕像`；`omen-book` 是当前保留的 legacy id；
  - 当前运行时默认预兆对象族必须收敛到这 `9` 张，禁止继续保留 `watch / amulet / pendant / coin / bell / feathers / mirror-shard` 这类不属于真 atlas 的伪对象名。
  - `contact-03-675-1275.jpg` 这组只包含牌背、玩家/叛徒/怪物参考卡；
  - `all-by-size-01.jpg` 里的大图组也没有出现可确认的预兆正面拼页；
- 因此当前运行时持有物里，已确认对象必须优先使用真实正面 atlas；未确认的 `Omen` 只能用牌背、对象名和类别临时维持可玩性，素材缺口必须记录在 intake / manifest / evidence，并向用户索要素材或锁定补源路径；不得误接错误拼页、marker 或其它无关素材，也不得把排障标签显示给玩家。
- 用户后续补充的 `384x336` 组已经证明这里有玩家和怪物 token。地图上的玩家 / 怪物位置必须优先使用 `tokens/explorers/*` 与 `tokens/monsters/*`；找不到对应 token 时，必须回到同尺寸组继续审查或询问素材位置，不能用探索者整板、怪物卡、队友面板、文字缩写或无关 marker 顶替。
- 2026-07-31 `384x336` token 纠错：用户点名范围 `...EE7C83DC` 到 `...442F4782` 共 31 张，此前只登记 4 张，且 `...06AB53C7`、`...8EDF6B9A` 被误登记为 Rebecca / Darryl。现已全部落到 `tokens/monsters/*` 语义路径并生成同尺寸压缩产物；Rebecca / Darryl 已改回正确探索者 token 源图。证据见 `evidence/betrayal/full-audit/token-384x336-intake-correction-2026-07-31.md`。
- 2026-07-31 木乃伊专项补充：旧版「木乃伊横行」规则要求「木乃伊怪物标记(大)」。虽然本轮已补齐 3e `384x336` 怪物 / Stunned token 组，但该组未发现木乃伊；当前代码仍引用 `betrayal/tokens/monsters/large-monster-front` 与 `betrayal/monsters/mummy`。用户批准先占位后，已新增明确写有“临时占位”的源图、压缩图、manifest 与 `runtime-resource-map.json` 记录；`evidence/betrayal/full-audit/mummy-token-source-search-2026-07-31.md` 已记录本地图包 `Mods\Images`、TTS、`Models`、`Assetbundles` 均未发现可确认木乃伊 token / portrait 源图。该对象正式素材状态仍必须保持 `blocked / visual-token-blocked`，不得把临时占位、其它怪物 token 或文字壳当成正式完成。
- 山屋骰子素材真相已经从 TTS Workshop JSON 与本地解包文件锁定：
  - Workshop 真相源：`D:\gongzuo\webgame\gameasset\山屋惊魂(小黑屋)第三版（渣图汉化自用)\Mods\Workshop\3420850553.json`。
  - 真正的山屋 0/1/2 骰子是 `Custom_Model`，共 48 颗，使用同一模型 `MeshURL`：`https://steamusercontent-a.akamaihd.net/ugc/836952878380612616/2444D3E2AC5B69A7939369B3566A0941C2D881C9/`。
  - 本地 OBJ：`D:\gongzuo\webgame\gameasset\山屋惊魂(小黑屋)第三版（渣图汉化自用)\Mods\Models\httpssteamusercontentaakamaihdnetugc8369528783806126162444D3E2AC5B69A7939369B3566A0941C2D881C9.obj`。
  - 本地材质图：`D:\gongzuo\webgame\gameasset\山屋惊魂(小黑屋)第三版（渣图汉化自用)\Mods\Images\httpssteamusercontentaakamaihdnetugc310636117333783900D4349CB7B7A59D4F8DF84D5A8FB0D723953A466.jpg`，512x512，近白 / 空白材质；点数来自模型几何与 `RotationValues`，不是贴图格子。
  - `RotationValues` 明确映射 6 面结果：`0` 对应 `z=90/-90`，`1` 对应 `x=90/-90`，`2` 对应 `z=0/180`。
  - 另一个 `Custom_Dice`（`GUID b14471`）不是山屋 0/1/2 点骰，而是探索者姓名随机骰，不能混用。
  - 当前状态：`source-found / runtime-ingested-as-3d-house-dice`。网页运行时已经从 TTS OBJ 按 `RotationValues` 派生 `0/1/2` 三张房屋骰骰面资源，落点为 `public/assets/i18n/zh-CN/betrayal/dice/house-die-0.png`、`house-die-1.png`、`house-die-2.png` 及对应 `compressed/*.webp`。`Board.tsx` 的 `BetrayalHouseDice3DGroup` 复用 `DiceBoxPhysicsSource` / `@3d-dice/dice-box-threejs` 作为物理源，并以前台山屋专属 3D 房屋骰承接显示；不再是单纯 2D 骰面图顶替。

## 6. 明确不进运行时的素材

以下素材现在只保留为 `source/candidate`，不进入 `public/assets/`：

- 6300x5400、5400x3826 这类尚未锁定运行时合同的大拼版图
- 3376x2550、2026x2550、2943x969 这类待裁切的楼层/房间/标记拼页
- 含大面积黑底的拼接参考页
- 扫描页 JPG
- 32x32、512x512 这类当前无明确业务语义的小图
- `contact-*`、`all-by-size-*` 这类联系表 / 索引总览图

原因：这些文件还不能唯一映射到“后续代码里会直接引用的单对象资源”，混入运行时目录会污染资源真相源。

补充门禁：

- 大拼版原图本身默认不直接放入 `public/assets/**`，但可以作为正式裁切源；从它裁出的房间牌 / 楼层板必须记录原始图集、裁剪坐标和导出尺寸。
- 例外：`6076x6376` 事件牌正面图集已经锁定为 `9x5` 正式 atlas，运行时路径为 `public/assets/i18n/zh-CN/betrayal/cards/event-front-atlas.jpg`，最后一列 / 最后一行承接 `1px` 余数；它不再属于“不进运行时”的未裁切大拼版。
- `contact-*`、`all-by-size-*` 只允许用于识别图面和定位候选，禁止裁成正式运行时房间牌、卡牌、角色板或地图板块。
- 如果为了跑通流程临时引用低清索引裁片，必须在 `runtime-resource-map.json` 标成 `temporary-runtime-placeholder`，不得标为正式 `runtime`；当前运行时房间牌已换成原始图集裁剪，不能再新增低清联系表裁片。

## 7. 已确认对象

- 探索者角色牌：已确认 13 张
- 怪物/特殊角色卡：已确认 3 张
- 探索者 token：当前确认 4 张，来自 `384x336` 组
  - `tokens/explorers/jaden-jones.png`
  - `tokens/explorers/father-warren-leung.png`
  - `tokens/explorers/rebecca-allen.png`
  - `tokens/explorers/darryl-highla.png`
- 怪物 / Stunned token：当前确认 31 张用户点名范围内的 3e token，来自 `384x336` 组；另有小型怪物 1-6 双面图和正面裁片
  - `tokens/monsters/jacks-spirit.png`
  - `tokens/monsters/head-of-the-house.png`
  - `tokens/monsters/demon.png`
  - `tokens/monsters/dark-queen.png`
  - `tokens/monsters/ghost-shark.png`
  - `tokens/monsters/construct.png`
  - `tokens/monsters/bakeneko.png`
  - `tokens/monsters/giant-wasp.png`
  - `tokens/monsters/demon-dog.png`
  - `tokens/monsters/werewolf.png`
  - `tokens/monsters/vampire.png`
  - `tokens/monsters/faceless-man.png`
  - `tokens/monsters/ghost.png`
  - `tokens/monsters/troll-right-hand.png`
  - `tokens/monsters/giant-hair-monster.png`
  - `tokens/monsters/troll-left-hand.png`
- 牌背：已确认 5 张
- 玩家/叛徒/怪物参考卡：已确认 6 张
- 标记：已确认 28 张
- 物品正面 atlas：已确认 1 张；`rope / 兔脚` 已确认第 `21` 格

## 8. 待确认对象

- 大拼版中的房间板块
- 楼层总览图与房屋楼层板
- 预兆正面 atlas 已确认，且当前运行时默认预兆对象族已收敛到 atlas 对应的 9 张真实预兆
- 扫描 PDF 对应的规则书、剧本书、参考书具体分工
- 剧本书 / 作祟文案 / 分阵营秘密阅读 / 开局朗读 / 结局朗读的玩家可见正文仍需回到已锁定原文或正式翻译原文后才能标 `locked`；当前整理稿、规则书口吻改写或目标摘要不能作为正式剧本原文。
- 剩余探索者 token、其它怪物 token、状态 token 仍需逐类审查；不得再笼统写成“头像/模型/局部标记图待确认”
- 物品正面 atlas 的“逐格确认”已由 2026-07-29 整牌库合同覆盖：官方 22 张物品正面已锁定到 item frame 0-21；后续缺口不再是“其它物品正面缺素材”，而是物品效果的 UI 承接、组合测试和新增消费者再审。legacy alias 仍按 duplicate-alias 处理，不重复计数。

## 9. 后续实施入口

2026-07-29 更新：本节是首轮 intake 遗留入口，不能自动接管当前执行队列。整牌库发现牌、事件/物品/预兆 atlas、duplicate-alias 和当前阻塞口径以 `evidence/betrayal/full-audit/full-deck-data-intake-contract.md` 为准；进入 Board/UI、E2E、截图、完整作祟或剧本实现前，必须重新锁定目标、入口和验收口径。

1. 先把当前候选资源从 `public/assets/betrayal/` 迁到 `public/assets/i18n/zh-CN/betrayal/`，并重新生成 manifest。
2. 再从大拼版图中裁出房间板块、楼层板和可能的起始房间。
3. 再按 `docs/ai-rules/data-entry.md` 的原文展示门禁，分别锁定规则书正文、求生者剧本书、叛徒剧本书、作祟开局、分阵营秘密阅读和结局朗读的原文来源；没有逐字原文或正式翻译原文时只能标 `blocked / disputed`，不得用摘要冒充剧本书正文。
4. 最后补 OCR/人工录入，把规则、剧本和参考卡转成结构化文字合同。
