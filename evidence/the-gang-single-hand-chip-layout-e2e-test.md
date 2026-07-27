# 纸牌帮单副手牌自己的筹码布局证据

## 问题

- 用户指出：验收对象是“单副手牌里，自己的筹码显示在哪里”。
- 本轮正确目标状态：自己的筹码显示在一副手牌上方，覆盖在手牌区域上层，不另占一行布局空间；顶部玩家区只显示其他玩家筹码。
- 最新验收口径：不能再用只含目标元素的单点截图收口，必须有关键元素齐全的压力态，能判断遮挡、空间和操作入口是否合理。

## 修复口径

- 单副手牌：自己的当前筹码由 `the-gang-local-hand-top-chip-rail` 承载，显示为 `hand-current-chip`。
- 单副手牌：顶部玩家区 `top-zone` 不包含 `玩家 1`，也不生成 `the-gang-player-chip-strip-0`。
- 单副手牌：筹码轨绝对定位在一副手牌上方居中，不能跑到顶部玩家列表，不能跑到手牌右侧外贴，也不能压住牌面。
- 两副手牌：仍保留上下两副手牌旁的右侧筹码轨，不把一副牌修复误伤两副牌分支。

## 历史基线

- 一周前旧截图 `test-results/evidence-screenshots/the-gang/the-gang-tutorial.e2e/桌面教程覆盖读牌力、选筹码、公共牌推进和摊牌反馈/教程首轮全员拿白筹码.jpg` 直接证明：自己的白色 1 星筹码在两张本地手牌上方居中显示；玩家 2 / 玩家 3 的筹码才在顶部玩家列表区域。
- `dad197f27646821cf1adfc4ff299bf769ff49ee9`（2026-07-19 前的代码基线）里顶部玩家区仍会遍历 `core.playerIds.map(...)`，说明历史代码和当前目标有过多种形态；因此不能只靠当前 DOM 或某个提交反推 UI 合同。
- 本轮以一周前旧截图作为“自己的筹码显示位置”的真相源：自己的筹码在一副手牌上方；顶部玩家列表只应作为其他玩家筹码的显示位置。

## 截图证据

| 截图 | 路径 | 当前状态 |
| :--- | :--- | :--- |
| 当前最终压力态图：第 4 轮满公共牌，自己的筹码在一副手牌上方 | `test-results/evidence-screenshots/the-gang/single-hand-chip-layout-current/02-压力态-第4轮满公共牌自己的筹码在一副手牌上方且无遮挡.jpg` | 最终验收图。图里同时包含 5 张公共牌、顶部玩家 2/3 筹码、右上抢劫/金库/警报状态、左下牌型/扩展/工具入口、自己的两张手牌、自己的 4 枚筹码和“摊牌”按钮；自己的筹码在手牌正上方，没有遮挡手牌、公共牌或主按钮。 |
| 标注辅助图：圈出自己的筹码 | `test-results/evidence-screenshots/the-gang/single-hand-chip-layout-current/03-标注-圈出自己的筹码在一副手牌上方.png` | 只用于回答“图里自己的筹码在哪”。红圈圈出手牌上方的本地玩家筹码，不替代原始压力态截图。 |
| 当前局部诊断图：刚拿白筹码后自己的筹码在一副手牌上方 | `test-results/evidence-screenshots/the-gang/single-hand-chip-layout-current/01-先拿筹码后自己的筹码在一副手牌上方.jpg` | 只能证明“先拿筹码后”的单点位置；因缺少满公共牌等关键竞争元素，按新口径不再作为布局最终验收图。 |
| 一周前旧图：自己的筹码在一副手牌上方 | `test-results/evidence-screenshots/the-gang/the-gang-tutorial.e2e/桌面教程覆盖读牌力、选筹码、公共牌推进和摊牌反馈/教程首轮全员拿白筹码.jpg` | 历史真相源。肉眼看到自己的 1 星筹码在两张本地手牌上方居中；玩家 2/3 的筹码在顶部玩家区。 |
| 旧错误截图：自己的筹码在右侧外贴 | `test-results/evidence-screenshots/the-gang/single-hand-chip-layout-current/01-先拿筹码后自己的筹码在本地手牌外侧.jpg` | 已废弃。它证明的是错误理解，不能作为本问题验收证据。 |

> 旧的“顶部玩家面板”“右侧外贴”和首轮单点截图都不能再冒充当前最终验收图；最终验收图必须是第 4 轮压力态截图。

## 断言证据

- 单副手牌顶部玩家面板数为 `玩家数 - 1`，且顶部不包含 `玩家 1`。
- `the-gang-player-chip-strip-0` 不存在，避免本地玩家被塞进顶部玩家面板。
- `the-gang-local-hand-top-chip-rail` 存在，且包含自己的 `hand-current-chip` 和历史筹码 `hand-chips-previous`。
- E2E 几何断言确认自己的筹码在一副手牌上方居中、没有进入顶部玩家列表、没有跑到手牌右侧外贴、没有压住牌面。
- 压力态断言确认公共牌、顶部玩家区、右上状态、左下工具入口、主操作按钮和本地手牌同屏，并且自己的筹码不遮挡这些关键区域。

## 已完成验证

- `npx eslint e2e/the-gang/the-gang-runtime.e2e.ts src/games/the-gang/Board.tsx src/games/the-gang/__tests__/Board.runtime.test.tsx`：通过。
- `node scripts/infra/run-e2e-single.mjs ci e2e/the-gang/the-gang-runtime.e2e.ts "桌面端单副手牌先拿筹码后自己的筹码显示在一副手牌上方"`：通过，`1 passed`，并生成最终压力态图。
- AI 图面核验：通过。压力态图能看到自己的 4 枚筹码在两张本地手牌正上方，公共牌、顶部玩家、左下入口、右上状态和“摊牌”按钮都没有被遮挡。
- 本机开图：通过。`npm run verify:open-image -- "<压力态原图>" "<标注辅助图>"` 返回两条 `OPENED_IMAGE=`，已打开原始压力态图和圈出自己的筹码位置的辅助图。
- `git diff --check -- .codex/skill/screenshot-delivery/SKILL.md docs/ai-rules/e2e-verification.md docs/ai-rules/doc-index.md e2e/the-gang/the-gang-runtime.e2e.ts`：通过。
- `python D:\codex-home\skills\.system\skill-creator\scripts\quick_validate.py D:\codex-home\skills\ui-audit-loop`：通过，`Skill is valid!`。

## 规范更新

- `D:\codex-home\skills\ui-audit-loop\SKILL.md`：新增“验收口径变更后旧截图必须重新归类”，旧图不满足新压力态口径时只能作历史/局部诊断/失败/过期证据。
- `.codex/skill/screenshot-delivery/SKILL.md`：新增 `10B`，项目截图交付中禁止把旧截图沿用为新口径下的最终验收图。
- `docs/ai-rules/e2e-verification.md`：新增 `14B.2`，E2E 截图验收口径更新后必须降级旧图或重拍。
- `docs/ai-rules/doc-index.md`：E2E 与截图验收入口摘要加入“验收口径更新后旧截图必须按新口径降级或重拍”。
