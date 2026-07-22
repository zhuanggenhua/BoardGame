# 山屋惊魂属性轨 UI E2E 证据

## 范围

- 规则切片：探索者属性以角色面板轨道和夹子位置表达；属性提升 / 下降移动夹子位置，重复数值不应吞掉位置变化。
- 真实入口：`/play/betrayal` 真实牌桌入口，经项目 harness 注入非线性属性轨代表态。
- 不代表完成：伤害分配面板、治疗预览、房间朝向、移动力快照、交易 / 特殊行动 / 攻击限制、怪物系统和 50 个作祟逐条合同仍需继续。

## 验证命令

- `npx vitest run src/games/betrayal/__tests__/Board.foundation.test.tsx --configLoader native --pool threads --no-file-parallelism --maxWorkers 1`
  - 结果：`72 passed`
- `npx eslint src/games/betrayal/Board.tsx src/games/betrayal/__tests__/Board.foundation.test.tsx e2e/betrayal/trait-track-ui.e2e.ts`
  - 结果：`0 errors / 13 existing warnings`
- `$env:PW_USE_DEV_SERVERS='false'; $env:PW_ALLOW_DEV_SERVER_TESTS='false'; npm run test:e2e:ci:file -- e2e/betrayal/trait-track-ui.e2e.ts`
  - 结果：`1 passed`

## 截图

| 文件 | 画面结论 |
| --- | --- |
| `01-属性轨角色板-重复数值夹子位置.jpg` | 当前玩家角色板显示四条属性轨；速度轨有重复数值 3，但当前夹子停在第一个 3 的位置；角色立绘上的速度夹子也按轨道位置定位。 |
| `02-属性轨详情-队友轨道.jpg` | 队友详情弹层显示完整属性轨；速度轨中重复数值 3 / 3 只高亮当前所在格，绿色起点标记可见。 |

## 图面核验

- 通过。截图可读，能直接看出属性是轨道和夹子，不再是单纯四个裸数字。
- 通过。详情弹层能展示重复数值和当前夹子位置，能解释“属性提升但数值不一定变化”的规则语义。

## 未覆盖范围

- 尚未证明伤害分配 UI 会用同一属性轨预览后果。
- 尚未证明治疗 UI 会显示回绿色起点。
- 尚未证明移动力快照、房间朝向选择、交易、特殊行动、攻击、怪物和全部作祟合同完成。
