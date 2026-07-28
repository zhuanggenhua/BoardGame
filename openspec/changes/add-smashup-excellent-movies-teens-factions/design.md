## Context

当前图片是一张多派系卡牌拼图，视觉上可初步识别为五组派系：动作英雄（Action Heroes）、返时者（Backtimers）、异形变体（Extramorphs）、青少年（Teens）和怨灵捕手（Wraithrustlers）。仓库已有外星人、极客、时间旅行者、幽灵等旧派系，但图片中的卡名与现有静态数据不匹配，因此本 change 按新派系批次处理，而不是覆盖旧派系。

## Goals / Non-Goals

- Goals: 完成五个 faction 的 intake、静态接入、玩法实现、审计、E2E 和资源远端回查。
- Goals: 将图片来源、外部对照源、缺失基地素材和中文命名裁定写入可复查 evidence。
- Non-Goals: 不重写既有外星人、极客、时间旅行者或幽灵派系；不复用相似旧派系 handler，除非 implementation evidence 证明语义同构。

## Decisions

- Decision: 采用 `add-smashup-excellent-movies-teens-factions` 作为独立 OpenSpec change。
  Alternatives considered: 直接追加到未完成的 POD 四派系 change。该 change 范围是探险家、星际旅者、侠义义警和摔角手 POD，和本图不是同一批对象，合并会污染审计边界。
- Decision: implementation 前先建立 intake handoff。
  Alternatives considered: 先写静态数据再补合同。项目 workflow 要求先文档后实现，且图片缺少清晰基地卡，必须先把缺口标为 `blocked/partial/disputed`。
- Decision: 新机制先走共享 runtime/DSL 能力，不在单派系文件里堆一次性逻辑。
  Alternatives considered: 在每个 faction handler 内硬编码。五组派系引入的 stasis、牌库顶使用和幽灵行动都可能被多张卡复用，硬编码会让审计和 E2E 证据不可迁移。

## Risks / Trade-offs

- 图片是低分辨率拼图，卡牌正文和基地素材可能不可完全锁定；intake 阶段必须裁单卡并用官方/项目爬虫对照，无法锁定的字段不得猜。
- 当前工作区已有未提交 Smash Up POD 改动；implementation 开始前需要确认是否先收口或隔离，避免同文件交叉导致归属不清。
- 如果五个 faction 的基地卡未在用户图片中出现，必须在 contract 中明确基地真相源，不能从卡牌拼图推断基地数据。

## Migration Plan

1. 建立图片来源合同、裁图目录和五派系对象清单。
2. 完成 card/base 静态数据、atlas、locale、metadata 和 registry 接入。
3. 按单派系顺序实现机制：动作英雄 → 返时者 → 异形变体 → 青少年 → 怨灵捕手。
4. 每个派系完成 L2 行为测试、至少一条真实入口 L3/L4 E2E、evidence 回写。
5. 批量统一审计、资源发布和 OpenSpec strict validation。

## Open Questions

- 用户图片没有显式 faction header 与基地卡；中文 faction 名称和基地数据需要 intake 阶段通过主真相源/对照源锁定。
- 若用户只希望先 intake 而非完整 gameplay，可在批准前缩小 scope；当前 proposal 按“实装到正式可玩”处理。
