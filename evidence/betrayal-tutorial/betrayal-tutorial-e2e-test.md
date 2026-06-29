# 山屋惊魂教程 E2E 截图验收

## 命令

- `node scripts/infra/run-e2e-command.mjs ci e2e/betrayal/betrayal-tutorial.e2e.ts`
- 结果：`1 passed`

## 截图核对

### 01 角色选择

- 路径：`D:\gongzuo\webgame\BoardGame\.worktrees\betrayal\evidence\betrayal-tutorial\01-山屋惊魂-教程-角色选择.png`
- 实际看到：教程不是独立假页面，而是直接落在真实角色选择页。
- 实际看到：可见真实探索者牌阵、当前选中探索者与 `确认` 入口，说明教程起点复用了正式开局链路。
- 验收结论：教程从真实角色选择入口开始成立。

### 02 恶兆前动作区

- 路径：`D:\gongzuo\webgame\BoardGame\.worktrees\betrayal\evidence\betrayal-tutorial\02-山屋惊魂-教程-恶兆前动作区.png`
- 实际看到：教程进入真实恶兆前运行时后，底部仍是正式 `移动 / 探索 / 交易 / 使用 / 结束回合` 动作区。
- 实际看到：没有额外造一条“教程专用按钮栏”或说明面板去替代正式交互。
- 验收结论：教程复用了真实运行时动作入口。

### 03 持有区与帮助入口

- 路径：`D:\gongzuo\webgame\BoardGame\.worktrees\betrayal\evidence\betrayal-tutorial\03-山屋惊魂-教程-持有区与帮助入口.png`
- 实际看到：左侧持有区、右侧帮助入口都还在正式牌桌里，没有切到独立帮助页。
- 实际看到：教程只是在真实页面上做最小锚点和提示，不是另做一套教学壳层。
- 验收结论：持有区与帮助入口的教程承载方式正确。

### 04 房间主视区

- 路径：`D:\gongzuo\webgame\BoardGame\.worktrees\betrayal\evidence\betrayal-tutorial\04-山屋惊魂-教程-房间主视区.png`
- 实际看到：中央房间牌桌仍是主视区，教程没有用大段正文盖住地图。
- 实际看到：教程对“房间是主战场”的说明依附在真实房间区锚点上，而不是把地图降成背景。
- 验收结论：教程守住了运行时主视区关系。

### 05 Haunt 收尾前

- 路径：`D:\gongzuo\webgame\BoardGame\.worktrees\betrayal\evidence\betrayal-tutorial\05-山屋惊魂-教程-haunt收尾前.png`
- 实际看到：教程已经进入第一剧本 `haunt` 收尾局面，正式底部动作区和右侧帮助入口仍然可见。
- 实际看到：这不是测试直接跳终局，而是先落到真实 `haunt` 运行时，再继续完成英雄线收尾。
- 验收结论：教程对第一剧本英雄线关键收尾的承接成立。

### 06 终局页

- 路径：`D:\gongzuo\webgame\BoardGame\.worktrees\betrayal\evidence\betrayal-tutorial\06-山屋惊魂-教程-终局页.png`
- 实际看到：教程最终落到真实终局页，而不是教程专用结算页。
- 实际看到：终局结构仍是正式幸存者胜利结果页，说明教程链路确实跑完了真实第一剧本英雄线结束。
- 验收结论：教程最小真实链路已经闭环。

## 备注

- 本文件只记录教程 E2E，不替代 `basic-flow` 与 `first-scenario` 的分段验收。
- 三条真实链路当前分工如下：
  - `basic-flow`：角色选择确认到恶兆前运行时
  - `first-scenario`：真实 haunt 运行时到第一剧本幸存者终局
  - `betrayal-tutorial`：真实角色选择到真实教程章节，再到第一剧本英雄线收尾与终局
- 当前教程仍只承诺第一轮基础范围：真实角色选择、恶兆前主循环、第一剧本英雄线目标与英雄线收尾；叛徒视角和更多剧本仍留待后续子教程。
