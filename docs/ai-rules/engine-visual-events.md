# 引擎动画、EventStream 与特写队列规范

## 动画表现与逻辑分离规范（强制）

> 引擎架构核心原则：**逻辑层同步完成状态计算，表现层按动画节奏异步展示**。两层通过框架 Hook 解耦，游戏层无需关心时序管理。
> 视觉特效的技术选型、粒子引擎、FX 系统等详见 `docs/ai-rules/animation-effects.md`。本节只覆盖引擎层的表现-逻辑分离基础设施。

### 架构约束

引擎管线（`executePipeline`）在一个 tick 内同步完成所有 reduce，core 状态立即反映最终值。但表现层需要按动画节奏逐步展示（骰子 → 攻击动画 → impact 瞬间数值变化 → 摧毁特效）。**引擎层不为表现延迟状态计算**，表现层自行管理视觉时序。

### 框架基础设施

引擎提供两个互补的框架 Hook，所有游戏统一使用：

| Hook | 职责 | 核心 API |
|------|------|---------|
| `useVisualStateBuffer` | 数值属性的视觉冻结/双缓冲 | `freeze`/`freezeBatch`/`release`/`clear`/`get`/`snapshot`/`isBuffering` |
| `useVisualSequenceGate` | 交互事件的延迟调度（动画期间不弹交互框） | `beginSequence`/`endSequence`/`scheduleInteraction`/`isVisualBusy`/`reset` |

#### useVisualStateBuffer（视觉状态缓冲）

在动画期间冻结受影响属性的视觉值，UI 读快照而非 core 真实值：

1. **冻结**（`freeze`）：事件到来时，对受影响的 key 快照当前值（回退到变化前）
2. **读取**（`get`）：UI 组件优先读快照值，无快照时回退到 core 真实值
3. **释放**（`release`）：动画 impact 瞬间删除指定 key，UI 回退到 core 真实值
4. **清空**（`clear`）：动画序列结束时清空所有快照

#### 释放时机：FxLayer onEffectImpact

FxLayer 提供 `onEffectImpact?: (id: string, cue: string) => void` 回调，在飞行动画到达目标（冲击帧）时触发。游戏层通过维护 `fxId → bufferKey` 映射，在 impact 回调中释放对应 key：

```typescript
// push 时记录映射
const fxId = fxBus.push(DT_FX.DAMAGE, {}, { damage, startPos, endPos });
if (fxId) fxImpactMap.set(fxId, `hp-${targetId}`);

// FxLayer onEffectImpact 时释放
<FxLayer
  bus={fxBus}
  onEffectImpact={(id) => {
    const key = fxImpactMap.get(id);
    if (key) { damageBuffer.release([key]); fxImpactMap.delete(id); }
  }}
/>
```

#### 两个 Hook 的协作

- `gate.beginSequence()` + `buffer.freeze()` — 动画开始（冻结数值 + 挂起交互）
- `buffer.release()` — impact 瞬间（数值变化可见）
- `buffer.clear()` + `gate.endSequence()` — 动画结束（交互队列排空）

### 已接入的游戏

| 游戏 | 冻结属性 | 冻结时机 | 释放时机 |
|------|---------|---------|---------|
| SummonerWars | 棋盘单位 damage（key=`"row-col"`） | `UNIT_ATTACKED` + `UNIT_DAMAGED` 事件 | 近战 `onAttackHit` / 远程 `onEffectImpact(COMBAT_SHOCKWAVE)` |
| DiceThrone | 玩家 HP（key=`"hp-{playerId}"`） | `DAMAGE_DEALT` / `HEAL_APPLIED` 事件 | `onEffectImpact(DAMAGE/HEAL)` |

### 适用场景

- 棋盘单位 damage / HP / 护甲等数值属性
- 玩家 HP、资源值（金币/魔法值等）
- 任何 UI 展示的数值属性，且该数值有对应的飞行动画/特效

### 新游戏接入（强制）

新游戏有数值变化动画时，必须使用 `useVisualStateBuffer` 管理视觉时序，禁止直接读 core 值渲染。典型接入流程：
1. 在事件消费 Hook 中创建 `useVisualStateBuffer`，事件到来时 `freeze` 对应 key
2. 在 `fxBus.push` 时记录 `fxId → bufferKey` 映射
3. 在 `FxLayer.onEffectImpact` 回调中 `release` 对应 key
4. UI 组件通过 `buffer.get(key, coreValue)` 读取视觉值

### 禁止事项

- ❌ 禁止在 UI 组件中用 `useState<Map>` 自行实现快照逻辑，必须使用 `useVisualStateBuffer`
- ❌ 禁止在 reducer/execute 层延迟事件处理来解决动画时序问题（引擎层必须同步完成）
- ❌ 禁止用 `setTimeout` 延迟读取 core 值来"等动画播完"
- ❌ 新游戏禁止直接读 core 数值属性渲染 HP/血条，必须经过 `useVisualStateBuffer.get()` 中转

---

## EventStreamSystem 使用规范（强制）

特效/动画/音效消费必须用 `getEventStreamEntries(G)`（EventStreamSystem），禁止用 `getEvents(G)`（LogSystem）。原因：LogSystem 持久化全量日志刷新后完整恢复，EventStream 实时消费通道带自增 `id`，撤销时清空。

### 乐观引擎兼容（强制理解）

乐观引擎的 `processCommand` / `reconcile` 过程中，`setState` 会被多次调用。`wait-confirm` 模式会剥离 EventStream（entries 暂时为空），这不是 Undo 回退。`useEventStreamCursor` 已内置处理：entries 为空时保持游标不变，只有当 entries 的最大 ID 真正回退（小于游标值）时才判定为 Undo 回退。消费者无需额外处理。

### 首次挂载跳过历史事件（强制）

> 所有消费 EventStream 的 Hook/Effect 必须遵循，无例外。

**模式 A：过滤式消费（推荐，处理多条新事件）**

使用引擎层通用 hook `useEventStreamCursor`（`src/engine/hooks/useEventStreamCursor.ts`），
自动处理首次挂载跳过历史 + Undo 恢复重置游标。
所有判断在 `consumeNew()` 内同步完成，不依赖 useEffect 时序，
消费者用 `useEffect` 或 `useLayoutEffect` 均可。

简单场景（不需要 reset 清理）：
```typescript
import { useEventStreamCursor } from '../../../engine/hooks';

const { consumeNew } = useEventStreamCursor({ entries: eventStreamEntries });

useEffect(() => {
  const { entries: newEntries } = consumeNew();
  if (newEntries.length === 0) return;
  // ... 处理 newEntries（游标已自动推进）
}, [eventStreamEntries, consumeNew]);
```

需要 Undo 回退清理（攻击队列/技能模式等）：
```typescript
const { consumeNew } = useEventStreamCursor({ entries });

useLayoutEffect(() => {
  const { entries: newEntries, didReset } = consumeNew();
  if (didReset) {
    // 清理 UI 状态：待播放队列、技能模式、视觉缓冲等
    clearPendingAttack(); setAbilityMode(null); damageBuffer.clear();
  }
  if (newEntries.length === 0) return;
  // ... 处理 newEntries
}, [entries, consumeNew]);
```

> `consumeNew()` 返回 `{ entries, didReset }`。`didReset=true` 表示检测到 Undo 回退
> （entries 清空或 ID 回退），消费者据此清理 UI 状态。
> 内部封装了：首次挂载跳过历史、Undo 检测与游标重置、`e.id > lastSeenId` 过滤 + 自动推进。
> 消费者无需手动管理 `lastSeenIdRef` / `isFirstMountRef` / `prevEntriesLenRef`。

**模式 B：单条最新事件消费**
```typescript
// 关键：初始值用当前最新 id，非 null/-1
const lastProcessedIdRef = useRef<number | null>(latestEntry?.id ?? null);
useEffect(() => {
  if (!latestEntry || lastProcessedIdRef.current === latestEntry.id) return;
  lastProcessedIdRef.current = latestEntry.id;
  // ... 处理 latestEntry
}, [latestEntry]);
```

**禁止**：初始值为 `null/-1` 且无首次挂载跳过逻辑；仅靠 `mountedRef` 守卫（后续 state 变化仍会重播）。

**检查清单**：① 是否使用 `useEventStreamCursor` 通用 hook？② `consumeNew` 返回的 `didReset` 是否被正确处理（需要清理 UI 状态的场景）？③ 模式 B 的 `useRef` 初始值是否为 `currentEntry?.id ?? null`？④ `consumeNew` 是否在依赖数组中？

**参考**：模式 A → `dicethrone/hooks/useCardSpotlight.ts`（简单）、`summonerwars/ui/useGameEvents.ts`（含 didReset 清理）；模式 B → `lib/audio/useGameAudio.ts`

---

## 卡牌特写队列（CardSpotlightQueue）使用规范

> 路径：`src/components/game/framework/CardSpotlightQueue.tsx` + `hooks/useCardSpotlightQueue.ts`

通用框架组件，用于展示卡牌特写。基于 EventStream 驱动，支持队列堆叠（有上限），点击任意位置关闭当前特写。

### 核心特性

- **默认只显示其他玩家**：提供 `currentPlayerId` 时自动过滤该玩家产生的事件；不提供时显示全部
- **联机确认可配置**：`consumeOnReconcile` 为 `true` 时，reconcile 后仍消费服务端确认事件，适合“对手出牌特写”这类纯远端驱动展示
- **队列有上限**：`maxQueue`（默认 5），超出时丢弃最旧的
- **点击关闭**：点击空白/卡牌即可关闭当前项，不阻塞其他操作
- **Undo 安全**：检测到 Undo 回退时自动清空队列
- **游戏层注入渲染**：框架层管理队列逻辑，游戏层通过 `renderCard` 提供卡牌 UI

### 特写真相源与失败口径（强制）

- **特写必须消费事件/对象自带的权威展示引用**：其他玩家打出卡牌、展示牌、弃牌、揭示牌时，事件或队列 item 必须携带足以直接渲染真实对象的 `previewRef` / `atlasId + frame/index` / 稳定对象引用。UI 层只能消费这份引用，不得再用当前观看者视角、当前手牌数组、当前英雄默认图集、全局 `cardId -> previewRef` map 或旧共享顺序二次推导卡面。
- **错图 fallback 禁止优先于显式失败**：如果特写消费层拿不到权威展示引用，允许做的动作只有：不入队、显示明确缺口态、弹 toast/modal、写带对象 ID 的错误日志，或使用同一真相链路内已证明等价的 fallback。禁止为了避免空白而展示“可能是这张”的卡图；错图比不显示更严重。
- **跨玩家 / 跨英雄 / 跨阵营展示必须保留 provenance**：只要同一个 `cardId`、`defId`、索引或展示名在不同玩家、英雄、阵营、语言资源中可能指向不同图片，事件必须携带来源玩家与真实图片 provenance。后续响应窗口、乐观回滚、PVP 观战、AI 出牌特写都不得退回到本地视角重新猜。
- **回归测试必须覆盖 stale viewer state**：修复“对手出牌错图 / 特写错图 / PVP 偶发错图”时，至少补一条测试证明观看者侧英雄映射缺失或错误时，特写仍使用事件自带真实卡面；若没有权威引用，则应断言显式失败，而不是断言展示某个默认素材。

### 接入方式（游戏层）

```typescript
import { useCardSpotlightQueue, CardSpotlightQueue } from '../../components/game/framework';
import { getEventStreamEntries } from '../../engine/systems/EventStreamSystem';

// 1. 定义数据提取函数
const extractCard = useCallback((event) => {
    const p = event.payload as { playerId: string; defId: string };
    return p ? { playerId: p.playerId, cardData: { defId: p.defId } } : null;
}, []);

// 2. 使用 Hook
const { queue, dismiss } = useCardSpotlightQueue({
    entries: getEventStreamEntries(G),
    currentPlayerId: myPid, // 传 null/undefined 可关闭“过滤自己”
    consumeOnReconcile: true, // 联机对手页需要消费服务端确认事件时开启
    triggerEventTypes: ['su:action_played'],  // 触发特写的事件类型
    extractCard,
    maxQueue: 5,
});

// 3. 定义渲染函数
const renderCard = useCallback((item) => (
    <div className="..."><CardPreview ... /></div>
), []);

// 4. 渲染组件
<CardSpotlightQueue queue={queue} onDismiss={dismiss} renderCard={renderCard} />
```

### 与 FX 系统的区别

| 维度 | FX 系统 | CardSpotlightQueue |
|------|---------|-------------------|
| 交互性 | `pointer-events-none`，纯展示 | 可点击关闭 |
| 生命周期 | 定时自动消失（`timeoutMs`） | 用户主动关闭 |
| 适用场景 | 力量浮字、VP 飞行等瞬态特效 | 卡牌特写、需要玩家确认的展示 |

### 已接入游戏

- **SmashUp**：行动卡打出时展示特写（在线默认只看对手，本地模式显示双方）
- **DiceThrone**：待迁移（当前使用游戏层自建的 `CardSpotlightOverlay` + `useCardSpotlight`）

---

