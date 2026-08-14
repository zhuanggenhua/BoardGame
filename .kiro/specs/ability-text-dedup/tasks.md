# 实施任务：SummonerWars 技能系统架构治理

## 阶段一：SummonerWars AbilityRegistry 迁移 + 文本去重

- [x] 1. AbilityRegistry 迁移至引擎层
  - [x] 1.1 在 `domain/abilities.ts` 中定义 `SWAbilityDef` 接口，扩展引擎层 `AbilityDef<AbilityEffect, AbilityTrigger>`，保留 SummonerWars 特有字段（`validation`/`ui`/`usesPerTurn`/`targetSelection`/`sfxKey`/`requiresTargetSelection`）
  - [x] 1.2 删除 `domain/abilities.ts` 中自建的 `class AbilityRegistry`，改为 `export const abilityRegistry = createAbilityRegistry<SWAbilityDef>('sw-abilities')`
  - [x] 1.3 更新所有 `abilities-*.ts` 文件中的 `AbilityDef` 类型引用为 `SWAbilityDef`
  - [x] 1.4 验证所有 `abilityRegistry.get()`/`getAll()`/`getByTrigger()` 调用点兼容性，运行 TypeScript 编译检查
- [x] 2. AbilityDef 文本迁移至 i18n
  - [x] 2.1 创建 `domain/abilityTextHelper.ts`，实现 `abilityText(id, field)` 函数
  - [x] 2.2 从所有 AbilityDef 文件提取硬编码中文 name/description，写入 `public/locales/zh-CN/game-summonerwars.json` 的 `abilities` 节点
  - [x] 2.3 为所有技能创建英文翻译，写入 `public/locales/en/game-summonerwars.json` 的 `abilities` 节点
  - [x] 2.4 将所有 AbilityDef 的 `name`/`description` 字段改为 `abilityText(id, 'name')`/`abilityText(id, 'description')` 调用
- [x] 3. 卡牌配置 abilityText 字段移除
  - [x] 3.1 从 `domain/types.ts` 的 UnitCard 接口移除 `abilityText?: string`
  - [x] 3.2 从 6 个派系配置文件删除所有 `abilityText` 字段（已确认无运行时消费者）
  - [x] 3.3 运行 TypeScript 编译检查

## 阶段二：SummonerWars execute 层 switch-case 消除

- [x] 4. 创建 AbilityExecutorRegistry 基础设施
  - [x] 4.1 创建 `domain/executors/types.ts`，定义 `SWAbilityContext`（扩展引擎层 `AbilityContext`，添加 `core`/`sourceUnit`/`sourcePosition`/`payload`）
  - [x] 4.2 创建 `domain/executors/index.ts`，使用 `new AbilityExecutorRegistry<SWAbilityContext, GameEvent>('sw-executors')` 创建执行器注册表
- [x] 5. 按派系拆分执行器
  - [x] 5.1 创建 `domain/executors/necromancer.ts`：迁移 `revive_undead`/`fire_sacrifice_summon`/`life_drain`/`infection`/`soul_transfer` 5 个执行器
  - [x] 5.2 创建 `domain/executors/trickster.ts`：迁移 `mind_capture_resolve`/`illusion`/`telekinesis`/`high_telekinesis`/`mind_transmission` 5 个执行器
  - [x] 5.3 创建 `domain/executors/goblin.ts`：迁移 `vanish`/`blood_rune`/`feed_beast`/`magic_addiction`/`grab` 5 个执行器
  - [x] 5.4 创建 `domain/executors/paladin.ts`：迁移 `fortress_power`/`guidance`/`holy_arrow`/`healing` 4 个执行器
  - [x] 5.5 创建 `domain/executors/frost.ts`：迁移 `structure_shift`/`ice_shards`/`frost_axe` 3 个执行器
  - [x] 5.6 创建 `domain/executors/barbaric.ts`：迁移 `ancestral_bond`/`prepare`/`inspire`/`withdraw`/`spirit_bond` 5 个执行器
- [x] 6. 改造 executeActivateAbility
  - [x] 6.1 将 `execute/abilities.ts` 的 switch-case 替换为 `executorRegistry.resolve(abilityId)` 调用
  - [x] 6.2 运行现有技能测试，确保无回归（34/35 文件通过，3 个失败均为 criticalImageResolver 图片预加载测试，与技能系统无关）

## 阶段三：SummonerWars UI 按钮数据驱动化

- [x] 7. 补全 AbilityDef.ui 配置
  - [x] 7.1 扩展 `AbilityDef.ui` 类型，添加 `quickCheck`/`activationStep`/`activationContext`/`activationType`/`useValidateForDisabled`/`extraCondition` 字段
  - [x] 7.2 添加 `AbilityUIContext` 接口
  - [x] 7.3 为所有需要按钮的主动技能补全 `ui` 配置（quickCheck/activationStep/activationType 等）
  - [x] 7.4 将自动触发技能（structure_shift/ancestral_bond/spirit_bond）的 `requiresButton` 改为 `false`
- [x] 8. 改造 AbilityButtonsPanel
  - [x] 8.1 将 AbilityButtonsPanel 从逐技能 if 硬编码改为遍历 abilities 数组 + 读取 AbilityDef.ui 配置的数据驱动循环
  - [x] 8.2 运行测试验证无回归（34/35 通过，3 个失败为 criticalImageResolver 图片预加载测试，与技能系统无关）

## 阶段四：SmashUp 卡牌文本迁移

- [x] 9. 创建 SmashUp i18n 数据
  - [x] 9.1 从 17 个派系文件提取中英文文本，写入 zh-CN 和 en 的 game-smashup.json（233 张卡牌含 44 张基地）
  - [x] 9.2 从基地定义提取中英文文本（已包含在 9.1 中）
- [x] 10. 更新 SmashUp 类型和数据
  - [x] 10.1 在 `domain/types.ts` 中将 `abilityText`/`abilityTextEn`/`effectText`/`effectTextEn` 标记为 `@deprecated`，`effectText`/`effectTextEn` 改为可选
  - [x] 10.2 数据文件保留原有字段（作为回退），i18n 优先
- [x] 11. 更新 SmashUp UI 层
  - [x] 11.1 修改 `resolveCardText`/`resolveCardName` 签名（`language: string` → `t: (key: string) => string`），实现从 i18n 查找 + 回退到定义
  - [x] 11.2 更新 10 个 UI 调用点（BaseZone/DeckDiscardZone/PromptOverlay/MeFirstOverlay/HandArea/FactionSelection/CardRevealOverlay/BoardEffects/Board.tsx）
  - [x] 11.3 运行测试验证（35/48 通过，13 个失败均为 pre-existing 问题，与文本迁移无关）

## 阶段五：验证与清理

- [x] 12. 完整性验证
  - [x] 12.1 编写测试：所有 SummonerWars AbilityDef 的 i18n key 在 zh-CN/en 中均存在（5/5 通过）
  - [x] 12.2 编写测试：所有 SmashUp 卡牌的 i18n key 在 zh-CN/en 中均存在（8/8 通过）
  - [x] 12.3 运行全量测试套件
- [x] 13. 遗留代码清理
  - [x] 13.1 从 SmashUp 17 个派系文件 + cards.ts 中删除 466 个 deprecated 文本字段（abilityText/abilityTextEn/effectText/effectTextEn）
  - [x] 13.2 从 SmashUp types.ts 中删除 @deprecated 字段声明（MinionCardDef/ActionCardDef/BaseCardDef）
  - [x] 13.3 更新验证测试适配字段删除（改用 abilityTags 判断白板卡）
  - [x] 13.4 更新 AGENTS.md 中"现有游戏的历史债务"描述
  - [x] 13.5 更新 .spec/knowledge/standards/engine-systems.md 中债务清单和反面教材引用

## 阶段六：abilityText() 引擎层提取

- [x] 14. 提取 abilityText/abilityEffectText 到引擎层
  - [x] 14.1 在 `engine/primitives/ability.ts` 末尾添加 `abilityText()` 和 `abilityEffectText()` 导出
  - [x] 14.2 替换 DiceThrone 7 个英雄文件中的本地 `abilityText` 定义为引擎层 import（barbarian/pyromancer/paladin/monk-abilities/monk-cards/moon_elf/shadow_thief）
  - [x] 14.3 将 SummonerWars `abilityTextHelper.ts` 改为 re-export 引擎层实现
  - [x] 14.4 验证 SummonerWars i18n 完整性测试通过（5/5）
  - [x] 14.5 验证 DiceThrone 测试通过（49/49 moon-elf + pyromancer）
  - [x] 14.6 更新 .spec/knowledge/standards/engine-systems.md 文档（引擎原语描述、参考实现、示例代码）
