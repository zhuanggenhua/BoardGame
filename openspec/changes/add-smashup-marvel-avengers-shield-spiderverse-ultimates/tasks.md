## 0. Approval

- [x] 0.1 审阅并批准本提案后再开始运行时代码实施

## 1. Intake Contract

- [x] 1.1 将 54 个唯一卡面逐卡补齐中文名、力量、中文原文和完整单卡裁图引用
- [x] 1.2 将每张卡拆成 C1/C2/C3 规则子句并标注时机、目标、可选/强制和清理
- [x] 1.3 锁定四派系的 canonical ID、20 张实体牌数量和 `0-53` atlas 索引
- [x] 1.4 建立共享机制复用表、全新机制清单和冲突/不可读字段表
- [x] 1.5 将 intake 合同从 `partial` 更新为逐卡 `locked/blocked/disputed`

## 2. Asset And Registry

- [x] 2.1 将原始 atlas 接入正式 `public/assets/smashup/cards/marvel_wave_one.png` 并生成压缩 WebP
- [x] 2.2 注册新的 `9 x 6` atlas ID 和四个 faction ID
- [x] 2.3 新增四个 faction 数据文件并在 `cards.ts` 增量注册
- [x] 2.4 补齐 faction metadata、双语 locale 和牌组选择可见性
- [x] 2.5 更新游戏级与根级 manifest、关键图片预加载和资源合同测试

## 3. Avengers

- [x] 3.1 完成复仇者 18 个唯一卡面的静态定义与 20 张牌数量
- [x] 3.2 实现复仇者全部 effect atom、天赋、持续行动与目标校验
- [x] 3.3 补复仇者 L2 行为测试、真实入口 L3/L4 E2E 和 evidence

## 4. S.H.I.E.L.D.

- [x] 4.1 完成神盾局 12 个唯一卡面的静态定义与 20 张牌数量
- [x] 4.2 实现神盾局全部 effect atom、额外打出、移动和牌库/弃牌机制
- [x] 4.3 补神盾局 L2 行为测试、真实入口 L3/L4 E2E 和 evidence

## 5. Spider-Verse

- [x] 5.1 完成蜘蛛宇宙 12 个唯一卡面的静态定义与 20 张牌数量
- [x] 5.2 实现蜘蛛宇宙全部 effect atom、特殊时机、移动和基地结算机制
- [x] 5.3 补蜘蛛宇宙 L2 行为测试、真实入口 L3/L4 E2E 和 evidence

## 6. Ultimates

- [x] 6.1 完成终极战队 12 个唯一卡面的静态定义与 20 张牌数量
- [x] 6.2 实现终极战队全部 effect atom、力量修正、移动和额外打出机制
- [x] 6.3 补终极战队 L2 行为测试、真实入口 L3/L4 E2E 和 evidence

## 7. Closeout

- [x] 7.1 运行四派系统一注册、i18n、interaction、targetType 和 atlas 审计
- [x] 7.2 运行受影响 TypeScript 文件 ESLint 与定向 Vitest
- [x] 7.3a 本轮资源交付改为 PR handoff，记录正式资源、manifest 与 `git add -f` 提交要求
- [ ] 7.3b PR 合并/作者发布后，对代表 URL 执行 `HEAD 200` 回查
- [x] 7.4 回写每个对象 L0-L4、可选跳过路径、finalState、triggerQueue 和 reaction session 结论
- [x] 7.5 完成真实派系选择和四派系可开局 E2E，记录截图绝对路径
- [x] 7.6 运行 OpenSpec 严格校验并确认所有任务状态与实际证据一致
