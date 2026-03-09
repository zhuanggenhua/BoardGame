# Cardia 卡组1 E2E测试 - 完整回合流程审计计划

> **审计日期**: 2026-03-01  
> **审计目标**: 确保每个测试不仅测试卡牌能力，还测试完整的回合流程  
> **审计范围**: 16个角色测试文件（card01-card16）

---

## 执行摘要

### 当前状态
- ✅ 所有16个测试都能正常运行
- ✅ 所有测试都验证了卡牌能力本身
- ❌ **所有测试都缺少完整回合流程验证**

### 问题定义
当前测试只覆盖了"能力激活"这一个点，缺少：
1. **阶段1验证**：打出卡牌阶段的完整流程
2. **阶段2验证**：影响力比较 → 判定胜负 → 印戒放置 → 能力激活的完整流程
3. **阶段3验证**：回合结束 → 抽牌 → 胜利条件检查的完整流程

### 改进目标
为每个测试补充完整回合流程验证，确保：
- ✅ 阶段1：双方同时打出卡牌，同时翻开
- ✅ 阶段2：影响力比较 → 判定胜负 → 印戒放置 → 失败者激活能力
- ✅ 阶段3：回合结束 → 双方抽牌 → 检查胜利条件

---

## 完整回合流程定义

根据 `src/games/cardia/rule/卡迪亚规则.md`：

### 阶段1：打出卡牌 (play)
1. 双方玩家同时从手牌选择1张卡牌
2. 面朝下放置在面前
3. 同时翻开卡牌

**测试验证点**：
- [ ] 双方都能打出卡牌
- [ ] 卡牌正确添加到 `playedCards` 数组
- [ ] 手牌数量减少1
- [ ] 阶段自动推进到 `ability`

### 阶段2：激活能力 (ability)
1. **比较影响力**（基础值 + 修正标记）
2. **判定胜负**：
   - 影响力高者获胜，在其获胜的那张牌上放置1个印戒
   - 平局：双方都不获得印戒，跳过能力阶段，直接进入回合结束阶段
3. **失败者激活能力**：
   - 只有失败者可以激活其卡牌上的能力
   - ⚡ 即时能力：立即执行效果后结束
   - 🔄 持续能力：放置持续标记，效果持续生效

**测试验证点**：
- [ ] 影响力比较正确（基础值 + 修正标记）
- [ ] 胜负判定正确
- [ ] 印戒放置正确（放在获胜的那张牌上）
- [ ] 只有失败者能激活能力
- [ ] 能力效果正确执行
- [ ] 持续能力正确放置持续标记
- [ ] 平局时跳过能力阶段

### 阶段3：回合结束 (draw)
1. 双方玩家各抽1张牌
2. 如果牌库为空，不抽牌（不会立即失败）
3. 检查胜利条件：
   - 如果你场上所有卡牌的印戒总和≥5，立即获胜
   - 如果双方印戒总和均≥5且相等，继续游戏直到分出多少

**测试验证点**：
- [ ] 双方都抽1张牌（如果牌库不为空）
- [ ] 手牌数量增加1
- [ ] 牌库数量减少1
- [ ] 牌库为空时不抽牌（不报错）
- [ ] 胜利条件检查正确
- [ ] 阶段自动推进到下一回合的 `play`

---

## 审计清单

### 通用测试模板改进

#### 改进前（当前）
```typescript
test('影响力X - 角色名：能力描述', async ({ browser }) => {
    // 1. Setup
    const setup = await setupCardiaOnlineMatch(browser);
    
    // 2. 注入手牌
    await injectHandCards(p1Page, '0', [{ defId: 'deck_i_card_XX' }]);
    await injectHandCards(p2Page, '1', [{ defId: 'deck_i_card_YY' }]);
    await setPhase(p1Page, 'play');
    
    // 3. 打出卡牌
    await playCard(p1Page, 0);
    await playCard(p2Page, 0);
    
    // 4. 激活能力
    await waitForPhase(p1Page, 'ability');
    await abilityButton.click();
    
    // 5. 验证能力效果
    const afterAbility = await readCoreState(p1Page);
    expect(afterAbility.xxx).toBe(yyy);
    
    // ❌ 缺少：回合结束阶段验证
    // ❌ 缺少：抽牌验证
    // ❌ 缺少：印戒验证
    // ❌ 缺少：阶段推进验证
});
```

#### 改进后（目标）
```typescript
test('影响力X - 角色名：完整回合流程', async ({ browser }) => {
    // 1. Setup
    const setup = await setupCardiaOnlineMatch(browser);
    
    // 2. 注入手牌（确保有足够的牌用于抽牌）
    await injectHandCards(p1Page, '0', [
        { defId: 'deck_i_card_XX' }, // 本回合打出
        { defId: 'deck_i_card_01' }, // 下回合备用
    ]);
    await injectHandCards(p2Page, '1', [
        { defId: 'deck_i_card_YY' }, // 本回合打出
        { defId: 'deck_i_card_02' }, // 下回合备用
    ]);
    await setPhase(p1Page, 'play');
    
    // 记录初始状态
    const initialState = await readCoreState(p1Page);
    const initialP1HandSize = initialState.players['0'].hand.length;
    const initialP2HandSize = initialState.players['1'].hand.length;
    const initialP1DeckSize = initialState.players['0'].deck.length;
    const initialP2DeckSize = initialState.players['1'].deck.length;
    
    // ===== 阶段1：打出卡牌 =====
    console.log('\n=== 阶段1：打出卡牌 ===');
    await playCard(p1Page, 0);
    await playCard(p2Page, 0);
    
    // 验证阶段1
    const afterPlay = await readCoreState(p1Page);
    expect(afterPlay.players['0'].playedCards.length).toBe(1); // P1 打出1张
    expect(afterPlay.players['1'].playedCards.length).toBe(1); // P2 打出1张
    expect(afterPlay.players['0'].hand.length).toBe(initialP1HandSize - 1); // 手牌减少
    expect(afterPlay.players['1'].hand.length).toBe(initialP2HandSize - 1); // 手牌减少
    expect(afterPlay.phase).toBe('ability'); // 阶段推进
    
    // ===== 阶段2：激活能力 =====
    console.log('\n=== 阶段2：激活能力 ===');
    await waitForPhase(p1Page, 'ability');
    
    // 验证影响力比较和印戒放置
    const beforeAbility = await readCoreState(p1Page);
    const p1Card = beforeAbility.players['0'].playedCards[0];
    const p2Card = beforeAbility.players['1'].playedCards[0];
    const p1Influence = calculateInfluence(p1Card, beforeAbility.modifierTokens);
    const p2Influence = calculateInfluence(p2Card, beforeAbility.modifierTokens);
    
    console.log('影响力比较:', { p1Influence, p2Influence });
    
    // 判定胜负
    const winner = p1Influence > p2Influence ? '0' : '1';
    const loser = winner === '0' ? '1' : '0';
    
    // 验证印戒放置（在获胜的那张牌上）
    const winnerCard = beforeAbility.players[winner].playedCards[0];
    expect(winnerCard.seals).toBe(1); // 获胜者的牌上有1个印戒
    
    // 激活失败者能力
    const abilityButton = p1Page.locator('[data-testid="cardia-activate-ability-btn"]');
    if (loser === '0') {
        await abilityButton.waitFor({ state: 'visible', timeout: 5000 });
        await abilityButton.click();
    } else {
        // P2 失败，P1 应该看不到能力按钮
        await expect(abilityButton).not.toBeVisible();
    }
    
    await p1Page.waitForTimeout(1000);
    
    // 验证能力效果
    const afterAbility = await readCoreState(p1Page);
    expect(afterAbility.xxx).toBe(yyy); // 能力特定效果
    
    // ===== 阶段3：回合结束 =====
    console.log('\n=== 阶段3：回合结束 ===');
    
    // 等待进入抽牌阶段
    await waitForPhase(p1Page, 'draw');
    
    // 验证抽牌
    const afterDraw = await readCoreState(p1Page);
    expect(afterDraw.players['0'].hand.length).toBe(initialP1HandSize); // 手牌恢复（-1打出 +1抽牌）
    expect(afterDraw.players['1'].hand.length).toBe(initialP2HandSize); // 手牌恢复
    expect(afterDraw.players['0'].deck.length).toBe(initialP1DeckSize - 1); // 牌库减少
    expect(afterDraw.players['1'].deck.length).toBe(initialP2DeckSize - 1); // 牌库减少
    
    // 验证胜利条件检查
    const totalSeals = afterDraw.players['0'].playedCards.reduce(
        (sum: number, c: any) => sum + (c.seals || 0), 0
    );
    if (totalSeals >= 5) {
        expect(afterDraw.sys.gameover?.winnerId).toBe('0');
    } else {
        expect(afterDraw.sys.gameover).toBeUndefined();
    }
    
    // 验证阶段推进到下一回合
    expect(afterDraw.phase).toBe('play'); // 新回合开始
    
    console.log('✅ 完整回合流程验证通过');
});
```

---

## 16个测试文件改进清单

### 简单能力（即时能力，单次效果）

#### 1. card01 - 雇佣剑士
- **当前状态**: ✅ 能力测试完整
- **需要补充**:
  - [ ] 阶段1验证（打出卡牌）
  - [ ] 印戒放置验证（P2获胜，P2的牌上有1个印戒）
  - [ ] 阶段3验证（回合结束 + 抽牌）
  - [ ] 阶段推进验证（play → ability → draw → play）

#### 2. card02 - 虚空法师
- **当前状态**: ✅ 能力测试完整
- **需要补充**:
  - [ ] 阶段1验证
  - [ ] 印戒放置验证
  - [ ] 阶段3验证
  - [ ] 前置条件验证（场上需要有修正标记）

#### 3. card03 - 外科医生
- **当前状态**: ✅ 能力测试完整
- **需要补充**:
  - [ ] 阶段1验证
  - [ ] 印戒放置验证
  - [ ] 阶段3验证
  - [ ] 修正标记持久性验证（下回合仍然生效）

#### 4. card04 - 调停者
- **当前状态**: ✅ 能力测试完整（持续能力）
- **需要补充**:
  - [ ] 阶段1验证
  - [ ] 平局时印戒处理验证（归还印戒）
  - [ ] 阶段3验证
  - [ ] 持续标记持久性验证（下回合仍然生效）

#### 5. card05 - 破坏者
- **当前状态**: ✅ 能力测试完整
- **需要补充**:
  - [ ] 阶段1验证
  - [ ] 印戒放置验证
  - [ ] 阶段3验证
  - [ ] 边界条件：对手牌库不足2张时的处理

#### 6. card06 - 占卜师
- **当前状态**: ✅ 能力测试完整
- **需要补充**:
  - [ ] 阶段1验证
  - [ ] 印戒放置验证
  - [ ] 阶段3验证
  - [ ] 下回合验证（对手先揭示）

### 中等复杂度（条件能力，需要特定前置条件）

#### 7. card07 - 宫廷卫士
- **当前状态**: ✅ 能力测试完整（条件影响力）
- **需要补充**:
  - [ ] 阶段1验证
  - [ ] 印戒放置验证
  - [ ] 阶段3验证
  - [ ] 条件满足/不满足两种情况

#### 8. card08 - 审判官
- **当前状态**: ✅ 能力测试完整（持续能力）
- **需要补充**:
  - [ ] 阶段1验证
  - [ ] 印戒放置验证
  - [ ] 阶段3验证
  - [ ] 持续标记持久性验证

#### 9. card09 - 伏击者
- **当前状态**: ✅ 能力测试完整（揭示顺序）
- **需要补充**:
  - [ ] 阶段1验证
  - [ ] 印戒放置验证
  - [ ] 阶段3验证
  - [ ] 揭示顺序验证

#### 10. card10 - 傀儡师
- **当前状态**: ✅ 能力测试完整（复制能力）
- **需要补充**:
  - [ ] 阶段1验证
  - [ ] 印戒放置验证
  - [ ] 阶段3验证
  - [ ] 复制能力的完整效果验证

#### 11. card11 - 钟表匠
- **当前状态**: ✅ 能力测试完整（回收卡牌）
- **需要补充**:
  - [ ] 阶段1验证
  - [ ] 印戒放置验证
  - [ ] 阶段3验证
  - [ ] 回收卡牌后的手牌验证

#### 12. card12 - 财务官
- **当前状态**: ✅ 能力测试完整（抽牌条件）
- **需要补充**:
  - [ ] 阶段1验证
  - [ ] 印戒放置验证
  - [ ] 阶段3验证
  - [ ] 条件满足/不满足两种情况

#### 13. card13 - 沼泽守卫
- **当前状态**: ✅ 能力测试完整（派系相关）
- **需要补充**:
  - [ ] 阶段1验证
  - [ ] 印戒放置验证
  - [ ] 阶段3验证
  - [ ] 派系匹配/不匹配两种情况

#### 14. card14 - 女导师
- **当前状态**: ✅ 能力测试完整（教学相关）
- **需要补充**:
  - [ ] 阶段1验证
  - [ ] 印戒放置验证
  - [ ] 阶段3验证
  - [ ] 教学效果验证

### 复杂能力（特殊机制，多步骤）

#### 15. card15 - 发明家
- **当前状态**: ✅ 能力测试完整（特殊机制）
- **需要补充**:
  - [ ] 阶段1验证
  - [ ] 印戒放置验证
  - [ ] 阶段3验证
  - [ ] 特殊机制的完整流程验证

#### 16. card16 - 精灵
- **当前状态**: ✅ 能力测试完整（直接获胜）
- **需要补充**:
  - [ ] 阶段1验证
  - [ ] 印戒放置验证（能力触发前）
  - [ ] 直接获胜验证（跳过阶段3）
  - [ ] 胜利条件验证

---

## 改进策略

### 策略A：为每个测试添加完整回合流程（推荐）
**目标**: 每个测试都验证完整的回合流程

**优点**:
- 测试覆盖更全面
- 能发现阶段推进的bug
- 能发现印戒放置的bug
- 能发现抽牌逻辑的bug

**缺点**:
- 测试代码量增加（每个测试约+50行）
- 测试运行时间增加（每个测试约+2秒）

**估算工作量**: 16个文件 × 1小时 = 16小时

### 策略B：创建单独的回合流程测试
**目标**: 创建一个通用的回合流程测试，覆盖所有阶段

**优点**:
- 不修改现有测试
- 集中测试回合流程
- 易于维护

**缺点**:
- 无法验证每个能力对回合流程的影响
- 可能遗漏能力与回合流程的交互bug

**估算工作量**: 1个新测试文件 × 4小时 = 4小时

### 策略C：混合策略（推荐）
**目标**: 
1. 创建1个通用回合流程测试（覆盖基础流程）
2. 为关键能力添加完整回合流程验证（如调停者、精灵）

**优点**:
- 平衡测试覆盖和工作量
- 关键能力有完整验证
- 基础流程有通用测试

**缺点**:
- 需要判断哪些是"关键能力"

**估算工作量**: 1个通用测试（4小时）+ 5个关键能力（5小时）= 9小时

---

## 推荐方案

**采用策略C（混合策略）**，理由：
1. 通用回合流程测试覆盖基础流程，确保引擎正确
2. 关键能力（调停者、精灵、占卜师、傀儡师、发明家）添加完整验证
3. 平衡测试覆盖和工作量
4. 优先级明确，可分批实施

---

## 实施计划

### 阶段1：创建通用回合流程测试（P0）
**文件**: `e2e/cardia-full-turn-flow.e2e.ts`

**测试场景**:
1. 基础回合流程（无能力）
2. 即时能力回合流程
3. 持续能力回合流程
4. 平局回合流程
5. 牌库为空时的回合流程
6. 达到5印戒时的胜利流程

**估算时间**: 4小时

### 阶段2：为关键能力添加完整验证（P1）
**文件列表**:
1. `card04-mediator.e2e.ts` - 调停者（平局机制）
2. `card06-diviner.e2e.ts` - 占卜师（揭示顺序）
3. `card10-puppeteer.e2e.ts` - 傀儡师（复制能力）
4. `card15-inventor.e2e.ts` - 发明家（特殊机制）
5. `card16-elf.e2e.ts` - 精灵（直接获胜）

**估算时间**: 5小时（每个1小时）

### 阶段3：为所有能力添加完整验证（P2，可选）
**文件列表**: 剩余11个测试文件

**估算时间**: 11小时（每个1小时）

---

## 验收标准

### 阶段1验收标准
- ✅ 通用回合流程测试通过
- ✅ 覆盖6个基础场景
- ✅ 所有阶段推进正确
- ✅ 印戒放置正确
- ✅ 抽牌逻辑正确

### 阶段2验收标准
- ✅ 5个关键能力测试通过
- ✅ 每个测试验证完整回合流程
- ✅ 能力与回合流程的交互正确

### 阶段3验收标准
- ✅ 所有16个测试验证完整回合流程
- ✅ 测试覆盖率100%
- ✅ 所有测试稳定通过

---

## 风险管理

### 风险1：测试运行时间增加
**影响**: 每个测试增加约2秒，总计约32秒
**缓解**: 使用并行执行（`--workers=4`），实际增加约8秒

### 风险2：测试复杂度增加
**影响**: 测试代码量增加，维护成本增加
**缓解**: 提取公共验证函数，减少重复代码

### 风险3：现有测试可能失败
**影响**: 添加新断言后，可能发现现有bug
**缓解**: 这是好事，说明测试有效

---

## 总结

**当前问题**: 所有测试只验证能力本身，缺少完整回合流程验证

**改进目标**: 补充完整回合流程验证，确保：
- 阶段1：打出卡牌正确
- 阶段2：影响力比较 → 印戒放置 → 能力激活正确
- 阶段3：回合结束 → 抽牌 → 胜利条件检查正确

**推荐方案**: 混合策略
- 创建1个通用回合流程测试（4小时）
- 为5个关键能力添加完整验证（5小时）
- 可选：为所有能力添加完整验证（11小时）

**总工作量**: 9-20小时

**优先级**: P0（通用测试）→ P1（关键能力）→ P2（所有能力）

