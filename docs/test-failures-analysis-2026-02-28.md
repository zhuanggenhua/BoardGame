# SmashUp 测试失败分析 (2026-02-28)

## 修复进度

- ✅ 修复 `aliens.ts` 和 `ninjas.ts` 中的 `ctx.state.bases` 错误
- ✅ 修复 `baseFactionOngoing.test.ts` 中的测试基础设施问题(添加 `matchState`)
- ✅ 重写 `ninja-hidden-ninja-interaction-bug.test.ts` 使用 `GameTestRunner`
- 测试失败从 27 个减少到 23 个

## 剩余失败分类

### 1. baseFactionOngoing.test.ts (3个失败) - 测试设计问题

**失败测试**:
- `ninja_acolyte: 同基地已使用忍者 special 时被阻止`
- `ninja_hidden_ninja: 同基地已使用忍者 special 时被阻止`
- `specialLimitGroup: 使用 shinobi 后同基地 acolyte 被阻止`

**问题分析**:
- 测试期望忍者卡牌共享 `ninja_special` 限制组
- 实际卡牌定义中每个卡牌有独立的限制组:
  - `ninja_shinobi` → `specialLimitGroup: 'ninja_shinobi'`
  - `ninja_acolyte` → `specialLimitGroup: 'ninja_acolyte'`
  - `ninja_hidden_ninja` → `specialLimitGroup: 'ninja_hidden_ninja'`
- 测试设置 `state.specialLimitUsed = { ninja_special: [0] }` 不匹配实际的限制组名称

**解决方案**:
1. **选项A**: 修改卡牌定义,让所有忍者 special 共享 `'ninja_special'` 限制组
2. **选项B**: 修改测试,使用正确的限制组名称(如 `ninja_acolyte`)
3. **选项C**: 删除这些测试,因为它们测试的是未实现的功能

**推荐**: 选项B - 修改测试使用正确的限制组名称

---

### 2. Igor onDestroy 相关 (4个失败) - 真实代码 bug

**失败测试**:
- `igor-big-gulp-double-trigger.test.ts`: vampire_big_gulp 消灭 Igor 应创建交互
- `igor-ondestroy-idempotency.test.ts` (2个): Igor onDestroy 交互创建问题
- `igor-two-igors-one-destroyed.test.ts`: 两个 Igor 其中一个被消灭

**问题分析**:
- 所有测试都期望 Igor 被消灭时创建交互(选择要消灭的随从)
- 实际执行后 `interaction` 为 `undefined`
- 这是真实的代码 bug: Igor 的 onDestroy 触发器没有正确创建交互

**可能原因**:
1. Igor onDestroy 触发器未注册
2. `processDestroyTriggers` 没有正确调用触发器
3. 触发器创建的交互没有正确返回到 `matchState`

**需要检查**:
- `src/games/smashup/abilities/elder_things.ts` 中 Igor 的 onDestroy 触发器
- `src/games/smashup/domain/ongoingEffects.ts` 中的触发器注册和调用逻辑

---

### 3. meFirst.test.ts (7个失败) - 阶段推进问题

**失败测试**:
- 有基地达标时打开 Me First! 响应窗口
- 有基地达标时跳过无特殊牌玩家
- loopUntilAllPass 相关测试(3个)
- P1 为当前玩家时响应队列
- Me First! 窗口内打出带 interaction 的 special 卡(2个)

**问题分析**:
- 核心问题: `ADVANCE_PHASE` 命令没有将阶段从 `playCards` 推进到 `scoreBases`
- 期望: `expect(result.finalState.sys.phase).toBe('scoreBases')`
- 实际: `phase` 仍然是 `'playCards'`

**可能原因**:
1. FlowSystem 的 `beforeCommand` 钩子没有正确处理 `ADVANCE_PHASE`
2. ResponseWindowSystem 阻止了阶段推进
3. 测试设置的初始状态不正确(如缺少达标基地)

**需要检查**:
- `src/engine/systems/FlowSystem.ts` 中的阶段推进逻辑
- `src/engine/systems/ResponseWindowSystem.ts` 中的 `canAdvance` 检查
- 测试中的 `setupWithBreakpoint` 函数是否正确设置了达标基地

---

### 4. multi-base-afterscoring-bug.test.ts (1个失败)

**失败测试**:
- 完整流程：3个基地依次计分，中间有 afterScoring 交互

**问题分析**:
- 期望: 3 个基地都触发 afterScoring
- 实际: 只有 1 个基地触发
- 这可能是多基地计分链的问题

**需要检查**:
- `src/games/smashup/domain/index.ts` 中的多基地计分逻辑
- `registerMultiBaseScoringInteractionHandler` 的实现

---

### 5. interactionChainE2E.test.ts (2个失败)

**失败测试**:
- `alien_probe` 2步链: `sourceId` 为 undefined
- `multi_base_scoring` 触发链: `ReferenceError: Cannot access 'updatedCore' before initialization`

**问题分析**:
1. alien_probe: 交互的 `sourceId` 字段缺失
2. multi_base_scoring: 代码中有变量初始化顺序问题

**需要检查**:
- `src/games/smashup/abilities/aliens.ts` 中 alien_probe 的交互创建
- `src/games/smashup/domain/index.ts:323` 的变量声明顺序

---

### 6. interactionDefIdAudit.test.ts (1个失败)

**失败测试**:
- 所有 createSimpleChoice 的卡牌选项必须包含 defId

**问题分析**:
- 有 2 个交互的选项缺少 `defId`/`minionDefId`/`baseDefId`
- 这是数据完整性问题

**需要检查**:
- 运行测试获取具体是哪些交互缺少 defId
- 修复对应的 `createSimpleChoice` 调用

---

### 7. ninja-hidden-ninja-interaction-bug.test.ts (1个失败)

**失败测试**:
- 便衣忍者打出后应该创建交互

**问题分析**:
- 重写后的测试仍然失败
- `interaction.current` 为 `undefined`
- 可能是测试设置不正确,或者便衣忍者的能力实现有 bug

**需要检查**:
- 测试的 setup 函数是否正确初始化了所有系统
- 便衣忍者的能力执行器是否正确创建了交互

---

### 8. wizard-archmage 相关 (2个失败)

**失败测试**:
- `wizard-archmage-debug.test.ts`: 从弃牌堆打出大法师 - 详细追踪
- `wizard-archmage-zombie-interaction.test.ts`: 使用"它们不断来临"从弃牌堆打出大法师

**问题分析**:
- 大法师从弃牌堆打出后应该在基地上,但 `archmageOnBase` 为 `undefined`
- 可能是大法师的 onPlay 能力(获得额外行动)没有正确执行

**需要检查**:
- `src/games/smashup/abilities/wizards.ts` 中大法师的能力实现
- 从弃牌堆打出随从的逻辑是否正确

---

### 9. 其他测试 (2个失败)

**bigGulpDroneIntercept.test.ts**:
- 一大口自动解决消灭科学小怪时,雄蜂防止消灭交互正确创建
- 期望 playerId 为 '0',实际为 '1'
- 可能是交互创建时 playerId 参数错误

**newFactionAbilities.test.ts**:
- 投机主义：对手随从被消灭后才给附着随从+1
- 期望有 POWER_COUNTER_ADDED 事件,实际为 undefined
- 可能是触发时机或条件判断有问题

---

## 下一步行动

### 优先级1: 修复测试设计问题
1. 修复 `baseFactionOngoing.test.ts` 中的限制组名称
2. 修复 `interactionChainE2E.test.ts` 中的变量初始化顺序

### 优先级2: 修复真实代码 bug
1. Igor onDestroy 交互创建问题(影响4个测试)
2. meFirst 阶段推进问题(影响7个测试)
3. wizard-archmage 从弃牌堆打出问题(影响2个测试)

### 优先级3: 修复数据完整性问题
1. interactionDefIdAudit 缺少 defId
2. bigGulpDroneIntercept playerId 错误
3. newFactionAbilities 触发时机问题

---

## 总结

23个失败中:
- **测试设计问题**: 5个 (baseFactionOngoing 3个 + interactionChainE2E 2个)
- **真实代码 bug**: 13个 (Igor 4个 + meFirst 7个 + wizard 2个)
- **数据完整性**: 3个 (defId audit 1个 + bigGulp 1个 + newFaction 1个)
- **需要进一步调查**: 2个 (ninja-hidden-ninja 1个 + multi-base-afterscoring 1个)

修复测试设计问题可以快速减少 5 个失败,然后专注于修复真实的代码 bug。
