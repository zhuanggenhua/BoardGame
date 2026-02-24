/**
 * 模态框集合
 * 从 UnifiedBuilder.tsx 提取
 */

import { Sparkles, Copy, GripVertical, Trash2 } from 'lucide-react';
import { useBuilder, useBuilderActions } from '../../context';
import { useAuth } from '../../../../contexts/AuthContext';
import { field, type SchemaDefinition, type FieldDefinition, type TagDefinition } from '../../schema/types';
import { DataTable } from '../../ui/DataTable';
import { validateAbilityJson } from '../../utils/validateAbilityJson';
import { Modal } from '../components/Modal';
import { RenderComponentManager } from '../components/RenderComponentManager';
import { type AIGenType, type ModalType, type BuilderProjectSummary, SCHEMA_TEMPLATES, normalizeTags, formatProjectDate } from '../builderTypes';
import { generateAIPrompt } from '../promptBuilders';

interface BuilderModalsProps {
  activeModal: ModalType;
  setActiveModal: (modal: ModalType) => void;
  builderProjects: BuilderProjectSummary[];
  isProjectLoading: boolean;
  refreshBuilderProjects: () => Promise<BuilderProjectSummary[]>;
  handleCreateProjectFromCurrent: () => Promise<void>;
  handleLoadProject: (projectId: string) => Promise<void>;
  handleDeleteProject: (projectId: string) => Promise<void>;
  handleSchemaChange: (schemaId: string, updates: Partial<SchemaDefinition>) => void;
  handleAddField: (schemaId: string, key: string, fieldDef: FieldDefinition) => void;
  handleDeleteField: (schemaId: string, fieldKey: string) => void;
  handleUpdateField: (schemaId: string, fieldKey: string, updates: Partial<FieldDefinition>) => void;
  handleChangeFieldType: (schemaId: string, fieldKey: string, newType: string) => void;
  renderComponentInstances: Array<{ id: string; name: string; targetSchema?: string }>;
  handleInstanceChange: (schemaId: string, instances: Record<string, unknown>[]) => void;
  handleAddInstance: () => void;
  editingItem: Record<string, unknown> | null;
  setEditingItem: (item: Record<string, unknown> | null) => void;
  handleEditItem: (item: Record<string, unknown>) => void;
  handleEditItemField: (key: string, value: unknown) => void;
  handleSaveEditItem: () => void;
  aiGenType: AIGenType;
  setAiGenType: (type: AIGenType) => void;
  aiGenInput: string;
  setAiGenInput: (input: string) => void;
  abilityImportErrors: string[];
  setAbilityImportErrors: (errors: string[]) => void;
  editingTagIndex: number | null;
  setEditingTagIndex: (index: number | null) => void;
  newTagName: string;
  setNewTagName: (name: string) => void;
  newTagGroup: string;
  setNewTagGroup: (group: string) => void;
  promptOutput: string;
  handleGenerateFullRules: () => void;
  handleAddRequirementEntry: () => void;
  handleUpdateRequirementEntry: (id: string, updates: Partial<{ location: string; content: string; notes?: string }>) => void;
  handleRemoveRequirementEntry: (id: string) => void;
  schemaTemplateModal: boolean;
  setSchemaTemplateModal: (open: boolean) => void;
  handleAddSchemaWithTemplate: (templateKey: keyof typeof SCHEMA_TEMPLATES) => void;
}

export function BuilderModals(props: BuilderModalsProps) {
  const {
    activeModal, setActiveModal,
    builderProjects, isProjectLoading, refreshBuilderProjects, handleCreateProjectFromCurrent, handleLoadProject, handleDeleteProject,
    handleSchemaChange, handleAddField, handleDeleteField, handleUpdateField, handleChangeFieldType, renderComponentInstances,
    handleInstanceChange, handleAddInstance,
    editingItem, setEditingItem, handleEditItem, handleEditItemField, handleSaveEditItem,
    aiGenType, setAiGenType, aiGenInput, setAiGenInput, abilityImportErrors, setAbilityImportErrors,
    editingTagIndex, setEditingTagIndex, newTagName, setNewTagName, newTagGroup, setNewTagGroup,
    promptOutput, handleGenerateFullRules, handleAddRequirementEntry, handleUpdateRequirementEntry, handleRemoveRequirementEntry,
    schemaTemplateModal, setSchemaTemplateModal, handleAddSchemaWithTemplate,
  } = props;
  const { state, currentSchema, currentInstances } = useBuilder();
  const actions = useBuilderActions();
  const { token } = useAuth();

  return (
    <>
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
                onClick={() => actions.selectSchema(s.id)}
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
                onChange={e => actions.setRequirementsRawText(e.target.value)}
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
                onClick={() => navigator.clipboard?.writeText(promptOutput)}
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
                      onClick={() => navigator.clipboard?.writeText(String(state.rulesCode))}
                      className="px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded text-xs"
                    >
                      <Copy className="w-3 h-3 inline mr-1" /> 复制代码
                    </button>
                  )}
                  <button
                    onClick={() => actions.setRulesCode('')}
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
                    actions.setRulesCode(text);
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
                    navigator.clipboard?.writeText(prompt);
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
          onChange={components => actions.setRenderComponents(components)}
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

    </>
  );
}
