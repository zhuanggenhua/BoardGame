# Smash Up 功夫斗士 / 古代印加人 POD 卡图接入证据

日期：2026-09-10

## 范围

- 接入用户提供的 `Kung Fu Fighters` 与 `Ancient Incas` POD 卡图。
- 保留现有派系与玩法实现，不新增 `*_pod` 玩法派系。
- 更新卡牌 `previewRef`、atlas catalog、资源清单与静态合同测试。
- 基地仍使用原有中文组合基地 atlas。

## 源图

| 派系 | 源文件 | SHA256 | bytes | 尺寸 | 布局 |
| --- | --- | --- | ---: | --- | --- |
| Kung Fu Fighters | `C:\Users\Dqm\.codex\attachments\d6535270-3cbe-49cf-af4a-5a2fe163a199\image-1.png` | `60b85a212b0cbe9b52cd2a665f5be27e1591ed15e613345ee370cb3167b6b806` | 5,995,300 | 1876x2100 | 4x5 row-major |
| Ancient Incas | `C:\Users\Dqm\.codex\attachments\d6535270-3cbe-49cf-af4a-5a2fe163a199\image-2.png` | `1523cd2cc537a11b70c5262deb81485fb57b36b63b3c4d37d7604c573b83cd6c` | 6,291,256 | 1876x2100 | 4x5 row-major |

## Kung Fu Fighters 槽位

| defId | POD slot |
| --- | ---: |
| `kung_fu_fighters_everybody_was_kung_fu_fighting` | 0 |
| `kung_fu_fighters_expert_timing` | 1 |
| `kung_fu_fighters_ancient_chinese_art` | 2 |
| `kung_fu_fighters_a_little_bit_frightening` | 4 |
| `kung_fu_fighters_lets_get_it_on` | 5 |
| `kung_fu_fighters_everybody_knew_their_part` | 6 |
| `kung_fu_fighters_oh_hoh_hoh_hoah` | 7 |
| `kung_fu_fighters_fast_as_lightning` | 8 |
| `kung_fu_fighters_cricket` | 12 |
| `kung_fu_fighters_drunken_master` | 16 |
| `kung_fu_fighters_lady_whirlwind` | 18 |
| `kung_fu_fighters_dragon_warrior` | 19 |

## Ancient Incas 槽位

| defId | POD slot | count |
| --- | ---: | ---: |
| `ancient_incas_signs_in_the_stars` | 0 | 1 |
| `ancient_incas_temple_of_the_sun` | 1 | 1 |
| `ancient_incas_fortress_walls` | 2 | 2 |
| `ancient_incas_armory` | 4 | 2 |
| `ancient_incas_royal_highway` | 6 | 1 |
| `ancient_incas_golden_condor` | 7 | 1 |
| `ancient_incas_ashlar_masonry` | 8 | 1 |
| `ancient_incas_quipu_strings` | 9 | 1 |
| `ancient_incas_llama` | 10 | 4 |
| `ancient_incas_incan_engineer` | 14 | 3 |
| `ancient_incas_child_of_the_sun` | 17 | 2 |
| `ancient_incas_sapa_inca` | 19 | 1 |

`Incan Engineer` 保持 x3：源图第 14、15、16 格均为该卡，古代印加人仍为 10 张行动 + 10 张随从，共 20 张实体牌。

## 资源与发布

| 文件 | SHA256 | bytes | 说明 |
| --- | --- | ---: | --- |
| `public/assets/i18n/zh-CN/smashup/cards/kung_fu_fighters_pod.png` | `60b85a212b0cbe9b52cd2a665f5be27e1591ed15e613345ee370cb3167b6b806` | 5,995,300 | PR 内保留源 PNG |
| `public/assets/i18n/zh-CN/smashup/cards/compressed/kung_fu_fighters_pod.webp` | `c7a8298d4adae34e726dfd08301959dd214639e8929b8cca0b331fee47b218ad` | 1,729,742 | 运行时资源，远端 `200` |
| `public/assets/i18n/zh-CN/smashup/cards/ancient_incas_pod.png` | `1523cd2cc537a11b70c5262deb81485fb57b36b63b3c4d37d7604c573b83cd6c` | 6,291,256 | PR 内保留源 PNG |
| `public/assets/i18n/zh-CN/smashup/cards/compressed/ancient_incas_pod.webp` | `0f57ea2aa73ba500ad3d021a7c189f44900b506feb462618341c52d8a279f5d6` | 1,644,142 | 运行时资源，远端 `200` |

- 游戏级 manifest 新增 `cards/ancient_incas_pod` 与 `cards/compressed/ancient_incas_pod`。
- 根级 manifest 新增 `zh-CN/smashup/cards/ancient_incas_pod` 与 `zh-CN/smashup/cards/compressed/ancient_incas_pod`。
- `kung_fu_fighters_pod` 条目已存在，本次本地源图与压缩图哈希和 manifest 一致。
- 远端发布：`serverPrimaryRelease=20260910004125310`，新增 `official/i18n/zh-CN/smashup/cards/compressed/ancient_incas_pod.webp`，`kung_fu_fighters_pod.webp` 由服务器判定为已存在未变化。

## 验证

- `node scripts/infra/vitest-cli-safe.mjs run src/games/smashup/__tests__/zhongguoFactionIntake.test.ts src/games/smashup/__tests__/abilities/ancient-incas.test.ts src/games/smashup/__tests__/cultureShockFourFactionsIntegration.test.ts src/games/smashup/__tests__/criticalImageResolver.test.ts src/games/smashup/__tests__/kungFuAncientIncasPodResourceContract.test.ts --configLoader native`：5 files / 48 tests passed。
- `npm run assets:validate -- --root public/assets/i18n/zh-CN --id smashup`：通过。
- `npm run assets:validate -- --root public/assets --id i18n`：被本地既有 Dicethrone 资源差异拦截，未纳入本次 diff；Smash Up 目标键已由资源合同测试和游戏级 manifest 校验覆盖。
- 远程 HEAD：
  - `https://assets.easyboardgame.top/official/i18n/zh-CN/smashup/cards/compressed/kung_fu_fighters_pod.webp`：`200`, `Content-Length=1729742`, `Content-Type=image/webp`
  - `https://assets.easyboardgame.top/official/i18n/zh-CN/smashup/cards/compressed/ancient_incas_pod.webp`：`200`, `Content-Length=1644142`, `Content-Type=image/webp`
