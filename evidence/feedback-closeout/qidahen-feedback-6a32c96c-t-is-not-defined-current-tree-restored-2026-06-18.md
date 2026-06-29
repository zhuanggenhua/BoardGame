# 七大恨线上反馈待回写（6a32c96c638b2f426d295896）

## 范围

- 反馈 ID：`6a32c96c638b2f426d295896`
- 游戏：`qidahen`
- 反馈原文：`[auto][board-render-error] t is not defined`

## 真相源

- 生产真源：
  - `ssh admin@8.148.71.102` -> `docker exec -i boardgame-mongodb mongosh --quiet` -> `boardgame.feedbacks`
- 当前仍为 `open` 的同根因历史记录：
  - `2026-06-16T12:15:54.991Z`：点击 `确认投票` 后前端崩溃
  - `2026-06-16T15:10:09.991Z`：点击 `确认投票` 后前端崩溃
  - `2026-06-17T16:21:00.283Z`：局内前置层 `qidahen-inmatch-setup-overlay` 期间前端崩溃
- 生产错误正文一致：
  - `ReferenceError: t is not defined`

## 根因

- 真正出错的位置不是“剧本投票功能整体坏了”，而是七大恨动作按钮右侧的短状态徽章。
- 历史提交 `c9039151` 把动作徽章从硬编码文本改成了翻译调用：
  - `当前` -> `t('board.actions.state.current', ...)`
  - `可选` -> `t('board.actions.state.available', ...)`
- 但同一位置当时没有把翻译函数带进组件，导致真实线上一旦重渲染到这块，就会直接抛：
  - `t is not defined`
- 这也解释了为什么用户现场有时点在“确认投票”，有时点在“局内前置层”，但最终都会掉到同一条前端崩溃。

## 当前树为什么判断为“已恢复”

- 后续提交 `ee8cd10a` 已在对应按钮组件补上：
  - `const { t } = useTranslation('game-qidahen')`
- 当前本地构建产物里，七大恨棋盘 bundle 已不再是“裸 `t(...)`”状态，而是组件内先拿到翻译函数再调用。
- 当前生产容器 revision 也已确认是：
  - `boardgame-web`: `b1257224dc08bdb02095c85eb40c4b40b2e14228`
  - `boardgame-game-server`: `b1257224dc08bdb02095c85eb40c4b40b2e14228`
- 该 revision 晚于 `ee8cd10a`，所以当前生产运行代码已经包含这条修复。

## 本地验证

- 真实联机 E2E：
  - `node scripts/infra/run-e2e-single.mjs ci e2e/qidahen/online-full-round-second-round.e2e.ts "真实联机 match 从局内剧本投票走到第二回合开始"`
  - 结果：`1 passed`
- 结构门禁：
  - `pnpm vitest run src/games/qidahen/__tests__/Board.test.ts --configLoader native`
  - 结果：`171 passed`
- 当前生产健康：
  - `https://api.easyboardgame.top/health`
  - 返回：`{"status":"ok",...}`

## 当前状态

- 反馈本体结论：`resolved（待正式回写）`
- 结论口径：
  - 这是**真实 bug**，不是误报。
  - 但它已经被后续代码修复并进入当前部署 revision，属于“当前树已恢复、生产状态未回写”的遗留 open。
- 当前边界：
  - 本轮没有再改七大恨代码。
  - 这条反馈还没有正式回写到生产真源，因为：
    - HTTP 开放回写接口当前为 `404`
    - 本轮没有拿到“可改生产 Mongo”的明确授权

## 收口结论

- 这条反馈不应继续按“现存未修 bug”推进。
- 更准确的口径是：
  - `历史线上真实 bug`
  - `已由后续提交修复`
  - `当前部署 revision 已包含修复`
  - `只差正式反馈状态回写`
