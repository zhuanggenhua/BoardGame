## 1. S0 录入与资源合同

- [x] 1.1 建立吸血鬼领主真相源表、录入核对表、卡牌录入核对表和玩家板槽位合同。
- [x] 1.2 完成正式语义命名、压缩媒体、状态 atlas、卡牌 atlas 和 manifest 重建。
- [x] 1.3 对照上一个派系 `lieren` 复核目录命名、atlas 命名、预加载和玩家可见生命周期标记。

## 2. 角色运行时

- [x] 2.1 注册 `vampire_lord` 角色、骰面、初始状态、Token、九个角色板技能槽和起始牌库。
- [x] 2.2 接入吸血鬼领主专属卡牌、升级替换、物理 slot 和 atlas 预览引用。
- [x] 2.3 同步中文 / 英文 i18n，并按生命周期在实施完毕和审计过前隐藏、审计通过后进入实施中。

## 3. 验证、上传与回查

- [x] 3.1 增加吸血鬼领主 intake / registry / critical image / portrait 合同测试。
- [x] 3.2 运行定向 Vitest、i18n 校验、manifest/asset 校验和 OpenSpec strict validate。
  - note：`npm run i18n:check` 已执行；吸血鬼领主相关 key 未出现缺失，命令仍因 Mage Wars 现有 83 个可见中文文案检查失败，非本轮吸血鬼改动导致。
- [x] 3.3 执行 `xixuegui` 资源上传预检、上传和公开 URL 回查。
  - note：先同步远端发布入口缺失脚本 `scripts/assets/server-android-package-refresh.mjs` 与 `scripts/mobile/android-assets-base-url.mjs`；随后上传成功，服务器发布批次 `20260828011337846`，6 个 `xixuegui` 对象发布完成，并自动刷新 DiceThrone Android 素材索引 `edge,stable`。公开 URL 回查 6 个对象均返回 `200` 且 `x-asset-source=server`。

## 4. 机制实现、审计与真实入口

- [x] 4.1 增加吸血鬼领主基础机制结果级测试，覆盖治疗、伤害、攻击修正、鲜血之力获得封顶、催眠获得与消费、流血施加、抽牌、扣 CP、弃牌堆、升级替换和 II 级上区效果。
  - note：`npx vitest run src/games/dicethrone/__tests__/vampire-lord-mechanics.test.ts src/games/dicethrone/__tests__/vampire-lord-intake.test.ts --configLoader native` 通过；机制测试 23 条、intake 测试 4 条，共 27 条覆盖共享 effect、攻击修正、鲜血之力 / 催眠低层消费链、升级壳、复合升级下区 variants 和 `slot-32` 预览裁定的最终权威状态。
- [x] 4.2 建立机制审计 evidence 和批次矩阵，明确静态接入、资源链、机制实现、真实入口和当前范围审计已收口，当前玩家可见状态为 `in_progress`。
  - note：见 `evidence/dicethrone/dicethrone-vampire-lord-mechanics-audit-2026-08-28.md`。
- [x] 4.3 裁定并实现 `blood_power` 主动消费增强低层链路：补权限矩阵、正式 token 消费入口和最终状态测试。
  - note：四档消费低层结果已覆盖：攻击 +3、移除 1 个状态选择、抽 2 张、按本次攻击已造成伤害治疗；4.5 已补 1/2/3/4 档本地真实入口链。
- [x] 4.4 裁定并实现 `mesmerize` 强迫重掷低层链路：补骰子选择/重掷交互合同、消耗与清理测试。
  - note：已覆盖无 token / 无对手骰不可用、投出 4 不触发后续选择、投出 5/6 后选择并重掷对手骰；4.5 已补催眠本地真实入口代表链，4.7 已补真实在线双玩家总链。
- [x] 4.5 补 `blood_power` / `mesmerize` 内部状态注入真实牌桌 E2E，证明玩家板按钮、临时骰展示、状态选择 / 对手骰选择和收口可见可用。
  - note：该项最初补齐鲜血之力 1 档当前攻击 +3、2 档状态选择移除流血、3 档抽 2 张牌、4 档按已造成伤害治疗、催眠临时骰 + 对手骰选择重掷 + 收口；当前 `vampire-lord-real-entry.e2e.ts` 已增至 8 条，利爪代表链见 4.9，防御入口见 4.10。该项不能替代 4.6 复合升级 / 预览冲突裁定；利爪其它分支由 4.9 的共享流程判等覆盖。
- [x] 4.6 裁定复合升级下区和 `slot-32` 通用牌预览冲突，并回写卡牌合同、实现和测试。
  - note：复合升级下区按女猎手 / 武士 / 枪手同类合同进入升级后技能 `variants`，打出升级牌只替换基础技能；`card-vampire-lord-bloodstone` 独占 `slot-32`，公共 `card-unexpected` 在吸血鬼牌库无吸血鬼 atlas `previewRef`。`vampire-lord-mechanics.test.ts` 已增至 23 条，intake 4 条，共 27 条覆盖该裁定。
- [x] 4.7 真实双玩家入口 E2E 证明吸血鬼资源可进桌，并作为切入实施中后的玩家入口回归证据。
  - note：当前玩家入口验收是“实施中可见 / 可手动选择 / 带实施中徽标 / 可进入牌桌”。
- [x] 4.8 接入 `hidden -> in_progress` 玩家可见生命周期：完整目录保留 `vampire_lord`，隐藏阶段过滤玩家入口；审计通过后玩家选角 UI 和直接玩家命令可选择，AI 自动选角仍过滤实施中角色。
  - note：`character-catalog-status.test.ts`、`vampire-lord-intake.test.ts` 和 `basic-commands-coverage.test.ts` 覆盖完整目录保留、玩家可见目录包含实施中角色、直接玩家命令可选与 AI 自动选角过滤实施中角色。
- [x] 4.9 补嗜血之爪 III 5 利爪真实入口代表链，证明升级后玩家板物理槽可触发 8 点攻击伤害。
  - note：`node scripts/infra/run-e2e-command.mjs ci e2e/dicethrone/vampire-lord-real-entry.e2e.ts` 通过 8 条；新增“嗜血之爪 III 5 利爪应通过真实投骰与玩家板物理槽触发 8 点攻击伤害”，截图显示 5 利爪投骰、槽位可触发、进入防御并结算到对手生命 50→42。I/II/III 其它 3/4/5 利爪分支仅有 `level`、`variantId`、`requiredClawCount`、`damageAmount` 配置差异，当前按 `dt-bloodthirsty-claws-variants-damage-v1` 共享流程判等放行。
- [x] 4.10 补 `undying` 不死防御真实入口 E2E，证明真实防御按钮链可用。
  - note：同一轮 E2E 通过 8 条；“不死防御应通过真实防御按钮投 4 骰并结算反击与自疗”截图显示 4 颗吸血鬼骰、确认后结束防御，收口后攻击者生命 50→49、防御方生命 42→39，并进入主要阶段 2。
- [x] 4.11 审计通过后将吸血鬼领主从 `hidden` 切入玩家可见 `in_progress` 阶段。
  - note：`core-types.ts` 中 `vampire_lord` 当前为 `setupOptionStatus: 'in_progress'`；玩家选角入口应显示实施中徽标并允许手动选择，直接玩家命令应接受，AI 自动选角仍过滤实施中角色。
