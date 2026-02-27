# DiceThrone 护盾减伤日志修复总结

## 问题描述

用户反馈：游戏日志中没有显示护盾（"下次一定"卡牌和"神圣防御"技能）的减伤记录。

### 用户案例
- 管理员1 打出"下次一定"卡牌（6点护盾）
- 管理员1 发动"神圣防御"技能（3点护盾）
- 游客6118 使用"匕首打击"造成 8 点伤害
- 日志中只显示"受到 1 点伤害（神圣防御）"，没有显示护盾的减伤明细

## 根本原因

1. **护盾消耗在 reducer 层**：`handleDamageDealt` 在 reducer 中直接修改状态，消耗护盾
2. **日志系统只看事件**：`formatDiceThroneActionEntry` 只能看到 `DAMAGE_DEALT` 事件
3. **信息丢失**：护盾消耗的详细信息（消耗了哪些护盾、每个护盾抵消了多少伤害）在 reducer 中处理后就丢失了

## 解决方案

在 `DAMAGE_DEALT` 事件的 payload 中添加 `shieldsConsumed` 字段，记录护盾消耗信息。

### 1. 扩展事件类型

```typescript
export interface DamageDealtEvent extends GameEvent<'DAMAGE_DEALT'> {
    payload: {
        // ... 其他字段
        /** 护盾消耗记录（由 reducer 层回填，用于 ActionLog 展示护盾减伤明细） */
        shieldsConsumed?: Array<{
            sourceId?: string;
            value?: number;
            reductionPercent?: number;
            absorbed: number;
        }>;
    };
}
```

### 2. Reducer 层记录护盾消耗

在 `reduceCombat.ts` 的 `handleDamageDealt` 中：

```typescript
const shieldsConsumed: Array<{
    sourceId?: string;
    value?: number;
    reductionPercent?: number;
    absorbed: number;
}> = [];

// 消耗护盾时记录信息
for (const shield of damageShields) {
    // ... 计算 preventedAmount
    
    if (preventedAmount > 0) {
        shieldsConsumed.push({
            sourceId: shield.sourceId,
            value: shield.value,
            reductionPercent: shield.reductionPercent,
            absorbed: preventedAmount,
        });
    }
}

// 将护盾消耗信息回填到事件中
if (shieldsConsumed.length > 0) {
    event.payload.shieldsConsumed = shieldsConsumed;
}
```

### 3. 日志格式化使用护盾消耗信息

在 `game.ts` 的 `formatDiceThroneActionEntry` 中：

```typescript
// 如果有护盾消耗记录（固定值护盾），在 breakdown tooltip 中追加护盾行
if (shieldsConsumed && shieldsConsumed.length > 0 && breakdownSeg.type === 'breakdown') {
    for (const shield of shieldsConsumed) {
        const shieldSource = shield.sourceId
            ? resolveAbilitySourceLabel(shield.sourceId, core, targetId)
            : null;
        breakdownSeg.lines.push({
            label: shieldSource?.label ?? 'actionLog.damageSource.shield',
            labelIsI18n: shieldSource?.isI18n ?? true,
            labelNs: shieldSource?.isI18n ? shieldSource.ns : DT_NS,
            value: -shield.absorbed,
            color: 'negative',
        });
    }
}
```

## 测试验证

新增测试文件 `shield-logging.test.ts`，验证：

1. ✅ 多个护盾叠加消耗时，所有护盾消耗都记录到事件中
2. ✅ 单个护盾部分消耗时，记录正确的 absorbed 值
3. ✅ 护盾完全抵消伤害时，所有护盾消耗都记录
4. ✅ 没有护盾时，shieldsConsumed 为 undefined

## 影响范围

- ✅ 不影响现有护盾消耗逻辑（所有护盾相关测试通过）
- ✅ 不影响其他伤害处理逻辑
- ✅ 向后兼容（`shieldsConsumed` 为可选字段）

## 后续工作

- 需要在游戏中实际测试，确认日志显示正确
- 可能需要添加 i18n 翻译 key（如果护盾来源没有对应的翻译）

## 相关文件

- `src/games/dicethrone/domain/events.ts` - 事件类型定义
- `src/games/dicethrone/domain/reduceCombat.ts` - 护盾消耗逻辑
- `src/games/dicethrone/game.ts` - 日志格式化逻辑
- `src/games/dicethrone/__tests__/shield-logging.test.ts` - 新增测试
