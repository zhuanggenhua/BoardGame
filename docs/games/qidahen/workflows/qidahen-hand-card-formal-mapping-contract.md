# 七大恨普通手牌正式映射反写契约

> 这份契约只定义“人工确认后的结果应如何反写到正式领域层”。当前没有任何普通事件、军备、战术、银两牌达到确认门槛，因此本文件不得被理解为已经完成正式映射。

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
  - 当前只为 16 个 preview seam 提供最小身份。
  - 不得把 OCR 候选直接填进这里。
- `src/games/qidahen/domain/handCardState.ts`
  - `QIDAHEN_FACTION_HAND_PREVIEW_COUNT = 16`
  - 当前不是完整 10x7 逐牌合同。
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

1. 在 `qidahen-hand-card-manual-entry-matrix.md` 或 `qidahen-hand-card-human-review-checklist.md` 中把候选行改为“已确认”，并填写中文牌名、牌类、规则效果摘要和军备目标。
2. 若确认的是军备牌，先核对 `QidahenArmamentId` 是否已存在；不存在时不得临时新增枚举，必须先回到军备目录真相源确认。
3. 新增或扩展正式手牌真相表，建议单独建领域层数据文件，而不是继续把大量逐牌表塞进 `handCardIdentity.ts`。
4. `resolveQidahenFormalHandCardIdentity` 只能读取已确认真相表；未知或未确认牌继续保持 `unknown` 或预览身份。
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

- `scripts/verify/qidahen-hand-card-manual-entry.mjs`
  - 读取 `qidahen-hand-card-manual-entry-matrix.md`、`qidahen-hand-card-human-review-checklist.md`、`qidahen-hand-card-tts-cardid-full-manual-entry-matrix.md` 和 `qidahen-hand-card-runtime-atlas-manual-entry-matrix.md`。
  - 只校验“已确认”行是否满足反写字段门槛。
  - 当前没有任何“已确认”行时应通过，但输出结论必须是“不允许反写正式手牌规则映射”。
  - 该脚本只验证人工录入字段完整性，不代表已经可以勾选 OpenSpec `2.4`。

## 当前裁决

- 当前没有任何人工确认行满足反写输入门槛。
- 当前不得修改正式手牌规则映射。
- 本契约只把未来反写入口和验收门槛固定下来，避免后续把 OCR 文本、文件路径、教程注入态或低保真预览身份误写进正式逻辑。
- OpenSpec `2.4` 和 `4.5` 继续保持未完成。
