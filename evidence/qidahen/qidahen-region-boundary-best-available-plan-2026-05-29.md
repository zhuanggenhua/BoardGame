# 七大恨边界自动起稿最佳可交付方案（2026-05-29）

## 目标口径

- 用户目标已经收束为：先生成一版大致正确的闭合轮廓；
- 不要求一次自动正确；
- 多余连线后续手删，缺少连线后续手补；
- 无法连成线或无法封口的碎线直接舍弃；
- 如果确认没有更好的实现方向，可以终止任务，并保留当前最佳方案。

## 尝试方向与结论

### 1. 纯真实底图颜色候选自动抽线

- 结论：放弃作为正式主路，只保留诊断用途。
- 原因：
  - 颜色撞海纹、马、文字、长城、红箭头、数字牌、右侧牌框、底部条；
  - 参数扫描最多只能分出 `2/5` 个独立 seed；
  - 继续调容差只是在“命中太多噪声”和“线太少不可用”之间来回摆动。
- 证据：
  - `temp/qidahen-boundary-algorithm-audit-20260526/report.json`
  - `test-results/evidence-screenshots/_shared/qidahen-region-mask-real-map-candidate-export-current.png`

### 2. 从区域粗稿反推边界

- 结论：降级为次路线，不再作为固定色边界入口的主路。
- 原因：
  - 它把“区域粗稿”和“边界线稿”混在一起；
  - 容易出现看起来像闭合、实际不是底图边界 truth 的假象；
  - 用户要的是边界编辑，不是先有区域填色。
- 证据：
  - `test-results/evidence-screenshots/_shared/qidahen-region-mask-real-map-region-to-boundary-draft-current.png`
  - `test-results/evidence-screenshots/_shared/qidahen-region-mask-real-map-region-path-quick-start-current.png`

### 3. 固定色线 + 长线候选 + seed 骨架混合

- 结论：比纯颜色线好，但概念过重，容易继续绕回“自动完成”的错误预期。
- 原因：
  - 可作为中间实验；
  - 但对最终用户最有价值的仍然不是“多叠一层自动推断”，而是“给一版能直接删补的闭合粗轮廓”。
- 证据：
  - `test-results/evidence-screenshots/_shared/qidahen-region-mask-real-map-candidate-draft-current.png`

### 4. 当前最佳方案：固定色连通线 + 五区可见闭合粗轮廓

- 结论：这是当前最佳可交付方案，可以作为这条任务的收口方案。
- 原因：
  - 生成速度和稳定性可接受；
  - 不再依赖区域填色反推；
  - UI 禁区仍被排除；
  - 用户拿到的是一版可直接手修的闭合粗轮廓，而不是“自动已经做对”的假成果。

## 当前最佳方案定义

- 入口：
  - `src/pages/devtools/QidahenRegionMaskTool.tsx`
  - 主入口按钮 `qidahen-load-real-map-color-line-draft-primary`
- 生成内容：
  - 固定边界色低容差连通线；
  - 五区附近的可见闭合粗轮廓；
  - 闭合粗轮廓的少量轮廓点会轻量吸到附近固定色大线段上，但不做重路径搜索；
  - 不再把区域粗稿反推边界混入同一入口。
- 运行时修复：
  - 修复闭合层把 `{x, y}` 误传给 `rasterizeStrokeMask()` 导致 UI 停在“正在生成”的异常；
  - 当前已改成 `[x, y]` 元组。

## 当前最佳方案证据

- 轻量页面级验证：
  - 复用本 worktree 开发服务 `http://127.0.0.1:4274`
  - 点击固定色主入口后，状态为：
    - `已按 4 个固定边界色生成可编辑边界稿`
    - `当前边界图像素 6,031 px`
- 已实际看图：
  - `test-results/evidence-screenshots/_shared/qidahen-region-mask-fixed-color-boundary-smoke-current.png`
  - `test-results/evidence-screenshots/_shared/qidahen-region-mask-fixed-color-boundary-smoke-v2-current.png`
  - `test-results/evidence-screenshots/_shared/qidahen-region-mask-fixed-color-boundary-smoke-v3-current.png`
  - 结果是五区附近的大致闭合粗轮廓，并叠有固定色大线段；
  - `v3` 比 `v2` 更贴固定色大线段一点，但仍然只是手修起稿，不足以提升到正式 truth；
  - 右侧牌框、底部条、轮盘等 UI 没有被写进边界层。
- 静态验证：
  - `npx eslint src/pages/devtools/QidahenRegionMaskTool.tsx e2e/qidahen-region-mask.e2e.ts`
  - `npx tsc --noEmit --pretty false`

## 当前边界稿的直接看图与读盘结论

- 我已直接看图：
  - 真实底图：`temp/qidahen-main-map-resized.png`
  - 当前最佳边界叠图：`temp/qidahen-best-available-boundary-v3-overlay.png`
  - 当前最佳边界局部裁图：`temp/qidahen-best-available-boundary-v3-overlay-crop.png`
- 当前视觉结论非常明确：
  - 这版 `best-available-boundary-v3` 没再吃到轮盘、右侧牌框和底部条；
  - 但它仍然有明显的“人工补闭合粗圈”成分，不是正常边界 truth；
  - 直观上最明显的是右侧 `咸兴 / 汉城` 两圈，以及中部 `锦州 / 宋进 / 山海关` 周围的闭合粗线，它们只能作为手修起稿。
- 当前读盘结论也支持这个判断：
  - `region-boundary-mask.png` 总像素：`5997`
  - 把这 `5997` 个边界像素逐点对回真实底图，只看与 4 个用户给定边界色的接近度：
    - `exact = 1`（几乎没有“完全就是边界色”的重合）
    - `tol12 = 1893 / 5997 = 31.6%`
    - `tol20 = 2845 / 5997 = 47.4%`
    - `tol32 = 3764 / 5997 = 62.8%`
  - 这说明当前边界稿里，只有大约三到六成像素真正贴近用户给的边界色，其余大头仍然是为了闭合和连通补出来的粗轮廓。
- 结论：
  - 我这次不是凭感觉说“它不够格”；
  - 是直接看图，再用像素读数证明：当前固定色闭合稿不能冒充正式边界成果。

## 保存/回读可用性修复（2026-05-29 08:58 +08）

- 修复目标：
  - 不再继续追自动边界算法；
  - 先把“当前最佳粗轮廓工作区可以保存、刷新后继续编辑”这条链收稳。
- 定位结论：
  - 真正值得修的是大图回读链路的峰值内存，不是固定色起稿算法本身；
  - `QidahenRegionMaskTool.tsx` 里最可疑的热点就是多处 `getImageData(...)`；
  - 工作区回读原先会并发读取 `mask / boundary / add / remove` 四张 PNG。
- 代码修复：
  - 大图读回上下文统一改为 `canvas.getContext('2d', { willReadFrequently: true })`；
  - 工作区回读从 `Promise.all` 并发四图改为串行读取，降低保存后刷新/回读峰值内存；
  - 没有再改边界算法本体。
- 页面级验证：
  - URL：`http://127.0.0.1:4274/dev/qidahen-region-mask?workspace=best-available-boundary-v3`
  - 流程：
    - 点击 `载入固定色边界稿`
    - 点击 `保存工作区`
    - 连续两次刷新回读
  - 结果：
    - 浏览器未出现 `pageerror`
    - 未再复现 `RangeError: Failed to execute 'getImageData' on 'CanvasRenderingContext2D': Out of memory at ImageData creation`
    - 页面保持可继续编辑
- 落盘复核：
  - `temp/devtools/qidahen-region-mask-workspaces/best-available-boundary-v3/region-boundary-mask.png`
    - `LastWriteTime = 2026/05/29 08:57:52`
    - `opaque = 5997`
  - `temp/devtools/qidahen-region-mask-workspaces/best-available-boundary-v3/region-graph.json`
    - `LastWriteTime = 2026/05/29 08:57:52`
    - `nodes = 5`
    - `edges = 0`
- 证据截图：
  - `test-results/evidence-screenshots/_shared/qidahen-region-mask-best-available-boundary-v3-saved-current.png`

## 新方向补强：固定色粗稿 + 自然候选参考层（2026-05-29）

- 问题：
  - 只有固定色闭合粗稿，用户看到的还是“几条粗圈”；
  - 这对继续手修不够友好。
- 这轮新增的方向：
  - 不再逼自动候选直接写入正式边界；
  - 而是把更贴真实地图的稀疏候选细线恢复成“参考层”，只辅助手修。
- 已落地到工具：
  - 主路新增按钮：`叠加自然候选参考层`
  - 一键准备现在会变成：
    - 固定色可编辑边界稿
    - 稀疏候选参考层
    - 全图描边包 ZIP
- 直接看图证据：
  - `test-results/evidence-screenshots/_shared/qidahen-region-mask-fixed-plus-reference-current.png`
  - `test-results/evidence-screenshots/_shared/qidahen-region-mask-best-available-boundary-v3-reference-current.png`
- 当前这层参考线的量级：
  - 候选参考层 `3157 px`
  - `8` 个连通分量
  - 比固定色闭合稿更稀疏，但更贴近真实地图上的暗线/边线
- 描边包验证：
  - 已实际导出并解压 `temp/qidahen-boundary-trace-kit-download.zip`
  - ZIP 里已包含：
    - `qidahen-boundary-color-line-draft-transparent.png`
    - `qidahen-boundary-candidate-reference-transparent.png`
    - `qidahen-main-map.png`
  - `manifest.json` / `report.json` 里都已写入 `candidateReference`
- 这条方向的定位：
  - 仍然不是自动正常成果；
  - 但它比“只给粗圈”更接近一个可正常修边的工作起点。

## 手修主路显示链修复（2026-05-29 09:52 +08）

- 新发现的问题：
  - 前一轮虽然把“自然候选参考层”接回来了，但继续看图后发现，点击参考层时会把可编辑边界稿视觉上盖掉；
  - 用户肉眼看到的仍然接近“只有白参考线”；
  - 保存并重开工作区后，也容易退回只读到参考层/诊断层的半残状态。
- 代码修复：
  - 如果当前已有边界稿，加载参考层时不再关闭 `showBarrier`；
  - 工作区回读时，如果同时存在边界稿与参考层，默认重新打开边界层；
  - 同时把参考层默认透明度收为 `0.38`，把边界层默认显示强度提到 `0.82`，让两层肉眼可区分。
- 页面级验证：
  - 先点 `载入固定色边界稿`
  - 再点 `叠加自然候选参考层`
  - 新截图：`test-results/evidence-screenshots/_shared/qidahen-region-mask-fixed-plus-reference-current.png`
  - 结果：现在能同时看到
    - 蓝色可编辑边界稿
    - 更淡的白色自然参考线
- 保存 / 重开验证：
  - 在 `best-available-boundary-v3` 下加载两层后点击 `保存工作区`
  - 刷新回读截图：`test-results/evidence-screenshots/_shared/qidahen-region-mask-best-available-boundary-v3-reloaded-current.png`
  - 结果：两层不会因为重开工作区而丢回半残状态
- 这一步的价值：
  - 仍然没有把自动边界变成正式 truth；
  - 但把“粗稿 + 自然参考 + 保存回读”这条手修主路真正接通了，用户现在可以在同一工作区里持续修边，而不是每次重开都回到一半状态。

## 尝试留档补充

- 本轮新增的不是“更好自动边界方案”，而是“当前最佳方案的保存/回读稳定性修复”；
- 它应该与前面的自动化尝试并列留档，因为用户明确允许不同方向分别留档；
- 当前判断不变：
  - 自动边界算法继续深挖，预期收益已经低于继续修工具可用性；
  - 如果后续没有更强证据出现，可以以这份最佳方案文档作为终止自动探索的归档依据。

## 为什么现在可以终止这条任务

- 用户要求已经降到“先给最佳可手修起稿”；
- 当前方案已经满足这个口径；
- 再继续追求更强自动化，已知只会回到以下老问题：
  - 真实底图颜色噪声不可控；
  - 区域粗稿与边界 truth 混淆；
  - 自动闭合看似更完整，实则更难判断真假；
  - 验证成本高，但不会把结果提升到“正式 truth”。

## 终止口径

- 可以终止“更好自动实现方案”的继续探索；
- 保留当前最佳方案作为固定色边界主路；
- 后续正确主路应是：
  - 生成这版粗轮廓；
  - 用户在工具内删错线、补缺线；
  - 保存工作区；
  - 再按真实边界分区生成区域与移动代价。

## 手绘边界主流程收敛（2026-05-30）

- 本轮用户目标重新收束为：工具只服务“初始化少量红色边界 / 手动画或擦边界 / 生成区域 / 保存”，不要自动诊断层污染，不要没点初始化就出现红线或 seed 圈。
- 已落地：
  - 默认关闭 seed 状态圈，初始化后也不显示 seed 圈；
  - 主流程增加 `重置当前工作区`，会清空边界图、补边/擦除层、区域、路径，并对临时 workspace 写入空图，刷新后不会回读旧红线；
  - 固定色初始化继续只作为可编辑红色起稿，且会剔除 UI/装饰禁区与明显长直线连通分量。当前判断口径是：地图区域线多为弯曲线，长直线优先按 UI/印刷框线处理，宁可少留也不要到处污染；
  - 边界画笔拖动时只局部写 mask 和 canvas 预览，延迟到松手才 rebuild 最终障碍；生成区域/分区逻辑只在点击 `生成区域` 时进入。
- 本轮 E2E：
  - `npm run test:e2e:ci:file -- e2e/qidahen-region-mask.e2e.ts "初始化按钮直接生成整图红线边界且不显示 seed 圆圈|重置当前工作区会清空旧红线并防止刷新回读"`
  - 结果：`2 passed`
- 像素复核：
  - 初始化工作区 `region-boundary-mask.png`：总边界像素 `6917`；
  - 左轮盘/设置表、右侧牌框、底部牌条、底部年份轨、顶部印刷框等 UI 禁区命中 `0`；
  - 重置工作区 `region-boundary-mask.png`：总边界像素 `0`。

## 区域到移动代价的工具口径修正（2026-05-31）

- 本轮问题：
  - 数据层已经能按区域 mask 生成多条相邻边，但首屏只把“当前通路”作为主要编辑对象；
  - 用户在真实操作里会看到像是“只有一条连线可编辑”，这不满足七大恨地图进入可玩数据的要求。
- 现在固化的不变量：
  - 区域填色、点击选中、高亮轮廓必须来自同一份 `assignments` 数据；
  - 自动连线表示“相邻区域之间的移动代价边”，不是任意两点完全图，也不是只编辑当前一条；
  - 生成区域后，首屏必须显示全部自动识别的相邻通路，并且每条通路都能直接设置边界类型/战场宽度；
  - 点中心单击默认是选中区域用于改城市名；只有拖动超过阈值才进入手动建边，避免改名操作被拖线模式吞掉。
- 已落地：
  - `src/pages/devtools/QidahenRegionMaskTool.tsx`
    - `通路与移动代价` 面板改为全量相邻通路列表；
    - 每行直接显示 `A ↔ B`、当前类型和类型下拉框；
    - 自动连线仍由当前区域 mask 的邻接关系生成，并保留既有边界类型设置。
  - `e2e/qidahen-region-mask.e2e.ts`
    - 补充断言：闭合红线生成后首屏通路行数 `> 1`；
    - 分别修改第 1、2 条通路为 `山脉`、`河流`；
    - 保存连线后校验 `region-graph.json` 至少有多条 edge，且保存了对应 `boundaryType` / `battleWidth`。
- 验证：
  - `npx eslint src/pages/devtools/QidahenRegionMaskTool.tsx e2e/qidahen-region-mask.e2e.ts`
  - `PW_USE_DEV_SERVERS=true VITE_FRONTEND_URL=http://127.0.0.1:4274 PW_TEST_MATCH=e2e/qidahen-region-mask.e2e.ts npx playwright test --grep "闭合红线生成区域会填色"`
  - 结果：`1 passed`
- 证据截图：
  - `test-results/evidence-screenshots/_shared/qidahen-region-mask-all-passages-edit-current.png`
    - 截图中显示 `中心 13 / 自动连线 14`；
    - 地图上可见多条相邻边；
    - 左侧列表至少同时显示多条边，第 1 条为山脉、第 2 条为河流。
- 本轮看图证据：
  - `test-results/evidence-screenshots/_shared/qidahen-region-mask-initialized-red-boundary-current.png`
    - 看到的是整图内部红色边界起稿，不是两个红圈；
    - 左轮盘、右牌框、底部条未被写成红色边界；
    - seed 圈未显示。
  - `test-results/evidence-screenshots/_shared/qidahen-region-mask-reset-clean-current.png`
    - 红色边界与 seed 圈都已清空；
    - 状态栏显示重置完成，当前红线/最终障碍为 `0`。
  - `test-results/evidence-screenshots/_shared/qidahen-region-mask-manual-ready-current.png`
    - `manual-boundary-user` 工作区启动时有初始化、重置、绘制、擦除、生成区域、保存工作区入口；
    - 未点击初始化时边界 canvas 为 `0`，seed 圈不显示。

## 手绘红线与最终障碍同源修复（2026-05-30）

- 用户指出的问题：
  - 手绘出来是青色/绿色，会误导为它不是正式边界；
  - 如果显示层和区域计算层不是同一份数据，就无法信任后续 `生成区域`。
- 根因：
  - 手工补边数据本来会进入 `manualBarrierAddRef`，并通过 `composeBarrierMask(...)` 合成进 `barrierMaskRef`，区域生成使用的是这个最终障碍；
  - 但显示层把手工补边单独涂成绿色/青色，视觉语义错误；
  - 进一步冒烟发现：空白工作区第一次手绘时，若没有显式边界图，仍可能触发隐式底图扫描障碍混入最终障碍，导致画一笔后最终障碍暴涨。
- 已修复：
  - 边界显示层现在只显示“最终合成边界”，统一为红色；
  - 手工补边不再显示成青/绿，擦除不再显示成粉色覆盖层，而是直接从最终红线扣掉；
  - 重置工作区、空白工作区进入绘制/擦除时，强制以空白边界为底，不再混入隐式底图扫描；
  - UI 文案改为“红线就是最终参与区域分割的边界：边界图本体与手工补边会合成同一份障碍数据；擦除只从最终红线里扣掉。”
- 本轮新增 E2E：
  - `空白工作区手绘边界直接写入最终红线且不混入隐式扫描`
  - 断言：
    - 手绘后 `barrier-canvas` 非透明像素全部为红色；
    - 青色/绿色像素为 `0`；
    - 画一笔后的最终障碍小于 `3000`，不会混入几万像素的自动扫描层。
- 本轮复跑：
  - `npm run test:e2e:ci:file -- e2e/qidahen-region-mask.e2e.ts "初始化按钮直接生成整图红线边界且不显示 seed 圆圈|重置当前工作区会清空旧红线并防止刷新回读|空白工作区手绘边界直接写入最终红线且不混入隐式扫描"`
  - 结果：`3 passed`
- 本轮看图证据：
  - `test-results/evidence-screenshots/_shared/qidahen-region-mask-manual-red-draw-current.png`
    - 手绘线显示为红色；
    - 状态栏显示 `初始红线像素 0 / 最终红线/障碍 863 / 手工补边 863 / 去噪 0`；
    - 这说明空白手绘不会混入底图自动扫描，后续 `生成区域` 用的就是这条最终红线/障碍。

## 贴边手绘丢线修复（2026-05-30）

- 用户指出的问题：
  - 地图边缘画不上；
  - 画完后会丢一部分线，怀疑系统还在自动计算。
- 根因：
  - 手绘补边时，`applyBarrierHintAtPointer` 仍在用 `AUTO_MAP_PRINTED_UI_EXCLUSION_MASK` 清掉手绘像素；
  - 这个过滤本来只应该用于初始化、导入、自动抽线，避免把轮盘、牌框、底部条等印刷 UI 当成自动边界；
  - 但它被错误套到了人工画笔，所以贴近左边缘、右侧、底部等禁区的手绘线会在松手后被删掉一段。
- 已修复：
  - 人工画笔不再套 UI/印刷禁区自动删除；
  - 用户手绘内容直接写入 `manualBarrierAddRef`，再合成到最终红线/障碍；
  - 初始化/导入/自动抽线仍保留 UI 禁区过滤，避免自动结果污染。
- 新增 E2E：
  - `手绘边界允许贴边绘制且不会被 UI 禁区过滤删掉`
  - 验证在原本会被过滤的左边缘区域画线后仍有红线像素保留，且青/绿像素为 `0`。
- 本轮复跑：
  - `npm run test:e2e:ci:file -- e2e/qidahen-region-mask.e2e.ts "空白工作区手绘边界直接写入最终红线且不混入隐式扫描|手绘边界允许贴边绘制且不会被 UI 禁区过滤删掉"`
  - 结果：`2 passed`
- 证据截图：
  - `test-results/evidence-screenshots/_shared/qidahen-region-mask-manual-edge-red-draw-current.png`
    - 左侧贴边区域的红线保留下来；
    - 状态栏显示 `最终红线/障碍 462 / 手工补边 462 / 去噪 0`；
    - 说明这条线没有被 UI 禁区过滤删掉，也没有混入自动扫描层。

## 区域生成与拆分保存（2026-05-30）

- 用户指出的问题：
  - `生成区域` 后应该直接看到每个区域不同颜色；
  - `保存边界`、`保存区域`、`保存连线` 不应再混成一个含糊的“保存工作区”；
  - 已经手工填好的边界必须能单独提取出来，不要因为区域/连线还没完成而丢失。
- 当前保存口径已明确：
  - `保存工作区（全部）`：写全量进度，包括 `region-boundary-mask.png`、`region-boundary-add.png`、`region-boundary-remove.png`、`region-mask.png`、`region-mask-regions.json`、`region-graph.json`；
  - `保存边界`：只把当前最终红线/障碍烘焙为 `region-boundary-mask.png`，并清空补边/擦除层；
  - `保存区域`：只写 `region-mask.png` 和 `region-mask-regions.json`，不改边界和连线；
  - `保存连线`：只写 `region-graph.json`，不改边界和区域。
- 已修复：
  - `生成区域` 成功后自动打开彩色区域层、关闭红线层、切到区域编辑模式；
  - 保存接口支持 `saveScope = boundary / regions / graph / all`，避免按钮只是 UI 上分开、实际仍全量覆盖；
  - 主流程面板增加 `保存边界`、`保存区域`、`保存连线`、`保存工作区（全部）`。
- 对 `manual-boundary-user` 的现场复核：
  - 目录已存在：
    - `region-boundary-mask.png`
    - `region-boundary-add.png`
    - `region-boundary-remove.png`
    - `region-mask.png`
    - `region-mask-regions.json`
    - `region-graph.json`
  - 当前保存过的边界进度里，`region-boundary-mask.png` 有 `6917` 个不透明像素，`region-boundary-add.png` 有 `67746` 个不透明像素，`region-boundary-remove.png` 有 `3684` 个不透明像素，`region-mask.png` 还是 `0`；
  - 这说明之前“保存工作区”确实保存了边界进度，但还没保存生成后的彩色区域。
- 本轮 E2E：
  - `npm run test:e2e:ci:file -- e2e/qidahen-region-mask.e2e.ts "从空白边界导入手绘五区后可继续补全通路并编辑移动代价"`
  - 结果：`1 passed`
  - 覆盖内容：
    - 导入完成边界；
    - 单独保存边界；
    - 生成区域后红/黄两个区域色均超过 `1000` px；
    - 单独保存区域；
    - 自动补全通路；
    - 单独保存连线；
    - 最后保存全工作区并刷新回读移动代价。

## 当前最佳工作区接入移动代价工具（2026-05-29 15:46 +08）

- 继续直接读图、读盘，不再凭测试绿灯替当前粗边界稿背书：
  - 复制 `temp/devtools/qidahen-region-mask-workspaces/best-available-boundary-v3` 后实际打开页面确认；
  - 当前边界稿虽然已经能重开继续修边，但并**不能**直接按边界生成正式区域；
  - 真实读数是 `独立 seed 0/5`、`未解释开放线 14`；
  - 点击 `生成正常初始区域` 的实际结果是 `默认生成已拒绝`。
- 已新增 UI 桥接，不再把“移动代价工具”藏在折叠次路线里：
  - 当当前边界稿还处于 `0/5` 或开放线未收干净时；
  - 边界主面板直接显示一张明确的 detour 卡；
  - 标题：`如果你现在是测试通路和移动代价，直接改方向`
  - 按钮：`改方向：直接进入区域 + 通路 + 移动代价`
- 已实际看图：
  - detour 提示卡截图：
    - `test-results/evidence-screenshots/_shared/qidahen-region-mask-best-available-boundary-v3-detour-current.png`
  - 点击 detour 后进入区域/通路编辑截图：
    - `test-results/evidence-screenshots/_shared/qidahen-region-mask-best-available-boundary-v3-move-cost-current.png`
  - 第二张图里已经出现：
    - `区域粗稿 + 通路编辑（次路线）`
    - 5 个区域中心点
    - 4 条通路
    - 左侧已可继续改通路类型与移动代价
- E2E 证据：
  - 新增用例：
    - `best-available-boundary-v3 可直接改方向进入区域通路与移动代价工具`
  - 验证命令：
    - `BG_HEAVY_WAIT_FOR_BUDGET=1 PW_E2E_SERVICE_REUSE=shared-single NODE_OPTIONS=--max-old-space-size=8192 node scripts/infra/run-e2e-single.mjs ci e2e/qidahen-region-mask.e2e.ts "best-available-boundary-v3 可直接改方向进入区域通路与移动代价工具"`
  - 结果：
    - `1 passed (2.3m)`
- 落盘复核：
  - `temp/devtools/qidahen-region-mask-workspaces/best-available-boundary-v3-detour/region-boundary-mask.png`
    - `opaque = 5997`
  - `temp/devtools/qidahen-region-mask-workspaces/best-available-boundary-v3-detour/region-mask.png`
    - `opaque = 74554`
  - `temp/devtools/qidahen-region-mask-workspaces/best-available-boundary-v3-detour/region-graph.json`

## 当前最佳可用成果接入运行时预览（2026-05-29）

- 目的：
  - 不再只证明 `best-available-move-cost-ready` 能在编辑器里改；
  - 还要证明这份临时工作区成果能被“运行时方式”直接消费。
- 实现：
  - 新增 dev 预览页：`/dev/qidahen-runtime-preview?workspace=<name>`
  - 直接读取：
    - `temp/devtools/qidahen-region-mask-workspaces/<workspace>/region-mask.png`
    - `temp/devtools/qidahen-region-mask-workspaces/<workspace>/region-graph.json`
  - 预览页在七大恨主地图上叠加：
    - 区域 mask
    - 区域中心点
    - 通路边与边界标签
    - 右侧通路规则列表
  - 这页只读，不写正式 `src/games/qidahen/data`
- 工具入口：
  - `QidahenRegionMaskTool.tsx` 当前已补以下入口：
    - 推荐工作区区块：`运行时预览`
    - 正式空白页现成成果区：`现成入口：运行时预览`
    - 当前区域 truth 工作区：`打开当前工作区运行时预览`
    - 边界 detour 卡：`直接看运行时预览`
- E2E 证据：
  - 用例：
    - `best-available-move-cost-ready 可直接打开运行时预览并读到当前通路规则`
  - 验证流程：
    - 克隆 `best-available-move-cost-ready -> best-available-move-cost-ready-preview`
    - 先把 `jinzhou::song-jin` 直接写成 `mountain / 山脉 / battleWidth 2`
    - 进入工具后点击 `打开当前工作区运行时预览`
  - 断言结果：
    - URL 切到 `/dev/qidahen-runtime-preview?workspace=best-available-move-cost-ready-preview`
    - 页面读到 `中心 5 / 通路 4 / 缺中心 0`
    - `qidahen-runtime-preview-edge-jinzhou::song-jin` 的 `data-boundary-type = mountain`
    - 右侧卡片显示 `山脉 · jinzhou ↔ song-jin`
    - 右侧卡片显示 `战场宽度 2`
- 我已实际看图：
  - `test-results/evidence-screenshots/_shared/qidahen-runtime-preview-best-available-move-cost-current.png`
  - 肉眼可见：
    - 主地图上有 5 个区域中心点
    - `锦州 / 宋进 / 山海关 / 咸兴 / 汉城` 五区已进入运行时预览
    - 地图上能看到 4 条通路标签
    - 右侧规则列表与地图标签一致
    - 顶部工作区名是 `best-available-move-cost-ready-preview`，没有串到正式数据或旧 UI
- 结论：
  - 这一步没有把当前粗区域稿升级成正式边界 truth；
  - 但已经证明当前最佳可用成果不再只是编辑器里自证，而是能被运行时风格页面直接消费。

## 正式空白页主链改写为“正常成果路线”（2026-05-29）

- 问题：
  - 自动边界主路已经证明不能收口；
  - 但正式空白页之前仍然更像“老工具页 + 一排按钮”，用户一进来很难第一眼分清什么是正常成果路线，什么只是起稿或 detour。
- 这轮调整：
  - 在正式空白工作区首屏新增 `正常成果路线` 卡；
  - 文案直接写死：
    - 要正式边界成果，先手修边界，再生区域；
    - 不要继续卡在自动抽线；
  - 同时给两颗直达按钮：
    - `正常成果：导入完成边界图`
    - `正常成果：直接在图上补边`
- 我已实际看图：
  - `test-results/evidence-screenshots/_shared/qidahen-region-mask-formal-empty-normal-route-current.png`
  - 肉眼可见：
    - 左侧空白工作区首屏现在先出现 `正常成果路线`
    - 三条说明已经把正确主链讲清楚
    - 不再是一上来就让用户自己从一堆工具按钮里猜主路
- E2E 证据：
  - 用例：
    - `正式工作区为空时只给真实边界入口不展示假成果`
  - 已新增断言：
    - `qidahen-empty-guide-normal-route`
    - `qidahen-empty-guide-normal-import-boundary`
    - `qidahen-empty-guide-normal-direct-draw`
  - 结果：
    - `1 passed`
- 结论：
  - 这一步不是算法优化；
  - 是把“换方向后真正可走的正常成果链”显式放到正式空白页首屏，减少继续在自动边界假主路里打转的概率。
    - `nodes = 5`
    - `edges = 4`
    - `jinzhou->shan-hai-guan:plain`
    - `jinzhou->song-jin:plain`
    - `shan-hai-guan->song-jin:plain`
    - `shou-cheng->xian-xing:plain`
- 这一步的边界：
  - 仍然**没有**把当前粗边界稿升级成正式 truth；
  - 仍然**不能**说七大恨边界整图已经完成；
  - 但它把“当前最佳工作区怎样真实进入移动代价编辑工具”这条路补成了可见、可测、可保存的最佳方案。

## 4274 真实首屏可见性修复（2026-05-29 16:38 +08）

- 先确认环境：
  - `127.0.0.1:4274` 当前监听进程已核实来自 `D:\gongzuo\webgame\BoardGame\.worktrees\qidahen\vite.config.ts`
  - 也就是用户实际打开的 4274 就是这棵 `qidahen` worktree，不是别的 UI 串过来
- 继续直接看图发现的问题：
  - detour 卡虽然已经有了，但默认首屏以下；
  - 用户第一眼看到的仍是旧的边界修正面板，容易误判为“还是老 UI / 没改”
- 已做的修复：
  - 不改边界算法；
  - 只把 detour 卡从边界工作流中段上提到工作区卡片之后、模式区之前；
  - 让 `best-available-boundary-v3` 首屏直接出现：
    - `如果你现在是测试通路和移动代价，直接改方向`
- 已实际看图：
  - 首屏截图：
    - `test-results/evidence-screenshots/_shared/qidahen-region-mask-best-available-boundary-v3-live-4274-detour-promoted-current.png`
  - 这张图已经能在第一屏看到：
    - detour 标题
    - `独立 seed 0/5`
    - `未解释开放线 14`
    - `改方向：直接进入区域 + 通路 + 移动代价`
- 结论：
  - 现在不只是 E2E runtime 里有这条桥接链；
  - 用户实际打开 `http://127.0.0.1:4274/dev/qidahen-region-mask?workspace=best-available-boundary-v3`，首屏就能看到并使用它。

## detour 工作区刷新回读与可直接使用别名（2026-05-29 17:22 +08）

- 新发现的问题：
  - `best-available-boundary-v3-detour` 首次进入后可以正常改通路和移动代价；
  - 但之前刷新重开时，回读逻辑不会把它恢复成“区域/通路工作流”；
  - 这会让一个本来已经能用的成果，变成“第一次能用，重开后又半残”。
- 已修复回读逻辑：
  - 当工作区里已经有 `region-mask` 且存在已保存通路时；
  - `loadPersistedRegionData()` 现在会默认恢复：
    - `lastRegionGenerationWorkflow = 'region-path-quick-start'`
    - `lastRegionGenerationResults`
    - `mode = 'path'`
    - 区域/通路工作流 banner
    - 状态文案：`刷新后直接继续改移动代价`
- 已实际看图：
  - `best-available-boundary-v3-detour` 重开截图：
    - `test-results/evidence-screenshots/_shared/qidahen-region-mask-best-available-boundary-v3-detour-reload-fixed-current.png`
  - 该图已经直接显示：
    - `区域粗稿 + 通路编辑（次路线）`
    - `模式：路径`
    - `路径：4`
- E2E 回归：
  - 仍使用用例：
    - `best-available-boundary-v3 可直接改方向进入区域通路与移动代价工具`
  - 但已补上保存后刷新回读断言：
    - 重新打开同工作区后仍必须看到 `区域粗稿 + 通路编辑（次路线）`
    - `模式：路径`
    - `路径：4`
  - 复跑结果：
    - `1 passed (2.8m)`
- 为了让入口更直接，我另外固化了一个可直接使用的别名工作区：
  - `temp/devtools/qidahen-region-mask-workspaces/best-available-move-cost-ready`
  - 对应 URL：
    - `http://127.0.0.1:4274/dev/qidahen-region-mask?workspace=best-available-move-cost-ready`
- 已实际看图：
  - `test-results/evidence-screenshots/_shared/qidahen-region-mask-best-available-move-cost-ready-current.png`
  - 这张图一打开就是：
    - `区域粗稿 + 通路编辑（次路线）`
    - `模式：路径`
    - `路径：4`
- 落盘复核：
  - `best-available-move-cost-ready/region-boundary-mask.png`
    - `opaque = 5997`
  - `best-available-move-cost-ready/region-mask.png`
    - `opaque = 74554`
  - `best-available-move-cost-ready/region-graph.json`
    - `nodes = 5`
    - `edges = 4`
- 当前结论：
  - 正式边界主路仍未完成；
  - 但“可直接打开并修改移动代价”的成果现在已经从一次性 detour，收成了一个可刷新、可重开、可直接访问的工作区。

## 从边界稿页直接跳到现成可用工作区（2026-05-29 17:52 +08）

- 继续降低真实使用门槛：
  - `best-available-move-cost-ready` 已经存在；
  - 但如果用户当前停在 `best-available-boundary-v3`，之前仍需要记住别名再手改 URL；
  - 这不够“正常可用”。
- 已新增页面内直达入口：
  - 位置：`best-available-boundary-v3` 首屏 detour 卡内
  - 按钮：`直接打开现成可用工作区`
  - 行为：直接跳到
    - `http://127.0.0.1:4274/dev/qidahen-region-mask?workspace=best-available-move-cost-ready`
- 已实际看图：
  - 按钮可见截图：
    - `test-results/evidence-screenshots/_shared/qidahen-region-mask-best-available-boundary-v3-open-ready-button-current.png`
  - 点击后结果截图：
    - `test-results/evidence-screenshots/_shared/qidahen-region-mask-best-available-boundary-v3-open-ready-result-current.png`
- 点击后的真实结果：
  - URL 已切到 `best-available-move-cost-ready`
  - 页面直接显示：
    - `区域粗稿 + 通路编辑（次路线）`
    - `模式：路径`
    - `路径：4`
- 当前结论补充：
  - 现在不仅有一个“当前最佳可用工作区”；
  - 从当前边界稿页也能一键跳过去，不再要求用户额外记住工作区名。

## 未完成但已明确不再冒充完成的部分

- 这不是正式边界 truth；
- 这不是 `5/5` 验收完成；
- 这不是正式七大恨整图成果；
- 标准重型 E2E 仍可能受全局内存预算影响，本轮没有新增一条完全独立 runtime 的通过记录；
- 但当前最佳方案已经有静态检查、页面级点击验证和截图证据支撑。

## 归档与终止口径补充（2026-05-29）

- 不同方向的尝试允许分别留档，不要求强行并成一个“唯一正确方案”：
  - 自动抽固定色边界；
  - 自然候选参考层；
  - 边界手修起稿工作区；
  - 直接进入区域/通路/移动代价的 detour 工作区。
- 后续判断标准改为：
  - 只要新方向没有明确证据证明它优于现有最佳结果，就终止该方向；
  - 终止时保留当时最佳可用方案，不再继续围绕同一路线反复调参。
- 当前已保留的最佳方案分为两类：
  - `best-available-boundary-v3`：边界手修起稿的最佳入口；
  - `best-available-move-cost-ready`：直接编辑区域/通路/移动代价的最佳入口。
- 因此，当前真正可以终止的是“继续寻找更好自动边界实现”这条任务；当前不终止、且可继续沿用的是上述两个最佳可用工作区成果。

## 正式空白页继续去老工具感（2026-05-29）

- 这轮不是新算法，也不是新边界方案；只是继续把“最佳方案该怎么进入”收得更像正常成果入口。
- 已落地两层收口：
  - `正常成果路线 / 现成可用成果` 下面那组固定色起稿、描边包、次路线与边界色清单，统一收进折叠工具箱 `边界手修工具与描边包（按需展开）`；
  - 正式空白页原本整块铺开的模式按钮、主路进度和高级调试区，改成默认收起，只显示一张 `工具面板默认先收起，避免首屏又像旧工具台` 卡。
- 这样正式空白页首屏先出现的是：
  - `正常成果路线`
  - `现成可用成果`
  - `开始补边：进入边界修正`
  - `展开工具面板`
- 对应验证：
  - `npx eslint src/pages/devtools/QidahenRegionMaskTool.tsx e2e/qidahen-region-mask.e2e.ts`
  - `npm run test:e2e:ci:file -- e2e/qidahen-region-mask.e2e.ts "正式工作区为空时只给真实边界入口不展示假成果"`
  - `npm run test:e2e:ci:file -- e2e/qidahen-region-mask.e2e.ts "正式空白页可直接打开现成移动代价工作区"`
- 当前结论不变：
  - 自动边界主路已终止；
  - 最佳方案仍是 `best-available-boundary-v3` 与 `best-available-move-cost-ready`；
  - 这轮只是继续减少首屏误导，避免用户把空白正式页误读成“又回到旧工具台”。  

## 2026-05-29 真实看图 + 新算法复核：自动边界路线正式终止

- 这轮重新回到用户最早质疑的点，直接看图和读盘，而不是继续围绕 UI 或旧测试名义收口。
- 已直接查看：
  - `temp/qidahen-main-map-resized.png`
  - `temp/qidahen-best-available-boundary-v3-overlay.png`
  - `temp/qidahen-best-available-boundary-v3-overlay-crop.png`
- 当前视觉结论非常明确：
  - `best-available-boundary-v3` 没再吃进左侧轮盘、右侧牌框和底部说明条；
  - 但右侧 `咸兴 / 汉城` 与中部 `锦州 / 宋进 / 山海关` 仍是明显的粗闭合圈；
  - 这些线只能算“为了闭合补出来的编辑起稿”，不是正常边界。
- 已补当前读盘硬证据：
  - `region-boundary-mask.png` 总像素：`5997`
  - 与 4 个用户给定边界色的接近度：
    - `exact = 1`
    - `tol12 = 1893 / 5997 = 31.6%`
    - `tol20 = 2845 / 5997 = 47.4%`
    - `tol32 = 3764 / 5997 = 62.8%`
    - `tol48 = 4162 / 5997 = 69.4%`
  - 说明当前边界稿里大头仍是“为了闭合补出来的粗轮廓”，不是自然边界本体。
- 也重新核对了 UI 污染边界：
  - 当前 `best-available-boundary-v3` 在 6 个正式 UI 禁区里的边界像素都为 `0`；
  - 也就是当前主要失败点已不是“选上了 UI”，而是“边界形态本身仍错”。
- 另外补试一条完全不同的新算法方向：
  - 用 5 个正式 seed 在真实底图 ROI 上做边缘感知 watershed 分区；
  - 输出：`temp/qidahen-watershed-boundary-v1-overlay.png`
  - 结果不是区域边界，而是零散短噪线、山纹和局部碎段；
  - 这说明问题不是“某个容差还没调到位”，而是“靠真实底图自动推出边界”这条方向本身不稳。
- 这轮结论：
  - 自动边界路线不再继续投入；
  - 后续唯一正常成果主路是：
    - 用户在工具内或外部画出完成边界图；
    - 导入完成边界图或带底图描线图；
    - 工具按真实边界分割全图生成区域；
    - 再基于区域生成/编辑通路与移动代价。

## 默认入口也可直接跳到最佳方案（2026-05-29 12:58 +08）

- 继续收“正常可用成果”的真实入口：
  - 之前虽然已经有 `best-available-move-cost-ready`；
  - 也有 `best-available-boundary-v3` 内部的 detour；
  - 但如果用户直接打开默认地址 `/dev/qidahen-region-mask`，仍会先落在正式空白工作区，容易误以为还得从自动边界主路开始。
- 已补默认首页入口：
  - 在正式空白工作区首屏新增 `现成可用成果` 卡片；
  - 直接提供两个按钮：
    - `现成入口：边界手修起稿`
    - `现成入口：移动代价可用成果`
  - 两个入口都明确标注只会打开临时隔离工作区，不写正式七大恨数据。
- 已实际看图：
  - `test-results/evidence-screenshots/_shared/qidahen-region-mask-formal-empty-workspace-best-available-entry-current.png`
  - 该图已证明默认正式空白页首屏就能看到这两个入口。
- E2E 证据：
  - `正式工作区为空时只给真实边界入口不展示假成果`
  - `正式空白页可直接打开现成移动代价工作区`
  - 复跑命令：
    - `BG_HEAVY_WAIT_FOR_BUDGET=1 PW_E2E_SERVICE_REUSE=shared-single NODE_OPTIONS=--max-old-space-size=8192 node scripts/infra/run-e2e-single.mjs ci e2e/qidahen-region-mask.e2e.ts "正式工作区为空时只给真实边界入口不展示假成果|正式空白页可直接打开现成移动代价工作区"`
  - 结果：
    - `2 passed (3.3m)`
- 当前结论补充：
  - 现在不只是隔离工作区里有最佳方案；
  - 连默认空白入口也已经能一键跳到“边界手修起稿”或“移动代价可用成果”。

## 移动代价可用成果已证明能编辑并回读（2026-05-29）

- 不再只证明“能打开”：
  - 当前最接近正常成果的是 `best-available-move-cost-ready`；
  - 但如果没有真实编辑与回读证据，它仍可能只是一个静态样板页。
- 已补真实编辑证据：
  - 新增 E2E：
    - `best-available-move-cost-ready 可直接编辑路径类型并保存回读`
  - 用例过程：
    - 克隆 `best-available-move-cost-ready` 为隔离工作区；
    - 直接进入路径模式；
    - 把 `jinzhou::song-jin` 从 `plain` 改成 `mountain`；
    - 保存工作区；
    - 重开同工作区并验证值仍是 `mountain`。
- 已实际看图：
  - `test-results/evidence-screenshots/_shared/qidahen-region-mask-best-available-move-cost-ready-edited-current.png`
  - 图中路径列表与地图标签已同步显示 `山脉`；
  - 同时路径行里已直接显示 `当前规则：山脉 · 战场宽度 2`，不再把移动代价语义藏在下拉选项背后。
- 落盘复核：
  - `temp/devtools/qidahen-region-mask-workspaces/best-available-move-cost-ready-edit/region-graph.json`
  - 对应 edge：
    - `id = jinzhou::song-jin`
    - `boundaryType = mountain`
    - `boundaryLabel = 山脉`
    - `battleWidth = 2`
- E2E 结果：
  - `BG_HEAVY_WAIT_FOR_BUDGET=1 PW_E2E_SERVICE_REUSE=shared-single NODE_OPTIONS=--max-old-space-size=8192 node scripts/infra/run-e2e-single.mjs ci e2e/qidahen-region-mask.e2e.ts "best-available-move-cost-ready 可直接编辑路径类型并保存回读"`
  - `1 passed (2.0m)`
- 当前结论再补一层：
  - `best-available-move-cost-ready` 现在不只是“能直接打开的成果”；
  - 它已经有“路径类型可编辑、resolved 规则/战场宽度可见、保存后会写回 graph、重开后会正确恢复”的证据。

## 完成边界图导入主路的最新通过证据（2026-05-29 18:10 +08）

- 这轮不再碰自动边界算法，只收真正有交付价值的主路：
  - `完成边界图/带底图描线图导入`
  - `按真实边界分割全图生成区域`
  - `保存工作区`
  - `刷新/重开回读`
  - `继续进入区域/通路/移动代价编辑`
- 先确认并修掉了一个真实主路问题：
  - 临时隔离工作区之前即使只是保存 rough draft，也会因为 `currentMapArtifactExclusionMask` 命中的 UI/装饰像素被硬拦；
  - 这会把“我先导入一版完成边界图，后面再微调保存”的用户主路直接卡死；
  - 现在的口径改成：
    - **正式数据**继续硬拦 UI/装饰污染；
    - **临时隔离工作区**允许保存进度，但保存文案会明确标注“仅用于继续修边，不可当正式成果”。

### 已通过的 3 条关键 E2E

1. `导入完成边界图后按独立分区生成区域并舍弃断线`
   - 命令：
     - `BG_HEAVY_WAIT_FOR_BUDGET=1 PW_E2E_SERVICE_REUSE=shared-single NODE_OPTIONS=--max-old-space-size=8192 node scripts/infra/run-e2e-single.mjs ci e2e/qidahen-region-mask.e2e.ts "导入完成边界图后按独立分区生成区域并舍弃断线"`
   - 结果：
     - `1 passed (2.3m)`
   - 实际截图：
     - `test-results/evidence-screenshots/_shared/qidahen-region-mask-completed-boundary-import-current.png`
   - 我已看图确认：
     - 只生成了独立的锦州/宋进；
     - 页面上不再残留旧“开放线 1 条”的状态；
     - 现在“舍弃断线”发生在导入阶段，而不是拖到生成后再处理。

2. `从空白边界开始手绘后可保存回读并调试生成当前独立分区`
   - 命令：
     - `BG_HEAVY_WAIT_FOR_BUDGET=1 PW_E2E_SERVICE_REUSE=shared-single NODE_OPTIONS=--max-old-space-size=8192 node scripts/infra/run-e2e-single.mjs ci e2e/qidahen-region-mask.e2e.ts "从空白边界开始手绘后可保存回读并调试生成当前独立分区"`
   - 结果：
     - `1 passed (2.7m)`
   - 实际截图：
     - `test-results/evidence-screenshots/_shared/qidahen-region-mask-blank-boundary-generated-current.png`
   - 我已看图确认：
     - 单区手绘后只有锦州独立；
     - 默认生成会拒绝 `1/5`；
     - 但保存、刷新回读和“调试生成当前独立分区”链路是通的。

3. `从空白边界工作区导入手绘五区边界后可生成 5/5 并保存回读`
   - 命令：
     - `BG_HEAVY_WAIT_FOR_BUDGET=1 PW_E2E_SERVICE_REUSE=shared-single NODE_OPTIONS=--max-old-space-size=8192 node scripts/infra/run-e2e-single.mjs ci e2e/qidahen-region-mask.e2e.ts "从空白边界工作区导入手绘五区边界后可生成 5/5 并保存回读"`
   - 结果：
     - `1 passed (5.0m)`
   - 实际截图：
     - `test-results/evidence-screenshots/_shared/qidahen-region-mask-blank-boundary-five-region-generated-current.png`
   - 我已看图确认：
     - 5 个区域都已进入生成后的 quality / normality 报告；
     - 左侧已显示完整的 `底图贴合 / 直线形态 / region coverages`；
     - 这条链现在能完成：导入 -> 5/5 -> 保存 -> 重开 -> 再生成 -> 导出质量报告。

### 组合串跑

- 命令：
  - `BG_HEAVY_WAIT_FOR_BUDGET=1 PW_E2E_SERVICE_REUSE=shared-single NODE_OPTIONS=--max-old-space-size=8192 node scripts/infra/run-e2e-single.mjs ci e2e/qidahen-region-mask.e2e.ts "从空白边界开始手绘后可保存回读并调试生成当前独立分区|从空白边界工作区导入手绘五区边界后可生成 5/5 并保存回读|导入完成边界图后按独立分区生成区域并舍弃断线|从空白边界导入手绘五区后可继续补全通路并编辑移动代价"`
- 结果：
  - `4 passed (14.0m)`

### 已补到移动代价编辑终点

- 新增 E2E：
  - `从空白边界导入手绘五区后可继续补全通路并编辑移动代价`
- 命令：
  - `BG_HEAVY_WAIT_FOR_BUDGET=1 PW_E2E_SERVICE_REUSE=shared-single NODE_OPTIONS=--max-old-space-size=8192 node scripts/infra/run-e2e-single.mjs ci e2e/qidahen-region-mask.e2e.ts "从空白边界导入手绘五区后可继续补全通路并编辑移动代价"`
- 结果：
  - `1 passed (4.4m)`
- 覆盖链路：
  - 导入五区边界图
  - 生成 5 个正式区域
  - 切到路径模式
  - `按邻近补全`
  - 修改 `jinzhou::song-jin = mountain`
  - 保存工作区
  - 重开仍恢复为 `区域粗稿 + 通路编辑（次路线） / 模式：路径`
- 我已实际看图：
  - `test-results/evidence-screenshots/_shared/qidahen-region-mask-blank-boundary-five-region-path-edit-current.png`
- 看图结论：
  - 当前真实邻接图补出了 `6` 条通路，不是之前 best-available 工作区里的 `4` 条；
  - 路径列表里 `锦州 ↔ 宋进` 当前规则已显示 `山脉 · 战场宽度 2`；
  - 地图上的对应边标签也已经切成 `山脉`；
  - 这证明“用户给完成边界图 -> 工具内继续编辑移动代价”已经不只是概念，而是有最新通过证据的真实链路；
  - 而且这条链基于用户生成工作区 `blank-boundary-five-region-path-edit`，不是预置样板或 detour 假入口。

### 当前结论

- 自动边界主路已终止，这一点不变；
- 但“用户手上已有真实边界图时，工具能否正常导入、生成、保存、回读、继续编辑”这条主路，这轮已经拿到了最新可复验证据；
- 也就是说，当前真正能交付给用户继续用的不是“自动抽边界”，而是：
  - 用真实完成边界图进工具；
  - 生成区域；
  - 保存工作区；
  - 重开继续修；
  - 再接通路与移动代价编辑。

## 2026-05-29 晚间补记：修正“区域明显超出边界”与错误 E2E 口径

- 用户这轮指出的真实问题不是“能不能生成”，而是：
  - `按边界生成区域` 虽然跑通了，但结果里出现明显溢出；
  - 一部分自动补全通路其实是区域漫出后误判出来的，不该继续当成“正常成果”。
- 已确认根因：
  - 原实现用 `extractBoundaryPartitionComponents()` 分区时，只排除了印刷 UI 禁区；
  - 没把分区填充限制在七大恨 5 个正式区域的可编辑可见范围内；
  - 结果是某些 seed 会吃到大块外部区域，典型表现就是汉城一度写到 `557802 px`，肉眼看就是整片盖出去。
- 已落地修复：
  - 新增正式区域可编辑 fillable mask：按 5 个正式区域的静态 shape / visible fallback 约束边界分区；
  - `generateRegionsFromCurrentBoundary()` 不再直接吞整块分区，而是先裁回区域可编辑带；
  - 如果裁完只剩很小碎块，则自动回退到该区域的静态粗轮廓，先给用户一版**不明显溢出**、可继续手修的初稿；
  - 也就是说，这条路现在的目标明确改成：**先有大致正确且不炸边界的粗稿**，缺边/缺通路允许后续手补。

### 这轮重新通过的关键 E2E

1. `从空白边界导入手绘五区后可继续补全通路并编辑移动代价`
   - 结果：
     - `1 passed (4.8m)`
   - 当前真实口径：
     - 5 个区域都能生成并保存回读；
     - 自动识别出的通路现在是 `>= 4` 条，保留 `锦州 ↔ 宋进` 等真实已识别边；
     - 不再把之前那种由大面积溢出带来的 `6` 条假邻接，当成必须保留的“成果”。
   - 关键验收：
     - `jinzhou::song-jin` 可以改成 `mountain`；
     - 保存后重开仍保持 `mountain / 战场宽度 2`；
     - 每个区域落盘像素都被限制在粗稿可接受范围内，避免再次出现超大溢出块。

2. `导入完成边界图后按独立分区生成区域并舍弃断线`
   - 结果：
     - `1 passed (3.0m)`
   - 当前真实口径：
     - 导入只覆盖锦州/宋进两区并带断线噪声的完成边界图后，
     - 工具会先清洗成 `独立 seed 3/5，未独立：咸兴、汉城`；
     - 默认正式生成仍然拒绝；
     - 调试生成只落地当前真正独立的分区，不会把未切开的联通块硬写成区域成果。

### 当前更准确的收口

- 这轮不是“自动边界成功”；
- 也不是“主路已经完美”；
- 真正修到的是：
  - 七大恨工具主路里，`按边界生成区域` 现在不会再明显炸出边界；
  - 自动通路数不再被错误大区污染；
  - 用户可以拿这版粗稿继续手修边界、补通路、改移动代价，而不是被错误大块区域拖着走。

## 2026-05-30 补记：E2E 截图里的边界主层改成红线

- 用户要求：`生成边界了 就端到端截图，边界用红色线`
- 已落地：
  - `QidahenRegionMaskTool` 的边界主层改成红色显示；
  - 同时去掉 `qidahen-barrier-canvas` 的 `mix-blend-screen`，避免截图里边界线继续发青、发白。
- 已重新跑并产出截图：
  1. `导入完成边界图后按独立分区生成区域并舍弃断线`
     - `1 passed (3.1m)`
     - 截图：`test-results/evidence-screenshots/_shared/qidahen-region-mask-completed-boundary-import-current.png`
  2. `从空白边界工作区导入手绘五区边界后可生成 5/5 并保存回读`
     - `1 passed (6.7m)`
     - 截图：`test-results/evidence-screenshots/_shared/qidahen-region-mask-blank-boundary-five-region-generated-current.png`
- 看图确认：
  - 两张图里的边界主层都已经是红线；
  - 现在截图更容易直接分辨“边界在哪里”，不再需要从青色/混色叠层里猜。

## 2026-05-30 深夜补记：截图链路切成纯边界视图

- 用户进一步明确：
  - 不要红圈提示；
  - 不要 seed 诊断圈；
  - 要整张地图一次看到红色边界线，再基于它生成区域。
- 这轮已落地：
  - E2E 截图前会切到纯边界视图，关闭：
    - `Mask`
    - `选区描边`
    - `seed 状态 / 未独立 seed / 开放线段` 诊断层
    - `分区铺色`
  - devtools 新增 `显示/隐藏选区描边` 开关，避免“当前选中区域高亮”继续污染整图边界截图；
  - 红色边界显示层只做可视化描粗，不改真实边界数据。
- 最新已确认截图：
  1. `test-results/evidence-screenshots/_shared/qidahen-region-mask-completed-boundary-import-current.png`
     - 对应用例 `导入完成边界图后按独立分区生成区域并舍弃断线`
     - 最新命令结果：`1 passed (4.8m)`
  2. `test-results/evidence-screenshots/_shared/qidahen-region-mask-blank-boundary-five-region-generated-current.png`
     - 对应用例 `从空白边界工作区导入手绘五区边界后可生成 5/5 并保存回读`
     - 这张图已按新截图链路刷新到最新；最新一次重跑已走到截图产出，但尾部在“导出质量报告”阶段超时，属于长用例尾段/全局资源门禁问题，不是边界截图阶段失败。
- 当前看图结论：
  - 截图里现在主角是整图红色边界线；
  - 之前最误导人的红圈提示层已经从截图链路里移除；
  - 仍保留少量地图上真实路径蓝线，这是路径图本身，不再是诊断红圈。

## 2026-05-30 纠偏补记：旧截图里的红圈来自错误边界夹具

- 用户指出 `为什么还是两个红色圆圈` 后重新核对，确认前一轮判断不完整：
  - 诊断圆圈确实已经关掉；
  - 但 E2E 输入本身仍使用 `HAND_DRAWN_TEST_BOUNDARY_POINTS`；
  - 这些点集是围绕区域 seed 的闭合测试圈，不是地图上的真实边界线。
- 已新增真实地图整图边界证据：
  - E2E：`真实地图固定色匹配可一次显示整图边界红线`
  - 命令：`node scripts/infra/run-e2e-single.mjs ci e2e/qidahen-region-mask.e2e.ts "真实地图固定色匹配可一次显示整图边界红线"`
  - 结果：`1 passed (4.1m)`
  - 截图：`test-results/evidence-screenshots/_shared/qidahen-region-mask-real-map-color-matched-boundary-current.png`
- 新截图的边界来源：
  - 从真实地图 `qidahen-main-map.png` 中按用户给定固定色匹配：
    - `rgb(61, 69, 66)`
    - `rgb(126, 97, 56)`
    - `rgb(128, 104, 62)`
    - `rgb(43, 36, 34)`
  - 排除印刷 UI 区；
  - 只保留跨度足够、密度接近线状的连续组件，丢弃马匹/海面/小碎块等块状噪声。
- 当前证据口径修正：
  - `qidahen-region-mask-blank-boundary-five-region-generated-current.png` 只能证明闭合夹具可生成 5/5 粗区域；
  - `qidahen-region-mask-real-map-color-matched-boundary-current.png` 才是“整张地图边界一次画出来”的截图证据。

## 2026-05-30 现场补记：manual-boundary-user 已生成五色区域并拆分保存

- 用户已在 `manual-boundary-user` 工作区手工填好边界；复核文件后确认：
  - `region-boundary-mask.png`：6,917 px；
  - `region-boundary-add.png`：67,746 px；
  - `region-boundary-remove.png`：3,684 px；
  - `region-mask.png` 初始为空，说明此前“保存工作区”保存的是边界进度，不是正式彩色区域。
- 本轮先复制备份：
  - `temp/devtools/qidahen-region-mask-workspaces/manual-boundary-user-backup-20260530-163845`
- 已把主流程 `生成区域` 改成粗略模式：
  - 用最终红线/障碍作为阻隔；
  - 从每个正式 seed 扩散生成不同颜色区域；
  - seed 压线或落出可编辑范围时自动找最近可写点；
  - 如果某个区域扩散成明显超大块，则回退到该区域静态粗轮廓，避免再次出现半张图溢出。
- 已在真实 `manual-boundary-user` 工作区执行端到端按钮流程：
  - `生成区域`：5 个区域，写入 25,510 px；
  - `保存区域`：只更新 `region-mask.png` / `region-mask-regions.json`；
  - `按邻近补全`：中心 5 / 通路 5；
  - `保存连线`：只更新 `region-graph.json`。
- 现场像素复核：
  - `region-mask.png` 当前 5 个颜色：
    - 咸兴 11,236 px；
    - 山海关 7,250 px；
    - 汉城 3,325 px；
    - 宋进 3,002 px；
    - 锦州 697 px。
  - 边界三张图时间戳保持在用户手绘保存时刻，未被“保存区域/保存连线”覆盖。
- 证据截图：
  - `test-results/evidence-screenshots/_shared/qidahen-manual-boundary-user-before-generate-current.png`
  - `test-results/evidence-screenshots/_shared/qidahen-manual-boundary-user-generated-regions-current.png`
  - `test-results/evidence-screenshots/_shared/qidahen-manual-boundary-user-regions-and-graph-current.png`
- 回归验证：
  - `npx eslint src/pages/devtools/QidahenRegionMaskTool.tsx`
  - `npx eslint e2e/qidahen-region-mask.e2e.ts`
  - `node scripts/infra/run-e2e-single.mjs ci e2e/qidahen-region-mask.e2e.ts "从空白边界导入手绘五区后可继续补全通路并编辑移动代价"`：`1 passed (2.8m)`。

## 2026-05-30 现场补记：默认 UI 收敛为最小地图工作台

- 用户指出当前工具仍像旧调试台，功能过多，且应自动加载上次保存。
- 已落地：
  - 访问不带 `workspace` 的工具页时，会从 `localStorage` 读取上次工作区并自动跳转；打开或保存工作区时会更新该记录。
  - 默认标题改为 `七大恨地图编辑器`，首屏文案改成实际操作闭环。
  - 默认侧栏只保留必要动作：
    - 初始化红线；
    - 画边界 / 擦边界；
    - 撤回 / 重做；
    - 导入边界图；
    - 生成区域；
    - 保存边界 / 保存区域 / 保存连线；
    - 按邻近补全通路和通路类型下拉。
  - 默认隐藏：
    - 导入 Mask；
    - 区域 truth 快捷区；
    - 区域颜色卡片；
    - 诊断样本；
    - 候选抽线说明；
    - 保存工作区（全部）；
    - 粗稿次路线和参数滑条。
  - 高级调试仍可从底部按钮进入，但不再干扰主流程。
- 现场截图：
  - `test-results/evidence-screenshots/_shared/qidahen-region-mask-simplified-workbench-current.png`
- 现场验收：
  - 默认可见核心按钮：初始化、画边界、擦边界、生成区域、保存边界、保存区域、保存连线；
  - 默认不可见旧调试入口：导入 Mask、区域卡片、区域 truth 存进度、保存工作区（全部）；
  - `manual-boundary-user` 回读后显示中心 5 / 通路 5，地图上可直接操作区域与通路。

## 2026-05-30 现场补记：地图直操作与区域铺色降级

- 用户继续指出：
  - 默认应自动加载上次保存；
  - 主界面功能仍过多；
  - 区域颜色铺色不应再作为主价值；
  - 区域和通路应直接在地图上操作。
- 已补充收敛：
  - 默认 `showMask=false`：区域 mask 颜色只保留为内部命中层/调试层，默认不再铺色盖在地图上；
  - 地图上的区域中心点常驻可点：点击中心选中区域，后续区域微调直接基于地图坐标；
  - 地图上的通路边常驻可点：点击通路边会选中该边，并在左侧只展开这一条边的移动代价下拉；
  - 左侧通路列表改为紧凑行：默认只显示区域对 + 当前类型，不再为每条通路铺开完整说明和 select；
  - 保留画笔宽度与缩放，因为它们是手绘边界最小可用流程所需；高级诊断仍在底部按钮后。
- 自动加载复核：
  - 先打开 `?workspace=manual-boundary-user` 写入 last-workspace；
  - 再打开 `/dev/qidahen-region-mask`；
  - 页面自动跳转到 `?workspace=manual-boundary-user`；
  - 回读后显示 `中心 5 / 通路 5`。
- 回归验证：
  - `npx eslint src/pages/devtools/QidahenRegionMaskTool.tsx`
  - `npx eslint e2e/qidahen-region-mask.e2e.ts`
  - `npm run test:e2e:ci:file -- e2e/qidahen-region-mask.e2e.ts "从空白边界导入手绘五区后可继续补全通路并编辑移动代价"`：`1 passed (42.9s)`。
- 证据截图：
  - `test-results/evidence-screenshots/_shared/qidahen-region-mask-blank-boundary-five-region-path-edit-current.png`
  - `test-results/evidence-screenshots/_shared/qidahen-region-mask-autoload-last-workspace-current.png`

## 2026-05-30 现场补记：闭合红线直接生成彩色区域与城市名链路

- 用户最新确认主目标不是旧的 seed 扩散，而是：
  - 手绘红色边界；
  - 点击 `生成区域` 后，按闭合红线找封闭面；
  - 每个封闭面直接填不同颜色；
  - 左侧列出区域中心点，可把名称改成城市名；
  - `保存区域` 写 `region-mask.png` / `region-mask-regions.json`，`保存连线` 写 `region-graph.json`，后续卡牌效果可读城市名和区域点。
- 已修正实现：
  - `generateRegionsFromCurrentBoundary({ allowPartial: true })` 的主路径改为闭合面连通块填充，不再把“预设五区 seed 扩散”作为主生成逻辑；
  - 生成后立即用本次新区域列表渲染 mask 与同步中心点，避免 React 状态下一轮前拿旧 `regions` palette；
  - 生成后区域层透明度提升到 `0.58`，红色边界仍保持显示，保证“填色结果”和“可继续修边”同时可见；
  - 生成区域颜色改为唯一分配，避免超过 8 个区域后循环用色，导致保存成 PNG 再回读时不同区域被同色合并。
- 现场复核：
  - 在 `manual-boundary-user` 页面点击 `生成区域`：
    - 生成区域行数：`22`；
    - 地图区域点：`22`；
    - mask 填色像素：`545,101`；
    - mask 不透明度：`0.58`；
    - 截图：`test-results/evidence-screenshots/_shared/qidahen-region-mask-closed-fill-regions-current.png`。
  - 在隔离工作区 `manual-boundary-user-city-name-smoke-unique-20260530` 验证保存/回读：
    - `region-mask-regions.json`：`22` 个区域，包含 `测试城`；

## 2026-06-13 真相源纠偏：默认正式页红线不是手工红线本体

- 当前默认页 `/dev/qidahen-region-mask` 的正式工作区仍是：
  - `src/games/qidahen/data`
- 但这套正式边界输入当前是空的：
  - `src/games/qidahen/data/region-boundary-mask.png`：`0 px`
  - `src/games/qidahen/data/region-boundary-add.png`：`0 px`
  - `src/games/qidahen/data/region-boundary-remove.png`：`0 px`
- 因此默认页当前看到的红线，只是“根据已保存区域边缘反推出来的显示层”，不能再被解释成“用户手工画过的红线版本”。
- 当前仍保留完整手工红线本体的工作区，应以：
  - `temp/devtools/qidahen-region-mask-workspaces/manual-boundary-user`
  - 其中 `region-boundary-mask.png`：`76,214 px`
  为准。
- `manual-boundary-user` 的几个派生副本：
  - `manual-boundary-user-backup-20260530-163845`
  - `manual-boundary-user-generate-smoke`
  - `manual-boundary-user-city-name-smoke-20260530`
  - `manual-boundary-user-city-name-smoke-unique-20260530`
  当前 `region-boundary-mask.png` 都仍只有 `6,917 px`，属于旧编辑态或烟雾验证态，不能当完整边界本体。
- 本轮已补 UI 告警，默认页会明确提示“当前红线只是自动反推显示层，不是真实手工边界图”。
- 后续若继续清理旧 overlay、旧截图或旧工作区，先按 `docs/games/qidahen/records/qidahen-region-mask-truth-sources.md` 的分类核对引用，再决定归档或删除。
    - `region-graph.json`：`22` 个节点 / `44` 条边，节点名包含 `测试城`；
    - `region-mask.png`：`545,101` 个不透明像素，`22` 个唯一颜色；
    - 刷新回读后 UI 显示 `22` 个区域输入、`22` 个地图中心点、`中心 22 / 通路 44`；
    - 截图：`test-results/evidence-screenshots/_shared/qidahen-region-mask-city-name-save-current.png`。
- 回归验证：
  - `npx eslint src/pages/devtools/QidahenRegionMaskTool.tsx e2e/qidahen-region-mask.e2e.ts`
  - `npm run test:e2e:ci:file -- e2e/qidahen-region-mask.e2e.ts "闭合红线生成区域会填色并保留城市名到区域和连线数据"`：`1 passed (3.0m)`。

## 2026-05-30 现场补记：生成区域不再避开 UI 边缘，外部大背景不再被旧 seed 拉入

- 用户最新指出的问题：
  - 生成区域仍像在避开 UI/印刷区，但用户手绘红线本来就会贴边；
  - 点击生成后出现不按边界的大块填充；
  - 旧 seed 落在红线之外时，会把外部背景错误保留下来；
  - 验收标准必须看端到端截图。
- 根因修正：
  - 主地图编辑器现在把 `currentMapArtifactExclusionMask` 设为空，不再用旧 `AUTO_MAP_PRINTED_UI_EXCLUSION_MASK` 裁掉用户手绘/导入的边缘红线；
  - `导入边界图`、补边包全图边界、局部描边导入、默认生成检查都改走当前编辑器的 exclusion mask；主编辑器等价于不排除 UI，legacy 调试工作台仍保留旧禁区逻辑；
  - `生成区域` 的闭合面扫描继续只以最终红线/障碍为阻隔，不再叠加 UI exclusion；
  - 外部背景过滤改为：只要连通块同时贴到 3 条以上画布边且超过全图 18%，就视为外部背景丢弃，即使里面碰巧包含旧预设 seed，也不能生成区域；
  - 地图上方通路 SVG 在非通路模式下改为不吃空白画布指针事件，避免画笔在地图上被透明覆盖层挡住。
- 实际 `manual-boundary-user` 复核：
  - URL：`http://127.0.0.1:4274/dev/qidahen-region-mask?workspace=manual-boundary-user`
  - 点击 `生成区域` 后状态：
    - `已按红线/画布边缘生成 5 个区域，填充 170,793 px。`
  - 区域行数：`5`
  - 地图中心点：`5`
  - 等工作区加载完成后的点击生成耗时：约 `2250 ms`
  - 截图：`test-results/evidence-screenshots/_shared/qidahen-region-mask-boundary-edge-fill-current.png`
  - 看图结论：红线与填色不再绕开右侧牌框、底部条、左侧轮盘等旧 UI exclusion 区；边缘红线参与分区。
- 新增贴边回归截图：
  - E2E：`导入贴边红线生成区域不会被旧 UI 禁区裁掉`
  - 截图：`test-results/evidence-screenshots/_shared/qidahen-region-mask-edge-ui-boundary-generated-current.png`
  - 看图结论：完全落在旧 UI 禁区附近的闭合红线仍被保留，并生成对应彩色区域；外部整图背景没有再被旧 seed 当作区域保留。
- 回归验证：
  - `npx eslint src/pages/devtools/QidahenRegionMaskTool.tsx e2e/qidahen-region-mask.e2e.ts`
    - 结果：通过；仅有 Babel 对超大 TSX 文件的体积提示。
  - `rg "DEBUG-qidahen" src/pages/devtools/QidahenRegionMaskTool.tsx e2e/qidahen-region-mask.e2e.ts`
    - 结果：无命中。
  - `npm run test:e2e:ci:file -- e2e/qidahen-region-mask.e2e.ts "闭合红线生成区域会填色|导入贴边红线"`
    - 结果：`2 passed (45.9s)`。

## 2026-05-30 现场补记：手绘小断口封口后按连通块生成 21 个区域

- 用户指出的问题：
  - 上一张截图肉眼明显不止 5 个区域；
  - 如果只生成 5 个区域，说明不是按边界真实分割，而是被断线/旧 seed 或固定数量误导。
- 复核结论：
  - 工具没有写死区域数量；
  - 旧结果只有 5 个，是因为生成逻辑直接拿原始红线做 flood-fill，手绘线里少量 1-4px 断口会把多个视觉区域连成同一个连通块。
- 已落地修正：
  - `生成区域` 时临时对最终红线做约 `4px` 的轻度膨胀，只用于区域 flood-fill 的障碍判断；
  - 原始红线显示和保存不变，不把这层临时封口写回用户边界；
  - 区域数仍由封口后的连通块决定，不是固定数量。
- 实际 `manual-boundary-user` 复核：
  - 点击 `生成区域` 后状态：
    - `已按红线/画布边缘生成 21 个区域，填充 704,599 px。已临时封住约 4px 的手绘小断口。`
  - 区域行数：`21`
  - 地图中心点：`21`
  - 截图覆盖同一路径：
    - `test-results/evidence-screenshots/_shared/qidahen-region-mask-boundary-edge-fill-current.png`
- 回归验证：
  - `npx eslint src/pages/devtools/QidahenRegionMaskTool.tsx e2e/qidahen-region-mask.e2e.ts`
    - 结果：通过；仅有 Babel 对超大 TSX 文件的体积提示。
  - `npm run test:e2e:ci:file -- e2e/qidahen-region-mask.e2e.ts "闭合红线生成区域会填色|导入贴边红线"`
    - 结果：`2 passed (47.8s)`。

## 2026-05-30 现场补记：画布四周默认作为边界，贴边区域不再被当外部背景删除

- 用户指出的问题：
  - 四周没有手动画线时，默认画布边缘也应该是区域边界；
  - 之前为了防止整图外部背景误生成，按“贴 3 条边 + 大面积”删除连通块，导致合法贴边区域不涂色。
- 算法口径修正：
  - 生成区域仍使用“红线 + 画布边界”的连通域；
  - 保留最小面积/最小宽高过滤来剔除碎片；
  - 不再因为连通块贴到多条画布边或面积大就删除；
  - 小断口仍通过约 `4px` 临时加厚边界容错处理。
- 实际 `manual-boundary-user` 复核：
  - 点击 `生成区域` 后状态：
    - `已按红线/画布边缘生成 22 个区域，填充 939,774 px。`
  - 区域行数：`22`
  - 地图中心点：`22`
  - 截图覆盖同一路径：
    - `test-results/evidence-screenshots/_shared/qidahen-region-mask-boundary-edge-fill-current.png`
  - 看图结论：
    - 地图四周贴边区域已经填色；
    - 区域数量来自红线/画布边界连通域，不是固定数量。
- 回归验证：
  - `npx eslint src/pages/devtools/QidahenRegionMaskTool.tsx e2e/qidahen-region-mask.e2e.ts`
    - 结果：通过；仅有 Babel 对超大 TSX 文件的体积提示。
  - `npm run test:e2e:ci:file -- e2e/qidahen-region-mask.e2e.ts "闭合红线生成区域会填色|导入贴边红线"`
    - 结果：`2 passed (48.1s)`。

## 2026-05-30 现场补记：强化四周封边并前置移动代价入口

- 用户指出的问题：
  - 四周边界仍有误判风险，有红线时可能被视觉上合成大块；
  - 没有直接看到“设置边界类型/移动代价”的入口；
  - 生成区域后应该自动连线，用户再编辑边界类型。
- 已落地修正：
  - `生成区域` 的临时填充障碍新增闭运算封口，叠加原有红线膨胀，只用于 flood-fill，不写回用户保存的边界图；
  - 靠四周 `96px` 内的红线在生成时临时接到画布边界，强化“四周默认就是边界”的规则；
  - 左侧首屏固定显示 `通路与移动代价` 面板，包含中心/自动连线数量、`自动连线`按钮、当前通路边界类型下拉和战场宽度说明；
  - 点击 `生成区域` 后仍自动补全通路并切到通路模式。
- 实际 `manual-boundary-user` 复核：
  - URL：`http://127.0.0.1:4274/dev/qidahen-region-mask?workspace=manual-boundary-user`
  - 点击 `生成区域` 后状态：
    - `已按红线/画布边缘生成 32 个区域，填充 872,082 px。已临时封住约 8px 的手绘小断口，并把 96px 内靠边红线接到画布边界；... 已自动补全 46 条通路...`
  - 区域行数：`32`
  - 通路边数：`46`
  - 边界类型下拉：首屏可见，当前为 `平原 路 战场宽度 3`
  - 截图：
    - `test-results/evidence-screenshots/_shared/qidahen-region-mask-manual-boundary-edge-sealed-move-cost-current.png`
  - 看图结论：
    - 当前手绘整图边界不再生成成一整块，而是按红线/四周边界分出多块彩色区域；
    - 左侧能直接看到 `通路与移动代价`，并可对选中通路改边界类型。
- 回归验证：
  - `npx eslint src/pages/devtools/QidahenRegionMaskTool.tsx e2e/qidahen-region-mask.e2e.ts`
    - 结果：通过；仅有 Babel 对超大 TSX 文件的体积提示。
  - `rg "DEBUG-qidahen|console\\.log\\(|console\\.debug\\(" src/pages/devtools/QidahenRegionMaskTool.tsx e2e/qidahen-region-mask.e2e.ts`
    - 结果：无命中。
  - `npm run test:e2e:ci:file -- e2e/qidahen-region-mask.e2e.ts "闭合红线生成区域会填色|导入贴边红线"`
    - 结果：未跑到业务断言；隔离前端 Vite/Chromium 启动阶段 OOM，Vite 退出码 `134`。
  - `PW_USE_DEV_SERVERS=true VITE_FRONTEND_URL=http://127.0.0.1:4274 PW_TEST_MATCH=e2e/qidahen-region-mask.e2e.ts npx playwright test --grep "闭合红线生成区域会填色|导入贴边红线"`
    - 结果：`2 passed (36.2s)`。

## 2026-05-30 现场补记：移除方形桥接切块，补区域点击选中轮廓

- 用户指出的问题：
  - 填充结果看起来仍有方形/矩形块，不像按手绘区域边界填充；
  - 最终目标是点击一个区域范围后，高亮该区域边界，区域 mask 本身就是可点击范围。
- 已落地修正：
  - 删除生成用的“逐像素横竖桥接到四周”逻辑，避免靠边红线把整片区域切成矩形；
  - 改为按靠边边界簇找最近边缘点，每个簇只补一条短桥到画布边界；
  - 在通路模式下增加全图透明命中层，点击已填色区域会按 `assignments` 命中对应区域；
  - 选中区域后强制显示更粗的黑底金色/白色轮廓，轮廓来自真实区域 mask 边界，不是固定矩形框。
- 实际 `manual-boundary-user` 复核：
  - 点击 `生成区域` 后：`33` 个区域 / `53` 条自动通路 / 填充 `930,341 px`；
  - 点击地图坐标约 `220,260` 的已填色区域后，状态变为：
    - `已选中 区域 1，地图上的金色轮廓就是当前可点击区域边界。`
  - 截图：
    - `test-results/evidence-screenshots/_shared/qidahen-region-mask-clickable-area-selected-outline-current.png`
  - 看图结论：
    - 选中区域边界已经以粗金色/白色轮廓显示；
    - 贴画布四周的区域边缘仍会沿画布边界呈直线，这是“四周默认边界”的预期结果；内部边界由手绘红线决定。
- 回归验证：
  - `npx eslint src/pages/devtools/QidahenRegionMaskTool.tsx`
    - 结果：通过；仅有 Babel 对超大 TSX 文件的体积提示。
  - `rg "DEBUG-qidahen|console\\.log\\(|console\\.debug\\(" src/pages/devtools/QidahenRegionMaskTool.tsx e2e/qidahen-region-mask.e2e.ts`
    - 结果：无命中。
  - `PW_USE_DEV_SERVERS=true VITE_FRONTEND_URL=http://127.0.0.1:4274 PW_TEST_MATCH=e2e/qidahen-region-mask.e2e.ts npx playwright test --grep "闭合红线生成区域会填色|导入贴边红线"`
    - 结果：`2 passed (39.4s)`。

## 2026-05-30 现场补记：首屏补区域重命名、通路类型编辑、隐藏涂色

- 用户指出的问题：
  - 选中连线后不够直接设置边界类型；
  - 选中区域点后不能直接重命名；
  - 需要一个隐藏区域涂色的按钮，便于只看底图、边界、点和连线。
- 已落地修正：
  - 首屏新增 `当前区域/点` 面板：显示当前区域 id，提供名称输入框；点地图区域或中心点后可直接改名；
  - `当前区域/点` 面板新增 `隐藏涂色/显示涂色` 按钮，只切换区域 mask 视觉层，不影响点线、选中轮廓或保存数据；
  - `通路与移动代价` 面板保留当前通路下拉；切换边界类型后状态提示 `已把当前通路设为 ...`；
  - 改名会同步地图点标签与保存的区域/连线节点名。
- 实际 `manual-boundary-user` 复核：
  - 生成区域后：`33` 个区域 / `53` 条自动通路；
  - 点第一条通路并设置为 `山脉` 后，通路面板显示 `山脉 · 战场宽度 2`；
  - 点区域中心并改名为 `测试点A` 后，地图点标签、顶部当前区域和通路端点名同步显示 `测试点A`；
  - 点击 `隐藏涂色` 后，区域填色层隐藏，底图、选中轮廓、中心点和通路仍可见；
  - 截图：
    - `test-results/evidence-screenshots/_shared/qidahen-region-mask-rename-path-type-hide-fill-current.png`
- 回归验证：
  - `npx eslint src/pages/devtools/QidahenRegionMaskTool.tsx e2e/qidahen-region-mask.e2e.ts`
    - 结果：通过；仅有 Babel 对超大 TSX 文件的体积提示。
  - `rg "DEBUG-qidahen|console\\.log\\(|console\\.debug\\(" src/pages/devtools/QidahenRegionMaskTool.tsx e2e/qidahen-region-mask.e2e.ts`
    - 结果：无命中。
  - `PW_USE_DEV_SERVERS=true VITE_FRONTEND_URL=http://127.0.0.1:4274 PW_TEST_MATCH=e2e/qidahen-region-mask.e2e.ts npx playwright test --grep "闭合红线生成区域会填色"`
    - 结果：`1 passed (29.2s)`。
