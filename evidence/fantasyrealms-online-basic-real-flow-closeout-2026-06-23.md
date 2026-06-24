# Fantasy Realms 真实端到端链路证据（2026-06-23）

## 本轮范围

- 使用当前开发环境真实服务跑 `Fantasy Realms` 联机链路。
- 从首页真实入口开始，经过建房、进入对局、等待 AI、回到我方回合、终局复盘。
- 本文只证明“真实页面链路是否能跑通，以及关键截图里肉眼能看到什么”，不把测试通过偷换成 UI 全部达标。

## 真实链命令

```powershell
$env:PW_USE_DEV_SERVERS='true'
$env:PW_ALLOW_DEV_SERVER_TESTS='true'
$env:PW_START_SERVERS='false'
$env:PW_WORKERS='1'
node scripts/infra/run-e2e-command.mjs dev e2e/fantasyrealms/fantasyrealms-online-basic.e2e.ts --grep "首页真实建房入口可从开始一路推进到终局排名，并在关键决策位保留前后截图"
```

结果：

- 日志明确写的是开发服务器 `4274 / 18001 / 18002`
- 本次命中用例 `1 passed`

## 关键截图

### 1. 首页真实建房弹窗

路径：
`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\fantasyrealms-online-basic.e2e\首页真实建房入口可从开始一路推进到终局排名，并在关键决策位保留前后截图\ui-full-flow-create-room-before-confirm.png`

观察：

- 这是首页上的真实建房弹窗，不是孤立测试页。
- 画面里能直接看到 `确认创建` 主按钮，下一步入口明确。
- AI 开关、人数位、思考时长都在同一弹窗里，能证明房间创建配置来自真实流程。

结论：

- 达到“从首页真实入口开始”的验收标准。

### 2. 开局已自动推进到可继续操作态

路径：
`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\fantasyrealms-online-basic.e2e\首页真实建房入口可从开始一路推进到终局排名，并在关键决策位保留前后截图\ui-full-flow-opening-before-first-draw.png`

观察：

- 画面已经是你的回合，右下只有灰态 `弃牌`，底部已经有完整手牌。
- 这说明真实链里开局唯一合法动作已经自动执行，没有停在“无入口可点”的卡死态。
- 但这张图的命名还是 `before-first-draw`，和画面语义不一致；它更像“自动摸牌后，等待弃牌”。

结论：

- 能证明真实链没有停在开局空转。
- 不能把这张图当成“开局摸牌前后对照”的最佳收口图，后续还应补更准确命名或更贴近动作语义的关键帧。

### 3. 中盘回到我方回合，摸牌入口明确

路径：
`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\fantasyrealms-online-basic.e2e\首页真实建房入口可从开始一路推进到终局排名，并在关键决策位保留前后截图\ui-full-flow-pre-take-discard-branch.png`

观察：

- 顶部是 `你的回合`，中间有两张中央公开牌，右下有 `摸牌（或拿中央牌）` 主按钮。
- 下一步怎么继续是明确的：要么点主按钮从牌库摸牌，要么直点中央公开牌拿牌。
- 牌桌布局、手牌、中央牌、主按钮都在同一真实页面里，不是拆开的组件页。

结论：

- 达到“关键决策前图必须让人一眼看出下一步入口”的验收标准。

### 4. 等待 AI 的状态是显式可见的

路径：
`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\fantasyrealms-online-basic.e2e\首页真实建房入口可从开始一路推进到终局排名，并在关键决策位保留前后截图\ui-full-flow-waiting-ai-after-first-discard.png`

观察：

- 顶部直接显示 `AI 2 号位`，不是静默停在我方回合画面。
- 中央牌区只剩 AI 当前的公开区，底部仍保留我方手牌上下文。
- 这类等待态从肉眼上看得到“现在轮到谁”，不属于“页面像没反应”。

结论：

- 达到“合法等待态必须显式说明谁在等谁”的验收标准。

### 5. 从中央直拿牌后，仍回到同一套正式桌面

路径：
`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\fantasyrealms-online-basic.e2e\首页真实建房入口可从开始一路推进到终局排名，并在关键决策位保留前后截图\ui-full-flow-take-discard-after-direct-click.png`

观察：

- 拿走一张中央牌后，中央区剩 1 张，底部手牌增加到 8 张。
- 右下仍是灰态 `弃牌`，说明拿牌后的下一步已收敛为弃牌。
- 整体布局没有跳成另一套样式，还是同一套正式牌桌。

结论：

- 达到“中央直点分支完成后，仍回到同一套桌面流程”的验收标准。

### 6. 终局复盘页已经跑通

路径：
`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\fantasyrealms-online-basic.e2e\首页真实建房入口可从开始一路推进到终局排名，并在关键决策位保留前后截图\ui-full-flow-final-standings.png`

观察：

- 顶部已经切到 `终局复盘`，右侧能直接看到最终排名。
- 第一名带王冠，第二、第三名保留银铜标识，获胜者足够明显。
- 中央同时出现本次计分展示卡组和右侧排名，说明真实链已经走到终局而不是中途假收口。

结论：

- 达到“真实流程可从首页跑到终局排名”的验收标准。

## 总结

- 这次证据证明的是：当前开发环境里的真实页面链路能从首页一路跑到终局复盘，不是隔离注入态冒充真实流程。
- 这次证据没有证明“所有关键帧都已经是最优展示”。尤其开局那张 `ui-full-flow-opening-before-first-draw.png`，画面语义和文件名不一致，不适合继续拿来充当最佳验收图。
