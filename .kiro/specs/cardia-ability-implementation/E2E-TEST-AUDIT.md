# Cardia E2E 测试审计报告

## 审计概述

**审计日期**: 2025-02-28  
**审计范围**: Cardia 游戏的端到端测试覆盖率和质量  
**测试文件数量**: 2 个  
**总测试用例数**: 8 个  

## 一、现有测试文件分析

### 1.1 `e2e/cardia-basic-flow.e2e.ts` - 基础流程测试

**测试用例数**: 3 个  
**测试质量**: ⭐⭐⭐⭐ (4/5)

#### 测试用例清单

| 测试用例 | 覆盖场景 | 断言质量 | 状态 |
|---------|---------|---------|------|
| `should complete a full turn cycle` | 完整回合循环 | ✅ 良好 | 通过 |
| `should handle ability activation` | 能力激活流程 | ⚠️ 基础 | 通过 |
| `should end game when player reaches 5 signets` | 游戏结束条件 | ✅ 良好 | 通过 |

#### 优点
- ✅ 覆盖了完整的游戏流程（打牌 → 能力 → 结束回合）
- ✅ 使用了 TestHarness 进行状态注入
- ✅ 有详细的控制台日志和错误捕获
- ✅ 测试了游戏结束条件（5 枚印戒）

#### 不足
- ⚠️ 能力激活测试只是"尝试点击"，没有验证能力效果
- ⚠️ 没有测试具体的能力类型（只是通用流程）
- ⚠️ 缺少对能力执行后状态变化的断言

### 1.2 `e2e/cardia-interactions.e2e.ts` - 交互和边界条件测试

**测试用例数**: 5 个  
**测试质量**: ⭐⭐⭐⭐ (4/5)

#### 测试用例清单

| 测试用例 | 覆盖场景 | 断言质量 | 状态 |
|---------|---------|---------|------|
| `should handle card selection interaction` | 卡牌选择交互（外科医生） | ✅ 良好 | 通过 |
| `should handle faction selection interaction` | 派系选择交互（伏击者） | ✅ 良好 | 通过 |
| `should display ongoing ability markers` | 持续标记显示（调停者） | ⚠️ 基础 | 通过 |
| `should handle empty deck edge case` | 空牌库边界条件（破坏者） | ✅ 良好 | 通过 |
| `should handle no valid targets edge case` | 无有效目标边界条件（外科医生） | ✅ 良好 | 通过 |

#### 优点
- ✅ 覆盖了两种主要交互类型（卡牌选择、派系选择）
- ✅ 测试了边界条件（空牌库、无有效目标）
- ✅ 使用了 TestHarness 精确控制游戏状态
- ✅ 验证了交互弹窗的显示和操作

#### 不足
- ⚠️ 持续标记测试只验证了标记显示，没有验证持续效果
- ⚠️ 没有测试修正标记的显示和效果
- ⚠️ 缺少能力组合场景的测试

## 二、与 tasks.md 要求对比

### 2.1 任务 19.1：简单能力 E2E 测试

**要求**: 测试破坏者、革命者等简单资源操作能力；测试外科医生、税务官等简单影响力修正能力

**现状**:
- ✅ 已测试：破坏者（空牌库边界条件）
- ✅ 已测试：外科医生（卡牌选择交互）
- ❌ 未测试：革命者、税务官、天才、使者等其他简单能力
- ⚠️ 测试深度不足：只测试了交互流程，没有验证能力效果（如影响力变化、印戒移动）

**覆盖率**: 🟡 30% (2/7 个简单能力)

### 2.2 任务 19.2：复杂能力 E2E 测试

**要求**: 测试继承者、傀儡师等需要多步交互的能力；测试女导师、幻术师等能力复制能力

**现状**:
- ❌ 未测试：继承者（多步交互：选择保留手牌）
- ❌ 未测试：傀儡师（卡牌替换）
- ❌ 未测试：女导师、幻术师、元素师（能力复制）
- ❌ 未测试：念动力法师（修正标记移动）

**覆盖率**: 🔴 0% (0/7 个复杂能力)

### 2.3 任务 19.3：持续能力 E2E 测试

**要求**: 测试调停者、审判官等持续能力；测试机械精灵条件胜利

**现状**:
- ⚠️ 部分测试：调停者（只测试了标记显示，未测试强制平局效果）
- ❌ 未测试：审判官（赢得平局）
- ❌ 未测试：财务官、顾问（额外印戒）
- ❌ 未测试：机械精灵（条件胜利）

**覆盖率**: 🟡 20% (1/5 个持续能力，但测试不完整)

### 2.4 任务 19.4：能力组合 E2E 测试

**要求**: 测试多个能力连续触发；测试能力效果叠加；测试能力冲突和优先级

**现状**:
- ❌ 未测试：多个能力连续触发
- ❌ 未测试：能力效果叠加（如多个修正标记）
- ❌ 未测试：能力冲突和优先级（如调停者 vs 审判官）

**覆盖率**: 🔴 0%

### 2.5 任务 19.5：边界条件 E2E 测试

**要求**: 测试牌库为空时的能力；测试无可选目标时的能力；测试资源不足时的能力

**现状**:
- ✅ 已测试：牌库为空（破坏者）
- ✅ 已测试：无可选目标（外科医生）
- ❌ 未测试：资源不足（如手牌不足、场上卡牌不足）

**覆盖率**: 🟡 67% (2/3 个边界条件)

## 三、能力覆盖率矩阵

### 3.1 按能力组分类

| 能力组 | 总数 | 已测试 | 覆盖率 | 测试深度 |
|-------|------|--------|--------|---------|
| 组 1：简单资源操作 | 5 | 1 | 20% | 浅层（边界条件） |
| 组 2：影响力修正 | 12 | 1 | 8% | 浅层（交互流程） |
| 组 3：持续能力 | 5 | 1 | 20% | 浅层（标记显示） |
| 组 4：卡牌操作 | 2 | 0 | 0% | 无 |
| 组 5：能力复制 | 3 | 0 | 0% | 无 |
| 组 6：特殊机制 | 4 | 0 | 0% | 无 |
| 组 7：派系相关 | 2 | 1 | 50% | 浅层（交互流程） |
| **总计** | **33** | **4** | **12%** | **浅层** |

### 3.2 按测试类型分类

| 测试类型 | 要求 | 现状 | 覆盖率 |
|---------|------|------|--------|
| 基础流程测试 | ✅ | ✅ 完整 | 100% |
| 交互流程测试 | ✅ | ✅ 部分 | 40% (2/5 种交互) |
| 能力效果测试 | ✅ | ❌ 缺失 | 0% |
| 状态变化测试 | ✅ | ❌ 缺失 | 0% |
| 边界条件测试 | ✅ | ✅ 部分 | 67% |
| 能力组合测试 | ✅ | ❌ 缺失 | 0% |

## 四、测试质量分析

### 4.1 优点

1. **测试基础设施完善**
   - ✅ `setupOnlineMatch` 辅助函数封装良好
   - ✅ `waitForTestHarness` 确保测试工具就绪
   - ✅ 使用 TestHarness 进行精确状态注入
   - ✅ 详细的控制台日志和错误捕获

2. **测试覆盖基础流程**
   - ✅ 完整的回合循环测试
   - ✅ 游戏结束条件测试
   - ✅ 基础交互流程测试

3. **边界条件考虑**
   - ✅ 空牌库边界条件
   - ✅ 无有效目标边界条件

### 4.2 不足

1. **能力覆盖率低**
   - 🔴 只测试了 4/33 个能力（12%）
   - 🔴 大部分能力组完全没有 E2E 测试
   - 🔴 复杂能力（能力复制、多步交互）完全未测试

2. **测试深度不足**
   - 🔴 只测试了交互流程，没有验证能力效果
   - 🔴 没有验证状态变化（影响力、印戒、修正标记）
   - 🔴 没有验证 UI 显示（修正标记、持续标记的视觉效果）

3. **缺少关键场景**
   - 🔴 没有测试能力组合和优先级
   - 🔴 没有测试能力效果叠加
   - 🔴 没有测试状态回溯（影响力变化 → 遭遇结果改变 → 印戒移动）

4. **断言不够具体**
   - ⚠️ 很多测试只验证"没有崩溃"，没有验证正确性
   - ⚠️ 缺少对具体数值的断言（影响力、印戒数量）
   - ⚠️ 缺少对事件序列的验证

## 五、缺失的测试场景

### 5.1 高优先级缺失场景

1. **影响力修正和状态回溯**
   ```typescript
   // 场景：外科医生 +5 修正 → 影响力变化 → 遭遇结果改变 → 印戒移动
   // 验证：
   // - 修正标记正确显示
   // - 影响力正确计算
   // - 遭遇结果正确改变
   // - 印戒正确移动
   ```

2. **持续能力效果应用**
   ```typescript
   // 场景：调停者强制平局 → 验证遭遇结果为平局
   // 场景：审判官赢得平局 → 验证平局转换为己方获胜
   // 场景：财务官/顾问额外印戒 → 验证印戒数量正确
   ```

3. **能力复制**
   ```typescript
   // 场景：女导师复制外科医生 → 验证复制能力正确执行
   // 场景：幻术师复制对手能力 → 验证跨玩家复制
   // 场景：元素师复制弃牌堆能力 → 验证从弃牌堆复制
   ```

4. **多步交互**
   ```typescript
   // 场景：继承者 → 对手选择保留 2 张手牌 → 验证其余手牌和牌库被弃掉
   // 场景：念动力法师 → 选择源卡牌和目标卡牌 → 验证修正标记移动
   ```

5. **能力组合和优先级**
   ```typescript
   // 场景：调停者 + 审判官同时生效 → 验证审判官优先级更高
   // 场景：多个修正标记叠加 → 验证影响力正确计算
   // 场景：机械精灵 + 财务官 → 验证条件胜利优先于额外印戒
   ```

### 5.2 中优先级缺失场景

6. **特殊机制能力**
   ```typescript
   // 场景：傀儡师卡牌替换 → 验证卡牌正确替换
   // 场景：占卜师揭示顺序 → 验证对手先揭示
   // 场景：贵族额外印戒 → 验证印戒正确放置
   // 场景：精灵直接胜利 → 验证游戏立即结束
   ```

7. **卡牌操作能力**
   ```typescript
   // 场景：沼泽守卫回收卡牌 → 验证卡牌从弃牌堆回到手牌
   // 场景：虚空法师移除所有标记 → 验证所有修正标记和持续标记被移除
   ```

8. **派系相关能力**
   ```typescript
   // 场景：伏击者派系弃牌（手牌） → 验证指定派系手牌被弃掉
   // 场景：巫王派系弃牌（牌库） → 验证指定派系牌库卡牌被弃掉
   ```

### 5.3 低优先级缺失场景

9. **延迟效果**
   ```typescript
   // 场景：图书管理员 → 下一张打出的牌 +5 → 验证延迟效果触发
   // 场景：工程师 → 对手下一张打出的牌 -3 → 验证延迟效果触发
   ```

10. **资源不足边界条件**
    ```typescript
    // 场景：手牌不足时激活需要选择多张手牌的能力
    // 场景：场上卡牌不足时激活需要选择多张场上卡牌的能力
    ```

## 六、测试改进建议

### 6.1 短期改进（1-2 天）

1. **补充核心能力测试**
   - 优先级：🔴 高
   - 工作量：1 天
   - 内容：
     - 补充影响力修正能力测试（外科医生、税务官、天才、使者）
     - 补充持续能力效果测试（调停者、审判官、财务官）
     - 补充简单资源操作能力测试（革命者、破坏者）

2. **增强测试断言**
   - 优先级：🔴 高
   - 工作量：0.5 天
   - 内容：
     - 在现有测试中添加状态变化断言
     - 验证影响力、印戒数量、修正标记等具体数值
     - 验证 UI 显示（使用 `data-testid` 选择器）

### 6.2 中期改进（3-5 天）

3. **补充复杂能力测试**
   - 优先级：🟡 中
   - 工作量：2 天
   - 内容：
     - 能力复制测试（女导师、幻术师、元素师）
     - 多步交互测试（继承者、念动力法师）
     - 特殊机制测试（傀儡师、占卜师、贵族、精灵）

4. **补充能力组合测试**
   - 优先级：🟡 中
   - 工作量：1 天
   - 内容：
     - 多个能力连续触发
     - 能力效果叠加
     - 能力冲突和优先级

5. **补充状态回溯测试**
   - 优先级：🟡 中
   - 工作量：1 天
   - 内容：
     - 影响力变化 → 遭遇结果改变 → 印戒移动
     - 多个修正标记叠加 → 影响力重新计算
     - 虚空法师移除标记 → 状态回溯

### 6.3 长期改进（可选）

6. **补充边界条件测试**
   - 优先级：🟢 低
   - 工作量：1 天
   - 内容：
     - 资源不足边界条件
     - 延迟效果边界条件
     - 能力组合边界条件

7. **测试稳定性改进**
   - 优先级：🟢 低
   - 工作量：0.5 天
   - 内容：
     - 减少 `waitForTimeout` 的使用
     - 使用更可靠的等待条件（`waitForSelector`、`waitForFunction`）
     - 添加重试机制

## 七、测试模板建议

### 7.1 影响力修正能力测试模板

```typescript
test('should apply modifier and recalculate influence', async ({ browser }, testInfo) => {
    const setup = await setupOnlineMatch(browser, testInfo.project.use.baseURL);
    if (!setup) throw new Error('Failed to setup match');
    
    const { page: p1Page, page2: p2Page, cleanup } = setup;
    
    try {
        // 1. 注入初始状态：确保有特定卡牌
        await waitForTestHarness(p1Page);
        await p1Page.evaluate(() => {
            window.__BG_TEST_HARNESS__!.state.patch({
                core: {
                    players: {
                        '0': { hand: [{ cardId: 'deck_i_card_03', influence: 3, faction: 'swamp' }] }
                    }
                }
            });
        });
        
        // 2. 双方打出卡牌
        await p1Page.locator('[data-testid="cardia-hand-area"] [data-testid^="card-"]').first().click();
        await p2Page.locator('[data-testid="cardia-hand-area"] [data-testid^="card-"]').first().click();
        
        // 3. 等待进入能力阶段
        await expect(p1Page.locator('[data-testid="cardia-phase-indicator"]')).toContainText('Ability');
        
        // 4. 激活能力
        const abilityButton = p1Page.locator('[data-testid^="ability-btn-"]').first();
        await abilityButton.click();
        
        // 5. 选择目标卡牌
        const cardSelectionModal = p1Page.locator('[data-testid="card-selection-modal"]');
        await expect(cardSelectionModal).toBeVisible();
        await cardSelectionModal.locator('[data-testid^="selectable-card-"]').first().click();
        await cardSelectionModal.locator('button').filter({ hasText: /Confirm|确认/ }).click();
        
        // 6. 验证修正标记显示
        const modifierBadge = p1Page.locator('[data-testid="modifier-badge"]');
        await expect(modifierBadge).toBeVisible();
        await expect(modifierBadge).toContainText('+5');
        
        // 7. 验证影响力变化
        const cardInfluence = p1Page.locator('[data-testid="card-influence"]').first();
        await expect(cardInfluence).toContainText('8'); // 3 + 5 = 8
        
        // 8. 验证遭遇结果改变（如果影响力变化导致结果改变）
        const signetBadge = p1Page.locator('[data-testid="signet-badge"]');
        await expect(signetBadge).toBeVisible();
        
    } finally {
        await cleanup();
    }
});
```

### 7.2 持续能力测试模板

```typescript
test('should apply ongoing ability effect', async ({ browser }, testInfo) => {
    const setup = await setupOnlineMatch(browser, testInfo.project.use.baseURL);
    if (!setup) throw new Error('Failed to setup match');
    
    const { page: p1Page, page2: p2Page, cleanup } = setup;
    
    try {
        // 1. 注入初始状态：确保有持续能力卡牌
        await waitForTestHarness(p1Page);
        await p1Page.evaluate(() => {
            window.__BG_TEST_HARNESS__!.state.patch({
                core: {
                    players: {
                        '0': { hand: [{ cardId: 'deck_i_card_04', influence: 4, faction: 'dynasty' }] }
                    }
                }
            });
        });
        
        // 2. 双方打出卡牌
        await p1Page.locator('[data-testid="cardia-hand-area"] [data-testid^="card-"]').first().click();
        await p2Page.locator('[data-testid="cardia-hand-area"] [data-testid^="card-"]').first().click();
        
        // 3. 等待进入能力阶段
        await expect(p1Page.locator('[data-testid="cardia-phase-indicator"]')).toContainText('Ability');
        
        // 4. 激活持续能力
        const abilityButton = p1Page.locator('[data-testid^="ability-btn-"]').first();
        await abilityButton.click();
        
        // 5. 验证持续标记显示
        const ongoingMarker = p1Page.locator('[data-testid="ongoing-ability-marker"]');
        await expect(ongoingMarker).toBeVisible();
        await expect(ongoingMarker).toContainText('调停者');
        
        // 6. 跳过能力阶段，进入结束阶段
        const skipButton = p1Page.locator('[data-testid="cardia-skip-ability-btn"]');
        await skipButton.click();
        
        // 7. 验证持续效果应用（如强制平局）
        const encounterResult = p1Page.locator('[data-testid="encounter-result"]');
        await expect(encounterResult).toContainText('平局');
        
        // 8. 验证印戒分配（平局时双方各得 1 枚）
        const p1Signets = p1Page.locator('[data-testid="cardia-signet-display"]').first();
        const p2Signets = p2Page.locator('[data-testid="cardia-signet-display"]').first();
        await expect(p1Signets).toContainText('1');
        await expect(p2Signets).toContainText('1');
        
    } finally {
        await cleanup();
    }
});
```

## 八、总结

### 8.1 整体评价

**测试质量**: ⭐⭐⭐ (3/5)  
**能力覆盖率**: 🔴 12% (4/33)  
**测试深度**: 🟡 浅层（只测试交互流程，缺少效果验证）  
**测试稳定性**: ⭐⭐⭐⭐ (4/5)  

### 8.2 关键发现

1. **基础设施完善** ✅
   - 测试辅助函数封装良好
   - TestHarness 集成正确
   - 错误捕获和日志完善

2. **覆盖率严重不足** 🔴
   - 只测试了 4/33 个能力（12%）
   - 大部分能力组完全没有 E2E 测试
   - 复杂能力（能力复制、多步交互）完全未测试

3. **测试深度不足** 🔴
   - 只测试了交互流程，没有验证能力效果
   - 没有验证状态变化（影响力、印戒、修正标记）
   - 没有验证 UI 显示（修正标记、持续标记的视觉效果）

4. **缺少关键场景** 🔴
   - 没有测试能力组合和优先级
   - 没有测试能力效果叠加
   - 没有测试状态回溯（影响力变化 → 遭遇结果改变 → 印戒移动）

### 8.3 优先级建议

**立即修复（P0）**:
- 补充核心能力测试（影响力修正、持续能力、简单资源操作）
- 增强测试断言（验证状态变化和 UI 显示）

**尽快修复（P1）**:
- 补充复杂能力测试（能力复制、多步交互、特殊机制）
- 补充能力组合测试（多个能力连续触发、效果叠加、优先级）

**可以延后（P2）**:
- 补充状态回溯测试
- 补充边界条件测试
- 测试稳定性改进

### 8.4 下一步行动

1. **短期（1-2 天）**：补充核心能力测试，增强测试断言
2. **中期（3-5 天）**：补充复杂能力测试，补充能力组合测试
3. **长期（可选）**：补充边界条件测试，测试稳定性改进

### 8.5 验收标准

要达到 tasks.md 中的验收标准，需要：
- ✅ 至少有 5 个代表性能力有 E2E 测试且通过（当前：4 个，但测试深度不足）
- ❌ 能力执行流程完整且无明显 bug（需要补充效果验证）
- ❌ UI 能够正确显示能力按钮、交互弹窗、持续标记和修正标记（需要补充 UI 验证）

**建议**: 优先补充核心能力测试和增强测试断言，确保至少 10 个代表性能力有完整的 E2E 测试（覆盖所有 7 个能力组）。
