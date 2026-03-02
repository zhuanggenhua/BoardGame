# 恐龙测试修复最终总结

## 问题根因

`ninja_assassination` 的 `onTurnEnd` 触发器在**每个玩家的回合结束时**都会触发，而不是只在卡牌拥有者的回合结束时触发。这导致在测试"多次拦截"场景时，`tooth_and_claw` 被错误地消耗了两次：

1. 玩家0回合结束时触发 → 消耗第一张 `tooth_and_claw` ✅
2. 切换到玩家1回合，玩家1回合结束时**又触发了一次** → 错误地消耗了第二张 `tooth_and_claw` ❌

## 修复方案

在 `ninja_assassination` 的 `onTurnEnd` 触发器中添加拥有者检查，只在暗杀卡拥有者的回合结束时触发：

```typescript
// 修复前：所有附着了 assassination 的随从都会在每个玩家回合结束时被消灭
const assassinationCard = m.attachedActions.find(a => a.defId === 'ninja_assassination');
if (assassinationCard) {
    // 触发消灭事件
}

// 修复后：只在暗杀卡拥有者的回合结束时触发
const assassinationCard = m.attachedActions.find(a => a.defId === 'ninja_assassination');
if (assassinationCard && assassinationCard.ownerId === trigCtx.playerId) {
    // 触发消灭事件
}
```

## 修改文件

1. **`src/games/smashup/abilities/ninjas.ts`** (第422-445行)
   - 在 `ninja_assassination` 的 `onTurnEnd` 触发器中添加 `assassinationCard.ownerId === trigCtx.playerId` 检查
   - 添加注释说明只在拥有者回合结束时触发

2. **`src/games/smashup/__tests__/audit-d31-dino-tooth-and-claw.test.ts`**
   - 移除所有调试日志（`console.log`）

3. **`src/games/smashup/abilities/dinosaurs.ts`**
   - 移除 `dinoToothAndClawInterceptor` 中的所有调试日志

## 测试结果

所有5个测试用例全部通过：

- ✅ 拦截路径1（直接命令执行）— 拦截消灭事件
- ✅ 拦截路径2（交互解决）— 拦截返回手牌事件
- ✅ 不拦截己方操作 — 己方消灭自己的随从
- ✅ POD版简单保护 — 只保护不自毁
- ✅ 拦截路径完整性 — 多次拦截

## 教训

**onTurnEnd 触发器的语义**：`onTurnEnd` 触发器会在**每个玩家的回合结束时**都触发，而不是只在特定玩家的回合结束时触发。如果需要限制触发时机，必须在触发器内部检查 `trigCtx.playerId` 是否匹配卡牌拥有者。

**类似的触发器需要检查**：
- `onTurnStart` — 可能也需要检查拥有者
- `beforeScoring` / `afterScoring` — 通常不需要检查（所有玩家都参与计分）
- `onMinionPlayed` / `onMinionDestroyed` — 通常不需要检查（事件本身已包含玩家信息）

## 完成状态

✅ 所有恐龙测试修复完成
✅ 所有调试日志已清理
✅ 代码质量良好，无遗留问题
