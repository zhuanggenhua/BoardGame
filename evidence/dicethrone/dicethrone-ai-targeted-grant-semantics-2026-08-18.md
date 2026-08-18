# DiceThrone AI 目标授予语义修复（2026-08-18）

## 原始症状

- 用户反馈：AI 会把“飞行”这类正面效果给敌方玩家，属于资敌行为。
- 用户进一步指出：这不应当只修某个角色或某张牌，而应修 AI 逻辑和 tag / 语义系统；其它派系也有各种 token/status。

## 结论

- 本轮判定为 **AI 交互语义消费缺陷**，不是炽天使单卡规则缺陷。
- 现实机制：DiceThrone token/status 定义层已经有“正面 / 负面 / 可消耗”的分类，代码字段是 `TokenDef.category`；所有角色 token 通过 `ALL_TOKEN_DEFINITIONS` 汇总进入 `state.core.tokenDefinitions`。
- AI 已通过 `getEffectCategory()` 消费这套分类，并由 `getEffectIntentForCategory()` 把分类转成“正面效果 / 负面效果 / 资源效果”的评分语义。
- 本轮真正修补的是第二段缺口：旧 `CHOICE_REQUESTED -> simple-choice` 选项不一定能表达“这个 token/status 授予给谁”。缺少目标语义时，AI 即使知道 token 是正面/负面，也无法稳定判断该选项是在帮自己、帮队友还是资敌。

## 修复范围

- `src/games/dicethrone/domain/events.ts`
  - `CHOICE_REQUESTED.options` 增加/扩展 `targetPlayerId`、`targetPlayerIds`、`tokenGrantConfig(s)`、`statusGrantConfig(s)`。
  - grant 级配置也支持 `targetPlayerId(s)`；如果 grant 自身未写目标，AI 才回退使用选项级目标。
  - 这些字段只描述交互语义，不替代 `value/customId` 的正式规则输入。
- `src/games/dicethrone/domain/core-types.ts`
  - `InteractionDescriptor` 同步 grant 级目标字段，保证 `dt:card-interaction` 和旧 choice 语义一致。
- `src/games/dicethrone/domain/systems.ts`
  - 旧 `CHOICE_REQUESTED` 改由 `createSimpleChoiceFromChoiceRequest()` 适配成 `simple-choice`，让 simple-choice 带上 `ai.status = semantic` 和稳定候选语义。
- `src/engine/systems/ChoiceRequestSimpleChoiceAdapter.ts`
  - 已提供 Choice Request 到 simple-choice 的语义适配；本轮 DiceThrone 开始消费该适配结果。
- `src/games/dicethrone/ai.ts`
  - `simple-choice` 优先消费 Choice Request 语义动作，再补充选项 value 上的 grant 目标提示。
  - `buildEffectGrantAiHints()` 支持每个 grant 自带目标；同一选项里可以同时表达“自己获得诅咒金币、目标获得休战/火药桶”。
  - `buildChoiceOptionAiHints()` 在只有 grant 级目标、没有选项级 `targetPlayerId(s)` 时也会生成 AI 评分提示，避免退回 label/customId 猜测。
- `src/games/dicethrone/domain/customActions/tianshi.ts`
  - 炽天使“神圣裁决 / 飞行”等选择写入真实目标玩家和授予语义，AI 应选择把飞行给自己而不是敌人。
- `src/games/dicethrone/domain/customActions/cursed_pirate.ts`
  - 咒缚海盗 human 面判决 / 无情劫掠补充 grant 级目标语义。
  - 无情诅咒、送你们去喂鱼的火药桶多目标选择补充 `targetPlayerIds + statusGrantConfig`。

## 攻击推进回归追修

- 用户原始症状还包括：选择攻击技能后立即进入防御阶段 / 可选攻击不能改选 / 需要临时骰或判定骰的牌和技能会卡在上一轮界面。
- 已定位的攻击推进回归来自提交 `52748281a 收口多游戏教程与运行修复`：该提交在 `SELECT_ABILITY` 后再次创建 `afterRollConfirmed` 响应窗口，实际把“选择攻击候选”错误当成“攻击已发起”。
- 本轮恢复的规则语义：确认骰面后的改骰响应窗口只由 `CONFIRM_ROLL` 打开；`SELECT_ABILITY` 只选攻击候选，不再重新开骰后响应窗口。攻击真正发起仍以后续阶段推进 / 进入防御链为边界。
- 同步修正 `card-flick` 的响应条件：弹一手这类改对手骰的响应牌只要处于确认骰后的合法响应窗口即可打出，不再额外要求攻击候选已经选定；主阶段或非响应窗口的攻击修正牌合法性没有放宽。
- 临时骰展示未改成全局自动确认：现有合同要求 `dt:bonus-dice` 由右侧骰盘普通确认收口。测试里如果同批事件先排入临时骰展示，再排入后续选择，必须先发 `SKIP_BONUS_DICE_REROLL` / `CONFIRM_ROLL` 等价确认后，才读取后续 simple-choice 或弃牌交互。
- 防御骰确认后的 `afterRollConfirmed` 窗口仍保留；例如进攻方可在防御方确认防御骰后用战术优势等合法改骰入口响应。相关测试改为显式让过当前响应者后再推进阶段，而不是删除合法窗口。
- 2026-08-18 追修：`thunder-strike.test.ts` 中“弹一手修改雷霆万钧奖励骰”仍按旧时序在对手 `afterRollConfirmed` 响应窗口未关闭时直接 `SELECT_ABILITY`。当前正确时序是：进攻方确认骰面 → 当前响应者让过 → 进攻方选择攻击候选 → 推进到防御投掷。测试已按该时序调整，避免把“命令被响应窗口拒绝后直接进 main2”的旧失败路径误当奖励骰问题。

## 全派系 tag 接入边界

- 已确认 token 分类不是炽天使专属：当前源码中按分类扫描得到 `buff: 7`、`debuff: 23`、`consumable: 24`，覆盖多个角色 token 文件和共享 token。
- 已确认 AI 读取的是 `state.core.tokenDefinitions`，而该表来自 `ALL_TOKEN_DEFINITIONS` 的跨角色汇总。
- 已确认“授予目标”消费点已做成通用逻辑：只要旧 choice 或 `dt:card-interaction` 写入 `targetPlayerId(s)` 与 `token/statusGrantConfig(s)`，AI 不需要知道具体派系名，也不需要从按钮文案猜正负收益。
- 未完成全派系逐牌矩阵：本轮不能宣称所有旧 `CHOICE_REQUESTED` 都已经逐条回填目标语义；只能说通用消费通道已接，且本轮命中的炽天使、咒缚海盗旧入口已补。

## 验证

- `node scripts\infra\vitest-cli-safe.mjs run src\games\dicethrone\__tests__\basic-commands-coverage.test.ts -t "grant 自带目标" --configLoader native`
  - 1 passed。
- `node scripts\infra\vitest-cli-safe.mjs run src\games\dicethrone\__tests__\basic-commands-coverage.test.ts --configLoader native`
  - 141 passed。
- `node scripts\infra\vitest-cli-safe.mjs run src\games\dicethrone\__tests__\tianshi-behavior.test.ts -t "AI 处理神圣裁决的飞行选择时应选自己而不是敌人" --configLoader native`
  - 1 passed。
- `node scripts\infra\vitest-cli-safe.mjs run src\games\dicethrone\__tests__\tianshi-behavior.test.ts -t "神圣裁决先选择玩家施加眩光，再选择玩家获得 2 个飞行和净化" --configLoader native`
  - 1 passed。
- `node scripts\infra\vitest-cli-safe.mjs run src\games\dicethrone\__tests__\tianshi-behavior.test.ts --configLoader native`
  - 54 passed。
- `node scripts\infra\vitest-cli-safe.mjs run src\games\dicethrone\__tests__\zhanshujia-cursed-pirate-mechanics.test.ts -t "无情诅咒在 4 人 2v2 中只允许至多两名对手获得火药桶" --configLoader native`
  - 1 passed。
- `node scripts\infra\vitest-cli-safe.mjs run src\games\dicethrone\__tests__\zhanshujia-cursed-pirate-mechanics.test.ts -t "送你们去喂鱼在 4 人 2v2 中选择至多三名不同对手，且可跳过" --configLoader native`
  - 1 passed。
- `node scripts\infra\vitest-cli-safe.mjs run src\games\dicethrone\__tests__\zhanshujia-cursed-pirate-mechanics.test.ts -t "human 面判决指令会获得诅咒金币、施加休战并造成不可防御伤害" --configLoader native`
  - 1 passed。
- `node scripts\infra\vitest-cli-safe.mjs run src\games\dicethrone\__tests__\zhanshujia-cursed-pirate-mechanics.test.ts -t "human 面判决指令在多人局选择诅咒金币后仍应命中原防守方" --configLoader native`
  - 1 passed。
- `node scripts\infra\vitest-cli-safe.mjs run src\games\dicethrone\__tests__\card-flick-locked-dice.test.ts src\games\dicethrone\__tests__\ability-reselection-prevention.test.ts src\games\dicethrone\__tests__\response-window-interaction-lock.test.ts --configLoader native`
  - 3 files passed；35 passed。
- `node scripts\infra\vitest-cli-safe.mjs run src\games\dicethrone\__tests__\zhanshujia-cursed-pirate-mechanics.test.ts --configLoader native`
  - 112 passed。
- `node scripts\infra\vitest-cli-safe.mjs run src\games\dicethrone\__tests__\thunder-strike.test.ts -t "弹一手修改雷霆万钧奖励骰后" --configLoader native`
  - 1 passed。
- `node scripts\infra\vitest-cli-safe.mjs run src\games\dicethrone\__tests__\thunder-strike.test.ts src\games\dicethrone\__tests__\paladin-holy-light-bonus-dice-settlement.test.ts --configLoader native`
  - 2 files passed；7 passed。
- `node scripts\infra\vitest-cli-safe.mjs run src\games\dicethrone\__tests__\flick-defensive-phase.test.ts src\games\dicethrone\__tests__\paladin-holy-light-bonus-dice-settlement.test.ts src\games\dicethrone\__tests__\thunder-strike.test.ts src\games\dicethrone\__tests__\bonus-damage-collection.test.ts src\games\dicethrone\__tests__\red-hot-meteor-integration.test.ts src\games\dicethrone\__tests__\targeted-defense-damage.test.ts src\games\dicethrone\__tests__\paladin-coverage.test.ts src\games\dicethrone\__tests__\paladin-vengeance-2-cp.test.ts --configLoader native`
  - 8 files passed；96 passed。
- `node scripts\infra\vitest-cli-safe.mjs run src\games\dicethrone\__tests__\ability-reselection-prevention.test.ts src\games\dicethrone\__tests__\basic-commands-coverage.test.ts --configLoader native`
  - 2 files passed；144 passed。
- `npm run typecheck`
  - passed。
- `npm run test:dicethrone`
  - 最终复跑通过。第一次全目录尝试曾出现 `zhanshujia-cursed-pirate-mechanics.test.ts` 中“凋零只减少持有者对对手造成的攻击伤害”单项失败；同一用例单跑、该文件全跑、以及随后全目录复跑均通过，未能稳定复现为实现缺陷，因此本轮未按该现象改代码。
- `git diff --check -- <本轮相关 DiceThrone 文件>`
  - passed；仅 CRLF 换行提示，无 whitespace error。

## 残余风险

- 战术家 / 咒缚海盗机制整文件已从旧记录的 94 passed / 18 failed 收口到 112 passed。
- 本 evidence 仍不能宣称“全派系逐牌矩阵完成”：AI grant 目标语义通用消费通道已接，已补本轮命中的炽天使与咒缚海盗入口；其它旧 `CHOICE_REQUESTED` 若没有写入目标语义，仍需要后续按 choice 来源矩阵逐项回填。
- 本轮没有把临时骰改成自动跳过或自动确认。若后续要改变“临时骰必须玩家确认”的产品规则，需要先改奖励骰确认合同、UI 提示和 AI / watchdog 合法动作，不应在某张牌里局部特判。

## 同类扩审

- 已覆盖两类通用消费入口：
  - 旧 `simple-choice`：候选 value 只要携带 `targetPlayerId(s)` 与 `token/statusGrantConfig(s)`，AI 会按正负效果和目标关系评分。
  - `dt:card-interaction` 的 `selectPlayer`：继续消费 `tokenGrantConfig(s) / statusGrantConfig(s)`，并与 `simple-choice` 共享 grant hint 生成器。
- 已横向检查 token 分类来源：其它派系 token 文件同样使用 `TokenDef.category`，AI 不需要按派系写死分类判断。
- 未横向完成所有旧 `CHOICE_REQUESTED` 逐条回填；后续若要宣称全派系完整，必须建立 choice 来源矩阵，逐项确认“选择目标、授予对象、正负分类、最终结算”四列闭合。

## 漏审复盘

- 旧测试覆盖了部分 `dt:card-interaction` 增益选人，但没有覆盖 `CHOICE_REQUESTED -> simple-choice` 这种“选项值是数字 / 分支，真实效果在后续 handler 里结算”的旧链路。
- 旧实现容易从 `customId` / 文案参数推断收益，这违反“AI 合法动作和评分应消费交互语义，不从 UI 文案猜”的规范口径。
- 本轮新增的通用 simple-choice 用例用于防止再次退回单卡特判；咒缚海盗新增断言用于防止多 grant、多目标选择丢失作用对象。
