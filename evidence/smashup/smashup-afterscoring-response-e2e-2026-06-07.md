# SmashUp 计分后响应卡死修复 E2E 证据（2026-06-07）

## 本轮要证明什么

- 计分后响应主链已经恢复为“手牌卡图承接 + MeFirst 中间提示 UI”。
- 没有合法目标时不会再卡死，必须给出明确反馈并自动收口。
- 响应窗口没有可正常让过入口时，`强制结束回合` 兜底必须能把流程直接推进下去。
- 计分响应里点击 `让过` 后，窗口必须立即收口，不能原地重开。

## 实际执行的 E2E

```powershell
$env:BG_ALLOW_HEAVY_TASK_CONCURRENCY='1'
$env:BG_HEAVY_WAIT_FOR_BUDGET='1'
npm run test:e2e:ci:file -- e2e/smashup/smashup-base-minion-selection.e2e.ts "反馈回归：计分后响应应保持手牌承接，并显示 MeFirst 提示弹窗"
npm run test:e2e:ci:file -- e2e/smashup/smashup-base-minion-selection.e2e.ts "反馈回归：我们乃最强在没有合法接收目标时，应直接给出反馈并自动收口"
npm run test:e2e:ci:file -- e2e/smashup/smashup-base-minion-selection.e2e.ts "反馈回归：同一基地计分响应里 0 号位让过后，1 号位出牌不应再把 0 号位拉回二次让过"
npm run test:e2e:ci:file -- e2e/smashup/smashup-base-minion-selection.e2e.ts "反馈回归：计分后响应卡死且无可让过时，强制结束回合应直接收口到下一玩家"
npm run test:e2e:ci:file -- e2e/smashup/smashup-titan-reaction-pass.e2e.ts
```

## 关键截图与肉眼观察

### 1. 计分后响应主链恢复手牌承接

- 触发前截图：
  [smashup-champions-mefirst-before-click.png](</D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/smashup/smashup-base-minion-selection.e2e/反馈回归：计分后响应应保持手牌承接，并显示-MeFirst-提示弹窗/smashup-champions-mefirst-before-click.png>)
- 收口后截图：
  [smashup-champions-mefirst-resolved.png](</D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/smashup/smashup-base-minion-selection.e2e/反馈回归：计分后响应应保持手牌承接，并显示-MeFirst-提示弹窗/smashup-champions-mefirst-resolved.png>)
- 肉眼看到：
  - 中间是 `计分后响应` 的 MeFirst 提示层，但真正可点的响应对象仍是底部手牌里的《我们乃最强》卡图，不是中间按钮列表。
  - 结算完成后，中央大脑基地上的己方随从从 4 力量变成 6 力量，说明转移力量指示物的后续链已经真正执行。
  - 画面回到正常牌桌状态，没有残留 `选择一个响应动作` 的旧壳层。
- 验收判断：
  - 这一条满足“恢复原本手牌承接，不再用新造中间交互对象替代”的目标。

### 2. 《我们乃最强》没有合法目标时自动收口

- 点基地后的即时截图：
  [smashup-champions-no-target-after-base-click.png](</D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/smashup/smashup-base-minion-selection.e2e/反馈回归：我们乃最强在没有合法接收目标时，应直接给出反馈并自动收口/smashup-champions-no-target-after-base-click.png>)
- 收口后截图：
  [smashup-champions-no-target-resolved.png](</D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/smashup/smashup-base-minion-selection.e2e/反馈回归：我们乃最强在没有合法接收目标时，应直接给出反馈并自动收口/smashup-champions-no-target-resolved.png>)
- 肉眼看到：
  - 点基地后顶部立即出现更短、更强硬的反馈文案 `没有可用目标`，说明不是静默失败。
  - 旧的中间按钮壳 `选择一个反应动作` 已经不见了，这条分支也回到了现有牌桌对象承接，而不是再弹一层旧 prompt。
  - 收口后页面回到可继续操作的桌面，并出现 `结束回合` 主按钮；《我们乃最强》已离开手牌，不会再把人卡在计分响应里。
- 验收判断：
  - “不会卡死、会给反馈、会自动收口”这一条现在已经满足。
  - 这一条分支也不再残留旧的中间按钮壳。

### 3. 卡死兜底入口改为 `强制结束回合`

- 卡死现场截图：
  [smashup-scorebases-force-end-turn-stuck.png](</D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/smashup/smashup-base-minion-selection.e2e/反馈回归：计分后响应卡死且无可让过时，强制结束回合应直接收口到下一玩家/smashup-scorebases-force-end-turn-stuck.png>)
- 收口后截图：
  [smashup-scorebases-force-end-turn-resolved.png](</D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/smashup/smashup-base-minion-selection.e2e/反馈回归：计分后响应卡死且无可让过时，强制结束回合应直接收口到下一玩家/smashup-scorebases-force-end-turn-resolved.png>)
- 肉眼看到：
  - 卡死现场右侧已经出现 `强制结束回合` 操作和更强硬的确认文案，不再是旧的弱提示口气。
  - 收口后左上角回合标签切到 `对手 / 出牌阶段`，说明流程没有停在 `scoreBases`，而是直接推进到了下一位玩家。
  - 页面里不再残留计分响应提示层，证明这不是“按钮能点但状态没走”的假收口。
- 验收判断：
  - 这条满足“任何游戏都不能卡死，必要时直接强制跳过当前回合”的兜底目标。

### 4. 计分响应 `让过` 立即收口且不重开

- 让过前截图：
  [smashup-kraken-reaction-pass-window.png](</D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/smashup/smashup-titan-reaction-pass.e2e/海怪克拉肯高亮反应点击让过后，应立即收口且不重开/smashup-kraken-reaction-pass-window.png>)
- 让过后截图：
  [smashup-kraken-reaction-pass-resolved.png](</D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/smashup/smashup-titan-reaction-pass.e2e/海怪克拉肯高亮反应点击让过后，应立即收口且不重开/smashup-kraken-reaction-pass-resolved.png>)
- 肉眼看到：
  - 让过前中间是 `计分后响应` 提示层，左下角直接展示海怪克拉肯卡图，可见这条链的承接对象是现有卡图。
  - 让过后中间提示层消失，页面回到正常桌面，右侧只剩常规操作按钮。
  - 没有再次弹出同一个响应窗口，也没有停留在无法继续的中间态。
- 验收判断：
  - 这条满足“让过要真让过，不能点了以后窗口又回来”的回归目标。

### 5. 同一基地里已经让过的玩家，不会再被拉回二次让过

- 0 号位让过前截图：
  [smashup-champions-pass-sticky-before-pass.png](</D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/smashup/smashup-base-minion-selection.e2e/反馈回归：同一基地计分响应里-0-号位让过后，1-号位出牌不应再把-0-号位拉回二次让过/smashup-champions-pass-sticky-before-pass.png>)
- 1 号位接手响应截图：
  [smashup-champions-pass-sticky-player-one-turn.png](</D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/smashup/smashup-base-minion-selection.e2e/反馈回归：同一基地计分响应里-0-号位让过后，1-号位出牌不应再把-0-号位拉回二次让过/smashup-champions-pass-sticky-player-one-turn.png>)
- 收口后截图：
  [smashup-champions-pass-sticky-resolved.png](</D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/smashup/smashup-base-minion-selection.e2e/反馈回归：同一基地计分响应里-0-号位让过后，1-号位出牌不应再把-0-号位拉回二次让过/smashup-champions-pass-sticky-resolved.png>)
- 肉眼看到：
  - 0 号位第一次看到的是正常 `计分后响应` 提示层和自己的《我们乃最强》手牌，说明起点是同一基地同一计分响应帧。
  - 0 号位点完 `让过` 后，响应权切到 1 号位，1 号位可以直接用现有手牌卡图继续出《我们乃最强》。
  - 1 号位结算完成后，桌面直接收口，没有再把 0 号位拉回第二次 `让过`。
- 验收判断：
  - 这条满足“同一基地的计分响应里，一个玩家显式让过一次后，不会再被同一帧拉回来二次让过”的回归目标。

## 本轮收口结论

- 端到端已经证明：计分后响应主链、无合法目标分支、同基地二次让过回归、强制结束回合兜底、计分响应让过收口，这五条链都不再卡死。
- 其中“手牌承接 + MeFirst 提示层”已经在主链上恢复成功。
- “无合法目标”这条分支现在也已经去掉了旧的 `选择一个反应动作` 中间按钮壳，并改成顶部强反馈后自动收口。
- 当前可以按真实证据收口为：计分响应 UI 主链已回归到“手牌承接 + MeFirst 提示层”，同基地显式让过也不会再把已让过玩家拉回二次让过。
