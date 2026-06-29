# Fantasy Realms 抓牌/弃牌 UI 截图验收

日期：2026-06-20

工作区：`D:\gongzuo\webgame\BoardGame`（`main`）

验证命令：

- `npx eslint src/games/fantasyrealms/Board.tsx src/games/fantasyrealms/__tests__/Board.foundation.test.tsx src/games/fantasyrealms/__tests__/ai.test.ts e2e/fantasyrealms/fantasyrealms-live-flow.e2e.ts e2e/fantasyrealms/helpers/fantasyrealmsOnlineAi.ts e2e/fantasyrealms/fantasyrealms-online-ai.e2e.ts e2e/fantasyrealms/fantasyrealms-online-ai-golden.e2e.ts e2e/fantasyrealms/fantasyrealms-online-basic.e2e.ts`
- `node scripts/infra/vitest-cli-safe.mjs run src/games/fantasyrealms/__tests__/Board.foundation.test.tsx --configLoader native`
- `npm run test:e2e:ci:file -- e2e/fantasyrealms/fantasyrealms-live-flow.e2e.ts "抓牌弃牌关键阶段截图链保持同一套正式 UI"`
- `npm run verify:open-image -- "D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\fantasyrealms-live-flow.e2e\抓牌弃牌关键阶段截图链保持同一套正式-UI\抓牌弃牌关键阶段截图链保持同一套正式-UI-03-中盘公开弃牌存在-摸牌按钮与中央牌直点.png"`

截图目录：

`test-results/evidence-screenshots/_shared/fantasyrealms-live-flow.e2e/抓牌弃牌关键阶段截图链保持同一套正式-UI/`

截图清单：

- `抓牌弃牌关键阶段截图链保持同一套正式-UI-01-开局自动摸牌后-待弃牌.png`
- `抓牌弃牌关键阶段截图链保持同一套正式-UI-02-点击手牌直接弃牌后-等待对手回合.png`
- `抓牌弃牌关键阶段截图链保持同一套正式-UI-03-中盘公开弃牌存在-摸牌按钮与中央牌直点.png`
- `抓牌弃牌关键阶段截图链保持同一套正式-UI-04-点击中央牌拿取后-待弃牌.png`

肉眼核对结论：

- 开局空弃牌时没有摸牌按钮，系统已自动进入弃牌阶段。
- 弃牌阶段显示大横幅 `弃一张牌`，没有右侧二次操作按钮；手牌本体直接承接弃牌。
- 非本方回合不显示本方动作按钮。
- 中盘有公开弃牌时显示大横幅 `摸牌 / 拿中央牌`，右侧只保留 `摸牌` 按钮。
- 中央公开牌本体直接承接拿牌；拿牌后若规则要求弃 1，会进入同一套大横幅弃牌态。
