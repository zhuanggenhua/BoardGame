# 线上反馈收口记录（2026-09-01）

## 口径

- 本轮口径：线上真实反馈。
- 线上读源：`http://8.148.71.102`。
- 当前抓取：`temp/feedback-closeout/2026-09-01-current-lock/summary.json`，生成时间 `2026-09-01T02:06:12.353Z`（北京时间 2026-09-01 10:06:12）。
- 抓取结果：`open=0`，`in_progress=10`，共 10 条未收口代表项。
- 本轮直接代码改动：`src/games/betrayal/game.ts`，让事件待投骰命令先走自己的触发者校验，再进入普通“是否轮到当前玩家”的校验。
- 当前树已验证修复：DiceThrone 旧浏览器正则 / `structuredClone` 兼容、Smash Up `reaction_pass` 缺少原因、Betrayal 事件待投骰恢复、DiceThrone 炽天使已有飞行 Token 响应链。天使斗篷投 4 的旧“获得飞行”结论已作废，需按“抵挡 1 点伤害且不授予飞行 Token”重新验证后再收口。

## 反馈处理结论

| 反馈 ID | 游戏 | 反馈原文 / 自动检测内容 | 结论 | 证据 |
| --- | --- | --- | --- | --- |
| `6a941e9987630a16ec8273bd` | Dice Throne | `[auto][window.error] Invalid regular expression: invalid group specifier name` | 已解决。当前树已消除旧浏览器不支持的 `(?<...)` 正则风险，生产构建通过。 | `rg -n "\(\?<" src apps -g '!**/node_modules/**'` 无命中；`npm run build` 通过。 |
| `6a951ed887630a16ec827ba7` | Smash Up | `[system][player-command-failure] su:reaction_pass pipeline_error: Cannot read properties of undefined (reading 'reason')` | 已解决。当前树在玩家让过未带原因时按“玩家主动让过”处理，不再读取不存在的原因字段。 | `npx vitest run src/games/smashup/__tests__/response-window-skip.test.ts src/games/smashup/__tests__/MeFirstOverlay.test.tsx`：2 files / 33 tests passed。 |
| `6a95977c87630a16ec828049` | Betrayal | `[system][player-command-failure] EXPLORE_ROOM pipeline_error: event roll must be started by ROLL_EVENT` | 已解决。待事件投骰时不会继续给当前回合 AI 生成探索动作，恢复链会让事件触发者执行正式投骰命令。 | `npx vitest run src/games/betrayal/__tests__/ai.test.ts`：1 file / 42 tests passed。 |
| `6a95979b87630a16ec828059` | Betrayal | `[system][online-ai-watchdog] EXPLORE_ROOM pipeline_error: event roll must be started by ROLL_EVENT` | 已解决。同上，线上 AI 恢复场景由事件触发者补 `ROLL_EVENT`，不是继续探索。 | `npx vitest run src/games/betrayal/__tests__/ai.test.ts`：1 file / 42 tests passed。 |
| `6a95979f87630a16ec828061` | Betrayal | `[system][online-ai-watchdog] circuit-breaker-tripped pipeline_error: event roll must be started by ROLL_EVENT` | 已解决。同一事件待投骰恢复链修复后，不再反复撞探索命令导致熔断。 | `npx vitest run src/games/betrayal/__tests__/ai.test.ts`：1 file / 42 tests passed。 |
| `6a95979f87630a16ec828069` | Betrayal | `[system][online-ai-watchdog] ADVANCE_PHASE 未知运行时命令。` | 已解决。待事件投骰期间会抑制普通阶段强推，改走座位合法动作恢复。 | `npx vitest run src/games/betrayal/__tests__/ai.test.ts`：1 file / 42 tests passed。 |
| `6a95979f87630a16ec828071` | Betrayal | `[system][online-ai-watchdog] repeated-recovery-suppressed active-turn:repeat-limit:3/3:force_advance_failed:ADVANCE_PHASE:未知运行时命令。` | 已解决。同一恢复链不再重复尝试未知阶段推进命令。 | `npx vitest run src/games/betrayal/__tests__/ai.test.ts`：1 file / 42 tests passed。 |
| `6a95a21987630a16ec82811c` | Client | `[auto][react.error_boundary] structuredClone is not defined` | 已解决。当前入口已加载全局 `structuredClone` 兼容实现，旧浏览器不会因缺少该 API 崩溃。 | `src/main.tsx` 引入 `src/lib/structuredClonePolyfill.ts`；`npm run typecheck` 和 `npm run build` 通过。 |
| `6a956ea687630a16ec827e43` | Dice Throne | `使用飞行token来防御，但是怎么还是跳过，没有牌可以打了啊` | 已解决。真实入口证明防御伤害响应弹窗里飞行 Token 可直接点击，不是只剩“跳过”；有 6 免伤，无 6 会继续扣伤并收口。 | `npm run test:e2e:file -- e2e/dicethrone/tianshi-ability-card-real-entry.e2e.ts "防御掷骰阶段的伤害响应弹窗应允许立即使用飞行"`：1 passed。截图目录：`test-results/evidence-screenshots/dicethrone/tianshi-ability-card-real-entry.e2e/防御掷骰阶段的伤害响应弹窗应允许立即使用飞行并免除当前伤害/`。 |
| `6a956ece87630a16ec827e4e` | Dice Throne | `天使斗篷投出4没效果啊，难道被奖励骰覆盖了？` | 旧结论作废：天使斗篷投出 4（双翼）不应授予飞行 Token，而是抵挡 1 点伤害；此前把提示卡里的飞行 Token 说明误接成天使斗篷骰面效果。当前需以“投 4 抵挡 1、无飞行 Token、攻击正常收口”的新真实入口证据重新收口。 | 旧 E2E 名为“天使斗篷双翼取得飞行后”的证据已失效；本轮以新用例“天使斗篷投出双翼后，真实防御链应防止 1 点伤害且不授予飞行”替代。 |

## 验证命令

- `node .spec/skills/feedback-closeout/scripts/triage-open-feedback.mjs --base-url http://8.148.71.102 --statuses open,in_progress --limit 100 --out-dir temp/feedback-closeout/2026-09-01-current-lock`
- `npx vitest run src/games/betrayal/__tests__/ai.test.ts`
- `npm run typecheck`
- `npx vitest run src/games/smashup/__tests__/response-window-skip.test.ts src/games/smashup/__tests__/MeFirstOverlay.test.tsx`
- `rg -n "\(\?<" src apps -g '!**/node_modules/**'`
- `npm run build`
- `node scripts/infra/e2e-doctor.mjs`
- `npm run test:e2e:file -- e2e/dicethrone/tianshi-ability-card-real-entry.e2e.ts "天使斗篷投出双翼后，真实防御链应防止 1 点伤害且不授予飞行"`
- `npm run test:e2e:file -- e2e/dicethrone/tianshi-ability-card-real-entry.e2e.ts "天使斗篷防御骰 4、5 和 6 应从真实防御链分别减免 1、2 与 3 点伤害"`
- `npm run test:e2e:file -- e2e/dicethrone/tianshi-ability-card-real-entry.e2e.ts "防御掷骰阶段的伤害响应弹窗应允许立即使用飞行"`

## 非阻塞备注

- `npm run build` 通过；输出包含既有 CSS 优化告警、chunk size 告警和 Browserslist 数据过期提示，本轮未把这些作为反馈根因处理。
- E2E 编码检查通过；输出保留 4 条既有可疑告警，本轮未修改对应文件。
- 当前工作区还有与本轮线上反馈无关的既有脏改，最终汇报不得把它们算作本轮成果。
