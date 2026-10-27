# 七大恨教程实现映射

> 本文件只定位实现 owner；行动链、教学选择与来源以 [教程覆盖矩阵](qidahen-tutorial-coverage-matrix.md) 为准，避免重复维护第二套流程。

## 玩家入口

`basic-opening` 是唯一面向玩家的入门教程。它使用正式开局和同一对局的连续状态，不要求玩家在教学章节、行动顺序或互斥轮盘走法间选择。本课的固定示范路线为：大明轮盘走 2 格、指定后金补牌、军屯辽东、突袭叶赫部、支付银两、打出鸳鸯阵、结算野战并占领；结束提示后保留当前对局，由下一玩家正常行动。

固定路线只约束本课；正式规则允许其它行动顺序、轮盘走法和合法目标。征兵训练没有落在这次真实走法上，因此不在本课虚构落点。

## 实现 owner

| 对象 | 真实来源与职责 |
|---|---|
| 规则 | `gameasset/七大恨 中文mod/七大恨规则.pdf` Ver 1.3；仓内简体 Markdown 仅供检索 |
| 自然开局 | `src/games/qidahen/tutorialSetup.ts`；保持正式局面、合法牌序和随机结果 |
| 教程清单 | `src/games/qidahen/tutorial.ts`；步骤、真实命令、目标和推进事件 |
| 地图与行动 UI | `src/games/qidahen/Board.tsx` 及其正式交互组件；教程焦点不代替真实地图输入 |
| 玩家文字 | `public/locales/zh-CN/game-qidahen.json` 与 `public/locales/en/game-qidahen.json` |
| 规则与身份验证 | `src/games/qidahen/__tests__/tutorialNaturalOpening.test.ts`、`tutorialFlow.test.ts` 及对应战斗/卡源测试 |
| 真实输入与视觉证据 | `e2e/qidahen/qidahen-closeout.e2e.ts`；逐步输入断言与关键状态截图分开 |

## 非玩家场景

其它代表态只在 `__E2E_TEST_MODE__` 下注册，用于征兵训练、其它轮盘落点、战斗例外与年度规则等专项回归。它们不自动串联为玩家章节，也不能证明 `basic-opening` 已教过对应机制。专项状态和未覆盖边界以覆盖矩阵及各自测试为准。

验收以本轮真实入口、真实输入、当前图面审查和查看器证据为准；历史截图或旧 PASS 清单不继承。
