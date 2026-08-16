# 大杀四方响应窗口与海盗王可发动交互 E2E 证据

## 本轮目标

- 先分清强制自动效果和可选 / 主动发动效果：强制自动效果不应要求玩家点来源；海盗王属于“可发动”，系统只开放发动机会，玩家点击海盗王才发动。
- 海盗王不能用“移动到该基地”按钮替代玩家动作；正确顺序是海盗王本体可发动高亮，点击本体后才高亮目标基地。
- 响应窗口打开后，响应牌由手牌本体承接；非响应手牌置灰，跳过按钮仍可用。
- 最终验收图必须优先复用现成复杂计分链，覆盖海盗王、Me First 手牌响应、托尔图加和大副 afterScoring。

## 实际 E2E

- 复杂链命令：`$env:PW_E2E_SERVICE_REUSE='isolated'; npm run test:e2e:file -- e2e/smashup/smashup-complex-multi-base-scoring.e2e.ts -g "复杂链路里海盗王可发动时应先点本体再高亮计分基地"`
- 复杂链结果：`1 passed (40.9s)`，截图生成时间为 `2026-08-16 20:13:19` 至 `2026-08-16 20:13:32`。
- 截图目录：`test-results/evidence-screenshots/smashup/smashup-complex-multi-base-scoring.e2e/复杂链路里海盗王可发动时应先点本体再高亮计分基地/`
- 标注图目录：`test-results/evidence-screenshots/smashup/smashup-complex-multi-base-scoring.e2e/复杂链路里海盗王可发动时应先点本体再高亮计分基地/_labeled-final-20260816-2013/`
- 总览图：`00-sequence-index.png`，9 张原图均为 `1920x1080`，sha256 前缀互不相同。

## 复杂链截图观察

- `complex-hand-response-01-existing-scoring-chain-ready.jpg`
  - 画面处于现成复杂计分链起点，托尔图加、丛林和秘密花园三个基地同屏。
  - 场上已有海盗王、大副和可被托尔图加移动的其它基地随从，证明这不是孤立新造窄场景。
- `complex-hand-response-02-pirate-king-available-source-highlight.jpg`
  - 选择托尔图加计分后，系统开放海盗王可发动机会，海盗王本体高亮。
  - 目标基地没有提前高亮；E2E 断言旧 `yes` 代理按钮不存在，计分基地和非计分基地此时都不是可提交目标。
- `complex-hand-response-03-pirate-king-after-source-click-target-base-highlight.jpg`
  - 点击海盗王本体后，才表示发动海盗王；此时海盗王进入选中态，目标计分基地出现绿色高亮。
  - 非目标基地置灰；E2E 断言点非目标基地后当前交互仍停留在海盗王移动，海盗王仍未移动。
- `complex-hand-response-04-pirate-king-me-first-hand-highlight.jpg`
  - 海盗王移动后进入 Me First 响应窗口，浮动栏提示点高亮手牌响应。
  - 影舞者手牌本体可响应，便衣忍者和忍者侍从处于不可响应状态。
- `complex-hand-response-05-after-select-card-target-base-highlight.jpg`
  - 点击影舞者手牌后，影舞者进入选中态，合法计分基地高亮。
  - 无关基地置灰；E2E 断言点无关基地不会提交响应。
- `complex-hand-response-06-legal-base-played-before-scoring-chain-continues.jpg`
  - 点击合法计分基地后，影舞者从手牌进入托尔图加，响应通过当前 live 窗口提交。
  - 计分链继续推进，没有被手牌响应或海盗王移动吞掉。
- `complex-hand-response-07-first-mate-after-scoring-base-choice.jpg`
  - 手牌响应完成后，大副 afterScoring 继续触发并要求选择移动目标基地。
  - E2E 断言可选择第三个基地，证明大副没有被跳过。
- `complex-hand-response-08-tortuga-after-scoring-minion-choice.jpg`
  - 大副收口后，托尔图加 afterScoring 继续触发，要求亚军选择其它基地上的随从。
  - E2E 选择秘密花园随从，证明托尔图加仍消费真实计分结果和亚军归属。
- `complex-hand-response-09-scoring-chain-complete.jpg`
  - 整条链回到出牌阶段，响应窗口和交互窗口均已清空。
  - E2E 断言双方 VP 更新，且来源链包含 `pirate_king_move`、`smashup_reaction_choose`、`pirate_first_mate_choose_base` 和 `base_tortuga`。

## 回归与同类排查

- 静态交互回归：`node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/Board.interactionBars.test.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1`，结果 `7 passed`。
- 类型检查：`npm run typecheck` 通过。
- 规范 lint：`npm run spec:lint` 通过。
- 差异格式：`git diff --check -- ...` 通过。
- ESLint：目标文件无 error；仍有既有 warning，例如 E2E 的 `any`、Board 既有 hook dependency / purity warning。
- 同类扫描：`rg -n "fieldSourceTargetType" src/games/smashup .spec e2e/smashup` 只命中海盗王能力、Board 消费点和本轮测试；没有发现其它同类场上来源到基地目标合同继续走按钮。
- 审计入口：`interactionTargetTypeAudit.test.ts` 在正式 audit 配置下仍失败，但失败项是已有其它派系 targetType / generic 登记债务；本轮新增的“场上来源到基地目标不能用按钮”没有报出海盗王问题。

## 规范回代

- `.spec/knowledge/standards/rule-driven-interaction-design.md` 已改成“场上对象可发动效果与自动效果分流”：强制自动效果自动结算；可选 / 主动发动效果才先高亮来源对象，点击来源后才高亮目标。
- `.spec/knowledge/standards/e2e-verification.md` 已补状态改变型可发动效果截图要求：最终图组必须证明“来源对象可发动且目标未提前高亮 -> 点击来源对象发动 -> 目标对象高亮 -> 点击目标对象”。
