# 山屋惊魂作祟 3「灰尘」狗交易 / 交换疾病分流 E2E 证据

## 本轮锁定

- 问题对象：灰尘剧本下，“交换疾病”和狗远距交易共用底部交易动作入口时的玩家可见分流。
- 真相来源：`docs/games/betrayal/haunts/03-the-dust.md` 的灰尘“控制冲动 / 交换疾病”合同、当前 23 张运行持有牌中“狗”的远距交易合同，以及当前工作区真实入口 Playwright 用例 `e2e/betrayal/the-dust-dog-trade-sickness-split.e2e.ts`。
- 目标入口 / 环境：`D:\gongzuo\webgame\BoardGame`，Playwright chromium，1600x900 真实牌桌页面 `/play/betrayal?players=3&seat0=human&seat1=human&seat2=human&seed=the-dust-dog-trade-sickness-split`，通过测试 helper 注入灰尘 + 狗交易 + 同房探索者代表态。
- 验收口径：初始同房探索者存在时底部入口默认“交换疾病”；选中狗交易牌和 4 格内非同房目标后，按钮切为“提出交易”；点击后生成狗交易待同意请求，不生成疾病交换等待态；同意后急救包转移给远距目标，狗记为已用，仍没有疾病交换残留。

## 执行命令

```powershell
npx eslint e2e\betrayal\the-dust-dog-trade-sickness-split.e2e.ts e2e\betrayal\betrayalTestHelpers.ts
node scripts\infra\run-e2e-single.mjs ci e2e\betrayal\the-dust-dog-trade-sickness-split.e2e.ts "灰尘态"
```

结果：

- ESLint：0 errors。
- E2E：`1 passed`，用例耗时约 11.6 秒，总运行约 20.8 秒。

## 截图与肉眼核验

| 顺序 | 截图 | 我实际看到什么 | 验收判断 |
| ---: | --- | --- | --- |
| 1 | `01-灰尘交易入口默认交换疾病.jpg` | 画面处于剧本 3「灰尘」作祟中；状态条显示疾病与“交换疾病 可用”；同房探索者 token 在入口大厅；狗交易候选区可见；底部按钮显示“交换疾病” | 通过：未选择狗交易目标时，疾病交换仍是默认主入口 |
| 2 | `02-选中狗交易持有物.jpg` | 急救包在狗交易候选区被选中；流程提示写明“用狗交易：急救包 -> 选 4 格内目标”；底部按钮未提前变成“提出交易” | 通过：只选物品不直接发交易，也不生成疾病交换等待态 |
| 3 | `03-狗交易目标选中后按钮变为提出交易.jpg` | 切到上层后，4 格内非同房队友 token 被选中；提示写明“用狗交易：你给出 急救包 / 不换回 -> 杰登·琼斯 提出交易”；底部按钮显示“提出交易” | 通过：狗交易目标选中后优先进入提出交易，不被交换疾病入口抢走 |
| 4 | `04-狗交易请求等待同意且未进入疾病交换.jpg` | 点击提出交易后进入接收方同意面板，当前状态是狗交易请求；没有疾病交换等待横幅 | 通过：发起的是狗交易待同意请求，不是疾病交换 |
| 5 | `05-狗交易同意后结算且未生成疾病交换.jpg` | 同意后当前玩家只剩狗和地图，远距队友获得急救包；狗卡显示已用；没有疾病交换横幅或待处理状态 | 通过：狗交易结算完成且没有疾病交换残留 |

## 自动断言覆盖

- 初始状态下，灰尘状态条、同房探索者 token、狗交易候选区和底部“交换疾病”同屏存在。
- 只选中狗交易持有物时，不生成交易请求，也不生成疾病交换等待态。
- 远距目标必须点击地图上的 4 格内队友 token 本体，并显示贴合 token 的五边形高亮。
- 选中远距目标后，底部按钮必须切为“提出交易”。
- 点击“提出交易”后，核心状态必须是狗交易 `pendingTradeAgreement`，且 `useDog=true`、目标为远距玩家、给出急救包；灰尘疾病交换等待态必须为空。
- 接收方同意后，急救包转移给远距玩家，狗记录为本回合已用；交易请求与疾病交换等待态都为空。

## 服务器相册

- 预览站任务：`http://8.148.71.102:18080/#/boardgame/betrayal-the-dust-dog-trade-sickness-split`
- 服务器健康检查：`ssh admin@8.148.71.102 "curl -fsS http://127.0.0.1:18080/health"` 返回 `{"status":"ok"}`。
- 服务器任务目录：`/home/admin/image-preview/data/projects/boardgame/tasks/betrayal-the-dust-dog-trade-sickness-split/latest`，包含 5 张截图和 `manifest.json`。
- 公开接口回查：`/api/tasks/boardgame/betrayal-the-dust-dog-trade-sickness-split` 返回 `imageCount=5`，标题为“山屋惊魂灰尘狗交易与交换疾病分流”。
- 公开详情页浏览器回查：真实页面加载 10 个图片节点，其中 5 张主图 + 5 张缩略图均为 `naturalWidth=1600`、`naturalHeight=900`，alt 文本与 5 个流程标题一致。

## 不外推边界

- 本证据只证明灰尘态下“交换疾病”和狗远距交易共用入口时的玩家可见分流代表链。
- 本证据不证明全部交易族、全部主动持有牌、全部搜尸 / 兔脚 / 掩埋 UI、完整灰尘终局矩阵或山屋完整规则完成。
- 普通狗远距交易完整链另见 `evidence/山屋惊魂-狗远距交易完整链路/e2e-test.md`；普通交易多选链另见 `evidence/betrayal-core-interactions/trade-multi-give/e2e-test.md`。
