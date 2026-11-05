# 本地反馈 6aa619b31f82c1eb2c2f7fa8：攻击修正导致攻击被跳过？

- 口径：本地数据库反馈。
- 统计时间：2026-09-13T12:38:06+08:00。
- 游戏：DiceThrone。
- 反馈原文：`攻击修正导致攻击被跳过？`
- 反馈入口：`/play/dicethrone/match/NOu9EWvkd9o?playerID=0`。
- 反馈版本：`appCommitSha=49574b290901`。

## 反馈现场

玩家可见操作记录尾部：

```text
[11:33:47] 游客7424: 推进阶段：6. 主要阶段（2）
[11:33:44] 游客7424: 奖励骰确认结果： [5,3,2,3,5] 血滴 0 个：本次攻击伤害 +0
[11:33:44] 游客7424: 确认投掷（魅惑之力）： [1,5,5,5,1]
[11:32:52] 游客7424: 奖励骰掷出： [5,3,2,3,5]
[11:32:52] 游客7424: 打出卡牌 死无全尸！
[11:32:52] 游客7424: 发动技能：魅惑之力
[11:32:47] 游客7424: 确认投掷： [1,5,5,5,1]
[11:32:43] AI 2 号位: 重投骰子 #5：5 → 1
[11:32:43] AI 2 号位: 打出卡牌 抬一手！
[11:32:41] 游客7424: 确认投掷： [1,5,5,5,5]
[11:32:34] 游客7424: 推进阶段：4. 掷骰攻击阶段
```

最终状态：

- 玩家 0：吸血鬼领主，HP 50，CP 1，弃牌堆包含 `死无全尸！`。
- 玩家 1：战术家，HP 50，CP 3。
- 事件尾部只有 `ATTACK_RESOLVED totalDamage=0`，随后从攻击掷骰阶段进入主要阶段 2。
- 没有出现 `DAMAGE_DEALT amount=4 sourceAbilityId=mesmerize-power`。

## 规则合同

- `魅惑之力`：基础版“获得 1 CP，获得催眠，造成 4 点不可防御伤害”；录入合同见 `src/games/dicethrone/rule/吸血鬼领主录入核对.md`。
- `死无全尸！`：“投 5 骰并按血滴数量给当前攻击加伤，至少加 3 伤害时施加 1 流血；不直接扣对手 HP”；录入合同见 `src/games/dicethrone/rule/吸血鬼领主卡牌录入核对.md`。

对照结论：反馈命中真实规则 bug。`死无全尸！` 投出 0 个血滴时应该只是本次攻击 +0，不能让 `魅惑之力` 自己的 4 点不可防御伤害消失。

## 根因分层

- 现实故障现象：玩家发动 `魅惑之力` 后打出 `死无全尸！`，奖励骰 0 血滴，随后直接进入主要阶段 2，对手 HP 仍是 50。
- 直接触发条件：`死无全尸！` 奖励骰确认后，把当前攻击标成“只剩攻击收尾”。
- 代码机制：攻击阶段退出时看到“只剩攻击收尾”就只追加 `ATTACK_RESOLVED`，不会再执行原技能的主伤害结算。
- 根本缺陷：`死无全尸！` 是攻击修正奖励骰，只决定给当前攻击加多少额外伤害；它没有消费原攻击主伤害，却把父攻击恢复阶段写成了主伤害已落地后的阶段。

## 修复

- 修改 `src/games/dicethrone/domain/customActions/vampire_lord.ts`：
  - `死无全尸！` 奖励骰确认后的攻击恢复阶段从 `readyToResolve` 改为 `preDamage`。
  - 保持卡牌效果不变：0 血滴仍是 +0；有血滴时仍按血滴数加伤，3 个及以上仍施加流血。
- 增加通用奖励骰续跑边界：
  - `readyToResolve` 的现实含义是“主攻击伤害已经结算，只剩攻击收尾”。
  - 业务上没有任何攻击修正奖励骰有资格在未消费主攻击伤害时跳过主攻击；未消费主攻击伤害的奖励骰只能回到 `preDamage` 等仍会继续跑主伤害的阶段。
  - `src/games/dicethrone/domain/core-types.ts` 把非法组合收窄到类型上写不出来：`markBonusDiceResolved: false` 不能再配 `settlementStage: 'readyToResolve'`。
  - `src/games/dicethrone/domain/effects.ts` 在奖励骰创建入口校验续跑合同，`src/games/dicethrone/domain/reducer.ts` 在旧状态 / 测试夹具绕过创建入口时再次校验。
  - `src/games/dicethrone/domain/utils.ts` 的断言不是静默兜底：内部非法状态会直接报错，暴露写错的能力来源，避免用“跳过攻击”伪装成正常收口。
- 补回归测试 `src/games/dicethrone/__tests__/vampire-lord-mechanics.test.ts`：
  - 正常玩家流程：确认 `[1,5,5,5,1]`、选择 `魅惑之力`、打出 `死无全尸！`、奖励骰 `[5,3,2,3,5]`、确认奖励骰、退出攻击阶段。
  - 断言必须出现 `DAMAGE_DEALT amount=4 sourceAbilityId=mesmerize-power`，对手 HP 从 50 到 46，最终 `ATTACK_RESOLVED totalDamage=4`。
- 补通用合同测试 `src/games/dicethrone/__tests__/bonus-dice-confirmation-contract.test.ts`：
  - `createDisplayOnlySettlement` 创建非法奖励骰续跑时直接报错。
  - `reduce(BONUS_DICE_SETTLED)` 遇到旧状态 / 测试夹具携带同样非法续跑时也直接报错。

## 红测和验证

首跑失败：

```text
npx vitest run --config vitest.config.ts --configLoader native src/games/dicethrone/__tests__/vampire-lord-mechanics.test.ts --reporter=dot
FAIL 死无全尸 0 血滴只给魅惑之力 +0，不应跳过原本 4 点不可防御伤害
AssertionError: expected undefined to match object { targetId: '1', amount: 4, actualDamage: 4, sourceAbilityId: 'mesmerize-power' }
```

修复后通过：

```text
npx vitest run --config vitest.config.ts --configLoader native src/games/dicethrone/__tests__/vampire-lord-mechanics.test.ts --reporter=dot
Test Files  1 passed (1)
Tests  39 passed (39)
```

相关回归通过：

```text
npx vitest run --config vitest.config.ts --configLoader native src/games/dicethrone/__tests__/vampire-lord-mechanics.test.ts src/games/dicethrone/__tests__/bonus-dice-confirmation-contract.test.ts src/games/dicethrone/__tests__/damage-settlement-boundary.test.ts src/games/dicethrone/__tests__/roll-context.test.ts src/games/dicethrone/__tests__/token-fix-coverage.test.ts --reporter=dot
Test Files  5 passed (5)
Tests  128 passed (128)
```

通用合同测试通过：

```text
npx vitest run --config vitest.config.ts --configLoader native src/games/dicethrone/__tests__/bonus-dice-confirmation-contract.test.ts --reporter=dot
Test Files  1 passed (1)
Tests  10 passed (10)
```

类型检查通过：

```text
npm run typecheck
tsc --noEmit
```

## 同类扩审

搜索范围：

- `markBonusDiceResolved: false`
- `readyToResolve`
- `vampire-lord-total-demise-roll`
- `card-vampire-lord-total-demise`
- `settlementStage: 'readyToResolve'` 与 `markBonusDiceResolved: false` 的跨行组合

结果：

- 所有 `markBonusDiceResolved: false` 的攻击续跑点当前都回到 `preDamage`，不再直接进入攻击收尾。
- 剩余 `readyToResolve` 命中均伴随“主攻击效果已消费”的路径，或是阶段收尾消费者本身；本轮没有发现第二个“未消费主伤害却直接收尾”的同类点。
- 跨行组合扫描只命中新加负向测试中的故意非法状态；生产代码没有第二个同形态命中。
- `死无全尸！` 的合同、测试、结算 handler 和行动日志引用已命中；本轮无需改规则描述。

## 漏审复盘 / 规范回代判断

- 漏审类型：测试停在中间态。旧用例覆盖了 `死无全尸！` 奖励骰能给当前攻击加伤、不直接扣 HP，但没有覆盖“奖励骰确认后退出攻击阶段，原攻击主伤害仍必须结算”的完整父链。
- 通用缺口：旧代码把“奖励骰结束后恢复哪个攻击阶段”交给每个攻击修正手写，缺少类型和运行时合同，导致单个错误能力可以把攻击推到只剩收尾。
- 现有规范是否覆盖：已覆盖。`rule-bug-fix-workflow` 和 `regression-closeout` 已要求规则 bug 回到原始失败位点，并覆盖写入点、阶段续跑、最终血量和攻击收口；`code-design` 已要求内部非法状态尽早断言，不静默兜底。
- 本轮是否更新规范：不更新项目规范。问题是现有规范执行失守和 DiceThrone 单游戏合同缺少代码边界；本轮已把边界落到 DiceThrone 类型合同、创建入口、reducer 消费点和通用测试。
