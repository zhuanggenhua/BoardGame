/**
 * 统一 UGC Builder
 * 
 * 布局：左侧一列（上：组件库，下：Schema/数据）+ 右侧始终显示 UI 画布
 * 可拖拽分隔线 + 模态框编辑
 */

import { useState, useCallback, useMemo, useRef, useEffect, type DragEvent, type MouseEvent as ReactMouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Save, Play, Upload, X, Download,
  ChevronDown, ChevronRight, 
  Square, Database, Layers,
  Plus, Trash2, Copy, Sparkles, Edit3, GripVertical, Gamepad2
} from 'lucide-react';

import { BaseEntitySchema, extendSchema, field, type SchemaDefinition, type FieldDefinition, type TagDefinition } from '../schema/types';
import { DataTable } from '../ui/DataTable';
import { SceneCanvas, type SceneComponent } from '../ui/SceneCanvas';
import { PreviewCanvas } from '../ui/RenderPreview';
import { PromptGenerator, type GameContext, useRenderPrompt } from '../ai';
import { buildRequirementsText } from '../utils/requirements';
import { generateUnifiedPrompt, TECH_STACK, OUTPUT_RULES } from '../ai/promptUtils';
import { resolveAnchorFromPosition, resolveLayoutRect } from '../../utils/layout';
import { UGC_API_URL } from '../../../config/server';
import { useToast } from '../../../contexts/ToastContext';
import { useAuth } from '../../../contexts/AuthContext';
import { validateAbilityJson } from '../utils/validateAbilityJson';
import { useAudio } from '../../../contexts/AudioContext';
import { AudioManager } from '../../../lib/audio/AudioManager';
import type { BgmDefinition } from '../../../lib/audio/types';
import { 
  BuilderProvider, 
  useBuilder, 
  type RenderComponent, 
  type BuilderState,
  type LayoutComponent 
} from '../context';

// 模块级变量已移除，避免热更新时跳过加载导致覆盖

// ============================================================================
// 类型定义（从 Context 导入，保留本地别名）
// ============================================================================

// 使用 Context 中的类型
export type { RenderComponent, BuilderState, LayoutComponent };

const normalizeTags = (schema?: SchemaDefinition): TagDefinition[] => schema?.tagDefinitions ?? [];

const normalizeRequirements = (
  value: unknown,
  fallback: BuilderState['requirements']
): BuilderState['requirements'] => {
  if (!value || typeof value !== 'object') return fallback;
  const rawText = typeof (value as { rawText?: unknown }).rawText === 'string'
    ? (value as { rawText: string }).rawText
    : fallback.rawText;
  const entriesRaw = (value as { entries?: unknown }).entries;
  const entries = Array.isArray(entriesRaw)
    ? entriesRaw.map((entry, index) => {
        const item = entry as Record<string, unknown>;
        const id = typeof item.id === 'string' ? item.id : `req-${index}`;
        const location = typeof item.location === 'string' ? item.location : '';
        const content = typeof item.content === 'string' ? item.content : '';
        const notes = typeof item.notes === 'string' ? item.notes : undefined;
        return { id, location, content, notes };
      })
    : fallback.entries;
  return { rawText, entries };
};

// AI 生成请求类型
type AIGenType = 'batch-data' | 'batch-tags' | 'ability-field' | null;

type ModalType =
  | 'schema'
  | 'data'
  | 'rules'
  | 'edit-item'
  | 'ai-gen'
  | 'template'
  | 'render-template'
  | 'tag-manager'
  | 'project-list'
  | null;

type BuilderProjectSummary = {
  projectId: string;
  name: string;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
};

type BuilderProjectDetail = BuilderProjectSummary & {
  data?: Record<string, unknown> | null;
};

const normalizeBaseUrl = (value: string) => value.replace(/\/+$/, '');
const buildAuthHeaders = (token: string | null) => ({
  'Content-Type': 'application/json',
  Authorization: token ? `Bearer ${token}` : '',
});
const formatProjectDate = (value?: string) => {
  if (!value) return '未保存';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
};

// ============================================================================
// 初始状态
// ============================================================================

// Schema 模板定义（创建 Schema 时选择）- 不为任何特定游戏预设字段
const SCHEMA_TEMPLATES = {
  blank: { 
    name: '空模板', 
    description: '从零开始定义字段',
    fields: {} 
  },
  entity: { 
    name: '实体模板', 
    description: '带名称和标签的通用实体',
    fields: {
      name: field.string('名称'),
      tags: { type: 'array', label: '标签', itemType: 'string', tagEditor: true } as const,
    }
  },
  withRender: { 
    name: '可渲染模板', 
    description: '带渲染组件引用的实体',
    fields: {
      name: field.string('名称'),
      renderComponentId: { type: 'renderComponent', label: '渲染组件', showInTable: true } as const,
    }
  },
  player: { 
    name: '玩家模板', 
    description: '玩家/角色基础结构',
    fields: {
      name: field.string('名称'),
      tags: { type: 'array', label: '标签', itemType: 'string', tagEditor: true } as const,
    }
  },
  resource: { 
    name: '资源模板', 
    description: '可数值化的资源/属性',
    fields: {
      name: field.string('名称'),
      value: field.number('数值', { min: 0 }),
      max: field.number('上限'),
    }
  },
};


const INITIAL_STATE: BuilderState = {
  name: '新游戏',
  description: '',
  tags: [],
  schemas: [],
  instances: {},
  renderComponents: [],
  layout: [],
  layoutGroups: [
    { id: 'default', name: '默认', hidden: false },
    { id: 'hide', name: '隐藏', hidden: true },
  ],
  selectedSchemaId: null,
  selectedComponentId: null,
  rulesCode: '',
  requirements: {
    rawText: '',
    entries: [],
  },
};

// ============================================================================
// UI 布局组件定义
// 区域组件：预制渲染逻辑 + 可覆盖
// ============================================================================

interface UIComponentDef {
  id: string;
  name: string;
  type: string;
  width: number;
  height: number;
  bindSchema?: string;
  defaultData?: Record<string, unknown>;
  // 组件接收的数据格式描述（用于AI提示词）
  dataFormat?: string;
  // 是否支持自定义渲染覆盖
  customizable?: boolean;
  // 预制功能描述
  presetFeatures?: string;
}

const BASE_UI_COMPONENTS: { category: string; items: UIComponentDef[] }[] = [
  {
    category: '区域组件',
    items: [
      { 
        id: 'hand-zone', 
        name: '手牌区', 
        type: 'hand-zone', 
        width: 400, 
        height: 120,
        dataFormat: '{ cards: CardData[] }',
        customizable: true,
      },
      { 
        id: 'play-zone', 
        name: '出牌区', 
        type: 'play-zone', 
        width: 300, 
        height: 200,
        dataFormat: '{ playedCards: { card: CardData, playerId: string }[] }',
        customizable: true,
      },
      { 
        id: 'deck-zone', 
        name: '牌堆', 
        type: 'deck-zone', 
        width: 100, 
        height: 140,
        dataFormat: '{ count: number, topCard?: CardData }',
        customizable: true,
      },
      { 
        id: 'discard-zone', 
        name: '弃牌堆', 
        type: 'discard-zone', 
        width: 100, 
        height: 140,
        dataFormat: '{ cards: CardData[], topCard?: CardData }',
        customizable: true,
      },
    ],
  },
  {
    category: '玩家区域',
    items: [
      { 
        id: 'player-area', 
        name: '玩家信息', 
        type: 'player-area', 
        width: 200, 
        height: 150,
        dataFormat: '{ resolvedPlayer: PlayerData, resolvedPlayerId: string, currentPlayerId: string, playerIds: string[], isCurrentPlayer: boolean, isCurrentTurn: boolean }',
        customizable: true,
      },
      { 
        id: 'resource-bar', 
        name: '资源栏', 
        type: 'resource-bar', 
        width: 200, 
        height: 40,
        dataFormat: '{ resources: { [key: string]: number } }',
        customizable: true,
      },
    ],
  },
  {
    category: 'UI 元素',
    items: [
      {
        id: 'action-bar',
        name: '操作栏',
        type: 'action-bar',
        width: 360,
        height: 70,
        defaultData: {
          name: '操作栏',
          layout: 'row',
          align: 'center',
          gap: 8,
          actions: [
            { id: 'action-primary', label: '主要操作', scope: 'current-player', variant: 'primary' },
            { id: 'action-secondary', label: '次要操作', scope: 'current-player', variant: 'secondary' },
          ],
        },
      },
      {
        id: 'phase-hud',
        name: '阶段提示',
        type: 'phase-hud',
        width: 260,
        height: 80,
        defaultData: {
          name: '阶段提示',
          orientation: 'horizontal',
          phases: [
            { id: 'ready', label: '准备' },
            { id: 'action', label: '行动' },
            { id: 'resolve', label: '结算' },
          ],
          currentPhaseId: 'action',
          statusText: '等待操作',
          currentPlayerLabel: '当前玩家: 玩家1',
        },
      },
      { id: 'message-log', name: '消息日志', type: 'message-log', width: 250, height: 200 },
      { id: 'dice-area', name: '骰子区', type: 'dice-area', width: 200, height: 100 },
      { id: 'token-area', name: '标记区', type: 'token-area', width: 150, height: 80 },
      { id: 'render-component', name: '渲染组件', type: 'render-component', width: 100, height: 140, customizable: true },
    ],
  },
  {
    category: '系统组件',
    items: [
      {
        id: 'bgm',
        name: '背景音乐',
        type: 'bgm',
        width: 220,
        height: 80,
        presetFeatures: '场景级背景音乐配置',
        defaultData: {
          name: '背景音乐',
          bgmKey: 'bgm-main',
          bgmName: '主背景',
          bgmSrc: '',
          bgmBasePath: '',
          bgmVolume: 0.6,
          bgmEnabled: true,
          bgmAutoPlay: true,
        },
      },
    ],
  },
];

function getUIComponents(): { category: string; items: UIComponentDef[] }[] {
  return BASE_UI_COMPONENTS;
}

// ============================================================================
// 通用钩子字段组件（AI辅助代码生成）
// ============================================================================

function HookField({
  label,
  value,
  onChange,
  requirementValue,
  onRequirementChange,
  schema,
  hookType,
  placeholder,
  componentType,
  outputsSummary,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  requirementValue: string;
  onRequirementChange: (v: string) => void;
  schema: SchemaDefinition | undefined;
  hookType: 'sort' | 'filter' | 'layout' | 'selectEffect' | 'render';
  placeholder: string;
  componentType?: string;
  outputsSummary?: string;
}) {
  const requirementText = requirementValue.trim() ? requirementValue.trim() : '（未填写需求）';

  const generatePrompt = () => {
    const schemaFields = schema
      ? Object.entries(schema.fields).map(([k, f]) => `- ${k}: ${f.type} (${f.label})`).join('\n')
      : '无 Schema';
    
    // 获取区域组件的数据格式描述
    const compDef = componentType 
      ? BASE_UI_COMPONENTS.flatMap(c => c.items).find(i => i.type === componentType)
      : undefined;
    const dataFormatInfo = compDef?.dataFormat 
      ? `\n## 组件接收数据格式\n${compDef.dataFormat}\n\n## 预制功能\n${compDef.presetFeatures || '无'}`
      : '';

    // 获取当前标签信息
    const tagsInfo = schema?.tagDefinitions?.length 
      ? `\n## 可用标签\n${[...new Set(schema.tagDefinitions.map(t => t.group || '未分组'))]
          .map(g => `- ${g}: ${schema.tagDefinitions?.filter(t => (t.group || '未分组') === g).map(t => t.name).join(', ')}`)
          .join('\n')}`
      : '';

    const outputsSection = outputsSummary
      ? `\n## 当前布局可用输出\n${outputsSummary}`
      : '';
    const playerContextInfo = componentType === 'player-area'
      ? `\n## 玩家上下文（系统注入，仅 player-area 可用）\n- playerIds: string[] - 玩家 ID 列表（由绑定 Schema 自动推导）\n- currentPlayerId: string | null - 当前玩家 ID\n- currentPlayerIndex: number - 当前玩家索引\n- resolvedPlayerId: string | null - 当前组件定位到的玩家 ID\n- resolvedPlayerIndex: number - 目标玩家索引\n- resolvedPlayer: Record<string, unknown> | undefined - 目标玩家数据\n- player: resolvedPlayer 的别名\n- isCurrentPlayer: boolean - 是否为当前玩家\n- isCurrentTurn: boolean - 预览中等价于 isCurrentPlayer\n\n### 组件配置字段（用于定位玩家）\n- playerRef: 'current' | 'index'\n  - current: 当前玩家\n  - index: 第 N 个玩家（使用 playerRefIndex）\n- playerRefIndex: number - 第 N 个玩家的索引（0 开始）\n\n### 关联示例（目标玩家的关联数据）\n\`\`\`tsx\nconst outputs = data.outputsByType?.['hand-zone'] || [];\nconst output = outputs[0];\nconst key = output?.bindEntity;\nconst relatedItems = key ? output.items.filter(item => item[key] === data.resolvedPlayerId) : [];\n\`\`\``
      : '';
    const filterContextInfo = componentType === 'hand-zone'
      ? `\n## 过滤上下文 ctx（系统注入，仅 hand-zone 可用）\n- playerIds: string[] - 玩家 ID 列表\n- currentPlayerId: string | null - 当前玩家 ID\n- currentPlayerIndex: number - 当前玩家索引\n- resolvedPlayerId: string | null - 目标玩家 ID\n- resolvedPlayerIndex: number - 目标玩家索引\n- bindEntity?: string - 归属字段（玩家ID）\n- zoneField?: string - 区域字段\n- zoneValue?: string - 区域值`
      : '';

    const templates: Record<string, string> = {
      sort: `你是一个排序比较函数生成器。
${dataFormatInfo}
## 数据结构
${schemaFields}
${tagsInfo}

## 用户需求
${requirementText}

## 函数签名（必须严格遵守）
(a: TItem, b: TItem) => number
// 返回负数：a排在b前面
// 返回正数：b排在a前面
// 返回0：顺序不变

## 输出格式（只输出函数体，不要包装）
\`\`\`javascript
(a, b) => 0
\`\`\``,
      filter: `你是一个过滤判断函数生成器。
${dataFormatInfo}
## 数据结构
${schemaFields}
${tagsInfo}
${filterContextInfo}

## 用户需求
${requirementText}

## 函数签名（必须严格遵守）
(item: TItem, ctx: Record<string, unknown>) => boolean
// 返回 true：显示该项
// 返回 false：隐藏该项

## 输出格式（只输出函数体，不要包装）
\`\`\`javascript
(item, ctx) => true
\`\`\``,
      layout: `你是一个布局代码生成器。
${dataFormatInfo}

## 用户需求
${requirementText}

## 函数签名
(index: number, total: number) => React.CSSProperties

## 参数说明
- index: 当前项在列表中的索引（0开始）
- total: 项目总数

## 输出格式（只输出函数体，不要包装）
\`\`\`javascript
(index, total) => ({})
\`\`\``,
      selectEffect: `你是一个选中效果代码生成器。

## 用户需求
${requirementText}

## 函数签名
(isSelected: boolean) => React.CSSProperties

## 参数说明
- isSelected: 项是否被选中

## 输出格式（只输出函数体，不要包装）
\`\`\`javascript
(isSelected) => (isSelected ? {} : {})
\`\`\``,
      render: `你是一个 React 渲染组件生成器。
${dataFormatInfo}
## 数据结构（Schema字段）
${schemaFields}
${tagsInfo}

## 组件渲染上下文 (data)
渲染代码接收的 data 对象包含以下字段：

### 通用字段
- type: string - 组件类型
- name: string - 组件名称
- width/height: number - 组件尺寸

### 绑定数据（来自Schema）
- items: Array - 绑定Schema的实例列表
- itemCount: number - 实例数量
- ...组件配置中的其他字段

## 组件输出（系统注入）
- outputsByType: Record<string, ComponentOutput[]> - 按组件类型聚合的输出
- outputsById: Record<string, ComponentOutput> - 按组件ID聚合的输出

## 渲染组件复用（系统注入）
- renderComponentIndex: Array<{ id: string; name: string; targetSchema: string }> 渲染组件索引
- renderByComponentId: (id: string, item: Record<string, unknown>, options?: { showBack?: boolean }) => ReactElement | null

ComponentOutput 结构:
- componentId: string
- type: string
- schemaId?: string
- items: Record<string, unknown>[]
- itemCount: number
- bindEntity?: string  // 关联字段（用于跨组件关联）

输出使用说明（通用）：
- 只有存在对应组件时才会出现 outputsByType['hand-zone'] 等输出
- bindEntity 表示“关联字段名”，例如 hand-zone 绑定的 Schema 若有 ownerId，则可设置 bindEntity = ownerId
- 其它组件可用 data.items 中的实体字段与 output.items 里的 bindEntity 字段进行关联过滤
${outputsSection}

## 关联示例（通用）
\`\`\`tsx
const outputs = data.outputsByType?.['hand-zone'] || [];
const output = outputs[0];
const key = output?.bindEntity;
const relatedItems = key ? output.items.filter(item => item[key] === (data as any)[key]) : [];
\`\`\`
${playerContextInfo}

## 渲染组件复用示例（通用）
\`\`\`tsx
const renderer = data.renderByComponentId;
const componentId = data.renderComponentIndex?.[0]?.id;
const node = componentId && renderer ? renderer(componentId, relatedItems[0] || {}, { showBack: true }) : null;
\`\`\`

### 渲染组件字段
当渲染单个数据项时，data 直接是该项对象，包含 Schema 定义的所有字段。
用户通过 Schema 定义自己需要的字段（如 playerName、cardCount 等）。

## 用户需求
${requirementText}

## 技术栈
- **Tailwind CSS 4**
- React 19 + TypeScript
- Lucide React 图标库

## 样式要求
- 根元素使用 \`className="relative w-full h-full"\`
- 定位使用内联样式 \`style={{ top: '8%', left: '8%' }}\`

## 输出格式
\`\`\`tsx
(data: Record<string, unknown>) => (
  <div className="relative w-full h-full ...">
    {/* 使用 data.items / data.outputsByType 等字段 */}
  </div>
)
\`\`\``,
    };

    return templates[hookType] || '';
  };

// ...
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-slate-400">{label}</label>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigator.clipboard.writeText(generatePrompt())}
            className="px-1.5 py-0.5 bg-purple-600 hover:bg-purple-500 rounded text-[10px]"
          >
            复制提示词
          </button>
          <button
            onClick={() => onChange('')}
            disabled={!value}
            className="px-1.5 py-0.5 bg-slate-700 hover:bg-slate-600 rounded text-[10px] disabled:opacity-40"
          >
            清空
          </button>
        </div>
      </div>
      <div className="mb-2">
        <input
          type="text"
          value={requirementValue}
          onChange={e => onRequirementChange(e.target.value)}
          placeholder={placeholder}
          className="w-full px-2 py-1 bg-slate-600 border border-slate-500 rounded text-white text-[10px]"
        />
      </div>
      <textarea
        value={value}
        readOnly
        onPaste={e => {
          e.preventDefault();
          const text = e.clipboardData.getData('text');
          if (text.trim()) {
            onChange(text);
          }
        }}
        placeholder="粘贴 AI 生成结果..."
        className="w-full h-14 px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white font-mono text-[10px] resize-none"
      />
    </div>
  );
}

function buildActionHookPrompt({
  requirement,
  componentType,
}: {
  requirement?: string;
  componentType?: string;
}): string {
  const requirementText = requirement?.trim() ? requirement.trim() : '实现按钮交互';
  const sourceInfo = componentType ? `组件类型: ${componentType}` : '组件类型: 未指定';
  return `你是一个动作钩子代码生成器。

${TECH_STACK}

## 触发来源
${sourceInfo}
- 点击动作按钮时触发

## 可用输入 payload
- payload.action: { id, label, scope, requirement? }
- payload.context: { componentId, componentType, currentPlayerId, resolvedPlayerId, resolvedPlayerIndex }
- payload.state: UGCGameState | null
- payload.sdk: UGCViewSdk | null
- payload.dispatchCommand: (command: { type?: string; payload?: Record<string, unknown> }) => string

## SDK 可用方法（存在时调用）
- payload.sdk.playCard(cardId, targetIds?)
- payload.sdk.selectTarget(targetIds)
- payload.sdk.endPhase()
- payload.sdk.endTurn()
- payload.sdk.drawCard(count?)
- payload.sdk.discardCard(cardIds)
- payload.sdk.respond(responseType, params?)
- payload.sdk.pass()

## 支持返回命令（推荐）
可直接 return 命令对象或数组，框架会自动调用 sendCommand：
- { type?: string; payload?: Record<string, unknown> }
- type 为空时默认使用 "ACTION"
- payload 会自动合并 actionId/actionLabel/componentId/componentType

## 用户需求
${requirementText}

## 函数签名（必须严格遵守）
(payload: { action: Record<string, unknown>; context: Record<string, unknown>; state: unknown; sdk: unknown; dispatchCommand: (command: { type?: string; payload?: Record<string, unknown> }) => string }) => void | { type?: string; payload?: Record<string, unknown> } | { type?: string; payload?: Record<string, unknown> }[] | Promise<void | { type?: string; payload?: Record<string, unknown> } | { type?: string; payload?: Record<string, unknown> }[]>

${OUTPUT_RULES}

## 输出格式（只输出函数体）
(payload) => {
  return {
    type: 'ACTION',
    payload: {
      detail: '触发动作',
    },
  };
}`;
}

// ============================================================================
// 模态框组件
// ============================================================================

function Modal({ 
  open, 
  onClose, 
  title, 
  children,
  width = 'max-w-4xl'
}: { 
  open: boolean; 
  onClose: () => void; 
  title: string; 
  children: React.ReactNode;
  width?: string;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className={`bg-slate-800 rounded-xl shadow-2xl ${width} w-full max-h-[85vh] flex flex-col`}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-auto p-4">
          {children}
        </div>
      </div>
    </div>
  );
}


// ============================================================================
// 主组件（包装 Provider）
// ============================================================================

export function UnifiedBuilder() {
  return (
    <BuilderProvider>
      <UnifiedBuilderInner />
    </BuilderProvider>
  );
}

// ============================================================================
// 内部组件（使用 Context）
// ============================================================================

function UnifiedBuilderInner() {
  // 从 Context 获取状态（暂未使用，渐进迁移后启用）
  const builderCtx = useBuilder();
  const { playBgm, stopBgm, setPlaylist } = useAudio();
  const { token } = useAuth();
  
  // 临时：仍使用本地状态，后续逐步替换为 Context
  // TODO: 迁移完成后删除本地 state，直接使用 contextState
  const [state, setState] = useState<BuilderState>(INITIAL_STATE);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['卡牌机制']));
  const [selectedComponentIds, setSelectedComponentIds] = useState<string[]>([]);
  const isLoadedRef = useRef(false);
  const hasHydratedData = useMemo(() => {
    return (
      state.schemas.length > 0 ||
      state.layout.length > 0 ||
      state.renderComponents.length > 0 ||
      Object.keys(state.instances).length > 0
    );
  }, [state.schemas, state.layout, state.renderComponents, state.instances]);
  const [promptOutput, setPromptOutput] = useState('');
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [editingItem, setEditingItem] = useState<Record<string, unknown> | null>(null);
  
  // AI 生成相关状态
  const [aiGenType, setAiGenType] = useState<AIGenType>(null);
  const [aiGenInput, setAiGenInput] = useState('');
  const [abilityImportErrors, setAbilityImportErrors] = useState<string[]>([]);
  
  // 标签编辑状态
  const [editingTagIndex, setEditingTagIndex] = useState<number | null>(null);
  const [newTagName, setNewTagName] = useState('');
  const [newTagGroup, setNewTagGroup] = useState('');
  const toast = useToast();
  const [builderProjects, setBuilderProjects] = useState<BuilderProjectSummary[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [isProjectLoading, setIsProjectLoading] = useState(false);
  const [projectNameDraft, setProjectNameDraft] = useState('');
  const stateRef = useRef(state);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const layoutOutputsSummary = useMemo(() => {
    const lines = state.layout
      .filter(comp => comp.data.bindSchema || comp.data.targetSchema)
      .map(comp => {
        const schemaId = (comp.data.bindSchema || comp.data.targetSchema) as string | undefined;
        const schemaName = schemaId ? state.schemas.find(s => s.id === schemaId)?.name : undefined;
        const bindEntity = (comp.data.bindEntity as string | undefined) || '未设置';
        return `- ${String(comp.data.name || comp.type)} (type=${comp.type}, id=${comp.id}) -> schema=${schemaName || '未知'} (${schemaId || '未绑定'}), bindEntity=${bindEntity}`;
      });
    return lines.length > 0 ? lines.join('\n') : '';
  }, [state.layout, state.schemas]);

  const renderComponentInstances = useMemo(() => {
    return state.layout
      .filter(comp => comp.type === 'render-component')
      .map(comp => ({
        id: comp.id,
        name: String(comp.data.name || '未命名渲染组件'),
        targetSchema: comp.data.targetSchema as string | undefined,
      }));
  }, [state.layout]);

  const schemaDefaults = useMemo(() => {
    const entries = state.schemas
      .filter(schema => typeof schema.defaultRenderComponentId === 'string' && schema.defaultRenderComponentId.trim())
      .map(schema => [schema.id, schema.defaultRenderComponentId!.trim()] as const);
    return entries.length > 0 ? Object.fromEntries(entries) : undefined;
  }, [state.schemas]);

  const previewConfig = useMemo(() => ({
    layout: state.layout,
    renderComponents: state.renderComponents,
    instances: state.instances,
    layoutGroups: state.layoutGroups,
    schemaDefaults,
  }), [state.layout, state.renderComponents, state.instances, state.layoutGroups, schemaDefaults]);

  // 预览模式状态
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const navigate = useNavigate();

  const bgmEntries = useMemo(() => {
    return state.layout
      .filter(comp => comp.type === 'bgm')
      .map((comp, index) => {
        const rawKey = comp.data.bgmKey ?? comp.data.key;
        const rawName = comp.data.bgmName ?? comp.data.name;
        const rawSrc = comp.data.bgmSrc ?? comp.data.src;
        const rawBasePath = comp.data.bgmBasePath ?? comp.data.basePath;
        const rawVolume = comp.data.bgmVolume;
        const rawEnabled = comp.data.bgmEnabled;
        const rawAutoPlay = comp.data.bgmAutoPlay;
        const key = typeof rawKey === 'string' ? rawKey.trim() : '';
        const name = typeof rawName === 'string' && rawName.trim() ? rawName.trim() : `背景音乐${index + 1}`;
        const src = typeof rawSrc === 'string' ? rawSrc.trim() : '';
        const basePath = typeof rawBasePath === 'string' ? rawBasePath.trim() : '';
        const volume = typeof rawVolume === 'number' && !Number.isNaN(rawVolume) ? rawVolume : 0.6;
        const enabled = rawEnabled !== false;
        const autoPlay = rawAutoPlay !== false;
        return {
          key,
          name,
          src,
          basePath,
          volume: Math.max(0, Math.min(1, volume)),
          enabled,
          autoPlay,
        };
      });
  }, [state.layout]);

  const bgmList = useMemo<BgmDefinition[]>(() => {
    return bgmEntries
      .filter(entry => entry.enabled && entry.key && entry.src)
      .map(entry => ({
        key: entry.key,
        name: entry.name,
        src: entry.src,
        volume: entry.volume,
      }));
  }, [bgmEntries]);

  const bgmBasePath = useMemo(() => {
    const uniquePaths = Array.from(new Set(bgmEntries.map(entry => entry.basePath).filter(Boolean)));
    return uniquePaths.length === 1 ? uniquePaths[0] : '';
  }, [bgmEntries]);

  const autoPlayBgmKey = useMemo(() => {
    const target = bgmEntries.find(entry => entry.enabled && entry.autoPlay && entry.key && entry.src);
    return target?.key ?? null;
  }, [bgmEntries]);

  useEffect(() => {
    if (!isPreviewMode) {
      setPlaylist([]);
      stopBgm();
      return;
    }

    if (bgmList.length === 0) {
      setPlaylist([]);
      stopBgm();
      return;
    }

    AudioManager.registerAll({ bgm: bgmList }, bgmBasePath);
    setPlaylist(bgmList);
    if (autoPlayBgmKey) {
      playBgm(autoPlayBgmKey);
    } else {
      stopBgm();
    }
  }, [isPreviewMode, bgmList, bgmBasePath, autoPlayBgmKey, playBgm, stopBgm, setPlaylist]);
  
  // 可拖拽分隔线状态
  const [leftPanelWidth, setLeftPanelWidth] = useState(280);
  const [topPanelRatio, setTopPanelRatio] = useState(0.5);
  const [gridSize, setGridSize] = useState(20);
  const [showGrid, setShowGrid] = useState(true);
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [snapToEdges, setSnapToEdges] = useState(true);
  const [snapToCenters, setSnapToCenters] = useState(true);
  const [snapThreshold, setSnapThreshold] = useState(6);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const isDraggingH = useRef(false);
  const isDraggingV = useRef(false);
  const leftPanelRef = useRef<HTMLDivElement>(null);

  // 同步本地状态到 Context（临时方案，迁移完成后删除）
  // 使用 ref 避免 builderCtx 变化导致无限循环
  const dispatchRef = useRef(builderCtx.dispatch);
  dispatchRef.current = builderCtx.dispatch;
  
  useEffect(() => {
    dispatchRef.current({ type: 'LOAD_STATE', payload: state });
  }, [state]);

  // 当前选中的 Schema（使用本地状态，迁移后使用 ctxCurrentSchema）
  const currentSchema = useMemo(() => 
    state.schemas.find(s => s.id === state.selectedSchemaId),
    [state.schemas, state.selectedSchemaId]
  );

  // 当前 Schema 的数据实例（使用本地状态，迁移后使用 ctxCurrentInstances）
  const currentInstances = useMemo(() => 
    state.selectedSchemaId ? (state.instances[state.selectedSchemaId] || []) : [],
    [state.instances, state.selectedSchemaId]
  );

  // AI 上下文
  const aiContext = useMemo<GameContext>(() => ({
    name: state.name,
    description: state.description,
    tags: state.tags,
    schemas: state.schemas,
    instances: state.instances,
    layout: state.layout,
  }), [state]);

  const promptGenerator = useMemo(() => new PromptGenerator(aiContext), [aiContext]);

  // 渲染组件提示词生成器（必须在顶层调用）
  const { generateFront, generateBack } = useRenderPrompt();

  // ========== 拖拽分隔线 ==========
  const handleHorizontalDragStart = useCallback((e: ReactMouseEvent) => {
    e.preventDefault();
    isDraggingH.current = true;
  }, []);

  const handleVerticalDragStart = useCallback((e: ReactMouseEvent) => {
    e.preventDefault();
    isDraggingV.current = true;
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingH.current) {
        const newWidth = Math.max(200, Math.min(400, e.clientX));
        setLeftPanelWidth(newWidth);
      }
      if (isDraggingV.current && leftPanelRef.current) {
        const rect = leftPanelRef.current.getBoundingClientRect();
        const relativeY = e.clientY - rect.top;
        const ratio = Math.max(0.2, Math.min(0.8, relativeY / rect.height));
        setTopPanelRatio(ratio);
      }
    };
    const handleMouseUp = () => {
      isDraggingH.current = false;
      isDraggingV.current = false;
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  // ========== Schema 操作 ==========
  const [schemaTemplateModal, setSchemaTemplateModal] = useState(false);

  const handleAddSchemaWithTemplate = useCallback((templateKey: keyof typeof SCHEMA_TEMPLATES) => {
    const template = SCHEMA_TEMPLATES[templateKey];
    const id = `schema_${Date.now()}`;
    const newSchema = extendSchema(BaseEntitySchema, {
      id,
      name: template.name === '空模板' ? '新 Schema' : template.name.replace('模板', ''),
      description: template.description,
      fields: { ...template.fields },
    });
    setState(prev => ({
      ...prev,
      schemas: [...prev.schemas, newSchema],
      instances: { ...prev.instances, [id]: [] },
      selectedSchemaId: id,
    }));
    setSchemaTemplateModal(false);
    setActiveModal('schema');
  }, []);

  const handleAddSchema = useCallback(() => {
    setSchemaTemplateModal(true);
  }, []);

  const handleDeleteSchema = useCallback((schemaId: string) => {
    setState(prev => {
      const restInstances = Object.fromEntries(
        Object.entries(prev.instances).filter(([key]) => key !== schemaId)
      );
      return {
        ...prev,
        schemas: prev.schemas.filter(s => s.id !== schemaId),
        instances: restInstances,
        selectedSchemaId: prev.selectedSchemaId === schemaId ? prev.schemas[0]?.id || null : prev.selectedSchemaId,
      };
    });
  }, []);

  const handleSchemaChange = useCallback((schemaId: string, updates: Partial<SchemaDefinition>) => {
    setState(prev => ({
      ...prev,
      schemas: prev.schemas.map(s => s.id === schemaId ? { ...s, ...updates } : s),
    }));
  }, []);

  const handleAddField = useCallback((schemaId: string, key: string, fieldDef: FieldDefinition) => {
    setState(prev => ({
      ...prev,
      schemas: prev.schemas.map(s => 
        s.id === schemaId 
          ? { ...s, fields: { ...s.fields, [key]: fieldDef } }
          : s
      ),
    }));
  }, []);

  const handleDeleteField = useCallback((schemaId: string, fieldKey: string) => {
    setState(prev => ({
      ...prev,
      schemas: prev.schemas.map(s => {
        if (s.id !== schemaId) return s;
        const restFields = Object.fromEntries(
          Object.entries(s.fields).filter(([key]) => key !== fieldKey)
        );
        return { ...s, fields: restFields };
      }),
    }));
  }, []);

  const handleUpdateField = useCallback((schemaId: string, fieldKey: string, updates: Partial<FieldDefinition>) => {
    setState(prev => ({
      ...prev,
      schemas: prev.schemas.map(s => {
        if (s.id !== schemaId) return s;
        const existingField = s.fields[fieldKey];
        if (!existingField) return s;
        return {
          ...s,
          fields: {
            ...s.fields,
            [fieldKey]: { ...existingField, ...updates } as FieldDefinition,
          },
        };
      }),
    }));
  }, []);

  const handleChangeFieldType = useCallback((schemaId: string, fieldKey: string, newType: string) => {
    const typeMap: Record<string, () => FieldDefinition> = {
      string: () => field.string(''),
      number: () => field.number(''),
      boolean: () => field.boolean(''),
      sfxKey: () => field.sfxKey('音效'),
      array: () => field.tags(''),  // UI中是array，对应tags类型
      abilities: () => field.abilities(''),
      renderComponent: () => ({ type: 'renderComponent', label: '', showInTable: true } as FieldDefinition),
    };
    const factory = typeMap[newType];
    if (!factory) return;
    
    setState(prev => ({
      ...prev,
      schemas: prev.schemas.map(s => {
        if (s.id !== schemaId) return s;
        const existingField = s.fields[fieldKey];
        if (!existingField) return s;
        const newField = factory();
        newField.label = existingField.label; // 保留 label
        return {
          ...s,
          fields: { ...s.fields, [fieldKey]: newField },
        };
      }),
    }));
  }, []);

  // ========== 数据实例操作 ==========
  const handleInstanceChange = useCallback((schemaId: string, instances: Record<string, unknown>[]) => {
    setState(prev => ({
      ...prev,
      instances: { ...prev.instances, [schemaId]: instances },
    }));
  }, []);

  const handleAddInstance = useCallback(() => {
    if (!state.selectedSchemaId || !currentSchema) return;
    // 自增ID：找到当前最大ID序号，+1
    const existingIds = currentInstances
      .map(item => String(item.id))
      .filter(id => /^item_\d+$/.test(id))
      .map(id => parseInt(id.replace('item_', ''), 10));
    const nextId = existingIds.length > 0 ? Math.max(...existingIds) + 1 : 1;
    const newInstance: Record<string, unknown> = { id: `item_${nextId}` };
    Object.keys(currentSchema.fields).forEach(key => {
      if (key !== 'id') newInstance[key] = '';
    });
    handleInstanceChange(state.selectedSchemaId, [...currentInstances, newInstance]);
  }, [state.selectedSchemaId, currentSchema, currentInstances, handleInstanceChange]);

  const handleEditItem = useCallback((item: Record<string, unknown>) => {
    setEditingItem({ ...item });
    setActiveModal('edit-item');
  }, []);

  const handleSaveEditItem = useCallback(() => {
    if (!editingItem || !state.selectedSchemaId) return;
    const id = String(editingItem.id);
    const updated = currentInstances.map(item => 
      String(item.id) === id ? editingItem : item
    );
    handleInstanceChange(state.selectedSchemaId, updated);
    setActiveModal('data');
    setEditingItem(null);
  }, [editingItem, state.selectedSchemaId, currentInstances, handleInstanceChange]);

  const handleEditItemField = useCallback((key: string, value: unknown) => {
    setEditingItem(prev => prev ? { ...prev, [key]: value } : null);
  }, []);

  // ========== UI 布局操作 ==========
  const handleDragStart = useCallback((comp: UIComponentDef, e: DragEvent) => {
    const baseData = { name: comp.name, bindSchema: comp.bindSchema };
    const withDefaults = comp.defaultData
      ? { ...baseData, ...comp.defaultData }
      : baseData;
    const data = comp.type === 'player-area'
      ? { ...withDefaults, playerRef: 'current' }
      : withDefaults;
    e.dataTransfer.setData('application/json', JSON.stringify({
      type: comp.type,
      width: comp.width,
      height: comp.height,
      data,
    }));
    e.dataTransfer.effectAllowed = 'copy';
  }, []);

  const handleLayoutChange = useCallback((layout: SceneComponent[]) => {
    setState(prev => ({
      ...prev,
      layout,
      selectedComponentId: prev.selectedComponentId && layout.some(c => c.id === prev.selectedComponentId)
        ? prev.selectedComponentId
        : null,
    }));
    setSelectedComponentIds(prev => prev.filter(id => layout.some(c => c.id === id)));
  }, []);

  const handleSelectionChange = useCallback((ids: string[]) => {
    setSelectedComponentIds(ids);
    setState(prev => ({
      ...prev,
      selectedComponentId: ids.length > 0 ? ids[ids.length - 1] : null,
    }));
  }, []);

  const selectedComponents = useMemo(() => {
    if (selectedComponentIds.length === 0) return [] as LayoutComponent[];
    return state.layout.filter(comp => selectedComponentIds.includes(comp.id));
  }, [state.layout, selectedComponentIds]);

  const resolveRect = useCallback((comp: LayoutComponent) => {
    if (!canvasSize.width || !canvasSize.height) return null;
    return resolveLayoutRect(
      {
        anchor: comp.anchor,
        pivot: comp.pivot,
        offset: comp.offset,
        width: comp.width,
        height: comp.height,
        rotation: comp.rotation,
      },
      canvasSize
    );
  }, [canvasSize]);

  const alignSelection = useCallback((mode: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => {
    if (!canvasSize.width || !canvasSize.height) return;
    if (selectedComponents.length === 0) return;
    const rects = selectedComponents
      .map(comp => ({ comp, rect: resolveRect(comp) }))
      .filter((item): item is { comp: LayoutComponent; rect: NonNullable<ReturnType<typeof resolveRect>> } => Boolean(item.rect));
    if (rects.length === 0) return;

    const bounds = rects.reduce(
      (acc, item) => {
        acc.minX = Math.min(acc.minX, item.rect.x);
        acc.minY = Math.min(acc.minY, item.rect.y);
        acc.maxX = Math.max(acc.maxX, item.rect.x + item.rect.width);
        acc.maxY = Math.max(acc.maxY, item.rect.y + item.rect.height);
        return acc;
      },
      { minX: Number.POSITIVE_INFINITY, minY: Number.POSITIVE_INFINITY, maxX: Number.NEGATIVE_INFINITY, maxY: Number.NEGATIVE_INFINITY }
    );

    const useCanvas = rects.length === 1;
    const nextLayout = state.layout.map(comp => {
      if (!selectedComponentIds.includes(comp.id)) return comp;
      const rect = rects.find(item => item.comp.id === comp.id)?.rect;
      if (!rect) return comp;

      let nextX = rect.x;
      let nextY = rect.y;
      if (mode === 'left') {
        nextX = useCanvas ? 0 : bounds.minX;
      }
      if (mode === 'center') {
        const target = useCanvas ? canvasSize.width / 2 : (bounds.minX + bounds.maxX) / 2;
        nextX = target - rect.width / 2;
      }
      if (mode === 'right') {
        const target = useCanvas ? canvasSize.width : bounds.maxX;
        nextX = target - rect.width;
      }
      if (mode === 'top') {
        nextY = useCanvas ? 0 : bounds.minY;
      }
      if (mode === 'middle') {
        const target = useCanvas ? canvasSize.height / 2 : (bounds.minY + bounds.maxY) / 2;
        nextY = target - rect.height / 2;
      }
      if (mode === 'bottom') {
        const target = useCanvas ? canvasSize.height : bounds.maxY;
        nextY = target - rect.height;
      }

      return {
        ...comp,
        anchor: resolveAnchorFromPosition({
          position: { x: nextX, y: nextY },
          pivot: comp.pivot,
          offset: comp.offset,
          size: { width: comp.width, height: comp.height },
          canvas: canvasSize,
        }),
      };
    });

    handleLayoutChange(nextLayout as SceneComponent[]);
  }, [canvasSize, handleLayoutChange, resolveRect, selectedComponentIds, selectedComponents, state.layout]);

  const distributeSelection = useCallback((axis: 'horizontal' | 'vertical') => {
    if (selectedComponents.length < 3) return;
    if (!canvasSize.width || !canvasSize.height) return;
    const rects = selectedComponents
      .map(comp => ({ comp, rect: resolveRect(comp) }))
      .filter((item): item is { comp: LayoutComponent; rect: NonNullable<ReturnType<typeof resolveRect>> } => Boolean(item.rect));
    if (rects.length < 3) return;

    const sorted = [...rects].sort((a, b) => axis === 'horizontal'
      ? a.rect.x - b.rect.x
      : a.rect.y - b.rect.y
    );

    const totalSpan = axis === 'horizontal'
      ? (sorted[sorted.length - 1].rect.x + sorted[sorted.length - 1].rect.width - sorted[0].rect.x)
      : (sorted[sorted.length - 1].rect.y + sorted[sorted.length - 1].rect.height - sorted[0].rect.y);
    const totalSize = sorted.reduce((sum, item) => sum + (axis === 'horizontal' ? item.rect.width : item.rect.height), 0);
    const gap = Math.max(0, (totalSpan - totalSize) / (sorted.length - 1));

    let cursor = axis === 'horizontal' ? sorted[0].rect.x : sorted[0].rect.y;
    const nextLayout = state.layout.map(comp => {
      const item = sorted.find(entry => entry.comp.id === comp.id);
      if (!item) return comp;

      const rect = item.rect;
      const nextX = axis === 'horizontal' ? cursor : rect.x;
      const nextY = axis === 'vertical' ? cursor : rect.y;
      cursor += (axis === 'horizontal' ? rect.width : rect.height) + gap;

      return {
        ...comp,
        anchor: resolveAnchorFromPosition({
          position: { x: nextX, y: nextY },
          pivot: comp.pivot,
          offset: comp.offset,
          size: { width: comp.width, height: comp.height },
          canvas: canvasSize,
        }),
      };
    });

    handleLayoutChange(nextLayout as SceneComponent[]);
  }, [canvasSize, handleLayoutChange, resolveRect, selectedComponents, state.layout]);

  const handleAddRequirementEntry = useCallback(() => {
    const entryId = `req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setState(prev => ({
      ...prev,
      requirements: {
        ...prev.requirements,
        entries: [
          ...prev.requirements.entries,
          { id: entryId, location: '', content: '', notes: '' },
        ],
      },
    }));
  }, []);

  const handleUpdateRequirementEntry = useCallback((id: string, updates: Partial<{ location: string; content: string; notes?: string }>) => {
    setState(prev => ({
      ...prev,
      requirements: {
        ...prev.requirements,
        entries: prev.requirements.entries.map(entry =>
          entry.id === id ? { ...entry, ...updates } : entry
        ),
      },
    }));
  }, []);

  const handleRemoveRequirementEntry = useCallback((id: string) => {
    setState(prev => ({
      ...prev,
      requirements: {
        ...prev.requirements,
        entries: prev.requirements.entries.filter(entry => entry.id !== id),
      },
    }));
  }, []);

  const upsertRequirementEntryByLocation = useCallback((location: string, content: string) => {
    const trimmed = content.trim();
    setState(prev => {
      const existing = prev.requirements.entries.find(entry => entry.location === location);
      if (!trimmed) {
        if (!existing) return prev;
        return {
          ...prev,
          requirements: {
            ...prev.requirements,
            entries: prev.requirements.entries.filter(entry => entry.location !== location),
          },
        };
      }
      if (existing && existing.content === trimmed) return prev;
      const nextEntry = existing
        ? { ...existing, content: trimmed }
        : { id: `req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, location, content: trimmed, notes: '' };
      const entries = existing
        ? prev.requirements.entries.map(entry => entry.location === location ? nextEntry : entry)
        : [...prev.requirements.entries, nextEntry];
      return {
        ...prev,
        requirements: {
          ...prev.requirements,
          entries,
        },
      };
    });
  }, []);

  const resolveAiGenRequirementLocation = useCallback((type: AIGenType, schema?: SchemaDefinition | null) => {
    if (!type || !schema) return null;
    if (type === 'batch-data') return `数据库 AI 生成/${schema.name}`;
    if (type === 'batch-tags') return `数据库 AI 生成/标签/${schema.name}`;
    if (type === 'ability-field') return `能力块 AI 生成/${schema.name}`;
    return null;
  }, []);

  // ========== 规则生成 ==========
  const handleGenerateFullRules = useCallback(() => {
    setPromptOutput(promptGenerator.generateFullPrompt(buildRequirementsText(state.requirements)));
  }, [promptGenerator, state.requirements]);

  const STORAGE_KEY = 'ugc-builder-state';

  const buildSaveData = useCallback(() => ({
    name: state.name,
    description: state.description,
    tags: state.tags,
    schemas: state.schemas,
    instances: state.instances,
    renderComponents: state.renderComponents,
    layout: state.layout,
    layoutGroups: state.layoutGroups,
    rulesCode: state.rulesCode,
    requirements: state.requirements,
    uiLayout: {
      leftPanelWidth,
      topPanelRatio,
      gridSize,
      showGrid,
      snapToGrid,
      snapToEdges,
      snapToCenters,
      snapThreshold,
    },
  }), [state, leftPanelWidth, topPanelRatio, gridSize, showGrid, snapToGrid, snapToEdges, snapToCenters, snapThreshold]);

  const applySavedData = useCallback((data: Record<string, unknown>) => {
    setState(prev => {
      const schemas = Array.isArray(data.schemas) ? data.schemas : prev.schemas;
      const requirements = normalizeRequirements(data.requirements, prev.requirements);
      const selectedSchemaId = schemas.length > 0 ? schemas[0].id : null;
      return {
        ...prev,
        name: typeof data.name === 'string' ? data.name : prev.name,
        description: typeof data.description === 'string' ? data.description : '',
        tags: Array.isArray(data.tags) ? data.tags : [],
        schemas,
        instances: (data.instances && typeof data.instances === 'object') ? data.instances as BuilderState['instances'] : prev.instances,
        renderComponents: Array.isArray(data.renderComponents) ? data.renderComponents : prev.renderComponents,
        layout: Array.isArray(data.layout) ? data.layout : [],
        layoutGroups: Array.isArray(data.layoutGroups) ? data.layoutGroups : prev.layoutGroups,
        selectedSchemaId,
        rulesCode: typeof data.rulesCode === 'string' ? data.rulesCode : '',
        requirements,
      };
    });
    if (data.uiLayout && typeof data.uiLayout === 'object') {
      const uiLayout = data.uiLayout as Record<string, unknown>;
      if (typeof uiLayout.leftPanelWidth === 'number') {
        setLeftPanelWidth(uiLayout.leftPanelWidth);
      }
      if (typeof uiLayout.topPanelRatio === 'number') {
        setTopPanelRatio(uiLayout.topPanelRatio);
      }
      if (typeof uiLayout.gridSize === 'number') {
        setGridSize(uiLayout.gridSize);
      }
      if (typeof uiLayout.showGrid === 'boolean') {
        setShowGrid(uiLayout.showGrid);
      }
      if (typeof uiLayout.snapToGrid === 'boolean') {
        setSnapToGrid(uiLayout.snapToGrid);
      }
      if (typeof uiLayout.snapToEdges === 'boolean') {
        setSnapToEdges(uiLayout.snapToEdges);
      }
      if (typeof uiLayout.snapToCenters === 'boolean') {
        setSnapToCenters(uiLayout.snapToCenters);
      }
      if (typeof uiLayout.snapThreshold === 'number') {
        setSnapThreshold(uiLayout.snapThreshold);
      }
    }
  }, [setLeftPanelWidth, setTopPanelRatio]);

  const persistLocalSave = useCallback((saveData: Record<string, unknown>) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saveData));
  }, []);

  const fetchBuilderProjects = useCallback(async (silent = false) => {
    if (!token) {
      setBuilderProjects([]);
      return [] as BuilderProjectSummary[];
    }
    const baseUrl = normalizeBaseUrl(UGC_API_URL);
    try {
      const res = await fetch(`${baseUrl}/builder/projects`, {
        headers: buildAuthHeaders(token),
      });
      if (!res.ok) {
        throw new Error(`项目列表加载失败: ${res.status}`);
      }
      const payload = await res.json() as { items?: BuilderProjectSummary[] };
      const items = Array.isArray(payload.items) ? payload.items : [];
      setBuilderProjects(items);
      return items;
    } catch {
      if (!silent) {
        toast.warning('草稿列表获取失败，将使用本地缓存');
      }
      return [] as BuilderProjectSummary[];
    }
  }, [token, toast]);

  const loadBuilderProject = useCallback(async (projectId: string, silent = false) => {
    if (!token) return null;
    const baseUrl = normalizeBaseUrl(UGC_API_URL);
    setIsProjectLoading(true);
    try {
      const res = await fetch(`${baseUrl}/builder/projects/${encodeURIComponent(projectId)}`, {
        headers: buildAuthHeaders(token),
      });
      if (!res.ok) {
        throw new Error(`项目加载失败: ${res.status}`);
      }
      const project = await res.json() as BuilderProjectDetail;
      if (project?.data && typeof project.data === 'object') {
        applySavedData(project.data);
        persistLocalSave(project.data);
      }
      setActiveProjectId(project.projectId);
      setProjectNameDraft(project.name ?? '');
      return project;
    } catch {
      if (!silent) {
        toast.warning('草稿加载失败，将使用本地缓存');
      }
      return null;
    } finally {
      setIsProjectLoading(false);
    }
  }, [applySavedData, persistLocalSave, token, toast]);

  const createBuilderProject = useCallback(async (payload: { name: string; description?: string; data?: Record<string, unknown> | null }, silent = false) => {
    if (!token) return null;
    const baseUrl = normalizeBaseUrl(UGC_API_URL);
    const res = await fetch(`${baseUrl}/builder/projects`, {
      method: 'POST',
      headers: buildAuthHeaders(token),
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      if (!silent) {
        toast.error('新建草稿失败');
      }
      return null;
    }
    const project = await res.json() as BuilderProjectDetail;
    setActiveProjectId(project.projectId);
    setProjectNameDraft(project.name ?? '');
    setBuilderProjects(prev => {
      const filtered = prev.filter(item => item.projectId !== project.projectId);
      return [project, ...filtered];
    });
    return project;
  }, [token, toast]);

  const updateBuilderProject = useCallback(async (
    projectId: string,
    payload: { name?: string; description?: string; data?: Record<string, unknown> | null },
    silent = false
  ) => {
    if (!token) return null;
    const baseUrl = normalizeBaseUrl(UGC_API_URL);
    const res = await fetch(`${baseUrl}/builder/projects/${encodeURIComponent(projectId)}`, {
      method: 'PUT',
      headers: buildAuthHeaders(token),
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      if (!silent) {
        toast.error('草稿保存失败');
      }
      return null;
    }
    const project = await res.json() as BuilderProjectDetail;
    setBuilderProjects(prev => prev.map(item => item.projectId === project.projectId
      ? { ...item, name: project.name, description: project.description, updatedAt: project.updatedAt }
      : item
    ));
    return project;
  }, [token, toast]);

  const deleteBuilderProject = useCallback(async (projectId: string) => {
    if (!token) return false;
    const baseUrl = normalizeBaseUrl(UGC_API_URL);
    const res = await fetch(`${baseUrl}/builder/projects/${encodeURIComponent(projectId)}`, {
      method: 'DELETE',
      headers: buildAuthHeaders(token),
    });
    if (!res.ok) {
      toast.error('删除草稿失败');
      return false;
    }
    setBuilderProjects(prev => prev.filter(item => item.projectId !== projectId));
    if (activeProjectId === projectId) {
      setActiveProjectId(null);
    }
    return true;
  }, [activeProjectId, token, toast]);

  const refreshBuilderProjects = useCallback(async (silent = false) => {
    setIsProjectLoading(true);
    try {
      return await fetchBuilderProjects(silent);
    } finally {
      setIsProjectLoading(false);
    }
  }, [fetchBuilderProjects]);

  useEffect(() => {
    if (activeModal !== 'project-list') return;
    void refreshBuilderProjects();
  }, [activeModal, refreshBuilderProjects]);

  useEffect(() => {
    if (!activeProjectId) return;
    if (state.name && state.name !== projectNameDraft) {
      setProjectNameDraft(state.name);
    }
  }, [activeProjectId, projectNameDraft, state.name]);

  const handleOpenProjectList = useCallback(() => {
    setActiveModal('project-list');
  }, []);

  const handleLoadProject = useCallback(async (projectId: string) => {
    const loaded = await loadBuilderProject(projectId);
    if (loaded) {
      toast.success('草稿已加载');
      setActiveModal(null);
    }
  }, [loadBuilderProject, toast]);

  const handleDeleteProject = useCallback(async (projectId: string) => {
    if (!confirm('确定删除该草稿？此操作不可撤销')) return;
    const ok = await deleteBuilderProject(projectId);
    if (ok) {
      toast.success('草稿已删除');
    }
  }, [deleteBuilderProject, toast]);

  const handleCreateProjectFromCurrent = useCallback(async () => {
    if (!token) {
      toast.warning('请先登录');
      return;
    }
    const saveData = buildSaveData();
    const created = await createBuilderProject({
      name: state.name || '未命名草稿',
      description: state.description,
      data: saveData,
    });
    if (created) {
      toast.success('草稿已创建');
    }
  }, [buildSaveData, createBuilderProject, state.description, state.name, toast, token]);

  const toggleCategory = (cat: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(cat)) {
        next.delete(cat);
      } else {
        next.add(cat);
      }
      return next;
    });
  };

  useEffect(() => {
    const location = resolveAiGenRequirementLocation(aiGenType, currentSchema);
    if (!location) return;
    upsertRequirementEntryByLocation(location, aiGenInput);
  }, [aiGenType, aiGenInput, currentSchema, resolveAiGenRequirementLocation, upsertRequirementEntryByLocation]);

  // ========== 保存/加载 ==========
  // 自动保存（防抖500ms，仅在加载完成后）
  useEffect(() => {
    if (!isLoadedRef.current) return; // 等待数据加载完成
    const timer = setTimeout(() => {
      const saveData = buildSaveData();
      persistLocalSave(saveData);
      if (token && activeProjectId) {
        void updateBuilderProject(activeProjectId, {
          name: state.name,
          description: state.description,
          data: saveData,
        }, true);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [activeProjectId, buildSaveData, persistLocalSave, token, updateBuilderProject, state.name, state.description]);

  const handleSave = useCallback(async () => {
    const saveData = buildSaveData();
    persistLocalSave(saveData);
    if (!token) {
      toast.success('已保存到本地');
      return;
    }
    if (activeProjectId) {
      const updated = await updateBuilderProject(activeProjectId, {
        name: state.name,
        description: state.description,
        data: saveData,
      });
      if (updated) {
        toast.success('已保存到云端');
      }
      return;
    }
    const created = await createBuilderProject({
      name: state.name || '未命名草稿',
      description: state.description,
      data: saveData,
    });
    if (created) {
      toast.success('已创建云端草稿');
    }
  }, [activeProjectId, buildSaveData, createBuilderProject, persistLocalSave, token, updateBuilderProject, state.name, state.description, toast]);

  const handleOpenSandbox = useCallback(() => {
    const saveData = buildSaveData();
    persistLocalSave(saveData);
    if (!String(saveData.rulesCode || '').trim()) {
      toast.warning('规则代码为空，试玩页将无法启动');
    }
    navigate('/dev/ugc/sandbox');
  }, [buildSaveData, navigate, persistLocalSave, toast]);

  const handleExport = useCallback(() => {
    const saveData = buildSaveData();
    const blob = new Blob([JSON.stringify(saveData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${state.name || 'game'}.ugc.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [buildSaveData, state.name]);

  const handleImport = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const data = JSON.parse(ev.target?.result as string);
          applySavedData(data);
          persistLocalSave(data);
          if (token && activeProjectId) {
            void updateBuilderProject(activeProjectId, {
              name: typeof data.name === 'string' ? data.name : stateRef.current.name,
              description: typeof data.description === 'string' ? data.description : stateRef.current.description,
              data,
            }, true);
          }
        } catch {
          alert('导入失败：无效的 JSON 文件');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }, [activeProjectId, applySavedData, persistLocalSave, token, updateBuilderProject]);

  // 页面加载时恢复（仅在无数据时才从 localStorage 还原）
  useEffect(() => {
    if (isLoadedRef.current) return;
    if (hasHydratedData) {
      isLoadedRef.current = true;
      return;
    }
    
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const data = JSON.parse(saved);
        applySavedData(data);
      } catch (err) {
        console.error('Failed to load saved state:', err);
      }
    }
    // 标记加载完成，允许自动保存
    isLoadedRef.current = true;
  }, [applySavedData, hasHydratedData]);

  // ========== 渲染 ==========
  return (
    <div className="h-screen flex flex-col bg-slate-900 text-white select-none">
      {/* 顶部工具栏 */}
      <header className="flex items-center justify-between px-4 py-2 border-b border-slate-700 shrink-0">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-semibold">UGC Builder</h1>
          <button 
            onClick={() => setActiveModal('template')}
            className="flex items-center gap-2 px-3 py-1.5 bg-green-600 hover:bg-green-500 rounded text-sm"
          >
            <Plus className="w-4 h-4" /> 新建
          </button>
          <input
            type="text"
            value={state.name}
            onChange={e => setState(prev => ({ ...prev, name: e.target.value }))}
            className="px-3 py-1 bg-slate-800 border border-slate-600 rounded text-sm focus:outline-none focus:border-amber-500"
            placeholder="游戏名称"
          />
          <span className="text-xs text-slate-400">
            {activeProjectId
              ? `当前草稿：${projectNameDraft || '未命名'}`
              : '未绑定云端草稿'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleOpenProjectList}
            className="flex items-center gap-2 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded text-sm"
          >
            <Database className="w-4 h-4" /> 草稿
          </button>
          <button 
            onClick={handleImport}
            className="flex items-center gap-2 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded text-sm"
          >
            <Upload className="w-4 h-4" /> 导入
          </button>
          <button 
            onClick={handleExport}
            className="flex items-center gap-2 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded text-sm"
          >
            <Download className="w-4 h-4" /> 导出
          </button>
          <button 
            onClick={handleSave}
            className="flex items-center gap-2 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded text-sm"
          >
            <Save className="w-4 h-4" /> 保存
          </button>
          <button 
            onClick={() => {
              if (confirm('确定清空所有数据？此操作不可撤销')) {
                localStorage.removeItem(STORAGE_KEY);
                setState(INITIAL_STATE);
              }
            }}
            className="flex items-center gap-2 px-3 py-1.5 bg-red-700 hover:bg-red-600 rounded text-sm"
          >
            <Trash2 className="w-4 h-4" /> 清空
          </button>
          <button 
            onClick={() => setActiveModal('rules')}
            className="flex items-center gap-2 px-3 py-1.5 bg-purple-600 hover:bg-purple-500 rounded text-sm"
          >
            <Sparkles className="w-4 h-4" /> 生成规则
          </button>
          <button 
            onClick={() => setIsPreviewMode(!isPreviewMode)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm ${isPreviewMode ? 'bg-green-600 hover:bg-green-500' : 'bg-blue-600 hover:bg-blue-500'}`}
          >
            <Play className="w-4 h-4" /> {isPreviewMode ? '退出预览' : '预览'}
          </button>
          <button
            onClick={handleOpenSandbox}
            className="flex items-center gap-2 px-3 py-1.5 bg-amber-600 hover:bg-amber-500 rounded text-sm"
          >
            <Gamepad2 className="w-4 h-4" /> 打开试玩
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* 左侧面板：上下分隔 */}
        <div 
          ref={leftPanelRef}
          className="flex flex-col border-r border-slate-700" 
          style={{ width: leftPanelWidth }}
        >
          {/* 上：组件库 */}
          <div className="overflow-hidden flex flex-col" style={{ height: `${topPanelRatio * 100}%` }}>
            <div className="px-3 py-2 border-b border-slate-700 flex items-center justify-between shrink-0">
              <span className="text-xs text-slate-400">组件库</span>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {/* 所有组件（包含渲染组件） */}
              {getUIComponents().map(({ category, items }) => (
                <div key={category}>
                  <button
                    onClick={() => toggleCategory(category)}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-slate-800 text-sm ${
                      category === '渲染组件' ? 'text-cyan-400' : ''
                    }`}
                  >
                    {expandedCategories.has(category) 
                      ? <ChevronDown className="w-4 h-4 text-slate-400" /> 
                      : <ChevronRight className="w-4 h-4 text-slate-400" />}
                    <span>{category}</span>
                    {category === '渲染组件' && <span className="text-xs text-slate-500">({items.length})</span>}
                  </button>
                  {expandedCategories.has(category) && (
                    <div className="ml-4 space-y-0.5">
                      {items.length === 0 && category === '渲染组件' ? (
                        <div className="text-xs text-slate-500 py-1">
                          暂无渲染组件
                        </div>
                      ) : (
                        items.map(item => (
                          <div
                            key={item.id}
                            draggable
                            onDragStart={e => handleDragStart(item, e)}
                            className={`flex items-center gap-2 px-2 py-1 rounded hover:bg-slate-700 cursor-grab text-sm ${
                              item.type === 'render-component' ? 'text-cyan-300' : 'text-slate-300'
                            }`}
                          >
                            {item.type === 'render-component' 
                              ? <Layers className="w-3 h-3" />
                              : <Square className="w-3 h-3 text-amber-500" />
                            }
                            <span className="flex-1">{item.name}</span>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* 垂直分隔线 */}
          <div 
            className="h-1 bg-slate-700 hover:bg-amber-500 cursor-row-resize shrink-0"
            onMouseDown={handleVerticalDragStart}
          />

          {/* 下：Schema/数据概览 */}
          <div className="flex-1 overflow-hidden flex flex-col">
            <div className="px-3 py-2 border-b border-slate-700 flex items-center justify-between shrink-0">
              <span className="text-xs text-slate-400">Schema & 数据</span>
              <button
                onClick={handleAddSchema}
                className="flex items-center gap-1 p-1 text-slate-400 hover:text-white"
                title="新建 Schema"
              >
                <Plus className="w-4 h-4" />
                <span className="text-[10px]">+ Schema</span>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {state.schemas.map(s => (
                <div 
                  key={s.id}
                  data-testid="schema-item"
                  className={`p-2 rounded cursor-pointer hover:bg-slate-800 ${state.selectedSchemaId === s.id ? 'bg-slate-700' : ''}`}
                  onClick={() => setState(prev => ({ ...prev, selectedSchemaId: s.id }))}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Database className="w-4 h-4 text-amber-500" />
                      <span className="text-sm font-medium">{s.name}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button 
                        onClick={e => { e.stopPropagation(); setActiveModal('schema'); }}
                        className="p-1 text-slate-400 hover:text-white"
                      >
                        <Edit3 className="w-3 h-3" />
                      </button>
                      {s.id !== 'card' && (
                        <button 
                          onClick={e => { e.stopPropagation(); handleDeleteSchema(s.id); }}
                          className="p-1 text-slate-400 hover:text-red-400"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                    <span>{Object.keys(s.fields).length} 字段</span>
                    <span>·</span>
                    <span>{state.instances[s.id]?.length || 0} 条数据</span>
                  </div>
                  {/* 快速操作按钮 */}
                  <div className="flex items-center gap-1 mt-1.5">
                    <button
                      onClick={e => { e.stopPropagation(); setActiveModal('data'); }}
                      className="px-1.5 py-0.5 bg-slate-600 hover:bg-slate-500 rounded text-[10px]"
                    >
                      编辑数据
                    </button>
                    <button
                      onClick={e => { 
                        e.stopPropagation(); 
                        setState(prev => ({ ...prev, selectedSchemaId: s.id }));
                        setAiGenType('batch-data');
                        setActiveModal('ai-gen');
                      }}
                      className="px-1.5 py-0.5 bg-purple-600 hover:bg-purple-500 rounded text-[10px]"
                    >
                      <Sparkles className="w-2.5 h-2.5 inline mr-0.5" />AI生成
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 垂直分隔线2 */}
          <div 
            className="h-1 bg-slate-700 hover:bg-amber-500 cursor-row-resize shrink-0"
          />

          {/* 下：场景层次 */}
          <div className="h-48 overflow-hidden flex flex-col border-t border-slate-700">
            <div className="px-3 py-2 border-b border-slate-700 flex items-center justify-between shrink-0">
              <span className="text-xs text-slate-400">场景层次</span>
              <button 
                onClick={() => {
                  const newGroup = {
                    id: `group-${Date.now()}`,
                    name: '新分组',
                    hidden: false,
                  };
                  setState(prev => ({
                    ...prev,
                    layoutGroups: [...(prev.layoutGroups || [{ id: 'default', name: '默认', hidden: false }, { id: 'hide', name: '隐藏', hidden: true }]), newGroup],
                  }));
                }}
                className="p-1 text-slate-400 hover:text-white" 
                title="新建分组"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {/* 分组列表 */}
              {(state.layoutGroups || [{ id: 'default', name: '默认', hidden: false }, { id: 'hide', name: '隐藏', hidden: true }]).map(group => {
                const groupComponents = state.layout.filter(c => (c.data.groupId || 'default') === group.id);
                return (
                  <div 
                    key={group.id} 
                    className={group.hidden ? 'opacity-50' : ''}
                    onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
                    onDrop={e => {
                      e.preventDefault();
                      const compId = e.dataTransfer.getData('compId');
                      if (compId) {
                        setState(prev => ({
                          ...prev,
                          layout: prev.layout.map(c => 
                            c.id === compId 
                              ? { ...c, data: { ...c.data, groupId: group.id } }
                              : c
                          ),
                        }));
                      }
                    }}
                  >
                    <div className="flex items-center gap-2 px-2 py-1 text-sm text-slate-400">
                      <Layers className="w-3 h-3" />
                      <span className="flex-1">{group.name}</span>
                      <span className="text-xs">{groupComponents.length}</span>
                    </div>
                    <div className="ml-4 space-y-0.5">
                      {groupComponents.map(comp => (
                        <div
                          key={comp.id}
                          data-testid={`layout-tree-item-${comp.id}`}
                          draggable
                          onDragStart={e => {
                            e.dataTransfer.setData('compId', comp.id);
                            e.dataTransfer.effectAllowed = 'move';
                          }}
                          onClick={e => {
                            e.stopPropagation();
                            const isMulti = e.metaKey || e.ctrlKey || e.shiftKey;
                            const nextSelected = isMulti
                              ? (selectedComponentIds.includes(comp.id)
                                ? selectedComponentIds.filter(id => id !== comp.id)
                                : [...selectedComponentIds, comp.id])
                              : [comp.id];
                            handleSelectionChange(nextSelected);
                          }}
                          className={`flex items-center gap-2 px-2 py-1 rounded cursor-grab text-xs ${
                            selectedComponentIds.includes(comp.id) ? 'bg-blue-600/50' : 'hover:bg-slate-700/50'
                          }`}
                        >
                          <GripVertical className="w-2.5 h-2.5 text-slate-500" />
                          <Square className="w-2.5 h-2.5" />
                          <span className="truncate">{String(comp.data.name || comp.type)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* 水平分隔线 */}
        <div 
          className="w-1 bg-slate-700 hover:bg-amber-500 cursor-col-resize shrink-0"
          onMouseDown={handleHorizontalDragStart}
        />

        {/* 中间：UI 画布 */}
        <div className="flex-1 flex flex-col">
          {isPreviewMode ? (
            <div className="flex-1 p-2">
              <PreviewCanvas
                components={previewConfig.layout}
                renderComponents={previewConfig.renderComponents}
                instances={previewConfig.instances}
                layoutGroups={previewConfig.layoutGroups}
                schemaDefaults={previewConfig.schemaDefaults}
                className="h-full"
              />
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-slate-800 bg-slate-900/80 text-xs">
                <div className="flex items-center gap-1">
                  <span className="text-slate-400">对齐</span>
                  <button
                    type="button"
                    onClick={() => alignSelection('left')}
                    disabled={selectedComponentIds.length === 0}
                    data-testid="align-left"
                    className={`px-2 py-1 rounded ${selectedComponentIds.length === 0 ? 'opacity-40 cursor-not-allowed' : 'bg-slate-700 hover:bg-slate-600'}`}
                  >左</button>
                  <button
                    type="button"
                    onClick={() => alignSelection('center')}
                    disabled={selectedComponentIds.length === 0}
                    data-testid="align-center"
                    className={`px-2 py-1 rounded ${selectedComponentIds.length === 0 ? 'opacity-40 cursor-not-allowed' : 'bg-slate-700 hover:bg-slate-600'}`}
                  >中</button>
                  <button
                    type="button"
                    onClick={() => alignSelection('right')}
                    disabled={selectedComponentIds.length === 0}
                    data-testid="align-right"
                    className={`px-2 py-1 rounded ${selectedComponentIds.length === 0 ? 'opacity-40 cursor-not-allowed' : 'bg-slate-700 hover:bg-slate-600'}`}
                  >右</button>
                  <button
                    type="button"
                    onClick={() => alignSelection('top')}
                    disabled={selectedComponentIds.length === 0}
                    data-testid="align-top"
                    className={`px-2 py-1 rounded ${selectedComponentIds.length === 0 ? 'opacity-40 cursor-not-allowed' : 'bg-slate-700 hover:bg-slate-600'}`}
                  >上</button>
                  <button
                    type="button"
                    onClick={() => alignSelection('middle')}
                    disabled={selectedComponentIds.length === 0}
                    data-testid="align-middle"
                    className={`px-2 py-1 rounded ${selectedComponentIds.length === 0 ? 'opacity-40 cursor-not-allowed' : 'bg-slate-700 hover:bg-slate-600'}`}
                  >中</button>
                  <button
                    type="button"
                    onClick={() => alignSelection('bottom')}
                    disabled={selectedComponentIds.length === 0}
                    data-testid="align-bottom"
                    className={`px-2 py-1 rounded ${selectedComponentIds.length === 0 ? 'opacity-40 cursor-not-allowed' : 'bg-slate-700 hover:bg-slate-600'}`}
                  >下</button>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-slate-400">分布</span>
                  <button
                    type="button"
                    onClick={() => distributeSelection('horizontal')}
                    disabled={selectedComponentIds.length < 3}
                    data-testid="distribute-horizontal"
                    className={`px-2 py-1 rounded ${selectedComponentIds.length < 3 ? 'opacity-40 cursor-not-allowed' : 'bg-slate-700 hover:bg-slate-600'}`}
                  >水平</button>
                  <button
                    type="button"
                    onClick={() => distributeSelection('vertical')}
                    disabled={selectedComponentIds.length < 3}
                    data-testid="distribute-vertical"
                    className={`px-2 py-1 rounded ${selectedComponentIds.length < 3 ? 'opacity-40 cursor-not-allowed' : 'bg-slate-700 hover:bg-slate-600'}`}
                  >垂直</button>
                </div>
                <div className="ml-auto flex flex-wrap items-center gap-2">
                  <label className="flex items-center gap-1 text-slate-400">
                    <input
                      type="checkbox"
                      checked={showGrid}
                      onChange={e => setShowGrid(e.target.checked)}
                      data-testid="toggle-grid"
                    />网格
                  </label>
                  <label className="flex items-center gap-1 text-slate-400">
                    <span>网格</span>
                    <input
                      type="number"
                      min={4}
                      value={gridSize}
                      onChange={e => setGridSize(Math.max(4, Number(e.target.value || 0)))}
                      data-testid="grid-size-input"
                      className="w-16 px-1 py-0.5 bg-slate-800 border border-slate-700 rounded"
                    />
                  </label>
                  <label className="flex items-center gap-1 text-slate-400">
                    <input
                      type="checkbox"
                      checked={snapToGrid}
                      onChange={e => setSnapToGrid(e.target.checked)}
                      data-testid="toggle-snap-grid"
                    />吸附网格
                  </label>
                  <label className="flex items-center gap-1 text-slate-400">
                    <input
                      type="checkbox"
                      checked={snapToEdges}
                      onChange={e => setSnapToEdges(e.target.checked)}
                      data-testid="toggle-snap-edges"
                    />边缘
                  </label>
                  <label className="flex items-center gap-1 text-slate-400">
                    <input
                      type="checkbox"
                      checked={snapToCenters}
                      onChange={e => setSnapToCenters(e.target.checked)}
                      data-testid="toggle-snap-centers"
                    />中心
                  </label>
                  <label className="flex items-center gap-1 text-slate-400">
                    <span>阈值</span>
                    <input
                      type="number"
                      min={1}
                      value={snapThreshold}
                      onChange={e => setSnapThreshold(Math.max(1, Number(e.target.value || 0)))}
                      data-testid="snap-threshold-input"
                      className="w-14 px-1 py-0.5 bg-slate-800 border border-slate-700 rounded"
                    />
                  </label>
                </div>
              </div>
              <div className="flex-1 p-2">
                <SceneCanvas
                  components={state.layout}
                  onChange={handleLayoutChange}
                  selectedIds={selectedComponentIds}
                  primarySelectedId={state.selectedComponentId ?? undefined}
                  onSelectionChange={handleSelectionChange}
                  onCanvasSizeChange={setCanvasSize}
                  gridSize={gridSize}
                  showGrid={showGrid}
                  snapToGrid={snapToGrid}
                  snapToEdges={snapToEdges}
                  snapToCenters={snapToCenters}
                  snapThreshold={snapThreshold}
                  onNewRenderComponent={comp => {
                    // 拖入新建渲染组件时，自动创建renderComponent并关联
                    const newRc: RenderComponent = {
                      id: `rc-${Date.now()}`,
                      name: String(comp.data.name || '新渲染组件'),
                      targetSchema: state.schemas[0]?.id || '',
                      renderCode: '',
                      description: '',
                    };
                    setState(prev => ({
                      ...prev,
                      renderComponents: [...prev.renderComponents, newRc],
                      layout: prev.layout.map(c => 
                        c.id === comp.id 
                          ? { ...c, data: { ...c.data, renderComponentId: newRc.id, isNew: undefined } }
                          : c
                      ),
                    }));
                  }}
                  className="h-full"
                />
              </div>
            </>
          )}
        </div>

        {/* 右侧：属性面板 */}
        <div className="w-72 border-l border-slate-700 flex flex-col overflow-hidden">
          <div className="px-3 py-2 border-b border-slate-700 text-xs text-slate-400 shrink-0">
            属性面板
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            {state.selectedComponentId ? (() => {
              const comp = state.layout.find(c => c.id === state.selectedComponentId);
              if (!comp) return <div className="text-slate-500 text-sm">组件不存在</div>;
              
              const updateComp = (updates: Partial<typeof comp>) => {
                handleLayoutChange(state.layout.map(c => 
                  c.id === comp.id ? { ...c, ...updates } : c
                ));
              };
              
              const updateCompData = (key: string, value: unknown) => {
                updateComp({ data: { ...comp.data, [key]: value } });
              };
              
              return (
                <div className="space-y-4">
                  {/* 基本信息 */}
                  <div className="space-y-2">
                    <h3 className="text-sm font-medium text-amber-500">基本信息</h3>
                    <div className="space-y-2 text-xs">
                      <div>
                        <label className="text-slate-400">类型</label>
                        <div className="text-white bg-slate-800 px-2 py-1 rounded">{comp.type}</div>
                      </div>
                      <div>
                        <label className="text-slate-400">名称</label>
                        <input
                          type="text"
                          value={String(comp.data.name || '')}
                          onChange={e => updateCompData('name', e.target.value)}
                          placeholder="组件名称"
                          className="w-full px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white"
                        />
                      </div>
                      {/* 显示区域组件的数据格式 */}
                      {(() => {
                        const compDef = BASE_UI_COMPONENTS.flatMap(c => c.items).find(i => i.type === comp.type);
                        if (!compDef?.dataFormat) return null;
                        return (
                          <div className="space-y-1">
                            <label className="text-slate-400">接收数据格式</label>
                            <div className="text-cyan-400 bg-slate-800 px-2 py-1 rounded text-[10px] font-mono">
                              {compDef.dataFormat}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  {/* 位置和尺寸 */}
                  <div className="space-y-2">
                    <h3 className="text-sm font-medium text-amber-500">变换</h3>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <label className="text-slate-400">锚点 X</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          max="1"
                          value={comp.anchor.x}
                          onChange={e => updateComp({ anchor: { ...comp.anchor, x: Number(e.target.value) } })}
                          className="w-full px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white"
                        />
                      </div>
                      <div>
                        <label className="text-slate-400">锚点 Y</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          max="1"
                          value={comp.anchor.y}
                          onChange={e => updateComp({ anchor: { ...comp.anchor, y: Number(e.target.value) } })}
                          className="w-full px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white"
                        />
                      </div>
                      <div>
                        <label className="text-slate-400">枢轴 X</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          max="1"
                          value={comp.pivot.x}
                          onChange={e => updateComp({ pivot: { ...comp.pivot, x: Number(e.target.value) } })}
                          className="w-full px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white"
                        />
                      </div>
                      <div>
                        <label className="text-slate-400">枢轴 Y</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          max="1"
                          value={comp.pivot.y}
                          onChange={e => updateComp({ pivot: { ...comp.pivot, y: Number(e.target.value) } })}
                          className="w-full px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white"
                        />
                      </div>
                      <div>
                        <label className="text-slate-400">偏移 X</label>
                        <input
                          type="number"
                          value={comp.offset.x}
                          onChange={e => updateComp({ offset: { ...comp.offset, x: Number(e.target.value) } })}
                          className="w-full px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white"
                        />
                      </div>
                      <div>
                        <label className="text-slate-400">偏移 Y</label>
                        <input
                          type="number"
                          value={comp.offset.y}
                          onChange={e => updateComp({ offset: { ...comp.offset, y: Number(e.target.value) } })}
                          className="w-full px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white"
                        />
                      </div>
                      <div>
                        <label className="text-slate-400">宽</label>
                        <input
                          type="number"
                          value={comp.width}
                          onChange={e => updateComp({ width: Number(e.target.value) })}
                          className="w-full px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white"
                        />
                      </div>
                      <div>
                        <label className="text-slate-400">高</label>
                        <input
                          type="number"
                          value={comp.height}
                          onChange={e => updateComp({ height: Number(e.target.value) })}
                          className="w-full px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white"
                        />
                      </div>
                    </div>
                  </div>

                  {/* BGM 配置 */}
                  {comp.type === 'bgm' && (
                    <div className="space-y-2">
                      <h3 className="text-sm font-medium text-amber-500">背景音乐</h3>
                      <div className="space-y-2 text-xs">
                        <div>
                          <label className="text-slate-400">BGM Key</label>
                          <input
                            type="text"
                            value={String(comp.data.bgmKey || '')}
                            onChange={e => updateCompData('bgmKey', e.target.value)}
                            placeholder="如：bgm-main"
                            className="w-full px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white"
                          />
                        </div>
                        <div>
                          <label className="text-slate-400">名称</label>
                          <input
                            type="text"
                            value={String(comp.data.bgmName || '')}
                            onChange={e => updateCompData('bgmName', e.target.value)}
                            placeholder="显示名称"
                            className="w-full px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white"
                          />
                        </div>
                        <div>
                          <label className="text-slate-400">音频路径</label>
                          <input
                            type="text"
                            value={String(comp.data.bgmSrc || '')}
                            onChange={e => updateCompData('bgmSrc', e.target.value)}
                            placeholder="如：common/audio/compressed/main.ogg"
                            className="w-full px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white"
                          />
                        </div>
                        <div>
                          <label className="text-slate-400">资源前缀</label>
                          <input
                            type="text"
                            value={String(comp.data.bgmBasePath || '')}
                            onChange={e => updateCompData('bgmBasePath', e.target.value)}
                            placeholder="如：dicethrone/audio"
                            className="w-full px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white"
                          />
                        </div>
                        <div>
                          <label className="text-slate-400">音量 (0-1)</label>
                          <input
                            type="number"
                            step="0.05"
                            min="0"
                            max="1"
                            value={Number(comp.data.bgmVolume ?? 0.6)}
                            onChange={e => updateCompData('bgmVolume', Number(e.target.value))}
                            className="w-full px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white"
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <label className="text-slate-400">启用</label>
                          <input
                            type="checkbox"
                            checked={comp.data.bgmEnabled !== false}
                            onChange={e => updateCompData('bgmEnabled', e.target.checked)}
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <label className="text-slate-400">预览自动播放</label>
                          <input
                            type="checkbox"
                            checked={comp.data.bgmAutoPlay !== false}
                            onChange={e => updateCompData('bgmAutoPlay', e.target.checked)}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {comp.type === 'action-bar' && (() => {
                    const actions = Array.isArray(comp.data.actions)
                      ? (comp.data.actions as Array<{ id: string; label?: string; scope?: string; variant?: string; disabled?: boolean; requirement?: string; hookCode?: string }>)
                      : [];
                    return (
                      <div className="space-y-2">
                        <h3 className="text-sm font-medium text-amber-500">操作栏</h3>
                        <p className="text-slate-500 text-[10px]">通用动作按钮区（非游戏特化）</p>
                        <div className="space-y-2 text-xs">
                          <div className="flex items-center justify-between">
                            <label className="text-slate-400">启用动作钩子</label>
                            <input
                              type="checkbox"
                              checked={comp.data.allowActionHooks !== false}
                              onChange={e => updateCompData('allowActionHooks', e.target.checked)}
                            />
                          </div>
                          <div>
                            <label className="text-slate-400">布局方向</label>
                            <select
                              value={String(comp.data.layout || 'row')}
                              onChange={e => updateCompData('layout', e.target.value)}
                              className="w-full px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white"
                            >
                              <option value="row">水平</option>
                              <option value="column">垂直</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-slate-400">对齐方式</label>
                            <select
                              value={String(comp.data.align || 'center')}
                              onChange={e => updateCompData('align', e.target.value)}
                              className="w-full px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white"
                            >
                              <option value="start">靠左</option>
                              <option value="center">居中</option>
                              <option value="end">靠右</option>
                              <option value="space-between">两端对齐</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-slate-400">间距</label>
                            <input
                              type="number"
                              value={String(comp.data.gap ?? 8)}
                              onChange={e => updateCompData('gap', Number(e.target.value || 0))}
                              className="w-full px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white"
                            />
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-slate-400">动作列表</span>
                            <button
                              onClick={() => updateCompData('actions', [
                                ...actions,
                                {
                                  id: `action-${Date.now()}`,
                                  label: '动作',
                                  scope: 'current-player',
                                  variant: 'secondary',
                                  disabled: false,
                                  requirement: '',
                                  hookCode: '',
                                },
                              ])}
                              className="px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded text-[10px]"
                            >
                              + 添加动作
                            </button>
                          </div>
                          {actions.length === 0 ? (
                            <div className="text-[10px] text-slate-500">暂无动作，可按需添加。</div>
                          ) : (
                            <div className="space-y-2">
                              {actions.map((action, index) => (
                                <div key={action.id} className="border border-slate-700 rounded p-2 bg-slate-900/40 space-y-2">
                                  <div className="flex items-center justify-between">
                                    <span className="text-[10px] text-slate-400">动作 {index + 1}</span>
                                    <button
                                      onClick={() => updateCompData('actions', actions.filter(a => a.id !== action.id))}
                                      className="text-[10px] text-red-400 hover:text-red-300"
                                    >
                                      删除
                                    </button>
                                  </div>
                                  <input
                                    type="text"
                                    value={action.label || ''}
                                    onChange={e => {
                                      const next = actions.map(item => item.id === action.id ? { ...item, label: e.target.value } : item);
                                      updateCompData('actions', next);
                                    }}
                                    placeholder="按钮文案"
                                    className="w-full px-2 py-1 bg-slate-800 border border-slate-700 rounded text-xs text-slate-200"
                                  />
                                  <select
                                    value={String(action.scope || 'current-player')}
                                    onChange={e => {
                                      const next = actions.map(item => item.id === action.id ? { ...item, scope: e.target.value } : item);
                                      updateCompData('actions', next);
                                    }}
                                    className="w-full px-2 py-1 bg-slate-800 border border-slate-700 rounded text-xs text-slate-200"
                                  >
                                    <option value="current-player">仅当前玩家可见</option>
                                    <option value="all">所有玩家可见</option>
                                  </select>
                                  <select
                                    value={String(action.variant || 'secondary')}
                                    onChange={e => {
                                      const next = actions.map(item => item.id === action.id ? { ...item, variant: e.target.value } : item);
                                      updateCompData('actions', next);
                                    }}
                                    className="w-full px-2 py-1 bg-slate-800 border border-slate-700 rounded text-xs text-slate-200"
                                  >
                                    <option value="primary">主按钮</option>
                                    <option value="secondary">次按钮</option>
                                    <option value="ghost">幽灵</option>
                                  </select>
                                  <label className="flex items-center gap-2 text-[10px] text-slate-400">
                                    <input
                                      type="checkbox"
                                      checked={Boolean(action.disabled)}
                                      onChange={e => {
                                        const next = actions.map(item => item.id === action.id ? { ...item, disabled: e.target.checked } : item);
                                        updateCompData('actions', next);
                                      }}
                                    />
                                    禁用
                                  </label>
                                  <textarea
                                    value={action.requirement || ''}
                                    onChange={e => {
                                      const next = actions.map(item => item.id === action.id ? { ...item, requirement: e.target.value } : item);
                                      updateCompData('actions', next);
                                    }}
                                    placeholder="动作需求描述（可选）"
                                    className="w-full h-16 px-2 py-1 bg-slate-800 border border-slate-700 rounded text-xs text-slate-200 resize-none"
                                  />
                                  <div className="flex items-center justify-between">
                                    <span className="text-[10px] text-slate-400">动作钩子代码</span>
                                    <div className="flex items-center gap-2">
                                      <button
                                        onClick={() => {
                                          navigator.clipboard.writeText(buildActionHookPrompt({
                                            requirement: String(action.requirement || ''),
                                            componentType: comp.type,
                                          }));
                                        }}
                                        className="text-[10px] text-purple-400 hover:text-purple-300"
                                      >
                                        复制提示词
                                      </button>
                                      <button
                                        onClick={() => {
                                          const next = actions.map(item => item.id === action.id ? { ...item, hookCode: '' } : item);
                                          updateCompData('actions', next);
                                        }}
                                        disabled={!action.hookCode}
                                        className="text-[10px] text-slate-400 hover:text-slate-200 disabled:opacity-40"
                                      >
                                        清空
                                      </button>
                                    </div>
                                  </div>
                                  <textarea
                                    value={action.hookCode || ''}
                                    readOnly
                                    onPaste={e => {
                                      e.preventDefault();
                                      const text = e.clipboardData.getData('text');
                                      if (text.trim()) {
                                        const next = actions.map(item => item.id === action.id ? { ...item, hookCode: text } : item);
                                        updateCompData('actions', next);
                                      }
                                    }}
                                    placeholder="粘贴 AI 生成的动作钩子代码"
                                    className="w-full h-20 px-2 py-1 bg-slate-800 border border-slate-700 rounded text-xs text-slate-200 resize-none"
                                  />
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  {comp.type === 'phase-hud' && (() => {
                    const phases = Array.isArray(comp.data.phases)
                      ? (comp.data.phases as Array<{ id: string; label: string }>)
                      : [];
                    return (
                      <div className="space-y-2">
                        <h3 className="text-sm font-medium text-amber-500">阶段提示</h3>
                        <p className="text-slate-500 text-[10px]">通用阶段/回合提示</p>
                        <div className="space-y-2 text-xs">
                          <div>
                            <label className="text-slate-400">布局方向</label>
                            <select
                              value={String(comp.data.orientation || 'horizontal')}
                              onChange={e => updateCompData('orientation', e.target.value)}
                              className="w-full px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white"
                            >
                              <option value="horizontal">水平</option>
                              <option value="vertical">垂直</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-slate-400">当前阶段 ID</label>
                            <input
                              type="text"
                              value={String(comp.data.currentPhaseId || '')}
                              onChange={e => updateCompData('currentPhaseId', e.target.value)}
                              placeholder="action"
                              className="w-full px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white"
                            />
                          </div>
                          <div>
                            <label className="text-slate-400">状态文案</label>
                            <input
                              type="text"
                              value={String(comp.data.statusText || '')}
                              onChange={e => updateCompData('statusText', e.target.value)}
                              placeholder="等待操作"
                              className="w-full px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white"
                            />
                          </div>
                          <div>
                            <label className="text-slate-400">当前玩家文案</label>
                            <input
                              type="text"
                              value={String(comp.data.currentPlayerLabel || '')}
                              onChange={e => updateCompData('currentPlayerLabel', e.target.value)}
                              placeholder="当前玩家: 玩家1"
                              className="w-full px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white"
                            />
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-slate-400">阶段列表</span>
                            <button
                              onClick={() => updateCompData('phases', [
                                ...phases,
                                { id: `phase-${Date.now()}`, label: '新阶段' },
                              ])}
                              className="px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded text-[10px]"
                            >
                              + 添加阶段
                            </button>
                          </div>
                          {phases.length === 0 ? (
                            <div className="text-[10px] text-slate-500">暂无阶段。</div>
                          ) : (
                            <div className="space-y-2">
                              {phases.map((phase, index) => (
                                <div key={phase.id} className="border border-slate-700 rounded p-2 bg-slate-900/40 space-y-2">
                                  <div className="flex items-center justify-between">
                                    <span className="text-[10px] text-slate-400">阶段 {index + 1}</span>
                                    <button
                                      onClick={() => updateCompData('phases', phases.filter(p => p.id !== phase.id))}
                                      className="text-[10px] text-red-400 hover:text-red-300"
                                    >
                                      删除
                                    </button>
                                  </div>
                                  <input
                                    type="text"
                                    value={phase.id}
                                    onChange={e => {
                                      const next = phases.map(item => item.id === phase.id ? { ...item, id: e.target.value } : item);
                                      updateCompData('phases', next);
                                    }}
                                    placeholder="阶段 ID"
                                    className="w-full px-2 py-1 bg-slate-800 border border-slate-700 rounded text-xs text-slate-200"
                                  />
                                  <input
                                    type="text"
                                    value={phase.label}
                                    onChange={e => {
                                      const next = phases.map(item => item.id === phase.id ? { ...item, label: e.target.value } : item);
                                      updateCompData('phases', next);
                                    }}
                                    placeholder="阶段名称"
                                    className="w-full px-2 py-1 bg-slate-800 border border-slate-700 rounded text-xs text-slate-200"
                                  />
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  {/* 数据绑定（render-component 使用专属 targetSchema，避免重复） */}
                  {comp.type !== 'render-component' && (
                    <div className="space-y-2">
                      <h3 className="text-sm font-medium text-amber-500">数据绑定</h3>
                      <div className="space-y-2 text-xs">
                        <div>
                          <label className="text-slate-400">绑定 Schema</label>
                          <select
                            value={String(comp.data.bindSchema || '')}
                            onChange={e => updateCompData('bindSchema', e.target.value || undefined)}
                            className="w-full px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white"
                          >
                            <option value="">无</option>
                            {state.schemas.map(s => (
                              <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="text-slate-400">
                            {comp.type === 'hand-zone' ? '归属字段（玩家ID）' : '关联实体字段'}
                          </label>
                          <input
                            type="text"
                            value={String(comp.data.bindEntity || '')}
                            onChange={e => updateCompData('bindEntity', e.target.value)}
                            placeholder={comp.type === 'hand-zone' ? '如：ownerId / playerId' : '如：playerId'}
                            className="w-full px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 玩家区域：目标玩家配置 */}
                  {comp.type === 'player-area' && (
                    <div className="space-y-2">
                      <h3 className="text-sm font-medium text-amber-500">目标玩家</h3>
                      <div className="space-y-2 text-xs">
                        <div>
                          <label className="text-slate-400">目标类型</label>
                          <select
                            value={String(comp.data.playerRef === 'self' ? 'current' : (comp.data.playerRef || 'current'))}
                            onChange={e => updateCompData('playerRef', e.target.value)}
                            className="w-full px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white"
                          >
                            <option value="current">当前玩家</option>
                            <option value="index">第 N 个玩家</option>
                          </select>
                        </div>
                        {(comp.data.playerRef === 'index') && (
                          <div>
                            <label className="text-slate-400">第 N 个玩家索引（0 开始）</label>
                            <input
                              type="number"
                              value={String(comp.data.playerRefIndex ?? 0)}
                              onChange={e => updateCompData('playerRefIndex', Number(e.target.value || 0))}
                              className="w-full px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white"
                            />
                          </div>
                        )}
                        <p className="text-[10px] text-slate-500">
                          预览会自动使用绑定 Schema 的数据作为玩家列表。
                        </p>
                      </div>
                    </div>
                  )}

                  {/* 手牌区：布局、选中、排序、过滤（引擎层 HandAreaSkeleton 支持） */}
                  {comp.type === 'hand-zone' && (() => {
                    const bindSchemaId = comp.data.bindSchema as string | undefined;
                    const bindSchema = bindSchemaId
                      ? state.schemas.find(s => s.id === bindSchemaId)
                      : undefined;
                    const schemaFields = bindSchema ? Object.entries(bindSchema.fields) : [];
                    const targetPlayerRef = String(comp.data.targetPlayerRef || 'current');
                    const actions = Array.isArray(comp.data.actions)
                      ? (comp.data.actions as Array<{ id: string; label?: string; scope?: string; requirement?: string; hookCode?: string }>)
                      : [];
                    return (
                      <>
                        <div className="space-y-2">
                          <h3 className="text-sm font-medium text-amber-500">归属与目标玩家</h3>
                          <p className="text-slate-500 text-[10px]">基于归属字段与目标玩家自动过滤</p>
                          <div className="space-y-2 text-xs">
                            <div>
                              <label className="text-slate-400">目标玩家</label>
                              <select
                                value={targetPlayerRef}
                                onChange={e => updateCompData('targetPlayerRef', e.target.value)}
                                className="w-full px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white"
                              >
                                <option value="current">当前玩家</option>
                                <option value="index">第 N 个玩家</option>
                              </select>
                            </div>
                            {targetPlayerRef === 'index' && (
                              <div>
                                <label className="text-slate-400">第 N 个玩家索引（0 开始）</label>
                                <input
                                  type="number"
                                  value={String(comp.data.targetPlayerIndex ?? 0)}
                                  onChange={e => updateCompData('targetPlayerIndex', Number(e.target.value || 0))}
                                  className="w-full px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white"
                                />
                              </div>
                            )}
                            <div>
                              <label className="text-slate-400">归属字段（玩家ID）</label>
                              {schemaFields.length > 0 ? (
                                <select
                                  value={String(comp.data.bindEntity || '')}
                                  onChange={e => updateCompData('bindEntity', e.target.value || undefined)}
                                  className="w-full px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white"
                                >
                                  <option value="">未设置</option>
                                  {schemaFields.map(([key, field]) => (
                                    <option key={key} value={key}>{`${key} (${field.label})`}</option>
                                  ))}
                                </select>
                              ) : (
                                <input
                                  type="text"
                                  value={String(comp.data.bindEntity || '')}
                                  onChange={e => updateCompData('bindEntity', e.target.value)}
                                  placeholder="如：ownerId / playerId"
                                  className="w-full px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white"
                                />
                              )}
                            </div>
                            <div>
                              <label className="text-slate-400">区域字段（可选）</label>
                              {schemaFields.length > 0 ? (
                                <select
                                  value={String(comp.data.zoneField || '')}
                                  onChange={e => updateCompData('zoneField', e.target.value || undefined)}
                                  className="w-full px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white"
                                >
                                  <option value="">未设置</option>
                                  {schemaFields.map(([key, field]) => (
                                    <option key={key} value={key}>{`${key} (${field.label})`}</option>
                                  ))}
                                </select>
                              ) : (
                                <input
                                  type="text"
                                  value={String(comp.data.zoneField || '')}
                                  onChange={e => updateCompData('zoneField', e.target.value)}
                                  placeholder="如：zoneType"
                                  className="w-full px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white"
                                />
                              )}
                            </div>
                            <div>
                              <label className="text-slate-400">区域值（可选）</label>
                              <input
                                type="text"
                                value={String(comp.data.zoneValue || '')}
                                onChange={e => updateCompData('zoneValue', e.target.value)}
                                placeholder="如：hand"
                                className="w-full px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white"
                              />
                            </div>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <h3 className="text-sm font-medium text-amber-500">布局与选中</h3>
                          <p className="text-slate-500 text-[10px]">由引擎层 HandAreaSkeleton 执行</p>
                          <div className="space-y-2 text-xs">
                            <HookField label="布局代码" value={String(comp.data.layoutCode || '')} onChange={v => updateCompData('layoutCode', v)} requirementValue={String(comp.data.layoutRequirement || '')} onRequirementChange={v => updateCompData('layoutRequirement', v)} schema={currentSchema} hookType="layout" placeholder="顺序排开，卡牌间距-30px" componentType={comp.type} />
                            <HookField label="选中效果" value={String(comp.data.selectEffectCode || '')} onChange={v => updateCompData('selectEffectCode', v)} requirementValue={String(comp.data.selectEffectRequirement || '')} onRequirementChange={v => updateCompData('selectEffectRequirement', v)} schema={currentSchema} hookType="selectEffect" placeholder="抬高一点" componentType={comp.type} />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <h3 className="text-sm font-medium text-amber-500">排序与过滤</h3>
                          <p className="text-slate-500 text-[10px]">由引擎层 HandAreaSkeleton 执行</p>
                          <div className="space-y-2 text-xs">
                            <HookField label="排序代码" value={String(comp.data.sortCode || '')} onChange={v => updateCompData('sortCode', v)} requirementValue={String(comp.data.sortRequirement || '')} onRequirementChange={v => updateCompData('sortRequirement', v)} schema={currentSchema} hookType="sort" placeholder="按点数从小到大排序" componentType={comp.type} />
                            <HookField label="过滤代码" value={String(comp.data.filterCode || '')} onChange={v => updateCompData('filterCode', v)} requirementValue={String(comp.data.filterRequirement || '')} onRequirementChange={v => updateCompData('filterRequirement', v)} schema={currentSchema} hookType="filter" placeholder="只显示可出的牌" componentType={comp.type} />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <h3 className="text-sm font-medium text-amber-500">渲染面</h3>
                          <p className="text-slate-500 text-[10px]">控制正/背面显示策略</p>
                          <div className="space-y-2 text-xs">
                            <div>
                              <label className="text-slate-400">渲染面模式</label>
                              <select
                                value={String(comp.data.renderFaceMode || 'auto')}
                                onChange={e => updateCompData('renderFaceMode', e.target.value)}
                                className="w-full px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white"
                              >
                                <option value="auto">跟随预览切换</option>
                                <option value="front">始终正面</option>
                                <option value="back">始终背面</option>
                              </select>
                            </div>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <h3 className="text-sm font-medium text-amber-500">动作钩子</h3>
                          <p className="text-slate-500 text-[10px]">支持在手牌区显示动作按钮并绑定交互钩子</p>
                          <div className="space-y-2 text-xs">
                            <div className="flex items-center justify-between">
                              <label className="text-slate-400">启用动作钩子</label>
                              <input
                                type="checkbox"
                                checked={comp.data.allowActionHooks !== false}
                                onChange={e => updateCompData('allowActionHooks', e.target.checked)}
                              />
                            </div>
                            <button
                              onClick={() => updateCompData('actions', [
                                ...actions,
                                {
                                  id: `action-${Date.now()}`,
                                  label: '动作',
                                  scope: 'current-player',
                                  requirement: '',
                                  hookCode: '',
                                },
                              ])}
                              className="px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded text-[10px]"
                            >
                              + 添加动作
                            </button>
                            {actions.length === 0 ? (
                              <div className="text-[10px] text-slate-500">暂无动作，可按需添加。</div>
                            ) : (
                              <div className="space-y-2">
                                {actions.map((action, index) => (
                                  <div key={action.id} className="border border-slate-700 rounded p-2 bg-slate-900/40 space-y-2">
                                    <div className="flex items-center justify-between">
                                      <span className="text-[10px] text-slate-400">动作 {index + 1}</span>
                                      <button
                                        onClick={() => updateCompData('actions', actions.filter(a => a.id !== action.id))}
                                        className="text-[10px] text-red-400 hover:text-red-300"
                                      >
                                        删除
                                      </button>
                                    </div>
                                    <input
                                      type="text"
                                      value={action.label || ''}
                                      onChange={e => {
                                        const next = actions.map(item => item.id === action.id ? { ...item, label: e.target.value } : item);
                                        updateCompData('actions', next);
                                      }}
                                      placeholder="按钮文案"
                                      className="w-full px-2 py-1 bg-slate-800 border border-slate-700 rounded text-xs text-slate-200"
                                    />
                                    <select
                                      value={String(action.scope || 'current-player')}
                                      onChange={e => {
                                        const next = actions.map(item => item.id === action.id ? { ...item, scope: e.target.value } : item);
                                        updateCompData('actions', next);
                                      }}
                                      className="w-full px-2 py-1 bg-slate-800 border border-slate-700 rounded text-xs text-slate-200"
                                    >
                                      <option value="current-player">仅当前玩家可见</option>
                                      <option value="all">所有玩家可见</option>
                                    </select>
                                    <textarea
                                      value={action.requirement || ''}
                                      onChange={e => {
                                        const next = actions.map(item => item.id === action.id ? { ...item, requirement: e.target.value } : item);
                                        updateCompData('actions', next);
                                      }}
                                      placeholder="动作需求描述（可选）"
                                      className="w-full h-16 px-2 py-1 bg-slate-800 border border-slate-700 rounded text-xs text-slate-200 resize-none"
                                    />
                                    <div className="flex items-center justify-between">
                                      <span className="text-[10px] text-slate-400">动作钩子代码</span>
                                      <div className="flex items-center gap-2">
                                        <button
                                          onClick={() => {
                                            navigator.clipboard.writeText(buildActionHookPrompt({
                                              requirement: String(action.requirement || ''),
                                              componentType: comp.type,
                                            }));
                                          }}
                                          className="text-[10px] text-purple-400 hover:text-purple-300"
                                        >
                                          复制提示词
                                        </button>
                                        <button
                                          onClick={() => {
                                            const next = actions.map(item => item.id === action.id ? { ...item, hookCode: '' } : item);
                                            updateCompData('actions', next);
                                          }}
                                          disabled={!action.hookCode}
                                          className="text-[10px] text-slate-400 hover:text-slate-200 disabled:opacity-40"
                                        >
                                          清空
                                        </button>
                                      </div>
                                    </div>
                                    <textarea
                                      value={action.hookCode || ''}
                                      readOnly
                                      onPaste={e => {
                                        e.preventDefault();
                                        const text = e.clipboardData.getData('text');
                                        if (text.trim()) {
                                          const next = actions.map(item => item.id === action.id ? { ...item, hookCode: text } : item);
                                          updateCompData('actions', next);
                                        }
                                      }}
                                      placeholder="粘贴 AI 生成的动作钩子代码"
                                      className="w-full h-20 px-2 py-1 bg-slate-800 border border-slate-700 rounded text-xs text-slate-200 resize-none"
                                    />
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </>
                    );
                  })()}

                  {/* 出牌区：布局（引擎层 HandAreaSkeleton 支持） */}
                  {comp.type === 'play-zone' && (
                    <div className="space-y-2">
                      <h3 className="text-sm font-medium text-amber-500">布局</h3>
                      <p className="text-slate-500 text-[10px]">由引擎层 HandAreaSkeleton 执行</p>
                      <div className="space-y-2 text-xs">
                        <HookField label="布局代码" value={String(comp.data.layoutCode || '')} onChange={v => updateCompData('layoutCode', v)} requirementValue={String(comp.data.layoutRequirement || '')} onRequirementChange={v => updateCompData('layoutRequirement', v)} schema={currentSchema} hookType="layout" placeholder="居中堆叠" componentType={comp.type} />
                        <div>
                          <label className="text-slate-400">渲染面模式</label>
                          <select
                            value={String(comp.data.renderFaceMode || 'auto')}
                            onChange={e => updateCompData('renderFaceMode', e.target.value)}
                            className="w-full px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white"
                          >
                            <option value="auto">跟随预览切换</option>
                            <option value="front">始终正面</option>
                            <option value="back">始终背面</option>
                          </select>
                        </div>
                        <div className="flex items-center justify-between">
                          <label className="text-slate-400">启用动作钩子</label>
                          <input
                            type="checkbox"
                            checked={comp.data.allowActionHooks !== false}
                            onChange={e => updateCompData('allowActionHooks', e.target.checked)}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 手牌区/出牌区：单项渲染组件引用 */}
                  {['hand-zone', 'play-zone'].includes(comp.type) && (() => {
                    const bindSchemaId = comp.data.bindSchema as string | undefined;
                    const availableRenderComponents = bindSchemaId
                      ? renderComponentInstances.filter(rc => rc.targetSchema === bindSchemaId)
                      : renderComponentInstances;
                    return (
                      <div className="space-y-2">
                        <h3 className="text-sm font-medium text-amber-500">单项渲染组件</h3>
                        <p className="text-slate-500 text-[10px]">引用渲染组件，复用正/背面渲染代码</p>
                        <div className="space-y-2 text-xs">
                          <div>
                            <label className="text-slate-400">渲染组件</label>
                            <select
                              value={String(comp.data.itemRenderComponentId || '')}
                              onChange={e => updateCompData('itemRenderComponentId', e.target.value || undefined)}
                              className="w-full px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white"
                            >
                              <option value="">选择渲染组件</option>
                              {availableRenderComponents.map(rc => (
                                <option key={rc.id} value={rc.id}>{rc.name}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* 渲染组件专属配置 */}
                  {comp.type === 'render-component' && (() => {
                    const targetSchema = state.schemas.find(s => s.id === comp.data.targetSchema);
                    return (
                      <div className="space-y-2">
                        <h3 className="text-sm font-medium text-cyan-500">渲染组件配置</h3>
                        <div className="space-y-2 text-xs">
                          <div>
                            <label className="text-slate-400">绑定 Schema</label>
                            <select
                              value={String(comp.data.targetSchema || '')}
                              onChange={e => updateCompData('targetSchema', e.target.value || undefined)}
                              className="w-full px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white"
                            >
                              <option value="">选择数据源</option>
                              {state.schemas.map(s => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="text-slate-400">需求描述</label>
                            <input
                              type="text"
                              value={String(comp.data.renderRequirement || '')}
                              onChange={e => updateCompData('renderRequirement', e.target.value)}
                              placeholder="如：显示图标和属性信息"
                              className="w-full px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white"
                            />
                          </div>
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className="text-slate-400">正面渲染代码</label>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => {
                                    const prompt = generateFront({
                                      requirement: String(comp.data.renderRequirement || '显示数据的基本信息'),
                                      schema: targetSchema,
                                    });
                                    navigator.clipboard.writeText(prompt);
                                  }}
                                  className="px-1.5 py-0.5 bg-purple-600 hover:bg-purple-500 rounded text-[10px]"
                                >
                                  复制提示词
                                </button>
                                <button
                                  onClick={() => updateCompData('renderCode', '')}
                                  disabled={!comp.data.renderCode}
                                  className="px-1.5 py-0.5 bg-slate-700 hover:bg-slate-600 rounded text-[10px] disabled:opacity-40"
                                >
                                  清空
                                </button>
                              </div>
                            </div>
                            <textarea
                              value={String(comp.data.renderCode || '')}
                              readOnly
                              onPaste={e => {
                                e.preventDefault();
                                const text = e.clipboardData.getData('text');
                                if (text.trim()) {
                                  updateCompData('renderCode', text);
                                }
                              }}
                              placeholder="(data) => <div>...</div>"
                              rows={4}
                              className="w-full px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white font-mono text-[10px]"
                            />
                          </div>
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className="text-slate-400">背面渲染代码</label>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => {
                                    const prompt = generateBack({
                                      requirement: String(comp.data.renderRequirement || '生成背面样式'),
                                    });
                                    navigator.clipboard.writeText(prompt);
                                  }}
                                  className="px-1.5 py-0.5 bg-purple-600 hover:bg-purple-500 rounded text-[10px]"
                                >
                                  复制提示词
                                </button>
                                <button
                                  onClick={() => updateCompData('backRenderCode', '')}
                                  disabled={!comp.data.backRenderCode}
                                  className="px-1.5 py-0.5 bg-slate-700 hover:bg-slate-600 rounded text-[10px] disabled:opacity-40"
                                >
                                  清空
                                </button>
                              </div>
                            </div>
                            <textarea
                              value={String(comp.data.backRenderCode || '')}
                              readOnly
                              onPaste={e => {
                                e.preventDefault();
                                const text = e.clipboardData.getData('text');
                                if (text.trim()) {
                                  updateCompData('backRenderCode', text);
                                }
                              }}
                              placeholder="(data) => <div>背面</div>"
                              rows={3}
                              className="w-full px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white font-mono text-[10px]"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* 注：点击/拖入交互由引擎层 HandAreaSkeleton 的 onPlayCard/onSellCard 处理，无需额外配置 */}

                  {/* 通用渲染代码配置（render-component 不显示，避免入口重复） */}
                  {comp.type !== 'render-component' && (
                    <div className="space-y-2">
                      <h3 className="text-sm font-medium text-purple-500">渲染代码</h3>
                      <div className="space-y-2 text-xs">
                        <p className="text-slate-500 text-[10px]">
                          通过渲染代码控制组件显示。上下文包含：组件类型、绑定数据、组件输出等
                        </p>
                        <HookField 
                          label="组件渲染" 
                          value={String(comp.data.renderCode || '')} 
                          onChange={v => updateCompData('renderCode', v)} 
                          requirementValue={String(comp.data.renderRequirement || '')}
                          onRequirementChange={v => updateCompData('renderRequirement', v)}
                          schema={currentSchema} 
                          hookType="render" 
                          placeholder="根据上下文数据渲染组件内容" 
                          componentType={comp.type} 
                          outputsSummary={layoutOutputsSummary}
                        />
                      </div>
                    </div>
                  )}

                  {/* 删除组件 */}
                  <button
                    onClick={() => {
                      handleLayoutChange(state.layout.filter(c => c.id !== comp.id));
                      setState(prev => ({ ...prev, selectedComponentId: null }));
                    }}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded text-xs"
                  >
                    <Trash2 className="w-3 h-3" /> 删除组件
                  </button>
                </div>
              );
            })() : (
              <div className="text-slate-500 text-sm text-center py-8">
                拖拽组件到画布后<br/>点击选中查看属性
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 底部状态栏 */}
      <footer className="px-4 py-1 bg-slate-800 border-t border-slate-700 text-xs text-slate-500 flex gap-4 shrink-0">
        <span>Schema: {state.schemas.length}</span>
        <span>数据: {Object.values(state.instances).flat().length}</span>
        <span>布局组件: {state.layout.length}</span>
      </footer>

      {/* ===== 模态框 ===== */}

      {/* 草稿列表模态框 */}
      <Modal open={activeModal === 'project-list'} onClose={() => setActiveModal(null)} title="云端草稿" width="max-w-3xl">
        <div className="space-y-4">
          {!token ? (
            <div className="text-sm text-slate-400">请先登录后管理草稿。</div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div className="text-xs text-slate-400">共 {builderProjects.length} 个草稿</div>
                <div className="flex gap-2">
                  <button
                    onClick={() => refreshBuilderProjects()}
                    className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded text-xs"
                  >
                    刷新
                  </button>
                  <button
                    onClick={handleCreateProjectFromCurrent}
                    className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 rounded text-xs"
                  >
                    以当前内容创建
                  </button>
                </div>
              </div>
              {isProjectLoading ? (
                <div className="text-sm text-slate-500">草稿加载中...</div>
              ) : builderProjects.length === 0 ? (
                <div className="text-sm text-slate-500">暂无云端草稿。</div>
              ) : (
                <div className="space-y-2">
                  {builderProjects.map(project => (
                    <div key={project.projectId} className="flex items-center justify-between p-3 bg-slate-800 rounded">
                      <div>
                        <div className="text-sm text-white">{project.name || '未命名草稿'}</div>
                        <div className="text-xs text-slate-500">最后更新：{formatProjectDate(project.updatedAt || project.createdAt)}</div>
                        {project.description ? (
                          <div className="text-xs text-slate-400 mt-1">{project.description}</div>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleLoadProject(project.projectId)}
                          className="px-3 py-1.5 bg-green-600 hover:bg-green-500 rounded text-xs"
                        >
                          打开
                        </button>
                        <button
                          onClick={() => handleDeleteProject(project.projectId)}
                          className="px-3 py-1.5 bg-red-600 hover:bg-red-500 rounded text-xs"
                        >
                          删除
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </Modal>

      {/* Schema 编辑模态框 */}
      <Modal open={activeModal === 'schema'} onClose={() => setActiveModal(null)} title="Schema 编辑">
        {currentSchema && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-slate-400">名称</label>
                <input
                  type="text"
                  value={currentSchema.name}
                  onChange={e => handleSchemaChange(currentSchema.id, { name: e.target.value })}
                  className="w-full mt-1 px-3 py-2 bg-slate-700 border border-slate-600 rounded text-sm text-white"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400">ID</label>
                <input type="text" value={currentSchema.id} disabled className="w-full mt-1 px-3 py-2 bg-slate-900 border border-slate-700 rounded text-sm text-slate-500" />
              </div>
            </div>
            <div>
              <label className="text-xs text-slate-400">默认渲染模板</label>
              <select
                value={String(currentSchema.defaultRenderComponentId || '')}
                onChange={e => handleSchemaChange(currentSchema.id, { defaultRenderComponentId: e.target.value || undefined })}
                className="w-full mt-1 px-3 py-2 bg-slate-700 border border-slate-600 rounded text-sm text-white"
              >
                <option value="">不设置</option>
                {state.renderComponents
                  .filter(rc => rc.targetSchema === currentSchema.id)
                  .map(rc => (
                    <option key={rc.id} value={rc.id}>{rc.name}</option>
                  ))}
              </select>
            </div>
            {/* 可用标签管理 */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs text-slate-400">
                  可用标签 ({currentSchema.tagDefinitions?.length || 0})
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setAiGenType('batch-tags');
                      setAiGenInput('');
                      setActiveModal('ai-gen');
                    }}
                    className="text-xs text-purple-500 hover:text-purple-400"
                  >
                    AI生成
                  </button>
                  <button
                    onClick={() => setActiveModal('tag-manager')}
                    className="text-xs text-cyan-500 hover:text-cyan-400"
                  >
                    管理标签
                  </button>
                </div>
              </div>
              {/* 按分组显示标签 */}
              {(() => {
                const tags = normalizeTags(currentSchema);
                const groups = [...new Set(tags.map(t => t.group || '未分组'))];
                return groups.length > 0 ? (
                  <div className="space-y-2">
                    {groups.map(group => (
                      <div key={group}>
                        <div className="text-[10px] text-slate-500 mb-1">{group}</div>
                        <div className="flex flex-wrap gap-1">
                          {tags.filter(t => (t.group || '未分组') === group).map((tag, idx) => (
                            <span 
                              key={`${tag.name}-${idx}`} 
                              className="px-2 py-0.5 bg-cyan-900 text-cyan-300 rounded text-xs cursor-pointer hover:bg-cyan-800"
                              onClick={() => {
                                setEditingTagIndex(tags.findIndex(t => t.name === tag.name));
                                setNewTagName(tag.name);
                                setNewTagGroup(tag.group || '');
                                setActiveModal('tag-manager');
                              }}
                            >
                              {tag.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <span className="text-xs text-slate-500">暂无标签，点击上方管理或AI生成</span>
                );
              })()}
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs text-slate-400">字段 ({Object.keys(currentSchema.fields).length})</label>
                <button
                  onClick={() => {
                    const key = `field_${Date.now()}`;
                    handleAddField(currentSchema.id, key, field.string('新字段'));
                  }}
                  className="text-xs text-amber-500 hover:text-amber-400"
                >
                  + 添加字段
                </button>
              </div>
              <div className="space-y-2">
                {Object.entries(currentSchema.fields).map(([key, f]) => (
                  <div key={key} className="px-3 py-2 bg-slate-700 rounded text-sm space-y-2">
                    <div className="flex items-center gap-2">
                      <GripVertical className="w-4 h-4 text-slate-500 cursor-grab" />
                      <input
                        type="text"
                        value={f.label}
                        onChange={e => handleUpdateField(currentSchema.id, key, { label: e.target.value })}
                        className="flex-1 px-2 py-1 bg-slate-600 border border-slate-500 rounded text-white text-sm"
                        placeholder="字段名称"
                      />
                      <select
                        value={f.type}
                        onChange={e => handleChangeFieldType(currentSchema.id, key, e.target.value)}
                        className="px-2 py-1 bg-slate-600 border border-slate-500 rounded text-white text-sm"
                      >
                        <option value="string">文本</option>
                        <option value="number">数字</option>
                        <option value="boolean">布尔</option>
                        <option value="sfxKey">音效</option>
                        <option value="array">标签</option>
                        <option value="abilities">能力 (GAS)</option>
                        <option value="renderComponent">渲染组件</option>
                      </select>
                      {f.aiGenerated && <span className="px-1.5 py-0.5 bg-purple-600 text-[10px] rounded">AI</span>}
                      <button
                        onClick={() => handleDeleteField(currentSchema.id, key)}
                        className="p-1 text-slate-400 hover:text-red-400"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    {/* 渲染组件选择（当类型为renderComponent时显示默认值选择） */}
                    {(f.type as string) === 'renderComponent' && (
                      <div className="flex items-center gap-2 ml-6">
                        <span className="text-xs text-slate-400">默认组件:</span>
                        <select
                          value={String(f.default || '')}
                          onChange={e => handleUpdateField(currentSchema.id, key, { 
                            default: e.target.value || undefined 
                          })}
                          className="flex-1 px-2 py-1 bg-slate-600 border border-slate-500 rounded text-white text-xs"
                        >
                          <option value="">无默认值</option>
                          {renderComponentInstances.map(rc => (
                            <option key={rc.id} value={rc.id}>{rc.name}</option>
                          ))}
                        </select>
                      </div>
                    )}
                    {/* 其他类型的默认值设置 */}
                    {f.type === 'string' && (
                      <div className="flex items-center gap-2 ml-6">
                        <span className="text-xs text-slate-400">默认值:</span>
                        <input
                          type="text"
                          value={String(f.default || '')}
                          onChange={e => handleUpdateField(currentSchema.id, key, { default: e.target.value || undefined })}
                          placeholder="无默认值"
                          className="flex-1 px-2 py-1 bg-slate-600 border border-slate-500 rounded text-white text-xs"
                        />
                      </div>
                    )}
                    {f.type === 'array' && (
                      <div className="flex items-center gap-2 ml-6">
                        <span className="text-xs text-slate-400">默认标签:</span>
                        <input
                          type="text"
                          value={Array.isArray(f.default) ? f.default.join(', ') : ''}
                          onChange={e => handleUpdateField(currentSchema.id, key, { 
                            default: e.target.value ? e.target.value.split(',').map(s => s.trim()) : undefined 
                          })}
                          placeholder="用逗号分隔"
                          className="flex-1 px-2 py-1 bg-slate-600 border border-slate-500 rounded text-white text-xs"
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* 数据编辑模态框 */}
      <Modal open={activeModal === 'data'} onClose={() => setActiveModal(null)} title="数据管理" width="max-w-5xl">
        <div className="space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-slate-400">Schema:</span>
            {state.schemas.map(s => (
              <button
                key={s.id}
                onClick={() => setState(prev => ({ ...prev, selectedSchemaId: s.id }))}
                className={`px-2 py-1 rounded text-xs ${state.selectedSchemaId === s.id ? 'bg-amber-600' : 'bg-slate-700 hover:bg-slate-600'}`}
              >
                {s.name} ({state.instances[s.id]?.length || 0})
              </button>
            ))}
            <div className="ml-auto flex gap-2">
              <button 
                onClick={() => { setAiGenType('batch-data'); setAiGenInput(''); setActiveModal('ai-gen'); }}
                className="px-2 py-1 bg-purple-600 hover:bg-purple-500 rounded text-xs flex items-center gap-1"
              >
                <Sparkles className="w-3 h-3" /> AI批量生成
              </button>
              <button onClick={handleAddInstance} className="px-2 py-1 bg-green-600 hover:bg-green-500 rounded text-xs">
                + 添加数据
              </button>
            </div>
          </div>
          {currentSchema && (
            <DataTable
              schema={currentSchema}
              data={currentInstances}
              onChange={items => handleInstanceChange(currentSchema.id, items)}
              onRowDoubleClick={handleEditItem}
              availableTags={normalizeTags(currentSchema)}
              availableRenderComponents={renderComponentInstances}
              className="max-h-[60vh]"
            />
          )}
        </div>
      </Modal>

      {/* 规则生成模态框 */}
      <Modal open={activeModal === 'rules'} onClose={() => setActiveModal(null)} title="AI 规则生成" width="max-w-5xl">
        <div className="flex gap-4 h-[60vh]">
          <div className="w-64 shrink-0 space-y-3">
            <button
              onClick={handleGenerateFullRules}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-purple-600 hover:bg-purple-500 rounded text-sm"
            >
              <Sparkles className="w-4 h-4" /> 完整规则
            </button>
            <div>
              <label className="text-xs text-slate-400 block mb-1">需求描述（可选，保存到配置）</label>
              <textarea
                value={state.requirements.rawText}
                onChange={e => setState(prev => ({
                  ...prev,
                  requirements: {
                    ...prev.requirements,
                    rawText: e.target.value,
                  },
                }))}
                placeholder="描述胜利条件、回合流程、特殊规则等"
                className="w-full h-32 px-2 py-1 bg-slate-800 border border-slate-700 rounded text-xs text-slate-200 resize-none"
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">结构化需求</span>
                <button
                  onClick={handleAddRequirementEntry}
                  className="px-2 py-0.5 bg-slate-700 hover:bg-slate-600 rounded text-[10px]"
                >
                  + 添加条目
                </button>
              </div>
              {state.requirements.entries.length === 0 ? (
                <div className="text-[10px] text-slate-500">暂无条目，可用于记录具体位置的需求。</div>
              ) : (
                <div className="space-y-2">
                  {state.requirements.entries.map((entry, index) => (
                    <div key={entry.id} className="p-2 rounded border border-slate-700 bg-slate-900/40 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-slate-400">条目 {index + 1}</span>
                        <button
                          onClick={() => handleRemoveRequirementEntry(entry.id)}
                          className="text-[10px] text-red-400 hover:text-red-300"
                        >
                          删除
                        </button>
                      </div>
                      <input
                        type="text"
                        value={entry.location}
                        onChange={e => handleUpdateRequirementEntry(entry.id, { location: e.target.value })}
                        placeholder="需求位置（如：手牌区/排序）"
                        className="w-full px-2 py-1 bg-slate-800 border border-slate-700 rounded text-xs text-slate-200"
                      />
                      <textarea
                        value={entry.content}
                        onChange={e => handleUpdateRequirementEntry(entry.id, { content: e.target.value })}
                        placeholder="需求内容"
                        className="w-full h-16 px-2 py-1 bg-slate-800 border border-slate-700 rounded text-xs text-slate-200 resize-none"
                      />
                      <input
                        type="text"
                        value={entry.notes || ''}
                        onChange={e => handleUpdateRequirementEntry(entry.id, { notes: e.target.value || undefined })}
                        placeholder="备注（可选）"
                        className="w-full px-2 py-1 bg-slate-800 border border-slate-700 rounded text-xs text-slate-200"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="flex-1 flex flex-col border-l border-slate-700 pl-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-400">提示词 ({promptOutput.length} 字符)</span>
              <button
                onClick={() => navigator.clipboard.writeText(promptOutput)}
                className="px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded text-xs"
              >
                <Copy className="w-3 h-3 inline mr-1" /> 复制
              </button>
            </div>
            <pre className="flex-1 p-3 bg-slate-900 rounded overflow-auto text-xs text-slate-300 font-mono whitespace-pre-wrap">
              {promptOutput || '点击生成规则提示词'}
            </pre>
            <div className="mt-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-slate-400">粘贴 AI 生成的规则代码</span>
                <div className="flex items-center gap-2">
                  {state.rulesCode && (
                    <button
                      onClick={() => navigator.clipboard.writeText(String(state.rulesCode))}
                      className="px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded text-xs"
                    >
                      <Copy className="w-3 h-3 inline mr-1" /> 复制代码
                    </button>
                  )}
                  <button
                    onClick={() => setState(prev => ({ ...prev, rulesCode: '' }))}
                    disabled={!state.rulesCode}
                    className="px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded text-xs disabled:opacity-40"
                  >
                    清空
                  </button>
                </div>
              </div>
              <textarea
                value={String(state.rulesCode || '')}
                readOnly
                onPaste={e => {
                  e.preventDefault();
                  const text = e.clipboardData.getData('text');
                  if (text.trim()) {
                    setState(prev => ({ ...prev, rulesCode: text }));
                  }
                }}
                placeholder="粘贴 AI 生成的规则代码"
                className="w-full h-32 px-3 py-2 bg-slate-900 border border-slate-700 rounded text-xs text-slate-300 font-mono resize-none"
              />
            </div>
          </div>
        </div>
      </Modal>

      {/* 数据项编辑模态框 */}
      <Modal open={activeModal === 'edit-item'} onClose={() => { setActiveModal('data'); setEditingItem(null); }} title="编辑数据">
        {editingItem && currentSchema && (
          <div className="space-y-4">
            {Object.entries(currentSchema.fields).map(([key, f]) => (
              <div key={key}>
                <label className="text-xs text-slate-400">{f.label}</label>
                {f.type === 'boolean' ? (
                  <div className="mt-1">
                    <input
                      type="checkbox"
                      checked={Boolean(editingItem[key])}
                      onChange={e => handleEditItemField(key, e.target.checked)}
                      className="rounded border-slate-500"
                    />
                  </div>
                ) : f.type === 'number' ? (
                  <input
                    type="number"
                    value={Number(editingItem[key]) || 0}
                    onChange={e => handleEditItemField(key, Number(e.target.value))}
                    className="w-full mt-1 px-3 py-2 bg-slate-700 border border-slate-600 rounded text-sm text-white"
                  />
                ) : f.type === 'array' && 'tagEditor' in f ? (
                  /* 标签字段 - 多级下拉（按分组） */
                  <div className="mt-1 space-y-1">
                    <div className="flex flex-wrap gap-1">
                      {(Array.isArray(editingItem[key]) ? editingItem[key] as string[] : []).map((tag: string) => (
                        <span key={tag} className="px-2 py-0.5 bg-cyan-900 text-cyan-300 rounded text-xs flex items-center gap-1">
                          {tag}
                          <button
                            onClick={() => handleEditItemField(key, (editingItem[key] as string[]).filter(t => t !== tag))}
                            className="text-cyan-400 hover:text-red-400"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                    {/* 多级下拉：按分组显示 */}
                    {(() => {
                      const tags = normalizeTags(currentSchema);
                      const groups = [...new Set(tags.map(t => t.group || '未分组'))];
                      const selectedTags = Array.isArray(editingItem[key]) ? editingItem[key] as string[] : [];
                      
                      return (
                        <select
                          value=""
                          onChange={e => {
                            if (e.target.value) {
                              if (!selectedTags.includes(e.target.value)) {
                                handleEditItemField(key, [...selectedTags, e.target.value]);
                              }
                            }
                          }}
                          className="w-full px-2 py-1 bg-slate-700 border border-slate-600 rounded text-sm text-white"
                        >
                          <option value="">+ 添加标签</option>
                          {groups.map(group => (
                            <optgroup key={group} label={group}>
                              {tags
                                .filter(t => (t.group || '未分组') === group)
                                .filter(t => !selectedTags.includes(t.name))
                                .map(t => (
                                  <option key={t.name} value={t.name}>{t.name}</option>
                                ))}
                            </optgroup>
                          ))}
                        </select>
                      );
                    })()}
                  </div>
                ) : (f.type as string) === 'renderComponent' || key === 'renderComponentId' ? (
                  /* 渲染组件字段 - 单选下拉 */
                  <select
                    value={String(editingItem[key] ?? '')}
                    onChange={e => handleEditItemField(key, e.target.value || undefined)}
                    className="w-full mt-1 px-3 py-2 bg-slate-700 border border-slate-600 rounded text-sm text-white"
                  >
                    <option value="">无</option>
                    {state.renderComponents.map(rc => (
                      <option key={rc.id} value={rc.id}>{rc.name}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={String(editingItem[key] ?? '')}
                    onChange={e => handleEditItemField(key, e.target.value)}
                    className="w-full mt-1 px-3 py-2 bg-slate-700 border border-slate-600 rounded text-sm text-white"
                  />
                )}
              </div>
            ))}
            <div className="flex justify-end gap-2 pt-4">
              <button
                onClick={() => { setActiveModal('data'); setEditingItem(null); }}
                className="px-4 py-2 bg-slate-600 hover:bg-slate-500 rounded text-sm"
              >
                取消
              </button>
              <button
                onClick={handleSaveEditItem}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-500 rounded text-sm"
              >
                保存
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* AI 生成模态框 */}
      <Modal open={activeModal === 'ai-gen'} onClose={() => { setActiveModal('data'); setAiGenType(null); }} title="AI 批量生成" width="max-w-4xl">
        <div className="space-y-4">
          {/* 生成类型选择 */}
          <div className="flex gap-2">
            <button
              onClick={() => {
                setAiGenType('batch-data');
                setAbilityImportErrors([]);
              }}
              className={`px-3 py-2 rounded text-sm ${aiGenType === 'batch-data' ? 'bg-purple-600' : 'bg-slate-700 hover:bg-slate-600'}`}
            >
              批量数据
            </button>
            <button
              onClick={() => {
                setAiGenType('batch-tags');
                setAbilityImportErrors([]);
              }}
              className={`px-3 py-2 rounded text-sm ${aiGenType === 'batch-tags' ? 'bg-purple-600' : 'bg-slate-700 hover:bg-slate-600'}`}
            >
              批量 Tag
            </button>
            <button
              onClick={() => {
                setAiGenType('ability-field');
                setAbilityImportErrors([]);
              }}
              className={`px-3 py-2 rounded text-sm ${aiGenType === 'ability-field' ? 'bg-purple-600' : 'bg-slate-700 hover:bg-slate-600'}`}
            >
              能力块 (GAS)
            </button>
          </div>

          {/* 需求输入 */}
          <div>
            <label className="text-xs text-slate-400 block mb-1">
              {aiGenType === 'batch-data' && '描述数据需求（如：生成多类实体，包含名称/数值/状态等属性）'}
              {aiGenType === 'batch-tags' && '描述 Tag 需求（如：分类/阵营/稀有度等标签）'}
              {aiGenType === 'ability-field' && '描述能力需求（如：选择目标后转移资源；属性为0则触发死亡）'}
              {!aiGenType && '请先选择生成类型'}
            </label>
            <textarea
              value={aiGenInput}
              onChange={e => setAiGenInput(e.target.value)}
              placeholder="输入你的需求描述..."
              className="w-full h-24 px-3 py-2 bg-slate-700 border border-slate-600 rounded text-sm text-white resize-none"
              disabled={!aiGenType}
            />
          </div>

          {/* 生成的提示词 */}
          {aiGenInput && aiGenType && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-slate-400">生成的提示词</label>
                <button
                  onClick={() => {
                    const prompt = generateAIPrompt(aiGenType, currentSchema, state);
                    navigator.clipboard.writeText(prompt);
                  }}
                  className="px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded text-xs"
                >
                  <Copy className="w-3 h-3 inline mr-1" /> 复制
                </button>
              </div>
              <pre className="p-3 bg-slate-900 rounded text-xs text-slate-300 font-mono whitespace-pre-wrap max-h-48 overflow-auto">
                {generateAIPrompt(aiGenType, currentSchema, state)}
              </pre>
            </div>
          )}

          {/* 导入区域 */}
          <div>
            <label className="text-xs text-slate-400 block mb-1">
              {aiGenType === 'batch-tags' ? '粘贴 AI 生成的标签 JSON' : aiGenType === 'ability-field' ? '粘贴 AI 生成的能力块 JSON' : '粘贴 AI 生成的 JSON 数据'}
            </label>
            <textarea
              placeholder={aiGenType === 'batch-tags' 
                ? '[{"name": "分类A", "group": "分类"}, {"name": "状态A", "group": "状态"}]' 
                : aiGenType === 'ability-field'
                  ? '[{"id": "entity-1", "abilities": [{"id": "ability-1", "name": "能力名称", "trigger": {"type": "always"}, "effects": [{"id": "effect-1", "operations": [{"type": "modifyAttribute", "target": "target", "attrId": "attributeA", "value": -1}]}]}]}]'
                  : '[{"id": "entity-1", "name": "实体A", ...}]'}
              className="w-full h-24 px-3 py-2 bg-slate-700 border border-slate-600 rounded text-sm text-white font-mono resize-none"
              onPaste={e => {
                try {
                  const text = e.clipboardData.getData('text');
                  const data = JSON.parse(text);
                  if (Array.isArray(data) && currentSchema) {
                    if (aiGenType === 'batch-tags') {
                      setAbilityImportErrors([]);
                      // 导入标签
                      const existingTags = normalizeTags(currentSchema);
                      const newTags = data.filter((t: { name: string }) => 
                        !existingTags.some(et => et.name === t.name)
                      );
                      handleSchemaChange(currentSchema.id, { 
                        tagDefinitions: [...existingTags, ...newTags]
                      });
                      setActiveModal('schema');
                    } else if (aiGenType === 'ability-field') {
                      const validation = validateAbilityJson(data);
                      if (!validation.isValid) {
                        setAbilityImportErrors(validation.errors);
                        return;
                      }
                      setAbilityImportErrors([]);
                      const updatesById = new Map(
                        data.map((item: Record<string, unknown>) => [String(item.id || ''), item])
                      );
                      const nextInstances = currentInstances.map(item => {
                        const key = String(item.id || '');
                        const update = updatesById.get(key) as Record<string, unknown> | undefined;
                        if (!update) return item;
                        const next: Record<string, unknown> = { ...item };
                        if (Array.isArray(update.abilities)) {
                          next.abilities = update.abilities;
                        }
                        return next;
                      });
                      handleInstanceChange(currentSchema.id, nextInstances);
                      setActiveModal('data');
                    } else {
                      setAbilityImportErrors([]);
                      // 导入数据
                      handleInstanceChange(currentSchema.id, [...currentInstances, ...data]);
                      setActiveModal('data');
                    }
                    setAiGenType(null);
                  }
                } catch {
                  if (aiGenType === 'ability-field') {
                    setAbilityImportErrors(['JSON 解析失败：请确认粘贴内容是有效的 JSON 数组']);
                  }
                }
              }}
            />
            <p className="text-xs text-slate-500 mt-1">粘贴后自动导入</p>
            {abilityImportErrors.length > 0 && (
              <div className="mt-2 rounded border border-red-500/50 bg-red-900/20 p-2 text-xs text-red-200">
                <div className="font-semibold mb-1">能力 JSON 校验失败</div>
                <ul className="list-disc pl-4 space-y-0.5">
                  {abilityImportErrors.slice(0, 6).map((err, index) => (
                    <li key={`${err}-${index}`}>{err}</li>
                  ))}
                </ul>
                {abilityImportErrors.length > 6 && (
                  <div className="mt-1 text-red-300">还有 {abilityImportErrors.length - 6} 条错误</div>
                )}
              </div>
            )}
          </div>
        </div>
      </Modal>

      {/* Schema 模板选择模态框 */}
      <Modal open={schemaTemplateModal} onClose={() => setSchemaTemplateModal(false)} title="选择 Schema 模板">
        <div className="grid grid-cols-3 gap-4">
          {(Object.entries(SCHEMA_TEMPLATES) as [keyof typeof SCHEMA_TEMPLATES, typeof SCHEMA_TEMPLATES[keyof typeof SCHEMA_TEMPLATES]][]).map(([key, tpl]) => (
            <button
              key={key}
              onClick={() => handleAddSchemaWithTemplate(key)}
              className="p-4 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-600 hover:border-amber-500 text-left transition-colors"
            >
              <div className="text-sm font-medium">{tpl.name}</div>
              <div className="text-xs text-slate-400 mt-1">{tpl.description}</div>
              <div className="text-xs text-slate-500 mt-2">
                {Object.keys(tpl.fields).length} 个预设字段
              </div>
            </button>
          ))}
        </div>
      </Modal>

      {/* 渲染组件编辑模态框 */}
      <Modal open={activeModal === 'render-template'} onClose={() => setActiveModal(null)} title="编辑渲染代码" width="max-w-4xl">
        <RenderComponentManager
          components={state.renderComponents}
          schemas={state.schemas}
          onChange={components => setState(prev => ({ ...prev, renderComponents: components }))}
          selectedId={(() => {
            const comp = state.layout.find(c => c.id === state.selectedComponentId);
            return comp?.data.renderComponentId as string | undefined;
          })()}
        />
      </Modal>

      {/* 标签管理模态框 */}
      <Modal 
        open={activeModal === 'tag-manager'} 
        onClose={() => { 
          setActiveModal('schema'); 
          setEditingTagIndex(null); 
          setNewTagName(''); 
          setNewTagGroup(''); 
        }} 
        title="标签管理"
        width="max-w-2xl"
      >
        {currentSchema && (
          <div className="space-y-4">
            {/* 添加/编辑标签 */}
            <div className="p-3 bg-slate-800 rounded space-y-3">
              <div className="text-sm font-medium">{editingTagIndex !== null ? '编辑标签' : '添加标签'}</div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400">标签名称</label>
                  <input
                    type="text"
                    value={newTagName}
                    onChange={e => setNewTagName(e.target.value)}
                    placeholder="如：稀有、普通、传说"
                    className="w-full mt-1 px-3 py-2 bg-slate-700 border border-slate-600 rounded text-sm text-white"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400">所属分组（可选）</label>
                  <input
                    type="text"
                    value={newTagGroup}
                    onChange={e => setNewTagGroup(e.target.value)}
                    placeholder="如：稀有度、花色、类型"
                    className="w-full mt-1 px-3 py-2 bg-slate-700 border border-slate-600 rounded text-sm text-white"
                    list="tag-groups"
                  />
                  <datalist id="tag-groups">
                    {[...new Set(normalizeTags(currentSchema).map(t => t.group).filter(Boolean))].map(group => (
                      <option key={group} value={group} />
                    ))}
                  </datalist>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    if (!newTagName.trim()) return;
                    const tags = normalizeTags(currentSchema);
                    
                    if (editingTagIndex !== null) {
                      const updated = [...tags];
                      updated[editingTagIndex] = { name: newTagName.trim(), group: newTagGroup.trim() || undefined };
                      handleSchemaChange(currentSchema.id, { tagDefinitions: updated });
                    } else {
                      if (tags.some(t => t.name === newTagName.trim())) return;
                      handleSchemaChange(currentSchema.id, { 
                        tagDefinitions: [...tags, { name: newTagName.trim(), group: newTagGroup.trim() || undefined }]
                      });
                    }
                    setNewTagName('');
                    setNewTagGroup('');
                    setEditingTagIndex(null);
                  }}
                  disabled={!newTagName.trim()}
                  className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 disabled:bg-slate-600 rounded text-sm"
                >
                  {editingTagIndex !== null ? '保存修改' : '添加'}
                </button>
                {editingTagIndex !== null && (
                  <button
                    onClick={() => {
                      const tags = normalizeTags(currentSchema);
                      const updated = tags.reduce<TagDefinition[]>((acc, tag, index) => {
                        if (index === editingTagIndex) return acc;
                        acc.push(tag);
                        return acc;
                      }, []);
                      handleSchemaChange(currentSchema.id, { tagDefinitions: updated });
                      setEditingTagIndex(null);
                      setNewTagName('');
                      setNewTagGroup('');
                    }}
                    className="px-3 py-1.5 bg-red-600 hover:bg-red-500 rounded text-sm"
                  >
                    删除
                  </button>
                )}
                {editingTagIndex !== null && (
                  <button
                    onClick={() => {
                      setEditingTagIndex(null);
                      setNewTagName('');
                      setNewTagGroup('');
                    }}
                    className="px-3 py-1.5 bg-slate-600 hover:bg-slate-500 rounded text-sm"
                  >
                    取消
                  </button>
                )}
              </div>
            </div>

            {/* 现有标签列表（按分组） */}
            <div>
              <div className="text-sm font-medium mb-2">现有标签</div>
              {(() => {
                const tags = normalizeTags(currentSchema);
                const groups = [...new Set(tags.map(t => t.group || '未分组'))];
                
                return groups.length > 0 ? (
                  <div className="space-y-3">
                    {groups.map(group => (
                      <div key={group} className="p-2 bg-slate-800 rounded">
                        <div className="text-xs text-slate-500 mb-2">{group}</div>
                        <div className="flex flex-wrap gap-1">
                          {tags.filter(t => (t.group || '未分组') === group).map((tag, idx) => {
                            const globalIdx = tags.findIndex(t => t.name === tag.name);
                            return (
                              <span 
                                key={`${tag.name}-${idx}`}
                                onClick={() => {
                                  setEditingTagIndex(globalIdx);
                                  setNewTagName(tag.name);
                                  setNewTagGroup(tag.group || '');
                                }}
                                className={`px-2 py-1 rounded text-xs cursor-pointer transition-colors ${
                                  editingTagIndex === globalIdx 
                                    ? 'bg-cyan-600 text-white' 
                                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                                }`}
                              >
                                {tag.name}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-slate-500">暂无标签</div>
                );
              })()}
            </div>

            {/* AI批量生成提示 */}
            <div className="p-3 bg-purple-900/30 border border-purple-700/50 rounded">
              <div className="text-xs text-purple-300">
                💡 使用 AI 批量生成：点击 Schema 编辑中的「AI生成」按钮，描述你需要的标签（如：扑克牌的四种花色、13种点数、大小王等）
              </div>
            </div>
          </div>
        )}
      </Modal>

    </div>
  );
}

// 渲染组件管理组件
function RenderComponentManager({
  components,
  schemas,
  onChange,
  selectedId,
}: {
  components: RenderComponent[];
  schemas: SchemaDefinition[];
  onChange: (components: RenderComponent[]) => void;
  selectedId?: string;
}) {
  const [editing, setEditing] = useState<RenderComponent | null>(() => {
    if (selectedId) {
      return components.find(c => c.id === selectedId) || null;
    }
    return null;
  });
  const [requirement, setRequirement] = useState('');

  // 使用渲染组件专用的提示词生成器
  const { generateFront, generateBack } = useRenderPrompt();

  const sanitizeRenderCode = useCallback((text: string) => {
    const trimmed = text.trim();
    const duplicateMatch = trimmed.match(/\n\s*\(data[^)]*\)\s*=>/);
    if (duplicateMatch && typeof duplicateMatch.index === 'number') {
      return trimmed.slice(0, duplicateMatch.index).trim();
    }
    return trimmed;
  }, []);

  const handleAdd = () => {
    setEditing({
      id: `rc-${Date.now()}`,
      name: '新渲染组件',
      targetSchema: schemas[0]?.id || '',
      renderCode: '',
      description: '',
    });
  };

  const handleSave = () => {
    if (!editing) return;
    const exists = components.find(c => c.id === editing.id);
    if (exists) {
      onChange(components.map(c => c.id === editing.id ? editing : c));
    } else {
      onChange([...components, editing]);
    }
    setEditing(null);
  };

  const handleDelete = (id: string) => {
    onChange(components.filter(c => c.id !== id));
  };

  const targetSchema = schemas.find(s => s.id === editing?.targetSchema);

  // 使用渲染组件专用的提示词生成器
  const generatePrompt = () => generateFront({
    requirement: requirement || '显示数据的基本信息',
    schema: targetSchema,
  });
  
  const generateBackPrompt = () => generateBack({
    requirement: requirement || '生成背面样式',
  });

  return (
    <div className="space-y-4">
      {!editing ? (
        <>
          <div className="flex justify-between items-center">
            <p className="text-sm text-slate-400">制作渲染组件，AI根据数据结构生成显示代码</p>
            <button onClick={handleAdd} className="px-3 py-1.5 bg-green-600 hover:bg-green-500 rounded text-sm">
              + 新建组件
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {components.map(c => (
              <div key={c.id} className="p-3 bg-slate-800 rounded border border-slate-600">
                <div className="flex justify-between items-start">
                  <div className="flex-1 mr-2">
                    <div className="font-medium">{c.name}</div>
                    {/* 直接在列表中更新 targetSchema */}
                    <div className="flex items-center gap-1 mt-1">
                      <span className="text-xs text-slate-400">适用:</span>
                      <select
                        value={schemas.find(s => s.id === c.targetSchema) ? c.targetSchema : ''}
                        onChange={e => {
                          const updated = components.map(comp => 
                            comp.id === c.id ? { ...comp, targetSchema: e.target.value } : comp
                          );
                          onChange(updated);
                        }}
                        className={`px-1 py-0.5 bg-slate-700 border rounded text-xs text-white ${
                          !schemas.find(s => s.id === c.targetSchema) ? 'border-red-500' : 'border-slate-600'
                        }`}
                      >
                        <option value="">选择 Schema</option>
                        {schemas.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => setEditing(c)} className="px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded text-xs">编辑</button>
                    <button onClick={() => handleDelete(c.id)} className="px-2 py-1 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded text-xs">删除</button>
                  </div>
                </div>
              </div>
            ))}
            {components.length === 0 && <div className="col-span-2 text-center text-slate-500 py-8">暂无渲染组件，点击“新建组件”创建</div>}
          </div>
        </>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-slate-400">组件名称</label>
              <input
                type="text"
                value={editing.name}
                onChange={e => setEditing({ ...editing, name: e.target.value })}
                className="w-full px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400">适用 Schema</label>
              <select
                value={editing.targetSchema}
                onChange={e => setEditing({ ...editing, targetSchema: e.target.value })}
                className="w-full px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white"
              >
                {schemas.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-400">输入需求描述</label>
            <input
              type="text"
              value={requirement}
              onChange={e => setRequirement(e.target.value)}
              placeholder="如：显示图标和属性信息"
              className="w-full px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-slate-400">正面渲染结果（粘贴导入）</label>
                <button
                  onClick={() => navigator.clipboard.writeText(generatePrompt())}
                  className="px-1.5 py-0.5 bg-purple-600 hover:bg-purple-500 rounded text-[10px]"
                >
                  复制正面提示词
                </button>
              </div>
              <textarea
                value={editing.renderCode}
                onPaste={e => {
                  e.preventDefault();
                  const text = e.clipboardData.getData('text');
                  if (text.trim()) {
                    const sanitized = sanitizeRenderCode(text);
                    setEditing({ ...editing, renderCode: sanitized });
                  }
                }}
                readOnly
                placeholder="粘贴AI生成结果"
                className="w-full h-32 px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white font-mono text-xs resize-none"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-slate-400">背面渲染结果（粘贴导入）</label>
                <button
                  onClick={() => navigator.clipboard.writeText(generateBackPrompt())}
                  className="px-1.5 py-0.5 bg-purple-600 hover:bg-purple-500 rounded text-[10px]"
                >
                  复制背面提示词
                </button>
              </div>
              <textarea
                value={editing.backRenderCode || ''}
                onPaste={e => {
                  e.preventDefault();
                  const text = e.clipboardData.getData('text');
                  if (text.trim()) {
                    const sanitized = sanitizeRenderCode(text);
                    setEditing({ ...editing, backRenderCode: sanitized });
                  }
                }}
                readOnly
                placeholder="粘贴AI生成结果"
                className="w-full h-32 px-2 py-1 bg-slate-700 border border-slate-600 rounded text-white font-mono text-xs resize-none"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setEditing(null)} className="px-3 py-1.5 bg-slate-600 hover:bg-slate-500 rounded text-sm">取消</button>
            <button onClick={handleSave} className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 rounded text-sm">保存</button>
          </div>
        </div>
      )}
    </div>
  );
}

// AI 提示词生成函数 - 包含丰富上下文
function generateAIPrompt(
  type: AIGenType, 
  schema: SchemaDefinition | undefined,
  state: BuilderState
): string {
  if (!type || !schema) return '';
  
  // 构建完整上下文
  const schemaFields = Object.entries(schema.fields)
    .map(([k, f]) => `- ${k}: ${f.type} (${f.label})${f.description ? ` - ${f.description}` : ''}`)
    .join('\n');

  const allSchemas = state.schemas
    .map(s => `- ${s.name} (${s.id}): ${Object.keys(s.fields).length}个字段`)
    .join('\n');

  const renderComponents = state.renderComponents.length > 0
    ? `\n渲染组件: ${state.renderComponents.map(rc => rc.name).join(', ')}`
    : '';

  const gameContext = `## 游戏上下文
游戏名称: ${state.name}
游戏描述: ${state.description || '未设置'}
所有 Schema:
${allSchemas}${renderComponents}`;

  const requirementsText = buildRequirementsText(state.requirements);

  if (type === 'batch-data' || type === 'batch-tags') {
    return generateUnifiedPrompt({
      type,
      requirement: requirementsText,
      schema,
      gameState: {
        name: state.name,
        description: state.description,
        schemas: state.schemas,
        renderComponents: state.renderComponents,
        instances: state.instances,
      },
    });
  }

  if (type === 'ability-field') {
    const attributeCandidates = state.schemas
      .map(s => {
        const fields = Object.entries(s.fields)
          .filter(([, f]) => f.type === 'number')
          .map(([key]) => key);
        return fields.length > 0 ? `- ${s.name} (${s.id}): ${fields.join(', ')}` : null;
      })
      .filter((line): line is string => Boolean(line))
      .join('\n');
    const attributeInfo = attributeCandidates
      ? `\n## 可能的属性/资源字段（可用作 attrId/cost）\n${attributeCandidates}`
      : '\n## 可能的属性/资源字段（可用作 attrId/cost）\n无';

    return `你是一个 GAS 能力数据生成器。请根据需求生成 AbilityDefinition JSON（不是代码）。

${gameContext}

## 目标 Schema: ${schema.name}
字段定义:
${schemaFields}
${attributeInfo}

## 用户需求
${requirementsText}

## GAS 结构要求（必须严格遵守）
- AbilityDefinition 字段: id, name, description?, tags?, trigger?, effects?, variants?, cooldown?, cost?
- trigger/condition 使用 EffectCondition：
  - always / hasTag / attributeCompare / and / or / not
- EffectDefinition 字段: id, name?, description?, operations, condition?
- EffectOperation 类型：
  - modifyAttribute / setAttribute / addTag / removeTag / custom
- TargetRef: self | target | allPlayers | allEnemies | { entityId: string }
- Expression: number | { type: 'attribute', entityId, attrId } | add/subtract/multiply/min/max
- custom 操作使用 actionId + params，自定义逻辑由游戏层实现

## custom actionId 命名规范
- 使用 kebab-case
- 建议以 abilityId 作为前缀，例如 "ability-1-transfer-resource"

${TECH_STACK}

## 输出格式（JSON 数组）
[
  {
    "id": "entity-1",
    "abilities": [
      {
        "id": "ability-1",
        "name": "能力名称",
        "trigger": { "type": "always" },
        "effects": [
          {
            "id": "effect-1",
            "operations": [
              { "type": "modifyAttribute", "target": "target", "attrId": "attributeA", "value": -1 }
            ]
          }
        ]
      }
    ]
  }
]

要求：
1. 只输出纯 JSON，不要 markdown 代码块或解释
2. abilities 为数组，每个元素是 AbilityDefinition
3. trigger/condition 必须使用 EffectCondition 结构，不要使用字符串条件
4. operations 必须是数组，单步也用数组表示`;
  }

  return '';
}
