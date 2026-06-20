# Fantasy Realms 抓牌/弃牌 UI 截图验收

日期：2026-06-20

工作区：`D:\gongzuo\webgame\BoardGame`（`main`）

验证命令：

- `npx eslint src/games/fantasyrealms/Board.tsx src/games/fantasyrealms/__tests__/Board.foundation.test.tsx e2e/fantasyrealms/fantasyrealms-live-flow.e2e.ts e2e/fantasyrealms/fantasyrealms-online-ai.e2e.ts e2e/fantasyrealms/fantasyrealms-online-ai-deep.e2e.ts e2e/fantasyrealms/fantasyrealms-online-ai-golden.e2e.ts e2e/fantasyrealms/fantasyrealms-online-basic.e2e.ts e2e/fantasyrealms/helpers/fantasyrealmsOnlineAi.ts`
- `node scripts/infra/vitest-cli-safe.mjs run src/games/fantasyrealms/__tests__/Board.foundation.test.tsx --configLoader native`
- `npm run test:e2e:ci:file -- e2e/fantasyrealms/fantasyrealms-live-flow.e2e.ts "抓牌弃牌关键阶段截图链保持同一套正式 UI"`

截图目录：

`test-results/evidence-screenshots/_shared/fantasyrealms-live-flow.e2e/抓牌弃牌关键阶段截图链保持同一套正式-UI/`

截图清单：

- `抓牌弃牌关键阶段截图链保持同一套正式-UI-01-开局自动摸牌后-待弃牌.png`
- `抓牌弃牌关键阶段截图链保持同一套正式-UI-02-弃牌阶段-选中手牌待确认.png`
- `抓牌弃牌关键阶段截图链保持同一套正式-UI-03-等待对手回合-无本方动作按钮.png`
- `抓牌弃牌关键阶段截图链保持同一套正式-UI-04-中盘公开弃牌存在-摸牌与拿公开牌二选一.png`
- `抓牌弃牌关键阶段截图链保持同一套正式-UI-05-拿公开牌后-中央公开牌承接选择.png`

肉眼核对结论：

- 开局空弃牌时没有摸牌按钮，系统已自动进入弃牌阶段。
- 弃牌阶段右侧只有弃牌确认动作，未出现长说明正文。
- 非本方回合不显示本方动作按钮。
- 中盘公开弃牌存在时只显示 `摸牌` 和 `拿公开牌` 两个短动作。
- 进入拿公开牌选牌态后，右侧动作按钮退场，由中央公开牌承接选择。
