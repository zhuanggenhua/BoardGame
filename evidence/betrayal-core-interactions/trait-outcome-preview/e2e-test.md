# 山屋惊魂属性后果预览 E2E 证据

## 范围

- 规则切片：伤害 / 治疗必须按属性轨位置表达后果；伤害按步扣减，治疗回绿色起点。
- 真实入口：`/play/betrayal` 真实牌桌入口，经项目 harness 注入代表态。
- 本次只证明“伤害分配属性轨预览”和“急救包治疗目标属性轨预览”这两条新增玩家可见交互；不能外推为山屋惊魂全部 P0 规则完成。

## 验证命令

- `npx eslint e2e/betrayal/trait-outcome-preview.e2e.ts`
  - 结果：通过，0 errors。
- `npx vitest run src/games/betrayal/__tests__/Board.foundation.test.tsx --configLoader native --pool threads --no-file-parallelism --maxWorkers 1`
  - 结果：通过，`74 passed`。
  - 备注：测试结束后仍有 happy-dom 尝试连接 `localhost:3000` 的既有 `ECONNREFUSED` / `AbortError` 噪音，但 Vitest 结果为通过。
- `$env:PW_USE_DEV_SERVERS='false'; $env:PW_ALLOW_DEV_SERVER_TESTS='false'; npm run test:e2e:ci:file -- e2e/betrayal/trait-outcome-preview.e2e.ts`
  - 结果：通过，`2 passed`。

## 截图

| 文件 | 画面结论 |
| --- | --- |
| `01-伤害分配属性轨预览.jpg` | 事件选择面板显示“伤害”，力量被选择为 `×2`；四条属性轨预览同屏可见，力量预览显示两步扣减后果，确认按钮可用。 |
| `02-治疗目标属性轨预览.jpg` | 当前持有区选中急救包；同房间队友被高亮为治疗目标；右上方治疗预览展示力量 / 速度回绿色，知识 / 神志不变。 |

## 图面核验

- 通过。伤害截图能直接看出同一属性可承接多点伤害，不再是“一条属性只能选一次”的集合选择。
- 通过。治疗截图能直接看出急救包是“回绿色起点”，不是加固定数值或回满最高值。

## 服务器相册

- 链接：`http://8.148.71.102:18080/#/boardgame/betrayal-trait-outcome-preview`
- 回查：服务器本机 `/health` 返回 `{"status":"ok"}`。
- 回查：远端 `latest/manifest.json` 包含 2 张图，文件均存在且非 0 字节。
- 回查：浏览器打开详情页后，第 1 张“伤害分配属性轨预览”和第 2 张“治疗目标属性轨预览”均完成加载，尺寸均为 `1600x900`。
- 回查：根路径 `http://8.148.71.102:18080/` 仍显示任务列表，不是单图页或强制跳转。

## 未覆盖范围

- 尚未证明房间朝向选择、移动力快照、交易 / 特殊行动 / 攻击限制、怪物系统和 50 个作祟逐条合同完成。
- 尚未证明完整山屋规则实现完成；本截图组只作为 P0 属性后果预览切片的 E2E 证据。
