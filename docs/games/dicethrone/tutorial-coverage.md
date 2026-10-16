# Dice Throne 交互式教程内容总账

本文件是单游戏作者覆盖矩阵，不是通用执行规范。通用判断来自 [tutorial-design](../../../.spec/knowledge/standards/tutorial-design.md)。

## 目标与范围

用户原话：“我的核心是交互式教程，是代替视频、文本规则，所以要全面，并且响应这类新增的功能也需要解释到”。目标不是增加说明字数，而是让玩家理解规则、亲手决策、操作正式入口并看到后果。

当前唯一教程清单是 [tutorial.ts](../../../src/games/dicethrone/tutorial.ts)，中英文正文是两份 `game-dicethrone.json` 的 `tutorial.steps`。本轮扩展已有教程 owner，不增加专用命令、状态或游戏规则。目标环境是本地 `/play/dicethrone/tutorial`。

开局同源：双人僧侣，50 体力、2 CP、4 张手牌、先手首回合跳过收入，首个决策在主要阶段 1。仅固定合法牌序和随机结果；未预造弃牌超限、攻击、Token 或响应状态。对手由正式命令执行；自己的首次防御和响应交还玩家。

## 规则、元素与交互矩阵

规则主源：[王权骰铸规则](../../../src/games/dicethrone/rule/王权骰铸规则.md)；英雄事实来自僧侣 `cards.ts`、`abilities.ts`、`diceConfig.ts`、`tokens.ts` 和现有卡面语言包；电子版响应来源：[card-timing-terms](card-timing-terms.md)、正式骰盘、响应条、Token 与手牌 UI。

| 来源 / 玩家任务 | 教学时刻 | 正式承接物 / 输入 / 结果 | 验收状态 |
| --- | --- | --- | --- |
| §1 胜负、同时归零 | intro | 目标说明、双方体力 | 规则说明；实际终局待独立练习 |
| §2 起手、CP / 体力读数 | stats | 玩家资源 HUD | 待本轮浏览器验证 |
| §3 阶段顺序、首回合收入例外 | phases、income-result | 阶段条、第二回合实际收入及抽牌 | 待验证 |
| §3.3 同层主要动作全集 | main-actions-rule | 手牌与技能板；不限次数、顺序自选 | 待验证 |
| §3.3 出售与电子版撤回 | sell-card-intro → sell-result → undo-sell → undo-result | 拖牌至弃牌堆、撤回，手牌与 CP 恢复 | 待验证 |
| §3 进攻五骰与最多三掷 | roll-rule → dice-roll → dice-lock → dice-reroll | 右侧骰盘锁定、重掷、剩余次数 | 待验证 |
| §4 数字与图标、顺子及组合 | dice-symbols、ability-rule | 当前骰盘与技能槽 | 图标实操；顺子仅规则说明 |
| 卡面“来个六！”与改骰确认 | play-six-rule → play-six → play-six-modify → dice-confirm | 真实手牌、骰子本体、普通确认 | 待验证 |
| §4 选技能、§7 一般伤害 | ability-rule → abilities → attack-rule → resolve-attack | 技能槽 → 正式攻击 → 对手防御 | 待验证 |
| §3.6 对手防御公开结果 | opponent-defense → main2-intro | 对手正式投骰、确认与攻击结果 | 待验证；不再隐藏首次防御解释 |
| 卡面“顿悟！”奖励骰 | enlightenment-rule → enlightenment-play → enlightenment-confirm → enlightenment-result | 右侧奖励骰普通确认、实际获得标记 | 待验证 |
| 卡面“静心！”、出牌后响应 | inner-peace-rule → inner-peace → inner-peace-response | 实际获得太极；有真实窗口才显示响应步骤 | 待验证；没有窗口不伪造 |
| §3.7–3.8 主要 2 / 弃牌 / 交接 | end-turn → discard-rule → discard-finish | 两次正式阶段推进；本局没有超限 | 待验证；超限出售待机制练习 |
| 他人行动与当前玩家防御权 | ai-turn → defense-rule → defense-roll → defense-confirm | 对手施加击倒并攻击；玩家亲手投防御骰 | 待验证 |
| §3.6 最后介入机会、太极减伤 | defense-resolve → token-response-rule → token-response-use → token-response-pass → damage-result | Token 本体使用 / 合法放弃 → 正式伤害落地 → 体力 | 待验证；分别覆盖介入与放弃 |
| 轮序与收入 | opponent-end-turn → income-result | 对手结束回合、自己 +1 CP 与抽牌 | 待验证 |
| 击倒与净化 | knockdown-explain → purify-rule → purify-use → purify-result | 选择击倒、消耗净化、状态移除 | 待验证；支付 2 CP / 跳过进攻分支待练习 |
| §5.1 永久升级、差价 | upgrade-rule → meditation-2 → upgrade-result | 支付 2 CP、技能等级 II | 待验证；III 级差价仅规则说明 |
| §5 卡牌字段、颜色 / 时机 | card-types → hand | 手中真实卡名、费用、时机图标、效果 | 待验证；红牌中断与对手回合出牌待练习 |
| 只读检视、提示板展开 / 收起、响应偏好开关 | tip-board / status-tokens | 现有正式 UI | 待补交互练习，不以一句介绍算覆盖 |
| §4.4 / §7 不可防御、纯粹、附属、终极；§8 语义 | 尚无真实练习 | 必须按各自真实规则链补充，不能由一般攻击替代 | 待补缺口 |
| §6 闪避、叠加上限、伙伴 | 已介绍标记；尚无完整练习 | 闪避判定骰、实际叠加、对应英雄伙伴 | 待补缺口 |
| §2 牌库耗尽重洗、§3.1 多效果维持 | 尚无真实练习 | 牌库、弃牌堆、维护效果 | 待补缺口 |
| §9 多人 / 团战 / 目标骰、其它英雄机制 | 不属于现有双人僧侣入口 | 需要对应人数或英雄的独立真实入口 | 未覆盖，不声明全游戏完成 |

## 治理裁定

- 保留：通用标准已有的因果链、首次教学、正式权限、单焦点与截图规则，属于已有要求待执行。
- 补充：完整替代教学的范围口径、未触发机制的真实练习落点、新增正式交互后的同步检查，唯一正文位于通用 `tutorial-design.md`，作用于全项目多游戏。
- 本文件仅记录 Dice Throne 的来源、处置与缺口，不复制执行正文。旧的首次攻击及自动批次证据不作为本轮完整教学证据。
- 本轮仍有待补机制与证据，因此不能宣称已达到替代全部文本规则的完成标准。
