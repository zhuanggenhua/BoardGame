# Fate/Domination 冬木事件图文合同

登记日期：2026-10-11。主真相源：`本地素材路径省略`。图面来自 `冬木1.htm` 的 `ScreenShot_2025-10-27_203*.png`；`冬木.htm` 另为 10 张局势 hashed 图，已记录在 `situations-10plus3-ocr.md`。本文件不改 `demo-data.ts`、`image-register` 或 `public/assets`。

## 读取与对账

- `冬木1.htm` 共引用 20 个事件槽位：16 张唯一图，其中 4 张各出现 2 次。
- 右上金色月桂数字为战果 VP；图面未见额外日月星地等图标，属性修正以卡面左侧力量/迅捷/魔术图标登记。
- `locked` = CHM 图面名称、VP、正文和重复数均可读取；`blocked` = 图面字段缺失，禁止用 demo 缩写补成 CHM 原文。
- 对应 demo ID 按第一批顺序：E0–E19。CHM 标题与 demo 名称不一致时采用 CHM 标题，差异留给合并审阅。

## 20 张槽位（16 张唯一图）

### E0 / 夺回伊莉雅（1 张）

- 图片：`temp/fate-domination-intake/chm-images/图包/ScreenShot_2025-10-27_203555_740.png`
- CHM 页：`冬木1.htm`
- 类别：事件；VP：5；重复数：1；图标：无
- 原文（逐字）：卡名为`夺回伊莉雅`；正文区域在 CHM 图面中为空白，未见可读效果文字。
- 状态：`locked`（2026-10-20 已直接解包并核对 CHM 完整原图，正文印刷区域为空，不存在 demo 的“赢区域者得3魔”效果）。
- 原始 CHM SHA256：2771487eef53443c6a1b5bb4a80c5fec2ad4a92dcb1952bfc83ca31170da35b7；冬木1.htm SHA256：4367b552a344f446ce7f84dcca76d21a96d11969f50133dd659d758e32fa149c；原图 916×1298 SHA256：7c1538fccdea261e98b024fec22f6c9eb047683400bf36adf78724b5fe836bee。目录 hhc 的事件→冬木指向此页，页面引用此原始成员。
- 与 demo-data：demo E0 的额外魔力效果与原图不符，禁止运行时消费。

### E1 / E2 / 铤而走险（2 张）

- 图片：`temp/fate-domination-intake/chm-images/图包/ScreenShot_2025-10-27_203549_347.png`
- CHM 页：`冬木1.htm`
- 类别：事件；VP：4；重复数：2；图标：无
- 原文（逐字）：`战果排名倒数第一者于此战场+12合计威力，倒数第二+8合计威力，倒数第三+4合计威力。（分数相同时，假设末位为A、B，倒数第二为C，第三为D，则A、B各+12，C+4，D+0）`
- 状态：`locked`
- 与 demo-data：效果方向一致；CHM 完整写出并列排名处理。

### E3 / 圣地（1 张）

- 图片：`temp/fate-domination-intake/chm-images/图包/ScreenShot_2025-10-27_203501_203.png`
- CHM 页：`冬木1.htm`
- 类别：事件；VP：3；重复数：1；图标：蓝色魔术攻击图标
- 原文（逐字）：`魔术攻击于此战场获得威力+3。`
- 状态：`locked`
- 与 demo-data：一致（demo 写“魔法”，CHM 卡面为“魔术”）。

### E4 / 火力压制（1 张）

- 图片：`temp/fate-domination-intake/chm-images/图包/ScreenShot_2025-10-27_203453_804.png`
- CHM 页：`冬木1.htm`
- 类别：事件；VP：3；重复数：1；图标：绿色迅捷攻击图标
- 原文（逐字）：`迅捷攻击于此战场获得威力+3。`
- 状态：`locked`
- 与 demo-data：一致。

### E5 / 强度测验（1 张）

- 图片：`temp/fate-domination-intake/chm-images/图包/ScreenShot_2025-10-27_203446_347.png`
- CHM 页：`冬木1.htm`
- 类别：事件；VP：3；重复数：1；图标：橙色力量攻击图标
- 原文（逐字）：`力量攻击于此战场获得威力+3。`
- 状态：`locked`
- 与 demo-data：CHM 名称为“强度测验”；demo 缩写使用“强度测验”，效果一致。

### E6 / 命运之战（1 张）

- 图片：`temp/fate-domination-intake/chm-images/图包/ScreenShot_2025-10-27_203439_683.png`
- CHM 页：`冬木1.htm`
- 类别：事件；VP：2；重复数：1；图标：无
- 原文（逐字）：`此战场上基本威力1和2的攻击基本威力增加至5。`
- 状态：`locked`
- 与 demo-data：一致。

### E7 / 占领高地（1 张）

- 图片：`temp/fate-domination-intake/chm-images/图包/ScreenShot_2025-10-27_203508_899.png`
- CHM 页：`冬木1.htm`
- 类别：事件；VP：3；重复数：1；图标：无
- 原文（逐字）：`位于此战场的玩家计算战力时，将其地利翻倍。`
- 状态：`locked`
- 与 demo-data：一致。

### E8 / 归零地（1 张）

- 图片：`temp/fate-domination-intake/chm-images/图包/ScreenShot_2025-10-27_203523_995.png`
- CHM 页：`冬木1.htm`
- 类别：事件；VP：3；重复数：1；图标：无
- 原文（逐字）：`此战场的地利位置不提供地利。`
- 状态：`locked`
- 与 demo-data：一致。

### E9 / 光荣的决斗（1 张）

- 图片：`temp/fate-domination-intake/chm-images/图包/ScreenShot_2025-10-27_203424_916.png`
- CHM 页：`冬木1.htm`
- 类别：事件；VP：2；重复数：1；图标：橙色力量攻击图标
- 原文（逐字）：`力量攻击于此战场获得威力+2。`
- 状态：`locked`
- 与 demo-data：CHM 卡名为“光荣的决斗”；demo 名称为“光荣决斗”，效果一致。

### E10 / 祭祀之地（1 张）

- 图片：`temp/fate-domination-intake/chm-images/图包/ScreenShot_2025-10-27_203418_203.png`
- CHM 页：`冬木1.htm`
- 类别：事件；VP：2；重复数：1；图标：蓝色魔术攻击图标
- 原文（逐字）：`魔术攻击于此战场获得威力+2。`
- 状态：`locked`
- 与 demo-data：一致（demo 缩写写“魔法”）。

### E11 / 险恶地形（1 张）

- 图片：`temp/fate-domination-intake/chm-images/图包/ScreenShot_2025-10-27_203412_715.png`
- CHM 页：`冬木1.htm`
- 类别：事件；VP：2；重复数：1；图标：绿色迅捷攻击图标
- 原文（逐字）：`迅捷攻击于此战场获得威力+2。`
- 状态：`locked`
- 与 demo-data：CHM 卡名为“险恶地形”；demo 名称为“险恶之地”，效果一致。

### E12 / 遏制第三方威胁（1 张）

- 图片：`temp/fate-domination-intake/chm-images/图包/ScreenShot_2025-10-27_203432_219.png`
- CHM 页：`冬木1.htm`
- 类别：事件；VP：2；重复数：1；图标：无
- 原文（逐字）：`基本威力4及以上的攻击于此战场获得+1威力。此战场的胜者可以恢复1枚令咒。`
- 状态：`locked`
- 与 demo-data：CHM 卡名为“遏制第三方威胁”；demo 名称缩写为“遏制威胁”，效果摘要漏掉“可以”但语义方向一致。

### E13 / E14 / 偷袭（2 张）

- 图片：`temp/fate-domination-intake/chm-images/图包/ScreenShot_2025-10-27_203354_956.png`
- CHM 页：`冬木1.htm`
- 类别：事件；VP：2；重复数：2；图标：无
- 原文（逐字）：`从者真名隐藏的玩家于此战场合计威力+5。`
- 状态：`locked`
- 与 demo-data：一致；CHM 图面确认两张重复牌。

### E15 / 协同（1 张）

- 图片：`temp/fate-domination-intake/chm-images/图包/ScreenShot_2025-10-27_203404_003.png`
- CHM 页：`冬木1.htm`
- 类别：事件；VP：2；重复数：1；图标：无
- 原文（逐字）：`于此战场的玩家，其所有攻击若至少有一种属性相同，则合计威力+4。`
- 状态：`locked`
- 与 demo-data：一致。

### E16 / E17 / 固有结界（2 张）

- 图片：`temp/fate-domination-intake/chm-images/图包/ScreenShot_2025-10-27_203345_444.png`
- CHM 页：`冬木1.htm`
- 类别：事件；VP：2；重复数：2；图标：特殊攻击禁用图标
- 原文（逐字）：`特殊攻击于此战场禁止打出。所有玩家不能移动至此地点也不能离开此地点。`
- 状态：`locked`
- 与 demo-data：一致。

### E18 / E19 / 地脉（2 张）

- 图片：`temp/fate-domination-intake/chm-images/图包/ScreenShot_2025-10-27_203633_659.png`
- CHM 页：`冬木1.htm`
- 类别：事件；VP：2；重复数：2；图标：无
- 原文（逐字）：`位于此战场的玩家在此战场发生战斗后，获得2点魔力。`
- 状态：`locked`
- 与 demo-data：一致；CHM 图面确认两张重复牌。

## 数量对账

| 统计 | 数量 |
| --- | ---: |
| 事件槽位（含重复） | 20 |
| 唯一图面 | 16 |
| 双张重复牌 | 铤而走险、偷袭、固有结界、地脉（4 组，共 8 张） |
| 单张牌 | 夺回伊莉雅、圣地、火力压制、强度测验、命运之战、占领高地、归零地、光荣的决斗、祭祀之地、险恶地形、遏制第三方威胁、协同（12 张） |
| `locked` | 19 张 |
| `blocked` | 1 张（E0 正文空白） |

## 合并待办

- 合并时需把本文件列出的 16 个事件图片追加进 `image-register-first-batch.md`；重复槽位沿用同一图片并记重复数。
- E0 仅有标题与 VP 的 CHM 证据，未发现中文正文；在补到原始清晰卡图前不得把 demo 的“赢区域者得3魔”写入中文效果合同。
