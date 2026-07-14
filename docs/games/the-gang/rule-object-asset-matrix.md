# The Gang 规则对象素材矩阵

## 当前结论

- 本矩阵是重新打开 The Gang 基础版收口后的第一批素材 intake 事实表。
- 当前状态：核心规则和真实 UI E2E 已通过；52 张普通扑克牌牌面、牌背、24 个基础版筹码、3 个警报、金条/成功标记、TTS 牌槽素材和 TTS 参考板内容已经进入运行时。2026-07-05 已补回此前缺失的 `public/assets/i18n/zh-CN/the-gang/cards/**` 与 `chips/**` 文件本体，并用图片加载断言复验。
- 本轮不能继续用“只接入缩略图”作为资源闭环证据；完成口径必须以本矩阵逐项素材接入、语义命名、正式落盘、压缩、manifest 和运行时引用为准。
- 当前已打开 `temp/the-gang-intake/contact-sheets/sheet-01.jpg` 到 `sheet-10.jpg` 供用户查看；这只证明“给用户看图”已做，不等于 AI 已完成图面验收。

## 矩阵

| 规则对象 | 基础版必要性 | 当前素材来源 | 当前正式命名 | 当前落点 | 使用方式 | 状态 | 下一步 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 缩略图/游戏封面 | 基础版必需 | 已接入缩略图资源 | `cover` | `public/assets/i18n/zh-CN/the-gang/thumbnails/` | 运行时直接引用 | 已完成 | 保持现状 |
| 52 张普通扑克牌牌面 | 基础版必需 | 已从 TTS Workshop JSON 的 `deckId=1675` 和用户指出的 9250x7684 牌面源图重建 52 张普通扑克牌；裁切和源图映射见 `temp/the-gang-intake/the-gang-resource-rebuild.json` | `ace-clubs` 到 `king-spades` | `public/assets/i18n/zh-CN/the-gang/cards/` 52 张 PNG 与 `cards/compressed/` 52 张 WebP；The Gang manifest 中 `cards/*` 和 `cards/compressed/*` 已更新 | `Board.tsx` 可见牌运行时直接引用真实牌面，隐藏牌继续使用真实牌背 | 已接入运行时 | 已由运行时 E2E 与教程 E2E 的图片加载断言复验 |
| 扑克牌牌背 | 基础版必需 | 已从 TTS Workshop JSON 的 `BackURL` 锁定真实牌背，并完成语义落盘和压缩 | `card-back` | `public/assets/i18n/zh-CN/the-gang/cards/` 与 `cards/compressed/` | `Board.tsx` 隐藏牌运行时直接引用 | 已接入运行时 | 已通过资源文件、manifest 和截图复核确认 |
| 白/黄/橙/红筹码 1-6 星 | 基础版必需 | 已从 TTS Workshop JSON 的 `Round N => X*` 对象锁定 24 个 1-6 星筹码，排除 0/7/8 扩展筹码和红色逃跑图标；源图映射见 `temp/the-gang-intake/the-gang-resource-rebuild.json` | `round-1-white-1` 到 `round-4-red-6` | `public/assets/i18n/zh-CN/the-gang/chips/` 24 个 PNG 与 `chips/compressed/` 24 个 WebP，已写入 `assets-manifest.json` | `Board.tsx` 筹码按钮运行时直接引用 | 已接入运行时 | 已由运行时 E2E 与教程 E2E 的图片加载断言复验 |
| 警报/失败标记 | 基础版必需 | 已从 TTS 原始存档锁定 3 个带 `Alarm` 标签的真实对象：`b73632`、`9d695b`、`2e9790`；三者共用 `Custom_Tile` 图片，并已映射到本地 Steam 缓存图 | `alarm-token`、`alarm-token-back` | `public/assets/i18n/zh-CN/the-gang/markers/` 与 `markers/compressed/`；The Gang manifest 已含 `markers/alarm-token` 与 `markers/compressed/alarm-token` | `Board.tsx` 失败轨道使用真实警报图，显示 0-3 个警报 | 已接入运行时 | `Board.runtime.test.tsx` 2 tests passed；ESLint 通过 |
| 金条/成功标记 | 基础版必需 | 已从全局 Lua 的 `GoldIngot` 表锁定 6 个真实金锭模型 GUID：`677ed9`、`e7b845`、`7feb6e`、`c8129d`、`711815`、`00b809`；OBJ 模型与贴图均映射到本地缓存，贴图本身不可读，已从真实 OBJ 几何渲染出 2D 成功标记 | `gold-ingot` | `public/assets/i18n/zh-CN/the-gang/markers/` 与 `markers/compressed/`；The Gang manifest 已含 `markers/gold-ingot` 与 `markers/compressed/gold-ingot` | `Board.tsx` 成功轨道使用真实金条图，显示 0-3 个成功标记 | 已接入运行时 | `Board.runtime.test.tsx` 2 tests passed；ESLint 通过；渲染合同见 `gold-ingot-render-contract.json` |
| 桌面/牌槽/公共牌区域 | 基础版必需视觉承载 | 已从 TTS 原始对象合同 `playmat-slot-object-map.json` 锁定 19 个共用同一张 `Custom_Tile` 图片的桌面/牌槽对象，包括牌库、金库、3 个警报槽、弃牌区和玩家筹码槽；本地缓存图尺寸 321x507 | `slot-tile` | `public/assets/i18n/zh-CN/the-gang/board/slot-tile.jpg` 与 `board/compressed/slot-tile.webp`；The Gang manifest 已含 `board/slot-tile` | `Board.tsx` 公共牌牌槽与摊牌结果/弃牌承载区引用真实 TTS 牌槽素材；完整 playmat 仍保持项目布局实现 | 已接入运行时 | `slot-tile-contract.json`；PureRef 已打开 `slot-tile-preview.jpg` 供用户查看；`Board.runtime.test.tsx` 2 tests passed；ESLint 通过 |
| 玩家帮助/规则参考 | 基础版教学辅助 | 已从 TTS 原始对象锁定两个脚本参考板：`b554dc` Hand Rank Reference 和 `2533df` Info Reference；不是图片单卡，而是对象脚本内中文/英文标签数据 | `hand-rank-reference`、`info-reference` | `temp/the-gang-intake/asset-audit/workshop-open-object-details/reference-board-facts.json` 作为抽取合同；运行时文本由 `Board.tsx` 默认折叠参考入口承载 | `Board.tsx` 默认折叠的“参考”入口展示 13 个牌型标签和 16 个功能标签，避免把长说明正文常驻主 UI | 已接入运行时 | `Board.runtime.test.tsx` 断言“参考”“皇家同花顺”“金库 & 警报”，且参考面板默认折叠；ESLint 通过 |
| 扩展/工具/事件/挑战卡 | 扩展后续 | 多个 `expansion-candidate` | 不纳入本轮 | 未落盘 | 后续 change | 已裁出基础版 | 保持为后续扩展 change |
| 无关/装饰素材 | 非基础版 | `unrelated` / `decorative` | 不纳入本轮 | 未落盘 | 排除 | 已排除 | 不处理，除非后续视觉参考需要 |


## 2026-07-05 AI 轻量看图记录

- 已给用户用 PureRef 打开 `object-review/alarm_gold.jpg`、`playmat_slots.jpg`、`help_cards.jpg`、`card_faces.jpg`；这是“给用户看图”，不等于 AI 已完成全部图面验收。
- AI 已复看 `help_cards-page-01..02`：候选图中未锁定基础版帮助图片单卡；随后从 TTS 原始对象补证据，锁定 `b554dc` / `2533df` 两个脚本参考板，并将 13 个牌型标签与 16 个功能标签接入默认折叠参考入口。
- AI 已复看 `alarm_gold-page-01..06`：仅靠候选图未能锁定警报/金条；随后从 TTS 原始存档补证据，已锁定 3 个真实 `Alarm` 对象和 6 个真实 `GoldIngot` 模型对象，并完成正式资源接入。
- AI 已复看 `playmat_slots-page-01..03`：候选图只能作为布局参考；随后从 TTS 原始对象合同补证据，锁定 19 个共用 `329FE6BDC96C00CC6783E81F4402BAAA594F8D84` 图片的牌槽对象，并将其语义落盘为 `board/slot-tile` 接入公共牌和摊牌结果承载区。
- AI 已复看并处理普通扑克牌牌面：#29 已建立 52 张裁切合同并正式落盘，#184 因重叠/旋转/缺边排除；`assets-manifest.json` 已重新生成并核对 106 个 `cards/*` key 缺失数为 0。
- 2026-07-05 追加复核：发现正式资源目录只有 `assets-manifest.json`、截图仍是白块后，已从 TTS Workshop JSON 与本地 Steam 缓存重建 52 张牌、牌背和 24 个筹码；`e2e/the-gang/the-gang-runtime.e2e.ts` 与 `e2e/the-gang/the-gang-tutorial.e2e.ts` 均已加入图片真实加载断言，最新拼图 `temp/the-gang-intake/the-gang-final-screenshot-contact.jpg` 复看通过。
- 本轮已继续执行到 TTS 原始对象、源图和脚本：警报、金条、桌面/牌槽和规则参考均已形成合同并接入运行时；不能再用旧的“桌面/帮助阻塞”口径描述当前状态。

## 仍未关闭的最终口径

- 牌面、牌背、筹码、警报、金条、桌面/牌槽均已完成真实资源接入；规则参考已通过 TTS 脚本参考板数据接入默认折叠入口。
- 进入运行时的图片已完成压缩、manifest 更新和最小 Board runtime 验证。
- 真实页面截图复验和 The Gang 本轮新增压缩资源远端发布回查已完成；整个 The Gang 基础版仍保持 `in_progress`，因为手机验收、用户桌面验收和最终完成口径尚未关闭，不再因为基础版素材对象缺失或远端压缩资源缺口而阻塞，也不得归档为“最终完成”。当前和后续资源验收统一以服务器素材主源为准。
