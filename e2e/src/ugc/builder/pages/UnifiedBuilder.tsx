/**
 * 统一 UGC Builder
 * 
 * 布局：左侧一列（上：组件库，下：Schema/数据）+ 右侧始终显示 UI 画布
 * 可拖拽分隔线 + 模态框编辑
 */

import { useState, useCallback, useMemo, useRef, useEffect, type DragEvent, type MouseEvent as ReactMouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Save, Play, Upload, Download,
  Database, Plus, Trash2, Sparkles, Gamepad2
} from 'lucide-react';

import { BaseEntitySchema, extendSchema, field, type SchemaDefinition, type FieldDefinition, type TagDefinition } from '../schema/types';
import { SceneCanvas, type SceneComponent } from '../ui/SceneCanvas';
import { PreviewCanvas } from '../ui/RenderPreview';
import { PromptGenerator, type GameContext } from '../ai';
import { buildRequirementsText } from '../utils/requirements';
import { migrateLayoutComponents, resolveAnchorFromPosition, resolveLayoutRect } from '../../utils/layout';
import { useToast } from '../../../contexts/ToastContext';
import { useAuth } from '../../../contexts/AuthContext';
import { BuilderProvider, useBuilder, useBuilderActions, type RenderComponent, type BuilderState, type LayoutComponent } from '../context';

import { type AIGenType, type ModalType, type ApplySavedResult, SCHEMA_TEMPLATES, normalizeRequirements, isValidLayoutComponent, isLegacyLayoutComponent } from './builderTypes';
import { type UIComponentDef } from './uiComponents';

import { PropertyPanel } from './panels/PropertyPanel';
import { BuilderModals } from './panels/BuilderModals';
import { LeftPanel } from './panels/LeftPanel';
import { CanvasToolbar } from './panels/CanvasToolbar';
import { useBgmPreview } from './hooks/useBgmPreview';
import { useProjectManager } from './hooks/useProjectManager';

export type { RenderComponent, BuilderState, LayoutComponent };


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
  const { state, currentSchema, currentInstances } = useBuilder();
  const actions = useBuilderActions();
  const { token } = useAuth();
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

  useBgmPreview(state.layout, isPreviewMode);
  
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
    actions.addSchema(newSchema);
    setSchemaTemplateModal(false);
    setActiveModal('schema');
  }, [actions]);

  const handleAddSchema = useCallback(() => {
    setSchemaTemplateModal(true);
  }, []);

  const handleDeleteSchema = useCallback((schemaId: string) => {
    actions.deleteSchema(schemaId);
  }, [actions]);

  const handleSchemaChange = useCallback((schemaId: string, updates: Partial<SchemaDefinition>) => {
    actions.updateSchema(schemaId, updates);
  }, [actions]);

  const handleAddField = useCallback((schemaId: string, key: string, fieldDef: FieldDefinition) => {
    actions.addSchemaField(schemaId, key, fieldDef);
  }, [actions]);

  const handleDeleteField = useCallback((schemaId: string, fieldKey: string) => {
    actions.deleteSchemaField(schemaId, fieldKey);
  }, [actions]);

  const handleUpdateField = useCallback((schemaId: string, fieldKey: string, updates: Partial<FieldDefinition>) => {
    actions.updateSchemaField(schemaId, fieldKey, updates);
  }, [actions]);

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
    
    const schema = state.schemas.find(s => s.id === schemaId);
    const existingField = schema?.fields[fieldKey];
    if (!existingField) return;
    const newField = factory();
    newField.label = existingField.label; // 保留 label
    actions.setSchemaField(schemaId, fieldKey, newField);
  }, [state.schemas, actions]);

  // ========== 数据实例操作 ==========
  const handleInstanceChange = useCallback((schemaId: string, instances: Record<string, unknown>[]) => {
    actions.setInstances(schemaId, instances);
  }, [actions]);

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
    actions.setLayoutValidated(layout as LayoutComponent[]);
    setSelectedComponentIds(prev => prev.filter(id => layout.some(c => c.id === id)));
  }, [actions]);

  const handleSelectionChange = useCallback((ids: string[]) => {
    setSelectedComponentIds(ids);
    actions.selectComponent(ids.length > 0 ? ids[ids.length - 1] : null);
  }, [actions]);

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
    actions.addRequirementEntry({ id: entryId, location: '', content: '', notes: '' });
  }, [actions]);

  const handleUpdateRequirementEntry = useCallback((id: string, updates: Partial<{ location: string; content: string; notes?: string }>) => {
    actions.updateRequirementEntry(id, updates);
  }, [actions]);

  const handleRemoveRequirementEntry = useCallback((id: string) => {
    actions.removeRequirementEntry(id);
  }, [actions]);

  const upsertRequirementEntryByLocation = useCallback((location: string, content: string) => {
    actions.upsertRequirementByLocation(location, content);
  }, [actions]);

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
  }), [
    state,
    leftPanelWidth,
    topPanelRatio,
    gridSize,
    showGrid,
    snapToGrid,
    snapToEdges,
    snapToCenters,
    snapThreshold,
  ]);

  const applySavedData = useCallback((data: Record<string, unknown>): ApplySavedResult => {
    const rawLayout = Array.isArray(data.layout) ? data.layout : [];
    const hasLegacyLayout = rawLayout.some(item => isLegacyLayoutComponent(item));
    const migratedLayout = hasLegacyLayout ? migrateLayoutComponents(rawLayout) : rawLayout;
    const layout = Array.isArray(migratedLayout)
      ? migratedLayout.filter(isValidLayoutComponent)
      : [];

    const schemas = Array.isArray(data.schemas) ? data.schemas : state.schemas;
    const requirements = normalizeRequirements(data.requirements, state.requirements);
    const selectedSchemaId = schemas.length > 0 ? schemas[0].id : null;
    actions.loadState({
      name: typeof data.name === 'string' ? data.name : state.name,
      description: typeof data.description === 'string' ? data.description : '',
      tags: Array.isArray(data.tags) ? data.tags : [],
      schemas,
      instances: (data.instances && typeof data.instances === 'object') ? data.instances as BuilderState['instances'] : state.instances,
      renderComponents: Array.isArray(data.renderComponents) ? data.renderComponents : state.renderComponents,
      layout,
      layoutGroups: Array.isArray(data.layoutGroups) ? data.layoutGroups : state.layoutGroups,
      selectedSchemaId,
      rulesCode: typeof data.rulesCode === 'string' ? data.rulesCode : '',
      requirements,
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

    return {
      data: { ...data, layout },
      didUpgrade: hasLegacyLayout,
    };
  }, [
    state,
    actions,
    setLeftPanelWidth,
    setTopPanelRatio,
    setGridSize,
    setShowGrid,
    setSnapToGrid,
    setSnapToEdges,
    setSnapToCenters,
    setSnapThreshold,
  ]);

  const persistLocalSave = useCallback((saveData: Record<string, unknown>) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saveData));
  }, []);

  const {
    builderProjects, isProjectLoading, refreshBuilderProjects,
    handleLoadProject, handleDeleteProject, handleCreateProjectFromCurrent,
    handleOpenProjectList, updateBuilderProject,
    activeProjectId, projectNameDraft, createBuilderProject,
  } = useProjectManager({
    applySavedData,
    persistLocalSave,
    buildSaveData,
    activeModal,
    setActiveModal,
    state,
  });

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
          const result = applySavedData(data);
          const nextData = result.data;
          persistLocalSave(nextData);
          if (token && activeProjectId) {
            void updateBuilderProject(activeProjectId, {
              name: typeof nextData.name === 'string' ? nextData.name : stateRef.current.name,
              description: typeof nextData.description === 'string' ? nextData.description : stateRef.current.description,
              data: nextData,
            }, true);
          }
        } catch {
          toast.error('导入失败：无效的 JSON 文件');
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
        const result = applySavedData(data);
        if (result.didUpgrade) {
          persistLocalSave(result.data);
        }
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
            onChange={e => actions.setName(e.target.value)}
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
                actions.reset();
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
        <LeftPanel
          leftPanelRef={leftPanelRef}
          leftPanelWidth={leftPanelWidth}
          topPanelRatio={topPanelRatio}
          expandedCategories={expandedCategories}
          toggleCategory={toggleCategory}
          handleDragStart={handleDragStart}
          handleAddSchema={handleAddSchema}
          handleDeleteSchema={handleDeleteSchema}
          state={state}
          actions={actions}
          setActiveModal={setActiveModal}
          setAiGenType={setAiGenType}
          selectedComponentIds={selectedComponentIds}
          handleSelectionChange={handleSelectionChange}
          handleVerticalDragStart={handleVerticalDragStart}
        />

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
              <CanvasToolbar
                selectedComponentIds={selectedComponentIds}
                alignSelection={alignSelection}
                distributeSelection={distributeSelection}
                showGrid={showGrid}
                setShowGrid={setShowGrid}
                gridSize={gridSize}
                setGridSize={setGridSize}
                snapToGrid={snapToGrid}
                setSnapToGrid={setSnapToGrid}
                snapToEdges={snapToEdges}
                setSnapToEdges={setSnapToEdges}
                snapToCenters={snapToCenters}
                setSnapToCenters={setSnapToCenters}
                snapThreshold={snapThreshold}
                setSnapThreshold={setSnapThreshold}
              />
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
                    actions.addRenderComponentAndLink(newRc, comp.id);
                  }}
                  className="h-full"
                />
              </div>
            </>
          )}
        </div>

        <PropertyPanel
          handleLayoutChange={handleLayoutChange}
          layoutOutputsSummary={layoutOutputsSummary}
          renderComponentInstances={renderComponentInstances}
        />
      </div>

      {/* 底部状态栏 */}
      <footer className="px-4 py-1 bg-slate-800 border-t border-slate-700 text-xs text-slate-500 flex gap-4 shrink-0">
        <span>Schema: {state.schemas.length}</span>
        <span>数据: {Object.values(state.instances).flat().length}</span>
        <span>布局组件: {state.layout.length}</span>
      </footer>

      <BuilderModals
        activeModal={activeModal}
        setActiveModal={setActiveModal}
        builderProjects={builderProjects}
        isProjectLoading={isProjectLoading}
        refreshBuilderProjects={refreshBuilderProjects}
        handleCreateProjectFromCurrent={handleCreateProjectFromCurrent}
        handleLoadProject={handleLoadProject}
        handleDeleteProject={handleDeleteProject}
        handleSchemaChange={handleSchemaChange}
        handleAddField={handleAddField}
        handleDeleteField={handleDeleteField}
        handleUpdateField={handleUpdateField}
        handleChangeFieldType={handleChangeFieldType}
        renderComponentInstances={renderComponentInstances}
        handleInstanceChange={handleInstanceChange}
        handleAddInstance={handleAddInstance}
        editingItem={editingItem}
        setEditingItem={setEditingItem}
        handleEditItem={handleEditItem}
        handleEditItemField={handleEditItemField}
        handleSaveEditItem={handleSaveEditItem}
        aiGenType={aiGenType}
        setAiGenType={setAiGenType}
        aiGenInput={aiGenInput}
        setAiGenInput={setAiGenInput}
        abilityImportErrors={abilityImportErrors}
        setAbilityImportErrors={setAbilityImportErrors}
        editingTagIndex={editingTagIndex}
        setEditingTagIndex={setEditingTagIndex}
        newTagName={newTagName}
        setNewTagName={setNewTagName}
        newTagGroup={newTagGroup}
        setNewTagGroup={setNewTagGroup}
        promptOutput={promptOutput}
        handleGenerateFullRules={handleGenerateFullRules}
        handleAddRequirementEntry={handleAddRequirementEntry}
        handleUpdateRequirementEntry={handleUpdateRequirementEntry}
        handleRemoveRequirementEntry={handleRemoveRequirementEntry}
        schemaTemplateModal={schemaTemplateModal}
        setSchemaTemplateModal={setSchemaTemplateModal}
        handleAddSchemaWithTemplate={handleAddSchemaWithTemplate}
      />
    </div>
  );
}
