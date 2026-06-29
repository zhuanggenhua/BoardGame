# SmashUp 自动反馈 `6a2e12e8d789d530ed3254d4` 收口证据

## 反馈对象

- 反馈 ID：`6a2e12e8d789d530ed3254d4`
- 游戏：`smashup`
- 来源：前端自动报错 `client-unhandled-rejection`
- 线上文案：`[auto][unhandledrejection] Maximum call stack size exceeded`

## 真实现场

只读生产记录显示：

- 路由：`/play/smashup/match/KhEiY5_f9Gs?playerID=0`
- 发生时页面上存在 modal：`hasModalOpen=true`
- 栈顶命中：
  - `game-DActPqsh.js`
  - `context-TvNsDRmo.js`
  - `useGameNamespaceReady-BJeEZyyq.js`
  - `MatchRoom-ceYy9XOn.js`
- 关键症状仍然是：
  - `buildLegalActions`
  - `Maximum call stack size exceeded`

现实含义是：

- 这不是 Howler 音频递归簇
- 而是 SmashUp 合法动作构建链在当时某个前端包上的递归栈溢出

## 与既有证据的关系

仓库里已有同根因 closeout：

- [feedback-closeout-2026-06-10-smashup-unhandledrejection-maximum-call-stack-old-bundle-closed.md](/abs/path/D:/gongzuo/webgame/BoardGame/evidence/feedback-closeout/feedback-closeout-2026-06-10-smashup-unhandledrejection-maximum-call-stack-old-bundle-closed.md:1)

既有证据已经证明：

- 当前代码对同根因真实 SmashUp 反制链快照回放时，不再出现 `buildLegalActions` 栈溢出
- 相关 transport / 极客反制 continuity 回归已覆盖这一类“候选漂移但进度未变”的 family

## 生产侧补证据

以当前线上镜像创建时间 `2026-06-17T17:47:35.734Z` 为分界，继续统计同文案：

- `client-unhandled-rejection / [auto][unhandledrejection] Maximum call stack size exceeded / gameId=smashup`
- 部署后新增条数：`0`

这说明：

- 这条反馈属于当前线上镜像之前的历史条目
- 当前生产版本之后没有再继续刷新同文案

## 结论

- 这条反馈的现实含义仍是 SmashUp `buildLegalActions` 递归栈溢出 family。
- 当前仓库已有同根因真实快照回放与 transport continuity 回归证据。
- 当前线上镜像之后没有新的同文案继续出现。

因此本条应按 **当前生产已恢复 / 历史残留条目** 收口，不再继续作为现存 bug 挂在未关闭队列。

## 收口口径

- 建议状态：`closed`
- 建议说明：`当前生产已恢复；这条命中的是 SmashUp buildLegalActions 递归栈溢出 family，既有真实快照回放已证明当前代码不再复现，且当前线上镜像后没有新的同文案反馈。`
