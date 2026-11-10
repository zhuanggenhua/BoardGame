# 七大恨行动承接重构局部验收（2026-09-25）

## 问题原文

> 行动条 为什么要保留，我的意思不是被交叉覆盖的不应该存在吗，还是说其他游戏有行动条？其他商业游戏有这个玩意？炉石 tmd 会有这种东西？规范怎么更新的，要重写了。

## 我的理解

不是把所有按钮都删掉，也不是因为“别的游戏有 / 没有”决定保留。先做职责矩阵：

- 当前玩家和势力身份由 `qidahen-player-float` 承接。
- 轮盘行动由 `qidahen-action-wheel` 承接。
- 有明确事件 / 军备来源时，由真实手牌本体承接。
- 地区目标由地图地区本体承接。
- 只有“没有单一手牌、轮盘、地图或结果本体可承接”的一级势力动作，才允许由 `qidahen-action-rail` 提供入口。
- 进入支付、二级目标、结果或轮盘推进态后，动作 dock 必须退场；它不能变成常驻状态条，也不能显示年份、轮次、阶段或教程解释。

## 关联验收

- 同一真实入口：`/play/qidahen?tutorialSetup=basic-opening`。
- 同一真实用例：`e2e/qidahen/first-step.e2e.ts` 的“教程直入行动窗口，点赐印招安后先弃牌支付，再场景直选目标并进入轮盘推进提示”。
- 同一玩家顺序：行动窗口 → 赐印招安 → 手牌支付 → 地图地区目标 → 轮盘推进。
- 证据截图：
  - `test-results/evidence-screenshots/_shared/qidahen-剧本基础流程/02-教程直入-行动窗口初始状态.png`
  - `test-results/evidence-screenshots/_shared/qidahen-剧本基础流程/05-赐印招安-轮盘推进可选免费走1.png`
- 结论：证据直接覆盖用户指出的“重复当前行动承载 / 行动条是否有独立职责”问题，关联成立。

## 当前解决方案

- 删除顶部重复提示：`qidahen-top-action-banner`、`qidahen-wheel-next-step-banner`，并保持 `qidahen-turn-banner` 不再生成。
- `PlayerFloat` 只承接当前势力、VP、手牌、军备和人物 / 战败状态。
- `qidahen-action-rail` 仅在 `primaryStageMode === 'faction'` 且无支付 / 目标 / 结果抢占时显示。
- 已有直接手牌入口的动作从 action rail 中移除，避免同一动作出现两份主入口。
- 地图目标点击后，action rail 退场；轮盘可操作态只保留轮盘本体和必要结果对象。

## 解决验收

- 真实 E2E：`1 passed`，25.6 秒。
- 断言覆盖：
  - 初始势力动作阶段 `qidahen-action-rail` 存在。
  - 支付面板出现后 `qidahen-action-rail` 为 0。
  - 地图目标选择后 `qidahen-action-rail` 为 0。
  - 轮盘推进态 `qidahen-action-rail` 为 0。
  - 当前玩家仍由 `qidahen-player-float` 显示。
  - 顶部旧行动横幅不存在。
- 代码测试：`src/games/qidahen/__tests__/Board.test.ts` 199/199 通过。
- 门禁：`typecheck`、`spec:lint`、`i18n:check`、`verify:ui-owners`、`git diff --check` 通过。
- 图面审查：初始态显示真实势力动作入口；支付 / 地图 / 轮盘态没有留下重复 action rail 或顶部行动横幅。局部视觉结论 `PASS`。

## 全量教程回归更新（2026-09-25）

- 真实入口：`/play/qidahen/tutorial/<tutorialId>`，运行 `e2e/qidahen/qidahen-closeout.e2e.ts`。
- 全量回归：17 个教程用例重新运行；当前桌面截图目录为 `test-results/evidence-screenshots/_shared/qidahen-教程完成/2026-09-25-tutorial-refactor-final`，60 张 PNG 落地，未生成新的失败产物。
- 年中新年与朝鲜特例单章重新取证：分别生成 `2026-09-25-year-tutorial-final-v4`、`2026-09-25-korea-tutorial-final` 截图组。
- 年中新年第一次失败不是 UI 双当前：E2E 选择器把 `qidahen-player-float` 容器也算进玩家卡；已收窄到 `ming/mongol/jin` 三个真实玩家卡。
- 年中新年第二次失败不是页面回归：E2E 仍断言旧教程文案；已同步到当前真实文案“玩家条上的‘当前’标记也换到新顺位的行动人”。
- 这两项都属于证据与实现不同步，不能拿旧失败直接判 UI 未解决；修正后同一入口、同一状态重新取证。

## 剩余缺口

- 旧的 `pass-manifest-20260924-rule-aligned-v11-final.json` 仍是历史证据，其中“顶部行动条保留”的描述已过时；不作为当前实现证据。
- 当前桌面全量教程证据已覆盖 17 个入口；移动端 3 张旧图未在本轮重拍，不把它们升级为本轮新 PASS。
- 规则全集仍不等于教程全集：事件效果全集、全部战术时机和 OpenSpec 2.4 / 4.5 仍按原记录保留缺口。
