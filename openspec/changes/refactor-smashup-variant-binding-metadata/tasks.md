## 1. Metadata Model
- [ ] 1.1 盘点当前 Smash Up 变体 surface：ability、interaction、ongoing、base ability、base pool、power modifier
- [ ] 1.2 设计并落地统一的变体绑定元数据结构与读取 helper
- [ ] 1.3 为缺少显式绑定的 POD 家族补初始化期 / 测试期强校验

## 2. Registry Refactor
- [ ] 2.1 让 `abilityRegistry` 只在元数据显式声明 `shared` 时生成 `_pod` alias
- [ ] 2.2 让 `abilityInteractionHandlers`、`ongoingEffects`、`baseAbilities` 读取同一份绑定元数据，移除隐式默认继承
- [ ] 2.3 保留复杂效果函数实现不变，只重构变体绑定与 surface 路由

## 3. Base Pool Refactor
- [ ] 3.1 用显式变体绑定元数据替换零散 `POD_BASE_POOL_VARIANT_FACTIONS` 白名单
- [ ] 3.2 保证 POD 派系选基只返回 `_pod` 基地 id，经典版只返回经典版 id

## 4. Family Migration
- [ ] 4.1 先迁移米斯卡塔尼克大学、神居寺、忍者道场这类基地差异家族
- [ ] 4.2 迁移大法师、达尼奇恐魔、渗透、布朗尼 / 藏身处 / 迷雾笼罩等差异 surface
- [ ] 4.3 收口现有 no-op / baseOnly / override 语义到统一元数据口径

## 5. Validation
- [ ] 5.1 增加“经典版 id 不得绑定 POD-only surface”的回归测试
- [ ] 5.2 增加“POD 基地池不得回退经典版 id”的回归测试
- [ ] 5.3 跑 Smash Up 定向 Vitest，覆盖米斯卡塔尼克大学与同类高风险点
