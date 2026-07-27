# 山屋惊魂作祟 3「灰尘」研究、属性选择与治愈成功代表链

## 规则真相源

- 官方英雄书 `docs/games/betrayal/sources/official/betrayal-3e-secrets-of-survival-en.md` 的作祟 3 源段：英雄在预兆房间可寻找治愈线索，成功放置研究标记；治愈灰尘时可用任意属性检定，并按已放研究标记获得加值，达到门槛后英雄胜利。
- 官方英雄书同一源段 p9 的 If You Win：英文官方原文已按 OCR 明显空格错误修正后接入；中文为正式翻译稿，用于结局朗读幕，不能外推为全部作祟 If You Win 均已接入。
- 项目子账本：`docs/games/betrayal/haunts/03-the-dust.md`。
- 本轮只证明代表链：寻找解药成功、研究计数生效、房间板块研究标记贴合显示、寻找解药知识 / 神志两种合法属性均可选择并成功放置研究标记、治愈灰尘四属性均可真实选中、三处研究标记提供 +6 加值、速度代表链进入英雄胜利终局，并证明灰尘英雄 / 叛徒 If You Win 文本合同已接入；不证明作祟 3 全量完成。

## 自动化验证

- ESLint：`npx eslint e2e\betrayal\betrayalTestHelpers.ts e2e\betrayal\the-dust-research-and-cure-success.e2e.ts`，0 errors。
- ESLint：`npx eslint src\games\betrayal\Board.tsx`，0 errors。
- ESLint：`npx eslint src\games\betrayal\game.ts`，0 errors / 5 existing warnings。
- ESLint：`npx eslint src\games\betrayal\__tests__\firstScenarioRuntime.test.ts src\games\betrayal\__tests__\Board.foundation.test.tsx e2e\betrayal\the-dust-research-and-cure-success.e2e.ts`，0 errors。
- 领域测试：`npx vitest run src\games\betrayal\__tests__\firstScenarioRuntime.test.ts --testNamePattern "灰尘.*终局读模型"`，2 passed / 294 skipped。
- 组件测试：`npx vitest run src\games\betrayal\__tests__\Board.foundation.test.tsx --testNamePattern "灰尘终局朗读"`，1 passed / 101 skipped。
- 领域测试：`npx vitest run src\games\betrayal\__tests__\firstScenarioRuntime.test.ts --testNamePattern "灰尘剧本治愈灰尘可选择任意属性"`，1 passed / 294 skipped。
- 真实入口 E2E：`node scripts\infra\run-e2e-single.mjs ci e2e\betrayal\the-dust-research-and-cure-success.e2e.ts "治愈灰尘可手动选择属性"`，1 passed。
- 既有研究 / 治愈代表链仍保留：`node scripts\infra\run-e2e-single.mjs ci e2e\betrayal\the-dust-research-and-cure-success.e2e.ts "寻找解药成功"`，1 passed。
- 真实入口 E2E：`node scripts\infra\run-e2e-single.mjs ci e2e\betrayal\the-dust-research-and-cure-success.e2e.ts "全部合法属性"`，1 passed。

## 截图证据

- 服务器相册：`http://8.148.71.102:18080/#/boardgame/betrayal-the-dust-research-and-cure-success`。
- 发布回查：服务器健康检查返回 `{"status":"ok"}`；公网任务 API 返回 12 张图；12 张公开图片 HEAD 均返回 200。

| 截图 | 观察结论 | 覆盖点 |
| --- | --- | --- |
| `evidence/betrayal-the-dust-research-and-cure-success/01-寻找解药成功前.jpg` | 牌桌已进入剧本 3「灰尘」；顶部进度条显示研究 0 处、疾病标记 3 枚、本人疾病 `4 / 5 / 6`，底部主动作是“寻找解药”。 | 证明玩家从真实牌桌按钮进入研究行动，且不是直接注入结算结果。 |
| `evidence/betrayal-the-dust-research-and-cure-success/02-研究标记放置后.jpg` | 寻找解药成功后，顶部进度条从研究 0 处变为研究 1 处；画廊房间右下角出现“研”研究标记；底部主动作从“寻找解药”切成“治愈灰尘”。 | 证明研究标记已进入运行态、贴到对应房间板块，并影响下一步可用行动。 |
| `evidence/betrayal-the-dust-research-and-cure-success/03-治愈灰尘成功终局.jpg` | 终局先进入独立结局朗读幕；顶部显示“官方 If You Win 原文 / 正式翻译”，正文为灰尘英雄胜利 If You Win 翻译稿，并提供“查看结果报告”承接按钮。画面没有旧的“非原文摘要 / 临时整理”。 | 证明一处研究标记触发英雄胜利后，玩家先看到灰尘英雄 If You Win 正式朗读幕，而不是摘要或直接跳结果报告。 |
| `evidence/betrayal-the-dust-research-and-cure-success/04-多研究标记治愈属性选择.jpg` | 顶部进度条显示研究 3 处；画廊、门厅、大阶梯三处房间板块右下角均显示“研”研究标记；治愈灰尘属性轨道里速度被玩家选中，力量只是可选项未被强制消费。 | 证明治愈灰尘不是系统自动选最高属性，且三处研究标记在地图和进度条上都有真实可见承接。 |
| `evidence/betrayal-the-dust-research-and-cure-success/05-速度治愈灰尘成功终局.jpg` | 速度治愈成功后停在独立结局朗读幕；顶部显示“官方 If You Win 原文 / 正式翻译”，正文为灰尘英雄胜利 If You Win 翻译稿，并提供“查看结果报告”承接按钮。 | 证明手动选择速度 + 三研究标记 +6 的代表链真实进入灰尘英雄 If You Win 朗读幕。 |
| `evidence/betrayal-the-dust-research-and-cure-success/06-速度治愈灰尘结果报告.jpg` | 点击“查看结果报告”后进入正式结果报告页，画面显示剧本“灰尘”、结果“胜利 / 幸存者逃脱”，幸存者与叛徒分栏正常。 | 证明朗读幕不是死路，玩家可继续进入结果报告。 |
| `evidence/betrayal-the-dust-research-and-cure-success/07-寻找解药知识选择成功.jpg` | 寻找解药结算画面显示“知识检定”“放置研究标记”和总点数 12；画廊房间板块右下角出现“研”。 | 证明寻找解药的知识分支能从真实牌桌选择并成功放置研究标记。 |
| `evidence/betrayal-the-dust-research-and-cure-success/08-寻找解药神志选择成功.jpg` | 寻找解药结算画面显示“神志检定”“放置研究标记”和总点数 13；画廊房间板块右下角出现“研”。 | 证明寻找解药的神志分支能从真实牌桌选择并成功放置研究标记。 |
| `evidence/betrayal-the-dust-research-and-cure-success/09-治愈灰尘力量选择.jpg` | 牌桌停在“治愈灰尘”动作；属性轨道四个按钮并列，力量按钮被选中；顶部进度条显示研究 3 处。 | 证明治愈灰尘可真实选中力量，不是只能使用默认最高或速度代表链。 |
| `evidence/betrayal-the-dust-research-and-cure-success/10-治愈灰尘速度选择.jpg` | 牌桌停在“治愈灰尘”动作；属性轨道四个按钮并列，速度按钮被选中；三处研究标记仍在地图上可见。 | 证明治愈灰尘可真实选中速度，并保留原速度成功代表链前置状态。 |
| `evidence/betrayal-the-dust-research-and-cure-success/11-治愈灰尘知识选择.jpg` | 牌桌停在“治愈灰尘”动作；属性轨道四个按钮并列，知识按钮被选中；顶部仍显示研究 3 处。 | 证明治愈灰尘可真实选中知识。 |
| `evidence/betrayal-the-dust-research-and-cure-success/12-治愈灰尘神志选择.jpg` | 牌桌停在“治愈灰尘”动作；属性轨道四个按钮并列，神志按钮被选中；画廊、门厅、大阶梯三处“研”标记可见。 | 证明治愈灰尘可真实选中神志，四属性选择 UI 全排列截图已补齐。 |

## 未覆盖边界

- 本相册只证明研究 / 治愈成功真实入口、寻找解药知识 / 神志两种合法属性成功、玩家手动选择治愈四属性、速度代表链、三处研究标记 +6 加值，以及灰尘英雄 If You Win 朗读幕和结果报告承接。
- 本相册只证明治愈灰尘四属性 UI 真实可选；除速度外，不逐一证明四属性都结算到英雄胜利。
- 仍缺其它死亡保护组合、其它伤害来源和死亡叛徒怪物化路径全排列回归。
