# 爆裂箭（Exploding Arrow）描述与实现验证报告

## 问题描述
用户反馈："dicethrone看箭 投掷的描述和效果不符检查一下"

## 验证结果：✅ 描述与实现完全一致

### 1. 描述文本（i18n）

**爆裂箭 I**（`exploding-arrow`）：
```
1弓+3月触发：掷骰5骰，造成 3 + 2×弓 + 1×足 伤害，另外对手丢失 1×月 CP，造成致盲
```

**爆炸射击 II**（`exploding-arrow-2`）：
```
1弓+3月触发：掷骰5骰，造成 3 + 1×弓 + 2×足 伤害，对手失去 1×月 CP，施加致盲
```

**爆炸射击 III**（`exploding-arrow-3`）：
```
1弓+3月触发：掷骰5骰，造成 3 + 1×弓 + 2×足 伤害，对手失去 1×月 CP，施加致盲和缠绕
```

### 2. 代码实现（`src/games/dicethrone/domain/customActions/moon_elf.ts`）

**爆裂箭 I**（`handleExplodingArrowResolve1`）：
```typescript
// 计算伤害：3 + 2×弓 + 1×足
const damageAmount = 3 + (2 * bowCount) + (1 * footCount);
```
✅ 与描述一致

**爆炸射击 II**（`handleExplodingArrowResolve2`）：
```typescript
// 计算伤害：3 + 1×弓 + 2×足（II级公式与I级不同，与III级相同）
const damageAmount = 3 + (1 * bowCount) + (2 * footCount);
```
✅ 与描述一致

**爆炸射击 III**（`handleExplodingArrowResolve3`）：
```typescript
// 计算伤害：3 + 1×弓 + 2×足（III级公式与I级不同）
const damageAmount = 3 + (1 * bowCount) + (2 * footCount);
```
✅ 与描述一致

### 3. 测试验证

**测试文件**：`src/games/dicethrone/__tests__/moon_elf-behavior.test.ts`

**爆裂箭 I 测试**：
```typescript
it('5骰全BOW时造成13点伤害（3+2×5）', () => {
    // 期望：3 + 2×5弓 + 1×0足 = 13
    expect((dmg[0] as any).payload.amount).toBe(13);
});
```
✅ 测试通过

**爆炸射击 II 测试**：
```typescript
it('5骰2弓2足1月：造成9伤害', () => {
    // 期望：3 + 1×2弓 + 2×2足 = 9
    expect((eventsOfType(events, 'DAMAGE_DEALT')[0] as any).payload.amount).toBe(9);
});
```
✅ 测试通过

**爆炸射击 III 测试**：
```typescript
it('5骰2弓2足1月：造成9伤害', () => {
    // 期望：3 + 1×2弓 + 2×2足 = 9
    expect((eventsOfType(events, 'DAMAGE_DEALT')[0] as any).payload.amount).toBe(9);
});
```
✅ 测试通过

### 4. 其他效果验证

| 效果 | 描述 | 代码实现 | 状态 |
|------|------|----------|------|
| CP 丢失 | 对手失去 1×月 CP | `cpLoss = moonCount` | ✅ 一致 |
| 致盲（I/II/III） | 施加致盲 | `applyStatus(opponentId, STATUS_IDS.BLINDED, 1, ...)` | ✅ 一致 |
| 缠绕（仅III） | 施加缠绕 | `applyStatus(opponentId, STATUS_IDS.ENTANGLE, 1, ...)` | ✅ 一致 |

## 结论

**所有三个等级的爆裂箭/爆炸射击的描述与代码实现完全一致，不存在不符的情况。**

### 可能的误解来源

1. **I级与II/III级公式不同**：
   - I级：`3 + 2×弓 + 1×足`（弓权重更高）
   - II/III级：`3 + 1×弓 + 2×足`（足权重更高）
   - 这是设计意图，升级后改变了伤害计算方式

2. **II级与III级伤害公式相同**：
   - 两者伤害计算完全一样
   - 区别在于III级额外施加缠绕效果

3. **"看箭"可能指其他技能**：
   - 如果用户指的是其他技能（如"长弓"Longbow），需要进一步确认

## 建议

如果用户仍然认为有问题，请提供以下信息：
1. 具体是哪个等级的技能（I/II/III）？
2. 游戏中实际显示的伤害数值是多少？
3. 投掷的5个骰子分别是什么面（弓/足/月）？
4. 期望的伤害数值是多少？

这样可以帮助我们精确定位问题。
