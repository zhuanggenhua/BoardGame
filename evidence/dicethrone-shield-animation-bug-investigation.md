# DiceThrone 护盾动画跳字 Bug 调查

## 用户反馈

**时间**：2026/3/4 13:45:46

**问题描述**：减伤日志正确，动画跳字还是8

**日志片段**：
```
[13:44:05] 管理员1: 以【拍击】对玩家游客6118造成  4  点伤害
[13:44:05] 游客6118: actionLog.damageShieldPercent
[13:44:05] 管理员1: 受到  2  点伤害（打不到我）
```

## 问题分析

### 1. 伤害计算链路

根据日志和 Wiki 数据：
- **原始伤害**：8 点（拍击 5 剑面）
- **第一次减伤**：8 → 4 点（某个护盾吸收了 4 点）
- **第二次减伤**：4 → 2 点（"打不到我" 50% 减伤）
- **最终伤害**：2 点

### 2. 日志显示正确

日志层使用以下逻辑计算最终伤害：

```typescript
// src/games/dicethrone/game.ts:463-465
const totalShieldAbsorbed = shieldsConsumed?.reduce((sum, s) => sum + s.absorbed, 0) ?? 0;
const finalDamage = Math.max(0, dealt - totalShieldAbsorbed);
```

这个逻辑会累加所有护盾的吸收量（包括百分比护盾和固定值护盾），然后从原始伤害中扣除。

### 3. 动画层问题

动画层使用 `resolveAnimationDamage` 函数计算伤害：

```typescript
// src/games/dicethrone/hooks/useAnimationEffects.ts:155-177
function resolveAnimationDamage(
    rawDamage: number,  // dmgEvent.payload.actualDamage (8 点)
    targetId: string,
    percentShields?: Map<string, number>,
    resolvedDamageByTarget?: Map<string, number>,
    fixedShieldsByTarget?: Map<string, number>,
): number {
    // 1. 扣除百分比护盾
    const reductionPercent = percentShields?.get(targetId);
    const shieldAbsorbed = reductionPercent != null
        ? Math.ceil(rawDamage * reductionPercent / 100)
        : 0;
    const dealtFromSameBatchShield = rawDamage - shieldAbsorbed;

    // 2. 扣除固定值护盾
    const fixedShieldAbsorbed = fixedShieldsByTarget?.get(targetId) ?? 0;
    const dealtAfterAllShields = Math.max(0, dealtFromSameBatchShield - fixedShieldAbsorbed);

    // 3. 如果有 ATTACK_RESOLVED.totalDamage，使用它（权威值）
    const resolvedDamage = resolvedDamageByTarget?.get(targetId);
    return resolvedDamage != null
        ? Math.max(0, resolvedDamage)
        : dealtAfterAllShields;
}
```

### 4. 可能的根因

#### 假设 1：`percentShields` 和 `fixedShieldsByTarget` 为空

如果护盾是在**之前的命令**中授予的（不在同一批次），那么：
- `percentShields` Map 中不会有"打不到我"的信息
- `fixedShieldsByTarget` Map 中不会有第一个护盾的信息
- `resolveAnimationDamage` 会返回 `rawDamage`（8 点）

但是，代码中有一个兜底逻辑：**如果有 `ATTACK_RESOLVED.totalDamage`，使用它作为权威值**。

#### 假设 2：`ATTACK_RESOLVED` 事件不在同一批次

如果 `ATTACK_RESOLVED` 事件不在同一批次，那么 `resolvedDamageByTarget` 也会是空的，导致动画显示原始伤害。

#### 假设 3：`ATTACK_RESOLVED.totalDamage` 的值不正确

如果 `ATTACK_RESOLVED.totalDamage` 的值是 8 而不是 2，那么即使使用了权威值，动画也会显示 8。

### 5. 需要验证的点

1. **`ATTACK_RESOLVED` 事件是否在同一批次中？**
   - 查看 EventStream，确认 `DAMAGE_DEALT` 和 `ATTACK_RESOLVED` 是否在同一批次
   
2. **`ATTACK_RESOLVED.totalDamage` 的值是多少？**
   - 如果是 8，说明 reducer 层计算有问题
   - 如果是 2，说明动画层没有正确使用这个值

3. **`resolvedDamageByTarget` 是否正确收集了 `ATTACK_RESOLVED.totalDamage`？**
   - 检查 `collectDamageAnimationContext` 的逻辑
   - 确认 `defenderDamageEventCount === 1` 的条件是否满足

## 下一步

1. 添加临时日志，输出以下信息：
   - `rawDamage`（原始伤害）
   - `percentShields.get(targetId)`（百分比护盾）
   - `fixedShieldsByTarget.get(targetId)`（固定值护盾）
   - `resolvedDamageByTarget.get(targetId)`（ATTACK_RESOLVED.totalDamage）
   - 最终返回的 `damage` 值

2. 重现问题场景：
   - 野蛮人使用拍击（5 剑面，8 点伤害）
   - 月精灵使用"打不到我"防御技能（50% 减伤）
   - 查看动画跳字是否显示 8 点

3. 根据日志输出，定位具体问题点


## 诊断日志已添加

已在 `src/games/dicethrone/hooks/useAnimationEffects.ts` 的 `resolveAnimationDamage` 函数中添加临时诊断日志：

```typescript
console.log('[DT Animation Debug]', {
    rawDamage,           // 原始伤害（dmgEvent.payload.actualDamage）
    targetId,            // 目标玩家 ID
    reductionPercent,    // 百分比护盾（如果在同一批次）
    shieldAbsorbed,      // 百分比护盾吸收量
    fixedShieldAbsorbed, // 固定值护盾吸收量
    resolvedDamage,      // ATTACK_RESOLVED.totalDamage（权威值）
    finalDamage,         // 最终返回的伤害值
});
```

### 如何使用

1. 启动游戏服务器：`npm run dev`
2. 打开浏览器控制台（F12）
3. 重现问题场景：
   - 野蛮人使用拍击（5 剑面，8 点伤害）
   - 月精灵使用"打不到我"防御技能（50% 减伤）
4. 查看控制台输出的 `[DT Animation Debug]` 日志
5. 将日志截图或复制到本文档

### 预期结果

如果一切正常，应该看到：
```javascript
{
    rawDamage: 8,
    targetId: "1",
    reductionPercent: undefined,  // 护盾在之前的批次中授予
    shieldAbsorbed: 0,
    fixedShieldAbsorbed: 0,
    resolvedDamage: 2,  // ATTACK_RESOLVED.totalDamage（权威值）
    finalDamage: 2
}
```

如果 `resolvedDamage` 是 `undefined` 或 `8`，说明问题在于：
- `ATTACK_RESOLVED` 事件不在同一批次
- `ATTACK_RESOLVED.totalDamage` 的值不正确

## 临时解决方案（如果需要）

如果确认问题是 `ATTACK_RESOLVED.totalDamage` 不正确，可以考虑：

1. **使用 `shieldsConsumed` 计算最终伤害**：
   ```typescript
   // 从 DAMAGE_DEALT 事件中读取 shieldsConsumed
   const totalShieldAbsorbed = dmgEvent.payload.shieldsConsumed?.reduce((sum, s) => sum + s.absorbed, 0) ?? 0;
   const finalDamage = Math.max(0, rawDamage - totalShieldAbsorbed);
   ```

2. **直接使用日志层的计算逻辑**：
   ```typescript
   // 与 game.ts:463-465 保持一致
   const dealt = dmgEvent.payload.actualDamage ?? 0;
   const totalShieldAbsorbed = dmgEvent.payload.shieldsConsumed?.reduce((sum, s) => sum + s.absorbed, 0) ?? 0;
   const finalDamage = Math.max(0, dealt - totalShieldAbsorbed);
   ```

这样可以确保动画层和日志层使用完全相同的计算逻辑。
