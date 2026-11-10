# 线上反馈收口：工匠纳米爆弹引爆无伤害

反馈 ID：`6abf8b2881a765066bd8ef84`
来源：线上 `https://api.easyboardgame.top/admin-api/feedback`，2026-10-02 拉取

## 反馈原文

王权的工匠（发明家）引爆纳米核弹没有伤害

## 效果描述原文

负面状态效果，上限 3。引爆时按数量造成 1/3/5 点伤害；维护阶段可尝试移除。

来源：`public/locales/zh-CN/game-dicethrone.json` 的 `statusEffects.nanobomb.description`（录入合同）。

## 当前现场

线上反馈附带的现场是 DiceThrone 工匠对局，角色为 `artificer`，提交时处于 `defensiveRoll`；状态快照显示纳米爆弹存在于对手身上，反馈描述为点击工坊后引爆没有伤害。

## 发现的问题

这是工匠纳米机器人引爆链的实现风险：自定义被动动作如果找不到处理器，旧路径可能先扣除 CP / Token，再静默结束，形成“资源消耗但玩家可见效果没有发生”。纳米爆弹的正式效果要求按层数产生直接伤害并移除状态。

## 处理方式 / 修复结果

- 在 `src/games/dicethrone/domain/execute.ts` 中把自定义动作处理器校验提前到成本事件之前；处理器缺失时拒绝执行，避免资源已扣而效果静默消失。
- 保留 `artificer-nanobot-detonate` 的正式 `DAMAGE_DEALT` 事件路径，并补充工匠领域回归覆盖。
- 真实入口：`e2e/dicethrone/artificer-intake.e2e.ts`，双玩家选择工匠后进入工坊，点击纳米机器人按钮。
- 真实结果：目标生命 `50 → 47`；同一运行事件流出现 `DAMAGE_DEALT`，`sourceAbilityId=artificer-nanobot-detonate`、`amount=3`、`actualDamage=3`、`damageScope=direct`、`unblockable=true`；纳米爆弹层数 `2 → 0`。
- 验证：工匠领域回归 `65/65` 通过；`npm run typecheck` 通过；真实入口 E2E `1 passed`。

## 当前状态

resolved

说明：本地工作树已完成修复并通过真实入口验证；生产代码尚未部署，待下一次发布生效。
