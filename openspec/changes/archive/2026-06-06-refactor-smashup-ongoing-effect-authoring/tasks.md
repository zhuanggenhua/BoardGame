## 1. Authoring Surface
- [x] 1.1 定义 Smash Up ongoing/static effect 的结构化 authoring types，覆盖 power/base power/breakpoint 三类持续数值效果
- [x] 1.2 为 authoring surface 增加显式 `variantPolicy`、controller lens 与 runtime identity helper 接口
- [x] 1.3 保留 legacy `selfManaged` 兼容入口，并为其增加明确的 anti-pattern / exception 注释口径

## 2. Runtime Integration
- [x] 2.1 在 `ongoingModifiers` runtime 中接入新的 authoring surface 与 shared helper
- [x] 2.2 确保 POD 语义只允许 `inherit / override / baseOnly`，禁止 `_pod` 规则反向污染基础版
- [x] 2.3 统一 copied / borrowed 持续效果的 runtime identity 归一，不再要求业务规则硬比 raw `defId`

## 3. Incremental Migration
- [x] 3.1 先迁移高风险持续效果规则：`steampunk_steam_man`、`fairies_daisy_chain`、`fairies_enchantment`
- [x] 3.2 迁移 `cyborg_apes_juiced_up`、`base_monkey_lab` 与相关 counting 规则
- [x] 3.3 迁移 `shapeshifters_copycat_copied_power` 与 `shapeshifters_cellular_bonding_copied_power`
- [x] 3.4 盘点剩余 legacy `selfManaged` 规则，区分“可继续迁移”与“暂时保留例外”

## 4. Verification
- [x] 4.1 补 focused tests，覆盖 POD override、borrowed controller seam、copied `_pod` identity seam
- [x] 4.2 回归 Smash Up modifier registry、ongoing modifiers 与相关业务能力测试
- [x] 4.3 更新相关开发文档，明确 ongoing/static effects 的首选 authoring 入口与 legacy 例外口径
