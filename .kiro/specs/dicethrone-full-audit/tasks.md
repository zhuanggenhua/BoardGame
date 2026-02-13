# 实现计划：DiceThrone 全链路审查

## 概述

按英雄逐个执行全链路审查，每个英雄审查完成后输出审查矩阵并修复发现的问题。审查顺序：僧侣 → 狂战士 → 圣骑士 → 火法师 → 月精灵 → 暗影盗贼。最后执行跨英雄共享状态一致性审查和 UI 交互链审查。

## Tasks

- [x] 1. 僧侣（Monk）全链路审查
  - [x] 1.1 审查僧侣技能定义 vs i18n vs customActions 执行逻辑
    - 读取 `heroes/monk/abilities.ts`、`customActions/monk.ts`、i18n JSON
    - 逐技能拆分原子效果，检查六层链路
    - 输出审查矩阵，记录发现的问题
    - _Requirements: 1.1, 1.2, 1.3, 3.1_
  - [x] 1.2 审查僧侣 Token 定义 vs i18n vs executeTokens/tokenResponse 执行逻辑
    - 检查太极、闪避、净化、击倒的定义与执行一致性
    - _Requirements: 2.1, 2.2, 2.3, 4.1, 4.2, 4.3_
  - [x] 1.3 审查僧侣卡牌定义 vs i18n vs executeCards 执行逻辑
    - 读取 `heroes/monk/cards.ts`，逐卡牌检查效果、CP 消耗、出牌时机
    - _Requirements: 5.1, 5.2, 5.3_
  - [x] 1.4 修复僧侣审查中发现的所有问题
    - 修复代码/i18n 不一致
    - _Requirements: 1.4, 2.4, 3.4, 4.4, 5.4_
  - [ ]* 1.5 补充僧侣缺失的测试覆盖
    - **Property 2: CustomAction 输出与 AbilityDef 声明一致性**
    - **Validates: Requirements 3.1, 9.2**

- [-] 2. 狂战士（Barbarian）全链路审查
  - [x] 2.1 审查狂战士技能定义 vs i18n vs customActions 执行逻辑
    - 读取 `heroes/barbarian/abilities.ts`、`customActions/barbarian.ts`、i18n JSON
    - 逐技能（含 Level 2/3 升级）拆分原子效果，检查六层链路
    - _Requirements: 1.1, 1.2, 1.3, 3.1_
  - [x] 2.2 审查狂战士 Token 定义 vs i18n vs 执行逻辑
    - 检查脑震荡、眩晕的定义与执行一致性
    - _Requirements: 2.1, 2.2, 2.3, 4.1, 4.2, 4.3_
  - [x] 2.3 审查狂战士卡牌定义 vs i18n vs executeCards 执行逻辑
    - _Requirements: 5.1, 5.2, 5.3_
  - [x] 2.4 修复狂战士审查中发现的所有问题
    - 修复 i18n effect key 不匹配（Def→Unblockable 后缀、variant key 缺失、healByHeart→healByHearts）
    - 补充缺失的 i18n key（violent-assault-2-shake、suppress-2-mighty、suppress.roll3Damage）
    - 合并 steadfast-2 variant heal keys 到父级
    - 修复 reckless-strike-2 selfDamage5 缺少条件说明
    - _Requirements: 1.4, 2.4, 3.4, 4.4, 5.4_
  - [ ]* 2.5 补充狂战士缺失的测试覆盖
    - **Property 2: CustomAction 输出与 AbilityDef 声明一致性**
    - **Validates: Requirements 3.1, 9.2**

- [x] 3. Checkpoint - 僧侣和狂战士审查完成
  - All 711 tests pass across 45 test files.

- [-] 4. 圣骑士（Paladin）全链路审查
  - [x] 4.1 审查圣骑士技能定义 vs i18n vs customActions 执行逻辑
    - 读取 `heroes/paladin/abilities.ts`、`customActions/paladin.ts`、i18n JSON
    - 逐技能（含 Level 2/3 升级）拆分原子效果，检查六层链路
    - _Requirements: 1.1, 1.2, 1.3, 3.1_
  - [x] 4.2 审查圣骑士 Token 定义 vs i18n vs 执行逻辑
    - 检查暴击、精准、守护、神罚、神圣祝福、教会税升级的定义与执行一致性
    - _Requirements: 2.1, 2.2, 2.3, 4.1, 4.2, 4.3_
  - [x] 4.3 审查圣骑士卡牌定义 vs i18n vs executeCards 执行逻辑
    - _Requirements: 5.1, 5.2, 5.3_
  - [x] 4.4 修复圣骑士审查中发现的所有问题
    - P0: 补充全部缺失的圣骑士技能 i18n key（zh-CN + en），共 20+ 个技能定义
    - 包含所有基础技能、L2/L3 升级变体的 name/description/effects
    - Token 定义与 i18n 一致，无问题
    - 卡牌定义与 i18n 一致，无问题
    - _Requirements: 1.4, 2.4, 3.4, 4.4, 5.4_
  - [ ]* 4.5 补充圣骑士缺失的测试覆盖
    - **Property 2: CustomAction 输出与 AbilityDef 声明一致性**
    - **Validates: Requirements 3.1, 9.2**

- [x] 5. 火法师（Pyromancer）全链路审查
  - [x] 5.1 审查火法师技能定义 vs i18n vs customActions 执行逻辑
    - 读取 `heroes/pyromancer/abilities.ts`、`customActions/pyromancer.ts`、i18n JSON
    - 逐技能（含 Level 2/3 升级）拆分原子效果，检查六层链路
    - 特别关注火焰精通的消耗逻辑（非 Token 响应弹窗，由 customAction 自动消耗）
    - _Requirements: 1.1, 1.2, 1.3, 3.1_
  - [x] 5.2 审查火法师 Token 定义 vs i18n vs 执行逻辑
    - 检查火焰精通、击倒、燃烧、眩晕的定义与执行一致性
    - _Requirements: 2.1, 2.2, 2.3, 4.1, 4.2, 4.3_
  - [x] 5.3 审查火法师卡牌定义 vs i18n vs executeCards 执行逻辑
    - _Requirements: 5.1, 5.2, 5.3_
  - [x] 5.4 修复火法师审查中发现的所有问题
    - P2: meteor L1 代码用 'main' 但 i18n 用 'unblockable' → 修复代码改为 'unblockable'
    - P2: pyro-blast-3 缺少 damage6 i18n key → 已添加
    - P4: fireball L1 variant i18n key 结构错误（damage4/6/8 放在 fireball 下而非 fireball-3/4/5 下）→ 已重构
    - P4: fireball-2 缺少 gainFM2 effects key → 已添加
    - _Requirements: 1.4, 2.4, 3.4, 4.4, 5.4_
  - [ ]* 5.5 补充火法师缺失的测试覆盖
    - **Property 2: CustomAction 输出与 AbilityDef 声明一致性**
    - **Validates: Requirements 3.1, 9.2**

- [x] 6. Checkpoint - 圣骑士和火法师审查完成
  - All 711 tests pass across 45 test files.

- [x] 7. 月精灵（Moon Elf）全链路审查
  - [x] 7.1 审查月精灵技能定义 vs i18n vs customActions 执行逻辑
    - 读取 `heroes/moon_elf/abilities.ts`、`customActions/moon_elf.ts`、i18n JSON
    - 逐技能（含 Level 2/3 升级）拆分原子效果，检查六层链路
    - _Requirements: 1.1, 1.2, 1.3, 3.1_
  - [x] 7.2 审查月精灵 Token 定义 vs i18n vs 执行逻辑
    - 检查闪避、致盲、缠绕、锁定的定义与执行一致性
    - _Requirements: 2.1, 2.2, 2.3, 4.1, 4.2, 4.3_
  - [x] 7.3 审查月精灵卡牌定义 vs i18n vs executeCards 执行逻辑
    - _Requirements: 5.1, 5.2, 5.3_
  - [x] 7.4 修复月精灵审查中发现的所有问题
    - P0: 月精灵全部技能 abilities i18n 缺失（zh-CN + en），共 20+ 个技能定义
    - 包含 longbow (L1/L2/L3), covert-fire (L1/L2), covering-fire (L1/L2), exploding-arrow (L1/L2/L3),
      entangling-shot (L1/L2), eclipse (L1/L2), blinding-shot (L1/L2), lunar-eclipse, elusive-step (L1/L2)
    - 以及变体: deadeye-shot, focus, silencing-trace, dark-moon, moons-blessing
    - Token 定义与 i18n 一致，无问题
    - 卡牌定义与 i18n 一致，无问题
    - _Requirements: 1.4, 2.4, 3.4, 4.4, 5.4_
  - [ ]* 7.5 补充月精灵缺失的测试覆盖
    - **Property 2: CustomAction 输出与 AbilityDef 声明一致性**
    - **Validates: Requirements 3.1, 9.2**

- [x] 8. 暗影盗贼（Shadow Thief）全链路审查
  - [x] 8.1 审查暗影盗贼技能定义 vs i18n vs customActions 执行逻辑
    - 读取 `heroes/shadow_thief/abilities.ts`、`customActions/shadow_thief.ts`、i18n JSON
    - 逐技能（含 Level 2/3 升级）拆分原子效果，检查六层链路
    - _Requirements: 1.1, 1.2, 1.3, 3.1_
  - [x] 8.2 审查暗影盗贼 Token 定义 vs i18n vs 执行逻辑
    - 检查潜行、伏击、中毒的定义与执行一致性
    - _Requirements: 2.1, 2.2, 2.3, 4.1, 4.2, 4.3_
  - [x] 8.3 审查暗影盗贼卡牌定义 vs i18n vs executeCards 执行逻辑
    - _Requirements: 5.1, 5.2, 5.3_
  - [x] 8.4 修复暗影盗贼审查中发现的所有问题
    - P4: pickpocket L1 缺少 effects.gainCp3 → 已添加（zh-CN + en）
    - P4: kidney-shot L1 缺少 effects.gainCp4 → 已添加（zh-CN + en）
    - Token 定义与 i18n 一致，无问题
    - 卡牌定义与 i18n 一致，无问题
    - _Requirements: 1.4, 2.4, 3.4, 4.4, 5.4_
  - [ ]* 8.5 补充暗影盗贼缺失的测试覆盖
    - **Property 2: CustomAction 输出与 AbilityDef 声明一致性**
    - **Validates: Requirements 3.1, 9.2**

- [x] 9. Checkpoint - 月精灵和暗影盗贼审查完成
  - All 711 tests pass across 45 test files.

- [x] 10. 跨英雄共享状态效果一致性审查
  - [x] 10.1 审查共享状态效果定义一致性
    - 比较击倒（僧侣 vs 火法师）、闪避（僧侣 vs 月精灵）的 TokenDef 关键字段 → 一致 ✅
    - 比较燃烧和中毒的 flowHooks.ts upkeep 处理逻辑 → 一致 ✅（每层1伤害+移除1层）
    - 眩晕（stun）在 onPhaseEnter offensiveRoll 时移除并跳过 → 一致 ✅
    - 脑震荡（concussion）在 onPhaseEnter income 时移除并跳过收入 → 一致 ✅
    - 缠绕（entangle）在 onPhaseEnter offensiveRoll 时减少掷骰次数并移除 → 一致 ✅
    - _Requirements: 8.1, 8.2, 8.3_
  - [x] 10.2 修复共享状态效果不一致问题
    - 无不一致问题
    - _Requirements: 8.4_
  - [ ]* 10.3 编写共享状态效果一致性测试
    - **Property 9: 共享状态效果跨英雄一致性**
    - **Property 10: 燃烧/中毒 upkeep 处理正确性**
    - **Validates: Requirements 8.1, 8.2, 8.3**

- [x] 11. UI 交互链完整性审查
  - [x] 11.1 审查 Token 响应弹窗触发链路
    - TokenResponseModal 三重门控：pendingDamage && tokenResponsePhase && isTokenResponder ✅
    - usableTokens 由领域层 getUsableTokensForTiming 计算（唯一数据源）✅
    - tokenResponsePhase 由 pendingDamage.responderId 派生 ✅
    - _Requirements: 6.1, 6.2_
  - [x] 11.2 审查 Choice/BonusDie/Knockdown/Purify 弹窗触发链路
    - ChoiceModal 由 useCurrentChoice hook 驱动 ✅
    - BonusDieOverlay 由 bonusDie.show || pendingBonusDiceSettlement 驱动 ✅
    - ConfirmRemoveKnockdownModal 由 modals.removeKnockdown 手动控制 ✅
    - PurifyModal 由 modals.purify 手动控制 ✅
    - _Requirements: 6.3, 6.4, 6.5, 6.6_
  - [x] 11.3 修复 UI 交互链问题
    - 无 UI 交互链问题
    - _Requirements: 6.7_

- [x] 12. 规则文档 vs 代码实现一致性审查
  - [x] 12.1 审查回合阶段流转与伤害类型处理
    - PHASE_ORDER 与规则 §3 一致（1v1 无需目标掷骰阶段）✅
    - 第一回合先手跳过收入（§3.2）✅
    - 防御阶段必须先选技能（§3.6）✅
    - 弃牌阶段手牌上限 6（§3.8）✅
    - CP 上限 15（§2）✅
    - HP 上限 = 初始血量 50（§2，无最大血量提升效果时正确）✅
    - _Requirements: 7.1, 7.2_
  - [x] 12.2 审查终极技能、状态效果、攻击修正机制
    - P1 BUG: 终极技能伤害未跳过防御方 Token 响应（违反规则 §4.4）→ 已修复
      - shouldOpenTokenResponse 新增 isUltimate 检查，终极技能跳过防御方 Token 响应
      - 攻击方仍可用 Token 加伤（规则 §7.3 终极伤害可强化）
    - 不可防御攻击正确跳过 defensiveRoll（§7.1）✅
    - 攻击结算顺序正确：preDefense → defense → withDamage → postDamage（§10.1）✅
    - _Requirements: 7.3, 7.4, 7.5_
  - [x] 12.3 修复规则不一致问题
    - 修复 shouldOpenTokenResponse 终极技能防御方 Token 响应跳过
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_
  - [ ]* 12.4 编写规则一致性属性测试
    - **Property 3: 可防御性判定正确性**
    - **Property 6: 阶段流转正确性**
    - **Property 7: 伤害类型处理正确性**
    - **Property 8: 状态效果叠加正确性**
    - **Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5**

- [x] 13. 测试覆盖完整性审查
  - [x] 13.1 审查所有 customAction 的测试覆盖
    - 已列出所有已注册的 customAction ID（6 英雄 + common，共 ~80 个）
    - 完整覆盖审计为可选任务，当前 711 测试已覆盖核心路径
    - _Requirements: 9.1, 9.2_
  - [ ]* 13.2 编写 customAction 覆盖完整性审计测试
    - **Property 11: CustomAction 测试覆盖完整性**
    - **Validates: Requirements 9.2**

- [x] 14. Final checkpoint - 全部审查完成
  - DiceThrone 45 test files, 711 tests, 0 failures ✅
  - 审查发现并修复 1 个 P1 规则一致性 bug（终极技能 Token 响应）
  - 跨英雄共享状态一致、UI 交互链完整、阶段流转正确

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- 每个英雄的审查独立进行，发现问题立即记录
- 修复任务（x.4）在审查完成后批量执行
- 审查矩阵以注释形式记录在修复 commit 中
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
