/**
 * UGC Builder - 导出入口
 * 
 * 主入口：UnifiedBuilder (通过 pages 导出)
 */

// 类型导出
export * from './types';

// Schema 定义（显式导出避免命名冲突）
export { 
  BaseEntitySchema, 
  extendSchema, 
  field, 
  getTableFields,
  type SchemaDefinition, 
  type FieldDefinition,
  type FieldType
} from './schema';

// 通用 UI 组件（仅导出被使用的）
export * from './ui';

// 主页面导出
export { UnifiedBuilder } from './pages/UnifiedBuilder';
