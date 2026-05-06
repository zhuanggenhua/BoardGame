# DiceThrone 4 人自来源转移状态 E2E 证据

## 目标

- 验证 4 人房间里，`乾坤大挪移 / transfer-status` 从自己身上选中状态后，不会卡死在第二阶段。
- 验证敌方与队友目标都保持可点击，点击后有明确选中反馈，确认后交互能正常收口。

## 运行命令

```bash
npm run test:e2e:ci:file -- e2e/dicethrone/dicethrone-simple-start.e2e.ts "Online 4-player transfer token: own token can be transferred to enemy without target freeze"
```

## 关键截图

### 1. 目标选择面板已正常打开

- 路径：
  `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-simple-start.e2e\Online-4-player-transfer-token-own-token-can-be-transferred-to-enemy-without-target-freeze\06b-four-player-transfer-own-token-target-selection.png`
- 肉眼观察：
  - 面板标题为“选择要转移的状态效果 / 选择转移目标玩家”，没有白屏、没有整页卡死。
  - 自己的来源卡显示“已选来源”，其余 3 个目标卡都仍然展示在面板内，没有被错误裁掉。
  - 敌方与队友卡片都带“点击作为接收目标”文案，确认按钮此时仍禁用，符合“尚未选目标”的预期。
- 验收结论：
  达标。第二阶段已正常展开，且不存在“只剩暗卡、没有候选目标”的异常。

### 2. 点击敌方后目标选中态生效

- 路径：
  `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-simple-start.e2e\Online-4-player-transfer-token-own-token-can-be-transferred-to-enemy-without-target-freeze\06c-four-player-transfer-own-token-target-picked.png`
- 肉眼观察：
  - 敌方目标卡出现明显高亮边框，并显示“已选目标”文案。
  - 确认按钮由禁用态切到高亮可用态。
  - 来源卡仍保持“已选来源”锁定状态，没有被错误切回可点击。
- 验收结论：
  达标。点击已真正命中目标，不是“看起来点了但状态没变”。

### 3. 确认后交互正常收口

- 路径：
  `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-simple-start.e2e\Online-4-player-transfer-token-own-token-can-be-transferred-to-enemy-without-target-freeze\06d-four-player-transfer-own-token-resolved.png`
- 肉眼观察：
  - 转移弹窗已经关闭，棋盘恢复正常可继续操作状态。
  - 顶部敌方头像旁可见 `crit` 指示物，自己的 `crit` 已移除。
  - 页面没有停留在模态层，也没有残留“确认/取消”交互面板。
- 验收结论：
  达标。交互已完整收口，不存在第二阶段卡死。

## 自动断言

- 点击敌方目标后，E2E 显式等待：
  - `dt-transfer-target-1[data-selected="true"]`
  - “确认”按钮可用
- 确认后，E2E 显式等待：
  - `sys.interaction.current` 清空
  - `players['0'].tokens.crit === 0`
  - `players['1'].tokens.crit === 1`
- 同步校验敌方页面也收到同样的最终状态。

## 本轮结论

- 根因不是 transfer-status 规则本体，而是 `DiceThroneBoard` 打开状态交互弹层时，`useSyncedModalStackEntry` / modal stack 同步链会被不稳定的 entry 驱动，进而引发渲染深度异常；修复后这条链不再报 `Maximum update depth exceeded`。
- 4 人“自己来源 -> 转给敌方”与“枪手开局 loaded -> 转给敌方”两条真实链路都已复现并通过。
- 当前收口证据表明：问题不再表现为“第二阶段全暗且点不动 / 直接卡死”。

## 补充验证：枪手开局 loaded

### 桌面链路

- 关键截图：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-simple-start.e2e\Online-4-player-transfer-token-gunslinger-opening-loaded-can-be-transferred-from-self-to-enemy\06f-four-player-transfer-gunslinger-loaded-target-selection.png`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-simple-start.e2e\Online-4-player-transfer-token-gunslinger-opening-loaded-can-be-transferred-from-self-to-enemy\06g-four-player-transfer-gunslinger-loaded-target-picked.png`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-simple-start.e2e\Online-4-player-transfer-token-gunslinger-opening-loaded-can-be-transferred-from-self-to-enemy\06h-four-player-transfer-gunslinger-loaded-resolved.png`
- 肉眼观察：
  - 第二阶段来源卡显示 `loaded`，敌方目标卡可点击。
  - 点击敌方后出现明显选中态，确认按钮可用。
  - 确认后弹层关闭，`loaded` 从自己转移到敌方，没有残留错误边界。

### Mobile context 链路

- 关键截图：
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-simple-start.e2e\Online-4-player-transfer-token-mobile-gunslinger-opening-loaded-can-be-transferred-from-self-to-enemy-without-render-loo\06j-mobile-four-player-transfer-gunslinger-loaded-target-selection.png`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-simple-start.e2e\Online-4-player-transfer-token-mobile-gunslinger-opening-loaded-can-be-transferred-from-self-to-enemy-without-render-loo\06k-mobile-four-player-transfer-gunslinger-loaded-target-picked.png`
  - `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-simple-start.e2e\Online-4-player-transfer-token-mobile-gunslinger-opening-loaded-can-be-transferred-from-self-to-enemy-without-render-loo\06l-mobile-four-player-transfer-gunslinger-loaded-resolved.png`
- 肉眼观察：
  - mobile 视口下第二阶段面板可正常展开，没有出现白屏或错误边界。
  - 敌方目标可选中，确认后流程顺利收口。
  - 本轮 mobile 用例已额外挂载 fatal console 门禁，未再出现 `Maximum update depth exceeded`。
