# 大杀四方 ActionLog 缺失事件修复

## 问题描述

大杀四方的 ActionLog（操作日志）系统存在大量事件类型未被记录的问题，导致很多重要的游戏操作在日志中不可见。

### 典型场景

**学徒（wizard_neophyte）触发链路**：
1. ✅ 打出学徒 → `MINION_PLAYED` 已记录
2. ❌ 展示牌库顶 → `REVEAL_DECK_TOP` 未记录
3. ✅ 玩家选择"作为额外行动打出" → `INTERACTION_COMMANDS.RESPOND` 已记录
4. ✅ 从牌库抽到手牌 → `CARDS_DRAWN` 已记录
5. ✅ 打出行动卡 → `ACTION_PLAYED` 已记录
6. ❌ 补偿行动额度 → `LIMIT_MODIFIED` 未记录（无 reason 时）
7. ❌ 执行行动卡的 onPlay 能力 → 产生的事件可能未记录

## 根本原因

`src/games/smashup/actionLog.ts` 的 `formatSmashUpActionEntry` 函数中，`switch (event.type)` 只处理了部分事件类型，导致以下事件类型缺失：

### 缺失的事件类型（共 13 个）

1. **REVEAL_HAND** - 展示手牌（占卜/聚集秘术等）
2. **REVEAL_DECK_TOP** - 展示牌库顶（学徒/盘旋机器人/墓地行者等）
3. **PERMANENT_POWER_ADDED** - 永久力量修正（科学怪人 Igor 等）
4. **TEMP_POWER_ADDED** - 临时力量修正
5. **ONGOING_CARD_COUNTER_CHANGED** - ongoing 卡牌计数器变化
6. **BREAKPOINT_MODIFIED** - 基地爆分线修改（狼人等）
7. **BASE_DECK_SHUFFLED** - 基地牌库洗牌
8. **SPECIAL_LIMIT_USED** - 特殊额度使用
9. **ABILITY_FEEDBACK** - 能力反馈消息（牌库空/搜索无结果等）
10. **ABILITY_TRIGGERED** - 持续效果触发
11. **BASE_CLEARED** - 基地清除（计分后弃置随从/ongoing）
12. **DECK_REORDERED** - 玩家牌库重排（占卜/传送门等）
13. **FACTION_SELECTED** - 派系选择

## 解决方案

### 1. 补充事件处理逻辑

在 `src/games/smashup/actionLog.ts` 的 `formatSmashUpActionEntry` 函数中，为所有缺失的事件类型添加 case 分支（共 13 个）：

```typescript
case SU_EVENTS.REVEAL_HAND: {
    const payload = event.payload as { targetPlayerId: string; viewerPlayerId: string | 'all'; cards: { uid: string; defId: string }[]; reason?: string };
    const segments: ActionLogSegment[] = [i18nSeg('actionLog.revealHand', {
        playerId: payload.targetPlayerId,
        count: payload.cards.length,
    })];
    if (payload.reason) {
        segments.push(...buildReasonSegments(payload.reason, buildCardSegment));
    }
    pushEntry(event.type, segments, payload.targetPlayerId, entryTimestamp, index);
    break;
}
// ... 其他 10 个事件类型
```

### 2. 添加 i18n 翻译

在 `public/locales/zh-CN/game-smashup.json` 和 `public/locales/en/game-smashup.json` 中添加对应的翻译 key：

```json
{
  "actionLog": {
    "revealHand": "{{playerId}} 展示手牌（{{count}}张）",
    "revealDeckTop": "{{playerId}} 展示牌库顶（{{count}}张）",
    "permanentPowerAdded": "永久力量+{{amount}}：",
    "tempPowerAdded": "临时力量+{{amount}}：",
    "ongoingCounterChanged": "持续行动计数器{{delta}}：",
    "breakpointModified": "{{base}} 爆分线{{delta}}",
    "baseDeckShuffled": "基地牌库洗牌",
    "specialLimitUsed": "{{playerId}} 使用特殊{{limitType}}额度",
    "abilityTriggered": "触发能力（{{triggerType}}）：",
    "baseCleared": "清空{{base}}",
    "deckReordered": "{{playerId}} 重排牌库",
    "factionSelected": "{{playerId}} 选择派系：{{faction}}"
  }
}
```

### 3. 添加测试

在 `src/games/smashup/__tests__/actionLogFormat.test.ts` 中添加测试用例验证新增事件类型：

```typescript
it('REVEAL_HAND 生成正确的 i18n segment', () => {
    // 测试展示手牌事件
});

it('REVEAL_DECK_TOP 生成正确的 i18n segment', () => {
    // 测试展示牌库顶事件
});

it('PERMANENT_POWER_ADDED 生成正确的 i18n segment', () => {
    // 测试永久力量修正事件
});
```

## 验证

### 1. 运行单元测试

```bash
npm run test -- src/games/smashup/__tests__/actionLogFormat.test.ts
```

所有测试通过 ✅

### 2. 运行覆盖率检查

```bash
node scripts/check-actionlog-coverage.mjs
```

输出：
```
📊 大杀四方 ActionLog 事件覆盖率检查

✅ 已定义事件：50 个
✅ 已处理事件：40 个
❌ 未处理事件：10 个

⚠️  未处理的事件类型：
  🔇 ALL_FACTIONS_SELECTED (silent/内部状态)
  🔇 SPECIAL_AFTER_SCORING_ARMED (silent/内部状态)
  🔇 SPECIAL_AFTER_SCORING_CONSUMED (silent/内部状态)
  🔇 SCORING_ELIGIBLE_BASES_LOCKED (silent/内部状态)
  🔇 BEFORE_SCORING_TRIGGERED (silent/内部状态)
  🔇 BEFORE_SCORING_CLEARED (silent/内部状态)
  🔇 AFTER_SCORING_TRIGGERED (silent/内部状态)
  🔇 AFTER_SCORING_CLEARED (silent/内部状态)
  🔇 MINION_PLAY_EFFECT_QUEUED (silent/内部状态)
  🔇 MINION_PLAY_EFFECT_CONSUMED (silent/内部状态)

✅ 所有非 silent 事件都已处理
```

所有需要记录的事件都已覆盖 ✅

## 影响范围

### 受益的卡牌/能力

1. **巫师派系**：
   - 学徒（wizard_neophyte）- 展示牌库顶
   - 占卜（wizard_scry）- 展示手牌
   - 聚集秘术（wizard_mass_enchantment）- 展示对手牌库顶
   - 传送门（wizard_portal）- 展示牌库顶 5 张

2. **机器人派系**：
   - 盘旋机器人（robot_hoverbot）- 展示牌库顶

3. **丧尸派系**：
   - 墓地行者（zombie_walker）- 展示牌库顶

4. **科学怪人派系**：
   - Igor - 永久力量修正（+1 力量指示物）

5. **狼人派系**：
   - 基地爆分线修改能力

6. **所有派系**：
   - 能力反馈消息（牌库空、搜索无结果等）
   - 持续效果触发日志
   - 派系选择记录
   - 牌库重排记录

## 后续优化建议

### 1. 自动化检测缺失事件

创建一个测试工具，自动对比 `SU_EVENTS` 中定义的所有事件类型和 `formatSmashUpActionEntry` 中处理的事件类型，确保没有遗漏：

```typescript
// 伪代码
const allEventTypes = Object.values(SU_EVENT_TYPES);
const handledEventTypes = extractHandledEventsFromSwitch(formatSmashUpActionEntry);
const missingEvents = allEventTypes.filter(e => !handledEventTypes.includes(e));
expect(missingEvents).toEqual([]);
```

### 2. 事件分类标注

在 `events.ts` 中为每个事件添加元数据，标注是否需要记录到 ActionLog：

```typescript
export const SU_EVENTS = defineEvents({
  'su:minion_played': { 
    audio: 'immediate', 
    sound: MINION_PLAY_KEY,
    actionLog: true,  // 需要记录
  },
  'su:minion_play_effect_queued': { 
    audio: 'silent',
    actionLog: false,  // 内部状态，不记录
  },
});
```

### 3. 统一事件处理模式

考虑使用注册表模式替代巨型 switch-case：

```typescript
const eventFormatters = new Map<string, EventFormatter>();
eventFormatters.set(SU_EVENTS.REVEAL_HAND, formatRevealHand);
eventFormatters.set(SU_EVENTS.REVEAL_DECK_TOP, formatRevealDeckTop);
// ...

const formatter = eventFormatters.get(event.type);
if (formatter) {
  const entry = formatter(event, state, buildCardSegment);
  if (entry) entries.push(entry);
}
```

## 相关文档

- `docs/ai-rules/engine-systems.md` - 引擎系统规范（ActionLogSystem）
- `docs/automated-testing.md` - 测试规范
- `src/engine/systems/ActionLogSystem.ts` - ActionLog 系统实现
- `src/games/smashup/domain/events.ts` - 事件定义

## 修改文件清单

1. `src/games/smashup/actionLog.ts` - 补充 13 个事件类型处理
2. `public/locales/zh-CN/game-smashup.json` - 添加中文翻译
3. `public/locales/en/game-smashup.json` - 添加英文翻译
4. `src/games/smashup/__tests__/actionLogFormat.test.ts` - 添加测试用例
5. `scripts/check-actionlog-coverage.mjs` - 创建覆盖率检查脚本
6. `docs/bugs/smashup-actionlog-missing-events.md` - 本文档

## 总结

本次修复补充了大杀四方 ActionLog 系统中缺失的 13 个事件类型，覆盖了展示牌库顶/手牌、力量修正、基地爆分线修改、能力反馈、派系选择、牌库重排等重要游戏操作。修复后，学徒等卡牌的完整触发链路都能在操作日志中正确显示，大幅提升了游戏的可追溯性和调试体验。

### 覆盖率统计

- **总事件数**：50 个
- **已处理事件**：40 个（80%）
- **Silent 事件**：10 个（内部状态，不需要记录）
- **覆盖率**：100%（所有需要记录的事件都已处理）

### 工具支持

新增 `scripts/check-actionlog-coverage.mjs` 脚本，可自动检测未处理的事件类型，防止未来新增事件时遗漏 ActionLog 处理。


## 修复过程

### 1. 问题定位

测试运行后发现 `INTERACTION_COMMANDS.RESPOND` 命令产生的事件没有被记录到 ActionLog。通过添加日志发现：

```
[ActionLogSystem] afterEvents called: {
  commandType: 'SYS_INTERACTION_RESPOND',
  eventsCount: 2,
  shouldRecord: false,  ← ❌ 问题根源
  hasFormatEntry: true
}
```

`shouldRecord` 为 `false`，说明命令被 allowlist 检查拒绝了。

### 2. 根本原因

`src/engine/systems/commandAllowlist.ts` 中的 `isCommandAllowlisted` 函数有一个设计缺陷：

```typescript
// ❌ 错误的检查顺序
if (BLOCKED_PREFIXES.some(prefix => commandType.startsWith(prefix))) {
    return false;  // 先检查 BLOCKED_PREFIXES，直接拒绝所有 SYS_ 开头的命令
}

if (!allowlist) {
    return options.fallbackToAllowAll ?? false;
}

return allowlist.has(commandType);  // 后检查 allowlist
```

`BLOCKED_PREFIXES` 包含 `'SYS_'`，而 `INTERACTION_COMMANDS.RESPOND` 的值是 `'SYS_INTERACTION_RESPOND'`，所以即使它在 allowlist 中，也会被 BLOCKED_PREFIXES 检查直接拒绝。

### 3. 修复方案

调整检查顺序，让 allowlist 的优先级高于 BLOCKED_PREFIXES：

```typescript
// ✅ 正确的检查顺序
export function isCommandAllowlisted(
    commandType: string,
    allowlist: NormalizedCommandAllowlist,
    options: { fallbackToAllowAll?: boolean } = {}
): boolean {
    // ✅ 先检查 allowlist（显式允许优先级最高）
    if (allowlist && allowlist.has(commandType)) {
        return true;
    }

    // ❌ 再检查 BLOCKED_PREFIXES（隐式拒绝）
    if (BLOCKED_PREFIXES.some(prefix => commandType.startsWith(prefix))) {
        return false;
    }

    // 🤷 fallback 到默认行为
    if (!allowlist) {
        return options.fallbackToAllowAll ?? false;
    }

    return false;
}
```

这样，即使命令以 `SYS_` 开头，只要它在 allowlist 中，就会被允许。

### 4. 测试结果

修复后，所有测试通过：

```
✓ 选择"放入手牌"应记录：打出学徒 + 展示牌库顶 + 抽牌
  Step 2 logs: ['su:minion_played', 'su:reveal_deck_top', 'su:limit_modified', 'su:cards_drawn']

✓ 选择"作为额外行动打出"应记录：打出学徒 + 展示牌库顶 + 抽牌 + 打出行动 + 额度补偿
  Step 2 logs: ['su:minion_played', 'su:reveal_deck_top', 'su:limit_modified', 'su:cards_drawn', 'su:action_played', 'su:limit_modified']

✓ 打出行动卡后应触发其 onPlay 能力并记录
  Final logs: ['su:minion_played', 'su:reveal_deck_top', 'su:limit_modified', 'su:cards_drawn', 'su:action_played', 'su:cards_drawn']
```

交互解决产生的所有事件（CARDS_DRAWN、ACTION_PLAYED、LIMIT_MODIFIED）都被正确记录到 ActionLog。

## 影响范围

此修复影响所有使用 `ActionLogSystem` 和 `UndoSystem` 的游戏，因为它们共享 `commandAllowlist.ts` 的逻辑。修复后：

- ✅ 显式添加到 allowlist 的系统命令（如 `SYS_INTERACTION_RESPOND`）可以正常工作
- ✅ 未添加到 allowlist 的系统命令（如 `SYS_UNDO`、`SYS_CHEAT_*`）仍然被阻止
- ✅ 向后兼容：现有游戏的 allowlist 不需要修改

## 相关文件

- `src/engine/systems/commandAllowlist.ts` - 修复 allowlist 检查顺序
- `src/games/smashup/actionLog.ts` - 添加 `INTERACTION_COMMANDS.RESPOND` 到 allowlist
- `src/games/smashup/__tests__/testRunner.ts` - 测试环境添加 ActionLogSystem
- `src/games/smashup/__tests__/wizard-neophyte-actionlog.test.ts` - 集成测试验证完整链路
