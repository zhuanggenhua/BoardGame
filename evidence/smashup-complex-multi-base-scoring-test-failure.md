# 大杀四方 - 复杂多基地计分测试失败调查

## 测试目标

测试 afterScoring 响应窗口在基地计分后是否正常打开。

## 测试场景

1. P0 手牌有 2 张卡：
   - `giant_ant_under_pressure` (beforeScoring special)
   - `giant_ant_we_are_the_champions` (afterScoring special)
2. 基地 0 有 3 个随从，总力量 12（等于 breakpoint）
3. 从 `playCards` 阶段开始，点击 "Finish Turn" 推进到 `scoreBases` 阶段
4. 验证 Me First! 窗口打开
5. 两个玩家都 PASS Me First! 窗口
6. **期望**：afterScoring 响应窗口打开
7. **实际**：测试超时，游戏卡在加载界面

## 问题分析

### 问题 1：测试环境加载失败

**现象**：
- 测试截图显示游戏卡在加载界面（"加载 GAMES.SMASHUP.TITLE... Loading match resources..."）
- 测试在等待游戏状态时超时（10 秒 → 30 秒）

**可能原因**：
1. `setupScene` 后游戏没有正确初始化
2. 等待条件太严格（要求手牌、随从数量完全匹配）
3. 测试环境资源加载超时

**已尝试的修复**：
1. 增加超时时间：120 秒 → 180 秒
2. 简化等待条件：只检查 `phase === 'playCards'` 和 `factionSelection === undefined`
3. 增加详细日志：记录每次等待时的状态

### 问题 2：afterScoring 窗口未打开（未验证）

**代码逻辑**（`src/games/smashup/domain/index.ts` lines 379-395）：
```typescript
const playersWithAfterScoringCards: PlayerId[] = [];
for (const [playerId, player] of Object.entries(afterScoringCore.players)) {
    const hasAfterScoringCard = player.hand.some(c => {
        if (c.type !== 'action') return false;
        const def = getCardDef(c.defId) as ActionCardDef | undefined;
        const isAfterScoring = def?.subtype === 'special' && def.specialTiming === 'afterScoring';
        console.log('🔍 [scoreBase] 检查卡牌:', {
            playerId,
            cardUid: c.uid,
            defId: c.defId,
            type: c.type,
            def: def ? { subtype: def.subtype, specialTiming: (def as any).specialTiming } : null,
            isAfterScoring,
        });
        return isAfterScoring;
    });
    if (hasAfterScoringCard) {
        playersWithAfterScoringCards.push(playerId);
    }
}
```

**检查点**：
1. `afterScoringCore.players` 是否包含正确的玩家状态？
2. `player.hand` 是否包含 `giant_ant_we_are_the_champions` 卡牌？
3. `getCardDef` 是否返回正确的卡牌定义？
4. `def.specialTiming` 是否为 `'afterScoring'`？

**无法验证**：由于测试环境加载失败，无法获取日志验证上述检查点。

## 下一步计划

### 方案 A：修复测试环境加载问题（优先）

1. **简化测试场景**：
   - 不使用 `setupScene`，改用手动创建在线对局
   - 通过调试面板注入状态（`applyCoreStateDirect`）
   - 验证游戏能否正常加载

2. **增加加载超时**：
   - 将 `waitForFunction` 超时从 30 秒增加到 60 秒
   - 添加更详细的加载进度日志

3. **检查资源加载**：
   - 验证图集、音频等资源是否正常加载
   - 检查网络请求是否有失败

### 方案 B：直接测试 scoreOneBase 函数（备选）

如果测试环境问题无法解决，可以：
1. 创建单元测试直接调用 `scoreOneBase` 函数
2. 模拟 `afterScoringCore` 状态
3. 验证 `openAfterScoringWindow` 是否被调用

## 测试文件

- 测试文件：`e2e/smashup-complex-multi-base-scoring.e2e.ts`
- 失败截图：`test-results/smashup-complex-multi-base-70531-分场景-两基地计分-afterScoring-响应窗口-chromium/test-failed-1.png`
- 错误上下文：`test-results/smashup-complex-multi-base-70531-分场景-两基地计分-afterScoring-响应窗口-chromium/error-context.md`

## 相关代码

- `src/games/smashup/domain/index.ts` (scoreOneBase 函数, lines 368-430)
- `src/games/smashup/domain/abilityHelpers.ts` (openAfterScoringWindow 函数, lines 1020-1050)
- `e2e/framework/GameTestContext.ts` (setupScene 实现)

## 总结

当前测试失败的根本原因是测试环境加载失败，游戏卡在加载界面。需要先解决测试环境问题，才能验证 afterScoring 窗口是否正常工作。

**建议**：暂时搁置此测试，优先修复测试环境加载问题，或者改用单元测试验证 `scoreOneBase` 函数的逻辑。
