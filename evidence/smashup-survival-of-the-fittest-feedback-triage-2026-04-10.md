# 大杀四方《适者生存》反馈排查（2026-04-10）

## 反馈对象
- feedbackId: `69d72257932fe508b2420cdb`
- 标题：`这个情况打不出适者生存`

## 本轮确认
1. 数据接线缺陷已修：`dino_survival_of_the_fittest` / `dino_survival_of_the_fittest_pod` 已补 `playNeedsBase: true`，不再在点卡瞬间直接报“场上没有符合条件的目标”。
2. E2E 环境 blocker 已修：`apps/api/src/main.ts` 已改为 loopback MongoMemoryServer 启动链路，当前定向用例可正常起环境。
3. 现网同构场景下，卡牌现在可以进入“选基地”流程，并在选择基地后继续进入“最低力量平局选择”交互。
4. 但同一条链路里仍会出现一条 `请先完成当前选择` 的提示噪音；它不再阻止卡牌打出，但会污染界面，因此本反馈本轮仍保留 `in_progress`。

## 验证命令
```powershell
npx eslint src/games/smashup/data/factions/dinosaurs.ts src/games/smashup/data/factions/dinosaurs_pod.ts src/games/smashup/__tests__/audit-d1-d8-d33-dino-survival-of-the-fittest.test.ts src/pages/MatchRoom.tsx src/pages/LocalMatchRoom.tsx src/games/smashup/ui/BaseZone.tsx src/games/smashup/Board.tsx e2e/smashup-gameplay.e2e.ts --quiet

node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/audit-d1-d8-d33-dino-survival-of-the-fittest.test.ts --config vitest.config.audit.ts --configLoader native

$env:NODE_OPTIONS='--max-old-space-size=8192'
$env:BG_BYPASS_GLOBAL_HEAVY_BUDGET='1'
$env:PW_RUNTIME_SCOPE='manual-sotf-closeout-20260410z15'
$env:PW_WORKERS='1'
$env:PW_E2E_FRONTEND_PORT='6374'
$env:PW_E2E_GAME_SERVER_PORT='20300'
$env:PW_E2E_API_SERVER_PORT='21300'
npm run test:e2e:ci:file -- smashup-gameplay.e2e.ts "适者生存应先进入选基地流程；若目标基地最低力量平局，则继续进入平局选择"
```

## 截图观察

### 1. 点卡后进入选基地
- 路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup-gameplay.e2e\适者生存应先进入选基地流程；若目标基地最低力量平局，则继续进入平局选择\sotf-after-card-click-awaiting-base.png`
- 我实际看到：手牌中的《适者生存》仍保持选中态，三个基地都出现紫色高亮边框，界面上没有出现“场上没有符合条件的目标”。
- 验收判断：**达到用户原始反馈的核心验收标准**——这张牌现在能进入“选基地”流程，不再在入口处直接打不出。

### 2. 选择基地后进入平局交互
- 路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup-gameplay.e2e\适者生存应先进入选基地流程；若目标基地最低力量平局，则继续进入平局选择\sotf-after-base-selection-awaiting-tiebreak.png`
- 我实际看到：顶部出现“选择要消灭的最低力量随从”横幅；`base_wizard_academy` 上原本的 1 力机器人已消失，说明《适者生存》已经开始结算；但右上角仍然存在一条 `请先完成当前选择` 提示。
- 验收判断：**主功能链路已走通，但界面仍有次生提示噪音，不能据此宣称完全收口。**

### 3. 平局候选仍可见
- 路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup-gameplay.e2e\适者生存应先进入选基地流程；若目标基地最低力量平局，则继续进入平局选择\sotf-tiebreak-candidates-visible.png`
- 我实际看到：`base_innsmouth_base` 上两个 2 力候选仍可见，说明平局选择 prompt 已正确挂起；但右上角同样残留 `请先完成当前选择` 提示。
- 验收判断：**tie-break 交互本身存在，但提示噪音仍在，当前只证明“能打出并进入后续交互”，还未证明“该场景完全无异常”。**

## 结论
- 这条反馈最初的“打不出《适者生存》”主因已经被修掉：`playNeedsBase` 接线 + E2E 同构场景都证明入口不再报“无目标”。
- 但在用户截图同类的“选基地后进入平局交互”场景里，界面仍会冒出 `请先完成当前选择` 提示。
- 因此本轮建议：
  - **不回退已修主问题**；
  - **状态继续保留 `in_progress`**；
  - 下一步集中排查这条提示噪音来自哪一次多余命令/重复点击链。
