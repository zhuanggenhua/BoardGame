## 1. S0 录入与资源合同

- [x] 1.1 建立吸血鬼领主真相源表、录入核对表、卡牌录入核对表和玩家板槽位合同。
- [x] 1.2 完成正式语义命名、压缩媒体、状态 atlas、卡牌 atlas 和 manifest 重建。
- [x] 1.3 对照上一个派系 `lieren` 复核目录命名、atlas 命名、预加载和玩家可见生命周期标记。

## 2. 角色运行时

- [x] 2.1 注册 `vampire_lord` 角色、骰面、初始状态、Token、九个角色板技能槽和起始牌库。
- [x] 2.2 接入吸血鬼领主专属卡牌、升级替换、物理 slot 和 atlas 预览引用。
- [x] 2.3 同步中文 / 英文 i18n，保留复杂机制收口缺口，并在实施完毕和审计过前对玩家隐藏。

## 3. 验证、上传与回查

- [x] 3.1 增加吸血鬼领主 intake / registry / critical image / portrait 合同测试。
- [x] 3.2 运行定向 Vitest、i18n 校验、manifest/asset 校验和 OpenSpec strict validate。
  - note：`npm run i18n:check` 已执行；吸血鬼领主相关 key 未出现缺失，命令仍因 Mage Wars 现有 83 个可见中文文案检查失败，非本轮吸血鬼改动导致。
- [x] 3.3 执行 `xixuegui` 资源上传预检、上传和公开 URL 回查。
  - note：先同步远端发布入口缺失脚本 `scripts/assets/server-android-package-refresh.mjs` 与 `scripts/mobile/android-assets-base-url.mjs`；随后上传成功，服务器发布批次 `20260828011337846`，6 个 `xixuegui` 对象发布完成，并自动刷新 DiceThrone Android 素材索引 `edge,stable`。公开 URL 回查 6 个对象均返回 `200` 且 `x-asset-source=server`。

## 4. 机制实现、审计与真实入口

- [x] 4.1 增加吸血鬼领主基础机制结果级测试，覆盖治疗、伤害、攻击修正、鲜血之力获得封顶、催眠获得与消费、流血施加、抽牌、扣 CP、弃牌堆、升级替换和 II 级上区效果。
  - note：`npx vitest run src/games/dicethrone/__tests__/vampire-lord-mechanics.test.ts src/games/dicethrone/__tests__/vampire-lord-intake.test.ts --configLoader native` 通过；机制测试 23 条、intake 测试 4 条，共 27 条覆盖共享 effect、攻击修正、鲜血之力 / 催眠低层消费链、升级壳、复合升级下区 variants 和 `slot-32` 预览裁定的最终权威状态。
- [x] 4.2 建立机制审计 evidence 和批次矩阵，明确静态接入/资源链已完成，整体仍有残余范围，当前玩家可见状态保持 `hidden`。
  - note：见 `evidence/dicethrone/dicethrone-vampire-lord-mechanics-audit-2026-08-28.md`。
- [x] 4.3 裁定并实现 `blood_power` 主动消费增强低层链路：补权限矩阵、正式 token 消费入口和最终状态测试。
  - note：四档消费低层结果已覆盖：攻击 +3、移除 1 个状态选择、抽 2 张、按本次攻击已造成伤害治疗；4.5 已补 1/2 档本地真实入口代表链，3/4 档真实 UI 仍留到完整收口或代表链判等。
- [x] 4.4 裁定并实现 `mesmerize` 强迫重掷低层链路：补骰子选择/重掷交互合同、消耗与清理测试。
  - note：已覆盖无 token / 无对手骰不可用、投出 4 不触发后续选择、投出 5/6 后选择并重掷对手骰；4.5 已补催眠本地真实入口代表链，4.7 已补真实在线双玩家总链。
- [x] 4.5 补 `blood_power` / `mesmerize` 内部状态注入真实牌桌 E2E，证明玩家板按钮、临时骰展示、状态选择 / 对手骰选择和收口可见可用。
  - note：`node scripts/infra/run-e2e-command.mjs ci e2e/dicethrone/vampire-lord-real-entry.e2e.ts` 通过 4 条；其中 3 条本地真实入口链覆盖鲜血之力 1 档当前攻击 +3、鲜血之力 2 档状态选择移除流血、催眠临时骰 + 对手骰选择重掷 + 收口；第 4 条真实在线双玩家链见 4.7。该项不能替代 4.6 复合升级 / 预览冲突裁定，也不代表鲜血之力 3/4 档真实 UI 或防御入口已完整覆盖。
- [x] 4.6 裁定复合升级下区和 `slot-32` 通用牌预览冲突，并回写卡牌合同、实现和测试。
  - note：复合升级下区按女猎手 / 武士 / 枪手同类合同进入升级后技能 `variants`，打出升级牌只替换基础技能；`card-vampire-lord-bloodstone` 独占 `slot-32`，公共 `card-unexpected` 在吸血鬼牌库无吸血鬼 atlas `previewRef`。`vampire-lord-mechanics.test.ts` 已增至 23 条，intake 4 条，共 27 条覆盖该裁定。
- [x] 4.7 历史真实双玩家入口 E2E 已在切入隐藏生命周期前证明过吸血鬼资源可进桌；当前不再作为玩家可选验收。
  - note：旧截图只能证明当时吸血鬼资源链、玩家板、提示卡、手牌卡图、状态图标和骰面可加载；用户新要求生效后，玩家入口验收改为“选角页看不到吸血鬼，内部状态注入仍可验证资源 / 机制”。
- [x] 4.8 接入 `hidden` 玩家可见生命周期：完整目录保留 `vampire_lord`，玩家选角 UI、直接玩家命令和 AI 自动选角均过滤吸血鬼领主。
  - note：吸血鬼领主当前为 `setupOptionStatus: 'hidden'`，不显示 `implementation_in_progress` 徽标；实施完毕并审计过后，才允许切到玩家可见的 `in_progress` 展示阶段。
