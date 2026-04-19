# Summoner Wars 阵营选择界面移动端对齐 E2E 证据

- 日期：2026-04-17
- 目标：把手机横屏的阵营选择界面收回到更接近 PC 的构图，不再出现整体过小、下半区过低、预览区贴底，以及“开始/等待”操作区被玩家状态列挤扁的问题。
- 相关实现：
  - `src/games/summonerwars/ui/FactionSelectionAdapter.tsx`
  - `e2e/src/games/summonerwars/ui/FactionSelectionAdapter.tsx`
- 验证命令：
  - `npm run test:e2e:ci:file -- e2e/summonerwars/summonerwars-selection.e2e.ts "mobile landscape keeps faction selection aligned with pc composition"`
  - `npm run test:e2e:ci:file -- e2e/summonerwars/summonerwars-selection.e2e.ts "main flow enters match from faction selection"`

## 关键截图与观察

### 1. PC 基线：进入选择界面
- 路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\summonerwars\summonerwars-selection.e2e\main-flow-enters-match-from-faction-selection\selection-host-entry.png`
- 我实际看到：PC 端四列阵营卡占据主视觉中心，下方预览区与玩家状态区位于第二层，不贴底、不挤进第一层卡牌区。
- 判定：这是本轮对照的构图基线，重点是“上方阵营卡 + 下方预览/状态”两层结构清晰分离。

### 2. 手机横屏：进入选择界面
- 路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\summonerwars\summonerwars-selection.e2e\mobile-landscape-keeps-faction-selection-aligned-with-pc-composition\selection-phone-landscape-entry.png`
- 我实际看到：手机横屏下，阵营卡仍保持四列主区；下方预览占位框和玩家状态区已经上提，不再像之前那样整块沉到屏幕底边。
- 我实际看到：主舞台没有超出屏幕，左右仍留有边距；玩家状态区位于预览区右侧，而不是挤到卡牌区下面。
- 我实际看到：顶部黄色“等待对手加入...”横幅现在与标题主视觉中心基本对齐，不再像之前那样明显偏到右侧。
- 判定：达到“手机横屏仍保持与 PC 同层次构图”的验收标准；等待横幅也达到“与标题居中对齐”的验收标准。

### 3. 手机横屏：双方都选完后的界面
- 路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\summonerwars\summonerwars-selection.e2e\mobile-landscape-keeps-faction-selection-aligned-with-pc-composition\selection-phone-landscape-both-picked.png`
- 我实际看到：双方选中标记出现后，下方预览图已显示，预览区位于第二层中央偏左，玩家状态区位于其右侧，仍在屏幕内。
- 我实际看到：玩家状态区右侧新增独立操作列，`等待全员就绪` 按钮不再塞在玩家状态卡下方，按钮宽度足够，文案没有被压成窄条。
- 我实际看到：预览图底边仍贴近屏幕底部，但没有再被明显裁掉；玩家状态卡完整可见。此时顶部等待横幅已按状态正常消失，没有残留错位横幅。
- 判定：达到“双方选完后预览区、玩家状态区、右侧操作区仍可同时完整工作”的验收标准；等待横幅也没有在后续状态里残留错位。

## 结论

- 这轮修复聚焦的是移动端阵营选择舞台的缩放与下半区垂直布局，不碰 PC 分支。
- 修后手机横屏界面已更接近 PC：主卡牌区更大、下半区上提、舞台整体不再超出屏幕，等待横幅回到标题中心线附近，开始/等待按钮也改为右侧独立操作列。
- 本轮已通过两条 E2E：
  - `mobile landscape keeps faction selection aligned with pc composition`
  - `main flow enters match from faction selection`
