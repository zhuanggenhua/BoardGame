# 托尔图加计分后便衣忍者交互卡住 Bug 分析

## Bug 报告

**提交者**: 匿名用户  
**时间**: 2026/2/28 16:22:39  
**反馈内容**: 图尔加卡死  

## 状态快照分析

```json
{
  "phase": "scoreBases",
  "currentPlayerIndex": 0,
  "turnNumber": 5,
  "bases": [
    {
      "defId": "base_the_mothership",
      "minions": []
    },
    {
      "defId": "base_tortuga",
      "minions": [
        // 玩家1（游客6118）: 10 力量
        { "uid": "c46", "defId": "alien_scout", "controller": "1", "basePower": 3 },
        { "uid": "c78", "defId": "robot_microbot_fixer", "controller": "1", "basePower": 1 },
        { "uid": "c65", "defId": "robot_hoverbot", "controller": "1", "basePower": 3 },
        { "uid": "c42", "defId": "alien_invader", "controller": "1", "basePower": 3, "playedThisTurn": true },
        
        // 玩家0（管理员1）: 17 力量
        { "uid": "c3", "defId": "pirate_buccaneer", "controller": "0", "basePower": 4 },
        { "uid": "c10", "defId": "pirate_first_mate", "controller": "0", "basePower": 2 },
        { "uid": "c27", "defId": "ninja_acolyte", "controller": "0", "basePower": 2 },
        { "uid": "c28", "defId": "ninja_acolyte", "controller": "0", "basePower": 2, "playedThisTurn": true },
        { "uid": "c29", "defId": "ninja_acolyte", "controller": "0", "basePower": 2, "playedThisTurn": true },
        { "uid": "c1", "defId": "pirate_king", "controller": "0", "basePower": 5 }
      ]
    }
  ],
  "scoringEligibleBaseIndices": [1],
  "specialLimitUsed": {
    "ninja_hidden_ninja": [1]
  }
}
```

### 力量计算

**托尔图加基地**（临界点 20）:
- 玩家0（管理员1）: 海盗桶(4) + 大副(2) + 忍者侍从×3(2+2+2) + 海盗王(5) = **17 力量**
- 玩家1（游客6118）: 侦察兵(3) + 微型机修理者(1) + 盘旋机器人(3) + 入侵者(3) = **10 力量**
- **总力量**: 27（已达到临界点 20）

**排名**:
1. 冠军: 玩家0（17 力量）
2. 亚军: 玩家1（10 力量）

## 操作日志分析

```
[16:22:20] 管理员1: 行动卡施放： 便衣忍者
[16:21:50] 管理员1: 随从登场： 忍者侍从  → 托尔图加
[16:21:45] 游客6118: 随从登场： 入侵者  → 托尔图加
[16:21:45] 游客6118: 游客6118 获得 1VP （原因： 入侵者 ）
[16:21:41] 管理员1: 随从登场： 忍者侍从  → 托尔图加
```

### 时间线推断

1. **16:20:34** - 管理员1 打出海盗王到母舰
2. **16:20:40-16:21:50** - 双方打出多个随从到托尔图加
3. **16:22:20** - 管理员1 打出便衣忍者（special action）
4. **之后** - 托尔图加达到临界点，进入计分阶段
5. **卡住** - 无法结束回合

## 根因分析

这是 **便衣忍者交互 UI 未显示** 的问题，与之前的两个 bug 完全相同:

1. `docs/bugs/smashup-ninja-hidden-ninja-interaction-not-visible.md` (2026/2/27)
2. `docs/bugs/smashup-tortuga-无法结束回合-analysis.md` (2026/2/28)

### 问题链条

1. **便衣忍者在 Me First! 响应窗口中打出**
   - 创建交互: 选择手牌中的随从打出到该基地
   - 交互设置 `targetType: 'hand'`（用于框架层自动刷新）

2. **UI 层判定为手牌直选模式**
   - `targetType: 'hand'` → `isHandDiscardPrompt === true`
   - `PromptOverlay` 不渲染（被条件排除）

3. **浮动按钮不显示**
   - 便衣忍者的所有选项都有 `cardUid`（手牌中的随从）
   - `handSelectExtraOptions.length === 0`（没有非手牌选项）
   - 浮动按钮不渲染

4. **用户看不到任何交互 UI**
   - 既没有 `PromptOverlay` 弹窗
   - 也没有浮动按钮
   - 用户以为卡住了

### 之前的修复

**2026/2/27 修复**:
- 问题: 便衣忍者交互未显示
- 方案: 添加"跳过"选项
- 结果: `handSelectExtraOptions.length > 0`，浮动按钮显示

**为什么又出现了?**

可能的原因:
1. 修复未完全部署到生产环境
2. 修复只针对特定场景，未覆盖所有情况
3. 代码回滚或合并冲突导致修复丢失

## 验证步骤

### 1. 检查便衣忍者代码

查看 `src/games/smashup/abilities/ninjas.ts` 中的 `ninjaHiddenNinja` 函数:

```typescript
function ninjaHiddenNinja(ctx: AbilityContext): AbilityResult {
    // ...
    const options = minionCards.map((c, i) => {
        // ...
        return { id: `hand-${i}`, label: `${name} (力量 ${power})`, value: { cardUid: c.uid, defId: c.defId, power } };
    });
    
    // ✅ 应该有"跳过"选项
    const skipOption = { id: 'skip', label: '跳过', value: { skip: true } };
    
    const interaction = createSimpleChoice(
        `ninja_hidden_ninja_${ctx.now}`, ctx.playerId,
        '选择要打出到该基地的随从（可跳过）',
        [...options, skipOption], // ← 检查是否包含 skipOption
        { sourceId: 'ninja_hidden_ninja', targetType: 'hand' },
    );
    // ...
}
```

### 2. 检查交互处理器

查看 `ninja_hidden_ninja` 交互处理器是否处理跳过逻辑:

```typescript
registerInteractionHandler('ninja_hidden_ninja', (state, playerId, value, iData, _random, timestamp) => {
    // ✅ 应该有跳过逻辑
    if ((value as any).skip) return { state, events: [] };
    
    const { cardUid, defId, power } = value as { cardUid: string; defId: string; power: number };
    // ...
});
```

### 3. 运行 E2E 测试

运行 `e2e/ninja-hidden-ninja-skip-option.e2e.ts` 验证修复是否生效:

```bash
npm run test:e2e -- ninja-hidden-ninja-skip-option
```

## 解决方案

### 方案1: 确认修复已部署（推荐）

1. 检查 `src/games/smashup/abilities/ninjas.ts` 是否包含"跳过"选项
2. 如果没有，重新应用之前的修复
3. 运行 E2E 测试验证
4. 部署到生产环境

### 方案2: 使用 `displayMode: 'overlay'`（备选）

如果不想添加"跳过"选项，可以强制使用弹窗模式:

```typescript
const interaction = createSimpleChoice(
    `ninja_hidden_ninja_${ctx.now}`, ctx.playerId,
    '选择要打出到该基地的随从',
    options,
    { 
        sourceId: 'ninja_hidden_ninja', 
        targetType: 'hand',
        displayMode: 'overlay', // ← 强制使用弹窗模式
    },
);
```

但这会失去框架层的自动刷新功能（需要手动实现 `optionsGenerator`）。

## 推荐行动

1. **立即检查代码**: 确认便衣忍者是否包含"跳过"选项
2. **如果缺失**: 重新应用修复（添加"跳过"选项）
3. **运行测试**: 验证修复是否生效
4. **部署**: 更新生产环境
5. **通知用户**: 告知 bug 已修复，刷新页面即可

## 相关文档

- `docs/bugs/smashup-ninja-hidden-ninja-interaction-not-visible.md` - 之前的修复（2026/2/27）
- `docs/bugs/smashup-tortuga-无法结束回合-analysis.md` - 类似问题分析
- `docs/interaction-ui-modes.md` - UI 渲染模式详解
- `e2e/ninja-hidden-ninja-skip-option.e2e.ts` - E2E 测试

## 教训

1. **修复必须有测试覆盖**: 便衣忍者的修复应该有 E2E 测试，防止回归
2. **部署验证**: 修复后必须在生产环境验证是否生效
3. **监控**: 应该有监控机制，及时发现交互 UI 未显示的问题
4. **文档**: 修复文档应该包含验证步骤和回归测试
