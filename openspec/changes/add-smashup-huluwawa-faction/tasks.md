## 1. Contract / Intake

- [x] 1.1 固化 `葫芦娃` 的中文规则、卡图 atlas、基地 atlas 与泰坦单图合同
- [x] 1.2 落地 `huluwawa` 的专用 atlas id、运行时资源路径与 manifest 计划
- [x] 1.3 明确中文可见 / 英文隐藏的 locale 接入边界

## 2. Runtime Wiring

- [x] 2.1 新增 `huluwawa` faction id、display name、faction metadata 与 atlas 注册
- [x] 2.2 新增 `huluwawa` 的 18 张卡牌、2 张基地和 1 张泰坦静态定义
- [x] 2.3 将资源接入关键图片预加载与官方卡牌预览链路

## 3. Gameplay

- [x] 3.1 完成可直接复用 helper / trigger / restriction 的一批能力
- [x] 3.2 完成需要 replacement / protection / attached-action 扩展的一批能力
- [x] 3.3 完成 `二娃`、`一根藤上七朵花` 与 `葫芦小金刚` 这批高交互能力
  - 已完成 `二娃`、`一根藤上七朵花`、`葫芦小金刚` 的 special summon、titan clash 改移动、以及“己方仆从发动 talent 后触发询问并复制另一个 minion talent”的真实入口。
  - `葫芦小金刚` 首版复制范围明确限定为当前引擎已有的 minion talent 主动入口；未来若新增其他仆从手动入口（例如随从持续主动能力），应追加同合同 C1/C2/C3。

## 4. Verification / Closeout

- [x] 4.1 补齐相关 Vitest：cards / faction selection / critical image / huluwawa rules / titan / bases
- [x] 4.2 运行 3 条真实入口 E2E 并人工看图验收
- [x] 4.3 生成 evidence 文档，记录资源合同、测试结果、截图路径与剩余风险
- [x] 4.4 运行图片压缩、更新资产 manifest，并完成必要的资源可用性抽查
  - 已完成葫芦娃 3 个压缩 WebP 精确发布、远端 ETag 校验和官方资源域名 HEAD 200 回查；未上传 unrelated `pretty_pretty.webp` 本地差异。
- [x] 4.5 运行 `openspec validate add-smashup-huluwawa-faction --strict --no-interactive`
