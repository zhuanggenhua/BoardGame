# 幻想国度官方基础卡表接入任务

> 说明：当前仓库里可能已经存在官方基础卡表相关的探索实现、合同文档与验证记录；在 `0.1` 未完成前，它们只能算“草案对应的探索产物”，不能按正式 change 收口。

## 0. Approval Gate
- [x] 0.1 用户明确批准 `add-fantasyrealms-official-card-catalog` 的范围与边界

## 1. Spec 与合同
- [x] 1.1 为官方基础卡表建立正式 OpenSpec change（proposal / design / tasks / spec）
- [x] 1.2 新增 `src/games/fantasyrealms/rule/official-card-table-contract.md`，登记真相源、字段映射、花色分布、`id` 规则与当前未完成项

## 2. Runtime 数据层收口
- [x] 2.1 复核 `fantasyrealms` runtime 牌库与 foundation 样例卡位统一复用官方 53 张基础卡
- [x] 2.2 明确当前仅正式接入英文 `name/text`，不把逐卡中文名/中文效果伪装成已完成

## 3. Verification
- [x] 3.1 新增官方卡表定向测试，锁住总数、唯一性、花色分布与克隆边界
- [x] 3.2 运行 `openspec validate add-fantasyrealms-official-card-catalog --strict --no-interactive`
- [x] 3.3 运行 `npx vitest run` 的 fantasyrealms 定向测试集
- [x] 3.4 运行 `npm run generate:manifests`
