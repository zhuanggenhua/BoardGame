/**
 * DataTable - 通用数据表格组件
 * 
 * 根据 Schema 自动生成表格 UI，支持：
 * - 从 Schema 生成列
 * - 排序/筛选/搜索
 * - 内联编辑
 * - 批量选中 + AI 生成
 */

import { useState, useMemo, useCallback } from 'react';
import type { SchemaDefinition, FieldDefinition } from '../schema/types';
import { getTableFields } from '../schema/types';

// ============================================================================
// 类型定义
// ============================================================================

export interface DataTableProps<T extends Record<string, unknown>> {
  /** Schema 定义 */
  schema: SchemaDefinition;
  /** 数据列表 */
  data: T[];
  /** 数据变更回调 */
  onChange: (data: T[]) => void;
  /** 选中项 */
  selected?: string[];
  /** 选中变更回调 */
  onSelectedChange?: (selected: string[]) => void;
  /** 批量 AI 生成回调 */
  onBatchAI?: (selected: T[], operation: string) => void;
  /** 行点击回调 */
  onRowClick?: (item: T) => void;
  /** 行双击回调（编辑） */
  onRowDoubleClick?: (item: T) => void;
  /** 删除回调 */
  onDelete?: (item: T) => void;
  /** 可用标签（用于内联标签编辑） */
  availableTags?: Array<{ name: string; group?: string }>;
  /** 可用渲染组件（用于内联选择） */
  availableRenderComponents?: Array<{ id: string; name: string }>;
  /** 类名 */
  className?: string;
}

interface SortConfig {
  key: string;
  direction: 'asc' | 'desc';
}

// ============================================================================
// 单元格渲染
// ============================================================================

function renderCellValue(value: unknown, field: FieldDefinition): React.ReactNode {
  if (value === null || value === undefined) {
    return <span className="text-gray-400">-</span>;
  }

  switch (field.type) {
    case 'boolean':
      return value ? '✓' : '✗';

    case 'sfxKey':
      return value ? (
        <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 text-xs rounded">
          {String(value)}
        </span>
      ) : (
        <span className="text-gray-400 text-xs">未设置</span>
      );

    case 'enum': {
      const option = field.options.find(opt => opt.value === value);
      return option?.label ?? String(value);
    }

    case 'array':
      if (Array.isArray(value)) {
        if (field.tagEditor) {
          return (
            <div className="flex flex-wrap gap-1 items-center">
              {value.slice(0, 3).map((tag, i) => (
                <span
                  key={i}
                  className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-xs rounded"
                >
                  {String(tag)}
                </span>
              ))}
              {value.length > 3 && (
                <span className="text-gray-400 text-xs">+{value.length - 3}</span>
              )}
              {value.length === 0 && (
                <span className="text-gray-400 text-xs">点击添加标签</span>
              )}
            </div>
          );
        }
        return `[${value.length}]`;
      }
      return '-';

    case 'abilities':
      return value ? (
        <span className="px-1.5 py-0.5 bg-green-100 text-green-700 text-xs rounded">
          已生成
        </span>
      ) : (
        <span className="px-1.5 py-0.5 bg-yellow-100 text-yellow-700 text-xs rounded">
          待生成
        </span>
      );

    case 'renderComponent':
      return value ? (
        <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 text-xs rounded">
          {String(value)}
        </span>
      ) : (
        <span className="text-gray-400 text-xs">点击选择</span>
      );

    case 'object':
      return <span className="text-gray-500">{'{...}'}</span>;

    default:
      return String(value);
  }
}

// ============================================================================
// DataTable 组件
// ============================================================================

export function DataTable<T extends Record<string, unknown>>({
  schema,
  data,
  onChange,
  selected = [],
  onSelectedChange,
  onBatchAI,
  onRowClick,
  onRowDoubleClick,
  onDelete,
  availableTags = [],
  availableRenderComponents = [],
  className = '',
}: DataTableProps<T>) {
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);
  const [searchText, setSearchText] = useState('');
  // 内联编辑状态
  const [editingCell, setEditingCell] = useState<{ id: string; key: string } | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  // 标签编辑下拉状态
  const [tagDropdownOpen, setTagDropdownOpen] = useState<{ id: string; key: string } | null>(null);

  const primaryKey = schema.primaryKey || 'id';
  const tableFields = useMemo(() => getTableFields(schema), [schema]);
  const tagGroups = useMemo(() => {
    const groups: Record<string, string[]> = {};
    availableTags.forEach(t => {
      const group = t.group || '未分组';
      if (!groups[group]) groups[group] = [];
      groups[group].push(t.name);
    });
    return groups;
  }, [availableTags]);

  // 排序和筛选
  const filteredData = useMemo(() => {
    let result = [...data];

    // 搜索筛选
    if (searchText) {
      const lower = searchText.toLowerCase();
      result = result.filter(item => {
        return tableFields.some(({ key }) => {
          const value = item[key];
          if (typeof value === 'string') {
            return value.toLowerCase().includes(lower);
          }
          return false;
        });
      });
    }

    // 排序
    if (sortConfig) {
      result.sort((a, b) => {
        const aVal = a[sortConfig.key];
        const bVal = b[sortConfig.key];

        if (aVal === bVal) return 0;
        if (aVal === null || aVal === undefined) return 1;
        if (bVal === null || bVal === undefined) return -1;

        const comparison = aVal < bVal ? -1 : 1;
        return sortConfig.direction === 'asc' ? comparison : -comparison;
      });
    }

    return result;
  }, [data, searchText, sortConfig, tableFields]);

  // 全选
  const allSelected = filteredData.length > 0 && 
    filteredData.every(item => selected.includes(String(item[primaryKey])));

  const handleSelectAll = useCallback(() => {
    if (!onSelectedChange) return;
    
    if (allSelected) {
      onSelectedChange([]);
    } else {
      onSelectedChange(filteredData.map(item => String(item[primaryKey])));
    }
  }, [allSelected, filteredData, primaryKey, onSelectedChange]);

  const handleSelectItem = useCallback((item: T) => {
    if (!onSelectedChange) return;
    
    const id = String(item[primaryKey]);
    if (selected.includes(id)) {
      onSelectedChange(selected.filter(s => s !== id));
    } else {
      onSelectedChange([...selected, id]);
    }
  }, [selected, primaryKey, onSelectedChange]);

  const handleSort = useCallback((key: string) => {
    setSortConfig(prev => {
      if (prev?.key === key) {
        return prev.direction === 'asc' 
          ? { key, direction: 'desc' }
          : null;
      }
      return { key, direction: 'asc' };
    });
  }, []);

  const handleDelete = useCallback((item: T) => {
    if (onDelete) {
      onDelete(item);
    } else {
      const id = String(item[primaryKey]);
      onChange(data.filter(d => String(d[primaryKey]) !== id));
    }
  }, [data, onChange, onDelete, primaryKey]);

  // 内联编辑处理
  const handleCellDoubleClick = useCallback((item: T, key: string, field: FieldDefinition) => {
    if (!field.editable) return;
    // 只允许编辑简单类型
    if (['string', 'number', 'sfxKey'].includes(field.type)) {
      const id = String(item[primaryKey]);
      setEditingCell({ id, key });
      setEditValue(String(item[key] ?? ''));
    }
  }, [primaryKey]);

  const handleCellBlur = useCallback(() => {
    if (!editingCell) return;
    const { id, key } = editingCell;
    const field = schema.fields[key];
    
    const newData = data.map(item => {
      if (String(item[primaryKey]) === id) {
        let value: unknown = editValue;
        if (field?.type === 'number') {
          value = parseFloat(editValue) || 0;
        }
        return { ...item, [key]: value };
      }
      return item;
    });
    onChange(newData as T[]);
    setEditingCell(null);
  }, [editingCell, editValue, data, onChange, primaryKey, schema.fields]);

  const handleCellKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCellBlur();
    } else if (e.key === 'Escape') {
      setEditingCell(null);
    }
  }, [handleCellBlur]);

  const selectedItems = useMemo(() => {
    return data.filter(item => selected.includes(String(item[primaryKey])));
  }, [data, selected, primaryKey]);

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* 工具栏 */}
      <div className="flex items-center justify-between p-2 border-b border-slate-700 bg-slate-800">
        <div className="flex items-center gap-2">
          {/* 搜索框 */}
          <input
            type="text"
            placeholder="搜索..."
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            className="px-2 py-1 bg-slate-700 border border-slate-600 rounded text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
          <span className="text-xs text-slate-400">
            共 {filteredData.length} 条
          </span>
        </div>

        {/* 批量操作 */}
        {selected.length > 0 && onBatchAI && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">
              已选 {selected.length} 项
            </span>
            <button
              onClick={() => onBatchAI(selectedItems, 'generate_abilities')}
              className="px-2 py-1 bg-purple-600 text-white text-xs rounded hover:bg-purple-500"
            >
              AI 生成能力
            </button>
            <button
              onClick={() => onBatchAI(selectedItems, 'translate')}
              className="px-2 py-1 bg-slate-600 text-white text-xs rounded hover:bg-slate-500"
            >
              批量翻译
            </button>
          </div>
        )}
      </div>

      {/* 表格 */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-xs">
          <thead className="bg-slate-700 sticky top-0 z-10 border-b border-slate-600">
            <tr>
              {/* 选择列 */}
              {onSelectedChange && (
                <th className="w-8 px-2 py-1.5 text-left bg-slate-700">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={handleSelectAll}
                    className="rounded border-slate-500"
                  />
                </th>
              )}

              {/* 数据列 */}
              {tableFields.map(({ key, field }) => (
                <th
                  key={key}
                  className="px-2 py-2 text-left font-medium text-slate-300 cursor-pointer hover:bg-slate-600 min-w-[80px] bg-slate-700"
                  style={{ width: field.width }}
                  onClick={() => handleSort(key)}
                >
                  <div className="flex items-center gap-1">
                    {field.label}
                    {sortConfig?.key === key && (
                      <span className="text-amber-400">
                        {sortConfig.direction === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </div>
                </th>
              ))}

              {/* 操作列 */}
              <th className="w-20 px-2 py-2 text-left font-medium text-slate-300 bg-slate-700">
                操作
              </th>
            </tr>
          </thead>

          <tbody>
            {filteredData.map((item, index) => {
              const id = String(item[primaryKey]);
              const isSelected = selected.includes(id);

              return (
                <tr
                  key={id}
                  className={`
                    border-b border-slate-700 cursor-pointer
                    ${isSelected ? 'bg-amber-900/30' : index % 2 === 0 ? 'bg-slate-800' : 'bg-slate-800/50'}
                    hover:bg-slate-700
                  `}
                  onClick={() => onRowClick?.(item)}
                  onDoubleClick={() => onRowDoubleClick?.(item)}
                >
                  {/* 选择列 */}
                  {onSelectedChange && (
                    <td className="px-2 py-1.5" onClick={e => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleSelectItem(item)}
                        className="rounded border-slate-500"
                      />
                    </td>
                  )}

                  {/* 数据列 - 支持内联编辑 */}
                  {tableFields.map(({ key, field }) => {
                    const isEditing = editingCell?.id === id && editingCell?.key === key;
                    const canEdit = ['string', 'number', 'sfxKey'].includes(field.type);
                    const isTagField = field.type === 'array' && 'tagEditor' in field && field.tagEditor;
                    const isTagDropdownOpen = tagDropdownOpen?.id === id && tagDropdownOpen?.key === key;
                    const currentTags = Array.isArray(item[key]) ? item[key] as string[] : [];
                    
                    return (
                      <td 
                        key={key} 
                        className={`px-2 py-2 text-slate-300 min-w-[80px] ${canEdit || isTagField ? 'cursor-pointer' : ''} relative`}
                        onDoubleClick={e => {
                          e.stopPropagation();
                          handleCellDoubleClick(item, key, field);
                        }}
                        onClick={e => {
                          if (isTagField) {
                            e.stopPropagation();
                            setTagDropdownOpen(isTagDropdownOpen ? null : { id, key });
                          }
                        }}
                      >
                        {isEditing ? (
                          <input
                            type={field.type === 'number' ? 'number' : 'text'}
                            value={editValue}
                            onChange={e => setEditValue(e.target.value)}
                            onBlur={handleCellBlur}
                            onKeyDown={handleCellKeyDown}
                            autoFocus
                            className="w-full px-1 py-0.5 bg-slate-600 border border-amber-500 rounded text-white text-xs focus:outline-none"
                          />
                        ) : isTagField ? (
                          <div className="relative">
                            {/* 标签显示 */}
                            <div className="flex flex-wrap gap-1 items-center">
                              {currentTags.slice(0, 3).map((tag, i) => (
                                <span
                                  key={i}
                                  className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-xs rounded flex items-center gap-1"
                                  onClick={e => e.stopPropagation()}
                                >
                                  {String(tag)}
                                  <button
                                    className="text-blue-500 hover:text-red-500"
                                    onClick={e => {
                                      e.stopPropagation();
                                      const newTags = currentTags.filter(t => t !== tag);
                                      const newData = data.map(d => 
                                        String(d[primaryKey]) === id ? { ...d, [key]: newTags } : d
                                      );
                                      onChange(newData as T[]);
                                    }}
                                  >
                                    ×
                                  </button>
                                </span>
                              ))}
                              {currentTags.length > 3 && (
                                <span className="text-gray-400 text-xs">+{currentTags.length - 3}</span>
                              )}
                              <span className="text-gray-400 text-xs">+</span>
                            </div>
                            
                            {/* 分级下拉 - 使用 fixed 定位避免被父容器裁剪 */}
                            {isTagDropdownOpen && (
                              <div 
                                className="fixed z-[9999] bg-slate-700 border border-slate-600 rounded shadow-lg min-w-[150px] max-h-[200px] overflow-y-auto"
                                style={{ 
                                  marginTop: '4px',
                                }}
                                onClick={e => e.stopPropagation()}
                              >
                                {Object.entries(tagGroups).map(([group, tags]) => (
                                  <div key={group}>
                                    <div className="px-2 py-1 text-xs text-slate-400 bg-slate-800 sticky top-0">{group}</div>
                                    {tags
                                      .filter(t => !currentTags.includes(t))
                                      .map(tag => (
                                        <button
                                          key={tag}
                                          className="w-full px-3 py-1 text-left text-xs text-white hover:bg-slate-600"
                                          onClick={() => {
                                            const newTags = [...currentTags, tag];
                                            const newData = data.map(d => 
                                              String(d[primaryKey]) === id ? { ...d, [key]: newTags } : d
                                            );
                                            onChange(newData as T[]);
                                            setTagDropdownOpen(null);
                                          }}
                                        >
                                          {tag}
                                        </button>
                                      ))
                                    }
                                  </div>
                                ))}
                                {availableTags.length === 0 && (
                                  <div className="px-3 py-2 text-xs text-slate-500">暂无可用标签</div>
                                )}
                              </div>
                            )}
                          </div>
                        ) : (field.type as string) === 'renderComponent' || key === 'renderComponentId' ? (
                          /* 渲染组件选择 - 内联下拉 */
                          <select
                            value={String(item[key] ?? '')}
                            onChange={e => {
                              const newData = data.map(d => 
                                String(d[primaryKey]) === id ? { ...d, [key]: e.target.value } : d
                              );
                              onChange(newData as T[]);
                            }}
                            onClick={e => e.stopPropagation()}
                            className="w-full px-1 py-0.5 bg-slate-600 border border-slate-500 rounded text-white text-xs"
                          >
                            <option value="">无</option>
                            {availableRenderComponents.map(rc => (
                              <option key={rc.id} value={rc.id}>{rc.name}</option>
                            ))}
                          </select>
                        ) : (
                          renderCellValue(item[key], field)
                        )}
                      </td>
                    );
                  })}

                  {/* 操作列 */}
                  <td className="px-2 py-1.5" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => onRowDoubleClick?.(item)}
                        className="px-1.5 py-0.5 text-amber-500 hover:bg-slate-600 rounded text-xs"
                      >
                        编辑
                      </button>
                      <button
                        onClick={() => handleDelete(item)}
                        className="px-1.5 py-0.5 text-red-400 hover:bg-slate-600 rounded text-xs"
                      >
                        删除
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}

            {filteredData.length === 0 && (
              <tr>
                <td
                  colSpan={tableFields.length + (onSelectedChange ? 2 : 1)}
                  className="px-3 py-8 text-center text-slate-500"
                >
                  暂无数据
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
