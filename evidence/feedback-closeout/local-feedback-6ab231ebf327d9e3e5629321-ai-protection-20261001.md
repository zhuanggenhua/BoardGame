# 本地反馈收口：6ab231ebf327d9e3e5629321

- 反馈原文：无法消灭AI的随从。
- 录入核对：`public/locales/zh-CN/game-smashup.json` 的 `innsmouth_in_plain_sight_pod` 明确写明：该基地力量 2 或以下的随从不受对手卡牌影响；defId 与 `src/games/smashup/data/factions/innsmouth_pod.ts` 一致。
- 消费映射：`src/games/smashup/abilities/innsmouth.ts` 注册 `registerProtection('innsmouth_in_plain_sight_pod', 'affect', innsmouthInPlainSightChecker)`；目标随从被保护时，AI 的消灭目标候选会被正式规则过滤。
- 本地验证：`innsmouth.test.ts` 25/25 通过；反馈复核记录中的场景为托尔图加上存在 `innsmouth_in_plain_sight_pod`，AI 低力量随从被合法保护，不是 AI 卡死或缺少消灭入口。
- 结论：关闭为规则保护导致的非产品 bug；若用户想消灭该随从，需要先移除保护或选择不受保护的目标。
- 本轮边界：只做本地验证，未做线上验证。
