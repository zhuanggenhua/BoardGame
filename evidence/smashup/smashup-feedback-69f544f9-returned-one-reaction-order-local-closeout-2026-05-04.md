# Smash Up 反馈 69f544f9 本地验收收口说明（2026-05-04）

## 反馈原文

- `为什么出现了选择反应，然后选择轮回者又没效果，然后之前还有选择名人堂和大法师结算顺序，有什么意义`

线上反馈对应：

- feedbackId：`69f544f99ec13b96d710ae00`
- gameId：`smashup`
- route：`/play/smashup/match/GJGL3v6jO_z?playerID=0`
- appVersion：`production`

## 线上现场能确认到什么

这条反馈把两个现象混在了一起：

1. 《轮回者 / Returned One》打出后出现了 `smashup_reaction_choose`
2. 《名人堂 / Hall of Fame》与《大法师 / Archmage》曾经出现过结算顺序选择

但当前保存下来的线上权威态已经能确认两件事都不是“最后没生效”的终态：

- 《轮回者》这部分：
  - action log 已出现 `轮回者 -> 名人堂`
  - 当前 `base_hall_of_fame.buriedCards` 中存在 `skeletons_returned_one`
  - 当前 `base_hall_of_fame.minions` 中已经没有《轮回者》本体
  - 当前 `flowHalted=false`、`phase=playCards`，说明链路已经收口，不是卡死
- 《名人堂 + 大法师》这部分：
  - action log 已出现 `大法师 -> 名人堂`
  - 同时出现 `大法师` 额外行动与《名人堂》`+2` 力量日志
  - 当前终态里没有残留排序交互或阻塞态

结论是：这条反馈记录下来的更像是“用户对中途交互语义的困惑”，而不是一个最终仍未生效的权威终态。

## 与现有证据的直接对照

### 1. 《轮回者》出现 reaction choose 是当前正确语义，不是新 bug

仓库里已有专门为此补的浏览器级证据：

- `evidence/smashup/smashup-skeletons-returned-one-spooky-scary-gravestones-e2e-2026-04-29.md`

其中已经明确回写过：

- 旧错误假设：`轮回者` 自埋后应“直接无交互”
- 当前真实链路：先进入 `smashup_reaction_choose`，再由《轮回者》收口

并且该证据文档明确给出两张关键截图：

- `D:\gongzuo\webgame\BoardGame\e2e\evidence\screenshots\smashup-skeletons-returned-one-reaction-prompt-2026-04-29.png`
  - 肉眼可见 `选择一个反应动作`
  - 候选只有 `轮回者 / 让过`
- `D:\gongzuo\webgame\BoardGame\e2e\evidence\screenshots\smashup-skeletons-returned-one-buried-resolved-2026-04-29.png`
  - 肉眼可见《轮回者》本体已离场
  - 基地下方留下埋葬牌
  - 交互窗已关闭

这与本条线上终态完全一致：`轮回者` 最终确实已经埋到《名人堂》下方。

### 2. 《名人堂 + 大法师》不应再弹无意义排序交互

仓库里已有专门对位回归：

- `src/games/smashup/__tests__/archmageE2E.test.ts`
  - `在名人堂打出大法师时，应自动结算无冲突 trigger 而不是弹排序交互`

该测试验证的就是：

- 打出《大法师》当回合仍拿到 banked 额外行动
- 《名人堂》的 `+2` 力量照常生效
- 最终 `interaction.current === undefined`

此外，历史批次验证文档也已把这条链并入已覆盖项：

- `evidence/smashup/smashup-feedback-online-batch9-smashup-11-verify-2026-04-24.md`

## 本轮补充验证

本轮尝试 fresh 复跑：

- `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/archmageE2E.test.ts --configLoader native --maxWorkers 1 --testNamePattern "在名人堂打出大法师时，应自动结算无冲突 trigger 而不是弹排序交互"`

结果：

- 未进入该断言本身，测试文件在初始化阶段被当前工作区内**无关脏改**阻塞：
  - `ReferenceError: ancientEgyptiansSealTheTombProgram is not defined`
  - 位置：`src/games/smashup/abilities/ancient_egyptians.ts`

这不是本条反馈所涉及模块，也不是本轮为处理 `69f544f9...` 新引入的问题，因此本轮不扩大范围去修 unrelated 脏改。

## 收口结论

- `轮回者` 部分：
  - 线上当前权威态已经证明“选择轮回者后没效果”这个结论不成立；它最终确实已被埋到《名人堂》下方。
  - 现有浏览器级 E2E 证据也明确说明 `reaction choose` 正是当前真实语义，而不是异常。
- `名人堂 + 大法师` 部分：
  - 仓库已有精确回归与历史批次验证，语义是“自动收口，不弹无意义排序交互”。
  - 本轮 fresh 复跑被 unrelated 的 `ancient_egyptians` 初始化错误阻塞，但这不影响本条既有证据链。

因此，这条反馈按当前任务口径应视为“已修未回写 / 用户误把中途 reaction 语义当成没生效”，可以转 `resolved`。
