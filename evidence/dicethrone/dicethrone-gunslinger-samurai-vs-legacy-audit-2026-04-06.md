# DiceThrone 枪手 / 武士对比老派系审计（2026-04-06）

## 审计范围

- 游戏：`dicethrone`
- 新角色：`gunslinger`、`samurai`
- 对照老派系：`monk`、`barbarian`、`pyromancer`、`paladin`、`moon_elf`、`shadow_thief`
- 本轮重点不再只看“新角色自己能不能跑”，而是看它们是否沿用了老派系已经稳定的共享契约：
  - 升级卡状态链
  - 通用卡 `previewRef` / atlas 接线
  - AI 与阶段门禁
  - 技能槽 / 卡牌特写 UI
  - 被动能力建模与时序消费

## 权威来源

- 运行时代码：
  - `src/games/dicethrone/domain/reduceCards.ts`
  - `src/games/dicethrone/domain/commonCards.ts`
  - `src/games/dicethrone/domain/rules.ts`
  - `src/games/dicethrone/domain/flowHooks.ts`
  - `src/games/dicethrone/domain/passiveAbility.ts`
  - `src/games/dicethrone/domain/characters.ts`
  - `src/games/dicethrone/ui/cardPreviewHelper.ts`
  - `src/games/dicethrone/ui/AbilityOverlays.tsx`
- 新角色真相源 / 规则文档：
  - `src/games/dicethrone/rule/枪手录入核对.md`
  - `src/games/dicethrone/rule/枪手卡牌录入核对.md`
  - `src/games/dicethrone/rule/武士录入核对.md`
  - `src/games/dicethrone/rule/武士卡牌录入核对.md`
- 既有审计文档：
  - `evidence/dicethrone/dicethrone-gunslinger-samurai-reaudit-2026-04-05.md`
  - `evidence/dicethrone/dicethrone-gunslinger-samurai-card-preview-audit-2026-04-04.md`
  - `evidence/dicethrone/dicethrone-full-capability-audit-2026-04-05.md`
  - `evidence/dicethrone/dicethrone-new-passives-e2e-test-2026-04-06.md`
  - `evidence/dicethrone/dicethrone-fan-the-hammer-upgrade-e2e-test-2026-04-06.md`

## 对比方法

1. 先用老派系已有稳定实现确定“共享契约”长什么样。
2. 再看枪手 / 武士是否复用同一条链，而不是只看某张牌或某个 UI 现象是否暂时正常。
3. 命中差异后区分：
   - 运行时已错
   - 运行时暂时正确但共享抽象分叉
   - 证据 / 文档口径过度收口

## 逐项结论

### 1. 升级卡状态链：新角色现已与老派系一致

- 老派系稳定契约：
  - 升级卡打出后，升级状态由 `abilityLevels` + `upgradeCardByAbilityId` 记录。
  - 升级卡本体不应再进入 `discard`，否则 UI 会把“已安装升级”和“弃牌”混成同一来源。
- 当前新角色实现：
  - `src/games/dicethrone/domain/reduceCards.ts` 中 `handleCardPlayed` 已对 `card.type === 'upgrade'` 特判，不把升级卡放入弃牌堆。
  - `handleAbilityReplaced` 会统一写入 `abilityLevels` 与 `upgradeCardByAbilityId`。
- 对比结论：
  - 枪手 / 武士当前已经回到和老派系一致的升级状态契约。
  - 这一点和此前“升级牌进弃牌堆”口径相反，旧口径必须视为失效。

### 2. 通用卡 atlas / `previewRef`：新角色现已与老派系共享同一展示合同

- 老派系稳定契约：
  - 运行时手牌图统一走 `previewRef.type = 'atlas'`，以角色自己的 `ability-cards` atlas 为真相源。
- 当前新角色实现：
  - `src/games/dicethrone/domain/commonCards.ts` 中枪手 / 武士都有角色级 `COMMON_ATLAS_INDEX` 映射。
  - `src/games/dicethrone/ui/cardPreviewHelper.ts` 已按“角色 + cardId”取精确 `previewRef`，不再偷用全局首个匹配项。
- 对比结论：
  - 枪手 / 武士虽然通用卡索引不同于老派系默认顺序，但运行时合同已经统一回 `previewRef -> atlas`，不再是另一套 hand atlas 体系。

### 3. AI 与阶段门禁：`card-next-time` 已补回老派系同类防御响应语义

- 老派系稳定契约：
  - 防御响应牌 / token 必须绑定到真实响应窗口，不能在主阶段被当作普通主动牌。
- 当前新角色实现：
  - `src/games/dicethrone/domain/commonCards.ts` 中 `card-next-time` 已带 `pendingDamage.role = 'target'` 与 `responseType = 'beforeDamageReceived'`。
  - `src/games/dicethrone/ai.ts` 的响应动作构建已走 `isCardPlayableInResponseWindow(...)`。
- 对比结论：
  - 枪手 / 武士之前暴露出来的“AI 第一张就打 +6 护盾”属于共享规则漏门禁，不是新角色独有机制。
  - 当前这条链已经回到老派系共享规则上。

### 4. UI 技能槽 / 特写：新角色现已能沿用老派系升级展示逻辑

- 老派系稳定契约：
  - 技能槽升级显示依赖 `abilityLevels` + `getUpgradeCardPreviewRef(...)`，不是靠弃牌堆。
  - 卡牌特写只能消费一次真实“打出升级牌”的事件，不应把升级替换事件再当成第二次打牌。
- 当前新角色实现：
  - `src/games/dicethrone/ui/AbilityOverlays.tsx` 与 `src/games/dicethrone/ui/BoardOverlays.tsx` 已统一按技能槽 + 等级查升级卡图。
  - `useCardSpotlight` 之前的重复消费问题已在前一轮修复。
- 对比结论：
  - 枪手 / 武士当前 UI 主链已对齐老派系的升级展示合同。
  - `左轮速射 II` 本轮额外做了“升级后再点技能槽”的正常对局 E2E，见 `evidence/dicethrone/dicethrone-fan-the-hammer-upgrade-e2e-test-2026-04-06.md`；运行时预期伤害为 `8`，未复现“打出升级卡但技能仍按一级攻击”的问题。

### 5. `Bushido` 曾存在共享抽象缺口，现已在本轮继续收口

- 老派系 / 现有稳定路径至少已经存在两种被动模型：
  - `tithes`：走 `player.passiveAbilities` + `PassiveAbilityDef.trigger`
  - `quick-draw`：走 `player.abilities` 中 `type = 'passive'` + `trigger.type = 'phaseStart'`
- 继续修复前状态：
  - `src/games/dicethrone/heroes/samurai/abilities.ts` 中 `BUSHIDO` 只有 `type: 'passive'` 和描述，`effects` 为空，也没有 `trigger`。
  - `src/games/dicethrone/domain/flowHooks.ts` 却通过硬编码 `playerHasAbility(..., 'bushido')` 在 `upkeep` / `discard -> turn changed` 两个时机单独发 `honor`。
  - 同时它又被 `src/games/dicethrone/domain/characters.ts` 放进 `player.abilities`，并通过 `src/games/dicethrone/ui/AbilityOverlays.tsx` / `abilitySlotMapping` 参与技能槽展示与升级层级。
- 本轮继续修复后状态：
  - `BUSHIDO` 已改成带两个变体的被动定义：`phaseStart(upkeep)` 与 `phaseEnd(discard)`。
  - `flowHooks` 中原先按 `abilityId === 'bushido'` 的武士特判已删除，改为通用 passive phase trigger 分发。
  - 具体规则语义通过 `samurai-bushido-start-turn` / `samurai-bushido-end-turn` custom action 执行，但触发时机已经能从静态定义直接读出。
- 修复判定：
  - 原 `D3/D23/D33` finding 已在本轮实现层收口，不再保留“空壳定义 + 旁路硬编码”的第三条被动路径。
  - 当前 `Bushido` 仍保留在 `player.abilities` 中承担技能槽展示职责，但它现在已经同时具备真实 trigger 合同，不再是假冒可执行定义的展示壳。

## Findings

### P1（已修复）：`Bushido` 曾绕过共享被动抽象，靠 `flowHooks` 的角色 ID 硬编码维持正确性

- 修复前证据：
  - `src/games/dicethrone/heroes/samurai/abilities.ts` 中 `BUSHIDO` 为空定义。
  - `src/games/dicethrone/domain/flowHooks.ts` 在两个位置直接判断 `playerHasAbility(..., 'bushido')`。
  - `src/games/dicethrone/domain/passiveAbility.ts` 并不知道 `phaseStart` / `turn-end reward` 这类被动。
- 修复后证据：
  - `BUSHIDO` 已声明自己的 `phaseStart` / `phaseEnd` trigger 变体。
  - `flowHooks` 改为按通用 passive phase trigger 分发，不再保留 `bushido` 角色特判。
- 为什么这条当时必须按高优先级处理：
  - 只审武士自己时，行为测试会绿，看起来“规则已实现”。
  - 但和 `tithes` / `quick-draw` 对比后，才会发现它没有沿用任何现成共享被动模型，而是第三条特例路径。
  - 如果旁路那两段 `flowHooks` 不存在，它立刻就是功能级重大 bug；因此它从来不是“小问题”，只是当时处于“行为正确、结构错误”的形态。

### P2：此前“枪手 / 武士已收口”的 evidence 主要按单点问题写，缺少一次强制的老派系对比审计

- 证据：
  - 既有文档大量覆盖 atlas、调试发牌、spotlight、compare-roll、bushido/quick-draw 个案。
  - 但缺少一份把“升级卡、previewRef、AI 阶段门禁、被动建模、UI 升级展示”同时拿来和老派系并排核对的文档。
- 判定：
  - 这不是“文档写少了”这么简单，而是流程门禁缺了一条“新角色必须和成熟旧角色做共享契约对比”的规范。

## 为什么会这样

1. 过去的审计更像“打补丁式专项复核”，谁报 bug 就补谁的证据，导致看到的是很多局部文档，不是一条共享契约总图。
2. 新角色接入时，资源链、规则链、UI 链、AI 链是分批修的；每次只盯当前症状，容易把“当前症状消失”误写成“已与老派系完全一致”。
3. DiceThrone 现在至少同时存在三种被动实现口径：
   - `player.passiveAbilities`
   - `ability.type = 'passive' + trigger`
   - `flowHooks` 直接按 `abilityId` 做角色特判
   只要文档不强制做“同类机制单一建模或显式登记例外”，以后还会继续分叉。
4. 过去的审计更偏“运行时有没有触发”，没有强制检查“定义层是不是自洽”。这会让“空壳定义 + 旁路实现”躲过首轮审计，因为行为测试会绿，但静态合同其实已经断开。
5. 本轮又补到一个口径风险：在 DiceThrone 的 `ATTACK_INITIATED / offensiveRoll` 阶段，`pendingAttack.damage` 不是稳定真相源；若审计人员直接盯这个字段，会把共享状态约定误判成“某张升级牌没生效”。这一点必须写进后续规范。

## 建议更新的规范

### 1. 通用审计规范

- 新增“新对象对成熟旧对象的共享契约对比”门禁：
  - 新角色 / 新派系 / 新模块只要复用了旧系统，审计时必须至少选 1 个成熟旧对象做并排比对。
  - 不允许只写“新对象自己现在能跑”。
  - 若本轮结论涉及“某阶段伤害/升级是否成立”，必须显式写出使用的真相源字段或统一查询函数；禁止默认把任意中间态字段当最终判据。

### 2. DiceThrone 角色 intake 规范

- 新角色 intake 完成前，必须单独核对这 6 条共享契约：
  - 升级卡状态落点
  - `previewRef` / atlas 接线
  - 通用卡索引差异是否已显式登记
  - AI / 阶段门禁
  - UI 技能槽 / spotlight
  - 被动能力走哪条共享抽象
  - 攻击发起阶段的伤害真相源（`pendingAttack.damage` 还是 `getPendingAttackExpectedDamage(...)`）
- 如果同类语义被拆进 `abilities`、`passiveAbilities`、`flowHooks` 多条路径，必须在角色规则文档和 evidence 里显式写“为什么例外”，不能默认算“已收口”。

## 本轮验证

```powershell
node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/cross-hero.test.ts --configLoader native --maxWorkers 1
npm run typecheck
node scripts/infra/run-e2e-single.mjs ci e2e/dicethrone/dicethrone-hero-mechanics.e2e.ts "Quick Draw：枪手首回合真实 upkeep 后应获得 1 个装填"
node scripts/infra/run-e2e-single.mjs ci e2e/dicethrone/dicethrone-hero-mechanics.e2e.ts "Bushido：武士首回合 upkeep 与回合末少于 3 次进攻掷骰时都应获得荣誉"
```

说明：

- `cross-hero.test.ts` 通过，覆盖了 `Bushido` 开局 honor、回合末 honor、3 次进攻掷骰门槛，以及本轮新增的“`Bushido` 不再是空壳定义”断言。
- `card-cross-audit.test.ts` 属于仓库默认排除的 `*audit*.test.ts`，不能直接作为本轮命令门禁；因此本轮不把它写成“已跑通过”的证据。
- 已补真实在线双人 E2E，见 `evidence/dicethrone/dicethrone-new-passives-e2e-test-2026-04-06.md`：
  - 枪手首回合 `Quick Draw` 的 `loaded`
  - 武士首回合 `Bushido` 的 `honor`
  - 武士回合末 `< 3` 次进攻掷骰后的第二层 `honor`

## 未覆盖风险

1. 本轮已补被动相关 UI E2E，但还没有补“武士第 3 次进攻掷骰时不再额外获得 honor”的真实 UI 反证链；该门槛目前仍主要由 `cross-hero.test.ts` 覆盖。
2. `player.passiveAbilities` 与 `ability.type='passive'` 这两套被动体系仍并存；本轮修掉的是 `Bushido` 的第三条旁路，不等于两套体系已经合并。
3. 如果后续决定统一 DiceThrone 被动系统，仍需要单开一轮架构变更，而不是继续靠 custom action + phase trigger 逐个收口。

## 修订记录

- 2026-04-06：
  - 首次把枪手 / 武士放到老派系共享契约下并排审计，而不是只审它们各自的专项问题。
  - 初版结论曾记录：当前剩余主要缺口不是 atlas、升级卡、AI 门禁，而是 `Bushido` 的被动建模仍然分叉。
  - 同日继续修复后：`Bushido` 已改为通用 passive phase trigger 路径，原结构性 finding 已收口；保留的后续议题变为“是否统一 `passiveAbilities` 与 `ability.type='passive'` 两套被动体系”。
  - 同日补充真实在线双人 E2E，并新增 `evidence/dicethrone/dicethrone-new-passives-e2e-test-2026-04-06.md` 作为 UI 侧收口证据；旧的“本轮没有重跑 UI E2E”口径失效。
- 2026-04-10：
  - 后续真实反馈进一步证明：即便新角色与老角色共享契约主链已补齐，也不能直接等价成“UI 体验已完整收口”。
  - 新增 UX 侧补审：`evidence/dicethrone/dicethrone-gunslinger-samurai-ux-reaudit-2026-04-10.md`，专门回写基础 `Loaded` 单骰特写、5 骰汇总文案、token 图标与按钮翻译这几类可见体验缺口。
  - 因此本文今后只能作为“共享契约对比审计”证据，不能再单独作为“枪手 / 武士全部体验已收口”的证明材料。
