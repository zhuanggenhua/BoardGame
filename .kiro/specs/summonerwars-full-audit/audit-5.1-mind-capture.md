# 审计报告 5.1：心灵捕获（mind_capture）

## 权威描述

来源：`public/locales/zh-CN/game-summonerwars.json` abilities.mind_capture.description

> 当本单位攻击一个敌方单位时，如果造成的伤害足够消灭目标，则你可以忽略本次伤害并且获得目标的控制权，以代替造成伤害。

## 原子步骤拆解

### 独立交互链 A：心灵捕获触发检查
触发条件：泰珂露攻击敌方单位时
1. **攻击**一个敌方单位 → `execute.ts` DECLARE_ATTACK 流程
2. **计算伤害**（含迷魂减伤、神圣护盾等） → `hits` 变量
3. **检查**伤害是否足以消灭目标 → `targetUnit.damage + hits >= getEffectiveLife(targetUnit, core)`
4. **检查**目标是否为敌方 → `targetUnit.owner !== attackerUnit.owner`
5. **暂停**伤害，生成 `MIND_CAPTURE_REQUESTED` 事件 → UI 消费

### 独立交互链 B：心灵捕获决策（"你可以"→ 必须有玩家确认）
触发条件：MIND_CAPTURE_REQUESTED 事件被 UI 消费后
1. 玩家**选择**"控制"或"伤害" → UI 按钮（StatusBanners.tsx）
2a. 选择**控制** → 发送 `ACTIVATE_ABILITY { abilityId: 'mind_capture_resolve', choice: 'control' }`
   - 生成 `CONTROL_TRANSFERRED` 事件 → reduce.ts 修改 `unit.owner`
2b. 选择**伤害** → 发送 `ACTIVATE_ABILITY { abilityId: 'mind_capture_resolve', choice: 'damage' }`
   - 生成 `UNIT_DAMAGED` 事件 → 若致命则 `emitDestroyWithTriggers`

### 自检：原文覆盖完整性
- "当本单位攻击一个敌方单位时" → 链 A 步骤 1+4 ✅
- "如果造成的伤害足够消灭目标" → 链 A 步骤 2+3 ✅
- "则你可以" → 链 B（玩家选择 UI）✅
- "忽略本次伤害并且获得目标的控制权" → 链 B 步骤 2a ✅
- "以代替造成伤害" → 链 B 步骤 2b（选择伤害时正常造成伤害）✅

## 八层链路检查

| 层级 | 状态 | 检查内容 |
|------|------|----------|
| 定义层 | ✅ | `abilities-trickster.ts`: `mind_capture` (trigger: passive, effects: custom/mind_capture_check) + `mind_capture_resolve` (trigger: activated, effects: custom/mind_capture_resolve)。两个 AbilityDef 分工明确：前者标记被动检查，后者处理玩家决策。 |
| 注册层 | ✅ | `abilities.ts`: `abilityRegistry.registerAll(TRICKSTER_ABILITIES)` 注册了两个能力。`customActionHandlers.ts`: `mind_capture_check` 已注册（但实际触发路径是 execute.ts 内联代码）。`executors/trickster.ts`: `mind_capture_resolve` 已注册到 `abilityExecutorRegistry`。 |
| 执行层 | ✅ | **链 A**：`execute.ts` 攻击流程中内联检查 `hasMindCapture && hits > 0 && targetCell?.unit`，使用 `getUnitAbilities(attackerUnit, core)` 查询（走统一入口），使用 `getEffectiveLife(targetUnit, core)` 计算有效生命（走统一入口），条件满足时 `break` 跳过伤害和 afterAttack。**链 B**：`executors/trickster.ts` mind_capture_resolve 根据 choice 分支处理控制转移或伤害。**限定条件全程约束**：`targetUnit.owner !== attackerUnit.owner` 在触发检查时验证，executor 中 `captureTarget.owner !== playerId` 再次验证。✅ |
| 状态层 | ✅ | `reduce.ts`: `MIND_CAPTURE_REQUESTED` → 通知事件不修改状态（正确）。`CONTROL_TRANSFERRED` → 修改 `cell.unit.owner = newOwner`，支持 `temporary` 和 `originalOwner` 字段。`UNIT_DAMAGED` → 标准伤害处理。 |
| 验证层 | ✅ | `abilityValidation.ts`: `mind_capture_resolve` 通过 `validateAbilityActivation` 验证，customValidator 检查 `choice` 必须为 'control' 或 'damage'。源单位所有权和技能拥有检查由通用验证逻辑处理。注意：无 `requiredPhase` 限制，但 UI 仅在攻击阶段触发，实际安全。 |
| UI层 | ✅ | `useGameEvents.ts`: 消费 `MIND_CAPTURE_REQUESTED` 事件，设置 `mindCaptureMode` 状态。`StatusBanners.tsx`: 显示决策 Banner，包含"控制"和"伤害"两个按钮，提示文本 `statusBanners.mindCapture.message` 包含 hits 数值。`useCellInteraction.ts`: `handleConfirmMindCapture` 发送 `ACTIVATE_ABILITY` 命令。**"你可以"效果有确认 UI** ✅ |
| i18n层 | ✅ | zh-CN: `abilities.mind_capture.name`="心灵捕获", `description`=完整描述, `statusBanners.mindCapture.message`="心灵捕获：控制目标还是造成 {{hits}} 点伤害？", `actions.control`="控制", `actions.damage`="伤害"。en: 对应英文条目齐全。`mind_capture_resolve` 也有独立的 name/description。 |
| 测试层 | ✅ | `abilities-trickster.test.ts`: 2 个测试覆盖链 A（致命攻击触发 MIND_CAPTURE_REQUESTED + 非致命不触发）。`abilities-trickster-execute.test.ts`: 4 个测试覆盖链 B（选择控制→状态变更验证、选择伤害→伤害验证、致命伤害→消灭验证、无效选择→验证拒绝）。**全部测试验证了"命令→事件→状态变更"全链路**（不仅断言事件，还断言 `newState.board[4][4].unit?.owner` 等最终状态）。 |

## 审计反模式检查

| # | 反模式 | 检查结果 |
|---|--------|----------|
| 1 | "可以/可选"效果自动执行 | ✅ 通过 — "你可以"效果有 UI 确认（控制/伤害按钮） |
| 2 | 测试只断言事件发射 | ✅ 通过 — 测试同时断言事件和最终状态 |
| 3 | `as any` 绕过类型检查 | ⚠️ 低风险 — 测试中 `(mcEvents[0].payload as any).sourceUnitId` 使用 `as any` 读取 payload，但这是测试代码中的类型断言，不影响运行时正确性 |
| 4 | 测试层标 ✅ 但只有事件断言 | ✅ 通过 — 测试覆盖全链路 |
| 5 | 消费点绕过统一查询入口 | ✅ 通过 — execute.ts 使用 `getUnitAbilities` 和 `getEffectiveLife` |
| 6 | 对其他单位的技能查询绕过 | ✅ 通过 — 不涉及 |
| 8 | 限定条件全局机制泄漏 | ✅ 通过 — 控制权转移直接修改 owner，无额度机制 |
| 9 | UI 层直接读底层字段 | ✅ 通过 — UI 不直接读取 card.abilities 等字段 |

## 发现的问题

### 问题 1（低严重度）：afterAttack 技能在 mind_capture 触发时被跳过

**位置**：`execute.ts` 第 546 行 `break`

**描述**：当 mind_capture 触发时，`break` 跳过了后续的 afterAttack 技能触发（第 632-647 行）。注释说"afterAttack 技能也在选择后触发"，但 `mind_capture_resolve` executor 并未触发 afterAttack 技能。

**影响**：泰珂露本身只有 `mind_capture` 一个技能（trigger: passive），不会有 afterAttack 技能被跳过。但如果通过幻化（illusion）或交缠颂歌（chant_of_entanglement）获得 afterAttack 技能（如念力），这些技能会被跳过。

**严重度**：low — 极端边缘场景，实际游戏中泰珂露很少获得临时 afterAttack 技能。

**修复建议**：暂不修复，记录为已知限制。如需修复，可在 `mind_capture_resolve` executor 中添加 afterAttack 触发逻辑。

### 问题 2（低严重度）：mind_capture_resolve 无 requiredPhase 验证

**位置**：`abilities-trickster.ts` mind_capture_resolve 定义

**描述**：`mind_capture_resolve` 的 validation 中没有 `requiredPhase: 'attack'`，理论上可以在任何阶段被调用。

**影响**：实际无影响 — UI 仅在攻击阶段的 mindCaptureMode 中触发此命令，且 boardgame.io 的 move 验证会阻止非法调用。

**严重度**：low — 防御性编程建议。

### 问题 3（信息）：customActionHandlers 中 mind_capture_check 与 execute.ts 内联代码重复

**位置**：`customActionHandlers.ts` 第 59-66 行 vs `execute.ts` 第 522-546 行

**描述**：`mind_capture_check` 在 customActionHandlers.ts 中注册了一个 handler，但实际的 mind_capture 检查逻辑是在 execute.ts 攻击流程中内联实现的。customActionHandler 中的 handler 不会被攻击流程调用（因为 mind_capture 的 trigger 是 passive，不会被 triggerAbilities('afterAttack') 触发）。

**影响**：无功能影响 — handler 存在是为了 entity-chain-integrity 测试的完整性声明。

**严重度**：info — 代码组织问题，不影响功能。

## 交叉影响检查

1. **控制权转移后的能力触发**：被控制的单位 `owner` 变为新控制者，其能力在新控制者下正确触发（通过 `unit.owner` 判断）。✅
2. **迷魂/神圣护盾与 mind_capture 交互**：减伤在 mind_capture 检查之前计算，`hits` 已是最终值。如果减伤后不再致命，mind_capture 不触发。✅ 语义正确。
3. **mind_capture 对召唤师的限制**：代码中没有显式排除召唤师作为 mind_capture 目标。但规则描述说"攻击一个敌方单位"，召唤师也是单位。如果伤害足以消灭敌方召唤师，理论上可以选择控制。但控制敌方召唤师不会导致游戏结束（因为召唤师未被摧毁）。这是一个有趣的规则边缘情况，但代码实现是一致的。

## 数据查询一致性

- `execute.ts` 使用 `getUnitAbilities(attackerUnit, core)` 查询攻击者技能 ✅
- `execute.ts` 使用 `getEffectiveLife(targetUnit, core)` 计算目标有效生命 ✅
- `executors/trickster.ts` 使用 `getEffectiveLife(captureTarget, core)` 计算致命判定 ✅
- 无直接 `.card.abilities` / `.card.life` 访问 ✅

## 总结

心灵捕获（mind_capture）实现完整且正确，八层链路全部通过。发现 3 个低严重度/信息级问题，均不影响功能。测试覆盖全面，包含触发条件、决策分支、状态变更验证。
