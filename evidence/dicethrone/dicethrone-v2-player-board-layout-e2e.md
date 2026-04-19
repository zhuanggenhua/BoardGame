# DiceThrone 第二版玩家板布局 / 放大 / 布局编辑器证据

## 范围

- 新角色 `gunslinger`、`samurai` 使用第二版玩家板布局。
- 局内玩家板放大层不再沿用旧角色 `2048 x 1673` 比例，避免第二版图片被裁剪。
- 调试布局编辑器升级为 `v1 / v2` 双版本保存，避免第二版保存覆盖旧版素材布局。
- 第二版局内 UI 微调：
  - 中央整体轻微右移。
  - 玩家板整体上移。
  - 放大按钮下移。

## 本轮执行结果

- `node scripts/infra/vitest-cli-safe.mjs run apps/api/test/layout.service.test.ts --config vitest.config.api.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1`
  - 结果：通过。
- `$env:CODEX_MANAGED_BY_NPM='0'; node scripts/infra/run-e2e-single.mjs ci e2e/dicethrone/character-selection.e2e.ts "应该能够放大预览第二版角色面板且不被裁剪"`
  - 结果：通过。
- `$env:CODEX_MANAGED_BY_NPM='0'; node scripts/infra/run-e2e-single.mjs ci e2e/dicethrone/dicethrone-watch-out-spotlight.e2e.ts "mobile narrow viewport should keep magnify entries visible and clickable"`
  - 结果：通过。
- 说明：
  - 这两条 E2E 在当前 Windows / Codex 环境下需要绕开 `CODEX_MANAGED_BY_NPM=1` 触发的共享 runtime 隐藏启动分支，否则会卡在脚本层，不会真正进入用例。

## 当前轮截图

### 1. 选角页第二版玩家板放大成功截图

- 路径：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\character-selection.e2e\应该能够放大预览第二版角色面板且不被裁剪\samurai-v2-player-board-magnify-open.png`
- 人工观察：
  - 截图左上角文案已经是中文 `选择你的英雄`，右上角按钮为 `关闭预览`，说明这轮用例确实跑在中文环境下。
  - 武士第二版玩家板大图完整铺开在中间，左右边缘都还在视口内，没有出现旧版高图比例套用后常见的上下裁切。
  - 左侧英雄列表、右侧武士详情列和右上关闭按钮同时保留，可见放大层虽然更宽，但没有把周围 UI 顶出屏幕。

### 2. 局内窄屏主界面基线截图

- 路径：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-watch-out-spotlight.e2e\mobile-narrow-viewport-should-keep-magnify-entries-visible-and-clickable\10-mobile-main-board-state.png`
- 人工观察：
  - 左上是中文 `回合顺序`，右侧主操作按钮为 `确认`，说明局内链路也在中文 locale 下运行。
  - 在 `812x375` 的窄横屏里，左侧顺序栏、中央玩家板、右侧骰子列和弃牌堆区域同时可见，没有顶层横向溢出。
  - 玩家板右上角的放大入口按钮仍然可见且没有压到武士详情面板上，说明第二版 UI 微调后的按钮位置是可操作的。

### 3. 局内窄屏第二版玩家板放大成功截图

- 路径：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-watch-out-spotlight.e2e\mobile-narrow-viewport-should-keep-magnify-entries-visible-and-clickable\11-mobile-player-board-surface-magnify-open.png`
- 人工观察：
  - 武士第二版玩家板在局内放大后仍然完整显示，顶部缺口、左右技能卡列和底部终极技区域都在框内，没有被裁出屏幕。
  - 放大层打开后，左侧 `回合顺序`、右侧骰子列和确认按钮仍在后景可见，但没有遮住放大内容，说明 overlay 层级正确。
  - 放大框体明显是宽版比例，和选角页保持一致，不再沿用旧角色更高的 `2048 x 1673` 视觉框体。

### 4. 局内窄屏弃牌堆预览成功截图

- 路径：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-watch-out-spotlight.e2e\mobile-narrow-viewport-should-keep-magnify-entries-visible-and-clickable\14-mobile-discard-pile-inspect-open.png`
- 人工观察：
  - 右侧弃牌堆卡牌 `666!` 已经正常放大到前景中央，证明在第二版玩家板改宽之后，其他放大入口没有被兼容性改坏。
  - 中央大图和底部缩略卡能同时看到，对应的关闭返回链路仍然保留，说明预览层布局没有因为第二版玩家板调宽而发生错位。
  - 背景中的武士玩家板、右侧信息条和骰子列仍处于可理解位置，说明窄屏下整体布局关系保持稳定。

## 代码侧已落地的结构证据

- `src/games/dicethrone/ui/abilitySlotLayout.ts`
  - 新增 `v1 / v2` 双布局版本。
  - 显式声明 `gunslinger`、`samurai` 走 `v2`，旧角色继续走 `v1`。
  - 显式维护各角色玩家板尺寸，第二版角色使用 `2048 x 1254`、`2048 x 1248`。
  - 新增 `getPlayerBoardAspectRatio()`、`getPlayerBoardUiTuning()`，把比例和 UI 微调从“旧默认值”改成“按角色读取”。
- `src/games/dicethrone/ui/BoardOverlays.tsx`
  - 放大层不再写死 `aspect-[2048/1673]`。
  - 玩家板放大容器改为按 `viewCharacterId` 注入真实宽高比。
  - 放大时叠加升级卡的槽位也从统一旧布局切到按角色布局。
- `src/games/dicethrone/ui/AttackShowcaseOverlay.tsx`
  - 技能裁切和特写宽高比改为按角色真实面板比例计算，避免第二版技能槽继续套旧比率。
- `src/games/dicethrone/ui/CenterBoard.tsx`
  - 第二版玩家板应用单独 UI tuning：整体右移、玩家板上移、放大按钮下移。
- `src/games/dicethrone/ui/AbilityOverlays.tsx`
  - 调试布局编辑器切到 `allLayouts`，保存时同时提交 `v1 / v2`。
- `apps/api/src/modules/layout/layout.service.ts`
  - 布局保存文件生成逻辑升级为双版本输出，不会再把第二版布局直接写回旧的单数组格式。

## 结论

- 结构层面，这次改动已经把“第二版素材”和“旧版素材”显式隔离：
  - 角色到布局版本的映射是显式配置。
  - 放大比例、技能槽裁切、布局编辑保存都不再共用旧版默认值。
  - 第二版保存不会覆盖第一版素材布局。
- 自动化层面，本轮已拿到 3 类通过结果：
  - API 侧布局保存测试通过。
  - 选角页第二版玩家板放大 E2E 通过。
  - 局内窄屏玩家板放大 / 弃牌堆预览入口 E2E 通过。
- 本轮最终成功截图里，玩家板与卡牌资源都已实际渲染，不再是黑图或 `Preview` 占位，因此可以直接用肉眼验证中文文案、第二版宽图比例和实际未裁切状态。
- 本轮同时补了两类测试稳定性修正：
  - `e2e/dicethrone/character-selection.e2e.ts` 先重置残留对局存储，避免首页被“返回当前对局”弹窗劫持；同时把选角放大层改成按 overlay 开关态断言，而不是错误地期待 DOM 卸载。
  - `e2e/dicethrone/dicethrone-watch-out-spotlight.e2e.ts` 改成中文 locale，并把放大断言从脆弱的 `img[alt="Preview"]` 依赖切到真实放大内容容器，避免图片节点瞬态导致误报。
