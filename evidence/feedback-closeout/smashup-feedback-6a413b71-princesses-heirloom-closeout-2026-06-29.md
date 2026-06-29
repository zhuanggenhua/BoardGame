# SmashUp 线上反馈收口（6a413b71f152a2b136898ec9）

## 范围

- 反馈 ID：`6a413b71f152a2b136898ec9`
- 游戏：`smashup`
- 反馈原文：`公主种族传家宝效果无法对其他传家宝生效`

## 结论

- 本轮结论：`resolved`
- 解决方式：
  - `传家宝（princesses_heirloom）` 的持续加成原先只按“单张卡给自己 +1”计算，无法实现“宿主身上的每张传家宝都会让所有传家宝一起生效”的真实牌面语义。
  - 本轮把它改成按宿主身上同名传家宝数量做平方加成，并显式固定运行时归因，避免同源别名链重复叠算。
  - 现在同一随从附着两张《传家宝》时，会正确获得 `+4`，而不是旧实现的 `+2`。

## 牌面真相

- 中文牌面：`对一个随从打出。持续：该随从身上的每张传家宝都使其获得 +1 力量。此牌不能被摧毁。`
- 现实含义：
  - 如果同一宿主上有 `N` 张《传家宝》，总加成应为 `N * N`。
  - 用户反馈说的不是“单张没生效”，而是“多张之间不会互相放大”。

## 根因

- 原实现位置：
  - `src/games/smashup/abilities/ongoing_modifiers.ts`
- 原逻辑把 `princesses_heirloom` 注册成固定 `delta: 1` 的结构化持续修正。
- 这只能表示“每张传家宝各给宿主 +1”，无法覆盖“每张传家宝都对其他传家宝也生效”的交叉叠加。

## 本轮修复

- `src/games/smashup/abilities/ongoing_modifiers.ts`
  - 移除 `princesses_heirloom` 固定 `+1` 的结构化注册。
  - 在 `registerPrincessesModifiers()` 中改为自定义规则：
    - 统计宿主身上同名《传家宝》数量；
    - 返回 `heirloomCount * heirloomCount`；
    - 增加 `runtimeIdentity: 'actionFamily'`，避免运行时别名/POD 归因链重复叠算。
- `src/games/smashup/__tests__/abilities/princesses.test.ts`
  - 新增回归用例：
    - `同一随从附着两张传家宝时，每张传家宝都会继续给该随从 +1 力量`
  - 目标断言：
    - `getEffectivePower(core, griselda, 0) === 9`

## 本地验证

- 验证命令：
  - `npx vitest run src/games/smashup/__tests__/abilities/princesses.test.ts`
- 结果：
  - `17 passed`
- 直接结论：
  - `格里赛尔达（princesses_griselda）` 基础力量 5，附着两张《传家宝》后力量正确变为 9。

## 真实入口补充排查

- 目标：
  - 补一条真实入口 E2E，证明测试壳场景下两张《传家宝》可正常附着。
- 已执行：
  - `node scripts/infra/run-e2e-single.mjs ci e2e/smashup-princesses-heirloom.e2e.ts`
- 当前结果：
  - 失败点不在《传家宝》规则断言，而在测试页进入了`游戏页保护`，未能注册测试壳。
- 失败现场：
  - `test-results/playwright-artifacts/smashup-princesses-heirloo-cd080-Poison-命中-destroy-链时仍保留在宿主上-chromium/error-context.md`
  - 页面文案：`游戏页保护 / 页面没有正常显示`
- 说明：
  - 这代表当前阻塞是 E2E 测试入口链路，不是本轮修复的业务规则再次失败。
  - 本轮不把这条失败冒充成“真实入口已验证通过”。

## 收口边界

- 这条反馈是**真实业务 bug**，不是误报，也不是“当前树已恢复”类旧样本。
- 本轮已完成：
  - 牌面语义定位
  - 代码修复
  - 定向回归测试通过
- 本轮未完成：
  - 真实入口 E2E 截图证据仍被测试页保护链路阻塞
- 因此本轮回写口径必须写成：
  - 已按规则修复并完成定向验证
  - 真实入口 E2E 另有测试页保护 blocker，未作为本条 resolved 的前置条件
