# Thor 全交互重审与重构记录（2026-10-29）

## 范围与当前结论

本轮覆盖索尔玩家板 21 个能力/变体、34 张实体卡和 7 项状态/同伴操作。规则原子、slot 00–33 原图约束与旧交互引用沿用并复核自 [2026-10-27 逐对象审计账本](thor-interaction-reaudit-20261027.md)；本报告记录本轮代码、测试和实时验收状态，不把旧 PASS 外推到当前源码。

当前是 **62 项已逐项静态复审，但 11:02–11:05 UTC 后续 DiceThrone 共享源码写入触及 reducer、reroll、Board 和 UI；受影响项待按最新源码复核。真实入口、当前截图和逐图验收仍未收口**。旧运行结果和历史图不外推到新源码；截图之前不记 UI PASS，也不宣称全量交互验收完成。

## 规范裁决

已复核 `.spec/knowledge/standards/rule-driven-interaction-design.md` 的共享交互合同、`.spec/knowledge/standards/e2e-verification.md` 的预期先于实现要求、`.spec/knowledge/standards/ui-change-gates.md` 的完整流程复用门禁，以及 `skill-governance`。

规范已经明确要求：先从规则和旧流程锁定操作语义；固定值与任意编辑分开；选择态必须由同一个合同提供提示、候选、进度、提交和取消/跳过；同类玩家任务要复用现有完整交互链；测试预期必须来自规则图源，真实 UI 必须截图复核。未发现需要新增第二份 canonical 规范的缺口，因此本轮不改 `.spec`。本次偏差属于执行和消费接线/测试预期跟随实现的问题，不是规范没有覆盖。

## 关键问题重审

| 对象 | 规则与旧流程 | 本轮实现核对 | 当前证据状态 |
| --- | --- | --- | --- |
| 手牌弃置成本（先前截图 02） | 单张成本用手牌区候选本体，当前提示贴近手牌；不得另开卡牌池弹窗 | `Board.tsx` 将 `selectHandCard` 弃牌交互从通用状态弹窗排除，`HandArea` 持有选择并显示 `GameHints`；既有 Thor E2E 断言提示与候选卡在手牌区、通用 overlay 隐藏、取消不扣费 | 当前源码截图待跑、待看 |
| 奥丁之力 II 可选整组重掷（06） | 可选 0–5 颗、一次成组重掷；空选确认保留；沿原效果骰结算确认收口 | `dt:bonus-dice` 投影为现有 `multistep-choice`，与普通选骰共用 `DiceInteractionContract`、`DiceTray`、`DiceActions`；提示/候选/进度/动作由同一合同产生。左键职责是“重掷所选”提交选中批次，右键“确认”结束结算 | 单测已过；本轮 E2E 与图面待跑/待看 |
| “当之无愧”（索尔卡槽 27，先前称 11） | 固定候选 4 或 5，沿旧 `mode:set` 先选值再点骰，取消时不提前改权威骰面 | `customActions/thor.ts` 使用 `allowedValues: [4, 5]`；骰盘只显示固定值选择，不产生 +/- 控件；选择骰子后沿旧 set 语义自动提交 | 领域/UI 单测已过；本轮 E2E 与图面待跑/待看 |
| 公共卡槽 11“不愧是我” | 允许当前掷骰者或队友；最多两次，规则允许同骰两次 | 与索尔专属槽 27“当之无愧”是不同实体。公共卡现走重复选骰合同；2v2 入口将验证队友出牌、索尔持骰、费用、提示和服务端骰子事件 | 领域测试已过；增强后的 2v2 E2E 待跑 |
| 公共卡 09/14/16 | 依原卡分别检查受伤响应目标/投掷阶段/队友受益权限 | 09 通过实际 pending-damage target 放置护盾；14 限进攻投掷；16 限防御投掷；11/14/16 的受益者与当前掷骰者分别处理。新增 2v2 用例补 CP、五颗候选、精确提示、骰权属和结算断言 | 领域测试已过；2v2 E2E 待跑。该 E2E 用状态注入准备代表时点，不证明自然攻击链创建响应窗口 |

## 共享交互重构审查

- `DiceInteractionContract` 是多步骰子 UI 的单一投影，覆盖合法候选骰、已完成次数、当前本地结果、必需提示、左右动作职责及控制器。
- `RightSidebar` 从该合同显示提示并向 `DiceTray` / `DiceActions` 传递同一对象。`DiceTray` 继续承接骰面点击、固定值、增减、任意改值和选择反馈；没有为索尔新建骰子弹窗。
- 普通多步交互保留现有取消与确认语义；整组重掷的左侧动作提交选中批次，右侧动作确认当前效果骰。空选时不显示“重掷所选”，仍可用原确认收口。
- 对照 `HEAD` 中旧版 `DiceTray.tsx`，组重掷的左侧提交动作和右侧确认动作在本轮之前就存在；本次合同重构把它们纳入共享动作投影，没有新造“重置所选”动作。当前中文资源文案为“重掷所选”。
- 当之无愧的第一次偏差是把原卡固定 4/5 错映射成 `any`，让测试也跟着错误实现走。现代码已改回固定结果枚举，并有独立规则图源、旧 `set` 流程、服务端合法值与取消/提交检查。

## 覆盖与测试

- 完整规则源/旧流程对象账本：21 能力、34 实体卡（含 33 张常规牌与 1 张推广牌）、7 项状态/同伴操作，见上方链接；21 个能力不会因升级卡 UI 通过而合并，基础/升级/变体继续分项。
- 本轮初始目标套件曾记录 298 项通过；为覆盖后续合同与手牌路由变更，2026-10-29 又复跑 10 个 Thor / 共享交互文件 183/183 通过，另跑 `card-playCondition-audit.test.ts` 131/131 通过。最新复跑优先作为当前证据，不把旧计数相加。
- 提示位置修复后单独重跑 `RightSidebar.contract.test.tsx`：4/4 通过。该单测只证明共享合同接线，不能替代真实截图的遮挡几何验收。
- 单独使用 `vitest.config.audit.ts` 跑 `card-playCondition-audit.test.ts`：131 项通过，只证明出牌合法性条件。
- 公共卡消费者回归：目标 3 项通过、116 项跳过；整套 `zhanshujia-cursed-pirate-mechanics.test.ts` 另有 1 项失败（119 项中 118 项通过）：树精“防止选择后恢复判决指令仍按攻击者眩光修正伤害”期望 46、实际 43。它不覆盖 Thor 骰盘或单张弃牌路由，本报告保留该失败，不把整套回归称为通过。
- 仓库级 TypeScript 检查未运行；本轮没有据此作干净构建声明。目标源码 `git diff --check` 通过；矩阵、报告与任务状态文件的行尾空白自检为 0。
- 测试只证明对应命令/规则/UI 断言；当前源码图面和真实入口仍以本轮 E2E 截图及逐图复核为准。

## 实时 E2E 与截图待办

真实入口按以下顺序收口：

1. `e2e/dicethrone/thor-interactions.e2e.ts`：手牌成本提示、06 空选/批量重掷、槽 27 固定 4/5、取消和重新提交等。旧 `main-r2` 结果因源码漂移无效；最新 `r3` 尝试与 Doctor Strange `r12` 隔离 E2E 重叠，前三项标为失败后内存看门狗在可用内存 0.14% 时终止进程，后三项没有运行，故没有最终 Playwright 汇总。
2. `e2e/dicethrone/thor-rule-interactions.e2e.ts`：角色能力、升级变体、效果骰、锤移动、响应及公共固定/任意/增减语义。
3. `e2e/dicethrone/thor-2v2-shared-dice-real-entry.e2e.ts`：四席真实线上入口中的队友出牌/实际掷骰者选骰及 09/11/14/16 公共卡结果。

此前两轮截图发现过 `tip-board` 遮挡：第一轮 6/6 在图面门禁失败；第二轮隔离 run 为 4 通过、2 张需返工，提示板横向相交。本轮源码当前将普通多步提示送回 GameHints 顶部，将效果骰/组选重掷提示送回 RightSidebar/DiceTray；新合同要求单份提示并带承载面，E2E 与单测分别核对提示承载和真实动作。

旧隔离 run `thor-full-reaudit-20261029-main-r2` 的 runtime 指纹为 `81c6ca0077e7593969a4afb9423b8d2fe06b345fa1306d7b43dd67ae67aa6d63`；其余 5 项因源码身份漂移被 helper 拒绝，首项截图也不属于结束时源码，全部作废。

最新 `thor-full-reaudit-20261029-r3` 于 2026-10-29 08:29 UTC 启动，初始前端指纹为 `0a15275cf64180d97d8a112e841836b0102e22791d70fa4bb96fef10b2bf89ba`。同期另有 Doctor Strange `r12` 隔离 runtime；Thor 输出在三项后遇到内存看门狗（可用内存 0.14%）而终止。自动失败图没有 Thor helper sidecar，不开图、不注册，也不作为当前源码行为结论。Playwright 的页面快照仅供定位。

截至 2026-10-29 08:34 UTC，`doctor-strange-interaction-current-20261029-r13` 仍是活跃隔离 runtime；未停止它，也未启动新的 Thor E2E。当前 Thor 截图验收仍未完成。

此前注册的 83 张图是 2026-10-27 历史截图的 source-review gallery，`PRODUCT_ACCEPTANCE=not-claimed`；它们不是本轮源码 PASS，也不替代当前截图。本轮打开过卡牌源图/裁图只用于锁定规则；它们不是本轮 UI 证据。

## 最终验收门

当前状态保持 **REVISE / 未完成**，直到 Thor 三个 E2E 文件用当前源码运行、失败项修复、当前截图逐张审查并注册可查看的结果；移动端未覆盖时仍须单独标明边界。2v2 状态注入范围和 09 自然响应窗口的领域证明边界应保留在结论中。

## 2026-10-29 全量静态审计增补

- 按 2026-10-27 独立规则账本逐行对照全部 21 个能力/变体、34 张物理卡、7 项状态/同伴操作；当前实现分别核对 `heroes/thor/abilities.ts`、`heroes/thor/cards.ts`、`heroes/thor/tokens.ts`、`heroes/thor/passiveAbilities.ts`、`domain/customActions/thor.ts`、共享 `domain/commonCards.ts` 与骰盘交互消费者。逐对象对应表和测试边界已写入同目录 `thor-interaction-coverage-matrix-20261029.md`。
- 当前没有发现规则源与当前实现之间新的语义差异。已知偏差继续按源图结论锁定：slot 27 固定 4/5 并走 `mode:set`；奥丁之力 II 使用原 DiceTray / DiceActions 的整组重掷与结算确认；手牌单张成本走 HandArea；公共卡 09/11/14/16 的目标、骰权与队友权限按各自规则消费。没有新增骰选弹窗或“重置所选”动作。
- 发现并修复的共享缺口：客户端历史完成骰与提示/候选未共用一份验证结果。现在 `parseDiceInteractionContract` 同时投影候选、已完成骰与步数；DiceTray 显示历史次数并禁止非重复模式重选已完成骰；重复模式仍可对同骰继续操作。共享合同、客户端投影、骰盘和 RightSidebar 测试均在上述 298 项通过集内。
- 本轮又确认一个提示承载缺口：旧普通选骰提示由 `GameHints` 显示，旧效果骰提示贴 `DiceTray`；把两族提示统一塞进 `RightSidebar` 会遮挡玩家板提示板。当前 `DiceInteractionContract.hint` 为必需字段，提示带 `game-hints` / `dice-tray` 承载面，Board 将同一合同分别传给两个旧宿主，宿主按承载面互斥渲染。规则规范原已要求提示与交互同合同并逐项复用旧完整流程，本轮没有增加第二份规则规范；只在 E2E canonical standard 明确单文件目标需显式设 `PW_E2E_SERVICE_REUSE=isolated` 与唯一 `PW_RUNTIME_SCOPE`，`spec-lint` 通过。
- 当前目标测试复跑：Thor 领域和共享 UI 10 个文件 183/183 通过；`card-playCondition-audit.test.ts` 131/131 通过；目标源码与 E2E helper ESLint 均以 `--max-warnings 0` 通过。仓库级 TypeScript build 未运行；`flowHooks.ts` 修复重复声明后游戏服务已能构建。
- 源图逐项核对确认：slot 11 明确允许自己或队友累计重掷两次（同骰可两次）；slot 27 明确只可设为 4 或 5；slot 09/14/16 分别对应即将受到 6 点伤害、进攻投掷阶段、 防御投掷阶段。截图仍未覆盖这些运行态。
- 2v2 E2E 脚本断言队友手牌、CP 与弃牌、骰主/候选五骰、当前操作者、历史重复骰次数和服务端 `DIE_REROLLED` 结果，并继续验证队友为索尔的真实待受伤害打出 slot 09；其中进攻/防御掷骰与伤害窗口通过状态注入准备，不证明自然攻击链创建这些窗口。该脚本尚未运行。
- 62 行矩阵状态统一标为“静态复核一致；E2E/图面待验”，而不是整体 PASS。桌面外的移动端、完整自然回合链及真人完成态仍未验收。

## 2026-10-31 当前源码执行结果与旧结论回写

- 上述 2026-10-29“待运行/仍有旧公共卡权限缺陷”状态已由当前批次覆盖。四个 Thor E2E 文件在 `shared-single` runtime 下 25/25 通过；定向 Vitest 11 个文件 228/228 通过。当前运行和对象级覆盖边界以 `thor-interaction-coverage-matrix-20261029.md` 的 2026-10-31 增补为准。
- 06 与 27 按原 DiceTray/`set` 操作语法运行：组选后沿原重掷和确认动作收口；空选沿原确认；固定值只给 4/5，取消不改骰并退回费用/卡牌，再提交仍走点骰流程。普通多步重投提示显示已用/剩余次数、同骰规则和骰盘下一步。
- 2v2 当前真实四席房间覆盖 11/14/16 的队友出牌、骰主选骰、重复选择、原骰盘确认及服务端事件；09 覆盖队友减伤与原伤害事务继续结算。09 的待伤害窗口由代表态注入，不作为自然攻击创建窗口的证明。双人房间实际选角与开局已通过。
- 当前批次生成 102 张 1920×1080 整屏截图。对 102 个 sidecar 的 1,185 个唯一源码输入逐一核对磁盘哈希，差异为 0；游戏专属源码目录只含 Dice Throne。逐图视觉报告尚未收口，因此本报告不把当前 UI 写为视觉 PASS。
- 全量对象审计的浏览器残余、移动端未覆盖、自然创建 09 响应窗口未验证等边界，逐对象列在矩阵增补中；旧 83 张历史图和 2026-10-29 旧失败记录均不作为本批 PASS 证据。
- `npm run audit:evidence:selfcheck -- evidence/dicethrone/thor-interaction-coverage-matrix-20261029.md evidence/dicethrone/thor-interaction-reaudit-20261028.md`：2 份审计文档通过；最终图片清单/索引与逐图报告仍待完成。

## 2026-10-29 共享消费者全量再审增量

- 对照旧版 `HEAD` 的 `DiceActions` 和当前所有合同消费者后，发现第二个真实消费缺口：成功的 Token 闪避不是 `dt:bonus-dice`，而是 `dt:token-response`；它可能处于普通投掷计数为 0、`rollConfirmed=true` 的状态。此前只把奖励骰结算纳入合同，闪避结算会落回普通按钮禁用条件，无法沿原右侧“确认”按钮收口。
- 新增 `tokenResponseSettlement` 合同变体，校验当前响应交互属于本机玩家；它把原 `response.yourTurn` 提示、既有响应窗口宿主和右侧原确认按钮纳入同一份投影，没有增加按钮、骰子弹窗或第二个可见提示。`DiceTray` 仍把确认交给原 `onConfirm` 响应链；`GameHints` 用合同提示填充原 `ResponseWindowHint`。
- 对应单测验证非当前响应者不能生成该合同、普通计数归零仍显示并启用原确认按钮、响应窗口提示只出现一次。11 个 Thor/共享交互测试文件本轮复跑 186/186 通过；`card-playCondition-audit.test.ts` 另跑 131/131 通过。目标 ESLint 0 error、1 个既有 Doctor Strange `chainId` unused warning；目标 `git diff --check` 无空白错误，仅报告预期行尾转换提示。
- 新增发现已纳入代码与合同测试；`dicethrone-token-response-window.e2e.ts` 的月精灵成功闪避真实入口仍须在当前源码下复跑。2026-10-29 10:44–10:45 UTC 两次前端源码指纹均为 `e9fc4abf89c476c4c173bbaef816724112d2119dec6238c516174a74bc080ceb`；另一隔离 Doctor Strange runtime 于 10:45 UTC 启动并正在使用资源，故 Thor 尚未启动，避免并发内存终止。这个稳定窗口不等于真实交互或图面验收通过。

## 2026-10-29 11:05 当前源码续审

- 用户确认普通骰子交互提示必须恢复 DiceThrone 原版顶部居中。核对发现当时工作树实际仍为 `left-center`，且 GameHints 单测与 Doctor Strange E2E 也把左侧居中写成预期；先前状态记录误称已恢复。现已把 `GameHints` 锚点改回 `top-center` 与原 `dtViewportInlineUnit(6)` 顶边距，同步更新单测和 Doctor Strange 2v2 队友选骰的几何断言。`GameHints.test.tsx` 7/7 通过，目标 ESLint 通过，`git diff --check` 无空白错误。真实入口仍待跑。
- 11:02–11:05 UTC 又有 DiceThrone `domain/reducer.ts`、`reroll.ts`、`tokenResponseChoiceContract.ts`、`Board.tsx` 和多个 UI 文件写入。此前 186 项目标测试早于其中部分写入，不能当作最新源码完整回归；`GameHints` 7 项仅覆盖刚修锚点。任务状态将 C2/C3 保持进行中，待稳定后重跑完整定向套件和 card play-condition 审计。
- 全前端指纹在 11:00–11:05 UTC 多次变化，最近工作区 hash 为 `c597623b194a367dcb9f708fd079bdd2515a6e32f7c86ecadcaa217d7246a6dd`，对应最后观察写入时间 11:05:08 UTC。无活跃 E2E runtime，但 E2E doctor 当时仅测得 1.4GB 可用内存；按用户要求继续等待自然空档，不与其他 runtime 重叠。需从最后一处相关写入后等待两分钟，再连续读取相同 hash 后才启动真实入口。

## 2026-10-29 真实入口续审

- 08:45 UTC scope `thor-full-reaudit-20261029-r4` 单跑首条弃牌/奥丁链：行为 E2E 1/1 通过；9 张整屏截图绑定运行时与工作区指纹 `6cc5895b…`。复核 sidecar 发现 06/07/08 提示与 `tip-board` 相交；原 E2E 只断言提示存在，未检查遮挡。该组为 `REVISE`，不登记 PASS。
- 修复后，08:50 UTC scope `thor-full-reaudit-20261029-r5` 再跑同一入口链：1/1 通过，9 张图绑定运行时/工作区指纹 `22244a30…`。提示移至骰盘上沿；sidecar 几何为视口内，且不与提示板、玩家栏、骰盘相交。9 张原始整屏图已逐张看图；弃牌沿 HandArea 原候选/取消流程，06 空选只有原确认，选中后沿原重掷/确认动作，没有“重置所选”。
- r5 结束后共享工作区的 DiceThrone 源码又在 08:54–08:57 UTC 更新：`AbilityOverlays.tsx`、`flowHooks.ts`、`reducer.ts`、`rules.ts`、`customActions/*` 等。当前指纹为 `e4fbb3ef…`；这些修改不是本轮实施，已保留。因截图绑定全前端源码身份，r5 图只作诊断，需待源稳定后重跑。
- 当前本轮修改将 `RightSidebar` 组选提示恢复为原骰盘上沿锚点，并由 Thor 截图 helper 对可见提示断言不出视口、不与提示板/顶部玩家栏/骰盘相交。`RightSidebar.contract.test.tsx` 5/5、目标 ESLint 与 `git diff --check` 通过；其余索尔 E2E、规则交互与 2v2 仍待稳定源码下运行。
