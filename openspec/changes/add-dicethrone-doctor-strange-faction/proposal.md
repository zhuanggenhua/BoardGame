# Change: 新增 Dice Throne 奇异博士

## Why

用户明确要求基于 `public/assets/i18n/zh-CN/dicethrone/images/doctor_strange` 实施新派系。现有运行时尚无奇异博士；其法术准备/施放、收入预感与即视感阶段重启需要正式规则消费，不能只复制其它英雄数据。

## What Changes

- 接入 `doctor_strange`、四种骰面、九个物理槽、32张物理卡（9法术、23行动）与三种状态；原文合同已先于运行时代码录入。
- 为法术增加真实准备区与单一结算owner；支持从手牌/弃牌/牌库准备，以及按规则从准备区/弃牌施放；复用现有ChoiceRequest、InteractionSystem与ResolutionFrame。
- 在现有阶段owner中接入预感收入选择、即视感结束并重开进攻投掷阶段、深红系带下一投掷阶段禁牌与清理。
- 使用现有v2桌面、手牌/卡图预览、被动动作栏与状态sprite，显式登记本角色几何与独立atlas。
- 实施审计未完成前隐藏；当前范围审计及交互验收后进入实施中；完成态需要真人明确批准。

## Impact

- Affected specs: `dicethrone-doctor-strange-faction`；现有选角能力通过现有生命周期扩展，不重写其它英雄的状态。
- Affected code: `src/games/dicethrone/heroes/doctor_strange`、角色/骰面注册、卡牌与法术规则owner、阶段/权限与视图消费、UI装配、双语本地化、定向测试与evidence。
- Assets: 仅奇异博士前缀；不修改公共/其它英雄atlas，不全仓上传素材。
- 用户当轮明确要求“实施新的dicethrone派系”为功能实施授权；Git提交、推送与生产代码部署不在本轮授权范围。移除实施中标记仍须单独真人确认。
- 当前change为可审阅的具体方案；实施前按 `openspec/AGENTS.md` 完成审阅批准记录。

## Sources

- [真相源表](../../../src/games/dicethrone/rule/奇异博士真相源表.md)
- [玩家板、状态与FAQ合同](../../../src/games/dicethrone/rule/奇异博士录入核对.md)
- [32张卡牌合同](../../../src/games/dicethrone/rule/奇异博士卡牌录入核对.md)
