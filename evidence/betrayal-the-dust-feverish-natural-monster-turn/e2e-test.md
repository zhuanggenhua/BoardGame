# 山屋惊魂作祟 3「灰尘」狂热病患自然怪物回合证据

## 范围

- 目标：证明死亡叛徒变成狂热病患后，上一名玩家结束回合会自然轮到该死亡叛徒操控狂热病患，并能完成移动、攻击和回合交接。
- 真相来源：`docs/games/betrayal/haunts/03-the-dust.md`；官方英雄书源段 `betrayal-3e-secrets-of-survival-en.md` p8-p9。
- 覆盖边界：本证据只覆盖作祟 3「灰尘」狂热病患自然怪物回合代表链；不代表灰尘完整作祟、全部感染交换排列、完整隐藏叛徒 UI、全部怪物自然回合或 50 个作祟怪物系统完成。

## 验证命令

```powershell
node scripts\infra\vitest-cli-safe.mjs run src\games\betrayal\__tests__\firstScenarioRuntime.test.ts --configLoader native -t "狂热病患|灰尘"
```

结果：1 个测试文件通过；11 passed / 265 skipped。

```powershell
node scripts\infra\run-e2e-single.mjs ci e2e\betrayal\the-dust-feverish-natural-monster-turn.e2e.ts "狂热病患"
```

结果：2 passed。

```powershell
npx eslint src\games\betrayal\testing\firstScenarioTestUtils.ts src\games\betrayal\__tests__\firstScenarioRuntime.test.ts e2e\betrayal\betrayalTestHelpers.ts e2e\betrayal\the-dust-feverish-natural-monster-turn.e2e.ts
```

结果：0 errors。

## 截图核验

| 截图 | 观察 |
| --- | --- |
| `01-灰尘狂热病患自然回合-上一玩家结束前.jpg` | 当前回合为玩家 2；作祟 3「灰尘」进度条显示研究 0 处、疾病标记 3 枚；狂热病患 token 在门厅，底部可见“结束回合”和“狂热病患开回合”入口。 |
| `02-灰尘狂热病患自然回合-移动骰出现.jpg` | 回合自然切到死亡叛徒玩家 0；画面显示“狂热病患移动 / 速度 5 / 可移动 2 间 / 总点数 2”，并提供“返回牌桌”确认入口。 |
| `03-灰尘狂热病患自然回合-移动目标高亮.jpg` | 返回牌桌后进入移动模式；底部按钮变成“取消移动”，真实已发现相邻房间可点击，高亮目标可作为移动目的地。 |
| `04-灰尘狂热病患自然回合-结束后交接.jpg` | 狂热病患移动到入口大厅后，回合交给下一名玩家；狂热病患 token 留在移动后的房间，底部仍保留怪物开回合入口。 |
| `05-灰尘狂热病患攻击前动作槽.jpg` | 玩家 0 控制狂热病患，移动剩余为 0；底部动作槽显示“狂热病患攻击”，同房英雄仍在门厅。 |
| `06-灰尘狂热病患攻击目标高亮.jpg` | 点击攻击后，狂热病患 token 显示攻击态，右侧队友列表中同房英雄出现“攻击”短标记，底部按钮变为“取消攻击”。 |
| `07-灰尘狂热病患攻击骰盘.jpg` | 点击同房英雄后进入攻击骰盘；画面显示“伤害分配 / 攻击”，防守者为丽贝卡，待分配 8 点物理伤害。 |

## 结论

- `PASS`：代表链已证明狂热病患可以从死亡叛徒自然回合进入移动骰、在真实牌桌中选择移动目标、结束后交给下一名玩家，并能从怪物动作槽进入同房英雄攻击。
- `未覆盖`：完整灰尘作祟仍需补全感染交换全排列、隐藏叛徒完整身份边界、研究 / 治愈全路径 UI、同时胜负政策和更多死亡 / 终局边界。
