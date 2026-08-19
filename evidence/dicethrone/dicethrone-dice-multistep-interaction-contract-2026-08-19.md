# DiceThrone 选骰重投 / 改骰共享交互验证证据

## 原始症状

- 用户最新纠偏：`我又行了！` / `就这？` 是“选择至多 5 颗骰子并进行 1 次额外投掷尝试”，应当是一次确认前的一批多选；不是确认一批后继续保留 `1/5`、`2/5`、`4/5` 的分批多步窗口。
- 用户同时指出的另一类规则：`不愧是我！` 明确写了“同一颗骰子重掷 2 次，或两颗骰子各重掷 1 次”，这才是同一对象可重复、按次数累计的多步合同。
- 玩家看到的错误是默认重投牌确认后仍残留“该骰子已完成结算”一类状态；内部证据是共享 `selectDie` 交互错误保留 `completedDieIds` / `completedSteps` 并继续开放下一批选择。

## 规则合同

- `public/locales/zh-CN/game-dicethrone.json`：`card-just-this` 描述为“对至多 5 颗骰子进行 1 次额外的投掷尝试”。
- `public/locales/zh-CN/game-dicethrone.json`：`card-i-can-again` 描述为“对至多 5 颗骰子进行 1 次额外的投掷尝试”。
- `public/locales/zh-CN/game-dicethrone.json`：`card-worthy-of-me` 描述为“重掷至多 2 颗骰子（可以是同一颗骰子重掷 2 次，或两颗骰子各重掷 1 次）”。
- `src/games/dicethrone/domain/customActions/common.ts`：只有 `reroll-die-2` 声明 `allowRepeatedDieSelection: true`；`reroll-die-5` 没有该声明。

## 合同拆分

- 一批多选：`我又行了！` / `就这？`，确认时提交当前选择的 1 至 5 颗骰并关闭整张牌交互；确认后不应继续显示 `1/5`、`2/5` 或 `4/5`。
- 同骰可重复：`不愧是我！`，允许同一颗骰子连续选择两次，或两颗不同骰各一次；已提交一次后取消只关闭剩余交互，不返还 CP 和卡牌。
- 默认不可重复：未声明同骰重复的重投牌仍按骰子本体去重；再次选择已完成骰应继续拒绝为“该骰子已完成结算”，这是正确的反向保护。

## 根因分层

- 现实故障现象：一次性多选牌被错误做成了分批累计交互，玩家第一次确认后还能继续选，后续再点已完成骰会看到“该骰子已完成结算”。
- 直接触发条件：`selectDie` 交互创建时无条件设置 `confirmationMode: 'submitBatch'` 和 `maxSteps: selectCount`，导致普通 `reroll-die-5` 也进入“提交本批但不关闭”的语义。
- 根本机制：实现把两类规则合同混成一种：`至多 N 颗` 被误解成“可分批累计到 N 次”，没有只让明确声明 `allowRepeatedDieSelection` 的效果进入同骰可重复 / 多步累计模式。
- 漏审复盘：之前测试和 evidence 把错误行为写成通过标准，尤其是 `2/5 -> 4/5 -> 空确认结束`；这属于测试基线固化错误规则，不是用户操作问题。

## 修复覆盖

- `src/games/dicethrone/domain/systems.ts`：共享 `selectDie` 创建器只在 `allowRepeatedDieSelection === true` 时启用 `submitBatch` 和 `maxSteps`；普通 `reroll-die-5` 恢复为确认即关闭。
- `src/games/dicethrone/Board.tsx`：客户端反序列化重注入同样按 `allowRepeatedDieSelection` 分流，避免 UI 端再次把普通重投注成分批模式。
- `src/games/dicethrone/__tests__/test-utils.ts`：测试注入工具同步分流，避免测试状态成为第二套错误真相。
- `src/games/dicethrone/__tests__/flow.test.ts`：删除错误的“我又行了分两批”预期，改为“选两颗确认后关闭整张牌”和“选一颗确认后关闭整张牌”；保留 `不愧是我` 同骰两次和取消不返还。
- `e2e/dicethrone/dicethrone-die-reroll.e2e.ts`：真实浏览器路径改为 `我又行了` / `就这` 确认后交互关闭；`不愧是我` 保留同骰两次与取消路径。
- `.spec/knowledge/standards/rule-driven-interaction-design.md`：新增项目通用交互规范，明确“至多 N 个对象”默认是一批多选，不等于跨确认分批累计；只有规则原文明写同对象可重复或次数分配时才使用多步累计。

## 截图证据

- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-die-reroll.e2e\card-i-can-again-一次选择两颗确认后关闭整张牌交互\i-can-again-first-two-dice-selected-before-confirm.jpg`
  - 画面显示 `我又行了！` 选中两颗正式骰后，确认按钮用于提交当前这批选择。
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-die-reroll.e2e\card-i-can-again-一次选择两颗确认后关闭整张牌交互\i-can-again-after-confirm-closes-card.jpg`
  - 画面显示确认后 `我又行了！` 交互已关闭，右侧不再显示 `2/5` 或继续选骰提示；同条 E2E 状态断言确认卡已离开手牌并进入弃牌。
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-die-reroll.e2e\card-just-this-防御阶段可通过真实骰子入口重掷已锁定防御骰\just-this-locked-defense-die-selected-before-confirm.jpg`
  - 画面显示防御阶段 `就这？` 可以选择已锁定的正式防御骰。
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-die-reroll.e2e\card-just-this-防御阶段可通过真实骰子入口重掷已锁定防御骰\just-this-locked-defense-confirm-closes-card.jpg`
  - 画面显示确认后 `就这？` 交互关闭，手牌不再保留该卡，防御骰已按新值显示。
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-die-reroll.e2e\card-worthy-of-me-可通过真实骰子入口重掷同一颗骰子两次\worthy-of-me-same-die-selected-twice-before-confirm.jpg`
  - 画面显示 `不愧是我！` 可把同一颗骰子选择两次，这是规则明确允许的重复次数合同。
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-die-reroll.e2e\card-worthy-of-me-可通过真实骰子入口重掷同一颗骰子两次\worthy-of-me-same-die-rerolled-twice-settled.jpg`
  - 画面显示同一颗骰子两次重掷后交互关闭。
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-die-reroll.e2e\card-worthy-of-me-提交一次重掷后取消不返还-CP-和卡牌\worthy-of-me-after-one-reroll-before-cancel.jpg`
  - 画面显示 `不愧是我！` 已提交 1 次重投后仍可选择继续或取消剩余交互。
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-die-reroll.e2e\card-worthy-of-me-提交一次重掷后取消不返还-CP-和卡牌\worthy-of-me-cancel-after-one-reroll-no-refund.jpg`
  - 画面显示取消后交互关闭；同条 E2E 状态断言确认 CP 没有返还、卡仍在弃牌堆、骰面保留已提交的重投结果。

## 验证

- `npx vitest run src/games/dicethrone/__tests__/flow.test.ts -t "我又行了|就这|不愧是我" --reporter verbose`：8 passed。
- `npx vitest run src/games/dicethrone/__tests__/basic-commands-coverage.test.ts -t "DiceThrone 改骰与重掷交互应由确认按钮收口|AI selectDie|AI modifyDie|selectDie|modifyDie" --reporter verbose`：11 passed。
- `npx vitest run src/engine/systems/__tests__/useMultistepInteraction.test.tsx src/games/dicethrone/ui/__tests__/DiceTray.test.tsx --reporter verbose`：14 passed。
- `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/dicethrone-die-reroll.e2e.ts`：10 passed，包含 `card-i-can-again 一次选择两颗确认后关闭整张牌交互`、`card-just-this 防御阶段可通过真实骰子入口重掷已锁定防御骰`、`card-worthy-of-me 可通过真实骰子入口重掷同一颗骰子两次` 和取消路径。

## 回归提交

- 已确认引入强候选提交：`e990af2f0a37027e17696ea978752cfbfdb5cd07`（2026-08-19 20:28:23 +0800，`收口在线 AI、交互测试规范与多游戏规则修复`）。
- 关键错误 hunk：该提交在 `src/games/dicethrone/domain/systems.ts` 的 `selectDie` 分支里把 `maxSteps: selectCount` 与 `confirmationMode: 'submitBatch'` 无条件应用到所有选骰重投，直接把 `reroll-die-5` 错接成分批累计交互。

## 失效证据处理

- 旧截图目录 `card-i-can-again-分批重掷时确认本批次不关闭整段交互` 只保留为历史坏基线，不再作为 PASS 证据。
- 旧结论 `2/5 -> 4/5 -> 空确认结束` 已撤销；当前 PASS 合同是 `我又行了！/就这？` 确认当前选择后关闭，`不愧是我！` 才允许同骰重复和多步累计。
