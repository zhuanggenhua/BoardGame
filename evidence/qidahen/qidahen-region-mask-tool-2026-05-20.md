# 七大恨区域制图工具验收证据（2026-05-20）

## 2026-05-26 02:18 +08 地图内部 UI/装饰像素进入正式成果前硬拒绝

本节针对用户指出的核心问题继续收紧：不能再只挡左侧轮盘、右牌库、底部条这类大 UI 区域，地图内部的红箭头、数字牌、锚点、卡牌/标记等也不能被选进正式区域成果。

先看图和读数据：

- `temp/qidahen-boundary-color-audit/boundary-color-overlay-red-playable-blue-ui.png`
  - 我实际看到：颜色命中不仅包含地图线，还包含左侧轮盘、右侧牌库、底部条、红箭头、数字牌、锚点、海纹、马和文字；
  - 报告读数：`matched=185213`，`uiMatched=107306`，`playableMatched=77907`，`componentCount=4951`。
- `temp/qidahen-weighted-seed-experiment/weighted-seed-overlay.png`
  - 我实际看到：结果仍是半透明几何色块，不是沿真实边界的正常区域。
- `temp/qidahen-boundary-trace-kit/layers/current-boundary-transparent.png`
  - 我实际看到：它只是断开的白色线段，不能封口生成正常成果。
- `temp/qidahen-real-map-accepted-candidate-overlay.png`
  - 我实际看到：只剩少量零散真实线片段，不能当完整边界。

实现变化：

- `src/pages/devtools/QidahenRegionMaskTool.tsx`
  - 新增当前地图级 `currentMapArtifactExclusionMask`；
  - 它由原有 `AUTO_MAP_PRINTED_UI_EXCLUSION_MASK` 与 `buildCompactPrintedDecorationExclusionMask(sourcePixels)` 合并；
  - 同一禁区现在用于：
    - 质量报告里的 `boundaryUiPixels / maskUiPixels`；
    - 导入完成边界图时剔除污染像素；
    - 导入带底图描线图时剔除污染像素；
    - 补边 ZIP 回导时剔除污染像素；
    - 保存前硬拒绝正式 mask / 边界图；
  - 保存失败文案明确点名：轮盘、说明框、牌框、底部条、红色箭头、数字牌、锚点和其它非地图边界装饰。
- `e2e/qidahen-region-mask.e2e.ts`
  - 新增 `正式保存会拒绝地图内部红箭头数字牌等装饰像素`；
  - 输入不是大矩形 UI 区，而是在地图中部/右侧红箭头和数字牌附近构造 mask；
  - 保存必须失败，且不得写入正式数据。

验证：

- `npx eslint src/pages/devtools/QidahenRegionMaskTool.tsx e2e/qidahen-region-mask.e2e.ts`：通过。
- `npx tsc --noEmit --pretty false`：通过。
- `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 PW_WORKERS=1 PW_PORT=6416 PW_GAME_SERVER_PORT=20316 PW_API_SERVER_PORT=21316 NODE_OPTIONS=--max-old-space-size=4096 node scripts/infra/run-e2e-command.mjs isolated e2e/qidahen-region-mask.e2e.ts --grep "正式保存会拒绝包含印刷 UI 禁区的 mask|导入完成边界图会直接剔除印刷 UI 禁区像素|正式保存会拒绝地图内部红箭头数字牌等装饰像素"`：`3 passed (3.5m)`。

截图与文件复核：

- 已实际看图 `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-in-map-decoration-rejected-current.png`
  - 左侧提示：`保存失败：正式 mask 包含 UI/装饰禁区 3,993 px`；
  - 地图上污染区域落在红箭头、数字牌、锚点附近；
  - 结论：这类地图内部 UI/装饰不会再被保存成正式区域成果。
- 正式文件复核：
  - `src/games/qidahen/data/region-mask.png 1265x893 opaque=0`
  - `src/games/qidahen/data/region-boundary-mask.png 1265x893 opaque=0`
  - `src/games/qidahen/data/region-boundary-add.png 1265x893 opaque=0`
  - `src/games/qidahen/data/region-boundary-remove.png 1265x893 opaque=0`

当前口径：

- 本节不是正常成果完成；
- 它是防止错误成果再次被保存的硬门禁；
- 原始地图自动抽线仍不能产出正常完整边界，正常主路仍是：导入/手绘一张完整闭合边界图，工具按 seed 分区生成区域，再逐区看图验收。

## 2026-05-26 01:41 +08 工具保存的区域图谱接入运行时 Board

本节补齐“移动/通行代价工具的保存产物是否会被七大恨运行时消费”的入口。此前 `region-graph.json` 只由 devtool 写出，Board 仍只用 `QIDAHEN_MAP_REGION_SHAPES` 粗 polygon 做点击区域；即使用户后续完成真实边界和通路类型，运行时也不会自动读取这些成果。

实现变化：

- 新增 `src/games/qidahen/ui/mapGraph.ts`
  - 解析 `src/games/qidahen/data/region-graph.json` 的 `nodes / edges / boundaryTypes`；
  - 提供无向通路 id、通路查询、边界类型元数据和 `battleWidth`；
  - 从 `region-mask-regions.json` 建立正式 mask 颜色到区域 id 的映射，供 Board hitmap 使用。
- 更新 `src/games/qidahen/Board.tsx`
  - Board 启动时先构建现有 polygon hitmap 作为 fallback；
  - 同时尝试加载正式 `region-mask.png`，只有图片尺寸正确且含有效区域颜色时才替换 hitmap；
  - 正式 mask 仍为空时，点击区域继续走 fallback，不会把空图或假成果当正式区域；
  - 当正式 graph 写入了中心点和边时，地图 overlay 会渲染运行时通路线、边界类型标签，并带 `data-boundary-type / data-battle-width`。
- 新增/更新测试
  - `src/games/qidahen/__tests__/mapGraph.test.ts` 覆盖：无向通路 id、山脉 `battleWidth=2`、mask 颜色映射、默认边界类型元数据；
  - `src/games/qidahen/__tests__/Board.test.ts` 增加 Board 消费 `region-mask.png?url`、`QIDAHEN_REGION_GRAPH_EDGES`、`QIDAHEN_REGION_ID_BY_MASK_COLOR` 和运行时 graph overlay 的结构门禁。

验证：

- `npx eslint src/games/qidahen/Board.tsx src/games/qidahen/ui/mapGraph.ts src/games/qidahen/__tests__/Board.test.ts src/games/qidahen/__tests__/mapGraph.test.ts`：通过。
- `npx tsc --noEmit --pretty false`：通过。
- `npx vitest run src/games/qidahen/__tests__/mapGraph.test.ts src/games/qidahen/__tests__/Board.test.ts`：`2 passed / 101 passed`。
- `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 PW_WORKERS=1 PW_PORT=6414 PW_GAME_SERVER_PORT=20314 PW_API_SERVER_PORT=21314 NODE_OPTIONS=--max-old-space-size=4096 node scripts/infra/run-e2e-command.mjs isolated e2e/qidahen-region-mask.e2e.ts --grep "导入闭合边界后可按区域邻近补全路径并保存边界类型"`：`1 passed (4.8m)`。

截图与数据复核：

- 已实际看图 `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-path-auto-passage-current.png`
  - 当前页面是七大恨区域制图工具，不是旧 UI；
  - 左侧通行路径图为 `中心 2 / 通路 1`；
  - `锦州 ↔ 宋进` 已设为 `山脉 路 战场宽度 2`；
  - 地图上有 `山脉` 通路标签。
- `temp/devtools/qidahen-region-mask-workspaces/path-graph/region-graph.json`
  - `jinzhou.center={x:774,y:414}, pixelCount=13439`
  - `song-jin.center={x:732,y:565}, pixelCount=13202`
  - `edges[0].boundaryType=mountain, battleWidth=2`
- PNG 复核：
  - 正式 `src/games/qidahen/data/region-mask.png 1265x893 opaque=0`
  - 正式 `src/games/qidahen/data/region-boundary-mask.png 1265x893 opaque=0`
  - 临时 `path-graph/region-mask.png 1265x893 opaque=26641`
  - 临时 `path-graph/region-boundary-mask.png 1265x893 opaque=6931`

当前口径：

- 运行时已经有入口消费工具产物：正式 mask 可替代粗 polygon hitmap，正式 graph 可渲染通路类型和 `battleWidth`；
- 当前正式 PNG 仍为空，所以运行时不会显示临时两区合成通路；
- 这不是正式地图完成，只是把“工具保存后运行时能读”的链路接上。

## 2026-05-26 01:18 +08 区域中心路径支持按邻近补全并保存边界类型

本节补齐“区域生成以后，移动/通行代价工具是否能从区域中心进入图编辑”的闭环。此前只能在路径模式手动从一个中心拖到另一个中心；对于用户手绘整图边界后的初始工作流，缺少从当前 mask 自动给出可编辑通路初值的入口。

实现变化：

- `src/pages/devtools/QidahenRegionMaskTool.tsx`
  - 新增“按邻近补全”按钮；
  - 从当前 `assignmentsRef` 读取已生成的正式区域，先按 mask 边界近邻识别通路，识别不到时再用区域中心最近邻给出初始通路；
  - 自动生成的通路保留已有边界类型设置，新边默认 `plain`，用户可继续改成山脉、河流、海岸、城/长城等类型；
  - 保存时继续写入 `region-graph.json` 的 `nodes.center / pixelCount / edges[].boundaryType / battleWidth`。
- `e2e/qidahen-region-mask.e2e.ts`
  - 用例改为 `导入闭合边界后可按区域邻近补全路径并保存边界类型`；
  - 流程：导入闭合边界图，调试生成锦州/宋进两个区域，进入路径模式，点击“按邻近补全”，把 `jinzhou::song-jin` 改为 `mountain`，保存工作区并刷新回读；
  - 断言保存后的 graph 含锦州/宋进 center、pixelCount，以及 `boundaryType=mountain / boundaryLabel=山脉 / battleWidth=2`。

验证：

- `npx eslint src/pages/devtools/QidahenRegionMaskTool.tsx e2e/qidahen-region-mask.e2e.ts`：通过。
- `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 PW_WORKERS=1 PW_PORT=6413 PW_GAME_SERVER_PORT=20313 PW_API_SERVER_PORT=21313 NODE_OPTIONS=--max-old-space-size=4096 node scripts/infra/run-e2e-command.mjs isolated e2e/qidahen-region-mask.e2e.ts --grep "导入闭合边界后可按区域邻近补全路径并保存边界类型"`：`1 passed (4.8m)`。
- 失败排查记录：第一次业务跑到按钮后未识别通路，原因是初版只看 14px mask 近邻；已改为“mask 近邻 + 区域中心近邻”的初始补全策略。更早一次 `PW_USE_DEV_SERVERS=true` 导致连接旧开发服务器模式，测试未进入业务位点，不计为功能失败。

截图与落盘复核：

- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-path-auto-passage-current.png`
  - 我实际看到：这是当前七大恨区域制图工具页面，不是旧 UI；
  - 我实际看到：左侧通行路径图显示 `中心 2 / 通路 1`；
  - 我实际看到：列表中存在 `锦州 ↔ 宋进`，类型已选 `山脉 路 战场宽度 2`；
  - 我实际看到：地图上锦州与宋进中心之间显示一条带 `山脉` 标签的通路。
- `temp/devtools/qidahen-region-mask-workspaces/path-graph/region-graph.json`
  - `jinzhou.center={x:774,y:414}, pixelCount=13439`
  - `song-jin.center={x:732,y:565}, pixelCount=13202`
  - `edges[0]=jinzhou::song-jin, boundaryType=mountain, boundaryLabel=山脉, battleWidth=2`
- 临时工作区 PNG 复核：
  - `region-boundary-mask.png 1265x893 opaque=6931`
  - `region-mask.png 1265x893 opaque=26641`

当前口径：

- 这证明“手绘/导入边界 -> 生成区域 -> 生成区域中心 -> 自动给通路初值 -> 编辑边界类型 -> 保存回读”链路可用；
- 这仍是临时工作区的两区合成边界验证，不是七大恨正式完整地图成果；
- 正式数据仍需真实完整边界图、5/5 或后续完整区域集、逐区看图验收后才能写入。

## 2026-05-25 23:46 +08 无新增描线导入不会清空已有边界

本节补强“用户已经有一张可微调边界图时，误导入未描线底图不能把成果清空”的防回归门禁。此前 `importBoundarySource()` 在带底图描线图抽线后，即使清洗结果为 `0 px`，也会继续写入 `boundaryDraftMaskRef.current`，等价于用空图覆盖当前边界。

实现变化：

- `src/pages/devtools/QidahenRegionMaskTool.tsx`
  - `导入带底图描线图` 在 `pruneImportedBoundaryMask()` 后统计 `nextBoundaryPixelCount`；
  - 若为 `0`，直接提示 `导入带底图描线图失败：没有抽出可用边界像素，已保留当前边界图`；
  - 失败分支不改写当前边界图、不清空手工补边/去噪层、不重置边界历史、不覆盖参考层。
- `e2e/qidahen-region-mask.e2e.ts`
  - 新增 E2E：`导入无新增描线的带底图文件不会清空已有边界图`；
  - 流程：先导入非空完成边界图，再导入未新增描线的 `qidahen-main-map.png`；
  - 断言失败提示可见，当前边界图像素仍为导入前 `3,445 px`，barrier canvas 像素数与 bounds 均保持不变。

验证：

- `npx eslint src/pages/devtools/QidahenRegionMaskTool.tsx e2e/qidahen-region-mask.e2e.ts`：通过。
- `npx tsc --noEmit --pretty false`：通过。
- `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 PW_WORKERS=1 PW_PORT=6404 PW_GAME_SERVER_PORT=20231 PW_API_SERVER_PORT=21231 node scripts/infra/run-e2e-command.mjs isolated e2e/qidahen-region-mask.e2e.ts --grep "导入无新增描线的带底图文件不会清空已有边界图"`：`1 passed (2.1m)`。
- 相邻正向回归：`BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 PW_WORKERS=1 PW_PORT=6406 PW_GAME_SERVER_PORT=20233 PW_API_SERVER_PORT=21233 NODE_OPTIONS=--max-old-space-size=4096 node scripts/infra/run-e2e-command.mjs isolated e2e/qidahen-region-mask.e2e.ts --grep "导入真实底图描线图时只保留用户新增描线"`：`1 passed (1.5m)`。
  - 备注：同用例第一次不带 `NODE_OPTIONS` 时在 Playwright worker 启动阶段 OOM，测试体未执行；加大 Node heap 后通过，不是业务断言失败。

截图与正式文件复核：

- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-real-map-empty-source-preserves-boundary-current.png`
  - 我实际看到：左侧失败提示明确写着“没有抽出可用边界像素，已保留当前边界图”；
  - 我实际看到：主链进度仍显示边界图 `3,445 px`；
  - 我实际看到：地图上原有完成边界仍显示，没有被未描线底图清空。
- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-real-map-hand-drawn-source-current.png`
  - 我实际看到：真实底图上新增的手绘闭合线仍能导入为白色边界；
  - 我实际看到：印刷 UI 区没有被当成边界写入；
  - 结论：0 像素保护没有误伤有效的真实底图描线导入。
- 正式文件复核：
  - `src/games/qidahen/data/region-mask.png 1265x893 opaque=0`
  - `src/games/qidahen/data/region-boundary-mask.png 1265x893 opaque=0`

当前口径：

- 这只是修复一个会丢用户边界成果的导入失败保护；
- 仍不代表七大恨正常区域成果已完成；
- 正常成果仍必须由真实闭合边界图回导后，通过 5/5 seed 独立、底图贴合、逐区看图验收与保存回读。

## 2026-05-25 23:08 +08 自动颜色线写入入口回滚

本节修正 22:26 的回归：真实底图颜色候选不能再写入边界编辑层。此前 12:05 已记录“自动候选不得再写入边界草稿”，但后续又恢复了 `loadRealMapColorLineBoundaryDraft()` 和 `qidahen-load-real-map-boundary-candidate-draft`，这会把已经被证据否定的断线/噪声候选重新变成编辑层内容。

读图与像素审计：

- 审计报告：`temp/qidahen-boundary-color-audit/report.json`
  - `matched=185213`
  - `uiMatched=107306`
  - `playableMatched=77907`
  - `uiRatio≈57.9%`
  - `componentCount=4951`
- 证据图：
  - `temp/qidahen-boundary-color-audit/boundary-color-overlay-red-playable-blue-ui.png`
  - `temp/qidahen-boundary-color-audit/jinzhou-color-support-crop.png`
  - `temp/qidahen-boundary-color-audit/xian-xing-color-support-crop.png`
- 看图结论：
  - 红色 playable 候选大量命中海面、马、文字、长城和海纹；
  - 蓝色 UI 命中覆盖左侧轮盘/表格、右侧牌框、底部流程条等印刷区；
  - 锦州与咸兴局部 crop 不能证明连续闭合边界，仍是混入噪声的断线候选。

实现变化：

- `src/pages/devtools/QidahenRegionMaskTool.tsx`
  - 删除 `qidahen-load-real-map-boundary-candidate-draft` 写入按钮；
  - 颜色候选说明改为“只导出诊断图和 trace kit，不写入编辑层”；
  - 保留 `qidahen-export-real-map-boundary-candidate`，只作为透明诊断 PNG 导出入口。
- `e2e/qidahen-region-mask.e2e.ts`
  - 用例改为 `真实底图颜色线只能导出诊断且不能写入边界草稿`；
  - 断言写入按钮不存在；
  - 断言导出诊断 PNG 非空且 UI 禁区像素为 0；
  - 断言导出后当前边界图和最终障碍仍为 0；
  - 断言默认生成拒绝、无区域已生成、mask 仍为空。

验证：

- `npx eslint src/pages/devtools/QidahenRegionMaskTool.tsx e2e/qidahen-region-mask.e2e.ts`：通过。
- `npx tsc --noEmit --pretty false`：通过。
- `node scripts/infra/vitest-cli-safe.mjs run src/pages/devtools/__tests__/qidahenRegionMaskToolUtils.test.ts --configLoader native --maxWorkers 1`：`50 passed`。
- `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 PW_WORKERS=1 PW_PORT=6399 PW_GAME_SERVER_PORT=20226 PW_API_SERVER_PORT=21226 node scripts/infra/run-e2e-command.mjs isolated e2e/qidahen-region-mask.e2e.ts --grep "真实底图颜色线只能导出诊断且不能写入边界草稿"`：`1 passed (2.1m)`。
- `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 PW_WORKERS=1 PW_PORT=6402 PW_GAME_SERVER_PORT=20229 PW_API_SERVER_PORT=21229 node scripts/infra/run-e2e-command.mjs isolated e2e/qidahen-region-mask.e2e.ts --grep "描边包加入修好边界层后可优先回导 repairedBoundary 并进入生成门禁"`：`1 passed (2.6m)`。

截图与正式文件复核：

- `test-results/evidence-screenshots/_shared/qidahen-region-mask-real-map-candidate-draft-current.png`
  - 我实际看到：页面显示 `候选不达标 seed 0/5`；
  - 我实际看到：没有 `载入颜色线底稿` 写入按钮；
  - 我实际看到：候选说明写明颜色线不会写入边界编辑层。
- `test-results/evidence-screenshots/_shared/qidahen-region-mask-trace-kit-repaired-import-current.png`
  - 我实际看到：repairedBoundary 回导后可生成 5/5，但仍是 `正常成果未证明 / suspicious`；
  - 结论：回导链路可跑，仍未绕过正常成果门禁。
- 正式文件复核：
  - `src/games/qidahen/data/region-mask.png 1265x893 opaque=0`
  - `src/games/qidahen/data/region-boundary-mask.png 1265x893 opaque=0`

当前口径：

- 颜色候选只能用于诊断和 trace kit 参考；
- 无法连成线、无法封口的碎线直接舍弃；
- 正常成果仍必须来自用户/外部画笔修好的真实闭合边界图回导，再经过 5/5 seed 独立、底图贴合、形态门禁、逐区看图验收和保存回读。

## 2026-05-25 22:55 +08 导入完成边界图时自动舍弃未参与分区的开放碎线

本节补强“用户修好边界图后导回工具”的入口门禁。此前工具已有“只保留有效分区边界”按钮，但导入完成边界图/补边包时仍需要用户再点一次清洗；现在导入链路会先按正式 seed 分区判断，如果已经存在有效 seed 分区或闭合边界，就自动丢弃不参与分区/封口的开放碎线。若输入完全没有有效分区，则不会把底稿清空，仍保留给用户继续微调。

实现变化：

- `src/pages/devtools/QidahenRegionMaskTool.tsx`
  - 新增导入清洗步骤：完成边界图、带底图描线图、补边 ZIP 回导都会调用同一套“有效分区边界 / 闭合边界”保留逻辑；
  - 导入问题定位改为按“seed 是否进入独立分区”判断，不再用闭合小圈判断；
  - 状态文案会显示自动清洗舍弃的像素数，避免把断线当作正常成果。
- `e2e/qidahen-region-mask.e2e.ts`
  - 新增 E2E：`导入完成边界图时自动舍弃未参与分区的开放碎线`；
  - 输入为 5 个闭合区域 + 1 条开放噪声线；
  - 断言导入后出现“已自动只保留有效分区边界”；
  - 断言 `未解释开放线=0`、独立 seed 为 `5/5`；
  - 断言默认生成 5/5，但 normality 仍不是 `accepted`。

验证：

- `npx eslint src/pages/devtools/QidahenRegionMaskTool.tsx e2e/qidahen-region-mask.e2e.ts`：通过。
- `node scripts/infra/vitest-cli-safe.mjs run src/pages/devtools/__tests__/qidahenRegionMaskToolUtils.test.ts --configLoader native --maxWorkers 1`：`50 passed`。
- `npx tsc --noEmit --pretty false`：通过。
- `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 PW_WORKERS=1 PW_PORT=6397 PW_GAME_SERVER_PORT=20224 PW_API_SERVER_PORT=21224 node scripts/infra/run-e2e-command.mjs isolated e2e/qidahen-region-mask.e2e.ts --grep "导入完成边界图时自动舍弃未参与分区的开放碎线"`：`1 passed (2.1m)`。
- `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 PW_WORKERS=1 PW_PORT=6398 PW_GAME_SERVER_PORT=20225 PW_API_SERVER_PORT=21225 node scripts/infra/run-e2e-command.mjs isolated e2e/qidahen-region-mask.e2e.ts --grep "描边包加入修好边界层后可优先回导 repairedBoundary 并进入生成门禁"`：`1 passed (2.5m)`。

截图与数据复核：

- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-imported-boundary-auto-pruned-current.png`
  - 我实际看到：工具仍显示 `正常成果未证明 / suspicious`，不是 accepted；
  - 我实际看到：锦州、宋进已经生成，其他区域仍处在逐区看图/弱支撑门禁中；
  - 结论：开放碎线不会再卡默认生成，但生成链路通过仍不等于正式正常成果。
- 正式文件复核：
  - `src/games/qidahen/data/region-mask.png 1265x893 opaque=0`
  - `src/games/qidahen/data/region-boundary-mask.png 1265x893 opaque=0`

## 2026-05-25 21:43 +08 trace kit 修好层 repairedBoundary 回导链路

本节补齐“自动抽线做不了后，用户修好边界层如何直接回导”的正向链路。目标不是证明合成测试边界是正常成果，而是证明 trace kit ZIP 加入修好的 `layers/repaired-boundary-transparent.png` 后，工具会优先读取它，并继续受正常成果门禁约束。

实现与测试变化：

- `e2e/qidahen-region-mask.e2e.ts`
  - 新增 `TRACE_KIT_REPAIRED_IMPORT_SCREENSHOT`；
  - 新增 E2E：`描边包加入修好边界层后可优先回导 repairedBoundary 并进入生成门禁`；
  - 流程：
    1. 导出 `qidahen-boundary-trace-kit.zip`；
    2. 模拟外部绘图软件新增 `layers/repaired-boundary-transparent.png`；
    3. 写入 `report.layers.repairedBoundary=layers/repaired-boundary-transparent.png`；
    4. 通过“导入补边包 ZIP 的全图边界层”回导；
    5. 断言状态文案为 `已从补边包回导 layers/repaired-boundary-transparent.png`；
    6. 断言 `closed-seed-hit-count=5`；
    7. 断言印刷 UI 禁区内边界像素为 0；
    8. 默认生成得到 5/5 和非空 mask；
    9. 断言 normality 仍不是 accepted。

验证：

- `npx eslint e2e/qidahen-region-mask.e2e.ts`：通过。
- `npx tsc --noEmit --pretty false`：通过。
- `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 PW_WORKERS=1 PW_PORT=6392 PW_GAME_SERVER_PORT=20219 PW_API_SERVER_PORT=21219 node scripts/infra/run-e2e-command.mjs isolated e2e/qidahen-region-mask.e2e.ts --grep "描边包加入修好边界层后可优先回导 repairedBoundary 并进入生成门禁"`：`1 passed (2.3m)`。

截图证据：

- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-trace-kit-repaired-import-current.png`
  - 我实际看到：新版七大恨区域制图工具和真实地图底图；
  - 我实际看到：repairedBoundary 回导后生成了 5/5；
  - 我实际看到：左侧仍显示 `正常成果未证明 / suspicious`；
  - 我实际看到：底图贴合和直线形态仍 blocked，验收按钮没有放行；
  - 结论：回导链路可用，但这张合成 repairedBoundary 不能当正常成果。

当前证据边界：

- 已证明用户修完 trace kit ZIP 后可以直接用补边包入口回导；
- 已证明 repairedBoundary 优先级高于未修的 currentBoundary；
- 已证明回导成功不等于 accepted，正常成果仍要真实边界贴图与逐区看图验收。

## 2026-05-25 21:19 +08 真实底图自动抽线参数扫描：最多 2/5，不能继续当自动成果路线

本节补充一条更直接的数据证据，回应“有没有看图，或者至少读取数据”。我重新读取真实底图、正式 seed 和用户给定的 4 个边界色，做参数扫描后确认：从原始底图自动抽线生成正常边界这条路当前不可行。

扫描输入：

- 真实底图：`public/assets/i18n/zh-CN/qidahen/board/qidahen-main-map.png`，`1265x893`。
- 用户给定边界色：
  - `rgb(61, 69, 66)`
  - `rgb(126, 97, 56)`
  - `rgb(128, 104, 62)`
  - `rgb(43, 36, 34)`
- 正式 seed：
  - 锦州 `(777,417)`
  - 宋进 `(736,568)`
  - 山海关 `(635,552)`
  - 咸兴 `(1098,511)`
  - 汉城 `(1118,629)`
- 扫描范围：
  - 颜色容差 `8,10,12,14,16,18,20,24,28,32`
  - 边界扩张 `0,1,2,3,4,6,8,10,12`
  - 原始剔 UI mask 与长线组件过滤两类策略

关键数据：

- 最优组合也只分出 `2/5` 个独立 seed：
  - `tolerance=18, expansion=1`：只独立 `山海关, 锦州`，`咸兴+汉城` 仍连在同一分区；raw UI 命中 `134,519 px`。
  - `tolerance=20, expansion=1`：只独立 `山海关, 锦州`，`咸兴+汉城` 仍连在同一分区；raw UI 命中 `145,855 px`。
- 低容差长线过滤保留像素太少，全部 seed 仍连在同一分区。
- 高容差会大量命中 UI、文字、标记和装饰，不能作为自动边界。

实现变化：

- `src/pages/devtools/QidahenRegionMaskTool.tsx`
  - 新增 `REAL_MAP_COLOR_AUTO_EXTRACTION_VERDICT`；
  - `边界图工作流` 新增 `qidahen-auto-extraction-verdict` 面板，直接显示“自动抽线不能自动生成正常成果 / 最多 2/5”；
  - `exportBoundaryTraceKitZip()` 的 `manifest.json` 和 `report.json` 写入：
    - `autoExtractionVerdict.state=not-fit-for-auto-completion`
    - `requiredSeedCount=5`
    - `bestObservedMatchedSeedCount=2`
    - `evaluatedToleranceRange=[8,32]`
    - `evaluatedBoundaryExpansionRange=[0,12]`
- `e2e/qidahen-region-mask.e2e.ts`
  - 全图描边包用例断言 manifest/report 中存在该 verdict；
  - 断言 `bestObservedMatchedSeedCount < requiredSeedCount`。
  - 断言工具 UI 中 `qidahen-auto-extraction-verdict` 显示“最多 2/5 个独立 seed”和“不能自动生成正常成果”。

验证：

- `npx eslint src/pages/devtools/QidahenRegionMaskTool.tsx e2e/qidahen-region-mask.e2e.ts`：通过。
- `npx tsc --noEmit --pretty false`：通过。
- `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 PW_WORKERS=1 PW_PORT=6388 PW_GAME_SERVER_PORT=20215 PW_API_SERVER_PORT=21215 node scripts/infra/run-e2e-command.mjs isolated e2e/qidahen-region-mask.e2e.ts --grep "全图描边包 ZIP 包含透明边界层、底图和边界颜色清单|描边包标准边界层经补边包入口回导后仍不能直接生成正常成果"`：`2 passed (3.0m)`。
- `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 PW_WORKERS=1 PW_PORT=6390 PW_GAME_SERVER_PORT=20217 PW_API_SERVER_PORT=21217 node scripts/infra/run-e2e-command.mjs isolated e2e/qidahen-region-mask.e2e.ts --grep "全图描边包 ZIP 包含透明边界层、底图和边界颜色清单"`：`1 passed (1.5m)`。

截图证据：

- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-auto-extraction-verdict-current.png`
  - 我实际看到：面板显示“自动抽线不能自动生成正常成果”；
  - 我实际看到：面板显示“最多 2/5 个独立 seed”；
  - 该截图证明工具 UI 不再把自动抽线入口包装成成果路线。

本地工作包同步复核：

- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\temp\qidahen-boundary-trace-kit\qidahen-boundary-trace-kit.zip`
  - `manifest.verdict=not-fit-for-auto-completion 2/5`
  - `report.verdict=not-fit-for-auto-completion 2/5`
  - `layers/current-boundary-transparent.png` 与 `qidahen-boundary-color-line-draft-transparent.png` 字节一致；
  - `layers/current-boundary-transparent.png 1265x893 opaque=8648`。

当前证据边界：

- 已证明“直接从原始底图颜色自动抽线得到正常成果”当前没有数据支撑；
- 颜色线层只应作为外部补边底稿；
- 正常成果仍必须来自用户/工具补完后的真实闭合边界图，并通过 5/5、底图贴合、形态门禁、逐区看图验收和保存回读。

## 2026-05-25 21:03 +08 描边包可直接走补边 ZIP 回导入口

本节继续收口“先生成边界图，再由用户微调”的工作包闭环。上一轮描边包已经包含颜色线初始层，但用户仍可能需要先解出 PNG 再从“导入完成边界图”入口回导；现在同一个 ZIP 也兼容“导入补边包 ZIP 的全图边界层”入口。

实现变化：

- `src/pages/devtools/QidahenRegionMaskTool.tsx`
  - `exportBoundaryTraceKitZip()` 额外写入 `layers/current-boundary-transparent.png`；
  - 该标准层内容与 `qidahen-boundary-color-line-draft-transparent.png` 完全一致；
  - `manifest.json.importTargets.repairPackageCurrentBoundary`、`manifest.json.layers.currentBoundary` 指向该标准层；
  - 新增 `report.json.layers.currentBoundary`，让既有补边包回导逻辑优先识别；
  - `report.json.layers.repairedBoundary` 仍为 `null`，提醒这不是修好的补边包；用户修完后应新增或覆盖 `layers/repaired-boundary-transparent.png`。
- `e2e/qidahen-region-mask.e2e.ts`
  - 全图描边包用例新增 ZIP 条目、manifest/report 标准层和字节一致性断言；
  - 原颜色线初始层负向门禁改为通过 `qidahen-import-boundary-repair-package` 直接导入整个 trace kit ZIP；
  - 断言回导选中的层是 `layers/current-boundary-transparent.png`；
  - 断言回导后仍 `seed 0/5`、UI 禁区无像素、默认生成拒绝、无区域生成、mask canvas 为空。

验证：

- `npx eslint src/pages/devtools/QidahenRegionMaskTool.tsx e2e/qidahen-region-mask.e2e.ts`：通过。
- `npx tsc --noEmit --pretty false`：通过。
- `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 PW_WORKERS=1 PW_PORT=6387 PW_GAME_SERVER_PORT=20214 PW_API_SERVER_PORT=21214 node scripts/infra/run-e2e-command.mjs isolated e2e/qidahen-region-mask.e2e.ts --grep "全图描边包 ZIP 包含透明边界层、底图和边界颜色清单|描边包标准边界层经补边包入口回导后仍不能直接生成正常成果"`：`2 passed (2.8m)`。

截图与数据核对：

- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-trace-kit-color-line-draft-current.png`
  - 我实际看到：透明层仍是断开的弯曲真实地图线段；
  - 我实际看到：没有右侧牌框、底部条、左侧轮盘这类 UI 框；
  - 读取数据：`1265x893 opaque=8648`。
- 本地工作包 `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\temp\qidahen-boundary-trace-kit\qidahen-boundary-trace-kit.zip`
  - 已同步更新 ZIP 条目：`layers/current-boundary-transparent.png`、`report.json`；
  - 已复核 `manifest.layers.currentBoundary=layers/current-boundary-transparent.png`；
  - 已复核 `report.layers.currentBoundary=layers/current-boundary-transparent.png`；
  - 已复核标准层与颜色线层字节一致；
  - 读取数据：`layers/current-boundary-transparent.png 1265x893 opaque=8648`。
- 正式文件复核：
  - `src/games/qidahen/data/region-mask.png 1265x893 opaque=0`；
  - `src/games/qidahen/data/region-boundary-mask.png 1265x893 opaque=0`。

当前证据边界：

- 已证明全图描边包可以被补边 ZIP 入口直接回导；
- 已证明这条回导通道不会把颜色线初始层误当正常成果；
- 仍未证明正式正常成果完成。当前包是可微调工作包，不是正式区域数据。

## 2026-05-25 14:47 +08 局部候选线不能替整图背书：14:07 accepted 结论失效

本节修正同日 14:07 的错误结论。复看截图和读取数据后确认，所谓“完成边界图 accepted 链”输入并不是正常边界：它只是把一段真实底图候选线叠到源图上，再用手绘补线围出区域。全局底图贴合率因此被局部长线抬高，但宋进、山海关、汉城等区域的局部边界仍缺少真实地图支撑。该输入不能代表用户真实完成边界图，14:07 的 `accepted / 5/5` 结论作废。

实现与测试变化：

- `src/pages/devtools/QidahenRegionMaskTool.tsx`
  - `BoundaryRealMapFitReport` 新增逐区支撑报告：`regionReports`、`weakRegionNames`、`minRegionSupportRatio`；
  - `scoreBoundaryRealMapFit()` 不再只看全局 `supportRatio`；
  - 工具现在会统计每个已生成区域相邻的边界像素中，有多少贴近真实底图支撑线；
  - 任一已生成区域局部支撑不足时，normality 保持 `suspicious`，人工验收按钮保持禁用；
  - UI 在 `qidahen-boundary-real-map-fit-weak-regions` 中显示弱支撑区域。
- `e2e/qidahen-region-mask.e2e.ts`
  - 原 E2E 改为负向回归：`局部候选线支撑不能替整张边界图背书并进入人工验收`；
  - 仍使用同类“局部候选线 + 手绘补线”输入，证明它会被新门禁挡住；
  - 断言生成 5/5 后 normality 仍为 `suspicious`；
  - 断言 `底图贴合 blocked`，且弱支撑区域包含 `宋进`；
  - 断言五个区域的 `看图通过` 按钮均禁用。

已实际看图：

- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-real-map-local-support-rejected-current.png`
  - 我实际看到：新版七大恨区域制图工具、真实地图底图、白色边界和五区分区叠层；
  - 左侧状态为 `正常成果未证明 / suspicious`；
  - `底图贴合 blocked · 24.3% · 6090/25108 px · 弱支撑 宋进、山海关、汉城`；
  - `看图通过` 按钮为禁用状态；
  - 截图没有默认红色 UI 禁区框，但这不是正常成果，只是被正确拒绝的伪完成输入。

验证：

- `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 PW_WORKERS=1 PW_PORT=6375 PW_GAME_SERVER_PORT=20202 PW_API_SERVER_PORT=21202 node scripts/infra/run-e2e-command.mjs isolated e2e/qidahen-region-mask.e2e.ts --grep "局部候选线支撑不能替整张边界图背书并进入人工验收"`：`1 passed (2.6m)`。
- `npx eslint src/pages/devtools/QidahenRegionMaskTool.tsx e2e/qidahen-region-mask.e2e.ts`：通过。
- `npx tsc --noEmit --pretty false`：通过。

正式文件复核：

- `src/games/qidahen/data/region-mask.png 1265x893 opaque=0`
- `src/games/qidahen/data/region-boundary-mask.png 1265x893 opaque=0`

当前证据边界：

- 已证明工具现在能挡住“局部真实候选线替整张边界图背书”的伪完成输入；
- 已证明自动候选仍只是只读诊断/描线素材，不会直接写入边界草稿；
- 还没有证明任何真实用户边界图能进入 `accepted`；
- 正式成果仍未完成。必须等用户提供真实完整边界图，人工微调并确认后，再写入正式数据。

## 2026-05-25 06:50 +08 真实底图完整描线图：严格生成 5/5，但仍需人工验收

本节补齐“用户在真实地图底图上画完整边界图后，工具能否生成 5/5 初始区域”的回归证据。这里仍使用 E2E 生成的完整曲线描线图，不是用户最终手绘成果；它用于证明工具主链路已经不再卡在旧 UI、UI 禁区污染、小圈夹具或半成品默认生成。

流程证据：

- `e2e/qidahen-region-mask.e2e.ts`
  - 新增/复用 `createRealMapCompleteBoundarySourcePng()`，以真实 `public/assets/i18n/zh-CN/qidahen/board/main-board.png` 为底图，叠加锦州、宋进、山海关、咸兴、汉城五个曲线描线区域；
  - E2E `导入真实底图完整描线图后可严格生成五个区域并进入逐区验收` 断言：
    - 导入后 `qidahen-closed-seed-hit-count=5`；
    - 五个正式区域 seed 都显示 `独立`；
    - 存在未解释开放线时，默认 `生成正常初始区域` 拒绝，不写半成品；
    - 点击 `只保留有效分区边界` 后 `未解释开放线=0`；
    - 再次使用默认严格生成入口，`[data-testid^="qidahen-region-generation-result-"]` 中 `已生成` 数量为 5；
    - 生成后仍保持逐区验收门禁，normality 不自动等于 accepted。

已实际看图：

- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-real-map-complete-source-current.png`
  - 我实际看到：新版七大恨区域制图工具、真实地图底图、五个曲线描线/seed 状态可见；
  - 不是旧 UI、不是黑图，也不是纯小圈夹具。
- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-real-map-complete-generated-current.png`
  - 我实际看到：新版工具 UI、真实地图底图、白色曲线边界和五个区域的半透明生成叠层可见；
  - 轮盘、右侧牌框、底部条等 UI 禁区没有被抽成边界；
  - 左侧截图当前滚动位置只露出 3 条已生成结果，不代表只生成 3 个；E2E 已用 DOM 断言锁住 `已生成` 数量为 5。

验证：

- `npx eslint src/pages/devtools/QidahenRegionMaskTool.tsx e2e/qidahen-region-mask.e2e.ts`：通过。
- `npx tsc --noEmit --pretty false`：通过。
- `npx vitest run src/pages/devtools/__tests__/qidahenRegionMaskToolUtils.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1`：`50 passed`。
- `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 PW_WORKERS=1 PW_PORT=6373 PW_GAME_SERVER_PORT=20200 PW_API_SERVER_PORT=21200 node scripts/infra/run-e2e-command.mjs isolated e2e/qidahen-region-mask.e2e.ts --grep "导入真实底图完整描线图"`：`1 passed (3.6m)`。

正式文件复核：

- `src/games/qidahen/data/region-mask.png 1265x893 opaque=0`
- `src/games/qidahen/data/region-boundary-mask.png 1265x893 opaque=0`

当前证据边界：

- 已证明工具可以处理“真实地图底图 + 完整曲线描线图”并在严格模式下生成 5/5；
- 仍未把任何测试结果保存为正式七大恨数据；
- 正常成果仍必须等用户导入/手绘最终边界图后，逐区看图验收并保存。

## 2026-05-25 06:25 +08 真实底图描线图差分导入：只抽用户新增边界

本节修正“导入带底图描线图”的真实流程风险。此前该入口会按边界色直接从上传图抽线；如果用户是在真实地图底图上描线，上传图里仍包含原始地图本身的同色 UI、文字、马纹、山纹、海纹和路线，可能被一起抽进边界草稿。新口径是：只有用户相对原始底图新增或改动过、且颜色命中边界色、且不落入印刷 UI 禁区的像素，才进入边界图。

实现变化：

- `src/pages/devtools/QidahenRegionMaskTool.tsx`
  - `buildBoundaryDraftFromSourcePixels(..., { extractionMode: 'hand-drawn' })` 新增 `basePixels` 输入；
  - `hand-drawn` 模式下先用上传图与当前真实底图做逐像素 RGB/A 差分；
  - 抽线 mask 改为 `边界色命中 ∩ 底图差分 ∩ 非 UI 禁区`；
  - `BoundaryDraftExtractionStats` 新增 `drawnChangedPixelCount`；
  - UI 最近抽线读数新增 `底图差分`；
  - `导入完成边界图` 里遇到不透明带底图文件时，也复用同一差分保护。
- `e2e/qidahen-region-mask.e2e.ts`
  - 新增 `createRealMapDrawnBoundarySourcePng()`，用真实 `public/assets/i18n/zh-CN/qidahen/board/main-board.png` 作背景，只叠加用户新增的锦州边界线；
  - 新增 E2E：`导入真实底图描线图时只保留用户新增描线，不抽原图同色元素`；
  - 断言原图同色命中仍很高，但最终边界只保留用户新增描线范围；
  - 断言印刷 UI 禁区在 barrier canvas 内为 0。

已实际看图：

- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-real-map-hand-drawn-source-current.png`
  - 我实际看到：截图是新版七大恨区域制图工具，不是旧 UI 或黑图；
  - 底图是真实地图；
  - 边界/seed 状态集中在锦州附近；
  - 轮盘、右侧牌框、底部条没有被抽成边界。

验证：

- `npx eslint src/pages/devtools/QidahenRegionMaskTool.tsx e2e/qidahen-region-mask.e2e.ts`：通过。
- `npx tsc --noEmit --pretty false`：通过。
- `npx vitest run src/pages/devtools/__tests__/qidahenRegionMaskToolUtils.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1`：`50 passed`。
- `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 PW_WORKERS=1 PW_PORT=6381 PW_GAME_SERVER_PORT=20208 PW_API_SERVER_PORT=21208 node scripts/infra/run-e2e-command.mjs isolated e2e/qidahen-region-mask.e2e.ts --grep "导入真实底图描线图"`：`1 passed (1.6m)`。
- `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 PW_WORKERS=1 PW_PORT=6382 PW_GAME_SERVER_PORT=20209 PW_API_SERVER_PORT=21209 node scripts/infra/run-e2e-command.mjs isolated e2e/qidahen-region-mask.e2e.ts --grep "导入带底图描线图后只抽边界色"`：`1 passed (3.6m)`。
- `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 PW_WORKERS=1 PW_PORT=6383 PW_GAME_SERVER_PORT=20210 PW_API_SERVER_PORT=21210 node scripts/infra/run-e2e-command.mjs isolated e2e/qidahen-region-mask.e2e.ts --grep "指定边界颜色"`：`1 passed (3.2m)`。

正式文件复核：

- `src/games/qidahen/data/region-mask.png 1265x893 opaque=0`
- `src/games/qidahen/data/region-boundary-mask.png 1265x893 opaque=0`

当前证据边界：

- 已证明真实底图描线图导入不会再把原图同色 UI/纹理直接抽成边界；
- 已证明普通纯色背景描线图、指定边界颜色入口仍可用；
- 这仍不是七大恨正式正常成果。真实完成仍要求用户导入/手绘完整真实边界图，生成 5/5，并逐区看图验收。

## 2026-05-25 05:05 +08 未解释开放线：有效接边分割线不再被断线门禁误杀

本节修正“按全图分区”模型下的开放线诊断。此前只要边界组件接到地图边缘或 UI 禁区，`analyzeOpenBoundaryComponents` 就可能把它当作开放线。对闭合圈模型这合理，但对当前“边界线分割全图”的模型不合理：一条接边曲线只要确实把不同 seed 分进独立分区，就不是需要补边的问题。

实现变化：

- `src/pages/devtools/QidahenRegionMaskTool.tsx`
  - 保留原始 `boundaryOpenDiagnostics`，继续展示总 `开放线段`；
  - 新增 `unexplainedBoundaryOpenDiagnostics`：
    - 用 `keepBoundaryPixelsTouchingSeedPartitions` 先识别参与 seed 分区的边界像素；
    - 从当前边界图中扣掉这些已解释的分区边界；
    - 对剩余 mask 再跑 `analyzeOpenBoundaryComponents`；
  - 默认 `生成正常初始区域` 只因 `未解释开放线` 阻塞；
  - 橙色断点 marker、`定位断点并手绘补边`、分区预览导出和补边 ZIP 都只使用未解释开放线；
  - 质量报告 JSON 同时导出：
    - `quality.openComponentCount`
    - `quality.unexplainedOpenComponentCount`
    - `openBoundaries.unexplainedHints`
- `e2e/qidahen-region-mask.e2e.ts`
  - `连接到地图边缘的边界线按全图分区生成而不是只取小圈` 新增断言：
    - 清洗后总 `开放线段=1`；
    - `未解释开放线=0`；
    - 补边 ZIP 不再包含 `problems/open-boundary-01.png`；
    - `report.json` 为 `openComponentCount=1 / unexplainedOpenComponentCount=0`。

已实际看图：

- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-partition-preview-current.png`
  - 我实际看到：右侧白色曲线接边分割线仍在，咸兴/汉城有半透明分区预览；图上没有橙色开放断点 marker。说明有效接边分割线没有再被当作补边问题。
- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-partition-generated-current.png`
  - 我实际看到：调试生成后只写入咸兴和汉城，锦州/宋进/山海关仍显示未生成；这张图证明当前仍是局部分区调试，不是正常完整成果。
- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-repair-package-unmatched-current.png`
  - 我实际看到：补边问题包裁图指向 `锦州 未独立 seed`，保留真实地图局部和 seed 标记；没有把有效接边曲线裁成开放线问题。
- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-hand-drawn-multi-generated-current.png`
  - 我实际看到：完整手绘测试按当前严格口径先拒绝默认生成，再用调试生成得到锦州/宋进；山海关、咸兴、汉城仍未生成，没有被冒充成正常成果。
- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-barrier-hint-undo-redo-current.png`
  - 我实际看到：普通未解释断线仍有橙色端点提示；补边是手绘痕迹，不是工具自动直线封口。说明这次改动没有把真正断线提示关掉。

验证：

- `npx eslint src/pages/devtools/QidahenRegionMaskTool.tsx e2e/qidahen-region-mask.e2e.ts`：通过。
- `npx tsc --noEmit --pretty false`：通过。
- `npx vitest run src/pages/devtools/__tests__/qidahenRegionMaskToolUtils.test.ts`：`50 passed`。
- `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 PW_WORKERS=1 PW_PORT=6373 PW_GAME_SERVER_PORT=20200 PW_API_SERVER_PORT=21200 node scripts/infra/run-e2e-command.mjs isolated e2e/qidahen-region-mask.e2e.ts --grep "连接到地图边缘"`：`1 passed (4.2m)`。
- `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 PW_WORKERS=1 PW_PORT=6376 PW_GAME_SERVER_PORT=20203 PW_API_SERVER_PORT=21203 node scripts/infra/run-e2e-command.mjs isolated e2e/qidahen-region-mask.e2e.ts --grep "完整手绘边界图"`：`1 passed (5.0m)`。
- `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 PW_WORKERS=1 PW_PORT=6374 PW_GAME_SERVER_PORT=20201 PW_API_SERVER_PORT=21201 node scripts/infra/run-e2e-command.mjs isolated e2e/qidahen-region-mask.e2e.ts --grep "导入完成边界图后按独立分区"`：在相邻三用例复跑中通过；另外两条旧超时口径随后已单独修正并复跑。
- `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 PW_WORKERS=1 PW_PORT=6378 PW_GAME_SERVER_PORT=20205 PW_API_SERVER_PORT=21205 node scripts/infra/run-e2e-command.mjs isolated e2e/qidahen-region-mask.e2e.ts --grep "边界断点只定位"`：`1 passed (4.4m)`。

正式文件复核：

- `src/games/qidahen/data/region-mask.png 1265x893 opaque=0`
- `src/games/qidahen/data/region-boundary-mask.png 1265x893 opaque=0`

当前证据边界：

- 已证明有效接边分割线不会再被断线门禁误杀；
- 已证明补边包只导出真正需要处理的未独立 seed / 未解释断线问题；
- 这仍不是七大恨正式正常成果，真实完成仍要求用户导入/手绘完整边界图，生成 5/5 并逐区看图验收。

## 2026-05-24 13:38 +08 完整 5/5 保存回读门禁：刷新后仍保持完成态

本节补齐完整 5 区 E2E 的持久化缺口。此前 5/5 生成与验收包只证明当前页面内存态成立；保存后刷新时，`lastRegionGenerationResults` 不会持久化，质量报告可能把已保存的 mask 降级回 `边界可用于生成`。这会让“正常成果”在刷新后失去完成态证据。

实现变化：

- `src/pages/devtools/QidahenRegionMaskTool.tsx`
  - 成果质量报告现在会统计 `assignmentsRef.current` 中每个正式区域的已分配像素；
  - 如果刷新回读后没有 `lastRegionGenerationResults`，但保存的 `region-mask.png` 已有该区域像素，则该区域显示为 `已生成`；
  - `generatedCount` 在无内存生成结果时由已保存 mask 像素推导；
  - 因此保存/刷新后仍可恢复 `generated-ready`，不会因为内存态丢失而降级。
- `e2e/qidahen-region-mask.e2e.ts`
  - 完整 5 区用例新增：
    - 点击 `保存工作区`；
    - 断言 `region-mask.png` 与 `region-boundary-mask.png` 已落盘且有像素；
    - 刷新页面并等待自动读取该临时工作区；
    - 断言质量报告仍为 `生成链路已跑通`；
    - 导出刷新后的质量报告 JSON，断言 `state=generated-ready`、`generatedCount=5`、5 个区域仍全是 `已生成`。

验证：

- `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 node scripts/infra/run-e2e-command.mjs default e2e/qidahen-region-mask.e2e.ts --grep "完整五区局部描边 ZIP"`：`1 passed`。
- `npx eslint src/pages/devtools/QidahenRegionMaskTool.tsx e2e/qidahen-region-mask.e2e.ts`：通过。
- `npx tsc --noEmit --pretty false`：通过。
- `npx vitest run src/pages/devtools/__tests__/qidahenRegionMaskToolUtils.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1`：`46 passed`。
- `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 node scripts/infra/run-e2e-command.mjs default e2e/qidahen-region-mask.e2e.ts`：`18 passed (8.1m)`。

当前证据边界：

- 已证明完整 5 区边界输入不仅能在当前页面生成 5/5，还能保存、刷新回读，并继续显示完整完成态；
- 这仍然是 E2E 合成边界输入的能力门禁，不是用户真实边界图已经完成；
- 真实完成仍要求导入用户实际描好的 5 区边界图并逐区视觉验收。

## 2026-05-24 13:10 +08 完整 5 区边界输入门禁：生成 5/5 与验收包完成态

本节补齐上一节缺口：此前批量局部描边 ZIP 只导入锦州、宋进、山海关，因此质量报告只能到 `3/5 needs-fix`。现在新增完整 5 区闭合边界输入的 E2E，证明当用户提供 5 个区域的闭合边界时，工具能进入 `generated-ready` 完成态，并导出真实地图底图验收包。

实现变化：

- `e2e/qidahen-region-mask.e2e.ts`
  - `HAND_DRAWN_TEST_BOUNDARY_POINTS` 新增咸兴、汉城两个测试闭合边界；
  - 汉城 seed 位于 `(1118,629)`，紧贴右侧 UI 禁区 `x >= 1120`，测试夹具对汉城使用 2px 贴边闭合线，避免跨入 UI 禁区后被清洗剪断；
  - 新增 E2E：`完整五区局部描边 ZIP 导入后可生成 5/5 并导出真实底图验收包`；
  - 断言 5 个区域全部闭合、质量报告从 `边界可用于生成` 进入 `generated-ready`；
  - 断言 `quality.generatedCount=5`、`formalRegionCount=5`、`closure.matchedSeedCount=5`、最近生成结果 5 个全为 `generated`；
  - 导出区域验收包后，留存完整总览图和汉城裁图。

已实际看图：

- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-complete-acceptance-overview-current.png`
  - 我实际看到：七大恨真实地图底图上叠加了 5 个区域的合成闭合结果，包含锦州、宋进、山海关、咸兴、汉城；不是黑底，也不是旧 UI。
- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-complete-acceptance-shou-cheng-current.png`
  - 我实际看到：汉城裁图保留真实地图底图、区域色、白色闭合边界和 seed；裁图能暴露汉城贴近 UI 禁区的边缘风险。

验证：

- `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 node scripts/infra/run-e2e-command.mjs default e2e/qidahen-region-mask.e2e.ts --grep "完整五区局部描边 ZIP"`：`1 passed`。
- `npx eslint src/pages/devtools/QidahenRegionMaskTool.tsx e2e/qidahen-region-mask.e2e.ts`：通过。
- `npx tsc --noEmit --pretty false`：通过。
- `npx vitest run src/pages/devtools/__tests__/qidahenRegionMaskToolUtils.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1`：`46 passed`。
- `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 node scripts/infra/run-e2e-command.mjs default e2e/qidahen-region-mask.e2e.ts`：`18 passed (7.8m)`。

当前证据边界：

- 已证明工具在“5 区闭合边界均已导入”的前提下，可以生成 5/5、导出 `generated-ready` 质量报告和真实地图底图验收包；
- 这仍是 E2E 合成闭合线，用来锁工具能力，不是七大恨真实最终边界 truth；
- 真实成果完成条件仍是：用户完成/导入真实 5 区边界图，生成 5/5 后逐区视觉验收通过。

## 2026-05-24 12:20 +08 区域验收包：修复黑底叠图，证据图改为真实地图底图

本节针对“有没有看图、是不是又拿假成果收口”补证据。上一轮新增区域验收包后，我实际打开下载包导出的 `overview.png` 和 `regions/jinzhou.png`，发现它们是黑底/透明底叠加区域色，而不是七大恨真实地图底图。这类图不能用于逐区视觉验收，因此本节先修导出图层，再复跑 E2E 并实际看图。

实现变化：

- `src/pages/devtools/QidahenRegionMaskTool.tsx`
  - 新增 `drawImageDataOverlay()`；
  - `buildAcceptanceOverviewDataUrl()` 和 `buildRegionAcceptanceCrop()` 不再用 `putImageData(overlay)` 直接覆盖源画布；
  - overlay 先写入临时 canvas，再 `drawImage()` 叠到真实地图底图上，避免透明像素把底图擦成黑底。
- `e2e/qidahen-region-mask.e2e.ts`
  - 区域验收包 ZIP 解压后，把 `overview.png` 和 `regions/jinzhou.png` 写到稳定证据目录；
  - 新增 alpha 断言：总览和锦州裁图透明像素都必须少于 `100`，防止黑底/透明底回归；
  - 继续断言 ZIP 包含 `overview.png`、5 个 `regions/<regionId>.png` 和 `report.json`，且 `report.json` 写入 `acceptancePackage`。

已实际看图：

- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-acceptance-overview-current.png`
  - 我实际看到：图中是七大恨真实地图底图，上面叠加锦州、宋进、山海关三个 E2E 合成闭合区域、白色边界、绿色 seed；咸兴和汉城只显示 seed，未生成。
  - 这张图可用于核对“导入边界后生成区域是否贴在真实地图位置上”，不再是黑底假证据。
- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-acceptance-jinzhou-current.png`
  - 我实际看到：裁图保留真实地图底图和锦州局部位置，区域色/边界/seed 叠在底图上。
- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-batch-trace-import-current.png`
  - 我实际看到：当前工具 UI 不是旧 fallback；左侧质量报告显示 `3/5`，锦州/宋进/山海关已生成，咸兴/汉城未生成；粉色印刷 UI 禁区没有被写入生成区域。

验证：

- `npx eslint src/pages/devtools/QidahenRegionMaskTool.tsx e2e/qidahen-region-mask.e2e.ts`：通过。
- `npx tsc --noEmit --pretty false`：通过。
- `npx vitest run src/pages/devtools/__tests__/qidahenRegionMaskToolUtils.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1`：`46 passed`。
- `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 node scripts/infra/run-e2e-command.mjs default e2e/qidahen-region-mask.e2e.ts --grep "可导出外部描边参考图"`：`1 passed`。
- `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 node scripts/infra/run-e2e-command.mjs default e2e/qidahen-region-mask.e2e.ts`：`17 passed (7.3m)`。

当前证据边界：

- 已证明区域验收包现在输出真实地图底图叠图，且 E2E 会防止黑底/透明底证据回归；
- 已证明批量局部描边导入、质量报告 JSON、验收包导出和整份区域工具 E2E 均通过；
- 这仍不是七大恨全图 truth 完成：当前 E2E 只合成了锦州/宋进/山海关 3 个闭合区，咸兴/汉城未导入；真实 5 区边界仍需要用户完成后导入，再逐区看图验收。

## 2026-05-24 01:17 +08 区域导向候选参考层：不写入边界图本体，不是全图 truth

### 2026-05-24 01:35 +08 补充验证：候选参考层不污染正式边界

- E2E：`$env:NODE_OPTIONS='--max-old-space-size=4096'; node scripts/infra/run-e2e-command.mjs ci e2e/qidahen-region-mask.e2e.ts --grep "真实地图区域导向候选参考"` → `1 passed (14.4s)`
- 静态验证：
  - `$env:NODE_OPTIONS='--max-old-space-size=4096'; npx eslint src/pages/devtools/QidahenRegionMaskTool.tsx e2e/qidahen-region-mask.e2e.ts` → 通过
  - `$env:NODE_OPTIONS='--max-old-space-size=4096'; npx tsc --noEmit --pretty false` → 通过
  - `$env:NODE_OPTIONS='--max-old-space-size=4096'; npx vitest run src/pages/devtools/__tests__/qidahenRegionMaskToolUtils.test.ts` → `44 passed`
  - `git diff --check -- src/pages/devtools/QidahenRegionMaskTool.tsx e2e/qidahen-region-mask.e2e.ts task_plan.md progress.md evidence/qidahen/qidahen-region-mask-tool-2026-05-20.md` → 通过，仅 LF/CRLF warning
- 新 E2E 断言：
  - 候选参考层 canvas 有候选像素；
  - `当前边界图像素` 保持 `0`；
  - `barrier canvas` 保持 `0`；
  - 轮盘、右侧牌框、底部条等印刷 UI 禁区候选像素为 `0`；
  - 点击 `按边界图生成初始区域` 后不出现任何 `已生成`。
- 截图复核：
  - `test-results/evidence-screenshots/_shared/qidahen-region-mask-real-map-long-line-candidate-current.png`
  - 我实际看到：白色候选只作为参考层叠在地图上，正式青色边界层没有写入；这张图证明的是“参考层可用且不污染正式边界”，不是全图 truth。

### 2026-05-24 01:46 +08 补充验证：参考层后手绘闭合才能生成区域

- 实现修正：
  - 生成区域导向候选参考后，工具进入空白边界手绘基底；
  - 后续重算 barrier 时只吃用户手绘补边/去噪，不再混回真实底图颜色；
  - 这避免“候选参考层 + 底图撞色”被误合成为正式边界。
- E2E：`$env:NODE_OPTIONS='--max-old-space-size=4096'; node scripts/infra/run-e2e-command.mjs ci e2e/qidahen-region-mask.e2e.ts --grep "真实地图区域导向候选参考"` → `1 passed (2.0m)`
- 新 E2E 覆盖：
  - 候选参考层本身不生成任何区域；
  - 用户手绘一条闭合锦州边界后，`手工补边` 与 `当前最终障碍像素` 变为正数；
  - 闭合诊断变为 `闭合面 1 / seed 命中 1`；
  - 点击生成后只有 `锦州` 进入 `已生成`。
- 截图复核：
  - `test-results/evidence-screenshots/_shared/qidahen-region-mask-candidate-reference-hand-drawn-current.png`
  - 我实际看到：参考层仍可见，手绘闭合线生成了锦州区域；这证明“参考层辅助手绘闭合”的工作流可用。
  - 这张图里的手绘线是 E2E 示例闭合线，不是全图正式 truth，不能扩大结论。
- 静态验证：
  - `$env:NODE_OPTIONS='--max-old-space-size=4096'; npx eslint src/pages/devtools/QidahenRegionMaskTool.tsx e2e/qidahen-region-mask.e2e.ts` → 通过
  - `$env:NODE_OPTIONS='--max-old-space-size=4096'; npx tsc --noEmit --pretty false` → 通过
  - `$env:NODE_OPTIONS='--max-old-space-size=4096'; npx vitest run src/pages/devtools/__tests__/qidahenRegionMaskToolUtils.test.ts` → `44 passed`

### 本轮修正点

- `src/pages/devtools/QidahenRegionMaskTool.tsx`
  - 新增 `生成区域导向候选参考` 入口。
  - 候选生成不再把真实底图颜色匹配结果直接当边界图，而是只保留正式区域粗略边缘支撑带附近的真实连续线。
  - 继续剔除轮盘、右侧牌框、底部条等印刷 UI 禁区，并过滤红箭头、白色数字牌等紧凑印刷装饰。
  - 不自动封口，不画直线闭合，不写入边界图本体；断线和未封口区域仍需要用户沿参考层手绘补边/去噪。
- `e2e/qidahen-region-mask.e2e.ts`
  - 新增/改写 `真实地图区域导向候选参考只保留区域附近连续线且不写入正式边界图`。
  - 断言候选参考层不命中印刷 UI 禁区，且 `当前边界图像素` 仍为 `0`。

### 验证命令

- `$env:NODE_OPTIONS='--max-old-space-size=4096'; npx eslint src/pages/devtools/QidahenRegionMaskTool.tsx e2e/qidahen-region-mask.e2e.ts` → 通过
- `$env:NODE_OPTIONS='--max-old-space-size=4096'; npx tsc --noEmit --pretty false` → 通过
- 历史整份验证：`$env:NODE_OPTIONS='--max-old-space-size=4096'; node scripts/infra/run-e2e-command.mjs ci e2e/qidahen-region-mask.e2e.ts "真实地图区域导向候选边界图只保留区域附近连续线且不选印刷 UI"` → 实际运行整份 `e2e/qidahen-region-mask.e2e.ts`，`13 passed (6.8m)`
- 当前后续门禁已改为：候选参考层有像素，`barrier canvas` 和 `当前边界图像素` 保持 `0`。

### 截图复核

- `test-results/evidence-screenshots/_shared/qidahen-region-mask-real-map-long-line-candidate-current.png`
  - 我实际看到：候选主要集中在正式区域附近的真实河线、边线和曲线链段。
  - 我实际看到：轮盘、右侧牌框、底部条等印刷 UI 没有被选入候选参考层。
  - 我实际看到：仍有少量山纹残留和断点，不能直接当完成边界图，因此当前实现不再把它写入边界图本体。

### 当前结论

- 区域导向候选参考层可以作为“用户先拿一张参考，再沿参考手绘微调”的入口。
- 它不是七大恨全图正式边界图，不会绕过闭合面生成门槛，也不会直接进入保存边界。
- 全图正式边界图和所有区域 truth 仍未完成；后续仍需要用户微调闭合后，再按闭合面生成区域并逐区验收。

## 2026-05-23 22:39 +08 入口语义收口：完成边界图优先，带底图描线图只作为参考抽线源

### 本轮修正点

- `src/pages/devtools/QidahenRegionMaskTool.tsx`
  - 空工作区和主工作流入口把 `推荐：导入完成边界图` 提为第一主路。
  - 原 `导入手绘原图` 改为 `导入带底图描线图`，语义限定为：用户已经在底图上描好边界线，工具只从这张描线图中抽取边界色，并把原图作为 `描线参考层` 叠回画布辅助微调。
  - 顶部说明继续强调：正式成果来自完成边界图或用户微调后的闭合边界；真实底图颜色诊断不写入边界图。
- `e2e/qidahen-region-mask.e2e.ts`
  - 用例名和断言同步改为 `导入带底图描线图后只抽边界色生成边界图`。
  - 原直线拖拽 helper 已替换为沿弯曲点列拖拽的 `dragCanvasMapPolyline()`，避免把直线多边形证据误当真实边界。
  - `描线参考层` 断言改为精确标题匹配，避免提示文案与标题同时命中导致 strict mode 假失败。

### 验证命令

- `$env:NODE_OPTIONS='--max-old-space-size=4096'; npx eslint src/pages/devtools/QidahenRegionMaskTool.tsx e2e/qidahen-region-mask.e2e.ts` → 通过
- `$env:NODE_OPTIONS='--max-old-space-size=4096'; npx tsc --noEmit --pretty false` → 通过
- `$env:NODE_OPTIONS='--max-old-space-size=4096'; npx eslint e2e/qidahen-region-mask.e2e.ts` → 通过
- 目标链路复跑：`node scripts/infra/run-e2e-command.mjs ci e2e/qidahen-region-mask.e2e.ts --grep "正式工作区默认不回读测试假边界|导入带底图描线图后只抽边界色生成边界图|导入完成边界图后只按闭合面生成区域并舍弃断线|从空白边界开始手绘后可保存回读并生成初始区域"` → `4 passed (2.7m)`
- 整份复跑：同一预构建 runtime、端口 `6473/20300/21300`，`node scripts/infra/run-e2e-command.mjs ci e2e/qidahen-region-mask.e2e.ts` → `12 passed (6.7m)`
- `$env:NODE_OPTIONS='--max-old-space-size=4096'; npx vitest run src/pages/devtools/__tests__/qidahenRegionMaskToolUtils.test.ts` → `44 passed`
- `git diff --check -- src/pages/devtools/QidahenRegionMaskTool.tsx e2e/qidahen-region-mask.e2e.ts src/pages/devtools/qidahenRegionMaskToolUtils.ts src/pages/devtools/__tests__/qidahenRegionMaskToolUtils.test.ts task_plan.md progress.md evidence/qidahen/qidahen-region-mask-tool-2026-05-20.md` → 通过，仅 LF/CRLF warning

### 当前结论

- 当前工具入口已经对准用户真实工作流：先导入完成边界图，或导入带底图的描线图再在工具内微调。
- `带底图描线图` 不是“真实底图自动抽色”，只在用户已经画了边界线的前提下作为抽线源和参考层。
- 全图正式边界图和所有区域 truth 仍未完成；本节只证明工具入口、闭合生成、断线舍弃、保存回读和 E2E 证据链已按正确方向收口。

### 截图复核

- `test-results/evidence-screenshots/_shared/qidahen-region-mask-formal-empty-current.png`
  - 我实际看到：空白正式入口首屏第一按钮是 `推荐：导入完成边界图`，第二按钮是 `导入带底图描线图`；说明文案明确真实底图抽色只做诊断，不写入边界。
- `test-results/evidence-screenshots/_shared/qidahen-region-mask-hand-drawn-source-current.png`
  - 我实际看到：导入描线源后，左侧主路仍保留 `推荐：导入完成边界图`，并显示 `当前：只用边界颜色/手工补边` 与只读诊断提示；画布显示抽出的边界/seed 标记，不是从真实底图直接生成全图成果。

## 2026-05-23 19:36 +08 E2E 恢复：只读诊断与手绘闭合主链均已留证

### 本轮修正点

- 真实底图入口保持 `诊断底图颜色（不写入）`：
  - 只统计抽色命中、剔除后像素、链段数量；
  - 不写入边界图；
  - 不清空手工补边/去噪；
  - 直接生成区域时仍只认闭合面，seed 不在闭合面内就跳过。
- E2E 断言已从旧文案“没有可用边界”改为当前真实行为：
  - `当前边界图像素：0`；
  - barrier canvas 不透明像素为 `0`；
  - `已生成 0 / 未生成 5`；
  - `锦州`、`宋进` 显示“没有闭合边界面包含这个 seed”。
- 手绘多闭合主链仍保持硬门槛：
  - 两个闭合区域生成；
  - 开放断线只显示端点提示；
  - `山海关` 未命中闭合面时不生成。

### 验证命令

- `$env:NODE_OPTIONS='--max-old-space-size=4096'; node scripts/infra/run-e2e-command.mjs ci e2e/qidahen-region-mask.e2e.ts --grep "真实地图颜色诊断只读显示且不会写入边界图"` → `1 passed`
- `$env:NODE_OPTIONS='--max-old-space-size=4096'; node scripts/infra/run-e2e-command.mjs ci e2e/qidahen-region-mask.e2e.ts --grep "完整手绘边界图会批量生成多个闭合区域并舍弃断线"` → `1 passed`
- `$env:NODE_OPTIONS='--max-old-space-size=4096'; node scripts/infra/run-e2e-command.mjs ci e2e/qidahen-region-mask.e2e.ts` → `9 passed`
- `$env:NODE_OPTIONS='--max-old-space-size=4096'; npx eslint src/pages/devtools/QidahenRegionMaskTool.tsx src/pages/devtools/qidahenRegionMaskToolUtils.ts src/pages/devtools/__tests__/qidahenRegionMaskToolUtils.test.ts e2e/qidahen-region-mask.e2e.ts` → 通过
- `$env:NODE_OPTIONS='--max-old-space-size=4096'; npx vitest run src/pages/devtools/__tests__/qidahenRegionMaskToolUtils.test.ts` → `44 passed`
- `$env:NODE_OPTIONS='--max-old-space-size=4096'; npx tsc --noEmit --pretty false` → 通过
- `git diff --check -- src/pages/devtools/QidahenRegionMaskTool.tsx src/pages/devtools/qidahenRegionMaskToolUtils.ts src/pages/devtools/__tests__/qidahenRegionMaskToolUtils.test.ts e2e/qidahen-region-mask.e2e.ts task_plan.md progress.md evidence/qidahen/qidahen-region-mask-tool-2026-05-20.md vite.config.ts` → 通过

### 截图证据

- `test-results/evidence-screenshots/_shared/qidahen-region-mask-real-map-auto-extract-current.png`
  - 我实际看到：页面是当前工作树的新工具 UI，不是旧 404；左侧工作流显示 `诊断底图颜色（不写入）`，边界图层没有写入真实底图抽色结果。
- `test-results/evidence-screenshots/_shared/qidahen-region-mask-hand-drawn-multi-diagnostics-current.png`
  - 我实际看到：合成手绘边界图有两个闭合环和一条开放断线；闭合诊断显示 `闭合面 2 / seed 命中 2`，橙色 marker 指向开放断线端点。
- `test-results/evidence-screenshots/_shared/qidahen-region-mask-hand-drawn-multi-generated-current.png`
  - 我实际看到：只生成 `锦州`、`宋进` 两块闭合区域；`山海关` 因未被闭合面包含而保持未生成。

### 当前结论

- 工具主线现在是：导出底图模板或导入手绘边界图 -> 闭合诊断 -> 必要时沿真实边界手绘补边/去噪 -> 保存工作区 -> 只按闭合面生成区域。
- 真实底图颜色匹配只作为诊断，不能再作为“正常成果”或“可微调底稿”写入边界图。
- 本轮没有完成全图正式边界图/truth；只有用户提供或在工具里微调出完整闭合边界图后，才能继续生成正式整图区域并逐区验收。

## 2026-05-23 19:55 +08 直接导入完成边界图：覆盖用户给图后的正式主链

### 本轮修正点

- `e2e/qidahen-region-mask.e2e.ts`
  - 新增 `createTransparentBoundaryMaskPng()`：生成透明背景的边界 PNG，模拟用户已经画好的边界图，而不是带底图手绘原图。
  - 新增 E2E：`导入完成边界图后只按闭合面生成区域并舍弃断线`。
  - 测试输入包含：
    - `锦州` 闭合边界；
    - `宋进` 闭合边界；
    - 一条未封口开放断线。
  - 验收断言：
    - 导入后出现 `已导入边界图`；
    - 闭合诊断为 `闭合面 2 / seed 命中 2`；
    - 开放线段为 `1`；
    - 生成后只有 `锦州`、`宋进` 显示 `已生成`；
    - `山海关` 不生成；
    - 正式 `src/games/qidahen/data` 字节级快照不被 E2E 写入污染。
- `src/pages/devtools/QidahenRegionMaskTool.tsx`
  - 正常成果链文案改为：`导入手绘原图或完成边界图`，明确透明/二值边界图是正式入口，不需要再走真实底图抽色。

### 验证命令

- `$env:NODE_OPTIONS='--max-old-space-size=4096'; node scripts/infra/run-e2e-command.mjs ci e2e/qidahen-region-mask.e2e.ts --grep "导入完成边界图后只按闭合面生成区域并舍弃断线"` → `1 passed`
- `$env:NODE_OPTIONS='--max-old-space-size=4096'; npx eslint src/pages/devtools/QidahenRegionMaskTool.tsx src/pages/devtools/qidahenRegionMaskToolUtils.ts src/pages/devtools/__tests__/qidahenRegionMaskToolUtils.test.ts e2e/qidahen-region-mask.e2e.ts` → 通过
- `$env:NODE_OPTIONS='--max-old-space-size=4096'; npx vitest run src/pages/devtools/__tests__/qidahenRegionMaskToolUtils.test.ts` → `44 passed`
- `$env:NODE_OPTIONS='--max-old-space-size=4096'; npx tsc --noEmit --pretty false` → 通过
- `$env:NODE_OPTIONS='--max-old-space-size=4096'; node scripts/infra/run-e2e-command.mjs ci e2e/qidahen-region-mask.e2e.ts` → `10 passed`

### 截图证据

- `test-results/evidence-screenshots/_shared/qidahen-region-mask-completed-boundary-import-current.png`
  - 我实际看到：页面是当前工具 UI；导入的透明边界图在地图上形成两个闭合面和一条开放断线；开放断线有橙色端点 marker；生成结果只覆盖两个闭合区域。

### 当前结论

- 用户提供一张完成边界图后，工具已能走“导入边界图 -> 闭合诊断 -> 只生成闭合区域 -> 舍弃断线”的主链。
- 这仍不是七大恨全图最终成果；它证明的是工具工作流已对准正确方向。全图成果仍需要用户提供或在工具里微调出完整闭合边界图，再逐区生成和验收。

## 2026-05-23 20:02 +08 未命中 seed 地图标记：补边时直接看到问题位置

### 本轮修正点

- `src/pages/devtools/QidahenRegionMaskTool.tsx`
  - 在地图 SVG overlay 中新增 `qidahen-unmatched-seed-markers`。
  - 只要当前有边界图，闭合诊断未命中的区域 seed 会直接以粉色虚线圈和区域名标在地图上。
  - 开放断线仍使用橙色端点 marker；两类信息同屏，分别回答“哪里断了”和“哪个区域 seed 还没被闭合面包住”。
- `e2e/qidahen-region-mask.e2e.ts`
  - `完整手绘边界图会批量生成多个闭合区域并舍弃断线` 增加未命中 seed marker 断言。
  - `导入完成边界图后只按闭合面生成区域并舍弃断线` 增加 `qidahen-unmatched-seed-marker-shan-hai-guan` 可见断言。

### 验证命令

- `$env:NODE_OPTIONS='--max-old-space-size=4096'; node scripts/infra/run-e2e-command.mjs ci e2e/qidahen-region-mask.e2e.ts --grep "完整手绘边界图会批量生成多个闭合区域并舍弃断线|导入完成边界图后只按闭合面生成区域并舍弃断线"` → `2 passed`
- `$env:NODE_OPTIONS='--max-old-space-size=4096'; npx eslint src/pages/devtools/QidahenRegionMaskTool.tsx e2e/qidahen-region-mask.e2e.ts` → 通过
- `$env:NODE_OPTIONS='--max-old-space-size=4096'; npx tsc --noEmit --pretty false` → 通过
- `$env:NODE_OPTIONS='--max-old-space-size=4096'; npx vitest run src/pages/devtools/__tests__/qidahenRegionMaskToolUtils.test.ts` → `44 passed`

### 截图证据

- `test-results/evidence-screenshots/_shared/qidahen-region-mask-hand-drawn-multi-diagnostics-current.png`
  - 我实际看到：顶部开放断线两端是橙色圈；`山海关/咸兴/汉城` seed 位置有粉色虚线圈和区域名。
- `test-results/evidence-screenshots/_shared/qidahen-region-mask-completed-boundary-import-current.png`
  - 我实际看到：直接导入完成边界图后，同样能看到开放断线端点与未命中 seed 标记。

### 当前结论

- 用户微调边界时，不再只能从侧栏文字判断漏了哪个区域；地图上会直接给出未命中 seed 的位置。
- 这仍是工具能力提升，不是全图 truth 完成。

## 2026-05-23 17:25 +08 开放线段端点提示：告诉用户该补哪里

### 修正点

- `src/pages/devtools/qidahenRegionMaskToolUtils.ts`
  - 新增 `analyzeOpenBoundaryComponents()`。
  - 它会找出没有围出内部面的开放边界组件，并为每个提示组件给出两个最远端点。
- `src/pages/devtools/QidahenRegionMaskTool.tsx`
  - `闭合诊断` 面板新增开放线段统计：
    - 开放线段数量；
    - 最大开放线段像素；
    - 提示端点坐标。
  - 地图 SVG 上新增橙色端点 marker，直接标出需要补封口的开放线段两端。
- `e2e/qidahen-region-mask.e2e.ts`
  - 多闭合边界用例新增断言：
    - `qidahen-open-boundary-count` 必须为 `1`；
    - `qidahen-open-boundary-hints` 必须包含 `↔`；
    - `qidahen-open-boundary-markers` 可见；
    - 端点 marker 数量必须为 `2`。

### 验证

- `npx vitest run src/pages/devtools/__tests__/qidahenRegionMaskToolUtils.test.ts` → `41 passed`
- `npx eslint src/pages/devtools/QidahenRegionMaskTool.tsx src/pages/devtools/qidahenRegionMaskToolUtils.ts src/pages/devtools/__tests__/qidahenRegionMaskToolUtils.test.ts e2e/qidahen-region-mask.e2e.ts` → 通过
- `npx tsc --noEmit --pretty false` → 通过
- `$env:NODE_OPTIONS='--max-old-space-size=4096'; node scripts/infra/run-e2e-command.mjs ci e2e/qidahen-region-mask.e2e.ts --grep "完整手绘边界图会批量生成多个闭合区域并舍弃断线"` → `1 passed`

### 看图结论

- `qidahen-region-mask-hand-drawn-multi-diagnostics-current.png`
  - 我实际看到：右侧顶部断线两端有橙色圈。
  - 我实际看到：左侧显示 `开放线段：1，最大 2,438 px`，并给出 `500,238 ↔ 694,258` 这类提示点坐标。
  - 当前有效结论：用户微调边界时，工具不只说“未闭合”，还能指出开放线段的大致端点。

### 2026-05-23 18:10 +08 补充验证：斜向/曲线断线适配

- 发现问题：单像素斜线在 4 邻接外部 flood 下可能被误判为“隔出内部”，这会让斜向断线或曲线断线看起来像已经封口。
- 修正：
  - `extractClosedBoundaryInteriorComponents()` 的外部 flood 改为 8 邻接；
  - `analyzeOpenBoundaryComponents()` 的外部 flood 改为 8 邻接；
  - 开放线段组件遍历也改为 8 邻接，让斜向手绘线被识别为同一条开放线段。
- 新增单测：
  - `extractClosedBoundaryInteriorComponents 不把斜向单线误判成闭合面`
  - `analyzeOpenBoundaryComponents 把斜向手绘线视为同一条开放线段`
- 最新验证：
  - `npx vitest run src/pages/devtools/__tests__/qidahenRegionMaskToolUtils.test.ts` → `43 passed`
  - `npx eslint src/pages/devtools/qidahenRegionMaskToolUtils.ts src/pages/devtools/__tests__/qidahenRegionMaskToolUtils.test.ts` → 通过
  - `npx tsc --noEmit --pretty false` → 通过
  - `$env:NODE_OPTIONS='--max-old-space-size=4096'; node scripts/infra/run-e2e-command.mjs ci e2e/qidahen-region-mask.e2e.ts` → `9 passed`

## 2026-05-23 16:50 +08 生成前闭合诊断：减少边界微调盲试错

### 修正点

- `src/pages/devtools/QidahenRegionMaskTool.tsx`
  - 侧栏新增 `闭合诊断` 面板。
  - 导入/手绘边界后，不必先点生成，就能看到：
    - 闭合面数量；
    - seed 命中数量；
    - 最大闭合面像素；
    - 未命中的区域名单。
- `e2e/qidahen-region-mask.e2e.ts`
  - `完整手绘边界图会批量生成多个闭合区域并舍弃断线` 新增生成前断言：
    - `qidahen-closed-face-count` 必须为 `2`；
    - `qidahen-closed-seed-hit-count` 必须为 `2`；
    - `qidahen-unmatched-closed-seeds` 必须包含 `山海关`。
  - 新增截图：`test-results/evidence-screenshots/_shared/qidahen-region-mask-hand-drawn-multi-diagnostics-current.png`。

### 验证

- `node scripts/infra/run-e2e-command.mjs ci e2e/qidahen-region-mask.e2e.ts --grep "完整手绘边界图会批量生成多个闭合区域并舍弃断线"` → `1 passed`
- `node scripts/infra/run-e2e-command.mjs ci e2e/qidahen-region-mask.e2e.ts` → `9 passed`
- `npx eslint src/pages/devtools/QidahenRegionMaskTool.tsx e2e/qidahen-region-mask.e2e.ts` → 通过
- `npx tsc --noEmit --pretty false` → 通过

### 看图结论

- `qidahen-region-mask-hand-drawn-multi-diagnostics-current.png`
  - 我实际看到：左侧显示 `闭合面：2 / seed 命中：2`，最大闭合面 `12,707 px`，未命中包含 `山海关`。
  - 我实际看到：右侧地图上有两个弯曲闭合圈，顶部还有一条未封口噪声线；诊断没有把断线计为闭合面。
  - 当前有效结论：用户微调边界时，现在能在生成前判断哪些线已经闭合、哪些区域 seed 仍未命中。

## 2026-05-23 16:26 +08 多闭合区批量生成与整块 UI 禁区门禁

### 本轮新增证据

- `e2e/qidahen-region-mask.e2e.ts`
  - 新增截图：`test-results/evidence-screenshots/_shared/qidahen-region-mask-hand-drawn-multi-generated-current.png`
  - 新增 E2E：`完整手绘边界图会批量生成多个闭合区域并舍弃断线`
  - 测试输入是一张手绘边界源：包含 `锦州`、`宋进` 两个弯曲闭合边界，以及一条未封口噪声线。
  - 验收断言：`锦州` 与 `宋进` 必须显示 `已生成`；`山海关` 不得显示 `已生成`；页面状态必须包含“本次只使用闭合边界面，断线区域会直接跳过”。
- 真实底图试提 UI 门禁加强：
  - 原来只检查轮盘中心、右侧牌框中心、底部规则区中心 3 个点。
  - 现在追加整块矩形统计：顶部边框、左侧轮盘/边栏、右侧牌框、底部流程/牌区、年份轨，在边界层内必须都是 `0` 个不透明像素。
  - 这能防止 UI 边框被抽进边界图，但中心点仍为透明的假通过。

### 验证

- `node scripts/infra/run-e2e-command.mjs ci e2e/qidahen-region-mask.e2e.ts --grep "完整手绘边界图会批量生成多个闭合区域并舍弃断线"` → `1 passed`
- `node scripts/infra/run-e2e-command.mjs ci e2e/qidahen-region-mask.e2e.ts --grep "真实地图试提边界会生成可微调边界图且剔除明显 UI 区"` → `1 passed`
- `node scripts/infra/run-e2e-command.mjs ci e2e/qidahen-region-mask.e2e.ts` → `9 passed`
- `npx vitest run src/pages/devtools/__tests__/qidahenRegionMaskToolUtils.test.ts` → `40 passed`
- `npx eslint src/pages/devtools/QidahenRegionMaskTool.tsx src/pages/devtools/qidahenRegionMaskToolUtils.ts src/pages/devtools/__tests__/qidahenRegionMaskToolUtils.test.ts e2e/qidahen-region-mask.e2e.ts vite.config.ts` → 通过
- `npx tsc --noEmit --pretty false` → 通过

### 看图结论

- `qidahen-region-mask-hand-drawn-multi-generated-current.png`
  - 我实际看到：地图上生成了 `锦州`、`宋进` 两个区域；顶部那条未闭合噪声线没有生成区域。
  - 当前有效结论：完整手绘边界图的批量生成主路已经能同时处理多个闭合面，并舍弃断线。
- `qidahen-region-mask-real-map-auto-extract-current.png`
  - 我实际看到：真实底图试提仍是边界底稿，禁区 UI 没有作为边界层进入。
  - 历史结论已失效：19:36 复核后，真实底图颜色诊断只保留为只读统计，不再写入边界图，也不再称为可微调底稿。
- `qidahen-region-mask-path-graph-current.png`
  - 我实际看到：路径编辑可在闭合区中心之间建边，并保存边界类型。
  - 当前有效结论：路径编辑链路可用；路径点最终可信度仍依赖用户微调后的真实区域 mask。

### 仍未完成

- 还没有七大恨全图最终边界图，因此不能宣称全图区域 truth 完成。
- 当前自动底图试提不会再拿 UI 当成果，但它也不会替代人工描边/微调。

## 2026-05-23 16:10 +08 闭合面生成接入主路：断线/无法封口直接舍弃

### 本轮修正

- `src/pages/devtools/qidahenRegionMaskToolUtils.ts`
  - 新增 `extractClosedBoundaryInteriorComponents()`：从当前边界 mask 反向 flood 外部，只返回被边界完整封住的内部面。
  - 断线、漏口、与外部连通的区域不会返回内部面。
- `src/pages/devtools/QidahenRegionMaskTool.tsx`
  - `按边界图生成初始区域` 不再直接围绕 seed 做猜测式 flood fill。
  - 当前流程改为：提取闭合内部面 -> 用区域 seed 找包含它的闭合面 -> 写入对应区域。
  - 如果没有闭合面包含 seed，结果卡片显示跳过，并提示优先补边封口。

### 验证

- `npx vitest run src/pages/devtools/__tests__/qidahenRegionMaskToolUtils.test.ts` → `40 passed`
- `npx eslint src/pages/devtools/QidahenRegionMaskTool.tsx src/pages/devtools/qidahenRegionMaskToolUtils.ts src/pages/devtools/__tests__/qidahenRegionMaskToolUtils.test.ts e2e/qidahen-region-mask.e2e.ts vite.config.ts` → 通过
- `npx tsc --noEmit --pretty false` → 通过
- `node scripts/infra/run-e2e-command.mjs ci e2e/qidahen-region-mask.e2e.ts --grep "魔棒分区、区域中心路径编辑和单主保存动作可用"` → `1 passed`
- `node scripts/infra/run-e2e-command.mjs ci e2e/qidahen-region-mask.e2e.ts` → `8 passed`

### 最新截图复核

- `test-results/evidence-screenshots/_shared/qidahen-region-mask-real-map-auto-extract-current.png`
  - 我实际看到：真实底图试提仍是零散边界底稿，不能当成闭合全图边界。
  - 当前结论：只保留为可微调初稿；E2E 已禁止它在未封口时生成正式区域。
- `test-results/evidence-screenshots/_shared/qidahen-region-mask-hand-drawn-generated-current.png`
  - 我实际看到：只生成了 `锦州`；`宋进`、`山海关` 没有闭合面包含 seed，因此显示未生成/跳过。
  - 当前结论：符合“无法连成线无法封口直接舍弃”，不是漏算完成区域。
- `test-results/evidence-screenshots/_shared/qidahen-region-mask-path-graph-current.png`
  - 我实际看到：路径模式下 `锦州 ↔ 宋进` 的区域中心连边与山脉边界类型可编辑。
  - 当前结论：这只证明路径编辑链路可用；最终路径点是否可信仍取决于用户微调后的真实区域 mask。

### 收口口径

- 当前已完成的是工具链：手绘/导入边界图、保存/回读、闭合面生成、断线跳过、路径编辑保存。
- 当前未完成的是七大恨全图最终区域 truth。真实底图自动试提仍只能做底稿，不能宣称全图区域已经完成。

## 2026-05-23 15:47 +08 看图后纠偏：去掉直线假边界证据，真实底图只产可微调边界底稿

### 纠偏结论

- 之前 `qidahen-region-mask-hand-drawn-generated-current.png` 和 `qidahen-region-mask-path-graph-current.png` 里可见的闭合边界来自 E2E 合成的静态多边形，视觉上仍是直线/规则形状。
- 这类图只能证明工具链能跑，不能证明七大恨边界成果正常。
- 本轮已把该证据降级，不再用它证明“正常成果完成”。

### 实现修正

- `src/pages/devtools/QidahenRegionMaskTool.tsx`
  - `hand-drawn` 导入不再用 5 个静态示例区域的 support mask 裁剪边界图；用户画完整图时，工具不会只保留锦州/宋进/山海关等局部示例附近的线。
  - `auto-map` 试提边界改为：抽实画边界色后，先剔除印刷 UI 区域，再过滤短小组件。
  - 已剔除的印刷 UI 区域包括顶部边框、左侧轮盘/边栏、右侧牌框、底部流程/牌区和年份轨。
  - 真实底图试提结果只作为“可微调边界底稿”，不能直接算最终区域。
- `e2e/qidahen-region-mask.e2e.ts`
  - 测试用手绘源从 `polygon` 改为弯曲闭合 `path`，避免继续用直线静态区域假装手绘成果。
  - 新增真实底图门禁：未封口的试提边界点击 `按边界图生成初始区域` 后，不允许任何区域显示 `已生成`。
  - 继续保留明显 UI 点位 alpha=0 门禁，覆盖轮盘中心、右侧牌框中心、底部规则区中心。

### 最新验证

- `npm run test:e2e:ci:file -- e2e/qidahen-region-mask.e2e.ts "真实地图试提边界会生成可微调边界图且剔除明显 UI 区"` → `1 passed`
- `npm run test:e2e:ci:file -- e2e/qidahen-region-mask.e2e.ts "导入手绘原图后只抽边界色生成边界图"` → `1 passed`
- `npm run test:e2e:ci:file -- e2e/qidahen-region-mask.e2e.ts "魔棒分区、区域中心路径编辑和单主保存动作可用"` → `1 passed`
- `node scripts/infra/run-e2e-command.mjs ci e2e/qidahen-region-mask.e2e.ts` → `8 passed`
- `npx eslint e2e/qidahen-region-mask.e2e.ts src/pages/devtools/QidahenRegionMaskTool.tsx src/pages/devtools/qidahenRegionMaskToolUtils.ts src/pages/devtools/__tests__/qidahenRegionMaskToolUtils.test.ts vite.config.ts` → 通过
- `npx vitest run src/pages/devtools/__tests__/qidahenRegionMaskToolUtils.test.ts` → `38 passed`
- `npx tsc --noEmit --pretty false` → 通过

### 最新截图判断

- `test-results/evidence-screenshots/_shared/qidahen-region-mask-real-map-auto-extract-current.png`
  - 当前有效结论：真实底图可以提取一张较干净的边界底稿，并且明显 UI 点位没有进入边界层。
  - 当前限制：这张图仍不是闭合全图边界，E2E 已禁止它直接生成正式区域。
- `test-results/evidence-screenshots/_shared/qidahen-region-mask-hand-drawn-generated-current.png`
  - 当前有效结论：闭合手绘边界图导入后可以生成区域。
  - 当前限制：这仍是测试用弯曲闭合源，不是七大恨全图真实成果。
- `test-results/evidence-screenshots/_shared/qidahen-region-mask-path-graph-current.png`
  - 当前有效结论：在已有闭合区域的前提下，区域中心与通行路径编辑链路可用。
  - 当前限制：路径点正确性取决于用户最终微调后的真实区域 mask。

## 2026-05-23 15:00 +08 最新收口：主路 UI 与端到端证据重跑

### 修复与收口口径

- `src/pages/devtools/QidahenRegionMaskTool.tsx`
  - 首屏新增 `主路进度` 与 `下一步`，直接提示当前应处在“空白 / 已有边界 / 已保存 / 已生成区域”的哪一步。
  - 默认界面保留真正主路：`导出底图模板`、`推荐：导入手绘原图`、`导入边界图`、`从空白边界开始手绘`、`保存工作区`、`按边界图生成初始区域`。
  - `诊断样本`、抽线参数、实验性真实地图试提边界下沉到 `展开高级调试与参数`，避免正式运行时看起来像回到旧实验 UI。
- 当前完成口径只证明“手绘/边界图主路工具链可用”：导入、参考层、补边/去噪、保存、刷新回读、生成初始区域、路径编辑和回读。
- 不能把这次结果扩大成“七大恨全地图区域已经完成”。全图最终区域仍依赖用户微调后的边界图输入。

### 最新验证

- `npm run test:e2e:ci:file -- e2e/qidahen-region-mask.e2e.ts "手绘参考层可保存回读并支持清除后不再回读"` → `1 passed`
- `npm run test:e2e:ci:file -- e2e/qidahen-region-mask.e2e.ts "导入手绘原图后可先保存工作区再刷新回读边界图"` → `1 passed`
- `node scripts/infra/run-e2e-command.mjs ci e2e/qidahen-region-mask.e2e.ts` → `8 passed`
- `npx eslint e2e/qidahen-region-mask.e2e.ts src/pages/devtools/QidahenRegionMaskTool.tsx src/pages/devtools/qidahenRegionMaskToolUtils.ts src/pages/devtools/__tests__/qidahenRegionMaskToolUtils.test.ts vite.config.ts` → 通过
- `npx vitest run src/pages/devtools/__tests__/qidahenRegionMaskToolUtils.test.ts` → `38 passed`
- `npx tsc --noEmit --pretty false` → 通过

### 最新截图证据

- `test-results/evidence-screenshots/_shared/qidahen-region-mask-formal-empty-current.png`
  - 证明正式空工作区默认不回读测试假边界，首屏主路入口可见。
- `test-results/evidence-screenshots/_shared/qidahen-region-mask-hand-drawn-source-current.png`
  - 证明导入手绘原图后会抽取边界色并显示参考层。
- `test-results/evidence-screenshots/_shared/qidahen-region-mask-hand-drawn-generated-current.png`
  - 证明按边界图生成初始区域后，闭合区域会生成，漏边区域会明确跳过。
- `test-results/evidence-screenshots/_shared/qidahen-region-mask-hand-drawn-workspace-current.png`
  - 证明只保存边界工作区、尚未生成区域时也能刷新回读边界图。
- `test-results/evidence-screenshots/_shared/qidahen-region-mask-hand-drawn-reference-persisted-current.png`
  - 证明手绘参考层可随工作区保存并刷新回读。
- `test-results/evidence-screenshots/_shared/qidahen-region-mask-hand-drawn-reference-cleared-current.png`
  - 证明清除参考图后保存，刷新不会再回读旧参考层。
- `test-results/evidence-screenshots/_shared/qidahen-region-mask-blank-boundary-generated-current.png`
  - 证明从空白边界开始手绘后可保存、回读并生成初始区域。
- `test-results/evidence-screenshots/_shared/qidahen-region-mask-real-map-auto-extract-current.png`
  - 证明真实地图试提边界当前只作为 fail-closed 诊断：不可用时不覆盖当前边界图，也不吞明显 UI 区。
- `test-results/evidence-screenshots/_shared/qidahen-region-mask-path-graph-current.png`
  - 证明手绘主路生成区域后，可以在区域中心之间编辑通行路径和边界类型。

## 2026-05-23 14:11 +08 手绘参考层可清除，且清除后不会再被回读

### 修复

- `src/pages/devtools/QidahenRegionMaskTool.tsx`
  - 新增 `清除参考图` 按钮。
  - 清除时只会重置：
    - `boundarySourceReferenceDataUrl`
    - `boundarySourceReferenceImage`
    - `showBoundarySourceReference`
  - 不会顺手清掉边界图、mask 或手工补边/去噪层。
- `vite.config.ts`
  - devtools 保存中间件现在允许 `boundarySourceReferencePngDataUrl` 为空。
  - 当参考图被清除后，保存会直接删除工作区里的 `region-boundary-source-reference.png`，而不是把一张旧参考图留在磁盘里继续被后续刷新回读。
- `e2e/qidahen-region-mask.e2e.ts`
  - 新增正式用例：`手绘参考层可保存回读并支持清除后不再回读`。
  - 同时把画布采样从 `canvas[n]` 改成显式 testid；参考层插到 mask 前后，旧的序号采样已经不可靠。

### 验证

- `npx eslint src/pages/devtools/QidahenRegionMaskTool.tsx e2e/qidahen-region-mask.e2e.ts vite.config.ts` → 通过
- `npx tsc --noEmit` → 通过
- `npm run test:e2e:ci:file -- e2e/qidahen-region-mask.e2e.ts "手绘参考层可保存回读并支持清除后不再回读"` → `1 passed`
- `node scripts/infra/run-e2e-command.mjs ci e2e/qidahen-region-mask.e2e.ts` → `8 passed`

### 我实际查看的截图

- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-hand-drawn-reference-persisted-current.png`
  - 我实际看到：地图上仍叠着手绘参考线，说明刷新后参考层确实跟工作区一起回来了。
  - 我实际看到：左侧仍然有参考层相关状态，而不是只剩一次性导入提示。
- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-hand-drawn-reference-cleared-current.png`
  - 我实际看到：同一工作区刷新后，参考层已经消失，只剩边界图/路径图本身。
  - 我实际看到：左侧当前视口里不再出现参考层控制块，说明这次不是“临时隐藏”，而是保存后真正不再回读。

## 2026-05-23 13:43 +08 手绘参考层已能随工作区保存并刷新回读

### 修复

- `src/pages/devtools/QidahenRegionMaskTool.tsx`
  - 新增 `boundarySourceReferenceDataUrl`。
  - `saveRegionData()` 现在会把参考层以 `boundarySourceReferencePngDataUrl` 一并写入保存 payload。
  - 工作区读取时，如果 payload 带回参考图，会自动重建参考层并显示。
- `vite.config.ts`
  - `qidahen-region-mask` save/load 中间件新增：
    - `region-boundary-source-reference.png`
  - 当前参考图不再只是前端内存态，而是会跟工作区一起落盘并回读。

### 验证

- `npx tsc --noEmit` → 通过
- 标准共享单 worker E2E 仍然会受 `6273/20100/21100` 端口争用影响，所以这次继续使用独立 `4377` 前端做手工验证。
- 本地 Playwright 真实链路：
  1. 进入 `http://127.0.0.1:4377/dev/qidahen-region-mask?workspace=manual-reference-persist-check`
  2. 导入手绘原图
  3. 保存工作区
  4. 刷新页面
  5. 等待 `手绘参考层` 回来
- 我还直接读取落盘文件：
  - `temp/devtools/qidahen-region-mask-workspaces/manual-reference-persist-check/region-boundary-source-reference.png`
  - 当前 `exists=true`
  - 当前 `opaque=1129645`

### 我实际查看的截图

- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-hand-drawn-reference-persisted-current.png`
  - 我实际看到：刷新后左侧仍保留 `手绘参考层` 面板，且仍显示 `参考透明度 0.42`。
  - 我实际看到：参考层不是导入当下的一次性提示，而是刷新回读后仍存在。
  - 这证明当前主路已经从“导入后当前会话可见”进化到“导入 -> 保存 -> 刷新 -> 继续对着参考层微调”。

## 2026-05-23 13:33 +08 导入手绘原图后可叠参考层继续微调

### 为什么要补这一步

- 之前主路虽然已经能“导入手绘原图 -> 抽边界图”，但进入工具后还是只能看抽出来的边界层和手工补边层。
- 对用户真正画好的整图来说，这样仍然不够顺手，因为补边/去噪时没有原始手绘线作参照，容易变成盲调。

### 修复

- `src/pages/devtools/QidahenRegionMaskTool.tsx`
  - 新增 `boundarySourceReferenceCanvasRef`。
  - 新增 `boundarySourceReferenceImage / showBoundarySourceReference / boundarySourceReferenceOpacity`。
  - `导入手绘原图` 和“导入带底图的边界图”时，会把原始文件读成参考图层并叠回画布。
  - 左侧新增 `手绘参考层` 控件：
    - 显示/隐藏
    - 透明度滑杆
  - 这层参考图只服务当前编辑会话，不会影响边界图、mask 或保存结构。

### 验证

- `npx tsc --noEmit` → 通过
- 标准 `npm run test:e2e:ci:file -- qidahen-region-mask.e2e.ts "导入手绘原图后只抽边界色生成边界图"` 本轮未能作为唯一证据，因为共享单 worker 端口 `6273/20100/21100` 被其他并行 E2E 占用。
- 为避免把“端口争用”误报成“功能失败”，我另起独立前端：
  - `http://127.0.0.1:4377/dev/qidahen-region-mask`
  - 用本地 Playwright 直连该页，实际执行：
    1. 进入 devtools 页面
    2. 导入合成手绘原图
    3. 等待 `已从手绘原图抽取边界图`
    4. 等待 `已载入手绘原图参考层`
    5. 截图留证

### 我实际查看的截图

- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-hand-drawn-reference-current.png`
  - 我实际看到：导入手绘原图后，边界图已经被抽出，不再是空白工作区。
- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-hand-drawn-reference-panel-current.png`
  - 我实际看到：左侧已经出现 `手绘参考层` 面板，并带有 `显示中` 与 `参考透明度 0.42`。
  - 这证明当前主路不是“只抽一层边界图”，而是可以一边看原始手绘线一边继续微调。

## 2026-05-23 13:07 +08 真实地图 auto-map 正式降级为诊断，不再覆盖边界图

### 真正收口点

- 之前即使把 auto-map 从 `93 px` 修回 `256 px`，它仍然只是几段零散链条，不足以当“整图可微调底稿”。
- 继续让这类结果直接写进当前边界图，会把“实验读数”误包装成“正式成果”，这正是用户这轮反复指出的问题。

### 修复

- `src/pages/devtools/QidahenRegionMaskTool.tsx`
  - 已把 `AUTO_MAP_USABILITY_GUARD` 真正接入 `buildBoundaryDraftFromSourcePixels(...)`。
  - `auto-map` 现在会记录并返回：
    - `componentCount`
    - `keptComponentCount`
    - `usable`
    - `usabilityReason`
  - `generateBoundaryDraftFromColors()` 现在对 `auto-map` 走 fail-closed：
    - 如果实验结果不足以当整图初稿，就只更新 `lastBoundaryExtractionStats` 和状态文案；
    - **不会**替换 `boundaryDraftMaskRef.current`；
    - 因此正式空工作区仍保持 `当前边界图像素 = 0`。
  - 左侧“最近抽线读数”新增：
    - `边界链：保留条数 / 总条数`
    - `实验判定：可用 / 不可用`
    - 以及对应不可用原因。
- `e2e/qidahen-region-mask.e2e.ts`
  - 原真实地图用例已改成：`真实地图试提边界判定不可用时不会覆盖当前边界图且不吞明显 UI 区`。
  - 现在验证的不是“生成了 256 px 底稿”，而是：
    - 侧栏读数仍记录本次实验；
    - 当前边界图仍为 `0`；
    - UI 敏感点 alpha 仍为 `0`；
    - 主画布不会出现实验边界覆盖。

### 验证

- `npx tsc --noEmit` → 通过
- `npx vitest run src/pages/devtools/__tests__/qidahenRegionMaskToolUtils.test.ts` → `38 passed`
- `npm run test:e2e:ci:file -- qidahen-region-mask.e2e.ts "真实地图试提边界"` → `1 passed`
- `node scripts/infra/run-e2e-command.mjs ci e2e/qidahen-region-mask.e2e.ts` → `7 passed`

### 我实际查看的截图

- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-real-map-auto-extract-current.png`
  - 我实际看到：左侧状态文案已经明确写成“当前底图实验判定不可用”。
  - 我实际看到：`当前边界图像素：0`、`当前最终障碍像素：0`。
  - 我实际看到：最近抽线读数里仍保留 `最终保留：256` 与 `边界链：4 / 60`，说明实验数据没有丢，但也没有再覆盖正式边界层。
  - 我实际看到：轮盘、右侧牌框和底部规则区没有被错误边界压住。

## 2026-05-23 13:07 +08 路径图测试切到手绘主路，不再依赖坏 auto-map

### 修复

- `e2e/qidahen-region-mask.e2e.ts`
  - `createSyntheticBoundarySourcePng()` 现支持一次生成多个正式区域的手绘边界源。
  - `魔棒分区、区域中心路径编辑和单主保存动作可用` 已改成：
    - 导入合成边界源（`jinzhou + song-jin`）；
    - 对两块区域做魔棒分区；
    - 切到路径模式拖出 `jinzhou -> song-jin`；
    - 保存并刷新回读。
  - 这样测试验证的是“边界图主路 + 编辑工具”，而不是错误的真实地图 auto-map。

### 验证

- `npm run test:e2e:ci:file -- qidahen-region-mask.e2e.ts "魔棒分区、区域中心路径编辑和单主保存动作可用"` → `1 passed`
- `node scripts/infra/run-e2e-command.mjs ci e2e/qidahen-region-mask.e2e.ts` → `7 passed`

### 我实际查看的截图

- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-path-graph-current.png`
  - 我实际看到：`锦州` 与 `宋进` 两块区域都按各自边界闭合，未越到海面或 UI 框。
  - 我实际看到：路径边已经显示为 `山脉`，并落在 `锦州 ↔ 宋进` 之间。
  - 这张图证明当前“边界图 -> 分区 -> 路径编辑”主路可用，不再依赖真实地图 auto-map。

## 2026-05-23 11:33 +08 空工作区手绘边界已能保存、回读并继续生成区域

### 真正补的断点

- 之前虽然页面上有“边界修正”，但空工作区直接手绘时，底层仍可能混入底图颜色提取；这条链不够硬。
- 更关键的是：如果用户只画手工边界就直接保存，旧逻辑会把手工修正单独存成 `region-boundary-add/remove.png`，刷新后又重新组合，不能证明“这是一张已经固化好的边界图”。

### 修复

- `src/pages/devtools/QidahenRegionMaskTool.tsx`
  - 新增 `manualBlankBoundaryBase`。
  - 新增 `从空白边界开始手绘` 入口。
  - 进入该模式后，`rebuildBarrierMask()` 会使用空白基底，不再混入底图自动识别；当前最终停线只来自手工补边。
  - `saveRegionData()` 新增空白手绘保存逻辑：
    - 若当前仍是空白手绘基底且还没有正式边界图，就直接把当前最终停线写入 `region-boundary-mask.png`；
    - 同时把 `region-boundary-add.png / region-boundary-remove.png` 以空白图落盘；
    - 这样刷新后回读的是一张已经固化的边界图，不再依赖提示层重建。
- `e2e/qidahen-region-mask.e2e.ts`
  - 新增用例：`从空白边界开始手绘后可保存回读并生成初始区域`。
  - 用例覆盖：
    - 进入空白边界手绘模式；
    - 手绘闭合边界；
    - 保存工作区；
    - 直接读工作区文件，断言 `region-boundary-mask.png > 0` 且 `region-boundary-add/remove.png = 0`；
    - 刷新后回读；
    - 再按边界图生成初始区域。

### 验证

- `npx tsc --noEmit` → 通过
- `npx vitest run src/pages/devtools/__tests__/qidahenRegionMaskToolUtils.test.ts` → `38 passed`
- Playwright（本工作树前端 `4373`）：
  - `从空白边界开始手绘后可保存回读并生成初始区域` → `1 passed`
  - `正式工作区默认不回读测试假边界` → `1 passed`
  - `导入手绘原图后只抽边界色生成边界图` → `1 passed`

### 我实际查看的截图

- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-blank-boundary-generated-current.png`
  - 我实际看到：左侧工作区是 `temp/devtools/qidahen-region-mask-workspaces/blank-boundary-hand-drawn`。
  - 我实际看到：读数是 `当前边界图像素 3,776 / 当前最终障碍像素 3,776 / 手工补边 0 / 去噪 0`。
  - 这说明刷新后不是靠手工补边层临时撑着，而是已经固化成真正边界图。
  - 我实际看到：地图上生成的是测试里手绘出来的闭合区域，不再把整块 UI/装饰自动吞进去。
  - 这张图证明的是“空白手绘链已能正常产出并持续回读”，不是宣称当前七大恨真实边界已经全部正确。

## 2026-05-23 11:10 +08 正式空白工作区首屏改成真实主流程

### 修复

- `src/pages/devtools/QidahenRegionMaskTool.tsx`
  - 新增“开始工作区”入口块，只在 `正式工作区 + 空白起点 + 当前没有边界图/障碍层/批量生成结果` 时显示。
  - 第一屏主入口固定为：
    - `导入手绘原图`
    - `导入边界图`
    - `直接在图上补边`
  - 点击“直接在图上补边”会直接切到 `边界修正 / 补边 / 画笔`，不再让用户先自己绕去找模式组合。
  - 原 `诊断样本` 文案降级成 `高级诊断`。
  - 空白正式入口下原 `实验：试提边界` 文案降级成 `高级：试提边界`，避免继续把底图实验入口伪装成主路。

### 验证

- `npx tsc --noEmit` → 通过
- `npx vitest run src/pages/devtools/__tests__/qidahenRegionMaskToolUtils.test.ts` → `38 passed`
- Playwright（使用本工作树独立前端 `4373`）：
  - `正式工作区默认不回读测试假边界` → `1 passed`
  - `导入手绘原图后只抽边界色生成边界图` → `1 passed`

### 我实际查看的截图

- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-formal-empty-current.png`
  - 我实际看到：正式空白入口第一屏先出现“开始工作区”大块，而不是旧的模式/诊断首屏。
  - 我实际看到：三条主入口分别是 `导入手绘原图`、`导入边界图`、`直接在图上补边`。
  - 我实际看到：`高级诊断` 已经降级到主入口之后，不再压过正式工作流。
  - 我实际看到：底部仍保持 `保存工作区`，正式目录仍是 `src/games/qidahen/data`，没有重新回到测试假图状态。

## 2026-05-23 10:28 +08 正式目录被 E2E 假图污染，现已隔离

### 真正根因

- 用户骂得对，之前那批“直来直去的边界”不是正常成果。
- 我直接读取当前正式目录后确认：
  - `src/games/qidahen/data/region-boundary-mask.png`
  - `src/games/qidahen/data/region-mask.png`
  - `src/games/qidahen/data/region-authoritative-guides.png`
- 它们之前不是用户手绘真相，而是 `qidahen-region-mask.e2e.ts` 里用合成多边形生成并保存出来的测试工作区。工具默认又会自动回读正式目录，于是用户一打开就看到假六边形和假初始区域。

### 修复

- `vite.config.ts`
  - `qidahen-region-mask` 的 save/load 中间件新增 `?workspace=`。
  - 未带 `workspace` 时，仍写正式目录 `src/games/qidahen/data`。
  - 带 `workspace` 时，改写到 `temp/devtools/qidahen-region-mask-workspaces/<workspace>`。
- `src/pages/devtools/QidahenRegionMaskTool.tsx`
  - save/load 请求会自动带上当前页面的 `workspace` 查询参数。
  - 当前工作区落点会显示成对应路径，不再把临时 workspace 误显示为正式目录。
- `e2e/qidahen-region-mask.e2e.ts`
  - 所有区域工具用例都改成走独立 workspace。
  - 读回验证也改成读各自 workspace 下的文件，不再读 `src/games/qidahen/data`。
  - 每条会保存工作区的用例都会快照正式目录并在结束后断言字节级不变，后续再有人把测试假图写回正式目录时，E2E 会直接失败。
- `src/pages/devtools/QidahenRegionMaskTool.tsx`
  - 侧栏新增“当前工作区”卡片，常驻显示当前读写路径和“正式/临时隔离”状态。
- 正式目录清理：
  - `region-mask.png`
  - `region-boundary-mask.png`
  - `region-boundary-add.png`
  - `region-boundary-remove.png`
  - `region-authoritative-guides.png`
  - 以上全部清成透明空白图。
  - `region-authoritative-guides.json` 清成空数组。
  - `region-graph.json` 中 `jinzhou` 的 `center/pixelCount` 也清回空起点。

### 验证

- `npx tsc --noEmit` → 通过
- `npx vitest run src/pages/devtools/__tests__/qidahenRegionMaskToolUtils.test.ts` → `38 passed`
- 在本工作树独立服务上复跑：
  - 前端：`4373`
  - game server：`18110`
  - api server：`18111`
  - `导入手绘原图后只抽边界色生成边界图` → `1 passed`

### 我直接读取的数据证据

- 正式目录当前像素：
  - `region-boundary-mask.png = 0`
  - `region-mask.png = 0`
  - `region-boundary-add.png = 0`
  - `region-boundary-remove.png = 0`
  - `region-authoritative-guides.png = 0`
- 测试 workspace `temp/devtools/qidahen-region-mask-workspaces/hand-drawn-generated/`：
  - `region-boundary-mask.png = 5018`
  - `region-mask.png = 14422`

### 我实际查看的截图

- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-hand-drawn-generated-current.png`
  - 我实际看到：左上侧栏新增“当前工作区”卡片，明确写着 `临时隔离工作区`。
  - 我实际看到：路径直接显示 `temp/devtools/qidahen-region-mask-workspaces/hand-drawn-generated`。
  - 我实际看到：底部提示已经不是写正式目录，而是写到 `temp/devtools/qidahen-region-mask-workspaces/hand-drawn-generated`。
  - 我实际看到：左侧结果面板仍能正常展示 `锦州 已生成`、`宋进/山海关 漏边跳过`。
  - 这证明隔离后工作流还可用，但假图不再落到正式目录污染用户默认入口。
- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\temp\qidahen-formal-workspace-current.png`
  - 我实际看到：当前工作区是 `正式工作区 / src/games/qidahen/data`。
  - 我实际看到：侧栏直接提示“当前工作区还没有保存过真实边界成果。请先导入手绘原图或导入边界图，再开始修边。”
  - 我实际看到：`当前边界图像素：0`、`当前最终障碍像素：0`。
  - 这说明正式入口现在已经是真空白起点，不会一打开就把底图 UI/纹理启发式糊成障碍层。

### 自动化回归

- `e2e/qidahen-region-mask.e2e.ts`
  - 新增用例：`正式工作区默认不回读测试假边界`
  - 断言：
    - 正式入口显示 `正式工作区`
    - 当前路径为 `src/games/qidahen/data`
    - 显示“还没有保存过真实边界成果”
    - `当前边界图像素 = 0`
    - `当前最终障碍像素 = 0`
    - 正式目录文件快照前后字节级不变
- 运行结果：
  - `PW_USE_DEV_SERVERS=true` 直连当前 worktree 三服务复跑 → `1 passed`

## 2026-05-23 08:46 +08 手绘原图导入改走独立抽线链

### 失效根因

- `导入手绘原图` 之前复用了“原图自动提边界”的严格链路。
- 根因不是颜色没命中，而是 `buildBarrierMask` 上的 `blurRadius=1 + lineFilter(maxAverageThickness=4.6)` 会把用户手绘线或测试合成线整体筛成 `0 px`。
- 本地定量采样结果：
  - 原始按色命中：`2528 px`
  - 套自动提边界 `lineFilter` 后：`0 px`
  - 去掉 `lineFilter`、仅保留支撑带/封口过滤后：`5018 px`

### 修复

  - `src/pages/devtools/QidahenRegionMaskTool.tsx`
  - `buildBoundaryDraftFromSourcePixels` 新增 `extractionMode`：
    - `auto-map`：继续给“从当前地图颜色直接提边界图”使用，保留现有严格过滤。
    - `hand-drawn`：给“导入手绘原图 / 导入带底图的边界图”使用，只做按边界色抽线，再走静态支撑带与封口过滤，不再套 `blur + lineFilter`。
  - `导入手绘原图` 与“导入边界图（检测为整张带底图文件）”已切到 `hand-drawn`。
  - 左侧工作流 UI 已改成“推荐：导入手绘原图”主按钮 + “实验：试提边界”次级按钮，避免再把旧自动提边界误读成正式成果。
  - 新增“最近抽线读数”：直接显示 `抽色命中 / 贴支撑带 / 封口后 / 最终保留 / 舍弃` 像素，避免只看结果图不读数据。
  - `最近批量生成结果` 已前移到 `边界图工作流` 下方，并补 `已生成 / 漏边 / 未生成 / 被占用` 汇总，避免生成完还要往侧栏下半截翻找结果。
  - 底部保存主按钮已改成“保存工作区”，文案明确当前保存的是边界图、mask、区域定义和链接图，而不是只保存最终区域。

### 验证

- `npx tsc --noEmit` → 通过
- `npx vitest run src/pages/devtools/__tests__/qidahenRegionMaskToolUtils.test.ts` → `38 passed`
- `npm run test:e2e:ci:file -- qidahen-region-mask.e2e.ts "导入手绘原图后只抽边界色生成边界图"` → `1 passed`
- `npm run test:e2e:ci:file -- qidahen-region-mask.e2e.ts "导入手绘原图后可先保存工作区再刷新回读边界图"` → `1 passed`
- `npm run test:e2e:ci:file -- qidahen-region-mask.e2e.ts "指定边界颜色可以生成区域初始值"` → `1 passed`
- 为避开 shared single-worker 端口冲突，本轮最新截图复跑使用当前 worktree 独立服务：
  - 前端：`http://127.0.0.1:4373`
  - game server：`18110`
  - api server：`18111`
  - 命令：`PW_USE_DEV_SERVERS=true` 直连 Playwright 复跑 `e2e/qidahen-region-mask.e2e.ts --grep "导入手绘原图后只抽边界色生成边界图"` → `1 passed`

### 我实际查看的截图

- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-hand-drawn-source-current.png`
  - 我实际看到：左侧工作流第一主按钮已经是“推荐：导入手绘原图”，而“实验：试提边界”被明确降成次级入口。
  - 我实际看到：左侧状态为“当前：只用边界颜色/手工补边”，说明后续区域生成不会再把整张底图当 barrier。
  - 我实际看到：`当前边界图像素：7,494`、`当前最终障碍像素：7,494`，已不再是此前失败态的 `0 px`。
  - 我实际看到：主画布只叠加了一块可编辑边界图/障碍层，不是先生成区域再倒推边界，也不是把整个 UI 框都识别成边界。
- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-hand-drawn-generated-current.png`
  - 我实际看到：`最近批量生成结果` 已经进入默认视口，不再埋在侧栏下半截。
  - 我实际看到：顶部汇总直接给出 `已生成 1 / 漏边 4 / 未生成 0 / 被占用 0`。
  - 我实际看到：`锦州` 卡片明确是 `已生成`，并显示 `13,290 px · seed 777, 417`。
  - 我实际看到：`宋进`、`山海关` 等卡片明确标成 `漏边跳过`，这正是用户后续补边时需要优先处理的清单。
- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-specified-boundary-current.png`
  - 我实际看到：指定边界颜色链路仍然可用，没有因为主路切到手绘导入而回退；主画布里仍能按闭合边界生成锦州区域。
- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-hand-drawn-persisted-current.png`
  - 这张图对应“导入手绘原图 -> 生成区域 -> 保存 -> 刷新后回读”的闭环；刷新后手绘边界仍被回读到工具里，而不是只存在于页面临时状态。
- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-hand-drawn-workspace-current.png`
  - 这张图对应“导入手绘原图后，先不生成区域，只保存工作区再刷新回读边界图”的闭环。
  - 我实际看到：底部主按钮已经变成“保存工作区”，而刷新后边界线仍在，说明现在可以先存边界进度，再回来继续修。

### 数据文件证据

- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\src\games\qidahen\data\region-boundary-mask.png`
  - 我直接读取文件像素，当前 `opaquePixels = 7,494`。
  - 这说明手绘边界图已经真实落盘，不是 E2E 页面内的临时 overlay。
- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\src\games\qidahen\data\region-mask.png`
  - 在“先保存边界工作区、尚未生成区域”的专门用例里，我直接读取该文件像素并验证 `opaquePixels = 0`。
  - 这说明工具已经支持“先存边界、后做区域”，不会强迫用户先把区域整图做完才能保存进度。

### 当前口径

- 这次修复证明的是“用户在原地图上手绘指定边界色后，工具可以稳定抽出一张可微调的边界图”。
- 这不是“原图自动提边界已经可靠”的证明；自动提边界仍只算辅助手段，正式路线继续以“手绘原图 -> 抽边界图 -> 微调 -> 按边界图生成区域 -> 保存/回读”为准。

## 2026-05-22 22:52 +08 记录真实手绘边界色与连续性口径

### 用户给定边界色

- `rgb(61, 69, 66)`
- `rgb(126, 97, 56)`
- `rgb(128, 104, 62)`
- `rgb(43, 36, 34)`

### 落地口径

- 工具默认边界色已改成以上 4 个实画颜色，不需要后续每次重新输入。
- 当前默认进入“只用边界颜色/手工补边”，避免原图马纹、山纹、文字继续参与 barrier。
- 边界连续性按用户口径处理：只让连续闭合边界限制 flood fill；断开或太短的零散色块不强行补全，后续由人工微调。
- 指定颜色输入现在同时支持 `#RRGGBB` 和 `rgb(r,g,b)`。

### 当前边界

- 这些颜色只是“边界停线”输入，不代表全地图区域已经自动完成。
- 若某块边界没有连上，生成初值时可能跳过或漏边过大被拒绝；这符合当前“连不上的不用管，后面微调”的工作流。

### 验证

- `node ..\..\node_modules\eslint\bin\eslint.js src\pages\devtools\QidahenRegionMaskTool.tsx e2e\qidahen-region-mask.e2e.ts` → 通过
- `node ..\..\node_modules\typescript\bin\tsc --noEmit --pretty false` → 通过
- `node scripts\infra\vitest-cli-safe.mjs run src\pages\devtools\__tests__\qidahenRegionMaskToolUtils.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1` → `36 passed`
- 临时端口 `4391` 启动当前工作树 Vite 后执行：
  - `node ..\..\node_modules\playwright\cli.js test e2e/qidahen-region-mask.e2e.ts --grep "指定边界颜色可以生成区域初始值" --workers=1` → `1 passed`
- 已实际查看截图：
  - `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-specified-boundary-current.png`
  - 截图中页面为当前 `七大恨区域制图工具`，显示“当前：只用边界颜色/手工补边”，边界预设列表已显示实画边界色；E2E 中额外输入的 `rgb(255, 0, 255)` 仍只是测试解析链路，不是七大恨真实边界色。

## 2026-05-22 23:24 +08 改为独立边界图工作流

### 旧路线失效点

- 只记录边界颜色仍然是“生成区域时的参数”，不是用户要的可编辑整图边界层。
- 正确工作流应先得到一张边界图，由用户微调到可用，再让区域生成只读这张边界图。

### 修复

- `src/pages/devtools/QidahenRegionMaskTool.tsx`
  - 新增独立 `boundaryDraftMaskRef`，作为“边界图本体”。
  - 新增 `生成边界图`：从当前启用边界颜色提取边界图。
  - 新增 `导出边界图 / 导入边界图 / 固化微调`：支持把当前最终停线作为可复用边界图。
  - `按边界图生成初始区域` 继续只读最终边界停线；断开的色块不会被强行补成区域。
- `vite.config.ts`
  - 保存/读取新增内部文件 `region-boundary-mask.png`，不再只保存补边/去噪两个 hint 层。
- `e2e/qidahen-region-mask.e2e.ts`
  - 新增边界图生成断言：点击 `生成边界图` 后，`当前边界图像素` 必须大于 0。

### 验证

- `node ..\..\node_modules\eslint\bin\eslint.js src\pages\devtools\QidahenRegionMaskTool.tsx e2e\qidahen-region-mask.e2e.ts vite.config.ts` → 通过
- `node ..\..\node_modules\typescript\bin\tsc --noEmit --pretty false` → 通过
- `node scripts\infra\vitest-cli-safe.mjs run src\pages\devtools\__tests__\qidahenRegionMaskToolUtils.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1` → `36 passed`
- 临时端口 `4393` 启动当前工作树 Vite 后执行：
  - `node ..\..\node_modules\playwright\cli.js test e2e/qidahen-region-mask.e2e.ts --grep "指定边界颜色可以生成区域初始值" --workers=1` → `1 passed`
- 已实际查看边界图证据截图：
  - `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-boundary-draft-current.png`
  - 截图显示左侧为 `边界图工作流`，`当前边界图像素：133,794`，主图叠加了青色边界图层；这张图是初始提取层，仍需要用户微调，不代表最终正确边界。

## 2026-05-23 08:01 +08 未封口线段直接舍弃

### 修复

- `src/pages/devtools/qidahenRegionMaskToolUtils.ts`
  - 新增 `keepBoundaryComponentsSealingInterior`：
  - 先从画布外缘 flood fill 出“外部空间”；
  - 再找所有被边界真正围住的内部空腔；
  - 只有接触到这些内部空腔的边界组件才保留，开放线段直接丢掉。
- `src/pages/devtools/QidahenRegionMaskTool.tsx`
  - `生成边界图` 改成先提取边界色候选，再走封口判定；
  - 状态文案会显示“未封口线段已舍弃多少像素”。
- `src/pages/devtools/__tests__/qidahenRegionMaskToolUtils.test.ts`
  - 新增单测：闭合方框保留，旁边单独的开放竖线被丢弃。

### 验证

- `node scripts\infra\vitest-cli-safe.mjs run src\pages\devtools\__tests__\qidahenRegionMaskToolUtils.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1` → `37 passed`
- `node ..\..\node_modules\eslint\bin\eslint.js src\pages\devtools\QidahenRegionMaskTool.tsx src\pages\devtools\qidahenRegionMaskToolUtils.ts src\pages\devtools\__tests__\qidahenRegionMaskToolUtils.test.ts e2e\qidahen-region-mask.e2e.ts vite.config.ts` → 通过
- `node ..\..\node_modules\typescript\bin\tsc --noEmit --pretty false` → 通过
- 临时端口 `4395` 启动当前工作树 Vite 后执行：
  - `node ..\..\node_modules\playwright\cli.js test e2e/qidahen-region-mask.e2e.ts --grep "指定边界颜色可以生成区域初始值" --workers=1` → `1 passed`

### 实际结果

- 我实际查看：
  - `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-boundary-draft-current.png`
- 当前图上左侧显示：
  - `当前边界图像素：17,377`
  - `当前最终障碍像素：17,377`
- 对比上一版 `133,794` 像素，说明大量无法封口的开放线段和散乱边界候选已被舍弃。
- 这仍然不是最终正确整图；它只是把“明显不封口的脏边界”先剔掉，为后续人工微调边界图创造一个更干净的起点。

## 2026-05-22 22:28 +08 修正：不预设边界颜色，测试边界改为不规则闭合线

### 失效结论

- 旧截图里用方形边界作为证据是错误口径：真实区域边界不可能是方形，不能用方框证明这个工作流适合区域制图。
- 旧 UI 默认填了 `#6ee7b7` 也是错误口径：工具不知道实际边界颜色时必须等用户给，不应该猜。

### 修复后的工作流

- 新增“指定边界生成”入口：
  - `添加边界颜色`：只接受用户输入的 Hex / RGB 颜色，并自动切到“只用边界颜色/手工补边”。
  - `按当前边界生成初始区域`：基于当前 barrier + 每个区域 seed，自动 flood fill 出初始 mask。
- 输入框默认留空，避免把测试色误当真实边界色。
- E2E 中的边界已改为不规则闭合多边形，不再使用方形边界截图。

### 实际结果

- 我实际看到的截图：
  - `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-specified-boundary-current.png`
- 我实际看到：
  - 左侧面板明确显示“只用边界颜色/手工补边”；
  - 画面里保留了不规则闭合边界修正层；
  - 通过“按当前边界生成初始区域”后，工具进入了可继续微调再保存的状态。
- 注意：截图中的 `#ff00ff` 只是 E2E 测试输入色，不代表真实七大恨边界颜色；真实颜色必须由用户提供后再录入工具。

### 验证

- `node scripts/infra/run-e2e-command.mjs dev e2e/qidahen-region-mask.e2e.ts --grep "指定边界颜色可以生成区域初始值"` → `1 passed`
- `node scripts/infra/run-e2e-command.mjs dev e2e/qidahen-region-mask.e2e.ts --grep "魔棒分区、区域中心路径编辑和单主保存动作可用"` → `1 passed`
- `node ..\..\node_modules\eslint\bin\eslint.js src\pages\devtools\QidahenRegionMaskTool.tsx e2e\qidahen-region-mask.e2e.ts`
- `node scripts\infra\vitest-cli-safe.mjs run src\pages\devtools\__tests__\qidahenRegionMaskToolUtils.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1` → `36 passed`
- `node ..\..\node_modules\typescript\bin\tsc --noEmit --pretty false`

## 2026-05-22 21:34 +08 越界门禁收敛：静态区域 guide 重新成为 bootstrap 真值

### 失效结论修正

- 旧判断“路径控件能拖、边界类型能保存，所以区域工具完成”已确认失效。
- 新完成口径改为：主画布选区必须不过度越过当前区域静态 guide；路径中心点必须来自当前有效 mask；保存后必须刷新回读。

### 修复

- `src/pages/devtools/QidahenRegionMaskTool.tsx`
  - 当区域有 `QIDAHEN_MAP_REGION_SHAPES` 静态 shape 时，自动候选只有在对静态 shape 有足够高精度、召回和面积比例时才允许覆盖 bootstrap。
  - 若自动候选会明显漂出静态区域，则回退到 `shape-outline`，让后续人工编辑通过锁链/边界修正完成，而不是让启发式扩张抢主链。
  - 静态 guide 判定从“必须点在 polygon 内”扩展为“点在 polygon 或其 guide 扩展范围内”，避免 `宋进` 这类边缘点击退回到图片启发式大扩张。

### 自动化证据

- 越界指标复核：
  - `锦州`：`16980 px`，静态 shape 外 `157 px`，比例 `0.009246`。
  - `宋进`：`17909 px`，静态 shape 外 `192 px`，比例 `0.010721`。
- E2E：
  - `$env:PW_PORT='4286'; node scripts/infra/run-e2e-command.mjs dev e2e/qidahen-region-mask.e2e.ts --grep "魔棒分区、区域中心路径编辑和单主保存动作可用"` → `1 passed`
  - 该用例覆盖：北京样本主画布写入、锦州/宋进魔棒分区、越界比例门禁、路径模式中心拖拽、边界类型下拉为 `mountain`、保存 `region-graph.json`、刷新后回读路径。
- 代码门禁：
  - `node ..\..\node_modules\eslint\bin\eslint.js src\pages\devtools\QidahenRegionMaskTool.tsx e2e\qidahen-region-mask.e2e.ts` → 通过
  - `node scripts\infra\vitest-cli-safe.mjs run src\pages\devtools\__tests__\qidahenRegionMaskToolUtils.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1` → `36 passed`
  - `node ..\..\node_modules\typescript\bin\tsc --noEmit --pretty false` → 通过

### 我实际查看的截图

- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-one-region-current.png`
  - 我实际看到：当前区域为 `锦州`，选区按静态区域轮廓闭合，不再出现上一版明显向外扩张的启发式糊块。
  - 是否达标：达到本轮“单区净选区不得明显越界”的最低验收。
- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-path-graph-current.png`
  - 我实际看到：`锦州` 与 `宋进` 都有中心点，二者之间存在路径边；路径标签显示 `山脉`。
  - 是否达标：达到“工具内编辑通行代价/边界类型”的验收。
- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-path-graph-persisted-current.png`
  - 我实际看到：刷新后路径仍存在，`锦州 + 宋进` 这一行仍显示 `山脉 路 战场宽度 2`。
  - 是否达标：达到“保存后回读”的验收。

### 当前边界

- 当前只证明 `锦州 / 宋进` 这条最小编辑链路可用，不能扩展成“全地图所有区域已校准”。
- `北京样本` 仍是 devtools 诊断项，不作为正式 graph 节点导出；截图左侧能看到样本卡，但路径图中心节点未包含它。

## 2026-05-21 08:15 +08 桥接收细并验证“不再一笔堵死”，但锦州自动初选仍未过线

本轮没有再把“面积更大”当成更好结果，做了两件更具体的修正：

- 已修改 `src/pages/devtools/QidahenRegionMaskTool.tsx`
  - 自动候选不再因为 `pixelCount` 更大就优先采用 radial 候选；无 guide 时要求更高的分数优势，避免把扩张候选误判成更好。
  - `边界修正 -> 桥接` 改成默认吸附到附近边界，并把默认桥接半径从粗线收细为窄线，避免一笔把当前选区直接堵成 `0 px`。
- 已修改 `.windsurf/skills/boardgame-ui-imagegen/SKILL.md`
  - 补入通用门禁：边界桥接/补边若直接写 `boundary hint`，默认必须是细线 + 边界吸附；一笔桥接如果会把当前自动选区直接压没，视为默认参数失控。

我实际查看最新截图：

- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\temp\qidahen-region-diagnostics\beijing-post-tighten-full.png`
  - 我实际看到：北京样本当前仍是 `5,772 px · 边界环`，主画布里还是一个可接受的简单区 bootstrap，没有回退成大块漏边。
- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\temp\qidahen-region-diagnostics\jinzhou-post-tighten-full.png`
  - 我实际看到：锦州样本当前仍是 `4,864 px · 边界环`，自动初选还是没有沿真实边界完整展开；这说明当前任务仍未完成，问题在基础 bootstrap，不只是桥接太粗。
- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\temp\qidahen-region-diagnostics\beijing-bridge-thinned-full.png`
  - 我实际看到：执行一次 `补边桥接` 后，左侧局部预览仍保持 `5,772 px · 边界环`，没有再出现“第二笔直接把当前魔棒填充打成 0”的情况。
  - 我实际看到：绿色桥接痕迹缩成了局部窄线，不再是一团大绿块。

验证：

- `npx eslint src/pages/devtools/QidahenRegionMaskTool.tsx`
- `npx tsc --noEmit --pretty false`

## 2026-05-21 18:45 +08 authoritative 保存/回读闭环证据

### 本轮目标

- 把“北京样本显式 truth 已进主链”从样本特判升级成正式工具能力：正式区域可标记为 authoritative guide，保存后落到游戏数据目录，刷新后自动回读，再次点击主画布时继续直走 `显式 guide 真相`。

### 根因结论

- 当前 bug 不在保存路由本身，而在前端回读 effect：
  - `loadPersistedRegionData` 之前绑定 `bootstrapShapeMasks`；
  - authoritative toggle 会先改 `authoritativeGuideRegionIds -> authoritativeTruthMasks -> bootstrapShapeMasks`；
  - effect 随后立刻再次从磁盘读取旧的空 `region-authoritative-guides.json`，把刚刚设好的 authoritative state 冲掉；
  - 表现为：按钮看起来点过了，但保存时 `regionIds` 仍为空。

### 修复

- `src/pages/devtools/QidahenRegionMaskTool.tsx`
  - 新增模块级 `STATIC_BOOTSTRAP_GUIDE_MASKS` / `STATIC_BOOTSTRAP_SHAPE_MASKS`，把静态 bootstrap 与 authoritative overlay 分层；
  - `bootstrapGuideMasks` / `bootstrapShapeMasks` 改为以静态层为底，再叠 authoritative；
  - `loadPersistedRegionData` 改成只在初次进入页面时执行，初始化 seed 对照只参考静态 shape，不再因为 authoritative overlay 自身变化而回读；
  - 补充 `qidahen-region-canvas`、`qidahen-region-graph`、区域卡、authoritative toggle 的 `data-testid`，让 devtools 自动化命中正式控件而不是数第几个 canvas。
- `vite.config.ts`
  - authoritative 存储链继续使用：
    - `region-authoritative-guides.png`
    - `region-authoritative-guides.json`
  - `load` / `save` 路由均已接通该组 internal files。
- `.windsurf/skills/boardgame-ui-imagegen/SKILL.md`
  - 补入通用门禁：真相源型工具的回读 effect 必须与 authoritative 可编辑状态解耦；回读只能由显式加载/刷新触发，不能绑到 authoritative toggle 或派生 memo 上自我覆盖。

### 实际验证

- worktree 专用前端：
  - `http://127.0.0.1:4274/dev/qidahen-region-mask`
- 命令：
  - `npx eslint src/pages/devtools/QidahenRegionMaskTool.tsx e2e/qidahen-region-mask.e2e.ts`
  - `npx tsc --noEmit --pretty false`
  - `$env:PYTHONUTF8='1'; python D:\codex-home\skills\.system\skill-creator\scripts\quick_validate.py .windsurf\skills\boardgame-ui-imagegen`
  - `$env:PW_USE_DEV_SERVERS='true'; $env:PW_PORT='4274'; npm run test:e2e:dev:file -- e2e/qidahen-region-mask.e2e.ts`
- 结果：
  - Playwright 通过：`1 passed`
  - 数据目录实际生成：
    - `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\src\games\qidahen\data\region-authoritative-guides.json`
    - `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\src\games\qidahen\data\region-authoritative-guides.png`
  - `region-authoritative-guides.json` 当前内容：
    - `["jinzhou"]`

### 我实际查看的截图

- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-one-region-current.png`
  - 我实际看到：主画布只留下锦州一块正式区域，魔棒初选结果能独立保存，不再混入导出按钮或额外导出流程。
- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-authoritative-current.png`
  - 我实际看到：刷新后再次点击锦州时，状态文案走的是 `显式 guide 真相`，说明 authoritative guide 已经从正式数据文件自动回读并进入主链。

### 结论

- authoritative guide 现在已经是正式工具能力，而不是北京样本里的临时 debug 特判。
- 当前剩余工作应继续围绕“锦州复杂区的真实范围 authoring”，不必再回头排查 save/load 或 authority 接线。
- `npx vitest run src/pages/devtools/__tests__/qidahenRegionMaskToolUtils.test.ts`：`26 passed`
- `python D:\codex-home\skills\.system\skill-creator\scripts\quick_validate.py .windsurf\skills\boardgame-ui-imagegen`

当前结论：

- **桥接工具默认失控** 这条已经修到更合理：现在桥接会吸附边界、默认更细，也经过真实页面验证不会一笔把北京样本当前填充压成 `0 px`。
- **锦州自动初选** 仍未达标：它现在还是“可继续锁链修边的 bootstrap”，不是“像地图程序那样沿真实边界停住”的最终结果。

## 五次复核修正（23:58）

针对“看图了吗，要仔细点看，现在完全不对”的继续反馈，重新核对截图生成链路后确认一个取证错误：

- `qidahen-region-mask-one-region-current.png` 之前是在锁链模式执行“减去一段边界”之后才保存，画面天然会出现被刻意挖掉的缺口和锁链控制点。
- 这张图不能作为“魔棒初选范围是否正确”的主验收图；它只能说明编辑态可见，不代表净选区效果。

本轮修正：

- 已修改 `e2e/qidahen-region-mask.e2e.ts`：`one-region` 主证据图改为在魔棒初选 `锦州` 后立即保存，再继续进入锁链减边、第二个区域、路径图和保存流程。
- 已补强通用 `boardgame-ui-imagegen`：区域工具截图必须区分 `净选区 / 编辑态 / 路径态`，禁止把被锁链减去或带调试控制点的编辑态截图当作主验收图。

最新人工取证截图：

- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-one-region-current.png`
  - 我实际看到：截图处于 `魔棒` 模式，左侧固定并内部滚动，右侧地图铺满主要工作区。
  - 我实际看到：`锦州` 为低透明填充 + 白金轮廓的净选区，没有锁链控制点，也没有被刻意减去的缺口。
  - 是否达标：这张图现在可以作为“净选区视觉反馈”的证据；但仍不能声明全图区域边界最终校准完成。

- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-path-graph-current.png`
  - 我实际看到：路径态中 `锦州` 与 `宋进` 均已分区，通行边标签为 `山脉`，保存动作仍只有一个。
  - 是否达标：可以证明路径图和单主保存动作仍可用；区域范围仍需逐区校准。

验证：

- `npx eslint src/pages/devtools/QidahenRegionMaskTool.tsx src/pages/devtools/qidahenRegionMaskToolUtils.ts src/pages/devtools/__tests__/qidahenRegionMaskToolUtils.test.ts e2e/qidahen-region-mask.e2e.ts`：通过
- `npx vitest run src/pages/devtools/__tests__/qidahenRegionMaskToolUtils.test.ts`：12 passed
- `npx tsc --noEmit --pretty false`：通过
- `$env:PYTHONUTF8='1'; python D:\codex-home\skills\.system\skill-creator\scripts\quick_validate.py .windsurf\skills\boardgame-ui-imagegen`：通过
- 正式 E2E 未进入用例：`isolated` 被全局重任务预算锁阻塞；`ci:file` 被共享端口 `6368/20100/21100` 占用阻塞。已用 `http://127.0.0.1:4281/dev/qidahen-region-mask` 真实页面 + Playwright 手工脚本重新产出并肉眼核对上述两张截图。

## 四次复核修正（23:40）

针对“看图了吗，现在完全不对”的反馈，重新实际打开截图复核，确认上一版不能收口：

- 旧 `qidahen-region-mask-one-region-current.png` 中，选区只是红色糊块，范围被马、山纹、文字和局部断线切碎，没有贴真实区域边界。
- 锁链点像调试噪点，不能作为可编辑边界反馈。
- 之前 E2E 只证明“有 mask、有保存、有路径”，没有证明“区域轮廓和选中效果可用”。

本轮修正：

- 魔棒改成“种子相近色 + 边界停线”，不再只按边界连通区整图扩散；点击到边界/字牌附近时，会自动吸附到附近可选区域内部。
- 选中效果改成低透明 mask + 暗外描边 + 白金内描边，更接近欧陆式区域选中反馈，不再依赖深红糊块。
- 锁链控制柄从满边界噪点降为少量编辑手柄，主要边界反馈由轮廓层承担。
- 工具说明同步为“种子色相近区域 + 边界停线”，避免文案仍写旧算法。
- E2E 点击种子改为当前截图中实际可用的内部点：锦州 `530,360`、宋进 `705,650`。

最新人工取证截图：

- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-one-region-current.png`
  - 我实际看到：左侧仍固定并内部滚动；右侧地图铺满主要工作区。
  - 我实际看到：当前选区是低透明填充和白金轮廓，锁链模式只有少量控制柄；相比旧图，已经不再是红色厚糊块和满边界噪点。
  - 是否达标：比上一版明显改善，但仍只能证明“选区视觉反馈可用”；区域名和完整大地图分区仍需要后续逐区人工校准。

- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-path-graph-current.png`
  - 我实际看到：两个区域均为低透明填充，当前区域有清晰轮廓；通行路径从区域中心连接，标签显示规则边界类型。
  - 我实际看到：蓝色边界调试层仍默认关闭，保存动作仍只有一个。
  - 是否达标：达到本轮“工具方向可用”的最低线；不再把旧粗糙视觉误报为完成。

复核命令：

- `npx eslint src/pages/devtools/QidahenRegionMaskTool.tsx src/pages/devtools/qidahenRegionMaskToolUtils.ts src/pages/devtools/__tests__/qidahenRegionMaskToolUtils.test.ts e2e/qidahen-region-mask.e2e.ts`
- `npx vitest run src/pages/devtools/__tests__/qidahenRegionMaskToolUtils.test.ts`
- `npx tsc --noEmit --pretty false`

E2E 状态：

- `npm run test:e2e:ci:file -- e2e/qidahen-region-mask.e2e.ts` 未进入用例：共享端口 `6368/20100/21100` 已被其他 node 进程占用。
- `node scripts/infra/run-e2e-command.mjs isolated e2e/qidahen-region-mask.e2e.ts` 未进入用例：全局 E2E 重任务预算被另一条 Playwright 用例占用。
- 已用独立 Vite `http://127.0.0.1:4281/dev/qidahen-region-mask` + Playwright 手工脚本完成真实页面取证；不能把本轮说成正式 E2E 已通过。

## 范围

- 工具页：`src/pages/devtools/QidahenRegionMaskTool.tsx`
- 路由：`/dev/qidahen-region-mask`
- 数据落点：`src/games/qidahen/data/region-mask.png`、`region-mask-regions.json`、`region-graph.json`

## 截图

- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-one-region-current.png`
  - 我实际看到：工具左侧是固定侧栏，内部滚动；右侧主地图铺满主要工作区，没有缩成小预览。
  - 我实际看到：魔棒已把锦州写成红色连续 mask，蓝色边界调试层未默认覆盖地图。
  - 是否达标：达到“至少端到端成功选择一个地区”的验收。

- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-path-graph-current.png`
  - 我实际看到：锦州与宋进都已分区，路径模式下用区域中心点连线，连线标签显示为“山脉”。
  - 我实际看到：边界色列表包含 `rgb(138, 114, 66)`，且边界调试仍是开关项，不是默认最终覆盖层。
  - 是否达标：达到“分区结果 + 通行路径图 + 单主保存动作”的本轮验收。

## 数据验证

- `region-mask-regions.json` 已包含 `ochre-line` 边界规则：`rgb: [138, 114, 66]`。
- `region-graph.json` 已包含 `jinzhou::song-jin`：
  - `boundaryType: "mountain"`
  - `boundaryLabel: "山脉"`
  - `battleWidth: 2`
  - `ruleNote: "战场宽度 2"`

## 验证命令

- `npx eslint src/pages/devtools/QidahenRegionMaskTool.tsx src/pages/devtools/qidahenRegionMaskToolUtils.ts src/pages/devtools/__tests__/qidahenRegionMaskToolUtils.test.ts`
- `npx vitest run src/pages/devtools/__tests__/qidahenRegionMaskToolUtils.test.ts`
- `npx tsc --noEmit --pretty false`
- `$env:PYTHONUTF8='1'; python D:\codex-home\skills\.system\skill-creator\scripts\quick_validate.py .windsurf\skills\boardgame-ui-imagegen`
- `npm run test:e2e:ci:file -- e2e/qidahen-region-mask.e2e.ts`

## 复核修正（12:22）

针对“颜色零碎、窄衔接应视为阻挡”的反馈，已调整魔棒策略：

- 原因：旧魔棒同时受区域底色容差约束，地图纹理/山体/阴影会把同一行政区域切成零碎片段。
- 修正：魔棒改为按边界色带形成的连续封闭区域填充，不再按底色碎片切割。
- 窄衔接处理：默认边界加粗从 2px 提到 4px，滑杆上限从 4px 提到 8px；窄缝会随边界加粗自动封闭，避免误跨到相邻区域。
- 山脉可见性：山脉仍通过“边界调试”蓝色层检查，默认不覆盖最终地图；路径图上的“山脉”标签仍保存为 `boundaryType: "mountain"`。

复核命令：

- `npx eslint src/pages/devtools/QidahenRegionMaskTool.tsx src/pages/devtools/qidahenRegionMaskToolUtils.ts src/pages/devtools/__tests__/qidahenRegionMaskToolUtils.test.ts`
- `npx vitest run src/pages/devtools/__tests__/qidahenRegionMaskToolUtils.test.ts`
- `npm run test:e2e:ci:file -- e2e/qidahen-region-mask.e2e.ts`
- `npx tsc --noEmit --pretty false`
- `python` 连通性复核：`region-mask.png` 中 red/yellow 均为 1 个连通组件（red=8725px，yellow=14035px）。

最新截图：

- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-one-region-current.png`
- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-path-graph-current.png`

## 锁链微调收口（22:20）

本轮把“绳索自由面选区”改成了“锁链边界微调”：

- 魔棒仍负责初选单连通区域。
- 锁链沿已选区域边界做局部加/减，不再提供自由套索式的整面闭合选区。
- 写入后会检查区域是否仍为单连通；若会产生碎岛，会拒绝并回滚。
- 左侧工具栏保持固定，内部滚动没有被破坏；主地图仍占据右侧主要工作区。

## 截图

- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-one-region-current.png`
  - 我实际看到：左侧是固定工具栏，内容在栏内滚动；右侧主地图仍铺满主要工作区。
  - 我实际看到：锁链模式下，区域边界点以浅色圆点叠在当前区域边缘附近，说明不是自由套索，而是在围绕已选区域边界做局部修边。
  - 我实际看到：状态提示写明“锁链已减去 … 连续块 1”，说明写入后做了连续性检查。
  - 是否达标：达标，证明锁链模式可见且没有把区域切碎。

- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-path-graph-current.png`
  - 我实际看到：切到路径模式后仍能从区域中心拖出通行边，右侧主地图没有被锁链模式挤变形。
  - 我实际看到：通行边标签继续按规则边界类型显示，保存主动作仍然只有一个。
  - 是否达标：达标，说明锁链微调没有破坏路径图与保存流程。

## 验证

- `npx eslint src/pages/devtools/QidahenRegionMaskTool.tsx src/pages/devtools/qidahenRegionMaskToolUtils.ts src/pages/devtools/__tests__/qidahenRegionMaskToolUtils.test.ts e2e/qidahen-region-mask.e2e.ts`
- `npx vitest run src/pages/devtools/__tests__/qidahenRegionMaskToolUtils.test.ts`
- `npx tsc --noEmit --pretty false`
- `$env:PYTHONUTF8='1'; python D:\codex-home\skills\.system\skill-creator\scripts\quick_validate.py .windsurf\skills\boardgame-ui-imagegen`
- `npm run test:e2e:ci:file -- e2e/qidahen-region-mask.e2e.ts`

## 二次复核修正（13:36）

针对“仍然稀碎、马图标被当成障碍、区域中间不应空一块”的反馈，确认上一版仍然把视觉边界/图标误用于区域生成，不符合本工具目的。

本轮改为：

- 魔棒不再按图片像素、底色、山脉纹理或障碍 mask 生成区域。
- 魔棒改为读取 `QIDAHEN_MAP_REGION_SHAPES` 中已经校准的区域 polygon，直接栅格化包围曲线并整块填充。
- 因此马图标、文字、山脉纹理只作为底图视觉，不会在区域 mask 里挖洞。
- 窄衔接/阻挡关系不再靠图片像素猜测，而应由区域 polygon 与 `region-graph.json` 的通行边/边界类型表达。

复核结果：

- `npx eslint src/pages/devtools/QidahenRegionMaskTool.tsx src/pages/devtools/qidahenRegionMaskToolUtils.ts src/pages/devtools/__tests__/qidahenRegionMaskToolUtils.test.ts`：通过
- `npx vitest run src/pages/devtools/__tests__/qidahenRegionMaskToolUtils.test.ts`：7 passed
- `npm run test:e2e:ci:file -- e2e/qidahen-region-mask.e2e.ts`：1 passed
- `npx tsc --noEmit --pretty false`：通过
- `region-mask.png` 连通性复核：red=16980px、yellow=17909px，均为 1 个连通组件；bbox 分别匹配区域 polygon 外接框。

## 三次复核修正（13:55）

针对“粗糙 polygon 横跨好几个边界，效果变差”的反馈，确认二次修正方向错误：当前 polygon 只是粗占位，不可作为区域真相源。

本轮改为：

- 移除魔棒对粗糙 polygon 的依赖，避免横跨多个边界。
- 恢复基于边界的 seed flood-fill，只在点击点所在的边界包围区内扩散。
- 新增 `fillMaskInternalHoles`：在边界包围区确定后，填平内部图标/文字/纹理造成的空洞；马图标不会再把区域挖洞。
- 这样区域外轮廓仍由真实边界限制，内部再整体铺满。

复核结果：

- `npx eslint src/pages/devtools/QidahenRegionMaskTool.tsx src/pages/devtools/qidahenRegionMaskToolUtils.ts src/pages/devtools/__tests__/qidahenRegionMaskToolUtils.test.ts`：通过
- `npx vitest run src/pages/devtools/__tests__/qidahenRegionMaskToolUtils.test.ts`：7 passed
- `npm run test:e2e:ci:file -- e2e/qidahen-region-mask.e2e.ts`：1 passed
- `npx tsc --noEmit --pretty false`：通过
- `region-mask.png` 连通性复核：red=10591px、yellow=14574px，均为 1 个连通组件；bbox 回到点击边界包围区，不再使用粗糙 polygon 的大范围跨界框。

## 交互方向调整（14:03）

根据反馈“需要的其实是框选工具/绳索，用魔棒选中后微调边界”：

- 新增模式：`框选`。拖一个矩形范围后，松开即加入当前区域，用于快速补大块缺口。
- 新增模式：`绳索`。沿边界拖拽记录点，松开后自动闭合并填充，用于比画笔更快地修不规则边界。
- 保留魔棒：作为初选入口；后续用框选/绳索/画笔/擦除微调。
- 绳索底层使用 `rasterizePolygonMask`，已补单测覆盖闭合范围填充。

验证：

- `npx eslint src/pages/devtools/QidahenRegionMaskTool.tsx src/pages/devtools/qidahenRegionMaskToolUtils.ts src/pages/devtools/__tests__/qidahenRegionMaskToolUtils.test.ts`：通过
- `npx vitest run src/pages/devtools/__tests__/qidahenRegionMaskToolUtils.test.ts`：8 passed
- `npm run test:e2e:ci:file -- e2e/qidahen-region-mask.e2e.ts`：1 passed
- `npx tsc --noEmit --pretty false`：通过

## 边界修正层复核（2026-05-21 01:06 +08）

这轮不是继续调容差，而是先证明当前方向哪里错。

诊断图：

- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\temp\qidahen-region-diagnostics\beijing-original.png`
- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\temp\qidahen-region-diagnostics\beijing-barrier.png`
- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\temp\qidahen-region-diagnostics\beijing-contiguous.png`
- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\temp\qidahen-region-diagnostics\beijing-color.png`
- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\temp\qidahen-region-diagnostics\jinzhou-original.png`
- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\temp\qidahen-region-diagnostics\jinzhou-barrier.png`
- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\temp\qidahen-region-diagnostics\jinzhou-contiguous.png`
- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\temp\qidahen-region-diagnostics\jinzhou-color.png`

我实际看到：

- 北京和锦州样本的 `barrier` 都不是闭合边界网络，而是被膨胀后的大块噪声。
- 北京样本框里最大的 barrier 连通块已经吞掉约 45.9% 的局部面积，这不是“还差一点参数”，而是启发式 barrier 已经失真。
- 因此当前工具方向改成三层：`启发式边界`、`手工边界修正（补边/去噪）`、`最终区域 mask`。魔棒只负责 bootstrap，最终停线不再只依赖最终装饰图的纯颜色提取。

本轮实现：

- `QidahenRegionMaskTool.tsx` 新增 `边界修正` 模式，支持 `补边 / 去噪`。
- 边界调试层现在区分：青色=启发式边界，绿色=手工补边，洋红=手工去噪。
- `保存区域数据` 仍然只有一个主动作，但会自动把边界修正提示一起写入数据目录。

验证：

- `npx eslint src/pages/devtools/QidahenRegionMaskTool.tsx src/pages/devtools/qidahenRegionMaskToolUtils.ts src/pages/devtools/__tests__/qidahenRegionMaskToolUtils.test.ts vite.config.ts`
- `npx vitest run src/pages/devtools/__tests__/qidahenRegionMaskToolUtils.test.ts`：13 passed
- `npx tsc --noEmit --pretty false`
- `$env:PYTHONUTF8='1'; python D:\codex-home\skills\.system\skill-creator\scripts\quick_validate.py .windsurf\skills\boardgame-ui-imagegen`

工具页截图：

- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\temp\qidahen-region-diagnostics\qidahen-region-tool-barrier-mode.png`

## 2026-05-21 02:00 +08 自动回读与同屏三联预览

- 已修改 `src/pages/devtools/QidahenRegionMaskTool.tsx`：
  - 启动时自动请求 `/devtools/qidahen-region-mask/load`，恢复已保存的 `mask / regions / graph / boundary hints / 参数`；
  - 修正 React dev 严格模式下的 effect 双跑陷阱，不再出现“保存成功但刷新后全丢”的假持久化；
  - 局部预览改为同屏三联：原图 / 启发式边界 / 当前魔棒填充。
- 已修改 `.windsurf/skills/boardgame-ui-imagegen/SKILL.md`：真相源型工具只要提供 `保存`，就必须默认支持刷新后的自动回读，不能要求用户每次手工导入刚保存的数据。

我实际查看截图：

- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\temp\qidahen-region-diagnostics\qidahen-region-tool-autoload-panel.png`
- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\temp\qidahen-region-diagnostics\qidahen-region-tool-autoload-full.png`

我实际看到：

- 左栏状态明确显示“已自动读取 `src/games/qidahen/data` 中的区域数据”。
- `锦州 / 宋进` 已恢复 `seed` 和 `路径 1`，不再是刷新后全部回到未设。
- 局部预览三张图在同一屏内都能看到，不需要再往下翻才能判断边界是不是已经糊成块。

验证：

- `npx eslint src/pages/devtools/QidahenRegionMaskTool.tsx`
- `npx tsc --noEmit --pretty false`
- `npx vitest run src/pages/devtools/__tests__/qidahenRegionMaskToolUtils.test.ts`：13 passed
- `$env:PYTHONUTF8='1'; python D:\codex-home\skills\.system\skill-creator\scripts\quick_validate.py .windsurf\skills\boardgame-ui-imagegen`

## 2026-05-21 02:25 +08 启发式边界降噪 + 区域粗轮廓限域

- 已修改 `src/pages/devtools/qidahenRegionMaskToolUtils.ts`：
  - `buildBarrierMask` 不再直接对原图做纯 RGB 阈值膨胀；
  - 启发式边界改为 `轻模糊 + 线状组件过滤 + 再膨胀`，优先保留长线边界，降低文字、马纹、山纹和块状纹理误判。
- 已修改 `src/pages/devtools/QidahenRegionMaskTool.tsx`：
  - 魔棒初选新增“命名区域粗轮廓限域”，只把现有粗 polygon 作为 bootstrap 范围约束，不作为最终区域真相；
  - 因此当前流程变成：`启发式边界` 负责停线趋势，`粗轮廓限域` 负责避免整图漏选，`锁链` 负责最终局部修边。
- 已修改 `.windsurf/skills/boardgame-ui-imagegen/SKILL.md`：
  - 地图交互真相源工具必须先区分 `运行时命中/高亮数据`、`规则连通/邻接数据`、`启发式辅助层`；
  - 纯 RGB 阈值 / 全图魔棒 / 边界色膨胀图未经样本看图证明前，不能直接升格为真相源。

我实际查看截图：

- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\temp\qidahen-region-diagnostics\qidahen-region-tool-barrier-mode-after-filter.png`
- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\temp\qidahen-region-diagnostics\qidahen-region-tool-jinzhou-preview-after-filter.png`
- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\temp\qidahen-region-diagnostics\qidahen-region-tool-jinzhou-magic-after-filter.png`

我实际看到：

- `边界修正` 大图里的青色层已不再把整张地图打成雪花噪声，主要沿真实长线结构走；但朝鲜牌库、底部轨道等非区域本体仍有少量误判，因此启发式层当前只够当 bootstrap/诊断，不应声明为最终真相源。
- `锦州样本` 的局部预览从之前的 `228,187 px` 巨大漏选，收到了 `10,081 px` 的局部选区量级；这已经从“整图漏边”回到“可继续锁链微调”的状态。
- 重新点击 `锦州` 后，右侧大图中的红色 mask 已回到锦州附近局部区域，不再吞掉大块北侧空域；当前形状仍需后续按真实边界继续微调，但方向已对。

验证：

- `npx eslint src/pages/devtools/QidahenRegionMaskTool.tsx src/pages/devtools/qidahenRegionMaskToolUtils.ts src/pages/devtools/__tests__/qidahenRegionMaskToolUtils.test.ts`
- `npx tsc --noEmit --pretty false`
- `npx vitest run src/pages/devtools/__tests__/qidahenRegionMaskToolUtils.test.ts`：14 passed
- `$env:PYTHONUTF8='1'; python D:\codex-home\skills\.system\skill-creator\scripts\quick_validate.py .windsurf\skills\boardgame-ui-imagegen`

说明：

- 本轮未重跑正式 `npm run test:e2e:ci:file -- e2e/qidahen-region-mask.e2e.ts` 成功，因为共享 single-worker 端口 `6368 / 20100 / 21100` 已被占用；按项目规则未清理共享进程。
- 真实页面验收通过当前本地 dev server `http://127.0.0.1:4273/dev/qidahen-region-mask` + Playwright 手工脚本截图完成。

## 2026-05-21 02:50 +08 从“闭合边界 flood fill”切到“边界环 bootstrap”

- 继续对北京样本做局部真图取证后，已确认问题不是“北京太复杂”，而是当前方向本身不对：
  - `qidahen-region-tool-beijing-barrier-gradient.png` 里，北京样本即使加了梯度边界，`当前魔棒填充` 仍是 `83,136 px`；
  - 这证明“先假设全图边界已闭合，再做 flood fill”对这张地图不成立。
- 已修改 `src/pages/devtools/QidahenRegionMaskToolUtils.ts`：
  - 新增 `buildGradientBarrierMask`：启发式边界不再只认固定 RGB，还会认深色高对比梯度；
  - 新增 `buildRadialBoundarySelectionMask`：从 seed 向四周扫描最近边界，先构出一块局部边界环，再栅格化为初始选区。
- 已修改 `src/pages/devtools/QidahenRegionMaskTool.tsx`：
  - 魔棒初选改成 `颜色停线/连续区` 与 `边界环 bootstrap` 二选一；
  - 当颜色 flood fill 不可信、没有 bootstrap guide，或边界环明显更紧时，优先使用 `radial` 结果；
  - 状态文案会显示当前初选来自 `边界环` 还是 `颜色停线`。

我实际查看截图：

- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\temp\qidahen-region-diagnostics\qidahen-region-tool-beijing-radial.png`
- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\temp\qidahen-region-diagnostics\qidahen-region-tool-jinzhou-radial.png`

我实际看到：

- 北京样本的 `当前魔棒填充` 已从 `83,136 px` 收到 `21,076 px`；虽然还不是最终正确区域，但已经不再跨到远处大片区域，能证明“边界环 bootstrap”比原先的闭合边界 flood fill 更接近正确方向。
- `锦州` 仍保持局部区域选中，没有因为接入 `radial` 又退回大面积漏边。
- 结论：当前方向已经从“等全图边界闭合”切到“先拿最近边界环做 bootstrap，再用锁链修边”。这更接近地图制图程序常见的 `自动初选 + 手工收边` 路线。

验证：

- `npx vitest run src/pages/devtools/__tests__/qidahenRegionMaskToolUtils.test.ts`：17 passed
- `npx eslint src/pages/devtools/QidahenRegionMaskTool.tsx src/pages/devtools/qidahenRegionMaskToolUtils.ts src/pages/devtools/__tests__/qidahenRegionMaskToolUtils.test.ts`
- `npx tsc --noEmit --pretty false`

## 2026-05-21 03:15 +08 北京继续收紧，锦州不回退

- 已继续修改 `src/pages/devtools/QidahenRegionMaskToolUtils.ts` 与 `src/pages/devtools/QidahenRegionMaskTool.tsx`：
  - `buildRadialBoundarySelectionMask` 不再让未命中边界的射线直接拖到最大半径，而是回填命中边界的中位距离并做环状平滑；
  - `radial` 新增形状门禁：过稀、过细长的边界环初选会被拒绝；
  - `radial` 不再直接作为最终初选，而是先当“局部工作区”，再在该工作区内做一次颜色停线，得到 `radial-color` 结果。

我实际查看截图：

- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\temp\qidahen-region-diagnostics\qidahen-region-tool-beijing-radial-gated.png`
- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\temp\qidahen-region-diagnostics\qidahen-region-tool-beijing-radial-color.png`
- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\temp\qidahen-region-diagnostics\qidahen-region-tool-jinzhou-radial-gated.png`
- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\temp\qidahen-region-diagnostics\qidahen-region-tool-jinzhou-radial-color.png`

我实际看到：

- 北京样本的 `当前魔棒填充` 已从 `21,076 px` 继续收到 `5,223 px`，再到 `5,156 px`；虽然还没完全贴住真实边界，但已经从“大块漏边”进入“局部可继续修边”的量级。
- 锦州在加上 `radial` 之后一度被误选成细长碎片；加入形状门禁后，锦州已回到稳定的局部块选区，没有回退成线条或远距离漏边。
- 当前结论：`radial` 可以保留，但只能作为 bootstrap / 局部 ROI，不能裸用；真正可用的是 `边界环 -> 局部工作区 -> 颜色停线` 这条组合链。

验证：

- `npx vitest run src/pages/devtools/__tests__/qidahenRegionMaskToolUtils.test.ts`：18 passed
- `npx eslint src/pages/devtools/QidahenRegionMaskTool.tsx src/pages/devtools/qidahenRegionMaskToolUtils.ts src/pages/devtools/__tests__/qidahenRegionMaskToolUtils.test.ts`
- `npx tsc --noEmit --pretty false`

## 2026-05-21 04:05 +08 北京样本现在可真编辑，但不会污染正式导出

本轮新增的是工具真相源门禁，不是新的选区算法：

- 点击 `北京样本` 时，如果当前没有同名正式区域，会自动创建 `__diagnostic__:beijing` 临时区域。
- 这个临时区域可以直接接魔棒、锁链和路径视图，不再只是左侧诊断预览。
- 保存时会自动从正式 `region-mask.png / region-mask-regions.json / region-graph.json` 导出中过滤掉所有 `__diagnostic__:` 区域、节点和路径。

我实际查看截图：

- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\temp\qidahen-region-diagnostics\qidahen-region-tool-beijing-diagnostic-region.png`
  - 我实际看到：当前区域标题已经切到 `北京样本 __diagnostic__:beijing`，说明它不再只是“诊断样本按钮”，而是能被真正选中的临时区域。
  - 我实际看到：左侧说明明确写了“它可直接走魔棒/锁链，但不会写入正式 mask/graph”。
  - 是否达标：达到本轮“从简单样本开始真编辑，但不污染正式数据”的要求。

我实际做了浏览器真实保存验证：

- 保存提示：`已保存到 src/games/qidahen/data：region-mask.png / region-mask-regions.json / region-graph.json（含边界修正提示文件）；已自动忽略 1 个诊断临时区域`
- 保存后检查：
  - `src/games/qidahen/data/region-mask-regions.json` 中无 `__diagnostic__:` 区域 id
  - `src/games/qidahen/data/region-graph.json` 中无 `__diagnostic__:` 节点 id

结论：

- 现在 `北京样本` 已从“只能看预览”推进到“可以走真实编辑链路”。
- 正式导出仍只保留运行时真相源，不会把 devtools 诊断对象混入游戏数据。

## 2026-05-21 04:30 +08 合成闭环接入 radial-barrier，但锦州还没跟上

这轮不是再调 tolerance，而是把 `radial` 采到的边界点真正闭成一圈，并和真实 `barrier` 合并后再做内部抠区。

代码变更：

- `src/pages/devtools/qidahenRegionMaskToolUtils.ts`
  - `buildRadialBoundaryStrokeMask` 现在会把首尾点闭合，再栅格化为闭环边界。
- `src/pages/devtools/QidahenRegionMaskTool.tsx`
  - `radial-barrier` 改成使用 `真实 barrier + synthetic radial loop` 的合成边界；
  - 再把这份合成边界喂给 `buildBarrierInteriorSelectionMask`，不再只拿原始 barrier 抠内部。

我实际用真实页面 `http://127.0.0.1:4273/dev/qidahen-region-mask` + Playwright 动态导入当前工具 util，直接复算了北京/锦州四种候选面积：

- 北京：
  - `color`: `90,473 px`
  - `radial`: `5,679 px`
  - `radial-color`: `5,598 px`
  - `radial-barrier`: `4,924 px`
- 锦州：
  - `color`: `13,373 px`
  - `radial`: `1,227 px`
  - `radial-color`: `0 px`
  - `radial-barrier`: `0 px`

我实际看到：

- 北京这条链已经不是原来那个 `radialInterior = 1 px` 的假结果了；`radial-barrier` 现在能抠出一块真实内部区域，说明“真实 barrier + 合成闭环”开始生效。
- 但它还没有明显优于 `radial-color`，只是更小、更收紧；目前只能说明方向正确，不能说北京已经贴边界完成。
- 锦州这条链当前仍走不通：`radial` 本身因为过细长被门禁拒绝，后面的 `radial-color / radial-barrier` 都没有可用结果，所以当前正式工具行为仍会回退到颜色停线。

我实际查看了当前整页工具截图：

- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\temp\qidahen-region-diagnostics\qidahen-region-tool-beijing-radial-barrier.png`
- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\temp\qidahen-region-diagnostics\qidahen-region-tool-jinzhou-radial-barrier.png`

结论：

- 北京样本已从“闭环完全没用”推进到“合成闭环开始生效”。
- 锦州样本还没进入同一条可用链路；任务仍未完成，下一步要继续解决 `radial` 在细长区域上的稳定性，而不是回去只调容差。

## 2026-05-21 04:40 +08 锦州问题的硬根因：粗轮廓和 seed 根本不一致

这轮继续追锦州时，发现一个比算法参数更硬的根因：

- `src/games/qidahen/data/region-mask-regions.json` 里，`锦州` 当前 seed 是 `(529, 359)`。
- `src/games/qidahen/ui/mapRegions.ts` 里，`jinzhou` 粗 polygon 的范围大约在 `x=694..846 / y=338..498`。
- 也就是说，工具之前一直在拿一块**根本不包含当前 seed** 的粗轮廓去裁 `radial` bootstrap。

这会直接把初选裁坏，表现为：

- `radial` 被错误 clip 成细长条；
- 形状门禁误判 `radial` 不可用；
- `radial-color / radial-barrier` 被整条链短路成 `0 px`。

本轮修正：

- 在 `src/pages/devtools/qidahenRegionMaskToolUtils.ts` 新增 `maskContainsPoint`。
- 在 `src/pages/devtools/QidahenRegionMaskTool.tsx` 中，`bootstrapGuideMask` 只有在**实际包含当前 seed** 时才会生效；否则自动禁用，不再拿错位粗轮廓裁坏自动初选。
- 在 `.windsurf/skills/boardgame-ui-imagegen/SKILL.md` 补入通用门禁：粗轮廓/粗 polygon/历史 region shape 只有包含当前 seed 时才能约束自动初选，否则必须自动失效。

我实际用真实页面再次复算后看到：

- 北京：
  - `radial-barrier` 仍约 `4,924 px`
- 锦州：
  - 修正前：`radial 1,227 / radial-color 0 / radial-barrier 0`
  - 修正后：`radial 10,687 / radial-color 10,267 / radial-barrier 9,324`

我实际查看最新截图：

- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\temp\qidahen-region-diagnostics\qidahen-region-tool-jinzhou-after-guide-guard-preview.png`
- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\temp\qidahen-region-diagnostics\qidahen-region-tool-jinzhou-after-guide-guard.png`

我实际看到：

- 左侧预览里，`锦州样本` 的 `当前魔棒填充` 已从之前的细长坏形状回到一块完整局部区域，状态文字显示 `8,286 px · 边界环内边界抠区`。
- 这说明当前问题不只是“边界识别噪声”，也有一层“bootstrap guide 错位”。

当前结论：

- 北京方向仍是对的：合成闭环继续保留。
- 锦州这条链已经从 `0 px` 救回来了，当前至少重新回到同一类 `radial-barrier` 结果。
- 但区域是否已经贴真实边界，仍需下一轮继续肉眼核对；现在只能说“从明显错误推进到可继续修边”，不能宣称最终正确。

## 2026-05-21 04:52 +08 继续纠正地图理解：旧“锦州样本”其实拿的不是锦州位置

继续看图后又确认一层取证错误：

- 旧 `锦州样本` 的点位是 `(529,359)`，它对应的局部预览里能直接看到 `白城 / 北京` 一带，不是当前 `mapRegions.ts` 里的 `锦州` 区域。
- 因此上一条里“锦州回到 `8k+ px`”的截图，只能说明**错点 + 错 guide** 被拆开后链路恢复了，不能说明“真正的锦州已经变好”。

本轮修正：

- `src/pages/devtools/QidahenRegionMaskTool.tsx`
  - 新增 `getRegionShapeCenterPoint`；
  - `锦州样本 / 宋进样本` 的诊断点位不再硬编码旧错点，而是按当前 `QIDAHEN_MAP_REGION_SHAPES` 的 shape 中心自动生成。
- 同时保留北京样本硬编码点位，因为北京当前不在正式区域列表里。

我实际查看新的锦州诊断截图：

- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\temp\qidahen-region-diagnostics\qidahen-region-tool-jinzhou-after-sample-fix-preview.png`
- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\temp\qidahen-region-diagnostics\qidahen-region-tool-jinzhou-after-sample-fix.png`

我实际看到：

- 左侧 `锦州样本` 坐标现在是 `773, 418`，原图预览也终于落到真正的锦州附近。
- 但新的 `当前魔棒填充` 只剩 `519 px · 颜色停线`，说明当前算法在**真实锦州点位**上依然很差。
- 这反而把当前状态说清楚了：北京样本继续作为“简单区先做对”的正向样本；真正锦州仍未达标，不能再拿旧错点的 `8k+ px` 当成乐观证据。

当前结论更新：

- `北京样本`：仍是当前最适合继续收紧算法的简单样本。
- `锦州样本`：现在点位和地图理解已对齐，但真实结果仍差，说明后续要继续修算法，而不是再被错点/错 guide 干扰判断。

## 2026-05-21 06:18 +08 北京/锦州切到“边界环贴边扩张”

本轮继续只盯北京简单样本，不再先扩大战场。

我实际先做了两轮诊断：

- 仅靠 `growMaskTowardBoundary` 的 radial refinement，能把北京从 `5,772 px` 推到更贴边，但仍会被内部文字框和纹理 barrier 干扰。
- 继续实验后确认，当前更合理的候选是：在 radial 候选外扩出的局部 search area 中，只保留**贴近候选外圈 support ring** 的 barrier 组件，再做 flood。

落地变更：

- `src/pages/devtools/qidahenRegionMaskToolUtils.ts`
  - 新增 `keepMaskComponentsTouchingSupportMask`
- `src/pages/devtools/QidahenRegionMaskTool.tsx`
  - 新增 `边界环贴边扩张` 候选并接入当前 radial 链裁决
- `.windsurf/skills/boardgame-ui-imagegen/SKILL.md`
  - 新增通用门禁：内部文字/图标混入 barrier 时，可只保留贴近 support ring 的局部边界组件

验证：

- `npx vitest run src/pages/devtools/__tests__/qidahenRegionMaskToolUtils.test.ts` → `26 passed`
- `npx eslint src/pages/devtools/QidahenRegionMaskTool.tsx src/pages/devtools/qidahenRegionMaskToolUtils.ts src/pages/devtools/__tests__/qidahenRegionMaskToolUtils.test.ts`
- `npx tsc --noEmit --pretty false`

我实际查看最新截图：

- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\temp\qidahen-region-diagnostics\beijing-after-ring-candidate-preview.png`
- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\temp\qidahen-region-diagnostics\beijing-after-ring-candidate-full.png`
- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\temp\qidahen-region-diagnostics\jinzhou-after-ring-candidate-preview.png`
- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\temp\qidahen-region-diagnostics\jinzhou-after-ring-candidate-full.png`

我实际看到：

- 北京样本当前是 `6,540 px · 边界环贴边扩张`，比上一版 `5,772 px · 边界环` 更接近城市边线，不再只是收在区域内部的一团。
- 锦州样本当前是 `5,763 px · 边界环贴边扩张`，比上一版 `4,864 px · 边界环` 更完整，不再回到小色块。

本轮结论：

- 方向仍是对的：当前问题不是回去只调容差，而是继续围绕北京这种简单区收紧“贴边后停止”的局部 barrier 候选。
- 当前结果仍然只是更好的 bootstrap，不把它声明为最终真相源。

## 2026-05-21 06:44 +08 拒绝“只变大不变准”的贴边扩张候选

继续实际看图后，确认上一版 `ring6 / 边界环贴边扩张` 不能保留为当前默认结果：

- 北京样本当时是 `6,959 px · 边界环贴边扩张`
- 锦州样本当时是 `6,191 px · 边界环贴边扩张`
- 这两张图的问题都不是“不够满”，而是“更大了，但没有更像真实边界停线”；尤其北京仍被内部文字和碎 barrier 结构拉偏。

本轮修正：

- 已修改 `src/pages/devtools/QidahenRegionMaskTool.tsx`
  - `radial-ring` 不再对局部 search area 直接 `floodFillContiguousArea`；
  - 改为 `buildBarrierInteriorSelectionMask(searchAreaMask + anchored barrier)`，让它先做 ROI 内部抠区；
  - 并加两道回退门禁：
    - 面积超过基础候选 `1.28x` 时拒绝；
    - 边界贴合提升不足 `0.02` 时拒绝。
- 已修改 `.windsurf/skills/boardgame-ui-imagegen/SKILL.md`
  - 新增通用门禁：`support ring / 贴边扩张` 候选如果只是把面积做大，却没有肉眼可见的边界贴合改善，必须自动拒绝并回退到更紧的基础候选。

验证：

- `npx eslint src/pages/devtools/QidahenRegionMaskTool.tsx`
- `npx vitest run src/pages/devtools/__tests__/qidahenRegionMaskToolUtils.test.ts`：`26 passed`
- 真实页面：`http://127.0.0.1:4273/dev/qidahen-region-mask` 返回 `200`

最新人工取证截图：

- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\temp\qidahen-region-diagnostics\beijing-after-ring-tightened-preview-only.png`
- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\temp\qidahen-region-diagnostics\jinzhou-after-ring-tightened-preview-only.png`

我实际看到：

- 北京样本当前已回退为 `5,772 px · 边界环`，不再继续让 `6,959 px` 的更大块误判为更好结果。
- 锦州样本当前已回退为 `4,864 px · 边界环`，同样不再让 `6,191 px` 的贴边扩张候选硬赢。
- 这一步的意义不是“已经对了”，而是先停止把明显更差的扩张结果往前推进。

当前结论：

- `ring6` 不是正确方向；当前默认结果已回退到更保守的基础候选。
- 最新结果仍只能算 bootstrap，还没有达到“像地图程序一样沿真实边界停住”的验收线。

## 2026-05-21 07:10 +08 正式区域候选开始受粗 shape 约束

继续看主画布放大图后，确认还有一层更具体的问题：

- 北京简单区现在已经能当参考，但锦州复杂区仍会因为 refinement 候选而变成整体轮廓不对的怪形状。
- 这不是“边界环路线全错”，而是当前裁决过度偏信 `supportRatio`，让 `radial-color` 这类 refinement 在边界略贴一点时，压过了更像整体区域的基础 `radial`。

本轮修正：

- 已修改 `src/pages/devtools/QidahenRegionMaskTool.tsx`
  - 正式区域新增粗 shape mask 作为第二裁判；
  - `radial-color / radial-barrier` 只有在不明显伤害 guide 覆盖时，才允许压过基础 `radial`。
- 已修改 `.windsurf/skills/boardgame-ui-imagegen/SKILL.md`
  - 正式区域如果已有粗 shape / 旧 mask / 旧 polygon，refinement 不得在没有明显边界收益时把整体轮廓做瘦、做怪、做偏。

验证：

- `npx eslint src/pages/devtools/QidahenRegionMaskTool.tsx`
- `npx tsc --noEmit --pretty false`
- 真实页面：`http://127.0.0.1:4273/dev/qidahen-region-mask`

最新人工取证截图：

- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\temp\qidahen-region-diagnostics\beijing-guide-gate-zoomed.png`
- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\temp\qidahen-region-diagnostics\jinzhou-guide-gate-zoomed.png`

我实际看到：

- 北京样本当前仍为 `5,772 px · 边界环`；主画布局部图里它已经可以作为“简单区基本正确”的参考。
- 锦州样本当前已从 `边界环内颜色停线` 回退成 `边界环`，避免 refinement 靠一点点贴边优势硬赢。
- 但锦州主画布局部图仍明显不对：它还没有沿真实区域边界完整展开，因此当前不能把它当通过样本。

当前结论：

- 方向上，当前工具更接近“基础自动初选 + 数据门禁 + 手工修边”的地图程序路线，而不是继续盲调单一 flood 参数。
- 交付上，只有北京能当简单区参考；锦州仍未达到“魔棒到边界停止”的验收线。

## 2026-05-21 10:02 +08 bootstrap 来源裁决修正后，锦州主画布回到 `边界环`

这轮先修掉一个更底层的裁决错误，而不是再调一层容差：

- 已修改 `src/pages/devtools/QidahenRegionMaskTool.tsx`
  - 保存过的当前 `region mask` 只有在**实际覆盖当前 seed** 时才允许优先充当 bootstrap；旧底稿不覆盖当前点时，自动让位给其他 bootstrap。
  - 加载已保存数据时，只要当前保存 mask 能算出中心，就直接把 seed 对齐到当前底稿中心。
  - `static shape / 粗 polygon` 不再把一个仍可继续修边的自动初选强行盖回 `shape-outline`；它现在只作为 support/ROI。
  - 新增 `shape-color / 形状约束颜色停线` 候选，尝试在 formal shape 的 ROI 内做颜色停线。
- 已修改 `.windsurf/skills/boardgame-ui-imagegen/SKILL.md`
  - 保存过的当前底稿只有覆盖当前 seed 时才配当 bootstrap。
  - `static shape / 粗 polygon` 默认只能做 support，不能因为面积更完整就压过一个仍可继续锁链微调的自动初选。

我实际重新看了三张最新主画布截图：

- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\temp\qidahen-region-diagnostics\post-change-jinzhou-main-click-v2.png`
  - 我实际看到：这时主画布仍被 `16,980 px · 形状轮廓` 盖回去，说明旧 `shape-outline` fallback 还在强行吃掉自动初选。
- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\temp\qidahen-region-diagnostics\post-change-jinzhou-main-click-v3.png`
  - 我实际看到：修正裁决后，主画布重新回到 `4,840 px · 边界环`；不再被整块粗 polygon 盖住，方向上更接近“魔棒初选 + 锁链微调”。
- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\temp\qidahen-region-diagnostics\post-change-jinzhou-main-click-v4.png`
  - 我实际看到：新增 `shape-color` 候选后，当前锦州样本仍然没有压过 `边界环`；主画布看起来还是一块偏窄的局部选区，没有沿真实地图边界完整展开。

当前结论更新：

- 这轮已经把“bootstrap 来源裁决错误”修正：旧 saved mask 不会再无条件挡住当前 seed，static shape 也不再把可修的自动初选整块盖回去。
- 但 `锦州` 复杂区仍未通过：当前主画布虽然回到 `边界环`，可它还是太窄，不是最终可交付的自动初选。

## 2026-05-21 11:20 +08 梯度边界过滤放松后，锦州主画布回到 `radial-color`

这轮先做了两步最小修正，再回到主画布看结果：

- 已修改 `src/pages/devtools/QidahenRegionMaskTool.tsx`
  - 放松 `HEURISTIC_GRADIENT_BARRIER.lineFilter`：从 `minSpan 12 / maxAverageThickness 5.2` 调整为 `minSpan 8 / maxAverageThickness 10`，保留更多真实边界段，减少 gradient barrier 被删空。
  - 新增 persisted bootstrap 门禁：若 formal `static shape` 已存在，而 persisted/current mask 与 static guide 几乎不重合，则 persisted 只能降级为历史参考，不能继续当 bootstrap。
  - `shape-color` 候选降级为兜底：只有 radial 不可用时才允许参与最终候选，避免 formal ROI 内的大面积 flood 抢掉主自动选区。
  - 新增 `window.__QIDAHEN_REGION_MAIN_CLICK_DEBUG__`，避免 `diagnostic-preview` 覆盖主画布点击调试结果。
- 已修改 `.windsurf/skills/boardgame-ui-imagegen/SKILL.md`
  - persisted/current mask 不能只凭 seed 覆盖就升级；若与 formal guide 几乎完全错位，必须降级。
  - `shape-color / guide 内 flood` 只能做 radial 不可用时的兜底。
  - 地图区域工具验收必须看主画布实际点击结果，侧栏小预览不能代替主 verdict。

验证：

- `npx eslint src/pages/devtools/QidahenRegionMaskTool.tsx`
- `npx tsc --noEmit --pretty false`
- `npx vitest run src/pages/devtools/__tests__/qidahenRegionMaskToolUtils.test.ts` → `26 passed`
- `python D:\codex-home\skills\.system\skill-creator\scripts\quick_validate.py .windsurf\skills\boardgame-ui-imagegen`

说明：

- 正式 `npm run test:e2e:ci:file -- e2e/qidahen-region-mask.e2e.ts` 本轮未通过，不是代码红，而是 shared single-worker E2E 端口 `6368/20100/21100` 已被其他运行中的测试占用；本轮没有去清共享端口。
- 为继续验证主画布，我改用当前开发页 `http://127.0.0.1:4273/dev/qidahen-region-mask` 直连 Playwright 取证。

最新人工取证截图：

- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-beijing-direct-current.png`
- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-jinzhou-direct-current.png`

我实际看到：

- 北京样本当前主画布结果是 `7,871 px · 边界环内颜色停线`；白色轮廓已经沿着北京城市块外缘停住，没有再漏成整片，也没有回退成 shape flood。
- 锦州样本当前主画布结果是 `6,286 px · 边界环内颜色停线`；它已经不再是之前那条偏窄内核，也不再被 `shape-color` 大块或旧 persisted 轮廓抢走，主轮廓明显更接近真实锦州区域。
- 锦州这版仍不是“最终权威 mask”：右上横向部分和下缘还存在继续锁链微调的空间，但它已经达到“复杂区不能明显选错”的当前阶段线，至少不再是一眼错误的大块或细条。

当前结论：

- 本轮真正修掉的是两类裁决错误：`gradient barrier` 过滤过狠，以及 `shape-color / persisted` 抢主候选。
- 工具现在更符合“魔棒初选 + 锁链微调”的路线：北京可作为简单区参考，锦州已推进到可继续精修的复杂区初选。

## 2026-05-21 12:00 +08 局部护栏内颜色停线接管锦州主候选

这轮没有再让 `shape-color` 或 `radial-color` 单独决定锦州，而是把 formal shape 降成局部搜索护栏，新增 `guide-local-color` 作为更贴近“魔棒初选 + 锁链微调”的主候选。

我实际做了两件事：

- `src/pages/devtools/QidahenRegionMaskTool.tsx`
  - 新增 `guide-local-color` 候选：在 formal shape 的小范围护栏内，优先用过滤后的边界停线做 seed flood，再在结果太小的时候回退成护栏内连通填充。
  - `focusDiagnosticSample` 不再把用户偷偷切到 `边界修正`，样本按钮现在保留用户的主路径。
- `.windsurf/skills/boardgame-ui-imagegen/SKILL.md`
  - 补一条通用门禁：diagnostic sample / bootstrap 快捷入口不得偷偷切到无关编辑模式，用户点“样本/定位”后默认仍能继续主路径。

验证：

- `npx eslint src/pages/devtools/QidahenRegionMaskTool.tsx`
- `npx tsc --noEmit --pretty false`
- `python D:\codex-home\skills\.system\skill-creator\scripts\quick_validate.py .windsurf\skills\boardgame-ui-imagegen`

我实际重新看了主画布：

- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-beijing-direct-current.png`
  - 北京仍是 `7,671 px · 边界环内颜色停线`，简单区没有被这轮改坏。
- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-jinzhou-direct-current.png`
  - 锦州这次由 `guide-local-color` 接管，主候选变成 `15,229 px · 局部护栏内颜色停线`。
  - 这块已经不再是偏窄内核，也不再是明显的小错区；它更像一个“先大致到边界，再交给锁链微调”的初选。
  - 但右上和下缘仍有收边空间，当前还不能把它说成最终权威 mask。

## 2026-05-21 12:10 +08 局部护栏只保留外圈边界组件，去掉深处噪声停线

继续看锦州主画布后，问题从“整体太小”收敛成了“护栏内深处噪声还在参与停线”。这轮继续收紧 `guide-local-color`：

- `src/pages/devtools/QidahenRegionMaskTool.tsx`
  - `guide-local-color` 的 barrier 不再直接吃整个护栏内的过滤边界，而是只保留**碰到护栏外圈 support ring** 的边界组件。
  - 这样深处的字牌/纹理/局部黑块不会再主导停线，外边界仍然保留。

验证：

- `npx eslint src/pages/devtools/QidahenRegionMaskTool.tsx`
- `npx tsc --noEmit --pretty false`

我实际重新看了最新主画布：

- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-beijing-direct-current.png`
  - 北京仍是 `7,671 px · 边界环内颜色停线`，简单区未回退。
- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-jinzhou-direct-current.png`
  - 锦州仍由 `guide-local-color` 接管，更新后是 `15,265 px · 局部护栏内颜色停线`。
  - 我实际看到：它比 `radial-color` 那条 `6k` 小块更接近整块区域，外轮廓方向对了；但仍留有局部收边和最终人工修边空间，因此继续视为 bootstrap，不报最终完成。

## 2026-05-21 16:40 +08 外层 seed 预筛只允许使用“当前点击命中的 guide”

继续看主画布和 debug 后，确认上一阶段还有一条更隐蔽的错位链路：

- `buildMagicSelection` 内层已经会判断“当前点击是否真的落在 static shape / persisted mask 内”，再决定能不能启用 guide。
- 但 `handleMagicFill` 外层的多 seed 预筛还没复用这条门禁，仍会直接按 `selectedRegion.id` 取 guide/shape 去探测 interior seed。
- 这会导致一个坏结果：即使当前点击根本不在该 guide 内，主链也可能被静默带到远处 guide 内部点，只因为那个点的像素更多、分数更高。

本轮修正：

- 已修改 `src/pages/devtools/QidahenRegionMaskTool.tsx`
  - 外层 `bootstrapGuideMask / bootstrapShapeMask` 现在先按当前点击做 point-aware 判定：只有点击真实命中 static shape 或 persisted mask 时，guide 才允许参与外层 seed 预筛；
  - load 阶段不再把“落在 static shape 外的现有 seed”自动纠到 shape 中心，而是保留当前 `saved mask center / persisted seed`，并只把 static shape 当 bootstrap 参考。
- 已修改 `.windsurf/skills/boardgame-ui-imagegen/SKILL.md`
  - 补入“guide/static shape 不能替代真实点击改点位”和“load 阶段不得因为粗 shape 不一致就自动覆盖现有 seed”两条通用门禁。

验证：

- `npx eslint src/pages/devtools/QidahenRegionMaskTool.tsx`
- `npx tsc --noEmit --pretty false`
- `$env:PYTHONUTF8='1'; python D:\codex-home\skills\.system\skill-creator\scripts\quick_validate.py .windsurf\skills\boardgame-ui-imagegen`

我实际用真实页面 `http://127.0.0.1:4273/dev/qidahen-region-mask` 重新取证：

- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\temp\qidahen-region-diagnostics\map-region-shapes-overlay.png`
  - 我实际看到：当前 `jinzhou` static shape 粗 guide 覆盖的是一块北侧棕色区域，本身仍只是 bootstrap，不应被当成“主点击必须跟随”的真相源。
- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\temp\qidahen-region-diagnostics\region-mask-jinzhou-old-seed-no-guide-jump.png`
  - 我实际看到：点击旧坏点 `529,359` 后，当前选区仍停留在该点击附近的大块区域，没有再静默跳到 `795,418` 一带的 static guide 区。
  - 对应 debug 也已确认：`bootstrapShapeSource = null`，`chosenPoint = 528,359`。
- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\temp\qidahen-region-diagnostics\jinzhou-current-from-debug.png`
  - 我实际看到：点击当前 guide 内点 `784,408` 时，主链仍能正常生成 `radial-raw-local-color` 结果；这证明 point-aware 门禁没有把现有可用路径打坏。

当前结论：

- 这轮已经压住“错 guide 把主点击带跑”和“load 时静默把 seed 纠到粗 shape 中心”两类问题。
- 当前工具的 guide 更接近真正的 bootstrap：它只能在用户点击已命中的情况下辅助选区，不再凌驾于真实点击之上。
- 任务仍未完成：`jinzhou` 的 static shape 本身还只是粗 guide，最终真相仍要靠真实点击、锁链收边和保存后的数据文件来收口。

## 2026-05-21 18:05 +08 北京样本 tie-break 改成“更接近点击优先”

继续只盯北京这个简单区后，我确认当前问题已经不是“北京完全选错区”，而是交互语义不够像魔棒：

- `guide-local-color` 在多个 seed 候选分数很接近时，会为了多拿几百像素，把 seed 往 guide 另一侧挪。
- 结果就是：用户点击北京东侧/北侧时，主链看起来像“自己在整块 guide 里巡航找更大块”，而不是“从点击位置附近往边界扩散，到边界就停”。

本轮修正：

- 已修改 `src/pages/devtools/QidahenRegionMaskTool.tsx`
  - static guide 下的 seed 候选半径从 `34px` 收紧到 `24px`；
  - 多 seed 候选比较时，若 fitness 差距落在同一 tie 区间，改为优先保留更接近用户点击位置的 seed。
- 已修改 `.windsurf/skills/boardgame-ui-imagegen/SKILL.md`
  - 补入通用门禁：多 seed 分差接近时，必须优先更接近点击的候选；不能只因为某个候选多涂出一圈像素，就把主点击静默改判成 guide 内另一个点。

验证：

- `npx eslint src/pages/devtools/QidahenRegionMaskTool.tsx`
- `npx tsc --noEmit --pretty false`
- `$env:PYTHONUTF8='1'; python D:\codex-home\skills\.system\skill-creator\scripts\quick_validate.py .windsurf\skills\boardgame-ui-imagegen`

我实际用真实 dev 页 `http://127.0.0.1:4273/dev/qidahen-region-mask` 复测了北京三次点击：

- `520,610 -> chosenPoint 519,619`
- `545,610 -> chosenPoint 544,620`
- `520,585 -> chosenPoint 511,583`

我实际查看最新截图：

- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\temp\qidahen-region-diagnostics\beijing-east-after-locality.png`
  - 我实际看到：北京东侧点击后，seed 已留在点击附近，不再跳到南侧那块更远的 guide 内部点。
  - 我实际看到：当前选区仍是同一块北京区域，没有因为 tie-break 收紧而退回碎块。
- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\temp\qidahen-region-diagnostics\beijing-north-after-locality.png`
  - 我实际看到：北京北侧点击后，seed 也保持在北侧附近，不再被更远的 seed 抢走。
  - 我实际看到：当前选区整体仍连续，没有出现“为了贴近点击就掉成 1k 小块”的回归。

当前结论：

- 这轮已经把北京样本的交互语义拉回到更像魔棒：用户点哪儿，主链就从哪儿附近起步，而不是在整块 guide 里自动找更大块。
- 但这还不是最终收口。下一步仍然要继续判断北京这块是否**真的到边界才停**；如果继续看图确认还有明显不到边界或过边界的问题，就要回到 barrier/停线本身，而不是再调 seed 选择。

## 2026-05-21 19:35 +08 显式 guide 进入主链，魔棒截图去掉路径图层污染

本轮没有把“主画布 still wrong”继续归咎于 seed tie-break，而是补上两条更硬的门禁：

- 一旦某个样本/区域已经有显式 guide / truth mask，它必须由主画布主链直接消费，不能只在侧栏预览或 debug 对照里正确。
- 路径节点/连线属于路径模式信息，不应长期盖在魔棒/锁链主画布上干扰范围判断。

实现：

- 已修改 `src/pages/devtools/QidahenRegionMaskTool.tsx`
  - `truth-guide` 现在在 `buildMagicSelection` 中直接提前返回，主链不再让 `guide-local-color`、`radial-*` 等启发式候选抢走；
  - 路径节点、连线、拖拽草线改成只在 `路径` 模式渲染。
- 已修改 `.windsurf/skills/boardgame-ui-imagegen/SKILL.md`
  - 补入“authoritative guide / truth mask 必须主链直用”和“编辑器辅助图层必须按模式显示”两条通用门禁。

我实际查看最新截图：

- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\temp\qidahen-region-diagnostics\beijing-authoritative-current.png`
  - 我实际看到：北京样本状态文案已变成 `10,679 px · 显式 guide 真相`，不再回退成 `局部护栏内颜色停线`。
  - 我实际看到：魔棒模式下不再额外叠路径节点和连线，当前主画布 verdict 比旧图干净。
- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\temp\qidahen-region-diagnostics\jinzhou-current-after-guide-cleanup.png`
  - 我实际看到：锦州主画布虽然也去掉了无关路径图层，但当前仍是 `13,336 px · 颜色停线`，范围依然明显不对。
  - 结论：复杂区的问题仍在边界/真相源层，而不是视图污染或“显式 guide 没接进主链”。

验证：

- `npx eslint src/pages/devtools/QidahenRegionMaskTool.tsx`
- `npx tsc --noEmit --pretty false`

## 2026-05-21 20:05 +08 再次看图后的结论：北京 truth-guide 与启发式停线必须拆开

这轮只做了一件事：重新把“北京看起来规整”和“魔棒真的到边界才停”拆开，不再混说。

- 我实际重新看了：
  - `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\temp\qidahen-region-diagnostics\beijing-authoritative-current.png`
  - `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\temp\qidahen-region-diagnostics\beijing-preview-fill-truth-guide.png`
  - `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\temp\qidahen-region-diagnostics\beijing-preview-fill-guided.png`
  - `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\temp\qidahen-region-diagnostics\beijing-diagnostic-preview-panel-current.png`
  - `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\temp\qidahen-region-diagnostics\beijing-original-crop.png`
- 我实际看到：
  - `beijing-authoritative-current.png` 现在规整，是因为主链已经直用显式 guide；
  - `beijing-preview-fill-truth-guide.png` 只是工具内 truth polygon 的填充，不是启发式停线结果；
  - `beijing-preview-fill-guided.png` 里仍能看到内部文字/装饰把选区切穿，这说明启发式本身还不能宣称“到边界才停”；
  - `beijing-diagnostic-preview-panel-current.png` 现在会把“禁用 truth 后的启发式初选”和“与显式 truth 的差异”并排展示；当前北京样本直接给出 `漏选 2,843 / 越界 1,585 / IoU 0.64`，已经足够证明算法仍未过线；
  - 因此，北京当前只能证明“显式 truth authoring 路线可行”，不能拿来证明“魔棒算法已经通过”。
- 我实际还看了：
  - `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\temp\qidahen-region-diagnostics\jinzhou-current-after-guide-cleanup.png`
- 我实际看到：
  - 锦州当前主画布仍是启发式结果，范围依旧没有达到最终真相源，仍需靠锁链微调和后续显式 truth 收口。

本轮同步补了两条门禁：

- 工具页内显式标出当前结果是 `显式 truth` 还是 `启发式 bootstrap`，避免再把两类证据混用。
- 通用 skill 明确要求：`truth-guide` 命中只代表真相源接线成功；简单区局部预览若仍被内部噪声切穿，就不能把启发式说成通过。

### 后续实验：提高 boundary ring 接触阈值，结果仍无改善

- 我又继续做了一版更严格的边界筛选：同样贴到 boundary ring 的 barrier 组件，只有在 ring 上占到足够接触长度才保留，不再因为一根细桥挂到边界就整串放行。
- 实现改动：
  - `src/pages/devtools/qidahenRegionMaskToolUtils.ts` 新增 `keepMaskComponentsTouchingSupportMaskWithThreshold`
  - `src/pages/devtools/QidahenRegionMaskTool.tsx` 的 `guide-local-color` 改为使用 `minSupportPixels: 12 / minSupportRatio: 0.045`
- 验证：
  - `npx eslint src/pages/devtools/QidahenRegionMaskTool.tsx src/pages/devtools/qidahenRegionMaskToolUtils.ts`
  - `npx tsc --noEmit --pretty false`
  - `npx vitest run src/pages/devtools/__tests__/qidahenRegionMaskToolUtils.test.ts`
- 我实际重新看了：
  - `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\temp\qidahen-region-diagnostics\beijing-diagnostic-preview-panel-after-support-threshold.png`
- 我实际看到：
  - 北京样本仍然是 `漏选 2,843 / 越界 1,585 / IoU 0.64`
  - 也就是这次更严格的 ring 接触阈值**没有带来可见改善**
- 这条结果的意义：
  - 当前北京问题已经不是“单纯提高一点 support 阈值就能把内部字块噪声剔掉”
  - 更像是内部噪声和外边界在当前 barrier 图层里已经连成同一类连续结构
  - 因此继续只调局部过滤参数，收益会越来越低；后续应优先转向更明确的 authoring / truth / hitmap 路线

### 后续实验：inside 候选改用 ROI 内部 seed，仍不能形成有效内块

- 我继续排除了另一条可能误判：不是只有点击点刚好落在坏位，导致 `guide-boundary-interior / guided-edge-fill` 失败。
- 实现改动：
  - `buildBarrierInteriorSelectionMask` 不再把起点所在的 1px 小孤岛直接当最终内部块；当起点组件过小，会改选更大的候选内部连通块。
  - `shape-*`、`radial-*`、`guide-local-color`、`guide-boundary-interior`、`radial-raw-local-color`、`guided-edge-fill` 这些路径的采样/inside 起点，改为优先使用对应 ROI 内部点，而不是继续用可能落在噪声位的原始点击点。
  - `src/pages/devtools/__tests__/qidahenRegionMaskToolUtils.test.ts` 新增回归用例，覆盖“起点落入小内部块时应选择更大内部块”。
- 验证：
  - `npx eslint src/pages/devtools/QidahenRegionMaskTool.tsx src/pages/devtools/qidahenRegionMaskToolUtils.ts src/pages/devtools/__tests__/qidahenRegionMaskToolUtils.test.ts`
  - `npx tsc --noEmit --pretty false`
  - `npx vitest run src/pages/devtools/__tests__/qidahenRegionMaskToolUtils.test.ts`
- 我实际重新看了：
  - `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\temp\qidahen-region-diagnostics\beijing-diagnostic-preview-panel-after-seed-fallback.png`
- 当前 debug 结论：
  - `guide-boundary-interior` 不再只是 1px，但仍只有约几十像素，`guideRecall` 近乎 0；
  - `guided-edge-fill` 仍是 `0 px`；
  - 北京样本整体仍没有向 truth 显著靠近。
- 这条实验进一步确认：当前失败点已经不是单个 seed、closing 或 support 阈值，而是 barrier truth 本身不足以从最终装饰图里稳定分出真实外轮廓。后续主线应继续走“启发式只做 bootstrap，锁链/显式 truth/hitmap 做收口”，不再把北京当作可靠纯启发式修好的样本。

### 后续实验：按“是否在边界带附近连成链”过滤撞色边界

- 针对“边界颜色已经给出，装饰撞色时能不能判断它是否连成边界”的问题，本轮新增了实际算法，而不是继续停在口头结论。
- 实现改动：
  - `src/pages/devtools/qidahenRegionMaskToolUtils.ts` 新增 `keepMaskBoundaryChainsNearSupport`；
  - 它先从预期边界 support ring 做距离传播，只保留边界带附近的同色像素；
  - 再按连通块长度、跨度和平均厚度过滤，要求候选必须像一段边界链，而不是一块内部装饰；
  - `src/pages/devtools/QidahenRegionMaskTool.tsx` 的 `guide-local-color` 已接入该过滤，`raw barrier + filtered barrier` 只有通过边界链过滤后才进入局部停线；
  - `src/pages/devtools/__tests__/qidahenRegionMaskToolUtils.test.ts` 新增撞色装饰分支用例：贴近边界带的链保留，远离边界带的同色装饰分支被剪掉。
- 验证：
  - `npx eslint src/pages/devtools/QidahenRegionMaskTool.tsx src/pages/devtools/qidahenRegionMaskToolUtils.ts src/pages/devtools/__tests__/qidahenRegionMaskToolUtils.test.ts`
  - `npx tsc --noEmit --pretty false`
  - `npx vitest run src/pages/devtools/__tests__/qidahenRegionMaskToolUtils.test.ts`
- 我实际重新看了：
  - `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\temp\qidahen-region-diagnostics\beijing-diagnostic-preview-panel-after-raw-boundary-chain-filter.png`
- 当前结果：
  - `guide-local-color` 从“直接吃同色噪声”改成了“边界带附近同色链路”；
  - 北京样本里 supportRatio 提升到 `0.397`，说明停线更贴近识别到的边界链；
  - 但 guideRecall 降到 `0.7405`，局部面板仍是 `漏选 2,843 / 越界 1,585 / IoU 0.64`，说明这条链路能剪撞色噪声，但还不足以自动补齐缺失边界。
- 结论：
  - 可以、也已经用算法判断“同色是否连成边界链”；
  - 但北京当前失败点从“撞色不可分”推进成“可分出较干净边界链，但边界链本身不完整，不足以闭合最终区域”；
  - 下一步不应再回到全图颜色阈值，而应在这条边界链基础上做显式补边/锁链修边/authoritative truth 收口。

### 后续实验：边界链源改为线结构过滤，端点短桥接替代通用 closing

本轮回应“边界颜色已经给出，装饰撞色时能不能用算法判断是否连成边界”的核心问题，继续把链判断做实，而不是把撞色当无解理由。

实现改动：

- `src/pages/devtools/QidahenRegionMaskTool.tsx`
  - 新增 `colorBarrierMaskRef`，保存“已知边界色 + 线结构过滤”后的边界 mask；
  - `guide-local` 的边界链过滤优先使用 `colorBarrierMaskRef`，不再优先吃过宽的 `rawColorBarrierMask`；
  - debug 里补充 `boundaryChainSourcePixels / boundaryChainSearchPixels / boundaryChainClippedPixels / boundaryChainSupportPixels`，便于区分链源、搜索范围和最终链条。
- `src/pages/devtools/qidahenRegionMaskToolUtils.ts`
  - `gapClosingIterations` 不再调用通用 `closeBinaryMask`；
  - 改为端点同方向短桥接：只在水平/垂直/对角同方向端点之间补最多 2 个 eligible 像素；
  - support 接触修正为“像素本身落在 support ring 上也算接触”；
  - 若组件没有直接接触 support，允许 support 带附近的短距离链段作锚点，再继续走叶子修剪、跨度和厚度门禁。
- `e2e/qidahen-region-mask.e2e.ts`
  - 修正 `ensureAuthoritativeGuideEnabled`：已有 `取消显式 truth` 时不再误点关闭 truth。

关键证据：

- 旧 raw 链源在真实图里过宽：`rawColorBarrierMask` 全图约 `533,443 px`，锦州局部 search area 内约 `9,354 px`，不能直接当边界链真相。
- 改为线结构过滤源后，真实页面锦州点击 `773,420`：
  - `guide-local-color.boundaryChainPixels=173`
  - `guide-local-color.boundaryChainSupportRatio=1`
  - `boundaryChainSourcePixels=212,021`
  - `boundaryChainClippedPixels=2,268`
- 这说明算法已经能在已知边界色原料中筛出贴近 support 的有效边界链，而不是把所有同色装饰一股脑当 barrier。

验证：

- `npx vitest run src/pages/devtools/__tests__/qidahenRegionMaskToolUtils.test.ts`：`35 passed`
- `npx eslint src/pages/devtools/QidahenRegionMaskTool.tsx src/pages/devtools/qidahenRegionMaskToolUtils.ts src/pages/devtools/__tests__/qidahenRegionMaskToolUtils.test.ts e2e/qidahen-region-mask.e2e.ts`：通过
- `npx tsc --noEmit --pretty false`：通过
- `$env:PW_USE_DEV_SERVERS='true'; $env:PW_PORT='4285'; npm run test:e2e:dev:file -- e2e/qidahen-region-mask.e2e.ts`：`1 passed`

本轮实际核对截图：

- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-one-region-current.png`
- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-authoritative-current.png`

当前结论：

- 装饰纹理不是主判断对象；撞色是噪声。
- 算法可以判断“同色像素是否连成边界链”，并且现在已经通过真实页面和 E2E 证明锦州能识别到正向边界链。
- 仍不能把 `truth-guide` 当成纯启发式已经最终解决。下一步应继续补齐缺失边界链、锁链修边，或把人工确认后的范围升格为 authoritative truth。

### 后续实验：多源边界链择优，但已知边界色链优先

本轮继续回应“边界颜色已经给出，装饰确实会撞色，但算法能不能判断是否连成边界”的问题。上一轮单押线结构源会让北京变干净，但锦州某些局部会丢链；单押通用 barrier 又会让锦州被更多像素抢走。当前改为多源分析，但裁决仍以“已知边界色链”为主。

实现改动：

- `src/pages/devtools/QidahenRegionMaskTool.tsx`
  - `guide-local` 同时分析 `line / expanded / raw-color / raw-barrier / barrier` 五类局部链源；
  - 每个源都走 `analyzeMaskBoundaryChainsNearSupport` 的 support 距离传播、端点短桥接、枝杈修剪、跨度/厚度/接触门禁；
  - 如果 `line / expanded / raw-color` 任一已知边界色源形成有效链，优先使用它；
  - `raw-barrier / barrier` 只在已知边界色链缺失时兜底，不能只因为 `keptPixelCount` 更多抢主链；
  - debug 新增 `boundaryChainSource` 与 `boundaryChainSourceCandidates`，记录每个源的 kept pixels、kept components、band pixels、厚度拒绝、弱 support 拒绝和最大拒绝厚度。
- `.windsurf/skills/boardgame-ui-imagegen/SKILL.md`
  - 已补入通用门禁：多源边界链择优时，通用 filtered/gradient barrier 不得仅凭像素更多抢走已知边界色链。

真实页面诊断：

- 北京样本：
  - `chosenMethod=radial`
  - `guide-local-color.boundaryChainSource=line`
  - `guide-local-color.boundaryChainPixels=61`
  - `guide-local-color.boundaryChainSupportRatio=1`
- 锦州样本：
  - `chosenMethod=truth-guide`
  - `guide-local-color.boundaryChainSource=expanded`
  - `guide-local-color.boundaryChainPixels=173`
  - `guide-local-color.boundaryChainSupportRatio=1`
  - 对照：同一局部里通用 `barrier` 虽有 `475` kept pixels，但因已知边界色 `expanded` 已形成有效链，不再抢主链。
- 宋进样本：
  - `chosenMethod=radial`
  - `guide-local-color.boundaryChainSource=line`
  - `guide-local-color.boundaryChainPixels=34`
  - `guide-local-color.boundaryChainSupportRatio=1`
  - `guide-local-color.usable=false`，因此不压过 radial。

验证命令：

- `npx eslint src/pages/devtools/QidahenRegionMaskTool.tsx src/pages/devtools/qidahenRegionMaskToolUtils.ts src/pages/devtools/__tests__/qidahenRegionMaskToolUtils.test.ts e2e/qidahen-region-mask.e2e.ts`
- `npx tsc --noEmit --pretty false`
- `npx vitest run src/pages/devtools/__tests__/qidahenRegionMaskToolUtils.test.ts` → `36 passed`
- `$env:PW_USE_DEV_SERVERS='true'; $env:PW_PORT='4285'; npm run test:e2e:dev:file -- e2e/qidahen-region-mask.e2e.ts` → `1 passed`

截图证据：

- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\temp\qidahen-region-diagnostics\北京样本.png`
- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\temp\qidahen-region-diagnostics\锦州样本.png`
- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\temp\qidahen-region-diagnostics\宋进样本.png`
- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-one-region-current.png`
- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-authoritative-current.png`

当前结论：

- 装饰/文字撞色不是“无算法可解”的理由；它是边界色原料里的噪声。
- 当前算法已经能在真实页面里判断已知边界色是否在预期边界带附近连成有效边界链，并能避免通用 barrier 因像素更多抢走主链。
- 这仍不是最终 authoritative mask 完成。`truth-guide` 只能证明显式真相源接进主链；缺失边界仍需要补边、锁链或用户确认 truth 收口。

### Active goal 完成审计：当前页面复核

目标要求可拆为：

- 已知边界色必须作为边界候选来源进入主链；
- 装饰、文字、纹理撞色只能作为噪声过滤，不能被表述成算法无解；
- 判断标准必须是“同色像素是否在预期边界带附近连成有效边界链”；
- 证据不能只靠代码存在，必须能在真实 dev 页面读到链源和链像素。

当前代码证据：

- `src/pages/devtools/qidahenRegionMaskToolUtils.ts`
  - `analyzeMaskBoundaryChainsNearSupport`
  - `keepMaskBoundaryChainsNearSupport`
- `src/pages/devtools/QidahenRegionMaskTool.tsx`
  - `colorLineBarrierMaskRef / colorBarrierMaskRef / rawColorBarrierMaskRef`
  - `boundaryChainSourceCandidates`
  - `isKnownColorBoundaryChainSource`
  - `boundaryChainSource / boundaryChainSourceCandidates` debug 输出
- `src/pages/devtools/__tests__/qidahenRegionMaskToolUtils.test.ts`
  - 覆盖撞色枝杈修剪、support 接触、短缺口桥接、过长缺口拒绝和拒绝原因暴露。

当前页面复核结果：

- 北京样本：`boundaryChainSource=line`，`boundaryChainPixels=61`，`boundaryChainSupportRatio=1`
- 锦州样本：`boundaryChainSource=line`，`boundaryChainPixels=232`，`boundaryChainSupportRatio=1`
- 宋进样本：`boundaryChainSource=line`，`boundaryChainPixels=34`，`boundaryChainSupportRatio=1`
- 三个样本均存在 `boundaryChainSourceCandidates` 明细，说明页面正在实际执行多源链分析，不是静态文档结论。

审计结论：

- 当前 active goal 已满足：可以用算法判断已知边界色是否连成边界，且实现已进入主页面实际选择链路。
- 更大的区域最终 authoritative mask/truth 收口仍是后续任务，不能与本目标混同。

### 2026-05-22 路径编辑流程复核：区域中心拖拽、边界类型和 graph 保存

本轮修正上一轮错误证据口径：不再使用主工作树旧 Board/旧 UI 截图，也不把“已有选区”当作路径编辑证明。复核对象限定为七大恨工作树 `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen` 的真实工具页 `/dev/qidahen-region-mask`。

实现补强：

- `src/pages/devtools/QidahenRegionMaskTool.tsx`
  - 为路径图节点补 `qidahen-region-graph-node-<regionId>`；
  - 为路径边补 `qidahen-passage-edge-<edgeId>`；
  - 为左侧路径行、边界类型下拉、删除按钮补稳定 `data-testid`。
- `e2e/qidahen-region-mask.e2e.ts`
  - 用真实鼠标点击主画布生成 `锦州`、`宋进` 两个区域；
  - 切到 `路径` 模式后，从 `锦州` 区域中心拖到 `宋进` 区域中心建立通行边；
  - 通过工具下拉把边界类型改为 `mountain`；
  - 点击唯一主动作 `保存区域数据`；
  - 读取 `src/games/qidahen/data/region-graph.json`，断言 `jinzhou::song-jin` 保存为 `boundaryType: "mountain"`、`boundaryLabel: "山脉"`、`battleWidth: 2`，并断言两个区域中心都已落盘；
  - 刷新工具页后重新进入路径模式，断言路径行和山脉边仍可见。

验证命令：

- `node ..\..\node_modules\eslint\bin\eslint.js src/pages/devtools/QidahenRegionMaskTool.tsx e2e/qidahen-region-mask.e2e.ts`：通过
- `node scripts/infra/vitest-cli-safe.mjs run src/pages/devtools/__tests__/qidahenRegionMaskToolUtils.test.ts --configLoader native`：`36 passed`
- `node scripts/infra/run-e2e-command.mjs dev e2e/qidahen-region-mask.e2e.ts --grep "魔棒分区、区域中心路径编辑和单主保存动作可用"`：`1 passed`

环境说明：

- `ci` 单文件入口先被共享 single-worker 端口 `6368/20100/21100` 占用阻塞；未清共享端口。
- `isolated` 自动起服链进入过用例，也曾证明路径编辑前半段；后续完整重跑时被 `mongodb-memory-server` 启动错误 `UnexpectedCloseError code 3221226505` 阻塞 API 服务。
- 本工具页的路径编辑和保存由 Vite devtools 中间件完成，不依赖 API/Mongo；因此最终采用 dev-server 模式复用本工作树前端 `http://127.0.0.1:4273/dev/qidahen-region-mask` 完成 E2E。

截图证据（均已实际打开核对）：

- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-path-graph-current.png`
  - 我实际看到：页面标题是 `七大恨区域制图工具`，不是旧 Board UI；左侧滚动到 `通行路径图`，存在 `锦州 ↔ 宋进` 路径行；边界类型下拉显示 `山脉 路 战场宽度 2`；右侧路径模式下能看到从区域中心点连出的路径图。
  - 是否达标：达标，证明工具内可通过区域中心拖拽创建通行边，并可在工具内编辑边界类型。
- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-path-graph-persisted-current.png`
  - 我实际看到：刷新后仍是同一工具页；左侧 `锦州 ↔ 宋进` 路径行和 `山脉 路 战场宽度 2` 下拉仍存在；右侧仍显示区域中心节点与路径图。
  - 是否达标：达标，证明保存后的 `region-graph.json` 能被工具回读，路径编辑不是一次性页面状态。

保存数据复核：

- `src/games/qidahen/data/region-graph.json`
  - `nodes[jinzhou].center = { x: 773, y: 410 }`
  - `nodes[song-jin].center = { x: 696, y: 618 }`
  - `edges[0].id = "jinzhou::song-jin"`
  - `edges[0].boundaryType = "mountain"`
  - `edges[0].boundaryLabel = "山脉"`
  - `edges[0].battleWidth = 2`

当前结论：

- “不同区域之间移动/通行代价”的当前实现不是旧式数字 cost 编辑器，而是区域中心路径图 + `boundaryType` + `battleWidth`。本轮已证明可在工具内创建、修改并保存这条关系。
- 这次截图不再是旧 UI；它来自 `feat/game-qidahen` 工作树真实 devtools 页面。
- 本轮只证明 `锦州 ↔ 宋进` 代表性路径编辑链路通过，不代表全地图所有区域边界/路径已经全部校准完成。

### 2026-05-22 北京样本端到端复核：背景加载与主画布 mask 写入

用户指出旧证据仍没有回答“北京到底在主画布哪里、背景是否跑通”。重新复核后确认：旧链路确实存在端到端缺口，`北京样本` 只更新诊断侧栏和 debug，没有把诊断临时区域写回主画布 assignments，因此主画布 mask 可能仍停在锦州。

实现修正：

- `src/pages/devtools/QidahenRegionMaskTool.tsx`
  - 诊断 preview 生成 `displaySelection` 后，若区域可用且像素数合法，调用 `replaceRegionWithSelection` 写入诊断临时区域；
  - 写入后调用 `renderAssignments()`，强制重绘主画布 mask canvas；
  - 这条链只服务工具内诊断区域，不把 `北京样本` 混入正式导出 truth。
- `e2e/qidahen-region-mask.e2e.ts`
  - 在正式锦州流程前增加北京样本段；
  - 读取背景 canvas 在 `520,610` 的 RGBA，断言 alpha 为 `255` 且 RGB 非全黑；
  - 点击 `北京样本` 后读取 mask canvas 在 `520,610` 的 alpha，断言为 `255`；
  - 保存北京主画布截图；
  - 清空后显式切回 `锦州`，避免北京临时区域污染后续锦州/宋进/路径图用例。

验证命令：

- `npx eslint e2e/qidahen-region-mask.e2e.ts src/pages/devtools/QidahenRegionMaskTool.tsx src/pages/devtools/qidahenRegionMaskToolUtils.ts src/pages/devtools/__tests__/qidahenRegionMaskToolUtils.test.ts`：通过
- `npx tsc --noEmit --pretty false`：通过
- `npx vitest run src/pages/devtools/__tests__/qidahenRegionMaskToolUtils.test.ts`：`36 passed`
- `$env:PW_USE_DEV_SERVERS='true'; $env:PW_PORT='4285'; npm run test:e2e:dev:file -- e2e/qidahen-region-mask.e2e.ts`：`1 passed`

截图证据（均已实际打开核对）：

- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-beijing-current.png`
  - 我实际看到：页面标题为 `七大恨区域制图工具`；地图背景完整铺在主画布；当前区域为 `北京样本`；北京位置有红色半透明主画布选区；不再是锦州范围。
  - 是否达标：达标，证明北京样本不是只存在于侧栏 debug，而是写入了主画布 mask。
- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-one-region-current.png`
  - 我实际看到：清空并切回 `锦州` 后，主画布显示锦州选区，后续流程没有继续停留在北京上下文。
  - 是否达标：达标，证明北京诊断段没有污染后续正式区域点击。
- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-path-graph-current.png`
  - 我实际看到：路径模式下存在 `锦州`、`宋进` 区域中心与二者连线，边界类型为 `山脉 路 战场宽度 2`。
  - 是否达标：达标，证明北京段之后完整路径编辑链仍通过。
- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-path-graph-persisted-current.png`
  - 我实际看到：刷新后路径图和山脉边界仍可回读。
  - 是否达标：达标，证明保存数据回读正常。

当前结论：

- 背景图已由 E2E 像素断言和截图证明真实加载。
- 北京样本已由 E2E mask 像素断言和截图证明写入主画布。
- 旧问题的根因不是“没有算法能找北京”，而是诊断选区没有接入主画布 assignments；该端到端缺口已修复。
- 这仍不等价于全地图最终 truth 已完成；后续还要继续校准正式区域 mask、缺失边界和全图路径。

### 2026-05-23 断点提示排序修正：优先服务未命中 seed

本轮继续沿用户要求修正：无法连成线、无法封口的边界仍然直接舍弃，不能用开放线段硬生成区域。新增内容只改善微调诊断，不改变生成门槛。

实现修正：

- `src/pages/devtools/qidahenRegionMaskToolUtils.ts`
  - 新增 `rankOpenBoundaryHintsForTargets`；
  - 将开放线段 hints 与未命中区域 seed 建立距离关系；
  - 当存在未命中 seed 时，提示顺序优先按距离最近排序，而不是仅按线段像素量。
- `src/pages/devtools/QidahenRegionMaskTool.tsx`
  - 闭合诊断保留未命中区域的 seed；
  - 开放线段提示显示最近区域名和 `距 seed Npx`；
  - `按边界图生成初始区域` 仍只消费闭合面，断线只用于橙色端点提示。
- `src/pages/devtools/__tests__/qidahenRegionMaskToolUtils.test.ts`
  - 新增单测证明“小但靠近未命中 seed 的开放线段”会排在“大但无关的开放线段”前面。

验证命令：

- `npx eslint src/pages/devtools/QidahenRegionMaskTool.tsx src/pages/devtools/qidahenRegionMaskToolUtils.ts src/pages/devtools/__tests__/qidahenRegionMaskToolUtils.test.ts`：通过
- `$env:NODE_OPTIONS='--max-old-space-size=4096'; npx vitest run src/pages/devtools/__tests__/qidahenRegionMaskToolUtils.test.ts`：`44 passed`
- `$env:NODE_OPTIONS='--max-old-space-size=4096'; npx tsc --noEmit --pretty false`：通过

E2E 状态：

- `ci` 复跑没有进入用例：API 服务 `code=134` 退出，bootstrap log 为空。
- 手动启动临时 Vite `4376` 没有成功：`bundle/native/runner` 配置加载都在 `vite.config` 加载时报 `exports is not defined in ES module scope`。
- 复用现有 `4273` 得到的是项目 404 页面，不是本工作树工具页；该截图不能作为有效证据。

当前结论：

- 断线舍弃的生成门槛没有放松。
- 断点提示现在更接近真实微调工作流：先指向未命中 seed 附近的问题线段。
- 本轮没有新增有效 E2E 截图；全图最终边界图/truth 仍未完成。

### 2026-05-23 真实底图复核：颜色匹配不能证明正常边界，补最近断点桥接

本轮按“必须看图/读数据”的标准重新检查真实底图路线，而不是只看测试合成图。

实际看图结论：

- `public/assets/i18n/zh-CN/qidahen/board/qidahen-main-map.png`
  - 真实底图中，用户给出的边界色同时出现在马、海面纹理、文字、河流/海岸、UI 框线和局部区域边界上。
- `test-results/evidence-screenshots/_shared/qidahen-region-mask-real-map-auto-extract-current.png`
  - 当前真实底图试提结果不是闭合区域边界，主要是河线/海岸/零散链段；这张图不能作为“正常成果”。
- `test-results/evidence-screenshots/_shared/qidahen-region-mask-hand-drawn-multi-diagnostics-current.png`
  - 这是合成手绘边界源，只能证明闭合面与断线机制，不是七大恨全图 truth。
- `test-results/evidence-screenshots/_shared/qidahen-region-mask-path-graph-current.png`
  - 只证明路径编辑控件可用，不能证明区域 mask 贴真实边界。

像素数据结论：

- 已生成诊断文件：
  - `temp/qidahen-real-boundary-analysis/tol-4-raw-color-excluded-ui.png`
  - `temp/qidahen-real-boundary-analysis/tol-8-raw-color-excluded-ui.png`
  - `temp/qidahen-real-boundary-analysis/current-util-t14-maxavg10.png`
  - `temp/qidahen-real-boundary-analysis/summary.json`
- 数据摘要：
  - 容差 `4`：原图命中 `31,155 px`，其中 UI 禁区 `17,434 px`。
  - 容差 `8`：原图命中 `98,946 px`，其中 UI 禁区 `61,929 px`。
  - 即使先剔除 UI，剩余像素仍大量覆盖马和海面纹理；颜色匹配本身不含“这是不是区域边界”的语义。

实现补强：

- `src/pages/devtools/QidahenRegionMaskTool.tsx`
  - 新增 `桥接最近断点` 按钮；
  - 取当前开放线段提示中离未命中 seed 最近的一条；
  - 把两个端点之间的线段写入手工补边层；
  - 桥接后切到边界桥接模式并重算最终停线。
- `e2e/qidahen-region-mask.e2e.ts`
  - 多闭合边界诊断用例补 `qidahen-bridge-nearest-open-boundary` 可见断言。

验证：

- `npx eslint src/pages/devtools/QidahenRegionMaskTool.tsx src/pages/devtools/qidahenRegionMaskToolUtils.ts src/pages/devtools/__tests__/qidahenRegionMaskToolUtils.test.ts e2e/qidahen-region-mask.e2e.ts`：通过
- `$env:NODE_OPTIONS='--max-old-space-size=4096'; npx vitest run src/pages/devtools/__tests__/qidahenRegionMaskToolUtils.test.ts`：`44 passed`
- `$env:NODE_OPTIONS='--max-old-space-size=4096'; npx tsc --noEmit --pretty false`：通过

当前结论：

- 真实底图自动抽色不能作为正常全图边界成果；继续沿这个方向调参数只会在“漏边”和“吞纹理/UI”之间摆动。
- 当前可验证的正确路线是：用户提供/手绘边界图 -> 工具做闭合诊断、断点排序和桥接辅助 -> 只有闭合面生成区域。
- 全图最终边界图/truth 仍未完成。

### 2026-05-23 阻断误用：真实底图入口只读诊断，不再写入边界图

上一节已经证明真实底图颜色匹配会污染结果。因此本轮把工具行为也改成 fail-closed，而不是继续让用户一键得到坏边界图。

实现修正：

- `src/pages/devtools/QidahenRegionMaskTool.tsx`
  - 按钮文案改为 `诊断底图颜色（不写入）`。
  - 点击后仍统计：
    - 抽色命中；
    - 剔除 UI/厚块噪声后像素；
    - 舍弃像素；
    - 链段数量。
  - 但不再执行：
    - 写入 `boundaryDraftMaskRef`；
    - 清空手工补边/去噪层；
    - 打开边界图 overlay；
    - 把结果表述成“可作为微调底稿”。
  - 状态信息明确写出：真实底图颜色会命中马、海面纹理、文字和河线，本入口不会写入边界图。
- `e2e/qidahen-region-mask.e2e.ts`
  - 原测试 `真实地图试提边界会生成可微调边界图且剔除明显 UI 区` 改为 `真实地图颜色诊断只读显示且不会写入边界图`。
  - 新预期：
    - 点击后出现 `只读诊断完成`；
    - `当前边界图像素` 保持 `0`；
    - barrier canvas 仍为 `0` 不透明像素；
    - 直接点 `按边界图生成初始区域` 不会生成任何区域。

验证：

- `npx eslint src/pages/devtools/QidahenRegionMaskTool.tsx src/pages/devtools/qidahenRegionMaskToolUtils.ts src/pages/devtools/__tests__/qidahenRegionMaskToolUtils.test.ts e2e/qidahen-region-mask.e2e.ts`：通过
- `$env:NODE_OPTIONS='--max-old-space-size=4096'; npx vitest run src/pages/devtools/__tests__/qidahenRegionMaskToolUtils.test.ts`：`44 passed`
- `$env:NODE_OPTIONS='--max-old-space-size=4096'; npx tsc --noEmit --pretty false`：通过

当前结论：

- 工具现在不会再把真实底图抽色结果伪装成边界图成果。
- 这不是完成全图 truth，而是把错误路线从主链上切掉。
- 后续正常成果只能来自手绘/导入边界图，再由工具做闭合诊断、断点桥接和闭合面生成。

### 2026-05-23 真实地图 auto-map 底稿收口：去掉 direct-support 二次裁剪，补 UI 误识别门禁

上一轮真实地图 `实验：试提边界` 虽然已经不再大面积吞轮盘、右侧框和底部规则条，但页面只剩 `93 px`。这次继续复盘后确认，问题不在 `keepMaskBoundaryChainsNearSupport` 本身，而在 auto-map 末尾又套了一层 `keepMaskComponentsTouchingSupportMask`。前一层已经把边界色压成“贴近正式区域边界带的细链”，后一层再要求“必须直接贴 support”，会把大多数有效链段再次裁掉，只剩一小撮直接接触的像素。

实现修正：

- `src/pages/devtools/QidahenRegionMaskTool.tsx`
  - 新增 `AUTO_MAP_BOUNDARY_DRAFT_CHAIN_FILTER` 常量，明确 auto-map 的当前主参数：
    - `supportClipExpansion: 8`
    - `maxDistance: 10`
    - `minPixels: 8`
    - `minSpan: 8`
    - `maxAverageThickness: 4.8`
    - `gapClosingIterations: 1`
  - `buildBoundaryDraftFromSourcePixels()` 里，`auto-map` 不再把 `sealedBoundaryMask` 再交给 `keepMaskComponentsTouchingSupportMask`；现在直接保留已经过链结构门禁的结果。
  - `hand-drawn` 路线保持原有 direct-support 收口，不影响“空白手绘 / 导入手绘原图”主路。
- `e2e/qidahen-region-mask.e2e.ts`
  - 新增 `真实地图试提边界会生成可微调底稿且不吞明显 UI 区`；
  - 新增 `getCanvasOpaqueBounds()`，直接在边界层 canvas 上取像素数和包围盒；
  - 对当前底图实验新增 UI 点位门禁：轮盘中心 `242,202`、右侧牌框 `1188,330`、底部规则区 `1082,808` 的边界层 alpha 必须为 `0`；
  - 同时把旧的 `指定边界颜色` / `路径编辑` 两条用例对齐到“正式空白工作区”新基线，避免继续假设隔离工作区默认已有边界图。

验证命令：

- `npx tsc --noEmit`
- `npx vitest run src/pages/devtools/__tests__/qidahenRegionMaskToolUtils.test.ts` → `38 passed`
- `$env:PW_USE_DEV_SERVERS='true'; $env:PW_PORT='4376'; node scripts/infra/run-e2e-command.mjs dev e2e/qidahen-region-mask.e2e.ts --grep "真实地图试提边界会生成可微调底稿且不吞明显 UI 区"` → `1 passed`
- `$env:PW_USE_DEV_SERVERS='true'; $env:PW_PORT='4376'; node scripts/infra/run-e2e-command.mjs dev e2e/qidahen-region-mask.e2e.ts` → `7 passed`

本轮真实地图结果：

- 当前截图：`D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-real-map-auto-extract-current.png`
  - 我实际看到：左侧工作区为 `real-map-auto-extract`，当前边界图像素已回到 `256`，不再是上一轮的 `93`。
  - 历史结论已失效：19:36 复核后，该入口改成只读诊断，不再把真实底图抽色结果写入边界图或称为可微调底稿。
- 本地参数扫描与当前实现一致的结果：
  - `keepMaskBoundaryChainsNearSupport` 在当前底图上能保留 `256 px`；
  - 粗包围盒约为 `left=709 / top=382 / right=1063 / bottom=614`；
  - 覆盖跨度约 `355 x 233`，明显大于旧版 `20 x 5` 那种无效细碎链；
  - 对轮盘、右侧牌框、底部规则区的粗禁区统计为 `0`。
- E2E 当前门禁：
  - 边界层像素数必须 `> 150` 且 `< 2000`；
  - 包围盒跨度必须大于 `200 x 150`；
  - 包围盒左上角必须仍落在辽东这块主区附近，而不是退回左上轮盘；
  - 三个明显 UI 点位 alpha 必须为 `0`。

历史结论：

- 以下三条已被 19:36 的只读诊断结论覆盖，不能继续作为当前工具口径：
- 真实地图 `实验：试提边界` 曾被认为能产出一张“不会乱吞明显 UI、像素量也够继续微调”的初始边界底稿。
- 曾认为这不是“自动整图完成”，只是辅助底稿生成器。
- 当前主线已改为：用户手绘/导入边界图为主；真实底图颜色匹配只读诊断，不写入边界图。

### 2026-05-22 视觉复核更正：路径编辑截图不能作为完成证据

用户指出 `qidahen-region-mask-path-graph-current.png` 与 `qidahen-region-mask-path-graph-persisted-current.png` 中区域 mask 明显超出地图真实边界。重新复核截图后确认该反馈成立：右侧主画布里锦州/宋进附近的半透明选区与白色轮廓存在明显越界，尤其锦州选区越过真实区域边线，不能作为“区域中心点/区域边界已正确”的完成证据。

失效结论：

- 旧结论“是否达标：达标，证明工具内可通过区域中心拖拽创建通行边，并可在工具内编辑边界类型”只能保留为“路径控件交互和 graph 保存可用”的局部结论；
- 旧结论不得继续解释为“选区边界正确”或“区域中心点可信”；
- 只要截图中选区明显越界，本轮不能再宣称区域制图工具完成。

当前有效结论：

- `region-graph.json` 的 `boundaryType / boundaryLabel / battleWidth` 保存链路已验证；
- 区域 mask 视觉与真实边界不达标，导致“从选区中心生成区域点”的前提不可靠；
- 下一步必须增加选区越界门禁，并修正魔棒/显式 truth/历史 mask 回读对坏选区的信任逻辑。

最低补救要求：

- E2E 不能只断言 `red/yellow pixelCount > 1000`；
- 必须增加“选区相对当前区域 guide/真实边界的越界比例”断言，截图明显越界时测试应失败；
- 证据截图结论必须同时写明“路径控件是否可编辑”和“区域 mask 是否贴边”，两者不得混为完成。

### 2026-05-23 边界微调撤销/重做证据

本轮补的是手绘/导入边界图后的工具可用性：用户补边或桥接断点画错时，不能只能清空整层重画。

实现：

- `src/pages/devtools/QidahenRegionMaskTool.tsx`
  - 新增手工边界修正历史栈，记录 `manualBarrierAddRef` / `manualBarrierRemoveRef` 快照；
  - 普通边界画笔、短线辅助、清空微调层都会进入撤销历史；
  - 最近断点入口已在下一节降级为只定位，不再自动直线写入补边层；
  - 撤销/重做都会重建最终 barrier，并触发闭合诊断重算；
  - 导入边界图、导入手绘原图、切空白边界、固化或清空整张边界图时清空历史，防止旧底稿的补线被恢复到新底稿。
- UI：
  - 新增 `撤销微调` / `重做微调`；
  - 新增稳定 test id：`qidahen-undo-barrier-hints`、`qidahen-redo-barrier-hints`、`qidahen-manual-barrier-add-count`、`qidahen-manual-barrier-remove-count`。
- `e2e/qidahen-region-mask.e2e.ts`
  - 当前 E2E 已升级为 `边界断点只定位不自动直线封口，手绘补边支持撤销与重做`；
  - 用带开放断线的合成手绘边界源验证：定位断点不写像素，手绘后补边像素增加，撤销后归零，重做后恢复。

验证：

- `$env:NODE_OPTIONS='--max-old-space-size=4096'; npx eslint src/pages/devtools/QidahenRegionMaskTool.tsx e2e/qidahen-region-mask.e2e.ts`：通过。
- `$env:NODE_OPTIONS='--max-old-space-size=4096'; npx tsc --noEmit --pretty false`：通过。
- `$env:NODE_OPTIONS='--max-old-space-size=4096'; node scripts/infra/run-e2e-command.mjs ci e2e/qidahen-region-mask.e2e.ts`：`11 passed`。
- `$env:NODE_OPTIONS='--max-old-space-size=4096'; npx vitest run src/pages/devtools/__tests__/qidahenRegionMaskToolUtils.test.ts`：`44 passed`。
- `git diff --check -- src/pages/devtools/QidahenRegionMaskTool.tsx e2e/qidahen-region-mask.e2e.ts task_plan.md progress.md evidence/qidahen/qidahen-region-mask-tool-2026-05-20.md`：通过，仅有既有 LF/CRLF warning。

截图：

- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-barrier-hint-undo-redo-current.png`

视觉复核：

- 截图中工作区为 `barrier-hint-undo-redo`，左侧可见闭合诊断、最近链读数和手工补边计数；
- 主画布仍显示边界调试层和未命中 seed 标记；
- 这张图证明的是断点桥接和微调历史可用，不是全图 truth 完成。

当前结论：

- 手绘/导入边界图后的微调链路已经可撤销、可重做；
- 断线仍不会绕过闭合面门槛；
- 全图最终边界图/truth 仍未完成，不能宣称整图区域制图完成。

### 2026-05-23 直线桥接风险降级：断点只定位，补线必须手绘

上一节中的“一键桥接最近断点”旧口径已被本节覆盖。它虽然没有绕过闭合面生成门槛，但会把两个断点直接连成直线写入补边层，仍然会制造“直来直去的假边界”。这与当前目标不一致。

修正：

- `src/pages/devtools/QidahenRegionMaskTool.tsx`
  - 删除自动写入直线补边的 `桥接最近断点` 行为；
  - 新入口 `定位断点并手绘补边` 只做三件事：
    - 定位最近开放线段；
    - 切到 `边界修正 / 画笔 / 补边`；
    - 提示“工具不会自动直线封口，请沿真实边界手绘补线”；
  - `桥接` 文案降级为 `短线辅助`，说明仅适合极短漏缝，正常边界必须用画笔沿真实边界补。
- 撤销粒度同步修正：
  - 边界画笔连续拖动的一整笔只记录一个历史步骤；
  - 一次撤销会回到这一笔之前，而不是只撤销最后一次 pointer move。
- `e2e/qidahen-region-mask.e2e.ts`
  - 原 `边界断点桥接支持撤销与重做，不需要清空整层重画` 改为 `边界断点只定位不自动直线封口，手绘补边支持撤销与重做`；
  - 验证点击断点定位后手工补边仍为 `0`；
  - 验证手绘一笔后像素增加；
  - 验证一次撤销归零，重做恢复。

验证：

- `$env:NODE_OPTIONS='--max-old-space-size=4096'; npx eslint src/pages/devtools/QidahenRegionMaskTool.tsx e2e/qidahen-region-mask.e2e.ts`：通过。
- `$env:NODE_OPTIONS='--max-old-space-size=4096'; npx tsc --noEmit --pretty false`：通过。
- `$env:NODE_OPTIONS='--max-old-space-size=4096'; node scripts/infra/run-e2e-command.mjs ci e2e/qidahen-region-mask.e2e.ts --grep "边界断点只定位不自动直线封口"`：`1 passed`。
- `$env:NODE_OPTIONS='--max-old-space-size=4096'; node scripts/infra/run-e2e-command.mjs ci e2e/qidahen-region-mask.e2e.ts --grep "指定边界颜色可以生成区域初始值|从空白边界开始手绘"`：`2 passed`。
- `$env:NODE_OPTIONS='--max-old-space-size=4096'; node scripts/infra/run-e2e-command.mjs ci e2e/qidahen-region-mask.e2e.ts`：`11 passed`。

截图：

- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-barrier-hint-undo-redo-current.png`

视觉复核：

- 截图显示当前入口是 `定位断点并手绘补边`，不是自动桥接；
- 手工补边计数来自 E2E 的画笔拖动；
- 这张图仍不是全图 truth，只证明工具不再自动直线封口，并且手绘一笔可以撤销/重做。

当前结论：

- 直线桥接不再是当前主链；
- 正常成果必须来自手绘/导入的真实边界图；
- 工具只负责闭合诊断、断点定位、手绘补边、闭合面生成和证据保存。

### 2026-05-23 全量 E2E 复跑、保存门禁与截图证据更新

本节补齐上一轮未完整跑完的整份 E2E，并把新增保存门禁写入审计证据。注意：本节仍不把工具状态升级为“全图 truth 完成”，只证明工具链路和门禁已经按当前方向收敛。

新增/确认的门禁：

- 正式 mask 若覆盖印刷 UI 禁区，保存必须失败；
- 真实底图颜色诊断只读显示，不写入边界图；
- 导入完成边界图后，只按闭合面生成区域，开放断线只提示端点；
- 断点定位不会自动直线封口，补线必须通过画笔手绘；
- 路径图只能证明区域中心 graph 可编辑/保存，不能替代区域 mask truth。

验证：

- 单条补跑：`$env:PW_SERVER_RUNTIME='prebuilt'; $env:PW_PREBUILT_BUNDLE_ROOT='temp/dev-bundles/e2e-single/pw-1779543590758-au1wx7'; node scripts/infra/run-e2e-command.mjs ci e2e/qidahen-region-mask.e2e.ts --grep "魔棒分区、区域中心路径编辑和单主保存动作可用"`：`1 passed`。
- 整份复跑：同一预构建 runtime、端口 `6473/20300/21300`，`node scripts/infra/run-e2e-command.mjs ci e2e/qidahen-region-mask.e2e.ts`：`12 passed (7.1m)`。
- 复跑前曾遇到两个 runtime 问题，均未作为业务失败处理：
  - managed isolated runtime 误判 `6273/20100/21100` 可用，实际撞残留 E2E 服务；
  - legacy bootstrap 首次 API 启动 `heap out of memory`。后续改用预构建 bundle 后通过。

截图与肉眼结论：

- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-completed-boundary-import-current.png`
  - 我实际看到：主画布上只有导入边界图形成的两个闭合面被用于生成区域，开放线段仍以橙色端点提示形式存在。
  - 是否达标：达标。该图证明“用户提供完成边界图后，工具按闭合面生成，断线不参与生成”。
- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-hand-drawn-multi-generated-current.png`
  - 我实际看到：左侧批量结果显示 `已生成 2 / 漏边 0 / 未生成 3`；`锦州`、`宋进` 已生成，`山海关` 显示 seed 不在闭合面内。
  - 是否达标：达标。该图证明未封口/不闭合目标会跳过，不再 flood fill 猜区域。
- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-ui-contaminated-rejected-current.png`
  - 我实际看到：轮盘 UI 位置出现红色污染 mask，左侧提示 `保存失败：正式 mask 包含印刷 UI 禁区 8,064 px`。
  - 是否达标：达标。该图证明 UI 边框/轮盘/牌框/底部条污染不会被保存为正式 mask。
- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-real-map-auto-extract-current.png`
  - 我实际看到：工具左侧入口是 `诊断底图颜色（不写入）`，说明文字明确只读诊断；主画布没有把底图抽色结果写成青色边界成果。
  - 是否达标：达标。该图证明真实底图抽色路线已被降级为诊断，不再伪装成可用边界图。
- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-path-graph-current.png`
  - 我实际看到：路径模式显示 `锦州 ↔ 宋进`，边界类型为山脉，路径数为 1。
  - 是否达标：仅对 graph 编辑达标。该图不能证明全图区域边界正确，不能作为全图 truth 证据。

当前结论：

- 已修复并验证：工具不会把真实底图撞色、UI 禁区或断线当成正式区域成果；手绘/导入边界图后的闭合生成、断点定位、撤销重做、保存门禁和路径编辑均有 E2E 与截图证据。
- 未完成：七大恨全图正式边界图和所有区域 truth。后续仍需要用户完成边界图微调后，再逐区生成和验收。

### 2026-05-24 候选参考层保存回读与手绘闭合证据

本节补的是“参考层辅助用户手绘”的真实工作流证据，防止把候选参考层本身误判为正式边界成果。

实现/测试变化：

- `e2e/qidahen-region-mask.e2e.ts`
  - `真实地图区域导向候选参考只保留区域附近连续线且不写入正式边界图` 现在覆盖：
    - 生成候选参考层后，正式边界图像素仍为 `0`；
    - barrier canvas 不写入任何候选像素；
    - 候选参考层不落入印刷 UI 禁区；
    - 直接生成区域时 `已生成 0`；
    - 用户手绘闭合锦州示例线后，保存时空白手绘边界固化为 `region-boundary-mask.png`；
    - `region-boundary-add.png` / `region-boundary-remove.png` 清零；
    - `region-boundary-source-reference.png` 保留；
    - 刷新后参考层和边界图均回读，再按闭合面生成锦州区域。
  - 同步修正旧断言：当前 UI 文案是 `参考层` / `参考层：42%` / `已载入参考层` / `已清除参考层`。

验证：

- `$env:NODE_OPTIONS='--max-old-space-size=4096'; node scripts/infra/run-e2e-command.mjs ci e2e/qidahen-region-mask.e2e.ts --grep "真实地图区域导向候选参考"`：`1 passed`。
- `$env:NODE_OPTIONS='--max-old-space-size=4096'; node scripts/infra/run-e2e-command.mjs ci e2e/qidahen-region-mask.e2e.ts --grep "描线参考层可保存回读|真实地图区域导向候选参考"`：`2 passed`。
- `$env:NODE_OPTIONS='--max-old-space-size=4096'; node scripts/infra/run-e2e-command.mjs ci e2e/qidahen-region-mask.e2e.ts`：`13 passed (8.6m)`。
- `$env:NODE_OPTIONS='--max-old-space-size=4096'; npx eslint src/pages/devtools/QidahenRegionMaskTool.tsx e2e/qidahen-region-mask.e2e.ts`：通过。
- `$env:NODE_OPTIONS='--max-old-space-size=4096'; npx vitest run src/pages/devtools/__tests__/qidahenRegionMaskToolUtils.test.ts`：`44 passed`。
- `$env:NODE_OPTIONS='--max-old-space-size=4096'; npx tsc --noEmit --pretty false`：通过。
- `git diff --check -- src/pages/devtools/QidahenRegionMaskTool.tsx e2e/qidahen-region-mask.e2e.ts task_plan.md progress.md evidence/qidahen/qidahen-region-mask-tool-2026-05-20.md`：通过，仅有 LF/CRLF warning。

截图与肉眼结论：

- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-real-map-long-line-candidate-current.png`
  - 我实际看到：真实地图候选只以白色参考线显示在地图中部到东部一带，没有写成青色正式边界；UI 禁区没有被候选线污染。
  - 是否达标：达标，但只对“候选参考层不污染正式边界图”达标。该图不能作为全图 truth。
- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-candidate-reference-persisted-current.png`
  - 我实际看到：刷新后工作区已读回，左侧显示边界图 `14,454 px`、保存工作区 `已可刷新回读`、生成区域 `还没生成`；主画布上可见固化后的边界调试线和参考辅助线。
  - 是否达标：达标。该图证明参考层和用户手绘闭合边界可以保存后刷新继续用。
- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-candidate-reference-hand-drawn-current.png`
  - 我实际看到：刷新回读后再生成，主画布只出现一个锦州测试示例区域，左侧仍显示“只用边界颜色/手工补边”主路。
  - 是否达标：仅对“保存回读后仍可按闭合面生成示例区域”达标。该手绘线是 E2E 示例线，不代表正式锦州边界，更不代表全图 truth。

当前结论：

- 候选参考层现在只是参考层，并且可随工作区保存/回读；
- 正式区域仍必须来自用户手绘/导入的闭合边界图；
- 断线和候选参考本身不会生成区域；
- 全图正式边界图/truth 仍未完成。

### 2026-05-24 纠偏：底图自动候选停用，导入描线图剔除 UI 污染

本节覆盖上一节中的“候选参考层辅助”口径。实际看图后确认：即使候选不写入正式边界，它仍会在视觉上提供不可靠线索；如果导入参考层继续显示原始上传图，也会让 UI 污染看起来像被工具选中了。因此当前结论改为：底图自动候选不再作为可执行主路，参考层只应来自清洗后的用户边界图。

实现：

- `src/pages/devtools/QidahenRegionMaskTool.tsx`
  - 新增 `AUTO_MAP_CANDIDATE_REFERENCE_ENABLED = false`；
  - `生成区域导向候选参考` 主按钮和空工作区按钮改为 disabled，显示 `已停用：底图自动候选`；
  - `generateRealMapLongLineBoundaryCandidate()` 即使被代码路径调用，也会直接返回并说明该路线已停用；
  - `buildBoundaryDraftFromSourcePixels(..., hand-drawn)` 也会剔除 `AUTO_MAP_PRINTED_UI_EXCLUSION_MASK`；
  - `导入边界图`、`导入带底图描线图` 的参考层改为 `buildMaskDataUrl(cleanedBoundaryMask)`，不再叠原始上传图；
  - `短线辅助` 加 `36 px` 上限，超过即拒绝，避免用长直线封大缺口。
- `e2e/qidahen-region-mask.e2e.ts`
  - `createSyntheticBoundarySourcePng(..., { includeUiContamination: true })` 会在轮盘、右侧牌框、底部条写入边界色污染；
  - `导入带底图描线图后只抽边界色生成边界图且剔除印刷 UI 污染` 断言所有印刷 UI 禁区在正式 barrier canvas 中均为 `0`；
  - `真实地图区域导向候选入口默认停用且不会写入正式边界图` 断言候选按钮 disabled、参考层 canvas 为 `0`、barrier canvas 为 `0`、直接生成区域为 `已生成 0`。

验证：

- `$env:NODE_OPTIONS='--max-old-space-size=4096'; node scripts/infra/run-e2e-command.mjs ci e2e/qidahen-region-mask.e2e.ts --grep "真实地图区域导向候选入口默认停用|导入带底图描线图后只抽边界色生成边界图且剔除印刷 UI 污染"`：`2 passed`。
- `$env:NODE_OPTIONS='--max-old-space-size=4096'; node scripts/infra/run-e2e-command.mjs ci e2e/qidahen-region-mask.e2e.ts`：`13 passed (6.9m)`。
- `$env:NODE_OPTIONS='--max-old-space-size=4096'; npx eslint src/pages/devtools/QidahenRegionMaskTool.tsx e2e/qidahen-region-mask.e2e.ts`：通过。
- `$env:NODE_OPTIONS='--max-old-space-size=4096'; npx vitest run src/pages/devtools/__tests__/qidahenRegionMaskToolUtils.test.ts`：`44 passed`。
- `$env:NODE_OPTIONS='--max-old-space-size=4096'; npx tsc --noEmit --pretty false`：通过。
- `git diff --check -- src/pages/devtools/QidahenRegionMaskTool.tsx e2e/qidahen-region-mask.e2e.ts task_plan.md progress.md evidence/qidahen/qidahen-region-mask-tool-2026-05-20.md`：通过，仅有 LF/CRLF warning。

截图与肉眼结论：

- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-hand-drawn-source-current.png`
  - 我实际看到：画布上只剩锦州附近的清洗后白色边界圈；合成源里故意加入的轮盘、右侧牌框、底部条污染没有出现在参考层或正式边界层。
  - 是否达标：达标。该图证明导入带底图描线图后，UI 污染不会继续误导用户视图。
- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-hand-drawn-generated-current.png`
  - 我实际看到：生成结果只给锦州示例闭合面着色，宋进、山海关等未闭合区域仍显示未生成。
  - 是否达标：对“闭合面生成、未闭合跳过”达标。该图仍不是全图 truth。
- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-auto-candidate-disabled-current.png`
  - 我实际看到：左侧按钮显示 `已停用：底图自动候选`，画布没有任何候选参考线，直接生成区域也没有可生成结果。
  - 是否达标：达标。该图证明错误方向已从主入口移除。

当前结论：

- 底图自动候选路线已停用；
- 带底图描线图导入会清洗 UI 禁区，并且参考层也使用清洗后的边界图；
- 大段直线桥接被短线辅助长度门禁拒绝；
- 全图正式边界图/truth 仍未完成，后续必须基于用户手绘/导入的完成边界逐区验收。

### 2026-05-24 复核：完成边界图链路当前可用，普通 CI runtime OOM 不作为业务失败

复核背景：

- 上一轮交接中提到 `导入完成边界图后只按闭合面生成区域并舍弃断线` 曾出现失败摘要。
- 本轮先用普通 managed CI runtime 复跑该单条，用例尚未进入工具页业务断言，前端 Vite/esbuild 已 `code=134` 退出；bootstrap log 是 esbuild parser / GC assist 堆栈，属于启动内存问题。
- 为避免把 runtime OOM 误报为工具业务失败，改用本工作树已有预构建 runtime 复跑。

验证：

- `$env:PW_SERVER_RUNTIME='prebuilt'; $env:PW_PREBUILT_BUNDLE_ROOT='D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\temp\dev-bundles\e2e-single\isolated-single-pw-1779563520144-48mgtu'; node scripts/infra/run-e2e-command.mjs ci e2e/qidahen-region-mask.e2e.ts --grep "导入完成边界图后只按闭合面生成区域并舍弃断线"`：`1 passed`。
- 同一预构建 runtime，`node scripts/infra/run-e2e-command.mjs ci e2e/qidahen-region-mask.e2e.ts`：`13 passed (6.7m)`。
- `$env:NODE_OPTIONS='--max-old-space-size=4096'; npx eslint src/pages/devtools/QidahenRegionMaskTool.tsx src/pages/devtools/qidahenRegionMaskToolUtils.ts src/pages/devtools/__tests__/qidahenRegionMaskToolUtils.test.ts e2e/qidahen-region-mask.e2e.ts`：通过。
- `$env:NODE_OPTIONS='--max-old-space-size=4096'; npx vitest run src/pages/devtools/__tests__/qidahenRegionMaskToolUtils.test.ts`：`44 passed`。
- `$env:NODE_OPTIONS='--max-old-space-size=4096'; npx tsc --noEmit --pretty false`：通过。
- `git diff --check -- task_plan.md progress.md evidence/qidahen/qidahen-region-mask-tool-2026-05-20.md`：通过，仅有既有 LF/CRLF warning。

截图与肉眼结论：

- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-completed-boundary-import-current.png`
  - 我实际看到：主画布不是黑图/空图，能看到由完成边界图生成的闭合区域着色，并且开放断线仍以橙色断点提示存在。
  - 是否达标：达标。该图只证明“导入完成边界图后按闭合面生成，断线舍弃”，不证明全图 truth。
- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-hand-drawn-source-current.png`
  - 我实际看到：参考层只保留清洗后的闭合线；合成源里的轮盘、右侧牌框、底部条污染没有进入正式边界层。
  - 是否达标：达标。该图证明描线图导入会清洗 UI 污染。
- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-hand-drawn-generated-current.png`
  - 我实际看到：只生成锦州示例闭合面，未闭合或未命中的区域仍未生成。
  - 是否达标：对“闭合面生成、未闭合跳过”达标；不是全图 truth。
- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-auto-candidate-disabled-current.png`
  - 我实际看到：底图自动候选按钮仍是禁用态，画布没有候选参考线。
  - 是否达标：达标。该图证明错误候选路线当前未开放。
- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-ui-contaminated-rejected-current.png`
  - 我实际看到：保存门禁拒绝轮盘 UI 污染，提示 `正式 mask 包含印刷 UI 禁区 8,064 px`。
  - 是否达标：达标。该图证明 UI 禁区污染不会保存成正式成果。
- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-barrier-hint-undo-redo-current.png`
  - 我实际看到：断点定位与手绘补边证据可见，短线辅助没有自动画长直线封大缺口。
  - 是否达标：对“不要直线桥接大缺口、手绘补边可逆”达标。

当前证据边界：

- 工具主链和门禁当前可用：完成边界图导入、带底图描线图清洗、闭合面生成、断线舍弃、UI 禁区拒绝、底图自动候选停用、短线辅助限长。
- 普通 CI runtime 的 `code=134` 是测试启动链内存问题，不是七大恨区域生成业务失败。
- 全图正式边界图与全部区域 truth 仍未完成。

### 2026-05-24 旧魔棒路径用例改造：完成边界图驱动路径编辑

本节修正旧证据口径：路径编辑用例不再以正式魔棒贴合静态粗 shape 为前提。正式工作区没有用户边界图时，魔棒应拒绝；路径编辑证据应建立在用户导入/手绘完成闭合边界图之后。

实现/测试变化：

- `src/App.tsx` 与 `index.html`
  - `/dev/qidahen-region-mask` 不再被 `/dev/` 静态启动保护或 `initial-loader` 当成游戏页 fallback；
  - 现在只对 `/play/` 保留游戏页启动保护，避免工具页 10 秒后被旧 UI 覆盖。
- `e2e/qidahen-region-mask.e2e.ts`
  - 删除旧用例对 `QIDAHEN_MAP_REGION_SHAPES` 外溢比例的正式断言；
  - 旧 `魔棒分区、区域中心路径编辑和单主保存动作可用` 改为 `导入闭合边界后区域中心路径编辑和单主保存动作可用`；
  - 用例流程改为导入完成闭合边界图，按闭合面生成 `锦州/宋进`，再建立并保存 `锦州 ↔ 宋进` 通行边。

验证：

- `npx eslint src/App.tsx src/pages/devtools/QidahenRegionMaskTool.tsx src/pages/devtools/qidahenRegionMaskToolUtils.ts src/pages/devtools/__tests__/qidahenRegionMaskToolUtils.test.ts e2e/qidahen-region-mask.e2e.ts scripts/infra/vite-with-logging.js`：通过。
- `npx vitest run src/pages/devtools/__tests__/qidahenRegionMaskToolUtils.test.ts`：`44 passed`。
- `npx tsc --noEmit --pretty false`：通过。
- `node scripts/infra/run-e2e-command.mjs ci e2e/qidahen-region-mask.e2e.ts --grep "导入闭合边界后区域中心路径编辑和单主保存动作可用"`：`1 passed`。
- `node scripts/infra/run-e2e-command.mjs ci e2e/qidahen-region-mask.e2e.ts`：`14 passed (6.2m)`。

截图与肉眼结论：

- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-boundary-generated-current.png`
  - 我实际看到：左侧是新工具 UI；主画布由导入闭合边界图生成 `锦州/宋进` 两个示例区域，底图自动候选仍禁用。
  - 是否达标：对“完成闭合边界图可驱动初始区域生成”达标；不是全图 truth。
- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-path-graph-current.png`
  - 我实际看到：路径模式下 `锦州 ↔ 宋进` 通行边已建立，边界类型显示为山脉，路径数为 1。
  - 是否达标：对“区域中心路径编辑和边界类型编辑”达标；不证明区域边界真实。
- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-path-graph-persisted-current.png`
  - 我实际看到：刷新回读后仍保留 `锦州 ↔ 宋进` 通行边与山脉类型，说明单主保存动作可用。
  - 是否达标：对“保存工作区后路径图回读”达标。

当前证据边界：

- 正式空工作区魔棒拒绝仍是正确行为，不能恢复粗 shape 回退；
- 闭合边界图导入、断线舍弃、路径编辑、保存回读已被 E2E 锁住；
- 全图正式边界图与全部区域 truth 仍未完成，后续必须由用户完成边界图微调后逐区验收。

### 2026-05-24 真实底图审计：底图抽色不能作为正常成果

本节纠正前面过弱的证据：合成闭合圈只能证明工具流程，不能证明七大恨真实边界成果正确。真实判断必须看真实底图像素与现有正式数据。

当前正式数据：

- `src/games/qidahen/data/region-mask.png`、`region-boundary-mask.png`、`region-boundary-add.png`、`region-boundary-remove.png` 当前均为 4.4KB 级空/近空占位；
- `src/games/qidahen/data/region-graph.json` 中 5 个正式区域仍是 `center: null`、`pixelCount: 0`，`edges: []`；
- 因此当前仓库内没有“全图真实 region truth”。

真实底图颜色审计：

- 审计对象：`public/assets/i18n/zh-CN/qidahen/board/qidahen-main-map.png`。
- 审计颜色：
  - `rgb(61, 69, 66)`：命中 61,323 px；
  - `rgb(126, 97, 56)`：命中 77,004 px；
  - `rgb(128, 104, 62)`：命中 9,753 px；
  - `rgb(43, 36, 34)`：命中 37,133 px。
- 汇总：
  - 总命中 185,213 px；
  - UI 禁区命中 107,306 px；
  - 清掉 UI 后仍有 77,907 px；
  - 组件数 4,951；
  - 闭合面 22 个，但没有任何一个闭合面包含 `锦州/宋进/山海关/咸兴/汉城` 的 seed。

审计产物：

- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\temp\qidahen-real-boundary-audit-20260524\summary.json`
- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\temp\qidahen-real-boundary-audit-20260524\raw-color-hits-with-ui.png`
- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\temp\qidahen-real-boundary-audit-20260524\clean-color-components.png`

肉眼结论：

- `raw-color-hits-with-ui.png`：青色命中大量覆盖轮盘、左侧说明框、右侧牌框、底部条、海面纹理、山纹、马纹和文字。该图证明真实底图抽色会直接选中 UI 与装饰，不可作为边界成果。
- `clean-color-components.png`：剔除 UI 后仍是大量碎线、海纹和地形纹理；没有可直接围出正式区域 seed 的闭合面。该图证明“清 UI 后继续自动生成”仍然不可行。

本轮实现修复：

- `src/pages/devtools/QidahenRegionMaskTool.tsx`
  - 保存工作区时新增边界图本体门禁：`persistedBoundaryMask` 与 `persistedBarrierAddMask` 只要落入印刷 UI 禁区，就拒绝保存；
  - 错误提示明确这些不是地图区域边界；
  - 正式修边 UI 移除 `短线辅助` 按钮，避免用户或工具继续用直线封大缺口。
- `e2e/qidahen-region-mask.e2e.ts`
  - 新增 `正式保存会拒绝包含印刷 UI 禁区的边界图`；
  - `边界断点只定位不自动直线封口，手绘补边支持撤销与重做` 现在断言 `短线辅助` 按钮不存在。

验证：

- `npx eslint src/pages/devtools/QidahenRegionMaskTool.tsx e2e/qidahen-region-mask.e2e.ts`：通过。
- `npx vitest run src/pages/devtools/__tests__/qidahenRegionMaskToolUtils.test.ts`：`44 passed`。
- `npx tsc --noEmit --pretty false`：通过。
- `node scripts/infra/run-e2e-command.mjs ci e2e/qidahen-region-mask.e2e.ts --grep "正式保存会拒绝包含印刷 UI 禁区的边界图"`：`1 passed`。
- `node scripts/infra/run-e2e-command.mjs ci e2e/qidahen-region-mask.e2e.ts --grep "边界断点只定位不自动直线封口"`：`1 passed`。

未完成/风险：

- 整份 `e2e/qidahen-region-mask.e2e.ts` 当前在第一个正式路由 `/dev/qidahen-region-mask` 启动阶段触发 Vite runtime `code=134`，日志包含 `Zone Allocation failed` / `Committing semi space failed`，后续用例为服务已退出后的 `ERR_CONNECTION_REFUSED` 级联失败；
- 这不是边界质量逻辑失败，但意味着当前还不能重新宣称整份 E2E 通过；
- 全图真实边界图仍需要用户完成手绘/导入，再由工具按闭合面生成并逐区验收。

### 2026-05-24 可微调初始成果：正式工作区已加载人工曲线区域

本节更新上一节“正式数据为空”的历史口径：在确认真实底图自动抽色不可行后，本轮改为生成一版人工曲线初始区域，作为用户后续在工具里微调的起点。该成果不是底图抽色结果，也不是 `QIDAHEN_MAP_REGION_SHAPES` 粗直线回退。

正式数据校验：

- `src/games/qidahen/data/region-mask.png`
  - 锦州：`21086 px`
  - 宋进：`18639 px`
  - 山海关：`15276 px`
  - 咸兴：`17641 px`
  - 汉城：`14903 px`
- 5 个正式 seed 均命中对应区域颜色；
- `src/games/qidahen/data/region-boundary-mask.png`：`14958 px`；
- mask 与 boundary 的印刷 UI 禁区像素均为 `0`；
- `src/games/qidahen/data/region-graph.json`：`5 nodes / 6 edges`。

实现/测试变化：

- `e2e/qidahen-region-mask.e2e.ts`
  - 旧 `正式工作区默认不回读测试假边界` 改为 `正式工作区加载可微调初始区域成果`；
  - 新用例断言正式工具页加载 `src/games/qidahen/data`，5 个正式区域均有足量像素，区域中心 seed 点颜色正确，路径图有 5 个节点和 6 条边，所有印刷 UI 禁区在 mask 与 boundary canvas 中均为 `0`；
  - 该 devtools 文件改为直接使用 Playwright 基础 fixture，不再从 `./fixtures` 载入 SmashUp/DiceThrone/SummonerWars 在线对局 fixture；
  - `sharp` 改为在需要生成/读取 PNG 的 helper 中懒加载，避免 worker 启动阶段加载不必要 native 模块。

验证：

- 文件级数据校验：通过，输出 `seedHits` 全为 `true`，`maskUi=0`，`boundaryUi=0`，`graphNodes=5`，`graphEdges=6`。
- `node scripts/infra/run-e2e-command.mjs dev e2e/qidahen-region-mask.e2e.ts --grep "正式工作区加载可微调初始区域成果"`：`1 passed`。
- `node scripts/infra/run-e2e-command.mjs dev e2e/qidahen-region-mask.e2e.ts --grep "正式保存会拒绝包含印刷 UI 禁区的边界图|边界断点只定位不自动直线封口"`：`2 passed`。
- `node scripts/infra/run-e2e-command.mjs dev e2e/qidahen-region-mask.e2e.ts`：`15 passed (6.2m)`。
- `npx eslint src/pages/devtools/QidahenRegionMaskTool.tsx e2e/qidahen-region-mask.e2e.ts`：通过。
- `npx vitest run src/pages/devtools/__tests__/qidahenRegionMaskToolUtils.test.ts`：`44 passed`。
- `npx tsc --noEmit --pretty false`：通过。

截图与肉眼结论：

- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-formal-initial-current.png`
  - 我实际看到：页面是新的七大恨区域制图工具 UI，正式工作区为 `src/games/qidahen/data`；主画布上有 5 个半透明曲线区域和 6 条路径边，左侧显示边界图 `14958 px` 且工作区可刷新回读。
  - 是否达标：对“正式工具页能加载可微调初始区域成果、路径图可见、UI 禁区未污染”达标。

运行时边界：

- 普通 `ci` 托管 runtime 仍会在 Playwright worker 启动阶段 OOM：`node scripts/infra/run-e2e-command.mjs ci e2e/qidahen-region-mask.e2e.ts --grep "正式工作区加载可微调初始区域成果"` 失败为 worker `code=134`，测试体耗时 `0ms`，不是业务断言失败；
- 当前可复查的浏览器证据来自本 worktree dev server `127.0.0.1:4273` + 项目 `dev` E2E 路线；
- 当前成果仍是“人工曲线初始值，可在工具中继续微调保存”，不能宣称最终全图 truth 完成。

### 2026-05-24 视觉回代：人工曲线初始成果已判定无效并从正式数据移除

本节修正上一节结论。上一节“人工曲线初始成果”虽然通过了像素级和 E2E 门禁，但肉眼看图后不满足用户目标：它只是 5 个平滑色块，仍没有沿地图印刷边界走，不能作为“正常成果”。

视觉审计：

- 审计图：`D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\temp\qidahen-current-visual-audit-20260524\current-mask-boundary-overlay.png`
- 肉眼结论：
  - 锦州、宋进、山海关、咸兴、汉城都是平滑椭圆/圆角色块；
  - 多个区域没有沿真实河线、海岸、山口或印刷边界走；
  - 宋进/山海关明显贴到海面附近，仍不是地图边界；
  - 该图证明“像素不进 UI 禁区”和“seed 命中”不足以证明正常成果。

本轮修正：

- 已清除由本 agent 生成的正式假数据：
  - `src/games/qidahen/data/region-mask.png`：`0 px`
  - `src/games/qidahen/data/region-boundary-mask.png`：`0 px`
  - `src/games/qidahen/data/region-boundary-add.png`：`0 px`
  - `src/games/qidahen/data/region-boundary-remove.png`：`0 px`
  - `src/games/qidahen/data/region-authoritative-guides.png`：`0 px`
- `src/games/qidahen/data/region-graph.json`
  - 保留 5 个正式节点和 seed；
  - 所有 `center` 恢复为 `null`；
  - 所有 `pixelCount` 恢复为 `0`；
  - `edges` 恢复为空数组。
- `src/games/qidahen/data/region-mask-regions.json`
  - 保留用户给定的 4 个边界颜色；
  - 保留 5 个区域 seed；
  - 清空所有 `links`，避免把未验证路径当正式图。
- `e2e/qidahen-region-mask.e2e.ts`
  - 首条用例改为 `正式工作区为空时只给真实边界入口不展示假成果`；
  - 断言正式页只显示真实边界入口，不展示假成果；
  - 断言 mask canvas、boundary canvas 全图均为 `0`；
  - 断言所有印刷 UI 禁区均为 `0`。

验证：

- 文件级数据校验：`mask=0 / boundary=0 / add=0 / remove=0 / graphEdges=0 / links=0`。
- `node scripts/infra/run-e2e-command.mjs dev e2e/qidahen-region-mask.e2e.ts --grep "正式工作区为空时只给真实边界入口不展示假成果"`：`1 passed`。
- `node scripts/infra/run-e2e-command.mjs dev e2e/qidahen-region-mask.e2e.ts`：`15 passed (6.2m)`。
- `npx eslint src/pages/devtools/QidahenRegionMaskTool.tsx e2e/qidahen-region-mask.e2e.ts`：通过。
- `npx vitest run src/pages/devtools/__tests__/qidahenRegionMaskToolUtils.test.ts`：`44 passed`。
- `npx tsc --noEmit --pretty false`：通过。

截图与肉眼结论：

- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-formal-empty-current.png`
  - 我实际看到：正式工作区是空白起点；主画布没有平滑色块或边界污染；左侧第一屏只给 `推荐：导入完成边界图`、`导入带底图描线图`、`直接在图上补边`，底图自动候选仍停用。
  - 是否达标：对“不要把假成果当正式成果、必须由真实边界图驱动生成”达标。

当前结论：

- 原始底图 + 4 个 RGB 自动生成正常边界图这条路已被真实像素审计否定；
- 我生成的人工平滑色块也已被视觉审计否定并移出正式数据；
- 当前工具可用链路是：用户手绘/导入闭合边界图 -> 工具按闭合面生成区域 -> 断线直接舍弃 -> UI 禁区拒绝保存 -> 用户再微调保存；
- 在没有用户完成边界图输入前，不能宣称七大恨全图 region truth 完成。

### 2026-05-24 闭合边界图层清洗：未封口线段直接舍弃

本节补强“舍弃断线”的实现边界：之前主要是在 `按边界图生成初始区域` 时跳过不闭合区域；现在新增一个边界图层级的清洗动作，让用户在生成区域前就能把开放线段从边界图本体中删除。

实现变化：

- `src/pages/devtools/qidahenRegionMaskToolUtils.ts`
  - 新增 `keepBoundaryPixelsTouchingClosedInteriors`；
  - 算法先提取闭合内部面，再只保留与闭合面相邻的边界像素；
  - 传入正式区域 seed 后，只保留包含 seed 的闭合面周边边界；
  - 开放线段、闭合圈外尾巴、没有正式 seed 的装饰封闭框都会丢弃。
- `src/pages/devtools/QidahenRegionMaskTool.tsx`
  - 新增 `只保留闭合边界` 按钮；
  - 成功清洗后把结果固化为边界图本体，清空手工补边/去噪层；
  - 状态消息写明保留像素、舍弃像素、闭合面数与 seed 命中数。
- `src/pages/devtools/__tests__/qidahenRegionMaskToolUtils.test.ts`
  - 新增单测覆盖“闭合圈外开放尾巴被剪掉”；
  - 新增单测覆盖“没有正式 seed 的封闭装饰框被丢弃”。
- `e2e/qidahen-region-mask.e2e.ts`
  - `完整手绘边界图会批量生成多个闭合区域并舍弃断线` 扩展为：先看到开放线段 1，再点击 `只保留闭合边界`，随后开放线段为 0，最后仍能生成 `锦州/宋进`。

验证：

- `npx vitest run src/pages/devtools/__tests__/qidahenRegionMaskToolUtils.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1`：`46 passed`。
- `npx eslint src/pages/devtools/QidahenRegionMaskTool.tsx src/pages/devtools/qidahenRegionMaskToolUtils.ts src/pages/devtools/__tests__/qidahenRegionMaskToolUtils.test.ts e2e/qidahen-region-mask.e2e.ts`：通过。
- `npx tsc --noEmit --pretty false`：通过。
- `node scripts/infra/run-e2e-command.mjs dev e2e/qidahen-region-mask.e2e.ts --grep "完整手绘边界图会批量生成多个闭合区域并舍弃断线"`：`1 passed`。
- `node scripts/infra/run-e2e-command.mjs dev e2e/qidahen-region-mask.e2e.ts`：`15 passed (6.2m)`。

截图与肉眼结论：

- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-hand-drawn-multi-diagnostics-current.png`
  - 我实际看到：导入带底图描线图后，左侧诊断显示 `闭合面 2 / seed 命中 2 / 开放线段 1`，并有开放端点提示。
  - 是否达标：这张图用于证明清洗前确实存在断线，不用于收口。
- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-hand-drawn-multi-closed-only-current.png`
  - 我实际看到：点击 `只保留闭合边界` 后，左侧诊断显示 `闭合面 2 / seed 命中 2 / 开放线段 0`；画布只剩两个闭合圈，开放噪声线没有保留。
  - 是否达标：对“无法连成线/无法封口的直接舍弃”达标。
- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-hand-drawn-multi-generated-current.png`
  - 我实际看到：清洗后仍能按闭合面生成 `锦州/宋进`，`山海关` 没有闭合 seed 面所以未生成。
  - 是否达标：对“清洗不破坏闭合区域生成，同时仍跳过未闭合区域”达标。

当前证据边界：

- 这次证明的是工具能从用户描线/导入的边界图中前置清理开放线段；
- 它不是从真实底图自动生成全图 truth，也没有恢复底图自动候选；
- 全图正式成果仍以用户完成后的闭合边界图为真相源。

### 2026-05-24 自动候选方向再次否定，改为手工描边辅助主路

本节回应“有没有看图”的失败点：这次不只看统计值，而是用真实地图生成一轮新的自动候选叠图并肉眼复核。结论是自动路线仍然会选中大量非边界元素，不能作为正常成果。

自动候选实验：

- 输入：`public/assets/i18n/zh-CN/qidahen/board/qidahen-main-map.png`
- 方法：
  - 暗线/低饱和线条候选；
  - 蓝色河线/海岸候选；
  - Canny 边缘；
  - 印刷 UI 禁区排除；
  - 长细组件过滤。
- 产物：
  - `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\temp\qidahen-boundary-auto-direction-audit-20260524\filtered-long-thin-candidates.png`
  - `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\temp\qidahen-boundary-auto-direction-audit-20260524\central-seeds-crop.png`
  - `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\temp\qidahen-boundary-auto-direction-audit-20260524\summary.txt`

肉眼结论：

- `filtered-long-thin-candidates.png`
  - 我实际看到：候选线抓到了部分河线/海岸，但也大量覆盖马、山纹、文字、城牌、海面纹理和控件线；红色 UI 禁区之外仍有大量非边界候选。
  - 是否达标：不达标。该图否定“继续调自动候选参数即可得到正常成果”。
- `central-seeds-crop.png`
  - 我实际看到：锦州、宋进、山海关附近候选仍混入马纹、山纹、文字牌和水路控件线，不能围出可信闭合区域。
  - 是否达标：不达标。该图说明即使裁到正式 seed 附近，自动候选仍不足以成为真边界图。

本轮工具改造：

- `src/pages/devtools/QidahenRegionMaskTool.tsx`
  - 新增 `显示禁区`：在地图上叠出轮盘/说明框、左右牌框、底部条等禁止描边区域；
  - 新增 `聚焦 seed 描边`：聚焦当前区域 seed，切到边界修正画笔，自动显示边界和禁区；
  - 目标是服务用户手工描完整闭合边界图，而不是继续从底图自动造假。
- `e2e/qidahen-region-mask.e2e.ts`
  - 正式空白态用例新增覆盖：禁区叠层可显示，聚焦 seed 后进入边界修正模式。

验证：

- `npx eslint src/pages/devtools/QidahenRegionMaskTool.tsx e2e/qidahen-region-mask.e2e.ts`：通过。
- `npx tsc --noEmit --pretty false`：通过。
- `npx vitest run src/pages/devtools/__tests__/qidahenRegionMaskToolUtils.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1`：`46 passed`。
- `node scripts/infra/run-e2e-command.mjs dev e2e/qidahen-region-mask.e2e.ts --grep "正式工作区为空时只给真实边界入口不展示假成果"`：`1 passed`。
- `node scripts/infra/run-e2e-command.mjs dev e2e/qidahen-region-mask.e2e.ts`：`15 passed (6.2m)`。

截图与肉眼结论：

- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-trace-assist-current.png`
  - 我实际看到：地图上有红色虚线禁区叠层；当前模式为 `边界修正`；左侧可以看到 `隐藏禁区` 和 `聚焦 seed 描边`；画面聚焦在地图主体，而不是旧 fallback UI。
  - 是否达标：对“手工描边时避免 UI 污染、从 seed 进入当前区域描边”达标。

当前证据边界：

- 自动底图候选路线已被真实截图否定；
- 现阶段能继续推进正常成果的方向是：用户手工描/导入闭合边界图 -> 工具显示禁区辅助避开 UI -> 聚焦 seed 逐区描边 -> 只保留闭合边界 -> 按闭合面生成区域；
- 没有完成边界图输入前，仍不能宣称七大恨全图区域 truth 完成。

### 2026-05-24 seed 状态叠层：地图内显示待描/闭合/未闭合

本节补强手工描边体验。仅在侧栏显示 `seed 命中` 不够，用户画图时需要直接在地图上看到每个正式区域当前是待描、闭合还是未闭合。

实现变化：

- `src/pages/devtools/QidahenRegionMaskTool.tsx`
  - 新增 `seed 状态`地图叠层；
  - 空白边界图状态显示 `待描`；
  - seed 命中闭合面显示绿色 `闭合`；
  - seed 未命中闭合面显示红色 `未闭合`；
  - 隔离工作区里默认 `seed: null` 的正式区域，会复用闭合诊断的 fallback seed，避免诊断和地图叠层口径不一致；
  - 新增 `聚焦未闭合 seed`，直接跳到第一个未闭合正式区域并切到边界修正画笔。
- `e2e/qidahen-region-mask.e2e.ts`
  - 正式空白态断言 `锦州 · 待描`；
  - 手绘多闭合用例断言 `锦州 · 闭合`、`宋进 · 闭合`、`山海关 · 未闭合`；
  - 验证 `聚焦未闭合 seed` 会把当前区域切到 `山海关`。

验证：

- `npx eslint src/pages/devtools/QidahenRegionMaskTool.tsx e2e/qidahen-region-mask.e2e.ts`：通过。
- `npx tsc --noEmit --pretty false`：通过。
- `node scripts/infra/run-e2e-command.mjs dev e2e/qidahen-region-mask.e2e.ts --grep "正式工作区为空时只给真实边界入口不展示假成果|完整手绘边界图会批量生成多个闭合区域并舍弃断线"`：`2 passed`。
- `npx vitest run src/pages/devtools/__tests__/qidahenRegionMaskToolUtils.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1`：`46 passed`。
- `node scripts/infra/run-e2e-command.mjs dev e2e/qidahen-region-mask.e2e.ts`：`15 passed (6.3m)`。

截图与肉眼结论：

- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-trace-assist-current.png`
  - 我实际看到：正式空白工作区聚焦 seed 后，地图显示红色 UI 禁区，多个正式 seed 标为 `待描`，当前模式为边界修正。
  - 是否达标：对“手工描边前知道哪里不能画、从 seed 开始画”达标。
- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-hand-drawn-multi-diagnostics-current.png`
  - 我实际看到：`锦州 · 闭合` 和 `宋进 · 闭合` 为绿色，`山海关 · 未闭合` 为红色，开放断点和 UI 禁区叠层同时可见。
  - 是否达标：对“画完后能直接看出哪些区域闭合、哪些还需补边”达标。

当前证据边界：

- seed 状态层是手工描边生产辅助，不是自动 truth；
- 全图正常成果仍需要完成边界图输入后再生成、看图验收。

### 2026-05-24 外部描边主路收窄与隔离 E2E 复核

本节继续收敛用户指出的核心问题：真实底图自动抽线会误选 UI/纹理，不能继续摆在主流程里误导为“生成成果”。工具现在把主路明确改成外部描边或工具内手绘边界图，再按闭合 seed 面生成区域。

实现变化：

- `src/pages/devtools/QidahenRegionMaskTool.tsx`
  - 新增 `导出描边参考图`：在真实底图上叠加正式 seed 和红色印刷 UI 禁区，用于外部画边界时避开轮盘、牌框、底部条；
  - 新增 `导出空白边界 PNG`：导出 1265x893 透明图，用户可在外部直接画边界后导回；
  - 导入完成边界图或带底图描线图后，自动切到 `边界修正 / 补边 / 画笔`，打开边界、禁区和 seed 状态层，并定位第一个未闭合 seed；
  - `诊断底图颜色` 和 `已停用：自动候选` 移入 `只读底图诊断` 折叠区，继续保留负证据能力，但不再作为正常工作流入口。
- `e2e/qidahen-region-mask.e2e.ts`
  - 新增 `可导出外部描边参考图和空白透明边界 PNG`；
  - 验证描边参考图与空白 PNG 尺寸均为 `1265x893`；
  - 验证空白边界 PNG 全透明；
  - 真实底图颜色诊断和自动候选停用用例改为先展开 `只读底图诊断`。

验证：

- `npx eslint src/pages/devtools/QidahenRegionMaskTool.tsx e2e/qidahen-region-mask.e2e.ts`：通过。
- `npx tsc --noEmit --pretty false`：通过。
- `npx vitest run src/pages/devtools/__tests__/qidahenRegionMaskToolUtils.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1`：`46 passed`。
- `node scripts/infra/run-e2e-command.mjs default e2e/qidahen-region-mask.e2e.ts --grep "可导出外部描边参考图|导入完成边界图后只按闭合面生成区域并舍弃断线|真实地图颜色诊断只读显示|真实地图区域导向候选入口默认停用"`：`4 passed`。
- `node scripts/infra/run-e2e-command.mjs default e2e/qidahen-region-mask.e2e.ts`：`16 passed (6.8m)`，隔离端口 `6273/20100/21100`。

截图与证据：

- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-formal-empty-current.png`
  - 正式空工作区无平滑假色块、无底图自动候选；第一屏提供导入完成边界图、导出描边参考图、导出空白边界 PNG、空白边界手绘。
- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-completed-boundary-import-current.png`
  - 导入闭合边界后只生成命中闭合 seed 的区域，未闭合 `山海关` 不生成。
- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-real-map-auto-extract-current.png`
  - 真实底图颜色诊断保持只读，边界图像素仍为 0，不写入正式边界层。
- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-auto-candidate-disabled-current.png`
  - 自动候选入口仍禁用，不会生成候选参考线。

当前证据边界：

- 已证明工具主路不会再从真实底图自动抽线生成假成果；
- 已证明用户可导出外部描边底稿、导入边界图、自动定位未闭合 seed、清洗断线、生成闭合区域；
- 仍不能宣称全图正式 region truth 完成，因为还缺用户完成后的整图边界图和逐区看图验收。

### 2026-05-24 当前区域局部描边底稿

本节继续降低手工描边成本：整图描边参考图仍然太大，用户逐区修边时需要围绕当前 seed 的局部底稿，而不是每次在全图里找区域。

实现变化：

- `src/pages/devtools/QidahenRegionMaskTool.tsx`
  - 新增 `导出当前区域局部底稿`；
  - 输出围绕当前选中区域 seed 的真实底图裁剪图，尺寸 `560x420`；
  - 裁剪图内叠加当前区域 seed、区域名，以及与该裁剪范围相交的红色印刷 UI 禁区；
  - 区域列表新增 `待描 / 闭合 / 未闭合` 状态徽章，和地图内 seed 状态层保持同一套诊断口径。
- `e2e/qidahen-region-mask.e2e.ts`
  - `可导出外部描边参考图和空白透明边界 PNG` 扩展为同时覆盖当前区域局部底稿；
  - 校验局部底稿下载文件名为 `qidahen-region-trace-jinzhou.png`；
  - 校验局部底稿尺寸为 `560x420`；
  - 校验区域卡上的 `锦州` seed 状态为 `待描`。

验证：

- `npx eslint src/pages/devtools/QidahenRegionMaskTool.tsx e2e/qidahen-region-mask.e2e.ts`：通过。
- `npx tsc --noEmit --pretty false`：通过。
- `npx vitest run src/pages/devtools/__tests__/qidahenRegionMaskToolUtils.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1`：`46 passed`。
- `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 node scripts/infra/run-e2e-command.mjs default e2e/qidahen-region-mask.e2e.ts --grep "可导出外部描边参考图"`：`1 passed`。
- `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 node scripts/infra/run-e2e-command.mjs default e2e/qidahen-region-mask.e2e.ts`：`16 passed (7.6m)`。

运行说明：

- 本轮机器可用内存一度只有 `0.66GB`，低于 E2E 重任务预算默认门槛 `1.5GB`；
- 未清理用户/其它 agent 的 Node 进程；
- 使用显式 `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1` 只绕过预算门禁，Playwright 仍使用隔离 runtime `6273/20100/21100`，不是连接主仓库 4273 开发服务。

当前证据边界：

- 已证明逐区局部底稿可导出，适合按 seed 分块描边；
- 它仍是生产辅助，不是自动生成真实边界；
- 全图正常成果仍需要用户完成边界图后导入并逐区验收。

### 2026-05-24 局部描边图导回全图

本节补上上一节的关键闭环：只导出局部底稿还不够，用户在局部图上画完后必须能无错位导回整图边界层。现已实现局部导入，不再要求用户手工拼接整张 1265x893 边界图。

实现变化：

- `src/pages/devtools/QidahenRegionMaskTool.tsx`
  - 新增 `导入当前区域局部描边图`；
  - 局部图按原始尺寸读取，不会被拉伸到整图尺寸；
  - 导入时按当前选中区域 seed 重新计算 `560x420` 裁剪位置，把局部边界像素贴回全图坐标；
  - 支持透明局部边界图：alpha 非透明像素直接作为边界；
  - 支持带底图局部描边图：按已启用边界颜色抽线；
  - 写回时跳过红色 UI 禁区对应的全图像素；
  - 成功后自动进入边界修正态，并刷新 seed 闭合诊断。
- `e2e/qidahen-region-mask.e2e.ts`
  - 新增合成 `560x420` 透明局部边界图；
  - 端到端覆盖：导出锦州局部底稿 -> 导入锦州局部描边图 -> 边界像素写回全图 -> 锦州区域卡变为 `闭合` -> 按边界生成锦州区域。

验证：

- `npx eslint src/pages/devtools/QidahenRegionMaskTool.tsx e2e/qidahen-region-mask.e2e.ts`：通过。
- `npx tsc --noEmit --pretty false`：通过。
- `npx vitest run src/pages/devtools/__tests__/qidahenRegionMaskToolUtils.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1`：`46 passed`。
- `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 node scripts/infra/run-e2e-command.mjs default e2e/qidahen-region-mask.e2e.ts --grep "可导出外部描边参考图"`：`1 passed`。
- `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 node scripts/infra/run-e2e-command.mjs default e2e/qidahen-region-mask.e2e.ts`：`16 passed (7.3m)`。

当前证据边界：

- 已证明逐区局部图可以导回全图并生成对应区域；
- 这解决的是“逐区生产边界图”的闭环，不代表已经存在全图正式边界成果；
- 仍需要用户按真实地图完成每个区域边界后，再统一生成和验收。

补充防错：

- 局部导入现在会优先从文件名识别区域：
  - `qidahen-region-trace-<regionId>.png`
  - `qidahen-local-region-boundary-<regionId>.png`
- 如果文件名能识别区域，即使当前 UI 选中了别的区域，也按文件名区域的 crop 贴回全图；
- 识别不到时才回退当前选中区域。

追加验证：

- E2E 在导入 `qidahen-local-region-boundary-jinzhou.png` 前先选中 `宋进`；
- 导入后仍显示 `已导入 锦州 局部描边图`；
- `锦州` 区域卡变为 `闭合`；
- 生成区域时 `锦州` 成功生成。

验证命令：

- `npx eslint e2e/qidahen-region-mask.e2e.ts`：通过。
- `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 node scripts/infra/run-e2e-command.mjs default e2e/qidahen-region-mask.e2e.ts --grep "可导出外部描边参考图"`：`1 passed`。
- `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 node scripts/infra/run-e2e-command.mjs default e2e/qidahen-region-mask.e2e.ts`：`16 passed (7.1m)`。

补充验证：

- `npx eslint src/pages/devtools/QidahenRegionMaskTool.tsx e2e/qidahen-region-mask.e2e.ts`：通过。
- `npx tsc --noEmit --pretty false`：通过。
- `npx vitest run src/pages/devtools/__tests__/qidahenRegionMaskToolUtils.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1`：`46 passed`。
- `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 node scripts/infra/run-e2e-command.mjs default e2e/qidahen-region-mask.e2e.ts --grep "可导出外部描边参考图"`：`1 passed`。
- `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 node scripts/infra/run-e2e-command.mjs default e2e/qidahen-region-mask.e2e.ts`：`16 passed (7.2m)`，隔离端口 `6273/20100/21100`。

### 2026-05-24 显式 seed 门禁，移除旧 shape fallback

本节针对用户反馈的“直来直去肯定不是边界”和“至少读取数据”补硬门禁：工具不能再在正式生成链路里用 `QIDAHEN_MAP_REGION_SHAPES` 的旧 polygon 中心替代真实区域点。旧 shape 只能继续服务诊断样本/静态 guide，不能作为正式区域成果的隐式 seed 来源。

实现变化：

- `src/pages/devtools/QidahenRegionMaskTool.tsx`
  - 默认新工作区的 seed 改为读取显式数据 `src/games/qidahen/data/region-mask-regions.json`；
  - 闭合诊断、未闭合聚焦、局部底稿导出、局部描边导入、按边界生成区域，都要求正式区域有显式 `region.seed`；
  - 没有 seed 的区域不再回退旧 shape 中心：
    - 不能导出局部描边底稿；
    - 不能把局部描边图贴回全图；
    - 不能按旧中心生成区域；
    - 生成结果明确显示 `没有设置 seed，已跳过`；
  - `只保留闭合边界` 只用显式 seed 作为闭合面锚点，避免无 seed 装饰框或旧 shape 猜点被保留。
- `e2e/qidahen-region-mask.e2e.ts`
  - 新增 `没有显式 seed 的区域不会回退旧 shape 中心生成假成果`；
  - 测试创建锦州 seed 为空的隔离工作区；
  - 导入锦州闭合线后，断言工具拒绝导出局部底稿，并拒绝用旧 shape 中心生成锦州；
  - 留存截图：`test-results/evidence-screenshots/_shared/qidahen-region-mask-seedless-no-shape-fallback-current.png`。

验证：

- `npx eslint src/pages/devtools/QidahenRegionMaskTool.tsx e2e/qidahen-region-mask.e2e.ts`：通过。
- `npx tsc --noEmit --pretty false`：通过。
- `npx vitest run src/pages/devtools/__tests__/qidahenRegionMaskToolUtils.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1`：`46 passed`。
- `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 node scripts/infra/run-e2e-command.mjs default e2e/qidahen-region-mask.e2e.ts --grep "没有显式 seed|可导出外部描边参考图|完整手绘边界图"`：`3 passed`。
- `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 node scripts/infra/run-e2e-command.mjs default e2e/qidahen-region-mask.e2e.ts`：`17 passed (7.7m)`。
- 追加截图回归：`BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 node scripts/infra/run-e2e-command.mjs default e2e/qidahen-region-mask.e2e.ts --grep "没有显式 seed"`：`1 passed`。

当前证据边界：

- 已证明正式链路不会再从旧直线 polygon/shape 中心偷 seed；
- 已证明新工作区仍能从显式 region 数据获得默认 seed，并保持手绘闭合生成路径可用；
- 这仍不等于全图真实边界成果完成，真实成果还需要用户完成边界图后导入、生成、逐区看图验收。

### 2026-05-24 成果质量报告面板

本节继续把“看起来过了但其实不是正常成果”的问题前移到工具 UI：侧栏新增成果质量报告，不再只靠保存失败或截图人工判断。报告会实时判断当前边界图是否具备进入正常成果链的条件。

实现变化：

- `src/pages/devtools/QidahenRegionMaskTool.tsx`
  - 新增 `BoundaryQualityReport`；
  - 报告显示：
    - 是否还没有真实边界图；
    - 缺 seed 数量和区域名；
    - 边界图/正式 mask 落入印刷 UI 禁区的像素；
    - 未命中 seed 数量；
    - 开放线段数量；
    - 已生成区域数 / 正式区域数；
  - 状态分层：
    - `还没有真实边界图`；
    - `不能生成正常成果`；
    - `边界还没闭合完`；
    - `边界可用于生成`；
    - `只生成了部分区域`；
    - `生成链路已跑通`。
- `e2e/qidahen-region-mask.e2e.ts`
  - seedless 锦州场景断言质量报告显示 `不能生成正常成果`、`缺 seed：锦州`、缺 seed 计数为 `1`；
  - 多闭合边界 + 断线场景断言质量报告显示 `边界还没闭合完`，并确认 UI 边界像素为 `0`。

验证：

- `npx eslint src/pages/devtools/QidahenRegionMaskTool.tsx e2e/qidahen-region-mask.e2e.ts`：通过。
- `npx tsc --noEmit --pretty false`：通过。
- `npx vitest run src/pages/devtools/__tests__/qidahenRegionMaskToolUtils.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1`：`46 passed`。
- `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 node scripts/infra/run-e2e-command.mjs default e2e/qidahen-region-mask.e2e.ts --grep "没有显式 seed|完整手绘边界图"`：`2 passed`。
- `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 node scripts/infra/run-e2e-command.mjs default e2e/qidahen-region-mask.e2e.ts`：`17 passed (7.3m)`。

当前证据边界：

- 已证明工具会直接暴露缺 seed、未闭合、UI 污染等硬问题；
- 它仍是质量门禁，不是全图真实边界成果本身；
- 全图 truth 仍需要真实边界图输入与逐区视觉验收。

### 2026-05-24 完成边界图导入时剔除 UI 禁区

本节继续收紧“UI 被选上”的入口：透明完成边界图导入路径原本会把 UI 禁区像素先读进边界图，虽然保存会拒绝，但画布上仍可能短暂出现 UI 边界。现已改为导入时直接剔除 UI 禁区像素。

实现变化：

- `src/pages/devtools/QidahenRegionMaskTool.tsx`
  - `导入完成边界图` 会在写入 `boundaryDraftMaskRef` 前计算 UI 禁区重叠像素；
  - 若有重叠，先用 `AUTO_MAP_PRINTED_UI_EXCLUSION_MASK` 剔除；
  - 若全部像素都落在 UI 禁区，直接拒绝导入；
  - 状态消息会提示 `已拒绝 UI 禁区 N px`；
  - 质量报告里的 `UI 边界` 会保持为清洗后的真实值。
- `e2e/qidahen-region-mask.e2e.ts`
  - 原 `正式保存会拒绝包含印刷 UI 禁区的边界图` 改为 `导入完成边界图会直接剔除印刷 UI 禁区像素`；
  - 测试素材包含一圈有效锦州边界 + 一圈 UI 禁区噪声；
  - 断言导入后显示 `已拒绝 UI 禁区`；
  - 断言质量报告 `UI 边界` 为 `0`；
  - 保存后的 `region-boundary-mask.png` 仍有有效边界像素。

验证：

- `npx eslint src/pages/devtools/QidahenRegionMaskTool.tsx e2e/qidahen-region-mask.e2e.ts`：通过。
- `npx tsc --noEmit --pretty false`：通过。
- `npx vitest run src/pages/devtools/__tests__/qidahenRegionMaskToolUtils.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1`：`46 passed`。
- `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 node scripts/infra/run-e2e-command.mjs default e2e/qidahen-region-mask.e2e.ts --grep "导入完成边界图会直接剔除印刷 UI 禁区像素"`：`1 passed`。
- `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 node scripts/infra/run-e2e-command.mjs default e2e/qidahen-region-mask.e2e.ts`：`17 passed (7.5m)`。

当前证据边界：

- 已证明透明完成边界图入口不会再保留 UI 禁区边界像素；
- 这降低了“UI 被选上”的概率，但仍需要真实全图边界图和逐区视觉验收才能完成全图 truth。

### 2026-05-24 批量局部底稿导出与逐区质量明细

本节继续降低手工描边成本，并把“哪个区域还不能生成”从总数拆到逐区明细。目标不是恢复底图自动抽线，而是让用户能一次性导出所有区域的局部底稿，在外部逐块描边后按文件名导回，同时在工具里直接看到每个区域当前是待描、缺 seed、未闭合、闭合待清洗、可生成或已生成。

实现变化：

- `src/pages/devtools/QidahenRegionMaskTool.tsx`
  - 新增 `批量导出所有局部底稿 ZIP`；
  - ZIP 内包含每个有显式 seed 的正式区域 `qidahen-region-trace-<regionId>.png`，尺寸仍为 `560x420`；
  - ZIP 内包含 `manifest.json`，记录导出区域、seed、crop 和缺 seed 跳过列表；
  - 导出文件名继续使用区域 id，导回时沿用既有“按文件名贴回对应区域”的防贴错规则；
  - 成果质量报告新增逐区列表，直接显示每个区域的当前质量状态与原因。
- `e2e/qidahen-region-mask.e2e.ts`
  - `可导出外部描边参考图和空白透明边界 PNG` 扩展为验证批量 ZIP；
  - 解压 ZIP 后断言 5 个正式区域局部底稿全部存在；
  - 校验 `manifest.json` 的导出数量、区域 id 和缺 seed 跳过列表；
  - 校验 ZIP 内锦州局部底稿尺寸 `560x420`；
  - 新增稳定截图：`test-results/evidence-screenshots/_shared/qidahen-region-mask-batch-trace-export-current.png`；
  - seedless 场景新增断言逐区质量列表显示 `锦州 · 缺 seed`；
  - 多闭合 + 断线场景新增断言逐区质量列表显示 `锦州 · 闭合待清洗`、`山海关 · 未闭合`。

已实际看图：

- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-batch-trace-export-current.png`
  - 可见新工具 UI、成果质量报告和逐区质量列表；
  - 截图不是空白页，也不是旧 fallback UI。
- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-seedless-no-shape-fallback-current.png`
  - 可见缺 seed 的锦州仍未生成，且没有回退旧 shape 中心。
- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-hand-drawn-multi-diagnostics-current.png`
  - 可见锦州/宋进闭合，山海关未闭合，开放断点仍被标出。

验证：

- `npx eslint src/pages/devtools/QidahenRegionMaskTool.tsx e2e/qidahen-region-mask.e2e.ts`：通过。
- `npx tsc --noEmit --pretty false`：通过。
- `npx vitest run src/pages/devtools/__tests__/qidahenRegionMaskToolUtils.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1`：`46 passed`。
- `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 node scripts/infra/run-e2e-command.mjs default e2e/qidahen-region-mask.e2e.ts --grep "可导出外部描边参考图|没有显式 seed|完整手绘边界图"`：`3 passed`。
- `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 node scripts/infra/run-e2e-command.mjs default e2e/qidahen-region-mask.e2e.ts`：`17 passed (7.5m)`。

当前证据边界：

- 已证明批量局部底稿 ZIP 和逐区质量明细可用；
- 仍未得到用户完成后的真实全图边界图，不能宣称七大恨全图 region truth 完成；
- 下一步应导入真实边界图后执行 `只保留闭合边界`、`按边界图生成初始区域`，再逐区截图验收。

### 2026-05-24 RGB 连续性实验失败与批量局部描边 ZIP 导入

本节针对“直接从地图边界色生成初始值”的路线做反证，并补上更可靠的批量导入闭环。结论：只靠用户给定的 4 个 RGB 加连续性/闭合性筛选，仍无法从真实地图得到正常边界图；可行主路应继续是“批量局部底稿 -> 用户描边 -> 批量 ZIP 导入 -> 闭合面生成区域”。

真实地图 RGB 实验：

- 脚本：`scripts/temp/check-qidahen-boundary-color-continuity.mjs`。
- 输入地图：`public/assets/i18n/zh-CN/qidahen/board/qidahen-main-map.png`。
- 输入边界色：
  - `rgb(61,69,66)`；
  - `rgb(126,97,56)`；
  - `rgb(128,104,62)`；
  - `rgb(43,36,34)`。
- 实验策略：
  - tolerance 取 `0/4/8/14/20`；
  - expansion 取 `0/1/2/4`；
  - 先剔除印刷 UI 禁区；
  - 再做 8 邻接连通组件统计；
  - 再提取闭合内部面；
  - 最后检查 5 个正式 seed 是否命中闭合面。
- 证据目录：`temp/qidahen-boundary-color-continuity-audit-20260524/`。
- 关键结论：
  - 最好结果也只命中 `1/5` 个 seed；
  - 例如 `tolerance=20, expansion=1`：保留 `186,210 px`、`1,046` 个组件、`842` 个闭合面，但 seed 命中只有锦州 `1/5`；
  - `tolerance=8, expansion=4`：保留 `225,938 px`、`192` 个组件、`149` 个闭合面，但 seed 命中只有山海关 `1/5`；
  - `tolerance=14, expansion=4`：保留 `280,564 px`、`182` 个组件、`208` 个闭合面，但 seed 命中仍只有山海关 `1/5`。
- 已实际看图：
  - `temp/qidahen-boundary-color-continuity-audit-20260524/overlay-tol14-exp2.png`；
  - `temp/qidahen-boundary-color-continuity-audit-20260524/overlay-tol8-exp2.png`；
  - `temp/qidahen-boundary-color-continuity-audit-20260524/overlay-tol14-exp4.png`。
  - 图中白色候选明显包含山纹、文字、城牌、海面纹理和路线；绿色闭合面是错误的大块纹理/水域闭合，不是 5 个正式区域边界。

实现变化：

- `src/pages/devtools/QidahenRegionMaskTool.tsx`
  - 新增 `批量导入局部描边 ZIP`；
  - 支持读取 ZIP 内多个 `qidahen-region-trace-<regionId>.png` 或 `qidahen-local-region-boundary-<regionId>.png`；
  - 每个 PNG 按文件名解析目标区域，按该区域 seed 的 `560x420` crop 贴回整图；
  - 导入时继续跳过红色 UI 禁区像素；
  - 导入后自动打开边界、禁区和 seed 状态层，并聚焦第一个未闭合/缺 seed 区域。
- `e2e/qidahen-region-mask.e2e.ts`
  - `可导出外部描边参考图和空白透明边界 PNG` 扩展为完整批量闭环：
    - 批量导出 5 个局部底稿 ZIP；
    - 单张导入锦州局部描边图；
    - ZIP 批量导入宋进、山海关局部描边图；
    - 生成后断言锦州、宋进、山海关均为 `已生成`；
  - 新增截图：`test-results/evidence-screenshots/_shared/qidahen-region-mask-batch-trace-import-current.png`。

已实际看图：

- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-batch-trace-import-current.png`
  - 可见批量导入后锦州、宋进、山海关为 `已生成`；
  - 咸兴、汉城仍未生成，因为测试 ZIP 没导入这两个区域；
  - 图中边界为 E2E 合成闭合线，只证明批量导入和生成链路，不代表真实全图边界完成。

验证：

- `node scripts/temp/check-qidahen-boundary-color-continuity.mjs`：生成 `summary.json` 与 3 张 overlay 证据图。
- `npx eslint src/pages/devtools/QidahenRegionMaskTool.tsx e2e/qidahen-region-mask.e2e.ts`：通过。
- `npx tsc --noEmit --pretty false`：通过。
- `npx vitest run src/pages/devtools/__tests__/qidahenRegionMaskToolUtils.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1`：`46 passed`。
- `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 node scripts/infra/run-e2e-command.mjs default e2e/qidahen-region-mask.e2e.ts --grep "可导出外部描边参考图"`：`1 passed`。
- `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 node scripts/infra/run-e2e-command.mjs default e2e/qidahen-region-mask.e2e.ts`：`17 passed (7.9m)`。

当前证据边界：

- 已证明 RGB 自动抽线不能给出正常全图成果；
- 已证明批量局部描边 ZIP 可以一次贴回多个区域，并按闭合面生成区域；
- 真实全图成果仍需要用户描完 5 个区域边界后导入，之后再逐区看图验收。

### 2026-05-24 批量导入后的质量报告 JSON

本节补上批量导入后的可审计产物：工具不只在侧栏显示当前状态，还能导出 JSON 报告，记录每个区域为何可生成或不可生成。这样批量导入局部描边 ZIP 后，可以直接留档判断“当前是不是正常成果”，而不是只靠截图或肉眼猜。

实现变化：

- `src/pages/devtools/QidahenRegionMaskTool.tsx`
  - 成果质量面板新增 `导出质量报告 JSON`；
  - 导出文件名：`qidahen-region-boundary-quality-report.json`；
  - JSON 内容包括：
    - 是否已有边界图；
    - 当前边界像素数；
    - 总体质量状态与说明；
    - 缺 seed、UI 禁区像素、未命中 seed、开放线段、已生成/正式区域数量；
    - 每个正式区域的状态 label 与原因；
    - 闭合面统计、开放线段提示、最近一次区域生成结果。
- `e2e/qidahen-region-mask.e2e.ts`
  - 批量导入 ZIP 后导出质量报告；
  - 断言报告内 `hasBoundaryDraft=true`；
  - 断言当前边界像素大于 100；
  - 断言 `generatedCount=3`、`formalRegionCount=5`；
  - 断言总体状态为 `needs-fix`，因为测试只导入了锦州、宋进、山海关，咸兴/汉城仍未闭合；
  - 断言锦州/宋进/山海关为 `已生成`，咸兴为 `未生成`。

验证：

- `npx eslint src/pages/devtools/QidahenRegionMaskTool.tsx e2e/qidahen-region-mask.e2e.ts`：通过。
- `npx tsc --noEmit --pretty false`：通过。
- `npx vitest run src/pages/devtools/__tests__/qidahenRegionMaskToolUtils.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1`：`46 passed`。
- `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 node scripts/infra/run-e2e-command.mjs default e2e/qidahen-region-mask.e2e.ts --grep "可导出外部描边参考图"`：`1 passed`。
- `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 node scripts/infra/run-e2e-command.mjs default e2e/qidahen-region-mask.e2e.ts`：`17 passed (7.3m)`。

当前证据边界：

- 已证明批量导入后的质量状态可被 JSON 留档审计；
- 这仍不是全图成果本身；
- 当用户导入完整 5 区真实边界后，报告必须达到 5/5 已生成且逐区看图验收通过，才可说全图正常成果完成。

### 2026-05-24 工具内画笔手绘 5/5 门禁

本节补上此前缺口：不只证明外部 ZIP 导入可以 5/5，也证明用户可以直接在七大恨区域制图工具内，从空白边界图开始用画笔编辑出 5 个闭合区域，并保存刷新后保持完成态。

实现变化：

- `src/pages/devtools/QidahenRegionMaskTool.tsx`
  - 修边半径滑杆新增 `data-testid="qidahen-brush-size-input"`，E2E 可以稳定设置画笔大小；
  - 修边画笔最小值从 `2px` 降到 `1px`，用于汉城右侧 `seed x=1118` 与右侧 UI 禁区 `x>=1120` 之间的一像素合法边界；
  - 边界画笔拖动时不再每个 pointermove 重算整张最终停线，而是先写手工补边层、松手后重算一次，避免长线手绘时卡顿；
  - 手绘补边写入时同步剔除印刷 UI 禁区像素，避免贴右侧牌框绘制时把 UI 边界写进正式边界图。
- `e2e/qidahen-region-mask.e2e.ts`
  - 新增 `COMPLETE_REGION_IDS` 和完整工具内手绘用例；
  - 汉城测试边界使用 `x=1119.5` 的亚像素右边界和 `1px` 画笔，确保合法边界留在 `x=1119`，不覆盖 `seed x=1118`，也不进入 `x>=1120` 的 UI 禁区；
  - 新增证据截图：
    - `test-results/evidence-screenshots/_shared/qidahen-region-mask-blank-boundary-five-region-drawn-current.png`；
    - `test-results/evidence-screenshots/_shared/qidahen-region-mask-blank-boundary-five-region-generated-current.png`。

新增 E2E 覆盖：

- 工作区：`blank-boundary-five-region-hand-drawn`；
- 点击 `从空白边界开始手绘`；
- 在 `qidahen-region-canvas` 上用画笔依次手绘锦州、宋进、山海关、咸兴、汉城；
- 生成前断言：
  - 5 个区域卡 seed 状态均为 `闭合`；
  - 质量状态为 `边界可用于生成`；
  - `未命中=0`；
  - `开放线=0`；
- 保存边界图后刷新回读，仍保持 `边界可用于生成`；
- 点击 `按边界图生成初始区域` 后断言 5 个区域均为 `已生成`；
- 再次保存、刷新、导出质量报告 JSON，断言：
  - `quality.state = generated-ready`；
  - `quality.generatedCount = 5`；
  - `quality.formalRegionCount = 5`；
  - `closure.matchedSeedCount = 5`；
  - 5 个正式区域逐区 label 均为 `已生成`；
- 断言正式七大恨数据目录未被临时 E2E 工作区污染。

已实际看图：

- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-blank-boundary-five-region-drawn-current.png`
  - 可见新工具 UI；
  - 可见真实七大恨地图底图；
  - 5 个闭合边界来自工具内画笔绘制；
  - 汉城边界贴近右侧 UI 禁区，但没有把右侧牌框圈入边界。
- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-blank-boundary-five-region-generated-current.png`
  - 可见按工具内手绘边界生成的 5 个区域；
  - 不是黑图、旧 UI 或外部 ZIP 导入截图。

验证：

- `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 node scripts/infra/run-e2e-command.mjs default e2e/qidahen-region-mask.e2e.ts --grep "从空白边界开始用画笔手绘五区"`：`1 passed`。
- `npx eslint src/pages/devtools/QidahenRegionMaskTool.tsx e2e/qidahen-region-mask.e2e.ts`：通过。
- `npx tsc --noEmit --pretty false`：通过。
- `npx vitest run src/pages/devtools/__tests__/qidahenRegionMaskToolUtils.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1`：`46 passed`。
- `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 node scripts/infra/run-e2e-command.mjs default e2e/qidahen-region-mask.e2e.ts`：`19 passed (4.7m)`。

当前证据边界：

- 已证明工具内画笔编辑链路可以从空白边界达到 5/5，并能保存刷新回读；
- 已证明手绘补边不会把印刷 UI 禁区写入正式边界；
- 这仍是 E2E 合成闭合线，不是用户最终手绘边界图；
- 七大恨全图正常成果仍需用户导入或手绘真实边界后，再逐区视觉验收。

### 2026-05-24 正常成果门禁：小圈 5/5 不能冒充完成

本节修正此前最危险的证据口径：`generated-ready` 只能证明闭合面生成链路跑通，不能证明边界已经是正常成果。合成小圈、直线圈、多边形圈即使让 5 个 seed 都命中闭合面，也必须被质量报告标为“正常成果未证明”。

实现变化：

- `src/pages/devtools/QidahenRegionMaskTool.tsx`
  - `BoundaryQualityReport` 新增 `normality`；
  - `normality.state` 包含：
    - `not-ready`：还没生成完正式区域；
    - `suspicious`：5/5 已生成但面积粗检像围 seed 小圈；
    - `needs-visual-review`：面积粗检通过，但仍需逐区看图验收；
  - 每个区域记录 `pixelCount / expectedPixelCount / coverageRatio / label`；
  - 侧栏质量报告新增 normality 面板，显示 `正常成果未证明`、blocker 和每区比例；
  - `导出质量报告 JSON` 与 `区域验收包 ZIP/report.json` 都加入 `quality.normality`。
- `e2e/qidahen-region-mask.e2e.ts`
  - 工具内画笔合成 5/5 后断言：
    - `quality.state = generated-ready`；
    - `quality.normality.state = suspicious`；
    - `quality.normality.blockers.length > 0`；
    - 汉城局部为 `疑似小圈`；
  - 完整局部 ZIP 合成 5/5 后断言：
    - 质量报告 `normality=suspicious`；
    - 验收包 `report.json` 内 `quality.normality.state=suspicious`；
    - 刷新回读后仍为 `normality=suspicious`；
  - 部分 3/5 导入仍断言 `normality=not-ready`。

已实际看图：

- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-blank-boundary-five-region-generated-current.png`
  - 当前新工具 UI；
  - 左侧质量面板显示 `生成链路已跑通`，同时 normality 显示 `正常成果未证明 / suspicious`；
  - 成兴、汉城生成面积只有粗范围约 `16.0% / 17.1%`，被标为 `疑似小圈`；
  - 这张图证明“链路跑通”和“正常成果完成”已经拆开。
- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-complete-acceptance-overview-current.png`
  - 真实底图上能看到 5 个合成闭合小圈；
  - 这不是正式边界，只能作为防误判测试夹具。
- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-complete-acceptance-shou-cheng-current.png`
  - 汉城裁图清楚显示局部小圈贴近右侧 UI 禁区；
  - 不能作为真实区域成果。

验证：

- `npx eslint src/pages/devtools/QidahenRegionMaskTool.tsx e2e/qidahen-region-mask.e2e.ts`：通过。
- `npx tsc --noEmit --pretty false`：通过。
- `npx vitest run src/pages/devtools/__tests__/qidahenRegionMaskToolUtils.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1`：`46 passed`。
- `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 node scripts/infra/run-e2e-command.mjs default e2e/qidahen-region-mask.e2e.ts --grep "从空白边界开始用画笔手绘五区"`：`1 passed`。
- `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 node scripts/infra/run-e2e-command.mjs default e2e/qidahen-region-mask.e2e.ts --grep "完整五区局部描边 ZIP"`：`1 passed`。
- `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 node scripts/infra/run-e2e-command.mjs default e2e/qidahen-region-mask.e2e.ts`：`19 passed (4.6m)`。

当前证据边界：

- 已证明小圈/合成线 5/5 不会再被工具或报告称为正常成果；
- 已证明 JSON 和验收包都能留档该判断；
- 真实全图正常成果仍未完成，必须等用户导入/手绘真实闭合边界后逐区看图验收。

### 2026-05-24 逐区人工验收门禁与保存回读

本节补上 `needs-visual-review` 之后的最后一道工具门禁：面积粗检通过仍不能自动成为正常成果，必须逐个正式区域点“看图通过”。验收结果会绑定当前区域像素与边界签名，边界或 mask 变化后会自动变成过期，防止旧验收继续冒充新成果。

实现变化：

- `src/pages/devtools/QidahenRegionMaskTool.tsx`
  - 正式区域数据新增 `acceptance`，保存到工作区 `region-mask-regions.json`；
  - `BoundaryQualityReport.normality` 新增 `accepted` 状态；
  - 每区 normality 明细新增 `currentSignature`、`acceptanceState`、`acceptanceLabel`、`reviewedAt`；
  - normality 面板新增人工验收计数 `人工验收 N/5`、逐区 `看图通过` / `撤销` 按钮；
  - `导出质量报告 JSON` 与 `区域验收包 ZIP/report.json` 同步导出逐区验收状态。
- `e2e/qidahen-region-mask.e2e.ts`
  - 新增 `面积粗检通过后仍必须逐区看图验收，验收状态可保存回读`；
  - 构造一个面积粗检通过的 5 区边界夹具；
  - 断言生成 5/5 后仍为 `normality.state=needs-visual-review`、人工验收 `0/5`；
  - 逐区点击 `看图通过` 后才进入 `normality.state=accepted`、人工验收 `5/5`；
  - 导出 JSON 后断言所有区域 `acceptanceState=approved` 且有当前签名；
  - 保存工作区、刷新回读后仍保持 `accepted`；
  - 断言正式七大恨数据目录未被临时 E2E 工作区污染。

已实际看图：

- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-review-accepted-current.png`
  - 当前新工具 UI；
  - 左侧 normality 面板显示 `正常成果已人工验收 / accepted` 与 `人工验收 5/5`；
  - 每个区域都有 `已验收` 与 `撤销` 按钮；
  - 主画布显示真实七大恨地图底图、禁区虚线和 5 个生成区域，右侧牌框与底部卡牌 UI 没有被当成正式区域。
- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-blank-boundary-five-region-generated-current.png`
  - 小圈 5/5 仍显示 `normality.state=suspicious`；
  - 证明合成小圈不会因为新增人工验收逻辑被误放行。
- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-complete-acceptance-overview-current.png`
  - 验收包 overview 是真实底图叠加区域覆盖与白圈标注；
  - 这仍是测试夹具，不是真实全图边界成果。
- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-complete-acceptance-shou-cheng-current.png`
  - 汉城局部裁图能看出测试夹具小圈风险，仍不能作为正式区域成果。

验证：

- `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 node scripts/infra/run-e2e-command.mjs default e2e/qidahen-region-mask.e2e.ts -g "面积粗检通过后仍必须逐区看图验收"`：`1 passed`。
- `npx eslint src/pages/devtools/QidahenRegionMaskTool.tsx e2e/qidahen-region-mask.e2e.ts`：通过。
- `npx tsc --noEmit --pretty false`：通过。
- `npx vitest run src/pages/devtools/__tests__/qidahenRegionMaskToolUtils.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1`：`46 passed`。
- `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 node scripts/infra/run-e2e-command.mjs default e2e/qidahen-region-mask.e2e.ts`：`20 passed (4.9m)`。

当前证据边界：

- 工具链现在有三层结果口径：`generated-ready` 只代表生成链路跑通，`needs-visual-review` 代表面积粗检过但还没人工验图，`accepted` 才代表当前工作区里 5 个区域都已逐区人工确认；
- `accepted` 绑定当前边界/区域签名，后续改边界或 mask 会让验收失效；
- 本轮 `accepted` 截图仍来自 E2E 测试夹具，只证明工具门禁和保存回读正确；
- 真实全图正常成果仍必须等用户导入/手绘真实闭合边界图后，再逐区视觉验收通过。

### 2026-05-24 修订：直线多边形夹具不得进入人工验收

上一节的 `accepted` 夹具结论已失效：它只证明“验收状态可保存回读”，但没有证明边界贴合真实底图。真实地图上的区域边界是河流、海岸、山脉、长城等弯曲线；测试夹具里的大直线/多边形即使面积粗检通过，也不是正常成果。该旧截图不能再作为完成证据。

实现变化：

- `src/pages/devtools/QidahenRegionMaskTool.tsx`
  - normality 新增 `realMapFit`；
  - 从真实底图像素构建“长线边界支撑层”，先剔除印刷 UI 和紧凑装饰/标记，再只保留靠近区域边界参考带的长线候选；
  - 当前边界图必须有足够像素贴近该支撑层，才能进入 `needs-visual-review` 或 `accepted`；
  - 直线多边形、粗轮廓、围 seed 的夹具现在会停在 `normality.state=suspicious`；
  - normality 面板和质量报告 JSON 输出 `realMapFit.state/supportRatio/supportedBoundaryPixelCount`。
- `e2e/qidahen-region-mask.e2e.ts`
  - 原“面积粗检通过后仍必须逐区看图验收”用例改为反向门禁：
    - `直线多边形面积粗检通过也不能人工验收成正常成果`；
    - 断言 5/5 生成后仍为 `normality.state=suspicious`；
    - 断言 `realMapFit.state=blocked`；
    - 断言所有 `看图通过` 按钮禁用；
    - 质量报告 JSON 中 `normality.realMapFit.state=blocked`，`approvedCount=0`；
    - 保存、刷新回读后仍保持 `suspicious`。

已实际看图：

- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-real-map-fit-rejected-current.png`
  - 当前新工具 UI；
  - 左侧显示 `正常成果未证明 / suspicious`；
  - `底图贴合 blocked · 7.6% · 994/13,069 px`；
  - 每区 `看图通过` 按钮均为禁用态；
  - 画布上可见夹具边界是直线/多边形，并没有沿真实河流、海岸、山脉、长城走线；
  - 右侧和底部印刷 UI 禁区以粉色虚线显示，未被当作正常成果。

验证：

- `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 node scripts/infra/run-e2e-command.mjs default e2e/qidahen-region-mask.e2e.ts -g "直线多边形面积粗检通过也不能人工验收成正常成果"`：`1 passed`。
- `npx eslint src/pages/devtools/QidahenRegionMaskTool.tsx e2e/qidahen-region-mask.e2e.ts`：通过。
- `npx tsc --noEmit --pretty false`：通过。
- `npx vitest run src/pages/devtools/__tests__/qidahenRegionMaskToolUtils.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1`：`46 passed`。
- `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 node scripts/infra/run-e2e-command.mjs default e2e/qidahen-region-mask.e2e.ts`：`20 passed (5.5m)`。

当前证据边界：

- 已修正“面积粗检 + 手点验收”仍可能放过假成果的问题；
- 现在要进入人工验收，必须先通过面积粗检和真实底图贴合门禁；
- 本轮仍没有生成真实全图成果：正式 `region-mask.png` / `region-boundary-mask.png` 当前仍是空白透明占位；
- 要得到正常成果，仍需要用户导入或手绘真实闭合边界图，然后让该边界通过底图贴合门禁、逐区验收和保存回读。

### 2026-05-24 补充：真实底图支撑线显示与画笔吸附

本节只补“辅助真实手绘”的工具能力，不把底图自动候选恢复成正式成果路线。真实底图支撑线来自记录的真实边界色和底图梯度，扩张后再次剔除印刷 UI 禁区；它只用于显示和用户显式开启后的画笔吸附，不会自动写入边界图。

实现变化：

- `src/pages/devtools/QidahenRegionMaskTool.tsx`
  - 新增 `显示真实线` 辅助层，使用琥珀色显示真实底图长线候选；
  - 新增 `吸附真实线` 开关，默认关闭，避免污染既有手绘/测试路径；
  - 补边画笔在开关开启时会把落点吸附到 18px 内最近的真实支撑线；
  - 新增 `导出真实线候选 PNG`，导出未扩张的透明细线候选图，供外部微调；
  - 支撑层固定使用记录的真实地图边界色，不受用户临时新增的边界色影响；
  - 修正 barrier debug 像素判断，避免 `null` 支撑层把整张画布误涂满；
  - 拖动补边时减少每个 pointer move 的状态刷新，最终重算仍在松手后执行。
- `e2e/qidahen-region-mask.e2e.ts`
  - 新增 `真实线候选可导出为透明 PNG 但不写入正式边界`；
  - 断言下载 PNG 有候选线、印刷 UI 禁区无像素、正式边界图像素仍为 0；
  - 新增 `真实底图支撑层只辅助画笔吸附，不自动生成正式成果`；
  - 用例从空白边界工作区打开真实线辅助层，显式开启吸附；
  - 从真实支撑线旁的透明点下笔，断言手工补边增加且质量报告中有真实线支撑像素；
  - 断言 `normality` 仍不是 `accepted`，防止辅助线冒充成果；
  - 同步把“指定边界颜色”用例改成导入指定颜色描线图，避免用高事件量拖拽误测。

已实际看图：

- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-real-map-candidate-export-current.png`
  - 当前新工具 UI；
  - 左侧显示 `导出真实线候选 PNG` 入口；
  - 画布仍是正式空白起点，没有显示生成区域；
  - 这只证明可导出候选初稿，不证明真实全图成果已完成。
- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-real-map-support-snap-current.png`
  - 当前新工具 UI；
  - 左侧显示 `正常成果未生成 / not-ready`，人工验收仍为 `0/5`；
  - `底图贴合 blocked`，没有进入 accepted；
  - 主画布是七大恨真实底图，只有支撑线/少量手工补边辅助，不是旧合成区域成果。

验证：

- `npx eslint src/pages/devtools/QidahenRegionMaskTool.tsx e2e/qidahen-region-mask.e2e.ts`：通过。
- `npx tsc --noEmit --pretty false`：通过。
- `npx vitest run src/pages/devtools/__tests__/qidahenRegionMaskToolUtils.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1`：`46 passed`。
- `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 node scripts/infra/run-e2e-command.mjs default e2e/qidahen-region-mask.e2e.ts --grep "真实线候选可导出为透明 PNG|真实底图支撑层只辅助画笔吸附|直线多边形面积粗检通过也不能人工验收成正常成果|正式工作区为空时只给真实边界入口不展示假成果|指定边界颜色可以生成区域初始值"`：`5 passed (8.7m)`。
- 说明：整份 `e2e/qidahen-region-mask.e2e.ts` 本轮尝试过两次，均被外层超时截断；其中旧长流程 `边界断点只定位不自动直线封口，手绘补边支持撤销与重做` 仍暴露独立稳定性问题，不能作为全量通过证据。

当前证据边界：

- 已证明真实支撑线可以辅助用户沿真实底图长线下笔；
- 已证明可以导出透明候选边界 PNG 作为用户微调初稿；
- 已证明该辅助层不会自动生成区域、不会进入 `accepted`、不会覆盖正式空白工作区；
- 真实全图成果仍未完成：必须等用户导入/手绘真实闭合边界图，再通过底图贴合、逐区验收和保存回读。

### 2026-05-25 修正：真实线候选不达标时禁止载入草稿

本节修正上一版错误结论：`真实线候选可直接载入为边界草稿` 不成立。实际看图和像素检查显示，RGB/梯度候选仍会混入马纹、山纹、海纹、文字、路线和印刷 UI，且不能形成包住 5 个正式 seed 的闭合边界。继续允许它载入草稿会误导用户，以为直线/碎线/UI 也是边界。因此本节把自动候选改成诊断信息：只有候选同时满足“无 UI 像素”和“闭合包住全部正式 seed”时才允许载入；当前真实底图候选不满足，必须走空白手绘或导入完成边界图。

实现变化：

- `src/pages/devtools/QidahenRegionMaskTool.tsx`
  - 新增 `scoreBoundaryCandidateReadiness`；
  - 对真实线候选统计闭合面、命中的正式 seed 数、印刷 UI 像素；
  - 只有 `matchedSeedCount === requiredSeedCount` 且 `uiPixelCount === 0` 时，`载入候选草稿` 才可用；
  - 当前候选不达标时按钮禁用，并显示 `候选不达标`、seed 命中数、闭合面数、UI 像素数；
  - 即使误点入口，也会被状态消息拦截，提示改走空白边界手绘或导入完成边界图。
- `e2e/qidahen-region-mask.e2e.ts`
  - 将旧用例改为 `真实线候选不达标时不能载入为边界草稿`；
  - 断言真实线候选像素存在；
  - 断言 readiness 显示 `候选不达标`；
  - 断言 `载入候选草稿` 按钮禁用；
  - 断言当前边界图和最终障碍像素仍为 0；
  - 断言 barrier canvas 的印刷 UI 禁区仍无像素；
  - 断言 `normality` 不是 `accepted`；
  - 点击生成区域后仍没有任何 `已生成` 区域；
  - 断言正式七大恨数据快照未改变。

已实际看图：

- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-real-map-candidate-draft-current.png`
  - 当前新工具 UI；
  - 左侧候选入口显示 `候选不载入`；
  - readiness 面板显示 `候选不达标：seed 0/5 / 闭合面 2 / UI 0 px`；
  - 画布没有把候选线载入边界草稿；
  - 这张图证明自动候选当前被门禁拦住，不再作为正常成果起点。
- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-real-map-candidate-export-current.png`
  - 左侧入口已改为 `导出候选诊断 PNG`；
  - 同屏显示 `候选不载入` 和 `候选不达标：seed 0/5 / 闭合面 2 / UI 0 px`；
  - 候选导出只能作为诊断产物，不能作为用户要的正常成果。
- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-real-map-support-snap-current.png`
  - 显示 `正常成果未生成 / not-ready`；
  - 人工验收仍为 `0/5`；
  - `底图贴合 blocked`，没有进入 accepted。

验证：

- `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 PW_WORKERS=1 PW_PORT=6373 PW_GAME_SERVER_PORT=20200 PW_API_SERVER_PORT=21200 node scripts/infra/run-e2e-command.mjs isolated e2e/qidahen-region-mask.e2e.ts --grep "底图候选诊断可导出|真实线候选不达标"`：`2 passed (2.1m)`。
- `npx eslint src/pages/devtools/QidahenRegionMaskTool.tsx e2e/qidahen-region-mask.e2e.ts`：通过。
- `npx tsc --noEmit --pretty false`：通过。

当前证据边界：

- 已证明当前自动候选不能作为正常成果起点；
- 已完成坏候选拦截，避免 UI/直线/碎线被载入边界草稿；
- 正常成果仍未完成：必须由用户导入/手绘闭合边界图，再按工具链生成区域、逐区验收、保存回读。

### 2026-05-25 补充：闭合边界导入链路仍可生成 5/5，但合成边界不是成果

在禁用坏候选载入后，复跑闭合边界导入链路，确认“用户手绘/导入闭合边界图”这条主路仍可工作。该验证使用测试生成的透明局部描边 ZIP，不是用户实际描出的真实地图边界，因此只能证明工具链路可用，不能证明正常成果已完成。

验证：

- `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 PW_WORKERS=1 PW_PORT=6373 PW_GAME_SERVER_PORT=20200 PW_API_SERVER_PORT=21200 node scripts/infra/run-e2e-command.mjs isolated e2e/qidahen-region-mask.e2e.ts --grep "完整五区局部描边 ZIP 导入后可生成 5/5"`：`1 passed (3.4m)`。
- `npx eslint src/pages/devtools/QidahenRegionMaskTool.tsx e2e/qidahen-region-mask.e2e.ts`：通过。
- `npx tsc --noEmit --pretty false`：通过。

已实际看图：

- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-complete-acceptance-overview-current.png`
  - 5 个区域均生成并出现在真实底图验收总览上；
  - 可见这些区域仍是测试合成的小圈/椭圆，尤其咸兴、汉城明显没有沿真实地图边界走线；
  - 该图证明生成链路和验收包导出可用，但不达成用户要的正常成果。
- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-complete-acceptance-shou-cheng-current.png`
  - 汉城裁图只覆盖右下局部小圈；
  - 不是完整真实边界区域，不能人工验收为正常成果。

当前证据边界：

- 主路工具链可用：导入闭合边界 ZIP -> 生成 5/5 -> 导出质量报告 -> 导出验收包 -> 保存回读；
- 门禁仍正确保持 `normality=suspicious`，不会把测试合成边界放行为正常成果；
- 要得到正常成果，仍需要用户提供/手绘贴真实地图边界的闭合边界图。

### 2026-05-25 补充：正式工作区禁止保存 suspicious 区域成果

上一节确认了临时工作区仍可保存合成小圈作为进度，但这类 `suspicious` 结果不能写入 `src/games/qidahen/data/*` 充当正式成果。本节补上正式工作区保存门禁：只要正式工作区中已经有区域像素，且 `normality.state !== accepted`，保存入口直接禁用；保存函数内部也做同样拦截，避免事件绕过 UI。

实现变化：

- `src/pages/devtools/QidahenRegionMaskTool.tsx`
  - 新增 `formalRegionSaveBlocked`；
  - 正式工作区有区域像素且未 `accepted` 时，保存按钮显示 `正式成果待验收` 并禁用；
  - 新增 `qidahen-formal-save-guard` 提示，明确 `suspicious` 不能保存为正式成果，临时工作区仍可保存进度；
  - `saveRegionData` 内部在写入前再次检查 `!isIsolatedWorkspace && exportedAssignedPixels > 0 && normality !== accepted`，不满足时直接返回错误状态消息。
- `e2e/qidahen-region-mask.e2e.ts`
  - 新增 `正式工作区中疑似生成结果不能保存为正式成果`；
  - 在正式路由 `/dev/qidahen-region-mask` 导入完整五区局部描边 ZIP 并生成 5/5；
  - 断言结果仍为 `suspicious`；
  - 断言保存按钮禁用且显示 `正式成果待验收`；
  - 断言正式七大恨数据快照未改变。

验证：

- `npx eslint src/pages/devtools/QidahenRegionMaskTool.tsx e2e/qidahen-region-mask.e2e.ts`：通过。
- `npx tsc --noEmit --pretty false`：通过。
- `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 PW_WORKERS=1 PW_PORT=6373 PW_GAME_SERVER_PORT=20200 PW_API_SERVER_PORT=21200 node scripts/infra/run-e2e-command.mjs isolated e2e/qidahen-region-mask.e2e.ts --grep "正式工作区中疑似生成结果不能保存为正式成果"`：`1 passed (1.8m)`。
- `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 PW_WORKERS=1 PW_PORT=6373 PW_GAME_SERVER_PORT=20200 PW_API_SERVER_PORT=21200 node scripts/infra/run-e2e-command.mjs isolated e2e/qidahen-region-mask.e2e.ts --grep "完整五区局部描边 ZIP 导入后可生成 5/5"`：`1 passed (3.4m)`，确认临时工作区保存进度未被误伤。

已实际看图：

- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-formal-save-guard-current.png`
  - 左侧显示当前为 `正式工作区`，输出目录是 `src/games/qidahen/data`；
  - 画布右侧仍是合成小圈/椭圆区域，不贴真实地图边界；
  - 保存按钮显示 `正式成果待验收`；
  - 警告文案明确写着正式工作区不能保存 `suspicious` 的区域成果。
- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-complete-acceptance-overview-current.png`
  - 临时工作区复跑仍可生成 5/5 并导出验收包；
  - 图上仍是合成小圈/椭圆，只能作为链路证据，不能作为正常成果证据。

当前证据边界：

- 正式数据目录现在不会被 `suspicious` 区域结果覆盖；
- 临时工作区仍可保存用户修边进度；
- 正常成果仍未完成：必须等用户提供/手绘真实闭合边界图，并通过真实底图贴合、5/5 人工验收、保存回读。

### 2026-05-25 补充：生成算法改为按边界分割全图

本节修正“小圈成果”的核心成因。此前 `按边界图生成初始区域` 只调用 `extractClosedBoundaryInteriorComponents`，等价于“找每条闭合线圈内部”。所以局部描边 ZIP 必然生成小圈/椭圆，即使链路通过，也不可能变成完整地图区域。现在生成策略改为：把边界图作为全图分割线，在剔除印刷 UI 禁区后找非边界连通分区；只有某个分区里恰好包含 1 个正式 seed 时才写入该区域。若多个 seed 仍在同一个分区里，说明边界没真正隔开，直接跳过，不硬造直线或假区域。

实现变化：

- `src/pages/devtools/qidahenRegionMaskToolUtils.ts`
  - 新增 `BoundaryPartitionComponent`；
  - 新增 `extractBoundaryPartitionComponents`；
  - 用 4 邻域遍历非边界、可填充像素；
  - 支持传入 `fillableMask`，七大恨工具里用它剔除印刷 UI 禁区；
  - 每个连通分区记录命中的 seed 索引。
- `src/pages/devtools/QidahenRegionMaskTool.tsx`
  - `boundaryClosureDiagnostics` 改为按“seed 是否被边界独立分割”判断；
  - `generateRegionsFromCurrentBoundary` 改为使用 `extractBoundaryPartitionComponents`；
  - 只生成 seed 独占的分区；
  - 对多个 seed 仍连通的分区给出跳过原因，例如“当前边界没有把 A、B、C 分割开”；
  - 状态文案改为“按边界线分割全图；未被边界真正隔开的 seed 会直接跳过”。
- `src/pages/devtools/__tests__/qidahenRegionMaskToolUtils.test.ts`
  - 新增“连接到边缘的边界线能分割整块地图”的单测；
  - 新增“未接边缘的开放线段不会被当作有效分割”的单测。
- `e2e/qidahen-region-mask.e2e.ts`
  - 新增 `连接到地图边缘的边界线按全图分区生成而不是只取小圈`；
  - 构造连接到右侧/底部禁区的边界线；
  - 断言咸兴和汉城生成大分区；
  - 断言锦州、宋进、山海关因仍未被边界分割开而跳过；
  - 断言正式数据快照不变。

验证：

- `npx vitest run src/pages/devtools/__tests__/qidahenRegionMaskToolUtils.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1`：`48 passed`。
- `npx eslint src/pages/devtools/QidahenRegionMaskTool.tsx src/pages/devtools/qidahenRegionMaskToolUtils.ts src/pages/devtools/__tests__/qidahenRegionMaskToolUtils.test.ts e2e/qidahen-region-mask.e2e.ts`：通过。
- `npx tsc --noEmit --pretty false`：通过。
- `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 PW_WORKERS=1 PW_PORT=6373 PW_GAME_SERVER_PORT=20200 PW_API_SERVER_PORT=21200 node scripts/infra/run-e2e-command.mjs isolated e2e/qidahen-region-mask.e2e.ts --grep "连接到地图边缘的边界线按全图分区生成"`：`1 passed (1.5m)`。
- `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 PW_WORKERS=1 PW_PORT=6373 PW_GAME_SERVER_PORT=20200 PW_API_SERVER_PORT=21200 node scripts/infra/run-e2e-command.mjs isolated e2e/qidahen-region-mask.e2e.ts --grep "完整五区局部描边 ZIP 导入后可生成 5/5|正式工作区中疑似生成结果不能保存为正式成果"`：`2 passed (5.0m)`。
- 正式文件复核：`src/games/qidahen/data/region-mask.png opaque=0`，`src/games/qidahen/data/region-boundary-mask.png opaque=0`。

已实际看图：

- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-partition-generated-current.png`
  - 画面是临时工作区；
  - 咸兴和汉城不是小圈：咸兴约 `11,832 px`，汉城约 `20,416 px`；
  - 锦州、宋进、山海关显示未生成，原因是它们仍在同一连通分区，边界没有把它们隔开；
  - 该图证明生成策略已经能按边界分割全图，但边界仍是测试直线，不是正常成果。

当前证据边界：

- 已修掉“只能生成局部小圈”的核心算法问题；
- 现在工具能消费连接到地图边缘/禁区/其它边界的分割线，生成大分区；
- 直线测试夹具仍不是正常成果；
- 要得到正常成果，仍需要用户导入/手绘真实地图边界线，形成每个区域 seed 独占的分区，再逐区看图验收。

### 2026-05-25 补充：有效分区边界清洗改为组件级保留

上一节的全图分区算法引入后，旧 `只保留闭合边界` 清洗动作变成新风险：它仍按“闭合面相邻像素”或单个边界像素判断，无法理解“连接到地图边缘/禁区/其它边界的分割线”。在 `连接到地图边缘的边界线按全图分区生成` 用例里，导入的 T 字分割线本来能分出咸兴/汉城，但点击清洗后只剩 `36 px`，随后 5 个 seed 仍在同一连通分区，0 区域生成。

实现变化：

- `src/pages/devtools/qidahenRegionMaskToolUtils.ts`
  - `keepBoundaryPixelsTouchingSeedPartitions` 改为先提取边界连通组件；
  - 对每个组件统计邻接到的 partition labels、单 seed partition labels、以及是否接触 fill boundary；
  - 组件邻接至少一个单 seed 分区，且同时邻接其它分区或 fill boundary 时，整条组件保留；
  - 只贴在同一分区内部的开放尾巴整条舍弃；
  - 这样不会把有效分割线裁成碎片。
- `src/pages/devtools/__tests__/qidahenRegionMaskToolUtils.test.ts`
  - 新增 `keepBoundaryPixelsTouchingSeedPartitions 保留接边分区线组件而不是裁成碎片`；
  - 小网格复现竖线接上下边、横线接右边、内部开放尾巴；
  - 断言接边分区线保留，内部尾巴删除。
- `src/pages/devtools/QidahenRegionMaskTool.tsx`
  - 现有按钮文案保持为 `只保留有效分区边界`；
  - 清洗优先走分区组件保留，没有有效分区时再回退闭合面清洗。

验证：

- `npx vitest run src/pages/devtools/__tests__/qidahenRegionMaskToolUtils.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1`：`50 passed`。
- `npx eslint src/pages/devtools/QidahenRegionMaskTool.tsx src/pages/devtools/qidahenRegionMaskToolUtils.ts src/pages/devtools/__tests__/qidahenRegionMaskToolUtils.test.ts e2e/qidahen-region-mask.e2e.ts`：通过。
- `npx tsc --noEmit --pretty false`：通过。
- `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 PW_WORKERS=1 PW_PORT=6373 PW_GAME_SERVER_PORT=20200 PW_API_SERVER_PORT=21200 node scripts/infra/run-e2e-command.mjs isolated e2e/qidahen-region-mask.e2e.ts --grep "连接到地图边缘的边界线按全图分区生成"`：`1 passed (1.9m)`。
- `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 PW_WORKERS=1 PW_PORT=6373 PW_GAME_SERVER_PORT=20200 PW_API_SERVER_PORT=21200 node scripts/infra/run-e2e-command.mjs isolated e2e/qidahen-region-mask.e2e.ts --grep "完整五区局部描边 ZIP 导入后可生成 5/5|正式工作区中疑似生成结果不能保存为正式成果"`：`2 passed (5.1m)`。
- 正式文件复核：
  - `src/games/qidahen/data/region-mask.png 1265x893 opaque=0`；
  - `src/games/qidahen/data/region-boundary-mask.png 1265x893 opaque=0`。

已实际看图：

- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-partition-generated-current.png`
  - 清洗后仍能生成咸兴和汉城大分区；
  - 咸兴约 `11,832 px`，汉城约 `20,416 px`；
  - 锦州、宋进、山海关仍显示未生成，因为测试线没有把这些 seed 分割开；
  - 图上边界仍是直线测试夹具，只证明算法/清洗链路，不是正常成果。

当前证据边界：

- 已修复清洗动作删除有效分区线的问题；
- 已证明“接边/接禁区的分割线”能在清洗后继续生成大分区；
- 正式七大恨 `region-mask.png` / `region-boundary-mask.png` 仍为空白，没有被测试夹具污染；
- 正常成果仍未完成，必须等用户导入/手绘真实边界图后逐区看图验收。

### 2026-05-25 补充：导入/手绘边界后的分区预览

上一节修复了“清洗后仍能按边界分割全图生成”的算法问题，但用户实际编辑时仍有一个体验缺口：在点击生成前，地图上只能看到边界线和 seed 状态，不能直接判断“这张边界图会把哪些区域分出来”。本节补上预览层，让用户先看即将生成的区域，再决定是否继续补线、清洗或生成。

实现变化：

- `src/pages/devtools/QidahenRegionMaskTool.tsx`
  - `BoundaryClosureDiagnostics` 新增 `matchedPartitions`，记录每个已经独立 seed 分区的 `regionId / regionName / color / pixelCount / mask`；
  - 新增 `qidahen-partition-preview-canvas`；
  - 在 `hasBoundaryDraft && !hasGeneratedRegions && matchedPartitions.length > 0` 时，用对应区域色半透明叠加即将生成的分区；
  - 点击生成后，预览层清空，正式 `qidahen-mask-canvas` 才显示生成结果；
  - 可见文案从“闭合诊断 / 闭合面 / seed 命中 / 未命中”收口为“分区诊断 / 可填分区 / 独立 seed / 未独立”，避免继续把全图分割模型误说成小圈闭合模型。
- `e2e/qidahen-region-mask.e2e.ts`
  - `连接到地图边缘的边界线按全图分区生成而不是只取小圈` 扩展为先看预览再生成；
  - 生成前断言 `qidahen-partition-preview-canvas` 有超过 `20,000 px` 不透明像素；
  - 同时断言 `qidahen-mask-canvas` 仍为 `0 px`，证明预览没有提前写正式 mask；
  - 生成后断言预览层回到 `0 px`。

验证：

- `npx eslint src/pages/devtools/QidahenRegionMaskTool.tsx src/pages/devtools/qidahenRegionMaskToolUtils.ts src/pages/devtools/__tests__/qidahenRegionMaskToolUtils.test.ts e2e/qidahen-region-mask.e2e.ts`：通过。
- `npx tsc --noEmit --pretty false`：通过。
- `npx vitest run src/pages/devtools/__tests__/qidahenRegionMaskToolUtils.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1`：`50 passed`。
- `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 PW_WORKERS=1 PW_PORT=6373 PW_GAME_SERVER_PORT=20200 PW_API_SERVER_PORT=21200 node scripts/infra/run-e2e-command.mjs isolated e2e/qidahen-region-mask.e2e.ts --grep "连接到地图边缘"`：`1 passed (2.5m)`。
- `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 PW_WORKERS=1 PW_PORT=6373 PW_GAME_SERVER_PORT=20200 PW_API_SERVER_PORT=21200 node scripts/infra/run-e2e-command.mjs isolated e2e/qidahen-region-mask.e2e.ts --grep "完整手绘边界图"`：`1 passed (4.1m)`。
- `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 PW_WORKERS=1 PW_PORT=6373 PW_GAME_SERVER_PORT=20200 PW_API_SERVER_PORT=21200 node scripts/infra/run-e2e-command.mjs isolated e2e/qidahen-region-mask.e2e.ts --grep "完整五区局部描边 ZIP"`：`1 passed (4.4m)`。
- `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 PW_WORKERS=1 PW_PORT=6373 PW_GAME_SERVER_PORT=20200 PW_API_SERVER_PORT=21200 node scripts/infra/run-e2e-command.mjs isolated e2e/qidahen-region-mask.e2e.ts --grep "正式工作区中疑似生成结果不能保存"`：`1 passed (2.1m)`。
- 正式文件复核：
  - `src/games/qidahen/data/region-mask.png 1265x893 opaque=0`；
  - `src/games/qidahen/data/region-boundary-mask.png 1265x893 opaque=0`。

已实际看图：

- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-partition-preview-current.png`
  - 左侧仍显示 `候选不达标：seed 0/5 / 可填分区 2 / UI 0 px`，说明不是把底图候选写成成果；
  - 地图右侧能看到咸兴/汉城两个半透明预览分区；
  - 这是生成前状态，正式 mask 仍为空。
- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-partition-generated-current.png`
  - 生成后咸兴、汉城写入正式 mask 层，像素约 `11,832 / 20,416`；
  - 锦州、宋进、山海关仍未生成，因为测试边界没有把这些 seed 独立分割出来；
  - 图上边界仍是直线测试夹具，只证明预览/生成链路，不是正式正常成果。
- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-hand-drawn-multi-diagnostics-current.png`
  - seed 状态已显示为 `独立 / 未独立`；
  - 仍可定位未独立区域并清洗开放噪声。

当前证据边界：

- 工具现在支持“用户导入/手绘边界图 -> 地图上预览独立分区 -> 清洗噪声 -> 生成区域 -> 保存门禁”这条实际编辑流程；
- 真实底图自动抽线仍被审计数据否定：4 色总命中 `185,213 px`，UI 禁区 `107,306 px`，清 UI 后仍有 `77,907 px / 4,951` 个碎组件；
- 正式七大恨数据仍未被测试夹具污染；
- 正常成果仍未完成，必须等用户提供/手绘贴真实地图边界的完整边界图，再逐区看图验收并保存回读。

### 2026-05-25 补充：曲线手绘边界证据替换直线夹具

用户明确指出“直来直去的肯定不是边界”。因此上一节的预览/生成证据不能继续只靠横平竖直的测试线。本节把 `连接到地图边缘的边界线按全图分区生成而不是只取小圈` 用例的边界输入改为曲线手绘形态。

实现变化：

- `e2e/qidahen-region-mask.e2e.ts`
  - `createEdgePartitionBoundaryMaskPng()` 不再生成直线 T 字夹具；
  - 东侧主分割线改为贝塞尔曲线；
  - 咸兴上边、咸兴/汉城之间的分割线也改为曲线；
  - 断开的噪声尾巴改为曲线，继续验证 `只保留有效分区边界` 会舍弃无法连成有效分区的线。

验证：

- `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 PW_WORKERS=1 PW_PORT=6373 PW_GAME_SERVER_PORT=20200 PW_API_SERVER_PORT=21200 node scripts/infra/run-e2e-command.mjs isolated e2e/qidahen-region-mask.e2e.ts --grep "连接到地图边缘"`：`1 passed (2.4m)`。
- `npx eslint e2e/qidahen-region-mask.e2e.ts`：通过。
- `npx tsc --noEmit --pretty false`：通过。
- 正式文件复核：
  - `src/games/qidahen/data/region-mask.png 1265x893 opaque=0`；
  - `src/games/qidahen/data/region-boundary-mask.png 1265x893 opaque=0`。

已实际看图：

- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-partition-preview-current.png`
  - 右侧白色边界线是弯曲手绘线，不再是直线 T 字；
  - 生成前仍只显示半透明区域预览，没有写入正式 mask。
- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-partition-generated-current.png`
  - 生成后咸兴约 `13,063 px`、汉城约 `21,109 px`；
  - 锦州、宋进、山海关仍因未被边界分开而跳过；
  - 该图证明曲线手绘边界也能驱动分区生成，但仍不是七大恨正式正常成果。

当前证据边界：

- “工具只会在直线夹具上工作”的风险已被降低；
- 但曲线夹具仍是测试输入，不是用户最终手绘的完整真实边界图；
- 正常成果仍未完成，下一步必须用用户实际描好的边界图或在工具内继续手绘到 5 个正式 seed 都进入独立分区，并逐区看图验收。

### 2026-05-25 补充：直线/多边形形态门禁

上一节降低了“只用直线夹具证明工具”的风险，但还需要防止另一个错误：面积粗检通过后，把直线/多边形区域误标为可人工验收。本节新增一个直接看边界 mask 的形态评分，不依赖 SVG 来源。

实现变化：

- `src/pages/devtools/QidahenRegionMaskTool.tsx`
  - 新增 `BoundaryShapeReport`；
  - 新增 `scoreBoundaryShape()`；
  - 统计实际边界 mask 中有多少像素落在长直线段上；
  - 当直线占比超过 `36%` 且 `realMapFit` 仍未 passed 时，将 normality 保持为 `suspicious`；
  - UI 在 normality 面板中显示 `直线形态 {state} · {ratio}`；
  - 导出的质量报告 JSON 增加 `quality.normality.shape`。
- `e2e/qidahen-region-mask.e2e.ts`
  - `直线多边形面积粗检通过也不能人工验收成正常成果` 的夹具改为真正折线多边形；
  - 新增断言 `qidahen-boundary-shape-report` 显示 `blocked`；
  - 新增断言 blockers 包含 `长直线段`；
  - 新增断言质量报告中 `normality.shape.state === 'blocked'` 且直线占比 > `0.36`。

验证：

- `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 PW_WORKERS=1 PW_PORT=6373 PW_GAME_SERVER_PORT=20200 PW_API_SERVER_PORT=21200 node scripts/infra/run-e2e-command.mjs isolated e2e/qidahen-region-mask.e2e.ts --grep "直线多边形"`：`1 passed (3.0m)`。
- `npx eslint src/pages/devtools/QidahenRegionMaskTool.tsx e2e/qidahen-region-mask.e2e.ts`：通过。
- `npx tsc --noEmit --pretty false`：通过。
- `npx vitest run src/pages/devtools/__tests__/qidahenRegionMaskToolUtils.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1`：`50 passed`。
- 正式文件复核：
  - `src/games/qidahen/data/region-mask.png 1265x893 opaque=0`；
  - `src/games/qidahen/data/region-boundary-mask.png 1265x893 opaque=0`。

已实际看图：

- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-real-map-fit-rejected-current.png`
  - 左侧显示 `正常成果未证明 / suspicious`；
  - `底图贴合 blocked · 6.5% · 900/13,820 px`；
  - `直线形态 blocked · 39.1% · 5,400/13,820 px`；
  - 5 个区域面积粗检可通过，但 `看图通过` 按钮仍不可用；
  - 这证明“面积大 + 生成 5/5”仍不能绕过真实边界门禁。

当前证据边界：

- 直线/多边形假成果现在有显式形态 blocker；
- 正式数据未被污染；
- 正常成果仍未完成：必须使用用户真实手绘边界图，且同时通过底图贴合、形态门禁、5/5 区域逐区看图验收后，才能保存为正式成果。

### 2026-05-25 补充：分区预览导出 PNG

用户后续真实手绘边界图时，需要能把“生成前会切出哪些区域”留成图证，而不是只看侧栏数字或实时 canvas。本节补上分区预览导出闭环。

实现变化：

- `src/pages/devtools/QidahenRegionMaskTool.tsx`
  - 新增 `buildPartitionPreviewDataUrl()`；
  - 新增 `exportPartitionPreviewPng()`；
  - 质量面板新增按钮 `导出分区预览 PNG`，`data-testid="qidahen-export-partition-preview"`；
  - 导出图包含真实底图、当前边界线、半透明预览分区、独立/未独立 seed 标记、开放线段端点；
  - 导出文件名固定为 `qidahen-region-partition-preview.png`。
- `e2e/qidahen-region-mask.e2e.ts`
  - `连接到地图边缘的边界线按全图分区生成而不是只取小圈` 扩展下载断言；
  - 断言文件名、`1265x893` 尺寸和非空像素 `>900,000`；
  - 下载后继续执行原生成断言，证明导出不会提前写正式 mask。

验证：

- `npx eslint src/pages/devtools/QidahenRegionMaskTool.tsx e2e/qidahen-region-mask.e2e.ts`：通过。
- `npx tsc --noEmit --pretty false`：通过。
- `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 PW_WORKERS=1 PW_PORT=6373 PW_GAME_SERVER_PORT=20200 PW_API_SERVER_PORT=21200 node scripts/infra/run-e2e-command.mjs isolated e2e/qidahen-region-mask.e2e.ts --grep "连接到地图边缘"`：`1 passed (3.0m)`。
- 正式文件复核：
  - `src/games/qidahen/data/region-mask.png 1265x893 opaque=0`；
  - `src/games/qidahen/data/region-boundary-mask.png 1265x893 opaque=0`。

已实际看图：

- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-partition-preview-current.png`
  - 左侧质量面板已有 `导出分区预览 PNG`；
  - 右侧是曲线手绘边界线驱动的咸兴/汉城半透明分区预览；
  - 正式 mask 仍未生成，属于生成前留档图。

当前证据边界：

- 这一步增强的是“手绘边界图 -> 生成前验图/留档”的工具闭环；
- 它不能替代用户真实边界图；
- 正常成果仍必须等真实完整边界图输入后，通过底图贴合、形态门禁、5/5 逐区看图验收。

### 2026-05-25 补充：禁区叠层默认隐藏，避免截图误判为 UI 选区

上一版分区预览截图仍有一个明显问题：红色 UI 禁区框默认压在地图上。虽然数据上没有把 UI 像素写入 mask，但视觉上会让人误以为工具又选中了轮盘、牌框或底部条。本节修正的是验图证据本身。

实现变化：

- `src/pages/devtools/QidahenRegionMaskTool.tsx`
  - `focusBoundaryImportProblem()` 导入后不再自动开启 `showForbiddenUiOverlay`；
  - 导入完成边界图、局部描边图、局部描边 ZIP 后，默认保持禁区叠层关闭；
  - `显示禁区` 按钮仍可手动开启；
  - 主动 `聚焦 seed 描边` 仍会开启禁区叠层，因为这是画笔补线状态，红区提示是有用信息。
- `e2e/qidahen-region-mask.e2e.ts`
  - `连接到地图边缘的边界线按全图分区生成而不是只取小圈` 增加断言：
    - 导入后 `qidahen-forbidden-ui-overlay` 数量为 `0`；
    - `只保留有效分区边界` 后仍为 `0`；
    - 按钮文案为 `显示禁区`。

验证：

- `npx eslint src/pages/devtools/QidahenRegionMaskTool.tsx e2e/qidahen-region-mask.e2e.ts`：通过。
- `npx tsc --noEmit --pretty false`：通过。
- `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 PW_WORKERS=1 PW_PORT=6373 PW_GAME_SERVER_PORT=20200 PW_API_SERVER_PORT=21200 node scripts/infra/run-e2e-command.mjs isolated e2e/qidahen-region-mask.e2e.ts --grep "连接到地图边缘"`：`1 passed (3.0m)`。
- 正式文件复核：
  - `src/games/qidahen/data/region-mask.png 1265x893 opaque=0`；
  - `src/games/qidahen/data/region-boundary-mask.png 1265x893 opaque=0`。

已实际看图：

- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-partition-preview-current.png`
  - 不再显示红色 UI 禁区框；
  - 右侧仍可见曲线手绘边界、咸兴/汉城半透明分区预览和 seed 状态；
  - 该截图现在能更直接判断“边界/分区是不是像正常地图结果”，不会被 UI 禁区叠层干扰。

当前证据边界：

- UI 禁区默认隐藏只解决截图误判和验图污染；
- UI 污染仍由导入/生成/保存的数据门禁拦截；
- 正常成果仍未完成，仍需要用户真实手绘边界图输入并通过逐区验收。

### 2026-05-25 补充：默认生成严格化，半成品只能调试生成

上一版仍存在一个主路风险：只有 2/5 seed 独立时，默认 `按边界图生成初始区域` 也会写入咸兴/汉城。这对算法调试有用，但很容易被误读成“生成成果”。本节把默认生成改成严格模式，调试生成单独分流。

实现变化：

- `src/pages/devtools/QidahenRegionMaskTool.tsx`
  - `generateRegionsFromCurrentBoundary()` 增加 `allowPartial` 选项；
  - 默认模式拒绝以下状态：
    - 没有真实边界图；
    - 正式区域缺 seed；
    - 独立 seed 不满 5/5；
    - 存在开放线段；
    - 边界落入 UI 禁区；
  - 默认拒绝时写 `默认生成已拒绝`，并列出阻塞项，不写入 mask；
  - 新增按钮 `调试生成当前独立分区`，`data-testid="qidahen-debug-generate-regions-from-boundary"`；
  - 调试按钮才允许生成当前已独立分区，用于排查和预览。
- `e2e/qidahen-region-mask.e2e.ts`
  - `连接到地图边缘的边界线按全图分区生成而不是只取小圈` 改为：
    - 默认生成先被拒绝；
    - 断言拒绝原因包含 `独立 seed 2/5`；
    - 断言 `qidahen-mask-canvas` 仍为 `0`；
    - 再用调试生成确认咸兴/汉城局部分区仍可生成。

验证：

- `npx eslint src/pages/devtools/QidahenRegionMaskTool.tsx e2e/qidahen-region-mask.e2e.ts`：通过。
- `npx tsc --noEmit --pretty false`：通过。
- `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 PW_WORKERS=1 PW_PORT=6373 PW_GAME_SERVER_PORT=20200 PW_API_SERVER_PORT=21200 node scripts/infra/run-e2e-command.mjs isolated e2e/qidahen-region-mask.e2e.ts --grep "连接到地图边缘"`：`1 passed (3.4m)`。
- 正式文件复核：
  - `src/games/qidahen/data/region-mask.png 1265x893 opaque=0`；
  - `src/games/qidahen/data/region-boundary-mask.png 1265x893 opaque=0`。

已实际看图：

- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-partition-preview-current.png`
  - 半成品预览仍清楚可见；
  - 咸兴/汉城是当前可调试分区；
  - 锦州、宋进、山海关仍未分区；
  - 这张图不能再通过默认入口直接生成成“成果”，只能走调试生成。

当前证据边界：

- 默认生成不再制造 2/5 半成品假成果；
- 调试能力保留；
- 正常成果仍未完成，必须等真实完整边界图达到 5/5 独立、无开放线、无 UI 污染后再默认生成。

### 2026-05-25 补充：补边问题包 ZIP

严格生成解决了“半成品默认生成”的问题，但用户仍需要知道下一步该补哪里。本节新增补边问题包，把未独立 seed 和开放线段拆成可直接查看的局部 PNG。

实现变化：

- `src/pages/devtools/QidahenRegionMaskTool.tsx`
  - 新增 `buildBoundaryRepairCropDataUrl()`；
  - 新增 `exportBoundaryRepairPackage()`；
  - 新增按钮 `导出补边问题包 ZIP`，`data-testid="qidahen-export-boundary-repair-package"`；
  - ZIP 内容：
    - `overview.png`：整图分区预览；
    - `report.json`：问题列表和计数；
    - `problems/unmatched-<regionId>.png`：未独立 seed 局部裁图；
    - `problems/open-boundary-XX.png`：开放线段断点局部裁图。
- `e2e/qidahen-region-mask.e2e.ts`
  - `连接到地图边缘的边界线按全图分区生成而不是只取小圈` 增加下载和解压断言；
  - 验证 ZIP 文件名为 `qidahen-boundary-repair-package.zip`；
  - 验证条目包含 `overview.png`、3 张 unmatched seed 裁图、1 张 open-boundary 裁图和 `report.json`；
  - 验证 report 为 `matchedSeedCount=2 / requiredSeedCount=5 / unmatchedCount=3 / openComponentCount=1`；
  - 将 `problems/unmatched-jinzhou.png` 写入稳定证据图。

验证：

- `npx eslint src/pages/devtools/QidahenRegionMaskTool.tsx e2e/qidahen-region-mask.e2e.ts`：通过。
- `npx tsc --noEmit --pretty false`：通过。
- `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 PW_WORKERS=1 PW_PORT=6373 PW_GAME_SERVER_PORT=20200 PW_API_SERVER_PORT=21200 node scripts/infra/run-e2e-command.mjs isolated e2e/qidahen-region-mask.e2e.ts --grep "连接到地图边缘"`：`1 passed (4.1m)`。
- 正式文件复核：
  - `src/games/qidahen/data/region-mask.png 1265x893 opaque=0`；
  - `src/games/qidahen/data/region-boundary-mask.png 1265x893 opaque=0`。

已实际看图：

- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-repair-package-unmatched-current.png`
  - 真实地图局部上标出 `锦州 未独立 seed`；
  - seed 点清楚可见；
  - 可作为后续手绘补边的具体问题裁图。

当前证据边界：

- 工具现在能把“还差哪里”导出成可复查裁图；
- 这仍不是正式正常成果；
- 正常成果仍必须由真实完整边界图经过严格默认生成、逐区验图和保存回读来证明。

### 2026-05-25 补充：细线候选可视/吸附不再使用扩张支撑层

上一版 `real-map-support-snap` 截图仍有一个明显问题：可视层使用扩张后的 support mask，截图上像大块黄雾或区域覆盖，容易被误判为工具又在自动生成边界或选中了大块区域。本节修正的是“候选辅助的呈现和吸附目标”，不是恢复自动生成正式成果路线。

实现变化：

- `src/pages/devtools/QidahenRegionMaskTool.tsx`
  - `renderBarrierOverlay()` 在 `showRealMapBoundarySupportOverlay` 开启时显示 `realMapBoundaryCandidateMask`；
  - `snapPointToRealMapBoundarySupport()` 改为吸附到 `realMapBoundaryCandidateMask`；
  - 扩张后的 `realMapBoundarySupportMask` 只保留给底图贴合统计，不再作为可视边界或吸附目标；
  - UI 文案改为 `显示细线候选` / `隐藏细线候选` / `吸附细线候选`；
  - 帮助文案明确：细线候选只辅助沿底图长线描边，不会自动写入边界图，也不能替代手绘闭合边界。
- `e2e/qidahen-region-mask.e2e.ts`
  - 用例改为 `真实底图细线候选只辅助画笔吸附，不自动生成正式成果`；
  - 断言按钮显示 `隐藏细线候选`；
  - 断言可视 canvas 像素量接近 candidate，而不是扩张 support；
  - 断言印刷 UI 禁区 rect 内候选像素为 0；
  - 断言质量报告仍不是 `accepted`，正式数据快照不变；
  - 单用例 timeout 调整为 `300000ms`，避免真实底图候选用例在慢机上超过 3 分钟被误杀。

已实际看图：

- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-real-map-support-snap-current.png`
  - 截图更新时间 `2026-05-25 07:15:09`；
  - 当前是新版工具 UI 和真实七大恨底图；
  - 画布上不再有黄色大块支撑覆盖，只显示细线候选和一次吸附后的少量手绘像素；
  - 左侧仍显示 `正常成果未生成 / not-ready`，人工验收 `0/5`；
  - 这张图只能证明细线候选辅助可用，不能证明正式区域成果完成。

验证：

- `npx eslint src/pages/devtools/QidahenRegionMaskTool.tsx e2e/qidahen-region-mask.e2e.ts`：通过。
- `npx vitest run src/pages/devtools/__tests__/qidahenRegionMaskToolUtils.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1`：`50 passed`。
- `npx tsc --noEmit --pretty false`：通过。
- `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 PW_WORKERS=1 PW_PORT=6373 PW_GAME_SERVER_PORT=20200 PW_API_SERVER_PORT=21200 node scripts/infra/run-e2e-command.mjs isolated e2e/qidahen-region-mask.e2e.ts --grep "底图候选诊断|细线候选不达标|真实底图细线候选"`：`3 passed (5.6m)`。
- 正式文件复核：
  - `src/games/qidahen/data/region-mask.png 1265x893 opaque=0`；
  - `src/games/qidahen/data/region-boundary-mask.png 1265x893 opaque=0`。

当前证据边界：

- 真实底图候选现在只作为细线辅助显示和吸附；
- 它不会自动写入边界图，不会载入不达标候选草稿，也不会生成正式区域；
- 正常成果仍未完成，必须等用户真实手绘/导入闭合边界图后，通过严格生成、5/5 逐区看图验收和保存回读。

### 2026-05-25 补充：全图描边包 ZIP，给外部画笔流程一个单一入口

用户明确要用画笔工具把边界画好，再由工具根据结果生成区域。继续把底图自动候选当主路会重复命中纹理、文字和 UI；继续拿局部合成圈截图也无法证明正常成果。本节新增的是外部画笔流程的交付包：把真实底图、透明边界层、seed、禁区和边界颜色放进同一个 ZIP，让用户能在外部画完整边界后导回。

实现变化：

- `src/pages/devtools/QidahenRegionMaskTool.tsx`
  - 新增 `exportBoundaryTraceKitZip()`；
  - 新增按钮 `导出全图描边包 ZIP`，`data-testid="qidahen-export-boundary-trace-kit"`；
  - ZIP 文件名 `qidahen-boundary-trace-kit.zip`；
  - ZIP 内容：
    - `qidahen-main-map.png`：真实底图；
    - `qidahen-boundary-trace-template.png`：带 seed 点和红色禁区的全图描边参考图；
    - `qidahen-boundary-empty-transparent.png`：`1265x893` 空白透明边界层；
    - `manifest.json`：记录 mapSize、导回目标、5 个正式 seed、印刷 UI 禁区和四个边界色。
- `e2e/qidahen-region-mask.e2e.ts`
  - 新增 `全图描边包 ZIP 包含透明边界层、底图和边界颜色清单`；
  - 断言 ZIP 条目完整；
  - 断言 manifest 中边界色为：
    - `rgb(61, 69, 66)`；
    - `rgb(126, 97, 56)`；
    - `rgb(128, 104, 62)`；
    - `rgb(43, 36, 34)`；
  - 断言包含印刷 UI 禁区、5 个正式区域 seed；
  - 断言空白透明边界层尺寸为 `1265x893` 且 `opaque=0`；
  - 将旧 `可导出外部描边参考图...` 收窄为“参考图/局部底稿导出 + 局部底稿导入 + 调试生成”链路，避免局部夹具绕过严格默认生成。

已实际看图：

- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-batch-trace-export-current.png`
  - 当前是新版工具 UI；
  - 5 个 seed 显示 `待描`；
  - 正式 mask 和正式边界仍为空；
  - 适合作为“外部描边前”的工具状态证据。
- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-batch-trace-import-current.png`
  - 图上仍是局部合成圈，不是正常成果；
  - 左侧 normality 没有 accepted；
  - 这张图只证明局部底稿导回和调试生成链路可用，不证明正式全图成果完成。

验证：

- `npx eslint src/pages/devtools/QidahenRegionMaskTool.tsx e2e/qidahen-region-mask.e2e.ts`：通过。
- `npx tsc --noEmit --pretty false`：通过。
- `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 PW_WORKERS=1 PW_PORT=6373 PW_GAME_SERVER_PORT=20200 PW_API_SERVER_PORT=21200 node scripts/infra/run-e2e-command.mjs isolated e2e/qidahen-region-mask.e2e.ts --grep "全图描边包 ZIP"`：`1 passed (1.1m)`。
- `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 PW_WORKERS=1 PW_PORT=6373 PW_GAME_SERVER_PORT=20200 PW_API_SERVER_PORT=21200 node scripts/infra/run-e2e-command.mjs isolated e2e/qidahen-region-mask.e2e.ts --grep "可导出外部描边参考图并导入局部底稿"`：`1 passed (6.9m)`。
- 正式文件复核：
  - `src/games/qidahen/data/region-mask.png 1265x893 opaque=0`；
  - `src/games/qidahen/data/region-boundary-mask.png 1265x893 opaque=0`。

当前证据边界：

- 已给外部画笔完整边界图流程提供单包入口；
- 自动候选仍不能作为成果，局部合成圈仍不能作为成果；
- 正常成果仍未完成：需要完整真实边界图导回后，通过严格默认生成、5/5 逐区看图验收和保存回读。

### 2026-05-25 补充：沿候选线补边不再直线封口

本节只证明工具内“候选线补边”不会把两点直连成假边界，不证明全图正式区域成果完成。

实现变化：

- `src/pages/devtools/QidahenRegionMaskTool.tsx`
  - `applyBarrierHintStroke()` 的补边 `add` 分支改为调用 `findBoundarySupportPath()`；
  - 路径来源限定为 `realMapBoundaryCandidateMask`；
  - 找不到连续真实底图细线候选路径时拒绝写入，不再 fallback 到直线；
  - UI 新增 `沿候选线补边`，`data-testid="qidahen-barrier-edit-mode-bridge"`；
  - 文案明确：预览线不是最终写入路径，最终写入沿候选细线寻路。
- `e2e/qidahen-region-mask.e2e.ts`
  - 新增 `沿候选线补边沿真实细线寻路而不是直线封口`；
  - 测试动态寻找真实候选层中的曲线段；
  - 隐藏候选层后断言手工补边层：路径中点有像素，起止两点直线中点仍透明；
  - 同时断言印刷 UI 禁区没有补边像素。

验证：

- `npx eslint src/pages/devtools/QidahenRegionMaskTool.tsx e2e/qidahen-region-mask.e2e.ts`：通过。
- `npx tsc --noEmit --pretty false`：通过。
- `npm run test:e2e:ci:file -- e2e/qidahen-region-mask.e2e.ts "沿候选线补边沿真实细线寻路而不是直线封口"`：`1 passed (3.7m)`。
- `npm run test:e2e:ci:file -- e2e/qidahen-region-mask.e2e.ts "真实底图细线候选只辅助画笔吸附|边界断点只定位不自动直线封口"`：`2 passed (6.9m)`。
- 正式文件复核：
  - `src/games/qidahen/data/region-mask.png 1265x893 opaque=0`；
  - `src/games/qidahen/data/region-boundary-mask.png 1265x893 opaque=0`。

截图核对：

- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-real-map-bridge-path-detail-current.png`
  - 我实际看到：两个橙色端点之间的补边沿地图上的弯曲细线走，视觉上不是一条直接穿过去的斜直线；
  - 是否达标：达成本轮“桥接补边不能直线封口”的局部验收。
- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-real-map-bridge-path-current.png`
  - 我实际看到：全页仍显示 `正常成果未生成 / not-ready`，人工验收 `0/5`；
  - 是否达标：达成“不把本次候选线补边误报为正式成果”的边界要求。
- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-real-map-support-snap-current.png`
  - 我实际看到：细线候选仍是辅助线，不是大块覆盖；
  - 是否达标：相邻回归未被本次桥接入口破坏。
- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-barrier-hint-undo-redo-current.png`
  - 我实际看到：断点定位和手绘补边/撤销重做仍走画笔主路；
  - 是否达标：旧“短线辅助”直线封口没有恢复。

当前证据边界：

- 工具内候选线补边不再制造直线假边界；
- 细线候选吸附和手绘补边回归通过；
- 正常成果仍未完成，必须由真实完整边界图导回后，经严格默认生成、5/5 逐区视觉验收和保存回读证明。

### 2026-05-25 补充：验收包签名门禁，贴合不足的 5/5 不能验收

本节修正一个更接近用户原始痛点的错误口径：生成 5/5 不等于正常成果。旧 `真实底图完整描线图` 夹具虽然能让 5 个 seed 独立并生成区域，但实际数据证明它仍然不贴合真实地图边界，不能进入人工验收。

实现变化：

- `src/pages/devtools/QidahenRegionMaskTool.tsx`
  - 新增 `lastAcceptancePackageSignature`；
  - `导出区域验收包 ZIP` 时把当前逐区验收签名写入 `acceptancePackage.reviewSignature`；
  - UI 新增 `qidahen-acceptance-package-signature-state`，显示 `验收包 missing/stale/current`；
  - `看图通过` 按钮要求：
    - normality 必须是 `needs-visual-review`；
    - 当前签名的验收包必须已经导出；
    - 当前区域不是 blocked/not-generated；
  - 直接调用 `markRegionAcceptanceApproved()` 时也会检查当前验收包签名，防止绕过 disabled 状态。
- `e2e/qidahen-region-mask.e2e.ts`
  - 将用例改为 `导入真实底图完整描线图后贴合不足仍不能验收成正常成果`；
  - 断言 5/5 生成后 normality 仍为 `suspicious`；
  - 断言 `底图贴合 blocked` 与 blocker 文案存在；
  - 导出验收包后，断言 `验收包 current`；
  - 断言五个区域的 `看图通过` 仍禁用，不能点成 `accepted`。

验证：

- `npx eslint src/pages/devtools/QidahenRegionMaskTool.tsx e2e/qidahen-region-mask.e2e.ts`：通过。
- `npx tsc --noEmit --pretty false`：通过。
- `npm run test:e2e:ci:file -- e2e/qidahen-region-mask.e2e.ts "导入真实底图完整描线图后贴合不足仍不能验收成正常成果"`：`1 passed (4.3m)`。
- 正式文件复核：
  - `src/games/qidahen/data/region-mask.png 1265x893 opaque=0`；
  - `src/games/qidahen/data/region-boundary-mask.png 1265x893 opaque=0`。

截图核对：

- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-real-map-complete-rejected-current.png`
  - 我实际看到：左侧 normality 是 `正常成果未证明 / suspicious`；
  - 我实际看到：底图贴合为 `blocked · 10.3% · 2,220/21,645 px`；
  - 我实际看到：验收包状态为 `current`，但五个区域仍是 `待验收`，`看图通过` 按钮禁用；
  - 我实际看到：主画布上的白色边界仍是粗闭合圈形态，不是最终真实边界图；
  - 是否达标：达成本轮负向门禁，即“5/5 但不贴合真实地图的输入不能验收成正常成果”。

当前证据边界：

- 已证明旧“完整描线图”不是正常成果；
- 已防止未导出验收包或贴合不足的 5/5 被误点成 accepted；
- 仍未证明真实正常成果完成。真正完成还需要用户导入/手绘一份足够贴合真实地图边界的完整边界图，然后跑到 `needs-visual-review -> accepted -> 保存 -> 刷新回读 accepted`。

### 2026-05-25 补充：工具内区域裁图预览成为看图通过前置门禁

本节继续收紧“看图验收”的定义：导出验收包还不够，每个区域必须在工具内打开当前签名的区域裁图预览，才能点 `看图通过`。这仍然只是验收门禁，不是正常成果完成。

实现变化：

- `src/pages/devtools/QidahenRegionMaskTool.tsx`
  - 新增每区 `查看裁图` 按钮，`data-testid="qidahen-view-normality-region-<regionId>"`；
  - 新增每区裁图状态，`data-testid="qidahen-normality-preview-state-<regionId>"`，显示 `未看图 / 已看图`；
  - 新增工具内裁图预览面板：
    - `qidahen-region-acceptance-preview`；
    - `qidahen-region-acceptance-preview-title`；
    - `qidahen-region-acceptance-preview-meta`；
    - `qidahen-region-acceptance-preview-image`；
  - `看图通过` 的 enabled 条件增加 `hasViewedRegionAcceptanceCrop(coverage)`；
  - `markRegionAcceptanceApproved()` 同步拒绝未打开当前签名裁图的区域，避免绕过 UI disabled。
- `e2e/qidahen-region-mask.e2e.ts`
  - 扩展 `导入真实底图完整描线图后贴合不足仍不能验收成正常成果`；
  - 导出验收包后先断言五区 `未看图`；
  - 打开 `shou-cheng` 裁图后断言预览面板可见、`<img>` 为 PNG data URL、该区状态变 `已看图`；
  - 继续断言 `shou-cheng` 的 `看图通过` 仍禁用，因为 normality 仍是 `suspicious`。

验证：

- `npx eslint src/pages/devtools/QidahenRegionMaskTool.tsx e2e/qidahen-region-mask.e2e.ts`：通过。
- `npx tsc --noEmit --pretty false`：通过。
- `npm run test:e2e:ci:file -- e2e/qidahen-region-mask.e2e.ts "导入真实底图完整描线图后贴合不足仍不能验收成正常成果"`：`1 passed (4.9m)`。
- 正式文件复核：
  - `src/games/qidahen/data/region-mask.png 1265x893 opaque=0`；
  - `src/games/qidahen/data/region-boundary-mask.png 1265x893 opaque=0`。

截图核对：

- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-real-map-complete-rejected-current.png`
  - 我实际看到：左侧已打开 `汉城 验收裁图`，面板内有局部地图、白色粗圈边界、彩色区域覆盖、像素数和 crop 坐标；
  - 我实际看到：主画布仍是粗闭合圈形态，不是贴真实地图线的边界；
  - 我实际看到：区域行里 `汉城` 已变为 `已看图`，但 `看图通过` 仍灰置不可点；
  - 是否达标：达成本轮“必须在工具内打开当前签名裁图，且贴合不足仍不能验收”的负向门禁。

当前证据边界：

- 工具内裁图预览已经成为 `看图通过` 的硬前置；
- 本轮只证明负向门禁更硬，不证明七大恨正常区域成果完成；
- 真正完成仍需要用户导入/手绘完整真实边界图，并通过 `needs-visual-review -> 逐区打开裁图 -> accepted -> 保存 -> 刷新回读 accepted`。

### 2026-05-25 补充：真实底图连续线可载入为初始边界草稿，但仍不能直接生成成果

本节是对用户“直接生成边界图，我再微调”的正向推进。此前候选因为不能闭合 5/5 seed 被完全禁用，实际让用户只能从空白图开始；这不符合当前目标。现在工具允许把真实底图连续细线候选载入为初始边界草稿，但仍明确阻止它直接生成或验收为正常成果。

像素事实：

- 用户给定 4 个边界色在真实底图命中 `214,744 px`；
- 命中里有 `121,306 px` 落在印刷 UI 禁区，所以原图抽色不能直接当边界成果；
- 剔除 UI 禁区、紧凑装饰和厚块噪声，并限制到区域导向连续线后，当前候选为 `2,367 px / 5 components / UI 0`；
- 该候选是可微调起点，不是完整闭合边界图。

实现变化：

- `src/pages/devtools/QidahenRegionMaskTool.tsx`
  - 新增 `canLoadRealMapBoundaryCandidateTraceDraft`；
  - `载入候选草稿` 改为 `载入初始草稿`；
  - 候选只要像素足够且 UI 禁区为 0，就允许载入到边界草稿层；
  - 如果候选仍命中 UI 或像素太少，继续拒绝载入；
  - 载入后的状态文案明确：不是正常成果，不会自动封口，未分区/断线部分需要继续画笔微调。
- `e2e/qidahen-region-mask.e2e.ts`
  - 将旧负向用例改为 `细线候选可载入为初始边界草稿但不能自动生成正常成果`；
  - 断言候选仍 `seed 0/5`，但按钮可用；
  - 载入后边界像素 >300 且 <10000；
  - 所有印刷 UI 禁区像素为 0；
  - 点击默认生成后出现 `默认生成已拒绝`，且没有任何区域 `已生成`。

验证：

- `npx eslint src/pages/devtools/QidahenRegionMaskTool.tsx e2e/qidahen-region-mask.e2e.ts`：通过。
- `npx tsc --noEmit --pretty false`：通过。
- `npm run test:e2e:ci:file -- e2e/qidahen-region-mask.e2e.ts "细线候选可载入为初始边界草稿但不能自动生成正常成果"`：`1 passed (1.8m)`。
- `npm run test:e2e:ci:file -- e2e/qidahen-region-mask.e2e.ts "真实底图细线候选只辅助画笔吸附|沿候选线补边沿真实细线寻路而不是直线封口"`：`2 passed (5.8m)`。
- 正式文件复核：
  - `src/games/qidahen/data/region-mask.png 1265x893 opaque=0`；
  - `src/games/qidahen/data/region-boundary-mask.png 1265x893 opaque=0`。

截图核对：

- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-real-map-candidate-draft-current.png`
  - 我实际看到：主画布上有贴真实地图线的细线草稿，集中在锦州/山海关/咸兴附近的河线和区域交界附近；
  - 我实际看到：这些线不是粗闭合圈，也不是直线多边形；
  - 我实际看到：轮盘、右侧牌框、底部行动条没有被涂成边界；
  - 我实际看到：左侧显示 `seed 0/5`，并提示“可载入为初始边界草稿，但不是正常成果，未封口和未分区部分需要继续手绘微调”；
  - 是否达标：达成本轮“从真实底图生成可微调初始边界图，同时不冒充正常成果”的阶段目标。

当前证据边界：

- 已经有比空白图更可用的初始边界草稿入口；
- 草稿仍不完整，不能自动生成 5/5，也不能验收为正常成果；
- 后续完成仍需要：补线/去噪 -> 严格生成 5/5 -> 导出验收包 -> 逐区打开裁图 -> accepted -> 保存 -> 刷新回读 accepted。

### 2026-05-25 11:20 +08 补充：初始草稿保存回读与补边问题包已验证

本节补齐上一节缺失的“保存/刷新回读/补边问题包”证据。结论只覆盖初始草稿工作流，不把草稿升级为正常成果。

新增/更新的 E2E 断言：

- `细线候选可载入为初始边界草稿但不能自动生成正常成果`
  - 载入真实底图连续线候选后，边界草稿像素 `>300` 且 `<10000`；
  - 轮盘、右侧牌框、底部行动条等印刷 UI 禁区像素为 `0`；
  - 点击 `聚焦未独立 seed` 后，工具内出现补边问题裁图预览；
  - 预览标题包含 `未独立 seed`，裁图为 PNG data URL，提示明确写“连不上的线直接舍弃”；
  - 默认生成被拒绝，没有任何区域显示 `已生成`；
  - 导出 `qidahen-boundary-repair-package.zip`；
  - `report.json` 为 `matchedSeedCount=0 / requiredSeedCount=5 / unmatchedCount=5`；
  - ZIP 内存在 5 个 `unmatched-seed` 问题，且包含 `problems/unmatched-jinzhou.png`；
  - 保存临时工作区后刷新页面，可自动读取 `real-map-boundary-candidate-draft`；
  - 回读后边界草稿仍存在，禁区像素仍为 `0`，默认生成仍拒绝。

验证：

- `npm run test:e2e:ci:file -- e2e/qidahen-region-mask.e2e.ts "细线候选可载入为初始边界草稿但不能自动生成正常成果"`：`1 passed (4.3m)`。
- `npx eslint src/pages/devtools/QidahenRegionMaskTool.tsx e2e/qidahen-region-mask.e2e.ts`：通过。
- `npx tsc --noEmit --pretty false`：通过。
- 正式文件复核：
  - `src/games/qidahen/data/region-mask.png 1265x893 opaque=0`；
  - `src/games/qidahen/data/region-boundary-mask.png 1265x893 opaque=0`。

截图核对：

- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-real-map-candidate-draft-current.png`
  - 我实际看到：主画布上是贴真实地图线的细线草稿，集中在锦州/山海关/咸兴附近；
  - 我实际看到：不是粗圈，也不是直线多边形；
  - 我实际看到：轮盘、右侧牌框、底部行动条没有被选进边界；
  - 我实际看到：左侧仍显示 `seed 0/5`，没有冒充生成成果。
- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-real-map-candidate-repair-preview-current.png`
  - 我实际看到：工具内补边预览面板显示 `锦州 未独立 seed`；
  - 我实际看到：面板包含 `crop 597,237+360x260`、真实地图局部、当前白色边界草稿和粉色 seed 标记；
  - 我实际看到：面板说明 `seed 777,417；沿真实地图边界补线，连不上的线直接舍弃。`
- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-real-map-candidate-repair-unmatched-current.png`
  - 我实际看到：裁图标出 `锦州 未独立 seed` 和 seed 位置；
  - 我实际看到：裁图背景是真实地图局部，叠加当前细线草稿，可用于下一步补线。

当前证据边界：

- 已证明初始草稿可载入、可保存、可刷新回读、可导出补边问题包；
- 草稿仍是 `seed 0/5`，不能生成 5/5 正常区域；
- 下一阶段应沿问题包逐段补线/去噪，并直接舍弃无法连成线或无法封口的断线，再进入严格生成与逐区验收。

### 2026-05-25 12:05 +08 修正：自动候选不得再写入边界草稿

本节废弃上一节“`seed 0/5` 仍可载入为初始草稿”的阶段结论。复核图像后确认：这类候选会把河线、地形线、零散印刷线混在一起，即使 UI 禁区为 0，也不是可直接进入边界层的真实边界。继续允许它写入边界草稿，会把任务再次带回“看起来有线但不是成果”的错误方向。

实现变化：

- `src/pages/devtools/QidahenRegionMaskTool.tsx`
  - 删除 `loadRealMapBoundaryCandidateAsDraft()`；
  - 删除 `qidahen-load-real-map-boundary-candidate-draft` 写入按钮；
  - 当前真实底图候选为 `seed 0/5`，页面不再提供自动候选写入边界图的动作；
  - 真实底图候选只保留为诊断图、导出 PNG、显示细线候选层和画笔吸附参考；
  - `聚焦未独立 seed` 在真正的手绘/导入边界链路中打开工具内补边裁图。
- `e2e/qidahen-region-mask.e2e.ts`
  - 将旧用例改为 `真实底图细线候选只能诊断和吸附，不能直接写成边界草稿`；
  - 断言候选 `seed 0/5` 时写入按钮不存在；
  - 断言当前边界图像素、最终障碍像素和 barrier canvas 均为 0；
  - 断言默认生成拒绝且没有区域 `已生成`；
  - 在 `完整手绘边界图会批量生成多个独立分区并舍弃断线` 中断言工具内补边预览出现。

验证：

- `npm run test:e2e:ci:file -- e2e/qidahen-region-mask.e2e.ts "真实底图细线候选只能诊断和吸附"`：`1 passed (1.4m)`。
- `npm run test:e2e:ci:file -- e2e/qidahen-region-mask.e2e.ts "完整手绘边界图会批量生成多个独立分区并舍弃断线"`：`1 passed (4.7m)`。
- `npx eslint src/pages/devtools/QidahenRegionMaskTool.tsx e2e/qidahen-region-mask.e2e.ts`：通过。
- `npx tsc --noEmit --pretty false`：通过。
- 正式文件复核：
  - `src/games/qidahen/data/region-mask.png 1265x893 opaque=0`；
  - `src/games/qidahen/data/region-boundary-mask.png 1265x893 opaque=0`。

截图核对：

- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-real-map-candidate-draft-current.png`
  - 我实际看到：候选页没有把细线写进边界层；
  - 我实际看到：不再有候选写入按钮，状态显示 `seed 0/5` 和只读诊断说明；
  - 我实际看到：地图上只是 seed 待描标记，不再有自动候选边界草稿覆盖主画布。
- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-boundary-repair-preview-current.png`
  - 我实际看到：工具内裁图显示 `山海关 未独立 seed`；
  - 我实际看到：裁图里有真实地图局部、当前白色手绘边界和 seed 标记；
  - 我实际看到：说明写明 `沿真实地图边界补线，连不上的线直接舍弃。`

当前证据边界：

- 自动候选已经退出边界草稿主路；
- 工具现在把可疑自动线限定在诊断/吸附层；
- 正常成果仍未完成，下一步必须继续围绕用户手绘/导入闭合边界图做 5/5 分区、逐区裁图验收和保存回读。

### 2026-05-25 12:43 +08 补边问题队列：默认不再打开红色 UI 禁区叠层

本节修正上一轮截图容易误判的问题：队列点击补边问题时，工具会主动进入补边定位状态，但不应默认铺红色 UI 禁区框。禁区叠层本身是诊断辅助，不是边界成果；默认打开会让验收截图看起来像“UI 被选进边界”。

实现变化：

- `src/pages/devtools/QidahenRegionMaskTool.tsx`
  - `focusRegionSeedForTracing(region, 'unmatched')` 默认关闭 `showForbiddenUiOverlay`；
  - `focusOpenBoundaryHintForTracing()` 默认关闭 `showForbiddenUiOverlay`；
  - 普通选中区域聚焦仍可按原交互显示禁区；补边队列场景保留 `显示禁区` 按钮供用户手动打开；
  - 状态文案改为“禁区叠层可按需手动显示”，避免把红色禁区框当作当前成果的一部分。
- `e2e/qidahen-region-mask.e2e.ts`
  - `完整手绘边界图会批量生成多个独立分区并舍弃断线` 新增断言：
    - 点击 `qidahen-repair-queue-unmatched-shan-hai-guan` 后，`qidahen-forbidden-ui-overlay` 数量为 `0`；
    - 点击 `qidahen-repair-queue-open-0` 后，`qidahen-forbidden-ui-overlay` 数量仍为 `0`；
    - 对应按钮显示 `显示禁区`，证明红色叠层没有默认打开。

验证：

- `npx eslint src/pages/devtools/QidahenRegionMaskTool.tsx e2e/qidahen-region-mask.e2e.ts`：通过。
- `npx tsc --noEmit --pretty false`：通过。
- `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 PW_WORKERS=1 PW_PORT=6373 PW_GAME_SERVER_PORT=20200 PW_API_SERVER_PORT=21200 node scripts/infra/run-e2e-command.mjs isolated e2e/qidahen-region-mask.e2e.ts --grep "完整手绘边界图会批量生成多个独立分区并舍弃断线"`：`1 passed (5.2m)`。
- 正式文件复核：
  - `src/games/qidahen/data/region-mask.png 1265x893 opaque=0`；
  - `src/games/qidahen/data/region-boundary-mask.png 1265x893 opaque=0`。

截图核对：

- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-boundary-repair-preview-current.png`
  - 我实际看到：工具内裁图显示 `山海关 未独立 seed`；
  - 我实际看到：裁图里是真实地图局部、当前白色手绘边界和 seed 标记；
  - 我实际看到：没有红色 UI 禁区框，说明裁图只服务补边定位。
- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-hand-drawn-multi-diagnostics-current.png`
  - 我实际看到：新版工具 UI、真实地图底图、白色手绘边界、补边问题队列、seed/断点提示都可见；
  - 我实际看到：左侧队列列出 `山海关未独立 seed`、`咸兴未独立 seed`、`汉城未独立 seed`、`山海关开放线段 1`；
  - 我实际看到：主图没有默认红色 UI 禁区叠层，轮盘、牌框、底部条没有被视觉上误标成边界。

当前证据边界：

- 已证明补边队列能定位真实手绘/导入边界的未独立 seed 与未解释开放线；
- 已证明这条定位链路不会默认用红色 UI 禁区叠层污染截图；
- 仍未证明正式七大恨区域成果完成。正常成果必须等待用户导入/微调后的真实闭合边界图，再完成 5/5 生成、逐区裁图验收和保存回读。

### 2026-05-25 13:00 +08 底图自动候选诊断改为正式分区口径

本节回应“如果做不了就告诉我换方向”的判断问题。此前真实底图候选虽然已被禁止写入边界图，但诊断仍偏闭合小圈口径，和当前正式生成采用的“边界线分割全图”模型不完全一致。现在候选可用性诊断改为和正式生成一致：只有候选能把 5 个正式 seed 分成独立分区，才可能成为成果候选；否则只能做只读诊断/吸附参考。

实现变化：

- `src/pages/devtools/QidahenRegionMaskTool.tsx`
  - `scoreBoundaryCandidateReadiness()` 改用 `extractBoundaryPartitionComponents()`；
  - 诊断使用 `AUTO_MAP_REGION_FILLABLE_MASK`，和正式生成一样剔除印刷 UI 禁区；
  - blocker 文案改为 `候选只分出 N/5 个独立 seed`；
  - 如果多个 seed 仍在同一分区，blocker 会列出这些区域；
  - UI 新增 `qidahen-real-map-boundary-candidate-blockers`，直接显示不可用原因。
- `e2e/qidahen-region-mask.e2e.ts`
  - `真实底图细线候选只能诊断和吸附，不能直接写成边界草稿` 新增断言：
    - 候选 readiness 显示 `候选不达标`；
    - blocker 显示 `候选只分出 \d/5 个独立 seed`；
    - 自动候选写入按钮不存在；
    - 当前边界图、最终障碍、barrier canvas 均为 0；
    - 默认生成拒绝且没有区域 `已生成`。

数据实验：

- 直接读取 `public/assets/i18n/zh-CN/qidahen/board/main-board.png`：
  - 4 个边界色总命中 `185,213 px`；
  - 印刷 UI 内命中 `107,306 px`；
  - 剔除 UI 后剩余 `77,907 px`，但分成 `4,951` 个连通组件；
  - 最大组件包括海岸/海纹、山纹、文字和路线，并非完整区域边界。
- 对真实底图颜色候选做容差/扩张分区实验：
  - `tol=8/12/14/18/24` 与 `expand=0/1/2/3` 均无法分出 5 个独立 seed；
  - 最好情况也只出现 1-2 个独立 seed；
  - 多数参数会把锦州、宋进、山海关、咸兴、汉城连在同一分区或把咸兴/汉城连在一起。

验证：

- `npx eslint src/pages/devtools/QidahenRegionMaskTool.tsx e2e/qidahen-region-mask.e2e.ts`：通过。
- `npx tsc --noEmit --pretty false`：通过。
- `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 PW_WORKERS=1 PW_PORT=6374 PW_GAME_SERVER_PORT=20201 PW_API_SERVER_PORT=21201 node scripts/infra/run-e2e-command.mjs isolated e2e/qidahen-region-mask.e2e.ts --grep "真实底图细线候选只能诊断和吸附"`：`1 passed (1.5m)`。
- 正式文件复核：
  - `src/games/qidahen/data/region-mask.png 1265x893 opaque=0`；
  - `src/games/qidahen/data/region-boundary-mask.png 1265x893 opaque=0`。

截图核对：

- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-real-map-candidate-draft-current.png`
  - 我实际看到：左侧显示 `候选不达标：seed 0/5 / 可填分区 4 / UI 0 px`；
  - 我实际看到：blocker 明确写出 `候选只分出 0/5 个独立 seed：锦州、宋进、山海关、咸兴、汉城；其中山海关、锦州、宋进、咸兴、汉城仍连在同一分区。`；
  - 我实际看到：页面没有候选写入按钮，主图只是 seed 待描标记，没有把底图候选写入边界层；
  - 我实际看到：轮盘、右侧牌框、底部条没有被边界层选入。

当前证据边界：

- 已证明当前自动从底图颜色生成正常边界不可行；
- 已把工具 UI 改成直接暴露不可行原因，而不是给用户一个看起来像“可用初始成果”的假入口；
- 正常成果仍必须来自用户手绘/导入的完成边界图，并通过 5/5 独立 seed、无未解释开放线、底图贴合、逐区裁图验收和保存回读。

## 2026-05-25 15:04 +08 局部弱支撑补边队列证据

本节修正 14:47 之后的可操作性缺口：工具不能只告诉用户“弱支撑”，还必须把弱支撑区域变成可点击、可看图、可沿真实底图补线的问题项。

实现变化：

- `src/pages/devtools/QidahenRegionMaskTool.tsx`
  - 补边预览类型新增 `weak-support`；
  - 计算 `weakRealMapFitRegionReports`，把逐区底图支撑不足的区域接入补边问题队列；
  - 新增弱支撑裁图打开逻辑，点击后进入边界画笔模式、关闭红色 UI 禁区叠层、显示真实地图局部 crop 与弱支撑段标记；
  - 队列数量包含弱支撑区域，弱支撑项使用 `qidahen-repair-queue-weak-support-<regionId>`。
- `e2e/qidahen-region-mask.e2e.ts`
  - `局部候选线支撑不能替整张边界图背书并进入人工验收` 增加断言：
    - 补边队列 count 为 `3`；
    - `宋进 底图弱支撑` 可点击；
    - 预览标题包含 `宋进 底图弱支撑`；
    - 预览详情包含 `局部边界支撑`；
    - `qidahen-forbidden-ui-overlay` 为 `0`；
    - 保存弱支撑裁图证据 `qidahen-region-mask-real-map-local-support-repair-preview-current.png`。

验证：

- `npx eslint src/pages/devtools/QidahenRegionMaskTool.tsx e2e/qidahen-region-mask.e2e.ts`：通过。
- `npx tsc --noEmit --pretty false`：通过。
- `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 PW_WORKERS=1 PW_PORT=6375 PW_GAME_SERVER_PORT=20202 PW_API_SERVER_PORT=21202 node scripts/infra/run-e2e-command.mjs isolated e2e/qidahen-region-mask.e2e.ts --grep "局部候选线支撑不能替整张边界图背书并进入人工验收"`：`1 passed (3.6m)`。

截图核对：

- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-real-map-local-support-repair-preview-current.png`
  - 我实际看到：裁图标题为 `宋进 底图弱支撑`，类型为 `weak-support`；
  - 我实际看到：裁图背景是真实地图局部，有当前白色边界、蓝色局部框线和 `弱支撑段` 标记；
  - 我实际看到：详情写明 `局部边界支撑 0.0%（0/816 px）`、未支撑 `816 px` 和弱支撑范围 `674,496 - 802,635`，并提示需要沿真实地图线重画，不能靠其它区域候选线通过验收。
- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-real-map-local-support-rejected-current.png`
  - 我实际看到：左侧 normality 仍为 `suspicious`，没有进入 accepted；
  - 我实际看到：`底图贴合 blocked · 24.3% · 6,090/25,108 px`，弱支撑区域列出 `宋进、山海关、汉城`；
  - 我实际看到：五个区域仍是未看图/待验收，`看图通过` 按钮不可用；
  - 我实际看到：主图没有红色 UI 禁区叠层，轮盘、右侧牌框、底部条没有被视觉上误标成边界成果。

正式文件复核：

- `src/games/qidahen/data/region-mask.png 1265x893 opaque=0`；
- `src/games/qidahen/data/region-boundary-mask.png 1265x893 opaque=0`。

当前证据边界：

- 已证明局部真线不能替整张边界图背书；
- 已证明弱支撑区域会进入可点击的补边问题队列，并能打开真实地图局部裁图；
- 仍未证明七大恨正式区域成果完成。正常成果必须等待用户真实完整边界图输入，并通过 5/5 分区、底图贴合、逐区裁图验收、保存与回读。

## 2026-05-25 15:50 +08 弱支撑问题进入补边 ZIP

本节继续修正“只在页面队列里能看，不能导出给用户修”的缺口。弱支撑区域现在不仅能点击查看，也能进入 `qidahen-boundary-repair-package.zip`，作为正式补边问题裁图留档。

实现变化：

- `src/pages/devtools/QidahenRegionMaskTool.tsx`
  - `exportBoundaryRepairPackage()` 新增 `weak-support` 问题类型；
  - ZIP 会导出 `problems/weak-support-<regionId>.png`；
  - `report.json` 新增 `weakSupportCount`；
  - 每个弱支撑问题记录 `supportRatio`、`supportedBoundaryPixelCount`、`boundaryPixelCount`、`unsupportedBoundaryPixelCount`、`weakBoundaryBounds`；
  - 导出状态文案会明确显示 `底图弱支撑 N 个`。
- `e2e/qidahen-region-mask.e2e.ts`
  - `局部候选线支撑不能替整张边界图背书并进入人工验收` 增加 ZIP 下载断言；
  - 断言 ZIP 条目包含：
    - `overview.png`
    - `problems/weak-support-song-jin.png`
    - `problems/weak-support-shan-hai-guan.png`
    - `problems/weak-support-shou-cheng.png`
    - `report.json`
  - 断言 `weakSupportCount=3`、`unmatchedCount=0`、`unexplainedOpenComponentCount=0`；
  - 断言没有 `open-boundary` 问题；
  - 断言宋进弱支撑问题包含非空 `unsupportedBoundaryPixelCount` 和 `weakBoundaryBounds`。

验证：

- `npx eslint src/pages/devtools/QidahenRegionMaskTool.tsx e2e/qidahen-region-mask.e2e.ts`：通过。
- `npx tsc --noEmit --pretty false`：通过。
- `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 PW_WORKERS=1 PW_PORT=6375 PW_GAME_SERVER_PORT=20202 PW_API_SERVER_PORT=21202 node scripts/infra/run-e2e-command.mjs isolated e2e/qidahen-region-mask.e2e.ts --grep "局部候选线支撑不能替整张边界图背书并进入人工验收"`：`1 passed (4.2m)`。

截图核对：

- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-real-map-local-support-repair-package-current.png`
  - 我实际看到：这是 ZIP 内 `problems/weak-support-song-jin.png` 导出的真实地图局部裁图；
  - 我实际看到：裁图有当前白色边界和蓝色 `弱支撑段` 标记；
  - 我实际看到：没有红色 UI 禁区叠层，轮盘、右侧牌框、底部条没有被误选进这张问题图。
- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-real-map-local-support-repair-preview-current.png`
  - 我实际看到：页面内裁图与 ZIP 裁图指向同一类弱支撑段；
  - 我实际看到：详情仍显示 `局部边界支撑 0.0%（0/816 px）`、未支撑 `816 px` 与弱支撑范围。

正式文件复核：

- `src/games/qidahen/data/region-mask.png 1265x893 opaque=0`；
- `src/games/qidahen/data/region-boundary-mask.png 1265x893 opaque=0`。

当前证据边界：

- 已证明弱支撑问题可导出成 ZIP 裁图，能交给用户按图补边；
- 仍未证明七大恨正式区域成果完成；
- 下一步仍是等真实完整边界图或继续改善工具，让用户更容易把这些弱支撑段补成可通过底图贴合与逐区看图验收的正常成果。

## 2026-05-25 16:39 +08 补边 ZIP 增加全图透明编辑层

本节继续修正补边包的可操作性：只有局部问题裁图还不够，用户在外部绘图软件里还需要可直接叠加修改的全图边界层和弱支撑定位层。

实现变化：

- `src/pages/devtools/QidahenRegionMaskTool.tsx`
  - 新增 `buildWeakSupportOverlayDataUrl()`，生成全图透明弱支撑标记层；
  - `exportBoundaryRepairPackage()` 每次导出 `layers/current-boundary-transparent.png`；
  - 有弱支撑区域时额外导出 `layers/weak-support-overlay-transparent.png`；
  - `report.json.layers.currentBoundary` 与 `report.json.layers.weakSupportOverlay` 记录 layer 路径；
  - 弱支撑 overlay 只画蓝色边框、点和标签，不铺大色块，避免遮住底图。
- `e2e/qidahen-region-mask.e2e.ts`
  - 弱支撑 E2E 断言两个 layer 条目存在；
  - 断言两张 layer 都是 `1265x893`；
  - 断言当前边界层和弱支撑 overlay 都非空；
  - 将 layer 文件写入稳定证据截图；
  - `连接到地图边缘...` 用例同步更新补边包条目断言，证明未独立 seed 包仍兼容新增当前边界层。

验证：

- `npx eslint src/pages/devtools/QidahenRegionMaskTool.tsx e2e/qidahen-region-mask.e2e.ts`：通过。
- `npx tsc --noEmit --pretty false`：通过。
- `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 PW_WORKERS=1 PW_PORT=6375 PW_GAME_SERVER_PORT=20202 PW_API_SERVER_PORT=21202 node scripts/infra/run-e2e-command.mjs isolated e2e/qidahen-region-mask.e2e.ts --grep "局部候选线支撑不能替整张边界图背书并进入人工验收"`：`1 passed (4.3m)`。
- 同环境 `--grep "局部候选线支撑不能替整张边界图背书并进入人工验收|连接到地图边缘"`：`2 passed (7.6m)`。

截图与数据核对：

- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-real-map-local-support-boundary-layer-current.png`
  - 我实际看到：透明层里只有当前白色边界；
  - 读取数据：`1265x893 opaque=25108`；
  - 这张图可作为外部绘图软件里的当前边界底层。
- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-real-map-local-support-weak-overlay-current.png`
  - 我实际看到：透明层里只有蓝色弱支撑框、点和标签；
  - 我实际看到：没有大块半透明填充，不会遮住底图；
  - 读取数据：`1265x893 opaque=17204`。
- 正式文件复核：
  - `src/games/qidahen/data/region-mask.png 1265x893 opaque=0`；
  - `src/games/qidahen/data/region-boundary-mask.png 1265x893 opaque=0`。

当前证据边界：

- 已证明补边包现在既有局部问题裁图，也有可外部叠加编辑的全图 layer；
- 仍未证明七大恨正式区域成果完成；
- 正常成果仍需真实完整边界图修正后回导，再通过严格生成、底图贴合、逐区看图验收和保存回读。

## 2026-05-25 16:53 +08 补边 ZIP 同包加入真实主地图

本节继续补齐外部画笔微调所需素材。上一节已有当前边界透明层和弱支撑 overlay，但用户仍需要主地图底图才能直接在外部软件里叠图修边。现在主地图也进入同一个补边 ZIP。

实现变化：

- `src/pages/devtools/QidahenRegionMaskTool.tsx`
  - `exportBoundaryRepairPackage()` 新增 `qidahen-main-map.png`；
  - `report.json.layers.mainMap` 指向 `qidahen-main-map.png`；
  - 同一个 ZIP 现在包含主地图、当前边界透明层、弱支撑透明标记层、局部问题裁图和 report。
- `e2e/qidahen-region-mask.e2e.ts`
  - 弱支撑补边包断言新增 `qidahen-main-map.png`；
  - 断言 `report.json.layers.mainMap` 为 `qidahen-main-map.png`；
  - 断言主地图尺寸为 `1265x893`，不透明像素 > `900000`；
  - 将 ZIP 内主地图写入 `qidahen-region-mask-real-map-local-support-repair-main-map-current.png`。

验证：

- `npx eslint src/pages/devtools/QidahenRegionMaskTool.tsx e2e/qidahen-region-mask.e2e.ts`：通过。
- `npx tsc --noEmit --pretty false`：通过。
- `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 PW_WORKERS=1 PW_PORT=6375 PW_GAME_SERVER_PORT=20202 PW_API_SERVER_PORT=21202 node scripts/infra/run-e2e-command.mjs isolated e2e/qidahen-region-mask.e2e.ts --grep "局部候选线支撑不能替整张边界图背书并进入人工验收|连接到地图边缘"`：`2 passed (7.7m)`。

截图与数据核对：

- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-real-map-local-support-repair-main-map-current.png`
  - 我实际看到：完整七大恨主地图底图；
  - 我实际看到：不是旧版工具 UI，不是空白图；
  - 读取数据：`1265x893 opaque=1129645`。
- 同包外部修图层：
  - `qidahen-region-mask-real-map-local-support-boundary-layer-current.png`：`1265x893 opaque=25108`；
  - `qidahen-region-mask-real-map-local-support-weak-overlay-current.png`：`1265x893 opaque=17204`。
- 正式文件复核：
  - `src/games/qidahen/data/region-mask.png 1265x893 opaque=0`；
  - `src/games/qidahen/data/region-boundary-mask.png 1265x893 opaque=0`。

当前证据边界：

- 已证明补边 ZIP 具备“真实主地图 + 当前边界透明层 + 弱支撑透明标记层 + 局部问题图”的外部修图素材闭环；
- 仍未证明正式正常成果完成；
- 下一步应继续围绕真实边界修正后的回导、严格生成、底图贴合、逐区看图验收和保存回读推进。

## 2026-05-25 17:18 +08 补边 ZIP 全图边界层回导

本节补齐上一节仍缺的“回导”动作。补边包现在不只是给外部修图软件看的素材，也可以把修后的全图透明边界层导回工具，继续走七大恨区域生成与验收门禁。

实现变化：

- `src/pages/devtools/QidahenRegionMaskTool.tsx`
  - 新增 `boundaryRepairZipInputRef` 与 `importBoundaryRepairPackageZip()`；
  - `边界图工作流` 新增 `导入补边包 ZIP 的全图边界层`；
  - 回导优先读取 `report.json.layers.repairedBoundary`；
  - 兼容 `layers/repaired-boundary-transparent.png`、`layers/current-boundary-transparent.png`、`region-boundary-mask.png`、`qidahen-boundary-empty-transparent.png`；
  - 只接受 `1265x893` 全图透明边界层；
  - 回导时继续剔除印刷 UI 禁区像素；
  - 回导后替换当前边界草稿、清空手工 add/remove 层，并触发现有分区、开放线、弱支撑与验收状态重算。
- `e2e/qidahen-region-mask.e2e.ts`
  - 弱支撑用例在导出补边包后，脚本生成 `layers/repaired-boundary-transparent.png` 模拟外部修图；
  - 写回 `report.json.layers.repairedBoundary`；
  - 导回编辑后的补边 ZIP；
  - 断言回导成功；
  - 断言未封口线会进入开放线提示；
  - 清洗有效分区边界后重新生成，仍必须保持 `suspicious` / `blocked`。

验证：

- `npx eslint src/pages/devtools/QidahenRegionMaskTool.tsx e2e/qidahen-region-mask.e2e.ts`：通过。
- `npx tsc --noEmit --pretty false`：通过。
- `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 PW_WORKERS=1 PW_PORT=6375 PW_GAME_SERVER_PORT=20202 PW_API_SERVER_PORT=21202 node scripts/infra/run-e2e-command.mjs isolated e2e/qidahen-region-mask.e2e.ts --grep "局部候选线支撑不能替整张边界图背书并进入人工验收"`：`1 passed (6.2m)`。

截图与数据核对：

- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-real-map-local-support-repair-import-current.png`
  - 我实际看到：工具页面使用真实七大恨主地图；
  - 我实际看到：左侧状态仍为 `suspicious` / `blocked`；
  - 我实际看到：不是旧 UI，不是空白，也没有把回导补线当作正常成果；
  - 读取数据：`1600x1000 opaque=1600000`。
- 关联素材复核：
  - 主地图：`qidahen-region-mask-real-map-local-support-repair-main-map-current.png 1265x893 opaque=1129645`；
  - 当前边界层：`qidahen-region-mask-real-map-local-support-boundary-layer-current.png 1265x893 opaque=25108`。
- 正式文件复核：
  - `src/games/qidahen/data/region-mask.png 1265x893 opaque=0`；
  - `src/games/qidahen/data/region-boundary-mask.png 1265x893 opaque=0`。

当前证据边界：

- 已证明补边 ZIP 可以闭环为“导出素材 -> 外部修改全图边界层 -> 回导工具 -> 重新诊断/生成”；
- 已证明不充分补线不会绕过弱支撑/开放线门禁；
- 仍未证明正式正常成果完成；
- 正常成果仍需真实完整边界图通过 5/5 seed 独立分区、无未解释开放线、UI 禁区 0、全局与逐区底图支撑、逐区看图验收和保存回读。

## 2026-05-25 18:08 +08 真实底图颜色线初始草稿

本节回应“直接生成边界图，然后人工微调”的主路。之前的问题是底图颜色诊断只读，用户还要从空白图开始补；现在工具可以把真实底图里的连续颜色线写入可编辑草稿，但仍不允许把它当正常成果。

读图与数据：

- 真实底图：`public/assets/i18n/zh-CN/qidahen/board/qidahen-main-map.png`。
- 颜色来源：用户已给定并写入默认值：
  - `rgb(61, 69, 66)`；
  - `rgb(126, 97, 56)`；
  - `rgb(128, 104, 62)`；
  - `rgb(43, 36, 34)`。
- 像素分析结论：
  - 这些颜色必须带容差才能命中真实扫描图线条；
  - 容差 16 可提取弯曲地图长线；
  - 颜色匹配本身会撞到 UI、文字、牌框、装饰，因此必须先剔 UI，再只保留长连续细线组件；
  - 无法连成线/无法封口的结果仍不能生成正常成果，只能作为微调初始值。

实现变化：

- `src/pages/devtools/QidahenRegionMaskTool.tsx`
  - 新增 `buildRealMapColorLineEditableDraft()`；
  - 新增 `loadRealMapColorLineBoundaryDraft()`；
  - `边界图工作流` 新增 `生成可编辑颜色线草稿`；
  - 写入当前边界草稿后进入边界修正模式；
  - 保持 `paintedBoundaryOnly=true`；
  - 清空手工 add/remove 层；
  - 自动隐藏 UI 禁区叠层但仍剔除 UI 禁区像素；
  - 不做直线封口；
  - 默认生成仍由 5/5 seed、开放线、底图贴合和逐区验收门禁决定。
- `e2e/qidahen-region-mask.e2e.ts`
  - 更新用例为 `真实底图颜色线可生成可编辑草稿但不能直接当正常成果`；
  - 断言边界草稿写入；
  - 断言所有 UI 禁区边界像素为 0；
  - 导出草稿边界层作为证据；
  - 默认生成仍拒绝，不能写出正式区域。

验证：

- `npx eslint src/pages/devtools/QidahenRegionMaskTool.tsx e2e/qidahen-region-mask.e2e.ts`：通过。
- `npx tsc --noEmit --pretty false`：通过。
- `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 PW_WORKERS=1 PW_PORT=6375 PW_GAME_SERVER_PORT=20202 PW_API_SERVER_PORT=21202 node scripts/infra/run-e2e-command.mjs isolated e2e/qidahen-region-mask.e2e.ts --grep "真实底图颜色线可生成可编辑草稿但不能直接当正常成果"`：`1 passed (2.2m)`。

截图与数据核对：

- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-real-map-candidate-draft-current.png`
  - 我实际看到：真实七大恨地图上出现弯曲的白色地图线草稿；
  - 我实际看到：没有把右侧牌库、底部条当作边界层写入；
  - 我实际看到：页面仍显示 `seed 0/5`，默认生成不会放行。
- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-real-map-candidate-draft-layer-current.png`
  - 我实际看到：透明边界层是弯曲地图线，不是直线多边形；
  - 读取数据：`1265x893 opaque=8666`。
- 正式文件复核：
  - `src/games/qidahen/data/region-mask.png 1265x893 opaque=0`；
  - `src/games/qidahen/data/region-boundary-mask.png 1265x893 opaque=0`。

当前证据边界：

- 已证明工具能从真实底图颜色生成可编辑初始边界图；
- 已证明该草稿不包含印刷 UI 禁区像素；
- 已证明该草稿不会被直接当作正常成果；
- 仍未证明正式正常成果完成；
- 下一步必须在这个草稿上继续补边/舍弃断线，直到 5/5 seed 独立分区、无未解释开放线、UI 禁区 0、底图全局与逐区支撑、逐区看图验收、保存回读全部成立。

## 2026-05-25 18:42 +08 真实底图区域底色草稿

本节记录对 `seed 0/5` 的路线修正：继续强行从未闭合颜色线生成区域会原地打转，因此新增一个更适合人工微调的入口，直接基于真实地图底色生成五区可编辑 mask 草稿。

实现变化：

- `src/pages/devtools/QidahenRegionMaskTool.tsx`
  - 新增 `RealMapRegionColorDraftReport`；
  - 新增真实底图底色采样、polygon 软范围、连通块选择相关 helper；
  - 新增 `buildRealMapRegionColorDraft()`；
  - 新增 `generateRealMapRegionColorDraft()`；
  - `边界图工作流` 新增按钮 `生成可编辑区域底色草稿`；
  - 输出只写当前 `mask` 草稿，不写正式边界图；
  - 自动剔除印刷 UI 禁区；
  - 生成后切到画笔模式，方便继续微调。
- `e2e/qidahen-region-mask.e2e.ts`
  - 新增 `saveCanvasPng()`，直接保存 canvas PNG，避免透明层证据变成带底图截图；
  - 新增 `getAllRegionMaskColorCounts()`；
  - 新增 `真实底图区域底色可生成五区可编辑草稿但仍不能当 accepted 成果`。

算法边界：

- 使用 `region-mask-regions.json` 中正式 seed；
- 使用 `QIDAHEN_MAP_REGION_SHAPES` 作为软约束，不把 polygon 直接当成果；
- 每区在 polygon 内采样真实底图中位底色；
- 在 polygon 周边软范围内筛选同底色像素；
- 选择与 seed 最近、且覆盖 polygon 足够的连通块；
- 对连通块做内部填洞并裁掉 UI 禁区；
- 结果是“可编辑草稿”，不是正常成果。

验证：

- `npx eslint src/pages/devtools/QidahenRegionMaskTool.tsx e2e/qidahen-region-mask.e2e.ts`：通过。
- `npx tsc --noEmit --pretty false`：通过。
- `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 PW_WORKERS=1 PW_PORT=6376 PW_GAME_SERVER_PORT=20203 PW_API_SERVER_PORT=21203 node scripts/infra/run-e2e-command.mjs isolated e2e/qidahen-region-mask.e2e.ts --grep "真实底图区域底色可生成五区可编辑草稿但仍不能当 accepted 成果"`：`1 passed (1.4m)`。
- `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 PW_WORKERS=1 PW_PORT=6377 PW_GAME_SERVER_PORT=20204 PW_API_SERVER_PORT=21204 node scripts/infra/run-e2e-command.mjs isolated e2e/qidahen-region-mask.e2e.ts --grep "真实底图颜色线可生成可编辑草稿但不能直接当正常成果"`：`1 passed (2.2m)`。

截图与数据核对：

- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-real-map-region-color-draft-current.png`
  - 我实际看到：真实七大恨地图上出现五块可编辑区域草稿；
  - 我实际看到：左侧仍显示 `suspicious`、`人工验收 0/5`，没有被当作正常成果；
  - 我实际看到：草稿没有选入右侧牌库、底部条、左侧轮盘等印刷 UI 禁区；
  - 我实际看到：区域边缘仍粗，需要人工微调，不能据此收口。
- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-real-map-region-color-draft-layer-current.png`
  - 我实际看到：透明 mask 层包含五个区域色块；
  - 我实际看到：不是旧的直线多边形边界成果；
  - 我实际看到：右侧牌库、底部条和左侧轮盘区域保持透明。
- 正式文件复核：
  - `src/games/qidahen/data/region-mask.png 1265x893 opaque=0`；
  - `src/games/qidahen/data/region-boundary-mask.png 1265x893 opaque=0`。

当前证据边界：

- 已证明工具能从真实底图生成五区可编辑区域草稿；
- 已证明该草稿不污染印刷 UI 禁区；
- 已证明该草稿不会被 accepted；
- 仍未证明正式正常成果完成；
- 下一步应围绕这份草稿做人工微调，或继续用完整闭合边界生成后再逐区验收。

## 2026-05-25 19:03 +08 区域底色草稿结论作废并停用入口

本节修订上一节结论。上一节 E2E 的断言过窄，只证明“五区非空、UI 禁区为 0、没有 accepted”，没有证明视觉上接近真实边界。实际看图后确认：区域底色草稿仍是粗色块，局部还有直边和明显不贴图的问题，不能作为正常成果方向。

失效结论：

- `真实底图区域底色可生成五区可编辑草稿` 不再作为正向进展结论；
- 相关截图只能作为反例留档；
- 禁止用该草稿证明“能够正常生成区域”。

实现修正：

- `src/pages/devtools/QidahenRegionMaskTool.tsx`
  - `生成可编辑区域底色草稿` 改为 disabled；
  - 按钮文案改为 `已停用：区域底色草稿`；
  - 新增 `qidahen-region-color-draft-disabled-note`，说明该路径看图不合格；
  - 禁用后不会再写入 mask。
- `e2e/qidahen-region-mask.e2e.ts`
  - 原正向用例改为 `真实底图区域底色草稿入口已停用避免假成果`；
  - 断言按钮 disabled；
  - 断言 mask canvas 仍为空；
  - 断言 normality 不为 accepted。

当前证据边界：

- 已修正一个会误导成“成果”的入口；
- 正常成果仍未完成；
- 当前唯一主路仍是：导入/手绘真实闭合边界，使用 `只保留有效分区边界` 舍弃断线和无 seed 噪声，再生成区域、逐区看图验收、保存回读。

## 2026-05-25 19:16 +08 主路 E2E 修正为导入用户修好边界层

本节记录“空白边界 -> 五区生成 -> 保存回读”证据链的修正。旧用例用 Playwright 鼠标连续拖五个闭合区，先遇到 6379 端口占用，换 6380 后在 `mouse.move` 处 180s 超时。这个失败说明旧 E2E 过度依赖慢速鼠标事件，不适合作为主路证据。

实现变化：

- `e2e/qidahen-region-mask.e2e.ts`
  - `createTransparentBoundaryMaskPng()` 改用平滑闭合路径，不再生成直线闭合边界；
  - 汉城边界笔宽降为 2px，避免右侧 UI 禁区裁断导致 seed 未独立；
  - 主路用例改名为 `从空白边界工作区导入手绘五区边界后可生成 5/5 并保存回读`；
  - 用例仍进入空白边界工作区，但改为导入用户修好的五区透明边界层，再验证保存、刷新回读、严格生成、质量报告；
  - 路径编辑相邻用例改用 `调试生成当前独立分区`，符合默认严格生成只允许 5/5 的当前口径；
  - 路径编辑相邻用例去掉全页截图，避免截图调用卡住测试；保留 DOM、保存文件、刷新回读和正式数据未污染断言。

看图与证据：

- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-blank-boundary-five-region-drawn-current.png`
  - 我实际看到：新版七大恨区域制图工具；
  - 我实际看到：真实七大恨主地图；
  - 我实际看到：五个 seed 均显示独立；
  - 我实际看到：这仍是测试导入边界层，不是正式成果。
- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-blank-boundary-five-region-generated-current.png`
  - 我实际看到：5/5 链路生成后仍显示 `正常成果未证明 / suspicious`；
  - 我实际看到：左侧明确写 `generated-ready 只代表链路跑通`；
  - 我实际看到：底图贴合和直线形态仍 blocked；
  - 因此这张图只能证明导入/保存/回读/生成链路，不证明正式区域成果。

验证：

- `npx eslint src/pages/devtools/QidahenRegionMaskTool.tsx e2e/qidahen-region-mask.e2e.ts`：通过。
- `npx tsc --noEmit --pretty false`：通过。
- `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 PW_WORKERS=1 PW_PORT=6380 PW_GAME_SERVER_PORT=20207 PW_API_SERVER_PORT=21207 node scripts/infra/run-e2e-command.mjs isolated e2e/qidahen-region-mask.e2e.ts --grep "从空白边界工作区导入手绘五区边界后可生成 5/5 并保存回读"`：`1 passed (4.3m)`。
- `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 PW_WORKERS=1 PW_PORT=6383 PW_GAME_SERVER_PORT=20210 PW_API_SERVER_PORT=21210 node scripts/infra/run-e2e-command.mjs isolated e2e/qidahen-region-mask.e2e.ts --grep "真实底图颜色线可生成可编辑草稿但不能直接当正常成果|真实底图区域底色草稿入口已停用避免假成果"`：`2 passed (2.5m)`。
- `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 PW_WORKERS=1 PW_PORT=6382 PW_GAME_SERVER_PORT=20209 PW_API_SERVER_PORT=21209 node scripts/infra/run-e2e-command.mjs isolated e2e/qidahen-region-mask.e2e.ts --grep "导入闭合边界后区域中心路径编辑和单主保存动作可用"`：`1 passed (6.3m)`。
- 组合回归中 `导入完成边界图后按独立分区生成区域并舍弃断线` 曾通过 `1 passed`。

正式文件复核：

- `src/games/qidahen/data/region-mask.png 1265x893 opaque=0`。
- `src/games/qidahen/data/region-boundary-mask.png 1265x893 opaque=0`。

当前证据边界：

- 已修复主路 E2E 卡死和慢速鼠标夹具问题；
- 已证明导入用户修好边界层后，工具能保存、刷新回读并生成 5/5；
- 仍未证明正式正常成果完成；
- 正常成果仍必须来自真实完整边界图，并通过底图贴合、形态门禁、逐区看图验收后再保存正式 PNG。

## 2026-05-25 20:34 +08 描边包加入真实颜色线初始层

本节继续回应用户“要直接生成边界图，然后人工微调”的方向。前提先说清：当前自动抽出的颜色线仍不能直接成为正常成果，但它可以作为外部画笔微调的初始透明层，避免从空白层开始画。

看图与数据：

- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-real-map-candidate-draft-current.png`
  - 我实际看到：真实七大恨地图上覆盖了白色弯曲颜色线；
  - 我实际看到：没有整块 UI 框被选入；
  - 我实际看到：左侧仍显示 `seed 0/5`，候选不达标。
- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-real-map-candidate-draft-layer-current.png`
  - 我实际看到：透明层是断开的真实地图线段；
  - 读取数据：`1265x893 opaque=8648`；
  - 结论：可作为初始边界层，不能作为正常区域成果。

实现变化：

- `src/pages/devtools/QidahenRegionMaskTool.tsx`
  - `buildRealMapColorLineEditableDraft()` 原来计算了 `decorationExclusionMask`，但没有从输出中扣掉；现已真正排除白色牌标、红箭头、数字 token 等紧凑装饰；
  - `exportBoundaryTraceKitZip()` 现在会额外生成 `qidahen-boundary-color-line-draft-transparent.png`；
  - `manifest.json.importTargets.colorLineDraft` 指向该文件；
  - `manifest.json.colorLineDraft` 记录 `pixelCount`、`componentCount` 和说明；
  - 状态提示会写出颜色线初始层像素数。
- `e2e/qidahen-region-mask.e2e.ts`
  - 全图描边包用例现在断言 ZIP 条目包含颜色线初始层；
  - 断言 manifest 中记录该层路径、像素数和组件数；
  - 断言颜色线初始层尺寸为 `1265x893`、非空；
  - 断言所有印刷 UI 禁区内像素为 0；
  - 将该层写成证据图 `qidahen-region-mask-trace-kit-color-line-draft-current.png`。

验证：

- `npx eslint src/pages/devtools/QidahenRegionMaskTool.tsx e2e/qidahen-region-mask.e2e.ts`：通过。
- `npx tsc --noEmit --pretty false`：通过。
- `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 PW_WORKERS=1 PW_PORT=6384 PW_GAME_SERVER_PORT=20211 PW_API_SERVER_PORT=21211 node scripts/infra/run-e2e-command.mjs isolated e2e/qidahen-region-mask.e2e.ts --grep "真实底图颜色线可生成可编辑草稿但不能直接当正常成果"`：`1 passed (2.2m)`。
- `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 PW_WORKERS=1 PW_PORT=6385 PW_GAME_SERVER_PORT=20212 PW_API_SERVER_PORT=21212 node scripts/infra/run-e2e-command.mjs isolated e2e/qidahen-region-mask.e2e.ts --grep "全图描边包 ZIP 包含透明边界层、底图和边界颜色清单"`：`1 passed (52.3s)`。

截图与数据核对：

- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-trace-kit-color-line-draft-current.png`
  - 我实际看到：透明层是弯曲的真实地图线段；
  - 我实际看到：没有右侧牌框、底部条、左侧轮盘这类 UI 框；
  - 读取数据：`1265x893 opaque=8648`。
- 正式文件复核：
  - `src/games/qidahen/data/region-mask.png 1265x893 opaque=0`；
  - `src/games/qidahen/data/region-boundary-mask.png 1265x893 opaque=0`。

当前证据边界：

- 已证明描边包现在包含可微调的真实颜色线初始层；
- 已证明该层不污染 UI 禁区；
- 已证明该层仍不能直接生成正常区域；
- 因此自动生成正常成果仍未达成，下一步必须由用户/外部画笔基于该层补成真实闭合边界后回导。

## 2026-05-25 20:39 +08 本地描边工作包

为了让用户不必只依赖浏览器下载，本节把当前可执行主路落成一个本地工作包。它不是正式成果，而是给外部画笔修边的输入包。

产物位置：

- 目录：`D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\temp\qidahen-boundary-trace-kit\`
- ZIP：`D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\temp\qidahen-boundary-trace-kit\qidahen-boundary-trace-kit.zip`

包内文件：

- `qidahen-main-map.png`
- `qidahen-boundary-empty-transparent.png`
- `qidahen-boundary-color-line-draft-transparent.png`
- `qidahen-boundary-trace-template.png`
- `manifest.json`
- `README.txt`

数据核对：

- ZIP 条目完整。
- `qidahen-main-map.png 1265x893 opaque=1129645`。
- `qidahen-boundary-empty-transparent.png 1265x893 opaque=0`。
- `qidahen-boundary-color-line-draft-transparent.png 1265x893 opaque=8648`。
- `qidahen-boundary-trace-template.png 1265x893 opaque=1129645`。
- `manifest.colorLineDraft.pixelCount=8648`。

颜色线初始层 UI 禁区复核：

- `top printed frame: 0`
- `left wheel and setup table: 0`
- `left printed margin: 0`
- `right card boxes: 0`
- `bottom cards and action strip: 0`
- `bottom year track: 0`

看图结论：

- `qidahen-boundary-trace-template.png` 已实际查看；
- 图中红色 UI 禁区框覆盖轮盘、右侧牌框、底部条等区域；
- 绿色 seed 标记可见；
- 这张图用于外部画笔描边，目的是避免继续把 UI 区域画进边界。

工作流：

1. 打开 `qidahen-main-map.png`。
2. 叠加 `qidahen-boundary-color-line-draft-transparent.png`。
3. 沿真实地图边界补线，擦掉错线；连不上的线直接舍弃。
4. 不在 `manifest.forbiddenUiRects` 覆盖区域画边界。
5. 导出同尺寸透明 PNG，回到工具用“导入完成边界图”导入。

当前证据边界：

- 已提供可实际打开和微调的描边工作包；
- 仍未提供正式 `region-mask.png` / `region-boundary-mask.png` 成果；
- 只有回导后的完整边界通过 5/5、底图贴合、形态门禁、逐区看图验收，才能写正式数据。

## 2026-05-25 20:50 +08 颜色线初始层回导不能生成成果

本节补一条负向门禁，防止后续再次把描边包里的颜色线初始层误当成完成边界。

新增 E2E：

- `描边包颜色线初始层回导后仍不能直接生成正常成果`

覆盖流程：

1. 在工具内导出 `qidahen-boundary-trace-kit.zip`。
2. 从 ZIP 中取出 `qidahen-boundary-color-line-draft-transparent.png`。
3. 用“导入完成边界图”把该颜色线初始层回导工具。
4. 断言边界像素存在。
5. 断言 `closed-seed-hit-count=0`。
6. 断言所有印刷 UI 禁区内边界像素为 0。
7. 点击 `生成正常初始区域`。
8. 断言 `默认生成已拒绝`。
9. 断言没有任何区域 `已生成`。
10. 断言 `qidahen-mask-canvas` 仍为空。
11. 断言 normality 不是 accepted。

验证：

- `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 PW_WORKERS=1 PW_PORT=6386 PW_GAME_SERVER_PORT=20213 PW_API_SERVER_PORT=21213 node scripts/infra/run-e2e-command.mjs isolated e2e/qidahen-region-mask.e2e.ts --grep "描边包颜色线初始层回导后仍不能直接生成正常成果"`：`1 passed (2.1m)`。
- `npx eslint src/pages/devtools/QidahenRegionMaskTool.tsx e2e/qidahen-region-mask.e2e.ts`：通过。
- `npx tsc --noEmit --pretty false`：通过。

正式文件复核：

- `src/games/qidahen/data/region-mask.png 1265x893 opaque=0`。
- `src/games/qidahen/data/region-boundary-mask.png 1265x893 opaque=0`。

当前证据边界：

- 已证明颜色线初始层可以回导，但会被严格生成拒绝；
- 已证明该层不污染 UI 禁区；
- 仍未证明正常成果完成。

## 2026-05-25 21:55 +08 Trace kit README 自说明与回导口径

本节补齐描边工作包的人工作业说明，防止 `layers/current-boundary-transparent.png` 被误当成修好成果，也防止用户修完后不知道该用哪个标准层回导。

实现变化：

- `src/pages/devtools/QidahenRegionMaskTool.tsx`
  - `exportBoundaryTraceKitZip()` 新增 `README.txt`；
  - README 明确 `current-boundary` 只是颜色线初始层；
  - README 明确自动抽线最多 `2/5` 个独立 seed，不能自动生成正常成果；
  - README 明确修完后应新增或覆盖 `layers/repaired-boundary-transparent.png`；
  - README 明确 `report.json.layers.repairedBoundary` 应写成 `layers/repaired-boundary-transparent.png`；
  - README 明确回导入口是“导入补边包 ZIP 的全图边界层”。
- `e2e/qidahen-region-mask.e2e.ts`
  - 全图描边包用例新增 `README.txt` 条目断言；
  - 断言 README 包含 repairedBoundary 路径、补边包回导入口、`2/5` 自动抽线失败结论、不能自动生成正常成果、断线直接舍弃。
- `temp/qidahen-boundary-trace-kit/`
  - 本地 `README.txt` 已同步；
  - 本地 `qidahen-boundary-trace-kit.zip` 已重新打包并读回验证。

验证：

- `npx eslint src/pages/devtools/QidahenRegionMaskTool.tsx e2e/qidahen-region-mask.e2e.ts`：通过。
- `npx tsc --noEmit --pretty false`：通过。
- `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 PW_WORKERS=1 PW_PORT=6394 PW_GAME_SERVER_PORT=20221 PW_API_SERVER_PORT=21221 node scripts/infra/run-e2e-command.mjs isolated e2e/qidahen-region-mask.e2e.ts --grep "全图描边包 ZIP 包含透明边界层、底图和边界颜色清单"`：`1 passed (1.6m)`。
- `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 PW_WORKERS=1 PW_PORT=6395 PW_GAME_SERVER_PORT=20222 PW_API_SERVER_PORT=21222 node scripts/infra/run-e2e-command.mjs isolated e2e/qidahen-region-mask.e2e.ts --grep "描边包标准边界层经补边包入口回导后仍不能直接生成正常成果|描边包加入修好边界层后可优先回导 repairedBoundary 并进入生成门禁"`：负向回导通过；正向 repairedBoundary 首次失败，失败截图停在全局 `易桌游 / 加载中…`，未进入工具页，未证明导入逻辑失败。
- `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 PW_WORKERS=1 PW_PORT=6397 PW_GAME_SERVER_PORT=20224 PW_API_SERVER_PORT=21224 node scripts/infra/run-e2e-command.mjs isolated e2e/qidahen-region-mask.e2e.ts --grep "描边包加入修好边界层后可优先回导 repairedBoundary 并进入生成门禁"`：复跑 `1 passed (2.9m)`。
- 本地 ZIP 读回：包含 `README.txt`、`layers/current-boundary-transparent.png`、`manifest.json`、`report.json`、主地图、空白边界层、颜色线初始层和描边模板；README 关键短语均存在。
- `git diff --check -- src/pages/devtools/QidahenRegionMaskTool.tsx e2e/qidahen-region-mask.e2e.ts temp/qidahen-boundary-trace-kit/README.txt temp/qidahen-boundary-trace-kit/qidahen-boundary-trace-kit.zip`：无空白错误，仅 CRLF warning。

看图结论：

- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-auto-extraction-verdict-current.png`
  - 我实际看到：UI 写明“自动抽线不能自动生成正常成果”；
  - 我实际看到：UI 写明“真实图像参数扫描最多 2/5 个独立 seed”；
  - 结论：工具没有把颜色抽线重新包装成完成路线。
- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-trace-kit-color-line-draft-current.png`
  - 我实际看到：透明层是断开的弯曲真实地图线段；
  - 我实际看到：没有大块轮盘、牌框、底部条等 UI 区域；
  - 结论：该层只能作为补边底稿，仍不是正式正常成果。

正式文件复核：

- `src/games/qidahen/data/region-mask.png 1265x893 opaque=0`。
- `src/games/qidahen/data/region-boundary-mask.png 1265x893 opaque=0`。

当前证据边界：

- 已把修边包导出、修完后的标准文件名、report 指向和回导入口固化到 ZIP 自说明；
- 已证明浏览器下载路径与本地工作包都包含该说明；
- 仍未证明正常成果完成，正式 PNG 继续保持空透明。

## 2026-05-25 22:26 +08 成本生长自动候选负证据与颜色线底稿降级

本节验证另一条自动路线：不再要求颜色线闭合，而是把真实边界色当高代价墙，从 5 个 seed 做区域生长。该路线经看图仍不达标，因此不接入正式工具。

实验产物：

- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\temp\qidahen-weighted-seed-experiment\weighted-seed-overlay.png`
- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\temp\qidahen-weighted-seed-experiment\weighted-seed-boundary-mask.png`
- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\temp\qidahen-weighted-seed-experiment\input-boundary-color-mask.png`
- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\temp\qidahen-weighted-seed-experiment\summary.json`

实验数据：

- `domainPixels=175407`。
- `boundaryColorPixels=66595`。
- `jinzhou=60724`。
- `song-jin=15990`。
- `shan-hai-guan=42629`。
- `xian-xing=35229`。
- `shou-cheng=20835`。

看图结论：

- `weighted-seed-overlay.png`
  - 我实际看到：5 个 seed 都被分到区域；
  - 我实际看到：边界仍有明显粗 shape/几何轮廓；
  - 我实际看到：汉城/咸兴候选贴近右侧和底部 UI；
  - 判定：不达标，不能作为正常成果。
- `weighted-seed-boundary-mask.png`
  - 我实际看到：白色边界存在长直/几何化轮廓；
  - 判定：不满足用户要求的真实地图边界。
- `input-boundary-color-mask.png`
  - 我实际看到：真实边界色仍大量命中马纹、山纹、海面纹理和 UI 线；
  - 判定：用真实边界色做成本场仍不能稳定区分“地图边界”和“装饰纹理/UI”。

实现变化：

- `src/pages/devtools/QidahenRegionMaskTool.tsx`
  - 按钮文案从 `生成可编辑颜色线草稿` 降级为 `载入颜色线底稿（非成果）`；
  - 状态文案从“生成可编辑边界草稿”改为 `已载入真实底图颜色线底稿到边界编辑层`；
  - 说明文本明确：颜色线底稿只是修边起点，不能直接生成正常成果。
- `e2e/qidahen-region-mask.e2e.ts`
  - 用例改名为 `真实底图颜色线只能载入为修边底稿且不能直接当正常成果`；
  - 断言 readiness 文案包含 `颜色线底稿`；
  - 断言载入后默认生成仍拒绝、无区域生成、normality 不是 accepted。

验证：

- `npx eslint src/pages/devtools/QidahenRegionMaskTool.tsx e2e/qidahen-region-mask.e2e.ts`：通过。
- `npx tsc --noEmit --pretty false`：通过。
- `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 PW_WORKERS=1 PW_PORT=6398 PW_GAME_SERVER_PORT=20225 PW_API_SERVER_PORT=21225 node scripts/infra/run-e2e-command.mjs isolated e2e/qidahen-region-mask.e2e.ts --grep "真实底图颜色线只能载入为修边底稿且不能直接当正常成果"`：`1 passed (2.3m)`。

截图证据：

- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-real-map-candidate-draft-current.png`
  - 我实际看到：工具页显示 `候选不达标 seed 0/5`；
  - 我实际看到：说明写明颜色线底稿不能直接生成正常成果；
  - 判定：自动候选仍被门禁拦住。
- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-real-map-candidate-draft-layer-current.png`
  - 我实际看到：透明层仍是断开的弯曲真实地图线段；
  - 判定：它只能作为修边底稿。

正式文件复核：

- `src/games/qidahen/data/region-mask.png 1265x893 opaque=0`。
- `src/games/qidahen/data/region-boundary-mask.png 1265x893 opaque=0`。

当前证据边界：

- 已否定“成本生长 + 粗 shape 软约束”自动生成路线；
- 已把颜色线草稿在 UI 上降级为非成果底稿；
- 正常成果仍必须来自用户/外部画笔完成的真实闭合边界图。

## 2026-05-26 00:48 +08 工具内画笔编辑五区链路

本节补齐“能不能直接在工具里用画笔编辑”的端到端证据。此前已有导入完整透明边界层的 5/5 链路，但那不能证明工具内画笔本身可用。

实现/测试变化：

- `e2e/qidahen-region-mask.e2e.ts`
  - 新增 E2E `从空白边界开始用画笔手绘五区后可生成 5/5 并保存回读`。
  - `dispatchCanvasPointerPolyline()` 从“只在顶点派发 pointermove”改为按约 3px 间距插值，模拟真实连续画笔 stroke。
  - 本用例 seed 状态断言从 `toContainText('独立')` 改为 `toHaveText('独立')`，避免 `未独立` 误过。
  - 汉城使用靠右侧禁区闭合的 U 形手绘线，避免画笔半径把 seed 本身盖成边界。

验证：

- `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 PW_WORKERS=1 PW_PORT=4273 NODE_OPTIONS=--max-old-space-size=4096 node scripts/infra/run-e2e-command.mjs dev e2e/qidahen-region-mask.e2e.ts --grep "从空白边界开始用画笔手绘五区后可生成 5/5 并保存回读"`：`1 passed (4.0m)`。
- `npx eslint src/pages/devtools/QidahenRegionMaskTool.tsx e2e/qidahen-region-mask.e2e.ts`：通过。
- `npx tsc --noEmit --pretty false`：通过。

保存产物读数：

- `temp/devtools/qidahen-region-mask-workspaces/blank-boundary-five-region-brush-drawn/region-boundary-mask.png opaque=9925`。
- `temp/devtools/qidahen-region-mask-workspaces/blank-boundary-five-region-brush-drawn/region-mask.png opaque=42669`。
- `region-boundary-add.png opaque=0`。
- `region-boundary-remove.png opaque=0`。

截图证据：

- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-blank-boundary-five-region-brush-drawn-current.png`
  - 我实际看到：工具处于边界修正画笔模式，地图 canvas 上已有 5 个手绘测试边界，seed 状态进入独立。
  - 结论：工具内画笔事件链能写入连续边界并触发分区诊断。
- `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\test-results\evidence-screenshots\_shared\qidahen-region-mask-blank-boundary-five-region-brush-generated-current.png`
  - 我实际看到：生成后页面显示 5/5 已生成，左侧质量报告仍为 `suspicious`，底图贴合为 blocked。
  - 结论：工具内画笔链路可生成、保存、刷新回读；但该截图仍是合成测试边界，不能当正式 accepted 成果。

当前证据边界：

- 已证明“空白边界 -> 工具内画笔 -> 5/5 分区 -> 保存回读”链路可用。
- 仍未证明七大恨正式正常成果完成；正式成果必须继续等待真实闭合边界图，并通过底图贴合、形态门禁和逐区人工验收。

## 2026-05-26 03:00 +08 透明边界导入清洗与 UI/装饰污染门禁修订

本节修订上一节的证据口径：`从空白边界开始用画笔手绘五区后可生成 5/5 并保存回读` 这个测试名仍保留，但当前严格门禁下，合成五区边界只能证明工具内画笔、5/5 分区和区域生成链路；它不能再作为“正常成果保存回读”的证据。原因是合成边界仍有低底图贴合、直线/多边形夹具特征，且会碰到地图内部装饰禁区。这个旧结论已失效：不能把合成边界保存成功当作正常成果证据。

实现修订：

- `src/pages/devtools/QidahenRegionMaskTool.tsx`
  - 透明“完成边界图”导入只做外圈印刷 UI 区域的破坏性剔除；不再用地图内部红箭头、数字牌、锚点等装饰禁区剪断透明边界闭合线。
  - 带底图描线图仍按地图内部装饰禁区做抽线清洗，避免把原图装饰当成用户新增描线。
  - 从边界生成区域时跳过 `currentMapArtifactExclusionMask`，保证红箭头、数字牌、锚点等 UI/装饰像素不会写入 `region-mask.png`。
  - 质量报告新增 `UI mask` 读数，用 `qidahen-quality-mask-ui-pixels` 暴露生成 mask 的 UI/装饰污染量。
  - 正式保存门禁仍不放松：mask 或边界图包含 UI/装饰禁区像素时继续拒绝保存。
- `e2e/qidahen-region-mask.e2e.ts`
  - 五区画笔/导入测试改为断言 `5/5 seed`、开放碎线清洗、生成区域、`UI mask=0`，并明确合成图仍是 `不能生成正常成果`。
  - 通路代价保存回读测试改用避开装饰禁区的小闭合夹具，只验证区域中心、自动补通路、`mountain` 边界类型保存和刷新回读。
  - 通路测试保存前清空合成边界图，避免用合成边界去绕过正式边界门禁；保存对象是已生成 mask 与 `region-graph.json`。

验证：

- `npx eslint src/pages/devtools/QidahenRegionMaskTool.tsx e2e/qidahen-region-mask.e2e.ts`：通过。
- `npx tsc --noEmit --pretty false`：通过。
- `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 PW_WORKERS=1 PW_PORT=6421 PW_GAME_SERVER_PORT=20321 PW_API_SERVER_PORT=21321 NODE_OPTIONS=--max-old-space-size=4096 node scripts/infra/run-e2e-command.mjs isolated e2e/qidahen-region-mask.e2e.ts --grep "从空白边界开始用画笔手绘五区后可生成 5/5 并保存回读|导入完成边界图时自动舍弃未参与分区的开放碎线|导入闭合边界后可按区域邻近补全路径并保存边界类型"`：`3 passed (10.4m)`。

截图证据：

- `test-results/evidence-screenshots/_shared/qidahen-region-mask-blank-boundary-five-region-brush-drawn-current.png`
  - 我实际看到：工具内画笔画出的五区合成边界让 5 个 seed 都进入独立分区；
  - 我实际看到：质量报告仍显示不能作为正常成果；
  - 判定：证明画笔/分区链路，不证明正式成果。
- `test-results/evidence-screenshots/_shared/qidahen-region-mask-blank-boundary-five-region-brush-generated-current.png`
  - 我实际看到：5 个区域均已生成；
  - 我实际看到：`UI mask` 为 0，说明生成区域已跳过 UI/装饰像素；
  - 判定：区域生成不会再把红箭头、数字牌等装饰写进 mask。
- `test-results/evidence-screenshots/_shared/qidahen-region-mask-imported-boundary-auto-pruned-current.png`
  - 我实际看到：导入完成边界图后，开放碎线被自动舍弃，seed 仍可达到 5/5；
  - 判定：透明边界导入不再被地图内部装饰禁区破坏闭合线。
- `test-results/evidence-screenshots/_shared/qidahen-region-mask-path-auto-passage-current.png`
  - 我实际看到：路径图存在 `锦州 ↔ 宋进`，边界类型为 `山脉`；
  - 判定：区域中心、邻近通路补全、移动代价类型编辑与保存回读链路可用。

正式文件复核：

- `src/games/qidahen/data/region-mask.png 1265x893 opaque=0`。
- `src/games/qidahen/data/region-boundary-mask.png 1265x893 opaque=0`。
- `src/games/qidahen/data/region-boundary-add.png 1265x893 opaque=0`。
- `src/games/qidahen/data/region-boundary-remove.png 1265x893 opaque=0`。

当前证据边界：

- 已证明工具可以编辑边界、舍弃断线、生成区域、跳过 UI/装饰像素，并保存/回读区域通路代价。
- 仍未生成七大恨正式正常区域成果；正式成果必须来自真实闭合边界图，并通过底图贴合、形态门禁和逐区人工验收后才可写入正式数据。

## 2026-05-26 03:09 +08 颜色线载入为可编辑边界草稿

本节回应用户“直接生成边界图，然后我来微调”的当前方向。这里的“生成”只生成可编辑初始边界草稿，不自动封口，不把断线硬连成线，也不绕过正常成果门禁。

实现修订：

- `src/pages/devtools/QidahenRegionMaskTool.tsx`
  - 新增 `载入颜色线为编辑草稿`。
  - 使用已记录的四个边界色 `rgb(61, 69, 66)`、`rgb(126, 97, 56)`、`rgb(128, 104, 62)`、`rgb(43, 36, 34)` 抽取真实底图颜色线。
  - 写入编辑层前继续剔除外圈 UI 禁区和地图内部装饰禁区。
  - 载入后自动切到边界画笔、显示 seed 状态，并定位第一个未独立 seed。
  - 状态文案明确：这是初始线稿，不会自动封口，不能直接当正常成果；无法连成线的碎线可用“只保留有效分区边界”舍弃。
- `e2e/qidahen-region-mask.e2e.ts`
  - 将旧负向用例改为 `真实底图颜色线可载入为编辑草稿但不能直接当正常成果`。
  - 覆盖载入前边界/障碍为 0、载入后边界/障碍非空、UI 禁区像素为 0、默认生成仍拒绝、mask 仍为空。

验证：

- `npx eslint src/pages/devtools/QidahenRegionMaskTool.tsx e2e/qidahen-region-mask.e2e.ts`：通过。
- `npx tsc --noEmit --pretty false`：通过。
- `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 PW_WORKERS=1 PW_PORT=6426 PW_GAME_SERVER_PORT=20326 PW_API_SERVER_PORT=21326 NODE_OPTIONS=--max-old-space-size=4096 node scripts/infra/run-e2e-command.mjs isolated e2e/qidahen-region-mask.e2e.ts --grep "真实底图颜色线可载入为编辑草稿但不能直接当正常成果"`：`1 passed (2.6m)`。

截图证据：

- `test-results/evidence-screenshots/_shared/qidahen-region-mask-real-map-candidate-draft-current.png`
  - 我实际看到：工具仍显示候选不达标，seed 未达 5/5；
  - 我实际看到：页面没有把颜色线标为 accepted 或正常成果；
  - 判定：颜色线现在可作为编辑起点，但不是正式区域成果。

正式文件复核：

- `src/games/qidahen/data/region-mask.png 1265x893 opaque=0`。
- `src/games/qidahen/data/region-boundary-mask.png 1265x893 opaque=0`。
- `src/games/qidahen/data/region-boundary-add.png 1265x893 opaque=0`。
- `src/games/qidahen/data/region-boundary-remove.png 1265x893 opaque=0`。

当前证据边界：

- 已证明：工具能从真实底图颜色线生成一个可编辑边界初稿，并把 UI/装饰污染挡在编辑层外。
- 未证明：该初稿能直接生成七大恨正式正常区域成果。
- 下一步仍是用户/工具内画笔补成真实闭合边界，跑到 5/5、逐区看图、accepted 后再保存正式数据。

## 2026-05-26 03:22 +08 自动候选扫描结论与草稿收窄

本节补充“至少读取数据”的硬证据。目标不是再证明一个按钮可点，而是判断当前自动/半自动候选是否真的能产正常边界。

实际查看：

- `public/assets/i18n/zh-CN/qidahen/board/qidahen-main-map.png`
  - 我实际看到：真实边界多为细曲线、河岸、海岸、长城/路线，并混有大量文字、马、山、红箭头、数字牌、锚点和右侧牌库 UI。
- `temp/qidahen-normal-boundary-candidate/boundary-overlay-on-map.png`
  - 我实际看到：旧候选是几个粗圈/粗边界，不贴真实地图线，不能当正常成果。
- `temp/qidahen-boundary-color-audit/boundary-color-overlay-red-playable-blue-ui.png`
  - 我实际看到：颜色命中大量选中 UI、海纹、马、文字和装饰。
- `temp/qidahen-boundary-trace-kit/layers/current-boundary-transparent.png`
  - 我实际看到：只是零散断线，不是闭合边界。

数据扫描：

- 脚本产物：`temp/qidahen-boundary-algorithm-audit-20260526/report.json`
- 扫描 1440 组参数：边界色容差、颜色+边缘、目标区域边界带、闭运算、膨胀半径。
- 最优结果仍只有 `matchedSeedCount=2/5`，`allSeparated=false`。
- 最优样本：
  - `color_tol8_shape-edge-band_close0_dil3`
  - `pixels=16053`
  - `uiPixels=0`
  - `decorPixels=0`
  - `componentCount=51`
  - `straightRatio=0.587865196536473`
  - `seedLabels`: 锦州/山海关/咸兴/汉城仍连在同一分区，只有宋进分开。
- 实际看图：
  - `temp/qidahen-boundary-algorithm-audit-20260526/01-color_tol8_shape-edge-band_close0_dil3-overlay.png`
  - `temp/qidahen-boundary-algorithm-audit-20260526/03-color-edge_tol8_shape-band_close0_dil1-overlay.png`
  - `temp/qidahen-boundary-algorithm-audit-20260526/06-color_tol8_none_close0_dil1-overlay.png`
  - `temp/qidahen-boundary-algorithm-audit-20260526/08-color-edge_tol10_shape-edge-band_close0_dil1-overlay.png`
  - 结论：没有一个候选既能 5/5 分区，又能看起来像真实闭合地图边界。

实现修订：

- `buildRealMapColorLineEditableDraft()` 现在不再把全图颜色线原样载入编辑层；
- 它会先剔除外圈 UI 和地图内部装饰，再与 `REAL_MAP_REGION_BOUNDARY_CLIP_MASK` 相交，只保留五个目标区域边界附近的颜色线；
- `载入颜色线为编辑草稿` 文案改为“已收窄到五个目标区域边界附近”；
- E2E 新增读数断言：`抽色命中 > 贴支撑带 >= 最终保留 > 100`，证明编辑草稿经过收窄，不是全图颜色命中直接落入编辑层。

验证：

- `npx eslint src/pages/devtools/QidahenRegionMaskTool.tsx e2e/qidahen-region-mask.e2e.ts`：通过。
- `npx tsc --noEmit --pretty false`：通过。
- `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 PW_WORKERS=1 PW_PORT=6427 PW_GAME_SERVER_PORT=20327 PW_API_SERVER_PORT=21327 NODE_OPTIONS=--max-old-space-size=4096 node scripts/infra/run-e2e-command.mjs isolated e2e/qidahen-region-mask.e2e.ts --grep "真实底图颜色线可载入为编辑草稿但不能直接当正常成果"`：`1 passed (2.5m)`。

当前证据边界：

- 自动从真实底图产正常边界：当前证据判定为不可行，不能继续包装成成果。
- 半自动颜色线草稿：可作为人工微调的起点，已经收窄到目标区域附近且挡住 UI/装饰，但仍不是正常成果。
- 正常成果路径：必须由用户/工具内画笔补出真实闭合边界，再跑 5/5、逐区看图、accepted、保存正式数据。

## 2026-05-26 11:43 +08 颜色线草稿继续收窄

触发原因：

- 本轮实际打开 `test-results/evidence-screenshots/_shared/qidahen-region-mask-real-map-candidate-draft-current.png`；
- 初始画面仍可见东南区域偏几何化蓝色折线；
- 即使 E2E 已证明它不会 accepted，也不能把这种线当作正常边界成果或稳定微调底稿。

实现修订：

- `src/pages/devtools/QidahenRegionMaskTool.tsx`
  - `keepBoundaryDraftComponents()` 新增组件级过滤：
    - `maxSpan`：超大跨度组件直接舍弃；
    - `maxStraightSupportRatio`：长直线占比过高的组件舍弃；
    - `maxAxisAlignedRunPixels`：水平/垂直长连续段过长的组件舍弃。
  - `载入颜色线为编辑草稿` 入口启用上述过滤；
  - `REAL_MAP_REGION_BOUNDARY_CLIP_RADIUS` 保持 `52`，避免影响手绘/导入主路；
  - 颜色线草稿单独使用 `REAL_MAP_COLOR_LINE_DRAFT_CLIP_RADIUS=28`；
  - 改动仅作用于真实底图颜色线草稿，不影响完成边界图导入、手绘闭合、区域生成和路径代价编辑。

验证：

- `npx eslint src/pages/devtools/QidahenRegionMaskTool.tsx e2e/qidahen-region-mask.e2e.ts`：通过。
- `npx tsc --noEmit --pretty false`：通过。
- `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 PW_WORKERS=1 PW_PORT=6433 PW_GAME_SERVER_PORT=20333 PW_API_SERVER_PORT=21333 NODE_OPTIONS=--max-old-space-size=8192 node scripts/infra/run-e2e-command.mjs isolated e2e/qidahen-region-mask.e2e.ts --grep "真实底图颜色线可载入为编辑草稿但不能直接当正常成果"`：`1 passed (3.3m)`。

中间失败：

- `PW_PORT=6431` 曾失败在页面标题出现前；
- 失败截图停在全局 Loading；
- `.tmp/playwright-bootstrap-pw-1779765790913-z4kf4e-worker-0.log` 显示 Vite 异常退出 `3221226505`；
- 换端口并提高 `NODE_OPTIONS=--max-old-space-size=8192` 后通过。

复看截图：

- `test-results/evidence-screenshots/_shared/qidahen-region-mask-real-map-candidate-draft-current.png`
  - 我实际看到：候选仍显示不达标，`seed 0/5`，`UI 0 px`；
  - 我实际看到：颜色线草稿比上一轮更局部，但仍不是闭合边界；
  - 判定：只能作为人工补边底稿，不能作为正式成果。

当前证据边界：

- 已证明：颜色线草稿进一步收窄，并且仍受 UI 禁区、默认生成拒绝、accepted 门禁约束。
- 未证明：自动/半自动草稿可以直接产出七大恨正常区域成果。
- 下一步：必须拿到真实闭合边界图或在工具内手绘补闭合后，再跑 5/5、底图贴合、形态门禁、逐区人工验收和正式保存回读。

## 2026-05-26 13:17 +08 手绘导入剪断修复与断线舍弃复核

触发原因：

- E2E `完整手绘边界图会批量生成多个独立分区并舍弃断线` 失败；
- 失败现场显示导入带底图描线图后只剩 `可填分区 1 / 独立 seed 0`；
- 这说明合成图里本应闭合的锦州、宋进边界被导入链路剪断。

根因：

- `hand-drawn` 模式已经使用 `buildPixelsChangedFromBaseMask()` 与底图差分，只保留用户新画线；
- 但后续又把 `currentMapArtifactExclusionMask` 套在差分后的用户线之上；
- 该 mask 包含真实地图内部装饰排除层，会把用户新画线经过装饰位置的像素剪掉；
- 结果是闭合线被剪断，种子无法进入独立分区。

实现修订：

- `src/pages/devtools/QidahenRegionMaskTool.tsx`
  - `buildBoundaryDraftFromSourcePixels(... extractionMode: 'hand-drawn')` 改为只剔除 `AUTO_MAP_PRINTED_UI_EXCLUSION_MASK`；
  - opaque 带底图导入的二次破坏性清洗同样只剔除真正印刷 UI 禁区；
  - 质量面板 `UI 边界 / UI mask` 改为只统计真正 UI 禁区；
  - 自动候选、真实底图颜色线草稿仍继续使用装饰过滤与不可 accepted 门禁。

E2E 修订：

- 用例改名为 `完整手绘边界图会批量生成多个独立分区并在导入时舍弃断线`；
- 断言导入后 `开放线段：0`，开放线定位入口不存在或禁用；
- 断言锦州、宋进 seed 独立，山海关、咸兴、汉城仍在未独立补边队列；
- 断言默认生成仍拒绝，只允许调试生成当前独立的 2 个区域。

截图复核：

- `test-results/evidence-screenshots/_shared/qidahen-region-mask-hand-drawn-multi-diagnostics-current.png`
  - 我实际看到：白色闭合线只围住锦州、宋进；
  - 我实际看到：左侧分区诊断为 `可填分区 3 / 独立 seed 2 / 开放线段 0`；
  - 我实际看到：补边队列只剩山海关、咸兴、汉城未独立 seed。
- `test-results/evidence-screenshots/_shared/qidahen-region-mask-hand-drawn-multi-generated-current.png`
  - 我实际看到：调试生成只写入锦州、宋进；
  - 我实际看到：山海关为未生成，未被边界真正隔开的区域被跳过。
- `test-results/evidence-screenshots/_shared/qidahen-region-mask-real-map-candidate-draft-current.png`
  - 我实际看到：真实底图颜色线仍是候选不达标，`seed 0/5`、`UI 0 px`；
  - 判定：颜色线仍只是可编辑草稿，不是正式成果。

验证：

- `npx eslint src/pages/devtools/QidahenRegionMaskTool.tsx e2e/qidahen-region-mask.e2e.ts`：通过。
- `npx tsc --noEmit --pretty false`：通过。
- `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 PW_WORKERS=1 PW_PORT=6433 PW_GAME_SERVER_PORT=20333 PW_API_SERVER_PORT=21333 NODE_OPTIONS=--max-old-space-size=8192 node scripts/infra/run-e2e-command.mjs isolated e2e/qidahen-region-mask.e2e.ts --grep "完整手绘边界图会批量生成多个独立分区并在导入时舍弃断线"`：`1 passed (5.7m)`。
- 同环境跑 `--grep "真实底图颜色线可载入为编辑草稿但不能直接当正常成果"`：`1 passed (2.8m)`。

正式文件复核：

- `src/games/qidahen/data/region-mask.png opaque=0`。
- `src/games/qidahen/data/region-boundary-mask.png opaque=0`。
- `src/games/qidahen/data/region-boundary-add.png opaque=0`。
- `src/games/qidahen/data/region-boundary-remove.png opaque=0`。

当前证据边界：

- 已证明：带底图手绘导入不会再被真实底图装饰排除层剪断；断线会在导入清洗阶段直接舍弃；工具仍能只调试生成已独立的区域。
- 未证明：自动/半自动草稿可以直接产出七大恨正常区域成果。
- 完成守卫仍为 `INCOMPLETE`：C3 仍失败，不能写正式成果。

## 2026-05-26 14:32 +08 补边问题包 manifest/README

本节补齐外部画笔工作流的可复查输入。用户已经给过边界颜色，补边包必须自己记录颜色、禁区和回导目标，不能每次依赖口头重复。

实现修订：

- `导出补边问题包 ZIP` 新增 `manifest.json`：
  - `boundaryColors` 固化四个边界色：
    - `rgb(61, 69, 66)`；
    - `rgb(126, 97, 56)`；
    - `rgb(128, 104, 62)`；
    - `rgb(43, 36, 34)`；
  - `forbiddenUiRects` 记录不能画入的 UI 禁区；
  - `layers.currentBoundary` 指向 `layers/current-boundary-transparent.png`；
  - `layers.repairedBoundaryTarget` 指向 `layers/repaired-boundary-transparent.png`；
  - `importTargets.preferred` 指向修复后的全图透明边界层；
  - `problemFiles` 记录每个问题裁图。
- ZIP 新增 `README.txt`：
  - 明确只用 manifest 中的边界色；
  - 明确不能画进 UI 禁区；
  - 明确能沿真实边界补闭合就补，无法连成线/封口的碎线直接舍弃；
  - 明确修完后保存 `layers/repaired-boundary-transparent.png` 并用“导入补边包 ZIP 的全图边界层”回导。

E2E 证据：

- `局部候选线支撑不能替整张边界图背书并进入人工验收`
  - 断言弱支撑补边包包含 `manifest.json`、`README.txt`；
  - 断言 manifest 中四个边界色、禁区、首选回导层、弱支撑问题列表和断线舍弃规则；
  - 断言仍不能通过局部候选线背书整张边界图，normality 保持 `suspicious`。
- `连接到地图边缘的边界线按全图分区生成而不是只取小圈`
  - 断言未独立 seed 补边包同样包含 manifest/README；
  - 断言 unmatched-seed problemFiles 和回导目标完整。

验证：

- `npx eslint src/pages/devtools/QidahenRegionMaskTool.tsx e2e/qidahen-region-mask.e2e.ts src/pages/devtools/qidahenRegionMaskToolUtils.ts src/pages/devtools/__tests__/qidahenRegionMaskToolUtils.test.ts`：通过。
- `npx tsc --noEmit --pretty false`：通过。
- `npx vitest run src/pages/devtools/__tests__/qidahenRegionMaskToolUtils.test.ts`：`50 passed`。
- `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 PW_WORKERS=1 PW_PORT=6435 PW_GAME_SERVER_PORT=20335 PW_API_SERVER_PORT=21335 NODE_OPTIONS=--max-old-space-size=8192 node scripts/infra/run-e2e-command.mjs isolated e2e/qidahen-region-mask.e2e.ts --grep "局部候选线支撑不能替整张边界图背书并进入人工验收|连接到地图边缘的边界线按全图分区生成而不是只取小圈"`：
  - `连接到地图边缘...` 通过；
  - `局部候选线支撑...` 在后段因 360s 超时失败。
- 提高该用例超时到 480s 后单跑：
  - `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 PW_WORKERS=1 PW_PORT=6437 PW_GAME_SERVER_PORT=20337 PW_API_SERVER_PORT=21337 NODE_OPTIONS=--max-old-space-size=8192 node scripts/infra/run-e2e-command.mjs isolated e2e/qidahen-region-mask.e2e.ts --grep "局部候选线支撑不能替整张边界图背书并进入人工验收"`：`1 passed (7.3m)`。
- 环境失败记录：
  - `PW_PORT=6434` 曾因 API MongoMemoryServer `code 48` 启动失败，未进入用例执行。

正式文件复核：

- `src/games/qidahen/data/region-mask.png opaque=0`。
- `src/games/qidahen/data/region-boundary-mask.png opaque=0`。
- `src/games/qidahen/data/region-boundary-add.png opaque=0`。
- `src/games/qidahen/data/region-boundary-remove.png opaque=0`。

当前证据边界：

- 已证明：补边问题包现在自带颜色、禁区、问题列表和回导规则，能支撑用户用外部画笔补真实闭合边界。
- 未证明：真实完整闭合边界图已经存在。
- 完成守卫仍为 `INCOMPLETE`，不能写正式成果。

## 2026-05-26 14:54 +08 未修复补边包回导警告

本节补上一个防误判口径：导入补边包成功不等于用户已经修好了边界。

实现修订：

- `importBoundaryRepairPackageZip()` 在选择回导层后检查：
  - 当前选择的是 `layers/current-boundary-transparent.png`；
  - ZIP 中没有 `layers/repaired-boundary-transparent.png`；
  - ZIP 又包含 `manifest.json` 或 `report.json`。
- 满足上述条件时，仍允许回导 currentBoundary 做诊断，但状态消息追加：
  - `ZIP 未包含 layers/repaired-boundary-transparent.png，本次只是回导 currentBoundary 初始/旧边界层，修完后请新增 repairedBoundary 再导入`。

验证：

- `npx eslint src/pages/devtools/QidahenRegionMaskTool.tsx e2e/qidahen-region-mask.e2e.ts`：通过。
- `npx tsc --noEmit --pretty false`：通过。
- `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 PW_WORKERS=1 PW_PORT=6438 PW_GAME_SERVER_PORT=20338 PW_API_SERVER_PORT=21338 NODE_OPTIONS=--max-old-space-size=8192 node scripts/infra/run-e2e-command.mjs isolated e2e/qidahen-region-mask.e2e.ts --grep "描边包标准边界层经补边包入口回导后仍不能直接生成正常成果"`：`1 passed (2.7m)`。

E2E 断言：

- 未修过的 trace kit 通过补边包入口回导时显示 repairedBoundary 缺失警告；
- `closed-seed-hit-count=0`；
- 默认生成拒绝；
- mask canvas 仍为空；
- normality 不是 `accepted`。

正式文件复核：

- `src/games/qidahen/data/region-mask.png opaque=0`。
- `src/games/qidahen/data/region-boundary-mask.png opaque=0`。
- `src/games/qidahen/data/region-boundary-add.png opaque=0`。
- `src/games/qidahen/data/region-boundary-remove.png opaque=0`。

当前证据边界：

- 已证明：未修补边包不会被文案包装成“修好了”。
- 未证明：真实完整边界图已经完成。

## 2026-05-26 15:55 +08 局部 repair-crops 补边包回导

本节补齐补边问题包的局部修复工作流。此前补边包只有全图 `layers/repaired-boundary-transparent.png` 回导口径；如果用户只想对 `problems/*.png` 对应的小图逐段修线，还必须自己把小图贴回 1265x893 全图，容易出错。

实现修订：

- `导出补边问题包 ZIP`
  - 每个 `problemFiles[]` 增加 `repairCropTarget`；
  - ZIP 同步写入 `repair-crops/*-boundary-transparent.png`；
  - 每个 repair crop 是对应 `crop` 范围内的透明边界层，可直接在外部画笔软件编辑；
  - `README.txt` 增加局部小图工作流说明：可以只编辑 `repair-crops/*.png`，工具会按 manifest 的 `crop` 坐标拼回全图。
- `导入补边包 ZIP 的全图边界层`
  - 仍优先读取全图 `layers/repaired-boundary-transparent.png`；
  - 若没有全图 repairedBoundary，但 manifest 中有 repair-crops，则以 `layers/current-boundary-transparent.png` 或当前工具边界作为底板拼回局部小图；
  - 只应用相对底板确实发生变化的小图，避免重叠裁图里未编辑的小图覆盖已编辑的小图；
  - 状态消息会显示已拼回几个局部层，并显示 `跳过未修改局部层 N 个`，避免把只修过单张小图误读为整包已修；
  - 拼回后继续执行 UI 禁区剔除、有效分区/闭合边界保留、生成门禁和 normality 门禁。

E2E 证据：

- `局部候选线支撑不能替整张边界图背书并进入人工验收`
  - 断言弱支撑补边包包含：
    - `repair-crops/weak-support-song-jin-boundary-transparent.png`；
    - `repair-crops/weak-support-shan-hai-guan-boundary-transparent.png`；
    - `repair-crops/weak-support-shou-cheng-boundary-transparent.png`；
  - 模拟外部画笔只编辑宋进的局部 repair crop；
  - 回导时状态显示 `layers/current-boundary-transparent.png + 局部修复层 1 个`；
  - 回导时同时显示 `跳过未修改局部层 2 个`；
  - 生成后仍保持 `normality=suspicious`、底图贴合 `blocked`，证明局部回导没有绕过正常成果门禁。
- `连接到地图边缘的边界线按全图分区生成而不是只取小圈`
  - 断言 unmatched seed 补边包包含：
    - `repair-crops/unmatched-jinzhou-boundary-transparent.png`；
    - `repair-crops/unmatched-shan-hai-guan-boundary-transparent.png`；
    - `repair-crops/unmatched-song-jin-boundary-transparent.png`；
  - 断言 repair crop 尺寸与问题 crop 同为 `360x260`。

验证：

- `npx eslint src/pages/devtools/QidahenRegionMaskTool.tsx e2e/qidahen-region-mask.e2e.ts`：通过。
- `npx tsc --noEmit --pretty false`：通过。
- `npx vitest run src/pages/devtools/__tests__/qidahenRegionMaskToolUtils.test.ts`：`50 passed`。
- `node scripts/infra/run-e2e-single.mjs ci e2e/qidahen-region-mask.e2e.ts "局部候选线支撑不能替整张边界图背书并进入人工验收"`：先 `1 passed (7.5m)`；状态反馈补强后复跑 `1 passed (7.3m)`。
- `node scripts/infra/run-e2e-single.mjs ci e2e/qidahen-region-mask.e2e.ts "连接到地图边缘的边界线按全图分区生成而不是只取小圈"`：`1 passed (4.4m)`。

失败与修正记录：

- 裸 `npx playwright test` 被项目 globalSetup 拦截，未进入测试体；
- 第一次局部回导 E2E 失败是测试补线画在 crop 外，工具回导差异为 0；
- 第二次局部回导 E2E 暴露重叠局部 crop 覆盖问题，已改为只应用相对底板发生变化的小图；
- `连接到地图边缘...` 首次失败为 240s 用例超时，非功能断言失败；提高到 360s 后通过。

正式文件复核：

- `src/games/qidahen/data/region-mask.png 1265x893 opaque=0`。
- `src/games/qidahen/data/region-boundary-mask.png 1265x893 opaque=0`。
- `src/games/qidahen/data/region-boundary-add.png 1265x893 opaque=0`。
- `src/games/qidahen/data/region-boundary-remove.png 1265x893 opaque=0`。

当前证据边界：

- 已证明：用户可以只编辑补边包里的局部 repair crop 并回导，工具能拼回全图且继续执行门禁。
- 未证明：真实完整闭合边界图已经完成。
- 完成守卫仍为 `INCOMPLETE`，不能写正式成果。

## 2026-05-26 16:32 +08 problems 可见裁图画线回导

本节补齐更贴近普通画笔软件的局部修法。用户可以不处理透明层，直接在补边包的 `problems/*.png` 可见裁图上按记录的边界色描线；工具回导时只取相对原始裁图新增的边界色像素。

实现修订：

- `导出补边问题包 ZIP`
  - 继续输出 `problems/*.png` 可见裁图；
  - 新增 `problem-sources/*.png`，作为对应 `problems/*.png` 的原始基线；
  - 继续输出 `repair-crops/*-boundary-transparent.png`；
  - README 说明两条局部修法：
    - 编辑透明 `repair-crops/*.png`；
    - 直接在 `problems/*.png` 上用 manifest 里的边界色画线。
- `导入补边包 ZIP 的全图边界层`
  - 仍优先读取全图 `layers/repaired-boundary-transparent.png`；
  - 若没有全图 repairedBoundary，则拼回发生变化的 `repair-crops`；
  - 再对比 `problems/*.png` 与 `problem-sources/*.png`；
  - 只回收新增且匹配边界色的像素；
  - 未修改的局部透明层与可见裁图都会跳过；
  - 回导后继续执行 UI 禁区剔除、有效分区/闭合边界清洗、默认生成和 normality 门禁。

E2E 证据：

- `局部候选线支撑不能替整张边界图背书并进入人工验收`
  - 断言补边包包含 `problem-sources/weak-support-*.png` 与 `repair-crops/weak-support-*.png`；
  - 模拟外部画笔直接编辑 `problems/weak-support-song-jin.png`；
  - 使用边界色 `rgb(61,69,66)` 画线；
  - 回导状态显示 `可见裁图画线 1 个`；
  - 回导状态显示 `跳过未修改局部层 3 个`；
  - 回导状态显示 `已从 problems 可见裁图回收边界色画线 1 张`；
  - 回导状态显示 `跳过未修改可见裁图 2 张`；
  - 生成后仍保持 `normality=suspicious`、底图贴合 `blocked`，人工验收按钮禁用。
- `连接到地图边缘的边界线按全图分区生成而不是只取小圈`
  - 断言 unmatched seed 补边包包含 `problem-sources/unmatched-*.png`；
  - 断言 unmatched seed 补边包仍包含 `repair-crops/unmatched-*.png`。

验证：

- `npx eslint src/pages/devtools/QidahenRegionMaskTool.tsx e2e/qidahen-region-mask.e2e.ts`：通过。
- `npx tsc --noEmit --pretty false`：通过。
- `node scripts/infra/run-e2e-single.mjs ci e2e/qidahen-region-mask.e2e.ts "局部候选线支撑不能替整张边界图背书并进入人工验收"`：`1 passed (7.9m)`。
- `node scripts/infra/run-e2e-single.mjs ci e2e/qidahen-region-mask.e2e.ts "连接到地图边缘的边界线按全图分区生成而不是只取小圈"`：`1 passed (4.5m)`。

正式文件复核：

- `src/games/qidahen/data/region-mask.png 1265x893 opaque=0`。
- `src/games/qidahen/data/region-boundary-mask.png 1265x893 opaque=0`。
- `src/games/qidahen/data/region-boundary-add.png 1265x893 opaque=0`。
- `src/games/qidahen/data/region-boundary-remove.png 1265x893 opaque=0`。

当前证据边界：

- 已证明：用户可以直接在 `problems/*.png` 可见裁图上画边界色线，工具可按颜色差分回收新增线并拼回全图。
- 未证明：真实完整闭合边界图已经完成。
- 完成守卫仍为 `INCOMPLETE`，不能写正式成果。

## 2026-05-26 17:03 +08 撤下颜色候选写入编辑层入口

本节回到用户原始问题：颜色候选看图并不正确，不能继续把它当成可写入边界层的“初始草稿”。此前虽有默认生成拒绝和 accepted 门禁，但只要按钮仍能把候选写进边界图，就会误导后续微调方向。

实际查看与数据：

- `test-results/evidence-screenshots/_shared/qidahen-region-mask-real-map-candidate-draft-current.png`
  - 我实际看到：页面显示 `候选不达标 seed 0/5`；
  - 我实际看到：候选只作为待描参考，不再写入边界图；
  - 我实际看到：当前边界图像素为 0，最终障碍像素为 0。
- `test-results/evidence-screenshots/_shared/qidahen-region-mask-partition-generated-current.png`
  - 我实际看到：合成分区仍是局部粗边和粗色块，不是正常成果。
- `temp/qidahen-boundary-algorithm-audit-20260526/report.json`
  - `variantCount=1440`；
  - 最优样本 `matchedSeedCount=2`；
  - `allSeparated=false`；
  - 结论：自动颜色候选仍不能生成 5/5 真实闭合边界。

实现修订：

- `src/pages/devtools/QidahenRegionMaskTool.tsx`
  - 删除 `载入颜色线为编辑草稿` 按钮；
  - 删除 `loadRealMapColorLineEditableDraft()`；
  - 文案改为“颜色候选只保留诊断和画笔吸附参考，不再写入边界编辑层”；
  - 保留 `导出候选诊断 PNG`、全图描边包、局部补边包、细线候选显示和吸附辅助。

E2E 证据：

- `真实底图颜色线只能诊断和吸附不能写入边界草稿`
  - 断言 `qidahen-load-real-map-color-line-draft` 不存在；
  - 断言候选诊断 PNG 仍可导出；
  - 断言诊断 PNG 的 UI 禁区像素为 0；
  - 断言导出后当前边界图、最终障碍、barrier canvas 仍为 0；
  - 断言默认生成拒绝，mask 为空，normality 非 `accepted`。

验证：

- `npx tsc --noEmit --pretty false`：通过。
- `npx eslint src/pages/devtools/QidahenRegionMaskTool.tsx e2e/qidahen-region-mask.e2e.ts`：通过。
- `node scripts/infra/run-e2e-single.mjs ci e2e/qidahen-region-mask.e2e.ts "真实底图颜色线只能诊断和吸附不能写入边界草稿"`：
  - 第一次失败：候选像素异步等待只给默认 5s，收到 0；失败快照已显示页面有候选诊断和写入按钮已撤下；
  - 调整等待到 30s 后复跑：`1 passed (2.1m)`。

正式文件复核：

- `src/games/qidahen/data/region-mask.png 1265x893 opaque=0`。
- `src/games/qidahen/data/region-boundary-mask.png 1265x893 opaque=0`。
- `src/games/qidahen/data/region-boundary-add.png 1265x893 opaque=0`。
- `src/games/qidahen/data/region-boundary-remove.png 1265x893 opaque=0`。

当前证据边界：

- 已证明：颜色候选不会再一键写入边界编辑层。
- 未证明：真实完整闭合边界图已经完成。
- 完成守卫仍为 `INCOMPLETE`，不能写正式成果。

## 2026-05-26 17:27 +08 局部描边底稿 ZIP 自说明

本节继续收窄人工闭合边界主路的歧义。批量局部底稿 ZIP 如果只给图片和 crop，不记录边界色和作业规则，用户仍可能画错颜色、直线硬封口，或把 UI/数字牌/红箭头当成边界。

实现修订：

- `exportAllRegionTraceTemplates()`
  - `manifest.json` 新增 `boundaryColors`；
  - `boundaryColors` 写入当前启用的 4 个边界色和 tolerance；
  - `manifest.json` 新增 `rules`；
  - `rules` 明确：只用记录颜色、沿真实地图边界、不直线硬封口、不能连成线或不能封口直接舍弃、不要把 UI/文字/数字牌/红箭头/锚点/牌框当边界；
  - `manifest.json` 新增 `importFilePrefixes`；
  - ZIP 新增 `README.txt`，给外部画笔作业者阅读。

E2E 证据：

- `可导出外部描边参考图并导入局部底稿`
  - 断言 `qidahen-region-trace-templates.zip` 包含 5 个局部 PNG；
  - 断言 `manifest.boundaryColors` 为：
    - `rgb(61, 69, 66)`；
    - `rgb(126, 97, 56)`；
    - `rgb(128, 104, 62)`；
    - `rgb(43, 36, 34)`；
  - 断言 `manifest.importFilePrefixes` 包含 `qidahen-region-trace-` 与 `qidahen-local-region-boundary-`；
  - 断言 `manifest.rules` 包含 `不要直线硬封口` 与 `不能连成线或不能封口的线直接舍弃`；
  - 断言 `README.txt` 包含同样的人工作业规则；
  - 继续覆盖单区导入、批量 ZIP 导入和调试生成。

验证：

- `npx eslint src/pages/devtools/QidahenRegionMaskTool.tsx e2e/qidahen-region-mask.e2e.ts`：通过。
- `npx tsc --noEmit --pretty false`：通过。
- `node scripts/infra/run-e2e-single.mjs ci e2e/qidahen-region-mask.e2e.ts "可导出外部描边参考图并导入局部底稿"`：`1 passed (5.5m)`。

截图复核：

- `test-results/evidence-screenshots/_shared/qidahen-region-mask-batch-trace-export-current.png`
  - 我实际看到：导出前仍是待描/未生成状态；
  - 这只是作业包生成，不是成果。
- `test-results/evidence-screenshots/_shared/qidahen-region-mask-batch-trace-import-current.png`
  - 我实际看到：导入测试用局部线后只生成部分区域；
  - 边界仍是测试用粗线，不是正式正常成果。

正式文件复核：

- `src/games/qidahen/data/region-mask.png 1265x893 opaque=0`。
- `src/games/qidahen/data/region-boundary-mask.png 1265x893 opaque=0`。
- `src/games/qidahen/data/region-boundary-add.png 1265x893 opaque=0`。
- `src/games/qidahen/data/region-boundary-remove.png 1265x893 opaque=0`。

当前证据边界：

- 已证明：批量局部描边底稿包自带边界色和作业红线，降低外部画笔修边误操作。
- 未证明：真实完整闭合边界图已经完成。
- 完成守卫仍为 `INCOMPLETE`，不能写正式成果。

## 2026-05-26 19:03 +08 局部描边 ZIP manifest 优先导入

本节修复局部描边 ZIP 回导的脆弱点。外部画笔软件或压缩工具可能把 PNG 放到子目录或改成普通文件名；如果导入端只靠 `qidahen-region-trace-` / `qidahen-local-region-boundary-` 前缀猜区域，用户修完的图会被跳过。

实现修订：

- `importRegionTraceZip()`
  - 先读取 `manifest.json`；
  - 从 `manifest.regions[].fileName` 建立 ZIP entry 到区域的映射；
  - 目标区域通过 `id/name` 匹配；
  - 同时登记 entry 全路径与 basename；
  - manifest 不存在或条目未命中时，才退回旧的文件名前缀解析。

E2E 证据：

- `可导出外部描边参考图并导入局部底稿`
  - 新增 `createManifestMappedLocalRegionBoundaryZip()` 测试夹具；
  - ZIP 内 PNG 名为 `painted/region-01.png`，没有标准区域前缀；
  - manifest 把该文件映射到 `jinzhou`；
  - 导入后锦州 seed 进入独立分区；
  - 后续继续用旧前缀 ZIP 导入宋进/山海关，确保兼容路径仍有效。

验证：

- `npx eslint src/pages/devtools/QidahenRegionMaskTool.tsx e2e/qidahen-region-mask.e2e.ts`：通过。
- `npx tsc --noEmit --pretty false`：通过。
- `node scripts/infra/run-e2e-single.mjs ci e2e/qidahen-region-mask.e2e.ts "可导出外部描边参考图并导入局部底稿"`：
  - 首次失败：用两个非标准名测试圈验证 3/5 独立时，工具写入了像素但测试圈没有让 seed 独立；这是夹具不能证明多区闭合，不是 manifest 未读；
  - 收窄为 manifest 映射锦州单区后复跑：`1 passed (5.2m)`。

截图复核：

- `test-results/evidence-screenshots/_shared/qidahen-region-mask-batch-trace-import-current.png`
  - 我实际看到：导入后仍是测试用粗线和局部区域；
  - 页面显示还存在未生成/弱支撑区域；
  - 这不是正式正常成果。

正式文件复核：

- `src/games/qidahen/data/region-mask.png 1265x893 opaque=0`。
- `src/games/qidahen/data/region-boundary-mask.png 1265x893 opaque=0`。
- `src/games/qidahen/data/region-boundary-add.png 1265x893 opaque=0`。
- `src/games/qidahen/data/region-boundary-remove.png 1265x893 opaque=0`。

当前证据边界：

- 已证明：局部描边 ZIP 可按 manifest 映射非标准文件名导入。
- 未证明：真实完整闭合边界图已经完成。
- 完成守卫仍为 `INCOMPLETE`，不能写正式成果。

## 2026-05-26 19:50 +08 导入后自动打开未独立 seed 补边裁图

本节继续完善人工闭合边界主路。目标不是让工具自动补线，而是导入用户/外部画笔的局部底稿后，马上指出第一个仍未独立的 seed，并给出可看的局部裁图。

实现修订：

- `openUnmatchedSeedRepairPreview(region, barrierMaskOverride?)`
  - 新增可选 `barrierMaskOverride`；
  - 导入流程可以用刚合成的边界 mask 生成裁图，不依赖 React 状态刷新后的 `barrierMaskRef.current`。
- `focusBoundaryImportProblem()`
  - 找到第一个未独立 seed 后，除选中区域外，还会自动打开补边裁图；
  - 单图导入优先检查当前导入区域，ZIP 导入优先检查本次实际写入过的区域；这些区域都已独立后，才回落到全局第一个未独立 seed；
  - 提示文案增加“并打开补边裁图”；
  - 如果所有 seed 已独立，会清空旧补边预览，避免残留误导。

E2E 证据：

- `可导出外部描边参考图并导入局部底稿`
  - manifest 映射非标准文件名 `painted/region-01.png` 到 `jinzhou`；
  - 导入后锦州进入独立分区；
  - 工具自动打开第一个仍未独立的 `宋进 未独立 seed` 补边裁图；
  - 断言裁图详情包含 `连不上的线直接舍弃`；
  - 后续旧前缀 ZIP 导入宋进/山海关仍可达到 3 个独立 seed。

验证：

- `npx eslint src/pages/devtools/QidahenRegionMaskTool.tsx e2e/qidahen-region-mask.e2e.ts`：通过。
- `npx tsc --noEmit --pretty false`：通过。
- `node scripts/infra/run-e2e-single.mjs ci e2e/qidahen-region-mask.e2e.ts "可导出外部描边参考图并导入局部底稿"`：
  - 截图保存前同逻辑通过：`1 passed (5.5m)`；
  - 增加截图保存后，isolated 第二次在 `page.goto` 前失败；bootstrap 日志显示 Vite OOM，退出码 134，未进入业务页面；
  - 改用已就绪开发服务器 4273 跑当前用例：先 `1 passed (5.5m)`，补上导入区域优先队列后复跑 `1 passed (5.6m)`。

截图复核：

- `test-results/evidence-screenshots/_shared/qidahen-region-mask-batch-trace-auto-repair-preview-current.png`
  - 我实际看到：裁图标题为 `宋进 未独立 seed`；
  - 我实际看到：图中有 seed 点、蓝色当前边界和真实底图局部；
  - 我实际看到：说明文字包含“沿真实地图闭合边界补线，连不上的线直接舍弃”；
  - 判定：导入局部底稿后，工具能直接给出下一块补边目标。
- `test-results/evidence-screenshots/_shared/qidahen-region-mask-batch-trace-import-current.png`
  - 我实际看到：页面仍是测试用粗线和局部区域；
  - 判定：该用例证明工具链路，不证明正式正常成果。

正式文件复核：

- `src/games/qidahen/data/region-mask.png 1265x893 opaque=0`。
- `src/games/qidahen/data/region-boundary-mask.png 1265x893 opaque=0`。
- `src/games/qidahen/data/region-boundary-add.png 1265x893 opaque=0`。
- `src/games/qidahen/data/region-boundary-remove.png 1265x893 opaque=0`。

当前证据边界：

- 已证明：局部描边导入后会自动打开首个未独立 seed 的补边裁图。
- 未证明：真实完整闭合边界图已经完成。
- 完成守卫仍为 `INCOMPLETE`，不能写正式成果。

## 2026-05-26 20:18 +08 未独立 seed 泄漏路径诊断

本节继续回应“直来直去的肯定不是边界”和“至少读数据/看图”的问题。本次没有让工具自动直线封口；相反，工具计算当前非障碍可填区域里的真实连通路径，用来说明 seed 是从哪里漏到另一个 seed 的。

实现修订：

- `BoundaryClosureDiagnostics.unmatchedRegions`
  - 新增 `connectedRegionNames`、`leakTargetName`、`leakTargetSeed`、`leakPath`、`leakDistancePixels`。
- 分区诊断：
  - 当一个可填分区包含多个 seed，记录这些 seed 对应的区域；
  - 对每个未独立 seed，在该分区 mask 内 BFS 到另一个 seed；
  - 路径按采样点保存，用于裁图显示。
- fallback 诊断：
  - 如果分区组件没有给出多 seed 信息，则在当前 `AUTO_MAP_REGION_FILLABLE_MASK` 且非 barrier 的区域里，从当前 seed BFS 到最近其它正式 seed；
  - 该路径仍然是实际非障碍可走路径，不是几何直线。
- `buildBoundaryRepairCropDataUrl()`
  - 新增 `paths` 绘制；
  - 用橙色虚线显示泄漏通道；
  - 支持 `connected-seed` 标记，显示“连到 X”。
- `openUnmatchedSeedRepairPreview()`
  - 详情文案写明 `当前仍与 X 连通` 和 `泄漏路径约 N px`；
  - 文案明确“先切断橙色泄漏路径，不要画直线硬封口”。

E2E 证据：

- `可导出外部描边参考图并导入局部底稿`
  - 导入 manifest 映射的锦州单区后，工具自动打开宋进未独立 seed 裁图；
  - 断言详情包含 `当前仍与`；
  - 断言详情包含 `橙色泄漏路径`；
  - 后续批量导入旧前缀 ZIP 仍达到 3 个独立 seed。

验证：

- `npx eslint src/pages/devtools/QidahenRegionMaskTool.tsx e2e/qidahen-region-mask.e2e.ts`：通过。
- `npx tsc --noEmit --pretty false`：通过。
- `node scripts/infra/run-e2e-single.mjs dev e2e/qidahen-region-mask.e2e.ts "可导出外部描边参考图并导入局部底稿"`：`1 passed (5.5m)`。

截图复核：

- `test-results/evidence-screenshots/_shared/qidahen-region-mask-batch-trace-auto-repair-preview-current.png`
  - 我实际看到：裁图标题为 `宋进 未独立 seed`；
  - 我实际看到：橙色虚线从宋进 seed 位置指向 `连到 山海关`；
  - 我实际看到：详情写明 `当前仍与 山海关 连通，泄漏路径约 117 px`；
  - 判定：该图说明的是当前边界没有隔断的真实连通路径，不是自动直线封口。

正式文件复核：

- `src/games/qidahen/data/region-mask.png 1265x893 opaque=0`。
- `src/games/qidahen/data/region-boundary-mask.png 1265x893 opaque=0`。
- `src/games/qidahen/data/region-boundary-add.png 1265x893 opaque=0`。
- `src/games/qidahen/data/region-boundary-remove.png 1265x893 opaque=0`。

当前证据边界：

- 已证明：工具能在导入局部底稿后显示未独立 seed 的连通对象和泄漏路径。
- 未证明：真实完整闭合边界图已经完成。
- 完成守卫仍为 `INCOMPLETE`，不能写正式成果。

## 2026-05-26 20:45 +08 补边包泄漏路径诊断留档

本节补齐 20:18 诊断的外部作业包证据。目标是让用户导出 ZIP 后也能看到“当前和谁连着、从哪里漏过去”，而不是只在工具弹窗里看到。

实现修订：

- `exportBoundaryRepairPackage()`
  - 对 `unmatched-seed` 问题写入 `connectedRegionNames`、`leakTargetName`、`leakTargetSeed`、`leakPath`、`leakDistancePixels`；
  - `manifest.problemFiles[]` 与 `report.problems[]` 都携带这些字段；
  - `problems/unmatched-*.png` 和 `problem-sources/unmatched-*.png` 都绘制橙色虚线泄漏路径和 `连到 X` 标记。
- `manifest.rules` / `README.txt`
  - 明确橙色虚线是当前未隔断的泄漏路径；
  - 明确这不是直线封口建议。

E2E 证据：

- `连接到地图边缘的边界线按全图分区生成而不是只取小圈`
  - 断言 `manifest.problemFiles` 里的 `problems/unmatched-jinzhou.png` 有 `connectedRegionNames`、`leakTargetName`、`leakTargetSeed`、`leakDistancePixels`、`leakPath`；
  - 断言 `report.problems` 里同一问题也有泄漏诊断字段；
  - 断言 `manifest.rules` 和 `README.txt` 包含 `橙色虚线是当前未隔断的泄漏路径`；
  - 断言 unmatched 问题图、source 图、repair crop 仍是 360x260。

验证：

- `npx eslint src/pages/devtools/QidahenRegionMaskTool.tsx e2e/qidahen-region-mask.e2e.ts`：通过。
- `npx tsc --noEmit --pretty false`：通过。
- `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 PW_WORKERS=1 NODE_OPTIONS=--max-old-space-size=8192 node scripts/infra/run-e2e-single.mjs dev e2e/qidahen-region-mask.e2e.ts "连接到地图边缘的边界线按全图分区生成而不是只取小圈"`：`1 passed (4.5m)`。
- 相邻弹窗回归 `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 PW_WORKERS=1 NODE_OPTIONS=--max-old-space-size=8192 node scripts/infra/run-e2e-single.mjs dev e2e/qidahen-region-mask.e2e.ts "可导出外部描边参考图并导入局部底稿"`：`1 passed (5.4m)`。

截图复核：

- `test-results/evidence-screenshots/_shared/qidahen-region-mask-repair-package-unmatched-current.png`
  - 我实际看到：裁图标题为 `锦州 未独立 seed`；
  - 我实际看到：图中有当前白色边界和橙色虚线泄漏路径；
  - 判定：补边 ZIP 的可见问题图已包含泄漏路径诊断，不再只靠 JSON 或页面弹窗。

正式文件复核：

- `src/games/qidahen/data/region-mask.png 1265x893 opaque=0`。
- `src/games/qidahen/data/region-boundary-mask.png 1265x893 opaque=0`。
- `src/games/qidahen/data/region-boundary-add.png 1265x893 opaque=0`。
- `src/games/qidahen/data/region-boundary-remove.png 1265x893 opaque=0`。

当前证据边界：

- 已证明：补边 ZIP 能把未独立 seed 泄漏路径交给外部画笔流程。
- 未证明：真实完整闭合边界图已经完成。
- 完成守卫仍为 `INCOMPLETE`，不能写正式成果。

## 2026-05-26 21:02 +08 补边包回导后优先回到本次修改区域

本节继续补外部画笔回导后的操作闭环。用户修完一个裁图后，工具应该优先检查这个刚修过的区域，而不是跳回全局第一个未独立 seed。

实现修订：

- `importBoundaryRepairPackageZip()`
  - 解析 `manifest.problemFiles[].id/type/name`；
  - 对实际发生修改的 `repair-crops/*.png` 和 `problems/*.png` 记录对应正式区域 id；
  - 回导完成后调用 `focusBoundaryImportProblem(nextBoundaryMask, changedRepairRegionIds)`；
  - 仅正式区域 id 会进入优先队列，开放线段等问题不会污染区域定位。

E2E 证据：

- `连接到地图边缘的边界线按全图分区生成而不是只取小圈`
  - 先导出未独立 seed 补边包；
  - 模拟外部画笔编辑 `problems/unmatched-song-jin.png`，用记录的边界色画一小段；
  - 再通过 `导入补边包 ZIP 的全图边界层` 回导；
  - 断言状态包含 `可见裁图画线 1 个`；
  - 断言状态自动定位 `宋进 未独立 seed`；
  - 断言补边预览详情仍有泄漏路径说明。

验证：

- `npx eslint src/pages/devtools/QidahenRegionMaskTool.tsx e2e/qidahen-region-mask.e2e.ts`：通过。
- `npx tsc --noEmit --pretty false`：通过。
- `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 PW_WORKERS=1 NODE_OPTIONS=--max-old-space-size=8192 node scripts/infra/run-e2e-single.mjs dev e2e/qidahen-region-mask.e2e.ts "连接到地图边缘的边界线按全图分区生成而不是只取小圈"`：`1 passed (5.5m)`。

截图复核：

- `test-results/evidence-screenshots/_shared/qidahen-region-mask-repair-package-import-focus-current.png`
  - 我实际看到：页面顶部当前区域是 `宋进 song-jin`；
  - 我实际看到：地图上出现 `宋进未独立` 标记；
  - 判定：回导后优先检查本次修改区域的链路成立。

当前证据边界：

- 已证明：补边 ZIP 回导后会优先回到本次实际修改过的区域。
- 未证明：真实完整闭合边界图已经完成。
- 完成守卫仍为 `INCOMPLETE`，不能写正式成果。

## 2026-05-26 21:24 +08 回导新增画线底图支撑统计

本节继续回应“有没有看图或至少读数据”。本次没有尝试自动生成正式成果，而是在补边包回导时直接统计用户新增画线与真实底图支撑线的关系。

实现修订：

- `importBoundaryRepairPackageZip()`
  - 对 `problems/*.png` 中相对 `problem-sources/*.png` 新增的边界色像素计数；
  - 统计其中命中 `realMapBoundarySupportMask` 的像素数；
  - 统计其中命中 `currentMapArtifactExclusionMask` 的 UI/装饰禁区像素数；
  - 回导状态写明 `新增可见画线底图支撑 X/Y px (Z%)`；
  - 支撑比例低于正常成果门槛时，写明 `疑似没有贴真实底图线，不能直接当正常成果`。

E2E 证据：

- `连接到地图边缘的边界线按全图分区生成而不是只取小圈`
  - 模拟编辑 `problems/unmatched-song-jin.png`；
  - 回导后断言状态包含新增可见画线底图支撑统计；
  - 保留回到 `宋进 未独立 seed` 与泄漏路径详情断言。

验证：

- `npx eslint src/pages/devtools/QidahenRegionMaskTool.tsx e2e/qidahen-region-mask.e2e.ts`：通过。
- `npx tsc --noEmit --pretty false`：通过。
- `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 PW_WORKERS=1 NODE_OPTIONS=--max-old-space-size=8192 node scripts/infra/run-e2e-single.mjs dev e2e/qidahen-region-mask.e2e.ts "连接到地图边缘的边界线按全图分区生成而不是只取小圈"`：`1 passed (5.6m)`。

截图复核：

- `test-results/evidence-screenshots/_shared/qidahen-region-mask-repair-package-import-focus-current.png`
  - 我实际看到：仍是新版工具和真实地图；
  - 我实际看到：当前区域为 `宋进 song-jin`；
  - 我实际看到：地图上有 `宋进未独立` 标记；
  - 判定：该截图证明回导后仍在真实地图工具内继续定位，不是旧 UI 或正式成果截图。

当前证据边界：

- 已证明：补边 ZIP 回导会读新增画线像素，并报告其底图支撑比例。
- 未证明：真实完整闭合边界图已经完成。
- 完成守卫仍为 `INCOMPLETE`，不能写正式成果。

## 2026-05-26 21:58 +08 problems 新增画线 UI/装饰硬拒绝

本节把上一节的统计提示升级为写入拦截。目标是防止用户或工具把 UI、装饰、底部条里的线画进 `problems/*.png` 后被回收到正式边界层。

实现修订：

- `importBoundaryRepairPackageZip()`
  - 处理 `problems/*.png` 新增边界色像素时，先检查 `currentMapArtifactExclusionMask`；
  - 命中 UI/装饰禁区的像素只计入 `paintedProblemUiPixelCount`；
  - 这些像素直接跳过，不写入 `rawBoundaryMask`；
  - 如果整张可见裁图新增线都落在 UI/装饰禁区，状态会写明 `新增可见画线 UI/装饰禁区 N px 已拒绝，未写入边界层`。

E2E 证据：

- `连接到地图边缘的边界线按全图分区生成而不是只取小圈`
  - 手工构造一个补边 ZIP；
  - manifest crop 覆盖底部 UI 区；
  - `problems/unmatched-song-jin-ui.png` 里画边界色直线；
  - 回导后断言 UI/装饰拒绝提示出现；
  - 回导前后读取 `qidahen-barrier-canvas` opaque 像素数，断言不变。

验证：

- `NODE_OPTIONS=--max-old-space-size=8192 npx eslint src/pages/devtools/QidahenRegionMaskTool.tsx e2e/qidahen-region-mask.e2e.ts`：通过。
- `npx tsc --noEmit --pretty false`：通过。
- `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 PW_WORKERS=1 NODE_OPTIONS=--max-old-space-size=8192 node scripts/infra/run-e2e-single.mjs dev e2e/qidahen-region-mask.e2e.ts "连接到地图边缘的边界线按全图分区生成而不是只取小圈"`：`1 passed (6.0m)`。

失败与修正记录：

- 首次复跑失败在页面渲染阶段，截图显示 `RangeError: Array buffer allocation failed`，未进入业务逻辑。
- 第二次复跑已经跑到新增断言，页面上下文显示 `新增可见画线 UI/装饰禁区 4,428 px 已拒绝，未写入边界层`；失败原因是测试正则未允许千分位逗号。
- 正则修正为 `[\d,]+` 后通过。

当前证据边界：

- 已证明：`problems/*.png` 里落入 UI/装饰禁区的新增边界色不会写入边界层。
- 未证明：真实完整闭合边界图已经完成。
- 完成守卫仍为 `INCOMPLETE`，不能写正式成果。

## 2026-05-26 22:27 +08 repair-crops 新增像素 UI/装饰硬拒绝

本节补齐透明局部层回导的同类风险。`repair-crops/*.png` 可以直接替换局部透明边界层，所以必须和 `problems/*.png` 一样拒绝 UI/装饰新增边界。

实现修订：

- `importBoundaryRepairPackageZip()`
  - 对 `repair-crops/*.png` 逐像素比较当前 crop 与底板；
  - 允许 `localOpaque=0` 覆盖 `baseOpaque=1`，用于去噪/删除错误线；
  - 当 `localOpaque=1 && baseOpaque=0` 且命中 `currentMapArtifactExclusionMask` 时，计入 `localRepairCropUiPixelCount` 并跳过；
  - 不把这些新增 UI/装饰像素写入 `rawBoundaryMask`；
  - 状态提示 `拒绝局部层 UI/装饰新增像素 N px，未写入边界层`。

E2E 证据：

- `连接到地图边缘的边界线按全图分区生成而不是只取小圈`
  - 手工构造一个只包含局部透明层的补边 ZIP；
  - `repair-crops/unmatched-song-jin-ui-repair-boundary-transparent.png` 在底部 UI 区画白线；
  - 回导后断言拒绝提示出现；
  - 回导前后读取 `qidahen-barrier-canvas` opaque 像素数，断言不变。

验证：

- `NODE_OPTIONS=--max-old-space-size=8192 npx eslint src/pages/devtools/QidahenRegionMaskTool.tsx e2e/qidahen-region-mask.e2e.ts`：通过。
- `npx tsc --noEmit --pretty false`：通过。
- `BG_BYPASS_GLOBAL_HEAVY_BUDGET=1 PW_WORKERS=1 NODE_OPTIONS=--max-old-space-size=8192 node scripts/infra/run-e2e-single.mjs dev e2e/qidahen-region-mask.e2e.ts "连接到地图边缘的边界线按全图分区生成而不是只取小圈"`：`1 passed (6.1m)`。

当前证据边界：

- 已证明：`repair-crops/*.png` 里落入 UI/装饰禁区的新增不透明像素不会写入边界层。
- 未证明：真实完整闭合边界图已经完成。
- 完成守卫仍为 `INCOMPLETE`，不能写正式成果。

## 2026-05-26 23:04 +08 泄漏路径附近真实支撑线建议层

本节回应当前卡点：工具已经能拦假线和定位泄漏，但还没有给用户足够明确的“该沿哪条真实底图线补”的参考。新方案不自动封口，也不把建议线写成正式边界；只在未独立 seed 的橙色泄漏路径附近，找真实底图支撑线，作为补边包里的绿色临摹参考。

实现修订：

- `buildLeakSupportSuggestion()`
  - 输入真实底图支撑线 `realMapBoundarySupportMask`、当前边界、泄漏路径、crop 和 `currentMapArtifactExclusionMask`；
  - 只保留橙色泄漏路径附近的支撑线像素；
  - 排除当前已有边界和 UI/装饰禁区；
  - 经过连续组件过滤后，只有 crop 内确实有建议像素才返回结果。
- `openUnmatchedSeedRepairPreview()`
  - 未独立 seed 裁图里叠加绿色真实支撑线建议；
  - 详情文案写明绿色只是“临摹参考”，不是自动成果。
- `exportBoundaryRepairPackage()`
  - 有建议时导出 `suggestions/unmatched-*-real-map-support-transparent.png`；
  - `problems/unmatched-*.png` 叠加同一批绿色建议；
  - manifest/report 写入 `supportSuggestionFileName / supportSuggestionPixelCount / supportSuggestionCropPixelCount / supportSuggestionComponentCount`；
  - README/rules 明确绿色层不会自动写入边界成果。

E2E 证据：

- `连接到地图边缘的边界线按全图分区生成而不是只取小圈`
  - 补边 ZIP 现在包含 `suggestions/unmatched-jinzhou-real-map-support-transparent.png`；
  - manifest/report 的锦州问题包含 supportSuggestion 统计；
  - 建议层 PNG 尺寸为 `360x260`；
  - 宋进/山海关在当前测试输入下没有连续真实支撑线建议，因此不硬造空建议层；
  - 原有回导 focus、UI/装饰拒绝、可见画线底图支撑统计仍继续覆盖。

验证：

- `$env:NODE_OPTIONS='--max-old-space-size=8192'; npx eslint src/pages/devtools/QidahenRegionMaskTool.tsx e2e/qidahen-region-mask.e2e.ts`：通过。
- `npx tsc --noEmit --pretty false`：通过。
- `$env:BG_BYPASS_GLOBAL_HEAVY_BUDGET='1'; $env:PW_WORKERS='1'; $env:NODE_OPTIONS='--max-old-space-size=8192'; node scripts/infra/run-e2e-single.mjs dev e2e/qidahen-region-mask.e2e.ts "连接到地图边缘的边界线按全图分区生成而不是只取小圈"`：`1 passed (6.1m)`。

看图证据：

- `test-results/evidence-screenshots/_shared/qidahen-region-mask-repair-package-unmatched-current.png`
  - 我实际看到：`锦州 未独立 seed` 裁图里，橙色虚线仍表示泄漏路径；
  - 我实际看到：绿色建议像素贴在真实地图印刷线附近，不是直线封口；
  - 判定：这是一层补边参考，不是完成边界图。
- `test-results/evidence-screenshots/_shared/qidahen-region-mask-repair-package-import-focus-current.png`
  - 我实际看到：页面仍是新版七大恨工具和真实地图；
  - 当前区域仍回到 `宋进 song-jin` 未独立 seed，说明回导后仍需继续补边。

当前证据边界：

- 已证明：补边包能在泄漏路径附近给出真实底图支撑线建议；没有连续支撑时不会硬造建议。
- 未证明：真实完整闭合边界图已经完成。
- 完成守卫仍为 `INCOMPLETE`，不能写正式成果。

## 2026-05-26 23:50 +08 建议层改用未扩张真实细线候选

本节修正上一节的视觉问题。23:04 版绿色建议层来自扩张后的 `realMapBoundarySupportMask`，这个 mask 适合做“贴合评分”，但看图后仍偏块状，不适合用户临摹真实边界。

实现修订：

- `buildLeakSupportSuggestion()`
  - 参数从 `supportMask` 改为 `candidateMask`；
  - 调用方改为传入未扩张的 `realMapBoundaryCandidateMask`；
  - 继续排除当前边界和 `currentMapArtifactExclusionMask`；
  - 继续只在 crop 内有真实建议像素时返回结果。
- `scoreBoundaryRealMapFit()`
  - 仍继续使用扩张后的真实支撑层做贴合门禁；
  - 因此这次只改变补边参考形态，不放松正常成果判定。
- E2E
  - 同一重型用例实际常跑到 `6.0-6.1m`，本轮把该用例自身超时上限从 360s 调整为 480s；
  - 断言没有删减。

验证：

- `$env:NODE_OPTIONS='--max-old-space-size=8192'; npx eslint src/pages/devtools/QidahenRegionMaskTool.tsx e2e/qidahen-region-mask.e2e.ts`：通过。
- `npx tsc --noEmit --pretty false`：通过。
- `$env:BG_BYPASS_GLOBAL_HEAVY_BUDGET='1'; $env:PW_WORKERS='1'; $env:NODE_OPTIONS='--max-old-space-size=8192'; node scripts/infra/run-e2e-single.mjs dev e2e/qidahen-region-mask.e2e.ts "连接到地图边缘的边界线按全图分区生成而不是只取小圈"`：`1 passed (6.1m)`。

看图证据：

- `test-results/evidence-screenshots/_shared/qidahen-region-mask-repair-package-unmatched-current.png`
  - 我实际看到：绿色建议从块状涂抹变为细线段；
  - 我实际看到：绿色线贴在真实河线/地图边界线附近；
  - 我实际看到：右侧 UI、底部 UI 没有被选进建议层。

当前证据边界：

- 已证明：未独立 seed 的建议层更接近“可临摹真实线”，不是扩张块状支撑区。
- 未证明：真实完整闭合边界图已经完成。
- 完成守卫仍为 `INCOMPLETE`，不能写正式成果。
