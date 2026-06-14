# Change: Refactor Smash Up effect semantic runtime

## Why
Smash Up 现在不是“完全没有保护入口”，而是**语义入口没有成为框架强制路径**。

当前代码已经有部分统一能力，例如：

- 保护注册与查询：`src/games/smashup/domain/ongoingEffects.ts`
- 随从目标过滤：`src/games/smashup/domain/abilityHelpers.ts`
- destroy/move 事件后处理保护拦截：`src/games/smashup/domain/reducer.ts`

但业务层和 modifier 层仍然可以直接扫描 `base.minions`、`attachedActions`、`ongoingActions`，自己决定：

- 哪些对象算“真实目标”
- 哪些对象只是“计数材料”
- 哪些效果要尊重保护 / action / affect / move 语义
- borrowed / copied / POD / controller lens 应该怎么看

这意味着项目目前只有“可选 helper”，没有“引擎拥有的统一 effect semantic runtime”。继续靠派系作者记得调用某个 helper，本质上仍是补洞模型，无法支撑后续更多游戏、新派系和新增效果类型。

当前代码证据已经表明这是结构性问题，而不是单张牌漏修：

- `src/games/smashup/domain/abilityHelpers.ts` 已有 `buildMinionTargetOptions(...)` 与 `buildValidatedDestroyEvents(...)`
- `src/games/smashup/domain/reducer.ts` 已在 destroy / move 后处理里做保护拦截
- 但 `src/games/smashup/domain/ongoingModifiers.ts` 仍把“匹配哪些 attached/base ongoing action”写成 raw runtime 扫描
- `src/games/smashup/abilities/kitty_cats.ts` 仍直接搜场上随从并手写 `affect/action` 保护逻辑
- `src/games/smashup/abilities/ongoing_modifiers.ts` 仍直接在 modifier 内决定哪些对象该计数、哪些对象因保护不该生效

也就是说，项目已经有“局部统一入口”，但还没有“谁都绕不过去的统一语义层”。

## What Changes
- 新增 `smashup-effect-semantics` capability，定义 Smash Up 的统一 effect semantic runtime。
- 把“对象语义”和“效果语义”从业务实现中抽离成运行时真相源，至少覆盖：
  - 目标对象身份与 controller lens
  - target / material / reference 三类语义区分
  - destroy / move / return / control / attach / detach / modifier 等应用入口
  - protection / suppression / variant / copied / borrowed 语义的一致判定
- 要求新能力与新 modifier 通过共享 semantic selector / gateway 表达“查询什么、影响什么”，而不是直接扫描原始数组并手写过滤。
- 收紧 `smashup-ongoing-effect-authoring` 中 `selfManaged` 例外的边界：
  - 允许保留复杂数值公式
  - 不再允许把目标合法性、material 判定、controller/variant 语义继续留在业务层各写各的
- 增加 fail-fast / audit 约束，防止未来继续新增绕过 semantic runtime 的路径。

## Relationship To Existing Changes
- 本提案**不重复** `refactor-smashup-ability-runtime`：
  - 那条线解决“能力如何以 program 执行”
  - 本提案解决“program / modifier / helper 读取和应用对象时，语义由谁拥有”
- 本提案**不重复** `refactor-smashup-effect-dsl-primitives`：
  - 那条线解决“effect primitive 如何成为执行与 footprint 的单一事实源”
  - 本提案解决“primitive 或 legacy helper 读取 target/material/reference 时必须走同一 semantic runtime”
- 本提案**依赖并消费** `refactor-smashup-variant-binding-metadata`：
  - variant metadata 继续是经典版 / POD surface 绑定真相源
  - semantic runtime 必须读取这份 metadata，而不是重新发明另一套 variant 归一规则

## Impact
- Affected specs:
  - `smashup-effect-semantics`（新增）
  - `smashup-ongoing-effect-authoring`
- Affected code:
  - `src/games/smashup/domain/abilityHelpers.ts`
  - `src/games/smashup/domain/ongoingEffects.ts`
  - `src/games/smashup/domain/ongoingModifiers.ts`
  - `src/games/smashup/domain/reducer.ts`
  - `src/games/smashup/abilities/**/*.ts`
  - `src/games/smashup/__tests__/**`
