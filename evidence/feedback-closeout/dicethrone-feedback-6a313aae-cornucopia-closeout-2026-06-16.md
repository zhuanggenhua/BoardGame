# DiceThrone 反馈收口：聚宝盆技能没有生效（6a313aaee7db65695ded80c7）

## 基本信息

- 反馈 ID：`6a313aaee7db65695ded80c7`
- 游戏：`dicethrone`
- 来源：玩家反馈弹窗（`feedback-modal`）
- 用户原文：`聚宝盆技能没有生效`
- 处理日期：`2026-06-16 +08:00`

## 真实反馈结论

- 归类结果：`已复现并修复`
- 使用的真实证据：
  - 生产真实反馈记录：`_id=6a313aaee7db65695ded80c7`
  - 既有聚宝盆真实/近真实链路快照：`temp/feedback-closeout/2026-04-04T08-15-51-179Z/69c7845196012f55115c3be8.md`
- 现象翻译：
  - 4 人 / 2v2 场景里，暗影盗贼的“聚宝盆”在 `targetingRoll` 之后错误读取了“当前 1 颗目标骰”，而不是本次攻击原本的 5 颗攻击骰快照。
  - 结果就是技能命中了，但后续抽牌/弃牌判定读错了骰面，表现成“聚宝盆没有生效”。

## 根因与修复

- 根因文件：[shadow_thief.ts](/D:/gongzuo/webgame/BoardGame/src/games/dicethrone/domain/customActions/shadow_thief.ts)
- 修复内容：
  - 聚宝盆 I / II 结算时不再直接读取当前骰池；
  - 改为优先读取本次攻击保存下来的攻击骰快照，确保 `targetingRoll`、多人模式和攻击后续选择不会把原攻击骰语义冲掉。
- 回归测试：[cornucopia-e2e.test.ts](/D:/gongzuo/webgame/BoardGame/src/games/dicethrone/__tests__/cornucopia-e2e.test.ts)

## 验证证据

- `npx vitest run src/games/dicethrone/__tests__/cornucopia-e2e.test.ts --configLoader native`
  - 覆盖：4 人模式 `targetingRoll` 结算后，聚宝盆仍按攻击骰快照触发。
- `npx vitest run src/games/dicethrone/__tests__/shadow_thief-behavior.test.ts --configLoader native`
  - 覆盖：暗影盗贼自定义动作层聚宝盆 I / II 行为未回归。
- 代码提交：
  - `614c8b73 修复 DiceThrone 聚宝盆在4人 targetingRoll 后丢失攻击骰快照`

## 状态口径

- 反馈状态：满足“根因定位 + 修复 + 验证 + evidence”，应直接回写 `resolved`
- 发布状态：与本条反馈是否允许回写无关；若后续需要说明上线情况，应单独记录“是否已 push / 已部署 / 已观察”
