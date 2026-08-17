# DiceThrone 闪避临时骰右侧骰盘确认修复（2026-08-17）

## 当前结论

- 用户原始问题：闪避 / 奖励骰这类临时骰已经进入右侧骰盘，但原应使用的右侧普通确认按钮没有可用；之前修法把确认职责迁到共享响应提示，等于用移除原按钮绕过灰态。
- 当前修复：闪避 Token 掷出临时骰后，共享响应提示继续保留为“仍在响应窗口”的状态层，但不再显示让过 / 确认按钮；右侧骰盘显示单个“确认”按钮。点击右侧确认会发出同一个 Token 响应收口命令，确认后清理闪避骰并回到主阶段。
- 保留口径：太极这类不产生临时骰的 Token 响应仍由共享响应提示跳过 / 收口；奖励骰 / 临时骰确认仍统一在右侧骰盘承接。

## 改动点

| 文件 | 改动 | 现实效果 |
| --- | --- | --- |
| `src/games/dicethrone/Board.tsx` | 闪避临时骰等待确认时恢复右侧骰盘动作区，右侧确认按钮发出 `SKIP_TOKEN_RESPONSE`；共享响应提示不再同时显示确认按钮 | 不再通过隐藏右侧按钮绕开灰态；玩家在骰盘看骰、改骰、确认 |
| `e2e/dicethrone/dicethrone-token-response-window.e2e.ts` | 闪避用例从“共享响应框确认”改为“右侧骰盘确认”，并断言右侧确认按钮可见、可用、共享响应提示仍可见且没有让过按钮 | 测试不再固化错误修法 |
| `e2e/dicethrone/dicethrone-die-modification.e2e.ts` | 战术优势重掷闪避骰后，收口入口改为右侧骰盘确认 | 覆盖“改骰后最终伤害跟着新骰面变” |
| `.spec/knowledge/standards/ui-change-gates.md` | 增加“禁用态回归不得靠迁移或删除入口解决” | 后续同类 UI bug 必须修原槽位授权，不得换位置冒充修复 |

## 验证

- `npx vitest run src/games/dicethrone/ui/__tests__/GameHints.test.tsx src/games/dicethrone/ui/__tests__/DiceTray.test.tsx src/games/dicethrone/ui/__tests__/diceStagePolicy.test.ts --reporter dot`
  - 结果：`3 files / 24 tests passed`。
- `npx vitest run src/games/dicethrone/__tests__/roll-context.test.ts -t "闪避|奖励骰普通确认|Duel" --reporter dot`
  - 结果：`1 file / 8 tests passed / 42 skipped`。
- `node scripts/infra/run-e2e-single.mjs isolated e2e/dicethrone/dicethrone-token-response-window.e2e.ts "月精灵闪避成功后由右侧骰盘确认收口到 main2，不再卡在 defensiveRoll"`
  - 结果：`1 passed`。
- `node scripts/infra/run-e2e-single.mjs isolated e2e/dicethrone/dicethrone-token-response-window.e2e.ts "武僧太极减伤走共享响应框并在跳过后结算血量"`
  - 结果：`1 passed`。
- `node scripts/infra/run-e2e-single.mjs isolated e2e/dicethrone/dicethrone-die-modification.e2e.ts "闪避骰进入当前骰区后，战术优势可重掷并重新计算免伤"`
  - 结果：`1 passed`。该用例现在断言闪避骰可被战术优势重掷，伤害按新骰面重算，并且共享响应提示保留为状态层、右侧骰盘确认收口。

## 截图

本轮新图来自当前工作树、当前 E2E：

- `test-results/evidence-screenshots/dicethrone/dicethrone-token-response-window.e2e/月精灵闪避成功后由右侧骰盘确认收口到-main2，不再卡在-defensiveRoll/闪避响应-使用前共享提示贴近手牌且Token可点.jpg`
- `test-results/evidence-screenshots/dicethrone/dicethrone-token-response-window.e2e/月精灵闪避成功后由右侧骰盘确认收口到-main2，不再卡在-defensiveRoll/闪避响应-成功后右侧骰盘确认按钮可用.jpg`
- `test-results/evidence-screenshots/dicethrone/dicethrone-token-response-window.e2e/月精灵闪避成功后由右侧骰盘确认收口到-main2，不再卡在-defensiveRoll/闪避响应-确认后免伤收口回到主阶段.jpg`
- `test-results/evidence-screenshots/dicethrone/dicethrone-die-modification.e2e/闪避骰进入当前骰区后，战术优势可重掷并重新计算免伤/闪避骰-成功后可干预.jpg`
- `test-results/evidence-screenshots/dicethrone/dicethrone-die-modification.e2e/闪避骰进入当前骰区后，战术优势可重掷并重新计算免伤/闪避骰-战术优势重掷后.jpg`
- `test-results/evidence-screenshots/dicethrone/dicethrone-die-modification.e2e/闪避骰进入当前骰区后，战术优势可重掷并重新计算免伤/闪避失败后正式收口并正常掉血.jpg`

旧 `由共享响应框确认收口` 图组只能作为坏基线和历史证据，不再代表当前正确合同。
