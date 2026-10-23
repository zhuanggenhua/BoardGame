# Fate/Domination 资产键退役合同（2026-10-21）

## 范围与来源

本合同只约束 `public/assets/i18n/zh-CN/fate-domination/assets-manifest.json` 中的 18 个旧 `compressed` 物理键。退役理由来自当前正式数据目录、现有资源录入记录，以及 `Fate-verified-runtime-assets-20261021.zip` 的逐对象清单；源 manifest 保持原有身份与结构，仅删除下表键，不改资源完整性门禁，也不重建 manifest。

- 修改前 manifest SHA-256：`9e2d4872c3b08777819898628664d817998c1e24b50b71625625ccc056b991bf`
- Library 输入：`非公开复核记录`，version `0`，文件 SHA-256：`f153af8723d2e4fdc7383b61c95078bf9fea90bf1d2ea2020da03254a9d4a295`
- 当前牌目录：`data/cards.ts` 从 `DEMO_CARDS` 构建 33 张牌；当前开放从者目录由 `data/identities.ts` 构建 13 名御主、14 名从者。

## 攻击牌旧单图键：由真实图集帧接管

当前 `cardA1/A2/A3/A4/B4` 仍是牌库定义，但其旧单图路径已不再是呈现或预加载的资源 owner。共享 `cardArtwork` owner 将手牌预览与实际图片预加载都绑定到正式图集；出牌、弃牌、检视与 `criticalImageResolver` 消费同一映射。

| 退役 manifest 键 | 当前牌 | `fate-basic-attacks` 帧 | 处理 |
| --- | --- | ---: | --- |
| `cards/compressed/attack-magic-low` | `cardA1` | 4 | 使用 `cards/basic-attack-atlas` |
| `cards/compressed/attack-magic-mid` | `cardA2` | 5 | 使用 `cards/basic-attack-atlas` |
| `cards/compressed/attack-magic-high` | `cardA3` | 6 | 使用 `cards/basic-attack-atlas` |
| `cards/compressed/attack-magic-super` | `cardA4` | 7 | 使用 `cards/basic-attack-atlas` |
| `cards/compressed/attack-strength-super` | `cardB4` | 11 | 使用 `cards/basic-attack-atlas` |

同源原图为 6000 × 2100、8 × 2，PNG SHA-256 `fdd7f4e948db94ce4ea36f912d44dc64ab78c25a96a39da33e32e2164891786a`；本地压缩图集 SHA-256 `c98d5339902502d2e6d0abcf88807e0104ab95a038a3a947ef744d1813fde115`。不裁图、不为旧键造别名。

## 旧技能卡键：当前牌目录不消费

以下七个旧 `skill-*` 物理键属于旧 fallback 资源命名，不属于当前 33 张牌定义的资产路径。当前 `cardPreparation`、`cardSurveil`、`cardluck` 分别由现有正式图集路径 `remote-control`、`rush`、`luck` 承接；另外四个未核验 fallback 卡不再由 `FATE_ATTACK_CARDS` 导出。故不将旧键映射为名称相似但含义不同的牌。

- `cards/compressed/skill-fumble`
- `cards/compressed/skill-instant-move`
- `cards/compressed/skill-luck`
- `cards/compressed/skill-moment`
- `cards/compressed/skill-preparation`
- `cards/compressed/skill-surveil`
- `cards/compressed/skill-unknown`

## 错误御主键

- `masters/compressed/master-slot-b` 是旧攻击图，不代表御主。既有 `intake/evidence/asset-intake-2026-09-30.md` 已记录这一事实；当前御主目录没有该 ID，也没有它的资源消费者。不得把攻击图伪装成御主图。

## 已迁移从者键

- `servants/compressed/saber`、`servants/compressed/saber-skill-1`、`servants/compressed/saber-skill-2`、`servants/compressed/saber-skill-3` 属于旧独立 Saber 资源命名。当前目录使用 `servant-saber` 与 `skills/sc_saber_1`、`skills/sc_saber_2`、`skills/sc_saber_np`。两组身份键不等价，不能创建别名或假定旧图内容匹配。

## 无当前消费者的旧牌背键

- `servants/compressed/unlocked-pending` 是旧解锁占位图。当前正式牌背由 `backs/servant` 等明确键提供，当前牌桌没有 `unlocked-pending` 消费点，因此退役该 manifest 键，不替它指定新用途。

## 验证合同

- 退役前后 manifest 的唯一键差异应恰为以上 18 项；其余 235 个 variants 保持原定义。
- Fate 专属 manifest 验证与原 `hasCompleteLocalE2EAssetPackage('fate-domination')` 完整性检查均须实际运行并通过；不能用本合同或另一环境的结果代替本地检查。
- 图集测试须证明五个预览帧与预加载图一致；当前开放从者牌库测试只检查 14 名从者实际引用的牌面资源，不要求未开放角色或无当前消费者的资源。
