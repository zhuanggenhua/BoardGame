# Dice Throne 在线 AI off-turn defensiveRoll 卡死修复证据（2026-04-21）

> 2026-06-06 当前有效口径：本文只对应“online AI 在 off-turn defensiveRoll 卡死”这一条历史专项修复证据，不是当前 DiceThrone 所有 online AI/watchdog/defensiveRoll 问题都已彻底收口的证明，也不是新英雄补审出口。阅读时只能把它当作单条链路修复记录。

## 关联反馈
- 反馈 ID：`69c7845196012f55115c3be8`
- 标题：`对战ai卡死`
- 本轮收口口径：虽然原始包记录在 `/play/dicethrone/local`，但本轮按用户要求改为**online 链路优先**复现/修复，锁定“真人仍是 activePlayer 时，AI 防御阶段没有被 watchdog/合法动作恢复链接住”的同类卡死风险。

## 复现与验证命令
1. 红灯复现（新增 transport 回归前失败）
   - `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts -t "online AI watchdog 在 human active 的 off-turn 防御阶段也应代 AI 执行合法动作，避免 defensiveRoll 卡死" --configLoader native --maxWorkers 1`
2. 修复后回归
   - `node scripts/infra/vitest-cli-safe.mjs run src/engine/transport/__tests__/server.test.ts -t "online AI watchdog 在 human active 的 off-turn 防御阶段也应代 AI 执行合法动作，避免 defensiveRoll 卡死" --configLoader native --maxWorkers 1`
   - `node scripts/infra/run-e2e-single.mjs ci e2e/dicethrone/dicethrone-simple-start.e2e.ts "Online AI 在 off-turn defensiveRoll 也应自动掷骰并收口，不应卡死在玩家回合下的防御阶段"`

## 截图证据

### 1) 卡死前：仍停在防御阶段
- 路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-simple-start.e2e\Online-AI-在-off-turn-defensiveRoll-也应自动掷骰并收口，不应卡死在玩家回合下的防御阶段\05h-online-ai-offturn-defensive-before.png`
- 我实际看到：
  - 左侧阶段条高亮在 **5. 那既攻击阶段 / 防御阶段**，说明流程仍停在 AI 防守方要处理的节点。
  - 画面中央有 `AI 2 号位 正在思考中...`，但右侧尚未回到主阶段按钮态，属于用户感知上的“AI 还没收口”前置状态。
- 是否达到验收标准：**未达到**。这张图只证明问题位点存在于防御阶段，不可单独收口。

### 2) 收口后：流程回到 main2
- 路径：`D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-simple-start.e2e\Online-AI-在-off-turn-defensiveRoll-也应自动掷骰并收口，不应卡死在玩家回合下的防御阶段\05j-online-ai-offturn-defensive-resolved.png`
- 我实际看到：
  - 左侧阶段条已经高亮到 **6. 主要阶段(2)**，不再停留在防御阶段。
  - 右侧主操作区重新出现可继续推进的 `下一阶段` 按钮，说明流程已回到可继续操作的主阶段。
  - 中央不再停留在上一张图那种“只剩 AI 思考、流程不动”的卡死观感。
- 是否达到验收标准：**达到**。这张图直接证明 online 链路下，AI 防御阶段已成功收口，不再卡死在玩家回合里的 defensiveRoll。

## 结论
- transport watchdog 现在能识别“**当前真人仍是 activePlayer，但另一个 AI seat 在防御阶段已有合法动作**”的场景，并改走 legal-action recovery，而不是继续空等。
- online E2E 已证明真实房间里，流程可从 defensiveRoll 收口到 `main2`，用户不再卡死。

---

**当前阅读说明**：本文只能证明“online AI off-turn defensiveRoll 卡死”这条专项问题曾被修复，不能外推为当前所有 AI 防御阶段卡死、所有 watchdog recovery 场景或 DiceThrone 当前整体审计都已收口。
