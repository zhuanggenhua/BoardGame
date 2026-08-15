# Smash Up Geckos POD 英文图集接入证据

## 范围

- 现有派系：`adolescent_epic_geckos`
- 新增语言资源：`en`
- 不修改派系 ID、卡牌定义、能力、数量、索引或中文图集
- 用户提供的图集不含基地，本次不新增基地资源

## 真相源与数量对账

- 原始文件：`D:\共享\game\Smash Up! by Mervil (2833984701)\Mods\Images\httpssteamusercontentaakamaihdnetugc18355681399272295236F1C0B274602235E432D8E1C1438F46D765C978BC.png`
- 原始 SHA-256：`C8586CABEA8F32CE12A5D4797282BE0C94383C21C35AA086B37F714E62A4BEFC`
- 原始尺寸：`1876x2100`
- 网格：`5` 列 x `4` 行，共 `20` 张英文卡面，无空槽
- 原图顺序为行动卡优先；现有运行时合同为随从卡优先

## 槽位重排

目标槽位到原始槽位的映射：

```text
16,19,18,17,10,11,12,13,9,5,4,6,0,1,2,3,7,8,14,15
```

重排后的目标顺序：Hokusai、Kandinsky、Monet、Van Gogh、June x4、Breaking News、Flip Kick、Gecko Blimp、Gecko Power、Gecko Rap、Lasagna Party x2、Now You Know: Bullying、The Master's Teachings x2、K.C. Smith x2。

## 正式产物

| 产物 | 尺寸 | 字节数 | SHA-256 |
| --- | --- | ---: | --- |
| `public/assets/i18n/en/smashup/cards/half_the_battle_geckos.png` | `1876x2100` | 4,959,241 | `071489bdcf5675347c52354acf3cf0eb00eac8c170ef2dba458e85a51fcbd19e` |
| `public/assets/i18n/en/smashup/cards/compressed/half_the_battle_geckos.webp` | `1876x2100` | 1,518,200 | `2e7b19c01ae4ad5f30fcb40ce571ad6930221f3457b09c1147541d1efaea9edd` |

运行时 WebP 通过 `npm run compress:runtime-images -- public/assets/i18n/en/smashup/cards` 生成，像素尺寸与源 PNG 一致，未降采样。

## 人工核对

- 已打开重排后的完整图集，确认 20 个槽位均为英文卡面。
- 已按现有 `previewRef.index` 顺序逐槽核对卡名与重复张数。
- 未发现中文卡面、空槽、错位或基地卡。

## Manifest 与验证

- 根 manifest：`public/assets/i18n/assets-manifest.json`
- 英文 Smash Up manifest：`public/assets/i18n/en/smashup/assets-manifest.json`
- 两级 manifest 均登记源 PNG 与 runtime WebP，并由 intake 测试核对文件哈希和尺寸。
- `git diff --check`：通过。
- `node scripts/assets/generate_asset_manifests.js --validate --root public/assets/i18n/en --id smashup`：通过。
- `npm run assets:check -- --asset-prefix i18n/en/smashup/cards/compressed/half_the_battle_geckos.webp`：通过，待发布对象为 `official/i18n/en/smashup/cards/compressed/half_the_battle_geckos.webp`，大小 `1518200` bytes。
- `npm run test:watch -- --run src/games/smashup/__tests__/halfTheBattleFactionIntake.test.ts -t "Geckos POD 英文源图"`：通过，锁定新增英文图集的哈希、manifest 和尺寸合同。
- `npm run test:watch -- --run src/components/common/media/__tests__/CardPreview.i18n.test.tsx`：通过，`19` 个用例通过，覆盖 locale 图集路径候选链。
- 全量 `halfTheBattleFactionIntake.test.ts` 在当前隔离 worktree 仍被既有中文资源文件缺失阻断：`public/assets/i18n/zh-CN/smashup/cards/half_the_battle_geckos.png` 不存在；该失败不是本次英文图集改动引入。
- 远端运行时资源回查：`https://assets.easyboardgame.top/official/i18n/en/smashup/cards/compressed/half_the_battle_geckos.webp` 当前返回 `404`。
- 已尝试通过 `node scripts/assets/upload-to-server.js --asset-prefix i18n/en/smashup/cards/compressed/half_the_battle_geckos.webp` 上传单个 WebP；本机发布进程未及时返回，已终止，避免后台占用。
- SSH fallback 验证：`ssh -o BatchMode=yes -o ConnectTimeout=10 admin@8.148.71.102 true` 返回 `Permission denied (publickey,gssapi-keyex,gssapi-with-mic)`，当前环境没有服务器发布权限。PR 中仍包含 runtime WebP 文件本身，作者合并后可取得完整资源。
