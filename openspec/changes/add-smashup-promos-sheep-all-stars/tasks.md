## 0. Approval

- [x] 0.1 用户审阅并明确批准本提案后再开始运行时代码、locale 或正式资源实施

## 1. Intake Contract

- [x] 1.1 逐卡锁定绵羊 12 个唯一卡面与全明星 20 个唯一卡面的中文名、牌面原文、力量、类型、数量和单卡裁图引用
- [x] 1.2 逐基地锁定牧场、绵羊神社、更衣室、体育场的 canonical 名称、中文原文、断点、VP 和 atlas 槽位
- [ ] 1.3 将每张卡和基地拆成 C1/C2/C3 规则子句与 effect atom（已建立对象级状态；尚未达到逐子句全面审计）
- [x] 1.4 建立共享机制复用表、全新机制清单、框架消费矩阵和冲突待裁定表
- [x] 1.5 对账当前已存在的牧场与绵羊神社实现，确认哪些结论可复用、哪些必须补证
- [x] 1.6 将 intake handoff 更新为 `locked/blocked/disputed`，满足 implementation 前置门禁

## 2. Runtime Assets

- [x] 2.1 将用户卡牌 atlas 接入正式 Smash Up 资源目录并生成压缩 WebP
- [x] 2.2 复用或唯一注册 Promo 基地 atlas，确认 `BASE4` 槽位 `8-11` 与用户图源一致
- [x] 2.3 注册 `6 x 6` 卡牌 atlas 元数据，并保证槽位 `32-35` 不进入 playable card registry
- [x] 2.4 重建游戏级与根级 manifest，并确认新键真实写入
- [ ] 2.5 上传本 change 正式资源并对代表运行时 URL 执行 `HEAD 200` 回查（blocked: 精确上传 `node scripts/assets/upload-to-r2.js --only official/i18n/zh-CN/smashup/cards/compressed/promos_sheep_all_stars.webp` R2 401；新卡图远端 HEAD 404，BASE4 HEAD 200）

## 3. Static Data And Locale

- [x] 3.1 注册 `SHEEP` 与 `ALL_STARS` 派系 ID、中文显示名和选择器 metadata
- [x] 3.2 新增绵羊和全明星独立 faction 数据文件，并在 `cards.ts` 增量注册
- [x] 3.3 复用牧场、绵羊神社，新增更衣室、体育场基地定义并接入全明星基地池
- [x] 3.4 补齐双语 locale、牌组选择可见性和关键图片预加载
- [x] 3.5 添加 atlas、注册、数量、i18n 和资源合同测试

## 4. Sheep Gameplay

- [x] 4.1 完成绵羊 12 个唯一卡面的静态定义和 20 张实体牌数量
- [x] 4.2 实现绵羊全部移动、跟随移动、持续力量修正、复制行动、抽牌和其它规则子句（代表性移动/抽牌/持续已实现；是不是要跟着显式 play/return 已补；木材换羊行动/随从展示分支已补；你好，多莉手牌反应与复制行动能力已补）
- [x] 4.3 对账并补证牧场与绵羊神社基地能力，不重写已正确的共享基地逻辑
- [ ] 4.4 补绵羊 L2 行为测试、真实入口 L3/L4 E2E 和 evidence（L2 与代表 L3 已过；对象级全面 L4 未完成）

## 5. All-Stars Gameplay

- [x] 5.1 完成全明星 20 个唯一卡面的静态定义和 20 张实体牌数量
- [ ] 5.2 逐张核对全明星致敬牌语义，裁定复用、包装复用或全新 handler（代表性 handler 已实现；基因工程生命体选择/洗回/打出已补；非无穷循环额外行动结算与回手已补；少尉可选 redirect 与负向不触发已补 L2）
- [x] 5.3 实现更衣室与体育场基地能力
- [ ] 5.4 补全明星 L2 行为测试、真实入口 L3/L4 E2E 和 evidence（L2 与代表 L3 已过；对象级全面 L4 未完成）

## 6. Audit And Closeout

- [ ] 6.1 为全部新增对象建立规则子句表、完整技能流程矩阵和 L0-L4 结论（已建立对象级状态与残余表；逐子句全面矩阵未完成）
- [ ] 6.2 为所有可选、至多、任意数量效果补合法候选存在时的跳过/空选测试
- [ ] 6.3 运行注册、interaction、targetType、ongoing、trigger、base 和 atlas 审计（定向注册/trigger/base/atlas 与 ACTION_PLAYED 构造审计已过；全局审计未跑）
- [x] 6.4 完成两派系真实选择、开局、代表复杂链路 E2E 和连续截图证据
- [ ] 6.5 运行定向 Vitest、typecheck、i18n、资源校验和 OpenSpec 严格校验（本轮 37 项定向 Vitest、typecheck、ACTION_PLAYED 审计、OpenSpec 通过；i18n 被无关并行派系缺口阻塞；R2 上传仍 401）
- [ ] 6.6 回写对象级 evidence 与批次汇总，仅在最终权威状态收口后勾完任务（代表性 evidence 已回写；最终全面收口未完成）
