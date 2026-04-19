/**
 * 渲染组件管理器
 */

import { useState, useCallback } from 'react';
import type { SchemaDefinition } from '../../schema/types';
import type { RenderComponent } from '../../context';
import { useRenderPrompt } from '../../ai';

export function RenderComponentManager({
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
            {components.length === 0 && <div className="col-span-2 text-center text-slate-500 py-8">暂无渲染组件，点击"新建组件"创建</div>}
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
