# 线上反馈收口 2026-09-19

## 本轮口径

- 口径：线上真实反馈。
- 最新读取时间：2026-09-19 22:35:08（Asia/Shanghai）。
- 真实读取入口：`https://api.easyboardgame.top/admin-api/feedback`。
- 本轮抓到：`open=0`、`in_progress=4`，归并为 4 个代表项。
- 真实回写入口：项目 feedback-closeout 正式脚本；无可复用 Bearer token 时由脚本切换到已确认的生产 Mongo SSH 写入口。
- 本地镜像：`temp/feedback-closeout/status-board.json`。
- 本轮不执行生产部署。

## 反馈内容 / 现实症状

### 1. 踢拳兄弟牌下行动没有被发动

```text
这张牌发动天赋以后，并没有发动埋在下面的牌。
```

- 游戏：大杀四方。
- 规则原文：踢拳兄弟“天赋：将储存在此牌下方的 1 张行动作为额外行动打出。”
- 原始现场：玩家发动天赋后只增加了普通行动额度，没有进入牌下行动的实际打出流程。
- 结论：真实规则 bug，已修复。
- 修复：把旧的“增加普通行动额度”路径改为先选择牌下行动，再进入立即额外行动和目标基地选择；牌从暂存区进入弃牌堆。
- 验证：2026-09-19 当前工作树执行 `node scripts/infra/run-e2e-single.mjs ci e2e/smashup/smashup-feedback-closeout-20260918.e2e.ts "踢拳兄弟天赋后能真实打出牌下行动，并从暂存区进入弃牌堆"`，结果 `1 passed`；同时保留 `src/games/smashup/__tests__/abilities/excellent-movies-teens.test.ts` 的领域回归。
- 建议终态：`resolved`。
- 漏审复盘：旧测试只看到了行动额度变化，没有把“选择牌下行动 -> 选择目标 -> 最终进入弃牌堆”作为完整公开行为合同；本轮已补到领域测试和真实入口 E2E。现有反馈收口规范已覆盖“回到原始位点补真实入口和最终状态”，不新增通用规范。

### 2. 冰雪奇缘效果整体与牌面不一致

```text
冰雪奇缘的效果全是错的
```

- 游戏：大杀四方。
- 当前真相源：冰雪奇缘中文卡图与基地图；本轮对象范围是 15 张牌和 2 个基地。
- 当前证据：`evidence/smashup/2026-09-19-frozen-reaudit.md` 已逐对象对账。它确认旧的“17 个对象全部 passed”结论失效，当前实现、中文/英文录入、旧测试和真实入口仍有系统性错配。
- 已确认的代表性错配：
  - “你想和我堆个雪人吗”牌面要求从弃牌堆额外打出棉花糖、雪宝或迷你雪人；当前实现却从牌库/弃牌堆回收至多两张迷你雪人。
  - “放手吧”牌面要求查看牌库顶三张并选择一张抽取、处理其余牌；当前实现却让玩家选择己方角色回手并增加额外行动。
  - “迷你雪人”、艾莎、汉斯、冻结的港口、锁上大门、冰宫、阿伦黛尔等对象也存在同类语义反转或缺失。
- 结论：真实 bug，且不是单张牌的局部问题；当前范围需要按牌图重录合同、重写实现、重写旧测试并补真实牌桌 E2E。
- 当前状态：`in_progress`。不是因为没查到，而是已经确认真实错误，不能用上轮局部测试通过或当前生产日志不再出现旧路径来关闭。
- 漏审复盘：旧 evidence 把局部测试和旧录入结果外推为整派系正确；旧测试沿着错误旧语义验证，所以没有挡住“牌面真相 -> 录入 -> 实现”整链错配。当前已新增全量 Frozen 复审 evidence；在实现和真实入口完成前不回写终态。

### 3. “慢慢走开”没有把好市民回手

```text
使用战术慢慢走开，并没有把好市民回手
```

- 游戏：大杀四方。
- 规则原文：`Walk Away... Slowly - Special: Play after a base scores. Return one of your minions there to its owner's hand.`
- 当前运行文案：`慢慢走开：选择一个己方随从返回手牌`。
- 真实入口尝试：先通过正式结束回合进入计分响应窗口，再打出“慢慢走开”，选择“好市民”。
- 结果：好市民回到拥有者手牌，计分基地清空；没有复现玩家描述的“没有回手”。
- 验证：2026-09-19 当前工作树执行 `node scripts/infra/run-e2e-single.mjs ci e2e/smashup/smashup-feedback-closeout-20260918.e2e.ts "慢慢走开在真实计分后响应窗口把好市民回到拥有者手牌"`，结果 `1 passed`。
- 结论：本次按真实路径未复现，不等于已证明历史问题被修复；按收口规范关闭为 `closed`。

### 4. 首页自动反馈“请求超时”

```text
[auto][unhandledrejection] 请求超时。
```

- 场景：`/?homeStyle=classic` 首页。
- 真实入口尝试：生产首页连续加载 3 次。
- 结果：每次都加载出 11 个游戏；`lastError=null`；没有 `pageerror`、console error 或 requestfailed。部分资源、`/auth/refresh`、`/admin-api/stats` 响应约 3–5 秒，但均返回 200。
- 额外核对：当前生产 bundle 和当前源码都没有固定裸文案“请求超时。”；反馈没有请求 URL、堆栈、操作日志或状态快照，所以无法反推历史现场的具体请求。
- 结论：本次真实入口未复现，不等于根因已定位或已证明修复；关闭为 `closed`，不凭空增加超时阈值、吞异常或兜底成功。

## 规范回代

- 已更新 `.spec/skills/feedback-closeout/SKILL.md`：人类反馈进入终态前必须从最近真实入口按玩家步骤尝试；真实入口按原步骤未复现时，允许写清“本次未复现，不等于已修复”后关闭，不再把未复现项无限期停在 `in_progress`。
- 本轮 Frozen 复审同时回写了“旧全面通过结论失效”的 evidence，避免旧局部测试继续冒充整派系正确。

## 回写结果

- 已回写：踢拳兄弟 `6aad4fb7935d564b96712522` -> `resolved`，写入 `resolvedMethod`。
- 已回写：慢慢走开 `6aad5269935d564b9671254b` -> `closed`，写入 `closedReason`。
- 已回写：首页自动反馈 `6aad2432935d564b967123c3` -> `closed`，写入 `closedReason`。
- 保留：冰雪奇缘 `6aac10778e41d08302191228` -> `in_progress`，直到 Frozen 重录、实现、测试和真实入口 E2E 完成。
- 生产 Mongo 精确 ID 回查：上述三条终态字段已写入；Frozen 仍为 `in_progress`。
- 生产运行产物核对：`boardgame-game-server` revision `520db7e056941056c767c245b0bc119e9b1acc52` 中存在踢拳兄弟真实 handler 与 `storedCards` 消费路径。
- 本地镜像已重新同步 `lastFetchedStatus`，并通过 `node scripts/verify/verify-feedback-status.mjs temp/feedback-closeout/status-board.json`。
