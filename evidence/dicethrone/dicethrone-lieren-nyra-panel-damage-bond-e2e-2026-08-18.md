# DiceThrone 女猎手妮拉状态与伤害响应 E2E 证据

日期：2026-08-18

> 2026-08-18 15:36 更新：本文对应上一版“转移伤害 + 确认分配”两按钮流程，已被 `dicethrone-lieren-nyra-single-allocation-control-e2e-2026-08-18.md` 和 `nyra-single-allocation-control-pass-manifest-2026-08-18.json` 取代。旧图只保留为历史证据，不再作为当前最终开图依据。

验收状态：PASS。上一版“左侧玩家面板内部左上 / 左上正式响应面板”的 PASS 口径已废弃；上一轮“小徽章”PASS 在用户指出“左上空间没这么小”后也已降级为历史证据，不能作为当前收口证据。

## 本轮要求

- 妮拉状态放进中间女猎手玩家板图片本身的左上角空白带，不放在左侧 HUD，也不挤压 Buff / 状态图标。
- 妮拉状态必须充分利用玩家板左上空白带，不能再缩成过小角标。
- 左侧 HUD 的 Buff / 状态图标、生命 / CP、牌堆和回合顺序必须保持原职责，不被妮拉徽章占位、遮挡或挤压。
- 妮拉承伤与羁绊分配必须使用玩家能读、能点的居中响应弹窗；不存在任何规范要求它靠左。
- 重新产出妮拉承伤与羁绊分配全流程截图，并在最终 PASS 后只用 PureRef 打开一次最终有序图组。

## 当前修正

- 女猎手玩家板登记为自己的 v2 图片尺寸与布局版本，避免用默认英雄布局推导图片内坐标。
- 妮拉状态牌改挂在 `player-board-surface` 内，锚点语义为“玩家板图片左上角空白带”；左侧 HUD、生命 / CP 行和状态图标区不再承载妮拉。
- 妮拉状态牌已放大为可读状态小面板，并由 E2E 断言锁定：它必须明显占用玩家板左上空白带，同时底部不得压到左上技能牌槽。
- 伤害响应控件通过 HUD Portal 渲染到视口层，保持真正居中；删除旧测试里“贴近左侧 / 不进入中间玩家板区域”的错误验收合同。
- 妮拉弹窗根层阻止点击事件冒泡，避免点击响应按钮误触发玩家板放大预览。
- PureRef 开图入口增加最近一次 PASS 清单 + 媒体列表去重；同一图组重复打开需要用户明确要求并追加 `--force-reopen`。

## 关键截图观察

- `02-牌桌-妮拉在玩家板图片左上空白.jpg`：妮拉状态牌在中间女猎手玩家板图片内部左上空白带，已从旧小角标放大为可读小面板；左侧 Buff / 状态图标、生命 / CP 条、牌堆和回合顺序保持原位置，没有被妮拉占位或挤压，状态牌底部也没有压到左上技能牌。
- `03-伤害响应-妮拉居中承伤与羁绊分配弹窗.jpg`：4 点待处理伤害打开后，妮拉承伤 / 羁绊分配弹窗位于画面中轴，按钮、滑杆、当前伤害和妮拉生命 / 羁绊数量清楚可读；弹窗没有压住左侧状态区、资源条、牌堆或底部手牌主体。
- `04-转移伤害后-妮拉直接承伤收口.jpg`：点击“转移伤害”后弹窗退场，妮拉生命显示 `1/7`，证明直接承伤链路完成。
- `05-确认羁绊分配后-妮拉承伤收口.jpg`：重新进入响应并点击“确认分配”后弹窗退场，妮拉生命显示 `1/7`，羁绊显示 `0/1`，证明羁绊分配链路完成。

## 验证命令

- `npx tsc --noEmit --pretty false --incremental false`
- `npm run test:e2e:file -- e2e/dicethrone/lieren-intake.e2e.ts`
- `npx vitest run src/games/dicethrone/__tests__/criticalImageResolver.test.ts src/games/dicethrone/__tests__/character-catalog-status.test.ts --configLoader native`
- `npm run spec:lint`
- `python .spec/skills/show-image-to-user/scripts/label-image-sequence.py --out-dir <_labeled-for-pureref-nyra-player-board-larger-badge-center-modal-20260818> ...`：生成 1 张序号索引和 4 张中文标记图。
- `node scripts/verify/open-verified-image.mjs --pass-manifest evidence/dicethrone/nyra-player-board-larger-badge-center-modal-pass-manifest-2026-08-18.json --viewer pureref --dry-run --paths <00-04 标记图>`：dry-run 通过，证明新 PASS 清单覆盖当前图组。
- `node scripts/verify/open-verified-image.mjs --pass-manifest evidence/dicethrone/nyra-player-board-badge-center-modal-pass-manifest-2026-08-18.json --viewer pureref --dry-run --path <新 00 索引图>`：脚本拒绝旧小徽章清单，提示 PASS 清单 `verdict` 必须是 `PASS`。
- `node scripts/verify/open-verified-image.mjs --pass-manifest evidence/dicethrone/nyra-player-board-larger-badge-center-modal-pass-manifest-2026-08-18.json --viewer pureref --paths <00-04 标记图>`：一次性打开 5 张最终标记图；执行前 PureRef 进程为 `11892,44916,52536`，执行后为 `11892,44916,52536,55736`，本轮只调用一次最终图组打开命令，本地 PureRef 自身新增进程 `55736`。

## 图面裁决

verdict: PASS

- 妮拉位置：PASS，放大后的妮拉状态牌位于中间女猎手玩家板图片内部左上空白带；不是左侧 HUD，也没有压住 Buff / 状态图标、生命 / CP 或左上技能牌槽。
- 居中弹窗：PASS，承伤 / 羁绊分配弹窗在 1280x720 视口水平与垂直居中，使用 HUD Portal 脱离玩家板 transform 容器；不存在靠左规范。
- 直接承伤：PASS，响应面板可读可点，点击后妮拉生命扣到 `1/7` 并收口。
- 羁绊分配：PASS，滑杆与确认入口可用，确认后妮拉生命为 `1/7` 且羁绊归零。
- 开图门禁：PASS 清单改用 `nyra-player-board-larger-badge-center-modal-pass-manifest-2026-08-18.json`；旧 `nyra-player-board-badge-center-modal-pass-manifest-2026-08-18.json` 和旧 `nyra-damage-bond-pass-manifest-2026-08-18.json` 均不得再用于最终开图。
- PureRef 打开：PASS，一次命令把序号索引和四张标记图传入 PureRef；最终图组路径为 `_labeled-for-pureref-nyra-player-board-larger-badge-center-modal-20260818`。
