# The Gang 运行入口验证

## 验证口径

- 2026-07-05 的截图和命令来自旧热座版本，保留为历史素材与布局证据；2026-07-10 后不得再把它解释为当前交互合同。
- 现行测试名称为“桌面端当前玩家使用可见 UI、其它座位用代表态完成四轮抢劫并显示摊牌结果”：当前玩家通过可见筹码和进度按钮操作，其它座位可用状态注入或测试命令补齐公开决策。
- 上述单客户端代表态只能证明桌面代码链路、素材接入和当前玩家可见控件流程可跑，不能证明多人自然操作、座位权限或多端同步；这些合同必须使用多个独立客户端。
- 现行口径的真相参考为 `docs/games/the-gang/user-stories/online-viewer-and-landscape-contract-2026-07-10.md`。
- 最新“给用户看图”已用 PureRef 打开；AI 复看只针对桌面中局满元素截图。
- 桌面教程链已追加独立 E2E：`node scripts/infra/run-e2e-single.mjs ci e2e/the-gang/the-gang-tutorial.e2e.ts "桌面教程覆盖读牌力、选筹码、公共牌推进和摊牌反馈"`，覆盖开场、读底牌、全员拿白筹码、公共牌推进、红筹码最终承诺、满元素待摊牌和摊牌结果反馈。
- 教程关键图已用 PureRef 打开给用户看：`教程满元素待摊牌.jpg` 与 `教程摊牌结果反馈.jpg`。这只关闭桌面教程截图交付，不关闭服务器素材主源发布、手机验收和最终完成口径。

## 已验证路径

| 验收点 | 结果 | 证据 |
| --- | --- | --- |
| 注册表可发现 `the-gang` | 通过 | generated manifests 均包含 The Gang |
| Board 可进入第一次可操作选筹码状态 | 通过 | `src/games/the-gang/__tests__/Board.runtime.test.tsx` 断言 `第 1 轮 · 白筹码` 与禁用的 `下一轮` |
| Board 可构造并展示四轮抢劫代表态 | 通过 | `e2e/the-gang/the-gang-runtime.e2e.ts` 由当前玩家使用可见 UI，其它座位用状态注入或测试命令补齐；不代表多人自然链路 |
| Board 可显示摊牌结果 | 通过 | 同一测试点击 `摊牌` 后断言 `摊牌结果`、`抢劫成功`、`成功 1`、`下一次抢劫` |
| 自动座位可跑到胜利结算 | 通过 | `src/games/the-gang/__tests__/auto-path.test.ts` 完成三次成功抢劫并进入 `game-over` |
| 桌面首轮可操作截图 | 通过 | `test-results/evidence-screenshots/the-gang/the-gang-runtime.e2e/桌面端可通过真实-UI-完成一次四轮抢劫并显示摊牌结果/桌面首轮可操作状态.jpg` |
| 桌面首轮全员筹码已选截图 | 通过 | `test-results/evidence-screenshots/the-gang/the-gang-runtime.e2e/桌面端可通过真实-UI-完成一次四轮抢劫并显示摊牌结果/桌面首轮全员筹码已选.jpg` |
| 桌面中局满元素截图 | 通过 | `test-results/evidence-screenshots/the-gang/the-gang-runtime.e2e/桌面端可通过真实-UI-完成一次四轮抢劫并显示摊牌结果/桌面中局满元素已拿新筹码待摊牌.jpg` |
| 桌面摊牌结果截图 | 通过 | `test-results/evidence-screenshots/the-gang/the-gang-runtime.e2e/桌面端可通过真实-UI-完成一次四轮抢劫并显示摊牌结果/桌面摊牌结果.jpg` |
| 桌面教程满元素待摊牌截图 | 通过 | `test-results/evidence-screenshots/the-gang/the-gang-tutorial.e2e/桌面教程覆盖读牌力、选筹码、公共牌推进和摊牌反馈/教程满元素待摊牌.jpg` |
| 桌面教程摊牌结果截图 | 通过 | `test-results/evidence-screenshots/the-gang/the-gang-tutorial.e2e/桌面教程覆盖读牌力、选筹码、公共牌推进和摊牌反馈/教程摊牌结果反馈.jpg` |

## 截图复看结论

| 截图 | 可见内容 | 结论 |
| --- | --- | --- |
| 桌面首轮可操作状态 | 页面标题“纸牌帮”，抢劫计数，`第 1 轮 · 白筹码`，5 张公共牌背面，玩家手牌与 1★/2★/3★筹码按钮 | 真实桌面入口已进入首轮可操作状态 |
| 桌面中局满元素已拿新筹码待摊牌 | 顶部三名玩家都有白/黄/橙历史筹码和红色当前筹码，中央有红筹码区和五张公共牌，底部本地玩家有历史筹码、当前红筹码和两张手牌，右下角有“摊牌”入口 | 满足“已经都拿过筹码、现在拿新筹码、中央有牌+筹码”的桌面过程态证据 |
| 桌面摊牌结果 | `第 4 轮 · 红筹码`，5 张公共牌正面，3 名玩家手牌与筹码，右侧“摊牌结果 / 抢劫失败” | 历史旧热座版本已到达四轮摊牌结算；当前版本只沿用其图面布局证据 |
| 教程满元素待摊牌 | 三名玩家均有历史筹码和当前红筹码，中央 5 张公共牌与红筹码区同屏，右下角“摊牌”可用 | 满足用户要求的“已经都拿过筹码、现在拿新筹码、中央有牌+筹码”的教程过程态证据 |
| 教程摊牌结果反馈 | 结果区展示抢劫成功/失败、玩家红筹码与牌型反馈，教程已进入摊牌解释步骤 | 桌面教程已跑到核心结果反馈，不再停在只会选筹码的局部链路 |

## 验证命令

- `npx vitest run src/games/the-gang --configLoader native`：2026-07-05 复验通过，8 files / 20 tests passed。
- 历史命令：`node scripts/infra/run-e2e-single.mjs ci e2e/the-gang/the-gang-runtime.e2e.ts "桌面端可通过真实 UI 完成一次四轮抢劫并显示摊牌结果"` 于 2026-07-05 14:02 通过，生成旧热座版本的桌面首轮、首轮全员筹码已选、中局满元素和摊牌结果截图。
- `npx vitest run src/games/the-gang/__tests__/tutorial.test.tsx --configLoader native`：2026-07-05 复验通过，3 tests passed。
- `node scripts/infra/run-e2e-single.mjs ci e2e/the-gang/the-gang-tutorial.e2e.ts "桌面教程覆盖读牌力、选筹码、公共牌推进和摊牌反馈"`：2026-07-05 复验通过，1 test passed，生成桌面教程截图链。
- `openspec validate add-the-gang-data-and-runtime-closeout --strict --no-interactive`：valid。
- `npm run typecheck`：通过。
