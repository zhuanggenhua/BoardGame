# 王权骰铸：卡牌骰子显示优化

> 2026-08-15 当前有效口径：本文的“卡牌骰子绑定到中央卡牌特写 / 技能显示独立奖励骰面板”属于历史显示方案，已经被右侧 2D 骰盘统一承接口径取代。当前 DiceThrone 奖励骰/临时骰不得出现中央奖励骰特写、卡牌特写内嵌骰子或奖励骰专用确认入口；当前验收见 `evidence/dicethrone/dicethrone-bonus-dice-no-central-spotlight-e2e-test.md`。

> 2026-06-06 历史阅读说明：本文只覆盖“多骰卡牌同时出现卡牌特写和独立骰子面板”这一条历史 UI/交互优化，不是当前 DiceThrone 所有卡牌/技能特写链路都已最终统一的证明，也不是新英雄补审出口。阅读时应把它当作单条显示逻辑拆分记录。

## 问题描述

用户反馈：打出多骰子卡牌（如万箭齐发、大吉大利、再来一次）时，会显示两个特写：
1. 独立骰子面板（`BonusDieOverlay` reroll 模式）
2. 卡牌特写（`CardSpotlightOverlay`）

这导致用户需要关闭两次特写，体验不佳。

## 根本原因

**卡牌 vs 技能的显示逻辑混淆**：

- **卡牌**（手牌）：骰子应该绑定到卡牌特写（`CardSpotlightOverlay`），显示卡牌图片 + 骰子结果
- **技能**（角色能力）：骰子应该显示在独立骰子面板（`BonusDieOverlay`），不显示卡牌图片

但代码中，卡牌和技能都调用了 `createDisplayOnlySettlement()`，导致卡牌也会触发独立骰子面板。

## 解决方案

### 1. 移除卡牌的 `createDisplayOnlySettlement` 调用

**月精灵卡牌**：
- ✅ 万箭齐发（Volley）：移除 `createDisplayOnlySettlement`

**野蛮人卡牌**：
- ✅ 大吉大利（Lucky Roll）：移除 `createDisplayOnlySettlement`
- ✅ 再来一次（More Please）：移除 `createDisplayOnlySettlement`

**月精灵技能**（保留 `createDisplayOnlySettlement`）：
- ✅ 爆裂箭 I/II/III（Exploding Arrow）：保留独立骰子面板

**野蛮人技能**（保留 `createDisplayOnlySettlement`）：
- ✅ 压制 I/II（Suppress）：保留独立骰子面板

### 2. 移除独立骰子面板的"继续"按钮

修改 `BonusDieOverlay.tsx`：
- 只在 `canReroll` 为 true 时显示"继续"按钮（武僧重掷场景）
- 其他情况只能点击空白背景关闭（自动关闭或手动点击）

## 代码修改

### 文件 1: `src/games/dicethrone/domain/customActions/moon_elf.ts`

```typescript
// 万箭齐发（Volley）- 移除 createDisplayOnlySettlement
function handleVolley(context: CustomActionContext): DiceThroneEvent[] {
    // ... 投掷5骰，发射事件 ...
    
    // 施加缠绕（给对手）
    events.push(applyStatus(opponentId, STATUS_IDS.ENTANGLE, 1, sourceAbilityId, state, timestamp + 6));

    // 万箭齐发是卡牌，骰子绑定到卡牌特写，不需要独立骰子面板
    // （不调用 createDisplayOnlySettlement）

    return events;
}

// 爆裂箭（Exploding Arrow）- 保留 createDisplayOnlySettlement
function resolveExplodingArrowMultiDie(...): DiceThroneEvent[] {
    // ... 投掷5骰，发射事件，造成伤害 ...
    
    events.push(
        createDisplayOnlySettlement(
            sourceAbilityId,
            attackerId,
            opponentId,
            dice,
            timestamp + (includeEntangle ? 10 : 9),
        ),
    );

    return events;
}
```

### 文件 2: `src/games/dicethrone/domain/customActions/barbarian.ts`

```typescript
// 大吉大利（Lucky Roll）- 移除 createDisplayOnlySettlement
function handleLuckyRollHeal(...): DiceThroneEvent[] {
    // ... 投掷3骰，治疗 ...
    
    // 卡牌的骰子绑定到卡牌特写，不需要独立骰子面板
    // （不调用 createDisplayOnlySettlement）

    return events;
}

// 再来一次（More Please）- 移除 createDisplayOnlySettlement
function handleMorePleaseRollDamage(...): DiceThroneEvent[] {
    // ... 投掷5骰，增加伤害 ...
    
    // 卡牌的骰子绑定到卡牌特写，不需要独立骰子面板
    // （不调用 createDisplayOnlySettlement）

    return events;
}

// 压制（Suppress）- 保留 createDisplayOnlySettlement
function handleBarbarianSuppressRoll(...): DiceThroneEvent[] {
    // ... 投掷3骰，造成伤害 ...
    
    // 多骰展示
    events.push(createDisplayOnlySettlement(sourceAbilityId, attackerId, opponentId, dice, timestamp));

    return events;
}
```

### 文件 3: `src/games/dicethrone/ui/BonusDieOverlay.tsx`

```typescript
// 只在可重掷时显示"继续"按钮（武僧等特殊情况）
{canReroll && (
    <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
    >
        <GameButton
            onClick={onSkipReroll}
            variant="primary"
            size="md"
            className="!text-[1.1vw] !px-[2.5vw] !py-[0.8vw]"
        >
            {t('bonusDie.confirmDamage')}
        </GameButton>
    </motion.div>
)}
```

## 验证结果

### 修改前
```
万箭齐发 → 独立骰子面板（5骰） + 卡牌特写（5骰） = 两个特写
大吉大利 → 独立骰子面板（3骰） + 卡牌特写（3骰） = 两个特写
再来一次 → 独立骰子面板（5骰） + 卡牌特写（5骰） = 两个特写
爆裂箭   → 独立骰子面板（5骰） = 一个特写 ✓
```

### 修改后
```
万箭齐发 → 卡牌特写（5骰 + 汇总文本） = 一个特写 ✓
大吉大利 → 卡牌特写（3骰 + 汇总文本） = 一个特写 ✓
再来一次 → 卡牌特写（5骰 + 汇总文本） = 一个特写 ✓
爆裂箭   → 独立骰子面板（5骰 + 汇总文本） = 一个特写 ✓
```

## 设计原则

### 卡牌 vs 技能的显示规则

| 类型 | 显示方式 | 是否调用 `createDisplayOnlySettlement` |
|------|----------|----------------------------------------|
| 卡牌（手牌） | 卡牌特写（`CardSpotlightOverlay`） | ❌ 否 |
| 技能（角色能力） | 独立骰子面板（`BonusDieOverlay`） | ✅ 是 |

### 判断依据

1. **查看注册 ID**：
   - `card-*` 或 `action-*` → 卡牌
   - `*-resolve-*` 或技能名称 → 技能

2. **查看卡牌定义**：
   - `cards.ts` 中定义 → 卡牌
   - `abilities.ts` 中定义 → 技能

3. **查看调用链**：
   - 从 `CARD_PLAYED` 事件触发 → 卡牌
   - 从 `ABILITY_ACTIVATED` 事件触发 → 技能

## 影响范围

- ✅ 月精灵：1 个卡牌修复（万箭齐发）
- ✅ 野蛮人：2 个卡牌修复（大吉大利、再来一次）
- ✅ UI 组件：移除非重掷场景的"继续"按钮
- ✅ 技能保持不变：爆裂箭、压制等技能仍然显示独立骰子面板

## 总结

通过区分卡牌和技能的显示逻辑，确保：
- 卡牌只显示一个特写（卡牌图片 + 骰子结果）
- 技能显示独立骰子面板（无卡牌图片）
- 用户体验更流畅，不需要关闭多个特写

---

**当前阅读说明**：本文只能证明“卡牌多骰显示与技能多骰显示需要分流”这条专项问题曾被修复，不能外推为当前所有 spotlight/bonus-die 交互、所有多骰对象或 DiceThrone 当前整体审计都已收口。
