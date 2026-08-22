---
name: engine-visual-events
description: 视觉事件标准：EventStream、特写、数值冻结、实体保留和 impact 回调——改表现事件时查
metadata:
  type: doc
  status: 已交付
---

# 引擎动画、EventStream 与特写队列规范

本文件只覆盖引擎层表现基础设施：数值冻结、实体保留、交互延迟、EventStream 消费和可读特写队列。FX 技术和视觉质量见 [`animation-effects`](animation-effects.md)，UI 动画触发见 [`ui-animation-patterns`](ui-animation-patterns.md)。

## 表现与逻辑分离

- `executePipeline` 在一个 tick 内同步完成规则归约，`core` 立即反映最终事实。
- 表现层负责按动画节奏展示事实变化；引擎层不为了动画延迟状态计算。
- 动画、浮字、投影、timer 和展示态 helper 都不能成为正式数值、区域、骰面或对象状态的写入来源。
- 按钮点击不能先播“来源到目标”动效再赌命令成功；必须先有事件 / 状态确认，再由表现层消费。

## 基础 Hook

| Hook | 职责 | 关键规则 |
| --- | --- | --- |
| `useVisualStateBuffer` | 数值属性视觉冻结 / 双缓冲 | 正式值先写 core；UI 读缓冲值，impact 后释放回 core |
| `useVisualEntityBuffer` | 已离场实体本体的视觉保留 | 只保存实体快照和表现 owner；不是第二套规则状态 |
| `useVisualSequenceGate` | 动画期间延迟交互弹出 | 序列开始挂起交互，序列结束或取消后释放 |

### 数值冻结

- 冻结值只能从正式 core 值和本次正式变化反推出动画前显示值。
- UI 读取时以正式 core 值作为 fallback。
- impact 或等价冲击回调释放对应 key；序列取消、Undo 或完整清理时清空相关 key。
- 适用于 HP、资源、护甲、治疗、伤害、状态计数、骰子显示值等可见数值。

### 实体保留

- 对象已从权威状态移除，但玩家还需要看到它参与命中、飘字、碎裂、离场或审计时，使用实体保留。
- FX push 前用 pending owner hold 快照；FX 创建成功后转移到真实 `fxId` / owner；该 owner 完成时只释放自己的持有。
- 同一实体可被多个 owner 同时持有；最后一个 owner 释放后才退场。
- live list 中仍存在的对象不得再渲染 held visual，避免重影。
- 新链路不得在游戏私有 hook 里复制 `dyingEntities`、`heldObjects` 或固定 timer。

## 可见结算时机

- 玩家体验上的“动画命中时才产生效果”，工程实现应是“规则已结算，相关可见值被 buffer 延后显示，相关实体本体被 owner 保留”。
- 需要来源和目标的 FX 事件必须携带来源 / 目标快照；渲染器只消费快照和参数。
- 播放期间不得临时查询业务 DOM，也不得因目标移除或布局变化改打格子中心、牌桌中心或替代对象。
- 坐标缺失时显式失败、跳过或走已声明迁移 adapter；不要静默猜位置。

## EventStream

视觉、动画和音效消费必须用 `getEventStreamEntries(G)`。不要用持久化日志 `getEvents(G)` 当实时表现通道。

EventStream 消费前必须声明消费者语义：

| 策略 | 现实含义 | 消费规则 |
| --- | --- | --- |
| `requiredSequence` | 必须完整播放的动画序列 | 按 EventStream id / 游标消费；不用时间戳过滤 |
| `transientNotification` | 临时提示或短展示 | 首次挂载可跳过基线，只消费新事件 |
| `derivedCurrentState` | 当前 UI 状态重建 | 不走播放队列，从当前状态派生 |
| `instantFeedback` | 音效、轻闪、飘字等即时反馈 | 可合并 / 限流，但不能阻塞核心结算 |

禁止把一种策略复制到所有事件上。攻击、受伤、摧毁、连锁结算属于 `requiredSequence` 时，不得套用“跳过进房旧事件”的临时提示逻辑。

## 乐观与首次挂载

- 乐观引擎 reconcile 期间 entries 可能暂时为空；这不是 Undo。只有 EventStream 最大 id 真正回退时，才按消费者语义处理回退。
- `requiredSequence` 默认按 id 完整消费后续新事件。若首次可见 Board 可能晚于服务端确认事件，必须显式声明首次已有 entries 也要消费。
- `transientNotification` 可以跳过首次挂载前已有基线，避免进房时重弹旧短提示。
- `derivedCurrentState` 应重建当前状态，不重播历史动画。
- 消费者若收到游标回退信号，只能按自身语义清理已失效对象；不得机械清空所有展示。

## 特写队列

`CardSpotlightQueue` 用于玩家必须阅读、复盘或确认的卡牌 / 对象特写。普通飞牌、飘字、分数飞行、仪式性闪卡不属于这里，继续走 FX / animation 自动退场。

特写队列规则：

- 可读特写只能由玩家明确关闭，例如点击空白背景、关闭按钮或继续按钮；不能用自动 timer、鼠标移出、prompt 出现、重同步或联机确认关闭。
- 特写入队后，即使随后进入 prompt、waiting、response window、重连、组件重挂载或乐观 reconcile，也不得自动丢弃；只有用户关闭、队列上限裁剪或明确 Undo 证据能移除。
- 透明收口层可以承接点击空白关闭，但不得铺整屏暗罩、毛玻璃或解释性壳层遮住棋盘上下文。
- 迁移到通用队列时，默认保持原有位置、尺寸、层级、遮罩强度、入退场方式、关闭动作和点击区域。
- 特写不得遮挡当前玩家必须读取或点击的主对象、手牌、牌库、弃牌堆、工具按钮、prompt 目标或其它关键区域。

## 特写真相源

- 特写必须消费事件或对象自带的权威展示引用，例如 `previewRef`、`atlasId + frame/index` 或稳定对象引用。
- UI 层不得用观看者视角、当前手牌数组、默认图集、全局 `cardId -> previewRef` map 或旧顺序重新猜卡面。
- 如果拿不到权威引用，只能不入队、显示明确缺口态、报错或使用同一真相链路内已证明等价的 fallback；错图比不显示更严重。
- 跨玩家、跨角色、跨阵营、跨语言资源可能指向不同图片时，事件必须携带来源玩家和真实图片 provenance。
- 修复错图 / PVP 偶发错图时，测试必须证明观看者侧映射缺失或错误时，特写仍使用事件自带卡面；无权威引用则显式失败。

## FX 与特写的区别

| 维度 | FX / animation | CardSpotlightQueue |
| --- | --- | --- |
| 目的 | 瞬时表现、过程反馈、飘字、飞行、命中 | 阅读、复盘、确认 |
| 生命周期 | 自动完成或 timeout | 用户主动关闭 |
| 交互性 | 通常 `pointer-events: none` | 点击空白 / 关闭按钮收口 |
| 失败口径 | 看不见过程或目标变化则失败 | 没有权威展示引用或会自动退场则失败 |

具体游戏是否已迁入通用特写队列，不在本标准维护；放对应游戏代码、evidence 或专项文档。
