# SmashUp 线上反馈待回写（6a32b526638b2f426d295640）

## 范围

- 反馈 ID：`6a32b526638b2f426d295640`
- 游戏：`smashup`
- 反馈原文：`积分后 沉船湾发动不了`

## 真相源

- 生产真源：
  - `ssh admin@8.148.71.102` -> `docker exec -i boardgame-mongodb mongosh --quiet` -> `boardgame.feedbacks`
- 历史真实入口证据：
  - `evidence/smashup/smashup-mermaids-shipwreck-cove-e2e-2026-04-29.md`
  - 该证据已经证明：
    - 《沉船湾》能在真实计分链路里进入 `afterScoring`
    - 也能真的从原基地移到另一基地

## 当前树验证

- 规则行为测试：
  - `pnpm vitest run src/games/smashup/__tests__/abilities/mermaids.test.ts --configLoader native -t "mermaids_shipwreck_cove"`
  - 结果：`2 passed`
- queued 归属链测试：
  - `pnpm vitest run src/games/smashup/__tests__/reactionQueueSourceRuntimeContext.test.ts --configLoader native -t "mermaids_shipwreck_cove"`
  - 结果：`3 passed`

## 关于本轮浏览器 E2E 的真实结论

- 本轮再次跑了：
  - `node scripts/infra/run-e2e-single.mjs ci e2e/smashup/smashup-robot-hoverbot-new.e2e.ts "沉船湾应在基地计分后可移到另一个基地"`
- 结果：**旧测试假设失败，不是实现缺失**
- 失败时最后快照明确显示：
  - `phase: "scoreBases"`
  - `windowType: "afterScoring"`
  - `interactionSourceId: "smashup_reaction_choose"`
  - 选项里包含 `triggerSourceDefId: "mermaids_shipwreck_cove"`
- 现实含义：
  - 当前实现已经真实进入“计分后的反应选择窗”，而不是“根本发动不了”
  - 失败的是旧 E2E helper 还在等直接进入 `mermaids_shipwreck_cove_after_scoring`，没有先接受统一的 `smashup_reaction_choose` 外层反应窗

## 当前状态

- 反馈本体结论：`closed（待正式回写）`
- 关闭理由：
  - 当前规则测试、queued 归属测试、历史真实入口证据都表明《沉船湾》实现仍然成立。
  - 本轮浏览器 E2E 失败暴露的是**测试链路假设陈旧**，不是“计分后能力没有发动”。
- 当前边界：
  - 还没有补一份“按当前统一反应窗口径重录”的新截图证据。
  - 这条反馈还没有正式回写到生产真源，因为：
    - HTTP 开放回写接口当前为 `404`
    - 本轮没有拿到“可改生产 Mongo”的明确授权

## 收口结论

- 这条反馈不应继续按“现存实现 bug”推进。
- 更准确的口径是：
  - `当前树已恢复 / 当前实现正常`
  - `旧浏览器 E2E 仍有一层 prompt 假设待更新`
  - `正式反馈状态可按 closed 回写，但要等用户授权真实写入口`
