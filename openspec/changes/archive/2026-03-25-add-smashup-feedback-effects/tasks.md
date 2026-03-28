## 1. P1：核心游戏循环反馈

- [x] 1.1 创建 `src/games/smashup/ui/useGameEvents.ts`，消费 EventStreamSystem 事件驱动动画
- [x] 1.2 实现随从入场动画（MinionCard 使用 motion.div，弹跳落地 + 随机旋转）
- [x] 1.3 实现行动卡打出展示动画（居中展示 → 缩小消失，ActionCardShowOverlay）
- [x] 1.4 增强基地临界点反馈（力量 >= 80% 脉冲抖动，达到临界点放大变色 + 光晕）
- [x] 1.5 实现基地记分动画（VP 飞行效果 + 计分板弹跳高亮）

## 2. P2：体验提升

- [x] 2.1 实现力量变化浮字（"+N" 手写风格，淡出上飘，PowerChangeFloat）
- [x] 2.2 实现回合/阶段切换提示动画（便签翻页 + "Your Turn!" 全局提示 + 阶段标签弹入）
- [x] 2.3 实现合法目标邀请效果（已有：选中随从时基地 ring-green + scale + glow）
- [x] 2.4 实现不可操作抖动反馈（HandCard 摇头抖动 rotate keyframes）

## 3. P3：锦上添花

- [ ] 3.1 实现抽牌飞入动画
- [ ] 3.2 实现弃牌滑出动画
- [ ] 3.3 实现随从堆叠 hover 扇形展开
