# DiceThrone 3D 骰子 PC / 移动端验收

## 当前对话范围

- 只验收 DiceThrone 棋盘内 3D 骰子，不把其它游戏或其它 UI 改动计入本轮结果。
- 真相源是当前工作树 `D:\gongzuo\webgame\BoardGame`、当前 E2E 入口和本轮重新生成的真实页面截图。
- 目标是证明五颗正式骰面骰子在 PC 与手机横屏停稳后逐颗可辨认，不叠成一团，并保持锁定、交互和切换稳定。

## 验收规则修正

- 项目规范新增 `.spec/knowledge/standards/e2e-verification.md` 的 `27A`：多颗物理骰必须按期望数量逐颗完整可辨认。
- DOM 节点数量、画布存在、总像素量或固定像素中心距不能单独证明五颗骰子没有叠在一起。
- 对明显旋转的骰子，轴对齐外接矩形只用于拦截接近完全覆盖；主要依据是按骰子尺寸归一化的逐对中心距、整体散布范围和真实整屏截图。
- 测试曾用严格轴对齐交叠比例把两个实际分开的斜放骰子误判为重叠；查看失败帧后已改为旋转场景适用的组合门禁，没有通过放宽中心塌缩条件来掩盖真重叠。

## 实际运行

- `npx eslint src/lib/dice-box-threejs/engine.ts src/games/dicethrone/ui/DiceTray.tsx src/games/dicethrone/ui/diceBoxStyleProfiles.ts e2e/dicethrone/dicethrone-board-dice-3d-toggle.e2e.ts src/games/dicethrone/ui/__tests__/diceBoxStyleProfiles.test.ts src/lib/__tests__/diceBoxThreeEngine.test.ts`
  - 通过。
- `npx tsc --noEmit --pretty false`
  - 通过。
- `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/ui/__tests__/diceBoxStyleProfiles.test.ts src/lib/__tests__/diceBoxThreeEngine.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1`
  - 2 个测试文件、5 条测试全部通过。
- PC：`默认关闭，打开后切到棋盘 3D 骰子，重投时不是原地静止`
  - 通过；覆盖初次切换五骰分离、切换后连续约 640ms 无抛起/无滚动/无位置漂移、真实重投和重投结束五骰分离。
- 移动横屏：`手机横屏投掷结束后 3D 骰子仍留在棋盘投骰区`
  - 通过；覆盖五骰分离、停稳后位置稳定、手牌与敌人提示窗无交叠。
- 锁定重投：`开启 3D 后锁定骰子再次投掷时保持原位且不消失`
  - 通过；覆盖锁定骰子保持原位、五颗骰子继续可见、骰子本体鼠标样式和锁定 UI。

## 肉眼核图

### PC 重投结束

- 原始整屏图：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-board-dice-3d-toggle.e2e\默认关闭，打开后切到棋盘-3D-骰子，重投时不是原地静止\03-确认重投后-3D骰子稳定完成.jpg`
- 尺寸：`1920x1080`。
- 实际看到五颗独立骰子，五个骰体和主要骰面均可辨认，没有叠成一个骰子团。
- 骰子使用正式武僧骰面素材，未出现原始数字骰或加载占位骰。
- 骰子位于棋盘中心偏上区域，没有挡住底部手牌，也没有进入敌人提示窗。

### 手机横屏投掷结束

- 原始整屏图：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-board-dice-3d-toggle.e2e\手机横屏投掷结束后-3D-骰子仍留在棋盘投骰区\00-手机横屏投掷结束后-3D骰子仍可见.jpg`
- 尺寸：`844x390`。
- 实际看到五颗独立骰子，未出现全部重叠、只剩少数骰面或骰子消失。
- 移动端与 PC 使用同一骰面、同一立体材质和同类自然散落；移动舞台更小，因此散布更紧，但没有改成另一套视觉样式。
- 骰子没有挡住底部手牌和右侧敌人提示窗。

### 锁定重投

- 原始整屏图：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-board-dice-3d-toggle.e2e\开启-3D-后锁定骰子再次投掷时保持原位且不消失\07-锁定后再次投掷-锁定骰子保持原位.jpg`
- 尺寸：`1920x1080`。
- 锁定骰子仍完整可见，锁定环比骰子大并位于骰子后方；锁定标签存在，未把骰面主体遮没。
- 其余四颗骰子正常保留，画面中仍能数出五颗骰子。

## 结论

- 当前 PC 与移动横屏均达到“五颗骰子逐颗完整可辨认”的验收标准。
- 当前截图没有出现用户指出的“全叠在一起”。
- 验收规范与 E2E 已补上对应防回归门禁，后续不能再用节点数量或像素存在覆盖真实图面失败。

## 2026-07-10 App 顶部单排回归修复

### 原始症状

- App 手机横屏中，五颗棋盘 3D 骰子虽然都能看到，但集中在角色面板上沿，视觉上挤成顶部一排。
- 旧 E2E 只验证“五颗存在、互不完全覆盖、没有挡住手牌”，还把约 200px 的顶部小方形骰台写成固定正确尺寸，因此没有拦住该构图回归。

### 根因

- `BoardDiceStage` 对 `900px` 以下视口做了显式特殊处理：固定在屏幕顶部，舞台约 `198–216px` 且保持方形。
- 移动物理配置同时使用 `worldWidthScale: 0.9`、`worldHeightScale: 0.75`，横向空间大于纵深，真实投掷停稳后容易沿角色面板上沿聚成横排。
- 该特殊处理由提交 `e63cc2eb1` 于 2026-07-10 引入，不是 App 缓存旧包。

### 修复

- 移动骰台改为角色面板内的矩形投骰区：向下避开顶部状态栏，并向左对齐角色主面板。
- 移动物理区域改为 `worldWidthScale: 0.72`、`worldHeightScale: 1.05`，保证纵深大于横向压缩。
- 移动骰体基准单独提高到 `baseScale: 40`，避免纵向散布后远处骰面缩到不可读。
- 桌面 3D 骰台与普通右侧骰盘没有修改。

### 新增门禁

- 移动端五颗骰子的纵向中心跨度至少达到 `1.2` 个平均骰体尺寸。
- 纵向跨度与横向跨度比例至少为 `0.3`，禁止再次退化为横向单排。
- 保留骰子完整位于舞台内、最小可见尺寸、手牌避让和右侧提示窗零遮挡断言。

### 验证

- `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/ui/__tests__/diceBoxStyleProfiles.test.ts --configLoader native`
  - 结果：`3 passed`
- `npm run test:e2e:file -- e2e/dicethrone/dicethrone-board-dice-3d-toggle.e2e.ts --grep "手机横屏投掷结束后"`
  - 结果：`1 passed`
- `npm run test:e2e:file -- e2e/dicethrone/dicethrone-board-dice-3d-toggle.e2e.ts --grep "默认关闭，打开后切到棋盘"`
  - 结果：`1 passed`
- 最终移动整屏图：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-board-dice-3d-toggle.e2e\手机横屏投掷结束后-3D-骰子仍留在棋盘投骰区\00-手机横屏投掷结束后-3D骰子仍可见.jpg`
  - 五颗骰子已从屏幕上沿单排移入角色面板投骰区，形成可辨认的纵向层次。
  - 没有进入右侧敌人提示窗，也没有遮挡底部操作区。

### 2026-07-10 最终定位与复验

- 原始症状保持为：App 手机横屏中五颗 3D 骰子仍在上面排成一排。
- 最终直接根因不是 App 缓存，也不只是物理区域宽高比例：
  - 平滑落位目标按物理墙体尺寸计算，而移动端相机使用 `cameraZoom: 1.45`，物理墙体明显大于相机当前真正看得见的范围。
  - 部分目标点因此落到视口外；停稳后的边界回收又使用旧的顶部单排槽位，把骰子重新集中到角色面板上沿。
- 最终修正：
  - 平滑落位改为按当前透视相机在骰子高度处的真实可见范围计算目标点。
  - 五颗骰子使用三上两下的二维槽位，仍在 `rolling` 状态内用约 `220ms` 平滑完成，不在 `settled` 后瞬移。
  - 自然落点虽然未完全出界、但纵向占用过高时也进入平滑收拢。
  - 边界安全回收与平滑落位复用同一套相机安全二维槽位，不再回到顶部单排。
  - 排查阶段临时写入画布的数据诊断已移除，未留在最终运行时。
- 最新验证：
  - `npm run typecheck`：通过。
  - `npx vitest run src/games/dicethrone/ui/__tests__/diceBoxStyleProfiles.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1`：`4 passed`。
  - 手机横屏 `844x390` 与 `932x430` 连续两轮共 4 次通过；移除临时诊断后再跑一轮，两档均通过。
  - `开启 3D 后锁定骰子仍留在棋盘骰台且右侧旧骰盘不重复出现`：通过。
  - `开启 3D 后锁定骰子再次投掷时保持原位且不消失`：通过。
  - 一次误用 `npm run test -- <file>` 触发了全量测试，最终被与本任务无关的“betrayal / the-gang 未配置 cursorTheme”门禁阻断；本轮未修改该范围外问题。
- 最新移动整屏图：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-board-dice-3d-toggle.e2e\手机横屏-844x390-投掷结束后-3D-骰子仍留在棋盘投骰区\00-手机横屏投掷结束后-3D骰子仍可见.jpg`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-board-dice-3d-toggle.e2e\手机横屏-932x430-投掷结束后-3D-骰子仍留在棋盘投骰区\00-手机横屏投掷结束后-3D骰子仍可见.jpg`
- 肉眼核图结论：
  - 两档画面都能数出五颗独立骰子，形成上下两层二维散布，不再退化为屏幕顶部横向单排。
  - 骰子主体和主要骰面完整可辨认，没有大面积互相覆盖。
  - 骰台位于顶部对手信息窗下方，没有进入右侧操作区，也没有压住底部手牌区域。
