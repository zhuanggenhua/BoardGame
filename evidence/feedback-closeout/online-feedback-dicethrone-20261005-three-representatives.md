# DiceThrone 线上反馈三条代表项核对（2026-10-05）

本证据只覆盖三条指定 DiceThrone 反馈；线上状态字段与本地修复证据分开记录。

## 1. 反馈内容 / 现实症状：加载不出来

- 反馈 ID：`69a7095fb832e79689a369da`
- 反馈原文：`加载不出来`
- 原始来源：`temp/feedback-closeout/triage-20261005/69a7095fb832e79689a369da.md`
- 发现的问题：诊断包没有 `route`、错误消息、堆栈或截图；操作日志已经执行到 DiceThrone `main1`，当前快照含完整角色、骰子、手牌和 `rollConfirmed` 状态。现有证据不能把症状归因到动态导入、资源请求、房间恢复或游戏规则。
- 处理方式：本轮未修改加载链路，避免用无错误诊断包猜测修复；已安排从 DiceThrone 真实入口回放并采集首个可见页面、动态导入 / asset 请求和浏览器错误。
- 验证结果：`node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/dicethrone-simple-start.e2e.ts "Online match: Can start a game successfully"` 通过（1/1）；这证明当前 DiceThrone 入口可启动，不证明历史反馈的具体加载失败根因已复现或已修复。
- 当前状态：`in_progress`；原因是缺少可回查的加载错误与同入口现场证据。

## 2. 反馈内容 / 现实症状：头晕目眩无法使用

- 反馈 ID：`69f4acdf9ec13b96d7109f30`
- 反馈原文：`头晕目眩无法使用`
- 原始来源：`temp/feedback-closeout/triage-20261005/69f4acdf9ec13b96d7109f30.md`
- 效果描述原文：`如果已对对手造成至少 8 点伤害，则对其施加脑震荡。`（`public/locales/zh-CN/game-dicethrone.json`，`card-dizzy`；同一规则快照见 `src/games/dicethrone/__tests__/fixtures/wikiSnapshots.ts`）
- 发现的问题：反馈包的直接错误是旧 Android WebView 抛出的 `"AppUpdate" plugin is not implemented on android`；现场已在 `main2`，手牌包含 `card-dizzy`，但没有证明卡牌条件或脑震荡效果校验错误。
- 处理方式：`src/lib/mobile/androidNativeUpdates.ts` 的 `subscribeAndroidNativeUpdateState` 捕获原生壳缺失 `AppUpdate` 插件异常，记录诊断并返回 `null`，不再升级成 `window.unhandledrejection`；保留最近错误上下文。该修复已在 2026-05-05 提交 `8b09f14aa` 落地。
- 验证结果：`androidLiveUpdates.test.ts`、`errorContext.autoReport.test.ts` 与 DiceThrone 规则相关测试合计 120 项通过；`node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/dicethrone-simple-start.e2e.ts "Online 2-player afterAttackResolved: card-dizzy should be playable and inflict Concussion"` 通过（1/1）。该 E2E 证明当前同名卡牌路径可用，但不是产生该反馈的同一 Android 壳和同一历史房间。
- 当前状态：`in_progress`；平台异常已隔离，技能本体仍缺同入口真实验收，不能写 `resolved`。

## 3. 反馈内容 / 现实症状：火法大顺子只打出 6 点

- 反馈 ID：`699d9c60c3c4e02a164a6d7f`
- 反馈原文：`火法的大顺子技能计算有问题，如图圈中的部分，四点火焰精通只打出了六点伤害，有可能是对方有一个防御6产生了干扰`
- 原始来源：`temp/feedback-closeout/triage-20261005/699d9c60c3c4e02a164a6d7f.md`
- 效果描述原文：`获得 2 层火焰精通，然后造成 4 点伤害；每有 1 层火焰精通，便额外造成 2 点伤害。`（`public/locales/zh-CN/game-dicethrone.json`，`abilities.ignite`）
- 当前现场：日志在 20:29:22 记录对手打出 `这次不算！`，其规则原文为 `一名玩家防止即将受到的 6 点伤害。`；20:30:28 记录 `点燃` 最终造成 6 点，且此前已记录获得 2 层火焰精通。
- 根因结论：不是点燃伤害公式错误。攻击方原始伤害为 `4 + 2 × 4 = 12`；对手 6 点护盾吸收后净掉血为 `6`。动作日志读取 reducer 写回的 `actualDamage`，所以显示 6 是护盾后的玩家可见净伤害。
- 处理方式：不改点燃公式；新增 `src/games/dicethrone/__tests__/pyromancer-behavior.test.ts` 回归，锁定 `FM=2 -> 获得2后原始12`，并验证对手 6 点护盾后 `HP 50 -> 44`、护盾清空。
- 验证结果：`pyromancer-behavior.test.ts` + `shield-double-counting-regression.test.ts` 共 57 项通过；该反馈属于规则符合现场，不应为了迎合“只看到 6”改动伤害计算。
- 当前状态建议：`closed`（`non_bug`），关闭理由必须保留以上规则原文、12→6 护盾对账和回归测试证据；不是“已修复”。

## 漏审复盘

- 69a709：已有反馈规范要求从真实入口采集错误，但原诊断包缺 route / error / screenshot，现有流程没有把“完整对局快照”与“加载失败证据”强制区分；本轮不扩大代码改动，保留 `in_progress`。
- 69f4ac：代码测试已覆盖插件缺失降级，但未覆盖同一 Android 壳中卡牌真实使用；现有规范已覆盖“平台异常不能冒充技能修复”，本轮不回写 `resolved`。
- 699d9c：旧审计缺少“原始伤害 vs 护盾后 actualDamage”的逐事件对账；本轮补对象级回归，现有反馈规范已覆盖规则原文、卡面 / 文案和消费链核对。
