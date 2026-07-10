# DiceThrone 3D 骰子 PC / 移动端验收

## 当前对话范围

- 只验收 DiceThrone 棋盘内 3D 骰子，不把其它游戏或其它 UI 改动计入本轮结果。
- 真相源是当前工作树 `D:\gongzuo\webgame\BoardGame`、当前 E2E 入口和本轮重新生成的真实页面截图。
- 目标是证明五颗正式骰面骰子在 PC 与手机横屏停稳后逐颗可辨认，不叠成一团，并保持锁定、交互和切换稳定。

## 验收规则修正

- 项目规范新增 `docs/ai-rules/e2e-verification.md` 的 `27A`：多颗物理骰必须按期望数量逐颗完整可辨认。
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
