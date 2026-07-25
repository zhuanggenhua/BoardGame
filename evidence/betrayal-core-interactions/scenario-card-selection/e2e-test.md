# 山屋惊魂剧本卡候选选择 E2E 证据

## 范围

- 规则切片：开局翻阅五张剧本卡、提议当前剧本卡、已选探索者共同确认剧本卡、共同确认进度、待接入剧本不能开局、回选可运行剧本后进入恶兆前牌桌。
- 真实入口：`/play/betrayal`，未使用状态注入。
- 不代表完成：50 个作祟逐条运行时、属性轨、房间朝向、移动力快照、伤害分配、交易限制、武器声明等仍按全规则账本继续排队。

## 验证命令

- `npx vitest run src/games/betrayal/__tests__/firstScenarioRuntime.test.ts -t "剧本卡" --configLoader native --pool threads --no-file-parallelism --maxWorkers 1`
- `npx vitest run src/games/betrayal/__tests__/Board.foundation.test.tsx -t "剧本卡|共同确认" --configLoader native --pool threads --no-file-parallelism --maxWorkers 1`
- `npx eslint src/games/betrayal/game.ts src/games/betrayal/Board.tsx src/games/betrayal/__tests__/Board.foundation.test.tsx src/games/betrayal/__tests__/firstScenarioRuntime.test.ts e2e/betrayal/scenario-card-selection.e2e.ts public/locales/zh-CN/game-betrayal.json public/locales/en/game-betrayal.json`
- `node scripts/infra/run-e2e-single.mjs ci e2e/betrayal/scenario-card-selection.e2e.ts`

## 结果

- 领域测试：`1 passed / 195 skipped`，覆盖候选池、提议清空确认、多人确认和待接入剧本阻止开局。
- 组件测试：`2 passed / 79 skipped`，覆盖五张候选、共同确认进度和等待其他玩家确认的禁用态。
- ESLint：`0 errors`；剩余为既有 warning / JSON ignored 提示，不作为本切片阻塞。
- E2E：`1 passed`。
- 图面核验：通过。三张图分别覆盖五张候选与 `剧本确认 0/1`、待接入剧本确认后 `剧本确认 1/1` 仍不能开始、确认赤红杰克后进入恶兆前牌桌。

## 截图

| 文件 | 画面结论 |
| --- | --- |
| `01-五张剧本卡候选.jpg` | 弹窗显示五张候选剧本卡和共同确认进度 `剧本确认 0/1`；赤红杰克归来是当前提议并标为可开局；其余候选显示待接入。 |
| `02-待接入剧本卡不能开始.jpg` | 永远的朋友被确认后显示 `剧本确认 1/1`，但主按钮仍显示规则待接入、不能开始，并处于禁用态。 |
| `03-确认赤红杰克后进入牌桌.jpg` | 回选赤红杰克归来并确认后，进入恶兆前真实牌桌。 |
