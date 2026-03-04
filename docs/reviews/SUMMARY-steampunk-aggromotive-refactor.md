# 总结：蒸汽机车（steampunk_aggromotive）重构

## 问题发现

你发现了蒸汽机车（Aggromotive）的实现缺陷：

**卡牌描述**：「打出到基地上。持续：如果你有一个随从在此基地，你在这里就拥有+5力量。」

**当前实现**：
- 使用 `registerOngoingPowerModifier('steampunk_aggromotive', 'base', 'firstOwnerMinion', 5)`
- 只给拥有者在该基地的**第一个随从**加成 +5
- 通过这种方式模拟"总战力 +5"的效果

**缺陷**：
- ❌ 第一个随从被消灭 → +5 跳到第二个随从
- ❌ 第一个随从返回手牌 → +5 跳到第二个随从
- ❌ 第一个随从移动到其他基地 → +5 跳到第二个随从
- ❌ 随从顺序改变（如插入新随从到前面）→ +5 可能跳转

**你的质疑**：
> "理应是仅增加总战力不增加某个具体随从的吧"

**你的反思**：
> "审计文档怎么又没审出来"

---

## 审计失败分析

### 1. 审计文档的盲区

**位置**：`.kiro/specs/smashup-full-audit/audit-9.1-steampunks.md:114`

审计标注执行层为 ✅，但实际上：
- 只验证了"给第一个己方随从 +5（避免重复计算）"
- **没有测试随从移除后的行为**
- **没有质疑这个实现方式是否正确**

### 2. 审计维度的缺失

**当前审计维度（D1-D49）中缺少**：

- ❌ **D50：持续效果稳定性**（应该有但没有）
  - 持续效果的目标被移除/移动后，效果是否仍然正确？
  - 检查清单：目标被消灭、返回手牌、移动、顺序改变

### 3. 实现假设的错误

审计假设：
- "给第一个随从 +5" ≈ "总战力 +5"
- 这个假设在**静态场景**下是正确的
- 但在**动态场景**下是错误的

审计没有质疑：
- 为什么要用"给第一个随从 +5"来模拟"总战力 +5"？
- 这种模拟方式在所有场景下都正确吗？
- 有没有更直接的实现方式？

### 4. 测试覆盖的不足

现有测试只覆盖了：
- ✅ 只给 owner 在基地的第一个随从 +5
- ✅ 两张叠加给第一个随从 +10
- ✅ owner 无随从时无效

缺失的测试：
- ❌ 第一个随从被消灭后的行为
- ❌ 第一个随从返回手牌后的行为
- ❌ 第一个随从移动到其他基地后的行为
- ❌ 新随从插入到第一个位置后的行为

---

## 正确实现方案

### 方案 1：基地级别力量修正（推荐）

**核心思路**：在 `getPlayerPowerOnBase` 中添加基地级别的力量修正，而不是随从级别。

**实施步骤**：

1. **扩展类型定义**（`src/games/smashup/domain/ongoingModifiers.ts`）：
   - 添加 `BasePowerModifierContext` 类型
   - 添加 `BasePowerModifierFn` 类型
   - 添加 `basePowerModifiers` 注册表
   - 添加 `registerBasePowerModifier` 函数
   - 添加 `getBasePowerModifiers` 函数

2. **修改 getPlayerPowerOnBase**（`src/games/smashup/domain/types.ts`）：
   - 添加可选参数 `state?: SmashUpCore` 和 `baseIndex?: number`
   - 调用 `getBasePowerModifiers` 获取基地级别修正
   - 返回 `minionPower + basePower`

3. **重新注册蒸汽机车**（`src/games/smashup/abilities/ongoing_modifiers.ts`）：
   ```typescript
   registerBasePowerModifier('steampunk_aggromotive', (ctx) => {
       const count = ctx.base.ongoingActions.filter(
           a => a.defId === 'steampunk_aggromotive' && a.ownerId === ctx.playerId
       ).length;
       
       if (count === 0) return 0;
       
       const hasMinion = ctx.base.minions.some(m => m.controller === ctx.playerId);
       
       return hasMinion ? count * 5 : 0;
   });
   ```

4. **更新所有调用点**：
   - 搜索所有 `getPlayerPowerOnBase` 调用
   - 传入 `state` 和 `baseIndex` 参数

5. **补充测试**：
   - 第一个随从被消灭后，总战力仍然 +5
   - 第一个随从返回手牌后，总战力仍然 +5
   - 第一个随从移动到其他基地后，原基地总战力仍然 +5
   - 没有随从时，总战力不加成

**优势**：
- ✅ 符合"纯计算层"原则（不修改状态，只在计算时调用）
- ✅ 扩展性好（未来其他"基地级别力量修正"可复用）
- ✅ 不引入状态冗余
- ✅ 修改范围可控

---

## 审计流程改进

### 1. 新增审计维度 D50

已添加到 `docs/ai-rules/testing-audit.md`：

**D50：持续效果稳定性（强制）**

**触发条件**：新增/修改持续效果（ongoing/buff/debuff/光环/力量修正）时触发

**核心原则**：持续效果依赖"具体实体"（如"第一个随从"）时，目标移除/移动后效果行为必须符合语义。

**检查清单**：
- [ ] 目标被消灭后，效果是否仍然正确？
- [ ] 目标返回手牌后，效果是否仍然正确？
- [ ] 目标移动到其他位置后，效果是否仍然正确？
- [ ] 目标顺序改变后，效果是否仍然正确？

**代码审查清单**：
- 看到 `'firstOwnerMinion'` 模式时，必须问："第一个随从被移除后会怎样？"
- 看到"模拟总战力"的实现时，必须问："这真的等价于总战力吗？"
- 看到"给第一个/最后一个 XXX"的逻辑时，必须问："顺序变化后会怎样？"

### 2. 更新审计文档

已标注蒸汽机车的实现缺陷，要求修复。

### 3. 补充测试要求

所有使用 `'firstOwnerMinion'` / `'lastOwnerMinion'` 模式的持续效果，必须测试目标移除场景。

---

## 已创建的文档

1. **refactor-steampunk-aggromotive.md** — 完整的重构方案
2. **steampunk-aggromotive-audit-failure-analysis.md** — 审计失败分析
3. **src/games/smashup/__tests__/steampunk-aggromotive-bug.test.ts** — Bug 验证测试
4. **docs/ai-rules/testing-audit.md** — 已添加 D50 维度

---

## 下一步行动

### 立即执行（必须）

1. **实施重构**：
   - 扩展 `ongoingModifiers.ts` 添加基地级别修正系统
   - 修改 `types.ts` 中的 `getPlayerPowerOnBase`
   - 重新注册蒸汽机车
   - 更新所有调用点

2. **补充测试**：
   - 运行 `steampunk-aggromotive-bug.test.ts` 验证问题
   - 补充随从移除/移动场景测试
   - 确保测试通过

3. **更新审计文档**：
   - 在 `.kiro/specs/smashup-full-audit/audit-9.1-steampunks.md` 中标注修复

### 后续排查（推荐）

1. **搜索其他使用 `'firstOwnerMinion'` 的地方**：
   ```bash
   grep -r "firstOwnerMinion" src/games/smashup/
   ```
   - 确认是否有其他卡牌使用相同模式
   - 逐一审查是否有相同问题

2. **搜索其他"第一个/最后一个"逻辑**：
   ```bash
   grep -r "first.*minion\|last.*minion" src/games/smashup/ --include="*.ts"
   ```
   - 审查是否依赖"第一个/最后一个"的位置
   - 验证位置变化后是否仍然正确

---

## 教训总结

### 审计失败的根本原因

1. **审计维度不完整**：缺少 D50（持续效果稳定性）维度
2. **测试覆盖不足**：只测试了静态场景，没有测试动态场景
3. **实现假设错误**：假设"给第一个随从 +5" ≈ "总战力 +5"，但没有质疑这个假设
4. **代码审查不深入**：看到 `'firstOwnerMinion'` 模式时，没有追问"第一个随从被移除后会怎样？"

### 改进措施

1. ✅ **补充 D50 维度**：持续效果稳定性检查
2. ✅ **更新审计文档**：标注蒸汽机车的实现缺陷
3. ⏳ **补充测试**：随从移除/移动场景测试
4. ✅ **代码审查清单**：添加"第一个/最后一个"逻辑的审查问题
5. ⏳ **自动化检查**：创建 Property 测试，自动检查所有使用 `'firstOwnerMinion'` 的地方

### 核心教训

- **不要假设"模拟"等价于"真实"**：用"给第一个随从 +5"模拟"总战力 +5"看起来巧妙，但在动态场景下会出错
- **动态场景必须测试**：所有依赖"第一个/最后一个"的逻辑，必须测试顺序变化场景
- **审计要质疑实现方式**：不能只验证"实现了什么"，还要质疑"为什么这样实现"和"这样实现对吗"
- **用户反馈是最好的审计**：你的一句"随从会被移除的"直接指出了问题核心，比所有自动化工具都有效

---

## 致谢

感谢你发现这个问题并质疑审计流程。这次发现暴露了审计维度的盲区，促使我们：

1. 新增了 D50 维度（持续效果稳定性）
2. 完善了代码审查清单
3. 提高了对"模拟实现"的警惕性
4. 强化了动态场景测试的重要性

这是一次宝贵的学习机会，让审计流程更加完善。
