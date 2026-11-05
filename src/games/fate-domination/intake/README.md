# Fate/Domination intake

状态：`S0 in_progress`（第一批 FSN+FZ 身份卡与核心规则已锁；剩余对象已进入 authority-summary，仍保留阿尔托莉雅数字概览与 E0 事件正文阻塞）

本目录只承载新游戏的规则、来源、对象全集和数据录入合同。
当前阶段不创建 Board、runtime UI、正式 manifest 或玩法实现。

## 当前真相源（2026-10-11 锁定）

用户当轮指定：本地中文规则书优先；Wiki 只做 QA，防止卡牌效果理解错误。

| 优先级 | 来源 | 职责 | 状态 |
| --- | --- | --- | --- |
| 1 主真相源 | `D:\gongzuo\webgame\gameasset\fate命运之夜\FD全卡图鉴V1.0.chm` 中文规则页 | 基础规则、组件、阶段、战斗、清理 | `locked` |
| 1 主真相源 | 同上 CHM 第一批角色页截图 | 中文卡面字段 | 身份/概览 `locked`；技能/附属 `authority-summary`（51 张） |
| 2 对照源 | `Mods\Workshop\2047461756.json` TTS 对象 `Nickname`/`Description` | 英文卡面、牌库构成、附属组件 | `partial` |
| 2 对照源 | `Mods\Images\` TTS 图包 | 卡图/立牌候选 | `partial`（1798 张，未全量登记） |
| 3 QA 对照 | Fate/Domination Wiki | 防止效果理解错误；不覆盖中文规则书 | `blocked`（本轮无法抓取） |
| 排除 | `Mods\PDF\` Master Database / Akashic Records | 15 页为 Master Database 扫描图；239 页为图鉴扫描，无提取文本 | 不作规则书 |

规则页落点：

- 原文：`rules/chm-前情提要与内容物介绍.md`、`rules/chm-进行一场圣杯战争.md`
- 结构化合同：`rules/core-rules-from-chm.md`
- 来源表：`rules/source-index.md`

旧 Wiki 合同 `rules/core-rules-v0.1.md` 降为历史对照，不再当主真相源。

## 术语对照（中文主源 / Wiki 英文）

| 中文规则书 | Wiki / TTS | 含义 |
| --- | --- | --- |
| 局势 | Event | 每回合魔力与全局天气/场地修正 |
| 事件 | Objective | 深山町/新都战场目标与 VP |
| 魔术工房 | Workshop | 部署得点魔力，人数上限 |
| 深山町 | Miyama | 明置事件战场 |
| 新都 | Shinto | 暗置事件战场 |
| 侦察 | Recon | 战力结算固定 +2 VP，上限 1 人 |

## 第一批范围

与 `data/identities.ts` 一致：13 御主 + 14 从者（FSN+FZ）。

合同：`catalog/first-batch-fsn-fz.md`
图片登记：`catalog/image-register-first-batch.md`
对象×素材：`catalog/object-asset-matrix-first-batch.md`
CHM vs TTS 差异：`evidence/chm-vs-tts-diffs-2026-10-11.md`
剩余必要录入任务包（转交其他 AI）：`catalog/remaining-entry-tasks.md`

## 已产出

- `rules/source-index.md`：2026-10-11 真相源重锁。
- `rules/core-rules-from-chm.md`：CHM 核心规则合同。
- `rules/chm-*.md`：规则书原文转写。
- `catalog/first-batch-fsn-fz.md`：第一批身份/概览 OCR。
- `catalog/image-register-first-batch.md`：已读取 CHM 图登记。
- `catalog/object-asset-matrix-first-batch.md`：规则数量×素材对账。
- `evidence/wiki-qa-blocked-2026-10-11.md`：Wiki QA 抓取失败。
- `evidence/chm-vs-tts-diffs-2026-10-11.md`：中英卡面差异，录入后汇报。
- `catalog/first-batch-master-aux-ocr.md`：13 御主技能/附属 51 张 authority-summary。
- `catalog/first-batch-servant-skills-ocr.md`：14 从者技能 42 张 authority-summary。
- `catalog/first-batch-attacks-ocr.md`：14×12 攻击牌索引对账；阿尔托莉雅数字概览 blocked。
- `catalog/situations-10plus3-ocr.md`：10+3 局势图文合同。
- `catalog/events-fuyuki-ocr.md`：20 槽位 / 16 唯一图冬木事件合同，E0 blocked。
- 历史 Wiki 证据仍保留在 `evidence/`，只作对照。

## 状态口径

- `locked`：规则或对象字段有明确来源定位，可以作为下一层数据输入。
- `partial`：已找到对象/页面，但仍缺完整列表、字段或图面证据。
- `blocked`：当前来源无法读取或存在冲突，不能猜测。
- `disputed`：两份来源冲突，以主真相源为准并记录对照差。
- `deferred`：规则上存在，但不阻塞当前最小可玩切片。

## S0 门禁（本轮）

已锁：玩家数、11 回合、阶段、棋盘区位、魔力/令咒、从者组件结构、胜负/淘汰、第一批 27 个身份/概览卡面。

当前保留的复核项：御主合同 49 locked + 2 partial；从者技能 42 locked；攻击牌 13/14 从者为 authority-summary，阿尔托莉雅 12 张 blocked；局势 13 张 locked；冬木事件 19 张 locked + E0 正文 blocked。TTS 1798 语义登记、逐张完整效果和 runtime 落盘不阻塞本轮文字合同。

Wiki QA：`blocked`，按用户指示不阻塞 S0 继续；效果理解争议以 CHM 中文为准。

设计稿：规则对象与棋盘布局已够写 UI 前置包；卡牌效果实现仍停在合同层。
