# 七大恨 Board UI 实施验证（2026-05-16）

## 范围

- 工作树：`D:\gongzuo\webgame\BoardGame\.worktrees\qidahen`
- 目标：把冻结稿 `temp/qidahen-ui-imagegen-review/final-design.png` 的稳定结构落到真实前端实现
- 本轮重点：
  - 顶部薄玩家状态
  - 左上轮盘本体交互
  - 轮盘下唯一纪年卡位
  - 右侧 `朝鲜牌库 + 朝鲜弃牌 + 具体动作 rail`
  - 底部完整居中的 `牌库 + 手牌 + 弃牌` 簇
  - 先选具体动作，再显示 `需弃 N / 已选 M`

## 本轮改动

- 已重写 `src/games/qidahen/Board.tsx` 的主布局，移除旧的战斗/日志/结束行动面板，改成地图主舞台 + overlay 组件。
- 已更新 `src/games/qidahen/domain/index.ts` 的占位 state，使其默认进入 `赐印招安` 支付态，并只显示四个叶子动作。
- 已修复 qidahen 资源链：当前 worktree 原本缺失 `public/assets/i18n/zh-CN/qidahen/**`，导致页面图片全部 404；本轮已同步资源并补命名别名。

## 验证

- `npx vitest run src/games/qidahen/__tests__/Board.test.ts`
  - 13/13 通过
- `npm run typecheck`
  - 通过
- 页面截图：
  - 桌面：`D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-board-desktop-2026-05-16.png`
  - 手机横屏：`D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-board-mobile-landscape-2026-05-16.png`

## 肉眼观察

- 桌面图已满足的点：
  - 顶部玩家状态已经压成单行薄条，没有再出现旧房间栏。
  - 左上轮盘仍由版图本体承担交互，没有额外“轮盘说明按钮”。
  - 纪年卡只保留在轮盘下方一处。
  - 右侧顺序已是 `朝鲜牌库 / 朝鲜弃牌 / 具体动作 rail`。
  - 右侧 rail 只显示 `突袭作战 / 征召军队 / 赐印招安 / 驱虎吞狼` 四个叶子动作。
  - 只有在 `赐印招安` 选中后才出现 `需弃 3 / 已选 0`。
  - 底部是完整的 `牌库 + 手牌 + 弃牌` 簇，没有回到旧确认/结束行动区。

- 桌面图未达标的点：
  - 底图仍是原始版图，左上说明字、左下 `七大恨 / KV`、右侧旧槽位底图仍然可见，和冻结稿相比噪声偏多。
  - 轮盘、底部手牌簇和右侧 rail 的整体质感还没完全贴到 `final-design.png` 的收敛程度。
  - 当前底部手牌文案仍是占位实现，尚未接上真实卡面裁切/卡表真相源。

- 手机横屏图未达标的点：
  - 仍偏“整张桌面缩小后摆进横屏”，不是冻结稿那种更贴屏、更像移动横屏壳层的效果。
  - 左右仍有较宽留白；虽然没有缩在左上角，但视觉上仍像桌面图缩略版。
  - 这意味着移动端主舞台仍需要单独做一轮缩放策略/视口收口。

## 结论

- 本轮结论不是“已完全贴稿”，而是“主结构与资源链已落地，可运行，可继续在真实前端上迭代”。
- 当前最主要剩余问题：
  - 原始版图杂讯仍过重
  - 移动横屏还不够贴屏
  - 底部手牌仍是占位卡面，不是真实卡图/卡表

## 风险与后续

- 当前手牌标题 `大雪 / 破败 / 烧火 / 商贸 / 秋收 / 坚城` 只是为了摆脱明显的“事件牌/军备牌”占位词，尚未建立到 atlas 裁切合同或正式卡表真相源；在接入真实卡图前，不应把这组文案当成最终规则数据。
- 下一轮应优先做三件事：
  - 接真实卡图/atlas 裁切，替换底部手牌占位面
  - 收口移动端横屏缩放与舞台占屏
  - 继续削弱原始版图中非当前 UI 所需的杂讯区域
