# 《我们到底在想什么？》四派系仓库交付证据

日期：2026-07-15
Change ID：`add-smashup-what-were-we-thinking-factions`
当前分支：`codex/smashup-what-were-we-thinking-pr`
基线：`upstream/main`（`7acb0b16`）

## 范围

| 派系 | factionId | 本批状态 |
| --- | --- | --- |
| 摇滚明星 | `rock_stars` | 静态数据、能力注册、持续修正、locale、关键图集预加载与代表行为测试已接入 |
| 泰迪熊 | `teddy_bears` | 静态数据、能力注册、保护/限制/取消、持续修正、locale、关键图集预加载与代表行为测试已接入 |
| 外婆 | `grannies` | 静态数据、能力注册、牌库顶/底操作、持续/触发能力、locale、关键图集预加载与代表行为测试已接入 |
| 探险家 | `explorers` | 静态数据、能力注册、基地发现/替换/移动、locale、关键图集预加载与正式探险家泰坦兼容断言已接入 |

## 资源交付

用户已明确要求本批图片随仓库/PR 交付，不走 R2。当前分支通过 `.gitignore` 精确放行以下四个文件，并在 root + smashup game manifest 中登记 hash/bytes。

| 资源 | 仓库路径 | bytes | SHA-256 |
| --- | --- | ---: | --- |
| 卡牌 PNG | `public/assets/i18n/zh-CN/smashup/cards/what_were_we_thinking.png` | 48,780,520 | `a1530f6940431609ce42bfad6908b3ce27f0dd783c507d880914d687feaf76aa` |
| 卡牌 WebP | `public/assets/i18n/zh-CN/smashup/cards/compressed/what_were_we_thinking.webp` | 1,040,202 | `13a2dda4740716388436e81d3344e127e4eae2028eca65bc3484c5f432f49312` |
| 基地 PNG | `public/assets/i18n/zh-CN/smashup/base/what_were_we_thinking_bases.png` | 15,998,657 | `cfeda490f5133a6f9a18c01831d4c809630f5171e3dc8c58e4fec741f5f8f548` |
| 基地 WebP | `public/assets/i18n/zh-CN/smashup/base/compressed/what_were_we_thinking_bases.webp` | 233,822 | `198ca3edc5156809b6b7b61310dc2a0026a2c13589055c0a73f92b9aa3212a15` |

## 当前验证

| 命令 | 结果 | 说明 |
| --- | --- | --- |
| `openspec validate add-smashup-what-were-we-thinking-factions --strict --no-interactive` | passed | OpenSpec change 严格校验通过 |
| `npm run typecheck` | passed | TypeScript 编译检查通过 |
| `npm run i18n:check` | passed | 本批新增 `ui`、`factions`、`cards` locale key 无缺失 |
| `npx vitest run src/games/smashup/__tests__/abilities/what-were-we-thinking.test.ts src/games/smashup/__tests__/whatWereWeThinkingIntegration.test.ts src/games/smashup/__tests__/criticalImageResolver.test.ts` | passed, 3 files / 81 tests | 四派系代表行为、静态接入、manifest、locale、关键图片预加载通过；经典摇滚客第二次使用 stderr 是预期负例 |
| `node <targeted hash/bytes check>` | passed, 4 files | 本批四个 PNG/WebP 文件与 root/game manifest 的 SHA-256 和 bytes 均一致 |
| `git diff --check` | passed after evidence cleanup | 仅 LF/CRLF 工作区提示，无 whitespace error |

## 已知非本批事项

- `npm run assets:validate` 在当前干净分支仍被既有 `atlas-configs/dicethrone/ability-cards-gunslinger.atlas.json` hash/bytes 不一致阻断；该文件不在本批 diff 内，本批四个图片已做定向 hash/bytes 校验。
- 本轮推送准备在 `codex/smashup-what-were-we-thinking-pr` 干净分支完成，不会推送原工作区中其他 Smash Up 批次或并行未提交改动。
