/**
 * 属性面板（右侧）
 * 从 UnifiedBuilder.tsx 提取
 */

import { Trash2 } from 'lucide-react';
import { useBuilder, useBuilderActions, type LayoutComponent } from '../../context';
import { useRenderPrompt } from '../../ai';
import { BASE_UI_COMPONENTS } from '../uiComponents';
import { buildActionHookPrompt } from '../promptBuilders';
import { HookField } from '../components/HookField';

interface PropertyPanelProps {
  handleLayoutChange: (layout: LayoutComponent[]) => void;
  layoutOutputsSummary: string;
  renderComponentInstances: Array<{ id: string; name: string; targetSchema?: string }>;
}

export function PropertyPanel({ handleLayoutChange, layoutOutputsSummary, renderComponentInstances }: PropertyPanelProps) {
  const { state, currentSchema } = useBuilder();
  const actions = useBuilderActions();
  const { generateFront, generateBack } = useRenderPrompt();

  return (
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
                  actions.selectComponent(null);
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
  );
}
