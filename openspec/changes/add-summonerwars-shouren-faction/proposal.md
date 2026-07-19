# Change: Add Summoner Wars Shouren Faction

## Why

用户已提供召唤师战争冰苔兽人完整派系素材，需要将该派系从卡图录入推进到现有派系选择、牌组、图集、资源发布和完整规则结算链。冰苔兽人包含掷骰后重掷、攻击后推拉与额外攻击、持续禁用等现有派系未完整覆盖的机制，不能只按静态配置接入。

## What Changes

- 新增冰苔兽人（`shouren`）召唤师、3 张英雄、4 张士兵、4 张事件、城门与预构筑牌组。
- 接入冰苔兽人派系选择、自定义卡池、AI 配置、音频能力枚举、中英文文案、图集和关键图片预加载。
- 为“激励”增加掷骰后、伤害前的可选重掷结算，并保证等待选择时伤害尚未落地。
- 实现冰苔兽人的充能、射程/战力/命中修正、攻击额外伤害、召唤后推拉、额外攻击、持续禁用和持续授予技能。
- 完成资源压缩、manifest、单派系服务器素材发布与远端回查。
- 建立逐对象规则子句、L0-L4 证据、共享消费合同、真实入口 E2E 与截图核验。

## Impact

- Affected specs: `summonerwars-core`
- Affected code: `src/games/summonerwars/**`, `public/locales/*/game-summonerwars.json`, `public/assets/i18n/zh-CN/summonerwars/**`, `e2e/summonerwars/**`
- Affected evidence: `evidence/summonerwars/**`

