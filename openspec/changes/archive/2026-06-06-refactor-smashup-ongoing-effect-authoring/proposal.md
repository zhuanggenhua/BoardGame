# Change: Refactor Smash Up ongoing effect authoring

## Why
Smash Up 当前的持续力量 / 基地力量 / 爆破点类规则，仍然混用三种 authoring 方式：

- 结构化的标准 modifier 定义；
- 带 `podStrategy` 的显式 definition object；
- 直接在业务文件里手写 `selfManaged` 规则函数，自己判断 `_pod`、`sourceControllerId`、`copiedAbilityDefId`、`attachedActions`。

最近这轮问题已经证明，只把 `_pod` alias 注册层收紧还不够。  
即使 registry 不再重复 alias，只要持续效果语义继续散落在手写规则里，仍会不断出现：

- POD 变体覆盖语义只能靠局部约定维持；
- copied / borrowed / sourceControllerId 需要每条规则自己记忆；
- 新增或迁移规则时容易再次写出 raw `defId === 'xxx'` 这类脆弱判断；
- 同类 bug 会以“个别规则漏算 / 双算 / 回流污染”的形式反复出现。

需要正式把 Smash Up 这层持续/静态效果收口成统一 authoring surface，但范围保持在 ongoing/static modifiers，不一口气重写整套 ability system。

## What Changes
- 为 Smash Up 的 ongoing/static modifier 引入统一 authoring surface，覆盖 `power modifier`、`base power modifier`、`breakpoint modifier` 与 copied-power 这类持续数值效果。
- 把 POD 语义正式定义为 `inherit / override / baseOnly`，并要求 runtime 只允许“继承或覆盖”，不允许 `_pod` 规则反向影响基础版。
- 为 copied / borrowed / sourceControllerId 这类持续效果常见语义提供共享 runtime helper，禁止新规则继续直接硬比 raw `defId`。
- 将 `selfManaged` 保留为兼容逃生舱，但标记为 legacy authoring；标准形态的新规则必须优先走结构化 surface。
- 允许渐进迁移：先迁高风险持续效果规则，不做整套能力系统的大爆炸替换。

## Impact
- Affected specs: `smashup-ongoing-effect-authoring`
- Affected code:
  - `src/games/smashup/abilities/ongoing_modifiers.ts`
  - `src/games/smashup/domain/ongoingModifiers.ts`
  - `src/games/smashup/domain/ongoingEffects.ts`
  - `src/games/smashup/__tests__/podPowerModifierRegistration.test.ts`
  - `src/games/smashup/__tests__/ongoingModifiers.test.ts`
  - `src/games/smashup/__tests__/yuanhouFactionAbilities.test.ts`
