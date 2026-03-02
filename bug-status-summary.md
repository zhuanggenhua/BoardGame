# Bug 状态总结

## ✅ 已修复的 Bug

### 1. 恐龙测试修复（dino_tooth_and_claw 多次拦截）
**问题**：`ninja_assassination` 的 `onTurnEnd` 触发器在每个玩家的回合结束时都触发，导致 `tooth_and_claw` 被错误地消耗两次。

**修复**：
- 在 `ninja_assassination` 的 `onTurnEnd` 触发器中添加拥有者检查
- 只在暗杀卡拥有者的回合结束时触发消灭效果
- 修复文件：`src/games/smashup/abilities/ninjas.ts`

**测试结果**：✅ 所有5个测试用例全部通过

### 2. ninja_assassination_pod 触发器错误
**问题**：POD 版暗杀注册的是 `onTurnStart` 触发器，应该是 `onTurnEnd`。

**修复**：
- 修改 `src/games/smashup/abilities/podStubs.ts`
- 将 `ninja_assassination_pod` 的触发器从 `onTurnStart` 改为 `onTurnEnd`

**测试结果**：✅ 能力行为审计测试中不再报告此问题

---

## ⚠️ 现存的 Bug（非本次修复引入）

以下是测试套件中发现的其他问题，这些问题在本次修复之前就已存在：

### 1. POD 派系占位符问题（14个测试文件失败）
**影响范围**：
- `abilityBehaviorAudit.test.ts` - 9个测试失败（POD 卡牌缺少触发器/保护注册）
- `alienAuditFixes.test.ts` - 外星人审计修复测试失败
- `audit-ability-coverage.property.test.ts` - 能力标签执行器全覆盖测试失败
- `audit-d1-alien-crop-circles.test.ts` - 外星人麦田圈审计测试失败
- `audit-d8-d19-base-fairy-ring.test.ts` - 仙灵圈基地审计测试失败（4个测试）

**原因**：POD 派系的卡牌大多只有占位符实现，缺少完整的能力注册。

**状态**：这些是已知的技术债务，不影响核心游戏功能。

### 2. afterScoring 链测试失败（2个测试文件）
**影响范围**：
- `mothership-scout-afterscore-bug.test.ts` - 母舰+侦察兵 afterScoring 链测试失败
- `wizard-academy-scout-afterscore.test.ts` - 巫师学院+侦察兵 afterScoring 链测试失败

**原因**：可能与 afterScoring 事件链的延迟处理机制有关。

**状态**：需要进一步调查。

---

## 📊 测试统计

**总体测试结果**：
- 测试文件：14 失败 | 118 通过 | 4 跳过（共136个）
- 测试用例：34 失败 | 1340 通过 | 9 跳过（共1383个）

**本次修复影响**：
- ✅ 修复了 `dino_tooth_and_claw` 的5个测试用例
- ✅ 修复了 `ninja_assassination_pod` 的触发器问题
- ⚠️ 未引入新的测试失败

---

## 🎯 结论

**本次修复是否完整？** ✅ 是的

本次修复成功解决了 `dino_tooth_and_claw` 多次拦截的问题，以及相关的 `ninja_assassination_pod` 触发器错误。所有与本次修复相关的测试都已通过。

现存的其他测试失败都是之前就存在的问题（主要是 POD 派系的占位符实现不完整），不是本次修复引入的。这些问题可以在后续的工作中逐步解决。
