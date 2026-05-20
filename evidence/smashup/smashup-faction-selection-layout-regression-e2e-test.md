# SmashUp 派系选择页布局回归 E2E 复核（2026-04-12）

## 范围
- `e2e/smashup/smashup-faction-selection-spacing.e2e.ts`
- `src/games/smashup/ui/FactionSelection.tsx`
- `src/pages/LocalMatchRoom.tsx`
- `src/engine/transport/react.tsx`

## 根因结论
1. **旧结论失效（必须更正）**：此前把 `isCompactLandscape` 作为“手机横屏应切 2 列紧凑布局”的结论是错误的。用户真实诉求是“横屏主路径不要偏、不要被修成窄布局”，不是要求把横屏改成双列手机稿。
2. **本轮最小风险修复**：移除 `FactionSelection.tsx` 中针对 `viewport <= 900` 的双列窄布局分支，恢复手机横屏继续使用桌面化主布局，只修选择页的锚点/居中问题，不再改列数和主版式。
3. **“等待提示”测试失败不是 SmashUp 业务实现 bug**：
   - 本地路由 `LocalMatchRoom.tsx` 使用 `<LocalGameProvider followCurrentTurnPlayer />`。
   - `LocalGameProvider` 会在 `localBoardPlayerId` 中默认跟随当前回合玩家，因此本地单机页不会稳定停留在“固定 P0 视角”。
   - 旧测试把 `currentPlayerIndex` 当成“只切回合、不切视角”，这个前提与当前本地模式设计不一致，所以会看到“现在轮到你了”而不是“正在等待 Px”。
4. **等待提示这条链路的最小风险修复**：只改 E2E 口径，不改本地视角机制；测试改为验证“顶部回合状态贴纸本身不可点穿到派系详情”。

## 关键证据
- `src/pages/LocalMatchRoom.tsx`：本地页显式传入 `followCurrentTurnPlayer`
- `src/engine/transport/react.tsx`：`localBoardPlayerId` 在 `followCurrentTurnPlayer` 开启时会跟随当前回合玩家
- `src/games/smashup/ui/FactionSelection.tsx`：顶部状态提示由 `isMyTurn = playerID === getCurrentPlayerId(core)` 决定

## E2E 结果
命令：
- `node scripts/infra/run-e2e-command.mjs ci e2e/smashup/smashup-faction-selection-spacing.e2e.ts`

结果：
- 2 passed

## 截图观察

### 1. 手机横屏主布局（修正后）
截图：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup-faction-selection-spacing\mobile-landscape.png`
- 我实际看到：顶部标题与状态贴纸仍在中轴附近，没有被挤到左上角，也没有只剩一块窄内容。
- 我实际看到：首行保持 5 张卡的横屏桌面化排布，第三张卡仍与第一张处于同一行，说明这次没有再被误修成双列窄布局。
- 我实际看到：卡面之间仍保留横向间距，且整页没有横向溢出滚动条。
- 验收结论：**达到本轮“横屏主路径不再被改成窄布局，只修偏移不改版式”的验收标准。**

### 2. 桌面参考图
截图：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup-faction-selection-spacing\desktop-reference.png`
- 我实际看到：桌面宽度下仍保持多列排布，顶部标题、状态贴纸与首行卡牌居中，没有被手机紧凑分支拖歪。
- 我实际看到：首行 4 张卡的左右留白仍然均衡，未出现整组整体右偏。
- 验收结论：**达到“修手机布局时不把桌面布局带偏”的验收标准。**

### 3. 回合状态贴纸不可点穿
截图：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup-faction-selection-waiting\turn-status-badge-click.png`
- 我实际看到：点击顶部“现在轮到你了”贴纸后，页面仍停留在派系选择网格，没有弹出右侧派系详情面板。
- 我实际看到：截图里没有出现错误 toast、未知命令提示或误开的详情抽屉。
- 验收结论：**达到“状态提示只是提示，不应触发派系详情”的验收标准。**

## 备注
- 这轮收口的是：**SmashUp 选择页布局回归 + 旧 E2E 错误前提**。
- 旧文档里“手机横屏 2 列紧凑布局达标”的结论已经失效，不能再作为当前验收依据。
- 本地单机页“视角跟随当前回合玩家”是当前既有设计，不建议为了这条测试去改共享本地模式逻辑。

## 2026-05-19 复核补充

命令：
- `npm run test:e2e:ci:file -- e2e/smashup/smashup-faction-selection-spacing.e2e.ts "移动端横屏应保持桌面化主布局并输出移动端/桌面端参考截图"`

结果：
- 通过

### 本轮根因与修正
- **旧结论失效（再次更正）**：此前把“桌面态直接平铺完整候选集也没问题”当成可接受结论，这和后续补入的 `高密度候选池必须提供减负入口` 规范不一致。用户指出“候选太多不好扫”是对的。
- **本轮 UI 修正**：
  - `FactionSelection.tsx` 默认先聚焦 `available`，不再把 `all` 当成桌面默认。
  - 桌面高密度候选池也露出搜索 + 状态筛选入口，不再只有窄视口才有减负工具。
  - 2 人桌面草稿单独走 `useFocusedDesktopDraftLayout`，候选卡与底栏摘要进一步收紧。
  - 多人 compact 桌面把工具条压成单行，避免为了减负入口反过来挤掉候选主区。
- **本轮 E2E 几何修正**：
  - 几何断言不再把“滚动区里下一排预露出的半截卡”直接当成“被底栏遮挡”。
  - 现在只统计 **在玩家 rail 上方有足够可见面积** 的候选卡；若完整可见的底排真被遮住，断言仍会失败。

### 1. 移动端横屏参考图
截图：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup-faction-selection-spacing\mobile-landscape.png`
- 我实际看到：横屏下仍是桌面化主布局，顶部标题和状态贴纸居中，没有缩成左上角一小块。
- 我实际看到：搜索框和 `可选 / 全部 / 已锁定` 筛选按钮已经进入主视口，说明移动端高密度候选池也能直接减负，不必先硬扫满屏卡。
- 我实际看到：首行仍是 5 列派系卡，页面没有横向溢出；底部玩家 rail 在 ultra-compact 横屏下继续隐藏，没有挤压候选主区。
- 验收结论：**达到。**

### 2. 桌面参考图
截图：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup-faction-selection-spacing\desktop-reference.png`
- 我实际看到：桌面态顶部保留单行减负工具条，默认聚焦 `可选`，不再是“整屏先铺满全部候选再让用户自己扫”。
- 我实际看到：候选卡已经收成更紧的 2 人桌面密度分支，当前有效可见的底排卡都在底栏上方，没有肉眼级被玩家摘要 rail 压住。
- 我实际看到：画面底部露出的下一排卡只属于滚动区的预露头，不是完整可操作行；本轮几何断言已改成只统计 rail 上方足够可见的候选卡。
- 验收结论：**达到。**

### 3. 本轮修正点
- `src/games/smashup/ui/FactionSelection.tsx`
  - 默认 `visibilityMode` 改为 `available`
  - 桌面高密度候选池显示搜索/筛选入口
  - 2 人桌面与多人 compact 桌面分支分别压缩密度
- `e2e/smashup/smashup-faction-selection-spacing.e2e.ts`
  - 几何门禁从“视口内半可见就算到底排”改为“rail 上方有足够可见面积才算有效候选行”
