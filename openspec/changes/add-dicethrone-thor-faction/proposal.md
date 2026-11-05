# Change: 新增 Dice Throne 索尔英雄

## Why

用户已提供索尔完整素材目录并明确要求实施新派系。现有游戏尚无 `thor` 角色定义。

## What Changes

- 以本轮用户指定图片建立逐对象录入合同，再接入角色、骰面、技能、Token、物理卡与升级。
- 复用成熟英雄的v2玩家板、完整卡图atlas、阶段与交互机制；新机制由游戏内明确owner承载。
- 完成资源链、领域测试、审计与真实入口验证；实施审计完成前隐藏，完成后保留实施中等待真人确认。

## Impact

- Affected specs: `dicethrone-thor-faction`
- Affected code: `src/games/dicethrone/`、双语本地化、索尔素材manifest、针对性测试和evidence。
- 授权依据：本轮用户明确“实施新派系”；不包含Git提交、生产代码部署或其它英雄重构。
