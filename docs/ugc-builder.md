# UGC Builder 文档

> UGC (User Generated Content) Builder 是一个通用的桌游原型构建工具，支持从 Schema 定义到 AI 规则生成的完整工作流。

## 访问路由

- `/dev/ugc` - 统一 Builder（推荐入口）
- `/dev/ugc/runtime-view` - 运行时预览视图（iframe 使用）
- `/dev/ugc/schema` - Schema 定义演示
- `/dev/ugc/scene` - 场景画布演示
- `/dev/ugc/rules` - 规则生成演示

## 相关文档

- [UGC 总览](./ugc/ugc-overview.md)
- [UGC 规则模板（DomainCore）](./ugc/ugc-rule-template.md)

## 核心功能

### 1. Schema 定义

定义游戏中的数据结构（如卡牌、武将、技能等）。

**支持的字段类型：**
- `string` - 文本
- `number` - 数字
- `boolean` - 布尔
- `array` (tags) - 标签列表
- `effects` - 效果代码（AI 生成）
- `code` - 自定义代码

**操作：**
- 添加/删除 Schema
- 添加/删除/编辑字段
- 修改字段名称和类型

### 2. 数据管理

管理 Schema 对应的数据实例。

**功能：**
- 表格展示（暗色主题）
- 搜索/排序
- 添加/编辑/删除数据行
- 双击编辑弹窗

### 3. UI 布局画布

拖拽配置游戏界面。

**组件类型：**

| 分类 | 组件 | 说明 |
|------|------|------|
| 卡牌机制 | 手牌区、牌堆、出牌区 | 可绑定 Schema |
| 玩家信息 | 玩家信息、资源栏 | 显示玩家状态 |
| UI 元素 | 操作栏、消息日志 | 界面辅助 |

**操作：**
- 从左侧组件库拖拽到画布
- 移动组件位置（拖拽）
- 调整组件尺寸（右下角手柄）
- 删除组件（红色按钮 / Delete 键）
- 点击选中查看属性

### 4. AI 规则生成

根据 Schema 和数据生成 **UGC DomainCore** 规则代码的提示词（输出 `domain` 对象）。

**输出契约：**
- `domain.gameId`
- `domain.setup / validate / execute / reduce / isGameOver / playerView`
- 状态结构为 `UGCGameState`（必须可序列化）

**使用方式：**
1. 点击工具栏“生成规则”按钮
2. 生成完整提示词
3. 复制到 AI 对话框生成代码并粘贴到规则代码框

### 5. 需求驱动数据生成

需求输入支持两种形态并会持久化保存：

- **总体需求**：在规则生成面板中填写的 rawText。
- **结构化条目**：记录具体位置需求（如区域/交互/过滤）。

在 "AI 批量生成" 中，会自动把需求与本次输入合并为统一上下文，避免手动拼接。

### 6. 预览/运行对齐

预览画布复用运行时容器，不保留旧预览逻辑：

- Builder 预览使用 `UGCRuntimeHost`（iframe）
- 运行时视图 `UGCRuntimeView` 通过 SDK 接收状态
- 预览配置存放在 `publicZones` 中，运行态与预览态一致

### 7. 保存/加载

**功能：**
- **保存** - 登录后保存到云端草稿；未登录仅保存到本地 localStorage
- **草稿列表** - 查看/打开/删除云端草稿，支持从当前内容创建草稿
- **导出** - 下载 JSON 文件
- **导入** - 上传 JSON 文件
- 页面加载自动恢复本地缓存
- 自动保存（500ms 防抖），云端草稿同步失败会自动回退到本地缓存

## 技术架构

```
src/ugc/builder/
├── ai/                     # AI 提示词生成
│   ├── PromptGenerator.ts  # 核心生成器
│   └── index.ts
├── pages/                  # 页面组件
│   ├── UnifiedBuilder.tsx  # 统一 Builder（主入口）
│   ├── SchemaBuilderDemo.tsx
│   ├── SceneBuilderDemo.tsx
│   └── RulesGeneratorDemo.tsx
├── schema/                 # Schema 定义
│   └── types.ts            # 类型和工具函数
├── ui/                     # UI 组件
│   ├── DataTable.tsx       # 数据表格
│   └── SceneCanvas.tsx     # 场景画布
└── __tests__/              # 测试用例
    └── UnifiedBuilder.test.ts
```

## 数据结构

### GameContext

```typescript
interface GameContext {
  name: string;           // 游戏名称
  description: string;    // 描述
  tags: string[];         // 标签
  schemas: SchemaDefinition[];  // Schema 列表
  instances: Record<string, Record<string, unknown>[]>;  // 数据实例
  layout: SceneComponent[];  // UI 布局
}
```

### SchemaDefinition

```typescript
interface SchemaDefinition {
  id: string;
  name: string;
  description: string;
  fields: Record<string, FieldDefinition>;
  primaryKey?: string;
}
```

### SceneComponent

```typescript
interface SceneComponent {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  data: Record<string, unknown>;
}
```

## 测试

运行测试：
```bash
npx vitest run src/ugc/builder/__tests__/UnifiedBuilder.test.ts
```

端到端测试：
```bash
npx playwright test e2e/ugc-builder.e2e.ts
```

测试覆盖：
- PromptGenerator（4 个测试）
- Schema 工具函数（3 个测试）
- createEmptyContext（1 个测试）

## 后续规划

- [ ] 组件属性编辑增强
- [ ] 撤销/重做
- [ ] 画布缩放/平移
- [ ] 更多组件类型
- [ ] 组件复制/粘贴
