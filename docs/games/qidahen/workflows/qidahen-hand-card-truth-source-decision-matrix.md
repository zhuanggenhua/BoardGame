# 七大恨普通手牌真相源完成依据决策矩阵

> 这份矩阵只判断“某个来源能否作为 OpenSpec `2.4` 的完成依据”。它不是正式规则映射，也不得把 OCR、文件路径或牌类说明自动写入正式手牌逻辑。

## 判定标准

OpenSpec `2.4` 要关闭，至少需要能证明普通事件、军备、战术、银两的逐牌规则身份：

- 中文牌名
- 牌类：事件 / 军备 / 战术 / 银两
- 规则效果摘要
- 军备目标：仅军备牌需要
- 可追溯来源：规则牌表、可靠 OCR 后人工确认、或逐牌人工录入记录

只证明“牌类存在”“图集存在”“CardID 顺序存在”“局部 OCR 像某张牌”“教程注入态能跑通”，都不能关闭 `2.4`。

## 来源决策矩阵

| 来源 | 已证明内容 | 缺口 | 能否关闭 2.4 | 证据文档 |
| --- | --- | --- | --- | --- |
| 规则 PDF | 证明手牌行动包含执行事件、升级军备、势力行动；证明军备牌、事件牌、战术牌、银两牌的通用牌类规则 | 不含逐张牌名、效果、军备目标或逐牌表 | 否 | `qidahen-hand-card-rule-pdf-review.md` |
| TTS Workshop JSON | 证明 `deckId 13 / 16 / 17` 有正式牌库对象、CardID 顺序和图集键 | 牌库内 `Nickname / Description` 为空；命名军备对象是辅助卡或状态对象 | 否 | `qidahen-hand-card-structured-source-recheck.md` |
| 本地素材目录穷尽复查 | 只发现图片素材、1 个 TTS JSON 和 1 个规则 PDF；没有额外文本牌表、结构化表格或压缩包；71 张图片文件名没有普通手牌牌类关键词命中；运行时 manifest 的 30 个 `cards/` 键也没有普通手牌牌类关键词命中；33 张疑似单卡素材 OCR 小批量试跑没有普通牌类关键词独占命中；33 张候选已按需求交接式安全读图全量验收 | 新扫描、小批量 OCR 和全量读图都没有发现未纳入前序矩阵的逐牌真相源；安全读图结果为 30 张非普通手牌/非手牌素材排除和 3 张纯色底块阻塞 | 否 | `qidahen-hand-card-local-asset-source-exhaustion.md`、`qidahen-hand-card-single-card-ocr-probe.md` |
| TTS CardID 完整矩阵 | 10 个牌组段展开为 143 行出现记录、99 个唯一图集位置；2026-07-03 已按哈希交叉证据和低分辨率安全核读结果全部回填为排除 | 143 行均无普通事件、军备、战术或银两确认字段，不能反写正式规则映射 | 否 | `qidahen-hand-card-tts-cardid-full-manual-entry-matrix.md` |
| 运行时资源清单 | 证明运行时有 `card / deck / atlas / characters` 资源路径 | 不含普通事件、军备、战术、银两的逐牌规则字段 | 否 | `qidahen-hand-card-structured-source-recheck.md` |
| 图集裁切候选 | 证明 49 张牌面可能可读，可作为人工复核入口；2026-07-03 已完成 49 张低分辨率标题预览核读并回填主矩阵 | 49 张均已排除为人物、纪年/剧本、牌背/空白、不可读或其他非普通手牌来源，没有普通事件、军备、战术或银两确认行 | 否 | `qidahen-hand-card-truth-source-candidates.md`、`qidahen-hand-card-manual-entry-matrix.md` |
| 安全标题 OCR | 证明 high/medium/low/unreadable 的人工核读优先级 | OCR 有明显错读；不能证明牌类、效果或军备目标 | 否 | `qidahen-hand-card-high-priority-title-review.md` 等 |
| 批量牌面 OCR | 49 张候选均有正文 OCR，43 张有标题 OCR | 存在错读、噪音、繁简/异体字问题；只可辅助人工录入 | 否 | `qidahen-hand-card-easyocr-batch-review.md` |
| OCR 关键词分流 | 证明“手牌/打出”等词会出现在人物或剧本/纪年正文里 | 普通关键词独占命中为 0，不能判定普通牌 | 否 | `qidahen-hand-card-ocr-keyword-triage.md` |
| 非普通排除候选 | 49 张里 37 张命中人物或剧本/纪年线索 | 排除仍需人工复核；不能替代逐牌确认 | 否 | `qidahen-hand-card-nonordinary-exclusion-candidates.md` |
| 剩余 12 张队列 | 把候选缩到 12 张仍需人工确认对象；2026-07-03 已通过低分辨率标题预览完成核读 | 5 张为人物牌标题，6 张为牌背/空白，1 张为不可读/非普通候选；没有普通事件、军备、战术或银两确认行 | 否 | `qidahen-hand-card-remaining-manual-review-queue.md` |
| 剩余 12 张二次分流 | 得到疑似人物 5 张、低信息 6 张、仍需人工看图 1 张；后续安全预览已把这些候选全部排除 | 没有任何普通牌可直接入库 | 否 | `qidahen-hand-card-remaining-review-subtriage.md` |
| 最后 1 张安全 OCR | `mongol_r07_c10` 小尺寸变体 OCR 仍无稳定牌名/牌类/效果 | 仍需人工看图或外部 OCR | 否 | `qidahen-hand-card-final-candidate-safe-ocr.md` |
| 人工复核清单 | 固定 12 张剩余候选的人工确认字段和排除字段；后续低分辨率标题预览已完成回填 | 12 张均已排除为人物牌、牌背/空白或不可读/非普通候选，没有已确认普通牌 | 否 | `qidahen-hand-card-human-review-checklist.md` |
| 运行时图集候选矩阵 | 通过文本与哈希交叉核验，把可能对应正式 faction hand preview atlas 的候选收窄为大明 9、蒙古 14、后金 5，共 28 条；2026-07-03 已用低分辨率安全预览完成 28 条核读 | 28 条均已排除为人物牌、纪年/剧本类牌或人物效果相关非普通牌，不能提供普通事件、军备、战术或银两映射 | 否 | `qidahen-hand-card-runtime-atlas-tts-crosswalk.md`、`qidahen-hand-card-runtime-atlas-manual-entry-matrix.md`、`qidahen-hand-card-runtime-atlas-priority-review.md` |
| 外部文本搜索 | 已两轮搜索中文和英文牌表关键词，追加搜索结果仍主要是无关页面或搜索噪音 | 没有找到可追溯逐牌牌表 | 否 | `qidahen-hand-card-external-source-search.md` |
| 教程注入态 | 可演示事件/军备教程链路 | 教程注入卡不是正式开局普通手牌真相源 | 否 | `qidahen-primary-interaction-audit.md` |

## 当前裁决

- 当前所有已核来源都不能单独或合并关闭 OpenSpec `2.4`。
- 49 张 OCR 候选主矩阵已经完成本轮安全标题预览核读回填，全部为人物、纪年/剧本、牌背/空白、不可读或其他非普通手牌来源，不能补普通事件、军备、战术或银两映射。
- TTS CardID 完整矩阵的 143 行也已完成排除回填：28 条运行时图集候选已安全核读排除，111 条纪年/朝鲜或非正式手牌图集由哈希证据排除，4 条 1x1 `CardCustom` 小牌组对象缺少牌名、说明、牌类和效果字段。
- 运行时 faction hand preview atlas 候选链已经被证伪：28 条候选全部核读并排除为非普通手牌，不能再作为普通事件、军备、战术或银两的完成依据。
- 本地疑似单卡素材 OCR 小批量试跑没有产生普通牌类关键词独占命中；33 张候选已按需求交接式安全读图全量验收，结果为 30 张非普通手牌/非手牌素材排除、3 张纯色底块阻塞，没有任何 `passed` 普通事件、军备、战术或银两牌；因此不能关闭 `2.4`。
- 现有证据能证明：普通手牌一级入口的规则目标明确，但正式局缺逐牌真相源。
- 下一步只有三条有效路径：
  - 找到可追溯逐牌牌表。
  - 对候选牌面做可靠 OCR 后进行人工确认。
  - 找到其他非运行时图集来源的可审计普通手牌录入，并把普通牌映射回正式规则。
- 在以上任一条件满足前，OpenSpec `2.4` 和 `4.5` 必须保持未完成。
