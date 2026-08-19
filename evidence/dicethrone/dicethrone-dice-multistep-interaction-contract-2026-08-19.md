# DiceThrone 选骰重投 / 改骰共享交互验证证据

## 原始症状

- 用户最新复现路径：`我又行了！` / `reroll-die-5` 这类“至多 5 颗重投”牌，第一次选择 2 颗骰并确认后，界面显示成 `1/5` 或错误回到普通确认链；第二批再选 2 颗时会遇到“已确认 / 不能投 / 不能改”的串线。
- 正确玩家语义：选中一批骰子后点“确认”只表示“提交这一批重投命令”；只有在已经至少重投过骰子、且当前没有新选中骰子时，再点“确认”才表示“结束整张卡牌交互”。
- 用户现场复现的关键路径不是“某一张牌能不能重投”，而是所有“选骰重投 / 改骰”类多步骰子交互共享额度、确认和已完成记录串错：选择两次后 UI 计数归 0，仍能继续选择，然后命令报错。
- 需要保真覆盖的重投路径：`不愧是我！` 允许同一颗骰子在同一次卡牌效果里重投 2 次；选满后不能回到 0/2，也不能继续越额选择；确认后应生成两次同骰重投并关闭交互。
- 需要保真覆盖的默认重投路径：未声明“同骰可重复”的重投牌，例如 `我又行了！` / `就这？`，仍按骰子本体去重，不能因为共享修复放开重复消费。
- 需要保真覆盖的改骰路径：`玩得六啊`、`俺也一样`、`惊不惊喜`、`意不意外`、`弹一手` 等改骰类卡牌也必须读取同一份“已完成次数 + 剩余额度”合同，不能已完成 1 步后仍按总额度继续改 2 颗。
- 同时保留已锁定防御骰路径：防御方在防御阶段打出 `就这？`，选择已锁定的正式防御骰，确认后该骰被重掷。

## 规则合同

- `public/locales/zh-CN/game-dicethrone.json`：`不愧是我！` 描述为“你或 1 名队友可以重掷至多 2 颗骰子（可以是同一颗骰子重掷 2 次，或两颗骰子各重掷 1 次）”。
- `src/games/dicethrone/domain/commonCards.ts`：`card-worthy-of-me` 接到共享的 `reroll-die-2`；`card-i-can-again` / `card-just-this` 接到共享的 `reroll-die-5`；改骰卡接到共享的 `modifyDie` 合同。
- `src/games/dicethrone/domain/customActions/common.ts`：只有 `reroll-die-2` 声明“允许同一颗骰子重复选择”；其它重投和所有改骰默认仍按骰子本体去重。

## 根因分层

- 现实故障现象：同类骰子多步交互没有稳定表达“本次交互已完成几步、剩余几步、是否允许同骰重复”，导致同骰重投、锁定防御骰重投、已完成后的改骰继续选择都可能表现成 UI 额度归零、继续可点或命令被拒。
- 本轮直接命中点：共享多步交互 hook 以前把“确认本批次”与“关闭整段交互”混成同一个动作，手动确认会在业务命令后无条件发送关闭交互命令；这会让第一批重投后整张卡交互被关掉，后续 UI/命令回到不该进入的普通骰面确认状态。
- 直接触发条件：第二次 `REROLL_DIE` 进入命令校验时，当前多步交互里没有把“允许重复同骰”和“已完成次数”传到校验合同，导致同一 `dieId` 命中已完成骰子拒绝。
- 之前误判原因：旧验证只覆盖了单骰/两颗不同骰的 happy path；低层 runner 还会在中途命令失败后继续执行，如果只看最终状态会漏掉失败命令。
- 根本机制：选骰重投 / 改骰交互缺少统一的数据合同来区分“默认按骰子本体去重”和“规则允许按次数重复选择同一骰”，并且 UI、命令校验、AI 和测试注入工具没有统一合并“服务端已完成次数 + 当前本地临时选择”。

## 修复覆盖

- `src/engine/systems/InteractionSystem.ts`、`src/engine/systems/useMultistepInteraction.ts`：新增“确认本批次”和“关闭整段交互”的语义区分；`submitBatch` 模式下，确认按钮先提交本批次命令，不自动关闭交互。
- `src/engine/systems/__tests__/useMultistepInteraction.test.tsx`：补低层回归，断言第一次批量确认只发 `REROLL_DIE`，不发关闭交互命令。
- `src/games/dicethrone/domain/core-types.ts`：给交互合同补充 `allowRepeatedDieSelection` 与 `completedSteps` 语义。
- `src/games/dicethrone/domain/index.ts`、`src/games/dicethrone/domain/commandValidation.ts`：从多步交互数据构造命令校验用合同时，透传允许重复同骰、已完成次数和已完成骰子，服务端按共享合同拒绝越额和非法重复。
- `src/games/dicethrone/domain/systems.ts`：选骰 reducer、交互创建和重投 / 改骰后完成记录按合同区分“按次数记录”和“按骰子去重”。
- `src/games/dicethrone/Board.tsx`、`src/games/dicethrone/ui/DiceTray.tsx`、`src/games/dicethrone/ui/RightSidebar.tsx`：UI 剩余额度改为“服务端已完成次数 + 当前本地临时选择”，选满后不再显示 0/2 或允许越额点击。
- `src/games/dicethrone/ai.ts`：AI 合法动作按共享合同生成剩余步数；允许重复时可枚举同骰两次，默认不可重复时过滤已完成骰，改骰已完成一步后只生成剩余一步。
- `src/games/dicethrone/__tests__/test-utils.ts`：测试注入的多步骰子交互也按剩余额度生成 reducer 和命令，避免测试工具成为第二套真相。
- `src/games/dicethrone/__tests__/flow.test.ts`：新增 `我又行了！` 分两批各重掷 2 颗的领域回归，断言第一次确认后累计 `2/5`、第二次确认后累计 `4/5`，交互仍然存在；另保留同骰两次、默认不可重复和代表改骰卡断言。
- `src/games/dicethrone/__tests__/basic-commands-coverage.test.ts`：新增 AI 重复同骰、已完成后剩余步数、默认不可重复、改骰剩余额度四类断言。
- `e2e/dicethrone/dicethrone-die-reroll.e2e.ts`：把 `card-i-can-again` E2E 改成真实分批路径：第一批选两颗并确认后截图 `2/5`，第二批再选两颗并确认后截图 `4/5`，最后空确认才结算整张牌；同时断言手牌区没有残留卡牌、飞出动画结束。
- `.spec/knowledge/standards/testing-tdd.md`：补充 GameTestRunner 成功路径断言规则，要求预期全部成功的命令链必须显式检查没有失败步骤。
- `docs/automated-testing.md`：只作为工具说明适配层，指回项目测试规范主源，不维护第二套规则正文。

## 截图证据

- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-die-reroll.e2e\card-i-can-again-分批重掷时确认本批次不关闭整段交互\i-can-again-first-two-dice-selected-before-confirm.jpg`
  - 画面显示玩家在“我又行了！”交互中选中前两颗正式骰，确认按钮仍是交互确认，不是普通投掷确认。
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-die-reroll.e2e\card-i-can-again-分批重掷时确认本批次不关闭整段交互\i-can-again-after-first-confirm-shows-2-of-5.jpg`
  - 画面显示第一次确认后右侧提示为“选择骰子（2/5）”，说明确认只提交了第一批两颗重投，交互没有关闭。
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-die-reroll.e2e\card-i-can-again-分批重掷时确认本批次不关闭整段交互\i-can-again-second-two-dice-selected-before-confirm.jpg`
  - 画面显示第二批又能继续选择两颗骰，没有出现“已确认不能投”的阻断。
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-die-reroll.e2e\card-i-can-again-分批重掷时确认本批次不关闭整段交互\i-can-again-after-second-confirm-shows-4-of-5.jpg`
  - 画面显示第二次确认后右侧提示为“选择骰子（4/5）”，说明累计进度按重投颗数增长，没有错误显示成 `1/5` 或归零。
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-die-reroll.e2e\card-i-can-again-分批重掷时确认本批次不关闭整段交互\i-can-again-empty-confirm-settles-card.jpg`
  - 画面显示空确认后交互提示消失，按钮回到普通“投掷 / 确认 / 结束攻击”区域；领域断言同时确认该卡已进入弃牌、手牌区不再包含该卡。
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-die-reroll.e2e\card-worthy-of-me-可通过真实骰子入口重掷同一颗骰子两次\worthy-of-me-same-die-selected-twice-before-confirm.jpg`
  - 画面显示同一颗正式骰子被选择两次后进入完成状态，未回到 0/2。
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-die-reroll.e2e\card-worthy-of-me-可通过真实骰子入口重掷同一颗骰子两次\worthy-of-me-same-die-rerolled-twice-settled.jpg`
  - 画面显示确认后骰 0 先重掷为 6，再重掷为 5，交互关闭。
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-die-reroll.e2e\card-worthy-of-me-可重掷两颗不同骰并确认\worthy-of-me-two-dice-selected-before-confirm.jpg`
  - 画面显示两颗不同骰的原有路径仍可选满并确认。
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-die-reroll.e2e\card-just-this-防御阶段可通过真实骰子入口重掷已锁定防御骰\just-this-locked-defense-die-rerolled-shows-1-of-5.jpg`
  - 画面显示 `就这？` 第一批确认后第一颗已锁定防御骰被重掷为 6，交互仍显示“选择骰子（1/5）”，说明“确认本批次”和“结束整张牌”没有混用。
- `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-die-reroll.e2e\card-just-this-防御阶段可通过真实骰子入口重掷已锁定防御骰\just-this-locked-defense-empty-confirm-settles-card.jpg`
  - 画面显示空确认后 `就这？` 交互关闭，手牌中不再保留该卡。

## 验证

- `npx vitest run src/engine/systems/__tests__/useMultistepInteraction.test.tsx`：1 passed，覆盖“确认本批次不关闭整段交互”的低层合同。
- `npx vitest run src/games/dicethrone/__tests__/flow.test.ts -t "我又行了"`：4 passed，覆盖 `2/5 -> 4/5 -> 空确认结束`、五颗选满、少选后结束、默认不可同骰重复。
- `npx vitest run src/games/dicethrone/__tests__/flow.test.ts -t "我又行了|不愧是我|抬一手|玩得六啊|俺也一样|惊不惊喜|意不意外|弹一手"`：15 passed，覆盖同类重投与代表改骰卡；`die_already_completed` 是默认不可重复反向测试的预期拒绝。
- `npx vitest run src/games/dicethrone/ui/__tests__/DiceTray.test.tsx`：13 passed，覆盖骰盘交互按钮残留点击不会串到普通骰面确认。
- `npx vitest run src/games/dicethrone/__tests__/basic-commands-coverage.test.ts -t "AI selectDie|selectDie"`：6 passed，覆盖 AI 选骰动作和剩余额度相关分支。
- `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/dicethrone-die-reroll.e2e.ts "card-i-can-again 分批重掷时确认本批次不关闭整段交互"`：1 passed，真实浏览器路径覆盖第一批两颗、第二批两颗、空确认结束和截图组。
- `npx vitest run src/games/dicethrone/__tests__/basic-commands-coverage.test.ts -t "AI selectDie|AI modifyDie|selectDie 多骰交互|本地 AI 在 selectDie=2|targetOpponentDice 的 selectDie=2|modifyDie set 双骰交互|modifyDie copy 双骰交互|DiceThrone 改骰与重掷交互应由确认按钮收口" --reporter verbose`：11 passed，覆盖 AI / 命令层的同类 selectDie 与 modifyDie。
- `npx vitest run src/games/dicethrone/__tests__/flow.test.ts -t "不愧是我|我又行了：未声明|玩得六啊|俺也一样|惊不惊喜|意不意外|弹一手" --reporter verbose`：10 passed，覆盖重投同骰、默认不可重复、五张代表改骰卡和响应窗口改骰路径；`die_already_completed` 是默认不可重复反向测试的预期拒绝。
- `npx vitest run src/games/dicethrone/ui/__tests__/DiceTray.test.tsx --reporter verbose`：13 passed。
- `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/dicethrone-die-reroll.e2e.ts "card-worthy-of-me 可通过真实骰子入口重掷同一颗骰子两次"`：1 passed。
- `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/dicethrone-die-reroll.e2e.ts`：9 passed。
- `npm run typecheck`：通过。
- `npm run spec:lint`：通过。
- `git diff --check -- ...`：无新增空白错误；仅有本工作区 LF/CRLF 提示。

## 规范回代

- 主源：`.spec/knowledge/standards/testing-tdd.md`，规则角色是 `canonical-source`。
- 适配层：`docs/automated-testing.md`，只说明 GameTestRunner 工具使用时应回到主源，不复制完整规范。
- 回代内容：GameTestRunner 成功路径不能只看最终状态；若预期所有命令成功，必须断言没有失败步骤。非法命令或拒绝路径才使用预期错误断言。

## 遗留说明

- 历史轻量审查将引入范围收窄到强候选提交 `d8a1093ed`（2026-08-18 18:30:02，`收口 DiceThrone 伤害边界与 Mage Wars 视觉保留`）：该提交在 `src/games/dicethrone/domain/systems.ts` 的多步交互收口里引入了 `completedDieIds` / `completedSteps`，并按去重后的骰子 ID 计算完成次数；这能解释同一骰第二次重投被当成重复消费。但本次没有做完整 last-known-good / first-bad 二分，因此不声称它是已证明的唯一 first-bad。
- 本次收口的是共享选骰重投 / 改骰合同、命令校验、玩家 UI、AI legal-actions 和测试注入工具，不是单卡特判；同类重投默认仍必须由规则合同显式声明是否允许同骰重复，改骰默认仍按骰子本体去重。
