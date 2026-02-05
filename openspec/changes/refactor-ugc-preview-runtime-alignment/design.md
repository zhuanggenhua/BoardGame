# Design: refactor-ugc-preview-runtime-alignment

## 设计目标
1. **通用性优先**：不对任何具体游戏做硬编码，所有能力可被多游戏复用。
2. **真实运行一致性**：预览层与运行时容器、接口、行为一致。
3. **需求可追溯**：需求输入可持久化并参与生成配置/代码流程。

## 关键设计

### 1) 需求结构（Builder State）
新增 `requirements` 字段并持久化（包含**编辑器内填写的需求与测试流程**）：
```ts
interface RequirementEntry {
  id: string;
  location: string; // 需求所在位置（如：规则填写/手牌区/排序）
  content: string;  // 原始需求文本
  notes?: string;   // 自动补充/优化备注
}

interface RequirementsState {
  rawText: string;         // 用户输入的原始文本
  entries: RequirementEntry[];
}
```
- **rawText** 保留原输入（含测试流程描述），**entries** 作为结构化拆解。
- 随保存/导入/导出写入 Builder 状态。

### 2) 预览与运行对齐
- 抽象 `UGCRuntimeHost`（或等价容器），统一负责：
  - 视图容器（iframe/内联）创建与生命周期
  - 受限 SDK 注入
  - 运行时上下文输入
- Builder 预览只切换“来源模式”，而不是使用独立渲染实现。

### 3) 区域组件渲染模式
新增区域级配置：
```ts
renderFaceMode: 'auto' | 'front' | 'back'
```
- `auto`：默认逻辑
- `front`：强制正面渲染
- `back`：强制背面渲染（用于隐藏其他玩家手牌）

### 4) 手牌区动作钩子（通用）
新增通用动作钩子配置：
```ts
actions: Array<{
  id: string;
  label: string;
  scope: 'current-player' | 'all';
  requirement?: string; // 需求描述（用于提示词/生成）
  hookCode?: string;    // 规则执行代码（运行时）
}>;
```
- **current-player**：仅当前玩家可用。
- 可作为“出牌/过牌/叫分/抢地主”等通用动作入口，但不硬编码具体游戏语义。

### 5) 出牌区钩子禁用
区域配置提供：
```ts
allowActionHooks: boolean; // 出牌区默认 false
```

### 6) 玩家数量推导
- 根据玩家信息组件数量推导玩家数 = `count + 1`。
- 作为上下文注入，不依赖游戏特化字段。

### 7) 需求驱动数据生成
- 在数据生成入口支持“需求驱动模式”，将 `requirements.rawText/entries` 作为提示词上下文。
- 仅生成结构化数据，不带游戏特化字段。

### 8) 端到端测试流程（需记录在需求中）
要求测试流程由用户在编辑器需求面板填写并持久化，例如：
1. 录入需求 → 生成配置/代码
2. 预览/运行使用统一 RuntimeHost
3. 验证生成数据与渲染结果

## 破坏性变更
- 不提供旧 RenderPreview 兼容层，预览统一切换至 RuntimeHost。

## 风险与对策
- **风险**：预览与运行对齐涉及多模块调整。
- **对策**：逐步替换 + 明确测试基线（E2E）。
