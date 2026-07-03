# 七大恨疑似单卡素材 OCR 小批量试跑

> 本文件记录 2026-07-03 对本地疑似单卡图片素材的安全 OCR 小批量试跑。它是阻塞证据和后续人工核读入口，不是正式手牌规则映射。

## 安全读取口径

- 本轮没有把本地图片、图集、完整牌面或图片二进制写入本文件。
- 图片只由本地脚本通过 PIL 读取，再转为数组交给 EasyOCR。
- 原始临时输出位于：
  - `temp/qidahen-asset-source-audit/single-card-ocr-probe/single-card-ocr-probe.json`
  - `temp/qidahen-asset-source-audit/single-card-ocr-probe/single-card-ocr-probe.md`
- 本条端到端链路的覆盖式识图验收产物位于：
  - `test-results/evidence-image-validation/qidahen-formal-handcard-2.4.json`
  - `test-results/evidence-image-validation/qidahen-formal-handcard-2.4.md`
- 本文件只沉淀 OCR 文本摘要、分流结果和完成依据裁决。

## 试跑汇总

- 候选数：33
- 试跑数：33
- 普通牌类关键词独占命中：0
- 普通/非普通混合命中：0
- 命中人物或下野等非普通线索：4
- 只有低信息 OCR 文本：23
- 没有 OCR 文本：6

| 分流 | 数量 | 当前裁决 |
| --- | ---: | --- |
| `ordinary-keyword-only-needs-human-confirmation` | 0 | 没有可进入普通手牌人工确认的独占命中 |
| `mixed-ordinary-nonordinary` | 0 | 没有普通词与非普通词混合命中 |
| `nonordinary-keyword` | 4 | 命中人物或下野等非普通线索，只能作为排除线索 |
| `ocr-text-no-class-keyword` | 23 | 自动 OCR 阶段文本低信息，不能仅凭 OCR 确认为普通手牌或全部排除；后续全量安全读图已继续逐项裁决 |
| `no-ocr-text` | 6 | 没有可用 OCR 文本，不能提供逐牌字段 |

## 目的交接式读图验收

2026-07-03 已按 `safe-image-reading` 的需求交接式流程完成 33 张疑似单卡候选的图片验收：主线程只交接当前需求、业务对象、字段门槛和结果用途；图片处理方只返回字段结论、失败点和下一步，不返回图片或无关视觉描述。

本轮验收门槛是：图片必须能锁定普通事件、军备、战术或银两牌所需的中文牌名、牌类、规则效果摘要，且军备牌还需锁定军备目标；否则不得反写正式 `cardKind / cardDefId / armamentId`。

| 序号 | 素材相对路径 | 结果 | 锁定字段 | 失败点或证据 | 下一步 |
| ---: | --- | --- | --- | --- | --- |
| 1 | `Images/httpcloud3steamusercontentcomugc1021699036693576133826DC58211367901CBF99B8FE7D1BB0898888C78.jpg` | `failed` | 牌类=非普通手牌（牌背） | 只见牌背/封面图案，无中文牌名、牌类、规则效果或军备目标 | 不进入正式手牌一级入口；按牌背资源另行归类 |
| 2 | `Images/httpcloud3steamusercontentcomugc10216990366888826209DCE7BEEDDF5D6C1DF7BF675A257E47B42C514BF.jpg` | `failed` | 牌类=非普通手牌（牌背） | 仅见背面“明”字，无中文牌名、牌类、规则效果正文 | 排除；若要录入需提供正面单卡图 |
| 3 | `Images/httpcloud3steamusercontentcomugc1021699036689083037C7790ACE6A95788F62F18ADDEBCFFD63920E7088.jpg` | `failed` | 牌类=非普通手牌（人物） | 卡面标注人物/人物判定等字段，不是事件、军备、战术或银两普通手牌 | 排除普通手牌入口候选 |
| 4 | `Images/httpcloud3steamusercontentcomugc1021699036689075077ACDDD46C4C8F020B9D8876C3609865A7DEEE0A3F.jpg` | `failed` | 牌类=非普通手牌（人物） | OCR 命中在场时、烧杀掳掠、叛逃/下野、回到人物牌堆等人物牌结算文本 | 排除普通手牌入口候选 |
| 5 | `Images/httpcloud3steamusercontentcomugc10216990366932226383203131DCEBEDB4521FFC6AF95ED69690F2C8A22.jpg` | `failed` | 中文牌名≈卓克图麦吉；牌类=非普通手牌（人物） | OCR 命中人物、在场时、本土区域、漠北援军、建立部队等人物牌字段 | 排除普通手牌入口候选 |
| 6 | `Images/httpcloud3steamusercontentcomugc1021699036689072120C4D34F7E5A459FA9AECBE196F01993379A2F4668.jpg` | `failed` | 牌类=非普通手牌（牌背） | 仅见背面“蒙”字，无中文牌名、牌类、规则效果正文 | 排除；若要录入需提供正面单卡图 |
| 7 | `Images/httpcloud3steamusercontentcomugc1021699036689073142B89E1E7F10B22F11F78870B2BA5AE016A86EDCF0.jpg` | `failed` | 牌类=非普通手牌（人物） | OCR 命中人物、克什克腾部、本土区域、行动前、子点数-1、下野等人物牌文本 | 排除普通手牌入口候选 |
| 8 | `Images/httpcloud3steamusercontentcomugc1021699036689076721BBDE708F11B714F0C8B5D278A21A1E3820868A54.jpg` | `failed` | 牌类=非普通手牌（人物） | OCR 命中来去如风、移动力+1、叛逃、下野、所属人物牌堆等人物牌文本 | 排除普通手牌入口候选 |
| 9 | `Images/httpcloud3steamusercontentcomugc1021699036693569203CFD26EA818FCA38CC2FC46469C05AEFB67ED82D5.jpg` | `failed` | 牌类=非普通手牌（封面/牌背） | 图面只有“七大恨”封面/牌背字样，无中文牌名、牌类、规则效果、军备目标 | 从普通手牌候选中排除 |
| 10 | `Images/httpcloud3steamusercontentcomugc10216990366907757308F837B1501198BB4BBE898AD66E598543BDB6FD3.jpg` | `failed` | 牌类=非普通手牌（封面/牌背） | 图面为龙与罗盘样式牌背/封面，无牌名、牌类、规则效果、军备目标 | 从普通手牌候选中排除 |
| 11 | `Images/httpcloud3steamusercontentcomugc1021698887369622177B4F9F3403271F0ABED1ED031DFB4B2E4A3423762.jpg` | `failed` | 牌类=非普通手牌（部队/标记类图标）；可见文字=炮 | 方形图标/棋子资源，无普通手牌所需中文牌名标题、牌类栏、规则正文 | 不纳入正式手牌一级入口；可转图标/标记资源核对 |
| 12 | `Images/httpcloud3steamusercontentcomugc1021698887369626427CABC8EF194083CC6646923A4450E85C2600EC0B9.jpg` | `failed` | 牌类=非普通手牌（图标/骰面）；可见文字=步 | 方形图标/骰面样式，无手牌牌框、中文牌名、牌类和规则效果文本 | 从普通手牌候选中排除 |
| 13 | `Images/httpcloud3steamusercontentcomugc1021698887369627982EDA7D5B3E8364306C1C9A0BA907105E39710C96E.jpg` | `failed` | 牌类=非普通手牌（图标/骰面）；可见文字=骑 | 方形图标/骰面样式，无手牌牌框、中文牌名、牌类和规则效果文本 | 从普通手牌候选中排除 |
| 14 | `Images/httpcloud3steamusercontentcomugc16229411697140102206C3F2E496FDE0A0DCFEB563D160B6F3DDB84AE85.png` | `blocked` | 无可锁定普通手牌字段 | 近似纯色底块，无稳定可读文字，不满足反写正式字段门槛 | 不作为普通手牌真相源；需补完整卡面或文本来源 |
| 15 | `Images/httpcloud3steamusercontentcomugc162294116971402951111321CBE233A2260D39055DA65921E8548D0D581.png` | `blocked` | 无可锁定普通手牌字段 | 近似纯色底块，无稳定可读文字，不满足反写正式字段门槛 | 不作为普通手牌真相源；需补完整卡面或文本来源 |
| 16 | `Images/httpcloud3steamusercontentcomugc162294116971403257107723BC277C0A70395451EEDC1C8FAF0B2CFE091.png` | `blocked` | 无可锁定普通手牌字段 | 近似纯色底块，无稳定可读文字，不满足反写正式字段门槛 | 不作为普通手牌真相源；需补完整卡面或文本来源 |
| 17 | `Images/httpcloud3steamusercontentcomugc1622941169714035400493E37C06EB2C58583B0264CD72C32F09240D584.png` | `failed` | 牌类=非普通手牌（TTS 材质色块） | 项目素材清单标为 TTS 材质色块：粉色；无文字，不是普通手牌 | 从候选池剔除 |
| 18 | `Images/httpcloud3steamusercontentcomugc16229411697140433211E1CC77ED5F24D9B45F232E58EA4779697B23880.png` | `failed` | 牌类=非普通手牌（TTS 材质色块） | 项目素材清单标为 TTS 材质色块：紫色；无文字，不是普通手牌 | 从候选池剔除 |
| 19 | `Images/httpcloud3steamusercontentcomugc1622941169714044208E33D299DA6DC530893AAF5DEB2ACD281DDC24111.png` | `failed` | 牌类=非普通手牌（TTS 材质色块） | 项目素材清单标为 TTS 材质色块：蓝色；无文字，不是普通手牌 | 从候选池剔除 |
| 20 | `Images/httpcloud3steamusercontentcomugc102169888736962924707AF95CF220ABD3234E184B978947C5932C0B36C.jpg` | `failed` | 中文牌名=蒙古雇佣步兵；牌类=非普通手牌（单位素材） | 项目素材清单归入单位素材；只见兵种字样，不能锁定普通手牌字段 | 不纳入正式手牌一级入口 |
| 21 | `Images/httpcloud3steamusercontentcomugc1021698887369595901E4ADF2B7515572652EFCFD83F4EA3CB7DE5727A8.jpg` | `failed` | 中文牌名=后金正规步兵；牌类=非普通手牌（单位素材） | 项目素材清单归入单位素材；只见兵种字样，不能锁定普通手牌字段 | 不纳入正式手牌一级入口 |
| 22 | `Images/httpcloud3steamusercontentcomugc10216988873696053473D7507798DD18670F90DAC69320D1E253FF32542.jpg` | `failed` | 中文牌名=后金正规炮兵；牌类=非普通手牌（单位素材） | 项目素材清单归入单位素材；只见兵种字样，不能锁定普通手牌字段 | 不纳入正式手牌一级入口 |
| 23 | `Images/httpcloud3steamusercontentcomugc1021698887369607810AFC65D1EAD042E4599AEAAE3BCCE382D40CA75D4.jpg` | `failed` | 牌类=非普通手牌（兵种/组件图标）；可见文字=骑 | 画面仅见“骑”字与图标/点位，无牌名、牌类栏、规则文字 | 从正式手牌候选中排除 |
| 24 | `Images/httpcloud3steamusercontentcomugc10216988873696162384323239B006560B024D4A85E118123E80F30CE66.jpg` | `failed` | 牌类=非普通手牌（兵种/组件图标）；可见文字=步 | 画面仅见“步”字与兵器/点位图标，无正式手牌字段和规则正文 | 从正式手牌候选中排除 |
| 25 | `Images/httpcloud3steamusercontentcomugc102169888736962388024185B87876A17869F8F37E5F68F727FB5F5FDBC.jpg` | `failed` | 牌类=非普通手牌（兵种/组件图标）；可见文字=骑 | 画面仅见“骑”字与马蹄/点位图标，无牌名、牌类、效果文字 | 从正式手牌候选中排除 |
| 26 | `Images/httpcloud3steamusercontentcomugc10216988873696310940F257296B5887B47036BA10ADA4E510BB7A92CE7.jpg` | `failed` | 牌类=非普通手牌（兵种/组件图标）；可见文字=骑 | 画面仅见“骑”字与马蹄/点位图标，无正式手牌应有的规则文字 | 从正式手牌候选中排除 |
| 27 | `Images/httpcloud3steamusercontentcomugc10216988873695911872FBEF8D1F729D453AE307BDEE7BA2A55BDC1924D.jpg` | `failed` | 牌类=非普通手牌（兵种/组件图标）；可见文字=步 | 画面仅见“步”字与兵器/点位图标，无牌名、牌类栏、效果正文 | 从正式手牌候选中排除 |
| 28 | `Images/httpcloud3steamusercontentcomugc1021698887369592695E9178FA3F5ED71C1C61F7CA3BE20B1CB23C636A4.jpg` | `failed` | 牌类=非普通手牌（兵种/组件图标）；可见文字=炮 | 画面仅见“炮”字与炮/点位图标，无正式手牌字段和规则正文 | 从正式手牌候选中排除 |
| 29 | `Images/httpcloud3steamusercontentcomugc102169888736959899848DE406B3358C8A5759A3E5A354CA3834E73F8EF.jpg` | `failed` | 牌类=非普通手牌（兵种/组件图标）；可见文字=炮 | 方形图标/棋子资源，无普通手牌所需中文牌名标题、牌类栏、规则正文；TTS JSON 命中为 `Custom_Tile` | 不纳入正式手牌一级入口 |
| 30 | `Images/httpcloud3steamusercontentcomugc1021698887369565005E7DEC85800C57FB8213316D1F55F0D0BFE0A14A4.jpg` | `failed` | 牌类=非普通手牌（棋子/图标）；可见文字=步 | 方形步兵图标/棋子资源，无普通手牌标题、牌类、规则效果文字 | 不纳入正式手牌一级入口 |
| 31 | `Images/httpcloud3steamusercontentcomugc1021698887369572010B0208AE430093ED759D965BFAA91F9ECF9FDBF49.jpg` | `failed` | 牌类=非普通手牌（棋子/图标）；可见文字=骑 | 方形骑兵图标/棋子资源，无普通手牌标题、牌类、规则效果文字 | 不纳入正式手牌一级入口 |
| 32 | `Images/httpcloud3steamusercontentcomugc102169888736959355480824E13BD4E58516F41B6BD3EFEEE3758A96CBD.jpg` | `failed` | 牌类=非普通手牌（棋子/图标）；可见文字=骑 | 方形骑兵图标/棋子资源，无普通手牌标题、牌类、规则效果文字 | 不纳入正式手牌一级入口 |
| 33 | `Images/httpcloud3steamusercontentcomugc10216988873695824520944EBB04180CC7BE6098E8A387FE01A7653383D.jpg` | `failed` | 牌类=非普通手牌（棋子/势力/区域图标）；可见文字=川 | 方形势力/区域图标类资源，无普通手牌标题、牌类、规则效果文字 | 不纳入正式手牌一级入口 |

本次校正说明：安全读图链路本身可用；当前不能关闭 `2.4` 的原因不是“图片不能读”，而是 33 张候选经目的交接式验收后仍没有任何 `passed` 普通事件、军备、战术或银两牌。结果为 30 张 `failed`、3 张 `blocked`：`failed` 行均能明确排除为人物、牌背、TTS 材质色块、单位或棋子/图标类非普通手牌；`blocked` 行仅阻塞对应纯色底块字段，不能反写正式映射。

流程复核：2026-07-03 已用三张安全预览抽样验证子代理流程。第一次子代理能识图但状态口径不够硬；补充 `safe-image-reading` 状态边界后，第二次子代理返回的人物牌 `failed`、纯色底块 `blocked`、炮图标 `failed` 与主线程安全预览人工对照一致。当前裁决以 `test-results/evidence-image-validation/qidahen-formal-handcard-2.4.json` 为机器校验主产物。

## 分流明细

| 序号 | 素材相对路径 | 尺寸 | 分流 | OCR 摘要 | 当前裁决 |
| ---: | --- | ---: | --- | --- | --- |
| 1 | `Images/httpcloud3steamusercontentcomugc1021699036693576133826DC58211367901CBF99B8FE7D1BB0898888C78.jpg` | 500x678 | `ocr-text-no-class-keyword` | `乡三& / @ / [叁=` | 低信息 OCR；不能确认普通手牌 |
| 2 | `Images/httpcloud3steamusercontentcomugc10216990366888826209DCE7BEEDDF5D6C1DF7BF675A257E47B42C514BF.jpg` | 500x682 | `ocr-text-no-class-keyword` | `贿` | 低信息 OCR；不能确认普通手牌 |
| 3 | `Images/httpcloud3steamusercontentcomugc1021699036689083037C7790ACE6A95788F62F18ADDEBCFFD63920E7088.jpg` | 500x685 | `nonordinary-keyword` | 命中 `人物 / 下野`，OCR 还出现人物牌堆和本土区域等线索 | 非普通手牌线索 |
| 4 | `Images/httpcloud3steamusercontentcomugc1021699036689075077ACDDD46C4C8F020B9D8876C3609865A7DEEE0A3F.jpg` | 500x686 | `nonordinary-keyword` | 命中 `人物 / 下野`，OCR 还出现人物牌堆和本土区域等线索 | 非普通手牌线索 |
| 5 | `Images/httpcloud3steamusercontentcomugc10216990366932226383203131DCEBEDB4521FFC6AF95ED69690F2C8A22.jpg` | 500x688 | `ocr-text-no-class-keyword` | OCR 出现蒙古、本土区域和部队效果类文本，但无普通牌类字段 | 低信息 OCR；不能确认普通手牌 |
| 6 | `Images/httpcloud3steamusercontentcomugc1021699036689072120C4D34F7E5A459FA9AECBE196F01993379A2F4668.jpg` | 500x693 | `ocr-text-no-class-keyword` | `蒙` | 低信息 OCR；不能确认普通手牌 |
| 7 | `Images/httpcloud3steamusercontentcomugc1021699036689073142B89E1E7F10B22F11F78870B2BA5AE016A86EDCF0.jpg` | 500x694 | `nonordinary-keyword` | 命中 `人物 / 下野`，OCR 还出现黄金家族、人物判定等线索 | 非普通手牌线索 |
| 8 | `Images/httpcloud3steamusercontentcomugc1021699036689076721BBDE708F11B714F0C8B5D278A21A1E3820868A54.jpg` | 500x695 | `nonordinary-keyword` | 命中 `人物 / 下野`，OCR 还出现所属人物牌堆等线索 | 非普通手牌线索 |
| 9 | `Images/httpcloud3steamusercontentcomugc1021699036693569203CFD26EA818FCA38CC2FC46469C05AEFB67ED82D5.jpg` | 503x691 | `ocr-text-no-class-keyword` | `恨` | 低信息 OCR；不能确认普通手牌 |
| 10 | `Images/httpcloud3steamusercontentcomugc10216990366907757308F837B1501198BB4BBE898AD66E598543BDB6FD3.jpg` | 504x690 | `ocr-text-no-class-keyword` | 多个噪音字和符号，无稳定牌名或牌类 | 低信息 OCR；不能确认普通手牌 |
| 11 | `Images/httpcloud3steamusercontentcomugc1021698887369622177B4F9F3403271F0ABED1ED031DFB4B2E4A3423762.jpg` | 825x836 | `ocr-text-no-class-keyword` | `炮` | 只见兵种字样，不能确认普通手牌 |
| 12 | `Images/httpcloud3steamusercontentcomugc1021698887369626427CABC8EF194083CC6646923A4450E85C2600EC0B9.jpg` | 825x836 | `ocr-text-no-class-keyword` | `步` | 只见兵种字样，不能确认普通手牌 |
| 13 | `Images/httpcloud3steamusercontentcomugc1021698887369627982EDA7D5B3E8364306C1C9A0BA907105E39710C96E.jpg` | 825x836 | `ocr-text-no-class-keyword` | `骑` | 只见兵种字样，不能确认普通手牌 |
| 14 | `Images/httpcloud3steamusercontentcomugc16229411697140102206C3F2E496FDE0A0DCFEB563D160B6F3DDB84AE85.png` | 836x836 | `no-ocr-text` | 无 | 无 OCR 文本 |
| 15 | `Images/httpcloud3steamusercontentcomugc162294116971402951111321CBE233A2260D39055DA65921E8548D0D581.png` | 836x836 | `no-ocr-text` | 无 | 无 OCR 文本 |
| 16 | `Images/httpcloud3steamusercontentcomugc162294116971403257107723BC277C0A70395451EEDC1C8FAF0B2CFE091.png` | 836x836 | `no-ocr-text` | 无 | 无 OCR 文本 |
| 17 | `Images/httpcloud3steamusercontentcomugc1622941169714035400493E37C06EB2C58583B0264CD72C32F09240D584.png` | 836x836 | `no-ocr-text` | 无 | 无 OCR 文本 |
| 18 | `Images/httpcloud3steamusercontentcomugc16229411697140433211E1CC77ED5F24D9B45F232E58EA4779697B23880.png` | 836x836 | `no-ocr-text` | 无 | 无 OCR 文本 |
| 19 | `Images/httpcloud3steamusercontentcomugc1622941169714044208E33D299DA6DC530893AAF5DEB2ACD281DDC24111.png` | 836x836 | `no-ocr-text` | 无 | 无 OCR 文本 |
| 20 | `Images/httpcloud3steamusercontentcomugc102169888736962924707AF95CF220ABD3234E184B978947C5932C0B36C.jpg` | 844x837 | `ocr-text-no-class-keyword` | `步` | 只见兵种字样，不能确认普通手牌 |
| 21 | `Images/httpcloud3steamusercontentcomugc1021698887369595901E4ADF2B7515572652EFCFD83F4EA3CB7DE5727A8.jpg` | 849x835 | `ocr-text-no-class-keyword` | `步` | 只见兵种字样，不能确认普通手牌 |
| 22 | `Images/httpcloud3steamusercontentcomugc10216988873696053473D7507798DD18670F90DAC69320D1E253FF32542.jpg` | 849x835 | `ocr-text-no-class-keyword` | `炮` | 只见兵种字样，不能确认普通手牌 |
| 23 | `Images/httpcloud3steamusercontentcomugc1021698887369607810AFC65D1EAD042E4599AEAAE3BCCE382D40CA75D4.jpg` | 849x835 | `ocr-text-no-class-keyword` | `骑` | 只见兵种字样，不能确认普通手牌 |
| 24 | `Images/httpcloud3steamusercontentcomugc10216988873696162384323239B006560B024D4A85E118123E80F30CE66.jpg` | 849x835 | `ocr-text-no-class-keyword` | `步` | 只见兵种字样，不能确认普通手牌 |
| 25 | `Images/httpcloud3steamusercontentcomugc102169888736962388024185B87876A17869F8F37E5F68F727FB5F5FDBC.jpg` | 849x835 | `ocr-text-no-class-keyword` | `骑 / 瞒` | 低信息 OCR；不能确认普通手牌 |
| 26 | `Images/httpcloud3steamusercontentcomugc10216988873696310940F257296B5887B47036BA10ADA4E510BB7A92CE7.jpg` | 845x853 | `ocr-text-no-class-keyword` | `骑` | 只见兵种字样，不能确认普通手牌 |
| 27 | `Images/httpcloud3steamusercontentcomugc10216988873695911872FBEF8D1F729D453AE307BDEE7BA2A55BDC1924D.jpg` | 853x856 | `ocr-text-no-class-keyword` | `步` | 只见兵种字样，不能确认普通手牌 |
| 28 | `Images/httpcloud3steamusercontentcomugc1021698887369592695E9178FA3F5ED71C1C61F7CA3BE20B1CB23C636A4.jpg` | 853x856 | `ocr-text-no-class-keyword` | `炮` | 只见兵种字样，不能确认普通手牌 |
| 29 | `Images/httpcloud3steamusercontentcomugc102169888736959899848DE406B3358C8A5759A3E5A354CA3834E73F8EF.jpg` | 853x856 | `ocr-text-no-class-keyword` | `炮` | 只见兵种字样，不能确认普通手牌 |
| 30 | `Images/httpcloud3steamusercontentcomugc1021698887369565005E7DEC85800C57FB8213316D1F55F0D0BFE0A14A4.jpg` | 849x876 | `ocr-text-no-class-keyword` | `步` | 只见兵种字样，不能确认普通手牌 |
| 31 | `Images/httpcloud3steamusercontentcomugc1021698887369572010B0208AE430093ED759D965BFAA91F9ECF9FDBF49.jpg` | 849x876 | `ocr-text-no-class-keyword` | `骑` | 只见兵种字样，不能确认普通手牌 |
| 32 | `Images/httpcloud3steamusercontentcomugc102169888736959355480824E13BD4E58516F41B6BD3EFEEE3758A96CBD.jpg` | 867x873 | `ocr-text-no-class-keyword` | `骑` | 只见兵种字样，不能确认普通手牌 |
| 33 | `Images/httpcloud3steamusercontentcomugc10216988873695824520944EBB04180CC7BE6098E8A387FE01A7653383D.jpg` | 872x879 | `ocr-text-no-class-keyword` | `川` | 低信息 OCR；不能确认普通手牌 |

## 裁决

- 本批没有任何普通事件、军备、战术或银两的确认行。
- 本批没有形成中文牌名、牌类、效果和军备目标的可靠组合。
- 33 张候选已通过需求交接式安全读图验收，其中 30 张明确为非普通手牌/非手牌素材，3 张因纯色底块无法判断；该结果校正了“不能安全读图”的误口径，但没有任何 `passed` 普通手牌行，也没有产生可反写字段。
- `ocr-text-no-class-keyword` 行不能被自动判为普通手牌，也不能被当作逐牌真相源。
- `no-ocr-text` 行不能提供任何可反写字段。
- 因此本批不能关闭 OpenSpec `2.4`，也不能修改正式 `cardKind / cardDefId / armamentId` 映射。

## 后续条件

只有出现以下任一证据，才能重新评估这批素材：

- 更可靠 OCR 产出稳定中文牌名、牌类、效果和军备目标，并经过人工确认。
- 找到可追溯逐牌牌表，与这些素材逐项对应。
- 人工录入矩阵出现满足 `qidahen-hand-card-formal-mapping-contract.md` 的确认行，并通过 `scripts/verify/qidahen-hand-card-manual-entry.mjs`。
