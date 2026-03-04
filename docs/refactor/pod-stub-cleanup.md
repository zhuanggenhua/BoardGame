# POD Stub 清理：修复 50+ POD 卡牌能力失效问题

## 问题背景

用户反馈："为什么还有很多对不上的，pod和原本不一致"

## 根本原因

`src/games/smashup/abilities/podStubs.ts` 文件包含 50+ POD 卡牌的占位符注册（stub registrations），这些占位符：

1. **是空实现**：`stubTrigger` 返回 `{ events: [] }`（不产生任何效果），`stubProtection` 返回 `false`（不提供保护）
2. **注册顺序错误**：在 `index.ts` 中，`initPodStubRegistrations()` 在 `registerPodOngoingAliases()` **之后**调用
3. **覆盖了正确实现**：自动映射先运行并创建正确的 POD 映射，然后 stub 注册覆盖了这些映射，导致 50+ POD 卡牌能力失效

## 文件头注释说明

```typescript
/**
 * POD 派系占位符注册
 * 
 * 这些是 POD (Print-on-Demand) 派系卡牌的占位符实现。
 * 它们的能力尚未完全实现，但注册了空的效果以通过审计测试。
 * 
 * TODO: 实现这些卡牌的实际能力
 */
```

**这些是占位符，不是真实实现！**

## 受影响的 POD 卡牌（50+ 张）

所有在 `podStubs.ts` 中注册的卡牌都受影响，包括但不限于：

- `killer_plant_water_lily_pod`
- `cthulhu_furthering_the_cause_pod`
- `steampunk_difference_engine_pod`
- `ninja_assassination_pod`
- `bear_cavalry_general_ivan_pod`
- `robot_warbot_pod`
- `frankenstein_uberserum_pod`
- `ghost_incorporeal_pod`
- `ninja_smoke_bomb_pod`
- `dino_upgrade_pod`
- `vampire_opportunist_pod`
- `werewolf_full_moon_pod`
- `trickster_leprechaun_pod`
- ... 等 50+ 张卡牌

## 解决方案

### 1. 删除 `podStubs.ts` 文件

所有 stub 注册都是占位符，应该由自动映射系统处理。

### 2. 从 `index.ts` 移除 stub 调用

```typescript
// ❌ 删除前
import { initPodStubRegistrations } from './podStubs';
// ...
initPodStubRegistrations();

// ✅ 删除后
// 不再 import 和调用 initPodStubRegistrations
```

### 3. 保留唯一的显式 POD 覆盖

`zombie_overrun_pod` 在 `zombies.ts` 中有显式注册（与基础版行为不同），这是唯一的合法覆盖：

```typescript
// zombies.ts
registerRestriction('zombie_overrun_pod', 'play_minion', zombieOverrunRestriction);
registerTrigger('zombie_overrun_pod', 'onTurnStart', zombieOverrunSelfDestruct);
```

## 修复结果

- **自动映射系统正常工作**：72 个 POD 版本的 trigger/restriction/protection 被自动映射
- **所有 POD 卡牌能力恢复**：50+ 张 POD 卡牌现在使用基础版的正确实现
- **测试全部通过**：`alien-scout-pod-afterscore.test.ts` 3 个测试全部通过

## 教训

1. **占位符必须明确标注**：文件头注释说明了这些是占位符，但代码仍然被执行
2. **注册顺序很重要**：即使有选择性覆盖机制，错误的注册顺序仍会导致问题
3. **自动化系统优于手动注册**：50+ 张卡牌的手动注册容易出错，自动映射系统更可靠
4. **删除优于注释**：占位符代码应该删除，而不是保留并注释掉

## 相关文档

- `docs/refactor/pod-auto-mapping.md` - POD 自动映射系统设计
- `docs/refactor/pod-selective-override-example.md` - 选择性覆盖示例
