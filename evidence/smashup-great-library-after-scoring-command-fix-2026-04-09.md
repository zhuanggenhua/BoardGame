# SmashUp 大图书馆 afterScoring 命令异常验证

## 对应反馈
- `69d71fc0932fe508b2420ca9`
- 标题：执行大图书馆基地效果执行命令异常

## 结论
- 当前工作区已包含对应修复，回归测试通过。
- 诊断包里的现象与“大图书馆 afterScoring 通过反应队列结算时，弃牌堆洗回抽牌抛命令异常”一致，现有专项回归测试已覆盖并通过。

## 对应实现/测试
- `src/games/smashup/domain/scoringSession.ts`
- `src/games/smashup/__tests__/afterscoring-window-skip-base-clear.test.ts`

## 验证
1. `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/afterscoring-window-skip-base-clear.test.ts --configLoader native -t "大图书馆 afterScoring 通过反应队列结算时，弃牌堆洗回抽牌不应抛出命令异常"`

## 验证结果
- 我实际跑过上述回归测试，已通过。
- 测试断言确认：
  - 通过反应队列选择大图书馆 afterScoring 效果后，不会抛出命令异常中断流程
  - 玩家 1 的弃牌堆卡成功回到手牌
  - 后续仍能继续进入 `alien_scout_return` 交互，而不是卡死在异常状态
