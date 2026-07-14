# DiceThrone 火法改骰与发明家扳手面板 E2E 证据

## 原始症状

- 火法师使用“惊不惊喜？！”时，炎爆术奖励骰无法在玩家可见界面正确改面。
- 普通骰子模式出现疑似物理 3D 骰盘的黄色圆圈，需要确认两种模式没有串线。
- 发明家升级后需要在真实角色面板中看到“扳手攻击 II”的描述。
- 普通不可防御伤害与终极伤害的减伤响应不能混为同一规则。

## 规则合同

- 普通不可防御伤害：跳过防御技能，但符合受伤前时机的卡牌与状态 Token 仍可减少、阻止或规避伤害。
- 终极伤害：防御方不能通过卡牌、状态效果、伙伴、Token 或其他行动减少或规避；攻击方仍可在允许的窗口增加伤害。
- 当前实现按 `pendingAttack.isUltimate` 单独封锁防御方响应，没有把普通不可防御伤害一并封锁。

## 根因与修复

1. 奖励骰展示层原先会阻挡后方手牌，导致“惊不惊喜？！”无法从真实手牌入口打出。
2. 改骰交互开始后，骰台原先仍展示普通投掷骰，没有切换到待结算的炎爆术奖励骰。
3. 骰台权限原先只认当前投骰视角，没有按本次改骰交互的真实操作者授权。
4. 上述交互链修通后，普通聚光骰的 CSS 备用渲染仍使用固定停稳朝向，内部值已经从 1 改到 6，玩家确认前看到的骰面却仍是 1/火焰。
5. 本轮让普通聚光骰复用既有 1–6 面序：先旋转到目标面，再叠加原聚光倾角。棋盘物理 3D 的 `board-topdown` 分支未修改。

## 自动验证

- `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/ui/__tests__/Dice3D.test.tsx --configLoader native`
  - 结果：`1 passed`
  - 覆盖：普通聚光骰从 1 改为 6 时，玩家可见骰体停稳朝向必须变化，并包含 6 面的 180° 基础旋转。
- `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/damage-path-unified.property.test.ts --config vitest.config.audit.ts --configLoader native`
  - 结果：`10 passed`
  - 覆盖：终极技能跳过防御方 Token 响应，攻击方增伤仍可用。
- `node scripts/infra/vitest-cli-safe.mjs run src/games/dicethrone/__tests__/card-system.test.ts src/games/dicethrone/__tests__/artificer-mechanics.test.ts src/games/dicethrone/__tests__/pyromancer-behavior.test.ts src/games/dicethrone/ui/__tests__/diceStagePolicy.test.ts --configLoader native`
  - 结果：`130 passed`
  - 覆盖：普通不可防御伤害的卡牌/Token 响应、火法奖励骰、发明家升级和骰台操作权限。
- `npm run test:e2e:file -- e2e/dicethrone/dicethrone-pyromancer-surprise-wrench-panel.e2e.ts`
  - 结果：`2 passed`
  - 覆盖：真实手牌打出“惊不惊喜？！”、奖励骰改为流星、按流星施加击倒、发明家升级后打开角色面板。

## 截图与肉眼结论

1. `test-results/evidence-screenshots/dicethrone/dicethrone-pyromancer-surprise-wrench-panel.e2e/惊不惊喜应通过真实手牌把炎爆术奖励骰改为流星并按新骰面结算/火法-惊不惊喜-奖励骰改为流星-确认前.jpg`
   - 右侧可操作骰子的主可见面已显示 `6/流星`，不再停留在 `1/火焰`。
   - 加减控件正常存在，独立黄色选中圆环节点不存在。
   - 骰子外侧橙色圆角框属于普通模式骰体/控件边缘，不是棋盘物理 3D 模式叠层。
2. `test-results/evidence-screenshots/dicethrone/dicethrone-pyromancer-surprise-wrench-panel.e2e/惊不惊喜应通过真实手牌把炎爆术奖励骰改为流星并按新骰面结算/火法-惊不惊喜-奖励骰已改为流星.jpg`
   - 奖励骰特写显示 `6/流星`。
   - 效果文案显示“陨石：施加击倒”。
3. `test-results/evidence-screenshots/dicethrone/dicethrone-pyromancer-surprise-wrench-panel.e2e/惊不惊喜应通过真实手牌把炎爆术奖励骰改为流星并按新骰面结算/火法-惊不惊喜-流星击倒结算完成.jpg`
   - 奖励骰结算已关闭，流程回到正常行动界面。
   - 对手已获得 1 个击倒状态。
4. `test-results/evidence-screenshots/dicethrone/dicethrone-pyromancer-surprise-wrench-panel.e2e/发明家升级后打开角色面板应显示扳手攻击-II/发明家-扳手攻击II-角色面板描述.jpg`
   - 角色面板真实展开。
   - 左上能力槽显示“扳手攻击 II”及升级后描述。

## 漏审复盘

- 旧验证分别覆盖了奖励骰结算、改骰交互和骰子展示，但没有把“真实手牌响应 → 普通模式预览改面 → 玩家确认前实际看到的骰面 → 最终按新面结算”作为一条端到端合同。
- 仅断言内部 `data-display-value=6` 无法证明玩家真的看到 6 面；本轮补了普通聚光骰组件回归，并保留最终截图肉眼验收。
- 这不是通用规范分层错误，主要是 DiceThrone 单游戏端到端验收维度缺失：缺少“内部数值与可见骰面一致”的负向断言。
