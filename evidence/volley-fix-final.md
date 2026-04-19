# Volley (万箭齐发) 最终修复

## 问题回顾

用户反馈：Volley 卡牌使用后"没有特写也没有伤害修正 UI，日志正常"

## 根本原因

第一次修复时，我参考了错误的模式：
- ❌ **错误**：发射 5 个独立 BONUS_DIE_ROLLED 事件 + 1 个汇总 BONUS_DIE_ROLLED 事件
- ✅ **正确**：发射 5 个独立 BONUS_DIE_ROLLED 事件 + 1 个 `createDisplayOnlySettlement` 事件

**关键问题**：缺少 `createDisplayOnlySettlement` 事件，导致：
1. 多骰面板（BonusDieOverlay）不会弹出
2. 用户看不到任何骰子特写
3. 伤害修正虽然已应用到 `pendingAttack.bonusDamage`，但 UI 没有显示

## 正确的实现模式（参考野蛮人）

### 野蛮人的标准实现

```typescript
// More Please (再来点儿！) - 投掷 5 骰
function handleMorePleaseRollDamage({ ... }: CustomActionContext): DiceThroneEvent[] {
    const events: DiceThroneEvent[] = [];
    const dice: BonusDieInfo[] = [];  // ← 关键：收集骰子数据
    
    // 1. 投掷骰子并发射独立事件
    for (let i = 0; i < 5; i++) {
        const value = random.d(6);
        const face = getPlayerDieFace(state, attackerId, value) ?? '';
        dice.push({ index: i, value, face });  // ← 关键：收集数据
        
        events.push({
            type: 'BONUS_DIE_ROLLED',
            payload: { value, face, effectKey: 'xxx', effectParams: { value, index: i } },
            timestamp: timestamp + i,
        });
    }
    
    // 2. 处理效果（伤害、状态等）
    // ...
    
    // 3. 多骰展示汇总（触发 BonusDieOverlay）
    events.push(createDisplayOnlySettlement(sourceAbilityId, attackerId, opponentId, dice, timestamp));
    //     ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ 关键：这个事件触发多骰面板显示
    
    return events;
}
```

### Volley 的最终修复

```typescript
function handleVolley(context: CustomActionContext): DiceThroneEvent[] {
    const { attackerId, sourceAbilityId, state, timestamp, random, ctx } = context;
    if (!random) return [];
    const opponentId = ctx.defenderId;
    if (!opponentId) {
        console.warn('[moon_elf] handleVolley: No defenderId in context');
        return [];
    }
    const events: DiceThroneEvent[] = [];
    const dice: BonusDieInfo[] = [];  // ← 新增：收集骰子数据

    // 1. 投掷5骰，统计弓面数量
    const diceValues: number[] = [];
    const diceFaces: string[] = [];
    for (let i = 0; i < 5; i++) {
        const value = random.d(6);
        const face = getPlayerDieFace(state, attackerId, value) ?? '';
        diceValues.push(value);
        diceFaces.push(face);
        dice.push({ index: i, value, face });  // ← 新增：收集数据
    }
    
    const bowCount = diceFaces.filter(f => f === FACE.BOW).length;
    
    // 2. 发射5个独立的骰子事件
    for (let i = 0; i < 5; i++) {
        events.push({
            type: 'BONUS_DIE_ROLLED',
            payload: { 
                value: diceValues[i], 
                face: diceFaces[i], 
                playerId: attackerId, 
                targetPlayerId: opponentId, 
                effectKey: 'bonusDie.effect.volley', 
                effectParams: { value: diceValues[i], index: i }  // ← 修改：添加 index
            },
            sourceCommandType: 'ABILITY_EFFECT',
            timestamp: timestamp + i,
        } as BonusDieRolledEvent);
    }

    // 3. 增加弓面数量的伤害（作为攻击修正加到 pendingAttack）
    if (bowCount > 0 && state.pendingAttack && state.pendingAttack.attackerId === attackerId) {
        state.pendingAttack.bonusDamage = (state.pendingAttack.bonusDamage ?? 0) + bowCount;
    }

    // 4. 施加缠绕（给对手）
    events.push(applyStatus(opponentId, STATUS_IDS.ENTANGLE, 1, sourceAbilityId, state, timestamp));

    // 5. 多骰展示汇总（触发 BonusDieOverlay 显示所有骰子）
    events.push(createDisplayOnlySettlement(sourceAbilityId, attackerId, opponentId, dice, timestamp));
    //     ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ 新增：这个事件触发多骰面板显示

    return events;
}
```

## 修改文件

- `src/games/dicethrone/domain/customActions/moon_elf.ts`
  - 添加 import：`createDisplayOnlySettlement`, `BonusDieInfo`
  - 修改 `handleVolley` 函数：
    - 添加 `dice: BonusDieInfo[]` 数组
    - 在循环中收集骰子数据
    - 移除错误的"汇总 BONUS_DIE_ROLLED 事件"
    - 添加 `createDisplayOnlySettlement` 事件

## 预期效果

1. 玩家使用 Volley 卡牌后，会弹出 **BonusDieOverlay 多骰面板**
2. 面板中显示 **5 颗骰子**（每颗骰子显示点数和骰面图标）
3. 面板底部显示汇总信息（弓面数量、伤害加成）
4. 伤害加成正确应用到 `pendingAttack.bonusDamage`
5. 对手被施加缠绕状态
6. 面板关闭后，游戏自动推进到下一阶段

## 教训

### 1. 第一次修复为什么失败？

**问题**：没有参考正确的标准实现
- 我看到 Exploding Arrow 只发射 1 个汇总事件
- 我以为 Volley 应该发射 5 个独立事件 + 1 个汇总事件
- 但实际上应该发射 5 个独立事件 + 1 个 `createDisplayOnlySettlement` 事件

**根本原因**：
- 没有搜索"同类技能"的实现（野蛮人的 More Please / Suppress）
- 只参考了"不同类技能"的实现（Exploding Arrow）
- 没有理解 `createDisplayOnlySettlement` 的作用

### 2. createDisplayOnlySettlement 的作用

**功能**：
- 触发 `BonusDieOverlay` 多骰面板显示
- 面板会显示所有骰子（从 `dice: BonusDieInfo[]` 数组读取）
- 面板底部显示汇总信息
- 面板关闭后，游戏自动推进

**为什么需要这个事件？**
- 单独的 BONUS_DIE_ROLLED 事件只会触发"单骰特写"（卡牌左侧显示 1 颗骰子）
- 多骰场景需要"多骰面板"（弹窗显示所有骰子）
- `createDisplayOnlySettlement` 事件就是用来触发多骰面板的

### 3. 两种骰子显示模式

#### 模式 1：单骰特写（CardSpotlightOverlay）

**触发条件**：只发射 1 个 BONUS_DIE_ROLLED 事件
- 卡牌特写显示在左侧
- 骰子特写显示在右侧
- 适用于"只投掷 1 颗骰子"的技能（如 Watch Out）

#### 模式 2：多骰面板（BonusDieOverlay）

**触发条件**：发射多个 BONUS_DIE_ROLLED 事件 + 1 个 `createDisplayOnlySettlement` 事件
- 弹出居中的多骰面板
- 显示所有骰子（网格布局）
- 底部显示汇总信息
- 适用于"投掷多颗骰子"的技能（如 Volley, More Please, Suppress）

### 4. 如何避免类似错误？

**规则 1：新增功能前，搜索同类功能**
- 用 `grepSearch` 搜索"投掷X骰"的技能
- 找到同类技能的实现（如野蛮人的 More Please）
- 参考标准实现，不要自己发明新模式

**规则 2：理解关键事件的作用**
- `BONUS_DIE_ROLLED`：记录单颗骰子的结果
- `createDisplayOnlySettlement`：触发多骰面板显示
- 两者配合使用，缺一不可

**规则 3：测试时检查 UI 显示**
- 不只是检查"日志是否正常"
- 还要检查"UI 是否正常显示"
- 如果 UI 没有显示，说明缺少关键事件

## 百游戏自检

- ❌ 是否引入游戏特化硬编码：否，使用通用的事件系统
- ❌ 是否破坏框架复用性：否，只修改游戏层代码
- ❌ 是否违反数据驱动原则：否，使用事件驱动
- ✅ 配置是否显式声明：是，effectKey 显式声明
- ✅ 是否提供了智能默认值：是，UI 系统自动处理多骰子显示
- ✅ 新增游戏需要写多少行代码：参考野蛮人的实现，约 30 行
- ✅ **是否参考了标准实现**：是，参考野蛮人的 More Please / Suppress
