# 重构：steampunk_aggromotive（蒸汽机车）力量修正机制

## 问题分析

### 当前实现的缺陷

**位置**：`src/games/smashup/abilities/ongoing_modifiers.ts:151`

```typescript
// 蒸汽机车（ongoing 行动卡附着在基地上）：拥有者在此基地有随从时，每张 +5 总力量
registerOngoingPowerModifier('steampunk_aggromotive', 'base', 'firstOwnerMinion', 5);
```

**实现方式**：
- 使用 `'firstOwnerMinion'` 模式
- 只给拥有者在该基地的**第一个随从**加成 +5
- 通过这种方式模拟"总战力 +5"的效果

**缺陷**：
1. ❌ 第一个随从被消灭 → +5 跳到第二个随从
2. ❌ 第一个随从返回手牌 → +5 跳到第二个随从
3. ❌ 第一个随从移动到其他基地 → +5 跳到第二个随从
4. ❌ 随从顺序改变（如插入新随从到前面）→ +5 可能跳转

**为什么审计没发现**：
- 审计文档（`.kiro/specs/smashup-full-audit/audit-9.1-steampunks.md:114`）标注执行层 ✅
- 但只验证了"给第一个己方随从 +5（避免重复计算）"
- **没有测试随从移除/移动后的行为**
- 测试层标注为 📝（无专门行为测试）

---

## 正确实现方案

### 方案 1：基地级别力量修正（推荐）

**核心思路**：在 `getPlayerPowerOnBase` 中添加基地级别的力量修正，而不是随从级别。

#### 1.1 扩展类型定义

**文件**：`src/games/smashup/domain/ongoingModifiers.ts`

```typescript
/** 基地级别力量修正上下文 */
export interface BasePowerModifierContext {
    /** 当前游戏状态 */
    state: SmashUpCore;
    /** 基地索引 */
    baseIndex: number;
    /** 基地 */
    base: BaseInPlay;
    /** 玩家 ID */
    playerId: PlayerId;
}

/** 基地级别力量修正函数：返回该玩家在该基地的额外力量 */
export type BasePowerModifierFn = (ctx: BasePowerModifierContext) => number;

/** 基地级别修正注册表 */
const basePowerModifiers: Map<string, BasePowerModifierFn> = new Map();

/** 注册基地级别力量修正 */
export function registerBasePowerModifier(defId: string, modifier: BasePowerModifierFn): void {
    basePowerModifiers.set(defId, modifier);
}

/** 计算玩家在基地的额外力量（来自基地级别修正） */
export function getBasePowerModifiers(
    state: SmashUpCore,
    baseIndex: number,
    playerId: PlayerId
): number {
    const base = state.bases[baseIndex];
    let total = 0;

    // 遍历基地上的所有 ongoing 行动卡
    for (const ongoing of base.ongoingActions) {
        const modifier = basePowerModifiers.get(ongoing.defId);
        if (modifier) {
            total += modifier({ state, baseIndex, base, playerId });
        }
    }

    return total;
}
```

#### 1.2 修改 getPlayerPowerOnBase

**文件**：`src/games/smashup/domain/types.ts`

```typescript
import { getBasePowerModifiers } from './ongoingModifiers';

export function getPlayerPowerOnBase(
    base: BaseInPlay,
    playerId: PlayerId,
    state?: SmashUpCore,  // 新增：需要完整状态来计算基地级别修正
    baseIndex?: number     // 新增：需要基地索引
): number {
    // 随从级别的力量总和
    const minionPower = base.minions
        .filter(m => m.controller === playerId)
        .reduce((sum, m) => sum + m.basePower + m.powerCounters + m.powerModifier, 0);
    
    // 基地级别的力量修正（如蒸汽机车）
    const basePower = (state && baseIndex !== undefined)
        ? getBasePowerModifiers(state, baseIndex, playerId)
        : 0;
    
    return minionPower + basePower;
}
```

#### 1.3 注册蒸汽机车

**文件**：`src/games/smashup/abilities/ongoing_modifiers.ts`

```typescript
function registerSteampunkModifiers(): void {
    // 蒸汽机车：拥有者在此基地有随从时，+5 总力量
    registerBasePowerModifier('steampunk_aggromotive', (ctx) => {
        // 统计该玩家打出的蒸汽机车数量
        const count = ctx.base.ongoingActions.filter(
            a => a.defId === 'steampunk_aggromotive' && a.ownerId === ctx.playerId
        ).length;
        
        if (count === 0) return 0;
        
        // 检查该玩家在此基地是否有随从
        const hasMinion = ctx.base.minions.some(m => m.controller === ctx.playerId);
        
        return hasMinion ? count * 5 : 0;
    });
    
    // 移除旧的注册
    // registerOngoingPowerModifier('steampunk_aggromotive', 'base', 'firstOwnerMinion', 5);
}
```

#### 1.4 更新所有调用点

需要更新所有调用 `getPlayerPowerOnBase` 的地方，传入 `state` 和 `baseIndex`：

**搜索命令**：
```bash
grep -r "getPlayerPowerOnBase" src/games/smashup/
```

**主要调用点**：
- `src/games/smashup/domain/scoring.ts` — 计分时
- `src/games/smashup/ui/` — UI 显示时
- `src/games/smashup/__tests__/` — 测试中

---

### 方案 2：虚拟随从（不推荐）

**思路**：创建一个"虚拟随从"来承载 +5 力量，不会被移除。

**缺点**：
- ❌ 增加系统复杂度
- ❌ 需要在 UI 中隐藏虚拟随从
- ❌ 需要在所有随从相关逻辑中排除虚拟随从
- ❌ 不符合"数据驱动"原则

---

### 方案 3：在 Player 上添加 basePowerModifiers（不推荐）

**思路**：在 `Player` 状态上添加 `basePowerModifiers: Map<baseIndex, number>`。

**缺点**：
- ❌ 状态冗余（需要在 reduce 中维护）
- ❌ 需要在每次 ongoing 打出/移除时更新
- ❌ 不符合"纯计算层"原则（ongoingModifiers 应该是无状态的）

---

## 推荐方案：方案 1

**理由**：
1. ✅ 符合"纯计算层"原则（不修改状态，只在计算时调用）
2. ✅ 扩展性好（未来其他"基地级别力量修正"可复用）
3. ✅ 不引入状态冗余
4. ✅ 修改范围可控（主要是 `ongoingModifiers.ts` 和 `types.ts`）

**风险**：
- ⚠️ 需要更新所有 `getPlayerPowerOnBase` 的调用点（约 10-15 处）
- ⚠️ 需要确保向后兼容（可选参数 + 默认值）

---

## 实施步骤

### 第一步：扩展类型和注册表

1. 在 `ongoingModifiers.ts` 中添加：
   - `BasePowerModifierContext` 类型
   - `BasePowerModifierFn` 类型
   - `basePowerModifiers` 注册表
   - `registerBasePowerModifier` 函数
   - `getBasePowerModifiers` 函数

### 第二步：修改 getPlayerPowerOnBase

1. 在 `types.ts` 中修改 `getPlayerPowerOnBase`：
   - 添加可选参数 `state?: SmashUpCore` 和 `baseIndex?: number`
   - 调用 `getBasePowerModifiers` 获取基地级别修正
   - 返回 `minionPower + basePower`

### 第三步：重新注册蒸汽机车

1. 在 `ongoing_modifiers.ts` 中：
   - 移除旧的 `registerOngoingPowerModifier('steampunk_aggromotive', ...)`
   - 添加新的 `registerBasePowerModifier('steampunk_aggromotive', ...)`

### 第四步：更新调用点

1. 搜索所有 `getPlayerPowerOnBase` 调用
2. 传入 `state` 和 `baseIndex` 参数
3. 确保测试通过

### 第五步：补充测试

1. 在 `steampunk-aggromotive-bug.test.ts` 中添加正确行为测试：
   - 第一个随从被消灭后，总战力仍然 +5
   - 第一个随从返回手牌后，总战力仍然 +5
   - 第一个随从移动到其他基地后，原基地总战力仍然 +5
   - 没有随从时，总战力不加成

### 第六步：更新审计文档

1. 在 `.kiro/specs/smashup-full-audit/audit-9.1-steampunks.md` 中：
   - 更新执行层证据："使用基地级别力量修正，不依赖具体随从"
   - 更新测试层状态：✅ 有随从移除/移动场景测试

---

## 影响范围评估

### 需要修改的文件

1. **核心系统**（必须）：
   - `src/games/smashup/domain/ongoingModifiers.ts` — 新增基地级别修正系统
   - `src/games/smashup/domain/types.ts` — 修改 `getPlayerPowerOnBase` 签名
   - `src/games/smashup/abilities/ongoing_modifiers.ts` — 重新注册蒸汽机车

2. **调用点**（必须）：
   - `src/games/smashup/domain/scoring.ts` — 计分逻辑
   - `src/games/smashup/ui/*.tsx` — UI 显示
   - 其他所有调用 `getPlayerPowerOnBase` 的地方

3. **测试**（必须）：
   - `src/games/smashup/__tests__/steampunk-aggromotive-bug.test.ts` — 新增
   - `src/games/smashup/__tests__/ongoingModifiers.test.ts` — 更新
   - `src/games/smashup/__tests__/baseScoring.test.ts` — 可能需要更新

4. **文档**（必须）：
   - `.kiro/specs/smashup-full-audit/audit-9.1-steampunks.md` — 更新审计结果

### 向后兼容性

- ✅ `getPlayerPowerOnBase` 的新参数是可选的，默认值为 0
- ✅ 不影响其他 ongoing 力量修正（仍然使用随从级别修正）
- ✅ 不影响其他派系

---

## 审计反思

### 为什么审计没发现这个问题？

1. **测试覆盖不足**：
   - 只测试了"有随从时 +5"
   - 没有测试"随从移除后的行为"
   - 没有测试"随从移动后的行为"

2. **审计维度缺失**：
   - 审计文档中没有"状态变化后的持续性"维度
   - 没有"随从移除/移动场景"检查清单

3. **实现假设错误**：
   - 假设"给第一个随从 +5"等价于"总战力 +5"
   - 忽略了"第一个随从"是动态变化的

### 如何改进审计流程？

1. **新增审计维度**：
   - **D50：持续效果稳定性**：持续效果的目标被移除/移动后，效果是否仍然正确？
   - 检查清单：
     - [ ] 目标随从被消灭
     - [ ] 目标随从返回手牌
     - [ ] 目标随从移动到其他基地
     - [ ] 目标随从顺序改变

2. **测试策略**：
   - 所有"持续效果"必须测试目标移除场景
   - 所有"第一个/最后一个"逻辑必须测试顺序变化场景

3. **代码审查**：
   - 看到 `firstOwnerMinion` 模式时，必须问："第一个随从被移除后会怎样？"
   - 看到"模拟总战力"的实现时，必须问："这真的等价于总战力吗？"

---

## 类似问题排查

需要检查是否有其他使用 `'firstOwnerMinion'` 模式的卡牌：

```bash
grep -r "firstOwnerMinion" src/games/smashup/
```

**结果**：
- `steampunk_aggromotive` — 本次修复
- 其他？（需要确认）

如果有其他卡牌使用相同模式，需要逐一审查是否有相同问题。
