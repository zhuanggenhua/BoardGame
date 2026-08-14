---
name: engine-action-log
description: 行动日志标准：事件、可见记录和反馈追踪——改 action log 或事件展示时查
metadata:
  type: doc
  status: 已交付
---

# ActionLogSystem 使用规范

## ActionLogSystem 使用规范（强制）

- ActionLogSystem 只负责收集/落库，禁止系统层硬编码游戏文案
- `formatEntry` 必须返回 i18n key 的 `ActionLogSegment`，禁止拼接硬编码字符串
- 覆盖所有玩家可见状态变化（伤害/治疗/摧毁/移动/资源/VP），不记录内部系统事件
- 支持多条日志返回（命令级+同步事件级）
- 卡牌类日志必须用 `card` 片段支持 hover 预览
- **命令级日志只能在 `afterEventsRound === 0` 生成**：`ActionLogSystem` 会把 afterEvents 当前轮次传给 `formatEntry`。格式化器必须把“玩家点击/确认/推进/选择”这类命令级记录限制在第 0 轮；后续轮次只能根据本轮 `events` 生成真正新增的事件级记录。禁止用最终按日志 ID 去重、吞掉重复 entry、UI 过滤或排序掩盖重复生成问题；如果后续轮次重复出现同一条命令级日志，必须回到格式化器或管线事件轮次合同修根因。

### 伤害来源标注（强制，面向百游戏）

**禁止在游戏层手写 breakdown 构建逻辑**，必须使用 `engine/primitives/actionLogHelpers.ts` 提供的通用工具。

每个游戏只需实现一次 `DamageSourceResolver`（约 15 行），框架层自动处理 breakdown 构建：

```typescript
// 游戏层：实现一次 resolver（约 15 行）
const myGameDamageSourceResolver: DamageSourceResolver = {
    resolve(sourceId: string): SourceLabel | null {
        // 1. 技能注册表查找
        const ability = abilityRegistry.get(sourceId);
        if (ability?.name) return { label: ability.name, isI18n: ability.name.includes('.'), ns: MY_NS };
        // 2. reason → i18n key 映射
        const knownReasons: Record<string, string> = { curse: 'actionLog.damageReason.curse' };
        if (knownReasons[sourceId]) return { label: knownReasons[sourceId], isI18n: true, ns: MY_NS };
        return null;
    },
};

// 游戏层：formatEntry 里调用（2 行）
// 场景 A：带 breakdown tooltip（适合有修改器的伤害，如 DiceThrone）
const breakdownSeg = buildDamageBreakdownSegment(dealt, { sourceAbilityId, breakdown, modifiers }, resolver, NS);

// 场景 B：轻量来源标注（适合单位伤害，如 SummonerWars）
const sourceSegs = buildDamageSourceAnnotation({ sourceEntityId, sourceAbilityId, reason }, resolver, NS, 'actionLog.damageFrom', buildCardSegment);
```

**两个工具函数的适用场景**：
- `buildDamageBreakdownSegment` — 有修改器明细（Token/状态/护盾加减），生成带 hover tooltip 的数值片段
- `buildDamageSourceAnnotation` — 无修改器，只需标注"来自 XX"，生成 0-2 个普通 segment

**现有游戏参考**：
- DiceThrone `game.ts` → `buildDamageBreakdownSegment`（DAMAGE_DEALT / HEAL_APPLIED）
- SummonerWars `actionLog.ts` → `buildDamageSourceAnnotation`（UNIT_DAMAGED）

### 音效与动画分流（强制）

- **无动画事件** → `feedbackResolver` 返回 `SoundKey`，框架层立即播放
- **有动画事件** → `feedbackResolver` 返回 `null`，动画层 `onImpact` 回调 `playSound(key)`
- **FX 特效** → `FeedbackPack` 在 `fxSetup.ts` 声明；运行时依赖数据用 `{ source: 'params' }`，`useFxBus` 从 `event.params.soundKey` 读取
- **原因**：引擎同步生成所有事件，动画有飞行时间，立即播音会视听不同步

---
