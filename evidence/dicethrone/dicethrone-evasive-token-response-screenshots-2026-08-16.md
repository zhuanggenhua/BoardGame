# DiceThrone 闪避 Token 响应截图证据

## 结论

验收状态：PASS。

本轮针对“闪避可用、点击闪避后投掷闪避骰、确认后效果生效并收口”的截图链已经存在，来自同一条 Playwright 用例：

`e2e/dicethrone/dicethrone-token-response-window.e2e.ts` 的“月精灵闪避成功后由共享响应框确认收口到 main2，不再卡在 defensiveRoll”。

## 自动断言

- 使用前：共享响应提示可见，类型为 Token 响应；闪避 Token 本体可见、可点击，并带可用高亮；旧 Token 弹窗、旧内嵌响应条、奖励骰弹窗和奖励骰专用确认按钮都不存在。
- 使用后：点击闪避 Token 后，当前仍停在防御掷骰阶段，闪避 Token 数量从 1 变 0；本次闪避骰结果为 1，闪避成功；当前伤害变为 0，伤害被标记为完全闪避。
- 待确认：共享响应提示仍在历史固定 HUD 槽位，右侧 2D 骰盘可见，提示按钮文案变为“确认”。
- 确认后：点击“确认”后，响应交互清空，待处理伤害清空，阶段回到 main2；防御方生命值保持 50，说明免伤效果已经正式落地。

## 截图清单

| 顺序 | 原图 | 直接证明的内容 |
| --- | --- | --- |
| 01 | `test-results/evidence-screenshots/dicethrone/dicethrone-token-response-window.e2e/月精灵闪避成功后由共享响应框确认收口到-main2，不再卡在-defensiveRoll/闪避响应-使用前共享提示贴近手牌且Token可点.jpg` | 使用前状态：左侧玩家面板里的闪避 Token 有明显可用光晕；共享响应提示显示“可以响应 / 跳过”，没有旧 Token 弹窗，也没有把提示塞进右侧骰盘。 |
| 02 | `test-results/evidence-screenshots/dicethrone/dicethrone-token-response-window.e2e/月精灵闪避成功后由共享响应框确认收口到-main2，不再卡在-defensiveRoll/闪避响应-成功后闪避骰在右侧骰盘等待确认.jpg` | 使用后状态：闪避骰已经投出并进入右侧骰盘；共享响应提示保留在手牌上方固定槽位，按钮变成“确认”，表示玩家还能确认收口。 |
| 03 | `test-results/evidence-screenshots/dicethrone/dicethrone-token-response-window.e2e/月精灵闪避成功后由共享响应框确认收口到-main2，不再卡在-defensiveRoll/闪避响应-确认后免伤收口回到主阶段.jpg` | 确认后状态：响应提示退场，阶段回到主阶段，防御方生命值保持 50，说明闪避成功后的免伤效果已经结算。 |

## 规范落点

不需要再更新规范主源。当前规范已经要求这类 Token / 临时骰压力态图组至少覆盖“使用前、使用后仍可确认、确认后收口”，并要求闪避代表路径证明共享响应提示不进入骰盘、旧 Token 弹窗不存在、Token 本体可点击、右侧骰盘不被遮挡。

本轮缺的是证据登记，不是规范缺失；因此本文件只补 evidence，不重写 E2E 用例合同。
