/**
 * Schema 定义类型 - 用于自动生成 UI 组件
 * 
 * Schema 驱动 UI：
 * - DataTable 根据 Schema 自动生成表格列
 * - SchemaEditor 根据 Schema 自动生成表单字段
 */

// ============================================================================
// 基础字段类型
// ============================================================================

/** 字段类型枚举 */
export type FieldType = 
  | 'string'
  | 'number'
  | 'boolean'
  | 'sfxKey'
  | 'enum'
  | 'array'
  | 'object'
  | 'abilities'        // GAS 能力列表（需 AI 生成）
  | 'renderComponent'; // 渲染组件引用

/** 字段定义基础接口 */
interface BaseFieldDef {
  /** 字段类型 */
  type: FieldType;
  /** 显示名称 */
  label: string;
  /** 字段描述（用于 AI 提示词） */
  description?: string;
  /** 是否必填 */
  required?: boolean;
  /** 默认值 */
  default?: unknown;
  /** 是否在表格中显示 */
  showInTable?: boolean;
  /** 是否可编辑（默认 true） */
  editable?: boolean;
  /** 是否需要 AI 生成（复杂字段） */
  aiGenerated?: boolean;
  /** 表格列宽度 */
  width?: number | string;
}

/** 字符串字段 */
export interface StringFieldDef extends BaseFieldDef {
  type: 'string';
  /** 最大长度 */
  maxLength?: number;
  /** 是否多行 */
  multiline?: boolean;
  /** 占位符 */
  placeholder?: string;
}

/** 音效 Key 字段 */
export interface SfxKeyFieldDef extends BaseFieldDef {
  type: 'sfxKey';
  /** 占位符 */
  placeholder?: string;
}

/** 数字字段 */
export interface NumberFieldDef extends BaseFieldDef {
  type: 'number';
  /** 最小值 */
  min?: number;
  /** 最大值 */
  max?: number;
  /** 步进 */
  step?: number;
  /** 是否使用滑块 */
  slider?: boolean;
}

/** 布尔字段 */
export interface BooleanFieldDef extends BaseFieldDef {
  type: 'boolean';
}

/** 枚举字段 */
export interface EnumFieldDef extends BaseFieldDef {
  type: 'enum';
  /** 选项列表 */
  options: Array<{
    value: string | number;
    label: string;
    icon?: string;
  }>;
}

/** 数组字段 */
export interface ArrayFieldDef extends BaseFieldDef {
  type: 'array';
  /** 数组元素类型 */
  itemType: 'string' | 'number' | 'object';
  /** 如果 itemType 是 object，提供子 Schema */
  itemSchema?: SchemaDefinition;
  /** 是否作为 Tag 编辑器 */
  tagEditor?: boolean;
}

/** 对象字段 */
export interface ObjectFieldDef extends BaseFieldDef {
  type: 'object';
  /** 子 Schema */
  schema: SchemaDefinition;
}

/** GAS 能力字段（AI 生成） */
export interface AbilitiesFieldDef extends BaseFieldDef {
  type: 'abilities';
  aiGenerated: true;
}

/** 代码字段（AI 生成） */
/** 渲染组件引用字段 */
export interface RenderComponentFieldDef extends BaseFieldDef {
  type: 'renderComponent';
  /** 关联的渲染组件 ID */
  options?: {
    componentId?: string;
  };
}

/** 字段定义联合类型 */
export type FieldDefinition =
  | StringFieldDef
  | NumberFieldDef
  | BooleanFieldDef
  | SfxKeyFieldDef
  | EnumFieldDef
  | ArrayFieldDef
  | ObjectFieldDef
  | AbilitiesFieldDef
  | RenderComponentFieldDef;

// ============================================================================
// Schema 定义
// ============================================================================

/** 标签定义（支持分组） */
export interface TagDefinition {
  /** 标签名称（实际使用的值） */
  name: string;
  /** 所属分组（仅用于配置时分类，不影响实际使用） */
  group?: string;
}

/** Schema 定义 */
export interface SchemaDefinition {
  /** Schema ID */
  id: string;
  /** Schema 名称 */
  name: string;
  /** Schema 描述 */
  description?: string;
  /** Schema 级默认渲染组件（模板） */
  defaultRenderComponentId?: string;
  /** 字段定义 */
  fields: Record<string, FieldDefinition>;
  /** 主键字段（默认 'id'） */
  primaryKey?: string;
  /** 显示字段（用于列表标题） */
  displayField?: string;
  /** 可用标签定义（支持分组，供标签字段下拉选择） */
  tagDefinitions?: TagDefinition[];
}

// ============================================================================
// 基础 Schema 模板（最小通用结构）
// ============================================================================

/**
 * 基础实体 Schema - 所有游戏对象的最小通用字段
 * 用户可以基于此扩展添加任意字段
 */
export const BaseEntitySchema: SchemaDefinition = {
  id: 'entity',
  name: '实体',
  description: '所有游戏对象的基础结构，用户可添加任意字段',
  primaryKey: 'id',
  displayField: 'name',
  fields: {
    id: {
      type: 'string',
      label: 'ID',
      required: true,
      editable: false,
      showInTable: true,
      width: 120,
    },
    name: {
      type: 'string',
      label: '名称',
      required: true,
      showInTable: true,
      width: 120,
    },
    tags: {
      type: 'array',
      label: '标签',
      itemType: 'string',
      tagEditor: true,
      showInTable: true,
      width: 150,
      description: 'Tag 标记，用于筛选和触发条件',
    },
    description: {
      type: 'string',
      label: '描述',
      multiline: true,
      showInTable: false,
    },
  },
};

// ============================================================================
// Schema 扩展工具
// ============================================================================

/**
 * 扩展 Schema - 基于现有 Schema 添加新字段
 */
export function extendSchema(
  base: SchemaDefinition,
  extension: {
    id: string;
    name: string;
    description?: string;
    fields: Record<string, FieldDefinition>;
  }
): SchemaDefinition {
  return {
    ...base,
    id: extension.id,
    name: extension.name,
    description: extension.description ?? base.description,
    fields: {
      ...base.fields,
      ...extension.fields,
    },
  };
}

/**
 * 创建空 Schema - 用户完全自定义
 */
export function createSchema(config: {
  id: string;
  name: string;
  description?: string;
  fields: Record<string, FieldDefinition>;
  primaryKey?: string;
  displayField?: string;
}): SchemaDefinition {
  return {
    id: config.id,
    name: config.name,
    description: config.description,
    fields: config.fields,
    primaryKey: config.primaryKey ?? 'id',
    displayField: config.displayField ?? 'name',
  };
}

/**
 * 创建字段定义的工厂函数
 */
export const field = {
  string: (label: string, options?: Partial<StringFieldDef>): StringFieldDef => ({
    type: 'string',
    label,
    showInTable: true,
    ...options,
  }),
  
  number: (label: string, options?: Partial<NumberFieldDef>): NumberFieldDef => ({
    type: 'number',
    label,
    showInTable: true,
    ...options,
  }),
  
  boolean: (label: string, options?: Partial<BooleanFieldDef>): BooleanFieldDef => ({
    type: 'boolean',
    label,
    showInTable: true,
    ...options,
  }),

  sfxKey: (label: string, options?: Partial<SfxKeyFieldDef>): SfxKeyFieldDef => ({
    type: 'sfxKey',
    label,
    showInTable: true,
    ...options,
  }),
  
  enum: (label: string, options: Array<{ value: string | number; label: string }>, extra?: Partial<EnumFieldDef>): EnumFieldDef => ({
    type: 'enum',
    label,
    options,
    showInTable: true,
    ...extra,
  }),
  
  tags: (label: string, options?: Partial<ArrayFieldDef>): ArrayFieldDef => ({
    type: 'array',
    label,
    itemType: 'string',
    tagEditor: true,
    showInTable: true,
    ...options,
  }),
  
  abilities: (label: string, description?: string): AbilitiesFieldDef => ({
    type: 'abilities',
    label,
    description,
    aiGenerated: true,
    showInTable: true,
    width: 90,
  }),
  
};

// ============================================================================
// 工具函数
// ============================================================================

/** 获取 Schema 中可在表格显示的字段 */
export function getTableFields(schema: SchemaDefinition): Array<{
  key: string;
  field: FieldDefinition;
}> {
  return Object.entries(schema.fields)
    .filter(([, field]) => field.showInTable !== false)
    .map(([key, field]) => ({ key, field }));
}

/** 获取 Schema 中需要 AI 生成的字段 */
export function getAIGeneratedFields(schema: SchemaDefinition): Array<{
  key: string;
  field: FieldDefinition;
}> {
  return Object.entries(schema.fields)
    .filter(([, field]) => field.aiGenerated)
    .map(([key, field]) => ({ key, field }));
}

/** 获取字段的默认值 */
export function getFieldDefault(field: FieldDefinition): unknown {
  if (field.default !== undefined) return field.default;
  
  switch (field.type) {
    case 'string':
    case 'sfxKey':
      return '';
    case 'number':
      return field.min ?? 0;
    case 'boolean':
      return false;
    case 'enum':
      return field.options[0]?.value ?? '';
    case 'array':
      return [];
    case 'object':
      return {};
    case 'abilities':
      return null;
    default:
      return null;
  }
}

/** 创建空实例 */
export function createEmptyInstance(schema: SchemaDefinition): Record<string, unknown> {
  const instance: Record<string, unknown> = {};
  
  for (const [key, field] of Object.entries(schema.fields)) {
    instance[key] = getFieldDefault(field);
  }
  
  return instance;
}
