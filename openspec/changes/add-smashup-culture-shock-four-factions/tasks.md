## 0. Approval

- [x] 0.1 用户审阅并明确批准本提案后再开始运行时代码实施

## 1. Intake Contract

- [ ] 1.1 逐卡锁定 59 个唯一卡面的中文名、牌面原文、力量、类型、数量和单卡裁图引用
- [ ] 1.2 逐基地锁定 8 张基地的 canonical 名称、中文原文、断点、VP 和 atlas 槽位
- [ ] 1.3 将每张卡和基地拆成 C1/C2/C3 规则子句与 effect atom
- [ ] 1.4 建立共享机制复用表、全新机制清单、框架消费矩阵和冲突待裁定表
- [ ] 1.5 裁定 `Cuzcu` / `Cuzco` 命名差异及其它图面、TTS、英文资料冲突
- [ ] 1.6 将 intake handoff 更新为 `locked/blocked/disputed`，满足 implementation 前置门禁

## 2. Runtime Assets

- [x] 2.1 将用户卡牌 atlas 接入正式 Smash Up 资源目录并生成压缩 WebP
- [x] 2.2 复用或唯一注册《文化冲击》共享基地 atlas，不覆盖波利尼西亚人批次
- [x] 2.3 注册 `10 x 6` 卡牌 atlas 和 `4 x 3` 基地 atlas 元数据
- [x] 2.4 重建游戏级与根级 manifest，并确认新键真实写入
- [ ] 2.5 上传本 change 正式资源并对代表运行时 URL 执行 `HEAD 200` 回查

## 3. Static Data And Locale

- [x] 3.1 注册 `ANANSI_TALES`、`GRIMMS_FAIRY_TALES`、`RUSSIAN_FAIRY_TALES`、`ANCIENT_INCAS`
- [x] 3.2 新增四个独立 faction 数据文件并在 `cards.ts` 增量注册
- [x] 3.3 新增 8 张基地定义并接入基地池
- [x] 3.4 补齐 faction metadata、双语 locale、牌组选择可见性和关键图片预加载
- [x] 3.5 添加 atlas、注册、数量、i18n 和资源合同测试

## 4. Anansi Tales

- [x] 4.1 完成阿南西传说 13 个唯一卡面的静态定义和 20 张实体牌数量
- [ ] 4.2 实现阿南西传说全部手牌转移、给予/接收、抽牌和其它规则子句
- [ ] 4.3 实现故事讲述者小屋与阿南西之网基地能力
- [ ] 4.4 补阿南西传说 L2 行为测试、真实入口 L3/L4 E2E 和 evidence

## 5. Grimms' Fairy Tales

- [x] 5.1 完成格林童话 18 个唯一卡面的静态定义和 20 张实体牌数量
- [ ] 5.2 实现格林童话全部配对、名称关联、额外打出和其它规则子句
- [ ] 5.3 实现姜饼屋与林中小屋基地能力
- [ ] 5.4 补格林童话 L2 行为测试、真实入口 L3/L4 E2E 和 evidence

## 6. Russian Fairy Tales

- [x] 6.1 完成俄罗斯童话 16 个唯一卡面的静态定义和 20 张实体牌数量
- [ ] 6.2 实现俄罗斯童话全部变形、牌库检索、力量比较和其它规则子句
- [ ] 6.3 实现巨型芜菁与变形之泉基地能力
- [ ] 6.4 补俄罗斯童话 L2 行为测试、真实入口 L3/L4 E2E 和 evidence

## 7. Ancient Incas

- [x] 7.1 完成古代印加人 12 个唯一卡面的静态定义和 20 张实体牌数量
- [ ] 7.2 实现古代印加人全部基地附着行动、额外行动、移动和其它规则子句
- [ ] 7.3 实现库斯科与马丘比丘基地能力
- [ ] 7.4 补古代印加人 L2 行为测试、真实入口 L3/L4 E2E 和 evidence

## 8. Audit And Closeout

- [ ] 8.1 为全部 67 个新增对象建立规则子句表、完整技能流程矩阵和 L0-L4 结论
- [ ] 8.2 为所有可选、至多、任意数量效果补合法候选存在时的跳过/空选测试
- [ ] 8.3 运行注册、interaction、targetType、ongoing、trigger、base 和 atlas 审计
- [ ] 8.4 完成四派系真实选择、开局、代表复杂链路 E2E 和连续截图证据
- [ ] 8.5 运行定向 Vitest、typecheck、i18n、资源校验和 OpenSpec 严格校验
- [ ] 8.6 回写对象级 evidence 与批次汇总，仅在最终权威状态收口后勾完任务
