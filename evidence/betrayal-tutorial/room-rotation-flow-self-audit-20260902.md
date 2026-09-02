# 山屋惊魂教程房间旋转流程自审

- 对象：普通玩家主线里的探索新房间、旋转房间、确认放置和事件牌触发。
- 日期：2026-09-02。
- 文档类型：`audit`。
- 结论等级：`当前范围已收口`。

## 审计自检表

| 自检项 | 状态 | 证据 |
| --- | --- | --- |
| 对象范围 | `passed` | 仅覆盖普通玩家主线 `20-23` 的探索、翻房间、旋转、确认和事件牌入口 |
| 真相源状态 | `passed` | 主真相源为规则源第 6.1、12、13 节，合同状态 `locked` |
| 原子语义断言 | `passed` | 已拆成探索、翻出房间、旋转朝向、确认放置、符号触发发现牌五个原子语义 |
| 实现消费链 | `passed` | `tutorial.ts` 步骤、`Board.tsx` 房间放置 UI、`betrayal-tutorial.e2e.ts` 真实点击链对齐 |
| 最终权威结果 | `passed` | 最终权威状态：房间放置面板清空，发现牌可见，投掷事件入口出现，流程进入事件结算 |
| 交互真实入口 | `passed` | 真实页面点击探索入口、目标房间、旋转按钮和确认放置按钮 |
| 验证证据 | `passed` | 完整 E2E 当前运行 `10 passed, 2 skipped`，教程单测 `16 passed`，房间放置 UI 单测 `1 passed` |
| 共享影响与代表链依据 | `passed` | 共享影响限于同游戏教程标准和确认按钮视觉语法；本审计不外推其它房间分支 |
| 残余范围声明 | `passed` | 作祟后、叛徒私密目标、木乃伊怪物行动和其它发现牌分支均不在本文范围 |
| 旧 evidence / 旧结论对账回写 | `passed` | 本文只作为当前 21-23 房间旋转时序补充证据，旧 PASS 清单继续保留历史身份 |

## 审计范围

- 覆盖：主线截图 `20-23`、教程步骤 `explore-upper -> rotate-room-placement -> confirm-room-placement -> discovery-card-type`、房间放置 UI 和 E2E 动作账。
- 不覆盖：作祟后英雄目标、叛徒私密目标、木乃伊怪物行动和其它房间 / 事件分支。

## 权威来源

- 主真相源：[`山屋惊魂小黑屋第三版规则汉化整理.md`](../../src/games/betrayal/rule/山屋惊魂小黑屋第三版规则汉化整理.md) 第 6.1、12、13 节。
- 实现入口：[`tutorial.ts`](../../src/games/betrayal/tutorial.ts) 的 `basic-setup-and-turn` 步骤。
- UI 入口：[`Board.tsx`](../../src/games/betrayal/Board.tsx) 的房间放置面板、旋转按钮和确认按钮。
- 端到端入口：[`betrayal-tutorial.e2e.ts`](../../e2e/betrayal/betrayal-tutorial.e2e.ts) 的普通玩家主线。
- 截图账本：[`full-tutorial-flow-sequence.json`](full-tutorial-flow-sequence.json)。

## 原子语义与证据

| 规则原子 | 当前教程 / UI | 截图证据 | E2E 证据 | 结论 |
| --- | --- | --- | --- | --- |
| 选择未探索走廊并探索 | `explore-upper` 高亮正式探索入口和目标房间 | `20-山屋惊魂-教程-探索目标房间.jpg` | 真实点击探索入口和目标房间 | 通过 |
| 翻出匹配区域房间 | 点击目标房间后出现房间放置面板，显示房间牌面和事件符号 | `21-山屋惊魂-教程-翻出房间朝向选择.jpg` | 断言 `betrayal-room-placement-panel` 可见 | 通过 |
| 选择朝向 / 旋转房间 | `rotate-room-placement` 高亮右转按钮，玩家点击后朝向值改变 | `21-山屋惊魂-教程-翻出房间朝向选择.jpg`、`22-山屋惊魂-教程-旋转后确认放置新房间.jpg` | 断言 `data-room-orientation-turns` 点击前后变化 | 通过 |
| 确认放置 | `confirm-room-placement` 高亮复用确认按钮，只提交已选朝向 | `22-山屋惊魂-教程-旋转后确认放置新房间.jpg` | 真实点击 `betrayal-room-placement-confirm` | 通过 |
| 放置后结算文字 / 符号并抽对应牌 | 确认后进入 `discovery-card-type`，事件符号翻出事件牌，并保留物品 / 预兆映射说明 | `23-山屋惊魂-教程-事件牌公开与投掷入口.jpg` | 断言事件符号、事件牌、物品牌、预兆牌和投掷事件入口可见 | 通过 |

最终权威结果 / finalState：玩家确认放置后，房间放置面板不再是当前阻塞层，最新发现牌区域展示事件牌，正式投掷事件按钮可见且可点击，下一步进入事件骰流程。流程收口要求是无残留的房间放置选择态，不把事件牌提前显示在确认之前。

## 编号自审

- 主线原图没有在 `22 -> 23` 之间缺旋转 UI：`21` 是翻出房间并出现旋转 UI，`22` 是旋转后确认，`23` 是确认后触发事件牌。
- 标注图目录额外有 `00-sequence-index.png`，所以 `22-labeled-21`、`23-labeled-22`、`24-labeled-23` 的前缀比原图编号大 1；不能把标注前缀误当主线步骤号。
- 房间效果和触发卡牌可以在 `23` 同步教学，因为它们都是确认放置后的连续自动后果；旋转朝向不可以合并，因为它是确认前的玩家决策。

## 边界负向证据

- 事件牌不应在确认放置前出现；`21` 和 `22` 都仍停在房间放置面板，`23` 才出现事件牌和投掷事件入口。
- 旋转不是无效点击：E2E 在点击右转按钮前后断言 `data-room-orientation-turns` 不同。
- 房间放置确认不应替代旋转：截图 `21` 先展示旋转控件，截图 `22` 才高亮确认放置。
- 本轮不声明空选、跳过、重复旋转或无效区域分支已完成；这些属于其它房间放置边界，不阻塞当前规则时序链。

## 验证证据

| 命令 | 当前结果 | 证明了什么 | 没有证明什么 |
| --- | --- | --- | --- |
| `npm run spec:lint` | `spec-lint: OK` | 规范结构、索引和链接没有破坏 | 不证明游戏流程正确 |
| `node scripts/infra/vitest-cli-safe.mjs run src/games/betrayal/__tests__/tutorial.test.ts --config vitest.config.core.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1` | `16 passed` | 教程步骤顺序、文案、防复读和发现牌三类分类断言通过 | 不替代真实页面截图 |
| `node scripts/infra/vitest-cli-safe.mjs run src/games/betrayal/__tests__/Board.foundation.test.tsx --config vitest.config.core.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "探索放置面板会把玩家选择的新房间朝向交给正式探索命令"` | `1 passed, 189 skipped` | 房间放置 UI 会显示旋转锚点，玩家选择的新朝向会进入正式探索命令，确认按钮视觉复用同游戏确认按钮 | 不证明其它房间分支 |
| `node scripts/infra/run-e2e-command.mjs isolated e2e/betrayal/betrayal-tutorial.e2e.ts` | `10 passed, 2 skipped` | 当前真实页面教程链覆盖探索、旋转、确认、事件牌、书本、兔脚、伤害分配和专题分支 | 两个 skipped 是旧英雄攻击 / 杰克之灵专题，不属于本轮房间旋转主线 |
| `node --max-old-space-size=8192 .\node_modules\eslint\bin\eslint.js src\games\betrayal\Board.tsx src\games\betrayal\tutorial.ts src\games\betrayal\__tests__\tutorial.test.ts src\games\betrayal\__tests__\Board.foundation.test.tsx e2e\betrayal\betrayal-tutorial.e2e.ts` | `0 errors, 7 warnings` | 当前修改范围没有新增 lint error | 7 个 warning 是既有未用变量 / React ref / fast-refresh 告警，未在本轮收口 |

测试语义对账：`betrayal-tutorial.e2e.ts` 在同一真实页面链里先保存探索目标图，再点击目标房间，等待房间放置面板，保存旋转前图，点击旋转按钮并断言朝向改变，保存确认图，点击确认后才断言事件牌和投掷事件入口可见。旧测试失效检查：当前教程单测已把 `rotate-room-placement` 纳入主线步骤和 required action 序列，防止后续再从探索目标直接跳到事件牌。

## 残余范围与共享影响

- 残余范围：其它房间文字效果、非事件符号房间、作祟后目标、叛徒私密目标和怪物行动不由本文证明。
- 共享影响：通用规范只新增规则时序和中间决策 UI 的判断方法；小黑屋专项答案仍落在本文件、覆盖矩阵和教程源码里。
- 代表链判等依据：本审计不借用其它分支，也不把其它截图分支外推为当前主线；判定依据来自当前普通玩家主线的真实入口、真实控件点击和 `20 -> 21 -> 22 -> 23` 原图。
- 当前边界：本文只证明普通玩家主线中这条房间旋转流程没有跳步，不外推为全规则书教程完成。

## 修订或失效记录

- 旧 evidence：`pass-manifest-20260902-room-rotation-flow.json` 保留为历史图组清单；当前自审展示清单改为 `pass-manifest-20260902-room-rotation-self-audit.json`。
- 旧结论：若只看标注图前缀，可能误把 `22-labeled-21 -> 23-labeled-22` 当成主线 `22 -> 23`。
- 修订：覆盖矩阵已写清主线原图编号与 PureRef 标注前缀的差异，并登记规则源第 6.1、12、13 节。
- 当前状态：新标注图组 `_labeled-for-pureref-20260902-room-rotation-self-audit/` 已生成 58 张图，并通过 `open-verified-image.mjs --dry-run` 清单校验；解释口径为“主线原图 21 是旋转 UI，22 是旋转后确认，23 才是事件牌”。

## 允许口径

- 可以说：普通玩家主线的房间探索流程已按规则时序覆盖 `探索 -> 翻出房间 -> 旋转朝向 -> 确认放置 -> 房间符号触发事件牌`。
- 不可以说：整个山屋惊魂规则书教程全部完成；其它房间 / 作祟 / 怪物分支都已自然端到端覆盖。
