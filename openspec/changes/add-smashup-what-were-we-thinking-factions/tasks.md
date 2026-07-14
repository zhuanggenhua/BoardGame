## 0. Approval

- [x] 0.1 用户审阅并明确批准本提案后再开始运行时代码实施

## 1. Intake Contract

- [x] 1.1 逐卡锁定 48 个唯一卡面的中文名、牌面原文、力量、类型、数量和单卡裁图引用
- [x] 1.2 逐基地锁定 8 张基地的 canonical 名称、中文原文、断点、VP 和 atlas 槽位
- [x] 1.3 将每张卡、基地和相关探险家泰坦拆成 C1/C2/C3 规则子句与 effect atom
- [x] 1.4 建立共享机制复用表、全新机制清单、框架消费矩阵和冲突待裁定表
- [x] 1.5 裁定外婆/老奶奶显示名、摇滚明星卡名双关、探险家泰坦归属和其它图面/TTS/英文资料冲突
- [x] 1.6 将 intake handoff 更新为 `locked/blocked/disputed`，满足 implementation 前置门禁

## 2. Runtime Assets

- [x] 2.1 将用户卡牌 atlas 接入正式 Smash Up 资源目录并生成压缩 WebP
- [x] 2.2 将 TTS 基地 atlas 接入正式 Smash Up 资源目录并生成压缩 WebP
- [x] 2.3 注册 `8 x 6` 卡牌 atlas 和 `4 x 2` 基地 atlas 元数据
- [x] 2.4 重建游戏级与根级 manifest，并确认新键真实写入
- [x] 2.5 按用户当前口径将本 change 正式 PNG/WebP 资源解除忽略并纳入仓库/PR 交付，不走 R2

## 3. Static Data And Locale

- [x] 3.1 注册 `ROCK_STARS`、`TEDDY_BEARS`、`GRANNIES`、`EXPLORERS`
- [x] 3.2 新增或补齐四个独立 faction 数据文件并在 `cards.ts` 增量注册
- [x] 3.3 新增 8 张基地定义并接入基地池
- [x] 3.4 补齐 faction metadata、双语 locale、派系选择可见性和关键图片预加载
- [x] 3.5 添加 atlas、注册、数量、i18n、资源合同和既有探险家泰坦兼容测试

## 4. Rock Stars

- [x] 4.1 完成摇滚明星 12 个唯一卡面的静态定义和 20 张实体牌数量
- [x] 4.2 实现摇滚明星全部额外打出、牌库/弃牌堆检索、基地力量修正和其它规则子句
- [x] 4.3 实现 Palooza 与 Lake Minnetonka 基地能力
- [x] 4.4 补摇滚明星 L2 行为测试、真实入口 L3/L4 E2E 和 evidence

## 5. Teddy Bears

- [x] 5.1 完成泰迪熊 12 个唯一卡面的静态定义和 20 张实体牌数量
- [x] 5.2 实现泰迪熊全部控制、转移、移动、保护和其它规则子句
- [x] 5.3 实现 Under the Bed 与 Out in the Woods 基地能力
- [x] 5.4 补泰迪熊 L2 行为测试、真实入口 L3/L4 E2E 和 evidence

## 6. Grannies

- [x] 6.1 完成外婆 12 个唯一卡面的静态定义和 20 张实体牌数量
- [x] 6.2 实现外婆全部牌库顶查看/重排/放置、抽牌、检索和其它规则子句
- [x] 6.3 实现 Grandma's House 与 Retirement Community 基地能力
- [x] 6.4 补外婆 L2 行为测试、真实入口 L3/L4 E2E 和 evidence

## 7. Explorers

- [x] 7.1 完成探险家 12 个唯一卡面的静态定义和 20 张实体牌数量
- [x] 7.2 实现探险家全部基地发现、基地替换、额外基地/计分、移动和其它规则子句
- [x] 7.3 实现 Ancient Temple 与 City of Gold 基地能力
- [x] 7.4 对账并吸收既有探险家泰坦实现，补齐与正式探险家派系共存的 L2/L3/L4 证据
- [x] 7.5 补探险家 L2 行为测试、真实入口 L3/L4 E2E 和 evidence

## 8. Audit And Closeout

- [x] 8.1 为全部 56 个新增卡/基地对象和相关探险家泰坦建立规则子句表、完整技能流程矩阵和 L0-L4 结论
- [x] 8.2 为所有可选、至多、任意数量效果补合法候选存在时的跳过/空选测试
- [x] 8.3 运行注册、interaction、targetType、ongoing、trigger、base、titan 和 atlas 审计
- [x] 8.4 完成四派系真实选择、开局、代表复杂链路 E2E 和连续截图证据
- [x] 8.5 运行定向 Vitest、typecheck、i18n、本地资源校验、仓库资源可见性校验和 OpenSpec 严格校验
- [x] 8.6 回写对象级 evidence 与批次汇总，最终权威状态已按代表性玩法证据、仓库资源交付和显式残余范围收口
