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

## 2026-08-14 玩家面板 / 地图 Token 配置关联表与交互验收

### 范围

- 现实问题：配置资料里没有一张明确的“玩家面板资源 ↔ 地图角色 token”关联表，旧资源说明还写过“玩家面板和地图均可消费”，容易把两个职责再次混用。
- 当前合同：左上玩家面板显示角色板 / 肖像 / 属性夹子 / 位置和持有摘要；地图房间格内显示正式探索者 token。两者通过 `BETRAYAL_EXPLORER_CATALOG` 里的 `portraitAsset` 与 `tokenAsset` 关联，但不能互相替代。
- 本轮数据表：`docs/games/betrayal/intake-contract.md` 的“5.1 探索者玩家面板 / 地图 Token 关联表”列出 12 名当前可玩探索者的面板资源、token 源图、token 压缩图和备注；`sera-nguyen.png` 标为未配对素材，不猜 token。
- 真实入口：`/play/betrayal`，桌面视口 `1600x900`，通过项目 E2E harness 注入属性轨代表态。

### 验证命令

- `node -e "JSON.parse(require('fs').readFileSync('docs/games/betrayal/sources/image-index/runtime-resource-map.json','utf8')); console.log('runtime-resource-map JSON OK')"`
  - 结果：`runtime-resource-map JSON OK`。
- `node scripts/infra/vitest-cli-safe.mjs run src/games/betrayal/__tests__/Board.foundation.test.tsx --config vitest.config.core.ts --configLoader native --pool forks --no-file-parallelism --maxWorkers 1 -t "探索者玩家面板恢复人物板"`
  - 结果：`1 passed / 180 skipped`。命令退出码为 `0`；结束后出现的 `ECONNRESET` 是测试环境退出噪声，不影响该用例结果。
- `node scripts/infra/run-e2e-single.mjs default e2e/betrayal/trait-track-ui.e2e.ts`
  - 结果：`1 passed`；素材准备选择 `711` 个资源，下载 `0`，跳过未变化 `711`，并重拍当前真实入口整图。

### 截图

| 文件 | 画面结论 |
| --- | --- |
| `01-属性轨角色板-连续轨指针位置.jpg` | 当前玩家视角：左上是布里塔妮 “B-BOX” 鲍温的角色板 / 肖像和属性轨，不显示“缺少正式标记”；地图大厅房间里同时可见三枚正式探索者 token。 |
| `02-属性轨观察队友-连续轨指针位置.jpg` | 点击队友后切换观察视角：左上变为 AI 2 号位 / Stephanie Richter 的角色板 / 肖像和属性轨；右侧队友卡出现观察高亮；地图房间内三枚正式探索者 token 仍保留。 |
| `03-玩家面板-显示玩家肖像且地图保留正式Token.jpg` | 已作废：这是此前把失败候选当正常版本时生成的旧图，不再作为最终验收图或 last-known-good 证据。 |

### 图面核验

- verdict: `PASS`
- score: `94/100`
- hard_failures: `[]`
- 通过。左上玩家面板显示角色板 / 肖像 / 属性轨，不显示“缺少正式标记”，也没有把地图 token 当作面板主体。
- 通过。地图房间格里的玩家棋子仍是正式 token 语义；点击队友只切换观察面板，不改变地图 token 承载。
- 通过。截图是当前真实入口整屏原图，覆盖当前玩家和观察队友两个状态，能看到本轮要验证的修改交互。
- 回归说明：`03-玩家面板-显示玩家肖像且地图保留正式Token.jpg` 已降级为旧失败候选；最终证据只认当前重拍的 `01` / `02` 整图。
- 测试说明：没有为这次数据表更新新增新的长期 E2E 文件；复用 `trait-track-ui.e2e.ts` 的真实入口链路验证玩家面板资源与观察交互。

### 用户可见展示

- 已按项目 `show-image-to-user` 规则使用 PureRef 一次性打开 3 张用户验收图：`pure-ref-2026-08-14/00-sequence-index.png`、`pure-ref-2026-08-14/01-labeled-01-属性轨角色板-连续轨指针位置.png`、`pure-ref-2026-08-14/02-labeled-02-属性轨观察队友-连续轨指针位置.png`。
- 原始整屏图保留为 `01-属性轨角色板-连续轨指针位置.jpg` 与 `02-属性轨观察队友-连续轨指针位置.jpg`；PureRef 展示图只是加了序号标题的全尺寸副本。
- PureRef 打开结果：已有进程 `407188`，本次打开后新增进程 `328180`，所以按实际记录为“PureRef 新开进程”，不写成复用了同一窗口。
