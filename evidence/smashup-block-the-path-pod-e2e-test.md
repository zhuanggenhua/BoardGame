# SmashUp《通路禁止》POD E2E 证据

## 目标

验证 `trickster_block_the_path_pod` 打到基地时：

1. 不再因 `blocked is not defined` 崩溃
2. 会正常弹出“为对手选择被封锁派系”的交互
3. 玩家完成选择后，基地上的持续战术会写入 `blockedFactionsByPlayer`

## 执行命令

- `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/interactionChainE2E.test.ts -t "trickster_block_the_path_pod" --configLoader native`
- `npm run test:e2e:ci:file -- e2e/smashup-crop-circles.e2e.ts "打到基地后应弹出派系封锁选项，并把选择写入基地持续战术"`

## 截图审查

### 1. 交互弹出

绝对路径：
`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup-crop-circles.e2e\打到基地后应弹出派系封锁选项，并把选择写入基地持续战术\block-the-path-prompt.png`

![通路禁止-交互弹出](../test-results/evidence-screenshots/smashup-crop-circles.e2e/打到基地后应弹出派系封锁选项，并把选择写入基地持续战术/block-the-path-prompt.png)

审查结论：

- 画面中央已出现交互层，底部能看到 2 个有效封锁选项和 1 个取消选项。
- 这说明点击基地后不再抛异常，前端已经拿到了 onPlay 生成的组合选项。
- 该用例里对手只有 1 名，因此有效选项应正好对应 `killer_plants_pod` 与 `aliens_pod` 两种封锁结果。

### 2. 交互完成后

绝对路径：
`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\smashup-crop-circles.e2e\打到基地后应弹出派系封锁选项，并把选择写入基地持续战术\block-the-path-resolved.png`

![通路禁止-交互完成](../test-results/evidence-screenshots/smashup-crop-circles.e2e/打到基地后应弹出派系封锁选项，并把选择写入基地持续战术/block-the-path-resolved.png)

审查结论：

- 交互层已经消失，说明选择流程已结束，没有卡在“必须继续选”的状态。
- 左侧基地上保留了已附着的持续战术牌，说明这张行动牌成功打到了基地上。
- 右上角残留了一条瞬时提示 toast，但该用例同时断言了 `current interaction = null`，并校验了 `blockedFactionsByPlayer` 已写入，所以这不是这次 bug 的阻塞项。

## 最终结论

- 根因确认是 `src/games/smashup/abilities/tricksters.ts` 中把 `c.blocked` 误写成了未定义变量 `blocked`。
- 修复后，定向 Vitest 与定向 Playwright E2E 均通过。
- 当前行为已覆盖“打到基地成功 + 弹出交互 + 写入封锁派系元数据”这条真实回归链路。
