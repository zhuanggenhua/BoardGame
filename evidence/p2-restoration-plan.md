# P2 测试恢复计划

## 背景

P2 验证发现约 8-10 个文件的测试用例确实缺失，需要评估恢复必要性。

## 恢复优先级

### ⭐⭐⭐ 高优先级（核心机制）

#### 1. DiceThrone 护盾系统测试 (`shield-cleanup.test.ts`)

**缺失测试**：
- ❌ `describe('终极技能（Ultimate）护盾免疫', ...)`
  - `it('Ultimate 伤害不被护盾抵消', ...)`
  - `it('非 Ultimate 伤害仍被护盾正常抵消', ...)`
  - `it('无 pendingAttack 时护盾正常工作（非攻击伤害）', ...)`
- ❌ `describe('百分比减免护盾（reductionPercent）', ...)`
  - 多个测试用例

**影响评估**：
- Ultimate 技能的护盾免疫机制是核心战斗机制
- 如果功能仍然存在但缺少测试，容易在重构时引入 bug

**恢复决策**：⚠️ **需要先验证功能是否仍然存在**

**验证步骤**：
1. 检查 `src/games/dicethrone/domain/reducer.ts` 中是否有 Ultimate 护盾免疫逻辑
2. 检查 `pendingAttack.isUltimate` 字段是否仍然存在
3. 如果功能存在 → 恢复测试
4. 如果功能已移除 → 无需恢复

---

#### 2. DiceThrone Token 执行测试 (`token-execution.test.ts`)

**缺失测试**：
- ❌ `it('燃烧：upkeep 造成固定 2 点伤害，状态持续不移除', ...)`
- ❌ `it('燃烧 + 1 层中毒：总共造成 3 点伤害（燃烧2 + 中毒1）', ...)`
- ❌ `it('防御方有潜行时：跳过防御掷骰、免除伤害、潜行不被消耗', ...)`
- ❌ `it('潜行免伤时攻击仍视为成功：onHit postDamage 效果正常触发（如天人合一获得太极）', ...)`

**影响评估**：
- Token 系统（燃烧、中毒、潜行）是核心机制
- 潜行与 onHit 效果的交互是复杂场景，容易出 bug

**恢复决策**：⚠️ **需要先验证功能是否仍然存在**

**验证步骤**：
1. 检查 Token 系统是否仍然支持燃烧、中毒、潜行
2. 检查潜行免伤时 onHit 效果是否仍然触发
3. 如果功能存在 → 恢复测试
4. 如果功能已移除或重构 → 评估是否需要新测试

---

#### 3. SmashUp 寺庙+大副时序测试 (`baseAbilityIntegrationE2E.test.ts`)

**缺失测试**：
- ❌ `describe('集成: base_temple_of_goju + pirate_first_mate 时序', ...)`
  - `it('寺庙 afterScoring 把 first_mate 放牌库底后，大副不再触发移动交互', ...)`
  - `it('寺庙上有多个 first_mate 且未被放牌库底的仍可触发移动', ...)`

**影响评估**：
- 这是多 afterScoring 交互链式传递的典型案例
- `docs/ai-rules/testing-audit.md` 中明确提到这是已知的复杂交互场景
- `docs/ai-rules/engine-systems.md` 中提到多 afterScoring 交互链式传递的 bug 修复

**恢复决策**：⭐⭐⭐ **强烈建议恢复**

**理由**：
1. 这是已知的复杂交互场景，容易出 bug
2. 文档中明确提到这个场景的重要性
3. 测试覆盖这种边缘情况对防止回归非常重要

**验证结果**：✅ **已验证，功能存在**
1. ✅ `base_temple_of_goju` 和 `pirate_first_mate` 仍然存在
2. ✅ `_deferredPostScoringEvents` 机制仍然存在（`src/games/smashup/domain/index.ts:403`）
3. ✅ 现有类似测试：`mothership-scout-afterscore-bug.test.ts`、`miskatonic-scout-afterscore.test.ts`
4. ❌ 但缺少寺庙场景（寺庙会移除随从，更复杂）

**详细验证报告**：见 `evidence/p2-temple-firstmate-verification.md`

---

### ⭐⭐ 中优先级

#### 4. DiceThrone 武僧测试 (`monk-coverage.test.ts`)

**缺失测试**：
- ❌ `describe('闪避后 onHit 效果仍触发', ...)`
  - `it('和谐被闪避后仍获得太极（攻击命中但伤害被免除）', ...)`
  - `it('定水神拳被闪避后仍获得太极+闪避（postDamage onHit 效果）', ...)`

**影响评估**：
- 闪避机制与 onHit 效果的交互是边缘情况
- 如果功能存在，测试覆盖有价值

**恢复决策**：⚠️ 需要验证功能是否存在

---

#### 5-8. 其他中优先级测试

- DiceThrone 圣骑士测试 (`paladin-coverage.test.ts`)
- DiceThrone 视角切换测试 (`viewMode.test.ts`)
- DiceThrone 火法测试 (`pyromancer-behavior.test.ts`)
- SmashUp 僵尸交互链测试 (`zombieInteractionChain.test.ts`)

**恢复决策**：⚠️ 需要逐个验证功能是否存在

---

## 恢复流程

### 第一步：验证功能是否存在

对于每个缺失的测试，执行以下验证：

1. **搜索相关代码**：
   ```bash
   # 示例：验证 Ultimate 护盾免疫
   grep -r "isUltimate" src/games/dicethrone/
   grep -r "Ultimate" src/games/dicethrone/domain/
   ```

2. **检查类型定义**：
   ```bash
   # 检查 pendingAttack 是否有 isUltimate 字段
   cat src/games/dicethrone/domain/types.ts | grep -A 10 "pendingAttack"
   ```

3. **检查 reducer 逻辑**：
   ```bash
   # 检查护盾计算逻辑
   cat src/games/dicethrone/domain/reducer.ts | grep -A 20 "damageShields"
   ```

### 第二步：决定是否恢复

**决策矩阵**：

| 功能状态 | 测试覆盖 | 决策 |
|---------|---------|------|
| 功能存在 | 无其他测试 | ✅ 恢复测试 |
| 功能存在 | 有其他测试 | ⚠️ 评估覆盖率，可选恢复 |
| 功能已移除 | N/A | ❌ 无需恢复 |
| 功能重构 | N/A | ⚠️ 编写新测试 |

### 第三步：恢复测试

如果决定恢复，执行以下步骤：

1. **提取原始测试代码**：
   ```bash
   git show 6ea1f9f:src/games/dicethrone/__tests__/shield-cleanup.test.ts > tmp/shield-cleanup-original.ts
   ```

2. **适配当前代码结构**：
   - 检查 import 路径是否正确
   - 检查类型定义是否变化
   - 检查测试辅助函数是否仍然存在

3. **运行测试验证**：
   ```bash
   npm run test -- shield-cleanup.test.ts
   ```

4. **修复失败的测试**：
   - 如果测试失败，分析原因
   - 如果是代码变化导致，更新测试
   - 如果是功能 bug，修复代码

---

## 下一步行动

### 立即执行（今天）

1. **验证 3 个高优先级测试的功能是否存在**：
   - [ ] Ultimate 护盾免疫
   - [ ] Token 系统（燃烧、潜行）
   - [ ] 寺庙+大副时序

2. **对于功能存在的测试，立即恢复**

### 后续执行（本周）

3. **验证 5 个中优先级测试的功能是否存在**
4. **对于功能存在的测试，评估恢复必要性**

### 长期执行（下周）

5. **验证剩余 57 个 P2 文件**
6. **更新审计方法论文档**

---

## 风险评估

### 不恢复测试的风险

1. **回归风险**：功能存在但缺少测试，重构时可能引入 bug
2. **文档缺失**：测试是功能的活文档，缺少测试意味着功能行为不明确
3. **维护困难**：新开发者不知道功能的边界条件和预期行为

### 恢复测试的成本

1. **时间成本**：每个测试文件约 30-60 分钟（提取、适配、验证）
2. **维护成本**：恢复的测试需要持续维护
3. **技术债务**：如果功能已重构，恢复旧测试可能不合适

### 建议

**优先恢复高优先级测试**，因为：
1. 覆盖核心机制，回归风险高
2. 测试价值明确（如寺庙+大副时序）
3. 文档中明确提到的重要场景

**中优先级测试可选恢复**，取决于：
1. 功能是否仍然存在
2. 是否有其他测试覆盖
3. 时间和资源是否充足
