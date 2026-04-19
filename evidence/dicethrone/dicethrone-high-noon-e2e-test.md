# 王权骰铸 High Noon 奖励骰特写 E2E 验证（已被“三分支证据链”取代）

## 覆盖范围
- 卡牌：`card-high-noon`
- 目标：奖励骰特写使用枪手骰面（而非目标英雄骰面），并以 displayOnly 结算

> 重要更新：本文件只保留历史入口。  
> **当前权威证据链** 已升级为三分支稳定覆盖（bullet/dash/bullseye），见：
> - `evidence/dicethrone/dicethrone-high-noon-branches-e2e-test.md`

## 运行命令
- `$env:NODE_ENV='test'; node scripts/infra/run-e2e-single.mjs ci e2e/dicethrone/dicethrone-die-reroll.e2e.ts`

## 关键截图与观察
### 1) 奖励骰特写（枪手骰面 / displayOnly）
请以三分支证据链文档为准（其中包含 overlay/closed/settled 的连续截图链）。

### 2) 结算后特写关闭
请以三分支证据链文档为准。

## 总结
- 历史结论依然成立（displayOnly + 枪手骰面），但证据链已升级并迁移到三分支文档中。
