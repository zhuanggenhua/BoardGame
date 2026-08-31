# 法师战争需求对齐表

> 状态：`foundation-synced / full-game-deferred / v6-user-approval-pending`。本表记录用户本轮明确目标与当前落点；foundation 技术链已收口，完整 Mage Wars 和 v6 人工批准仍不在“已证明完成”口径内。

| 用户目标 / 明确口径 | 对应产物 | 当前状态 | 缺口 |
| --- | --- | --- | --- |
| 使用 `D:\gongzuo\webgame\gameasset\法师战争` 作为新游戏素材来源 | `source-index.md`、`asset-candidate-audit.md`、`runtime-resource-chain-audit.md` | 已登记来源；foundation 范围 34 个运行时素材、2 个 atlas JSON 和 manifest 已正式命名、压缩、接入并完成服务器 / Android 回查 | 全 322 张法术、自由构筑、完整 token / 墙体 / 扩展素材留到后续 |
| “可以开新工作树来准备实施” | `.worktrees/mage-wars`，分支 `feat/mage-wars` | 已创建并锁定执行现场 | 无；后续读写继续限定该 worktree |
| “先看完规则，然后技术选型” | `tech-selection.md`、`rule/intake-summary.md`、`rule/domain-modeling.md` | 已形成规则摘要、首轮选型和 foundation 领域建模；学徒范围 91 张字段合同已补齐 | 完整标准模式和全卡表仍需后续建模 / intake |
| 询问是否使用 Phaser | `tech-selection.md`、OpenSpec `design.md` | 裁定首轮不让 Phaser 接管主 Board/UI；作为后续复杂特效层候选 | 若后续法术 FX 超出现有 FX/Canvas/Shader，再单独评估 |
| “释放一个法术肯定要上特效” | `tech-selection.md`、OpenSpec `design.md`、`tasks.md`、`rule/domain-modeling.md`、`src/games/mage-wars/ui/fxSetup.ts` | 已作为首轮硬需求写入，并完成 foundation 事件驱动 FX 映射、渲染器消费和单测验证 | 更丰富的法术粒子、完整法术特效编排留到后续 |
| “按新游戏 skill 流程来” | 阶段 0 intake docs、OpenSpec change `add-mage-wars-foundation`、`src/games/mage-wars/**`、E2E evidence | Foundation 已批准并完成当前 tasks；runtime、manifest/i18n/thumbnail/domain、Board、资源链、E2E 和 OpenSpec 均已验证通过 | v6 仍待用户人工批准；完整游戏范围、全卡表、完整 AI、教程、行动日志 UI 和撤回 UI 留到后续 |

## 当前不扩展的目标

- 不直接修改主工作区；若发现误落，必须以 `.worktrees/mage-wars` 为正式现场并清理本轮误落。
- 不把 `src/games/mage-wars/` foundation 实现称为完整 Mage Wars；它只证明 2 人正式标准竞技场、基础回合 / 施法 / 移动 / 攻击 / 守卫 / 胜负主链、隐藏信息边界、FX 和真实运行页在当前范围内可验证。
- 不默认接入全 322 张法术、所有法师、四人模式或豪华竞技场。
- 不把 TTS/Workshop 坐标当最终视觉风格。
