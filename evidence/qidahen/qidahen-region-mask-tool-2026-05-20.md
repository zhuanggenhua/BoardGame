# 七大恨区域制图工具验收证据（2026-05-20）

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
