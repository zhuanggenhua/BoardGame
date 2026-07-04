# 七大恨一级交互审查表

> 目的：先把“玩家第一层到底在决定什么、第二层才决定什么、哪些 UI 只是提示”锁清，再决定教程和正式 UI 怎么改。  
> 当前文档是运行态真相源：每次源码改动后必须同步回写，不能拿旧结论继续指导实现。
> 规则真相源：`src/games/qidahen/rule/七大恨规则.md`。  
> 当前实现真相源：`src/games/qidahen/Board.tsx`、`src/games/qidahen/tutorial.ts`、`src/games/qidahen/domain/regionSelectionReducer.ts`、`src/games/qidahen/domain/turnActionInteractionBuilders.ts`。

## 全交互审查来源门禁

- 本表不得从几张教程截图或 E2E 成功链倒推交互全集。
- 每轮继续审查时必须同时看：
  - 规则书同层动作
  - `QidahenCore.turnPhase` 与关键选择状态
  - `QidahenCommand / QidahenEvent`
  - selection / dispatch builder
  - reducer 与 action resolution
  - 当前 E2E 入口与截图
- 每个交互行必须拆开：
  - 真实承接物：按钮、手牌、地图区域、轮盘格、列表项或系统交互入口
  - 提示 UI：横幅、步骤卡、摘要、状态条、地图短提示
- 只有提示 UI、没有真实承接物的一行，必须标为“承接物未锁定”，不得进入实现或收口口径。

## 当前结论

- 规则书定义的回合骨架是：`检查手牌上限 -> 转动轮盘 -> 执行一次手牌行动及轮盘行动，顺序由玩家自行决定`。
- 当前正式页已新增一条真实收口：动作栏默认聚焦不再用“已确认/已锁定”的强确认视觉呈现，只有进入支付预览或正式执行后才升到强确认态。
- 因此，玩家进入正式主循环后的**一级决策**，不是“先选地区”，而是：
  - 先怎样转轮盘
  - 在手牌行动与轮盘行动里先做哪一个
  - 手牌行动内部再决定是 `执行事件`、`升级军备` 还是 `势力行动`
  - 进入某个具体行动后，再决定目标地区、支付对象或后续选项
- 当前正式 UI 表层并不是完全“只能先选地区”：
  - 右侧势力行动按钮本身可直接点击
  - 轮盘行动格本身可直接点击
- 当前正式进行页的截图证据链已经纠偏：
  - 正式页截图统一改回测试态正式棋盘入口 `/play/qidahen?tutorialSetup=basic-opening`
  - 不再使用 `/play/qidahen/tutorial/...` 路由截图来判断正式进行页 UI
  - 已重新核到的正式页图里，底部教程白色 `下一步` 卡不再出现
- 但当前正式 UI **没有完整暴露规则书定义的手牌行动全集**：
  - `执行事件` 还没有对正式开局大多数手牌形成稳定一级入口
  - `升级军备` 已从右侧势力行动按钮列拆出，只能由**已识别**军备牌手牌本体直接进入正式动作预览
  - 手牌区虽然已能让**已识别**军备牌/事件牌直接进入正式动作预览，但正式开局仍缺普通事件牌/军备牌真相源，不能稳定承担规则书意义上的“直接打出哪张手牌”
- 当前地区状态已完成一层持久语义拆分：`regionFocusState` 明确承接默认聚焦、已锁来源、当前目标和展示锚点；`selectedRegionId` 继续作为兼容的屏幕焦点入口，但不再是后续来源区、目标区和展示锚点的唯一真相源。
- 当前基础教程虽然已经不再把 `select-region` 写成独立第一步，但教程体系与正式进行页之间仍有两层问题：
  - 基础章当前只稳定示范了 `势力行动 + 轮盘行动`
  - 教程隐藏续章能示范 `升级军备 / 事件行动`，但这不等于正式局已经具备规则书口径的手牌一级入口
- 当前教程截图链已在 2026-07-02 回跑到 46 张，新增验证点包括：
  - 攻城、外交、年中、新年这些 `highlightTarget = qidahen-season-summary` 的信息步骤会显示真实结算摘要，而不是被前景交互面板压掉。
  - 年中/新年教程按真实行动座位切换视角；新年防线维护由大明座位的真实维护按钮承接，不再靠测试旁路命令顶替。E2E 已补核心状态断言：年中后三方战败标记归零；新年后蒙古支付手牌获得本年纪年卡并威望 +1；年份推进到天命五年 1620，纪年卡区刷新，大明新年人物进入出场状态。
  - 朝鲜章节已覆盖朝鲜朝贡后的牌库/弃牌堆、朝鲜区人口为 0 的核心状态断言、朝鲜耗损摘要结果，以及新年摘要中的“非朝鲜区域”控制区统计；水路已由 `water-dispatch` 隐藏续章补真实调度入口：大明骑兵调度从皮岛通过海岸/水路解围东江，同时展示 `皮岛 → 东江 → 登莱` 的纯水路续航候选，并确认陆路后续目标不会进入玩家候选。
  - 攻城章节已把 `守城宣告` 从说明态改为真实按钮入口：城市被攻击前会出现 `守城避战 / 出城野战`，点击 `守城避战` 后才进入城战待结算；骑兵城战减值已由真实城战摘要承接。E2E 已补围城后核心状态断言：山海关仍由后金控制，城内人口状态保留，大明只成为外围围城方；`31a-攻城第3步-同章选择占领该区.png` 已补同章占领对照，证明攻下城市后选择占领会把山海关控制权改为大明，并清空城内状态与围城状态。
  - 外交章节已把 `友好标记 / 翻为附庸 / 移除他方控制标记` 都改为真实操作步骤；`33b-外交第2b步-移除他方控制标记.jpg` 已证明东江目标与 `移除控制标记` 按钮由真实外交面板承接。
- 当前应判定为：**教程有问题，正式流程交互建模也有问题；不能只改教程。**

## 当前正式阻塞

- 当前仍不能把七大恨正式局说成“规则书级手牌一级入口已具备”。
- 阻塞不再是“完全没有普通手牌图集或确认行”：2026-07-04 已确认 atlas05 是普通手牌图集，并把 45 张 `passed` 普通手牌接入正式发牌/预览流。但这只是局部接入，仍不是完整普通手牌全集真相源：
  - `src/games/qidahen/domain/handCardState.ts`
    - 正式局初始手牌与摸牌现在按 atlas05 的 45 张已确认普通手牌连续发放，并引用 `qidahen:atlas05-ordinary-hand-preview`。
    - 运行态手牌 `label` 已使用 atlas05 人工确认中文牌名，而不是继续显示“大明/后金/蒙古 手牌 N”占位名；放大预览、无障碍标签与战术牌结算摘要会直接复用这些中文牌名。
    - 运行态手牌 `rulesSummary` 已携带 45 张已确认牌的规则效果摘要，作为人工录入矩阵反写后的可审计说明字段；这只是把真相源带入手牌对象，不等于完整实现事件效果全集、战术时机或银两资源链。
  - `src/games/qidahen/domain/handCardIdentity.ts`
    - `resolveQidahenAtlas05OrdinaryHandCardIdentity(atlasIndex)` 只解析人工确认的 45 张 `event / armament / tactic`，并返回对应中文牌名、牌类、`cardDefId / armamentId` 与规则效果摘要；未确认、blocked 行不入正式运行时。
    - `resolveQidahenFormalHandCardIdentity(factionId, previewIndex)` 仍保留旧 16-frame faction preview seam 的最小身份解析，供旧合同和排障对照使用。
    - 当前仍未能建立普通 `event / armament / tactic / silver` 牌的完整全集映射；银两目前没有满足正式反写门槛。2026-07-04 已用 161KB 完整 10x7 网格邻格诊断图复核最后 3 张 blocked：idx25 / idx44 只是银两图形，idx48 仍是边缘窄条，均不能进入正式运行时。
  - `src/games/qidahen/domain/initialCoreSetup.ts`
    - 正式开局会消费 atlas05 45 张普通手牌确认行；这证明“可反写确认行”已经进入运行时，但不证明整副普通手牌全集完成。
  - `src/games/qidahen/tutorialSetup.ts`
    - 只有教程注入态会手动补 `event / armament / tactic / silver`
  - `temp/qidahen-hand-sheets/*.png`
    - 已核图可直接看到：
      - `ming-sheet.png` 前排主要是人物牌，如熊廷弼、孙承宗、孙元化、毛文龙、杨镐、高第、王化贞
      - `mongol-sheet.png` 前几张混入剧本卡 `丁卯胡乱 / 萨尔浒战后 / 山海关之议`，后面大面积是纪年卡
      - `jin-sheet.png` 前几张是人物牌，后几张直接是牌背
  - `D:\gongzuo\webgame\gameasset\七大恨 中文mod\Images`
    - 原始素材目录继续核过一遍，没有发现另一组单独命名、可直接认作 `事件 / 军备 / 战术 / 银两` 的普通手牌资源文件
- 2026-07-02 已进一步核验 TTS Workshop 素材：
  - `D:\gongzuo\webgame\gameasset\七大恨 中文mod\Workshop\2228142777.json`
    - `deckId 13 / 16 / 17` 确实有正式 `CardID` 与 10x7 图集，但 JSON 内卡对象基本没有逐牌 `Nickname / Description`，不能从这里直接建立普通 `event / armament / tactic / silver` 的规则级映射。
    - `deckId 26 / 27 / 28` 分别标成 `大明军备 / 蒙古军备 / 后金军备`，但它们是 1x1 `CardCustom`，且 `FaceURL = BackURL`，更像军备状态标记或 checker，不是可打出的手牌军备牌真相源。
    - `deckId 29 / 30 / 31` 是辅助卡，1x1，也不能当普通手牌牌库。
- 2026-07-03 已进一步核验规则 PDF：
  - `D:\gongzuo\webgame\gameasset\七大恨 中文mod\七大恨规则.pdf`
    - 已抽取 13,054 字文本并沉淀为 `docs/games/qidahen/workflows/qidahen-hand-card-rule-pdf-review.md`。
    - 规则 PDF 能确认普通手牌分成军备牌、事件牌、战术牌、银两牌，以及手牌行动包含执行事件、升级军备、势力行动。
    - 但它没有提供逐张普通事件、军备、战术、银两牌的中文牌名、效果或军备目标，因此只能定义目标口径，不能关闭正式手牌真相源缺口。
- 2026-07-02 已重新做 TTS 结构化字段复核：
  - `deckId 13 / 16 / 17` 的正式牌库对象有 10x7 图集合同和 `CardID` 顺序，但 `ContainedObjects` 逐牌 `Nickname / Description` 仍为空。
  - `deckId 26 / 27 / 28` 的命名军备对象仍只是 1x1 状态图来源，不是可打出的普通军备手牌。
  - 其他带 `Nickname` 的 TTS 对象主要是积分、辅助卡、骰子、控制标记、部队或地区标记，不能作为普通事件、军备、战术、银两逐牌规则表。
- 2026-07-02 已进一步生成裁切候选审计：
  - `docs/games/qidahen/workflows/qidahen-hand-card-truth-source-candidates.md`
    - 已把本轮普通手牌候选审计整理成可提交的长期入口。
    - 结论是：大明 70 张裁切中 17 张可能可读，后金 60 张中 15 张可能可读，蒙古 70 张中 17 张可能可读。
    - 已按安全读取图片口径生成标题区小预览，只保留 49 张候选的标题裁切；`tmp/` 下裁切图、候选图册和安全标题预览只作为本地辅助输入，不作为长期交付物。
    - 这些候选只用于人工读牌与补真相表；未录入前不得把候选自动写进正式 `event / armament / tactic / silver` 规则映射。
    - EasyOCR 已对 49 张安全标题裁切跑出候选优先级：high 16、medium 7、low 19、unreadable 7；但样本中存在明显错读，OCR 结果只能用于人工录入排序，不能直接写入正式规则映射。
    - high 核读索引已沉淀为 `docs/games/qidahen/workflows/qidahen-hand-card-high-priority-title-review.md`，结论是 high 候选主要是人物/非普通手牌标题，不能补普通事件、军备、战术、银两映射。
    - medium 核读入口已沉淀为 `docs/games/qidahen/workflows/qidahen-hand-card-medium-priority-title-review.md`，只整理 7 张安全标题小裁切及本地辅助图册；当前仍没有人工确认的中文牌名、牌类、效果或军备目标。
    - low 核读入口已沉淀为 `docs/games/qidahen/workflows/qidahen-hand-card-low-priority-title-review.md`，只整理 19 张安全标题小裁切及本地辅助图册；该批 OCR 置信度更低、错读风险更高，仍不能作为正式规则映射依据。
    - unreadable 核读入口已沉淀为 `docs/games/qidahen/workflows/qidahen-hand-card-unreadable-title-review.md`，只整理 7 张安全标题小裁切及本地辅助图册；该批 OCR 置信度为 0，只能留作外部 OCR 或人工复核入口。
    - EasyOCR 批量牌面复核已沉淀为 `docs/games/qidahen/workflows/qidahen-hand-card-easyocr-batch-review.md`；49 张候选均有牌面正文 OCR 文本，43 张有标题 OCR 文本，但仍存在明显错读，只能作为人工录入辅助，不能自动写入正式规则映射。
    - OCR 关键词分流已沉淀为 `docs/games/qidahen/workflows/qidahen-hand-card-ocr-keyword-triage.md`；25 张普通手牌关键词命中全部同时命中人物或剧本/纪年线索，没有普通关键词独占候选，因此不能据“手牌/打出”等词自动判为普通事件、军备、战术或银两牌。
    - 非普通手牌排除候选已沉淀为 `docs/games/qidahen/workflows/qidahen-hand-card-nonordinary-exclusion-candidates.md`；37 张候选命中人物或剧本/纪年线索，普通牌类词独占命中为 0，只能缩小人工复核范围，不能替代人工确认。
    - 剩余人工复核队列已沉淀为 `docs/games/qidahen/workflows/qidahen-hand-card-remaining-manual-review-queue.md`；当前把 49 张候选缩到 12 张仍需人工确认的候选，但这些候选没有普通牌类词命中，不能自动判为普通事件、军备、战术或银两牌。
    - 剩余 12 张二次文本分流已沉淀为 `docs/games/qidahen/workflows/qidahen-hand-card-remaining-review-subtriage.md`；其中 5 张疑似人物牌文本、6 张低信息/疑似牌背或空白、1 张仍需人工看图，仍没有可直接确认为普通事件、军备、战术或银两的候选。
    - 2026-07-03 已对主矩阵剩余 11 张待复核候选读取单张低分辨率安全标题预览并回填：阿敏、额亦都、皇太极、范文程、努尔哈赤、王化贞、高第、萨囊彻辰均为人物牌标题，蒙古低置信候选为纪年/剧本类牌；至此 49 张 OCR 候选主矩阵没有任何普通事件、军备、战术或银两确认行。
    - 最后未分流候选安全 OCR 已沉淀为 `docs/games/qidahen/workflows/qidahen-hand-card-final-candidate-safe-ocr.md`；`mongol_r07_c10` 的小尺寸变体 OCR 仍没有稳定中文牌名、牌类、效果或军备目标，只能保留为人工看图或外部 OCR 候选。
    - 剩余候选人工复核清单已沉淀为 `docs/games/qidahen/workflows/qidahen-hand-card-human-review-checklist.md`；它把 12 张候选的人工确认字段固定为中文牌名、牌类、规则效果、军备目标和排除原因，但当前仍没有任何行达到正式规则映射门槛。
    - 外部文本来源搜索已沉淀为 `docs/games/qidahen/workflows/qidahen-hand-card-external-source-search.md`；多轮公开搜索已经覆盖中英文泛词、牌表词、牌类词，以及“大汗令箭 / 火炮技术”等精确词，仍没有找到可追溯逐牌牌表，命中结果主要是百科、单词、歌曲、知乎/无关页面或搜索噪音。
    - 结构化素材来源复查已沉淀为 `docs/games/qidahen/workflows/qidahen-hand-card-structured-source-recheck.md`；运行时资源清单只有资源路径层级，TTS JSON 仍只有 CardID 顺序、图集键、辅助卡和军备状态对象名称，不能提供普通事件、军备、战术、银两逐牌规则字段。
    - 本地素材逐牌来源旧复查已沉淀为 `docs/games/qidahen/workflows/qidahen-hand-card-local-asset-source-exhaustion.md`；但该结论只覆盖当时的单卡候选、旧 preview seam 和结构化文本来源，不再能概括完整 `Images` 目录。2026-07-04 重新利用完整 `Images` 后，已确认 atlas05 是普通手牌图集；当前口径应改为“已有普通手牌图集、45 张确认行和正式运行时接入，但全集、银两和部分行动语义仍未闭环”。
    - 疑似单卡素材 OCR 小批量试跑已沉淀到 `docs/games/qidahen/workflows/qidahen-hand-card-single-card-ocr-probe.md`；33 张候选经 PIL + EasyOCR 试跑后，普通牌类关键词独占命中为 0，混合普通/非普通命中为 0，4 张命中人物或下野等非普通线索，23 张只有低信息 OCR 文本，6 张没有 OCR 文本；后续按需求交接式安全读图流程验收全部 33 张候选，得到 30 张非普通手牌/非手牌素材排除和 3 张纯色底块阻塞；本批没有产生可反写正式手牌规则映射的逐牌真相源。
    - 完成依据决策矩阵已沉淀为 `docs/games/qidahen/workflows/qidahen-hand-card-truth-source-decision-matrix.md`；当前所有已核来源都被判定为不能单独或合并关闭 `2.4`。
    - 正式映射反写契约已沉淀为 `docs/games/qidahen/workflows/qidahen-hand-card-formal-mapping-contract.md`；它只规定人工确认后如何落到 `cardKind / cardDefId / armamentId` 和 `QidahenArmamentId`，2026-07-04 之前没有确认行可反写；当前 atlas05 已有 45 张确认行，下一步应继续按该契约接入正式映射。
    - `npm run verify:qidahen:handcards` 已沉淀为普通手牌真相源门禁入口：先校验 `test-results/evidence-image-validation/qidahen-formal-handcard-2.4.json`，再校验人工录入矩阵反写门槛。2026-07-04 当前图片验收输出 `passed=45 / failed=0 / blocked=3 / partial=0`，人工录入反写校验输出“已确认行数：45”；这证明完整 `Images` 目录中的 atlas05 已经产生可反写的普通手牌真相源，但尚不足以勾选 OpenSpec `2.4 / 4.5`。
    - 人工录入反写校验脚本已沉淀为 `scripts/verify/qidahen-hand-card-manual-entry.mjs`；它覆盖 49 张 OCR 候选人工录入矩阵、12 张剩余候选复核清单、完整 CardID 人工录入矩阵、运行时图集候选人工录入矩阵，以及 2026-07-04 新增的 atlas05 普通手牌人工录入矩阵。当前脚本已校验 atlas05 的 45 张确认行，能检查中文牌名、牌类、规则效果摘要和军备目标是否满足反写门槛。
    - TTS CardID 位置清单已沉淀为 `docs/games/qidahen/workflows/qidahen-hand-card-tts-cardid-position-map.md`；它只能提供 `deckId / index / row / col / 出现次数`，不能提供牌名、牌类、效果或军备目标；2026-07-03 交叉核验还确认 `deckId 13 / 16 / 17` 的图集哈希分别命中蒙古、纪年、朝鲜整版图集，不等价于当前运行时正式手牌预览使用的三套 faction atlas。
    - TTS CardID 完整人工录入矩阵已沉淀为 `docs/games/qidahen/workflows/qidahen-hand-card-tts-cardid-full-manual-entry-matrix.md`；它把 10 个牌组段展开为 143 行出现记录、99 个唯一图集位置，后续已按哈希交叉证据和低分辨率安全核读结果全部回填为“已排除”，只能作为 TTS 牌组复核归档，不能作为正式规则映射依据。
    - 2026-07-03 已继续回填 TTS CardID 完整人工录入矩阵：143 行全部按已有证据排除，其中 28 条运行时图集候选已安全核读排除，111 条纪年/朝鲜或非正式手牌图集由哈希证据排除，4 条 1x1 `CardCustom` 小牌组对象没有牌名、说明、牌类或效果字段；仍没有普通事件、军备、战术或银两确认行。
    - 运行时图集交叉核验与候选人工录入矩阵已沉淀为 `docs/games/qidahen/workflows/qidahen-hand-card-runtime-atlas-tts-crosswalk.md` 和 `docs/games/qidahen/workflows/qidahen-hand-card-runtime-atlas-manual-entry-matrix.md`；它把可能命中正式 faction hand preview atlas 的候选收窄为大明 9、蒙古 14、后金 5，共 28 条；2026-07-03 已通过低分辨率安全预览完成全部 28 条核读并全部排除为人物牌、纪年/剧本类牌或人物效果相关非普通牌，不能作为普通事件、军备、战术或银两真相源。
    - 运行时图集候选安全复核入口已沉淀为 `docs/games/qidahen/workflows/qidahen-hand-card-runtime-atlas-safe-review.md`；本地脚本只生成 28 条候选的小尺寸缩略图与标题裁切索引，避免直接读取大图，但这仍只是人工/OCR 入口，不是正式规则映射。
    - 运行时图集候选小图 OCR 尝试已沉淀为 `docs/games/qidahen/workflows/qidahen-hand-card-runtime-atlas-ocr-attempt.md`；本轮定位到路径编码与内存/显存不足问题，未获得稳定逐牌 OCR 结果，后续改用低分辨率安全预览逐批核读。
    - 运行时图集候选与既有 OCR 线索交叉表已沉淀为 `docs/games/qidahen/workflows/qidahen-hand-card-runtime-atlas-existing-ocr-crosswalk.md`；`docs/games/qidahen/workflows/qidahen-hand-card-runtime-atlas-priority-review.md` 已记录 28 条候选的逐批安全预览核读结果，所有候选均已排除，且没有任何行达到人工确认反写门槛。
- 因此当前正式局已修正“可证明非行动牌仍是 unknown 壳”的问题，并且 atlas05 已提供普通手牌抽样真相源；45 张已确认普通手牌已经进入正式发牌/摸牌、预览流与运行态规则摘要字段。但正式运行态仍不具备：
  - 按规则书直接打出哪张事件牌
  - 按规则书直接打出哪张军备牌
  - 以真实手牌对象承接一级手牌行动入口
- 在这层手牌规则真相补齐前：
  - `执行事件` 仍然只能判定为正式一级入口缺口
  - `升级军备` 已去掉抽象势力行动按钮，但仍只能判定为已识别军备牌的局部真实入口
  - 任何“正式局已经能从真实手牌直接打牌”的口径都不成立
- OpenSpec `2.4` 不得因为 atlas05 已有 45 张确认行、领域层解析函数和正式发牌/预览接入而勾选；当前核验结论是“普通手牌真相源与局部运行时接入已打开缺口，但事件效果全集、战术时机和银两资源链仍未完成”，不是“正式手牌入口已完成”

## 规则骨架

### 回合主循环

规则原文明确写的是：

1. 检查手牌是否超过上限。
2. 转动轮盘，决定其他玩家是否抽牌。
3. 执行一次手牌行动及轮盘行动，执行顺序由玩家自行决定。

这意味着：

- `转轮盘` 是主循环中的前置公共推进，不是轮盘行动本身。
- `手牌行动` 与 `轮盘行动` 是同层一级行动。
- `手牌行动` 内部还要先区分：
  - `执行事件`
  - `升级军备`
  - `势力行动`
- `地区目标`、`支付对象`、`建军方式`、`围城/占领` 这类，都属于进入一级行动后的后续步骤。

## 规则书同层一级行动全集

> 这一段专门补齐“不能只按当前显眼入口抽样”的缺口。

在规则书口径下，当前主循环里玩家同层会遇到的一级入口至少有：

1. `手牌上限弃牌`
2. `轮盘推进`
3. `执行事件`
4. `升级军备`
5. `势力行动`
6. `轮盘行动`

其中：

- `执行事件 / 升级军备 / 势力行动`
  - 是 `手牌行动` 这一层里的三个并列一级入口
- `征召军队 / 赐印招安 / 大汗令箭 / 马市贸易 / 联姻诱降 / 驱虎吞狼`
  - 则是进入 `势力行动` 之后的下一层
- `地图地区 / 支付对象 / 候选目标`
  - 更是进入具体行动后的二级目标或执行对象

所以只审：

- 右侧势力行动按钮
- 地图目标选择
- 轮盘进攻调度

还不够；因为它漏掉了规则书里同层存在的：

- `执行事件`
- `升级军备`

## 正式进行页一级入口核对表

> 这一张专门回答：如果不看教程、不看实现计划，只看当前正式进行页，规则书同层一级动作现在分别是什么状态。

| 规则书一级动作 | 当前正式进行页入口 | 真正承接点击的对象 | 当前状态 | 证据与说明 |
| :--- | :--- | :--- | :--- | :--- |
| 手牌上限弃牌 | 手牌区 + 弃牌提交控件 | 手牌本体、提交按钮 | 真实可用 | 进入 `hand-limit-discard` 后直接选牌弃置；不是地区先行 |
| 轮盘推进 | 轮盘本体 | 轮盘格 | 真实可用 | 横幅只是提示；真实点击在轮盘格 |
| 执行事件 | 已识别事件牌可由手牌本体进入正式动作预览 | 已识别事件手牌本体 | 局部真实可用 | 当前只对少量已识别事件牌成立；正式开局大多数手牌仍是低保真预览，不能稳定承接“打出哪张事件牌” |
| 升级军备 | 已识别军备牌由手牌本体进入正式动作预览；无已识别军备牌时不再提供右侧抽象 `upgrade-armament` 按钮 | 已识别军备手牌本体 | 局部真实可用 | 当前已避免“同一动作同时出现手牌直点入口和右侧重复主入口”；但普通军备牌真相源仍缺，整体仍不是规则书口径的“打出军备牌，再弃 1 张” |
| 势力行动 | 右侧行动按钮列 | 行动按钮 | 真实可用 | 但它只覆盖手牌行动全集里的 `势力行动` 这一支 |
| 轮盘行动 | 轮盘推进后的轮盘分支 | 轮盘格、地图目标、后续按钮 | 真实可用 | 进入后再选目标区或待结算对象；不是先选地区 |

### 当前收口裁决

- 不能把当前正式局说成“规则书一级入口已完整实现”。
- 目前只能说：
  - `手牌上限弃牌 / 轮盘推进 / 势力行动 / 轮盘行动` 已有正式入口
  - `升级军备` 已接上局部真实手牌入口，但整体仍受低保真手牌限制
  - `执行事件` 已接上局部真实手牌入口，但整体仍未形成规则书级稳定入口
- 因此，任何“新游戏收工 / 正式流程完整 / 教程已经证明正式局怎么运作”的口径，都必须继续保留这两个正式缺口：
  - `执行事件` 只对已识别事件手牌成立，未形成稳定正式映射
  - `升级军备` 只对已识别军备牌成立，整体仍不是规则书原始入口

## 首回合真实动作顺序表

> 这一张专门回答：如果玩家从正式局当前主入口进入，首回合到底应该先理解哪一层动作，哪些只是后续目标或支付。

| 规则书顺序 | 当前正式局先暴露的真实对象 | 当前层级 | 默认预选/默认高亮语义 | 当前状态 | 审计结论 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 检查手牌上限 | 手牌区、弃牌提交控件 | 一级公共推进 | 若进入该阶段，手牌高亮只是待弃候选，不是地区先行 | 真实可用 | 这里的第一步是弃牌，不是先选地图区 |
| 转动轮盘 | 轮盘本体、可点轮盘格 | 一级公共推进 | `selectedWheelMoveId` 只是默认聚焦；玩家未点前不算已决定走哪格 | 真实可用 | 顶部轮盘横幅只是提示，真实入口是轮盘格 |
| 决定先做哪类主行动 | 当前正式局会暴露两类主行动语义：手牌行动侧的动作入口，以及轮盘行动侧的轮盘分支入口 | 一级动作层 | 默认聚焦只属便捷起点，不等于玩家已决定先做哪一类 | 部分真实可用 | 这一步先决定动作层，不是先决定地区 |
| 手牌行动内部先分支 | 右侧动作按钮列当前稳定暴露 `势力行动`；已识别军备牌/事件牌由手牌本体直入预览 | 一级动作层内部并列分支 | `selectedActionId` 只是默认聚焦；进入支付预览前不等于正式确认 | `势力行动` 真实可用；`升级军备 / 执行事件` 为局部真实可用；整体仍有缺口 | 教程不得把这里写成“先选地区”；也不能把局部 seam 误报成规则书完整原入口 |
| 锁定具体行动后支付或选目标 | 手牌、地图候选、右侧后续选择卡 | 二级目标 / 支付 / 确认 | `selectedRegionId` 常只是默认焦点；若来源已锁，则后续地图焦点不应反写来源 | 真实可用但建模混用 | 到这里才轮到支付、地图目标或来源区；不应再被教成首个正式决策入口 |
| 轮盘行动进入后选目标或待结算对象 | 轮盘格后的地图高亮目标、待结算卡、战后选择项 | 二级目标 / 待结算 / 收口 | 默认来源区或默认目标区只是弱聚焦，不等于玩家已确认 | 真实可用但默认预选混用 | 轮盘行动应先轮盘、后目标；地图阶段不能反写成重新选来源 |

## 一级交互审查表

| 场景 | 规则书先要求玩家决定什么 | 当前正式 UI 一级入口 | 当前后续目标/二级步骤 | 当前真实承接物 | 哪些 UI 只是提示 | 审查结论 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 回合开始 | 是否弃到手牌上限 | 手牌弃牌流程 | 选哪些牌弃掉 | 手牌本体 / 提交 | 说明文案、提示卡 | 合理，一级入口不是地区 |
| 转动轮盘 | 走 1/2/3 格 | 轮盘格可直接点 | 无或之后进入轮盘分支 | 轮盘可点格 | 顶部轮盘横幅 | 合理，横幅应只是提示 |
| 执行事件 | 先决定打出哪张事件牌 | 已识别事件牌可由手牌本体直入预览 | 牌面效果自身决定后续目标/结算 | 已识别事件手牌本体；未识别手牌仍无稳定入口 | 顶部行动横幅、右侧步骤卡 | **部分收口但仍有缺口**：规则层这一入口已接上局部真实 seam，但正式开局还没稳定暴露给大多数手牌 |
| 升级军备 | 先决定打出哪张军备牌，再弃 1 张手牌 | 已识别军备牌会由手牌本体直入预览；无已识别军备牌时不再提供右侧抽象入口 | 再弃 1 张手牌、再落到军备升级结果 | 已识别军备手牌本体 | 顶部行动横幅、右侧步骤卡 | **部分收口但仍有缺口**：已识别军备牌已接上真实承接物，但普通军备牌真相源仍缺 |
| 势力行动 | 先决定是否走势力行动，以及走哪一种势力行动 | 右侧行动按钮列 | 某些行动之后才选地区/支付 | 行动按钮 | 顶部行动横幅 | 右侧按钮承接合理，但它只覆盖了手牌行动全集里的其中一支 |
| 赐印招安 | 先选手牌行动，再支付并指定效果对象 | 行动按钮 `grant-pardon` | 支付 3 张，再指定受影响区域/部队 | 按钮、支付牌、地图目标 | 步骤提示/状态条 | 当前教程教反了，先教成选地区 |
| 征召军队 | 先进入该行动 | 行动按钮 `recruit` | 某地区建军、再选建军方式 | 行动按钮、地图、后续选项 | interaction subtitle | 当前文案泄露“先选地区”心智 |
| 马市贸易 | 先进入该行动 | 行动按钮 `ma-shi-trade` | 地区与建军数量 | 行动按钮、地图、后续选项 | interaction subtitle | 当前文案泄露“先选地区”心智 |
| 大汗令箭 | 先进入该行动 | 行动按钮 `khan-edict` | 地区与执行哪种免付效果 | 行动按钮、地图、后续选项 | interaction subtitle | 当前文案泄露“先选地区”心智 |
| 轮盘进攻/调度 | 先完成轮盘推进，再进入对应轮盘行动 | 轮盘格/轮盘移动入口 | 之后才选目标地区、来源地区、待结算目标 | 轮盘格、地图可点目标 | 顶部轮盘横幅、地图状态词 | 合理的交互应是“先轮盘，后目标” |
| 王化贞/高第等地图调度 | 先进入该效果 | 高第先选弃牌，王化贞可直接进入地图目标 | 高第等待弃牌时地图改区只重建来源候选，不反写当前持久焦点；高第弃牌后再选目标；王化贞直接选目标地区 | 高第先由手牌承接，王化贞由地图高亮目标承接 | 顶部短提示 | 已拆出两条合同：高第不是先点地图，王化贞才是直点地图；高第等待态已记录显式点击 `explicitRegionId`，但保留原 `selectedRegionId` |
| 攻城/围城 | 先对待结算结果做选择 | 战后/城战选择项 | 再进入围城或占领结果 | 选择按钮 | 横幅/状态条 | 合理，横幅不应承接点击 |

## 当前明确教反的地方

### 1. 基础教程顺序写反

- 当前 `tutorial.ts` 基础章已经改成：
  - `pick-action`
  - `pay-cards`
  - `action-result`
  - `wheel-action`
- 也就是不再把“先选地区”写成独立首步。
- 但当前教程体系仍未把规则书同层的一级动作完整教清：
  - `basic-opening` 只稳定示范 `势力行动 + 轮盘行动`
  - `升级军备 / 事件行动` 被拆到隐藏技术续章
  - 玩家从目录第一章看完，仍看不出“手牌行动全集”和“正式局一级入口全集”之间的差距
- 所以当前问题已经不是“还在把 select-region 放前面”，而是：
  - 基础章覆盖仍不足以代表完整首回合
  - 教程示范链与正式进行页一级入口状态仍需分开标注

### 2. 若干 interaction subtitle 在泄露错误心智

当前这些文案都在强化“先选地区”：

- `准备在 {{地区}} 建军 · 也可先换别的己方区域`
- `准备在 {{地区}} 执行 · 也可先换地图区域`

这些句子的问题不是文案长短，而是它们把：

- 一级动作入口
- 和
- 进入动作后的目标地区选择

混成了同一层。

### 3. 形式上可先点动作，结构上却强依赖 selectedRegionId

当前正式 UI 里：

- 手牌行动按钮能先点
- 轮盘入口也能先点

但底层大量重建逻辑仍依赖 `selectedRegionId`，于是出现两个后果：

1. 文案自然会写成“先选地区”
2. 教程很容易顺着现有实现写成“先点地区”

这说明问题不是单纯教程文案，而是正式流程建模已经偏向“地区先行”。

### 4. 规则书里的手牌行动全集没有被正式 UI 原样承接

当前正式 UI 对 `手牌行动` 的处理，是：

- 把 `势力行动` 做成右侧一级按钮
- 把已识别军备牌保留为手牌本体直点入口；右侧抽象 `升级军备` 主按钮已拆掉
- 把已识别事件牌保留为手牌本体直点入口；正式开局大多数普通事件牌仍没有稳定暴露

同时当前手牌对象本身：

- 当某张手牌已经带有规则级行动身份时，现已可由手牌本体直接进入对应正式动作预览
- 但正式开局当前只能稳定识别 atlas 中可审计的非行动牌身份；普通事件牌、军备牌、战术牌、银两仍缺规则级真相源，不能稳定承接“打出哪张事件牌 / 打出哪张军备牌”
- 主要只承担支付、弃牌、人物/科技/高第这类专项选择

这意味着当前正式流程不只是“地区先行”有问题，还存在一层更早的合同偏差：

- 规则书的手牌行动全集
- 没有被当前正式 UI 完整映射出来

### 5. 已锁来源对象与当前焦点对象仍在部分链路里混用

- 这轮已经命中的真实问题是：
  - `drive-tiger-consent` / `dispatch-targeting`
  - 地图重点切换本来只该改变“当前焦点”
  - 却一度反向改写了“已经锁定的来源区”
- 当前已修的合同是：
  - 进入 `drive-tiger-consent` 或 `dispatch-targeting` 后
  - 地图重选逻辑区可以改变观察焦点
  - 但不能反写这条链已经锁定的 `sourceRegionId`
- 这说明七大恨当前正式流程不只要区分：
  - 一级动作入口
  - 二级目标入口
- 还必须再区分：
  - 已锁来源对象
  - 当前地图焦点对象
  - 真实下一步提交对象

## 提示 UI 与真实交互载体

### 当前真实交互载体

- 轮盘行动：轮盘格 / 轮盘移动可点项
- 势力行动：右侧行动按钮
- 地图目标：地图高亮目标
- 支付：手牌本体
- 战后/围城/占领：选择按钮

### 当前缺失或被抽象替代的真实交互载体

- 执行事件：缺少“打出哪张事件牌”的正式一级入口
- 升级军备：已识别军备牌已有“打出哪张军备牌”的局部真实入口；整体仍缺稳定规则级一级入口

### 当前只是提示的 UI

- 顶部轮盘横幅
- 顶部行动横幅
- 右侧步骤标题
- 地图状态短词

结论：

- 横幅应该提示“现在轮到哪一层动作”，不该被教程写成主要点击入口。
- 如果某步真实点击发生在地图或按钮上，教程必须直接教那个对象。

## 当前屏幕可见可点对象盘点

> 这一张专门回答：当前正式页每个关键阶段，玩家第一眼能看到哪些对象，哪些才是真正该点的主入口。

| 当前阶段 | 玩家第一眼能看到的对象 | 真实语义归类 | 当前真正该点的是谁 | 当前问题 |
| :--- | :--- | :--- | :--- | :--- |
| 手牌上限弃牌 | 手牌本体、弃牌提交控件、说明文案 | 手牌是支付/弃牌对象；提交是确认控件；说明文案是提示UI | 手牌本体，选够后再点提交 | 这里没有“先选地区”的空间，教程若写成地区先行就是教反 |
| 轮盘推进 | 可点轮盘格、顶部轮盘横幅 | 轮盘格是一级动作入口；横幅是提示UI | 轮盘格 | 横幅不能再被写成“点这里进入轮盘” |
| 手牌行动主入口 | 右侧行动按钮列、顶部行动横幅、地图默认焦点 | 行动按钮是一级动作入口；横幅是提示UI；地图默认焦点不是这一步主入口 | 行动按钮 | 当前最容易误读的是默认 `selectedRegionId` 被当成这一步已选地区 |
| 支付预览 | 手牌本体、执行按钮、取消按钮、动作标题 | 手牌是支付对象；执行/取消是确认控件；标题是提示UI | 手牌本体与执行按钮 | 若还同时保留强主步骤卡，容易与当前支付步骤抢主语义 |
| 征召/马市/令箭等后续步骤 | 地图高亮候选、右侧选择卡、顶部横幅 | 地图或右侧选项是二级目标/确认；横幅是提示UI | 当前高亮地图目标或右侧选项 | interaction subtitle 仍容易把默认地区说成“第一步” |
| 轮盘进攻/调度 | 地图高亮目标、右侧摘要、顶部短提示 | 地图高亮目标是二级目标；摘要与短提示是提示UI | 地图高亮目标 | 若玩家要靠右侧摘要才知道点哪里，说明正式 UI 表达仍不够 |
| 待结算战斗 / 战后选择 | 右侧待结算卡、战后选择按钮、地图战斗提示 | 待结算卡和战后按钮是确认控件；地图提示是提示UI | 右侧结算或战后按钮 | 这里已不是一级动作阶段，不应再出现竞争性主入口 |

## 当前专项判断

### 哪些是教程问题

- 基础教程虽然已改正首个显式步骤顺序，但仍不足以单章代表规则书口径的完整首回合。
- 教程目录与隐藏续章会让玩家看到“教程可示范升级军备 / 事件行动”，却可能误以为正式局也已有同口径一级入口。
- 教程当前还没有先用这张审查表锁定交互合同。

### 哪些是正式流程问题

- 规则书同层的 `执行事件 / 升级军备 / 势力行动` 没被完整映射到正式 UI。
- 行动交互文案把地区选择写成动作入口前提。
- 大量行动重建逻辑强依赖 `selectedRegionId`，导致产品感知偏成“先选地区”。
- 提示 UI、动作入口、后续目标入口三层没有被明确拆开。

## 默认预选与真实决策分离审查

> 这一段专门回答：当前七大恨哪些“默认选中的东西”只是便捷初始态，哪些才算玩家真的做出了决定。

### 当前代码证据

- `src/games/qidahen/domain/actionWindowEntryState.ts`
  - 进入行动窗口时，会默认写入：
    - `selectedWheelMoveId`
    - `selectedActionId`
    - `selectedRegionId`
- `src/games/qidahen/tutorialSetup.ts`
  - 各教程预设也会直接种入：
    - `selectedWheelMoveId`
    - `selectedActionId`
    - `selectedRegionId`
- `src/games/qidahen/Board.tsx`
  - 棋盘会把 `selectedRegionId` 画成当前选中态
  - 轮盘会把 `selectedWheelMoveId` 画成当前选中态
  - 行动区仍会把 `selectedActionId` 画成当前默认聚焦，但已不再直接等同于“已确认执行”
- `src/games/qidahen/domain/handCardState.ts`
  - 正式局生成的手牌会先进入 `resolveQidahenFormalHandCardIdentity`
  - 当前已能稳定识别 atlas 中可证明的非行动牌身份：人物、剧本、纪年、牌背
  - 普通事件牌、军备牌、战术牌、银两仍缺稳定 `cardKind / cardDefId / armamentId` 映射
- `src/games/qidahen/tutorialSetup.ts`
  - 只有教程注入态才会显式把少量手牌改成：
    - `event`
    - `armament`
    - `tactic`
    - `silver`
- `src/games/qidahen/__tests__/payment-selection.test.ts`
  - 升级军备相关断言也是通过测试里手动补 `cardKind/armamentId` 来验证“识别军备牌目标”

### 审查结论

这些默认态目前都只能算：

- 初始聚焦
- 系统给出的便捷起点
- 当前实现为了能继续重建后续选择而保留的中间状态

它们都**不等于**：

- 玩家已经先做出一级动作决定
- 玩家已经先选好了地区
- 玩家已经先确认了轮盘移动

当前已修正的一点是：

- 动作栏默认聚焦与已确认执行，已经在正式页视觉上拆成两层：
  - 默认聚焦：弱聚焦
  - 已进入支付/执行：强确认
- 但这只是视觉收口，不代表领域建模已经完全拆干净；`selectedActionId` 仍同时承担默认焦点与已确认动作的状态来源。

### 对教程与正式文案的直接约束

1. 不能把默认 `selectedRegionId` 写成“正式第一步先选这里”。
2. 不能把默认 `selectedActionId` 写成“当前规则一上来就是做这个行动”。
3. 不能把默认 `selectedWheelMoveId` 写成“轮盘已经替你决定了这一步怎么走”。
4. 如果当前阶段真实入口仍是直点对象，就必须靠真实高亮告诉玩家“现在能点哪里”，而不是靠“当前已选中”的说明词替代。

### 分层裁决

#### 可以接受的默认预选

- 轮盘可直接点击时，默认聚焦一个轮盘候选格
- 一级行动列表仍完整可见时，默认聚焦一个行动
- 已进入某个二级步骤后，为了继续重建候选目标，保留一个默认来源区或目标区

前提是：

- 玩家仍然一眼就能看到其它同层候选
- 文案不把这个默认态说成“你必须先选它”
- 真实可点对象一进入该阶段就已经高亮

#### 当前不可接受的感知

- 默认选中的地区被文案写成“这一步先从这里开始”
- 默认选中的地区没有被说明为“只是当前聚焦点”，却在教程里变成首个正式决策入口
- 顶部横幅和右侧说明仍在替默认态兜底，让玩家靠读说明才知道去点哪里

## 手牌对象保真度审查

> 这一段专门回答：为什么当前不能直接把“没做成手牌直打事件/军备”简单归类成一条小 UI 漏项。

### 当前代码证据

- `src/games/qidahen/domain/handCardState.ts`
  - 正式局初始手牌与摸到的新手牌，会先建立低保真预览对象：
    - `previewRef`
    - `label`
    - `status`
  - 随后经 `resolveQidahenFormalHandCardIdentity` 补入 atlas 中可审计的非行动牌身份：
    - 人物牌、剧本卡、纪年卡、牌背可以进入稳定 `cardKind / cardDefId`
  - 但仍不会稳定带出普通手牌所需的：
    - 普通事件牌 / 军备牌 / 战术牌 / 银两牌 `cardKind`
    - 军备牌对应的 `armamentId`
    - 普通手牌逐牌 `cardDefId`
- `src/games/qidahen/Board.tsx`
  - 手牌区当前稳定把手牌用于：
    - 支付
    - 弃牌
    - 孙元化科技选牌
    - 高第弃牌调度
    - 放大查看
  - 已能局部承担：
    - 已识别事件牌直接进入动作预览
    - 已识别军备牌直接进入动作预览
  - 但不承担规则书级完整入口：
    - 不能稳定让正式开局大多数普通事件牌直接打出
    - 不能稳定让正式开局普通军备牌直接打出并绑定军备目标
- `src/games/qidahen/tutorialSetup.ts`
  - 教程能出现 `事件 / 军备 / 战术 / 银两` 这些分类，是因为注入态手动补了 `cardKind`
  - 这不是正式局天然就有的正式交互合同
- `src/games/qidahen/ui/cardAtlas.ts`
  - 当前只有整版 atlas 的切片坐标
  - 没有把每一帧稳定映射成规则级 `cardDefId / cardKind / armamentId`
- `src/games/qidahen/rule/七大恨素材接入清单.md`
  - intake 文档已明确记下：
    - `cards/atlases/*` 还缺 atlas 裁切合同
    - 还缺卡名顺序
- `temp/qidahen-hand-sheets/ming-sheet.png`
  - 肉眼可见当前大明 atlas 切出的前排卡面主要是人物牌，不是普通手牌集合
- `temp/qidahen-hand-sheets/mongol-sheet.png`
  - 肉眼可见当前蒙古 atlas 混入剧本卡与纪年卡，不是单一“普通手牌”集合
- `temp/qidahen-hand-sheets/jin-sheet.png`
  - 肉眼可见当前后金 atlas 前排是人物牌，后排直接出现牌背，说明它连可见对象全集都未闭合
- `D:\gongzuo\webgame\gameasset\七大恨 中文mod\Images`
  - 2026-07-04 重新核对后，确认 `httpcloud3steamusercontentcomugc102169903669356559588DEAD347E28EC522FA222DB84DF3E941A092647.jpg` 对应 TTS `deckKey 16`，是普通手牌 atlas05，不应继续按“纪年图集”或“没有普通手牌素材”口径描述。
  - 已按安全读图流程生成单牌裁图和分块验收图，并锁定 23 张普通手牌确认行，覆盖事件、军备、战术三类；银两仍为 blocked/partial 证据，不得反写正式真相表。验收结论覆盖写入 `test-results/evidence-image-validation/qidahen-formal-handcard-2.4.json` 与 `test-results/evidence-image-validation/qidahen-formal-handcard-2.4.md`。

### 当前教程侧的直接证据

- `src/games/qidahen/tutorialSetup.ts`
  - `event-action` 教程当前仍是用 `selectedActionId = 'khan-edict'` 作为示范入口
  - 它演示的是“支付后继续选效果”的正式行动链，不是真正的“从正式手牌区直接打出事件牌”
- `public/locales/zh-CN/game-qidahen.json`
  - 当前教程文案不能再写“真实手牌行动入口”
  - 否则会把教程注入态误报成正式局已具备规则级手牌入口

### 审查结论

当前七大恨正式局的手牌对象，仍然更接近：

- 低保真手牌预览
- 可支付资源卡
- 少量专项交互载体
- 且当前可见 atlas 还混入人物牌、剧本卡、纪年卡与牌背

而不是：

- 规则书意义上可直接承接 `执行事件 / 打出军备 / 战术打出` 的高保真卡对象

这意味着：

1. 当前“正式开局还没有稳定直打事件/军备入口”不是单句文案问题。
2. 如果要把正式 UI 改回规则书口径，前提不只是补 `cardKind` 映射，而是先拿到真正属于普通手牌集合的素材合同，再把正式局手牌对象提升成可稳定识别类别与定义的对象。
3. 在这件事没做之前，教程和审计都必须把它明确记成**正式流程缺口**，不能默认“只是 UI 还没高亮一下”。
4. atlas05 已经给出 23 张可正式反写的普通手牌真相源，因此“没有素材/没有任何确认行”的旧结论不再成立。
5. atlas05 已确认通过项覆盖事件、战术、军备三类普通手牌，并已完成 `cardKind / cardDefId / armamentId` 局部运行时接入和定向测试；银两仍为 blocked/partial 证据，事件效果全集与战术时机也未闭环，因此“真实手牌入口全集”“正式可直接打出所有事件牌/军备牌”的完成口径仍不成立。

### 2026-07-02 运行时 atlas preview 合同核验（正式手牌阻塞）

- 运行时证据：`src/games/qidahen/ui/cardAtlas.ts` 的 faction atlas 帧由 `buildFrames(topXs, leftYs)` 组装，当前合同只覆盖顶行 `topXs` 与左列 `leftYs` 的 16 个预览帧，而不是三张 10x7 原图的完整 60/70 张全牌面。
- 发牌证据：`src/games/qidahen/domain/handCardState.ts` 固定 `QIDAHEN_FACTION_HAND_PREVIEW_COUNT = 16`，并通过 `resolveQidahenFormalHandCardIdentity` 只为这些 preview index 补 atlas 中可审计的非行动牌身份。
- 结论：现有运行时 faction preview seam 可证明人物、剧本、纪年、牌背等少量非行动牌身份，但它不是普通手牌全集入口；普通事件牌、军备牌、战术牌的逐牌真相源已由 atlas05 打开，并且 atlas05 普通手牌预览已从旧顶行+左列 seam 修正为完整 10x7 网格。当前 45 张 confirmed/passed 行已进入正式发牌/摸牌与预览流，运行态手牌名称也已改为对应中文牌名；银两牌仍未满足正式反写门槛，事件效果全集、战术时机和银两资源链仍未完成。
- 素材状态：`docs/games/qidahen/workflows/qidahen-hand-card-atlas05-manual-entry-matrix.md` 已新增 atlas05 普通手牌人工录入矩阵；`test-results/evidence-image-validation/qidahen-formal-handcard-2.4.json` 当前记录 45 张 passed 普通手牌、0 张 partial、3 张 blocked，`npm run verify:qidahen:handcards` 已通过。旧的 49 张 OCR 候选、TTS CardID 完整矩阵和运行时 faction preview 候选仍保留为排除证据；它们不能覆盖 atlas05 这一新发现，也不能再支持“本地没有任何普通手牌确认行”的结论。当前已完成 45 张确认行的正式运行时接入和定向测试；后续仍需补齐银两、事件效果全集和战术时机后，才能关闭 2.4 / 4.5。

## 后续实施门禁

在继续改七大恨教程或正式 UI 之前，必须先满足：

1. 基础教程改成：先让玩家经过真实一级动作入口，再进入地区/支付等二级步骤。
2. 相关正式流程文案改成：先描述行动，再描述后续目标选择；不得继续说“先选地区”。
3. 如果要把 `执行事件 / 升级军备` 做成规则书级正式入口，必须先补正式局手牌对象保真度，而不是直接在低保真手牌预览上硬挂交互。
4. 横幅、步骤卡、状态条继续只做提示，不被教程写成交互入口。
5. 若某些正式流程真的做不到“先动作后目标”，必须单独判定那是实现限制还是规则特例，不能默认合理化。

## 正式进行页交互总览

> 这一段不是教程建议，而是当前正式进行页真实暴露给玩家的交互面。  
> 目的：把“所有交互都要审查”落成对象清单，后续实现改动逐项回到这里核。

| 交互类目 | 当前状态进入条件 | 玩家第一眼可见入口 | 真实承接物 | 后续步骤 | 当前问题 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 手牌上限弃牌 | `turnPhase = hand-limit-discard` | 右侧弃牌卡、手牌区 | 手牌本体 + 提交 | 选够数量后确认 | 基本合理；不是地区先行 |
| 轮盘推进 | `wheelStageAvailable` | 轮盘本体、上方轮盘横幅 | 轮盘可点格 | 走完后进入某轮盘分支 | 横幅只是提示，不应被教程写成交互 |
| 手牌行动：执行事件 | 规则书允许时应先选要打出的事件牌 | 已识别事件手牌会直接暴露单牌入口 | 已识别事件手牌本体 | 事件效果自身再决定后续流程 | **部分真实可用**：当前 seam 已接上，但正式开局大多数手牌仍未识别，不能把它报成规则书级完整入口 |
| 手牌行动：升级军备 | 规则书允许时应先打出军备牌 | 已识别军备牌会直接暴露单牌入口；无已识别军备牌时不再提供右侧抽象按钮 | 已识别军备手牌本体 | 军备升级结果 | **部分真实可用**：当前 seam 已接上，但普通军备牌真相源仍缺，不能把它报成规则书级完整入口 |
| 手牌行动：势力行动 | `primaryStageMode = faction` | 右侧行动按钮列 | 行动按钮 | 某些行动才继续选地区/支付 | 这只是手牌行动全集里的一支，不是全部 |
| 手牌支付预览 | 选中有费用的手牌行动后 | 右侧支付预览、手牌区 | 预览确认/取消、手牌本体 | 支付完成后才执行行动 | 基本合理；但教程目前没按这个顺序教 |
| 征召军队 | `turnPhase = recruit-choice` | 右侧选择卡 + 地图提示 | 右侧选项按钮 | 目标地区由已选区或重建逻辑决定 | 文案把地区写得像一级入口 |
| 马市贸易 | `turnPhase = ma-shi-trade-choice` | 右侧选择卡 + 地图提示 | 右侧选项按钮 | 建军数量与目标地区联动 | 文案把地区写得像一级入口 |
| 大汗令箭 | `turnPhase = khan-edict-choice` | 右侧选择卡 + 地图提示 | 右侧选项按钮 | 之后进入征兵训练或外交雇佣 | 文案把地区写得像一级入口 |
| 外交雇佣 | `turnPhase = diplomacy-choice` | 右侧摘要卡 + 地图候选按钮 | 地图候选按钮 + 右侧选项按钮 | 反复处理最多 3 次外交，再雇佣结算 | 一级动作已锁定后仍带强地区语气，容易误导 |
| 轮盘进攻/调度 | `turnPhase = dispatch-targeting` | 地图高亮候选、右侧摘要 | 地图目标本体 | 进入待结算战斗 | 这时地区是二级目标，不是一级动作 |
| 高第/王化贞调度 | 对应角色效果开启 | 高第先看到弃牌步骤，王化贞先看到地图目标 | 高第先由手牌承接弃牌，再进入地图目标；王化贞直接由地图目标承接 | 进入调度结果 | 高第已修正为“先弃牌后选目标”，王化贞保留地图直点 |
| 突袭/联姻诱降待结算 | `pendingTargetAction != null` | 右侧待结算卡 | 右侧结算按钮/数量按钮 | 进入战后或结果 | 合理；此时目标已锁定，不该再出现一级动作 |
| 战后选择 | `postBattleSelection != null` | 右侧战后选择卡 | 右侧选项按钮 | 围城/占领/撤退等收口 | 合理；属于收口阶段 |
| 防线维护 / 年度结算 | `fortificationMaintenanceSelection` 或 `season-resolution` | 右侧结算卡 | 右侧选项按钮 | 进入新年/年中结果 | 合理；不是地区先行 |

## 需要继续重点追的正式流程问题

### 1. 手牌行动全集没有被完整映射成正式一级入口

规则书一级入口里明确存在：

- `执行事件`
- `升级军备`
- `势力行动`

但当前正式 UI 实际稳定暴露出来的，是：

- 右侧势力行动按钮
- 已识别事件牌 / 军备牌直入预览；未识别时不再退回抽象 `upgrade-armament`

却没有：

- 规则级的“打出哪张事件牌”
- 规则级的“打出哪张军备牌”

同时当前手牌对象还是低保真：

- atlas 中可审计的非行动牌已经能记录 `cardKind / cardDefId`
- 普通事件牌、军备牌、战术牌、银两仍缺稳定卡名、卡类、效果与军备目标映射
- 手牌区只对已识别行动牌承担“打出动作”，还不是正式局稳定可依赖的规则书级入口

这说明后续不该只围着“地区先后顺序”修；还要先决定：

- 七大恨正式 UI 是否要把手牌行动做成规则级承接
- 是否要先把正式局手牌对象提升成高保真规则对象
- 如果暂时做不到，教程和审计都必须明确把它记成正式流程缺口，而不是默认已存在

### 2. 地区选择被很多后续系统反向提升成了“默认前提”

当前这些系统都会在进入后自动围绕 `selectedRegionId` 重建：

- 征召军队
- 马市贸易
- 大汗令箭
- 外交雇佣
- 轮盘进攻/调度
- 若干人物调度

问题不在“系统里允许换地区”，而在：

- 它们把一个本应属于后续目标选择或来源地区的状态
- 提前渗透进了一级动作文案和教程顺序

结果就是玩家感知被推成：

- 先找地区
- 再决定做什么

而不是规则要求的：

- 先决定做什么
- 再决定目标/来源/支付

### 3. 轮盘与行动横幅目前是纯提示，不应再被写成交互入口

当前地图目标横幅与上方主横幅都只是提示层：

- 地图选择横幅是 `pointer-events-none`
- 顶部轮盘/行动横幅也只承担状态词与提示文案

这意味着：

- 它们不能再被教程文案写成“点横幅”
- 也不能被设计理解成“横幅是主交互”

### 4. 某些右侧选择卡已经是二级步骤，不应继续和同级一级动作混屏

像这些状态一旦出现，就说明一级动作已经锁定：

- `recruitSelection`
- `maShiTradeSelection`
- `khanEdictSelection`
- `diplomacySelection`
- `wheelDispatchSelection`
- `pendingTargetAction`
- `postBattleSelection`

此时玩家应该只面对当前二级步骤，不应再同时看到会被误读成并列主入口的通用步骤提示。

### 5. 正式流程里仍有“动作按钮可先点，但后续文案把它说成地区先行”的内外不一致

这是当前最需要处理的正式流程问题：

- 外层真实交互已经允许先点动作
- 内层 follow-up、selection builder、interaction subtitle 却继续围绕“先选地区”组织文案与默认目标

如果不把这层不一致拆掉，教程即使改对，也很容易再次被实现带偏。

## 当前主要交互全清单审查

> 这一张是“所有主要交互都要审查一下”的落地版本。  
> 不是代表链；是当前正式进行页主要交互的完整清单。

| 交互类目 | 当前进入条件 | 第一眼入口 | 真实承接物 | 默认预选/默认高亮 | 当前主要问题 | 执行分流 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 开局公共推进：手牌上限 | `turnPhase = hand-limit-discard` | 手牌区、弃牌卡 | 手牌本体 + 提交 | 无问题的默认预选 | 语义基本对 | 暂不处理：当前未命中误导 |
| 开局公共推进：轮盘推进 | `wheelStageAvailable` | 轮盘本体、顶部横幅 | 轮盘格 | 默认 `selectedWheelMoveId` | 默认态合理，但不能被写成已决策；主入口必须仍是轮盘格 | 可立即真修项已处理：轮盘主步骤卡退场，保留轮盘格直点 |
| 一级行动入口：势力行动 | `primaryStageMode = faction` | 右侧行动列、顶部横幅 | 行动按钮 | 默认 `selectedActionId` | 默认聚焦存在，但不能把它写成“规则先做这个”；当前部分文案仍在绕地区 | 局部收口：二级步骤上方一级横幅已退场；仍需继续拆默认聚焦与已确认动作 |
| 支付/弃牌 | 动作已预览且需要费用 | 手牌区、支付卡 | 手牌本体 + 执行按钮 | 已选支付牌 | 这是正式支付阶段，不是一级动作入口 | 暂不处理：当前语义基本合理 |
| 二级目标：赐印招安 | 一级动作已锁定 | 地图候选、右侧支付/结果提示 | 地图目标 + 支付牌 | 当前常由默认 `selectedRegionId` 承接 | 教程容易被带成“先选区”；正式实现也依赖预选区 | 需要建模补齐：缺默认聚焦、当前目标、已锁来源拆分 |
| 二级目标：征召军队 | `turnPhase = recruit-choice` | 右侧选择卡、地图 | 右侧选项 + 地图改区 | 已锁焦点 `selectedRegionId` + 显式点击 `explicitRegionId` | 地图改区现在不再把建军目标反写成持久焦点，但结算后仍会收回真实建军区 | 局部收口：选择对象已显式携带 `displayAnchorRegionId/displayAnchorRegionName`；等待态地图重选只更新 `explicitRegionId` 与 `recruitSelection.targetRegionId`，不再反写 `selectedRegionId` |
| 二级目标：马市贸易 | `turnPhase = ma-shi-trade-choice` | 右侧选择卡、地图 | 右侧选项 + 地图改区 | 已锁焦点 `selectedRegionId` + 显式点击 `explicitRegionId` | 地图改区现在不再把建兵目标反写成持久焦点，但结算后仍会收回真实建兵区 | 局部收口：选择对象已显式携带 `displayAnchorRegionId/displayAnchorRegionName`；等待态地图重选只更新 `explicitRegionId` 与 `maShiTradeSelection.targetRegionId`，不再反写 `selectedRegionId` |
| 二级目标：大汗令箭 | `turnPhase = khan-edict-choice` | 右侧效果卡、地图 | 右侧选项 + 地图改区 | 已锁焦点 `selectedRegionId` + 显式点击 `explicitRegionId` | 来源区/目标区/展示锚点已部分拆开；外交分支已不再按地图目标反写 `selectedRegionId` | 局部收口：选择对象已显式携带 `displayAnchorRegionId/displayAnchorRegionName`；令箭等待态地图重选只更新 `explicitRegionId` 与 `khanEdictSelection`，不再反写 `selectedRegionId` |
| 二级目标：外交雇佣 | `turnPhase = diplomacy-choice` | 地图候选、右侧摘要 | 地图候选 + 右侧选项 | 已锁来源/焦点 `selectedRegionId` + 当前目标 `explicitRegionId` + `diplomacySelection.targetRegionId` | 外交摘要现在也已改为消费 `displayAnchorRegionId/displayAnchorRegionName`；外交等待态地图重选与连续外交结算都不再把目标区反写成持久焦点 | 局部收口：来源/焦点继续留在 `selectedRegionId`，地图点击目标记录到 `explicitRegionId`，真实外交目标由 `diplomacySelection.targetRegionId` 承接；人物调度与部分结算链仍需继续拆 |
| 地图目标：轮盘进攻调度 | `turnPhase = dispatch-targeting` | 地图高亮、右侧摘要 | 地图目标本体 | 已锁来源区、高亮候选区；误点只记录 `explicitRegionId` | 右侧目标卡已去掉“进攻某地”和“可攻/可去 N 处”复述；等待态地图误点重建时不再让显式浏览焦点改写已锁来源区或展示锚点 | 局部收口：轮盘调度来源锁已补一层；仍需继续拆其它默认来源区与展示锚点 |
| 地图目标：王化贞/高第等调度 | 对应人物效果开启 | 王化贞直接暴露地图高亮；高第先暴露弃牌步骤，弃牌后才暴露目标地图高亮 | 地图目标本体或后续选择 | 默认来源区/默认目标区；人物窗口内地图点击记录 `explicitRegionId` | 高第未弃牌前地图改区只重建来源候选，不反写持久焦点；已选弃牌后，误点非候选区会保留原调度选择；王化贞仍是直接地图目标 | 局部收口：人物调度来源/目标反写已补一层；仍需拆 builder 输入里的默认来源与展示锚点 |
| 待结算战斗 | `pendingTargetAction != null` | 右侧待结算卡、地图战斗提示 | 右侧结算控件 | 目标已锁定；显式浏览焦点只写 `explicitRegionId` | 这时已不是一级动作；应只剩战斗结算语义 | 局部收口：误点地图不改待结算目标；结算进入下一阶段时也不再用结果区覆盖显式浏览焦点 |
| 战后选择/围城/占领 | `postBattleSelection != null` | 右侧战后卡 | 右侧选项按钮 | 目标已锁定；显式浏览焦点只写 `explicitRegionId` | 当前阶段定义清楚，但需防止与上层主步骤卡重复 | 局部收口：战后等待态误点不改战场目标；最终选择结算后保留此前显式浏览焦点 |
| 年中/新年/维护 | `season-resolution` 或维护选择开启 | 右侧结算卡 | 右侧选项按钮 | 无关键问题 | 与地区预选无关，语义清晰 | 暂不处理：当前未命中误导 |

## 联机座位与控制权裁决

- 正式局私有信息按座位过滤：`playerView` 只返回当前玩家所属阵营的手牌、支付牌、直点手牌行动与手牌上限弃牌选择；其他阵营的手牌实体和选择 id 不可见。
- 当前势力一级操作归当前行动座位：普通地图选择、势力行动、轮盘行动、支付与取消都必须由 `currentPlayer` 执行。
- 已进入系统交互的等待态归交互持有人：征召、马市贸易、大汗令箭、内部调度、手牌上限弃牌等由当前 interaction 的 `playerId` 执行，不能由旁观座位代点。
- 驱虎吞狼拆成三段控制权：被指挥方座位决定同意或拒绝；同意后由大明座位锁定调度进攻目标；进入战斗后，待结算与战后选择回到实际出兵/攻击方座位。
- 新年防线维护属于大明防线选择：即使轮盘由非大明势力转入新年，维护按钮也只归大明座位处理，不能让当前轮盘玩家代点。
- 当前 2.6 的验证证据：`commands.test.ts` 覆盖非当前座位拦截、驱虎吞狼三段控制权、待结算/战后座位、新年防线维护座位；`playerView.test.ts` 覆盖手牌、支付牌、直点手牌行动与手牌上限弃牌选择的私有视角过滤。

## 继续实施前的硬门禁

1. 任何后续七大恨教程改动，都必须先引用这张“主要交互全清单审查表”，不能只抓一条基础教程链。
2. 任何后续七大恨正式 UI 改动，都必须先说明这次改的是：
   - 一级动作入口问题
   - 默认预选语义问题
   - 二级目标直点可见性问题
   - 或提示横幅误当交互入口问题
3. 没先说清属于哪一类，就不能再“顺手调一处文案试试看”。

## 当前整改优先级

> 这一段专门回答：审完全部主要交互后，接下来哪些能直接真修，哪些不能再靠文案或教程粉饰。

### A. 可立即真修的正式流程问题

1. 所有会在正式进行页上屏的短状态、摘要卡、interaction subtitle，继续保持“先说明当前动作层，再说明后续目标”，不得把 `selectedRegionId`、已锁来源区或默认高亮翻译成“第一步先选地区 / 从这里开始 / 先攻这里”。
2. 提示横幅、步骤卡、地图短提示继续只做提示；凡是真实点击发生在轮盘、地图、手牌或右侧选项按钮上，就不得再新增“去点横幅 / 看右侧就算主入口”的替代链。
3. 任何进入二级步骤后才出现的地图候选、支付手牌、战后选项，都必须保持即时高亮或等价可点击语义，不能让玩家靠读摘要去猜。
4. 当二级步骤卡已经出现时，同屏不得再摆一个会与它竞争主语义的通用主步骤卡，避免一屏两个“主入口”。
5. 当前这轮已真收的摘要层出口包括：
   - 外交摘要不再写“正在查看某地区 / 当前目标步骤”，改成“外交目标”
   - 轮盘进攻候选卡不再写“进攻某地”来冒充主入口
   - 轮盘进攻摘要与 runtime subtitle 不再写“可攻 / 可去 N 处”复述候选按钮数量，当前只保留“进攻目标”
   - 地图选择横幅不再写“点一个进攻目标 / 点一个调度目标”，只保留“进攻目标 / 调度目标”这类阶段短状态，点击语义继续由地图高亮目标承接
   - 手牌行动顶部横幅现在和轮盘横幅一样，会在支付、二级目标、调度、战斗、战后、维护等前景操作出现时退场，不再把一级动作提示压在二级步骤上方
   - 征召军队、马市贸易、大汗令箭选择对象新增 `displayAnchorRegionId/displayAnchorRegionName`；右侧摘要改用展示锚点字段，不再从真实目标区或来源区字段直接推导展示主语
  - 外交卡片不再写“当前目标步骤”，改成“外交目标”；未选目标时的提示不再说“先从地图或候选列表选择”，改成外交规则短状态；外交摘要主语也已改成消费 `displayAnchorRegionId/displayAnchorRegionName`，不再直接拿 `sourceRegionName` 充当屏幕主语
   - 高第调度在弃牌前不再写“先选要弃掉的手牌”，改成“弃 1 张手牌”；地图高亮仍只在选完弃牌、进入调度目标后出现
   - 驱虎吞狼同意后的季节摘要不再写“从某地出发”，改成“进入调度目标选择”
   - 高第调度、王化贞调度、轮盘进攻/调度选择对象也已新增 `displayAnchorRegionId/displayAnchorRegionName`；右侧摘要改用展示锚点字段，不再直接拿正式 `sourceRegionName` 当屏幕主语
   这些都已属于运行态真实实现，不再只是规范口径。

### B. 地区状态拆分已收口，仍需防止回流的问题

1. `selectedRegionId` 当前仍保留为兼容焦点入口，但正式运行态已经新增 `regionFocusState`，把 `defaultFocusRegionId / lockedSourceRegionId / currentTargetRegionId / displayAnchorRegionId` 拆成持久语义。`selectedActionFollowUp` 已不再把一级动作结果反写成后续来源区或目标区；`regionSelectionReducer` 也已把征召军队、马市贸易、大汗令箭、外交雇佣等待态地图重选从“反写 selectedRegionId”改为“保留已锁焦点 + 记录 explicitRegionId + 重建 selection 目标”。轮盘调度、外交连续结算、人物调度、待结算/战后结算也已把来源、目标和展示锚点同步到独立语义字段。
2. 因此 OpenSpec 2.5 已可收口；后续风险不再是“没有拆字段”，而是新增链路若继续裸用 `selectedRegionId`，可能重新把“后续目标/来源区”感知成“主流程第一步”。
3. 后续维护方向不是简单删掉默认选中，而是继续守住三层语义：
   - 默认聚焦
   - 当前真实可点击对象
   - 玩家已确认的正式决策

### B.1 当前代码级混用位点

> 这一段把“所有主要交互都要审查”继续落到 builder / follow-up 层；不是泛泛而谈 `selectedRegionId` 有问题，而是指出它现在具体混了哪些职责。

1. `src/games/qidahen/domain/selectionBuilders.ts`
   - `buildRecruitSelectionFromRegionSemantics` / `buildMaShiTradeSelectionFromRegionSemantics`
   - 已完成收口：新增 `buildRecruitSelectionFromRegionSemantics` / `buildMaShiTradeSelectionFromRegionSemantics`，进入等待态后由调用方先经 `getQidahenExplicitRegionSelectionSemantics` 拆出锁定焦点、显式目标和展示锚点；地图点击只更新 `explicitRegionId` 与各自 selection 的目标，不再反写 `selectedRegionId`。
   - 持久状态层已通过 `regionFocusState` 承接 `默认聚焦 / 当前目标 / 已锁来源 / 展示锚点`。
2. `src/games/qidahen/domain/selectionBuilders.ts`
   - `buildKhanEdictSelectionFromRegionSemantics`
   - 已完成收口：新增 `buildKhanEdictSelectionFromRegionSemantics`，令箭面板由调用方显式传入锁定焦点、显式目标和展示锚点；`recruit/hire` 目标与右侧展示名不再直接从持久 `selectedRegionId` 裸推。
   - 令箭进入外交雇佣和征兵训练结算时已同步 `regionFocusState.lockedSourceRegionId / displayAnchorRegionId`，来源区不再只靠 `selectedRegionId` 裸推。
3. `src/games/qidahen/domain/selectionBuilders.ts`
   - `buildDiplomacySelectionFromRegionSemantics`
   - 已完成收口：新增 `buildDiplomacySelectionFromRegionSemantics`，外交等待态地图点击由 reducer 显式传入锁定焦点、当前目标与展示锚点；地图点击只更新 `explicitRegionId` 与 `diplomacySelection.targetRegionId`，连续外交结算也保留 `hireRegionId/sourceRegionId` 作为来源焦点。
   - 外交来源锁、当前目标和展示锚点已由 `regionFocusState` 与 `diplomacySelection` 双层承接；显式点击目标不再反写 `selectedRegionId`。
4. `src/games/qidahen/domain/dispatchSelectionBuilders.ts`
   - `buildWangHuazhenInternalDispatchSelectionFromRegionSemantics` / `buildGaoDiDispatchSelectionFromRegionSemantics`
   - 已完成收口：新增 `buildWangHuazhenInternalDispatchSelectionFromRegionSemantics` / `buildGaoDiDispatchSelectionFromRegionSemantics`，人物窗口进入和地图重选时显式传入已锁焦点、当前目标与展示锚点；高第选牌后若点到非候选目标，不再重建来源区；王化贞等待态若点到非候选目标，不再重建来源区，只保留显式浏览焦点。
   - 人物调度结算后同步 `regionFocusState`，来源、目标和展示锚点不再只靠 `selectedRegionId`。
5. `src/games/qidahen/domain/dispatchSelectionBuilders.ts`
   - `buildWheelDispatchSelectionFromRegionSemantics` 及其上游 `getPreferredDispatchSourceRegionIdForSemantics`
   - 已完成收口：新增 `buildWheelDispatchSelectionFromRegionSemantics` 与 `QidahenWheelDispatchSelectionRegionSemantics`，等待态重建由 reducer 显式传入来源区、当前目标区与展示锚点；进入 `dispatch-targeting` 后，误点地图只更新 `explicitRegionId`，不会让来源选择 helper 用显式浏览焦点改写已锁来源区。
   - 令箭调度、驱虎吞狼同意链与 `dispatch-targeting` 重建都已改为消费显式地区语义或锁定地区语义，不再通过驱虎吞狼/令箭的裸地区 wrapper 推入 builder；等待同意时地图误点只记录 `explicitRegionId`，正式调度来源继续锁在原来源区。
   - 进入调度前的默认来源选择也已改为消费 `QidahenWheelDispatchSelectionRegionSemantics`，目标锁定后同步 `regionFocusState.lockedSourceRegionId / currentTargetRegionId / displayAnchorRegionId`。
6. `src/games/qidahen/domain/selectedActionFollowUp.ts`
   - 已完成收口：征召军队、马市贸易、大汗令箭、驱虎吞狼、突袭作战与联姻诱降进入后续选择或待结算时，`selectedRegionId` 保留一级动作执行前的当前焦点。
   - 后续正式来源区、目标区与结算对象改由 `recruitSelection / maShiTradeSelection / khanEdictSelection / wheelDispatchProgress / pendingTargetAction` 自身携带，不再通过 `selectedRegionId` 反写。
   - 这层已经阻断“动作刚执行完就把屏幕焦点强制切成后续来源/目标”的回流；剩余混用点继续保留在 reducer / builder 的等待态重建与地图重选链。

### B.2 当前最小真修方向

1. 不是继续扩大 `explicitRegionId` 的职责；`explicitRegionId` 仍只表示“玩家显式点过的地区”。
2. 下一层应优先在 selection / dispatch builder 层继续补专用语义，而不是再让 `selectedRegionId` 一值多用。
3. 当前最可能的拆法是把下列语义继续拆开：
   - `preferredSourceRegionId`
   - `selectedTargetRegionId`
   - `displayAnchorRegionId`
4. 当前已完成一层真实推进：
   - 征召军队、马市贸易、大汗令箭、外交雇佣已把右侧展示主语改成 `displayAnchorRegionId/displayAnchorRegionName`
   - 征召军队、马市贸易、大汗令箭已新增显式地区语义 builder，`selectedActionFollowUp` 与 `regionSelectionReducer` 会先拆出锁定焦点、显式目标和展示锚点再重建 selection
   - 外交雇佣已新增显式地区语义 builder，等待态地图重选由 reducer 传入显式地区语义，不再让外交 builder 自己从裸 `selectedRegionId` 推导当前目标
   - 高第调度、王化贞调度、轮盘进攻/调度也已把右侧展示主语改成 `displayAnchorRegionId/displayAnchorRegionName`
   - 高第调度、王化贞调度已新增显式地区语义 builder，人物窗口初次进入和等待态重选都不再只靠一个裸 `selectedRegionId` 同时表达来源、目标与展示锚点
   - `selectedActionFollowUp` 已保留一级动作执行前的当前焦点，不再把后续建军目标、马市目标、令箭来源、驱虎来源或待结算目标反写进 `selectedRegionId`
   - 轮盘外交/雇佣与大汗令箭进入外交链的入口已改为向外交 builder 传入锁定/显式地区语义，不再在这些入口继续直接传裸 `selectedRegionId`
   - 轮盘调度 `dispatch-targeting` 等待态已阻断“显式浏览焦点反写来源区”：误点地图后仍保留原来源区，只把误点记录到 `explicitRegionId`
   - 轮盘调度已新增显式地区语义 builder，等待态重建会把 `selectedTargetRegionId / preferredSourceRegionId / displayAnchorRegionId` 作为一个合同对象传入，避免目标名、路径名与来源排序继续共用一个裸 `selectedRegionId`
   - 外交雇佣等待态与连续外交结算已阻断“目标区反写来源/焦点”：地图目标写入 `explicitRegionId` 与 `diplomacySelection.targetRegionId`，`selectedRegionId` 继续保留外交来源/焦点
   - 高第/王化贞人物调度等待态已阻断“非候选地图点击反写来源区”：高第选牌后保留原选择，王化贞保留原来源选择，只把点击写到 `explicitRegionId`
   - 待结算战斗与战后选择已阻断“结果区覆盖显式浏览焦点”：`pendingTargetAction / postBattleSelection` 继续承接真实战斗目标，地图误点与后续结算只保留到 `explicitRegionId`
5. 这轮已经完成 OpenSpec 2.5 的字段级拆分：默认聚焦、已锁来源、当前目标和展示锚点都有独立持久语义；`selectedRegionId` 仍保留为旧界面焦点兼容入口，但不再承担全部真相。
6. 仍不能把七大恨判成“新游戏接近收工”，原因集中在 2.4 与 4.5：正式手牌行动全集仍缺银两、事件效果全集与战术时机闭环；教程规则覆盖已补骑兵避战、骑兵劫掠、中立入侵、水路调度、“水路后不能再接陆路”的玩家视角候选证据、骑兵城战减值摘要证据、战术牌真实打出、攻城同章占领对照，以及轮盘主章节完成后自动续到开垦隐藏续章的 `15g` 证据，但这些教程注入态不能替代正式普通手牌全集。4.5 必须继续保持未完成。

### C. 当前不能靠 UI 小修冒充完成的问题

1. 规则书同层一级入口里的 `执行事件 / 升级军备 / 势力行动`，当前正式局只稳定暴露了：
   - 势力行动按钮列
   - 已识别军备牌直入预览；未识别军备牌不再退回抽象 `upgrade-armament`
2. 正式局仍缺：
   - 规则书口径的“打出哪张事件牌”
   - 规则书口径的“打出哪张军备牌”
3. 这不是按钮文案问题，而是正式手牌对象只补到了 atlas05 已确认普通手牌的局部身份：
   - 人物 / 剧本 / 纪年 / 牌背已能稳定记录 `cardKind / cardDefId`
   - atlas05 的 23 张已确认普通事件 / 军备 / 战术牌已能稳定记录 `cardKind / cardDefId / armamentId`
   - 银两、事件效果全集和战术时机仍没有完整运行时闭环
4. 在正式手牌真相表与行动语义补齐前，不得把教程里的 `event-action / armament-upgrade` 示例链说成“正式局手牌一级入口已经完成”。

### D. 当前收工门槛

只有同时满足下面两层，七大恨才可进入“正式流程收口”口径：

1. 教程层：
   - 章节与文案按规则顺序教学
   - 截图链能看出玩家如何完成一个真实主循环和关键规则面
2. 正式进行页：
   - 一级入口全集已按规则或明确缺口被审清
   - 上屏文案不再误导动作顺序
   - 真正承接点击的对象与提示 UI 已拆清
   - 若某个规则书级一级入口尚未实现，必须明确记为正式流程缺口，不能再报“新游戏完成”

## 当前教程文案与步骤问题清单

> 这一段只根据当前 `tutorial.ts` 与当前中英文语言包记录运行态真相，不代表已实施新文案。

### 1. 基础教程的首个主操作仍未落在当前玩家第一层真实选择上

- 当前 `basic-opening` 的步骤顺序是：
  - `welcome`
  - `hand-limit`
  - `hand-resource`
  - `wheel-first`
  - `wheel-move`
  - `after-wheel`
  - `pick-action`
  - `pay-cards`
  - `action-result`
  - `morale-level`
  - `wheel-action`
- 这轮实施后，基础章首个 `requireAction` 已改成 `wheel-move`，也就是先在轮盘本体上做首回合第一段真实选择。
- 但规则书级“完整首回合”仍要求：
  - 检查手牌上限
  - 转动轮盘
  - 再在 `手牌行动 / 轮盘行动` 之间决定先做哪一个
- 因此这轮已经收掉“首个主操作跳过轮盘真实选择”的错误，但是否还要继续做到“玩家先在手牌行动与轮盘行动之间自己决定先后”，仍属于后续运行态缺口，不可误报为正式局完整收口。

### 1.1 信息步骤的真实摘要承接已经补齐一层

- 当前 `Board.tsx` 已改为按教程步骤的高亮目标判断是否展示结算摘要：
  - 只要教程步骤高亮 `qidahen-season-summary`，即使前景还有主动交互面板，也会保留真实摘要。
  - 这覆盖攻城、外交、年中、新年、朝鲜耗损这类“看结果”的教程信息步骤。
- 当前 `e2e/qidahen/qidahen-closeout.e2e.ts` 不再断言这些步骤没有摘要，而是断言摘要里出现真实结果词：
  - 攻城：`战后围城`、`战后占领`、`山海关`
  - 外交：`轮盘外交/雇佣`、`外交 1：宁远 已放置 大明友好标记`、`外交 2：宁远 已翻为 大明附庸`、`外交 3：东江 的控制标记已移除`、`雇佣军`
  - 年中：`年中结算`
  - 新年：`新年结算`
  - 朝鲜：`朝鲜耗损`、`非朝鲜区域`
- 2026-07-03 已继续补强年中/新年 E2E 核心状态证据：
  - 年中摘要正文断言 `土地税赋 / 战败标记 / 非朝鲜区域`，同时读核心状态确认大明、蒙古、后金三方战败标记均归零。
  - 新年防线维护后断言摘要标题为 `新年结算`，正文包含 `维护 / 兵力耗损 / 获得本年纪年卡 / 威望 +1 / 非朝鲜区域`。
  - 同一 E2E 还读核心状态确认年份推进到 `天命五年 1620`、三方顺位数组有效、纪年卡区刷新、蒙古手牌减少且威望 +1、大明新年人物出场。
- 2026-07-03 已继续补强攻城/山海关 E2E 核心状态证据：
  - 城战后进入围城选择时，山海关仍由后金控制，城内人口状态保留。
  - 选择 `围城该区` 后，山海关仍由后金控制，城内人口状态继续保留，同时 `siegeState.attackerFactionId` 为大明且围城兵力大于 0。
  - 2026-07-04 已追加同章占领对照：同一攻城教程从守城宣告、城战待结算进入战后选择后点击 `占领该区`，摘要写入 `战后占领 / 山海关`，核心状态断言山海关控制权改为大明、城内状态与围城状态清空。该证据关闭“攻下所有城市后占领成功”的教程同章对照缺口。
- 这只能证明“教程看结果的承接物已回到真实摘要”，不能外推出正式手牌行动全集已经完成。

### 2. 当前玩家文案里仍有明显作者旁白腔

- 当前玩家可见文案里仍存在大量“这一步 / 这次 / 这里 / 现在先”口吻，例如：
  - `board.setup.description`
  - `tutorial.basic.steps.actionResult`
  - `tutorial.attackAndBattle.steps.moveEntry`
  - `tutorial.siege.steps.defendCity`
  - `tutorial.wheelSharedCost.steps.dispatchReady`
- 这些句子的问题不只是口气不好，而是它们没有稳定落在规则动作名、对象名或结果名上，容易把教程写成作者旁白，而不是游戏本身。

### 3. 基础教程标题与描述的覆盖承诺高于当前实际覆盖

- 当前标题/描述写的是：
  - `开局、轮盘与首回合`
  - `从正式开局走完：检查手牌上限、转动公共轮盘、完成一次手牌行动，再完成一次轮盘行动`
- 但当前基础章实际稳定示范的只有：
  - 一次轮盘真实选择
  - 一次 `赐印招安`
  - 木块等级/士气的单段说明
- 当前仍没有在同一章里完整覆盖：
  - 手牌行动同层其它分支的定位
  - 回合交接结果
  - 事件牌 / 军备牌作为同层手牌行动的地位
- 因此标题虽然比旧版收紧了，但依然只应被视为“基础骨架教学”，不能外推成规则书级完整首回合证明。

### 4. 若干教程句子仍在解释“教学编排”，而不是只解释游戏事实

- 例如：
  - `tutorial.basic.steps.pickAction` 现在本质上在说“这次先点赐印招安”
  - `tutorial.eventAction.steps.chooseAction` 本质上在说“先打出这张大汗令箭事件牌”
- 这些句子虽然比旧版“示范题/为了教学”前进了一步，但仍保留了较强的脚本旁白感，没有完全退回到“规则动作 + 当前收益 + 当前结果”的玩家语义。

### 5. 当前教程体系还没有把“完整主循环”和“规则面扩展”清楚分层

- 当前目录里：
  - `basic-opening` 想承担完整首回合
  - `armament-upgrade`
  - `event-action`
  - `attack-and-battle`
  - `siege-and-occupation`
  - `diplomacy-and-hire`
  - `year-and-characters`
- 但 `basic-opening` 还没有完成它自己标题宣称的“完整首回合”，导致后续章节既像补规则面，也像在补首章本该覆盖的内容。
- 因此当前教程问题已经不是某一句文案长短，而是：
  - 首章真实边界未锁
  - 首章承诺与实际覆盖不一致
  - 玩家第一层真实选择仍未被当成首个主操作去教
