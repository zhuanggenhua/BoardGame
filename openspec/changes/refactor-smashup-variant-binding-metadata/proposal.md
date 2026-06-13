# Change: Refactor Smash Up variant binding metadata

## Why
Smash Up 当前的经典版 / POD 变体关系同时分散在多处：

- 数据层用 `*_pod` id 和若干 POD 基地覆盖项表达“有这个变体”
- 行为层默认通过 alias 生成器把经典版能力、交互、ongoing 与基地能力自动复制给 POD
- 少数差异规则再靠 `_pod` 显式覆写、no-op 截断或 `baseOnly`/`override` 局部补丁修正
- 选基层再用白名单决定某些 POD 派系是否真的切到 `_pod` 基地 id

这导致“变体关系是什么”和“每个 registry 现在如何猜测它”被拆开维护。米斯卡塔尼克大学暴露的不是单张牌录错，而是这个模型允许：

- 经典版 id 绑到 POD 语义实现
- POD 选基继续发经典版基地 id
- registry 在未声明语义的情况下继续生成 `_pod` alias

继续在现有默认继承模型上补 no-op，只会把风险继续留给每个调用点记忆。需要做一次正式重构，把 Smash Up 变体绑定收为显式元数据，并让 runtime / base pool / 测试统一读取同一份真相源。

## What Changes
- 新增 Smash Up 变体绑定元数据模型，显式声明经典版与 POD 版在各条 surface 上是：
  - `shared`：共享同一实现
  - `separate`：基础版与 POD 版各自独立实现
  - `baseOnly`：只属于经典版
  - `podOnly`：只属于 POD 版
- 去掉 ability / interaction / ongoing / base ability registry 对 `_pod` 的隐式默认继承；只有变体绑定元数据明确允许时，才生成共享 alias。
- 让 Smash Up 基地池构建读取显式的变体绑定元数据，POD 派系必须返回 `_pod` 基地 id，而不是再靠零散白名单切换。
- 为经典版 / POD 差异明显的高风险家族增加强校验：
  - 缺少显式变体绑定时初始化失败
  - 经典版 id 误绑到 POD-only surface 时初始化失败
  - POD 基地池返回经典版 id 时测试失败
- 保留复杂效果执行在代码里，不把 Smash Up 全量改写成纯 DSL；本次只把“变体绑定与选择”改成数据驱动。

## Impact
- Affected specs:
  - `smashup-variant-binding`（新增）
- Affected code:
  - `src/games/smashup/data/cards.ts`
  - `src/games/smashup/domain/abilityRegistry.ts`
  - `src/games/smashup/domain/abilityInteractionHandlers.ts`
  - `src/games/smashup/domain/ongoingEffects.ts`
  - `src/games/smashup/domain/baseAbilities.ts`
  - `src/games/smashup/domain/baseAbilities_expansion.ts`
  - `src/games/smashup/abilities/index.ts`
  - `src/games/smashup/__tests__/factionSelection.test.ts`
  - `src/games/smashup/__tests__/bases/miskatonic-university-base.test.ts`
  - `src/games/smashup/__tests__/baseAbilityIntegrationE2E.test.ts`
  - `src/games/smashup/__tests__/abilities/wizards.test.ts`
  - `src/games/smashup/__tests__/abilities/tricksters.test.ts`
  - `src/games/smashup/__tests__/abilities/elder-things.test.ts`
  - `src/games/smashup/__tests__/abilities/ninjas.test.ts`
