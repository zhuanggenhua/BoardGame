# 山屋惊魂作祟 3「灰尘」回合末未交换疾病伤害分配 E2E 证据

> 证据状态：通过。  
> 范围：只证明作祟 3「灰尘」中“本回合未交换疾病标记，回合结束受 2 骰一般伤害”的分配切片，不代表灰尘完整作祟完成。

## 验证命令

```powershell
node scripts\infra\run-e2e-single.mjs ci e2e\betrayal\the-dust-end-turn-damage-allocation.e2e.ts "灰尘"
```

结果：`1 passed`。

## 截图核验

| 截图 | 绝对路径 | 实际看到 | 验收结论 |
| --- | --- | --- | --- |
| 结束回合前 | `D:\gongzuo\webgame\BoardGame\evidence\betrayal-the-dust-end-turn-damage-allocation\01-灰尘未交换结束回合前.jpg` | 真实牌桌处于剧本 3「灰尘」，顶部有研究 / 疾病标记 / 同房交换进度条，当前玩家是丽贝卡，底部“结束回合”可点击。 | 达标：进入真实牌桌原位点，不是临时页面。 |
| 伤害分配面板 | `D:\gongzuo\webgame\BoardGame\evidence\betrayal-the-dust-end-turn-damage-allocation\02-灰尘冲动伤害分配面板.jpg` | 结束回合后没有直接轮转，出现“伤害分配 / 灰尘冲动”，右上显示丽贝卡受 `2 点一般伤害`，力量 / 速度 / 知识 / 神志均可选，确认按钮未选满前禁用。 | 达标：未交换疾病触发的 2 骰一般伤害进入玩家分配面板。 |
| 分配确认后交接 | `D:\gongzuo\webgame\BoardGame\evidence\betrayal-the-dust-end-turn-damage-allocation\03-灰尘冲动分配确认后交接.jpg` | 伤害面板已关闭，当前回合切到达里尔，底部仍是正常牌桌行动区。 | 达标：玩家确认分配后才推进回合。 |

## 不外推

- 未覆盖感染交换全排列。
- 未覆盖隐藏编号完整可见性。
- 未覆盖研究 / 治愈全路径 UI。
- 未覆盖同时胜负政策或完整终局边界。
