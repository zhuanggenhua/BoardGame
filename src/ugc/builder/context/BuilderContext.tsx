/**
 * Builder 全局上下文
 * 
 * 提供统一的状态管理和提示词上下文
 */

import { createContext, useContext, useReducer, useMemo, type ReactNode } from 'react';
import type { SchemaDefinition } from '../schema/types';

// ============================================================================
// 类型定义
// ============================================================================

/** 渲染组件定义 */
export interface RenderComponent {
  id: string;
  name: string;
  targetSchema: string;
  renderCode: string;
  backRenderCode?: string;
  description: string;
}

/** 布局分组 */
export interface LayoutGroup {
  id: string;
  name: string;
  hidden: boolean;
}

export interface RequirementEntry {
  id: string;
  location: string;
  content: string;
  notes?: string;
}

export interface RequirementsState {
  rawText: string;
  entries: RequirementEntry[];
}

/** Builder 全局状态 */
export interface BuilderState {
  name: string;
  description: string;
  tags: string[];
  schemas: SchemaDefinition[];
  instances: Record<string, Record<string, unknown>[]>;
  renderComponents: RenderComponent[];
  layout: LayoutComponent[];
  layoutGroups: LayoutGroup[];
  selectedSchemaId: string | null;
  selectedComponentId: string | null;
  rulesCode?: string;
  requirements: RequirementsState;
}

/** 布局组件 */
export interface LayoutComponent {
  id: string;
  type: string;
  anchor: { x: number; y: number };
  pivot: { x: number; y: number };
  offset: { x: number; y: number };
  width: number;
  height: number;
  rotation?: number;
  data: Record<string, unknown>;
  renderComponentId?: string;
}

/** 提示词上下文（从状态派生，只读） */
export interface PromptContext {
  /** 游戏名称 */
  gameName: string;
  /** 游戏描述 */
  gameDescription: string;
  /** 所有 Schema 的摘要 */
  schemasSummary: string[];
  /** 所有标签分组名 */
  allTagGroups: string[];
  /** 按分组分类的具体标签 */
  tagsByGroup: Record<string, string[]>;
  /** 渲染组件列表 */
  renderComponentNames: string[];
}

/** 组件特定上下文（用于特定区域/组件） */
export interface ComponentContext {
  /** 绑定的 Schema */
  schema?: SchemaDefinition;
  /** 绑定的数据 */
  data?: Record<string, unknown>[];
  /** 绑定的渲染组件 */
  renderComponent?: RenderComponent;
}

// ============================================================================
// Actions
// ============================================================================

type BuilderAction =
  | { type: 'SET_NAME'; payload: string }
  | { type: 'SET_DESCRIPTION'; payload: string }
  | { type: 'SET_TAGS'; payload: string[] }
  | { type: 'SET_SCHEMAS'; payload: SchemaDefinition[] }
  | { type: 'UPDATE_SCHEMA'; payload: { id: string; updates: Partial<SchemaDefinition> } }
  | { type: 'SET_INSTANCES'; payload: { schemaId: string; data: Record<string, unknown>[] } }
  | { type: 'SET_RENDER_COMPONENTS'; payload: RenderComponent[] }
  | { type: 'SET_LAYOUT'; payload: LayoutComponent[] }
  | { type: 'SELECT_SCHEMA'; payload: string | null }
  | { type: 'SELECT_COMPONENT'; payload: string | null }
  | { type: 'LOAD_STATE'; payload: Partial<BuilderState> }
  | { type: 'RESET' };

// ============================================================================
// Reducer
// ============================================================================

const initialState: BuilderState = {
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

function builderReducer(state: BuilderState, action: BuilderAction): BuilderState {
  switch (action.type) {
    case 'SET_NAME':
      return { ...state, name: action.payload };
    case 'SET_DESCRIPTION':
      return { ...state, description: action.payload };
    case 'SET_TAGS':
      return { ...state, tags: action.payload };
    case 'SET_SCHEMAS':
      return { ...state, schemas: action.payload };
    case 'UPDATE_SCHEMA':
      return {
        ...state,
        schemas: state.schemas.map(s =>
          s.id === action.payload.id ? { ...s, ...action.payload.updates } : s
        ),
      };
    case 'SET_INSTANCES':
      return {
        ...state,
        instances: { ...state.instances, [action.payload.schemaId]: action.payload.data },
      };
    case 'SET_RENDER_COMPONENTS':
      return { ...state, renderComponents: action.payload };
    case 'SET_LAYOUT':
      return { ...state, layout: action.payload };
    case 'SELECT_SCHEMA':
      return { ...state, selectedSchemaId: action.payload };
    case 'SELECT_COMPONENT':
      return { ...state, selectedComponentId: action.payload };
    case 'LOAD_STATE':
      return { ...state, ...action.payload };
    case 'RESET':
      return initialState;
    default:
      return state;
  }
}

// ============================================================================
// Context
// ============================================================================

interface BuilderContextValue {
  state: BuilderState;
  dispatch: React.Dispatch<BuilderAction>;
  /** 全局提示词上下文（自动派生） */
  promptContext: PromptContext;
  /** 获取特定组件的上下文 */
  getComponentContext: (componentId: string) => ComponentContext;
  /** 获取当前选中 Schema */
  currentSchema: SchemaDefinition | undefined;
  /** 获取当前选中 Schema 的数据 */
  currentInstances: Record<string, unknown>[];
}

const BuilderContext = createContext<BuilderContextValue | null>(null);

// ============================================================================
// Provider
// ============================================================================

export function BuilderProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(builderReducer, initialState);

  // 派生：全局提示词上下文
  const promptContext = useMemo<PromptContext>(() => {
    // 收集所有 Schema 的标签（按分组分类）
    const tagsByGroup: Record<string, string[]> = {};
    state.schemas.forEach(s => {
      s.tagDefinitions?.forEach(t => {
        const group = t.group || '未分组';
        if (!tagsByGroup[group]) tagsByGroup[group] = [];
        if (!tagsByGroup[group].includes(t.name)) {
          tagsByGroup[group].push(t.name);
        }
      });
    });

    return {
      gameName: state.name,
      gameDescription: state.description,
      schemasSummary: state.schemas.map(s => `${s.name} (${Object.keys(s.fields).length}字段)`),
      allTagGroups: Object.keys(tagsByGroup),
      tagsByGroup, // 新增：按分组分类的具体标签
      renderComponentNames: state.renderComponents.map(rc => rc.name),
    };
  }, [state.name, state.description, state.schemas, state.renderComponents]);

  // 派生：当前选中的 Schema
  const currentSchema = useMemo(
    () => state.schemas.find(s => s.id === state.selectedSchemaId),
    [state.schemas, state.selectedSchemaId]
  );

  // 派生：当前选中 Schema 的数据
  const currentInstances = useMemo(
    () => (state.selectedSchemaId ? state.instances[state.selectedSchemaId] || [] : []),
    [state.instances, state.selectedSchemaId]
  );

  // 获取特定组件的上下文
  const getComponentContext = useMemo(() => {
    return (componentId: string): ComponentContext => {
      const comp = state.layout.find(c => c.id === componentId);
      if (!comp) return {};

      const schemaId = comp.data.bindSchema as string | undefined;
      const schema = schemaId ? state.schemas.find(s => s.id === schemaId) : undefined;
      const data = schemaId ? state.instances[schemaId] : undefined;
      const renderComponent = comp.renderComponentId
        ? state.renderComponents.find(rc => rc.id === comp.renderComponentId)
        : undefined;

      return { schema, data, renderComponent };
    };
  }, [state.layout, state.schemas, state.instances, state.renderComponents]);

  const value = useMemo<BuilderContextValue>(
    () => ({
      state,
      dispatch,
      promptContext,
      getComponentContext,
      currentSchema,
      currentInstances,
    }),
    [state, promptContext, getComponentContext, currentSchema, currentInstances]
  );

  return <BuilderContext.Provider value={value}>{children}</BuilderContext.Provider>;
}

// ============================================================================
// Hook
// ============================================================================

export function useBuilder() {
  const context = useContext(BuilderContext);
  if (!context) {
    throw new Error('useBuilder must be used within a BuilderProvider');
  }
  return context;
}

/** 获取特定组件的上下文 */
export function useComponentContext(componentId: string) {
  const { getComponentContext } = useBuilder();
  return useMemo(() => getComponentContext(componentId), [getComponentContext, componentId]);
}

/** 获取当前提示词生成所需的上下文 */
export function usePromptContext() {
  const { state, currentSchema, promptContext } = useBuilder();
  
  return useMemo(() => ({
    // 游戏级别上下文
    gameName: promptContext.gameName,
    gameDescription: promptContext.gameDescription,
    allTagGroups: promptContext.allTagGroups,
    tagsByGroup: promptContext.tagsByGroup,
    schemasSummary: promptContext.schemasSummary,
    renderComponentNames: promptContext.renderComponentNames,
    
    // 当前 Schema 上下文
    currentSchema,
    currentSchemaFields: currentSchema 
      ? Object.entries(currentSchema.fields).map(([k, f]) => ({
          key: k,
          type: f.type,
          label: f.label,
          description: f.description,
        }))
      : [],
    currentTagDefinitions: currentSchema?.tagDefinitions || [],
    
    // 所有数据（用于生成示例）
    allInstances: state.instances,
  }), [promptContext, currentSchema, state.instances]);
}
