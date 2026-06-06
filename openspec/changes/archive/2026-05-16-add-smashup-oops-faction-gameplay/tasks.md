## 1. Proposal & Design
- [x] 1.1 确认四个派系的玩法范围、实施顺序与 UI 交互类型边界
- [x] 1.2 记录埋葬体系现状：领域逻辑、玩家可见性、`vampires_pod` 先例与 UI 缺口

## 2. Ancient Egyptians
- [x] 2.1 为 `Ancient Egyptians` 补齐 card defs 的 `abilityTags / subtype / 元数据`
- [x] 2.2 实现 `Mummy / Priest of Anubis / Pharaoh / Pyramid Engineer` 与对应 action/base 能力
- [x] 2.3 补齐埋葬链路 UI：己方埋葬牌可见、对手仅见隐藏占位、翻开/打出流程可操作
- [x] 2.4 从 `Ancient Egyptians` 开始执行首轮规则审计，覆盖 `bury / uncover / 目标基地 / 可见性 / 替代去向` 链路
- [x] 2.5 为 `Ancient Egyptians` 补领域回归测试与 evidence；新交互 E2E 可延后到统一阶段，但审计结论不得延后

## 3. Vikings
- [x] 3.1 为 `Vikings` 补齐 card defs 的 `abilityTags / subtype / 元数据`
- [x] 3.2 实现 `Huscarl / Shield Maiden / Raider / Valkyrie` 与对应 action/base 能力
- [x] 3.3 复用 Ancient Egyptians 的埋葬 UI，并补足跨玩家 bury / forced discard / extra play 联动
- [x] 3.4 完成 `Vikings` 专项规则审计，覆盖 bury/discard/hidden-information 与共享链路扩审
- [x] 3.5 为 `Vikings` 补领域测试与派系 evidence，必要时补最小 E2E 证据

## 4. Cowboys
- [x] 4.1 为 `Cowboys` 补齐 card defs 的 `abilityTags / subtype / 元数据`
- [x] 4.2 实现决斗、手牌数量判定、移动、破坏与金币类效果
- [x] 4.3 为决斗/破坏目标选择补 UI 与交互断言
- [x] 4.4 完成 `Cowboys` 专项规则审计，覆盖 duel / destroy / move / hand-size 判定与共享链路扩审
- [x] 4.5 为 `Cowboys` 补领域测试与派系 evidence，必要时补最小 E2E 证据

## 5. Samurai
- [x] 5.1 为 `Samurai` 补齐 card defs 的 `abilityTags / subtype / 元数据`
- [x] 5.2 实现移动响应、自毁换杀、被破坏替代去向与对应 action/base 能力
- [x] 5.3 为替代去向、响应移动与强制破坏补 UI 与交互断言
- [x] 5.4 完成 `Samurai` 专项规则审计，覆盖 replacement / reactive move / destroy 链路与共享链路扩审
- [x] 5.5 为 `Samurai` 补领域测试与派系 evidence，必要时补最小 E2E 证据

## 6. Cross-faction Audit Rollup & Verification
- [x] 6.1 四个派系全部完成后，汇总四份派系审计结果，复查共享链路与跨派系交互回归
- [x] 6.2 运行相关 Vitest、typecheck 与 OpenSpec 校验
- [x] 6.3 补并运行覆盖“埋葬 / 翻开 / 决斗 / 替代去向”等新交互类型的统一 E2E
- [x] 6.4 输出统一 evidence，总结已实现项、残留风险与后续可扩展点
