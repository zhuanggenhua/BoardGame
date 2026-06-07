# Change: Refactor SmashUp modifier variant registration

## Why
Smash Up 当前的力量修正 / 基地力量修正 / 爆破点修正注册，默认通过 `_pod` alias 机制复用基础版逻辑；当某条规则需要自己区分“原版 / POD / 仅原版”时，又要靠 `handlesPodInternally` 这种布尔补丁阻止重复 alias。  
这使“业务规则是什么”和“变体复用策略是什么”被挤在同一个低语义接口里，导致像极地突击队员这样“原版有 ongoing、POD 没有 ongoing”的规则很容易被重复注册。

继续沿用布尔补丁，只会把这类风险留给每个调用点自己记忆。需要做一次最小但正式的重构，把 Smash Up modifier registry 的 POD 变体策略收成显式接口，同时保持现有规则语义不变。

## What Changes
- 为 Smash Up modifier registry 引入显式的变体注册语义，替代外露的 `handlesPodInternally` 布尔补丁。
- 将 modifier 注册区分为稳定的几类意图：
  - 基础版规则自动复用到 POD
  - 规则内部已自行处理原版 / POD 差异
  - 规则只属于基础版，不应自动生成 POD alias
- 将 `ongoing_modifiers.ts` 中标准化的持续力量规则收敛为结构化定义入口，让“规则内容”和“注册方式”处于同一份定义中。
- 迁移 `registerPowerModifier`、`registerBasePowerModifier`、`registerBreakpointModifier` 相关调用点到新的注册 seam，但不改任何卡牌规则语义。
- 保持现有审计输出与 POD 可见性口径，只修正“重复 alias 导致重复计算”的结构性风险。
- 为极地突击队员及同类自管变体规则补回归测试，证明不会再因 alias 重复而双算。

## Impact
- Affected specs:
  - `smashup-modifier-registration`（新增）
- Affected code:
  - `src/games/smashup/domain/ongoingModifiers.ts`
  - `src/games/smashup/abilities/ongoing_modifiers.ts`
  - `src/games/smashup/__tests__/ongoingModifiers.test.ts`
  - `src/games/smashup/__tests__/podPowerModifierRegistration.test.ts`
  - `src/games/smashup/__tests__/abilities/bear-cavalry.test.ts`
