/**
 * Builder 类型定义、常量和工具函数
 */

import { field, type TagDefinition } from '../schema/types';
import type { BuilderState, LayoutComponent } from '../context';

// ============================================================================
// 类型定义
// ============================================================================

export type ApplySavedResult = {
  data: Record<string, unknown>;
  didUpgrade: boolean;
};

export type AIGenType = 'batch-data' | 'batch-tags' | 'ability-field' | null;

export type ModalType =
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

export type BuilderProjectSummary = {
  projectId: string;
  name: string;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type BuilderProjectDetail = BuilderProjectSummary & {
  data?: Record<string, unknown> | null;
};

// ============================================================================
// 工具函数
// ============================================================================

export const normalizeTags = (schema?: { tagDefinitions?: TagDefinition[] }): TagDefinition[] =>
  schema?.tagDefinitions ?? [];

export const normalizeRequirements = (
  value: unknown,
  fallback: BuilderState['requirements'],
): BuilderState['requirements'] => {
  if (!value || typeof value !== 'object') return fallback;
  const rawText =
    typeof (value as { rawText?: unknown }).rawText === 'string'
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

const isLayoutPoint = (value: unknown): value is { x: number; y: number } => {
  if (!value || typeof value !== 'object') return false;
  const point = value as { x?: unknown; y?: unknown };
  return typeof point.x === 'number' && typeof point.y === 'number';
};

export const isValidLayoutComponent = (value: unknown): value is LayoutComponent => {
  if (!value || typeof value !== 'object') return false;
  const comp = value as Record<string, unknown>;
  return (
    typeof comp.id === 'string' &&
    typeof comp.type === 'string' &&
    isLayoutPoint(comp.anchor) &&
    isLayoutPoint(comp.pivot) &&
    isLayoutPoint(comp.offset) &&
    typeof comp.width === 'number' &&
    typeof comp.height === 'number'
  );
};

export const isLegacyLayoutComponent = (value: unknown): boolean => {
  if (!value || typeof value !== 'object') return false;
  const comp = value as Record<string, unknown>;
  const hasLegacyPosition = typeof comp.x === 'number' || typeof comp.y === 'number';
  const hasNewLayout =
    isLayoutPoint(comp.anchor) && isLayoutPoint(comp.pivot) && isLayoutPoint(comp.offset);
  return hasLegacyPosition && !hasNewLayout;
};

export const normalizeBaseUrl = (value: string) => value.replace(/\/+$/, '');
export const buildAuthHeaders = (token: string | null) => ({
  'Content-Type': 'application/json',
  Authorization: token ? `Bearer ${token}` : '',
});
export const formatProjectDate = (value?: string) => {
  if (!value) return '未保存';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
};

// ============================================================================
// Schema 模板
// ============================================================================

export const SCHEMA_TEMPLATES = {
  blank: {
    name: '空模板',
    description: '从零开始定义字段',
    fields: {},
  },
  entity: {
    name: '实体模板',
    description: '带名称和标签的通用实体',
    fields: {
      name: field.string('名称'),
      tags: { type: 'array', label: '标签', itemType: 'string', tagEditor: true } as const,
    },
  },
  withRender: {
    name: '可渲染模板',
    description: '带渲染组件引用的实体',
    fields: {
      name: field.string('名称'),
      renderComponentId: { type: 'renderComponent', label: '渲染组件', showInTable: true } as const,
    },
  },
  player: {
    name: '玩家模板',
    description: '玩家/角色基础结构',
    fields: {
      name: field.string('名称'),
      tags: { type: 'array', label: '标签', itemType: 'string', tagEditor: true } as const,
    },
  },
  resource: {
    name: '资源模板',
    description: '可数值化的资源/属性',
    fields: {
      name: field.string('名称'),
      value: field.number('数值', { min: 0 }),
      max: field.number('上限'),
    },
  },
};

// ============================================================================
// 初始状态
// ============================================================================

export const INITIAL_STATE: BuilderState = {
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
