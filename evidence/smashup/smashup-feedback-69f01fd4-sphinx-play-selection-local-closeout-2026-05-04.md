# Smash Up 反馈 69f01fd4 本地验收收口说明（2026-05-04）

## 反馈原文

- `没法选择打出斯芬克斯`

线上反馈对应：

- feedbackId：`69f01fd49b68d90ee983669d`
- gameId：`smashup`
- route：`/play/smashup/match/aLb__VB8sQU?playerID=0`
- appVersion：`production`

## 线上现场能确认到什么

- 当前终态不是卡死态：
  - `sys.phase = startTurn`
  - `sys.flowHalted = false`
  - `sys.interaction.isBlocked = false`
- 当前正停在 `titan_sphinx_start_turn` 交互：
  - `current.id = titan_sphinx_start_turn_0`
  - `current.data.sourceId = titan_sphinx_start_turn`
- 这份交互的候选不是“点一张 Sphinx 卡面”，而是：
  - 选择一张自己的埋葬牌 `buried-c17 = 远古诅咒 @ 金字塔`
  - 或 `skip`
- 当前场上也能对上这份交互上下文：
  - `base_pyramids_pod` 下方确实存在 1 张己方埋葬牌 `ancient_egyptians_ancient_curse_pod`
  - `titan_0_sphinx` 仍在 `setaside`

这说明现场不是“系统没有给可选目标”，而是已经进入了 Sphinx 的真实起始回合交互，只是选择位点在**基地下方埋葬牌区域**，不是额外再弹一个“打出 Sphinx”按钮。

## 权威文案对照

仓库当前权威 locale 文案：

- `public/locales/zh-CN/game-smashup.json`
  - `特殊：你的回合开始时，你可以将你埋葬的一张牌返回手牌，然后将此泰坦打出到该牌所在的基地。`
- `public/locales/en/game-smashup.json`
  - `Special: At the start of your turn, you may return one of your buried cards to your hand to play this titan on its base.`

当前实现也与文案一致：

- `src/games/smashup/abilities/titans.ts`
  - `sphinxOnTurnStart(...)` 会先收集“你的埋葬牌”作为候选
  - `titan_sphinx_start_turn` handler 在选中埋葬牌后，才会：
    - 把该埋葬牌回手
    - 再把 `Sphinx` 打到该牌所在基地

## 本轮本地复核

- 本轮重新跑通聚焦烟测：
  - `src/games/smashup/__tests__/smashup.smoke.test.ts`
    - `狮身人面像会在你的回合开始时创建回收埋葬牌并进场的交互`
    - `狮身人面像在其所在基地计分后会创建回收该基地埋葬牌的交互`
- 仓库现有浏览器级证据也已覆盖真实入口：
  - `evidence/smashup-sphinx-start-turn-buried-refresh-e2e-test.md`
  - `evidence/smashup-sphinx-stale-buried-options-e2e.md`
- 关键旧截图里已明确说明：
  - 顶部只有一个 `跳过` 按钮
  - 实际可选目标位点在基地下方埋葬牌区域
  - 选择埋葬牌后，Sphinx 会从 `setaside` 进入对应基地

## 结论

- 这条反馈对应的现场里，Sphinx 的起始回合交互已经正常出现。
- 当前产品语义不是“单独点一张 Sphinx 卡把它打出”，而是“点一张埋葬牌，系统据此把 Sphinx 打到那张牌所在基地”。
- 因此这条不是“系统没法选择打出 Sphinx”，而是用户把真实交互位点理解成了“应该有一个单独的 Sphinx 按钮”。

## 收口口径

- 当前任务口径下，`resolved` 表示“本地已经确认并完成本地验收”，不代表已上传/已上线。
- 本条无需额外改代码，按“现网现场符合当前规则语义，但状态尚未回写”处理，可直接转 `resolved`。
