# 作祟 12 交互子账本：The House is Hungry / Helping Hands

> 状态：`monster-turn-runtime-e2e-verified-representative`。这是自由混战与巨魔手怪物回合代表链，当前证明领域层 setup / 控制权、Board 组件里的伤害 / 偷牌选择、援手攻击奖励伤害待分配面板、巨魔手移动 / 单手攻击 / 合击 / 结束怪物回合入口、巨魔手攻击伤害待分配面板，以及真实牌桌入口中的力量攻击奖励选择、同房双巨魔手“第1只 / 第2只力量 5 单手攻击 + 力量 8 合击”并列入口、巨魔手力量 8 合击后的伤害分配、巨魔手移动目标高亮、移动后反馈、明确结束巨魔手回合、护符换手控制权和无人持护符跳过提示；不外推为完整自然怪物回合全排列、完整终局或全部作祟完成。

## 1. 源段锁定

| 项 | 内容 |
| --- | --- |
| 英雄书 | 无，叛徒书独占 |
| 叛徒书 | `betrayal-3e-traitors-tome-en.md` p11 |
| 剧本卡 / 触发预兆 | NONE / The House is Hungry |
| 叛徒 | 自由混战 |
| 类型 | 全员敌对 + 物品争夺 + 巨魔手怪物 |

## 2. 公开步骤

- 公开这是自由混战：所有探索者互为障碍物，可互相攻击。
- 公开奇异护符决定谁控制巨魔手。
- 公开巨魔手在作祟揭秘者回合后行动；没有人持有奇异护符时跳过怪物回合。

## 私密可见性

- 本作祟是自由混战；奇异护符持有人、巨魔手位置和怪物控制者全部公开。
- 没有隐藏阵营；玩家仍可按基础规则隐藏自己手中未公开卡牌细节。
- 巨魔手行动权必须随奇异护符换手实时更新，不能绑定作祟揭秘者。

## 3. setup 队列

1. 若无人持有奇异护符，从物品牌堆找出并交给作祟揭秘者。
2. Monster Card 放在作祟揭秘者左侧；怪物在作祟揭秘者之后行动。
3. 放置 2 个巨魔手 token：入口大厅 1 个，地下室登陆点 1 个。
4. 作祟揭秘者左侧玩家先行动。

## 4. 目标模型

| 玩家 | 胜利条件 |
| --- | --- |
| 每名探索者 | 自己持有奇异护符，且其他探索者全部死亡 |

## 5. 特殊行动 / 持续规则

- 当你用力量攻击另一名探索者并获胜时，可以选择偷取其 1 张物品或预兆，而不是造成伤害。

## 6. 持续 / 触发规则

- 自由混战：所有探索者都是障碍物；所有探索者可互相攻击。
- 巨魔手由当前持有奇异护符的玩家控制。
- 当前无人持有奇异护符时，作祟揭秘者之后的怪物回合跳过。

## 6.1 怪物合同

| 怪物 | 数量 | 属性 | 特殊规则 |
| --- | ---: | --- | --- |
| 巨魔手 | 2 | 力量 5、速度 3、神志 4、知识 4 | 不能被击晕；若两个巨魔手同房间，可选择一次力量 8 合击作为替代入口，但不能遮掉两只巨魔手各自力量 5 的单手攻击入口 |

怪物行动权必须动态读取奇异护符当前持有人；交易、偷取、死亡掉落都可能改变控制者。

## 6.2 巨魔手回合交互合同

本节只定义 12 号作祟的巨魔手回合，不把它写成已经完成的通用怪物系统。

| 环节 | 规则真相 | 领域状态 / 命令 | 牌桌承接 | 负向断言 |
| --- | --- | --- | --- | --- |
| 触发 | 作祟揭秘者结束回合后，先进入巨魔手回合，再轮到下一名探索者 | `monsterTurnAfterPlayerId` 命中本回合结束者时，自动进入巨魔手回合；无人持护符则记录跳过并直接推进 | 底部短状态明确显示“巨魔手回合”或“无人持有奇异护符，巨魔手跳过” | 不得把巨魔手回合塞进护符持有者自己的普通回合，也不得在无人持护符时保留行动入口 |
| 控制者 | 当前持有奇异护符的探索者控制两个巨魔手；控制者不是固定的作祟揭秘者 | 每个怪物命令都重新核对护符当前持有人 | 状态条显示控制者；只有该玩家能点巨魔手命令 | 旧持有人不能因曾经持有护符继续操作；旁观者和其他探索者不能操作 |
| 移动骰 | 两个巨魔手同属一个类型，本怪物回合只投一次速度 3 骰；总点数是每只手本回合的最大移动格数，最低为 1 | 回合开始生成同一份移动骰结果，并为两只手分别建立可消耗移动额度 | 先显示“巨魔手速度 3 / 可移动 N 间”，再高亮每只手可去的房间 | 不得分别为两只手重复投骰；不得按探索者速度或上回合移动力代替怪物移动力 |
| 移动 | 每只手可在已发现房间间移动；地下室登陆点与一楼楼梯平台视作相邻；离开有探索者的房间按障碍物规则消耗 2 点 | `MOVE_HELPING_HANDS_TROLL_HAND` 校验怪物 id、剩余移动、合法连接和怪物楼梯特例 | 点巨魔手后高亮合法目标；移动后保留剩余步数 | 不能探索新房间、不能走断开的假通道、不能越过未发现房间、不能超额移动 |
| 攻击 | 在巨魔手回合内，控制者可让每只未行动的手对同房间存活探索者做力量 5 攻击；两手同房时可改为一次力量 8 合击；造成伤害时由受伤探索者在力量 / 速度中分配 | 现有 `HELPING_HANDS_TROLL_HAND_ATTACK` 只在活跃巨魔手回合可用；记录已行动的手；造成伤害时生成来源为“巨魔手攻击”的 `pendingDamageAllocation` | 单手与合击入口并列，合击后两个 token 同时标记已行动；攻击获胜后显示受伤方伤害分配面板 | 合击不能与两个单手攻击叠加；已经行动的手不能再次攻击；跨房间目标不可选；不能在攻击结算时直接自动扣属性 |
| 结束 | 控制者可在不移动完或不攻击的情况下明确结束巨魔手回合，然后才推进下一名探索者 | `END_HELPING_HANDS_MONSTER_TURN` 关闭该回合并恢复正常顺时针顺序 | “结束巨魔手回合”是独立明确动作 | 不得自动跳过仍可操作的怪物回合，也不得让普通探索者结束巨魔手回合 |
| 被攻击 | 巨魔手可以被攻击，但本作祟明确不能被击晕；攻击仍消耗攻击者本回合攻击额度并留下“不能击晕”的结果 | 对巨魔手的攻击结算不写入击晕状态 | 怪物 token 保持正面，反馈写明未被击晕 | 不得把巨魔手移除、翻面或当作普通探索者扣属性 |

## 7. token / 怪物合同

| 对象 | 状态真相 |
| --- | --- |
| 奇异护符 | 当前持有人；若从牌堆搜索出来，需要记录来源和离开牌堆状态 |
| 巨魔手 token | 房间位置、是否同房间、行动控制者、不可击晕 |

## 8. UI 承接

- 主目标条：每名玩家显示“夺取奇异护符并成为最后生还者”。
- 持有物区：奇异护符必须高亮为怪物控制权来源。
- 地图：巨魔手行动时显示当前控制者；若两个巨魔手同房间，攻击面板同时提供“第1只单手攻击 / 第2只单手攻击 / 合击”的合法选择。
- 探索者攻击奖励结算：探索者用力量攻击获胜后必须让攻击者选择“造成伤害 / 偷物品或预兆”；选择造成伤害后由受伤防守者分配物理伤害，不能由攻击者自动扣属性。
- 巨魔手攻击结算：巨魔手攻击或合击获胜后直接进入受伤探索者的“巨魔手攻击”伤害分配；合击会同时消耗两只巨魔手的本回合攻击机会。
- 当前 Board 组件承接：力量攻击获胜后，攻击投骰回顾收口后显示“造成伤害 / 偷物品或预兆”；如果攻击者仍有兔脚这类改骰来源，空白关闭保持禁用，玩家需明确点“返回牌桌”再进入奖励选择；点“造成伤害”后进入受伤方的伤害分配面板；巨魔手怪物回合只显示怪物专属动作，控制者可点“移动巨魔手”进入地图房间本体高亮，点击合法房间后执行 `MOVE_HELPING_HANDS_TROLL_HAND` 并反馈目标房间；控制者可点“结束巨魔手回合”执行 `END_HELPING_HANDS_MONSTER_TURN` 并推进下一名探索者；巨魔手同房时同时显示两只单手力量 5 攻击入口和力量 8 合击入口，点合击后进入受伤方的伤害分配面板。

## 9. 验证

- 单测：无人持有护符时 setup 搜索；护符持有人控制怪物；无人持有时跳过怪物；力量攻击胜利后生成“造成伤害 / 偷物品或预兆”选择；选择偷牌不造成伤害；选择造成伤害后生成待分配伤害，错误玩家不能替受伤方分配，受伤方确认后才扣属性；非力量攻击获胜不能偷牌；同房间巨魔手提供力量 8 合击并消耗两个巨魔手；巨魔手攻击获胜后生成待分配伤害，错误玩家不能替受伤方分配，受伤方确认后才扣属性。
- 页面测试：自由混战目标条、护符控制提示、力量攻击后的伤害 / 偷牌选择、点造成伤害后的受伤方分配面板、巨魔手移动入口、房间本体高亮、移动反馈、巨魔手回合结束、巨魔手同房时两只单手攻击与合击并列、点合击后的受伤方分配面板。
- E2E：已覆盖力量攻击奖励选择、巨魔手同房时两只单手力量 5 攻击与力量 8 合击并列、巨魔手合击后的真实入口伤害分配、巨魔手移动目标高亮、移动后回牌桌、明确结束巨魔手回合、护符换手后怪物控制权改变、无人持护符跳过怪物回合的真实入口路径；仍需覆盖完整自然怪物回合全排列、移动后攻击 / 两手分别行动等边界和终局。
- 当前领域证据：
  - `npx vitest run src/games/betrayal/__tests__/firstScenarioRuntime.test.ts -t "巨魔手同房" --configLoader native --pool threads --no-file-parallelism --maxWorkers 1`：1 passed / 199 skipped。`npx vitest run src/games/betrayal/__tests__/firstScenarioRuntime.test.ts -t "大宅饿了|援手|巨魔手|奇异护符|伤害分配" --configLoader native --pool threads --no-file-parallelism --maxWorkers 1`：17 passed / 183 skipped。
  - `npx vitest run src/games/betrayal/__tests__/firstScenarioRuntime.test.ts --configLoader native --pool threads --no-file-parallelism --maxWorkers 1`：200 passed。
- 当前 Board 组件证据：
  - `npx vitest run src/games/betrayal/__tests__/Board.foundation.test.tsx -t "巨魔手怪物回合|巨魔手同房" --configLoader native --pool threads --no-file-parallelism --maxWorkers 1`：2 passed / 83 skipped。`npx vitest run src/games/betrayal/__tests__/Board.foundation.test.tsx -t "大宅饿了|援手|巨魔手|偷牌|伤害分配" --configLoader native --pool threads --no-file-parallelism --maxWorkers 1`：6 passed / 79 skipped；命令 0 退出，退出后有测试环境 socket reset / AbortError 和 `compact-omen-book` 重复 key 噪声日志。
  - `npx vitest run src/games/betrayal/__tests__/Board.foundation.test.tsx --configLoader native --pool threads --no-file-parallelism --maxWorkers 1`：84 passed；命令 0 退出，退出后有测试环境 socket reset / AbortError 和 `compact-omen-book` 重复 key 噪声日志。
  - `npx tsc --noEmit --pretty false`：通过。
  - `npx eslint src/games/betrayal/Board.tsx src/games/betrayal/__tests__/Board.foundation.test.tsx public/locales/zh-CN/game-betrayal.json public/locales/en/game-betrayal.json`：0 errors / 2 JSON ignored warnings。
  - `openspec validate refactor-betrayal-core-interactions --strict --no-interactive`：valid。
  - `game-betrayal` zh-CN / en 文案 JSON 解析通过。
- 当前真实入口 E2E / 截图证据：
  - `node scripts/infra/run-e2e-single.mjs ci e2e/betrayal/helping-hands-combat.e2e.ts`：3 passed。
  - `npx eslint e2e/betrayal/betrayalTestHelpers.ts e2e/betrayal/helping-hands-combat.e2e.ts`：0 errors。
  - 证据文档：`evidence/betrayal-helping-hands-combat/e2e-test.md`。
  - 服务器相册：`http://8.148.71.102:18080/#/boardgame/betrayal-helping-hands-combat`。
  - 截图：`01-大宅饿了-力量攻击投骰回顾-可改骰时空白不可关闭.jpg`、`02-大宅饿了-伤害或偷牌选择.jpg`、`03-大宅饿了-偷牌后回牌桌.jpg`、`04-大宅饿了-巨魔手合击入口.jpg`、`05-大宅饿了-巨魔手合击后伤害分配.jpg`、`06-大宅饿了-巨魔手移动目标高亮.jpg`、`07-大宅饿了-巨魔手移动后回牌桌.jpg`、`08-大宅饿了-结束巨魔手回合后下一位.jpg`、`09-大宅饿了-护符换手后旧持有人无巨魔手入口.jpg`、`10-大宅饿了-护符新持有人获得巨魔手入口.jpg`、`11-大宅饿了-无人持护符巨魔手跳过.jpg`。
