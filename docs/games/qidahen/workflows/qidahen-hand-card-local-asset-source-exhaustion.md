# 七大恨本地素材逐牌真相源穷尽复查

> 本文件记录 2026-07-03 对本地七大恨素材目录的再次文本/元数据复查。复查目标是确认是否还存在未纳入前序矩阵的普通事件、军备、战术、银两逐牌牌表。本文件不读取图片，不把图片、OCR 猜测或文件路径直接写入正式手牌规则映射。

## 复查对象

- 素材根目录：`D:\gongzuo\webgame\gameasset\七大恨 中文mod`
- 当前仓库文档与临时证据入口：
  - `docs/games/qidahen/workflows/qidahen-hand-card-truth-source-candidates.md`
  - `docs/games/qidahen/workflows/qidahen-hand-card-truth-source-decision-matrix.md`
  - `docs/games/qidahen/workflows/qidahen-hand-card-manual-entry-matrix.md`
  - `docs/games/qidahen/workflows/qidahen-hand-card-tts-cardid-full-manual-entry-matrix.md`
  - `docs/games/qidahen/workflows/qidahen-hand-card-runtime-atlas-manual-entry-matrix.md`

## 文件类型结果

本地素材目录递归扫描到的文件类型为：

| 类型 | 数量 | 当前裁决 |
| --- | ---: | --- |
| `.jpg` | 62 | 图片素材；未直接读入模型上下文，需安全裁切/OCR/人工核读后才可作为候选线索 |
| `.png` | 9 | 图片素材；未直接读入模型上下文，不能单独成为逐牌规则真相源 |
| `.json` | 1 | TTS Workshop JSON；此前已核为只有牌组顺序、图集键、辅助卡和军备状态对象名称，缺逐牌规则字段 |
| `.pdf` | 1 | 规则 PDF；此前已核为只有牌类与手牌行动规则说明，缺普通牌逐张牌名、效果和军备目标 |

## 图片元数据复查

- 本轮只读取图片文件头、文件名、字节数和尺寸，不读取图片内容，不把图片二进制放入模型上下文。
- 本地辅助输出：
  - `temp/qidahen-asset-source-audit/local-image-metadata.json`
  - `temp/qidahen-asset-source-audit/local-image-metadata.md`
- 图片总数：71。
- 扩展名分布：`.jpg` 62、`.png` 9。
- 文件名牌类关键词命中：0。
- 尺寸分布显示素材主要是单卡/图集/棋盘/小图标混合资源；但文件名没有出现 `事件 / 军备 / 战术 / 银两 / event / armament / tactic / silver` 等能直接判定普通手牌逐牌身份的命名线索。

## 运行时资源 manifest 键复查

- 本轮只读取 `public/assets/i18n/zh-CN/qidahen/assets-manifest.json` 的资源键，不读取图片内容。
- 本地辅助输出：
  - `temp/qidahen-asset-source-audit/runtime-asset-manifest-key-audit.json`
  - `temp/qidahen-asset-source-audit/runtime-asset-manifest-key-audit.md`
- `files` 总键数：130。
- `cards/` 相关键数：30。
- 普通手牌牌类关键词命中：0。
- `cards/` 资源键只落在图集、压缩图集、牌背和蒙古人物牌分组；没有 `事件 / 军备 / 战术 / 银两 / event / armament / tactic / silver` 的逐牌资源键。

## 疑似单卡素材 OCR 小批量试跑

- 本轮继续按图片安全读取口径推进：不把本地图片、图集或牌面二进制写入 Markdown，也不把大图交给模型；只由本地脚本用 PIL 读取图片后转为数组交给 EasyOCR。
- 本地辅助输出：
  - `temp/qidahen-asset-source-audit/single-card-ocr-probe/single-card-ocr-probe.json`
  - `temp/qidahen-asset-source-audit/single-card-ocr-probe/single-card-ocr-probe.md`
- 可提交长期证据：
  - `docs/games/qidahen/workflows/qidahen-hand-card-single-card-ocr-probe.md`
- 候选数：33；试跑数：33。
- 分流结果：
  - `ordinary-keyword-only-needs-human-confirmation`: 0
  - `mixed-ordinary-nonordinary`: 0
  - `nonordinary-keyword`: 4
  - `ocr-text-no-class-keyword`: 23
  - `no-ocr-text`: 6
- 4 条 `nonordinary-keyword` 命中人物或下野等非普通手牌线索，可作为排除线索。
- 23 条 `ocr-text-no-class-keyword` 只有低信息 OCR 文本，不能自动确认为普通事件、军备、战术或银两，也不能自动全部排除；它们最多说明“本轮自动 OCR 没有命中普通牌类关键词”。
- 6 条 `no-ocr-text` 没有可用 OCR 文本，不能提供中文牌名、牌类、效果或军备目标。
- 已按需求交接式安全读图流程补做 4 张代表样本验收：3 张明确为非普通手牌（人物、部队/标记图标、牌背），1 张因纯色底块无法判断。该步骤证明安全读图链路可用，但样本没有产出普通事件、军备、战术或银两的反写字段。
- 因此本批试跑没有产生任何可以反写正式 `cardKind / cardDefId / armamentId` 的逐牌真相源，只能作为“本地图片侧自动推进仍未闭环”的阻塞证据。

## 可直接读取来源结果

- 本地素材目录内没有额外 `.txt / .md / .csv / .tsv / .xml / .html / .xlsx / .xls / .docx` 牌表文件。
- 本地素材目录内没有 `.zip / .rar / .7z` 等可能藏有逐牌牌表的压缩包。
- 仅有两个可直接读取的非图片来源：
  - `七大恨规则.pdf`
  - `Workshop\2228142777.json`
- 两者都已在前序文档中复核，均不能提供普通事件、军备、战术、银两所需的逐牌中文牌名、牌类、效果和军备目标。

## 与现有矩阵关系

- 49 张 OCR 候选主矩阵已完成核读回填，无普通事件、军备、战术或银两确认行。
- 143 行 TTS CardID 完整矩阵已全部按证据回填为排除，无普通事件、军备、战术或银两确认行。
- 28 条运行时图集候选矩阵已完成低分辨率安全核读并全部排除，无普通事件、军备、战术或银两确认行。
- 本次本地素材目录复查没有发现第四条可追溯文本来源来推翻上述裁决。
- 图片元数据复查没有发现可直接替代逐牌牌表的文件名命名线索。
- 运行时资源 manifest 键复查也没有发现可直接替代逐牌牌表的普通手牌资源键。
- 疑似单卡素材 OCR 小批量试跑没有产生普通牌类关键词独占命中；需求交接式读图代表样本也只得到 3 条非普通手牌排除和 1 条图片不足阻塞，没有给出可审计中文牌名、牌类、效果或军备目标，因此不能替代逐牌牌表或人工确认。

## 当前裁决

本地素材目录已经没有未复查的文本牌表、结构化牌表、表格文件或压缩包。当前普通手牌真相源缺口仍成立：不能把现有图片素材、TTS `CardID` 顺序、文件路径、OCR 关键词或教程注入态反写为正式 `cardKind / cardDefId / armamentId`。

后续若要继续推进 OpenSpec `2.4`，只能走以下路径之一：

- 找到新的可追溯逐牌牌表，且字段覆盖中文牌名、牌类、效果和军备目标。
- 对非运行时图集来源做可靠 OCR，并经人工确认后回填矩阵。
- 取得其他可审计普通手牌录入来源，再按 `qidahen-hand-card-formal-mapping-contract.md` 和 `scripts/verify/qidahen-hand-card-manual-entry.mjs` 验证反写门槛。
