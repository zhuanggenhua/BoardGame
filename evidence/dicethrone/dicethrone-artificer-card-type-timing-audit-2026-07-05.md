# DiceThrone 工匠专属牌类型与时机审计（2026-07-05）

## 审计口径

- 对象：工匠专属手牌 slot 17-31。
- 真相源：`public/assets/i18n/zh-CN/dicethrone/images/artificial/手牌.png`、轻量核对图 `temp/dicethrone-intake/artificer/audit/artificer-slots-17-31-title-text-strip.png`、运行时录入 `src/games/dicethrone/heroes/artificer/cards.ts`、录入合同 `src/games/dicethrone/rule/工匠卡牌录入核对.md`。
- 验收口径：红框行动牌必须按红色即时牌处理，普通对方回合要能通过真实出牌命令打出；响应型牌必须保留响应窗口约束；升级牌不因内部技能效果可在后续阶段触发而改变升级牌本体使用时机。

## 逐卡结果

| slot | 中文名 | cardId | 图面/文本证据 | 运行时类型 / 时机 | 合同类型 / 时机 | 结论 |
| ---: | --- | --- | --- | --- | --- | --- |
| 17 | 合成大师！ | `card-artificer-masterpiece` | 主阶段行动牌图面 | action / main | action / main | 未发现类型/时机错误 |
| 18 | 机械的反击！ | `card-artificer-mechanical-strike` | 受击后打出，响应型牌 | action / instant | action / instant | 未发现类型/时机错误 |
| 19 | 电弧盾 | `upgrade-artificer-shock-bot-2` | 受击后打出，响应型升级牌 | upgrade / instant | upgrade / instant | 未发现类型/时机错误 |
| 20 | 稍作调整 II | `upgrade-artificer-tinker-2` | 升级牌，替换防御能力 | upgrade / main | upgrade / main | 未发现类型/时机错误 |
| 21 | 超频运行 II | `upgrade-artificer-overclock-2` | 升级牌，替换进攻能力 | upgrade / main | upgrade / main | 未发现类型/时机错误 |
| 22 | 电能脉冲 III | `upgrade-artificer-shock-bot-3` | 升级牌，替换进攻能力 | upgrade / main | upgrade / main | 未发现类型/时机错误 |
| 23 | 唤醒机械 II | `upgrade-artificer-activate-bots-2` | 升级牌，替换进攻能力 | upgrade / main | upgrade / main | 未发现类型/时机错误 |
| 24 | 灵感突现 II | `upgrade-artificer-eureka-2` | 升级牌，替换进攻能力 | upgrade / main | upgrade / main | 未发现类型/时机错误 |
| 25 | 电路图 II | `upgrade-artificer-schematics-2` | 升级牌，替换能力 | upgrade / main | upgrade / main | 未发现类型/时机错误 |
| 26 | 扳手攻击 II | `upgrade-artificer-wrench-strike-2` | 升级牌，替换进攻能力 | upgrade / main | upgrade / main | 未发现类型/时机错误 |
| 27 | 收集配件 II | `upgrade-artificer-collect-parts-2` | 升级牌，替换维护/工坊能力 | upgrade / main | upgrade / main | 未发现类型/时机错误 |
| 28 | 超高电压！ | `card-artificer-voltage` | 红框行动牌 | action / instant | action / instant | 未发现类型/时机错误 |
| 29 | 纳米袭击！ | `card-artificer-nano-attack` | 红框行动牌 | action / instant | action / instant | 未发现类型/时机错误 |
| 30 | 万能电流！ | `card-artificer-overdrive` | 红框行动牌 | action / instant | action / instant | 本轮发现原先误录为主阶段牌，已修正为即时牌 |
| 31 | 这玩意儿真棒！ | `card-artificer-perfectly-calibrated` | 红框行动牌 | action / instant | action / instant | 已修正为即时牌，普通对方回合真实出牌管线已覆盖 |

## 回归证据

- `万能电流！`修复前新增回归失败，失败原因是主阶段牌校验挡住非当前回合玩家打牌：`player_mismatch`，并显示卡牌时机为 `main`。
- `万能电流！`修复后要求：普通对方回合玩家 1 可打出该牌，牌离开手牌并进入弃牌堆，奖励骰投出齿轮，玩家 1 获得 1 合成器。
- `这玩意儿真棒！`要求：普通对方回合玩家 1 可打出该牌，牌离开手牌并进入弃牌堆，奖励骰投出 5，玩家 1 获得 3 合成器。
