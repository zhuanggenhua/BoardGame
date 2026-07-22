# Change: Add Summoner Wars Yongheng Faction

## Why

用户已提供召唤师战争永恒议会派系素材，需要将该派系从素材录入推进到派系选择、牌组、图集、资源链、规则实现和审计验证。永恒议会围绕抓牌、手牌数量、弃牌、充能和持续事件保留结算，不能只做静态卡池接入。

## What Changes

- 新增永恒议会（`yongheng`）召唤师、3 张英雄、4 张士兵、4 张事件、城门与预构筑牌组。
- 接入永恒议会派系选择、自定义卡池、AI 配置、中英文文案、图集和关键图片预加载。
- 实现永恒议会的抓牌触发、弃牌惩罚、攻击后弃牌入牌库底、召唤后/攻击后抓牌、手牌数量/充能战力修正、事件充能与保留持续事件。
- 完成资源压缩、manifest、单派系资源发布预检/上传与远端回查。
- 建立逐对象录入合同、规则子句、L0-L4 证据、共享消费合同、真实入口 E2E 与截图核验。

## Impact

- Affected specs: `summonerwars-core`
- Affected code: `src/games/summonerwars/**`, `public/locales/*/game-summonerwars.json`, `public/assets/i18n/zh-CN/summonerwars/**`, `e2e/summonerwars/**`
- Affected evidence: `evidence/summonerwars/**`
