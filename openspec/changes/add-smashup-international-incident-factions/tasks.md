## 0. Approval

- [x] 0.1 用户已于 2026-07-13 明确批准本提案，允许开始运行时代码实施

## 1. Intake Contract

- [ ] 1.1 逐卡锁定 51 个唯一卡面的中文名、牌面原文、力量、类型、数量和单卡裁图引用
- [ ] 1.2 逐基地锁定 8 张基地的 canonical 名称、中文原文、断点、VP 和 atlas 槽位
- [x] 1.3 将每张卡和基地拆成 C1/C2/C3 规则子句与 effect atom
- [x] 1.4 建立共享机制复用表、全新机制清单、框架消费矩阵和冲突待裁定表
- [ ] 1.5 裁定摔角手/摔跤手显示名、英文正文来源和其它图面/TTS/英文资料冲突
- [ ] 1.6 将 intake handoff 更新为 `locked/blocked/disputed`，满足 implementation 前置门禁

## 2. Runtime Assets

- [x] 2.1 将用户卡牌 atlas 接入正式 Smash Up 资源目录并生成压缩 WebP
- [x] 2.2 将 TTS 基地 atlas 接入正式 Smash Up 资源目录并生成压缩 WebP
- [x] 2.3 注册 `8 x 7` 卡牌 atlas 和 `4 x 4` 基地 atlas 元数据
- [x] 2.4 重建游戏级与根级 manifest，并确认新键真实写入
- [ ] 2.5 上传本 change 正式资源并对代表运行时 URL 执行 `HEAD 200` 回查

## 3. Static Data And Locale

- [x] 3.1 注册 `SUMO_WRESTLERS`、`MUSKETEERS`、`MOUNTIES`、`LUCHADORS`
- [x] 3.2 新增四个派系静态数据并在 `cards.ts` 增量注册
- [x] 3.3 新增 8 张基地定义并接入基地池
- [x] 3.4 补齐 faction metadata、双语 locale、派系选择可见性和关键图片预加载
- [x] 3.5 添加 atlas、注册、数量、i18n 和资源合同测试

## 4. Sumo Wrestlers

- [x] 4.1 完成相扑手 12 个唯一卡面的静态定义和 20 张实体牌数量
- [x] 4.2 实现相扑手全部移动、力量标记、选择基地、行动链和其它规则子句
- [x] 4.3 实现 Heya Training Stable 与 The Dohyo 基地能力
- [ ] 4.4 补相扑手 L2 行为测试、真实入口 L3/L4 E2E 和 evidence

## 5. Musketeers

- [x] 5.1 完成火枪手 14 个唯一卡面的静态定义和 20 张实体牌数量
- [x] 5.2 实现火枪手全部额外行动、连续行动、让路/护卫和其它规则子句
- [x] 5.3 实现 Bastion Saint-Gervais 与 The Golden Lily 基地能力
- [ ] 5.4 补火枪手 L2 行为测试、真实入口 L3/L4 E2E 和 evidence

## 6. Mounties

- [x] 6.1 完成骑警 12 个唯一卡面的静态定义和 20 张实体牌数量
- [x] 6.2 实现骑警全部移动、搜寻、基地条件力量修正和其它规则子句
- [x] 6.3 实现 Strategic Syrup Reserve 与 Great White North, Eh? 基地能力
- [ ] 6.4 补骑警 L2 行为测试、真实入口 L3/L4 E2E 和 evidence

## 7. Luchadors

- [x] 7.1 完成摔角手 13 个唯一卡面的静态定义和 20 张实体牌数量
- [x] 7.2 实现摔角手全部 Set-Up 附着、Pin、Reversal、团队标记和其它规则子句
- [x] 7.3 实现 Ringside 与 The Squared Circle 基地能力
- [ ] 7.4 补摔角手 L2 行为测试、真实入口 L3/L4 E2E 和 evidence

## 8. Audit And Closeout

- [x] 8.1 为全部 59 个新增对象建立规则子句表、完整技能流程矩阵和 L0-L4 结论
- [x] 8.2 为所有可选、至多、任意数量效果补合法候选存在时的跳过/空选测试
- [x] 8.3 运行注册、interaction、targetType、ongoing、trigger、base 和 atlas 审计
- [x] 8.4 完成四派系真实选择、开局、代表复杂链路 E2E 和连续截图证据
- [x] 8.5 运行定向 Vitest、typecheck、i18n、资源校验和 OpenSpec 严格校验
- [ ] 8.6 回写对象级 evidence 与批次汇总，仅在最终权威状态收口后勾完任务
