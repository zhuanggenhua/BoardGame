# Smash Up Marvel POD 英文图集独立接入证据

## 范围与边界

- 新增语言资源：`en`
- 独立 POD 派系：`avengers_pod`、`shield_pod`、`spider_verse_pod`、`ultimates_pod`、`hydra_pod`、`kree_pod`、`masters_of_evil_pod`、`sinister_six_pod`
- 不修改八个经典 Marvel 派系、经典中文图集或经典行为
- POD 与经典版仅在规则语义一致的 gameplay surfaces 上共享 handler

## 真相源与数量对账

| 图集 | 用户原图 | 原图 SHA-256 | 尺寸 | 网格 | 有效槽位 | 空槽 |
| --- | --- | --- | --- | --- | ---: | ---: |
| `marvel_villains_pod` | `image-1.png` | `fde8c2716bf91462b749800efc97043a9a032618a9f2fc42af9c736fb637ef03` | `4399 x 4096` | `9 x 6` | 49 | 5 |
| `marvel_wave_one_pod` | `image-2.png` | `e12f1a7b230666dd2731295bb856349c467badac63b6771e6e4e12f1c3ed599d` | `4399 x 4096` | `9 x 6` | 54 | 0 |

两张图集均为英文 Marvel POD 卡面，不是中文翻译卡图。

## 图集槽位合同

| 图集 | 派系 | 槽位 | 唯一定义数 | 实体牌数 |
| --- | --- | --- | ---: | ---: |
| `marvel_wave_one_pod` | Avengers POD | `0-17` | 18 | 20 |
| `marvel_wave_one_pod` | S.H.I.E.L.D. POD | `18-29` | 12 | 20 |
| `marvel_wave_one_pod` | Spider-Verse POD | `30-41` | 12 | 20 |
| `marvel_wave_one_pod` | Ultimates POD | `42-53` | 12 | 20 |
| `marvel_villains_pod` | Hydra POD | `0-10` | 11 | 20 |
| `marvel_villains_pod` | Kree POD | `11-22` | 12 | 20 |
| `marvel_villains_pod` | Masters of Evil POD | `23-34` | 12 | 20 |
| `marvel_villains_pod` | Sinister Six POD | `35-48` | 14 | 20 |

## 独立接入合同

- `SMASHUP_FACTION_IDS` 中八个 POD 派系均使用独立 `_pod` ID。
- 八组 POD 卡牌在独立数据文件中定义，全部卡牌 ID 以 `_pod` 结尾，`faction` 指向对应 POD 派系。
- 两张图集分别登记为 `MARVEL_WAVE_ONE_POD_CARDS` 和 `MARVEL_VILLAINS_POD_CARDS`。
- `FACTION_METADATA` 暴露八个独立 POD 选择项；经典 Marvel 选择项仍限制为 `zh-CN`，POD 选择项不覆盖经典项。
- variant binding 明确登记 ability、interaction、ongoing、baseAbility、powerModifier 与 basePool 的共享关系；共享只代表规则语义复用，不合并身份或资源。

## 正式资源产物

| 产物 | 尺寸 | 字节数 | SHA-256 |
| --- | --- | ---: | --- |
| `public/assets/i18n/en/smashup/cards/marvel_villains_pod.png` | `4399 x 4096` | 34,711,937 | `fde8c2716bf91462b749800efc97043a9a032618a9f2fc42af9c736fb637ef03` |
| `public/assets/i18n/en/smashup/cards/compressed/marvel_villains_pod.webp` | `4399 x 4096` | 6,320,664 | `1b6b83736dbde9cd99a5f6268ad02ddae618e5d04147a7fb06a9c1fb6e167b24` |
| `public/assets/i18n/en/smashup/cards/marvel_wave_one_pod.png` | `4399 x 4096` | 35,943,625 | `e12f1a7b230666dd2731295bb856349c467badac63b6771e6e4e12f1c3ed599d` |
| `public/assets/i18n/en/smashup/cards/compressed/marvel_wave_one_pod.webp` | `4399 x 4096` | 6,257,536 | `f410e6bf194e873884a78fb097619e0997bf12c83e199b785d05f8a7f129099a` |

WebP 由 `npm run compress:runtime-images -- public/assets/i18n/en/smashup/cards` 生成，像素尺寸与源 PNG 一致，没有降采样。

## 验证与远端回查

- 根 manifest：`public/assets/i18n/assets-manifest.json`
- 英文 Smash Up manifest：`public/assets/i18n/en/smashup/assets-manifest.json`
- 合同测试：`src/games/smashup/__tests__/marvelPodResourceContract.test.ts`
- manifest 校验：`node scripts/assets/generate_asset_manifests.js --validate --root public/assets/i18n/en --id smashup` 通过。
- Marvel POD 资源合同测试：7/7 通过；相邻派系选择、关键图片解析、variant binding、能力注册测试：92/92 通过；卡牌预览 i18n 测试：19/19 通过。
- 正式上传计划只包含下列两个 runtime WebP，路径、字节数与 MD5 均已通过上传脚本预检：
  - `official/i18n/en/smashup/cards/compressed/marvel_wave_one_pod.webp`：6,257,536 bytes，MD5 `1f333049b1c6ab7f517a12bd3d92d348`
  - `official/i18n/en/smashup/cards/compressed/marvel_villains_pod.webp`：6,320,664 bytes，MD5 `ff541e96779bc1996bfc48a970eacd57`
- 已尝试按精确 asset prefix 上传，但正式资源服务器 `admin@8.148.71.102` 拒绝当前协作者 SSH 密钥（`Permission denied (publickey)`）；本地没有可用的资源服务器凭据，因此没有将上传误报为成功。
- 截至 2026-08-13，下列公开 URL 均返回 404：
  - `https://assets.easyboardgame.top/official/i18n/en/smashup/cards/compressed/marvel_wave_one_pod.webp`
  - `https://assets.easyboardgame.top/official/i18n/en/smashup/cards/compressed/marvel_villains_pod.webp`
- 两个 runtime WebP 与两张源 PNG 均随本 PR 提交；资源服务器发布需要由具备正式 SSH 凭据的维护者完成，发布后可直接依据本节路径和哈希回查。
