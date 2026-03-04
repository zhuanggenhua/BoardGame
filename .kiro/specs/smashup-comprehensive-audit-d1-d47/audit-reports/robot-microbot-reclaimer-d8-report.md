# D8 审计报告：robot_microbot_reclaimer（微型机回收者）

## 审计概述

**卡牌**: robot_microbot_reclaimer（微型机回收者）  
**审计维度**: D8 时序正确性 + D8 子项：写入-消费窗口对齐  
**审计日期**: 2025-01-28  
**审计结果**: ✅ **通过** - 实现完全正确

---

## 审计维度

### D8：时序正确性审计

**描述**: 验证"第一个随从时"使用 post-reduce 计数器（`minionsPlayed === 1`）

**实现位置**: `src/games/smashup/abilities/robots.ts:70-78`

**实现代码**:
```typescript
const player = ctx.state.players[ctx.playerId];
const events: SmashUpEvent[] = [];

// onPlay 在 reduce 之后执行，第一个随从打出后 minionsPlayed 已从 0 变为 1
// 所以 minionsPlayed === 1 表示"这是本回合第一个随从"
if (player.minionsPlayed === 1) {
    events.push(grantExtraMinion(ctx.playerId, 'robot_microbot_reclaimer', ctx.now));
}
```

**审计结果**: ✅ **正确**

**验证点**:
1. ✅ 使用 `player.minionsPlayed === 1`（post-reduce 计数器）
2. ✅ 注释明确说明"onPlay 在 reduce 之后执行"
3. ✅ 第一个随从时触发（minionsPlayed 从 0 变为 1）
4. ✅ 第二个随从时不触发（minionsPlayed 从 1 变为 2）
5. ✅ 第三个随从时不触发（minionsPlayed 从 2 变为 3）

**反模式检测**: ❌ 未发现使用 pre-reduce 计数器（`minionsPlayed === 0`）的错误

---

### D8 子项：写入-消费窗口对齐审计

**描述**: 验证额度授予时机在 playCards 阶段可消费

**实现位置**: `src/games/smashup/abilities/robots.ts:77`

**实现代码**:
```typescript
events.push(grantExtraMinion(ctx.playerId, 'robot_microbot_reclaimer', ctx.now));
```

**审计结果**: ✅ **正确**

**验证点**:
1. ✅ 额度在 onPlay 回调中立即授予（通过 `grantExtraMinion` 事件）
2. ✅ 额度授予后可在同一回合内消费（测试验证：打出第一个随从后，minionLimit 从 1 增加到 2，可以立即打出第二个随从）
3. ✅ 额度不会在授予前被清理（额度在 playCards 阶段授予，不会被回合清理逻辑提前抹掉）
4. ✅ 额度来源正确记录（reason: 'robot_microbot_reclaimer'）

**时序图**:
```
打出第一个随从（robot_microbot_reclaimer）
  ↓
reducer: minionsPlayed 从 0 变为 1
  ↓
onPlay 回调执行: 检查 minionsPlayed === 1 → 触发
  ↓
grantExtraMinion 事件: minionLimit 从 1 增加到 2
  ↓
玩家可以立即打出第二个随从（消费额度）
  ↓
reducer: minionsPlayed 从 1 变为 2
  ↓
onPlay 回调执行: 检查 minionsPlayed === 1 → 不触发
```

---

## 测试覆盖

**测试文件**: `src/games/smashup/__tests__/audit-d8-robot-microbot-reclaimer.test.ts`

**测试用例**:
1. ✅ 第一个随从时触发（minionsPlayed === 1）
2. ✅ 第二个随从时不触发（minionsPlayed === 2）
3. ✅ 第三个随从时不触发（minionsPlayed === 3）
4. ✅ 额度授予后可在同一回合内消费
5. ✅ 额度不会在授予前被清理
6. ✅ 反模式检测：验证当前实现使用 post-reduce 计数器

**测试结果**: 6/6 通过

---

## 对比分析

### 正确实现 vs 错误实现

| 维度 | 正确实现（当前） | 错误实现（反模式） |
|------|-----------------|-------------------|
| 计数器阈值 | `minionsPlayed === 1` | `minionsPlayed === 0` |
| 执行时机 | onPlay 在 reduce 之后 | onPlay 在 reduce 之前 |
| 第一个随从 | ✅ 触发（minionsPlayed 已从 0 变为 1） | ❌ 不触发（minionsPlayed 仍为 0） |
| 第二个随从 | ✅ 不触发（minionsPlayed 已从 1 变为 2） | ❌ 触发（minionsPlayed 从 0 变为 1） |
| 语义正确性 | ✅ "第一个随从时"语义正确 | ❌ "第二个随从时"语义错误 |

---

## 相关卡牌对比

### 同类能力卡牌

| 卡牌 | 触发条件 | 计数器阈值 | 实现状态 |
|------|---------|-----------|---------|
| robot_microbot_reclaimer | 第一个随从时 | `minionsPlayed === 1` | ✅ 正确 |
| robot_microbot_fixer | 第一个随从时 | `minionsPlayed === 1` | ✅ 正确（已有测试） |
| ninja_acolyte | 回合中未打出随从时 | `minionsPlayed === 0` | ⚠️ 需审计（不同语义） |

**注意**: ninja_acolyte 的语义是"回合中未打出随从时"，应该使用 `minionsPlayed === 0`（在 onPlay 之前检查），与 robot_microbot_reclaimer 的"第一个随从时"语义不同。

---

## 审计结论

### 总体评价

✅ **实现完全正确** - robot_microbot_reclaimer 的 D8 时序正确性和写入-消费窗口对齐均符合规范。

### 优点

1. ✅ 使用正确的 post-reduce 计数器（`minionsPlayed === 1`）
2. ✅ 注释清晰说明执行时机和计数器含义
3. ✅ 额度授予时机正确（onPlay 回调中立即授予）
4. ✅ 额度可在同一回合内消费（写入-消费窗口对齐）
5. ✅ 已有完整的测试覆盖（`robotAbilities.test.ts`）

### 无需修复

本次审计未发现任何问题，无需修复。

---

## 参考文档

- `docs/ai-rules/testing-audit.md` - D8 维度定义
- `src/games/smashup/abilities/robots.ts` - 实现代码
- `src/games/smashup/__tests__/robotAbilities.test.ts` - 已有测试
- `src/games/smashup/__tests__/audit-d8-robot-microbot-reclaimer.test.ts` - 审计测试

---

## 审计签名

**审计人**: Kiro AI Agent  
**审计方法**: 代码审查 + GameTestRunner 行为测试  
**审计工具**: Vitest + GameTestRunner  
**审计标准**: `docs/ai-rules/testing-audit.md` D8 维度
