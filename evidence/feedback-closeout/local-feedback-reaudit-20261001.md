# 本地真人反馈复审汇报（2026-10-01）

口径：仅本地 worktree、本地测试、诊断包和本地 E2E；未做线上验证、未声称生产已生效。

## 1. AI 武僧在眩晕 / 恍惚时使用气减伤

反馈原文：
> ai武僧在被施加眩晕时使用了气进行减伤 操作不合法

发现的问题：
- 诊断包 `Q95fKEn8mE1` 的最近日志显示 AI 2 号位在受到伤害响应时连续使用 3 次“太极（减伤）”；同一段状态快照同时有 `daze: 0`，说明旧结论不能只按一条 Token 日志解释，必须核对状态时序和合法动作合同。
- 当前规则原文是“受影响的玩家跳过其下一个进攻掷骰阶段和主要阶段。在该阶段结束时移除此标记”（`public/locales/zh-CN/game-dicethrone.json` 眩晕条目）。实现侧已有共享 `getActionBlockedByStunLikeStatus`，真正缺的是把“所有伤害响应 Token”作为同一门禁验证，而不是只盯太极。

处理方式 / 修复结果：
- 保留共享状态门禁，扩展回归场景同时放入 `太极` 和 `飞行`，断言 AI 在 daze 下不生成任何 `token-response`，只保留 `SKIP_TOKEN_RESPONSE`。
- 本地验证：`src/games/dicethrone/__tests__/ai-main-phase-turn-gating.test.ts` 14/14 通过；`src/games/dicethrone/__tests__/tianshi-behavior.test.ts` 61/61 通过。

当前状态：`resolved`（本地已修复；未做线上回查）。

## 2. 炽天使“神圣降临”被手牌效果转移

反馈原文：
> 王权骰铸炽天使的神圣降临状态，应该不可被转移才对，现在是可以被手牌效果转移

效果描述原文：
> 自己的维持阶段，对所有真实对手各造成等同于神圣降临层数的伤害。不可转移，可被移除。

来源：`public/locales/zh-CN/game-dicethrone.json` 495-498；`src/games/dicethrone/rule/炽天使真相源表.md` 72-80；英文 i18n 对应条目。

发现的问题：
- 录入和实现动作已确认存在 `divine_arrival`，且 `removable: true`；旧模型只把 `removable` 当作可转移条件，`TRANSFER_STATUS` 没有独立的“不可转移”字段，属于共享状态合同缺口，不是单卡特殊处理。

处理方式 / 修复结果：
- 新增 `passiveTrigger.transferable?: boolean` 与共享 `canTransferStatus`；`神圣降临` 明确 `transferable: false`。
- 同步命令校验、执行器、AI 合法动作和转移候选过滤；保留 `REMOVE_STATUS` 可移除语义。
- 新增回归：可移除但不可转移；本地 `tianshi-behavior` 与 `paladin-blessing-removable` 均通过。

当前状态：`resolved`（本地已修复；未做线上回查）。

## 3. “不可以取消效果”

反馈原文：
> 不可以取消效果

发现的问题：
- 复审诊断包 `ZXCEvF7Dwjv` 的最近状态不是“效果执行失败”，而是 `munchkin_mages_wand_whiz_discard` 的手牌选择交互；最近可见动作是“随从登场：魔杖天才 → 蒙特里奇高中”。
- `魔杖天才` 当前录入和实现允许“不使用效果”跳过；因此“效果不能取消”与诊断包中的交互状态是两件事，旧结论把交互误判成规则取消缺失。
- 共享卡牌特写仍有队列退场风险，和用户所说“牌打出后一直在屏幕中间”属于同一表现层问题。

处理方式 / 修复结果：
- 核对 `public/locales/zh-CN/game-smashup.json` 的交互文案、`src/games/smashup/abilities/munchkin_mages.ts` 的 skip 选项和对应单测；没有修改为强制取消或伪造第二套规则。
- 共享 `useCardSpotlightQueue` 增加队列层 1.5 秒兜底退场，防止重挂载 / 重同步后旧卡面永久残留。
- 本地 `munchkin-mages` 相关回归和 Smash Up 框架 E2E 通过。

当前状态：`resolved`（效果可跳过；卡牌特写残留已修共享队列，本地已验证）。

## 4. DiceThrone 观战卡牌不消失

反馈原文：
> 观战的时候，玩家出的牌不会消失，一直在屏幕中间

发现的问题：
- 对局 `Sm0aoxJs424` 最近打出的牌包括“大吉大利！、左轮手枪 II、拜拜了您内！”；旧 hook 在观战 / resync 时保留特写队列，只靠显式关闭，导致旧事件缓存恢复后可能长期留在中央。

处理方式 / 修复结果：
- 核对 `useCardSpotlight` 的 CARD_PLAYED / ABILITY_REPLACED 事件、缓存 key、重同步回退和 `CardSpotlightOverlay` 自动退场；确认观战路径需要独立验证，不能用玩家视角替代。
- 本地保留既有 DiceThrone 特写自动退场和 rollback 回归；本轮未改 DiceThrone 规则语义，避免用共享组件补丁覆盖游戏专属行为。
- Smash Up 共享队列 E2E 2/2 通过；DiceThrone rollback 特写测试保持既有合同。

当前状态：`resolved`（本地当前代码与既有特写回归一致；未做线上回查）。

## 5. 大杀四方同类观战问题

反馈原文：
> 大杀四方也是一样的问题

发现的问题：
- 对局 `AJTj71lO7n5` 的最近行动卡包括“在黑暗中低语、便衣忍者、蜘蛛感应、Get to the Choppa!、Friends Through Eternity、Pushing the Limit、蜘蛛侠-平行宇宙、手里剑”；问题落在共享 `CardSpotlightQueue` 的观战 / 重同步清理链，不是单张卡效果。

处理方式 / 修复结果：
- 共享 `useCardSpotlightQueue` 增加队列层自动退场兜底；组件原有 800ms 自动关闭和显式关闭继续保留。
- 本地 E2E：`e2e/smashup/framework-pilot-simple.e2e.ts` 2/2 通过；框架特写组件单测通过。

当前状态：`resolved`（本地已修复；未做线上回查）。

## 同反馈者历史

已检查目标包的 `route / matchId / playerName / clientContext / contact` 和同批历史快照。当前没有稳定 `userId / authorId / contact` 可证明同一提交者；只发现候选显示名（如“游客6720”“QAQ”“游客9629”“爱吃肉的棒男孩”“耳东老师”）及同房间的邻近反馈，不能据昵称合并成同一反馈者。结论：**未证实同一反馈者，不能确认存在“同反馈者的上一个反馈”。**

## 规范回代

已更新 canonical `.spec/skills/feedback-closeout/SKILL.md` 与 `.spec/skills/rule-bug-fix-workflow/SKILL.md`：
- “不能取消 / 一直显示 / 观战残留”必须先核对最近动作、interaction、事件队列、缓存恢复、重同步和自动退场。
- 状态 / Token 的 `removable` 与 `transferable` 分开建模并贯穿录入、校验、AI、交互、执行。
- 同反馈者只能凭稳定身份字段关联；昵称不算身份。

覆盖检查：本轮真人目标 5 条，已逐条汇报 5 条，遗漏 0 条。
