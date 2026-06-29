# 大杀四方时间旅行者回牌库卡面显示验证

## 结论

- 时间掠夺者现在不是走中央弹层，而是自动展开弃牌堆底部面板，直接从弃牌堆候选卡面里点选。
- 往复时间者现在也不是走中央弹层，而是自动展开弃牌堆底部面板，只把合法行动卡暴露成可直选候选。
- 两条链路都在真实页面里完成了“弃牌堆底部面板显示真实卡面 -> 直接点击选择 -> 回牌库并收口”。

## 时间掠夺者

- 触发前截图：
  `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\smashup-yuanhou-factions.e2e\时间旅行者-Time-Raider-真实天赋可选择弃牌堆任意牌放到牌库底\yuanhou-time-raider-discard-panel.png`
  观察：
  1. 牌桌中央没有新的主弹层，主承接面是底部弃牌堆面板。
  2. 下方两个候选都显示为真实卡面，而不是空白占位。
  3. 这两个候选都直接来自当前弃牌堆，符合“能直选就直选”的承接规则。

- 关键候选卡截图：
  `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\smashup-yuanhou-factions.e2e\时间旅行者-Time-Raider-真实天赋可选择弃牌堆任意牌放到牌库底\yuanhou-time-raider-discard-action-card.png`
  观察：
  1. 候选项清楚显示了“时间旅行”行动卡的完整卡面。
  2. 卡名、类型、正文都可直接辨认，说明前端已经拿到正确卡定义而不是只拿到 uid。

- 选择后截图：
  `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\smashup-yuanhou-factions.e2e\时间旅行者-Time-Raider-真实天赋可选择弃牌堆任意牌放到牌库底\yuanhou-time-raider-selected-card-bottomed.png`
  观察：
  1. prompt 已关闭。
  2. 时间掠夺者已显示“已用”。
  3. 右侧弃牌堆数量减少，符合“已选牌进入牌库底、未选牌保留”的收口结果。

## 往复时间者

- 触发前截图：
  `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\smashup-yuanhou-factions.e2e\时间旅行者-Repeater-Perfect-真实入口可从混合弃牌堆选择非第一张行动放到牌库顶\yuanhou-repeater-perfect-discard-action-panel.png`
  观察：
  1. 牌桌中央没有新的主弹层，主承接面是底部弃牌堆面板。
  2. 只出现两张行动卡候选，没有把弃牌堆里的随从混进来。
  3. 两个候选都显示为真实卡面，不是白块。

- 关键候选卡截图：
  `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\smashup-yuanhou-factions.e2e\时间旅行者-Repeater-Perfect-真实入口可从混合弃牌堆选择非第一张行动放到牌库顶\yuanhou-repeater-perfect-second-action-card.png`
  观察：
  1. 候选项清楚显示了“时间旅行”行动卡的完整卡面。
  2. 这张图证明第二张行动候选也拿到了正确卡定义，不只是第一张卡偶然正常。

- 选择后截图：
  `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\_shared\smashup-yuanhou-factions.e2e\时间旅行者-Repeater-Perfect-真实入口可从混合弃牌堆选择非第一张行动放到牌库顶\yuanhou-repeater-perfect-selected-action-topped.png`
  观察：
  1. prompt 已关闭。
  2. 往复时间者留在基地上，右侧弃牌堆仍保留未选行动。
  3. 链路已回到可继续操作的牌桌状态。

## 对应改动

- 项目规则补成“弃牌堆静态选牌默认走弃牌堆底部直选面板”：`src/games/smashup/rule/discard-entry-target-family-contract.md`
- 时间旅行者两条能力改成 `discard` 语义，并补上真实卡定义：`src/games/smashup/abilities/yuanhou.ts`
- Board 把 `targetType: discard` 接到弃牌堆底部面板，而不是中央弹层：`src/games/smashup/Board.tsx`
- 回归测试锁定这两个交互必须是弃牌堆直选语义：`src/games/smashup/__tests__/interactionTargetTypeAudit.test.ts`
- 领域回归测试继续锁定候选必须带 `defId`：`src/games/smashup/__tests__/yuanhouFactionAbilities.test.ts`

## 补充回归

- 往复时间者：
  - 弃牌堆只剩一张行动时，真实入口仍会自动放到牌库顶，不会错误弹出弃牌堆面板。
  - 弃牌堆为空时，真实入口仍只给“没有可选牌”的反馈，不会错误弹出弃牌堆面板。
- 时间掠夺者：
  - 弃牌堆只剩一张牌时，真实入口仍会自动放到牌库底，不会错误弹出弃牌堆面板。
  - 弃牌堆为空时，真实入口仍只给“没有可选牌”的反馈，不会错误弹出弃牌堆面板。
