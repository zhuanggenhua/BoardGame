# 七大恨普通手牌正式映射反写契约

> 这份契约只定义“人工确认后的结果应如何反写到正式领域层”。2026-07-04 已有 atlas05 的 49 张普通手牌达到人工确认门槛，并已接入正式发牌/预览流；但当前只是普通手牌真相源局部推进，事件效果全集、战术时机和完整行动语义仍未闭环，因此本文件不得被理解为已经完成正式手牌一级入口。
>
> 2026-07-04 追加口径：atlas05 已确认事件牌已能从手牌本体进入 `play-event-card` / `执行事件` 记录层，记录具体牌名和规则效果摘要；这只是“打出哪张事件牌”的记录合同，不代表逐张事件效果、额外成本、持续事件区、移出游戏或跨势力资源链已经完成。

## 当前运行时落点

正式手牌对象使用 `QidahenHandCard` 承载规则身份：

| 字段 | 现实含义 | 当前用途 |
| --- | --- | --- |
| `cardKind` | 这张手牌属于哪类牌 | 可为 `event / armament / tactic / silver / character / scenario / chronology / card-back / unknown` |
| `cardDefId` | 这张牌的稳定规则身份 | 事件、人物、剧本、纪年等可用它连接到规则效果或预览身份 |
| `armamentId` | 军备牌对应的可升级军备 | 仅 `cardKind = armament` 时允许填写 |
| `previewKind` | 低保真预览属于哪类可见素材 | 只用于展示/排除，不等同于正式可打出普通手牌 |
| `previewIdentityId` | 预览素材的可追踪身份 | 可追踪人物/剧本/纪年/牌背，不等同于普通手牌规则身份 |

当前正式入口集中在：

- `src/games/qidahen/domain/handCardIdentity.ts`
  - `resolveQidahenFormalHandCardIdentity(factionId, previewIndex)`
  - 当前仍保留 16 个 faction preview seam 的最小身份解析，供旧合同和排障对照使用。
  - `resolveQidahenAtlas05OrdinaryHandCardIdentity(atlasIndex)` 读取 atlas05 已确认普通手牌真相表，正式发牌/摸牌现在已消费这 49 张确认行。
- `src/games/qidahen/domain/ordinaryHandCardIdentities.ts`
  - 当前承载 atlas05 的 49 张已确认普通手牌规则身份。
  - 只允许来自人工确认矩阵的行进入，不得把 OCR 候选直接填进这里。
- `src/games/qidahen/domain/handCardState.ts`
  - 正式开局手牌与后续摸牌已按 atlas05 的 49 张 `passed` 真相表连续发放。
  - 只消费人工确认行；`partial / blocked` 行不会进入正式手牌身份或预览。
- `src/games/qidahen/ui/cardAtlas.ts`
  - 已注册 `qidahen:atlas05-ordinary-hand-preview`，指向 `qidahen/cards/atlases/ordinary-hand-atlas05`。
  - 该图集使用 10x7 网格合同，当前正式运行时只引用 49 张已确认普通手牌帧。
- `src/games/qidahen/domain/types.ts`
  - `QidahenHandCard.cardKind / cardDefId / armamentId`
  - `QidahenArmamentId` 限定军备目标枚举。
- `src/games/qidahen/domain/armamentCatalogState.ts`
  - 军备牌若确认，`armamentId` 必须能落到这里已有军备目录。

## 可反写输入门槛

只有人工复核行同时满足以下条件，才允许进入正式映射候选：

| 条件 | 要求 |
| --- | --- |
| 中文牌名 | 人工从牌面或可靠牌表确认，不能直接复制 OCR 错字 |
| 牌类 | 明确为普通事件、军备、战术或银两之一 |
| 规则效果 | 能写出可执行效果摘要；银两牌可写“无特殊效果，只作资源弃牌” |
| 军备目标 | 军备牌必须指定已有 `QidahenArmamentId`；非军备牌必须留空 |
| 来源证据 | 指向规则牌表、可靠 OCR 后人工确认记录，或人工录入矩阵中的确认行 |
| 复核状态 | 必须为“已确认”；“待复核 / 已排除 / 不可读”都不得反写 |

## 反写流程

1. 在 `qidahen-hand-card-manual-entry-matrix.md`、`qidahen-hand-card-human-review-checklist.md` 或 `qidahen-hand-card-atlas05-manual-entry-matrix.md` 中把候选行改为“已确认”，并填写中文牌名、牌类、规则效果摘要和军备目标。
2. 若确认的是军备牌，先核对 `QidahenArmamentId` 是否已存在；不存在时不得临时新增枚举，必须先回到军备目录真相源确认。
3. 新增或扩展正式手牌真相表，建议单独建领域层数据文件，而不是继续把大量逐牌表塞进 `handCardIdentity.ts`。
4. `resolveQidahenFormalHandCardIdentity` 只能读取正式局当前 preview seam；`resolveQidahenAtlas05OrdinaryHandCardIdentity` 只能读取已确认 atlas05 真相表；未知或未确认牌继续保持 `unknown` 或预览身份。
5. `getQidahenDirectActionIdForHandCard` 只能对已确认可直接打出的普通牌返回动作入口：
   - `armament` 且有 `armamentId`：`upgrade-armament`
   - 已实现事件效果的 `event`：对应事件动作，例如 `khan-edict`
   - `tactic`：只能进入战斗战术时机，不能作为普通行动窗口默认入口
   - `silver`：不能作为独立行动入口，只能作为支付/资源弃牌候选

## 验收门槛

每批反写后至少需要验证：

| 验收项 | 最低证据 |
| --- | --- |
| 未确认牌不入库 | 单测证明 OCR 候选和待复核行不会生成正式 `cardKind` |
| 事件牌入口 | 已确认事件牌能由手牌本体进入对应动作预览或结算 |
| 军备牌入口 | 已确认军备牌能由手牌本体进入 `upgrade-armament`，并使用正确 `armamentId` |
| 战术牌时机 | 战术牌不会在普通手牌行动阶段误变成可打出行动 |
| 银两牌语义 | 银两牌不会生成直接行动入口，只能作为资源/支付候选 |
| 2.4 状态 | 只有普通事件、军备、战术、银两映射都具备可追溯来源后，才允许重新评估是否勾选 |

## 可重复校验脚本

- `npm run verify:qidahen:handcards`
  - 先运行图片验收产物校验，再运行人工录入反写校验。
  - 当前已有 `passed=49` 图片候选和 49 张“已确认”普通手牌行；脚本通过证明确认行满足反写字段门槛，仍需结合定向单测证明正式运行时接入。
- `scripts/verify/qidahen-hand-card-image-validation.mjs`
  - 读取 `test-results/evidence-image-validation/qidahen-formal-handcard-2.4.json`。
  - 校验图片条目统计、逐项状态、子代理结果和主线程抽样对照记录。
  - 当前 `passed=49` 时仍要求结合人工录入反写校验和定向测试，不能单独据此勾选 OpenSpec `2.4 / 4.5`。
- `scripts/verify/qidahen-hand-card-manual-entry.mjs`
  - 读取 `qidahen-hand-card-manual-entry-matrix.md`、`qidahen-hand-card-human-review-checklist.md`、`qidahen-hand-card-tts-cardid-full-manual-entry-matrix.md`、`qidahen-hand-card-runtime-atlas-manual-entry-matrix.md` 和 `qidahen-hand-card-atlas05-manual-entry-matrix.md`。
  - 只校验“已确认”行是否满足反写字段门槛。
  - 当前已确认行数为 49；该脚本只验证人工录入字段完整性，不代表已经可以勾选 OpenSpec `2.4`。

## 当前裁决

- atlas05 当前已有 49 张人工确认行满足反写输入门槛。
- 当前已经新增领域层 atlas05 普通手牌真相表、解析函数、正式图集资源和运行时发牌/摸牌接入；支付单测证明初始手牌与后续摸牌会消费这 49 张 `passed` 普通手牌身份。
- 本契约继续约束后续反写入口和验收门槛，避免把 OCR 文本、文件路径、教程注入态或低保真预览身份误写进正式逻辑。
- OpenSpec `2.4` 和 `4.5` 继续保持未完成：事件效果全集、战术时机和完整行动语义仍未闭环。
