/**
 * 统一提示词工具函数
 * 
 * 使用组合模式构建提示词，确保所有AI提示词一致
 */

import type { SchemaDefinition } from '../schema/types';

// ============================================================================
// 提示词组件（可组合的部分）
// ============================================================================

/** 技术栈信息 */
export const TECH_STACK = `## 技术栈
- **Tailwind CSS 4**（使用新版语法）
- React 19 + TypeScript
- Lucide React 图标库
- 自研游戏引擎（状态管理/命令分发/事件流）`;

/** 通用输出规则 */
export const OUTPUT_RULES = `## ⚠️ 输出规则（必须遵守）
1. **只输出代码**，不要解释、不要 markdown 代码块标记
2. **输出必须可直接复制使用**
3. **不要重新定义已传入的参数**（如 data.tags 直接用，不要 const tags = data.tags）
4. **禁止使用HTML实体**：使用普通字符 ' " < > & 而不是 &#39; &#34; &lt; &gt; &amp;
5. **禁止添加任何注释**：不要写 {/* ... */} 或 // 等注释，代码必须简洁无注释`;

/** 代码风格规则 */
export const CODE_STYLE_RULES = `## 代码风格
- 使用 Tailwind CSS 4 样式类
- 组件应美观、响应式
- 直接使用传入的参数，不做额外解构

## ⚠️ className 动态拼接语法
当 className 需要动态值时，必须使用**模板字符串**（反引号），示例：
\`\`\`tsx
// ✅ 正确写法
<div className={\`flex \${condition ? 'text-red-500' : 'text-black'}\`}>

// ❌ 错误写法（缺少反引号）
<div className={flex \${condition ? 'text-red-500' : 'text-black'}}>
\`\`\``;

/** 游戏状态结构（用于效果/规则代码） */
export const GAME_STATE_STRUCTURE = `## 游戏状态结构 (G)
\`\`\`typescript
interface GameState {
  entities: Record<string, {
    id: string;
    zones: Record<string, unknown[]>;  // 各类区域（如手牌区/弃置区等）
    resources: Record<string, number>; // 数值资源（生命、能量等）
    status?: Record<string, number>;   // 状态层叠
  }>;
  currentEntityId: string;
  selectedTargetId?: string;
  focusArea?: {
    visible: boolean;
    items: unknown[];
    source: 'self' | 'target';
    onSelect?: (itemId: string) => void;
  };
}
\`\`\``;

/** 组件上下文结构（用于渲染代码） */
export const COMPONENT_CONTEXT = `## 组件渲染上下文 (data)
渲染代码接收的 data 对象包含以下字段：

### 通用字段
- \`type\`: string - 组件类型
- \`name\`: string - 组件名称
- \`width\`: number - 组件宽度
- \`height\`: number - 组件高度

### 绑定数据（来自 Schema）
- \`items\`: Array - 绑定 Schema 的实例列表
- \`itemCount\`: number - 实例数量
- ...组件配置中的其他字段

### 组件输出（系统注入）
- \`outputsByType\`: Record<string, ComponentOutput[]> - 按组件类型聚合的输出
- \`outputsById\`: Record<string, ComponentOutput> - 按组件ID聚合的输出

ComponentOutput 结构:
- componentId: string
- type: string
- schemaId?: string
- items: Record<string, unknown>[]
- itemCount: number
- bindEntity?: string

### 渲染单个数据项
当渲染单个数据项时，data 直接是该项对象，包含 Schema 定义的所有字段。
用户通过 Schema 定义自己需要的字段（如 playerName、cardCount、hp 等）。

### 设计原则
- 不预设游戏特定字段（如 handCount、playerIndex）
- 数据结构由用户通过 Schema 自定义
- 组件通过 bindSchema 绑定数据源`;

/** 引擎层钩子接口（从 HandAreaConfig 等派生） */
export const ENGINE_HOOKS_INTERFACE = `## 引擎层钩子接口
钩子代码由引擎层骨架组件（如 HandAreaSkeleton）执行，签名如下：

### 布局代码 (layoutCode)
\`\`\`typescript
(index: number, total: number) => React.CSSProperties
// index: 当前项索引（0开始）
// total: 总数
\`\`\`

### 选中效果代码 (selectEffectCode)
\`\`\`typescript
(isSelected: boolean) => React.CSSProperties
// isSelected: 是否被选中
\`\`\`

### 过滤代码 (filterCode)
\`\`\`typescript
(card: TCard, ctx: {
  playerIds: string[];
  currentPlayerId: string | null;
  currentPlayerIndex: number;
  resolvedPlayerId: string | null;
  resolvedPlayerIndex: number;
  bindEntity?: string;
  zoneField?: string;
  zoneValue?: string;
}) => boolean
// card: 卡牌数据（包含 Schema 定义的字段）
// ctx: 过滤上下文（hand-zone 注入）
\`\`\`

### 卡牌渲染函数 (renderCard)
\`\`\`typescript
(card: TCard, index: number, isSelected: boolean) => ReactNode
// card: 卡牌数据（包含 Schema 定义的字段）
// index: 在列表中的索引
// isSelected: 是否被选中
\`\`\`

这些钩子在引擎层（HandAreaSkeleton 等）中被调用，游戏层通过配置注入。`;

/** 上下文对象（用于效果/规则代码） */
export const CTX_STRUCTURE = `## 上下文对象 (ctx)
\`\`\`typescript
interface Ctx {
  currentPlayer: string;  // 当前玩家ID
  numPlayers: number;     // 玩家数量
  phase: string;          // 当前阶段
  turn: number;           // 当前回合
}
\`\`\``;

/** 可用的 moves 函数 */
export const AVAILABLE_MOVES = `## 可用的 moves 函数
\`\`\`typescript
// 选择目标实体
selectTarget: (targetEntityId: string) => void;

// 显示特写区域（查看目标实体的对象列表）
showFocusArea: (sourceEntityId: string) => void;

// 隐藏特写区域
hideFocusArea: () => void;

// 从特写区域选择对象
selectFromFocusArea: (itemId: string) => void;

// 转移对象（支持指定区域）
transferItem: (itemId: string, fromEntityId: string, toEntityId: string, fromZone?: string, toZone?: string) => void;

// 增减资源
addResource: (entityId: string, key: string, amount: number) => void;
removeResource: (entityId: string, key: string, amount: number) => void;
setResource: (entityId: string, key: string, value: number) => void;
\`\`\``;

/** 获取Schema字段信息（带访问方式） */
export function getSchemaFieldsInfo(schema: SchemaDefinition | undefined): string {
  if (!schema) return '无 Schema';
  return Object.entries(schema.fields)
    .map(([k, f]) => {
      const accessHint = f.type === 'array' ? `(data.${k} as string[])` : `data.${k}`;
      return `- \`${accessHint}\`: ${f.type} - ${f.label}${f.description ? ` (${f.description})` : ''}`;
    })
    .join('\n');
}

/** 获取标签使用说明（不列出具体值，而是说明如何使用） */
export function getTagsUsageInfo(schema: SchemaDefinition | undefined): string {
  if (!schema?.tagDefinitions?.length) return '';
  
  const groups = [...new Set(schema.tagDefinitions.map(t => t.group || '未分组'))];
  
  return `
## 标签使用说明
data.tags 是一个字符串数组，包含该实体的所有标签。
标签分组（仅供参考，运行时只需判断 data.tags.includes('标签名')）：
${groups.map(g => `- ${g} 类标签`).join('\n')}

使用方式：(data.tags as string[])?.includes('标签名')`;
}

/** 获取游戏上下文 */
export function getGameContext(state: {
  name: string;
  description?: string;
  schemas: SchemaDefinition[];
  renderComponents?: { name: string }[];
}): string {
  const allSchemas = state.schemas
    .map(s => `- ${s.name} (${s.id}): ${Object.keys(s.fields).length}个字段`)
    .join('\n');
  
  const rcInfo = state.renderComponents?.length 
    ? `\n渲染组件: ${state.renderComponents.map(rc => rc.name).join(', ')}`
    : '';

  return `## 游戏上下文
游戏名称: ${state.name}
游戏描述: ${state.description || '未设置'}
所有 Schema:
${allSchemas}${rcInfo}`;
}

/** 构建数据参数说明 */
function buildDataParamInfo(schema: SchemaDefinition | undefined): string {
  const fields = getSchemaFieldsInfo(schema);
  const tags = getTagsUsageInfo(schema);
  return `## data 参数结构（已传入，直接使用 data.xxx）
${fields}
${tags}`;
}

// ============================================================================
// 提示词模板
// ============================================================================

export type PromptType = 
  | 'render-component'
  | 'render-component-back'
  | 'sort-function'
  | 'filter-function'
  | 'layout-code'
  | 'select-effect'
  | 'batch-data'
  | 'batch-tags';

interface PromptContext {
  type: PromptType;
  requirement: string;
  schema?: SchemaDefinition;
  gameState?: {
    name: string;
    description?: string;
    schemas: SchemaDefinition[];
    renderComponents?: { name: string }[];
    instances?: Record<string, unknown[]>;
  };
  componentDataFormat?: string;
}

/** 生成统一格式的AI提示词 */
export function generateUnifiedPrompt(ctx: PromptContext): string {
  const { type, requirement, schema, gameState } = ctx;
  
  // 公共部分
  const techStack = TECH_STACK;
  const schemaFields = getSchemaFieldsInfo(schema);
  const tagsInfo = getTagsUsageInfo(schema);
  const gameContext = gameState ? getGameContext(gameState) : '';
  
  // 数据示例（用于批量数据生成）
  const existingDataSample = gameState?.instances?.[schema?.id || '']?.slice(0, 2);
  const dataSampleText = existingDataSample?.length 
    ? `\n## 已有数据示例\n${JSON.stringify(existingDataSample, null, 2)}`
    : '';

  // 组合通用部分
  const dataParamInfo = buildDataParamInfo(schema);

  switch (type) {
    case 'render-component':
      return `你是一个 React 渲染组件生成器。

${techStack}

## 目标 Schema: ${schema?.name || '未选择'}
${schema?.description || ''}

${dataParamInfo}

## 用户需求
${requirement || '显示数据的基本信息'}

## 输出格式
(data: Record<string, unknown>) => (<div>...</div>)

${OUTPUT_RULES}
${CODE_STYLE_RULES}`;

    case 'render-component-back':
      return `你是一个 React 渲染组件生成器，专门生成**背面**渲染代码。

${techStack}

## 目标 Schema: ${schema?.name || '未选择'}
${schema?.description || ''}

## 用户需求
${requirement || '生成卡牌/实体的背面样式'}

## 输出格式
() => (<div>背面样式</div>)

说明：背面不需要 data 参数（信息隐藏），显示统一图案

${OUTPUT_RULES}
${CODE_STYLE_RULES}`;

    case 'sort-function':
      return `你是一个排序函数生成器。

${techStack}

${dataParamInfo}

## 用户需求
${requirement}

## 输出格式
(a, b) => { /* 排序逻辑 */ return 0; }

${OUTPUT_RULES}`;

    case 'filter-function':
      return `你是一个过滤函数生成器。

${techStack}

${dataParamInfo}

## 用户需求
${requirement}

## 输出格式
(item, ctx) => { /* 过滤条件 */ return true; }

${OUTPUT_RULES}`;

    case 'layout-code':
      return `你是一个卡牌布局代码生成器。

${techStack}

## 用户需求
${requirement || '顺序排开'}

## 输出格式
(index, total) => ({ marginLeft: ..., transform: ..., zIndex: ... })

${OUTPUT_RULES}`;

    case 'select-effect':
      return `你是一个选中效果代码生成器。

${techStack}

## 用户需求
${requirement || '抬高一点'}

## 输出格式
(isSelected) => isSelected ? { /* 选中样式 */ } : {}

${OUTPUT_RULES}`;

    case 'batch-data':
      return `你是一个游戏数据生成器。请根据需求生成 JSON 数据数组。

${gameContext}

## 目标 Schema: ${schema?.name}
${schema?.description || ''}

## 字段定义
${schemaFields}
${dataSampleText}
${tagsInfo ? `\n## Tag 使用说明\n- tags 字段应使用上方"可用标签"中定义的标签\n- 一个实体可以有多个 Tag，表示不同维度的属性${tagsInfo}` : ''}

## 用户需求
${requirement}

${techStack}

## 输出格式
请输出 JSON 数组：
[
  { "id": "xxx-1", "name": "...", "tags": ["tag1", "tag2"], ... },
  { "id": "xxx-2", "name": "...", "tags": ["tag3"], ... }
]

注意：
1. id 字段必须唯一
2. 严格按照 Schema 字段类型生成
3. 只输出纯 JSON，不要 markdown 代码块
4. tags 字段必须使用已定义的可用标签`;

    case 'batch-tags': {
      const existingGroups = [...new Set((schema?.tagDefinitions || []).map(t => t.group).filter(Boolean))];
      const existingGroupsInfo = existingGroups.length > 0 
        ? `\n已有分组: ${existingGroups.join(', ')}`
        : '';
      
      return `你是一个游戏 Tag 系统设计器。请根据需求设计 Tag 列表。

${gameContext}

## 目标 Schema: ${schema?.name}
${schema?.description || ''}
${existingGroupsInfo}

## 用户需求
${requirement}

## Tag 设计原则
Tag 用于描述**单个实体的固有属性**，不是组合规则或游戏逻辑。

✅ 正确使用 Tag（实体固有属性）：
- 分类属性（类别、类型、子类）
- 数值属性（等级、强度、成本）
- 状态属性（可用、已使用、禁用）

❌ 错误使用 Tag（这些是规则/逻辑，不是属性）：
- 组合规则 → 应在规则代码中定义
- 使用限制 → 应在 moves 代码中定义
- 胜负条件 → 应在 endgame 代码中定义

## 输出格式
[
  { "name": "分类A", "group": "分类属性" },
  { "name": "分类B", "group": "分类属性" },
  { "name": "数值高", "group": "数值属性" },
  { "name": "状态可用", "group": "状态属性" }
]

注意：只输出纯 JSON，不要 markdown 代码块`;
    }

    default:
      return '';
  }
}
