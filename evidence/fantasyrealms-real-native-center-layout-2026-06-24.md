# Fantasy Realms 真实联机中央牌区验收

结论：已修正。少牌时不再重新居中放大，中央牌区保持满 10 张的固定槽位语义。

## 证据

1. [两张牌](../test-results/evidence-screenshots/fantasyrealms/real-native-01-中央牌区-两张牌.png)
   - 我实际看到：两张牌直接落在左上固定槽位，不再挤到中间。
   - 是否达标：达标。

2. [九张牌](../test-results/evidence-screenshots/fantasyrealms/real-native-02-中央牌区-九张牌.png)
   - 我实际看到：上排 5 槽、下排 4 槽，位置继续按固定 10 槽铺开。
   - 是否达标：达标。

3. [十张牌](../test-results/evidence-screenshots/fantasyrealms/real-native-03-中央牌区-十张牌.png)
   - 我实际看到：满 10 张时上下两排都按固定槽位铺满，没有出现额外放大或重新居中。
   - 是否达标：达标。

## 备注

- 真实窗口验证已执行，`verify:open-image` 已打开 01 和 03 两张主图。
- 本次问题本体是中央牌区少牌时的布局跳变，不是牌面资源缺失。

## 2026-06-24 补充：正式在线房间 E2E

新增正式回归：`e2e/fantasyrealms/fantasyrealms-online-ai.e2e.ts` 的 `真实在线房间低张数公开弃牌保持固定槽位，不因少牌重新居中放大`。

验证结果：通过。

这条用例会创建真实在线 AI 房间，进入真实 `/play/fantasyrealms/match/...` 牌桌，再注入 9 张与 2 张公开弃牌状态。断言内容是：2 张公开牌的前两个卡位与 9 张公开牌的前两个固定槽位一致，卡牌宽高也一致。

新截图：

1. [真实在线房间：两张中央牌](../test-results/evidence-screenshots/_shared/fantasyrealms-online-ai.e2e/真实在线房间低张数公开弃牌保持固定槽位，不因少牌重新居中放大/real-online-center-slots-two-cards.png)
   - 我实际看到：两张中央牌保持正常卡面尺寸，落在牌河前两个固定槽位。
   - 是否达标：达标。

2. [真实在线房间：九张中央牌](../test-results/evidence-screenshots/_shared/fantasyrealms-online-ai.e2e/真实在线房间低张数公开弃牌保持固定槽位，不因少牌重新居中放大/real-online-center-slots-nine-cards.png)
   - 我实际看到：九张公开牌沿用同一套正式牌桌槽位。
   - 是否达标：达标。

没有混入为同一个问题的历史 blocker：

- `首页真实建房入口可从开始一路推进到终局排名，并在关键决策位保留前后截图` 曾在当前 4274 开发服务器冷跑时停在首页详情弹窗骨架层，`game-details-open-create-room` 没出现。
- 后续隔离 E2E runtime 已通过同一条首页真实入口链，因此该骨架卡住不再作为中央牌少牌放大的 blocker；它只能记录为当前开发服务器运行态风险。

## 2026-06-24 补充：首页真实入口链复核

复核命令：

`node scripts/infra/run-e2e-command.mjs default e2e/fantasyrealms/fantasyrealms-online-basic.e2e.ts --grep "首页真实建房入口可从开始一路推进到终局排名，并在关键决策位保留前后截图"`

验证结果：通过。

这次复核使用隔离 E2E runtime，证明当前代码下首页入口可以打开详情、进入创建房间弹窗、创建真实在线房间，并从开局一路推进到终局排名。

关键截图：

1. [首页入口：创建房间前](../test-results/evidence-screenshots/_shared/fantasyrealms-online-basic.e2e/首页真实建房入口可从开始一路推进到终局排名，并在关键决策位保留前后截图/ui-full-flow-create-room-before-confirm.png)
   - 我实际看到：已经从首页详情进入创建房间弹窗，`确认创建` 主按钮可见。
   - 是否达标：达标。

2. [首页入口：中段公开弃牌分支](../test-results/evidence-screenshots/_shared/fantasyrealms-online-basic.e2e/首页真实建房入口可从开始一路推进到终局排名，并在关键决策位保留前后截图/ui-full-flow-pre-take-discard-branch.png)
   - 我实际看到：牌桌进入可操作回合，公开弃牌使用固定牌河槽位，卡面没有因为张数变化突然放大。
   - 是否达标：达标。

3. [首页入口：终局排名](../test-results/evidence-screenshots/_shared/fantasyrealms-online-basic.e2e/首页真实建房入口可从开始一路推进到终局排名，并在关键决策位保留前后截图/ui-full-flow-final-standings.png)
   - 我实际看到：终局复盘和最终排名可见。
   - 是否达标：达标。

当前开发服务器补充：

- `http://127.0.0.1:4274/` 在探针中出现根路径 10 秒无响应；同进程下 `src/components/lobby/GameDetailsModal.tsx` 可返回 200。
- 因此 4274 上的骨架卡住更像当前开发服务器运行态卡死，不是当前代码在干净 runtime 下必现的首页入口 bug。
