# Fate/Domination 资源录入核对（2026-09-30）

状态：`partial`

## 真相源

- 服务器素材清单：`https://assets-upload.easyboardgame.top/asset-publish`
- 运行时资源域名：`https://assets.easyboardgame.top/official/i18n/zh-CN/fate-domination/`
- 对照源：本地 TTS Workshop JSON `C:\Users\zhuagenbao\Documents\My Games\Tabletop Simulator\Mods\Workshop\2047461756.json`

## 已核对

- 服务器 Fate 专属对象：57 个。
- 下载到继续目录：57 个；逐对象大小 / SHA-256 核对通过。
- 与本地 `public/assets/i18n/zh-CN/fate-domination/assets-manifest.json` 对照：57/57 匹配，无跨语义重复哈希。
- `masters/compressed/emiya-shirou.webp`：卫宫士郎，`runtime`。
- `cards/compressed/attack-strength-high.webp`：干将·莫邪攻击牌，`runtime`；旧名 `master-slot-b.webp` 不代表 Master。
- `servants/compressed/saber.webp`：阿尔托莉雅·潘德拉贡 / Saber，`runtime`。
- `servants/compressed/unlocked-pending.webp`：卡背，`runtime`（背面用途），不是角色肖像。

## 缺口 / 阻塞

- 远端没有独立的绮礼与慎二 Master 图文件；OpenDesign v5 不再复用卫宫或干将·莫邪错图。
- TTS JSON 中存在绮礼、慎二的 `FaceURL`，但 Steam CDN 当前返回 HTTP 403，未能取回原图。
- 因此绮礼、慎二及第三个对手位的肖像状态为 `blocked`；不能称为“角色素材已闭合”。

## 继续动作

补齐独立角色原图并完成压缩、manifest、远端回查后，才能把对应待补位改回正式角色图。
