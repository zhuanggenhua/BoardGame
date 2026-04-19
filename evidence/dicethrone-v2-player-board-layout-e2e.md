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
- `$env:CODEX_MANAGED_BY_NPM='0'; node scripts/infra/run-e2e-single.mjs ci e2e/character-selection.e2e.ts "应该能够放大预览第二版角色面板且不被裁剪"`
  - 结果：通过。
- `$env:CODEX_MANAGED_BY_NPM='0'; node scripts/infra/run-e2e-single.mjs ci e2e/dicethrone-watch-out-spotlight.e2e.ts "mobile narrow viewport should keep magnify entries visible and clickable"`
  - 结果：通过。
- 说明：
  - 这两条 E2E 在当前 Windows / Codex 环境下需要绕开 `CODEX_MANAGED_BY_NPM=1` 触发的共享 runtime 隐藏启动分支，否则会卡在脚本层，不会真正进入用例。

## 当前轮截图

### 1. 选角页第二版玩家板放大成功截图

- 路径：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\character-selection.e2e\应该能够放大预览第二版角色面板且不被裁剪\samurai-v2-player-board-magnify-open.png`
- 人工观察：
  - 截图左上角文案已经是中文 `选择你的英雄`，右上角按钮为 `关闭预览`，说明这轮用例确实跑在中文环境下。
  - 武士第二版玩家板大图完整铺开在中间，左右边缘都还在视口内，没有出现旧版高图比例套用后常见的上下裁切。
  - 左侧英雄列表、右侧武士详情列和右上关闭按钮同时保留，可见放大层虽然更宽，但没有把周围 UI 顶出屏幕。

### 2. 局内窄屏主界面基线截图

- 路径：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone-watch-out-spotlight.e2e\mobile-narrow-viewport-should-keep-magnify-entries-visible-and-clickable\10-mobile-main-board-state.png`
- 人工观察：
  - 左上是中文 `回合顺序`，右侧主操作按钮为 `确认`，说明局内链路也在中文 locale 下运行。
  - 在 `812x375` 的窄横屏里，左侧顺序栏、中央玩家板、右侧骰子列和弃牌堆区域同时可见，没有顶层横向溢出。
  - 玩家板右上角的放大入口按钮仍然可见且没有压到武士详情面板上，说明第二版 UI 微调后的按钮位置是可操作的。

### 3. 局内窄屏第二版玩家板放大成功截图

- 路径：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone-watch-out-spotlight.e2e\mobile-narrow-viewport-should-keep-magnify-entries-visible-and-clickable\11-mobile-player-board-magnify-open.png`
- 人工观察：
  - 武士第二版玩家板在局内放大后仍然完整显示，顶部缺口、左右技能卡列和底部终极技区域都在框内，没有被裁出屏幕。
  - 放大层打开后，左侧 `回合顺序`、右侧骰子列和确认按钮仍在后景可见，但没有遮住放大内容，说明 overlay 层级正确。
  - 放大框体明显是宽版比例，和选角页保持一致，不再沿用旧角色更高的 `2048 x 1673` 视觉框体。

### 4. 局内窄屏弃牌堆预览成功截图

- 路径：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone-watch-out-spotlight.e2e\mobile-narrow-viewport-should-keep-magnify-entries-visible-and-clickable\12-mobile-discard-pile-inspect-open.png`
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
  - `e2e/character-selection.e2e.ts` 先重置残留对局存储，避免首页被“返回当前对局”弹窗劫持；同时把选角放大层改成按 overlay 开关态断言，而不是错误地期待 DOM 卸载。
  - `e2e/dicethrone-watch-out-spotlight.e2e.ts` 改成中文 locale，并把放大断言从脆弱的 `img[alt="Preview"]` 依赖切到真实放大内容容器，避免图片节点瞬态导致误报。

## 2026-04-04 桌面回归复核

- 背景：
  - 用户反馈 `gunslinger` / `samurai` 在**游戏内桌面主界面**里的玩家板“显示过大，超出范围”。
  - 本次按回归问题流程，先回看最后正常证据，再对照当前代码补桌面视口验证。
- 最后正常证据：
  - 文档：本文档本身
  - 历史截图：
    - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone-watch-out-spotlight.e2e\mobile-narrow-viewport-should-keep-magnify-entries-visible-and-clickable\10-mobile-main-board-state.png`
    - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone-watch-out-spotlight.e2e\mobile-narrow-viewport-should-keep-magnify-entries-visible-and-clickable\11-mobile-player-board-surface-magnify-open.png`
- 本轮新增桌面回归用例：
  - 文件：`e2e/dicethrone-watch-out-spotlight.e2e.ts`
  - 用例：`desktop v2 player board should stay within normal gameplay width`
  - 命令：
    - `$env:CODEX_MANAGED_BY_NPM='0'; $env:BG_BYPASS_GLOBAL_HEAVY_BUDGET='1'; node scripts/infra/run-e2e-single.mjs ci e2e/dicethrone-watch-out-spotlight.e2e.ts "desktop v2 player board should stay within normal gameplay width"`
  - 结果：通过
- 本轮桌面截图：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone-watch-out-spotlight.e2e\desktop-v2-player-board-should-stay-within-normal-gameplay-width\15-desktop-v2-board-layout.png`
- 人工观察：
  - 武士玩家板现在明显更大，中央主视觉已经回到“玩家板优先”的占比，较旧版 `<= 0.48` 收敛方案更接近用户想要的宽板效果。
  - 玩家板与右侧提示板之间只保留一条很窄但仍清晰可见的缝，不再是此前偏保守的较宽留白，也没有重新贴死到提示板。
  - 右侧提示板、骰列、掷骰/确认按钮和底部弃牌堆仍完整可见，没有因为这轮放大玩家板而被压缩、挤飞或遮挡。
- 自动断言：
  - 桌面视口 `1365x768` 下，玩家板与提示板都必须完全留在视口内。
  - 玩家板宽度占视口比例必须落在 `0.495 ~ 0.515`，确保它比上一轮更大，但不会重新失控挤占右侧 HUD。
  - 玩家板与提示板之间必须保留 `> 0px` 且 `<= 8px` 的边界框间距，确保是“只留一点点”的紧凑关系，而不是重新拉开大空档或互相顶住。

## 2026-04-05 V2 布局紧凑化跟进

- 背景：
  - 用户继续反馈 `gunslinger / samurai` 的第二版布局还可以再收紧，明确要求“玩家面板和提示板间距只要一点点，让玩家面板大一点”。
- 本轮实现：
  - `src/games/dicethrone/ui/abilitySlotLayout.ts`
    - 把 `CenterBoard` 相关参数正式纳入 `v1 / v2` 的 UI tuning。
    - `v2` 新增 `tipBoardHeightVw: 29.6`、`centerBoardGapVw: 0.24`，保持 `v1` 完全不受影响。
  - `src/games/dicethrone/ui/CenterBoard.tsx`
    - 不再写死中央玩家板/提示板的统一高度与 gap。
    - 改为按角色版本读取 `playerBoardBaseHeightVw / tipBoardHeightVw / centerBoardGapVw`，让枪手/武士单独走更紧凑的双板关系。
  - `e2e/dicethrone-watch-out-spotlight.e2e.ts`
    - 把桌面 V2 回归断言改成“玩家板更大 + 缝隙更小”的新口径，而不是只验证“不超 0.48”。
- 本轮执行：
  - `$env:CODEX_MANAGED_BY_NPM='0'; $env:BG_BYPASS_GLOBAL_HEAVY_BUDGET='1'; node scripts/infra/run-e2e-single.mjs ci e2e/dicethrone-watch-out-spotlight.e2e.ts "desktop v2 player board should stay within normal gameplay width"`
  - 结果：通过
- 本轮主截图复核：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone-watch-out-spotlight.e2e\desktop-v2-player-board-should-stay-within-normal-gameplay-width\15-desktop-v2-board-layout.png`
  - 肉眼结论：
    - 中央武士玩家板横向占比确实比上一轮更饱满，八个技能槽与底部终极技区更接近“主屏主体”。
    - 提示板仍紧贴在玩家板右侧，但两者之间保留了一条细窄缝隙，视觉上已经是“只差一点点”，没有重新贴边或互相压住。
    - 右侧骰列、按钮和弃牌堆区仍保持完整纵向链路，说明这次优化解决的是中央双板比例，而不是靠牺牲右侧操作区换空间。

## 2026-04-05 V2 玩家板上抬 10% 跟进

- 背景：
  - 用户进一步明确，本轮要上抬的是 `v2` 的玩家面板本体，不是提示板。
- 本轮实现：
  - `src/games/dicethrone/ui/abilitySlotLayout.ts`
    - 将 `v2.playerBoardTranslateY` 从 `-1.45` 调整为 `-4.95`，等价于在当前 `35vw` 玩家板高度基线下额外上抬约 `10%` 面板高度。
- 本轮验证：
  - `$env:CODEX_MANAGED_BY_NPM='0'; $env:BG_BYPASS_GLOBAL_HEAVY_BUDGET='1'; node scripts/infra/run-e2e-single.mjs ci e2e/dicethrone-watch-out-spotlight.e2e.ts "desktop v2 player board should stay within normal gameplay width"`
  - 结果：通过
- 本轮截图观察：
  - 同一张 `15-desktop-v2-board-layout.png` 中，武士头部和上沿技能槽整体更贴近顶部头像栏下方，中央面板重心明显上移。
  - 顶部头像栏仍与玩家板保持安全距离，没有发生碰撞；底部手牌仍可完整展开，未被玩家板压没。
