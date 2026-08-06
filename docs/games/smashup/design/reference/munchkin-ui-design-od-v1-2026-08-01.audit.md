# Smash Up Munchkin UI 设计稿候选 v1 随图审计

- 当前状态更新：`SUPERSEDED / rejected-as-current-frontend-baseline`
- 更新原因：用户在 2026-08-01 明确指出“如果已经有前端，那么代码设计稿应该和当前前端完全一致”。本 v1 可作为 Munchkin 机制视觉方向候选保留，但不再作为当前前端基线设计稿或后续实现依据。
- 替代稿：`docs/games/smashup/design/reference/munchkin-ui-existing-frontend-design-v2-2026-08-01.png`

- 审计时间：2026-08-01
- 候选图：`docs/games/smashup/design/reference/munchkin-ui-design-od-v1-2026-08-01.png`
- 图片尺寸：1920x1080
- SHA-256：`628EB6C0378216C0880DCAB8D9EB4661FEAB4D548BECC66359CE6CBE7C24DC95`
- 生成路线：`open-design-artifact-candidate`
- Open Design 项目：`D:\codex-home\tools\open-design\.od\projects\smashup-munchkin-ui-design-20260801-112428`
- Open Design artifact：`munchkin-ui-v1.html`
- 渲染来源：`http://127.0.0.1:7456/api/projects/smashup-munchkin-ui-design-20260801-112428/raw/munchkin-ui-v1.html`

## 设计前置证据块

### 本轮实际读取的规则 / 规范文件

- `AGENTS.md`
- `docs/ai-rules/doc-index.md`
- `docs/ai-rules/ui-ux.md`
- `docs/ai-rules/asset-pipeline.md`
- `.codex/skill/boardgame-ui-imagegen/SKILL.md`
- `docs/infra/open-design.md`
- `docs/games/smashup/design/reference/munchkin-ui-design-brief-2026-08-01.md`

### 规则对象结论 -> 画面决策

| 规则对象结论 | 画面决策 |
| --- | --- |
| 怪物是基地上的中立对象，不归属玩家随从 | 焦点基地上方叠放两张怪物卡，使用 `中立 / 力量 / 宝藏` 短徽章，不进入玩家随从行 |
| 宝藏是奖励资源，不是疯狂牌式惩罚牌 | 宝藏出现在奖励托盘、手牌宝藏区和附着卡位，使用金色奖励语法，不做负担牌堆 |
| 怪物 / 宝藏是公共特殊牌堆，不混入普通派系卡池 | 右侧只保留四个紧凑公共入口：怪物牌堆、怪物弃牌、宝藏牌堆、宝藏弃牌 |
| 破基地前需要看玩家力量、怪物总力和宝藏奖励 | 焦点基地旁显示轻量破基地预览，只放短标签和数值 |

### 可见主体素材账本

| 画面主体 | 输入素材 | 状态 |
| --- | --- | --- |
| 三张基地卡 | `temp/smashup-munchkin-ui-imagegen/input-pack/base-*.png` | `design-asset-ready` |
| 中立怪物卡 | `temp/smashup-munchkin-ui-imagegen/input-pack/monster-*.png` | `design-asset-ready` |
| 宝藏牌 | `temp/smashup-munchkin-ui-imagegen/input-pack/treasure-*.png` | `design-asset-ready` |
| 玩家普通派系牌 | `temp/smashup-munchkin-ui-imagegen/input-pack/faction-*.png` | `design-asset-ready` |
| 公共牌堆 / 破基地预览 / 当前动作 | 程序化运行时 UI | `approved-programmatic-runtime-ui` |

### 禁止替代清单

- 禁止把怪物画成玩家随从。
- 禁止把宝藏画成克苏鲁疯狂牌式惩罚负担。
- 禁止使用规则长文、教程正文、日志列或后台面板作为主 UI。
- 禁止用文字壳、抽象图标或空框替代正式卡牌 / 基地 / 怪物 / 宝藏。

## AI 图面核验

| 核验项 | 结论 |
| --- | --- |
| 基地、怪物、宝藏、公共牌堆、玩家手牌和宝藏附着均可见 | PASS |
| 怪物贴附在焦点基地附近，并以中立短徽章表达 | PASS |
| 宝藏以奖励托盘、宝藏手牌和附着形式出现，没有惩罚牌堆语义 | PASS |
| 公共怪物 / 宝藏牌堆紧凑可见，没有压过基地主舞台 | PASS |
| 破基地预览使用短标签和数值，没有规则长文 | PASS |
| 画面第一眼是开放式牌桌和真实卡牌，不是表格 / 线框 / 后台面板 | PASS |

## 交付状态

- AI 图面核验：`PASS`
- 人工验收状态：`human-review-allowed`
- 注意：当前 Codex 会话的 Open Design MCP `start_run` 仍返回 `Transport closed`；本轮使用同一个 Open Design daemon 的官方 project / artifact / raw render 链路生成候选图。`od export` 桌面导出器返回 `UPSTREAM_UNAVAILABLE`，因此 PNG 由本地 Chromium 渲染该 OD artifact 生成。
