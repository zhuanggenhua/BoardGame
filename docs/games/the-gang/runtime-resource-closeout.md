# The Gang 运行时资源收口

## 裁定

- 旧裁定只正式接入缩略图：`the-gang/thumbnails/cover`，该裁定已被废弃，不能作为资源链闭环证据。
- 当前新增进展：基础版 52 张普通扑克牌牌面、白/黄/橙/红 1-6 星筹码、隐藏牌背、3 个警报、金条/成功标记、TTS 牌槽素材与 TTS 参考板内容已完成图面/对象核验、语义命名或标签抽取、正式落盘、压缩、manifest 和 Board 接入。
- 2026-07-05 资源纠偏：此前截图白块不是 UI 验收通过，而是资源本体缺失。已从 TTS Workshop JSON 的 `deckId=1675` 和本地 Steam 缓存源图重建 52 张普通牌、牌背与 24 个基础筹码，证据写入 `temp/the-gang-intake/the-gang-resource-rebuild.json`。
- 再审计结论：The Gang 基础版素材矩阵中的牌面源图旧 `blocked/不接入` 口径已纠正；主 UI 已按 TTS Workshop JSON 完成布局合同抽取、Board 对照实现、真实页面 E2E、PureRef 看图和 AI 复看截图。

## 已验证证据

| 项 | 结果 | 证据 |
| --- | --- | --- |
| The Gang 缩略图进入 i18n asset manifest | 通过 | `public/assets/i18n/assets-manifest.json` 中存在 `zh-CN/the-gang/thumbnails/cover` 与 `zh-CN/the-gang/thumbnails/compressed/cover` |
| The Gang 基础版筹码进入运行时 | 通过 | `temp/the-gang-intake/the-gang-resource-rebuild.json`、`public/assets/i18n/zh-CN/the-gang/chips/**` 24 个 PNG 与 `chips/compressed/**` 24 个 WebP、`public/assets/i18n/zh-CN/the-gang/assets-manifest.json`、`src/games/the-gang/Board.tsx` |
| The Gang 隐藏牌背进入运行时 | 通过 | `public/assets/i18n/zh-CN/the-gang/cards/card-back.png`、`cards/compressed/card-back.webp`、The Gang manifest 的 `cards/card-back` 与 `cards/compressed/card-back`、`src/games/the-gang/Board.tsx` |
| The Gang 52 张普通扑克牌牌面进入运行时 | 通过 | `temp/the-gang-intake/the-gang-resource-rebuild.json`、用户指出的 `httpssteamusercontentaakamaihdnetugc11150178257462815859B26889FF2BB711962C1798B79C870A35A62A80CF.png`、`public/assets/i18n/zh-CN/the-gang/cards/<rank>-<suit>.png` 52 张、`cards/compressed/<rank>-<suit>.webp` 52 张、The Gang manifest 的 `cards/*` 与 `cards/compressed/*` key、`src/games/the-gang/Board.tsx` |
| The Gang 3 个警报进入运行时 | 通过 | `alarm-token-contract.json`、TTS `Alarm` 对象 GUID `b73632`/`9d695b`/`2e9790`、`public/assets/i18n/zh-CN/the-gang/markers/alarm-token.png`、`markers/compressed/alarm-token.webp`、The Gang manifest 的 `markers/alarm-token`、`src/games/the-gang/Board.tsx` |
| The Gang 金条/成功标记进入运行时 | 通过 | `gold-ingot-object-summary.json`、`gold-ingot-render-contract.json`、TTS `GoldIngot` GUID `677ed9`/`e7b845`/`7feb6e`/`c8129d`/`711815`/`00b809`、`public/assets/i18n/zh-CN/the-gang/markers/gold-ingot.png`、`markers/compressed/gold-ingot.webp`、The Gang manifest 的 `markers/gold-ingot`、`src/games/the-gang/Board.tsx` |
| The Gang 桌面/牌槽素材进入运行时 | 通过 | `playmat-slot-object-map.json`、19 个 TTS `Custom_Tile` 牌槽对象、`slot-tile-contract.json`、`public/assets/i18n/zh-CN/the-gang/board/slot-tile.jpg`、`board/compressed/slot-tile.webp`、The Gang manifest 的 `board/slot-tile`、`src/games/the-gang/Board.tsx` |
| The Gang 规则参考进入运行时 | 通过 | `reference-board-facts.json`、TTS 参考板 GUID `b554dc`/`2533df`、`Board.tsx` 默认折叠参考入口、`Board.runtime.test.tsx` 断言 `皇家同花顺` 与 `金库 & 警报` |
| The Gang TTS 布局合同进入运行时 | 通过 | `layout-source-contract.md`、`Board.tsx` 的 `data-layout-contract="tts-workshop"`、`data-tts-zone="chip-columns"`、`central-community-slots`、`alarm-gold-bank`、`Board.runtime.test.tsx` 布局断言、2026-07-05 最新 E2E 截图 |
| 游戏注册表发现 The Gang | 通过 | `src/games/manifest.generated.ts`、`src/games/manifest.client.generated.tsx`、`src/games/manifest.server.generated.ts` 均含 `the-gang` |
| 安卓方向映射 | 通过 | `android/app/src/main/assets/game-orientation-map.json` 含 `the-gang: landscape` |
| The Gang 桌面 E2E 真实图片加载门禁 | 通过 | `e2e/the-gang/the-gang-runtime.e2e.ts`、`e2e/the-gang/the-gang-tutorial.e2e.ts` 均增加图片 `naturalWidth/naturalHeight > 1` 与非空地址断言，避免白块截图再次被误判为通过 |
| The Gang 最新关键截图 | 通过 | 运行时满元素、运行时摊牌结果、教程满元素、教程摊牌结果 4 张截图已在 PureRef 打开；`temp/the-gang-intake/the-gang-final-screenshot-contact.jpg` AI 复看确认牌面与筹码可见 |
| The Gang R2/CDN 压缩资源发布 | 通过 | 2026-07-05 定向上传 `official/i18n/zh-CN/the-gang/**/compressed/*.webp` 共 77 个对象，覆盖 52 张牌面、1 张牌背和 24 个基础筹码；上传后逐个 `HeadObject` 校验远端大小一致，`npm run assets:check` 已确认 `THE_GANG_REMOTE_DIFF=none` |
| 全局资源校验 | 阻塞在既有 DiceThrone 漂移 | `npm run assets:validate` 报 `atlas-configs/dicethrone/ability-cards-gunslinger.atlas.json.json` hash/bytes 不一致 |

## 影响

- The Gang 当前基础版素材 intake 已补到规则对象级运行时接入；不能再沿用“桌面/牌槽和帮助卡仍阻塞”的旧结论。
- 既有 DiceThrone manifest 漂移不能算 The Gang 问题，也不能混入本 change 修复。
- 本轮 The Gang 基础版运行时资源、R2/CDN 压缩资源发布和桌面布局检查点已闭合：定向测试、真实页面 E2E、R2 `HeadObject` 回查、PureRef 打开截图和 AI 复看均已完成。手机验收、用户桌面验收和最终完成口径按后续流程另行裁定，不混入本地桌面检查点。
