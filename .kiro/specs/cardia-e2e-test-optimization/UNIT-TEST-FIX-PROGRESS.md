# Cardia 单元测试修复进度（仅卡组一）

**开始时间**: 2025-01-02 16:21
**当前时间**: 2025-01-02 16:30
**范围**: 仅统计卡组一（Deck I）相关测试

---

## 📊 总体进度

### 初始状态（全部测试）
- **总失败用例**: 45 / 303 (14.9%)
- **卡组一失败**: 25 个
- **卡组二失败**: 20 个 (标记为 ⚠️ TODO)

### 当前状态（仅卡组一）
- **卡组一失败**: 20 / 25 (80%) ✅ **-5**
- **已修复**: 5 个 (Random API)
- **待修复**: 20 个
- **卡组一通过率**: ~92%

---

## ✅ 已完成修复（仅卡组一）

### 阶段 1: Random API 不匹配 (P0) - ✅ 完成

**修复时间**: 2025-01-02 16:22-16:24 (2 分钟)
**修复用例**: 5 个（仅卡组一）
**修复文件**: 1 个

#### 修复详情

**傀儡师 (Puppeteer)** - 卡组一 - `group6-special.ts:50`
```typescript
// ❌ 修复前
const randomIndex = Math.floor(ctx.random.random() * opponent.hand.length);

// ✅ 修复后
const randomIndex = Math.floor(ctx.random() * opponent.hand.length);
```

#### 验证结果

```bash
npx vitest run src/games/cardia/__tests__/abilities-group6-special.test.ts

✅ Test Files  1 passed (1)
✅ Tests  24 passed (24) - 包含傀儡师的 5 个测试
```

#### 修复的测试用例（卡组一）

1. ✅ abilities-group6-special.test.ts > 傀儡师 > 应该弃掉相对的牌
2. ✅ abilities-group6-special.test.ts > 傀儡师 > 替换的卡牌不应该触发能力
3. ✅ abilities-group6-special.test.ts > 傀儡师 > 应该使用随机数选择对手手牌
4. ✅ abilities-group6-special.test.ts > 傀儡师 > 应该保持相同的遭遇序号
5. ✅ abilities-group6-special.test.ts > 特殊机制的交互 > 傀儡师替换的卡牌应该保持原有的遭遇序号

---

## ⚠️ 卡组二修复（标记为 TODO）

### 阶段 1: Random API 不匹配 - ⚠️ TODO (5 个)

**影响能力**: 继承者 (Heir)、革命者 (Revolutionary) - 均为卡组二

**修复文件**: 
- `src/games/cardia/domain/abilities/group1-resources.ts:76` (革命者) - ⚠️ TODO
- `src/games/cardia/domain/abilities/group1-resources.ts:146` (继承者) - ⚠️ TODO

**测试用例**:
1. ⚠️ abilities-group1.test.ts > 继承者 > 对手手牌 > 2 张时
2. ⚠️ ability-heir.test.ts > 继承者 > 当对手手牌 > 2 张时
3. ⚠️ ability-revolutionary.test.ts > 革命者 > 应该让对手弃掉 2 张手牌
4. ⚠️ ability-revolutionary.test.ts > 革命者 > 当对手手牌少于 2 张时

**注**: 这些测试已在代码层面修复（Random API），但因为是卡组二能力，标记为 TODO

---

## 🔄 进行中（仅卡组一）

### 阶段 2: 交互系统测试策略 (P1)

**状态**: 规划中
**预计时间**: 2-3 小时
**影响用例**: 10 个（仅卡组一）

#### 决策点

**选项 A (推荐)**: 更新测试以匹配交互系统架构
- ✅ 优点: 符合实际架构，测试真实行为
- ❌ 缺点: 需要重写 10 个测试
- ⏱️ 时间: 2-3 小时

**选项 B**: 简化实现，自动选择派系（临时方案）
- ✅ 优点: 快速修复测试
- ❌ 缺点: 不符合实际架构，未来需要重构
- ⏱️ 时间: 1 小时

**推荐**: 选项 A

#### 待修复测试分类（仅卡组一）

1. **伏击者 (Ambusher)** - 卡组一 (6 个)
   - 需要派系选择交互

2. **宫廷卫士 (Court Guard)** - 卡组一 (2 个)
   - 需要派系选择 + 对手选择

3. **发明家 (Inventor)** - 卡组一 (2 个)
   - 需要两次交互（+3 和 -3）

---

## 📋 待修复（仅卡组一）

### 阶段 3: 功能正确性修复 (P2)

**预计时间**: 1-2 小时
**影响用例**: 9 个（仅卡组一）

#### 3.1 事件数量不匹配 (4 个)

1. **调停者 (Mediator)** - 卡组一 (1 个)
   - 期望 1 事件，实际 2 事件
   - 需要检查是否产生额外的 FACTION_SELECTED 事件

2. **虚空法师 (Void Mage)** - 卡组一 (1 个)
   - 期望空数组，实际返回 `ability_no_valid_target` 事件
   - 需要决定是否保留"无效目标"事件

3. **破坏者 (Saboteur)** - 卡组一 (2 个)
   - 牌库数量不匹配
   - 需要检查弃牌逻辑

#### 3.2 阶段流转逻辑 (5 个)

1. **能力阶段后应进入结束阶段** (2 个)
   - ACTIVATE_ABILITY: 期望 'end'，实际 'play'
   - SKIP_ABILITY: 期望 1 事件，实际 4 事件

2. **持续能力优先级** (3 个)
   - 调停者效果未正确应用
   - 审判官效果未正确应用
   - 调停者/审判官优先级错误

### 阶段 4: 边缘情况修复 (P3)

**预计时间**: 30 分钟
**影响用例**: 1 个

1. **卡牌回收** (1 个)
   - CARD_RECYCLED: 期望手牌 6 张，实际 5 张
   - 需要检查 reduce.ts 中的处理逻辑

---

## ⚠️ 卡组二待修复（标记为 TODO）

### 交互系统未实现 - ⚠️ TODO (15 个)

1. **巫王 (Witch King)** - 卡组二 - ⚠️ TODO (9 个)
2. **图书管理员 (Librarian)** - 卡组二 - ⚠️ TODO (1 个)
3. **派系选择交互** - 通用 - ⚠️ TODO (3 个)
4. **派系过滤逻辑** - 通用 - ⚠️ TODO (2 个)

---

## 📈 预期最终结果（仅卡组一）

### 修复完成后
- **卡组一通过率**: 100% (当前 ~92%)
- **卡组一失败用例**: 0 (当前 20)
- **预计总时间**: 4-6 小时

### 里程碑（仅卡组一）

- [x] 阶段 1 完成: 25 → 20 失败 (5 个修复) ✅
- [ ] 阶段 2 完成: 20 → 10 失败 (10 个修复)
- [ ] 阶段 3 完成: 10 → 1 失败 (9 个修复)
- [ ] 阶段 4 完成: 1 → 0 失败 (1 个修复)

### 卡组二（标记为 TODO）

- [ ] 卡组二测试: 20 个失败 - ⚠️ TODO（后续迭代处理）

---

## 📝 下一步行动（仅卡组一）

### 立即行动 (推荐)

1. **决定交互系统测试策略** (选项 A vs 选项 B)
   - 与团队讨论架构决策
   - 评估时间成本 vs 长期收益

2. **开始阶段 2 修复** - 交互系统测试 (10 个用例)
   - 如果选择选项 A: 创建交互系统测试模板
   - 如果选择选项 B: 简化能力实现，自动选择派系

3. **修复功能正确性问题** (P2) - 9 个用例
   - 检查调停者/虚空法师/破坏者实现
   - 检查阶段流转逻辑
   - 检查持续能力应用逻辑

4. **修复边缘情况** (P3) - 1 个用例
   - 检查卡牌回收逻辑

### 备选行动

如果时间紧迫，可以先修复 P2/P3 的功能正确性问题（10 个用例），将交互系统测试留到后续迭代。

---

## 📋 重复测试识别与合并建议

### 重复测试 1: 伏击者能力

**重复文件**:
- `abilities-group1.test.ts` - 伏击者测试（简单）
- `abilities-group7-faction.test.ts` - 伏击者测试（详细）✅ 保留

**建议**: 
- ✅ 保留 `abilities-group7-faction.test.ts`（最详细）
- ❌ 删除 `abilities-group1.test.ts` 中的伏击者测试

### 重复测试 2: 巫王能力 - ⚠️ TODO（卡组二）

**重复文件**:
- `abilities-group1.test.ts` - 巫王测试
- `abilities-group7-faction.test.ts` - 巫王测试（更详细）
- `ability-witch-king.test.ts` - 巫王单独测试

**建议**: 
- ⚠️ TODO: 保留 `abilities-group7-faction.test.ts`
- ⚠️ TODO: 删除其他重复测试

### 重复测试 3: 继承者能力 - ⚠️ TODO（卡组二）

**重复文件**:
- `abilities-group1.test.ts` - 继承者测试
- `ability-heir.test.ts` - 继承者单独测试

**建议**:
- ⚠️ TODO: 保留 `ability-heir.test.ts`
- ⚠️ TODO: 删除 `abilities-group1.test.ts` 中的继承者测试

### 重复测试 4: 革命者能力 - ⚠️ TODO（卡组二）

**重复文件**:
- `ability-revolutionary.test.ts` - 革命者单独测试

**建议**:
- ⚠️ TODO: 保留 `ability-revolutionary.test.ts`
- ⚠️ TODO: 检查并删除其他文件中的重复测试

---

**报告结束**
