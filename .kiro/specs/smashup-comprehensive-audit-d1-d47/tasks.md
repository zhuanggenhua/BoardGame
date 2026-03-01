# 任务列表：大杀四方全面审计（D1-D47 维度）

## 阶段 1：高风险卡牌优先审计（P0）

### 任务 1.1：base_tortuga（托尔图加）全维度审计
- [x] D1 子项：验证"亚军可移动随从到替换基地"的范围限定（其他基地上的随从，非本基地）
- [x] D8：验证 afterScoring 不误用 ctx.playerId 作为亚军判定
- [x] D37：验证交互选项动态刷新（基地替换后选项更新）
- [x] GameTestRunner 测试：亚军移动随从，冠军/第三名不能移动

### 任务 1.2：alien_crop_circles（麦田怪圈）全维度审计
- [x] D1 子项：验证"从一个基地返回随从"的范围限定（单个基地，非全局）
- [x] D5：验证"任意数量"使用 multi: { min: 0, max: N }
- [x] D37：验证多步选择流程中选项自动刷新
- [x] GameTestRunner 测试：从单个基地返回多个随从，其他基地不受影响

### 任务 1.3：pirate_full_sail（全速航行）全维度审计
- [x] D1 子项：验证"移动到其他基地"正确排除当前基地
- [x] D5：验证多步循环交互的 multi 配置和停止机制
- [x] GameTestRunner 测试：移动多个随从到其他基地

### 任务 1.4：robot_microbot_reclaimer（微型机回收者）全维度审计
- [x] D8：验证"第一个随从时"使用 post-reduce 计数器（minionsPlayed === 1）
- [x] D8 子项：验证额度授予时机在 playCards 阶段可消费
- [x] GameTestRunner 测试：第一个随从触发，第二个不触发

### 任务 1.5：base_fairy_ring（仙灵圈）全维度审计
- [x] D8 子项：验证"首次打出随从后"的额度授予时机
- [x] D19：验证与 base_homeworld 同时生效时额度互不干扰
- [x] GameTestRunner 测试：首次打出触发，第二次不触发

## 阶段 2：基础版 8 派系审计

### 任务 2.1：外星人（Aliens）派系审计
- [x] D1 子项：alien_collector 本基地限定
- [x] D2 子项：alien_terraform 额度约束传递
- [x] D5：alien_supreme_overlord 可选交互配置
- [x] D8：alien_scout 基地计分后触发时机
- [x] D24：alien_terraform 多步交互状态一致性
- [x] D31：alien_scout 拦截路径完整性
- [x] D46：所有交互 displayMode 声明
- [x] GameTestRunner 测试：2-3 个代表性能力

### 任务 2.2：恐龙（Dinosaurs）派系审计
- [x] D1 子项：dino_survival_of_the_fittest 全局扫描
- [x] D8：dino_armor_stego 回合判断
- [x] D11/D12：dino_rampage 额度对称性
- [x] D14：dino_rampage 回合清理
- [x] D31：dino_tooth_and_claw、dino_wildlife_preserve 拦截路径
- [x] D33：跨派系"消灭力量更低随从"一致性
- [~] GameTestRunner 测试：3 个代表性能力

### 任务 2.3：海盗（Pirates）派系审计
- [-] D1 子项：pirate_broadside 三重条件过滤
- [~] D8：pirate_king、pirate_first_mate 时序
- [~] D31：pirate_buccaneer、pirate_first_mate 拦截路径
- [~] D33：pirate_powderkeg 跨派系一致性
- [ ] GameTestRunner 测试：3 个代表性能力

### 任务 2.4：忍者（Ninjas）派系审计
- [~] D1 子项：ninja_master 范围限定
- [~] D5：ninja_disguise 交互链完整性
- [~] D8：ninja_shinobi、ninja_acolyte 时序和计数器
- [~] D8 子项：ninja_acolyte 额度授予时机
- [~] D14：ninja_infiltrate 回合清理
- [~] D31：ninja_smoke_bomb、ninja_assassination 拦截路径
- [ ] GameTestRunner 测试：3 个代表性能力

### 任务 2.5：机器人（Robots）派系审计
- [~] D1 子项：robot_microbot_alpha 全局标记
- [~] D8：robot_microbot_fixer 计数器
- [~] D11/D12：robot_zapbot 额度约束
- [~] D19：robot_microbot_alpha 组合场景
- [~] D31：robot_warbot、robot_nukebot 拦截路径
- [~] D33：robot_hoverbot 跨派系一致性
- [ ] GameTestRunner 测试：3 个代表性能力

### 任务 2.6：巫师（Wizards）派系审计
- [~] D5：wizard_portal、wizard_scry 交互链
- [~] D8 子项：wizard_archmage、wizard_time_loop 额度授予
- [~] D11/D12：wizard_archmage 额度对称性
- [~] D24：wizard_sacrifice 状态一致性
- [~] D33：wizard_neophyte 跨派系一致性
- [ ] GameTestRunner 测试：3 个代表性能力

### 任务 2.7：僵尸（Zombies）派系审计
- [~] D1 子项：zombie_lord、zombie_outbreak 双重条件
- [~] D5：zombie_not_enough_bullets 同名判断
- [~] D8：zombie_tenacious_z 时序和限制
- [~] D31：zombie_theyre_coming_to_get_you 拦截路径
- [~] D33：zombie_grave_digger 跨派系一致性
- [ ] GameTestRunner 测试：3 个代表性能力

### 任务 2.8：捣蛋鬼（Tricksters）派系审计
- [~] D8：trickster_leprechaun、trickster_flame_trap 时序
- [~] D14：trickster_mark_of_sleep 回合清理
- [ ] D31：trickster_hideout、trickster_block_the_path 拦截路径
- [ ] D33：trickster_brownie 跨派系一致性
- [ ] GameTestRunner 测试：3 个代表性能力

## 阶段 3：扩展派系审计

### 任务 3.1：幽灵（Ghosts）派系审计
- [ ] D8：ghost_spectre 条件判断时机
- [ ] D31：ghost_haunting、ghost_incorporeal 拦截路径
- [ ] GameTestRunner 测试：2 个代表性能力

### 任务 3.2：熊骑兵（Bear Cavalry）派系审计
- [ ] D1 子项：bear_cavalry_youre_pretty_much_borscht 范围限定
- [ ] D31：bear_cavalry_general_ivan、bear_cavalry_superiority 拦截路径
- [ ] GameTestRunner 测试：2 个代表性能力

### 任务 3.3：蒸汽朋克（Steampunks）派系审计
- [ ] D1 子项：steampunk_mechanic 过滤条件
- [ ] D31：steampunk_steam_queen、steampunk_escape_hatch 拦截路径
- [ ] GameTestRunner 测试：2 个代表性能力

### 任务 3.4：食人花（Killer Plants）派系审计
- [ ] D5：killer_plant_blossom 同名判断
- [ ] D8：killer_plant_sprout 四步流程时序
- [ ] D14：killer_plant_weed_eater 回合清理
- [ ] GameTestRunner 测试：2 个代表性能力

### 任务 3.5：克苏鲁仆从（Cthulhu）派系审计
- [ ] D8：cthulhu_chosen 时序和临时修正
- [ ] D14：cthulhu_chosen 回合清理
- [ ] GameTestRunner 测试：2 个代表性能力

### 任务 3.6：远古物种（Elder Things）派系审计
- [ ] D5：elder_thing_shoggoth 三重效果交互链
- [ ] D31：elder_thing_elder_thing 拦截路径
- [ ] GameTestRunner 测试：2 个代表性能力

### 任务 3.7：印斯茅斯（Innsmouth）派系审计
- [ ] D5：innsmouth_the_locals 搜索流程
- [ ] D8：innsmouth_return_to_the_sea 拦截时机
- [ ] GameTestRunner 测试：2 个代表性能力

### 任务 3.8：米斯卡塔尼克（Miskatonic University）派系审计
- [ ] D8 子项：miskatonic_professor 双额度授予时机
- [ ] GameTestRunner 测试：2 个代表性能力

## 阶段 4：基地卡审计

### 任务 4.1：高风险基地卡审计
- [ ] base_temple_of_goju：D8 时序、D1 全局扫描
- [ ] base_homeworld：D8 子项额度授予、D11/D12 约束对称性
- [ ] base_secret_garden：D11/D12 约束对称性、D19 组合场景
- [ ] GameTestRunner 测试：3 个高风险基地

### 任务 4.2：其他复杂基地卡审计
- [ ] base_tar_pits、base_ritual_site：D31 拦截路径
- [ ] 其他具有 ongoing 能力的基地卡
- [ ] GameTestRunner 测试：5-8 个代表性基地

## 阶段 5：全局维度审计

### 任务 5.1：D37 交互选项动态刷新审计
- [ ] grep 所有 createSimpleChoice 调用点
- [ ] 检查选项类型自动推断
- [ ] 检查手动 optionsGenerator 的必要性
- [ ] GameTestRunner 测试：多交互同时触发场景

### 任务 5.2：D39 流程控制标志清除审计
- [ ] grep 所有 flowHalted = true 设置点
- [ ] 追踪清除条件是否检查背后状态
- [ ] 检查所有退出路径
- [ ] GameTestRunner 测试：阶段结束技能流程恢复

### 任务 5.3：D40 后处理循环事件去重审计
- [ ] grep 所有后处理循环
- [ ] 检查去重集合构建来源
- [ ] GameTestRunner 测试：触发链递归去重

### 任务 5.4：D45 Pipeline 多阶段调用去重审计
- [ ] 检查 executePipeline 中 postProcessSystemEvents 调用
- [ ] 验证去重机制
- [ ] GameTestRunner 测试：事件只被后处理一次

### 任务 5.5：D46 交互选项 UI 渲染模式审计
- [ ] grep 所有 createSimpleChoice 调用点
- [ ] 检查 displayMode 声明
- [ ] 验证跨派系一致性

## 阶段 6：跨能力交叉影响审计

### 任务 6.1：保护效果叠加审计
- [ ] 多个"不能被消灭"保护同时存在
- [ ] 优先级和互斥逻辑

### 任务 6.2：限制效果叠加审计
- [ ] 多个"不能打出"限制同时存在
- [ ] 合并逻辑

### 任务 6.3：触发链审计
- [ ] 一个事件触发多个持续效果
- [ ] 执行顺序和状态一致性

### 任务 6.4：特殊机制交互审计
- [ ] robot_microbot_alpha 与其他派系
- [ ] 疯狂卡机制与非克苏鲁派系

## 阶段 7：审计结果汇总

### 任务 7.1：生成审计报告
- [ ] 按严重程度分类问题
- [ ] 计算每个派系审计通过率
- [ ] 按修复优先级排序
- [ ] 标注审计反模式违规项
- [ ] 高风险卡牌结果摘要
- [ ] 提供修复建议和参考实现

### 任务 7.2：创建修复 Spec
- [ ] 基于审计结果创建修复任务 spec
- [ ] 按优先级分组修复任务
