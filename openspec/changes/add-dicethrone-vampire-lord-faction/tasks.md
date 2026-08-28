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

## 4. 机制实现、审计与真实入口

- [x] 4.1 增加吸血鬼领主基础机制结果级测试，覆盖治疗、伤害、鲜血之力获得封顶、催眠获得、流血施加、抽牌、扣 CP、弃牌堆、升级替换和 II 级上区效果。
  - note：`npx vitest run src/games/dicethrone/__tests__/vampire-lord-mechanics.test.ts src/games/dicethrone/__tests__/vampire-lord-intake.test.ts --configLoader native` 通过；机制测试 11 条、intake 测试 4 条，共 15 条覆盖共享 effect / 升级壳的最终权威状态。
- [x] 4.2 建立机制审计 evidence 和批次矩阵，明确静态接入/资源链已完成，整体仍保持 `in_progress`。
  - note：见 `evidence/dicethrone/dicethrone-vampire-lord-mechanics-audit-2026-08-28.md`。
- [ ] 4.3 裁定并实现 `blood_power` 主动消费增强：补权限矩阵、正式 token 使用入口、最终状态测试和真实入口证据。
- [ ] 4.4 裁定并实现 `mesmerize` 强迫重掷：补骰子选择/重掷交互合同、消耗与清理测试和真实入口证据。
- [ ] 4.5 裁定复合升级下区和 `slot-32` 通用牌预览冲突，并回写卡牌合同、实现和测试。
- [ ] 4.6 跑真实双玩家入口 E2E，证明选角、进入牌桌、玩家板、提示卡、手牌卡图、状态图标和关键交互可见。
