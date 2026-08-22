---
name: engine-action-log
description: 行动日志标准：事件、可见记录和反馈追踪——改 action log 或事件展示时查
metadata:
  type: doc
  status: 已交付
---

# ActionLogSystem 使用规范

## 目标

行动日志记录玩家能感知的规则结果和命令结果，帮助玩家解释发生了什么。它不是内部事件 dump，也不是隐藏调试日志。

## 基本合同

- `ActionLogSystem` 只负责收集和落库；系统层不得硬编码游戏文案。
- `formatEntry` 返回 i18n key 的 `ActionLogSegment`，禁止拼接硬编码字符串。
- 玩家可见状态变化必须覆盖：伤害、治疗、摧毁、移动、资源、计分和等价公开结果。
- 内部系统事件、临时 pending、推导 helper 和仅服务测试的事件不得直接进入玩家日志。
- 卡牌、对象或来源类日志必须用可预览片段，不能只给内部 id。

## 事件轮次

命令级日志只能在 `afterEventsRound === 0` 生成。玩家点击、确认、推进、选择这类命令记录只属于第 0 轮；后续轮次只能根据本轮真实新增事件生成事件级记录。

如果后续轮次重复出现同一条命令级日志，必须回到格式化器或管线轮次合同修根因。禁止靠日志 id 去重、UI 过滤、排序或吞 entry 掩盖重复生成。

## 伤害来源标注

伤害 breakdown 构建逻辑归 `engine/primitives/actionLogHelpers.ts`。游戏层只提供一次来源解析器，把 source id 映射成玩家可读标签；框架层负责生成带 tooltip 的伤害明细或轻量来源标注。

来源解析器不得重新计算伤害，不得读取 UI 展示值，也不得为某个游戏手写一套 breakdown。正式伤害数值和明细合同见 [`engine-damage-pipeline.md`](engine-damage-pipeline.md)。

## 音效与动画

行动日志只解释已经发生的规则结果；音效和动画分流见 [`audio-assets.md`](audio-assets.md) 与 [`engine-visual-events.md`](engine-visual-events.md)。不得为了让日志、音效或动画对齐而延迟正式 reducer 结算。

## 验收

- 改日志格式时，至少证明命令级日志不跨轮重复。
- 改伤害日志时，证明日志读取的是 reducer 后的正式 `actualDamage` / breakdown。
- 改对象日志时，证明玩家看到的是可识别对象名称或预览，不是内部路径、id 或测试标签。
