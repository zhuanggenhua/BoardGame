## Context

本 change 包含四个完整派系、51 个唯一卡面、80 张实体牌和 8 张基地。四派系共用一张 `8 x 7` 卡牌 atlas 和一张 `4 x 4` 基地 atlas。

当前工作区已有多个 Smash Up 批次并行修改共享注册文件；本 change 必须把业务逻辑尽量放进独立模块，并把共享文件编辑限制为增量注册。

## Goals / Non-Goals

- Goals:
  - 四派系在正式派系选择入口可选、可初始化、可完整结算。
  - 51 个卡面和 8 张基地使用真实用户/TTS 素材，不使用占位或自绘替代。
  - 每个规则子句都有静态定义、运行时入口、最终权威状态和测试/evidence。
  - 资源链路完成压缩、manifest、R2/CDN 上传和远端回查。
- Non-Goals:
  - 不顺手实现同扩展外的其它派系。
  - 不重写整个 Smash Up 能力框架。
  - 不把 TTS 名称或图片 OCR 直接当作无需复核的最终规则文本。
  - 不在批准前修改运行时共享文件。

## Decisions

### Decision: 每个派系使用独立数据与能力模块

计划新增：

- `data/factions/sumo_wrestlers.ts`
- `data/factions/musketeers.ts`
- `data/factions/mounties.ts`
- `data/factions/luchadors.ts`
- `abilities/sumo_wrestlers.ts`
- `abilities/musketeers.ts`
- `abilities/mounties.ts`
- `abilities/luchadors.ts`

共享文件只增加 import、registry entry、atlas metadata、base registry 和 faction metadata。

### Decision: 卡牌 atlas 使用单一 `8 x 7` 合同

- 槽位 `0-11`：相扑手
- 槽位 `12-25`：火枪手
- 槽位 `26-37`：骑警
- 槽位 `38-50`：摔角手
- 槽位 `51-54`：派系展示卡
- 槽位 `55`：Smash Up 标识

不得为四个派系复制四份相同图片，也不得把派系展示卡或标识格注册为手牌。

### Decision: 基地 atlas 使用单一 `4 x 4` 合同

TTS `CustomDeck 66` 提供《国际事件》基地 atlas。卡组元数据已经确认本 change 使用以下 8 张基地：

- 相扑手：`Heya Training Stable`、`The Dohyo`
- 火枪手：`Bastion Saint-Gervais`、`The Golden Lily`
- 骑警：`Strategic Syrup Reserve`、`Great White North, Eh?`
- 摔角手：`Ringside`、`The Squared Circle`

intake 阶段必须基于基地主裁图锁定断点、VP 和中文正文；TTS 名称只作为 canonical 英文和槽位对照源。

### Decision: implementation 以 effect atom 为最小单位

图片文字需要先裁成单卡并拆分时机、目标、主效果、可选/强制、替代入口、额外效果、持续时间和清理。实现和测试不得只按“整张卡已完成”记录。

### Decision: 一次闭环一个派系

顺序为：

1. 相扑手
2. 火枪手
3. 骑警
4. 摔角手

每个派系必须完成静态数据、能力、基地、L2、L3/L4 和 evidence 后，才能推进下一个派系。

## Risks / Trade-offs

- 51 个唯一卡面规则量较大，整图阅读容易漏限定词。
  - Mitigation: 使用单卡裁图逐张建立规则合同，不从整图直接批量猜测。
- 摔角手存在 `Set-Up` 关联牌，可能需要新的“附着到随从/延迟触发/被特定牌消费”共享语义。
  - Mitigation: 先写 effect atom 与消费合同，再决定是复用已有 ongoing/action-on-minion 机制还是扩展共享层。
- 火枪手存在连续行动/额外行动风格效果，可能触及额外行动额度、顺序和回合内清理。
  - Mitigation: 优先查既有 extra action / extra play 共享链，补 L4 finalState 与清理证据。
- 当前共享文件已有未提交改动。
  - Mitigation: 编辑前后逐文件 diff，仅做最小增量追加，不运行会重排整文件的格式化。

## Migration Plan

1. 完成逐卡/逐基地 intake、冲突裁定和 implementation handoff。
2. 接入共享卡牌 atlas 与基地 atlas 合同。
3. 注册四派系静态数据、基地、locale、metadata 和关键图片。
4. 按派系顺序完成玩法、测试、E2E 和 evidence。
5. 完成统一审计、资源上传、远端回查和 OpenSpec 收口。

## Open Questions

- 英文牌面正文以哪一份官方资料为最终对照源；该问题必须在 intake 中锁定，但不影响本提案的范围判断。
- 中文派系名最终展示采用“摔角手”还是审计旧表中的“摔跤手”；本提案暂按用户图面和常用译名写“摔角手”，实现前在 locale 合同中锁定。
