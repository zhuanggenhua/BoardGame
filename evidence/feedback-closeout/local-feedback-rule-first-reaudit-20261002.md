# 反馈逐条复审（本地，2026-10-02）

本轮口径：只核对本地工作树，不做线上回查。规则反馈统一按“`rule/` 原文 → 完整提示卡/卡面 → 录入 → 实现消费点 → 本地入口”处理；反馈原文不是规则真相。

## 1. AI 武僧在眩晕时使用气减伤

反馈原文：
> ai武僧在被施加眩晕时使用了气进行减伤 操作不合法

效果描述原文：
> 气指示物可以在任何时候被花费，每花费1个即可防止1点即将受到的伤害。

来源：`public/assets/i18n/zh-CN/dicethrone/images/monk/tip.png` 完整武僧提示卡；对应录入为 `src/games/dicethrone/heroes/monk/tokens.ts` 的 `TAIJI.activeUse.timing = ['beforeDamageDealt', 'beforeDamageReceived']`。

发现的问题：
玩家把“眩晕限制攻击”误读成“不能防御”。实现侧确实有同一门禁误拦：`getUsableTokenAmountForTiming` 和 `USE_TOKEN` 校验对所有伤害响应都调用眩晕门禁，导致合法的 `beforeDamageReceived` 气响应被屏蔽。

处理方式：
将眩晕门禁收窄到 `beforeDamageDealt`，保留防御方受伤前花气减伤；同步把回归测试改为验证“眩晕时仍可用气减伤”。本地 `ai-main-phase-turn-gating`、`ai-response-value-gate` 共 17/17 通过；完整武僧提示卡已打开核对。

当前状态：`resolved`（本地已修复；线上未回查）。

## 2. 炽天使神圣降临转移

反馈原文：
> 王权骰铸炽天使的神圣降临状态，应该不可被转移才对，现在是可以被手牌效果转移

效果描述原文：
> 对所有对手造成 1 伤害：1名拥有本指示物的玩家在其维持阶段对所有对手造成1伤害。本指示物不能以任何方式被转移（但可以被移除）。

来源：`public/assets/i18n/zh-CN/dicethrone/images/tianshi/tip.png` 完整炽天使提示卡；`src/games/dicethrone/rule/炽天使真相源表.md`；录入合同 `src/games/dicethrone/rule/炽天使录入核对.md`。

发现的问题：
原反馈命中了真实实现缺口：旧转移链只检查 `removable`，没有独立消费 `transferable`，因此把“可移除”错误地当成“可转移”。

处理方式：
保留共享 `transferable` 合同，并让命令校验、执行器、AI 候选统一调用 `canTransferStatus`；炽天使 `DIVINE_ARRIVAL` 已锁定 `transferable: false`。本地 `tianshi-behavior` 已覆盖“可移除但不可 TRANSFER_STATUS 转移”，相关 61 项炽天使行为回归通过；完整提示卡已打开核对。

当前状态：`resolved`（本地已修复；线上未回查）。

## 3. 魔杖天才“不可以取消效果”

反馈原文：
> 不可以取消效果

效果描述原文：
> 你可以丢弃一张牌来打出一个额外的仆从或打出一个额外的行动。

来源：完整卡图 `public/assets/i18n/zh-CN/smashup/cards/munchkin_mages.png`（魔杖天才物理槽）；录入文案 `public/locales/zh-CN/game-smashup.json` 的 `munchkin_mages_wand_whiz.abilityText`。

发现的问题：
这是把可选效果的选择交互误读成强制效果。截图显示的是“选择一张手牌作为弃牌成本”交互；卡面用“你可以”，不是必须执行。

处理方式：
核对完整卡面后保留当前实现的跳过分支，不改规则代码；本地 Smash Up 真实入口 `feedback-closeout-20260926.e2e.ts` 的“魔杖天才可以在真实手牌入口跳过”通过，相关 Munchkin 单测 20/20、Munchkin 机制单测 99/99 通过。

当前状态：`closed`。

关闭理由：完整卡面原文是“你可以……”，当前交互提供跳过，不存在“效果必须执行且不能取消”的规则 bug；截图中的提示是可选成本选择，不代表强制结算。

## 4. DiceThrone 观战卡牌残留

反馈原文：
> 观战的时候，玩家出的牌不会消失，一直在屏幕中间

发现的问题：
此前把反馈主语错换成了 DiceThrone 游戏 UI 布局，并据此把“专用特写落点压住玩家面板、提示板和骰盘”当成根因。这个结论没有先在原始 spectator 入口复现反馈本体，不能证明是观战队列未退场、重复入队、重挂载 / resync 恢复或显式关闭失效；它属于未经复现的 UI 误判。卡面核对不适用，替代真相源应是 spectator 入口和共享特写生命周期。

处理方式：
已撤回 DiceThrone 专用特写落点 / 尺寸改动，以及共享特写容器的临时布局、计时和队列兜底改动；保留“大吉大利”卡面投掷 3 颗骰子的夹具核对，但不把它当作观战残留已修。下一步必须回到原始 spectator 入口，按“玩家出的牌不会消失，一直在屏幕中间”核对最近打出的牌、事件队列、入队、重挂载 / resync、自动退场和显式关闭。

当前状态：`in_progress`（观战主语已纠正；未复现不等于已修复）。

## 5. Smash Up 观战卡牌残留

反馈原文：
> 大杀四方也是一样的问题

发现的问题：
这是另一条观战端反馈，不能直接继承 DiceThrone 的 UI 布局结论，也不能因为措辞相似就认定共享队列已经定位。当前尚未证明是队列未退场、重复入队、重挂载 / resync 恢复或显式关闭失效；卡面核对不适用，必须以 Smash Up spectator 入口和生命周期证据为准。

处理方式：
已撤回未经原始 Smash Up spectator 症状复现证明的共享定位、自动退场和内容偏移改动结论；保留本条 `in_progress`，重新按原始观战步骤复现并记录最近打出的牌、事件队列、入队 / 重挂载 / resync、自动退场和显式关闭。两条原始记录的 `userId` 和 `contactInfo` 均为空，只有不同观战房间和游客昵称，仍不能认定为同一反馈者。

当前状态：`in_progress`（未复现不等于已修复）。

## 6. 2026-10-03 本地 spectator 复现补充

DiceThrone 本地真实联机用例 `opponent lucky card should only show card spotlight for player viewer` 通过，证明对手出牌事件能进入 host 玩家页，特写节点会出现并自动退场；该用例没有创建 `spectate=1` spectator 页面，不能证明历史观战现场已修复。

同文件用例 `opponent common-card spotlight should match actual effect on player viewer for samurai and gunslinger` 在删除无来源布局断言后通过，但它同样只创建 host/guest 玩家页，不是原始 spectator 入口；因此不能证明“观战看不到当前人的卡牌”或“观战特写重复显示”已解决。

复核后确认，这条跨层容器矩形重叠断言没有来自用户故事、产品合同或反馈原文，属于擅自增加的验收标准，已从 E2E 删除；同时确认此前的成功截图是玩家页截图，不是 spectator 验收截图，不能覆盖当前反馈的公开牌区与重复特写问题。

本轮尝试录屏，但另一条长 E2E 已占用全局 runtime，录制任务在资源门禁处排队后停止；没有生成可交付录屏。临时录屏开关和跳过布局断言的测试改动已全部撤回。

Smash Up 现有 `actionSpotlightSuppression.test.tsx` 3/3 通过，只覆盖共享 hook / 组件的自动关闭和旧事件不回流；没有覆盖用户反馈对应的真实 spectator 页面，因此不能据此关闭反馈或宣称观战已修。

## 规范回代

- canonical source：`.spec/skills/feedback-closeout/SKILL.md`。
- 本轮已补强“先定位游戏，再找 `rule/` 原文；完整提示卡/卡面固定首步；录入和运行时数据低置信度；合法行为必须 `non_bug + closedReason`；每条真人反馈必须独立留三项汇报”的执行门。
- 该规则不复制到状态板或 evidence；状态板和本文件只记录证据与结果。
