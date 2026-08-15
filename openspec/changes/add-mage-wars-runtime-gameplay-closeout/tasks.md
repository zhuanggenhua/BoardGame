## 0. Approval

- [x] 0.1 用户批准本 change 改为“标准竞技场兽王 / 女祭司两派系流程跑通”；批准不等于批准全 322 张法术、教程或完整 Mage Wars。

## 1. Spec and Boundary

- [x] 1.1 更新 `openspec/specs/mage-wars/spec.md`，把当前目标从学徒模式 / 2x3 改为标准竞技场 / 4x3。
- [x] 1.2 更新本提案和 delta，明确 `apprentice` 只保留为资源/配置命名，不是运行模式目标。
- [x] 1.3 保留 foundation、状态注入视觉 E2E 和真实流程 E2E 的证据边界，禁止互相冒充。

## 2. Runtime Interaction

- [x] 2.1 默认运行时使用标准竞技场部署和 12 区域布局。
- [x] 2.2 从配置包正式部署提供兽王 / 女祭司两派系的预设法术书分页、分类和可计划卡牌。
- [x] 2.3 通过真实点击发出计划法术命令并显示计划区变化。
- [x] 2.4 通过场地直选完成来源、目标区域、目标法师或目标对象选择。
- [x] 2.5 接通流程必需的基础施法、部署、移动、守卫、攻击和攻击结算链。
- [x] 2.6 接通阶段推进、快速施法窗口和回合切换的产品入口。
- [x] 2.7 保持对手计划牌和未揭示信息的隐藏边界。

## 3. E2E

- [x] 3.1 保留桌面/移动 foundation 截图测试作为视觉回归辅助，不把它当作玩法链证据。
- [x] 3.2 使用正式联机入口覆盖双方计划、部署和隐藏信息。
- [x] 3.3 使用正式联机入口覆盖法术施放后的法力、弃牌和 FX 变化。
- [x] 3.4 使用正式联机入口覆盖移动、攻击、攻击/效果骰反馈、伤害状态和阶段推进。
- [x] 3.5 将旧的“学徒竞技场”断言改为“正式竞技场 / 标准竞技场”。

## 4. Verification

- [x] 4.1 通过 Mage Wars 定向 Vitest。
- [x] 4.2 通过 Mage Wars 定向 E2E。
- [x] 4.3 通过 `openspec validate add-mage-wars-runtime-gameplay-closeout --strict --no-interactive`。
- [x] 4.4 通过 `openspec validate mage-wars --strict --no-interactive`。
