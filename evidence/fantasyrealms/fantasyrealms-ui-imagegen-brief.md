# 幻想国度 16:9 UI 参考图 brief

> 产出日期：`2026-06-04`
>
> 规则来源：`src/games/fantasyrealms/rule/幻想国度规则.md`
>
> 视觉来源：`public/assets/i18n/zh-CN/fantasyrealms/cards/atlases/fantasyrealms-base-cards-atlas.png`、`public/assets/i18n/zh-CN/fantasyrealms/cards/backs/fantasyrealms-base-card-back.png`

## 规则理解

幻想国度没有棋盘或空间地图。玩家每回合的核心不是移动实体，而是在始终维持 `7` 张手牌的前提下，通过“抽一张、弃一张”优化最终组合得分。弃牌区是公开信息，并且弃牌数达到 `10` 张会触发终局。

## 玩家关注点排序

1. **第一关注点**：当前 `7` 张手牌、当前焦点牌、可弃置候选。
2. **第二关注点**：抽牌来源二选一、弃牌区明牌、弃牌 `10` 张终局进度、当前组合得分。
3. **第三关注点**：当前玩家、当前阶段、牌库余量、座位顺序。
4. **按需关注点**：完整计分明细、日志、规则摘要、帮助。

## UI 元素拆解

- **素材已有 UI**：本轮没有主棋盘或印刷桌面 UI；只有卡牌 atlas 与牌背。
- **规则必须常驻**：手牌、焦点牌详情、抽牌来源、弃牌区、弃牌进度、当前得分。
- **按需展开**：完整弃牌堆查看、完整计分 breakdown、规则帮助、操作日志。
- **禁止出现**：地图、区域、资源矿、行动点、任务栏、科技树、流程说明大面板、整列日志。

## 构图裁定

- 中央最大区域给 `7` 张手牌和焦点牌，表达“组合构筑”是首要决策。
- 左侧使用紧凑抽牌来源区，牌库与弃牌明牌并列，服务当前回合第一步。
- 右侧使用公开弃牌区 + 终局进度，强调弃牌区既是可回收信息，也是倒计时。
- 顶部只放轻量状态 chip，不做大标题栏。

## 生成/绘制 prompt

```text
Use case: ui-mockup
Asset type: 16:9 board game UI layout reference
Primary request: 幻想国度游戏 UI 布局参考图，基于 7 张手牌组合得分、抽牌来源二选一、弃牌区公开信息和弃牌 10 张终局进度。
Canvas: 1920x1080 landscape, single game table screen, no map.
Composition: center-dominant hand and scoring workspace; left compact draw-source chooser; right public discard and endgame progress; top status chips only.
Main focus: seven readable hand cards and one enlarged focus card with combo scoring.
Secondary focus: deck vs discard draw choice, public discard cards, discard progress 7/10.
Style: refined fantasy parchment table, warm ink, restrained jewel accents, high readability.
Text: only short labels such as "手牌", "抽牌", "弃牌区", "当前组合", "结束回合".
Avoid: map, territory board, resource bar, action points, quest log, tutorial copy, large rule explanation, full-height log panel, sci-fi HUD.
```

## 主要元素审计

| 元素 | 归属 | 结论 |
|---|---|---|
| 7 张手牌 | 当前决策 | 保留并放在画面主区域 |
| 焦点牌大预览 | 当前决策 | 保留，靠近得分解释 |
| 当前组合得分 | 当前决策 | 保留，和焦点牌绑定 |
| 牌库 / 弃牌抽取 | 规则动作 | 保留，左侧紧凑呈现 |
| 弃牌区公开明牌 | 规则动作 + 当前决策 | 保留，右侧呈现 |
| 弃牌 7/10 进度 | 实现必要状态 + 终局规则 | 保留，但不抢主视觉 |
| 玩家/阶段/牌库余量 | 实现必要状态 | 降级为顶部 chip |
| 日志/帮助/完整计分 | 按需关注点 | 不常驻，仅保留小入口 |

