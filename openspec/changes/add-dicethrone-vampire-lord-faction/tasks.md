## 1. S0 录入与资源合同

- [x] 1.1 建立吸血鬼领主真相源表、录入核对表、卡牌录入核对表和玩家板槽位合同。
- [x] 1.2 完成正式语义命名、压缩媒体、状态 atlas、卡牌 atlas 和 manifest 重建。
- [x] 1.3 对照上一个派系 `lieren` 复核目录命名、atlas 命名、预加载和实施中标记。

## 2. 角色运行时

- [x] 2.1 注册 `vampire_lord` 角色、骰面、初始状态、Token、九个角色板技能槽和起始牌库。
- [x] 2.2 接入吸血鬼领主专属卡牌、升级替换、物理 slot 和 atlas 预览引用。
- [x] 2.3 同步中文 / 英文 i18n，保留复杂机制实施中缺口。

## 3. 验证、上传与回查

- [x] 3.1 增加吸血鬼领主 intake / registry / critical image / portrait 合同测试。
- [x] 3.2 运行定向 Vitest、i18n 校验、manifest/asset 校验和 OpenSpec strict validate。
  - note：`npm run i18n:check` 已执行；吸血鬼领主相关 key 未出现缺失，命令仍因 Mage Wars 现有 83 个可见中文文案检查失败，非本轮吸血鬼改动导致。
- [x] 3.3 执行 `xixuegui` 资源上传预检、上传和公开 URL 回查。
  - note：先同步远端发布入口缺失脚本 `scripts/assets/server-android-package-refresh.mjs` 与 `scripts/mobile/android-assets-base-url.mjs`；随后上传成功，服务器发布批次 `20260828011337846`，6 个 `xixuegui` 对象发布完成，并自动刷新 DiceThrone Android 素材索引 `edge,stable`。公开 URL 回查 6 个对象均返回 `200` 且 `x-asset-source=server`。
