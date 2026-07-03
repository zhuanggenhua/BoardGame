# 七大恨疑似单卡素材 OCR 小批量试跑

> 本文件记录 2026-07-03 对本地疑似单卡图片素材的安全 OCR 小批量试跑。它是阻塞证据和后续人工核读入口，不是正式手牌规则映射。

## 安全读取口径

- 本轮没有把本地图片、图集、完整牌面或图片二进制写入本文件。
- 图片只由本地脚本通过 PIL 读取，再转为数组交给 EasyOCR。
- 原始临时输出位于：
  - `temp/qidahen-asset-source-audit/single-card-ocr-probe/single-card-ocr-probe.json`
  - `temp/qidahen-asset-source-audit/single-card-ocr-probe/single-card-ocr-probe.md`
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
| `ocr-text-no-class-keyword` | 23 | OCR 文本低信息，不能自动确认为普通手牌，也不能自动全部排除 |
| `no-ocr-text` | 6 | 没有可用 OCR 文本，不能提供逐牌字段 |

## 目的交接式读图校正

2026-07-03 已按 `safe-image-reading` 的需求交接式流程补做 4 张代表样本的图片验收：主线程只交接当前需求、业务对象、字段门槛和结果用途；图片处理方只返回字段结论、失败点和下一步，不返回图片或无关视觉描述。

| 序号 | 素材相对路径 | 结果 | 锁定字段 | 失败点或证据 | 下一步 |
| ---: | --- | --- | --- | --- | --- |
| 1 | `Images/httpcloud3steamusercontentcomugc1021699036689083037C7790ACE6A95788F62F18ADDEBCFFD63920E7088.jpg` | `failed` | 牌类=非普通手牌（人物） | 卡面右下角明确标注“人物”，且有“人物判定”段；不是事件、军备、战术或银两普通手牌 | 不进入正式手牌一级入口反写；归入人物/非普通手牌候选 |
| 2 | `Images/httpcloud3steamusercontentcomugc1021698887369622177B4F9F3403271F0ABED1ED031DFB4B2E4A3423762.jpg` | `failed` | 牌类=非普通手牌（部队/标记类图标） | 图片只有“炮”图标，无中文牌名、牌类、规则效果；可确认不是可反写的普通手牌卡面 | 不进入正式手牌一级入口反写；如需用途，转查资源索引或图标/标记分类 |
| 3 | `Images/httpcloud3steamusercontentcomugc16229411697140102206C3F2E496FDE0A0DCFEB563D160B6F3DDB84AE85.png` | `blocked` | 无 | 图片为纯色底块，无可读中文牌名、牌类或规则效果；无法稳定判断是否普通手牌 | 暂不反写；需要同对象的完整卡面图或文本真相源 |
| 4 | `Images/httpcloud3steamusercontentcomugc1021699036693576133826DC58211367901CBF99B8FE7D1BB0898888C78.jpg` | `failed` | 牌类=非普通手牌（牌背） | 图片为牌背图案，无中文牌名、牌类、规则效果；可确认不是正面普通手牌卡面 | 不进入正式手牌一级入口反写；可作为牌背资源处理 |

本次校正说明：安全读图链路本身可用；当前不能关闭 `2.4` 的原因不是“图片不能读”，而是已验收样本没有产出普通事件、军备、战术或银两的逐牌反写字段。后续若继续推进，应按同一交接式流程分批处理剩余图片，并把每张的 `passed / failed / blocked / partial` 写入人工录入矩阵或对应证据文档。

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
- 4 张代表样本已通过需求交接式读图验收，其中 3 张明确为非普通手牌，1 张因纯色底块无法判断；该结果校正了“不能安全读图”的误口径，但没有产生可反写字段。
- `ocr-text-no-class-keyword` 行不能被自动判为普通手牌，也不能被当作逐牌真相源。
- `no-ocr-text` 行不能提供任何可反写字段。
- 因此本批不能关闭 OpenSpec `2.4`，也不能修改正式 `cardKind / cardDefId / armamentId` 映射。

## 后续条件

只有出现以下任一证据，才能重新评估这批素材：

- 更可靠 OCR 产出稳定中文牌名、牌类、效果和军备目标，并经过人工确认。
- 找到可追溯逐牌牌表，与这些素材逐项对应。
- 人工录入矩阵出现满足 `qidahen-hand-card-formal-mapping-contract.md` 的确认行，并通过 `scripts/verify/qidahen-hand-card-manual-entry.mjs`。
