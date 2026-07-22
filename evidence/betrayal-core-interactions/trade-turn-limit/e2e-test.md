# 山屋惊魂普通交易每回合一次 E2E 证据

## 范围

- 规则切片：普通同房间交易在接收方同意后结算，并把发起方本回合普通交易额度锁定；同一回合不能再提出第二笔普通交易；换到下一名玩家回合后交易额度恢复。
- 真实入口：`/play/betrayal?players=3&seat0=human&seat1=human&seat2=human` 真实牌桌入口，经项目 harness 注入首剧本普通交易代表态；选择持有物、选择地图队友、提出交易、接收方同意和结束回合都走正式牌桌命令链。
- 本次只证明“普通同房间交易每回合一次”这一 P0 交易限制切片；不能外推为狗远距交易、特殊行动额度、攻击后武器不可交易或完整山屋惊魂规则完成。

## 验证命令

- `npx eslint e2e/betrayal/first-scenario-trade-interaction.e2e.ts`
  - 结果：通过，0 errors。
- `npx vitest run src/games/betrayal/__tests__/firstScenarioRuntime.test.ts -t "普通交易|移动不会消耗" --configLoader native --pool threads --no-file-parallelism --maxWorkers 1`
  - 结果：通过，`3 passed / 163 skipped`。
- `$env:PW_USE_DEV_SERVERS='false'; $env:PW_ALLOW_DEV_SERVER_TESTS='false'; npm run test:e2e:ci:file -- e2e/betrayal/first-scenario-trade-interaction.e2e.ts "真实页面可选物品、选目标并确认交易"`
  - 结果：通过，`1 passed`。

## 截图

| 文件 | 绝对路径 | 画面结论 |
| --- | --- | --- |
| `01-交易前.jpg` | `D:\gongzuo\webgame\BoardGame\evidence\betrayal-core-interactions\trade-turn-limit\01-交易前.jpg` | 当前玩家杰登·琼斯在门厅，持有兔脚和书本，底部交易流程条处于可发起普通同房间交易状态。 |
| `02-交易完成本回合已交易.jpg` | `D:\gongzuo\webgame\BoardGame\evidence\betrayal-core-interactions\trade-turn-limit\02-交易完成本回合已交易.jpg` | 接收方同意后，兔脚已转到丽贝卡·艾伦博士持有区，当前玩家持有区只剩书本；底部“交易”按钮变灰，证明同回合第二笔普通交易入口被锁定。 |
| `03-下回合交易恢复.jpg` | `D:\gongzuo\webgame\BoardGame\evidence\betrayal-core-interactions\trade-turn-limit\03-下回合交易恢复.jpg` | 点击结束回合后切到丽贝卡·艾伦博士，新行动者持有兔脚，交易按钮恢复为可操作入口。 |

## 自动断言摘要

- 交易前：真实牌桌显示普通交易入口，状态为 `同房间可交易对象：1人`，持有区正式牌面 atlas 已加载。
- 移动后：普通移动不会写入 `tradeUsedThisTurnPlayerIds`，同房间目标仍可发起普通交易，证明“行动任意顺序”没有被交易额度误锁。
- 提出交易后：`pendingTradeAgreement.targetPlayerId = "1"`，`activePlayerId = "1"`，兔脚仍在发起方持有区，证明不能跳过接收方同意直接转移。
- 接收方同意后：兔脚从发起方持有区移除并进入目标玩家持有区，`pendingTradeAgreement = null`，活动日志记录同意交易。
- 同意结算后：`tradeUsedThisTurnPlayerIds` 包含发起方 `0`；`betrayal-trade-status` 的文本为 `本回合已交易`；流程条内不再出现 `data-trade-confirm-placement="flow-banner"` 的确认按钮；底部普通交易按钮为 disabled。
- 点击结束回合后：当前玩家切到 `1`，`tradeUsedThisTurnPlayerIds = []`，新行动者持有兔脚，状态回到 `同房间可交易对象：1人`，普通交易按钮重新 enabled。

## 图面核验

- 通过。三张截图都来自真实牌桌入口，没有加载页、错误遮罩、替代页面或规则说明长文案。
- 通过。第一张显示交易前持有物和同房间队友，第二张显示兔脚转移且交易按钮变灰，第三张显示换到下一名玩家后牌桌继续可操作。
- 备注。`本回合已交易` 文字位于桌面状态读模型并由 E2E DOM 断言覆盖；最终视觉截图主要用交易按钮禁用态和持有物转移结果作为可见证据。

## 服务器相册

- 链接：`http://8.148.71.102:18080/#/boardgame/betrayal-trade-turn-limit`
- 回查：服务器本机 `/health` 返回 `{"status":"ok"}`。
- 回查：远端 `latest/manifest.json` 包含 3 张图，文件均存在且非 0 字节。
- 回查：浏览器打开详情页后，接口 manifest 返回 3 张图；三张图片均可通过 `/artifacts/...` 加载，尺寸均为 `1600x900`。
- 回查：根路径 `http://8.148.71.102:18080/` 仍显示任务列表，不是单图页或强制跳转。

## 未覆盖范围

- 尚未把整条交易规则宣称完成：拒绝交易、空交易边界、任意数量交易的全量真实入口回归仍需后续单独收口。
- 尚未证明狗远距交易每来源一次、狗作为特殊行动的 per-source 额度、已使用持有物不能交易、攻击后武器不能交易。
- 尚未证明特殊行动额度、攻击声明、怪物系统和 50 个作祟逐条合同完成。
- 尚未证明完整山屋规则实现完成；本截图组只作为 P0 普通交易每回合一次切片的 E2E 证据。
