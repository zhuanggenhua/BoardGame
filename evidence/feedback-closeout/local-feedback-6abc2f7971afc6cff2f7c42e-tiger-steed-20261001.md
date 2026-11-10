# 本地反馈收口：虎骑士效果没发动

- 反馈原文：虎骑士效果没发动
- 本地反馈截图：`temp/feedback-closeout/online-20260930/images/6abc2f7971afc6cff2f7c42e-01.jpg`
- 主真相源：截图牌面显示“你可以摧毁这里一个力量2或更少的仆从”。
- 录入问题：`public/locales/zh-CN/game-smashup.json` 与 `public/locales/en/game-smashup.json` 原先只有名称，没有能力文字；`src/games/smashup/data/factions/munchkin.ts` 原先没有给虎骑士注册 `onPlay` 能力标签。
- 消费实现：新增 `munchkin_treasure_tiger_steed` 的 `onPlay` 选择链；只展示同基地有效力量不超过 2 的仆从，并允许跳过；选择后通过正式 `buildValidatedDestroyEvents` 消灭目标。
- 单测：`src/games/smashup/__tests__/munchkinMechanics.test.ts`，99/99 通过。
- 真实入口：`e2e/smashup/smashup-munchkin-monster-treasure-ui.e2e.ts` 新增用例“虎骑士打出后可在同基地摧毁力量2或更少的仆从”，Playwright 1 passed (17.6s)。
- 结论：本地已修复并完成真实玩家入口验证；生产未验证、未部署。
