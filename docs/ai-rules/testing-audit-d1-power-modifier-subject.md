# D1 子项：力量修正主语审查（强制）

> **触发条件**：新增/修改任何力量修正能力时触发

## 核心原则

**描述说"你 +N 力量"就必须增加玩家总战力，不能实现成"随从 +N 力量"。**

## 审查方法

### 1. 提取描述中的主语

逐字阅读能力描述，标注力量修正的主语：

- **"你/玩家 +N 力量"** → 主语是玩家，应该增加玩家总战力
- **"它/该随从 +N 力量"** → 主语是随从，应该增加随从力量
- **"你的随从 +N 力量"** → 主语是随从（复数），应该增加每个随从的力量

### 2. 检查实现的修正目标

- 使用 `registerPowerModifier` → 修正随从力量
- 使用 `registerBasePowerModifier` → 修正玩家总战力
- 使用 `'firstOwnerMinion'` 模式 → ⚠️ 可能是错误的"模拟"实现

### 3. 判定标准

| 描述 | 实现 | 判定 |
|------|------|------|
| "你 +N 力量" | `registerBasePowerModifier` | ✅ 正确 |
| "你 +N 力量" | `registerPowerModifier` | ❌ 语义不保真 |
| "它 +N 力量" | `registerPowerModifier` | ✅ 正确 |
| "它 +N 力量" | `registerBasePowerModifier` | ❌ 语义不保真 |

## 典型错误模式

### 错误 1：用"给第一个随从 +N"模拟"玩家总战力 +N"

```typescript
// ❌ 错误：描述说"你在这里就拥有+5力量"，实现成"第一个随从 +5 力量"
registerOngoingPowerModifier('steampunk_aggromotive', 'base', 'firstOwnerMinion', 5);
```

**问题**：
- 静态场景下结果相同（第一个随从 +5 = 玩家总战力 +5）
- 但语义错误（描述说的是玩家，不是随从）
- 随从移除后效果会跳转到下一个随从

**正确做法**：
```typescript
// ✅ 正确：直接增加玩家总战力
registerBasePowerModifier('steampunk_aggromotive', (ctx) => {
    const count = ctx.base.ongoingActions.filter(
        a => a.defId === 'steampunk_aggromotive' && a.ownerId === ctx.playerId
    ).length;
    
    if (count === 0) return 0;
    
    const hasMinion = ctx.base.minions.some(m => m.controller === ctx.playerId);
    
    return hasMinion ? count * 5 : 0;
});
```

### 错误 2：假设"给第一个随从 +N" ≈ "玩家总战力 +N"

这个假设在以下场景下会失败：
- 第一个随从被消灭 → +N 跳到第二个随从
- 第一个随从返回手牌 → +N 跳到第二个随从
- 第一个随从移动到其他基地 → +N 跳到第二个随从
- 新随从插入到第一个位置 → +N 跳转

## 审查输出格式

```
卡牌: steampunk_aggromotive (蒸汽机车)
描述: "如果你有一个随从在此基地，你在这里就拥有+5力量"
主语: "你"（玩家）
实现: registerOngoingPowerModifier(..., 'firstOwnerMinion', 5)
修正目标: 第一个随从的力量
判定: ❌ 语义不保真（描述说玩家总战力，实现成随从力量）
修复方案: 使用 registerBasePowerModifier 增加玩家总战力
```

## 教训

**蒸汽机车（steampunk_aggromotive）案例**：

- **描述**："你在这里就拥有+5力量"
- **实现**："第一个随从 +5 力量"
- **审计结果**：✅ 标注为正确（"给第一个己方随从 +5（避免重复计算）"）
- **实际问题**：❌ 语义不保真，审计未发现

**根本原因**：
- 审计没有逐字对照描述文本
- 审计假设"给第一个随从 +5" ≈ "玩家总战力 +5"
- 审计没有质疑实现的语义正确性

## 改进措施

1. **强制逐字对照**：审计时必须逐字对照描述文本，提取主语
2. **禁止"模拟"实现**：不允许用"给第一个随从 +N"来模拟"玩家总战力 +N"
3. **代码审查清单**：看到 `'firstOwnerMinion'` 模式时，必须问"描述的主语是谁？"
