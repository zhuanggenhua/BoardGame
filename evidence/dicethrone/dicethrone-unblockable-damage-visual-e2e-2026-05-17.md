# DiceThrone 不可防御伤害飞字 E2E（2026-05-17）

## 范围

- 僧侣 `transcendence`
- 圣骑士基础不可防御技能 `blessing-of-might`

## 执行命令

```powershell
npm run test:e2e:ci:file -- e2e/dicethrone/dicethrone-unblockable-damage-visual.e2e.ts "圣骑士基础不可防御技能结算后也应播放伤害动画和跳字"
```

## 结果

- 通过：`1 passed`

## 关键截图与肉眼验收

1. `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-unblockable-damage-visual.e2e\圣骑士基础不可防御技能结算后也应播放伤害动画和跳字\paladin-unblockable-before-resolve.png`

我实际看到：

- 场景停在结算前，圣骑士这条攻击链已经准备好推进。
- 这张图只用于证明“结算前态”存在，不作为完成态收口。

验收结论：

- 进入了真实圣骑士不可防御伤害链路。

2. `D:\gongzuo\webgame\BoardGame\test-results\evidence-screenshots\dicethrone\dicethrone-unblockable-damage-visual.e2e\圣骑士基础不可防御技能结算后也应播放伤害动画和跳字\paladin-unblockable-after-resolve.png`

我实际看到：

- 左侧生命值从 `50` 变成 `47`。
- 页面出现红色 `-3` 伤害浮字。
- 事件流里有 1 条 `DAMAGE_DEALT`。

验收结论：

- 圣骑士基础不可防御技能在真实链路里会正常播伤害动画和跳字。
- 这条结果不支持“AI 身份会跳过伤害表现”的判断。

## 链路结论

- 圣骑士 `blessing-of-might` 本身会进入通用 `DAMAGE_DEALT -> useAnimationEffects -> FlyingEffect` 链路。
- 当前问题不在“圣骑士技能有没有伤害事件”，而在展示层是否被别的特写动效叠出错觉。
