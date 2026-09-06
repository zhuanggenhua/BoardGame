# 🎓 教程系统开发指南（Tutorial System）

本系统旨在为所有游戏提供统一、现代化且高度灵活的教学引导体验。采用“极简气泡”设计风格，支持动态定位和可选的焦点遮罩。

---

## 🏗️ 核心架构

### 1. 数据结构 (`TutorialStep`)
每个教学步骤由 `TutorialStep` 对象定义：

```typescript
export interface TutorialStep {
    id: string;          // 步骤唯一标识
    content: string;     // 气泡内显示的文本内容
    visual?: {           // 可选参考图；src 用逻辑资源路径，不写 /assets、compressed 或扩展名
        src: string;
        alt: string;     // 纯文本或 i18n key
        caption?: string;// 极短说明，纯文本或 i18n key
    };
    highlightTarget?: string; // 高亮目标（通过 data-tutorial-id 标识匹配）
    position?: string;   // 建议位置（系统会自动智能计算最佳位置）
    requireAction?: boolean; // 是否需要用户执行特定操作才能继续
    aiMove?: number;     // 智能方自动落子的索引。设置后，该步骤不显示气泡，智能方动作完成后自动进入下一步。
    showMask?: boolean;  // 是否开启暗色焦点遮罩。重要步骤建议开启，默认关闭（极简气泡）。
    infoStep?: boolean;  // 纯说明步骤：自动禁止所有游戏命令，防止用户在阅读教程时误操作。
    waitForAnimation?: boolean; // 等待动画完成后才推进到下一步（如召唤/攻击动画）。
}
```

### 2. UI 规范（`TutorialOverlay`）
- **风格**：白色圆角卡片（`bg-white rounded-xl`），带有柔和深邃的阴影（`shadow-[0_8px_30px_rgb(0,0,0,0.12)]`）。
- **高亮环**：采用 Apple 风格的蓝色发光光圈，具有脉冲动画效果。
- **气泡箭头**：位于卡片边缘的 45 度旋转方块，与卡片完美融合，指向目标。
- **遮罩层**：SVG 挖孔遮罩，支持点击穿透（用户只能点击“洞”里的元素）。

---

## 💡 开发指南

### 如何为新游戏添加教程？

1. **准备 DOM**：
   在游戏的 `Board.tsx` 中，为需要引导的元素添加 `data-tutorial-id`。
   ```tsx
   <div data-tutorial-id="cell-4" onClick={...}>...</div>
   ```

2. **定义脚本**：
   在游戏目录下创建 `tutorial.ts`，定义 `TutorialManifest`。
   ```typescript
   export const MyGameTutorial: TutorialManifest = {
       id: 'my-game-basic',
       steps: [
           { 
               id: 'step1', 
               content: '欢迎！点击中间开始。', 
               highlightTarget: 'cell-4', 
               requireAction: true,
               showMask: true // 强引导模式
           }
       ]
   };
   ```

3. **注册并启动**：
   在 `Board` 组件中使用 `useTutorial` Hook 启动。
   ```tsx
   const { startTutorial } = useTutorial();
   // 在合适时机触发
   startTutorial(MyGameTutorial);
   ```

---

## ⚠️ 最佳实践与注意事项

1. **自动步骤处理**：
   如果一个步骤只包含 `aiActions`，且没有 `requireAction` / `infoStep`，`TutorialOverlay` 会自动隐藏，让系统或智能方静默完成动作。不要在纯自动步骤写玩家必须阅读的正文；应该在自动动作之后添加可见步骤解释刚才发生了什么。反过来，如果 `aiActions` 只是帮其它席位补确认、补响应或补同步，而当前玩家仍要阅读 / 点击 / 确认，必须保留 `requireAction` 或 `infoStep`，浮层不能隐藏。

2. **卡面 / 图标图例**：
   首次教学卡牌、角色卡、帮助卡、骰面或 token 的图面字段时，若已有官方或用户确认的图例截图，优先用 `visual` 展示真实图片并配极短文案。重复字段后续不再重复贴同一张图，只讲当前对象新增的类型差异、目标限制或结算后果。

3. **遮罩使用时机**：
   - **开启遮罩**：当界面非常复杂，或者需要用户精准点击某个位置时开启。
   - **关闭遮罩**：一般的规则解释、非交互性的提示建议关闭，保持界面通透。

4. **智能定位逻辑**：
   气泡定位优先级为：**右侧 > 左侧 > 下方 > 上方**。系统会自动检测边缘空间并进行约束（Clamping，防止超出屏幕）。

5. **移动端横屏适配**：
   当视口进入移动端横屏范围时，`TutorialOverlay` 会自动改用贴边的紧凑面板布局，优先避开刘海和手势安全区，并优先选择**不遮挡当前关键目标**的位置。编写教程步骤时，不要假设文案卡片一定出现在高亮目标的同侧；如果某一步的核心目标位于棋盘中央或基地/战区附近，优先验证左侧 / 右侧贴边布局是否更安全。
   - 如果高亮目标本身是**底部/顶部条带式操作区**（例如手牌区、顶部 HUD、底部工具栏），移动端横屏下默认应优先把教程卡放到**左侧或右侧贴边**，避免把棋盘中央或下一步操作区盖住。

6. **新增/修改教程后的 UI 遮挡验收（强制）**：
   - 必须在真实 E2E 中检查教程卡片与本步关键目标之间的**遮挡关系**，不能只验证“教程出现了”。
   - 移动端横屏至少保留 1 张关键截图，截图里要同时看到：教程卡片、被引导目标、两者相对位置。
   - 如果教程步骤要求用户继续点击基地/战区/手牌/按钮，E2E 中禁止用 `force: true` 掩盖遮挡或点击失败；测试必须证明真实点击链路可继续完成。
   - 若发现遮挡，应优先调整教程位置策略或步骤布局，而不是靠提高 `z-index` 硬压过去。

7. **Hooks 限制**：
   修改 `TutorialOverlay` 时，严格遵守 React Hooks 规则：所有 Hooks 必须在任何 `return null` 之前调用。

8. **`overflow: hidden` 容器与 `scrollIntoView`**：
   当高亮目标在 `overflow: hidden` 容器（如基于 CSS transform 平移的地图组件）内时，`TutorialOverlay` 会自动跳过 `scrollIntoView` 调用。这类容器通过 transform 自行管理可见性，`scrollIntoView` 会产生意外的 `scrollTop` 偏移，与 transform 定位冲突。如果你的游戏使用了类似的 transform 容器，无需额外处理——该逻辑已在 `TutorialOverlay` 中通用解决。

9. **命令限制优先级**：
   教程系统按以下优先级检查命令限制：
   - `allowedCommands`：白名单模式，只允许列表中的命令
   - `infoStep: true`：纯说明步骤，阻止所有非系统命令
   
   **注意**：系统命令（`SYS_` 前缀）始终不受限制，包括 CHEAT 命令和教程控制命令。

10. **目标级门控（`allowedTargets`）**：
   `allowedTargets` 可以在交互步骤中限制只有特定卡牌/单位可交互，其他置灰显示。
   - 这是 **UI 层** 的门控，引擎不感知此字段，逻辑在 Board 组件中实现。
   - 各游戏自行定义"目标"含义：SmashUp = cardUid，TTT = cellId，DT = cardId 等。
   - 非允许目标视觉反馈：降低透明度 + 灰度 + 点击摇头，允许目标保留游戏原有交互样式。
   ```typescript
   {
       id: 'playMinion',
       allowedCommands: ['PLAY_MINION'],   // 命令类型门控（引擎层）
       allowedTargets: ['tut-1'],          // 目标级门控（UI 层）
       advanceOnEvents: [{ type: 'MINION_PLAYED' }],
   }
   ```

11. **动画等待**：
   对于有视觉效果的操作步骤（如召唤、攻击），设置 `waitForAnimation: true` 可以让教程等待动画播放完毕后才推进到下一步。
   
   游戏层需要在动画完成时调用 `tutorialAnimationComplete()`（从 `useTutorial()` 获取）。

---

*最后更新：2026-09-05*
