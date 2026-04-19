# 大杀四方 - 响应窗口跳过逻辑修复

## 问题描述

测试 `src/games/smashup/__tests__/response-window-skip.test.ts` 失败，原因是使用了错误的卡牌类型。

## 根本原因

测试最初使用 `wizard_portal` 卡牌，但该卡牌的 `subtype: 'standard'`，不会触发 Me First! 响应窗口。

**Me First! 窗口触发条件**：
- 卡牌必须有 `subtype: 'special'`（特殊行动卡）
- 或者随从有 `beforeScoringPlayable: true`（可在计分前打出的随从）

## 修复方案

将测试卡牌从 `wizard_portal` 改为 `ninja_hidden_ninja`（便衣忍者）：

**ninja_hidden_ninja 特性**：
- `subtype: 'special'` ✅ 会触发 Me First! 窗口
- 创建交互选择手牌随从打出到基地
- 交互可以跳过（`skip: true`），适合测试跳过逻辑

**测试场景**：
1. 玩家 0 手牌：`ninja_hidden_ninja`（special 卡）+ `ninja_shinobi`（随从，供选择）
2. 玩家 1 手牌：`robot_microbot_alpha`（普通随从，无 special 卡）
3. 推进到 scoreBases 阶段 → Me First! 窗口打开
4. 玩家 0 打出 `ninja_hidden_ninja` → 创建交互
5. 玩家 0 跳过交互（`skip: true`）→ 窗口解锁
6. 窗口推进到玩家 1 → 玩家 1 无 special 卡，被跳过
7. 窗口重新回到玩家 0（`currentResponderIndex: 0`）
8. 玩家 0 pass → 窗口关闭

## 代码变更

### 修改前（错误）
```typescript
core.players['0'].hand = [
    { uid: 'card-1', defId: 'wizard_portal', type: 'action', owner: '0' },
];
core.players['0'].deck = [
    { uid: 'minion-1', defId: 'ninja_shinobi', type: 'minion', owner: '0' },
    { uid: 'minion-2', defId: 'robot_microbot_alpha', type: 'minion', owner: '0' },
];
```

### 修改后（正确）
```typescript
core.players['0'].hand = [
    { uid: 'card-1', defId: 'ninja_hidden_ninja', type: 'action', owner: '0' },
    { uid: 'minion-1', defId: 'ninja_shinobi', type: 'minion', owner: '0' }, // 手牌中有随从供 hidden_ninja 选择
];
```

## 测试结果

```
✓ src/games/smashup/__tests__/response-window-skip.test.ts (2 tests) 23ms
  ✓ 响应窗口跳过逻辑 (2)
    ✓ 重新开始一轮时应跳过没有可响应内容的玩家 18ms
    ✓ 所有玩家都没有可响应内容时应立即关闭窗口 3ms
```

## 关键日志

```
[skipToNextRespondableResponder] loopUntilAllPass: 本轮有动作，重新开始（跳过无内容玩家）
[hasRespondableContent] Result: { playerId: '0', hasSpecialAction: false, hasBeforeScoringMinion: true, result: true }
[skipToNextRespondableResponder] 检查玩家: { index: 0, playerId: '0', hasContent: true }
[skipToNextRespondableResponder] 返回原窗口
[Test] After interaction resolved: {
  hasWindow: true,
  currentResponderIndex: 0,  // ✅ 跳过玩家 1，回到玩家 0
  actionTakenThisRound: false,
  pendingInteractionId: undefined
}
```

## 教训

1. **卡牌类型必须匹配测试场景**：测试 Me First! 窗口时，必须使用 `subtype: 'special'` 的卡牌
2. **忍者派系卡牌分类**：
   - `ninja_hidden_ninja`：special action（`subtype: 'special'`）✅
   - `ninja_shinobi`：minion with `beforeScoringPlayable: true`（不是 special action）❌
   - `ninja_acolyte`：minion with `abilityTags: ['special']`（不是 special action）❌
3. **交互可跳过性**：`ninja_hidden_ninja` 的交互支持 `skip: true`，适合测试跳过逻辑

## 相关文件

- `src/games/smashup/__tests__/response-window-skip.test.ts` - 测试文件
- `src/games/smashup/data/factions/ninjas.ts` - 忍者卡牌定义
- `src/games/smashup/abilities/ninjas.ts` - 忍者能力实现
- `src/engine/systems/ResponseWindowSystem.ts` - 响应窗口系统

## 完成时间

2026-03-04
