# Fate 手牌承载回归锁定（2026-10-21）

## 用户指出的问题

- 已打出的牌曾在桌面原位呈现；近期改成了新建窗口/牌册，用户明确否决。
- 两类手牌被固定为 40% / 60%，位置过近；该比例不再是批准要求。
- 地图应独立铺满视口并可平移缩放，HUD 浮在地图上；手牌/骑乘状态不得改变地图相机的初始拟合或平移。

## 最后正常证据与边界

- 父级基于 `artifacts/fate-domination-open-design/DESIGN-v6.md` 与历史 `open-design-current` 01/02/04 原图及 source-provenance 逐项复核，锁定恢复语义：地图按视口作为舞台；本人攻击区在攻击手牌上方；通过正式卡牌本体打出/撤回；攻击牌区和技能牌区保持分区。上述原始图文件未随本独立 checkpoint 提供，本记录不伪称本地复看。
- 当前本地可复核的行为基线为 Rider v1 输入包中的 `rider-v1-base/unpacked/source-overlay/src/games/fate-domination/ui/FateHandSurface.tsx` 与 `hand-surface.css`：攻击/技能实体卡由 `renderAttack` / `renderSkill` 渲染在 `fd-runtime-play-area`，选中攻击仍可由卡牌本体撤回，已激活技能仍可在对应牌上发动。该源文件用于确认交互承载，不作为已通过当前布局的截图。
- Master Duel、Eternal、MTG Arena 原图见本次已保存参考包：只迁移底边自然沉入、不同卡牌区域有明确分组/职责；不照搬扇形、皮肤或其具体占屏比例。

## 首个回归 hunk 与根因

1. `layout-v2.patch` 在 `FateHandSurface.tsx` 新增 `ModalBase`、`playedBrowserOpen`、触发按钮和独立 `fd-played-inspection`，并以独立图卡+代理撤回按钮取代原位牌区/卡牌本体。根因是表现层单点实现：新建替代交互载体，丢失原承载语义。
2. 同一补丁在 `hand-surface.css` 把两区固定为 `left:30%; width:40%` 的等宽网格，并将移动横屏写成 110/100/226 三行，同时为弹层新增专属版式。用户明确撤销 40/60 意图；此批固定比例和分行是当前布局被否决的首个实现批次。
3. `layout-v2.patch` 增加 `Board.tsx -> safeAreaRevision -> FateMapSurface` 重算链，并把 `runtime-table.css` 的地图安全边距从 checkpoint 原值扩大至 380/420px；后续窄桌面又加了 368px 例外。此处将按本轮明确授权移除整条 HUD 安全区拟合，让地图只按视口计算相机；不把 checkpoint 中更早存在的旧安全区代码错称为 v2 首次引入。

## 本次允许改动与保护项

- 只恢复牌区原位展示/卡本体交互、取消固定手牌比例/牌册弹层、取消地图相机与 HUD/骑乘的耦合。
- 组内保留可读卡牌尺寸和滚动；攻击与技能区保持明显间距与各自标题。实际布局依据真实卡区内容和窗口可用宽度伸缩，不声明固定百分比。
- 保留 Rider 能力合法性、费用与取消/确认语义，保留角色准备锁定、隐私投影、检视牌面与焦点恢复等已修好的非布局行为。
- 当前 v2/v3 整桌截图保留为已否决历史；本轮截图和行为链只提供父级复核，执行者不作最终视觉 PASS。

## 验证矩阵

- 桌面真实 Board：常态 0 张/数量变化；打出攻击；卡本体撤回并回到手牌；已激活技能仍能发动；多张已打出牌在原区可达浏览。
- 骑乘：打开选择/确认/取消与牌本体浏览；地图相机在开启前后保持原视口姿态。
- 窄桌面与手机横屏：两类手牌保持分组，标题、费用牌、控制可读；只对当前可用内容区横向浏览，不出现独立牌册窗口。
- 重复行为与状态变化只以断言/trace记录；截图仅保留布局或交互形态实际不同的整屏状态。

## 本次恢复实现与验证事实

- `FateHandSurface.tsx` / `hand-surface.css`：本人攻击牌、已暂选牌、已打出牌和激活技能在攻击手牌上方的原位牌区直接渲染；暂选牌本体可撤回，激活技能本体可发动，检视仍独立承接。移除 ModalBase 牌册/数量入口与 40/60；攻击区获得扣除技能区自然宽度后的剩余宽度，牌行在各自区内横向浏览。没有创建另一处选择或撤回入口。
- `Board.tsx` / `FateMapSurface.tsx` / `tableCameraLayout.ts` / `runtime-table.css`：地图相机只跟随地图视口与自身输入，不再随骑乘状态、手牌区或 HUD 安全边距重算；Fate 既有 `1920×1080` 手机横屏 board-shell 保持外层缩放，内部地图留在稳定游戏坐标。
- RED/GREEN：回归测试首次在旧牌册行为下复现，日志为 `临时日志路径省略`；最终聚焦回归 5 个文件 / 39 个测试通过，日志为 `临时日志路径省略`。第一次真实浏览器试验暴露 20 张时第 20 张溢出约 38px；攻击区改为自然取得剩余宽度、出牌牌行内部滚动后，完整 Board 链通过。
- 最终真实 Board run：`1792599515965-190348-6904ca9d-a41f-4f07-a630-edce0edd742b`，运行 stdout 在 `临时日志路径省略`；Chromium `/usr/bin/chromium`，`chromiumSandbox:true`，Mongo 7.0.3，使用 `/workspace` 临时目录。1/1 通过；source revision 为 `6cf1a9178b00567e3d58c46ef17209b78016928c+tree-sha256:9e937b9e6b9973f7f4292c2b37521428857f7f41c90ae88035514cba02ed9e6b`。真实链包含正常准备、部署、御主抽牌、普通攻击激活骑乘、打开/取消骑乘选择、打出/撤回；随后用正式攻击牌定义构造20张浏览代表态。此代表态由本局12个实例加8个仅供布局压力的唯一实例组成，不是自然对局，不表示游戏数量上限或规则效果。
- 行为 trace 有6个转换步骤、27个显式 actual/expected 断言，逐项相等；5张整屏图分别覆盖空牌区、手牌暂选、真实骑乘选择、20张出牌区、936×432窄横屏。图组与trace位于 `test-results/evidence-screenshots/fate-domination/hand-layout-real-board.e2e/Fate-攻击牌在原位打出与撤回，出牌区密集时相机仍独立/`。这些图尚未做本轮视觉审查；按用户要求只供父级看图，不宣告最终视觉 PASS，也未注册查看器或发布。
- 本轮按用户指定，将 `.spec/knowledge/standards/ui-change-gates.md` 的地图/HUD段落改为由已确认层级合同决定避让；地图与 HUD 独立时不因手牌/HUD尺寸缩小地图，跨层重叠本身不判失败，同时保留自由平移/缩放和真实热区命中验证。`git diff --check` 通过。`npm run spec:lint` 未通过，现有环境缺少/误连 `.claude/agents`、`.claude/skills`、`.agents/skills`、`.codex/skill` 四个宿主软链接；本轮没有改动这些无关入口。
