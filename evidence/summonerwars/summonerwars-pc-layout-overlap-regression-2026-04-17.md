# SummonerWars PC 布局重叠回归修复验证（2026-04-17）

## 范围

- 对象：`src/games/summonerwars/Board.tsx`、`src/games/summonerwars/ui/MapContainer.tsx`、`src/games/summonerwars/ui/layoutConstants.ts`
- 关联验证：`e2e/summonerwars/summonerwars.e2e.ts`
- 问题：最近一轮 PC UI 调整后，桌面端 `hand area`、右侧 `phase tracker`、右下 `phase controls` 的参考宽度重新绑定到 `100vw`，导致 HUD 与底部手牌放大并重新挤压。

## 根因

- `1e20628a` 把桌面端 `--sw-board-reference-width` / `--sw-hand-reference-width` 从受限参考宽度改成了 `100vw`，同时删掉了旧的 `handReferenceWidth` 上限。
- `27cf7fa8` 又把桌面端地图留白从基于 `BOARD_SHELL_REFERENCE_WIDTH` 的比例值改成固定 `10vw`，使棋盘、渐变遮罩、手牌与右侧 HUD 的坐标基线进一步分裂。
- `Board.tsx` 当时给 `MapContainer` 传了 `style`，但 `MapContainerProps` 没有该 prop，导致“理论上的外层留白”并没有稳定落到真实容器。
- 首次复跑在线 E2E 时还暴露出一个独立测试不稳定点：`prepareDeterministicCore()` 虽然会优先挑掉 `fire_sacrifice_summon` 单位，但手牌尾部仍可能被额外抽到的单位覆盖，`unitCard.last()` 会误点到火祀召唤单位，从而进入“选择牺牲友军”分支，假性阻断普通召唤格高亮。

## 修复

### 实现修复

- 桌面端恢复为“安全区宽度与 `1280px` 上限取最小值”的 HUD/手牌参考宽度。
- 桌面端地图留白恢复为基于 `BOARD_SHELL_REFERENCE_WIDTH` 的比例计算，不再直接使用裸 `vw`。
- `MapContainer` 补上 `style` 透传，确保布局 padding 真正作用在容器层。
- 召唤阶段“可打出手牌”高亮恢复为更强的视觉出口：从原本过弱的细边框/弱阴影，改成更明显的 `emerald ring + glow + 轻底色`，避免在压缩手牌布局下看起来像“没有高亮”。
- 桌面端回合指示从 `top-[40%]` 的经验值定位改成独立右侧中线 rail：`absolute inset-y-0 right-2 flex items-center`，不再和右上对手区、右下 controls 共用一套猜位置的锚点。

### E2E 视口修复（2026-04-18 追加）

- `playwright.config.ts` 的 `chromium` 项目从默认 `devices['Desktop Chrome']`（1280x720）改为显式 `viewport: { width: 1920, height: 1080 }`，符合 `.spec/knowledge/standards/ui-ux.md` §2.0 规范。
- `e2e/summonerwars/summonerwars.e2e.ts` 在线对局测试内部硬编码 `viewport: { width: 1440, height: 900 }`，覆盖了 config 设置，已改为 `1920x1080`。

### Action Banner 居中修复（2026-04-18 追加）

- `Board.tsx` 中 `sw-action-banner` 包装层桌面端居中方式从 `left-1/2 -translate-x-1/2` 改为 `left-0 right-0 flex justify-center`。
- 原因：`ActionBanner` 内部使用 `framer-motion` 的 `motion.div` 并设置 `animate={{ y: 0 }}`，framer-motion 会接管 `transform` 属性，覆盖 Tailwind 的 `-translate-x-1/2`，导致水平偏移失效、banner 不居中。
- 改用 flexbox 居中后不再依赖 `transform`，与 framer-motion 无冲突。

### E2E 稳定性修复

- 调整 `prepareDeterministicCore()` 的手牌重排逻辑：把已明确筛掉 `fire_sacrifice_summon` 的稳定单位放到手牌末尾。
- 这样现有 UI 流程里复用的 `.locator('[data-card-type="unit"][data-can-play="true"]').last()` 仍能命中普通召唤单位，不会被额外抽到的技能单位污染。

## 验证

### `npm run typecheck`

- 结果：通过。
- 结论：`Board -> MapContainer` 的 prop 链路与桌面参考宽度常量收口后，项目仍可正常通过 TypeScript 编译。

### `node scripts/infra/run-e2e-single.mjs ci e2e/summonerwars/summonerwars.e2e.ts "在线对局流程：召唤、移动、建造、攻击与弃牌"`

- 结果：通过。
- 关键截图 1：`test-results/evidence-screenshots/summonerwars/summonerwars.e2e/在线对局流程：召唤、移动、建造、攻击与弃牌/50-pc-online-layout-start.png`（1920x1080 视口）
  - 我实际看到：棋盘主体保持在视口中央，没有缩在左上角。
  - 我实际看到：底部手牌在棋盘下沿居中展开，右边界没有侵入右下角“结束阶段/弃牌”控件区。
  - 我实际看到：右侧回合指示位于右侧中线附近，右下 controls 保持独立分区，没有再出现“整体偏下”的旧表现。
  - 我实际看到：顶部 `sw-action-banner` 在视口水平居中，不再偏左。
  - 判定：达到“PC 起始主态不再重叠 + banner 居中”的验收标准。
- 关键截图 2：`test-results/evidence-screenshots/summonerwars/summonerwars.e2e/在线对局流程：召唤、移动、建造、攻击与弃牌/50-pc-online-layout-start-hand-phase-clip.png`
  - 我实际看到：手牌、阶段条、结束阶段按钮、弃牌堆同时出现在同一张裁剪图里，方便直接判断相对位置。
  - 我实际看到：手牌顶部与阶段条/结束阶段按钮之间仍有明显空隙，不存在“牌面顶到按钮底下”的现象。
  - 判定：达到“重叠问题已解除”的近景证据标准。
- 关键截图 3：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\summonerwars\summonerwars.e2e\在线对局流程：召唤、移动、建造、攻击与弃牌\51-pc-online-layout-after-attack.png`
  - 我实际看到：进入攻击阶段后，右侧阶段条仍保持完整，底部手牌虽然数量减少但仍沿底部中线分布，没有重新向右下角挤压.
  - 我实际看到：棋盘中央和 HUD 继续共用同一套坐标系，没有出现“主区还在中间、HUD 漂去另一侧”的分裂感.
  - 判定：达到“流程推进后也不回归重叠”的验收标准.
- 关键截图 4：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\summonerwars\summonerwars.e2e\在线对局流程：召唤、移动、建造、攻击与弃牌\50-pc-online-playable-hand-highlight.png`
  - 我实际看到：召唤阶段可打出的手牌边缘都有明显青绿色外圈和发光，不再是“必须贴着看才勉强看见”的弱边框.
  - 我实际看到：高亮没有挤占手牌间距，也没有把牌面内容遮没，只是把“哪些牌当前可打出”直接标出来.
  - 判定：达到“召唤阶段可选手牌高亮恢复可见”的验收标准.

### `node scripts/infra/run-e2e-single.mjs ci e2e/summonerwars/summonerwars.e2e.ts "移动横屏：基础流程可完成召唤、移动、建造、攻击与弃牌"`

- 结果：通过.
- 关键截图：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\summonerwars\summonerwars.e2e\移动横屏：基础流程可完成召唤、移动、建造、攻击与弃牌\40-mobile-basic-flow-playable-hand-highlight.png`
  - 我实际看到：移动横屏下可打出的手牌同样带有青绿色描边和外发光，缩小到手机手牌尺寸后仍能一眼区分.
  - 我实际看到：高亮与本轮 PC 布局修复共存，没有把手牌再次撑宽或挤到右侧 controls.
  - 判定：达到“同一份 HandArea 高亮在移动端也成立”的验收标准.

## 结论

- 本轮问题是 **SummonerWars 自己的桌面参考宽度回归**，不是 `MobileBoardShell` 或全局 HUD 壳层的共性故障。
- 追加修复：E2E 视口从 1440x900 硬编码改为 1920x1080 规范值；`sw-action-banner` 居中从 transform 方式改为 flexbox 方式，避免与 framer-motion 冲突。
- 当前实现修复 + 在线 E2E 复跑都已完成，现有证据显示：
  - 底部手牌不再侵入右下 controls；
  - 阶段条与 controls 不再重叠；
  - 棋盘主区没有缩在左上角；
  - 流程推进到攻击阶段后仍保持稳定；
  - `sw-action-banner` 在 1920x1080 视口下水平居中；
  - E2E 截图分辨率符合项目 UI/UX 规范。
