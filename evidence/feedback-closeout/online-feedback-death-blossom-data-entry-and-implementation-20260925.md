# 2026-09-25 忍者死亡盛放反馈源头复审

## 反馈原文

> 忍者死亡绽放技能抽出6点但是伤害不变成不可防御

- 反馈 ID：`6ab3cdb08bd81596a8e56101`
- 创建时间：`2026-09-23T13:01:36.993Z`
- 原始诊断包：`temp/feedback-closeout/20260925-online-recheck/6ab3cdb08bd81596a8e56101.md`
- 反馈未附截图；本轮使用反馈原文、当时状态快照、操作日志和正式忍者玩家面板原图复核。

## 当时情况概述

- 玩家使用的是基础版 `death-blossom`，状态快照明确 `abilityLevels.death-blossom = 1`。
- 操作日志记录奖励骰出现 `6`，随后系统记录奖励骰确认和追加伤害，但没有把当前攻击改成不可防御。
- 现场快照中的 `sourceAbilityId = death-blossom`，不是升级版 `death-blossom-2`。
- 旧实现还会在基础版出现面具时错误增加 `ninjutsu`，这与正式卡面不符。

## 源头与录入核对

主真相源：

- 正式忍者玩家面板：`public/assets/i18n/zh-CN/dicethrone/images/ninja/玩家面板.png`
- 本轮复核裁图：`temp/feedback-closeout/20260925-online-recheck/death-blossom-base-source.png`

卡面逐字语义：

> 死亡盛放  
> 投掷5骰：  
> 造成 1 × 忍刀 + 2 × 手里剑 伤害。  
> 如果投出面具，本次攻击变为不可防御。

录入复核：

- 修复前 `public/locales/zh-CN/game-dicethrone.json` 把基础版录成“按结果追加伤害或获得忍术”，漏掉“面具使攻击不可防御”，并凭空加入“获得忍术”。
- 修复前英文录入存在同样偏差。
- 结论：**录入错误已确认。**

## 实现链核对

- `src/games/dicethrone/heroes/ninja/abilities.ts` 将基础版接入 `ninja-death-blossom`。
- `src/games/dicethrone/domain/customActions/ninja.ts` 修复前的基础版 settlement：
  - 忍刀计 `1` 伤；
  - 手里剑计 `2` 伤；
  - 面具分支错误发放 `ninjutsu`；
  - 没有发出 `ATTACK_MADE_UNDEFENDABLE`。
- 修复后：
  - 保留忍刀 / 手里剑伤害计算；
  - 面具分支发出 `ATTACK_MADE_UNDEFENDABLE`；
  - 不再发放忍术。
- 结论：**实现 bug 已确认并已修复。**

## 本地验证

- `src/games/dicethrone/__tests__/ninja-token-mechanics.test.ts`
  - 基础 Death Blossom 断言更新为：面具 -> 不可防御、忍术不增加。
- `src/games/dicethrone/__tests__/ninja-ability-card-contract.test.ts`
  - `35` 项通过。
- `src/games/dicethrone/__tests__/ninja-token-mechanics.test.ts`
  - `13` 项通过。
- `npm run typecheck`
  - 通过。
- `npm run spec:lint`
  - 通过。

## 状态口径

- 本地根因、录入修复、实现修复和回归验证已完成，本轮直接写 `resolved`。
- 生产版本尚未部署；这只意味着不能声称“线上已生效”，不阻止本地反馈状态本轮收口。
- 漏审复盘：旧测试只验证了基础版奖励骰伤害和防御流程，没有把正式卡面“面具 -> 不可防御”作为基础版断言，也没有阻止错误的“面具 -> 忍术”录入，属于**录入合同与测试断言双缺口**。
