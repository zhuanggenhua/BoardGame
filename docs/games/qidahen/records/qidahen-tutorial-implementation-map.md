# 七大恨教程实现映射

> 当前判定：专项维护文档；运行态以源码、测试和当前 E2E 证据为准。

## 1. 目录映射

| 教程 ID | 目录状态 | 主要职责 |
|---|---|---|
| `basic-opening` | 可见 | 正式起手、公共轮盘、落点结算、一次手牌行动 |
| `attack-and-battle` | 可见 | 突袭作战、支付、野战、战术时机、战后处理 |
| `siege-and-occupation` | 可见 | 守城宣告、城战、围城、占领 |
| `wheel-shared-cost` | 可见 | 轮盘代价、对手摸牌、进攻调度 |
| `year-and-characters` | 可见 | 年中、新年、纪年卡、顺位和人物刷新 |
| `korea-and-special-map-rules` | 可见 | 朝鲜朝贡、汉城、水路、朝鲜耗损、山海关 |
| 其余 11 个专题 | 隐藏 | 独立代表局面；不作为目录平级章节，不自动串联 |

## 2. 基础教程映射

`basic-opening` 的步骤顺序固定为：

```text
welcome
  -> turn-flow
  -> wheel-first
  -> wheel-rule
  -> wheel-move
  -> wheel-branch-recovery (hidden, only for legal non-mainline wheel branches)
  -> wheel-result
  -> hand-action-order
  -> grant-pardon-rule
  -> pick-action
  -> pay-cards
  -> choose-grant-pardon-target
  -> choose-grant-pardon-source
  -> action-result
  -> finish
```

承接规则：

- 起手 3 张手牌、上限 15 张；没有超限时 `handLimitDiscardSelection` 必须为空。
- `wheel-first` 是正式开局检查与轮盘入口说明；第一个真实点击仍是 `wheel-move`，不是弃牌、检视、士气或重复轮盘说明。
- `wheel-move` 使用正式公共轮盘点击；规则参考卡说明 1 / 2 / 3 格都是合法走法，当前动作卡只承接 `move-1-free` 对应的征兵训练落点。其它合法轮盘分支进入隐藏 `branch-recovery`，由教程系统恢复到 `wheel-move` 的完整检查点，不生成可见错误卡。
- `hand-action-order` 只解释大明四个同层势力行动；`grant-pardon-rule` 只承接规则原文，不把教程导航写进玩家文案。
- `pick-action` 和 `pay-cards` 使用正式手牌行动入口与支付面板。
- 目标选择必须落到真实地图接收区；若接收区唯一对应一个对手，正式状态自动锁定该对手，不渲染冗余对手按钮；若仍有多个对手，才显示剩余选择。
- `choose-grant-pardon-source` 是被指定玩家的真实选兵窗口，必须由该玩家点击正式地图部队本体；`action-result` 必须读取实际部队位置、数量和控制权变化。
- `finish` 只结束基础教程，不跳到其它专题。

## 3. 专题映射

| 专题 | 入口状态 | 主要结果 |
|---|---|---|
| `wheel-shared-cost` | 轮盘位于军屯，公共轮盘未使用 | 走 3 格后蒙古、后金各补 2 张牌；进入进攻调度 |
| `wheel-reclaim` | 轮盘位于新年 | 开垦结算，己方控制区人口增加 |
| `wheel-military-farm` | 轮盘位于开垦 | 军屯结算，补牌并建立正规军 |
| `wheel-recruit-train` | 轮盘位于军屯 | 征兵 / 训练结算，加兵并提升炮兵训练 |
| `armament-upgrade` | 正式手牌行动窗口 | 支付军备行动费用，火炮技术升到 2 级 |
| `event-action` | 正式手牌行动窗口 | 支付大汗令箭，选择征兵 / 训练效果 |
| `attack-and-battle` | 突袭作战可选 | 进入野战并完成战后处理 |
| `retreat-and-rout` | 已进入战败处理 | 处理断后与溃退代价 |
| `cavalry-evasion` | 待处理骑兵避战 | 骑兵避战并移动到相邻友方区域 |
| `cavalry-plunder` | 待处理骑兵劫掠 | 选择劫掠并写入结算摘要 |
| `neutral-invasion` | 中立入侵待结算 | 生成并结算中立守军 |
| `water-dispatch` | 水路调度窗口 | 锁定海岸水路限 2，排除水路后接陆路 |
| `diplomacy-and-hire` | 外交 / 雇佣窗口 | 友好标记、附庸 / 雇佣结果 |
| `year-and-characters` | 年中年度状态 | 年中、新年、纪年、顺位和人物刷新 |
| `korea-and-special-map-rules` | 新年朝贡状态 | 朝贡、汉城、水路、朝鲜耗损、山海关 |

## 4. 串联规则

当前 `src/games/qidahen/tutorial.ts` 不使用 `nextTutorialId` 把这些教程串成一条自动链。测试只保留“所有目录项存在、隐藏专题隐藏、没有跨专题自动链”的断言。

需要跨专题继续学习时，使用目录或明确专题 URL 重新进入；不要把独立预设局面写成前一个专题的规则结果。

## 5. 代码与测试职责

- `src/games/qidahen/tutorial.ts`：步骤、目标、允许命令、步骤校验器、章节显隐。
- `src/games/qidahen/tutorialSetup.ts`：各专题预设局面；必须标明专题起点，不能伪装正式自然承接。
- `src/games/qidahen/__tests__/tutorialFlow.test.ts`：章节清单、基础步骤合同和专题结果合同。
- `e2e/qidahen/qidahen-closeout.e2e.ts`：真实入口、玩家动作顺序、截图和关键结果断言。
- `public/locales/zh-CN/game-qidahen.json` / `public/locales/en/game-qidahen.json`：玩家可见文案；规则解释不能脱离规则源。

## 6. 维护红线

- 不重新加入与当前基础起手无关的弃牌、手牌检视、士气或重复轮盘说明。
- 不因为截图方便增加代操作、假确认、教程专属跳转或第二套状态。
- 不把单元测试、历史截图或旧 PASS 清单解释为当前完整 E2E 通过。
- 任一专题如果需要独立局面，必须保持独立入口、独立截图组和独立证据范围。
