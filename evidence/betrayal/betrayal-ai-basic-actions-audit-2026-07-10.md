# 小黑屋剧本一 AI 基础动作审计

## 审计范围

- 游戏：小黑屋第一剧本
- 入口：本地合作 AI `src/games/betrayal/ai.ts`
- 领域真相：`BetrayalDomain.validate / execute / reduce`
- 本轮动作：主动持有物、普通交易、狗的远程交易、搜刮尸体、兔脚重掷、神秘电梯房间效果
- 非目标：远程 AI provider、独立 AI UI、额外提示正文

## 结论等级

**代表性玩法已验证。**

本轮已经用领域行为测试和 Board 基础界面测试证明五类动作能通过正式命令管线执行，并通过全 AI 对局验证英雄、叛徒和杰克之灵链路未被破坏。本轮没有修改 UI，也没有新增真实浏览器 E2E，因此不把本证据扩大表述为小黑屋全游戏的全面玩法审计。

## 结构与策略

### 持有物

- `possessionEffects.ts` 成为持有物主动效果的共享真相源。
- `game.ts` 与 `ai.ts` 共同读取该表，避免 AI 反向导入整个领域入口形成循环依赖。
- 急救包和奇怪的药品只在目标存在属性损失时使用。
- 地图类持有物只在目标房间能缩短当前阵营目标距离时使用。
- 面具只保留领域校验通过的已发现相邻房间目标。

### 交易

- 普通交易只对同房间同阵营队友生成。
- 狗交易只对领域允许的 4 格范围同阵营队友生成。
- AI 比较持有物在当前持有者和目标队友上的稳定收益，收益不足时不生成交易。
- 已使用持有物和狗交易狗本身继续由领域 validator 拒绝。

### 搜尸

- AI 同时提供尸体玩家与具体持有物，不默认取第一张牌。
- 搜尸策略分数低于攻击、驱魔等阵营胜利动作。
- 死亡叛徒操控杰克之灵时不会再使用尸体持有物、交易或搜尸。

### 兔脚

- 仅在事件未达到最佳阈值、攻击未成功、房间检定失败、死亡保护失败或剧本检定失败时生成。
- 每颗骰子仍逐一经过领域 validator。
- 最低点骰子的策略分数最高。
- 已成功的攻击和最佳事件分支不会生成兔脚动作。

### 房间效果

- AI 生成通用 `USE_ROOM_EFFECT` 候选。
- 当前仅神秘电梯能通过领域 validator。
- 使用后由正式 reducer 更新房间位置、每回合使用标记和最近投骰。

## AI 专属门禁

- AI legal actions 只由 `GameAiRuntime` 为对应 AI 座位构造。
- 非当前 AI 不生成普通回合动作。
- 每个候选都经过 `BetrayalDomain.validate`，AI 不直接修改状态。
- 本轮没有修改真人操作入口、领域规则、响应窗口或 watchdog。

## 验证证据

- `npx vitest run src/games/betrayal/__tests__/ai.test.ts --reporter=verbose`
  - 18/18 通过。
  - 覆盖急救包正式管线、地图与面具参数、普通/狗交易、无收益不交易、具体搜尸、兔脚失败/成功分支、神秘电梯、英雄终局、叛徒终局和杰克之灵。
- `npx vitest run src/games/betrayal/__tests__/firstScenarioRuntime.test.ts`
  - 118/118 通过。
- `npx vitest run src/games/betrayal/__tests__/Board.foundation.test.tsx`
  - 32/32 通过。
  - 存在既有 `Multiple instances of Three.js` 警告，不影响测试结果。
- `npx vitest run src/games/__tests__/betrayalManifestIntegration.test.ts`
  - 3/3 通过，命令退出码为 0。
  - 测试进程结束后出现 `ECONNRESET socket hang up` 噪声，没有失败用例。
- `npx tsc --noEmit --pretty false`
  - 通过。
- `npx eslint src/games/betrayal/ai.ts src/games/betrayal/game.ts src/games/betrayal/possessionEffects.ts src/games/betrayal/__tests__/ai.test.ts`
  - 0 error。
  - `game.ts` 保留 5 个本轮之前已经存在的未使用函数 warning。
- `git diff --check`
  - 通过，仅输出工作区换行格式提示。
- `openspec validate add-betrayal-cooperative-ai --strict --no-interactive`
  - 通过。
- `python D:\codex-home\skills\task-completion-guard\scripts\check_completion.py --state temp\betrayal-ai-basic-actions-completion.json`
  - 返回 `COMPLETE`。

## 残余范围

- 远程 AI provider 仍保持关闭。
- 独立 AI UI、专用提示正文和专用模式入口不在本轮范围。
- 策略权重已满足基础可玩与反循环要求，后续真实玩家反馈仍可继续调参。
