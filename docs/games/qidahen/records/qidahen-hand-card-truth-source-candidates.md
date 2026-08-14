# 七大恨普通手牌真相源候选审计

> 结论先行：这份文档只记录 2026-07-02 至 2026-07-03 已核过的普通手牌候选证据，不能直接当作正式规则映射。早期表里的“待复核 / 待人工复核”是当时归档状态；当前裁决以主矩阵、TTS 完整矩阵、运行时图集矩阵和完成依据决策矩阵为准。未找到逐牌真相源前，OpenSpec `2.4` 和 `4.5` 必须保持未完成。

## 当前结论

- 正式运行时仍不能把普通事件牌、军备牌、战术牌、银两牌稳定识别成规则书口径的手牌行动入口。
- 当前可提交证据已经把 49 张 OCR 候选、143 行 TTS CardID 完整矩阵和 28 条运行时图集候选全部核读或交叉排除；没有任何普通事件、军备、战术或银两确认行。
- `tmp/qidahen-card-sheets/` 下的裁切图、候选图册和安全标题预览是本地临时证据，受 `.gitignore` 的 `tmp/` 规则忽略；它们不能作为长期可追溯交付物，只能作为本轮人工录入的本地辅助输入。
- 下一步不再是继续把 49 张或 28 条既有候选归类，而是寻找可追溯逐牌牌表、对非运行时图集来源做可靠 OCR 后人工确认，或找到其他可审计普通手牌录入来源。

## 已核素材

- TTS Workshop JSON：`D:\gongzuo\webgame\gameasset\七大恨 中文mod\Workshop\2228142777.json`
- 规则 PDF：`D:\gongzuo\webgame\gameasset\七大恨 中文mod\七大恨规则.pdf`
  - 已抽取文本并沉淀复核记录：`docs/games/qidahen/records/qidahen-hand-card-rule-pdf-review.md`。
  - 能确认普通手牌的顶层分类和手牌行动规则，但没有普通事件、军备、战术、银两的逐牌牌名、效果或军备目标。
  - 因此它只能作为 2.4 的目标定义依据，不能作为正式规则映射真相源。
- 图集候选：`deckId 13 / 16 / 17`
  - 有正式 `CardID` 与 10x7 图集。
  - JSON 内基本缺逐牌 `Nickname / Description`。
  - 不能直接建立普通 `event / armament / tactic / silver` 的规则级映射。
- 军备对象候选：`deckId 26 / 27 / 28`
  - 分别标成 `大明军备 / 蒙古军备 / 后金军备`。
  - 但它们是 1x1 `CardCustom`，且 `FaceURL = BackURL`。
  - 更像军备状态标记或 checker，不是可打出的普通手牌军备牌真相源。
- 辅助卡候选：`deckId 29 / 30 / 31`
  - 也是 1x1 辅助对象。
  - 不能作为普通手牌牌库。
- TTS 结构化字段复核：
  - 2026-07-02 重新解析 `ObjectStates`、`DeckIDs`、`CustomDeck` 与 `ContainedObjects` 后确认，`deckId 13 / 16 / 17` 对应的正式牌库对象有 10x7 图集和 `CardID` 顺序，但逐牌 `Nickname / Description` 仍为空。
  - 2026-07-03 追加文本交叉核验：TTS `deckId 13 / 16 / 17` 的 `CustomDeck.FaceURL` 哈希分别命中素材接入清单中的 `蒙古牌库图集/整版`、`纪年卡图集/整版`、`朝鲜牌库图集/整版`，而当前运行时正式手牌预览使用的是 `ming-faction-deck-atlas / mongol-faction-deck-atlas / jin-faction-deck-atlas`。因此这些 `DeckIDs` 不能直接当作大明/后金/蒙古普通手牌逐牌真相源。
  - `deckId 26 / 27 / 28` 只有 `后金军备 / 大明军备 / 蒙古军备` 这类 1x1 命名对象；它们可证明军备状态图存在，但不能证明可打出的普通军备手牌。
  - 其他带 `Nickname` 的 TTS 对象主要是积分、辅助卡、骰子、控制标记、部队或地区标记，不是普通事件牌、军备牌、战术牌、银两牌的逐牌规则表。
  - 结论不变：TTS JSON 仍只能作为图集和部分非手牌对象的来源，不能直接补 OpenSpec `2.4` 所需的逐牌中文牌名、牌类、效果和军备目标映射。

## 运行时合同

- `src/games/qidahen/ui/cardAtlas.ts`
  - faction atlas 目前通过 `buildFrames(topXs, leftYs)` 组装预览帧。
  - 当前合同只覆盖顶行 `topXs` 与左列 `leftYs` 的 16 个 preview seam。
  - 这不是三张 10x7 原图的完整 60/70 张逐牌合同。
- `src/games/qidahen/domain/handCardState.ts`
  - 固定 `QIDAHEN_FACTION_HAND_PREVIEW_COUNT = 16`。
  - 通过 `resolveQidahenFormalHandCardIdentity` 只为这些 preview index 补 atlas 中可审计的非行动牌身份。

## 候选裁切结果

本轮已在本地生成候选裁切审计和安全标题预览；这些文件位于 `tmp/` 下，默认不入库。

| 阵营 | 原始候选裁切数 | 可能可读候选数 | 安全标题预览大小 |
| --- | ---: | ---: | ---: |
| 大明 | 70 | 17 | 121,178 bytes |
| 后金 | 60 | 15 | 109,388 bytes |
| 蒙古 | 70 | 17 | 120,680 bytes |

本地临时入口如下，仅用于人工录入时复核：

- `tmp/qidahen-card-sheets/qidahen-card-crop-audit.json`
- `tmp/qidahen-card-sheets/qidahen-card-crop-audit-summary.md`
- `tmp/qidahen-card-sheets/qidahen-readable-candidate-manual-entry.json`
- `tmp/qidahen-card-sheets/qidahen-readable-candidate-manual-entry.md`
- `tmp/qidahen-card-sheets/safe-title-previews/safe-title-preview-index.md`

## 安全读取图片口径

- 不直接反复读取整张 10x7 图集或完整候选图册。
- 默认先使用文件大小、数量、尺寸和索引清单判断是否需要继续。
- 若需要人工读牌，优先使用标题区小预览或单张小裁切。
- 安全标题预览只保留 49 张候选的标题裁切，不包含完整大图。

## 2026-07-02 安全标题批次

- 已把 49 张候选继续拆成单卡标题小裁切，并生成每批最多 6 张的人工录入批次索引。
- 本地入口：`tmp/qidahen-card-sheets/safe-title-previews/per-card/manual-entry-batches.json`。
- 单卡标题小裁切大小约 7,883-11,457 bytes；它们只用于人工读牌，不包含整张候选大图。
- 本机当前没有可直接使用的 `tesseract` 可执行文件；Python OCR 模块也未形成可直接完成中文 OCR 的稳定链路。因此下一步仍是人工 OCR/人工录入，不能自动推进正式规则映射。

## 2026-07-02 OCR 冒烟结果

- 本机没有 `tesseract` 可执行文件；`easyocr` 可导入，但当前只允许先跑标题小裁切样本，不直接读取整张图册。
- 冒烟结果保存在本地临时文件：`tmp/qidahen-card-sheets/safe-title-previews/per-card/easyocr-smoke-result.json`。
- OCR 样本结果只能用于判断“是否值得继续批量 OCR”，不能直接写入正式 `cardKind / cardDefId / armamentId` 映射。

## 2026-07-02 标题 OCR 候选表

- 已对 49 张安全单卡标题裁切运行 EasyOCR，并生成候选摘要：`tmp/qidahen-card-sheets/safe-title-previews/per-card/easyocr-title-candidates-summary.md`。
- OCR 结果经过 mojibake 修复后仍只能作为人工录入优先级排序，不能直接作为正式中文牌名真相源。
- 当前结果只说明有一批标题可进入人工复核；仍没有牌类、效果文本和军备目标映射，因此 OpenSpec `2.4` 继续保持未完成。

## 2026-07-02 人工录入矩阵

- 已把 49 张 OCR 候选整理成可提交的人工录入工作台：`docs/games/qidahen/records/qidahen-hand-card-manual-entry-matrix.md`。
- 矩阵按 EasyOCR 优先级排序：high 16、medium 7、low 19、unreadable 7。
- 后续低分辨率标题预览已完成 49 张候选回填；主矩阵当前没有“待复核”行，也没有任何“已确认”的普通事件、军备、战术或银两行。
- 因此它现在是候选排除证据和人工录入归档，不能作为正式 `cardKind / cardDefId / armamentId` 映射依据。

## 2026-07-02 high 候选核读

- 已为 16 张 high 优先级安全标题小裁切生成放大核读索引：`docs/games/qidahen/records/qidahen-hand-card-high-priority-title-review.md`。
- 本地辅助图册：`tmp/qidahen-card-sheets/safe-title-previews/review-sheets/high-priority-title-review.jpg`，尺寸 840×1440，约 333KB，只包含 16 张标题小裁切的放大版，不是整张 10x7 图集。
- 安全核读结论：high 候选主要是人物/非普通手牌标题，不能补普通事件、军备、战术、银两的逐牌规则映射。
- 因此 high 候选不能推进正式手牌一级入口完成，只能帮助排除一批非普通手牌或后续补人物身份。

## 2026-07-02 medium 候选核读入口

- 已为 7 张 medium 优先级安全标题小裁切生成可提交核读索引：`docs/games/qidahen/records/qidahen-hand-card-medium-priority-title-review.md`。
- 本地辅助图册：`tmp/qidahen-card-sheets/safe-title-previews/review-sheets/medium-priority-title-review.jpg`，约 117KB，只包含 7 张标题小裁切的放大版，不是整张 10x7 图集，也不是完整牌面图。
- 本轮只生成索引和本地辅助图册，没有直接读取 medium 图册进入模型上下文。
- medium 候选仍只是 OCR 排序入口；当前没有人工确认的中文牌名、牌类、效果文本或军备目标，不能补普通事件、军备、战术、银两的逐牌规则映射。

## 2026-07-02 low 候选核读入口

- 已为 19 张 low 优先级安全标题小裁切生成可提交核读索引：`docs/games/qidahen/records/qidahen-hand-card-low-priority-title-review.md`。
- 本地辅助图册：`tmp/qidahen-card-sheets/safe-title-previews/review-sheets/low-priority-title-review.jpg`，约 318KB，只包含 19 张标题小裁切的放大版，不是整张 10x7 图集，也不是完整牌面图。
- 本轮只生成索引和本地辅助图册，没有直接读取 low 图册进入模型上下文。
- low 候选置信度整体较低，OCR 文本错读风险更高；当前没有人工确认的中文牌名、牌类、效果文本或军备目标，不能补普通事件、军备、战术、银两的逐牌规则映射。

## 2026-07-02 unreadable 候选核读入口

- 已为 7 张 unreadable 安全标题小裁切生成可提交核读索引：`docs/games/qidahen/records/qidahen-hand-card-unreadable-title-review.md`。
- 本地辅助图册：`tmp/qidahen-card-sheets/safe-title-previews/review-sheets/unreadable-priority-title-review.jpg`，约 133KB，只包含 7 张标题小裁切的放大版，不是整张 10x7 图集，也不是完整牌面图。
- 本轮只生成索引和本地辅助图册，没有直接读取 unreadable 图册进入模型上下文。
- 这 7 张候选当前 OCR 置信度为 0，不能提供中文牌名、牌类、效果文本或军备目标；只能作为后续外部 OCR 或人工复核入口。

## 2026-07-02 EasyOCR 批量牌面复核

- 已对 49 张候选牌面运行本地 EasyOCR，并把可提交结论沉淀到：`docs/games/qidahen/records/qidahen-hand-card-easyocr-batch-review.md`。
- 本地辅助输出：`tmp/qidahen-card-sheets/full-card-ocr/easyocr-all-readable-candidates.json` 与 `tmp/qidahen-card-sheets/full-card-ocr/easyocr-all-readable-candidates.csv`。
- 批量结果：49 / 49 张候选都有牌面正文 OCR 文本，43 / 49 张候选有标题 OCR 文本。
- OCR 结果已经把候选从“只能看图”推进为“有文本线索可人工录入”，但仍存在明显错读、繁简混杂、异体字/部首误识别和局部英文符号噪音。
- 因此本批 OCR 只能作为人工录入矩阵的辅助文本来源；未逐行人工确认前，仍不能作为中文牌名、牌类、效果或军备目标真相源。

## 2026-07-02 OCR 关键词分流

- 已对 49 张候选 OCR 文本做关键词分流，并把可提交结论沉淀到：`docs/games/qidahen/records/qidahen-hand-card-ocr-keyword-triage.md`。
- 分流结果：普通手牌关键词命中 25 张，人物线索命中 30 张，剧本/纪年线索命中 18 张。
- 25 张普通手牌关键词命中全部同时命中人物或剧本/纪年线索，说明“手牌”“打出”等词大量来自人物效果或纪年卡正文，不能据此判为普通事件、军备、战术或银两牌。
- 当前没有普通关键词独占命中的候选；因此 OCR 分流只能帮助排除误判和安排人工复核优先级，仍不能补齐正式规则映射。

## 2026-07-02 非普通手牌排除候选

- 已基于 OCR 文本生成非普通手牌排除候选清单：`docs/games/qidahen/records/qidahen-hand-card-nonordinary-exclusion-candidates.md`。
- 49 张 OCR 候选中，37 张命中人物或剧本/纪年线索；只命中普通牌类词、且未命中人物/剧本/纪年线索的候选为 0。
- 这份清单是 2026-07-02 的 OCR 分流依据；后续主矩阵和剩余候选低分辨率预览已完成核读回填，相关候选均未形成普通手牌确认行。
- 当前仍没有可直接判为普通事件、军备、战术或银两的候选，不能补齐正式规则映射。

## 2026-07-02 剩余人工复核队列

- 已基于 OCR 文本生成剩余人工复核队列：`docs/games/qidahen/records/qidahen-hand-card-remaining-manual-review-queue.md`。
- 当时队列把 49 张候选缩到 12 张需要后续核读的候选，其中后金 6 张、大明 5 张、蒙古 1 张。
- 后续低分辨率标题预览已经完成 12 张核读：人物牌 5 张、牌背/空白 6 张、不可读/非普通候选 1 张。
- 队列中普通牌类词命中为 0；当前没有任何普通事件、军备、战术或银两确认行。

## 2026-07-02 剩余 12 张二次文本分流

- 已基于 OCR 文本生成剩余 12 张候选的二次分流记录：`docs/games/qidahen/records/qidahen-hand-card-remaining-review-subtriage.md`。
- 二次分流当时结果：疑似人物牌文本 5 张，低信息/疑似牌背或空白 6 张，待看图 1 张。
- 后续低分辨率标题预览已经完成这 12 张核读，并全部排除为人物牌、牌背/空白或不可读/非普通候选。
- 当前仍没有任何一张能直接确认为普通事件、军备、战术或银两牌，OpenSpec `2.4` 继续保持未完成。

## 2026-07-02 最后未分流候选安全 OCR

- 已对最后 1 张当时待看图候选 `mongol_r07_c10` 生成小尺寸安全变体，并记录本地 OCR 结果：`docs/games/qidahen/records/qidahen-hand-card-final-candidate-safe-ocr.md`。
- 本地辅助输出：`tmp/qidahen-card-sheets/final-candidate-safe-review/mongol_r07_c10-safe-variant-index.json` 与 `tmp/qidahen-card-sheets/final-candidate-safe-review/mongol_r07_c10-variant-ocr.json`。
- 原始完整牌面没有直接进入模型上下文；本步骤只由本地脚本生成小尺寸变体并运行本地 OCR。
- OCR 变体没有产生稳定中文牌名、牌类、效果或军备目标；后续标题预览核读也未确认普通手牌身份，`mongol_r07_c10` 已按不可读/非普通候选排除。

## 2026-07-03 人工复核清单

- 已把剩余 12 张候选整理为可提交人工复核清单：`docs/games/qidahen/records/qidahen-hand-card-human-review-checklist.md`。
- 清单最初按“疑似人物牌文本 5 张、低信息/疑似牌背或空白 6 张、待看图 1 张”组织，并列出每张需要人工确认的中文牌名、牌类、规则效果、军备目标和排除原因。
- 后续低分辨率标题预览已完成回填；当前仍没有任何候选达到普通事件、军备、战术或银两的正式规则映射门槛。

## 2026-07-03 外部文本来源搜索

- 已新增外部文本来源搜索记录：`docs/games/qidahen/records/qidahen-hand-card-external-source-search.md`。
- 搜索 `七大恨 事件牌 军备牌 战术牌 银两牌`、`七大恨 卡牌列表 事件牌`、`七大恨 中文mod 牌表`、`Nadan Koro card list event armament tactic silver` 后，结果主要是无关页面或搜索噪音。
- 2026-07-03 追加公开搜索复查 `七大恨 牌表 事件牌 军备牌 战术牌 银两牌`、`七大恨 卡牌列表 事件牌 军备牌`、`Nadan Koro board game cards list` 等关键词，返回摘要仍为无关页面或搜索噪音。
- 本轮没有找到可追溯的外部逐牌牌表，因此不能补普通事件、军备、战术、银两的正式规则映射。

## 2026-07-03 结构化素材来源复查

- 已新增结构化素材来源复查：`docs/games/qidahen/records/qidahen-hand-card-structured-source-recheck.md`。
- 运行时资源清单只命中 `card / deck / atlas / characters` 文件路径层级，没有普通事件、军备、战术、银两的逐牌规则字段。
- TTS JSON 复查确认 164 个 card/deck-like 对象里，正式牌库对象仍只提供 `CardID` 顺序和图集键；牌库内 `Nickname / Description` 为空。
- 命名对象主要是辅助卡、军备状态对象和 `Checker_*`，不能作为可打出的普通军备手牌逐牌表。

## 2026-07-03 本地素材逐牌来源穷尽复查

- 已新增本地素材逐牌真相源穷尽复查：`docs/games/qidahen/records/qidahen-hand-card-local-asset-source-exhaustion.md`。
- 素材目录 `D:\gongzuo\webgame\gameasset\七大恨 中文mod` 只有 62 个 `.jpg`、9 个 `.png`、1 个 `.json` 和 1 个 `.pdf`；未发现额外文本牌表、结构化表格文件或压缩包。
- 后续只读图片文件头与文件名做元数据复查：71 张图片没有任何文件名命中普通手牌牌类关键词，因此也不能从命名线索建立逐牌规则映射。
- 运行时资源 manifest 的 `files` 下有 130 个资源键，其中 30 个 `cards/` 键只覆盖图集、压缩图集、牌背和蒙古人物牌分组，普通手牌牌类关键词命中仍为 0。
- 疑似单卡素材 OCR 小批量试跑也已回写到该文档，并沉淀为长期证据 `docs/games/qidahen/records/qidahen-hand-card-single-card-ocr-probe.md`：33 张候选经 PIL + EasyOCR 试跑后，普通牌类关键词独占命中为 0，混合普通/非普通命中为 0，4 张命中人物或下野等非普通线索，23 张只有低信息 OCR 文本，6 张没有 OCR 文本。
- 2026-07-03 已对 33 张候选补做需求交接式安全读图全量验收，并沉淀到 `test-results/evidence-image-validation/qidahen-formal-handcard-2.4.json` / `.md`：30 张明确排除为人物、牌背、TTS 材质色块、单位或棋子/图标类非普通手牌/非手牌素材，3 张因纯色底块阻塞，没有任何 `passed` 普通事件、军备、战术或银两牌。该结果说明安全读图链路可用，但本批仍没有产出可直接反写的逐牌普通手牌真相源；后续若要重评 2.4，必须先通过 `npm run verify:qidahen:handcards`。
- 仅有的非图片来源仍是规则 PDF 与 TTS Workshop JSON，二者已经在前序复核中证明不能提供普通事件、军备、战术、银两的逐牌中文牌名、牌类、效果和军备目标。
- 因此本地素材目录没有第四条可追溯文本来源来关闭 OpenSpec `2.4`。

## 2026-07-03 完成依据决策矩阵

- 已新增完成依据决策矩阵：`docs/games/qidahen/records/qidahen-hand-card-truth-source-decision-matrix.md`。
- 矩阵把规则 PDF、TTS JSON、运行时资源清单、图集裁切候选、OCR 分流、剩余人工队列、人工复核清单、外部文本搜索和教程注入态逐项判定为“不能关闭 2.4”。
- 当前裁决是：所有已核来源都不能单独或合并作为普通事件、军备、战术、银两的正式逐牌规则映射依据。

## 2026-07-03 正式映射反写契约

- 已新增正式映射反写契约：`docs/games/qidahen/records/qidahen-hand-card-formal-mapping-contract.md`。
- 契约明确人工确认后的结果应落到 `QidahenHandCard.cardKind / cardDefId / armamentId`，军备牌必须落到已有 `QidahenArmamentId`。
- 当前没有任何人工确认行满足反写门槛；该契约只定义未来入口和验收门槛，不代表已经可以修改正式手牌规则映射。
- 已新增只读校验脚本：`scripts/verify/qidahen-hand-card-manual-entry.mjs`。它校验人工录入矩阵、剩余候选复核清单和完整 CardID 人工录入矩阵里的“已确认”行是否满足反写字段门槛，当前无确认行时会明确输出“不允许反写正式手牌规则映射”。

## 2026-07-03 TTS CardID 位置清单

- 已新增 TTS CardID 到图集位置清单：`docs/games/qidahen/records/qidahen-hand-card-tts-cardid-position-map.md`。
- 清单把 TTS `DeckIDs` 转成 `deckId / index / row / col / 出现次数`，便于后续人工录入时回到具体牌面位置。
- 2026-07-03 交叉核验补充：这些 `DeckIDs` 对应的图集哈希命中蒙古、纪年、朝鲜等素材，不等价于当前运行时的大明/后金/蒙古 faction hand preview atlas。
- 该清单只能证明对应 TTS 牌组的图集位置和重复次数，不能提供当前正式手牌的中文牌名、牌类、效果或军备目标，因此不能关闭 `2.4`。

## 2026-07-03 TTS CardID 完整人工录入矩阵

- 已新增完整 CardID 人工录入工作台：`docs/games/qidahen/records/qidahen-hand-card-tts-cardid-full-manual-entry-matrix.md`。
- 矩阵把 TTS `DeckIDs` 的 10 个牌组段展开为 143 行出现记录、99 个唯一图集位置，并保留重复 CardID 的出现次数，便于后续按真实牌组顺序人工录入。
- 后续已将 143 行全部按证据回填为“已排除”：28 条运行时图集候选已安全核读排除，111 条纪年/朝鲜或非正式手牌图集由哈希证据排除，4 条 1x1 `CardCustom` 小牌组对象无牌名、说明、牌类或效果字段。
- 由于 `deckId 13 / 16 / 17` 的文本哈希不等价于当前运行时 faction hand preview atlas，这张完整矩阵只能作为 TTS 牌组复核归档，不能直接作为正式 `cardKind / cardDefId / armamentId` 映射依据，也不能关闭 `2.4`。

## 2026-07-03 运行时图集候选矩阵

- 已新增运行时手牌图集与 TTS 牌组交叉核验：`docs/games/qidahen/records/qidahen-hand-card-runtime-atlas-tts-crosswalk.md`。
- 交叉核验通过文本、JSON、素材 URL 哈希和运行时 atlas id，把真正可能对应正式 faction hand preview atlas 的候选收窄为：
  - 大明：`deckKey 2`，9 条 DeckIDs。
  - 蒙古：`deckKey 13`，14 条 DeckIDs。
  - 后金：`deckKey 15`，5 条 DeckIDs。
- 已新增运行时图集候选人工录入矩阵：`docs/games/qidahen/records/qidahen-hand-card-runtime-atlas-manual-entry-matrix.md`。
- 矩阵共 28 条候选；后续低分辨率安全预览已全部核读并排除为人物牌、纪年/剧本类牌或人物效果相关非普通牌。
- 因此本矩阵只能作为运行时图集候选被证伪的归档证据；不得反写正式手牌规则映射，也不能关闭 `2.4`。
- 已新增运行时图集候选安全复核入口说明：`docs/games/qidahen/records/qidahen-hand-card-runtime-atlas-safe-review.md`。本地脚本只生成 28 条候选的小尺寸缩略图与标题裁切索引，供人工读牌/OCR 使用；这仍不是逐牌真相源。
- 已新增运行时图集候选小图 OCR 尝试记录：`docs/games/qidahen/records/qidahen-hand-card-runtime-atlas-ocr-attempt.md`。EasyOCR 失败是阻塞证据；后续低分辨率安全预览已经完成候选核读，仍不能作为正式真相源。
- 已新增运行时图集候选与既有 OCR 线索交叉表：`docs/games/qidahen/records/qidahen-hand-card-runtime-atlas-existing-ocr-crosswalk.md`。28 条候选全部命中既有 OCR/核读线索；后续安全预览已全部排除，不能作为正式真相源。

## 下一步门槛

只有满足以下任一条件，才能继续推进 OpenSpec `2.4`：

- 找到可追溯的逐牌牌表，包含中文牌名、牌类、效果和军备目标。
- 完成人工 OCR/人工录入，并把 49 张 OCR 候选或 28 张运行时图集候选逐项归类为 `event / armament / tactic / silver / 非普通手牌 / 不可读`。
- 对能确认的普通军备牌补齐 `armamentId`，对事件/战术/银两补齐规则效果或可执行的最小规则合同。

未满足前，不得把局部已识别牌、教程注入态或本地候选图册当作正式手牌一级入口闭环。
