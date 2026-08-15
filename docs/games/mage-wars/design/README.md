# 法师战争设计目录索引

> 当前状态：`OPEN_DESIGN_V75_AI_PASS / human-review-allowed-in-chat / implementation-freeze / mobile-blocked-until-pc-approval`。用户明确要求“使用 Open Design，不要生图”，当前有效设计工具是 Open Design artifact 代码设计稿及其渲染截图，不是 `od media generate` 或图片模型生图。v75 保留 v74 的右侧弃牌堆位置和尺寸，但按规则修正公开弃牌堆的显示语义：弃牌堆是可检视公开归档，不是隐藏信息，因此显示紧凑顶牌正面 / 半露正面 + `弃牌 3`。历史版本裁定详见下方“当前裁定”。

## 当前入口

| 类型 | 文件 | 状态 |
| --- | --- | --- |
| Step 1 饱和 UI 设计 | `docs/games/mage-wars/design/reference/step1-runtime-board-saturated-ui-design.md` | `REVISE / rule-ui-semantics-failed`，必须先重构牌区语义 |
| 用户纠正覆盖账本 | `docs/games/mage-wars/design/reference/user-correction-traceability-ledger.md` | `required-before-next-artifact / drift-check`，下一版 Open Design artifact、导出 PNG 和 AI 图面核验前必须逐项消费 |
| 外部 UI 方法论基线 | `docs/games/mage-wars/design/reference/external-ui-methodology-baseline.md` | `required-before-next-design`，下一版 UI 设计和 Open Design 设计稿前必须先消费 |
| Skill 驱动 UI 设计方案 | `docs/games/mage-wars/design/reference/skill-driven-ui-design-options.md` | `ui-design-options / awaiting-user-selection`，列出 A/B/C/D 四套真正不同的结构方案 |
| Skill 方案选择 brief | `docs/games/mage-wars/design/reference/skill-driven-user-selection-brief.md` | `selection-brief / awaiting-user-decision`，给用户快速判断 A/B/C/D 或推荐组合 |
| Skill 方案低保真结构草图 | `docs/games/mage-wars/design/reference/skill-driven-layout-thumbnails.md` | `layout-thumbnails / awaiting-user-decision`，用文字草图展示 A/B/C/D 与推荐组合的布局差异 |
| 多设计稿前基线 | `docs/games/mage-wars/design/generated/step1-runtime-board-opendesign-artifact-v21.png` | `baseline-retained / not-overwritten`，开始多设计稿之前的基线候选，后续新稿必须与它对照 |
| Skill 方案低保真草稿图 v1 | `docs/games/mage-wars/design/generated/skill-drafts/mage-wars-ui-draft-overview.png` | `FAILED / same-page-same-template / user-rejected`，同页同母版失败候选，不得继续作为选择入口 |
| Skill 草稿图 v1 审计 | `docs/games/mage-wars/design/generated/skill-drafts/mage-wars-ui-skill-drafts-v1-audit.md` | `FAILED / final-design-not-approved`，记录失败复盘和后续独立稿要求 |
| v2 独立方案矩阵 | `docs/games/mage-wars/design/generated/skill-drafts-v2/mage-wars-v2-independent-draft-matrix.md` | `brief-matrix-ready / v21-baseline-retained / open-design-artifact-only`，A/B/C/D 独立设计轴矩阵 |
| v2 方案 C brief | `docs/games/mage-wars/design/generated/skill-drafts-v2/mage-wars-v2-option-c-casting-brief.md` | `option-c-brief / consumed-by-option-c-artifact / media-generate-forbidden` |
| v2 方案 C artifact 源 | `D:\codex-home\tools\open-design\.od\projects\mage-wars-ui-design\mage-wars-v2-option-c-casting.html` | `AI_PASS / mediaGenerate=false / pending-human-review` |
| v2 方案 C 审图截图 | `docs/games/mage-wars/design/generated/skill-drafts-v2/mage-wars-v2-option-c-casting.png` | `AI_PASS / human-review-allowed` |
| v2 方案 C 几何审计 | `docs/games/mage-wars/design/generated/skill-drafts-v2/mage-wars-v2-option-c-casting-geometry.json` | `PASS / casting-chain-and-zone-anchor-clear` |
| v2 方案 C 审计 | `docs/games/mage-wars/design/generated/skill-drafts-v2/mage-wars-v2-option-c-casting-audit.md` | `AI_PASS / implementation-blocked-until-user-approval` |
| v3 设计前置包 | `docs/games/mage-wars/design/generated/skill-drafts-v3/mage-wars-v3-ui-design-preflight.md` | `preflight-ready / open-design-artifact-only / media-generate-forbidden` |
| v3 施法结算态 artifact 源 | `D:\codex-home\tools\open-design\.od\projects\mage-wars-ui-design\mage-wars-v3-casting-resolution.html` | `AI_PASS / mediaGenerate=false / pending-human-review` |
| v3 施法结算态 PNG | `docs/games/mage-wars/design/generated/skill-drafts-v3/mage-wars-v3-casting-resolution.png` | `AI_PASS / casting-dice-near-target` |
| v3 法术书计划态 artifact 源 | `D:\codex-home\tools\open-design\.od\projects\mage-wars-ui-design\mage-wars-v3-spellbook-planning.html` | `AI_PASS / mediaGenerate=false / pending-human-review` |
| v3 法术书计划态 PNG | `docs/games/mage-wars/design/generated/skill-drafts-v3/mage-wars-v3-spellbook-planning.png` | `AI_PASS / spellbook-workbench-and-hud-separated` |
| v3 战场指挥态 artifact 源 | `D:\codex-home\tools\open-design\.od\projects\mage-wars-ui-design\mage-wars-v3-battlefield-command.html` | `AI_PASS / mediaGenerate=false / pending-human-review` |
| v3 战场指挥态 PNG | `docs/games/mage-wars/design/generated/skill-drafts-v3/mage-wars-v3-battlefield-command.png` | `AI_PASS / single-action-surface` |
| v3 AI 图面核验 | `docs/games/mage-wars/design/generated/skill-drafts-v3/mage-wars-v3-ai-visual-verdict.md` | `historical-input / superseded-by-v6` |
| v6 设计前置包 | `docs/games/mage-wars/design/generated/skill-drafts-v6/mage-wars-v6-ui-design-preflight.md` | `preflight-ready / open-design-artifact-only / media-generate-forbidden` |
| v6 竞技场战术桌 artifact 源 | `D:\codex-home\tools\open-design\.od\projects\mage-wars-ui-design\mage-wars-v6-arena-tactical-table.html` | `AI_PASS_REVOKED / mediaGenerate=false / same-shell-failure` |
| v6 竞技场战术桌 PNG | `docs/games/mage-wars/design/generated/skill-drafts-v6/mage-wars-v6-arena-tactical-table.png` | `REVISE / same-shell-failure` |
| v6 法术书底部浏览器 artifact 源 | `D:\codex-home\tools\open-design\.od\projects\mage-wars-ui-design\mage-wars-v6-spellbook-bottom-browser.html` | `AI_PASS_REVOKED / mediaGenerate=false / same-shell-failure` |
| v6 法术书底部浏览器 PNG | `docs/games/mage-wars/design/generated/skill-drafts-v6/mage-wars-v6-spellbook-bottom-browser.png` | `REVISE / same-shell-failure` |
| v6 开放施法链路 artifact 源 | `D:\codex-home\tools\open-design\.od\projects\mage-wars-ui-design\mage-wars-v6-open-casting-lane.html` | `AI_PASS_REVOKED / mediaGenerate=false / same-shell-failure` |
| v6 开放施法链路 PNG | `docs/games/mage-wars/design/generated/skill-drafts-v6/mage-wars-v6-open-casting-lane.png` | `REVISE / same-shell-failure` |
| v6 AI 图面核验 | `docs/games/mage-wars/design/generated/skill-drafts-v6/mage-wars-v6-ai-visual-verdict.md` | `AI_PASS_REVOKED / human-review-blocked / implementation-blocked` |
| 主 UI 前置矩阵 | `docs/games/mage-wars/design/implementable/board-ui-preflight-matrix.md` | 已被 v6 与 foundation runtime 消费；继续迭代前仍必须重读 |
| 规则到 UI 元素清单 | `docs/games/mage-wars/design/implementable/rule-to-ui-element-list.md` | `design-preflight-contract / evidence`，从规则、TTS、atlas 和素材合同提炼布局、交互和 UI 元素；下一版设计稿 / Open Design artifact / Board 实现前必须消费 |
| 正式素材输入包 | `docs/games/mage-wars/design/reference/step1-runtime-board-asset-input-manifest.md` | 证明正式资源已复制 / 裁切为 Open Design 输入 |
| Open Design v7 硬回执 | `docs/games/mage-wars/design/reference/step1-runtime-board-pc-redesign-v7-preflight.md` | `REVISE / invalid-default-card-zone` |
| Open Design v7 artifact 源 | `D:\codex-home\tools\open-design\.od\projects\mage-wars-ui-design\mage-wars-step1-runtime-board-v7.html` | `rejected / mediaGenerate=false / invalid-default-card-zone` |
| Open Design v7 审图截图 | `docs/games/mage-wars/design/generated/step1-runtime-board-opendesign-artifact-v7.png` | 历史失败候选，不得打开人工验收 |
| Open Design v7 审计 | `docs/games/mage-wars/design/generated/step1-runtime-board-opendesign-artifact-v7-audit.md` | `AI_PASS_REVOKED / rule-ui-semantics-failed / human-review-blocked` |
| Open Design v8 硬回执 | `docs/games/mage-wars/design/reference/step1-runtime-board-pc-redesign-v8-preflight.md` | `preflight-ready / media-generate-forbidden` |
| Open Design v8 artifact 源 | `D:\codex-home\tools\open-design\.od\projects\mage-wars-ui-design\mage-wars-step1-runtime-board-v8.html` | `REVISE / user-review-failed / mediaGenerate=false` |
| Open Design v8 审图截图 | `docs/games/mage-wars/design/generated/step1-runtime-board-opendesign-artifact-v8.png` | 历史失败候选，不得打开人工验收 |
| Open Design v8 审计 | `docs/games/mage-wars/design/generated/step1-runtime-board-opendesign-artifact-v8-audit.md` | `AI_PASS_REVOKED / interaction-weight-failed / programmatic-ui-quality-failed` |
| Open Design v9 硬回执 | `docs/games/mage-wars/design/reference/step1-runtime-board-pc-redesign-v9-preflight.md` | `REVISE / source-structure-polluted`，源码块重复，不得送验 |
| Open Design v9 artifact 源 | `D:\codex-home\tools\open-design\.od\projects\mage-wars-ui-design\mage-wars-step1-runtime-board-v9.html` | `REVISE / failed-candidate / duplicated-edge-sections` |
| Open Design v10 硬回执 | `docs/games/mage-wars/design/reference/step1-runtime-board-pc-redesign-v10-preflight.md` | `preflight-ready / media-generate-forbidden / human-review-not-allowed` |
| Open Design v10 artifact 源 | `D:\codex-home\tools\open-design\.od\projects\mage-wars-ui-design\mage-wars-step1-runtime-board-v10.html` | `draft-ai-review-pending / mediaGenerate=false` |
| Open Design v11 硬回执 | `docs/games/mage-wars/design/reference/step1-runtime-board-pc-redesign-v11-preflight.md` | `preflight-ready / media-generate-forbidden / human-review-not-allowed` |
| Open Design v11 artifact 源 | `D:\codex-home\tools\open-design\.od\projects\mage-wars-ui-design\mage-wars-step1-runtime-board-v11.html` | `REVISE / AI_PASS_REVOKED / overlap-hard-failure` |
| Open Design v11 审图截图 | `docs/games/mage-wars/design/generated/step1-runtime-board-opendesign-artifact-v11.png` | `REVISE / historical-failed-candidate` |
| Open Design v11 审计 | `docs/games/mage-wars/design/generated/step1-runtime-board-opendesign-artifact-v11-audit.md` | `AI_PASS_REVOKED / implementation-blocked` |
| Open Design v12 硬回执 | `docs/games/mage-wars/design/reference/step1-runtime-board-pc-redesign-v12-preflight.md` | `preflight-ready / media-generate-forbidden / human-review-not-allowed` |
| Open Design v12 artifact 源 | `D:\codex-home\tools\open-design\.od\projects\mage-wars-ui-design\mage-wars-step1-runtime-board-v12.html` | `REVISE / overlap-hard-failure / mediaGenerate=false` |
| Open Design v12 审图截图 | `docs/games/mage-wars/design/generated/step1-runtime-board-opendesign-artifact-v12.png` | `REVISE / historical-failed-candidate` |
| Open Design v12 审计 | `docs/games/mage-wars/design/generated/step1-runtime-board-opendesign-artifact-v12-audit.md` | `REVISE / human-review-blocked` |
| Open Design v13 硬回执 | `docs/games/mage-wars/design/reference/step1-runtime-board-pc-redesign-v13-preflight.md` | `preflight-ready / media-generate-forbidden / human-review-not-allowed` |
| Open Design v13 artifact 源 | `D:\codex-home\tools\open-design\.od\projects\mage-wars-ui-design\mage-wars-step1-runtime-board-v13.html` | `AI_PASS_REVOKED / overlap-hard-failure / mediaGenerate=false` |
| Open Design v13 审图截图 | `docs/games/mage-wars/design/generated/step1-runtime-board-opendesign-artifact-v13.png` | `REVISE / historical-failed-candidate` |
| Open Design v13 审计 | `docs/games/mage-wars/design/generated/step1-runtime-board-opendesign-artifact-v13-audit.md` | `AI_PASS_REVOKED / dice-over-field-card / implementation-blocked` |
| Open Design v14 硬回执 | `docs/games/mage-wars/design/reference/step1-runtime-board-pc-redesign-v14-preflight.md` | `preflight-ready / media-generate-forbidden / human-review-not-allowed` |
| Open Design v14 artifact 源 | `D:\codex-home\tools\open-design\.od\projects\mage-wars-ui-design\mage-wars-step1-runtime-board-v14.html` | `AI_PASS_REVOKED / visual-clutter-failure / mediaGenerate=false` |
| Open Design v14 审图截图 | `docs/games/mage-wars/design/generated/step1-runtime-board-opendesign-artifact-v14.png` | `REVISE / historical-failed-candidate` |
| Open Design v14 审计 | `docs/games/mage-wars/design/generated/step1-runtime-board-opendesign-artifact-v14-audit.md` | `AI_PASS_REVOKED / visual-clutter-failure / implementation-blocked` |
| Open Design v15 硬回执 | `docs/games/mage-wars/design/reference/step1-runtime-board-pc-redesign-v15-preflight.md` | `preflight-ready / media-generate-forbidden / human-review-not-allowed` |
| Open Design v15 artifact 源 | `D:\codex-home\tools\open-design\.od\projects\mage-wars-ui-design\mage-wars-step1-runtime-board-v15.html` | `AI_PASS_REVOKED / visual-overlap-failure / mediaGenerate=false` |
| Open Design v15 审图截图 | `docs/games/mage-wars/design/generated/step1-runtime-board-opendesign-artifact-v15.png` | `REVISE / historical-failed-candidate` |
| Open Design v15 审计 | `docs/games/mage-wars/design/generated/step1-runtime-board-opendesign-artifact-v15-audit.md` | `AI_PASS_REVOKED / visual-overlap-failure / implementation-blocked` |
| Open Design v16 硬回执 | `docs/games/mage-wars/design/reference/step1-runtime-board-pc-redesign-v16-preflight.md` | `REVISE / visual-overlap-risk / human-review-blocked` |
| Open Design v16 artifact 源 | `D:\codex-home\tools\open-design\.od\projects\mage-wars-ui-design\mage-wars-step1-runtime-board-v16.html` | `REVISE / visual-overlap-risk / mediaGenerate=false` |
| Open Design v16 审图截图 | `docs/games/mage-wars/design/generated/step1-runtime-board-opendesign-artifact-v16.png` | `REVISE / historical-failed-candidate` |
| Open Design v16 审计 | `docs/games/mage-wars/design/generated/step1-runtime-board-opendesign-artifact-v16-audit.md` | `REVISE / visual-overlap-risk / implementation-blocked` |
| Open Design v17 硬回执 | `docs/games/mage-wars/design/reference/step1-runtime-board-pc-redesign-v17-preflight.md` | `preflight-ready / media-generate-forbidden / human-review-not-allowed-until-ai-pass` |
| Open Design v17 artifact 源 | `D:\codex-home\tools\open-design\.od\projects\mage-wars-ui-design\mage-wars-step1-runtime-board-v17.html` | `AI_PASS_REVOKED / dice-settlement-misplaced / mediaGenerate=false` |
| Open Design v17 审图截图 | `docs/games/mage-wars/design/generated/step1-runtime-board-opendesign-artifact-v17.png` | `REVISE / historical-failed-candidate` |
| Open Design v17 审计 | `docs/games/mage-wars/design/generated/step1-runtime-board-opendesign-artifact-v17-audit.md` | `AI_PASS_REVOKED / dice-settlement-misplaced / implementation-blocked` |
| Open Design v18 硬回执 | `docs/games/mage-wars/design/reference/step1-runtime-board-pc-redesign-v18-preflight.md` | `preflight-ready / media-generate-forbidden / human-review-not-allowed-until-ai-pass` |
| Open Design v18 artifact 源 | `D:\codex-home\tools\open-design\.od\projects\mage-wars-ui-design\mage-wars-step1-runtime-board-v18.html` | `AI_PASS_REVOKED / zone-anchoring-failed / mediaGenerate=false` |
| Open Design v18 审图截图 | `docs/games/mage-wars/design/generated/step1-runtime-board-opendesign-artifact-v18.png` | `REVISE / historical-failed-candidate` |
| Open Design v18 审计 | `docs/games/mage-wars/design/generated/step1-runtime-board-opendesign-artifact-v18-audit.md` | `AI_PASS_REVOKED / zone-anchoring-failed / implementation-blocked` |
| Open Design v19 参考基线 | `docs/games/mage-wars/design/reference/step1-runtime-board-pc-redesign-v19-reference-baseline.md` | `reference-baseline-required / no-skin-copy / implementation-blocked` |
| Open Design v19 硬回执 | `docs/games/mage-wars/design/reference/step1-runtime-board-pc-redesign-v19-preflight.md` | `consumed-by-v19-ai-pass / media-generate-forbidden / preflight-only` |
| Open Design v19 artifact 源 | `D:\codex-home\tools\open-design\.od\projects\mage-wars-ui-design\mage-wars-step1-runtime-board-v19.html` | `AI_PASS / mediaGenerate=false / pending-human-review` |
| Open Design v19 审图截图 | `docs/games/mage-wars/design/generated/step1-runtime-board-opendesign-artifact-v19.png` | `AI_PASS / human-review-allowed` |
| Open Design v19 几何审计 | `docs/games/mage-wars/design/generated/step1-runtime-board-opendesign-artifact-v19-geometry.json` | `PASS / zone-anchor-and-settlement-clear` |
| Open Design v19 审计 | `docs/games/mage-wars/design/generated/step1-runtime-board-opendesign-artifact-v19-audit.md` | `AI_PASS / implementation-blocked-until-user-approval` |
| Open Design v19 目标收口矩阵 | `docs/games/mage-wars/design/generated/step1-runtime-board-v19-goal-closeout.md` | `ai-closeout-complete / pending-user-human-review` |
| Open Design v20 硬回执 | `docs/games/mage-wars/design/reference/step1-runtime-board-pc-redesign-v20-preflight.md` | `consumed-by-v20-ai-pass / media-generate-forbidden / preflight-only` |
| Open Design v20 artifact 源 | `D:\codex-home\tools\open-design\.od\projects\mage-wars-ui-design\mage-wars-step1-runtime-board-v20.html` | `AI_PASS / mediaGenerate=false / pending-human-review` |
| Open Design v20 审图截图 | `docs/games/mage-wars/design/generated/step1-runtime-board-opendesign-artifact-v20.png` | `AI_PASS / human-review-allowed` |
| Open Design v20 几何审计 | `docs/games/mage-wars/design/generated/step1-runtime-board-opendesign-artifact-v20-geometry.json` | `PASS / zone-first-grid-and-card-anchor-clear` |
| Open Design v20 审计 | `docs/games/mage-wars/design/generated/step1-runtime-board-opendesign-artifact-v20-audit.md` | `AI_PASS / implementation-blocked-until-user-approval` |
| Open Design v21 硬回执 | `docs/games/mage-wars/design/reference/step1-runtime-board-pc-redesign-v21-preflight.md` | `consumed-by-v21-ai-pass / media-generate-forbidden / preflight-only` |
| Open Design v21 artifact 源 | `D:\codex-home\tools\open-design\.od\projects\mage-wars-ui-design\mage-wars-step1-runtime-board-v21.html` | `AI_PASS / mediaGenerate=false / pending-human-review` |
| Open Design v21 审图截图 | `docs/games/mage-wars/design/generated/step1-runtime-board-opendesign-artifact-v21.png` | `AI_PASS / human-review-allowed` |
| Open Design v21 几何审计 | `docs/games/mage-wars/design/generated/step1-runtime-board-opendesign-artifact-v21-geometry.json` | `PASS / horizontal-hud-and-spellbook-browser-clear` |
| Open Design v21 审计 | `docs/games/mage-wars/design/generated/step1-runtime-board-opendesign-artifact-v21-audit.md` | `AI_PASS / implementation-blocked-until-user-approval` |
| Open Design v23 硬回执 | `docs/games/mage-wars/design/reference/step1-runtime-board-pc-redesign-v23-preflight.md` | `consumed-by-v23-ai-pass / media-generate-forbidden / preflight-only` |
| Open Design v23 artifact 源 | `D:\codex-home\tools\open-design\.od\projects\mage-wars-ui-design\mage-wars-step1-runtime-board-v23.html` | `AI_PASS / mediaGenerate=false / pending-human-review` |
| Open Design v23 元数据 | `D:\codex-home\tools\open-design\.od\projects\mage-wars-ui-design\mage-wars-step1-runtime-board-v23.html.artifact.json` | `mediaGenerate=false`，Open Design artifact 路线 |
| Open Design v23 审图截图 | `docs/games/mage-wars/design/generated/step1-runtime-board-opendesign-artifact-v23.png` | `AI_PASS / human-review-allowed` |
| Open Design v23 几何审计 | `docs/games/mage-wars/design/generated/step1-runtime-board-opendesign-artifact-v23-geometry.json` | `PASS / zone-anchor-and-dice-target-proximity-clear` |
| Open Design v23 审计 | `docs/games/mage-wars/design/generated/step1-runtime-board-opendesign-artifact-v23-audit.md` | `AI_PASS / implementation-blocked-until-user-approval / mobile-blocked-until-pc-approval` |
| Open Design v25 硬回执 | `docs/games/mage-wars/design/reference/step1-runtime-board-pc-redesign-v25-preflight.md` | `REVISE / human-review-blocked / failed-candidate` |
| Open Design v25 artifact 源 | `D:\codex-home\tools\open-design\.od\projects\mage-wars-ui-design\mage-wars-step1-runtime-board-v25.html` | `REVISE / mediaGenerate=false / failed-candidate` |
| Open Design v25 审图截图 | `docs/games/mage-wars/design/generated/step1-runtime-board-opendesign-artifact-v25.png` | `REVISE / bottom-spellbook-rail-clipped / human-review-blocked` |
| Open Design v25 几何审计 | `docs/games/mage-wars/design/generated/step1-runtime-board-opendesign-artifact-v25-geometry.json` | `REVISE / candidates-outside-rail` |
| Open Design v25 审计 | `docs/games/mage-wars/design/generated/step1-runtime-board-opendesign-artifact-v25-audit.md` | `REVISE / implementation-blocked` |
| Open Design v26 硬回执 | `docs/games/mage-wars/design/reference/step1-runtime-board-pc-redesign-v26-preflight.md` | `REVISE / user-review-failed / media-generate-forbidden / preflight-only` |
| Open Design v26 artifact 源 | `D:\codex-home\tools\open-design\.od\projects\mage-wars-ui-design\mage-wars-step1-runtime-board-v26.html` | `AI_PASS_REVOKED / mediaGenerate=false / user-review-failed` |
| Open Design v26 元数据 | `D:\codex-home\tools\open-design\.od\projects\mage-wars-ui-design\mage-wars-step1-runtime-board-v26.html.artifact.json` | `mediaGenerate=false`，Open Design artifact 路线 |
| Open Design v26 审图截图 | `docs/games/mage-wars/design/generated/step1-runtime-board-opendesign-artifact-v26.png` | `REVISE / visible-bottom-container / confirm-away-from-prepared` |
| Open Design v26 几何审计 | `docs/games/mage-wars/design/generated/step1-runtime-board-opendesign-artifact-v26-geometry.json` | `PASS / player-identity-and-spell-rail-clear` |
| Open Design v26 审计 | `docs/games/mage-wars/design/generated/step1-runtime-board-opendesign-artifact-v26-audit.md` | `AI_PASS_REVOKED / user-review-failed / implementation-blocked` |
| Open Design v27 硬回执 | `docs/games/mage-wars/design/reference/step1-runtime-board-pc-redesign-v27-preflight.md` | `REVISE / ai-visual-review-failed / media-generate-forbidden / preflight-only` |
| Open Design v27 artifact 源 | `D:\codex-home\tools\open-design\.od\projects\mage-wars-ui-design\mage-wars-step1-runtime-board-v27.html` | `REVISE / mediaGenerate=false / intermediate-failed-candidate` |
| Open Design v27 元数据 | `D:\codex-home\tools\open-design\.od\projects\mage-wars-ui-design\mage-wars-step1-runtime-board-v27.html.artifact.json` | `mediaGenerate=false`，Open Design artifact 路线 |
| Open Design v27 审图截图 | `docs/games/mage-wars/design/generated/step1-runtime-board-opendesign-artifact-v27.png` | `REVISE / tabs-still-filter-like / controls-still-floating` |
| Open Design v27 几何审计 | `docs/games/mage-wars/design/generated/step1-runtime-board-opendesign-artifact-v27-geometry.json` | `PASS / geometry-only` |
| Open Design v27 审计 | `docs/games/mage-wars/design/generated/step1-runtime-board-opendesign-artifact-v27-audit.md` | `REVISE / human-review-blocked / implementation-blocked` |
| Open Design v28 硬回执 | `docs/games/mage-wars/design/reference/step1-runtime-board-pc-redesign-v28-preflight.md` | `AI_PASS_REVOKED / layer-model-missing / confirm-authorization-missing` |
| Open Design v28 artifact 源 | `D:\codex-home\tools\open-design\.od\projects\mage-wars-ui-design\mage-wars-step1-runtime-board-v28.html` | `AI_PASS_REVOKED / mediaGenerate=false / user-review-failed` |
| Open Design v28 元数据 | `D:\codex-home\tools\open-design\.od\projects\mage-wars-ui-design\mage-wars-step1-runtime-board-v28.html.artifact.json` | `mediaGenerate=false`，Open Design artifact 路线 |
| Open Design v28 审图截图 | `docs/games/mage-wars/design/generated/step1-runtime-board-opendesign-artifact-v28.png` | `REVISE / human-review-blocked / layer-model-failed` |
| Open Design v28 几何审计 | `docs/games/mage-wars/design/generated/step1-runtime-board-opendesign-artifact-v28-geometry.json` | `geometry-only / cannot-prove-rule-action-model` |
| Open Design v28 审计 | `docs/games/mage-wars/design/generated/step1-runtime-board-opendesign-artifact-v28-audit.md` | `AI_PASS_REVOKED / rule-action-model-failed / implementation-blocked` |
| Open Design v29 硬回执 | `docs/games/mage-wars/design/reference/step1-runtime-board-pc-redesign-v29-preflight.md` | `REVISE / visual-review-failed / prepared-card-too-close-to-field-card` |
| Open Design v29 artifact 源 | `D:\codex-home\tools\open-design\.od\projects\mage-wars-ui-design\mage-wars-step1-runtime-board-v29.html` | `REVISE / mediaGenerate=false / intermediate-failed-candidate` |
| Open Design v29 元数据 | `D:\codex-home\tools\open-design\.od\projects\mage-wars-ui-design\mage-wars-step1-runtime-board-v29.html.artifact.json` | `mediaGenerate=false`，Open Design artifact 路线 |
| Open Design v29 审图截图 | `docs/games/mage-wars/design/generated/step1-runtime-board-opendesign-artifact-v29.png` | `REVISE / prepared-card-too-close-to-field-card` |
| Open Design v29 几何审计 | `docs/games/mage-wars/design/generated/step1-runtime-board-opendesign-artifact-v29-geometry.json` | `geometry-pass-but-visual-failed` |
| Open Design v29 审计 | `docs/games/mage-wars/design/generated/step1-runtime-board-opendesign-artifact-v29-audit.md` | `REVISE / AI_VISUAL_REVIEW_FAILED / implementation-blocked` |
| Open Design v30 硬回执 | `docs/games/mage-wars/design/reference/step1-runtime-board-pc-redesign-v30-preflight.md` | `AI_PASS_REVOKED / user-review-failed / readability-and-space-budget-missing` |
| Open Design v30 artifact 源 | `D:\codex-home\tools\open-design\.od\projects\mage-wars-ui-design\mage-wars-step1-runtime-board-v30.html` | `REVISE / mediaGenerate=false / failed-candidate` |
| Open Design v30 元数据 | `D:\codex-home\tools\open-design\.od\projects\mage-wars-ui-design\mage-wars-step1-runtime-board-v30.html.artifact.json` | `mediaGenerate=false`，Open Design artifact 路线 |
| Open Design v30 审图截图 | `docs/games/mage-wars/design/generated/step1-runtime-board-opendesign-artifact-v30.png` | `REVISE / card-zone-unreadable / center-stage-overcrowded / human-review-blocked` |
| Open Design v30 几何审计 | `docs/games/mage-wars/design/generated/step1-runtime-board-opendesign-artifact-v30-geometry.json` | `geometry-pass-only / cannot-prove-player-readable` |
| Open Design v30 审计 | `docs/games/mage-wars/design/generated/step1-runtime-board-opendesign-artifact-v30-audit.md` | `AI_PASS_REVOKED / user-review-failed / implementation-blocked / mobile-blocked-until-pc-approval` |
| Open Design v31 硬回执 | `docs/games/mage-wars/design/reference/step1-runtime-board-pc-redesign-v31-preflight.md` | `AI_PASS_REVOKED / user-review-failed / readability-gate-insufficient` |
| Open Design v31 artifact 源 | `D:\codex-home\tools\open-design\.od\projects\mage-wars-ui-design\mage-wars-step1-runtime-board-v31.html` | `REVISE / mediaGenerate=false / failed-candidate` |
| Open Design v31 元数据 | `D:\codex-home\tools\open-design\.od\projects\mage-wars-ui-design\mage-wars-step1-runtime-board-v31.html.artifact.json` | `mediaGenerate=false`，Open Design artifact 路线 |
| Open Design v31 审图截图 | `docs/games/mage-wars/design/generated/step1-runtime-board-opendesign-artifact-v31.png` | `REVISE / bottom-card-zone-unreadable / center-stage-still-overcrowded` |
| Open Design v31 几何审计 | `docs/games/mage-wars/design/generated/step1-runtime-board-opendesign-artifact-v31-geometry.json` | `geometry-pass-only / user-review-failed` |
| Open Design v31 审计 | `docs/games/mage-wars/design/generated/step1-runtime-board-opendesign-artifact-v31-audit.md` | `AI_PASS_REVOKED / user-review-failed / implementation-blocked` |
| Open Design v32 硬回执 | `docs/games/mage-wars/design/reference/step1-runtime-board-pc-redesign-v32-preflight.md` | `preflight-ready / media-generate-forbidden / external-pattern-backed` |
| Open Design v32 artifact 源 | `D:\codex-home\tools\open-design\.od\projects\mage-wars-ui-design\mage-wars-step1-runtime-board-v32.html` | `AI_PASS_REVOKED / mediaGenerate=false / user-review-failed` |
| Open Design v32 元数据 | `D:\codex-home\tools\open-design\.od\projects\mage-wars-ui-design\mage-wars-step1-runtime-board-v32.html.artifact.json` | `mediaGenerate=false`，Open Design artifact 路线 |
| Open Design v32 审图截图 | `docs/games/mage-wars/design/generated/step1-runtime-board-opendesign-artifact-v32.png` | `REVISE / historical-failed-candidate / current-spell-readable-but-user-rejected` |
| Open Design v32 几何审计 | `docs/games/mage-wars/design/generated/step1-runtime-board-opendesign-artifact-v32-geometry.json` | `geometry-pass-only / user-review-failed` |
| Open Design v32 审计 | `docs/games/mage-wars/design/generated/step1-runtime-board-opendesign-artifact-v32-audit.md` | `AI_PASS_REVOKED / user-review-failed / implementation-blocked` |
| Open Design v34 硬回执 | `docs/games/mage-wars/design/reference/step1-runtime-board-pc-redesign-v34-preflight.md` | `preflight-ready / media-generate-forbidden / v32-user-review-failed` |
| Open Design v34 artifact 源 | `D:\codex-home\tools\open-design\.od\projects\mage-wars-ui-design\mage-wars-step1-runtime-board-v34.html` | `AI_PASS_REVOKED / mediaGenerate=false / center-pressure-failed` |
| Open Design v34 审图截图 | `docs/games/mage-wars/design/generated/step1-runtime-board-opendesign-artifact-v34.png` | `REVISE / player-readability-and-center-pressure-failed` |
| Open Design v34 几何审计 | `docs/games/mage-wars/design/generated/step1-runtime-board-opendesign-artifact-v34-geometry.json` | `geometry-pass-player-failed` |
| Open Design v34 审计 | `docs/games/mage-wars/design/generated/step1-runtime-board-opendesign-artifact-v34-audit.md` | `AI_PASS_REVOKED / human-review-blocked / implementation-blocked` |
| Open Design v35 硬回执 | `docs/games/mage-wars/design/reference/step1-runtime-board-pc-redesign-v35-preflight.md` | `preflight-ready / media-generate-forbidden / v34-ai-pass-revoked` |
| Open Design v35 artifact 源 | `D:\codex-home\tools\open-design\.od\projects\mage-wars-ui-design\mage-wars-step1-runtime-board-v35.html` | `AI_PASS_REVOKED / mediaGenerate=false / low-quality-programmatic-effect-die` |
| Open Design v35 审图截图 | `docs/games/mage-wars/design/generated/step1-runtime-board-opendesign-artifact-v35.png` | `REVISE / low-quality-programmatic-effect-die` |
| Open Design v35 几何审计 | `docs/games/mage-wars/design/generated/step1-runtime-board-opendesign-artifact-v35-geometry.json` | `PASS / geometry-only` |
| Open Design v35 审计 | `docs/games/mage-wars/design/generated/step1-runtime-board-opendesign-artifact-v35-audit.md` | `AI_PASS_REVOKED / human-review-blocked / implementation-blocked` |
| Open Design v36 硬回执 | `docs/games/mage-wars/design/reference/step1-runtime-board-pc-redesign-v36-preflight.md` | `preflight-ready / media-generate-forbidden / v34-ai-pass-revoked` |
| Open Design v36 artifact 源 | `D:\codex-home\tools\open-design\.od\projects\mage-wars-ui-design\mage-wars-step1-runtime-board-v36.html` | `AI_PASS / mediaGenerate=false / pending-human-review` |
| Open Design v36 审图截图 | `docs/games/mage-wars/design/generated/step1-runtime-board-opendesign-artifact-v36.png` | `AI_PASS / human-review-allowed / physical-effect-die-and-clear-workbench` |
| Open Design v36 几何审计 | `docs/games/mage-wars/design/generated/step1-runtime-board-opendesign-artifact-v36-geometry.json` | `PASS / no-overlap-and-current-workbench-clear` |
| Open Design v36 审计 | `docs/games/mage-wars/design/generated/step1-runtime-board-opendesign-artifact-v36-audit.md` | `AI_PASS / implementation-blocked-until-user-approval / mobile-blocked-until-pc-approval` |
| Open Design v37 硬回执 | `docs/games/mage-wars/design/reference/step1-runtime-board-pc-redesign-v37-preflight.md` | `REVISE / player-workflow-insufficient / human-review-blocked` |
| Open Design v37 artifact 源 | `D:\codex-home\tools\open-design\.od\projects\mage-wars-ui-design\mage-wars-step1-runtime-board-v37.html` | `REVISE / mediaGenerate=false / failed-candidate` |
| Open Design v37 审图截图 | `docs/games/mage-wars/design/generated/step1-runtime-board-opendesign-artifact-v37.png` | `REVISE / source-target-workbench-weak / human-review-blocked` |
| Open Design v37 几何审计 | `docs/games/mage-wars/design/generated/step1-runtime-board-opendesign-artifact-v37-geometry.json` | `geometry-pass-player-workflow-failed` |
| Open Design v37 审计 | `docs/games/mage-wars/design/generated/step1-runtime-board-opendesign-artifact-v37-audit.md` | `AI_PASS_REVOKED / implementation-blocked / mobile-blocked` |
| Open Design v38 硬回执 | `docs/games/mage-wars/design/reference/step1-runtime-board-pc-redesign-v38-preflight.md` | `in-progress / media-generate-forbidden / target-confirmation-workbench` |
| Open Design v38 artifact 源 | `D:\codex-home\tools\open-design\.od\projects\mage-wars-ui-design\mage-wars-step1-runtime-board-v38.html` | `pending-generation / mediaGenerate=false` |
| Open Design v42 法术书计划态 artifact 源 | `D:\codex-home\tools\open-design\.od\projects\mage-wars-ui-design\mage-wars-step1-spellbook-planning-v42.html` | `AI_PASS_CANDIDATE / mediaGenerate=false / planning-capacity-reference` |
| Open Design v42 法术书计划态 PNG | `docs/games/mage-wars/design/generated/step1-spellbook-planning-opendesign-artifact-v42.png` | `AI_PASS_CANDIDATE / spellbook-capacity-reference / not-current-human-review-target` |
| Open Design v43 统一来源目标工作台 PNG | `docs/games/mage-wars/design/generated/step1-unified-source-target-workbench-opendesign-artifact-v43.png` | `REVISE / workbench-overlaps-field-cards / confirm-too-far` |
| Open Design v44 统一动作工作台 artifact 源 | `D:\codex-home\tools\open-design\.od\projects\mage-wars-ui-design\mage-wars-step1-unified-action-workbench-v44.html` | `AI_PASS_REVOKED / mediaGenerate=false / actionable-objects-lost` |
| Open Design v44 统一动作工作台 PNG | `docs/games/mage-wars/design/generated/step1-unified-action-workbench-opendesign-artifact-v44.png` | `REVISE / human-review-blocked / actionable-objects-lost` |
| Open Design v44 几何审计 | `docs/games/mage-wars/design/generated/step1-unified-action-workbench-opendesign-artifact-v44-geometry.json` | `geometry-only / insufficient-player-workflow-proof` |
| Open Design v45 行动来源与法术书守恒 artifact 源 | `D:\codex-home\tools\open-design\.od\projects\mage-wars-ui-design\mage-wars-step1-action-redesign-v45.html` | `AI_PASS_REVOKED / mediaGenerate=false / closed-workbench-and-confirm-control` |
| Open Design v45 行动来源与法术书守恒 PNG | `docs/games/mage-wars/design/generated/step1-action-redesign-opendesign-artifact-v45.png` | `REVISE / human-review-blocked / closed-workbench-and-confirm-control` |
| Open Design v45 几何审计 | `docs/games/mage-wars/design/generated/step1-action-redesign-opendesign-artifact-v45-geometry.json` | `geometry-only / insufficient-open-table-proof` |
| Open Design v45 审计 | `docs/games/mage-wars/design/generated/step1-action-redesign-opendesign-artifact-v45-audit.md` | `AI_PASS_REVOKED / implementation-blocked / mobile-blocked` |
| Open Design v46 开放式行动层 artifact 源 | `D:\codex-home\tools\open-design\.od\projects\mage-wars-ui-design\mage-wars-step1-open-action-layer-v46.html` | `AI_PASS_REVOKED / mediaGenerate=false / omitted-dice-token-user-marked-elements` |
| Open Design v46 开放式行动层 PNG | `docs/games/mage-wars/design/generated/step1-open-action-layer-opendesign-artifact-v46.png` | `REVISE / human-review-blocked / omitted-dice-token-user-marked-elements` |
| Open Design v46 几何审计 | `docs/games/mage-wars/design/generated/step1-open-action-layer-opendesign-artifact-v46-geometry.json` | `geometry-only / obsolete-player-workflow-proof` |
| Open Design v46 审计 | `docs/games/mage-wars/design/generated/step1-open-action-layer-opendesign-artifact-v46-audit.md` | `AI_PASS_REVOKED / human-review-blocked / implementation-blocked / mobile-blocked` |
| Open Design v47 标注图饱和布局硬回执 | `docs/games/mage-wars/design/reference/step1-annotated-saturated-v47-preflight.md` | `preflight-ready / media-generate-forbidden / user-marked-elements-conserved` |
| Open Design v47 标注图饱和布局 artifact 源 | `D:\codex-home\tools\open-design\.od\projects\mage-wars-ui-design\mage-wars-step1-annotated-saturated-v47.html` | `AI_PASS_REVOKED / mediaGenerate=false / user-questioned-rule-necessity` |
| Open Design v47 标注图饱和布局 PNG | `docs/games/mage-wars/design/generated/step1-annotated-saturated-opendesign-artifact-v47.png` | `REVISE / human-review-blocked / opponent-plan-symmetry-failed` |
| Open Design v47 几何审计 | `docs/games/mage-wars/design/generated/step1-annotated-saturated-opendesign-artifact-v47-geometry.json` | `geometry-only / insufficient-rule-necessity-proof` |
| Open Design v47 审计 | `docs/games/mage-wars/design/generated/step1-annotated-saturated-opendesign-artifact-v47-audit.md` | `AI_PASS_REVOKED / implementation-blocked / mobile-blocked / v48-required` |
| Open Design v48 标注图饱和布局硬回执 | `docs/games/mage-wars/design/reference/step1-annotated-saturated-v48-preflight.md` | `preflight-ready / media-generate-forbidden / opponent-plan-symmetry-and-rule-necessity-fixed` |
| Open Design v48 标注图饱和布局 artifact 源 | `D:\codex-home\tools\open-design\.od\projects\mage-wars-ui-design\mage-wars-step1-annotated-saturated-v48.html` | `AI_PASS / mediaGenerate=false / human-review-allowed` |
| Open Design v48 标注图饱和布局 PNG | `docs/games/mage-wars/design/generated/step1-annotated-saturated-opendesign-artifact-v48.png` | `AI_PASS / human-review-allowed / implementation-blocked-until-user-approval` |
| Open Design v48 几何审计 | `docs/games/mage-wars/design/generated/step1-annotated-saturated-opendesign-artifact-v48-geometry.json` | `PASS / opponent-plan-left-top / page-corner-pagination / dice-token-present` |
| Open Design v48 审计 | `docs/games/mage-wars/design/generated/step1-annotated-saturated-opendesign-artifact-v48-audit.md` | `AI_PASS / implementation-blocked / mobile-blocked` |
| Open Design v49 标注图饱和布局硬回执 | `docs/games/mage-wars/design/reference/step1-annotated-saturated-v49-preflight.md` | `superseded-by-v50 / entity-anchor-incomplete` |
| Open Design v49 标注图饱和布局 artifact 源 | `D:\codex-home\tools\open-design\.od\projects\mage-wars-ui-design\mage-wars-step1-annotated-saturated-v49.html` | `superseded-by-v50 / mediaGenerate=false / human-review-not-allowed` |
| Open Design v49 标注图饱和布局 PNG | `docs/games/mage-wars/design/generated/step1-annotated-saturated-opendesign-artifact-v49.png` | `superseded-by-v50 / human-review-not-allowed` |
| Open Design v49 几何审计 | `docs/games/mage-wars/design/generated/step1-annotated-saturated-opendesign-artifact-v49-geometry.json` | `geometry-only / superseded-by-v50` |
| Open Design v50 标注图饱和布局硬回执 | `docs/games/mage-wars/design/reference/step1-annotated-saturated-v50-preflight.md` | `historical / ai-pass-revoked / proxy-ui-failed` |
| Open Design v50 标注图饱和布局 artifact 源 | `D:\codex-home\tools\open-design\.od\projects\mage-wars-ui-design\mage-wars-step1-annotated-saturated-v50.html` | `REVISE / mediaGenerate=false / human-review-blocked` |
| Open Design v50 元数据 | `D:\codex-home\tools\open-design\.od\projects\mage-wars-ui-design\mage-wars-step1-annotated-saturated-v50.html.artifact.json` | `AI_PASS_REVOKED / mediaGenerate=false / superseded-by-v51-required` |
| Open Design v50 标注图饱和布局 PNG | `docs/games/mage-wars/design/generated/step1-annotated-saturated-opendesign-artifact-v50.png` | `REVISE / historical-failed-candidate / human-review-blocked` |
| Open Design v50 几何审计 | `docs/games/mage-wars/design/generated/step1-annotated-saturated-opendesign-artifact-v50-geometry.json` | `geometry-only / old-pass-insufficient` |
| Open Design v50 审计 | `docs/games/mage-wars/design/generated/step1-annotated-saturated-opendesign-artifact-v50-audit.md` | `AI_PASS_REVOKED / open-direct-selection-failed / implementation-blocked / mobile-blocked` |
| Open Design v51 开放式直选硬回执 | `docs/games/mage-wars/design/reference/step1-annotated-saturated-v51-preflight.md` | `historical-preflight / superseded-by-v52-required` |
| Open Design v51 开放式直选 artifact 源 | `D:\codex-home\tools\open-design\.od\projects\mage-wars-ui-design\mage-wars-step1-annotated-saturated-v51.html` | `AI_PASS_REVOKED / mediaGenerate=false / human-review-blocked` |
| Open Design v51 元数据 | `D:\codex-home\tools\open-design\.od\projects\mage-wars-ui-design\mage-wars-step1-annotated-saturated-v51.html.artifact.json` | `AI_PASS_REVOKED / mediaGenerate=false / superseded-by-v52-required` |
| Open Design v51 开放式直选 PNG | `docs/games/mage-wars/design/generated/step1-annotated-saturated-opendesign-artifact-v51.png` | `REVISE / historical-failed-candidate / human-review-blocked` |
| Open Design v51 几何审计 | `docs/games/mage-wars/design/generated/step1-annotated-saturated-opendesign-artifact-v51-geometry.json` | `geometry-only / old-pass-insufficient / layer-budget-failed` |
| Open Design v51 审计 | `docs/games/mage-wars/design/generated/step1-annotated-saturated-opendesign-artifact-v51-audit.md` | `AI_PASS_REVOKED / bottom-map-layer-misread / implementation-blocked / mobile-blocked` |
| Open Design v55 底图最低层开放叠层 artifact 源 | `D:\codex-home\tools\open-design\.od\projects\mage-wars-ui-design\mage-wars-step1-annotated-saturated-v55.html` | `AI_PASS_REVOKED / mediaGenerate=false / repeated-card-face-fields` |
| Open Design v55 元数据 | `D:\codex-home\tools\open-design\.od\projects\mage-wars-ui-design\mage-wars-step1-annotated-saturated-v55.html.artifact.json` | `AI_PASS_REVOKED / implementation-blocked` |
| Open Design v55 PNG | `docs/games/mage-wars/design/generated/step1-annotated-saturated-opendesign-artifact-v55.png` | `REVISE / historical-failed-candidate` |
| Open Design v55 几何审计 | `docs/games/mage-wars/design/generated/step1-annotated-saturated-opendesign-artifact-v55-geometry.json` | `geometry-only / old-pass-insufficient` |
| Open Design v55 审计 | `docs/games/mage-wars/design/generated/step1-annotated-saturated-opendesign-artifact-v55-audit.md` | `AI_PASS_REVOKED / card-readability-failed / human-review-blocked` |
| Open Design v56 卡面去复读与读卡尺寸 artifact 源 | `D:\codex-home\tools\open-design\.od\projects\mage-wars-ui-design\mage-wars-step1-annotated-saturated-v56.html` | `AI_PASS_REVOKED / REVISE / card-scale-ratio-failed` |
| Open Design v56 元数据 | `D:\codex-home\tools\open-design\.od\projects\mage-wars-ui-design\mage-wars-step1-annotated-saturated-v56.html.artifact.json` | `AI_PASS_REVOKED / human-review-blocked` |
| Open Design v56 PNG | `docs/games/mage-wars/design/generated/step1-annotated-saturated-opendesign-artifact-v56.png` | `REVISE / card-scale-ratio-failed / human-review-blocked` |
| Open Design v56 几何审计 | `docs/games/mage-wars/design/generated/step1-annotated-saturated-opendesign-artifact-v56-geometry.json` | `geometry-only / insufficient-player-ratio-evidence` |
| Open Design v56 审计 | `docs/games/mage-wars/design/generated/step1-annotated-saturated-opendesign-artifact-v56-audit.md` | `AI_PASS_REVOKED / REVISE / card-scale-ratio-failed` |
| Open Design v57 卡牌比例前置回执 | `docs/games/mage-wars/design/reference/step1-annotated-saturated-v57-ratio-preflight.md` | `consumed-by-v57-ai-pass / open-design-artifact-only / media-generate-forbidden` |
| Open Design v57 卡牌比例重构 artifact 源 | `D:\codex-home\tools\open-design\.od\projects\mage-wars-ui-design\mage-wars-step1-annotated-saturated-v57.html` | `AI_PASS_REVOKED / mediaGenerate=false / spellbook-page-density-failed` |
| Open Design v57 元数据 | `D:\codex-home\tools\open-design\.od\projects\mage-wars-ui-design\mage-wars-step1-annotated-saturated-v57.html.artifact.json` | `AI_PASS_REVOKED / human-review-blocked` |
| Open Design v57 PNG | `docs/games/mage-wars/design/generated/step1-annotated-saturated-opendesign-artifact-v57.png` | `REVISE / spellbook-page-density-failed / prepared-zone-placement-failed` |
| Open Design v57 几何审计 | `docs/games/mage-wars/design/generated/step1-annotated-saturated-opendesign-artifact-v57-geometry.json` | `geometry-only / insufficient-player-density-evidence` |
| Open Design v57 审计 | `docs/games/mage-wars/design/generated/step1-annotated-saturated-opendesign-artifact-v57-audit.md` | `AI_PASS_REVOKED / REVISE / selected-state-layout-stability-failed` |
| Open Design v58 法术书密度前置回执 | `docs/games/mage-wars/design/reference/step1-annotated-saturated-v58-page-density-preflight.md` | `consumed-by-v58-ai-pass / open-design-artifact-only / media-generate-forbidden` |
| Open Design v58 法术书密度重构 artifact 源 | `D:\codex-home\tools\open-design\.od\projects\mage-wars-ui-design\mage-wars-step1-annotated-saturated-v58.html` | `AI_PASS_REVOKED / mediaGenerate=false / background-dominates-spellbook` |
| Open Design v58 元数据 | `D:\codex-home\tools\open-design\.od\projects\mage-wars-ui-design\mage-wars-step1-annotated-saturated-v58.html.artifact.json` | `AI_PASS_REVOKED / human-review-blocked` |
| Open Design v58 PNG | `docs/games/mage-wars/design/generated/step1-annotated-saturated-opendesign-artifact-v58.png` | `REVISE / background-dominates-spellbook / human-review-blocked` |
| Open Design v58 几何审计 | `docs/games/mage-wars/design/generated/step1-annotated-saturated-opendesign-artifact-v58-geometry.json` | `geometry-only / cannot-prove-background-does-not-squeeze-spellbook` |
| Open Design v58 审计 | `docs/games/mage-wars/design/generated/step1-annotated-saturated-opendesign-artifact-v58-audit.md` | `AI_PASS_REVOKED / REVISE / background-dominates-actionable-objects` |
| Open Design v59 背景叠层前置回执 | `docs/games/mage-wars/design/reference/step1-annotated-saturated-v59-background-overlay-preflight.md` | `historical-input / superseded-by-v60 / open-design-artifact-only / media-generate-forbidden` |
| Open Design v59 背景叠层 artifact 源 | `D:\codex-home\tools\open-design\.od\projects\mage-wars-ui-design\mage-wars-step1-annotated-saturated-v59.html` | `AI_PASS_REVOKED / mediaGenerate=false / human-review-blocked` |
| Open Design v59 元数据 | `D:\codex-home\tools\open-design\.od\projects\mage-wars-ui-design\mage-wars-step1-annotated-saturated-v59.html.artifact.json` | `AI_PASS_REVOKED / mediaGenerate=false / implementation-blocked` |
| Open Design v59 PNG | `docs/games/mage-wars/design/generated/step1-annotated-saturated-opendesign-artifact-v59.png` | `REVISE / visual-pad-without-semantics / card-readability-standard-missing` |
| Open Design v59 几何审计 | `docs/games/mage-wars/design/generated/step1-annotated-saturated-opendesign-artifact-v59-geometry.json` | `geometry-only / cannot-prove-readability-or-pad-semantics` |
| Open Design v59 审计 | `docs/games/mage-wars/design/generated/step1-annotated-saturated-opendesign-artifact-v59-audit.md` | `AI_PASS_REVOKED / REVISE / implementation-blocked` |
| Open Design v60 法术书可读性前置回执 | `docs/games/mage-wars/design/reference/step1-annotated-saturated-v60-readable-spellbook-preflight.md` | `consumed-by-v61-ai-pass / open-design-artifact-only / media-generate-forbidden` |
| Open Design v60 法术书可读性 artifact 源 | `D:\codex-home\tools\open-design\.od\projects\mage-wars-ui-design\mage-wars-step1-annotated-saturated-v60.html` | `REVISE / mediaGenerate=false / visual-tray-still-too-heavy / superseded-by-v61` |
| Open Design v60 PNG | `docs/games/mage-wars/design/generated/step1-annotated-saturated-opendesign-artifact-v60.png` | `REVISE / visual-tray-still-too-heavy / superseded-by-v61` |
| Open Design v61 开放式法术书 artifact 源 | `D:\codex-home\tools\open-design\.od\projects\mage-wars-ui-design\mage-wars-step1-annotated-saturated-v61.html` | `AI_PASS_REVOKED / mediaGenerate=false / dead-space-failed` |
| Open Design v61 元数据 | `D:\codex-home\tools\open-design\.od\projects\mage-wars-ui-design\mage-wars-step1-annotated-saturated-v61.html.artifact.json` | `AI_PASS_REVOKED / mediaGenerate=false / implementation-blocked` |
| Open Design v61 PNG | `docs/games/mage-wars/design/generated/step1-annotated-saturated-opendesign-artifact-v61.png` | `REVISE / dead-space-failed / human-review-blocked` |
| Open Design v61 几何审计 | `docs/games/mage-wars/design/generated/step1-annotated-saturated-opendesign-artifact-v61-geometry.json` | `PASS / no-visual-pad / readable-spellbook-cards / protected-objects-clear` |
| Open Design v61 审计 | `docs/games/mage-wars/design/generated/step1-annotated-saturated-opendesign-artifact-v61-audit.md` | `AI_PASS_REVOKED / dead-space-failed / implementation-blocked` |
| Open Design v62 底部空间预算前置回执 | `docs/games/mage-wars/design/reference/step1-annotated-saturated-v62-bottom-space-budget-preflight.md` | `preflight-ready / open-design-artifact-only / media-generate-forbidden` |
| Open Design v62 底部空间预算 artifact 源 | `D:\codex-home\tools\open-design\.od\projects\mage-wars-ui-design\mage-wars-step1-annotated-saturated-v62.html` | `AI_PASS_REVOKED / mediaGenerate=false / pagination-proportion-failed` |
| Open Design v62 元数据 | `D:\codex-home\tools\open-design\.od\projects\mage-wars-ui-design\mage-wars-step1-annotated-saturated-v62.html.artifact.json` | `AI_PASS_REVOKED / mediaGenerate=false / implementation-blocked` |
| Open Design v62 PNG | `docs/games/mage-wars/design/generated/step1-annotated-saturated-opendesign-artifact-v62.png` | `REVISE / pagination-proportion-failed / human-review-blocked` |
| Open Design v62 几何审计 | `docs/games/mage-wars/design/generated/step1-annotated-saturated-opendesign-artifact-v62-geometry.json` | `PASS / bottom-unused-gap-18px / no-protected-overlap` |
| Open Design v62 审计 | `docs/games/mage-wars/design/generated/step1-annotated-saturated-opendesign-artifact-v62-audit.md` | `AI_PASS_REVOKED / pagination-proportion-failed / implementation-blocked` |
| Open Design v63 分页比例前置回执 | `docs/games/mage-wars/design/reference/step1-annotated-saturated-v63-pagination-proportion-preflight.md` | `preflight-ready / open-design-artifact-only / media-generate-forbidden` |
| Open Design v63 artifact 源 | `D:\codex-home\tools\open-design\.od\projects\mage-wars-ui-design\mage-wars-step1-annotated-saturated-v63.html` | `REVISE / mediaGenerate=false / pagination-still-too-heavy` |
| Open Design v63 PNG | `docs/games/mage-wars/design/generated/step1-annotated-saturated-opendesign-artifact-v63.png` | `REVISE / pagination-still-too-heavy / human-review-blocked` |
| Open Design v63 几何审计 | `docs/games/mage-wars/design/generated/step1-annotated-saturated-opendesign-artifact-v63-geometry.json` | `REVISE / pagination-to-card-area-too-high` |
| Open Design v63 审计 | `docs/games/mage-wars/design/generated/step1-annotated-saturated-opendesign-artifact-v63-audit.md` | `REVISE / implementation-blocked` |
| Open Design v64 artifact 源 | `D:\codex-home\tools\open-design\.od\projects\mage-wars-ui-design\mage-wars-step1-annotated-saturated-v64.html` | `AI_PASS_REVOKED / mediaGenerate=false / page-button-style-changed` |
| Open Design v64 元数据 | `D:\codex-home\tools\open-design\.od\projects\mage-wars-ui-design\mage-wars-step1-annotated-saturated-v64.html.artifact.json` | `AI_PASS_REVOKED / mediaGenerate=false / implementation-blocked` |
| Open Design v64 PNG | `docs/games/mage-wars/design/generated/step1-annotated-saturated-opendesign-artifact-v64.png` | `REVISE / page-button-style-changed / human-review-blocked` |
| Open Design v64 几何审计 | `docs/games/mage-wars/design/generated/step1-annotated-saturated-opendesign-artifact-v64-geometry.json` | `PASS / pagination-corner-control / card-148x209` |
| Open Design v64 审计 | `docs/games/mage-wars/design/generated/step1-annotated-saturated-opendesign-artifact-v64-audit.md` | `AI_PASS_REVOKED / page-button-style-changed / implementation-blocked` |
| Mage Wars UI 设计记忆 skill | `.spec/skills/mage-wars-ui-design-memory/SKILL.md` | `canonical-source / user-quote-review-gate` |
| Open Design v65 artifact 源 | `D:\codex-home\tools\open-design\.od\projects\mage-wars-ui-design\mage-wars-step1-annotated-saturated-v65.html` | `AI_PASS / mediaGenerate=false / human-review-allowed-in-chat` |
| Open Design v65 元数据 | `D:\codex-home\tools\open-design\.od\projects\mage-wars-ui-design\mage-wars-step1-annotated-saturated-v65.html.artifact.json` | `AI_PASS / mediaGenerate=false / implementation-blocked` |
| Open Design v65 PNG | `docs/games/mage-wars/design/generated/step1-annotated-saturated-opendesign-artifact-v65.png` | `AI_PASS / human-review-allowed-in-chat` |
| Open Design v65 几何审计 | `docs/games/mage-wars/design/generated/step1-annotated-saturated-opendesign-artifact-v65-geometry.json` | `PASS / page-button-style-preserved / page-index-auxiliary` |
| Open Design v65 审计 | `docs/games/mage-wars/design/generated/step1-annotated-saturated-opendesign-artifact-v65-audit.md` | `AI_PASS / implementation-blocked-until-user-approval` |
| Open Design v66 artifact 源 | `D:\codex-home\tools\open-design\.od\projects\mage-wars-ui-design\mage-wars-step1-annotated-saturated-v66.html` | `AI_PASS / mediaGenerate=false / human-review-allowed-in-chat` |
| Open Design v66 元数据 | `D:\codex-home\tools\open-design\.od\projects\mage-wars-ui-design\mage-wars-step1-annotated-saturated-v66.html.artifact.json` | `AI_PASS / mediaGenerate=false / implementation-blocked` |
| Open Design v66 PNG | `docs/games/mage-wars/design/generated/step1-annotated-saturated-opendesign-artifact-v66.png` | `AI_PASS / human-review-allowed-in-chat` |
| Open Design v66 几何审计 | `docs/games/mage-wars/design/generated/step1-annotated-saturated-opendesign-artifact-v66-geometry.json` | `PASS / left-side-tabs / bottom-capacity-removed / page-button-style-preserved` |
| Open Design v66 审计 | `docs/games/mage-wars/design/generated/step1-annotated-saturated-opendesign-artifact-v66-audit.md` | `AI_PASS / implementation-blocked-until-user-approval` |
| Open Design v70 artifact 源 | `D:\codex-home\tools\open-design\.od\projects\mage-wars-ui-design\mage-wars-step1-annotated-saturated-v70.html` | `AI_PASS_REVOKED / background-avoidance-failed / still-outside-map-bottom-rail` |
| Open Design v70 元数据 | `D:\codex-home\tools\open-design\.od\projects\mage-wars-ui-design\mage-wars-step1-annotated-saturated-v70.html.artifact.json` | `AI_PASS_REVOKED / mediaGenerate=false / implementation-blocked` |
| Open Design v70 PNG | `docs/games/mage-wars/design/generated/step1-annotated-saturated-opendesign-artifact-v70.png` | `AI_PASS_REVOKED / historical-failed-candidate` |
| Open Design v70 几何审计 | `docs/games/mage-wars/design/generated/step1-annotated-saturated-opendesign-artifact-v70-geometry.json` | `historical-machine-pass / player-view-failed` |
| Open Design v70 审计 | `docs/games/mage-wars/design/generated/step1-annotated-saturated-opendesign-artifact-v70-audit.md` | `AI_PASS_REVOKED / map-avoidance-feedback` |
| Open Design v71 artifact 源 | `D:\codex-home\tools\open-design\.od\projects\mage-wars-ui-design\mage-wars-step1-annotated-saturated-v71.html` | `AI_PASS / superseded-by-v72 / mediaGenerate=false` |
| Open Design v71 元数据 | `D:\codex-home\tools\open-design\.od\projects\mage-wars-ui-design\mage-wars-step1-annotated-saturated-v71.html.artifact.json` | `AI_PASS / superseded-by-v72 / implementation-blocked` |
| Open Design v71 PNG | `docs/games/mage-wars/design/generated/step1-annotated-saturated-opendesign-artifact-v71.png` | `AI_PASS / superseded-by-v72` |
| Open Design v71 几何审计 | `docs/games/mage-wars/design/generated/step1-annotated-saturated-opendesign-artifact-v71-geometry.json` | `PASS / map-bottom-layer-overlay-fixed / protected-objects-clear` |
| Open Design v71 审计 | `docs/games/mage-wars/design/generated/step1-annotated-saturated-opendesign-artifact-v71-audit.md` | `AI_PASS / superseded-by-v72` |
| Open Design v72 artifact 源 | `D:\codex-home\tools\open-design\.od\projects\mage-wars-ui-design\mage-wars-step1-annotated-saturated-v72.html` | `AI_PASS / superseded-by-v73 / mediaGenerate=false` |
| Open Design v72 元数据 | `D:\codex-home\tools\open-design\.od\projects\mage-wars-ui-design\mage-wars-step1-annotated-saturated-v72.html.artifact.json` | `AI_PASS / superseded-by-v73 / implementation-blocked` |
| Open Design v72 PNG | `docs/games/mage-wars/design/generated/step1-annotated-saturated-opendesign-artifact-v72.png` | `AI_PASS / superseded-by-v73` |
| Open Design v72 几何审计 | `docs/games/mage-wars/design/generated/step1-annotated-saturated-opendesign-artifact-v72-geometry.json` | `PASS / superseded-by-v73 / spellbook-6-per-page / planned-spell-same-size` |
| Open Design v72 审计 | `docs/games/mage-wars/design/generated/step1-annotated-saturated-opendesign-artifact-v72-audit.md` | `AI_PASS / superseded-by-v73` |
| Open Design v73 artifact 源 | `D:\codex-home\tools\open-design\.od\projects\mage-wars-ui-design\mage-wars-step1-annotated-saturated-v73.html` | `AI_PASS_REVOKED / superseded-by-v74 / discard-too-small` |
| Open Design v73 元数据 | `D:\codex-home\tools\open-design\.od\projects\mage-wars-ui-design\mage-wars-step1-annotated-saturated-v73.html.artifact.json` | `AI_PASS_REVOKED / superseded-by-v74 / implementation-blocked` |
| Open Design v73 PNG | `docs/games/mage-wars/design/generated/step1-annotated-saturated-opendesign-artifact-v73.png` | `AI_PASS_REVOKED / superseded-by-v74 / discard-too-small` |
| Open Design v73 几何审计 | `docs/games/mage-wars/design/generated/step1-annotated-saturated-opendesign-artifact-v73-geometry.json` | `historical-machine-pass / discard-too-small` |
| Open Design v73 审计 | `docs/games/mage-wars/design/generated/step1-annotated-saturated-opendesign-artifact-v73-audit.md` | `AI_PASS_REVOKED / superseded-by-v74` |
| Open Design v74 artifact 源 | `D:\codex-home\tools\open-design\.od\projects\mage-wars-ui-design\mage-wars-step1-annotated-saturated-v74.html` | `AI_PASS_REVOKED / superseded-by-v75 / public-discard-cardback-misread` |
| Open Design v74 元数据 | `D:\codex-home\tools\open-design\.od\projects\mage-wars-ui-design\mage-wars-step1-annotated-saturated-v74.html.artifact.json` | `AI_PASS_REVOKED / superseded-by-v75 / implementation-blocked` |
| Open Design v74 PNG | `docs/games/mage-wars/design/generated/step1-annotated-saturated-opendesign-artifact-v74.png` | `AI_PASS_REVOKED / superseded-by-v75 / public-discard-cardback-misread` |
| Open Design v74 几何审计 | `docs/games/mage-wars/design/generated/step1-annotated-saturated-opendesign-artifact-v74-geometry.json` | `historical-machine-pass / discard-readable-size / public-discard-cardback-misread` |
| Open Design v74 审计 | `docs/games/mage-wars/design/generated/step1-annotated-saturated-opendesign-artifact-v74-audit.md` | `AI_PASS_REVOKED / superseded-by-v75` |
| Open Design v75 artifact 源 | `D:\codex-home\tools\open-design\.od\projects\mage-wars-ui-design\mage-wars-step1-annotated-saturated-v75.html` | `AI_PASS / mediaGenerate=false / human-review-allowed-in-chat` |
| Open Design v75 元数据 | `D:\codex-home\tools\open-design\.od\projects\mage-wars-ui-design\mage-wars-step1-annotated-saturated-v75.html.artifact.json` | `AI_PASS / mediaGenerate=false / implementation-blocked` |
| Open Design v75 PNG | `docs/games/mage-wars/design/generated/step1-annotated-saturated-opendesign-artifact-v75.png` | `AI_PASS / human-review-allowed-in-chat` |
| Open Design v75 几何审计 | `docs/games/mage-wars/design/generated/step1-annotated-saturated-opendesign-artifact-v75-geometry.json` | `PASS / discard-public-face-up / discard-anchor-kept-user-marked-right-side` |
| Open Design v75 审计 | `docs/games/mage-wars/design/generated/step1-annotated-saturated-opendesign-artifact-v75-audit.md` | `AI_PASS / implementation-blocked-until-user-approval` |
| Open Design v44 审计 | `docs/games/mage-wars/design/generated/step1-unified-action-workbench-opendesign-artifact-v44-audit.md` | `AI_PASS_REVOKED / implementation-blocked / mobile-blocked` |
| Open Design v6 artifact 源 | `D:\codex-home\tools\open-design\.od\projects\mage-wars-ui-design\mage-wars-step1-runtime-board-v6.html` | `AI_PASS_REVOKED / user-review-failed` |
| Open Design v6 元数据 | `D:\codex-home\tools\open-design\.od\projects\mage-wars-ui-design\mage-wars-step1-runtime-board-v6.html.artifact.json` | `mediaGenerate=false`，Open Design artifact 路线 |
| Open Design v6 审图截图 | `docs/games/mage-wars/design/generated/step1-runtime-board-opendesign-artifact-v6.png` | 历史候选；用户指出 PC 未好后不得继续送验 |
| Open Design v6 审计 | `docs/games/mage-wars/design/generated/step1-runtime-board-opendesign-artifact-v6-audit.md` | 历史 `PASS 93/100` 已撤销为 `REVISE`；需重做 PC 基线 |
| 坐标与内置物件合同 | `docs/games/mage-wars/design/implementable/board-coordinate-contract.md` | foundation `2x3` 运行时映射已就绪；完整标准竞技场坐标留到后续 |

## 历史候选

| 候选 | 状态 | 结论 |
| --- | --- | --- |
| Open Design v1 / `index.html` | `REJECTED / failed-candidate` | 规则主链不成立，不能送人工验收 |
| Open Design v2 / `mage-wars-step1-saturated-v2.html` | `REJECTED / failed-candidate` | 用户否定；旧 `AI_PASS` 撤销 |
| Open Design v3 / `mage-wars-step1-runtime-board-v3.html` | `REVISE / failed-candidate` | 路线正确，但学徒半场和对象落位不一致 |
| Open Design v4 / `mage-wars-step1-runtime-board-v4.html` | `REVISE / side-selection-pending` | 同半场主链路修正，但仍暴露左 / 右半场候选 |
| Open Design v5 / `mage-wars-step1-runtime-board-v5.html` | `AI_PASS / superseded-by-v6` | 只呈现 `2x3` 学徒竞技场，但饱和对象不足、主动作链仍可收紧 |
| Open Design v6 / `mage-wars-step1-runtime-board-v6.html` | `REVISE / user-review-failed / pc-baseline-rework-required` | 用户指出 PC 端没好；旧 AI_PASS 撤销，移动端和实现线冻结 |
| Open Design v7 / `mage-wars-step1-runtime-board-v7.html` | `REVISE / failed-candidate / rule-ui-semantics-failed / invalid-default-card-zone` | 引入规则不存在的默认持牌区概念，旧 AI_PASS 撤销，不得继续送验 |
| Open Design v8 / `mage-wars-step1-runtime-board-v8.html` | `REVISE / failed-candidate / AI_PASS_REVOKED` | 改回规则牌区命名但交互权重与程序化骰子质量未过；不得继续送验 |
| Open Design v9 / `mage-wars-step1-runtime-board-v9.html` | `REVISE / failed-candidate / source-structure-polluted` | 源码存在重复牌区块，且未重新完成截图核验；不得继续送验 |
| Open Design v10 / `mage-wars-step1-runtime-board-v10.html` | `REVISE / failed-candidate / ai-self-review-failed` | 重做规则权重正确，但攻击骰像红黑块、己方边缘牌区拥挤、仍有解释句；不得送验 |
| Open Design v11 / `mage-wars-step1-runtime-board-v11.html` | `REVISE / AI_PASS_REVOKED / overlap-hard-failure` | 使用正式骰面裁图、重排己方边缘牌区并删除解释句，但仍存在顶部与左下 UI 重叠；不得送验 |
| Open Design v12 / `mage-wars-step1-runtime-board-v12.html` | `REVISE / overlap-hard-failure` | 顶部阶段条与左下压叠有所缓解，但对方法术区仍压竞技场上沿；不得送验 |
| Open Design v13 / `mage-wars-step1-runtime-board-v13.html` | `AI_PASS_REVOKED / overlap-hard-failure` | 将对手法术书 / 已计划 / 弃牌堆移到右侧玩家边缘，但右下骰盘压住场上卡牌；不得送验 |
| Open Design v14 / `mage-wars-step1-runtime-board-v14.html` | `AI_PASS_REVOKED / visual-clutter-failure` | 将攻击骰 / 效果骰移到右侧独立结算槽，但目标区框体、目标框和路径线仍抢焦点；不得送验 |
| Open Design v15 / `mage-wars-step1-runtime-board-v15.html` | `AI_PASS_REVOKED / visual-overlap-failure` | 底部牌区与当前施法大卡互相挤压，左 / 右玩家附件与 HUD 缺清晰槽位；不得送验 |
| Open Design v16 / `mage-wars-step1-runtime-board-v16.html` | `REVISE / visual-overlap-risk` | 火球术独立贴底后仍有贴边和重复焦点，左下槽位未彻底清理；不得送验 |
| Open Design v17 / `mage-wars-step1-runtime-board-v17.html` | `AI_PASS_REVOKED / dice-settlement-misplaced` | 虽移除了贴底独立火球术大卡，但攻击掷骰被放到右侧辅助区，当前结算主体没有回到目标 / 主舞台上层；不得送验 |
| Open Design v18 / `mage-wars-step1-runtime-board-v18.html` | `AI_PASS_REVOKED / zone-anchoring-failed` | 攻击骰与 12 面效果骰移回竞技场上层，但场上卡牌没有唯一所属区域：西锁骑士骑在 A2/B2 缝隙，火印魔婴与烈焰魔物在网格外，缠绕藤蔓大面积压线；不得送验 |
| Open Design v19 / `mage-wars-step1-runtime-board-v19.html` | `AI_PASS / superseded-by-v20` | 重建 `2列 x 3行` 区域锚点，场上卡牌全部有唯一所属区域，攻击骰与效果骰贴当前目标附近；但区域第一视觉仍可继续强化 |
| Open Design v20 / `mage-wars-step1-runtime-board-v20.html` | `AI_PASS / superseded-by-v21` | 在 v19 基础上强化右半场六格第一视觉、左半场退场和卡牌单一区域归属；因用户继续反馈玩家 HUD 与法术书浏览，已由 v21 替代 |
| 旧 HTML 预览 | `docs/games/mage-wars/design/implementable/board-ui-preview.html` | `rejected / failed-candidate`，不得恢复为验收图 |
| 历史 media 生图脚本 | `docs/games/mage-wars/design/generated/run-step1-runtime-board-imagegen.ps1` | 仅当用户明确重新要求图片模型生图时才考虑 |

## 当前裁定

- v6 不再是可人工验收视觉稿；用户指出 PC 端没好后，v6 与运行页截图都必须降为失败候选 / 历史技术证据。
- v6 没有调用 `od media generate`、imagegen 或 media provider；这一点只证明“不生图路线正确”，不能证明设计通过。
- v6 曾使用正式竞技场、法师牌、学徒法术牌、卡背、行动 / 快速施法 token、守卫 / 伤害 token 和攻击骰素材；生命 / 法力 / 聚魔 / 伤害为 `approved-programmatic-runtime-ui`。这些证据只能作为重构输入，不得作为当前通过结论。
- 法师状态板仍为 `reference-only`，不得作为主界面玩家面板、血条面板或蓝条面板复现。
- v7 不再是人工验收候选；它虽然使用了部分真实素材并保持不生图路线，但规则牌区语义错误，必须降为失败候选。
- v8 不再是人工验收候选；它只保留为“命名修正但交互权重与视觉质量失败”的历史候选。
- v13 不再是人工验收候选；复核原图确认骰盘压住场上卡牌，旧 `AI_PASS` 已撤销。
- v14 不再是人工验收候选；复核确认目标区框体和路径线抢焦点，旧 `AI_PASS` 已撤销。
- v15 不再是人工验收候选；复核确认底部牌区、当前施法卡和 HUD 存在视觉重叠 / 挤压问题，旧 `AI_PASS` 已撤销。
- v16 不再是人工验收候选；复核确认仍有贴边和重复焦点风险。
- v17 不再是当前 PC Open Design 设计稿候选；攻击掷骰位置违背“当前结算主体必须在主舞台上层 / 目标附近承载”的门禁。
- v18 不再是当前 PC Open Design 设计稿候选；它只证明骰盘位置比 v17 接近规则，但区域锚点硬失败已经撤销人工验收资格。
- v20 已按 `2x3` 学徒区域坐标 / 锚点合同通过 AI 审计：每张场上卡牌都有明确区域，中心点不在区域边界或格外，token 贴附宿主对象；区域本身也已作为第一视觉规则强化。v20 现在只作为区域锚点基线，不再是当前人工验收候选。
- v21 已按用户最新反馈通过 AI 审计：双方法师 HUD 和法师牌 `transform=none`，生命 / 法力 / 聚魔使用水平条与数字，己方法术书浏览器在底部展示 5 张候选卡、分类切换和 `1/4` 分页，并保留 `已计划 2/2` 作为当前可施放来源。用户补充裁定后，v21 同时保留为“开始多设计稿之前”的基线候选，不得被后续多方案覆盖或删除。
- v23 已降为上一轮可用基线：它沿用 v21 的正确规则结构，解决了区域锚点、当前结算锚定和禁用手牌语义，但用户随后指出玩家身份区、法术书 / 已计划关系和底部牌区沉浸感仍需重构，因此不再作为当前人工验收候选。
- v25 不再是人工验收候选：它回应了法师牌上置和已计划法术分层，但底部法术书候选切边，旧几何审计判 `REVISE`，不得打开送验。
- v26 不再是人工验收候选：用户指出底部法术书仍像带边框 / 容器的大 UI 壳层，且费用 / 确认 / 取消远离已计划火球术；旧 `AI_PASS` 已撤销。
- v27 不再是人工验收候选：它删除了底部大容器，但分类仍像后台筛选器，确认动作仍像漂在已计划法术上方的独立 UI；只能作为中间失败输入。
- v28 不再是当前 PC Open Design 人工验收候选：它虽然保留法师牌上置、规则真实牌区命名、2x3 区域锚点和当前结算锚定，但仍把法术书 / 已计划法术当作避让底图的底部布局问题，未建立可重叠层级模型；同时保留了规则未授权的常驻确认 / 取消控件，并留下无职责右下空白。下一稿必须先写层级 / 可重叠 / 确认授权前置包，再重新生成。
- v29 不再是当前 PC Open Design 人工验收候选：它补上了层级模型并删除确认 / 取消，但当前已计划火球术离 B3 场上缠绕藤蔓过近，玩家容易误读成场内对象；只能作为中间失败输入。
- v30 不再是当前 PC Open Design 人工验收候选：它只修正了层级 / 可重叠和确认控件问题，但底部法术书 / 当前可支配对象不可读，右下空间没有现实职责，中央主舞台过度拥挤。旧 `AI_PASS` 已撤销；下一稿必须先消费外部游戏 UI 范式并补“可读性 + 空间预算 + 焦点预览 / 抽屉 + 拥挤度”门禁。
- v31 不再是当前 PC Open Design 人工验收候选：用户复核后指出底部卡牌区仍不可读、右下职责没有真正减压、中央仍拥挤。旧 `AI_PASS` 撤销，几何审计只能作为历史机器证据。
- v32 不再是当前 PC Open Design 人工验收候选：它虽然把当前已计划火球术放大，但用户继续指出底部语义、右下职责和中心压力仍未通过；旧 `AI_PASS` 已撤销，几何通过只能作为历史机器证据。
- v34 不再是当前 PC Open Design 人工验收候选：它删除了底部混合牌区并尝试让右下成为工作台，但 AI 原图复核确认 B2 目标、骰子、伤害、燃烧和目标角标仍形成中心注意力团块。
- v35 不再是当前 PC Open Design 人工验收候选：它修正了中心团块，但效果骰仍是低质程序化蓝圆，占位感违反素材一致性门禁。
- v36 不再是当前 PC Open Design 人工验收候选：用户继续指出卡面字段复写、确认态与结算态混用、动作链不统一，旧 `AI_PASS` 撤销。
- v37 不再是当前 PC Open Design 人工验收候选：它修掉手牌词和卡面字段复写，但法术书 / 已计划法术 / 弃牌堆仍像挂件，右侧动作工作台与棋盘目标关系弱，机器几何通过不能证明玩家友好。
- v43 不再是当前 PC Open Design 人工验收候选：它方向上建立了来源 / 目标 / 确认同台，但底部工作台压住 A3 / B3 场上卡，确认离目标摘要过远，仍不能送验。
- v44 不再是当前 PC Open Design 人工验收候选：它虽然把攻击 / 施法 / 装备攻击统一为“选来源 -> 点目标 -> 同台确认”，但用户指出当前可支配对象守恒失败，法术书 / 已计划法术被弱化成小缩略和单卡背入口，旧 `AI_PASS` 已撤销。
- v45 不再是当前 PC Open Design 人工验收候选：它解决了当前可支配对象守恒，但仍把底部做成封闭大工作台，并保留规则 / 当前状态未授权的确认式控件，旧 `AI_PASS` 已撤销。
- v46 不再是当前 PC Open Design 人工验收候选：它删除确认 / 执行 / 取消按钮和封闭底部面板的方向是对的，但把“目标选择态不提前结算”错误扩大成省略骰子、效果骰、伤害 / 燃烧 token 和用户标注图点名物理件；旧 `AI_PASS` 已撤销，下一版必须按用户标注图和元素守恒重新生成。
- v47 不再是当前 PC Open Design 人工验收候选：它虽然恢复了骰子、token 和用户标注元素，但把对手已计划法术挂在右侧状态区，没有放到左上形成镜像；左下玩家区、当前来源大卡、右下大计划框和关系箭头也没有逐项回答“是否规则必要 / 是否只是 UI 辅助”；分页控件没有按用户画出的贴边翻页样式执行。旧 `AI_PASS` 撤销，下一版必须先按规则必要性和席位镜像重构。
- v48 不再是当前 PC Open Design 人工验收候选：它修复了 v47 的对手计划左上镜像、问号区域规则职责裁定、页角分页样式，并保留骰子、token、法术书、已计划法术、弃牌堆、法师牌和卡背等用户点名物理件；但用户随后指出已计划法术和已选法术重复，v48 已由 v49 / v50 取代。
- v49 不再是当前 PC Open Design 人工验收候选：它删除了 `火球术` 的“已选法术”复制卡，但还没有把规则对象实体锚点守恒扩展到目标摘要、弃牌堆顶牌和可见对象审计，已由 v50 取代。
- v50 不再是当前 PC Open Design 人工验收候选：它虽然补齐了“规则对象实体锚点守恒”，但仍让目标摘要、大箭头和问号 / 空白代理 UI 抢走了真实对象本体直选职责；弃牌堆也被展示成显眼正面顶牌，违反公开归档降权原则。旧 `AI_PASS` 已撤销。
- v51 不再是当前 PC Open Design 人工验收候选：它解决了目标摘要、大箭头和弃牌正面顶牌问题，但仍错误保护整张竞技场底图，把主交互挤到边缘；旧 `AI_PASS` 已撤销。下一稿必须把竞技场底图视为最低层承载，允许法术书 / 已计划法术 / 归档入口作为开放 overlay 覆盖低权重石砖区域，只保护格子语义、场上对象、目标高亮、骰子和 token。
- v55 不再是当前 PC Open Design 人工验收候选：它把竞技场底图降为最低层承载的方向正确，但卡外重复写卡名且卡牌尺寸不足以阅读，旧 `AI_PASS` 已撤销。
- v56 不再是当前 PC Open Design 人工验收候选：它删除卡外可见卡名 / 费用 / 射程 / 目标字段复写的方向正确，但把法术书焦点卡和已计划来源卡常驻提升到 `260x366`，误把临时读卡检视层尺寸放进主牌桌层，破坏卡牌游戏牌桌比例。旧 `AI_PASS` 已撤销；下一稿必须参考成熟卡牌游戏比例范式，明确常驻牌桌、焦点候选和 inspect / spotlight 的尺寸上限。
- v57 不再是当前 PC Open Design 人工验收候选：它虽然解决了 v56 的 `260x366` 常驻大卡问题，但法术书真实容量是 30/33 张而不是一页 4 张；已计划牌应贴近回合结束操作区上方；选中 / 焦点 / 来源态不得通过左右特大牌改变常驻布局占位。旧 `AI_PASS` 已撤销，下一稿必须按法术书真实容量重做分页密度和稳定选中态。
- v58 不再是当前 PC Open Design 人工验收候选：它把法术书浏览改为一页 10 张、已计划法术贴近右下 `回合结束` 上方，并修掉左右特大选中牌，但仍让整张竞技场底图成为不可覆盖的布局排斥体，把法术书 / 当前可支配牌区挤到底边；几何无重叠不能证明玩家可读、可点、可比较。旧 `AI_PASS` 已撤销，下一稿必须把竞技场拆成 `必须保护的规则热区` 与 `可被法术书 / 计划区 overlay 覆盖的低权重纹理区`，不得再为了露出整张地图牺牲法术书可用性。
- v59 不再是当前 PC Open Design 人工验收候选：它把法术书作为开放 overlay 放到竞技场下沿低权重石砖区的方向正确，但底部阴影没有规则 / 材质 / 交互职责，法术书候选卡 `104x147` 也没有基于可读性预算建立标准；旧 `AI_PASS` 已撤销。下一稿必须删除无语义黑影，把法术书候选卡按 PC 100% 缩放可读标准放大，必要时从 `10 / 页` 改为 `8 / 页`。
- v60 不再是当前 PC Open Design 人工验收候选：它把法术书候选改到 `120x169`、`8 / 页`，但仍保留过重的法术书托盘形态；已由 v61 删除视觉垫层后取代。
- v61 不再是当前 PC Open Design 人工验收候选：它删除无语义黑影 / 托盘，保留 8 张 `120x169` 法术书候选、`1 / 4` 页码和 `法术书 30 / 8 / 页` 的方向正确，但用户复核指出底部无职责空白明显。旧 `AI_PASS` 已撤销；下一稿必须把底边空间分配给法术书候选、分页、容量读数、已计划法术、弃牌堆和回合结束，而不是继续保留空地。
- v62 不再是当前 PC Open Design 人工验收候选：它按底部空间预算修掉 v61 的死空，但用户指出分页控件占据空间过大；重新裁定为“页码 / 翻页有职责，但视觉占比与职责不匹配”。
- v63 不再是当前 PC Open Design 人工验收候选：它把错误理解修正为“分页比例问题”，但 `164x34` 的 `‹ 1 / 4 ›` 仍像独立底栏，旧候选不得送验。
- v64 不再是当前 PC Open Design 人工验收候选：它把页码压小的方向对，但错误地改变了分页按钮样式和位置，违背用户“分页按钮保持原样”的反馈。
- v65 不再是当前 PC Open Design 人工验收候选：它恢复 `42x42` 侧边页角式分页按钮的方向正确，但用户继续标注分类标签和底部容量文字，因此已由 v66 取代。
- v66 不再是当前 PC Open Design 人工验收候选：它将分类标签移到法术书左侧并删除底部容量文字的方向正确，但用户继续指出法术书牌列、已计划法术和底部空隙仍有布局问题，旧 `AI_PASS` 已撤销。
- v67-v69 不再是当前 PC Open Design 人工验收候选：它们是本轮修复底部空隙、计划牌和槽位分离的中间失败候选，未打开人工验收。
- v70 不再是当前 PC Open Design 人工验收候选：它虽然收掉底部死空、分离法术书 / 分页 / 已计划 / 弃牌 / 回合结束槽位，但用户指出“为什么还在躲着地图”，证明几何不重叠不能替代玩家视角；旧 `AI_PASS` 已撤销。
- v71 不再是当前 PC Open Design 人工验收候选：它解决了地图底层 / 法术书开放 overlay 问题，但用户随后要求“手牌改6张，要放大一点，计划牌大小和手牌一致”，因此由 v72 取代。
- v72 不再是当前 PC Open Design 人工验收候选：它解决了 6 张法术书和计划牌同尺寸问题，但用户随后标注弃牌堆应移到右侧竖向空位，因此由 v73 取代。
- v73 不再是当前 PC Open Design 人工验收候选：它把弃牌堆移到了正确右侧空位，但可见卡背约 `28x40`，只有计划牌高度的约 `18%`，用户指出“小过头”后旧 `AI_PASS` 已撤销。
- v74 不再是当前 PC Open Design 人工验收候选：它修正了 v73 的弃牌堆过小问题，但把公开可检视弃牌堆继续画成卡背堆，错误地把“低权重归档”误做成了“隐藏信息”；旧 `AI_PASS` 已撤销。
- v75 是当前 PC Open Design 人工验收候选：它保留 v74 的右侧弃牌堆位置、v72 的地图底层开放 overlay、6 张 `158x224` 法术书、2 张同尺寸已计划法术和原分页按钮；弃牌堆整体仍为 `138x100`，顶牌正面约 `71x98`，约为计划牌高度的 `43.8%`，几何审计确认不压对手状态、计划牌、回合结束、场上卡、骰子或 token。用户未明确批准前，真实 Board/UI 实现、真实页面 E2E 和移动端适配仍冻结。
- v79 不再是当前 PC Open Design 人工验收候选：它只修复了“场地不应放密集文字法师规则卡”这一半，但 HUD 仍使用人物肖像，未完成用户要求的“规则提示卡和玩家卡图位置交换”。
- v80 是当前红框对象交换修正版候选 / Mage Wars 当前基线：场地格子使用人物 / 肖像法师本体，玩家 HUD 使用密集文字规则提示卡；几何审计确认 `arenaHasDenseTextMageCards=false` 且 `hudUsesMageRuleHintCards=true`。这是本游戏当前稿的设计裁定，不是跨游戏固定模板；用户未明确批准前，真实 Board/UI 实现、真实页面 E2E 和移动端适配仍冻结。
- v1 多设计稿已经失败：虽然使用 Open Design artifact 且未生图，但四套方案同在一个页面，结构和视觉母版过于相似，用户裁定“长一个样子、比之前更差”。后续多设计稿必须拆成多个独立 HTML artifact 与独立 PNG，并把 v21 作为第一张基线对照。
- Mage Wars 牌区白名单是：法术书、已计划法术、弃牌堆、隐性结界卡背、公开场上法术 / 装备 / 生物；禁止写成规则不存在的牌区概念。
- Mage Wars 的弃牌堆确实存在，且任何玩家可随时检视；它是“已消耗 / 公开检视”的归档区，不是隐藏信息。下一稿默认必须作为所属玩家边缘紧凑入口，并用顶牌正面 / 半露正面 + 数量表达公开可检视内容；只有当前规则步骤明确要求从弃牌堆选择、回收、复活或结算时，才允许展开完整清单或提升权重。
- 程序化运行态 UI 不能是粗糙占位；效果骰、血条、蓝条、费用球等自制对象必须先过形状、材质、尺寸、状态和素材一致性审查。
- v2 方案 C 降为历史中间稿；它证明了独立 artifact 路线可行，但图面仍偏方向说明，不再作为当前人工验收候选。
- v3 三张状态稿已降为历史输入，不再作为当前人工验收候选。
- v6 三张 PC Open Design 设计稿不再是当前可进入人工验收的新候选：它们是独立 artifact、独立 PNG、独立审计，且未调用 `od media generate`，但图面仍是同一棋盘壳、同一 HUD 语言、同一素材摆法和同一结算构图下的权重变化，不满足“多个真正不同设计稿”的需求。用户明确批准前，真实 Board/UI 实现、真实页面 E2E 和移动端适配仍冻结。

## 继续迭代门禁

- 继续改视觉稿、Open Design artifact、HTML 预览或 AI 图面核验时，必须先逐项消费 `user-correction-traceability-ledger.md`；该文件是纠正覆盖账本 / drift-check，不是独立规范来源。若账本发现新规则缺 canonical-source，先回 `.spec/skills/mage-wars-ui-design-memory/SKILL.md` 或 `.spec/skills/ui-design-pipeline/SKILL.md` 补规则，再重新审图。
- 继续改视觉稿、Open Design artifact、HTML 预览或 AI 图面核验时，必须先重读 `board-ui-preflight-matrix.md`、学徒法术书合同、学徒区域锚点合同和已重构 UI 设计。
- 继续改视觉稿、Open Design artifact、HTML 预览或 AI 图面核验前，必须先消费 `external-ui-methodology-baseline.md`，并输出新的文字 UI 设计；不能直接从 v21 / v22 微调。
- 后续多设计稿必须以 v21 作为第一张对照基线，新增候选统一落到 `docs/games/mage-wars/design/generated/skill-drafts-v2/`，并各自对应独立 Open Design artifact、独立 PNG 和独立审计；不得再用同页总览或同母版微调作为多方案。
- 每个可见主体必须绑定正式素材路径、atlas frame 或 `approved-programmatic-runtime-ui` 裁定。
- 对手计划法术、隐性结界和未公开法术书内容只能显示卡背 / 数量 / 控制归属，不得公开正面或卡名；不得称为对手默认持牌区。
- 主 UI 常驻文字只允许对象名、数值、短状态和按钮标签；规则说明、教程句和实现验收文案不得进入主界面。
- AI 图面核验必须先查规则 / 素材矩阵，再看图；矩阵不过时，视觉再像也只能判 `REVISE`。
- v8 之后字符串门禁：artifact 可见文案、aria、class、审计文本不得出现规则不存在的默认持牌区词；历史失败文件除外。
- v9 之前必须新增 `规则对象交互权重表`：规则存在、当前阶段角色、主/次/归档权重、默认位置、展开方式、与召唤师战争等成熟实现的交互不变量对比。
