# SummonerWars 事件牌两段式/交互取消 E2E 证据（2026-04-18）

## 范围
- 非交互事件牌：先 `armed` 再确认，且可点棋盘取消。
- 魔力阶段非交互事件牌：先 `armed`，第二次点击进入“打出/弃牌/取消”。
- 交互事件牌：可单击直接进入交互，但未确认前不消耗；点击非目标格可取消。

## 执行命令
```powershell
$env:PW_E2E_SERVICE_REUSE='shared-single'
$env:PW_E2E_FRONTEND_PORT='7174'
$env:PW_E2E_GAME_SERVER_PORT='20000'
$env:PW_E2E_API_SERVER_PORT='21000'

npm run test:e2e:ci:file -- summonerwars/summonerwars.e2e.ts "事件卡：非交互事件牌应先 armed 再确认，点棋盘可取消"
npm run test:e2e:ci:file -- summonerwars/summonerwars.e2e.ts "事件卡：魔力阶段非交互事件牌应先 armed，再次点击进入打出/弃牌选择"
npm run test:e2e:ci:file -- summonerwars/summonerwars.e2e.ts "事件卡：交互事件牌可直接进交互，取消后不消耗（单目标不自动触发）"
```

## 关键截图与观察

### 1) 非交互事件：首次点击仅 armed
- 路径：`D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/summonerwars/summonerwars.e2e/事件卡：非交互事件牌应先-armed-再确认，点棋盘可取消/event-noninteractive-armed-step.png`
- 观察：事件牌抬起且仍在手牌，未立即结算。
- 验收：达标。

### 2) 非交互事件：点棋盘取消 armed
- 路径：`D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/summonerwars/summonerwars.e2e/事件卡：非交互事件牌应先-armed-再确认，点棋盘可取消/event-noninteractive-board-cancel.png`
- 观察：事件牌回到未选中，手牌未消耗。
- 验收：达标。

### 3) 魔力阶段非交互：二次点击才弹出选择
- 路径：`D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/summonerwars/summonerwars.e2e/事件卡：魔力阶段非交互事件牌应先-armed，再次点击进入打出-弃牌选择/event-magic-noninteractive-choice-open.png`
- 观察：第一次仅 armed；第二次点击出现 `Play / Discard / Cancel` 按钮。
- 验收：达标。

### 4) 交互事件：进入交互但未确认不消耗
- 路径：`D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/summonerwars/summonerwars.e2e/事件卡：交互事件牌可直接进交互，取消后不消耗（单目标不自动触发）/event-interactive-single-target-open.png`
- 观察：点击后出现单目标高亮；事件牌仍在手牌（未自动触发）。
- 验收：达标。

### 5) 交互事件：点击状态栏取消按钮
- 路径：`D:/gongzuo/webgame/BoardGame/test-results/evidence-screenshots/summonerwars/summonerwars.e2e/事件卡：交互事件牌可直接进交互，取消后不消耗（单目标不自动触发）/event-interactive-single-target-cancel.png`
- 观察：点击 `Cancel/取消` 后目标高亮清除，事件牌仍留在手牌。
- 验收：达标。

## 结果
- `事件卡：非交互事件牌应先 armed 再确认，点棋盘可取消`：通过。
- `事件卡：魔力阶段非交互事件牌应先 armed，再次点击进入打出/弃牌选择`：通过。
- `事件卡：交互事件牌可直接进交互，取消后不消耗（单目标不自动触发）`：通过。
