# 第一批从者攻击牌逐张对账（authority-summary）

日期：2026-10-11。

主真相源：CHM 从者概览卡（构成与数量）+ CHM 规则原文（基础攻击 / 特殊牌类别语义）。
对照源：demo-data.ts / cards.ts 仅用于牌 ID、项目索引和基线数值对照；TTS 仅用于发现冲突。

本批按用户授权采用 precision: authority-summary：锁定从者、序号、牌 ID、类别、重复数量和 CHM 概览直接覆盖的“大致信息”。费用/威力在本文件只保留项目索引对照，不视为 CHM 锁定值；未逐张读取的卡面全文、限定词与额外效果不补写。
阿尔托莉雅数字概览在 CHM 尚未找到，12 张仅列项目/TTS 对照，全部 blocked，不作为锁定构成。

## 汇总

| 从者 | 目标张数 | 已登记 | 状态 | 权威概览图 |
| --- | ---: | ---: | --- | --- |
| 安格拉·曼纽 | 12 | 12 | locked（authority-summary） | ScreenShot_2025-11-02_120543_887.png |
| 阿尔托莉雅·潘德拉贡 | 12 | 12 | blocked（数字概览缺失） | ScreenShot_2025-10-29_221758_597.png |
| 卫宫 | 12 | 12 | locked（authority-summary） | ScreenShot_2025-11-01_154110_741.png |
| 吉尔伽美什 | 12 | 12 | locked（authority-summary） | ScreenShot_2025-11-01_154227_893.png |
| 伊斯坎达尔 | 12 | 12 | locked（authority-summary） | ScreenShot_2025-11-01_163842_910.png |
| 美杜莎 | 12 | 12 | locked（authority-summary） | ScreenShot_2025-11-01_163744_063.png |
| 迪卢木多·奥迪那 | 12 | 12 | locked（authority-summary） | ScreenShot_2025-11-01_111207_280.png |
| 库·丘林 | 12 | 12 | locked（authority-summary） | ScreenShot_2025-11-01_111054_633.png |
| 美狄亚 | 12 | 12 | locked（authority-summary） | ScreenShot_2025-11-01_191706_941.png |
| 吉尔·德·雷 | 12 | 12 | locked（authority-summary） | ScreenShot_2025-11-01_191753_822.png |
| 佐佐木小次郎 | 12 | 12 | locked（authority-summary） | ScreenShot_2025-11-01_212419_960.png |
| 哈桑·萨巴赫(咒腕) | 12 | 12 | locked（authority-summary） | ScreenShot_2025-11-01_212532_416.png |
| 赫拉克勒斯 | 12 | 12 | locked（authority-summary） | ScreenShot_2025-11-02_110640_013.png |
| 兰斯洛特 | 12 | 12 | locked（authority-summary） | ScreenShot_2025-11-02_110748_453.png |

## 安格拉·曼纽

precision: authority-summary
权威概览：temp/fate-domination-intake/chm-images/图包/ScreenShot_2025-11-02_120543_887.png
状态：locked（锁定索引/类别/重复数量/大致信息；逐张卡面全文仍为 not-currently-consumed，不进入运行时效果实现）。

| 序号 | 牌 ID | 卡牌/所在索引 | 类别 | 费用 | 威力 | 大致信息（权威摘要） | 项目索引对照 | 原文/图面状态 |
| ---: | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | cardB1 | 力量基础攻击 #1 | 力量 | 未逐张确认 | 未逐张确认 | 基础攻击 | 0/2（仅对照） | authority-summary；未逐张 OCR |
| 2 | cardB1 | 力量基础攻击 #1 | 力量 | 未逐张确认 | 未逐张确认 | 基础攻击 | 0/2（仅对照） | authority-summary；未逐张 OCR |
| 3 | cardB2 | 力量基础攻击 #2 | 力量 | 未逐张确认 | 未逐张确认 | 基础攻击 | 0/3（仅对照） | authority-summary；未逐张 OCR |
| 4 | cardQ1 | 迅捷基础攻击 #1 | 迅捷 | 未逐张确认 | 未逐张确认 | 基础攻击 | 0/2（仅对照） | authority-summary；未逐张 OCR |
| 5 | cardQ1 | 迅捷基础攻击 #1 | 迅捷 | 未逐张确认 | 未逐张确认 | 基础攻击 | 0/2（仅对照） | authority-summary；未逐张 OCR |
| 6 | cardQ2 | 迅捷基础攻击 #2 | 迅捷 | 未逐张确认 | 未逐张确认 | 基础攻击 | 0/3（仅对照） | authority-summary；未逐张 OCR |
| 7 | cardQ3 | 迅捷基础攻击 #3 | 迅捷 | 未逐张确认 | 未逐张确认 | 基础攻击 | 0/4（仅对照） | authority-summary；未逐张 OCR |
| 8 | cardA1 | 魔术基础攻击 #1 | 魔术 | 未逐张确认 | 未逐张确认 | 基础攻击 | 0/2（仅对照） | authority-summary；未逐张 OCR |
| 9 | cardA2 | 魔术基础攻击 #2 | 魔术 | 未逐张确认 | 未逐张确认 | 基础攻击 | 0/3（仅对照） | authority-summary；未逐张 OCR |
| 10 | Card_Avenger | 复仇者 | 特殊 | 未逐张确认 | 未逐张确认 | 职阶公共特殊；概览仅标复仇者 | 未定义（仅对照） | authority-summary；未逐张 OCR |
| 11 | Card_Avenger | 复仇者 | 特殊 | 未逐张确认 | 未逐张确认 | 职阶公共特殊；概览仅标复仇者 | 未定义（仅对照） | authority-summary；未逐张 OCR |
| 12 | Card_Avenger | 复仇者 | 特殊 | 未逐张确认 | 未逐张确认 | 职阶公共特殊；概览仅标复仇者 | 未定义（仅对照） | authority-summary；未逐张 OCR |

### 牌组说明
12 张数量与 CHM 从者概览合同一致；基础攻击按 CHM 规则的力量/迅捷/魔术类别登记，特殊牌按概览中的幸运/侦察/蓄势/职阶公共牌登记。
项目索引对照数值只用于定位单卡图和发现冲突；如后续单卡图出现额外效果或不同费用/威力，追加到 intake/evidence/chm-vs-tts-diffs-2026-10-11.md，状态改为 manual-review。

## 阿尔托莉雅·潘德拉贡

precision: authority-summary
权威概览：temp/fate-domination-intake/chm-images/图包/ScreenShot_2025-10-29_221758_597.png
状态：blocked。CHM 首页为中文能力卡，不是 12 张数字概览；以下仅记录项目/TTS 对照，待找到中文概览后复核。

| 序号 | 牌 ID | 卡牌/所在索引 | 类别 | 费用 | 威力 | 大致信息（权威摘要） | 项目索引对照 | 原文/图面状态 |
| ---: | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | cardB1 | 力量基础攻击 #1 | 力量 | 未逐张确认 | 未逐张确认 | 基础攻击 | 0/2（仅对照） | blocked（CHM 数字概览未找到） |
| 2 | cardB2 | 力量基础攻击 #2 | 力量 | 未逐张确认 | 未逐张确认 | 基础攻击 | 0/3（仅对照） | blocked（CHM 数字概览未找到） |
| 3 | cardB3 | 力量基础攻击 #3 | 力量 | 未逐张确认 | 未逐张确认 | 基础攻击 | 0/4（仅对照） | blocked（CHM 数字概览未找到） |
| 4 | cardB3 | 力量基础攻击 #3 | 力量 | 未逐张确认 | 未逐张确认 | 基础攻击 | 0/4（仅对照） | blocked（CHM 数字概览未找到） |
| 5 | cardB3 | 力量基础攻击 #3 | 力量 | 未逐张确认 | 未逐张确认 | 基础攻击 | 0/4（仅对照） | blocked（CHM 数字概览未找到） |
| 6 | cardB4 | 力量基础攻击 #4 | 力量 | 未逐张确认 | 未逐张确认 | 基础攻击 | 1/5（仅对照） | blocked（CHM 数字概览未找到） |
| 7 | cardQ2 | 迅捷基础攻击 #2 | 迅捷 | 未逐张确认 | 未逐张确认 | 基础攻击 | 0/3（仅对照） | blocked（CHM 数字概览未找到） |
| 8 | cardA1 | 魔术基础攻击 #1 | 魔术 | 未逐张确认 | 未逐张确认 | 基础攻击 | 0/2（仅对照） | blocked（CHM 数字概览未找到） |
| 9 | cardA2 | 魔术基础攻击 #2 | 魔术 | 未逐张确认 | 未逐张确认 | 基础攻击 | 0/3（仅对照） | blocked（CHM 数字概览未找到） |
| 10 | cardSurveil | 侦察/急行 | 特殊 | 未逐张确认 | 未逐张确认 | 基础特殊；侦察 | 1/3（仅对照） | blocked（CHM 数字概览未找到） |
| 11 | cardluck | 幸运 | 特殊 | 未逐张确认 | 未逐张确认 | 基础特殊；幸运 | 0/4（仅对照） | blocked（CHM 数字概览未找到） |
| 12 | cardluck | 幸运 | 特殊 | 未逐张确认 | 未逐张确认 | 基础特殊；幸运 | 0/4（仅对照） | blocked（CHM 数字概览未找到） |

### 牌组说明
demo-data.ts 对照构成为 cardB1, cardB2, cardB3×3, cardB4, cardQ2, cardA1, cardA2, cardSurveil, cardluck×2；不锁定，待 CHM/TTS 中文概览人工复核。

## 卫宫

precision: authority-summary
权威概览：temp/fate-domination-intake/chm-images/图包/ScreenShot_2025-11-01_154110_741.png
状态：locked（锁定索引/类别/重复数量/大致信息；逐张卡面全文仍为 not-currently-consumed，不进入运行时效果实现）。

| 序号 | 牌 ID | 卡牌/所在索引 | 类别 | 费用 | 威力 | 大致信息（权威摘要） | 项目索引对照 | 原文/图面状态 |
| ---: | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | cardB1 | 力量基础攻击 #1 | 力量 | 未逐张确认 | 未逐张确认 | 基础攻击 | 0/2（仅对照） | authority-summary；未逐张 OCR |
| 2 | cardB2 | 力量基础攻击 #2 | 力量 | 未逐张确认 | 未逐张确认 | 基础攻击 | 0/3（仅对照） | authority-summary；未逐张 OCR |
| 3 | cardQ1 | 迅捷基础攻击 #1 | 迅捷 | 未逐张确认 | 未逐张确认 | 基础攻击 | 0/2（仅对照） | authority-summary；未逐张 OCR |
| 4 | cardQ1 | 迅捷基础攻击 #1 | 迅捷 | 未逐张确认 | 未逐张确认 | 基础攻击 | 0/2（仅对照） | authority-summary；未逐张 OCR |
| 5 | cardQ2 | 迅捷基础攻击 #2 | 迅捷 | 未逐张确认 | 未逐张确认 | 基础攻击 | 0/3（仅对照） | authority-summary；未逐张 OCR |
| 6 | cardQ3 | 迅捷基础攻击 #3 | 迅捷 | 未逐张确认 | 未逐张确认 | 基础攻击 | 0/4（仅对照） | authority-summary；未逐张 OCR |
| 7 | cardA1 | 魔术基础攻击 #1 | 魔术 | 未逐张确认 | 未逐张确认 | 基础攻击 | 0/2（仅对照） | authority-summary；未逐张 OCR |
| 8 | cardA2 | 魔术基础攻击 #2 | 魔术 | 未逐张确认 | 未逐张确认 | 基础攻击 | 0/3（仅对照） | authority-summary；未逐张 OCR |
| 9 | cardA3 | 魔术基础攻击 #3 | 魔术 | 未逐张确认 | 未逐张确认 | 基础攻击 | 0/4（仅对照） | authority-summary；未逐张 OCR |
| 10 | cardSurveil | 侦察/急行 | 特殊 | 未逐张确认 | 未逐张确认 | 基础特殊；侦察 | 1/3（仅对照） | authority-summary；未逐张 OCR |
| 11 | cardPreparation | 蓄势/远隔操作 | 特殊 | 未逐张确认 | 未逐张确认 | 基础特殊；蓄势 | 1/2（仅对照） | authority-summary；未逐张 OCR |
| 12 | cardPreparation | 蓄势/远隔操作 | 特殊 | 未逐张确认 | 未逐张确认 | 基础特殊；蓄势 | 1/2（仅对照） | authority-summary；未逐张 OCR |

### 牌组说明
12 张数量与 CHM 从者概览合同一致；基础攻击按 CHM 规则的力量/迅捷/魔术类别登记，特殊牌按概览中的幸运/侦察/蓄势/职阶公共牌登记。
项目索引对照数值只用于定位单卡图和发现冲突；如后续单卡图出现额外效果或不同费用/威力，追加到 intake/evidence/chm-vs-tts-diffs-2026-10-11.md，状态改为 manual-review。

## 吉尔伽美什

precision: authority-summary
权威概览：temp/fate-domination-intake/chm-images/图包/ScreenShot_2025-11-01_154227_893.png
状态：locked（锁定索引/类别/重复数量/大致信息；逐张卡面全文仍为 not-currently-consumed，不进入运行时效果实现）。

| 序号 | 牌 ID | 卡牌/所在索引 | 类别 | 费用 | 威力 | 大致信息（权威摘要） | 项目索引对照 | 原文/图面状态 |
| ---: | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | cardB1 | 力量基础攻击 #1 | 力量 | 未逐张确认 | 未逐张确认 | 基础攻击 | 0/2（仅对照） | authority-summary；未逐张 OCR |
| 2 | cardB2 | 力量基础攻击 #2 | 力量 | 未逐张确认 | 未逐张确认 | 基础攻击 | 0/3（仅对照） | authority-summary；未逐张 OCR |
| 3 | cardB3 | 力量基础攻击 #3 | 力量 | 未逐张确认 | 未逐张确认 | 基础攻击 | 0/4（仅对照） | authority-summary；未逐张 OCR |
| 4 | cardQ1 | 迅捷基础攻击 #1 | 迅捷 | 未逐张确认 | 未逐张确认 | 基础攻击 | 0/2（仅对照） | authority-summary；未逐张 OCR |
| 5 | cardQ2 | 迅捷基础攻击 #2 | 迅捷 | 未逐张确认 | 未逐张确认 | 基础攻击 | 0/3（仅对照） | authority-summary；未逐张 OCR |
| 6 | cardQ3 | 迅捷基础攻击 #3 | 迅捷 | 未逐张确认 | 未逐张确认 | 基础攻击 | 0/4（仅对照） | authority-summary；未逐张 OCR |
| 7 | cardA1 | 魔术基础攻击 #1 | 魔术 | 未逐张确认 | 未逐张确认 | 基础攻击 | 0/2（仅对照） | authority-summary；未逐张 OCR |
| 8 | cardA2 | 魔术基础攻击 #2 | 魔术 | 未逐张确认 | 未逐张确认 | 基础攻击 | 0/3（仅对照） | authority-summary；未逐张 OCR |
| 9 | cardA3 | 魔术基础攻击 #3 | 魔术 | 未逐张确认 | 未逐张确认 | 基础攻击 | 0/4（仅对照） | authority-summary；未逐张 OCR |
| 10 | cardPreparation | 蓄势/远隔操作 | 特殊 | 未逐张确认 | 未逐张确认 | 基础特殊；蓄势 | 1/2（仅对照） | authority-summary；未逐张 OCR |
| 11 | cardluck | 幸运 | 特殊 | 未逐张确认 | 未逐张确认 | 基础特殊；幸运 | 0/4（仅对照） | authority-summary；未逐张 OCR |
| 12 | cardluck | 幸运 | 特殊 | 未逐张确认 | 未逐张确认 | 基础特殊；幸运 | 0/4（仅对照） | authority-summary；未逐张 OCR |

### 牌组说明
12 张数量与 CHM 从者概览合同一致；基础攻击按 CHM 规则的力量/迅捷/魔术类别登记，特殊牌按概览中的幸运/侦察/蓄势/职阶公共牌登记。
项目索引对照数值只用于定位单卡图和发现冲突；如后续单卡图出现额外效果或不同费用/威力，追加到 intake/evidence/chm-vs-tts-diffs-2026-10-11.md，状态改为 manual-review。

## 伊斯坎达尔

precision: authority-summary
权威概览：temp/fate-domination-intake/chm-images/图包/ScreenShot_2025-11-01_163842_910.png
状态：locked（锁定索引/类别/重复数量/大致信息；逐张卡面全文仍为 not-currently-consumed，不进入运行时效果实现）。

| 序号 | 牌 ID | 卡牌/所在索引 | 类别 | 费用 | 威力 | 大致信息（权威摘要） | 项目索引对照 | 原文/图面状态 |
| ---: | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | cardB1 | 力量基础攻击 #1 | 力量 | 未逐张确认 | 未逐张确认 | 基础攻击 | 0/2（仅对照） | authority-summary；未逐张 OCR |
| 2 | cardB1 | 力量基础攻击 #1 | 力量 | 未逐张确认 | 未逐张确认 | 基础攻击 | 0/2（仅对照） | authority-summary；未逐张 OCR |
| 3 | cardB2 | 力量基础攻击 #2 | 力量 | 未逐张确认 | 未逐张确认 | 基础攻击 | 0/3（仅对照） | authority-summary；未逐张 OCR |
| 4 | cardB2 | 力量基础攻击 #2 | 力量 | 未逐张确认 | 未逐张确认 | 基础攻击 | 0/3（仅对照） | authority-summary；未逐张 OCR |
| 5 | cardB3 | 力量基础攻击 #3 | 力量 | 未逐张确认 | 未逐张确认 | 基础攻击 | 0/4（仅对照） | authority-summary；未逐张 OCR |
| 6 | cardB4 | 力量基础攻击 #4 | 力量 | 未逐张确认 | 未逐张确认 | 基础攻击 | 1/5（仅对照） | authority-summary；未逐张 OCR |
| 7 | cardQ1 | 迅捷基础攻击 #1 | 迅捷 | 未逐张确认 | 未逐张确认 | 基础攻击 | 0/2（仅对照） | authority-summary；未逐张 OCR |
| 8 | cardQ2 | 迅捷基础攻击 #2 | 迅捷 | 未逐张确认 | 未逐张确认 | 基础攻击 | 0/3（仅对照） | authority-summary；未逐张 OCR |
| 9 | cardQ3 | 迅捷基础攻击 #3 | 迅捷 | 未逐张确认 | 未逐张确认 | 基础攻击 | 0/4（仅对照） | authority-summary；未逐张 OCR |
| 10 | cardA2 | 魔术基础攻击 #2 | 魔术 | 未逐张确认 | 未逐张确认 | 基础攻击 | 0/3（仅对照） | authority-summary；未逐张 OCR |
| 11 | cardSurveil | 侦察/急行 | 特殊 | 未逐张确认 | 未逐张确认 | 基础特殊；侦察 | 1/3（仅对照） | authority-summary；未逐张 OCR |
| 12 | cardluck | 幸运 | 特殊 | 未逐张确认 | 未逐张确认 | 基础特殊；幸运 | 0/4（仅对照） | authority-summary；未逐张 OCR |

### 牌组说明
12 张数量与 CHM 从者概览合同一致；基础攻击按 CHM 规则的力量/迅捷/魔术类别登记，特殊牌按概览中的幸运/侦察/蓄势/职阶公共牌登记。
项目索引对照数值只用于定位单卡图和发现冲突；如后续单卡图出现额外效果或不同费用/威力，追加到 intake/evidence/chm-vs-tts-diffs-2026-10-11.md，状态改为 manual-review。

## 美杜莎

precision: authority-summary
权威概览：temp/fate-domination-intake/chm-images/图包/ScreenShot_2025-11-01_163744_063.png
状态：locked（锁定索引/类别/重复数量/大致信息；逐张卡面全文仍为 not-currently-consumed，不进入运行时效果实现）。

| 序号 | 牌 ID | 卡牌/所在索引 | 类别 | 费用 | 威力 | 大致信息（权威摘要） | 项目索引对照 | 原文/图面状态 |
| ---: | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | cardB1 | 力量基础攻击 #1 | 力量 | 未逐张确认 | 未逐张确认 | 基础攻击 | 0/2（仅对照） | authority-summary；未逐张 OCR |
| 2 | cardB2 | 力量基础攻击 #2 | 力量 | 未逐张确认 | 未逐张确认 | 基础攻击 | 0/3（仅对照） | authority-summary；未逐张 OCR |
| 3 | cardB4 | 力量基础攻击 #4 | 力量 | 未逐张确认 | 未逐张确认 | 基础攻击 | 1/5（仅对照） | authority-summary；未逐张 OCR |
| 4 | cardQ2 | 迅捷基础攻击 #2 | 迅捷 | 未逐张确认 | 未逐张确认 | 基础攻击 | 0/3（仅对照） | authority-summary；未逐张 OCR |
| 5 | cardQ2 | 迅捷基础攻击 #2 | 迅捷 | 未逐张确认 | 未逐张确认 | 基础攻击 | 0/3（仅对照） | authority-summary；未逐张 OCR |
| 6 | cardQ3 | 迅捷基础攻击 #3 | 迅捷 | 未逐张确认 | 未逐张确认 | 基础攻击 | 0/4（仅对照） | authority-summary；未逐张 OCR |
| 7 | cardQ4 | 迅捷基础攻击 #4 | 迅捷 | 未逐张确认 | 未逐张确认 | 基础攻击 | 1/5（仅对照） | authority-summary；未逐张 OCR |
| 8 | cardA2 | 魔术基础攻击 #2 | 魔术 | 未逐张确认 | 未逐张确认 | 基础攻击 | 0/3（仅对照） | authority-summary；未逐张 OCR |
| 9 | cardA2 | 魔术基础攻击 #2 | 魔术 | 未逐张确认 | 未逐张确认 | 基础攻击 | 0/3（仅对照） | authority-summary；未逐张 OCR |
| 10 | cardSurveil | 侦察/急行 | 特殊 | 未逐张确认 | 未逐张确认 | 基础特殊；侦察 | 1/3（仅对照） | authority-summary；未逐张 OCR |
| 11 | cardPreparation | 蓄势/远隔操作 | 特殊 | 未逐张确认 | 未逐张确认 | 基础特殊；蓄势 | 1/2（仅对照） | authority-summary；未逐张 OCR |
| 12 | cardPreparation | 蓄势/远隔操作 | 特殊 | 未逐张确认 | 未逐张确认 | 基础特殊；蓄势 | 1/2（仅对照） | authority-summary；未逐张 OCR |

### 牌组说明
12 张数量与 CHM 从者概览合同一致；基础攻击按 CHM 规则的力量/迅捷/魔术类别登记，特殊牌按概览中的幸运/侦察/蓄势/职阶公共牌登记。
项目索引对照数值只用于定位单卡图和发现冲突；如后续单卡图出现额外效果或不同费用/威力，追加到 intake/evidence/chm-vs-tts-diffs-2026-10-11.md，状态改为 manual-review。

## 迪卢木多·奥迪那

precision: authority-summary
权威概览：temp/fate-domination-intake/chm-images/图包/ScreenShot_2025-11-01_111207_280.png
状态：locked（锁定索引/类别/重复数量/大致信息；逐张卡面全文仍为 not-currently-consumed，不进入运行时效果实现）。

| 序号 | 牌 ID | 卡牌/所在索引 | 类别 | 费用 | 威力 | 大致信息（权威摘要） | 项目索引对照 | 原文/图面状态 |
| ---: | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | cardB2 | 力量基础攻击 #2 | 力量 | 未逐张确认 | 未逐张确认 | 基础攻击 | 0/3（仅对照） | authority-summary；未逐张 OCR |
| 2 | cardB3 | 力量基础攻击 #3 | 力量 | 未逐张确认 | 未逐张确认 | 基础攻击 | 0/4（仅对照） | authority-summary；未逐张 OCR |
| 3 | cardB4 | 力量基础攻击 #4 | 力量 | 未逐张确认 | 未逐张确认 | 基础攻击 | 1/5（仅对照） | authority-summary；未逐张 OCR |
| 4 | cardQ1 | 迅捷基础攻击 #1 | 迅捷 | 未逐张确认 | 未逐张确认 | 基础攻击 | 0/2（仅对照） | authority-summary；未逐张 OCR |
| 5 | cardQ2 | 迅捷基础攻击 #2 | 迅捷 | 未逐张确认 | 未逐张确认 | 基础攻击 | 0/3（仅对照） | authority-summary；未逐张 OCR |
| 6 | cardQ2 | 迅捷基础攻击 #2 | 迅捷 | 未逐张确认 | 未逐张确认 | 基础攻击 | 0/3（仅对照） | authority-summary；未逐张 OCR |
| 7 | cardQ3 | 迅捷基础攻击 #3 | 迅捷 | 未逐张确认 | 未逐张确认 | 基础攻击 | 0/4（仅对照） | authority-summary；未逐张 OCR |
| 8 | cardQ3 | 迅捷基础攻击 #3 | 迅捷 | 未逐张确认 | 未逐张确认 | 基础攻击 | 0/4（仅对照） | authority-summary；未逐张 OCR |
| 9 | cardQ3 | 迅捷基础攻击 #3 | 迅捷 | 未逐张确认 | 未逐张确认 | 基础攻击 | 0/4（仅对照） | authority-summary；未逐张 OCR |
| 10 | cardQ4 | 迅捷基础攻击 #4 | 迅捷 | 未逐张确认 | 未逐张确认 | 基础攻击 | 1/5（仅对照） | authority-summary；未逐张 OCR |
| 11 | cardQ4 | 迅捷基础攻击 #4 | 迅捷 | 未逐张确认 | 未逐张确认 | 基础攻击 | 1/5（仅对照） | authority-summary；未逐张 OCR |
| 12 | cardSurveil | 侦察/急行 | 特殊 | 未逐张确认 | 未逐张确认 | 基础特殊；侦察 | 1/3（仅对照） | authority-summary；未逐张 OCR |

### 牌组说明
12 张数量与 CHM 从者概览合同一致；基础攻击按 CHM 规则的力量/迅捷/魔术类别登记，特殊牌按概览中的幸运/侦察/蓄势/职阶公共牌登记。
项目索引对照数值只用于定位单卡图和发现冲突；如后续单卡图出现额外效果或不同费用/威力，追加到 intake/evidence/chm-vs-tts-diffs-2026-10-11.md，状态改为 manual-review。

## 库·丘林

precision: authority-summary
权威概览：temp/fate-domination-intake/chm-images/图包/ScreenShot_2025-11-01_111054_633.png
状态：locked（锁定索引/类别/重复数量/大致信息；逐张卡面全文仍为 not-currently-consumed，不进入运行时效果实现）。

| 序号 | 牌 ID | 卡牌/所在索引 | 类别 | 费用 | 威力 | 大致信息（权威摘要） | 项目索引对照 | 原文/图面状态 |
| ---: | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | cardB1 | 力量基础攻击 #1 | 力量 | 未逐张确认 | 未逐张确认 | 基础攻击 | 0/2（仅对照） | authority-summary；未逐张 OCR |
| 2 | cardB2 | 力量基础攻击 #2 | 力量 | 未逐张确认 | 未逐张确认 | 基础攻击 | 0/3（仅对照） | authority-summary；未逐张 OCR |
| 3 | cardQ1 | 迅捷基础攻击 #1 | 迅捷 | 未逐张确认 | 未逐张确认 | 基础攻击 | 0/2（仅对照） | authority-summary；未逐张 OCR |
| 4 | cardQ3 | 迅捷基础攻击 #3 | 迅捷 | 未逐张确认 | 未逐张确认 | 基础攻击 | 0/4（仅对照） | authority-summary；未逐张 OCR |
| 5 | cardQ3 | 迅捷基础攻击 #3 | 迅捷 | 未逐张确认 | 未逐张确认 | 基础攻击 | 0/4（仅对照） | authority-summary；未逐张 OCR |
| 6 | cardQ3 | 迅捷基础攻击 #3 | 迅捷 | 未逐张确认 | 未逐张确认 | 基础攻击 | 0/4（仅对照） | authority-summary；未逐张 OCR |
| 7 | cardQ4 | 迅捷基础攻击 #4 | 迅捷 | 未逐张确认 | 未逐张确认 | 基础攻击 | 1/5（仅对照） | authority-summary；未逐张 OCR |
| 8 | cardA1 | 魔术基础攻击 #1 | 魔术 | 未逐张确认 | 未逐张确认 | 基础攻击 | 0/2（仅对照） | authority-summary；未逐张 OCR |
| 9 | cardA3 | 魔术基础攻击 #3 | 魔术 | 未逐张确认 | 未逐张确认 | 基础攻击 | 0/4（仅对照） | authority-summary；未逐张 OCR |
| 10 | cardA4 | 魔术基础攻击 #4 | 魔术 | 未逐张确认 | 未逐张确认 | 基础攻击 | 1/5（仅对照） | authority-summary；未逐张 OCR |
| 11 | cardSurveil | 侦察/急行 | 特殊 | 未逐张确认 | 未逐张确认 | 基础特殊；侦察 | 1/3（仅对照） | authority-summary；未逐张 OCR |
| 12 | cardSurveil | 侦察/急行 | 特殊 | 未逐张确认 | 未逐张确认 | 基础特殊；侦察 | 1/3（仅对照） | authority-summary；未逐张 OCR |

### 牌组说明
12 张数量与 CHM 从者概览合同一致；基础攻击按 CHM 规则的力量/迅捷/魔术类别登记，特殊牌按概览中的幸运/侦察/蓄势/职阶公共牌登记。
项目索引对照数值只用于定位单卡图和发现冲突；如后续单卡图出现额外效果或不同费用/威力，追加到 intake/evidence/chm-vs-tts-diffs-2026-10-11.md，状态改为 manual-review。

## 美狄亚

precision: authority-summary
权威概览：temp/fate-domination-intake/chm-images/图包/ScreenShot_2025-11-01_191706_941.png
状态：locked（锁定索引/类别/重复数量/大致信息；逐张卡面全文仍为 not-currently-consumed，不进入运行时效果实现）。

| 序号 | 牌 ID | 卡牌/所在索引 | 类别 | 费用 | 威力 | 大致信息（权威摘要） | 项目索引对照 | 原文/图面状态 |
| ---: | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | cardQ1 | 迅捷基础攻击 #1 | 迅捷 | 未逐张确认 | 未逐张确认 | 基础攻击 | 0/2（仅对照） | authority-summary；未逐张 OCR |
| 2 | cardQ2 | 迅捷基础攻击 #2 | 迅捷 | 未逐张确认 | 未逐张确认 | 基础攻击 | 0/3（仅对照） | authority-summary；未逐张 OCR |
| 3 | cardQ3 | 迅捷基础攻击 #3 | 迅捷 | 未逐张确认 | 未逐张确认 | 基础攻击 | 0/4（仅对照） | authority-summary；未逐张 OCR |
| 4 | cardA1 | 魔术基础攻击 #1 | 魔术 | 未逐张确认 | 未逐张确认 | 基础攻击 | 0/2（仅对照） | authority-summary；未逐张 OCR |
| 5 | cardA2 | 魔术基础攻击 #2 | 魔术 | 未逐张确认 | 未逐张确认 | 基础攻击 | 0/3（仅对照） | authority-summary；未逐张 OCR |
| 6 | cardA2 | 魔术基础攻击 #2 | 魔术 | 未逐张确认 | 未逐张确认 | 基础攻击 | 0/3（仅对照） | authority-summary；未逐张 OCR |
| 7 | cardA3 | 魔术基础攻击 #3 | 魔术 | 未逐张确认 | 未逐张确认 | 基础攻击 | 0/4（仅对照） | authority-summary；未逐张 OCR |
| 8 | cardA3 | 魔术基础攻击 #3 | 魔术 | 未逐张确认 | 未逐张确认 | 基础攻击 | 0/4（仅对照） | authority-summary；未逐张 OCR |
| 9 | cardA4 | 魔术基础攻击 #4 | 魔术 | 未逐张确认 | 未逐张确认 | 基础攻击 | 1/5（仅对照） | authority-summary；未逐张 OCR |
| 10 | cardSurveil | 侦察/急行 | 特殊 | 未逐张确认 | 未逐张确认 | 基础特殊；侦察 | 1/3（仅对照） | authority-summary；未逐张 OCR |
| 11 | cardluck | 幸运 | 特殊 | 未逐张确认 | 未逐张确认 | 基础特殊；幸运 | 0/4（仅对照） | authority-summary；未逐张 OCR |
| 12 | cardPreparation | 蓄势/远隔操作 | 特殊 | 未逐张确认 | 未逐张确认 | 基础特殊；蓄势 | 1/2（仅对照） | authority-summary；未逐张 OCR |

### 牌组说明
12 张数量与 CHM 从者概览合同一致；基础攻击按 CHM 规则的力量/迅捷/魔术类别登记，特殊牌按概览中的幸运/侦察/蓄势/职阶公共牌登记。
项目索引对照数值只用于定位单卡图和发现冲突；如后续单卡图出现额外效果或不同费用/威力，追加到 intake/evidence/chm-vs-tts-diffs-2026-10-11.md，状态改为 manual-review。

## 吉尔·德·雷

precision: authority-summary
权威概览：temp/fate-domination-intake/chm-images/图包/ScreenShot_2025-11-01_191753_822.png
状态：locked（锁定索引/类别/重复数量/大致信息；逐张卡面全文仍为 not-currently-consumed，不进入运行时效果实现）。

| 序号 | 牌 ID | 卡牌/所在索引 | 类别 | 费用 | 威力 | 大致信息（权威摘要） | 项目索引对照 | 原文/图面状态 |
| ---: | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | cardA1 | 魔术基础攻击 #1 | 魔术 | 未逐张确认 | 未逐张确认 | 基础攻击 | 0/2（仅对照） | authority-summary；未逐张 OCR |
| 2 | cardA1 | 魔术基础攻击 #1 | 魔术 | 未逐张确认 | 未逐张确认 | 基础攻击 | 0/2（仅对照） | authority-summary；未逐张 OCR |
| 3 | cardA1 | 魔术基础攻击 #1 | 魔术 | 未逐张确认 | 未逐张确认 | 基础攻击 | 0/2（仅对照） | authority-summary；未逐张 OCR |
| 4 | cardA2 | 魔术基础攻击 #2 | 魔术 | 未逐张确认 | 未逐张确认 | 基础攻击 | 0/3（仅对照） | authority-summary；未逐张 OCR |
| 5 | cardA2 | 魔术基础攻击 #2 | 魔术 | 未逐张确认 | 未逐张确认 | 基础攻击 | 0/3（仅对照） | authority-summary；未逐张 OCR |
| 6 | cardA2 | 魔术基础攻击 #2 | 魔术 | 未逐张确认 | 未逐张确认 | 基础攻击 | 0/3（仅对照） | authority-summary；未逐张 OCR |
| 7 | cardA3 | 魔术基础攻击 #3 | 魔术 | 未逐张确认 | 未逐张确认 | 基础攻击 | 0/4（仅对照） | authority-summary；未逐张 OCR |
| 8 | cardA3 | 魔术基础攻击 #3 | 魔术 | 未逐张确认 | 未逐张确认 | 基础攻击 | 0/4（仅对照） | authority-summary；未逐张 OCR |
| 9 | cardA4 | 魔术基础攻击 #4 | 魔术 | 未逐张确认 | 未逐张确认 | 基础攻击 | 1/5（仅对照） | authority-summary；未逐张 OCR |
| 10 | cardA4 | 魔术基础攻击 #4 | 魔术 | 未逐张确认 | 未逐张确认 | 基础攻击 | 1/5（仅对照） | authority-summary；未逐张 OCR |
| 11 | cardPreparation | 蓄势/远隔操作 | 特殊 | 未逐张确认 | 未逐张确认 | 基础特殊；蓄势 | 1/2（仅对照） | authority-summary；未逐张 OCR |
| 12 | cardPreparation | 蓄势/远隔操作 | 特殊 | 未逐张确认 | 未逐张确认 | 基础特殊；蓄势 | 1/2（仅对照） | authority-summary；未逐张 OCR |

### 牌组说明
12 张数量与 CHM 从者概览合同一致；基础攻击按 CHM 规则的力量/迅捷/魔术类别登记，特殊牌按概览中的幸运/侦察/蓄势/职阶公共牌登记。
项目索引对照数值只用于定位单卡图和发现冲突；如后续单卡图出现额外效果或不同费用/威力，追加到 intake/evidence/chm-vs-tts-diffs-2026-10-11.md，状态改为 manual-review。

## 佐佐木小次郎

precision: authority-summary
权威概览：temp/fate-domination-intake/chm-images/图包/ScreenShot_2025-11-01_212419_960.png
状态：locked（锁定索引/类别/重复数量/大致信息；逐张卡面全文仍为 not-currently-consumed，不进入运行时效果实现）。

| 序号 | 牌 ID | 卡牌/所在索引 | 类别 | 费用 | 威力 | 大致信息（权威摘要） | 项目索引对照 | 原文/图面状态 |
| ---: | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | cardB1 | 力量基础攻击 #1 | 力量 | 未逐张确认 | 未逐张确认 | 基础攻击 | 0/2（仅对照） | authority-summary；未逐张 OCR |
| 2 | cardB2 | 力量基础攻击 #2 | 力量 | 未逐张确认 | 未逐张确认 | 基础攻击 | 0/3（仅对照） | authority-summary；未逐张 OCR |
| 3 | cardB3 | 力量基础攻击 #3 | 力量 | 未逐张确认 | 未逐张确认 | 基础攻击 | 0/4（仅对照） | authority-summary；未逐张 OCR |
| 4 | cardQ1 | 迅捷基础攻击 #1 | 迅捷 | 未逐张确认 | 未逐张确认 | 基础攻击 | 0/2（仅对照） | authority-summary；未逐张 OCR |
| 5 | cardQ2 | 迅捷基础攻击 #2 | 迅捷 | 未逐张确认 | 未逐张确认 | 基础攻击 | 0/3（仅对照） | authority-summary；未逐张 OCR |
| 6 | cardQ2 | 迅捷基础攻击 #2 | 迅捷 | 未逐张确认 | 未逐张确认 | 基础攻击 | 0/3（仅对照） | authority-summary；未逐张 OCR |
| 7 | cardQ3 | 迅捷基础攻击 #3 | 迅捷 | 未逐张确认 | 未逐张确认 | 基础攻击 | 0/4（仅对照） | authority-summary；未逐张 OCR |
| 8 | cardQ4 | 迅捷基础攻击 #4 | 迅捷 | 未逐张确认 | 未逐张确认 | 基础攻击 | 1/5（仅对照） | authority-summary；未逐张 OCR |
| 9 | cardQ4 | 迅捷基础攻击 #4 | 迅捷 | 未逐张确认 | 未逐张确认 | 基础攻击 | 1/5（仅对照） | authority-summary；未逐张 OCR |
| 10 | cardSurveil | 侦察/急行 | 特殊 | 未逐张确认 | 未逐张确认 | 基础特殊；侦察 | 1/3（仅对照） | authority-summary；未逐张 OCR |
| 11 | cardluck | 幸运 | 特殊 | 未逐张确认 | 未逐张确认 | 基础特殊；幸运 | 0/4（仅对照） | authority-summary；未逐张 OCR |
| 12 | cardluck | 幸运 | 特殊 | 未逐张确认 | 未逐张确认 | 基础特殊；幸运 | 0/4（仅对照） | authority-summary；未逐张 OCR |

### 牌组说明
12 张数量与 CHM 从者概览合同一致；基础攻击按 CHM 规则的力量/迅捷/魔术类别登记，特殊牌按概览中的幸运/侦察/蓄势/职阶公共牌登记。
项目索引对照数值只用于定位单卡图和发现冲突；如后续单卡图出现额外效果或不同费用/威力，追加到 intake/evidence/chm-vs-tts-diffs-2026-10-11.md，状态改为 manual-review。

## 哈桑·萨巴赫(咒腕)

precision: authority-summary
权威概览：temp/fate-domination-intake/chm-images/图包/ScreenShot_2025-11-01_212532_416.png
状态：locked（锁定索引/类别/重复数量/大致信息；逐张卡面全文仍为 not-currently-consumed，不进入运行时效果实现）。

| 序号 | 牌 ID | 卡牌/所在索引 | 类别 | 费用 | 威力 | 大致信息（权威摘要） | 项目索引对照 | 原文/图面状态 |
| ---: | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | cardB1 | 力量基础攻击 #1 | 力量 | 未逐张确认 | 未逐张确认 | 基础攻击 | 0/2（仅对照） | authority-summary；未逐张 OCR |
| 2 | cardB2 | 力量基础攻击 #2 | 力量 | 未逐张确认 | 未逐张确认 | 基础攻击 | 0/3（仅对照） | authority-summary；未逐张 OCR |
| 3 | cardB3 | 力量基础攻击 #3 | 力量 | 未逐张确认 | 未逐张确认 | 基础攻击 | 0/4（仅对照） | authority-summary；未逐张 OCR |
| 4 | cardQ2 | 迅捷基础攻击 #2 | 迅捷 | 未逐张确认 | 未逐张确认 | 基础攻击 | 0/3（仅对照） | authority-summary；未逐张 OCR |
| 5 | cardQ3 | 迅捷基础攻击 #3 | 迅捷 | 未逐张确认 | 未逐张确认 | 基础攻击 | 0/4（仅对照） | authority-summary；未逐张 OCR |
| 6 | cardQ4 | 迅捷基础攻击 #4 | 迅捷 | 未逐张确认 | 未逐张确认 | 基础攻击 | 1/5（仅对照） | authority-summary；未逐张 OCR |
| 7 | cardA1 | 魔术基础攻击 #1 | 魔术 | 未逐张确认 | 未逐张确认 | 基础攻击 | 0/2（仅对照） | authority-summary；未逐张 OCR |
| 8 | cardA2 | 魔术基础攻击 #2 | 魔术 | 未逐张确认 | 未逐张确认 | 基础攻击 | 0/3（仅对照） | authority-summary；未逐张 OCR |
| 9 | cardA2 | 魔术基础攻击 #2 | 魔术 | 未逐张确认 | 未逐张确认 | 基础攻击 | 0/3（仅对照） | authority-summary；未逐张 OCR |
| 10 | cardSurveil | 侦察/急行 | 特殊 | 未逐张确认 | 未逐张确认 | 基础特殊；侦察 | 1/3（仅对照） | authority-summary；未逐张 OCR |
| 11 | cardSurveil | 侦察/急行 | 特殊 | 未逐张确认 | 未逐张确认 | 基础特殊；侦察 | 1/3（仅对照） | authority-summary；未逐张 OCR |
| 12 | cardPreparation | 蓄势/远隔操作 | 特殊 | 未逐张确认 | 未逐张确认 | 基础特殊；蓄势 | 1/2（仅对照） | authority-summary；未逐张 OCR |

### 牌组说明
12 张数量与 CHM 从者概览合同一致；基础攻击按 CHM 规则的力量/迅捷/魔术类别登记，特殊牌按概览中的幸运/侦察/蓄势/职阶公共牌登记。
项目索引对照数值只用于定位单卡图和发现冲突；如后续单卡图出现额外效果或不同费用/威力，追加到 intake/evidence/chm-vs-tts-diffs-2026-10-11.md，状态改为 manual-review。

## 赫拉克勒斯

precision: authority-summary
权威概览：temp/fate-domination-intake/chm-images/图包/ScreenShot_2025-11-02_110640_013.png
状态：locked（锁定索引/类别/重复数量/大致信息；逐张卡面全文仍为 not-currently-consumed，不进入运行时效果实现）。

| 序号 | 牌 ID | 卡牌/所在索引 | 类别 | 费用 | 威力 | 大致信息（权威摘要） | 项目索引对照 | 原文/图面状态 |
| ---: | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | cardB1 | 力量基础攻击 #1 | 力量 | 未逐张确认 | 未逐张确认 | 基础攻击 | 0/2（仅对照） | authority-summary；未逐张 OCR |
| 2 | cardB1 | 力量基础攻击 #1 | 力量 | 未逐张确认 | 未逐张确认 | 基础攻击 | 0/2（仅对照） | authority-summary；未逐张 OCR |
| 3 | cardB2 | 力量基础攻击 #2 | 力量 | 未逐张确认 | 未逐张确认 | 基础攻击 | 0/3（仅对照） | authority-summary；未逐张 OCR |
| 4 | cardB4 | 力量基础攻击 #4 | 力量 | 未逐张确认 | 未逐张确认 | 基础攻击 | 1/5（仅对照） | authority-summary；未逐张 OCR |
| 5 | cardB4 | 力量基础攻击 #4 | 力量 | 未逐张确认 | 未逐张确认 | 基础攻击 | 1/5（仅对照） | authority-summary；未逐张 OCR |
| 6 | cardB5 | 力量基础攻击 #5 | 力量 | 未逐张确认 | 未逐张确认 | 狂战士基础攻击 | 3/7（仅对照） | authority-summary；未逐张 OCR |
| 7 | cardB6 | 力量基础攻击 #6 | 力量 | 未逐张确认 | 未逐张确认 | 狂战士基础攻击 | 5/9（仅对照） | authority-summary；未逐张 OCR |
| 8 | cardQ1 | 迅捷基础攻击 #1 | 迅捷 | 未逐张确认 | 未逐张确认 | 基础攻击 | 0/2（仅对照） | authority-summary；未逐张 OCR |
| 9 | cardQ3 | 迅捷基础攻击 #3 | 迅捷 | 未逐张确认 | 未逐张确认 | 基础攻击 | 0/4（仅对照） | authority-summary；未逐张 OCR |
| 10 | cardQ5 | 迅捷基础攻击 #5 | 迅捷 | 未逐张确认 | 未逐张确认 | 狂战士基础攻击 | 3/7（仅对照） | authority-summary；未逐张 OCR |
| 11 | cardluck | 幸运 | 特殊 | 未逐张确认 | 未逐张确认 | 基础特殊；幸运 | 0/4（仅对照） | authority-summary；未逐张 OCR |
| 12 | cardluck | 幸运 | 特殊 | 未逐张确认 | 未逐张确认 | 基础特殊；幸运 | 0/4（仅对照） | authority-summary；未逐张 OCR |

### 牌组说明
12 张数量与 CHM 从者概览合同一致；基础攻击按 CHM 规则的力量/迅捷/魔术类别登记，特殊牌按概览中的幸运/侦察/蓄势/职阶公共牌登记。
项目索引对照数值只用于定位单卡图和发现冲突；如后续单卡图出现额外效果或不同费用/威力，追加到 intake/evidence/chm-vs-tts-diffs-2026-10-11.md，状态改为 manual-review。

## 兰斯洛特

precision: authority-summary
权威概览：temp/fate-domination-intake/chm-images/图包/ScreenShot_2025-11-02_110748_453.png
状态：locked（锁定索引/类别/重复数量/大致信息；逐张卡面全文仍为 not-currently-consumed，不进入运行时效果实现）。

| 序号 | 牌 ID | 卡牌/所在索引 | 类别 | 费用 | 威力 | 大致信息（权威摘要） | 项目索引对照 | 原文/图面状态 |
| ---: | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | cardB1 | 力量基础攻击 #1 | 力量 | 未逐张确认 | 未逐张确认 | 基础攻击 | 0/2（仅对照） | authority-summary；未逐张 OCR |
| 2 | cardB1 | 力量基础攻击 #1 | 力量 | 未逐张确认 | 未逐张确认 | 基础攻击 | 0/2（仅对照） | authority-summary；未逐张 OCR |
| 3 | cardB3 | 力量基础攻击 #3 | 力量 | 未逐张确认 | 未逐张确认 | 基础攻击 | 0/4（仅对照） | authority-summary；未逐张 OCR |
| 4 | cardB5 | 力量基础攻击 #5 | 力量 | 未逐张确认 | 未逐张确认 | 狂战士基础攻击 | 3/7（仅对照） | authority-summary；未逐张 OCR |
| 5 | cardQ1 | 迅捷基础攻击 #1 | 迅捷 | 未逐张确认 | 未逐张确认 | 基础攻击 | 0/2（仅对照） | authority-summary；未逐张 OCR |
| 6 | cardQ2 | 迅捷基础攻击 #2 | 迅捷 | 未逐张确认 | 未逐张确认 | 基础攻击 | 0/3（仅对照） | authority-summary；未逐张 OCR |
| 7 | cardQ4 | 迅捷基础攻击 #4 | 迅捷 | 未逐张确认 | 未逐张确认 | 基础攻击 | 1/5（仅对照） | authority-summary；未逐张 OCR |
| 8 | cardQ5 | 迅捷基础攻击 #5 | 迅捷 | 未逐张确认 | 未逐张确认 | 狂战士基础攻击 | 3/7（仅对照） | authority-summary；未逐张 OCR |
| 9 | cardQ6 | 迅捷基础攻击 #6 | 迅捷 | 未逐张确认 | 未逐张确认 | 狂战士基础攻击 | 5/9（仅对照） | authority-summary；未逐张 OCR |
| 10 | cardluck | 幸运 | 特殊 | 未逐张确认 | 未逐张确认 | 基础特殊；幸运 | 0/4（仅对照） | authority-summary；未逐张 OCR |
| 11 | cardluck | 幸运 | 特殊 | 未逐张确认 | 未逐张确认 | 基础特殊；幸运 | 0/4（仅对照） | authority-summary；未逐张 OCR |
| 12 | cardluck | 幸运 | 特殊 | 未逐张确认 | 未逐张确认 | 基础特殊；幸运 | 0/4（仅对照） | authority-summary；未逐张 OCR |

### 牌组说明
12 张数量与 CHM 从者概览合同一致；基础攻击按 CHM 规则的力量/迅捷/魔术类别登记，特殊牌按概览中的幸运/侦察/蓄势/职阶公共牌登记。
项目索引对照数值只用于定位单卡图和发现冲突；如后续单卡图出现额外效果或不同费用/威力，追加到 intake/evidence/chm-vs-tts-diffs-2026-10-11.md，状态改为 manual-review。

## 人工复核队列

- 逐张卡图正文尚未全部抽取；需要玩家可见完整文案或规则实现时，必须回到 CHM 单卡图 / 中文卡图补 OCR。
- Card_Avenger 的具体费用/威力/效果未由当前 CHM 概览直接覆盖，暂保留为职阶公共特殊牌索引，不得用 TTS 英文补中文效果。
- 阿尔托莉雅 12 张数字概览仍 blocked。
