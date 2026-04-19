# Card11 钟表匠 P1 问题修复

## 问题描述

**P1-1: Card11 钟表匠 - E2E 测试未覆盖"上一个遭遇的牌添加修正标记"场景**

钟表匠能力有两个效果：
1. **效果1（立即）**：为上一个遭遇的牌添加 +3 修正标记
2. **效果2（延迟）**：为下一次打出的牌添加 +3 修正标记

原测试只验证了效果2，未验证效果1。

## 修复方案

### 1. 修复 `waitForPhase` 函数支持中文

**问题**：原函数只支持英文阶段文本，但游戏实际显示中文。

**修复**：在 `e2e/helpers/cardia.ts` 中修改 `waitForPhase` 函数，支持中英文双语：

```typescript
export const waitForPhase = async (page: Page, phase: string, timeout = 10000) => {
    const phaseMap: Record<string, string[]> = {
        play: ['Play Card', '打出卡牌'],
        ability: ['Ability', '能力'],
        end: ['End', '结束'],
    };
    
    const phaseTexts = phaseMap[phase] || [phase];
    const indicator = page.locator('[data-testid="cardia-phase-indicator"]');
    
    // 等待任意一个匹配的文本出现
    await page.waitForFunction(
        ({ texts, timeout: timeoutMs }) => {
            const indicator = document.querySelector('[data-testid="cardia-phase-indicator"]');
            if (!indicator) return false;
            const text = indicator.textContent || '';
            return texts.some((t: string) => text.includes(t));
        },
        { texts: phaseTexts, timeout },
        { timeout }
    );
};
```

### 2. 新增测试用例

在 `e2e/cardia/cardia-deck1-card11-clockmaker.e2e.ts` 中新增测试用例：

**测试用例：应该为上一个遭遇的牌和下一张打出的牌都添加 +3 修正标记**

**测试场景**：
1. P1 已有一张已打出的牌（雇佣剑士，encounterIndex: 0）
2. P1 打出钟表匠（encounterIndex: 1），P2 打出财务官
3. P1 失败，激活钟表匠能力
4. 验证效果1：上一个遭遇的牌（雇佣剑士）添加了 +3 修正标记
5. 验证效果2：延迟效果被注册（为下一张牌添加 +3）
6. P1 打出下一张牌（外科医生）
7. 验证延迟效果被触发，新牌添加了 +3 修正标记

**关键验证点**：

```typescript
// 验证效果1：上一个遭遇的牌添加了修正标记
const previousCard = stateAfterAbility.players['0'].playedCards.find(
    (c: any) => c.encounterIndex === 0
);

const previousCardModifier = stateAfterAbility.modifierTokens.find(
    (t: any) => t.cardId === previousCard.uid && t.source === ABILITY_IDS.CLOCKMAKER
);

expect(previousCardModifier).toBeDefined();
expect(previousCardModifier.value).toBe(3);
```

```typescript
// 验证效果2：有两个修正标记（一个给上一个遭遇的牌，一个给新打出的牌）
const clockmakerModifiers = finalState.modifierTokens.filter(
    (t: any) => t.source === ABILITY_IDS.CLOCKMAKER
);

expect(clockmakerModifiers).toHaveLength(2);
```

## 测试结果

### 运行命令

```bash
BG_HEAVY_MEMORY_MIN_FREE_GB=0.05 npm run test:e2e:ci -- cardia-deck1-card11-clockmaker.e2e.ts
```

### 测试输出

```
✓  1 钟表匠延迟效果 E2E 测试 › 应该为下一张打出的牌添加 +3 修正标记 (8.6s)
✓  2 钟表匠延迟效果 E2E 测试 › 应该为上一个遭遇的牌和下一张打出的牌都添加 +3 修正标记 (7.5s)

2 passed (18.2s)
```

### 关键日志

**效果1验证（立即效果）**：
```
激活能力后状态: {
  modifierTokens: [
    {
      cardId: 'deck_i_card_01_1775132718879_ujph52c2o',
      value: 3,
      source: 'ability_i_clockmaker',
      timestamp: 1775132720392
    }
  ]
}
✅ 上一个遭遇的牌已添加修正标记（效果1）
```

**效果2验证（延迟效果）**：
```
打牌后最终状态: {
  delayedEffects: [],
  modifierTokens: [
    {
      cardId: 'deck_i_card_01_1775132718879_ujph52c2o',
      value: 3,
      source: 'ability_i_clockmaker',
      timestamp: 1775132720392
    },
    {
      cardId: 'deck_i_card_03_1775132718877_qa91viacb',
      value: 3,
      source: 'ability_i_clockmaker',
      timestamp: 1775132721520
    }
  ]
}
🔍 查找钟表匠的所有修正标记: { count: 2 }
✅ 测试通过：钟表匠的两个效果都正确执行
```

## 修复文件

- `e2e/helpers/cardia.ts`：修复 `waitForPhase` 函数支持中文
- `e2e/cardia/cardia-deck1-card11-clockmaker.e2e.ts`：新增测试用例

## 状态

- [x] 代码修复完成
- [x] 测试运行通过
- [x] 两个测试用例全部通过

## 结论

✅ P1 问题已完全修复。钟表匠的两个效果（立即效果和延迟效果）都已通过 E2E 测试验证。

---

**修复日期**: 2026-04-02  
**修复人员**: AI Assistant  
**问题优先级**: P1（重要）  
**实际工作量**: 30 分钟
