## Context

本 change 包含四个完整派系、59 个唯一卡面、80 张实体牌和 8 张基地。四派系共用一张卡牌 atlas，基地则共用《文化冲击》`4 x 3` atlas。

当前工作区已有多个 Smash Up 批次并行修改共享注册文件；其中 `add-smashup-polynesian-voyagers-penguins` 还会使用同一张《文化冲击》基地 atlas。因此本 change 必须把业务逻辑尽量放进独立模块，并把共享文件编辑限制为增量注册。

## Goals / Non-Goals

- Goals:
  - 四派系在正式派系选择入口可选、可初始化、可完整结算。
  - 59 个卡面和 8 张基地使用真实用户/TTS 素材，不使用占位或自绘替代。
  - 每个规则子句都有静态定义、运行时入口、最终权威状态和测试/evidence。
  - 《文化冲击》基地 atlas 在并行 changes 之间只有一个运行时合同。
- Non-Goals:
  - 不顺手实现同扩展的其它派系。
  - 不重写整个 Smash Up 能力框架。
  - 不把 TTS 名称或图片 OCR 直接当作无需复核的最终规则文本。
  - 不在批准前修改运行时共享文件。

## Decisions

### Decision: 每个派系使用独立数据与能力模块

计划新增：

- `data/factions/anansi_tales.ts`
- `data/factions/grimms_fairy_tales.ts`
- `data/factions/russian_fairy_tales.ts`
- `data/factions/ancient_incas.ts`
- `abilities/anansi_tales.ts`
- `abilities/grimms_fairy_tales.ts`
- `abilities/russian_fairy_tales.ts`
- `abilities/ancient_incas.ts`

共享文件只增加 import、registry entry、atlas metadata、base registry 和 faction metadata。

### Decision: 卡牌 atlas 使用单一 `10 x 6` 合同

- 槽位 `0-12`：阿南西传说
- 槽位 `13-30`：格林童话
- 槽位 `31-46`：俄罗斯童话
- 槽位 `47-58`：古代印加人
- 槽位 `59`：标识格

不得为四个派系复制四份相同图片，也不得把标识格注册为卡牌。

### Decision: 基地 atlas 与波利尼西亚人批次共享

《文化冲击》基地图由 TTS `CustomDeck 73` 提供，网格为 `4 x 3`。如果并行 change 已完成该 atlas 注册，本 change 只复用已有 ID 和资源路径；如果尚未注册，则由最先实施的 change 建立唯一共享合同，另一 change 只追加自己的基地槽位映射。

### Decision: implementation 以 effect atom 为最小单位

图片文字需要先裁成单卡并拆分时机、目标、主效果、可选/强制、替代入口、额外效果、持续时间和清理。实现和测试不得只按“整张卡已完成”记录。

### Decision: 一次闭环一个派系

顺序为：

1. 阿南西传说
2. 格林童话
3. 俄罗斯童话
4. 古代印加人

每个派系必须完成静态数据、能力、基地、L2、L3/L4 和 evidence 后，才能推进下一个派系。

## Risks / Trade-offs

- 59 个唯一卡面规则量较大，整图阅读容易漏限定词。
  - Mitigation: 使用已生成的单卡裁图逐张建立规则合同，不从整图直接批量猜测。
- TTS 记录古代印加人基地为 `Cuzcu`，官方 canonical 名称可能为 `Cuzco`。
  - Mitigation: intake 阶段对照官方资料并显式裁定 `defId/nameEn/evidence`。
- 格林童话在 TTS 中使用 `Grimms' Fairy Tales` 标点形式。
  - Mitigation: faction ID 固定为 `grimms_fairy_tales`，显示名称与 canonical 英文在 locale 合同中单独锁定。
- 基地 atlas 与另一个 active change 重叠。
  - Mitigation: 实施前检查并行 change 当前状态，只保留一个 atlas ID、资源路径和 manifest key。
- 当前共享文件已有未提交改动。
  - Mitigation: 编辑前后逐文件 diff，仅做最小增量追加，不运行会重排整文件的格式化。

## Migration Plan

1. 完成逐卡/逐基地 intake、冲突裁定和 implementation handoff。
2. 接入共享卡牌 atlas 与唯一基地 atlas 合同。
3. 注册四派系静态数据、基地、locale、metadata 和关键图片。
4. 按派系顺序完成玩法、测试、E2E 和 evidence。
5. 完成统一审计、资源上传、远端回查和 OpenSpec 收口。

## Open Questions

- 古代印加人基地 canonical 英文名最终采用 `Cuzco` 还是保留 TTS 的 `Cuzcu`。
- 英文牌面正文以哪一份官方资料为最终对照源；该问题必须在 intake 中锁定，但不影响本提案的范围判断。
