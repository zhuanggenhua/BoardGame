# DiceThrone 战术优势重掷锁定骰修复证据

## 原始症状

- 玩家使用战术家的战术优势 Token 重掷骰子时，已锁定骰不能作为目标。
- 现实影响：玩家已经保留 / 锁定的正式主骰，无法被“花费 Token 指定重掷 1 骰”的效果重新选择。

## 规则合同

- `public/locales/zh-CN/game-dicethrone.json`：战术优势描述为“可花费 1 个来获得 1 CP 或重掷 1 骰”，没有“未锁定骰”限制。
- `src/games/dicethrone/rule/战术家录入核对.md`：`tactical_advantage` C2 为“1 个任意时重掷 1 骰”，实现入口为被动 `rerollDie`。

## 修复结论

- 这是实现消费错误，不是战术优势单个 Token 的特例。
- “锁定骰”只表示普通投骰时保留该骰，不表示 Token / 被动能力不能指定重掷该骰。
- 已统一被动 `rerollDie` 共享链路：可用性判断、命令校验、执行结算、Board 点击入口、骰盘可点状态、AI 合法动作和回归测试。
- 普通投骰仍保留原规则：自然重投只重掷未锁定骰。

## 截图证据

- `test-results/evidence-screenshots/dicethrone/dicethrone-die-modification.e2e/战术家可从真实主骰入口主动使用战术优势重掷已锁定骰/04-战术家-锁定主骰主动重掷前.jpg`
- `test-results/evidence-screenshots/dicethrone/dicethrone-die-modification.e2e/战术家可从真实主骰入口主动使用战术优势重掷已锁定骰/05-战术家-锁定主骰主动重掷选择中.jpg`
- `test-results/evidence-screenshots/dicethrone/dicethrone-die-modification.e2e/战术家可从真实主骰入口主动使用战术优势重掷已锁定骰/06-战术家-锁定主骰已重掷且战术优势已消耗.jpg`

## 验证

- `npx vitest run src/games/dicethrone/__tests__/passive-reroll-validation.test.ts src/games/dicethrone/__tests__/zhanshujia-cursed-pirate-mechanics.test.ts src/games/dicethrone/__tests__/treant-token-mechanics.test.ts src/games/dicethrone/ui/__tests__/DiceTray.test.tsx --reporter verbose`：187 passed。
- `npx vitest run src/games/dicethrone/__tests__/passive-reroll-validation.test.ts --reporter verbose`：35 passed。
- `npx vitest run src/games/dicethrone/__tests__/basic-commands-coverage.test.ts -t "本地 AI 的被动重掷候选应包含已锁定骰子" --reporter verbose`：1 passed。
- `npx vitest run src/games/dicethrone/__tests__/ai-roll-strategy.test.ts src/games/dicethrone/__tests__/ai-response-value-gate.test.ts --reporter verbose`：8 passed。
- `node scripts/infra/run-e2e-single.mjs default e2e/dicethrone/dicethrone-die-modification.e2e.ts "战术家可从真实主骰入口主动使用战术优势重掷已锁定骰"`：1 passed。

## 遗留说明

- 当前未按“回归提交”定性，因为本轮没有完成 last-known-good / first-bad 的提交历史定位。
- 若后续要追具体引入提交，应再走 `git log -S` / `git blame` / 必要时二分；不能用本次实现根因直接冒充首次变坏提交。
