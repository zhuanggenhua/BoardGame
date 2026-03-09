# Card09 伏击者 - 调试材料已准备完成

## 已创建的文件

### 1. CARD09-INJECT-STATE.json
**用途**：手动测试时注入的游戏状态

**内容**：
- P1 手牌：伏击者（影响力 9）+ 2 张其他牌
- P2 手牌：4 张
  - 傀儡师（影响力 10，Academy 派系）
  - 审判官（影响力 8，Academy 派系）
  - 女导师（影响力 14，Academy 派系）
  - 雇佣剑士（影响力 1，Guild 派系）
- 阶段：play
- 回合数：2

**使用方法**：
1. 打开调试面板（Debug 按钮或 Ctrl+Shift+D）
2. 切换到 State 标签页
3. 点击 "Toggle Input" 按钮
4. 粘贴 JSON 内容
5. 点击 "Apply" 按钮

### 2. CARD09-DEBUG-GUIDE.md
**用途**：完整的手动调试指南

**内容**：
- 问题概述
- 手动测试步骤（准备工作、注入状态、打出卡牌、激活能力、调试派系选择）
- 关键日志（交互处理器日志、CardiaEventSystem 日志、弃牌事件日志）
- 问题排查（弹窗没有出现、手牌没有被弃掉、选择了错误的派系）
- 完整状态检查命令
- 预期的完整流程
- 调试结果记录表
- 下一步行动
- 注意事项
- 相关文档

## 测试场景

### 初始状态
- P1 手牌：伏击者（影响力 9）
- P2 手牌：4 张（3 张 Academy + 1 张 Guild）

### 游戏流程
1. P1 打出伏击者（影响力 9）
2. P2 打出傀儡师（影响力 10，Academy 派系）
3. P1 失败（9 < 10），进入 ability 阶段
4. P1 激活伏击者能力
5. P1 选择 Academy 派系
6. **预期**：P2 的 2 张 Academy 派系手牌被弃掉（审判官、女导师）
7. **预期**：P2 手牌只剩 1 张（Guild 派系的雇佣剑士）

### 预期结果
- P2 手牌数量：1 张（Guild 派系的雇佣剑士）
- P2 弃牌堆数量：2 张（审判官、女导师）
- P2 Academy 派系手牌数量：0

### 实际结果（如果有 bug）
- P2 手牌数量：3 张（没有变化）
- P2 弃牌堆数量：0 张（没有增加）
- P2 Academy 派系手牌数量：2 张（没有被弃掉）

## 可能的问题

### 问题 1：abilityId 字段缺失
**状态**：✅ 已修复（ABILITYID-FIX-COMPLETE.md）

### 问题 2：框架层 bug（与 Card15 相同）
**状态**：❓ 待确认

**症状**：
- 交互处理器被调用
- 事件被发射（CARDS_DISCARDED）
- 但状态没有更新（手牌没有被弃掉）

**原因**：
交互处理器返回的 `state` 不会被应用（框架层已知 bug）

**解决方案**：
- 参考 Card15 的修复方案（CARD15-BUG-FIX-COMPLETE.md）
- 通过 `CardiaEventSystem` 的 `afterEvents` 钩子发射事件
- 或者修改框架层，使交互处理器返回的 `events` 能够被正确应用

## 调试检查清单

### 步骤 1：注入状态
- [ ] 打开调试面板
- [ ] 切换到 State 标签页
- [ ] 粘贴 CARD09-INJECT-STATE.json 的内容
- [ ] 点击 Apply 按钮
- [ ] 确认状态已更新（P1 手牌有伏击者，P2 手牌有 4 张）

### 步骤 2：打出卡牌
- [ ] P1 打出伏击者（影响力 9）
- [ ] P2 打出傀儡师（影响力 10）
- [ ] 确认进入 ability 阶段

### 步骤 3：激活能力
- [ ] P1 点击"激活能力"按钮
- [ ] 确认派系选择弹窗出现
- [ ] 选择 Academy 派系
- [ ] 确认弹窗关闭

### 步骤 4：验证结果
- [ ] 打开控制台，查看是否有 `[Ambusher]` 日志
- [ ] 查看是否有 `CARDS_DISCARDED` 事件
- [ ] 使用调试面板查看 P2 手牌数量（应该是 1 张）
- [ ] 使用调试面板查看 P2 弃牌堆数量（应该是 2 张）
- [ ] 确认 P2 手牌中没有 Academy 派系的牌

## 关键调试命令

### 查看选择前的状态
```javascript
const stateBefore = window.__BG_TEST_HARNESS__.state.get();
const p2 = stateBefore.core.players['1'];
console.log('P2 手牌数量:', p2.hand.length);
console.log('P2 手牌:', p2.hand.map(c => ({ defId: c.defId, faction: c.faction })));
console.log('P2 Academy 派系手牌数量:', p2.hand.filter(c => c.faction === 'academy').length);
```

### 查看选择后的状态
```javascript
const stateAfter = window.__BG_TEST_HARNESS__.state.get();
const p2After = stateAfter.core.players['1'];
console.log('P2 手牌数量:', p2After.hand.length);
console.log('P2 手牌:', p2After.hand.map(c => ({ defId: c.defId, faction: c.faction })));
console.log('P2 弃牌堆数量:', p2After.discard.length);
console.log('P2 Academy 派系手牌数量:', p2After.hand.filter(c => c.faction === 'academy').length);
```

## 下一步

1. **手动测试**：按照 CARD09-DEBUG-GUIDE.md 的步骤进行手动测试
2. **记录结果**：填写调试结果记录表
3. **确认问题**：确认是否与 Card15 相同的框架层 bug
4. **修复问题**：如果确认是框架层 bug，参考 Card15 的修复方案
5. **更新 E2E 测试**：修复后更新 E2E 测试，确保测试通过

## 相关文档

- `CARD09-INJECT-STATE.json` - 注入状态 JSON
- `CARD09-DEBUG-GUIDE.md` - 完整调试指南
- `CARD15-BUG-FIX-COMPLETE.md` - Card15 的修复说明（类似问题）
- `INTERACTION-HANDLER-BUG.md` - 交互处理器框架层 bug 说明
- `ABILITYID-FIX-COMPLETE.md` - abilityId 字段修复说明
- `e2e/cardia-deck1-card09-ambusher.e2e.ts` - E2E 测试文件

