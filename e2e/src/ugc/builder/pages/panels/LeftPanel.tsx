/**
 * 左侧面板：组件库 + Schema/数据概览 + 场景层次
 */

import { type DragEvent, type MouseEvent as ReactMouseEvent } from 'react';
import {
  ChevronDown, ChevronRight,
  Square, Database, Layers,
  Plus, Trash2, Sparkles, Edit3, GripVertical,
} from 'lucide-react';

import { type BuilderState } from '../../context';
import type { useBuilderActions } from '../../context';
import type { AIGenType, ModalType } from '../builderTypes';
import { getUIComponents, type UIComponentDef } from '../uiComponents';

interface LeftPanelProps {
  leftPanelRef: React.RefObject<HTMLDivElement | null>;
  leftPanelWidth: number;
  topPanelRatio: number;
  expandedCategories: Set<string>;
  toggleCategory: (cat: string) => void;
  handleDragStart: (comp: UIComponentDef, e: DragEvent) => void;
  handleAddSchema: () => void;
  handleDeleteSchema: (schemaId: string) => void;
  state: BuilderState;
  actions: ReturnType<typeof useBuilderActions>;
  setActiveModal: (modal: ModalType) => void;
  setAiGenType: (type: AIGenType) => void;
  selectedComponentIds: string[];
  handleSelectionChange: (ids: string[]) => void;
  handleVerticalDragStart: (e: ReactMouseEvent) => void;
}

export function LeftPanel({
  leftPanelRef,
  leftPanelWidth,
  topPanelRatio,
  expandedCategories,
  toggleCategory,
  handleDragStart,
  handleAddSchema,
  handleDeleteSchema,
  state,
  actions,
  setActiveModal,
  setAiGenType,
  selectedComponentIds,
  handleSelectionChange,
  handleVerticalDragStart,
}: LeftPanelProps) {
  return (
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
              onClick={() => actions.selectSchema(s.id)}
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
                    actions.selectSchema(s.id);
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
              actions.setLayoutGroups([...(state.layoutGroups || [{ id: 'default', name: '默认', hidden: false }, { id: 'hide', name: '隐藏', hidden: true }]), newGroup]);
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
                    actions.setLayout(state.layout.map(c => 
                      c.id === compId 
                        ? { ...c, data: { ...c.data, groupId: group.id } }
                        : c
                    ));
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
  );
}
