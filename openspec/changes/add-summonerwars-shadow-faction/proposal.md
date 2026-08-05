# Change: Add Summoner Wars Shadow Elves Faction

## Why

用户提供了召唤师战争暗影精灵的召唤师、卡牌和起始部署素材。当前工作区已经完成素材 intake 与部分静态录入，但派系尚未接入完整的选择目录、图集/资源清单、能力注册与可验证的领域链路。

暗影精灵围绕伤害充能、单位返回手牌、离场触发、传送门相邻部署、弃牌抓牌和持续事件替换等规则，不能只把卡牌图片和数值放进卡池后宣称可玩完成。

## What Changes

- 新增暗影精灵（`shadow`）召唤师瑟伦达、3 张英雄、4 类士兵、4 张事件、起始城门和预构筑牌组。
- 接入暗影精灵派系选择、卡牌注册、独立图集、关键图预加载、中英文文案和资源 manifest。
- 按卡面规则实现可由现有 Summoner Wars 领域/交互合同承载的能力与事件效果；新交互若无法闭合则明确记录为阻塞，不用静态接入冒充完成。
- 补暗影精灵对象级录入合同、规则子句矩阵、L2 行为测试、真实入口验证和残余风险记录。
- 完成单派系资源预检、上传与代表 URL 回查（前提是当前环境和发布入口可达）。

## Impact

- Affected specs: `summonerwars-core`
- Affected code: `src/games/summonerwars/**`, `public/locales/*/game-summonerwars.json`
- Affected assets: `public/assets/i18n/zh-CN/summonerwars/hero/shadow/**`
- Affected evidence: `evidence/summonerwars/shadow-faction-intake.md`
