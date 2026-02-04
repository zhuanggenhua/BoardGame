# 实现计划：DiceThrone 音效优化

## 概述

本实现计划将 DiceThrone 音效优化设计转换为可执行的编码任务。核心目标是：
1. 替换 CP 系统音效为能量类音效
2. 为 Monk 关键技能配置专属音效
3. 确保配置完整性和正确性

## 任务清单

- [x] 1. 更新 CP 音效配置
  - 修改 `src/games/dicethrone/audio.config.ts` 中的 `cp_gain` 和 `cp_spend` 音效配置
  - 将 `cp_gain` 的 `src` 改为 `'status/compressed/Charged_A.ogg'`，音量设为 0.6
  - 将 `cp_spend` 的 `src` 改为 `'status/compressed/Purged_A.ogg'`，音量设为 0.5
  - 更新分类标签为 `{ group: 'system', sub: 'cp_gain/cp_spend' }`
  - _需求：1.1, 1.2_

- [x] 2. 新增 Monk 技能音效配置
  - [x] 2.1 在 `audio.config.ts` 中新增超凡入圣音效
    - 添加 `transcendence_ultimate` 配置，使用 `'fight/compressed/FGHTImpt_Special_Hit_02.ogg'`
    - 音量设为 1.0，分类为 `{ group: 'combat', sub: 'ultimate' }`
    - _需求：2.1_
  
  - [x] 2.2 在 `audio.config.ts` 中新增雷霆一击音效
    - 添加 `thunder_strike` 配置，使用 `'fight/compressed/FGHTImpt_Versatile_Punch_Hit_02.ogg'`
    - 音量设为 0.9，分类为 `{ group: 'combat', sub: 'heavy_attack' }`
    - _需求：2.2_
  
  - [x] 2.3 在 `audio.config.ts` 中新增太极连击音效
    - 添加 `taiji_combo` 配置，使用 `'fight/compressed/SFX_Fight_Kick_Swoosh_2.ogg'`
    - 音量设为 0.85，分类为 `{ group: 'combat', sub: 'combo' }`
    - _需求：2.3_

- [x] 3. 更新 Monk 技能定义
  - [x] 3.1 为超凡入圣技能添加音效键
    - 在 `src/games/dicethrone/monk/abilities.ts` 中找到 `transcendence` 技能定义
    - 添加 `sfxKey: 'transcendence_ultimate'` 字段
    - _需求：2.1_
  
  - [x] 3.2 为雷霆一击技能添加音效键
    - 在 `abilities.ts` 中找到 `thunder-strike` 技能定义
    - 添加 `sfxKey: 'thunder_strike'` 字段
    - _需求：2.2_
  
  - [x] 3.3 为太极连击技能添加音效键
    - 在 `abilities.ts` 中找到 `taiji-combo` 技能定义
    - 添加 `sfxKey: 'taiji_combo'` 字段
    - _需求：2.3_

- [x] 4. 编写单元测试
  - [x] 4.1 创建测试文件
    - 创建 `src/games/dicethrone/__tests__/audio.config.test.ts`
    - 设置测试环境和导入必要模块
    - _需求：3.1, 3.2, 3.3, 3.4_
  
  - [ ]* 4.2 编写 CP 音效测试用例
    - 测试 `cp_gain` 配置使用正确的能量充能音效
    - 测试 `cp_spend` 配置使用正确的能量释放音效
    - 测试 `eventSoundResolver` 根据 delta 正负值返回正确音效键
    - _需求：1.1, 1.2_
  
  - [ ]* 4.3 编写 Monk 技能音效测试用例
    - 测试超凡入圣技能配置了正确的 sfxKey 和音效资源
    - 测试雷霆一击技能配置了正确的 sfxKey 和音效资源
    - 测试太极连击技能配置了正确的 sfxKey 和音效资源
    - 测试没有 sfxKey 的技能使用默认音效
    - _需求：2.1, 2.2, 2.3, 2.4_

- [x] 5. 编写属性测试
  - [x] 5.1 创建属性测试文件
    - 创建 `src/games/dicethrone/__tests__/audio.config.property.test.ts`
    - 设置测试环境和导入必要模块（包括 fs 和 path）
    - _需求：3.1, 3.2, 3.3, 3.4_
  
  - [ ]* 5.2 编写 CP 变化音效正确性属性测试
    - **属性 1：CP 变化音效正确性**
    - **验证：需求 1.1, 1.2**
    - 测试多个随机 delta 值（正数、负数、零）
    - 验证 CP 增加时返回 'cp_gain'，减少时返回 'cp_spend'
    - 验证音效资源路径包含 'Charged' 和 'Purged'
  
  - [ ]* 5.3 编写技能音效正确性属性测试
    - **属性 2：技能音效正确性**
    - **验证：需求 2.1, 2.2, 2.3, 2.4**
    - 遍历所有 Monk 技能，测试音效解析逻辑
    - 验证有 sfxKey 的技能返回自定义音效键
    - 验证没有 sfxKey 的技能返回默认音效 'ability_activate'
    - 验证所有自定义音效键在配置中存在
  
  - [ ]* 5.4 编写配置完整性属性测试
    - **属性 3：配置完整性**
    - **验证：需求 3.1, 3.2, 3.3, 3.4**
    - 遍历所有音效配置项，验证文件路径存在
    - 验证所有音量值在 0 到 1 之间
    - 验证所有分类标签符合规范（group 在允许列表中）
    - 验证所有技能 sfxKey 在配置中有对应条目

- [x] 6. 检查点 - 确保所有测试通过
  - 运行测试套件：`npm run test -- audio.config`
  - 确保所有单元测试和属性测试通过
  - 如有失败，修复配置或测试代码
  - 确认无音效文件路径错误或配置不一致问题

- [x] 7. 修复硬币音效问题
  - [x] 7.1 识别硬币音效使用位置
    - 发现 `card_sell` 使用 `Small_Coin_Drop_001.ogg`（硬币音效）
    - 发现 `card_sell_undo` 使用 `Small_Reward_001.ogg`（硬币相关音效）
    - _问题：游戏中不应该有硬币音效_
  
  - [x] 7.2 从音效列表选择替代音效
    - 选择 `FX Discard For Gold 001` 替代 `card_sell`（为金币弃牌，但不是硬币声音）
    - 选择 `FX Boost 001` 替代 `card_sell_undo`（撤销售卖，获得增益）
    - _来源：`BordGameAsset/SoundEffect/音效列表_完整.md`_
  
  - [x] 7.3 复制音频文件到 public 目录
    - 从 `BordGameAsset/SoundEffect/_source_zips/sfx/cards/Decks and Cards Sound FX Pack/FX/` 复制源文件
    - 复制 `FX Discard For Gold 001.wav` 和 `FX Boost 001.wav` 到 `public/assets/dicethrone/audio/card/`
    - 使用 ffmpeg 压缩为 `.ogg` 格式到 `compressed/` 子目录
  
  - [x] 7.4 更新音效配置
    - 修改 `card_sell` 的 `src` 为 `'card/compressed/FX_Discard_For_Gold_001.ogg'`
    - 修改 `card_sell_undo` 的 `src` 为 `'card/compressed/FX_Boost_001.ogg'`
    - 运行测试确认配置正确：`npm run test -- audio.config` ✅ 15/15 通过

- [ ] 8. 游戏内验证
- [ ] 8. 游戏内验证
  - [ ] 8.1 验证 CP 音效
    - 启动游戏，进入 DiceThrone 对局（本地或在线模式）
    - 触发 CP 增加场景（如掷出 CP 骰面），确认播放充能音效而非金币音效
    - 触发 CP 消耗场景（如使用技能），确认播放释放音效
    - _需求：1.1, 1.2_
  
  - [ ] 8.2 验证 Monk 技能音效
    - 选择 Monk 英雄进行对局
    - 触发超凡入圣技能（5 个莲花），确认播放重击音效
    - 触发雷霆一击技能（3 个掌），确认播放拳击音效
    - 触发太极连击技能（3 个拳 + 1 个掌），确认播放踢击音效
    - 触发其他技能（如拳法），确认播放默认技能音效
    - _需求：2.1, 2.2, 2.3, 2.4_
  
  - [ ] 8.3 验证卡牌售卖音效
    - 触发卡牌售卖场景，确认播放 FX 音效而非硬币音效
    - 触发撤销售卖场景，确认播放增益音效
    - _修复：硬币音效问题_
  
  - [ ] 8.4 检查控制台错误
    - 打开浏览器开发者工具控制台
    - 确认无音效加载失败警告或错误
    - 确认无 React 运行时错误或 Hooks 警告
    - _需求：3.1_

- [ ]* 9. 文档更新（可选）
  - 如果存在 `docs/dicethrone-audio.md`，更新 CP 和 Monk 音效说明
  - 补充音效选择理由和设计决策
  - 更新音效配置示例

## 注意事项

- 任务标记 `*` 的为可选任务，可根据项目进度决定是否执行
- 所有音效文件路径基于 `public/assets/dicethrone/audio/` 目录
- 音效资源来源于 `BordGameAsset/SoundEffect/音效列表_完整.md`
- 测试应在修改代码后立即运行，确保配置正确性
- 游戏内验证是最终确认步骤，确保音效听感符合预期

## 检查点说明

**检查点 6** 是关键验证节点：
- 确保所有自动化测试通过，配置完整且正确
- 如有测试失败，必须先修复再继续后续任务
- 测试通过后再进行游戏内验证，避免浪费时间

## 依赖关系

- 任务 1、2、3 可并行执行（修改不同文件）
- 任务 4、5 依赖任务 1、2、3 完成（需要测试修改后的配置）
- 任务 6 依赖任务 4、5 完成（运行测试）
- 任务 7 依赖任务 6 通过（游戏内验证）
- 任务 8 可在任务 7 完成后执行（文档更新）
