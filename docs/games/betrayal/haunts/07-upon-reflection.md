# 作祟 7 交互子账本：Upon Reflection

> 状态：`contract-ready`。这是无叛徒合作解谜，核心是作祟揭秘者沉默、秘密组合和镜像怪物压力。
> 2026-09-02 测试入口迁移：原 `src/games/betrayal/__tests__/firstScenarioRuntime.test.ts` 已退出正式入口；Upon Reflection 领域回归当前归 `src/games/betrayal/__tests__/betrayal-event-card-resolution.test.ts`，公共夹具在 `src/games/betrayal/__tests__/helpers/firstScenarioRuntimeHarness.ts`。下方 2026-07 历史验证命令保留原貌，不再作为新增测试入口。

## 0. 2026-07-29 领域补证状态

| 覆盖面 | 当前证据 | 状态 |
| --- | --- | --- |
| 秘密组合 | 7 号作祟触发时已写入 `scenarioRuntime.uponReflection.secretCombination`，包含 Trait / Omen / Room；普通玩家视角会隐藏组合内容，只保留作祟揭秘者可见 | `min-domain-verified / partial` |
| 破咒特殊行动 | 已接入 `BREAK_MIRROR_CURSE` 命令校验、执行事件、reducer、行动预算和终局：0-4 无反馈；5+ 但组合错误只给否定反馈且不泄露错误项；5+ 且 Trait/Omen/Room 全中进入英雄胜利 | `min-domain-verified / partial` |
| 事件符号房间 | 7 号作祟中发现事件符号房间时自动跳过事件牌：不抽取、不结算、不移动事件牌堆，且 `turnEndedByDiscovery=false` | `min-domain-verified / partial` |
| 镜中提示 | 已接入 `GIVE_MIRROR_HINT` 命令校验、执行事件与 reducer：仅作祟揭秘者每回合一次；从当前事件牌堆选择事件给任意存活玩家作提示；该事件不结算、不进弃牌堆、从事件牌堆放到一边 | `min-domain-verified / partial` |
| 镜中怪物最近目标移动 | 怪物移动目标现在按已发现房间连接图计算最短路径：只允许走向能缩短到最近可攻击探索者距离的相邻房间；距离平手时暴露多个等距路径供作祟揭秘者裁决；已同房时不允许离开；作祟揭秘者自身因灵魂在镜中不作为移动/攻击目标 | `min-domain-verified / partial` |
| 镜中怪物同房攻击 | 普通怪物攻击入口已读取 Mirror Being 的默认攻击属性：用神志投骰；若对英雄造成伤害，进入精神伤害分配，只允许分配知识 / 神志；物理属性轨不被扣减 | `min-domain-verified / partial` |
| setup 队列 | `deal-secret-mirror-combination` 已由领域状态自动闭合为 resolved；仍保留镜中沉默和怪物卡等 manual-check | `partial` |
| 验证命令 | `node scripts/infra/vitest-cli-safe.mjs run src/games/betrayal/__tests__/firstScenarioRuntime.test.ts -t "怪异的镜子|Upon Reflection|镜中|事件符号|镜中提示" --reporter=dot`：18 passed / 669 skipped；`node scripts/infra/vitest-cli-safe.mjs run src/games/betrayal/__tests__/firstScenarioRuntime.test.ts -t "镜中怪物" --reporter=dot`：4 passed / 683 skipped；`npx eslint src/games/betrayal/game.ts src/games/betrayal/__tests__/firstScenarioRuntime.test.ts --max-warnings=9999`：0 errors，5 个既有 warning | `pass` |

仍不得标为完整实现：镜中提示只完成最小领域命令链，镜中怪物只补了“最近目标移动 / 平手路径裁决 / 已同房神志攻击”的领域代表链；正式私密选择 UI、专属移动与目标选择 UI、E2E、截图和完整怪物回合组合仍未闭合。

## 1. 源段锁定

| 项 | 内容 |
| --- | --- |
| 英雄书 | `betrayal-3e-secrets-of-survival-en.md` p16-p17 |
| 叛徒书 | 无，英雄书独占 |
| 剧本卡 / 触发预兆 | NONE / Eerie Mirror |
| 叛徒 | 无叛徒；作祟揭秘者被困镜中 |
| 类型 | 合作解谜 + 沟通限制 + 怪物追击 |

## 2. 公开步骤

- 公开没有叛徒，但作祟揭秘者的灵魂被困镜中。
- 公开作祟揭秘者仍在游戏中但倒伏，且不能正常交流。
- 公开事件符号房间不再抽事件卡，也不会因此结束回合。

## 3. 私密可见性

- 作祟揭秘者秘密记录正确的 Trait、Omen、Room 组合。
- 作祟揭秘者不能说话、比划、书写或以其他方式交流，除非规则允许。
- 作祟揭秘者回合时只能从事件牌堆选择一张事件卡交给任意玩家作为提示；该事件不结算，之后放到一边。
- 破咒检定成功但组合不正确时，作祟揭秘者只能用赞成/否定手势反馈，不可额外解释。

## 4. setup 队列

1. 作祟揭秘者倒伏立牌；仍在游戏中但视为已死亡，灵魂在镜中。
2. 作祟揭秘者随机抽取并秘密记录一个 Trait token。
3. 随机抽取 1-9 Number token，对应 Mask、Dog、Idol、Dagger、Armor、Ring、Book、Holy Symbol、Skull 中一个预兆。
4. 洗混房间堆，偷看底部房间并秘密记录其房间名，然后重新洗混房间堆。
5. Trait token 和 Number token 放回盒中，不再使用。
6. 在入口大厅放置 2/3/4/5 个 Mirror Being。
7. Monster Card 放在作祟揭秘者左侧；作祟后首回合由其左侧玩家开始。

## 5. 目标模型

| 阵营 | 胜利条件 | 失败条件 |
| --- | --- | --- |
| 英雄 | 任一英雄用正确 Trait、持有正确 Omen、并位于正确 Room 时成功破咒 | 全部英雄死亡 |

## 6. 特殊行动

| 行动 | 使用者 | 条件 | 检定 / 结果 | UI 承接 |
| --- | --- | --- | --- | --- |
| 破咒 | 英雄 | 任意房间；选择一个属性，并告诉作祟揭秘者自己一个预兆名 | 用选择的属性检定；5+ 若 Trait/Omen/Room 全部正确则英雄胜利，否则只得到否定反馈；0-4 无反馈 | 属性选择 + 预兆选择 + 房间自动带入 + 静默反馈 |
| 镜中提示 | 作祟揭秘者 | 作祟揭秘者回合 | 从事件牌堆选 1 张给任意玩家解释；不结算事件，之后放一边 | 领域命令已补；正式私密事件牌选择 + 目标玩家选择 UI 未闭合 |

## 7. 持续 / 触发规则

- 发现事件符号房间时不抽事件卡，且不结束回合。
- Mirror Being 在作祟揭秘者之后行动，必须向最近探索者移动；领域层已按已发现房间连接图计算最短路径，距离平手时暴露多个合法下一步，供作祟揭秘者裁决。
- Mirror Being 若结束移动时与探索者同房间，使用神志攻击；当前已补“最近目标移动 / 平手路径裁决 / 已同房普通攻击”的领域代表链。

## 8. token / 怪物合同

| 对象 | 数量 | 状态真相 |
| --- | ---: | --- |
| Mirror Being | 2/3/4/5 | 房间、状态、最近目标和平手选择；移动目标过滤和平手路径、普通同房攻击神志 / 精神伤害已补领域代表链 |
| 秘密组合 | 1 | trait、omen、room；只对作祟揭秘者可见 |
| 事件提示牌 | 若干 | 已用于提示且不结算，放到一边 |

Mirror Being 属性：力量 4、速度 3、神志 6、知识 4。

## 9. UI 承接

- 作祟揭秘者界面应承接“镜中提示”和秘密组合，不显示普通行动建议；当前仅镜中提示领域命令链已补，正式 UI 未闭合。
- 英雄破咒界面必须把当前房间、所选属性、所报预兆三项同时确认。
- 主界面不能展示解释性长文；沟通限制用短状态“镜中沉默 / 只能用事件牌提示”承接。

## 10. 验证

- 单测：秘密组合随机且私密；破咒 0-4 无反馈、5+ 组合错误只给否定反馈、三条件全中才胜利；作祟揭秘者不能破咒；事件房间不抽牌不结束回合；镜中提示成功、非作祟揭秘者拒绝、不存在事件牌拒绝、同回合二次提示拒绝；镜中怪物移动目标只允许朝最近探索者缩短距离、最近距离平手允许作祟揭秘者选择任一等距路径、已同房不允许离开、已同房普通攻击按神志结算精神伤害已覆盖。
- 页面测试：作祟揭秘者视角与英雄视角不同；破咒反馈不泄露错误项。
- E2E：覆盖错误组合反馈、正确组合胜利、Mirror Being 平手由作祟揭秘者选择。
