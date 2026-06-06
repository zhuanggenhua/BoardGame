## 1. Spec
- [x] 1.1 为 `game-ai-system` 增加准备阶段去重规则（DiceThrone/SmashUp/Summoner Wars）。
- [x] 1.2 增加“准备阶段随机扰动独立于玩法难度随机性”的要求。
- [x] 1.3 增加响应窗口优先级规则（阻止立即失败 / 确保立即得分）。
- [x] 1.4 增加 DiceThrone 锁骰/重投 + 防御/资源权衡要求。
- [x] 1.5 增加 SmashUp 基地评分节奏 + 行动卡时机要求。
- [x] 1.6 增加 Summoner Wars 召唤师安全 + 击杀/魔力经济平衡要求。

## 2. Setup Selection Validation
- [x] 2.1 验证 DiceThrone AI 选角已过滤已选角色，补齐必要测试。
- [x] 2.2 验证 SmashUp AI 选派系已遵循 takenFactions，补齐必要测试。
- [x] 2.3 验证 Summoner Wars AI 选派系已过滤已选阵营，补齐必要测试。

## 3. Response Priority & Decision Quality
- [x] 3.1 设计响应窗口“立即失败/立即得分”判定与评分优先级。
- [x] 3.2 在公共评分流程或各游戏策略中接入响应优先级逻辑。
- [x] 3.3 补充跨游戏响应优先级回归测试用例。

## 4. DiceThrone Strategy
- [x] 4.1 设计锁骰/重投评分逻辑（基于能力价值与完成度）。
- [x] 4.2 增强 AI 在低生命值/资源不足时的防御与恢复偏好。
- [x] 4.3 补充关键场景的 DiceThrone AI 掷骰与行动测试。

## 5. SmashUp Strategy
- [x] 5.1 强化基地评分临近判定与投放节奏。
- [x] 5.2 优化行动卡使用时机与保留策略。
- [x] 5.3 补充 SmashUp AI 节奏与干扰优先级测试。

## 6. Summoner Wars Strategy
- [x] 6.1 强化召唤师安全优先级与防守判定。
- [x] 6.2 平衡击杀机会与魔力经济的行动偏好。
- [x] 6.3 补充 Summoner Wars AI 安全与击杀场景测试。

## 7. Verification
- [x] 7.1 运行相关 Vitest（DiceThrone/SmashUp/Summoner Wars AI）。
- [x] 7.2 执行 `openspec validate update-ai-setup-selection-and-dice-strategy --strict --no-interactive`。
