# 山屋惊魂属性轨 UI E2E 证据

## 范围

- 规则切片：探索者属性以角色面板轨道和夹子位置表达；属性提升 / 下降移动夹子位置，重复数值不应吞掉位置变化。
- 真实入口：`/play/betrayal` 真实牌桌入口，经项目 harness 注入非线性属性轨代表态。
- 本次覆盖：当前玩家属性轨、观察队友后的属性轨、聚焦到自己房间按钮、点击队友卡切换观察视角而非弹详情。
- 不代表完成：伤害分配面板、治疗预览、房间朝向、移动力快照、交易 / 特殊行动 / 攻击限制、怪物系统和 50 个作祟逐条合同仍需继续。

## 验证命令

- `node scripts/infra/vitest-cli-safe.mjs run src/games/betrayal/__tests__/Board.foundation.test.tsx --config vitest.config.core.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "属性轨"`
  - 结果：`2 passed / 178 skipped`
- `$env:NODE_OPTIONS='--max-old-space-size=12288'; node .\node_modules\eslint\bin\eslint.js src/games/betrayal/Board.tsx src/games/betrayal/__tests__/Board.foundation.test.tsx e2e/betrayal/trait-track-ui.e2e.ts`
  - 结果：`0 errors`，保留 Babel 对 `Board.tsx` 超过 500KB 的 deoptimise 提示。
- `$env:PW_USE_DEV_SERVERS='false'; $env:PW_ALLOW_DEV_SERVER_TESTS='false'; npm run test:e2e:ci:file -- e2e/betrayal/trait-track-ui.e2e.ts`
  - 结果：`1 passed`

## 截图

| 文件 | 画面结论 |
| --- | --- |
| `01-属性轨角色板-连续轨指针位置.jpg` | 当前玩家左侧角色板显示四条属性轨；轨道是一条连续底板，重复数值按内部竖线保留物理格，当前格整格高亮，绿色起始标记仍可见。 |
| `02-属性轨观察队友-连续轨指针位置.jpg` | 点击队友卡后切换到观察视角，不弹探索者详情；左侧角色板切到队友，属性轨仍保持连续底板、内部格线和当前格高亮。 |
| `_audit-crops/01-trait-tracks-close.jpg` | 当前玩家属性轨放大审计图：肉眼可见同一条底板内部分格，不再是一排外部断开小方框。 |
| `_audit-crops/02-trait-tracks-close.jpg` | 观察队友属性轨放大审计图：连续轨道、重复数字分格、数字居中和当前格高亮均成立。 |

## 图面核验

- verdict: `PASS`
- score: `92/100`
- hard_failures: `[]`
- 通过。整屏图里属性区没有第二套当前值数字贴片，骷髅端点显示为死亡符号而非数值 `1`。
- 通过。放大图里属性轨是一条连续底板，重复数字没有合并成一格，也没有被拆成外部断开的独立小方框；当前格、绿色起点和内部格线可区分。
- 通过。观察队友态证明点击队友卡是切换观察视角，左侧角色板随观察对象变化；聚焦按钮仍为“聚焦到我的房间”的短入口。

## 未覆盖范围

- 尚未证明伤害分配 UI 会用同一属性轨预览后果。
- 尚未证明治疗 UI 会显示回绿色起点。
- 尚未证明移动力快照、房间朝向选择、交易、特殊行动、攻击、怪物和全部作祟合同完成。
