/**
 * 渲染预览组件
 * 
 * 动态执行用户生成的渲染代码并显示预览
 */

import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import * as Babel from '@babel/standalone';
import { ActionBarSkeleton, HandAreaSkeleton, PhaseHudSkeleton } from '../../../components/game/framework';
import { getVisibleActions } from '../../runtime/actionHooks';
import { resolvePlayerContext } from '../utils/resolvePlayerContext';
import { resolveLayoutRect } from '../../utils/layout';
import type { UGCGameState } from '../../sdk/types';

interface RenderPreviewProps {
  renderCode: string;
  backRenderCode?: string;
  data: Record<string, unknown>;
  showBack?: boolean;
  className?: string;
}

/**
 * 安全执行渲染代码
 * 返回 React 元素或错误信息
 */
/**
 * 解码HTML实体，确保代码可正确执行
 */
function decodeHtmlEntities(code: string): string {
  const entities: Record<string, string> = {
    '&#39;': "'",
    '&#34;': '"',
    '&quot;': '"',
    '&lt;': '<',
    '&gt;': '>',
    '&amp;': '&',
    '&apos;': "'",
  };
  let result = code;
  for (const [entity, char] of Object.entries(entities)) {
    result = result.split(entity).join(char);
  }
  return result;
}

/**
 * 修复缺少反引号的className模板字符串
 * className={xxx ${...}} => className={`xxx ${...}`}
 */
function fixClassNameTemplate(code: string): string {
  // 匹配 className={...} 其中包含 ${ 但缺少反引号
  // 例如：className={relative ${...}} => className={`relative ${...}`}
  return code.replace(
    /className=\{([^`][^}]*\$\{[^}]*\}[^}]*)\}/g,
    (match, content) => {
      // 如果内容已经有反引号，不处理
      if (content.startsWith('`') && content.endsWith('`')) {
        return match;
      }
      // 添加反引号
      return `className={\`${content}\`}`;
    }
  );
}

/**
 * 移除 TypeScript 类型注解，使代码可在纯 JavaScript 中执行
 */
function stripTypeAnnotations(code: string): string {
  // 先解码HTML实体
  let result = decodeHtmlEntities(code);
  // 修复缺少反引号的className
  result = fixClassNameTemplate(result);
  // 移除参数类型注解：(data: Record<string, unknown>) => ...
  result = result.replace(/\((\w+)\s*:\s*[^)]+\)/g, '($1)');
  // 移除箭头函数返回类型注解：(data) : Type => ...
  result = result.replace(/\)\s*:\s*[^=]+=>/g, ') =>');
  // 移除变量类型注解：const x: Type = ...
  result = result.replace(/:\s*(?:string|number|boolean|string\[\]|number\[\]|Record<[^>]+>|[A-Z]\w*(?:<[^>]+>)?)\s*(?=[=,;)\]])/g, '');
  // 移除 as 类型断言：x as string[] 或 x as Type
  // 支持 (data.tags as string[]) 形式
  result = result.replace(/\s+as\s+string\[\]/g, '');
  result = result.replace(/\s+as\s+number\[\]/g, '');
  result = result.replace(/\s+as\s+unknown\[\]/g, '');
  result = result.replace(/\s+as\s+(?:string|number|boolean|unknown|Record<[^>]+>|[A-Z]\w*(?:<[^>]+>)?)/g, '');
  return result;
}

function executeRenderCode(
  code: string, 
  data: Record<string, unknown>
): { element: React.ReactNode; error?: string } {
  if (!code || !code.trim()) {
    return { element: null, error: '无渲染代码' };
  }

  // 验证代码格式：必须以箭头函数或function开头
  const trimmedCode = code.trim();
  if (!trimmedCode.startsWith('(') && !trimmedCode.startsWith('function')) {
    return { element: null, error: '代码格式错误：需要函数表达式' };
  }

  // 移除 TypeScript 类型注解
  const jsCode = stripTypeAnnotations(trimmedCode);

  try {
    // 使用 Babel 编译 JSX
    const compiled = Babel.transform(jsCode, {
      presets: ['react'],
      filename: 'render.jsx',
    });
    
    if (!compiled.code) {
      return { element: null, error: '编译失败' };
    }

    // 创建函数并执行
    // eslint-disable-next-line no-new-func
    const renderFn = new Function('data', 'React', `
      "use strict";
      const fn = ${compiled.code};
      if (typeof fn !== 'function') {
        throw new Error('不是有效的函数');
      }
      return fn(data);
    `);
    
    // 传入导入的 React 对象（不使用 require）
    const element = renderFn(data, React);
    return { element };
  } catch (err) {
    console.error('[RenderPreview] 执行错误:', err, '\n原始代码:', code.substring(0, 200));
    return { 
      element: null, 
      error: err instanceof Error ? err.message : '执行错误' 
    };
  }
}

export function RenderPreview({ 
  renderCode, 
  backRenderCode, 
  data, 
  showBack = false,
  className = '' 
}: RenderPreviewProps) {
  const [key, setKey] = useState(0);

  const result = useMemo(() => {
    const code = showBack && backRenderCode ? backRenderCode : renderCode;
    return executeRenderCode(code, data);
  }, [renderCode, backRenderCode, data, showBack, key]);

  if (result.error) {
    return (
      <div className={`flex flex-col items-center justify-center bg-red-900/20 border border-red-500/50 rounded-lg p-2 ${className}`}>
        <AlertTriangle className="w-4 h-4 text-red-400 mb-1" />
        <span className="text-red-300 text-[10px] text-center">{result.error}</span>
        <button 
          onClick={() => setKey(k => k + 1)}
          className="mt-1 px-1.5 py-0.5 bg-red-600/30 hover:bg-red-600/50 rounded text-[10px] text-red-300"
        >
          <RefreshCw className="w-3 h-3 inline mr-1" />
          重试
        </button>
      </div>
    );
  }

  // 生成的代码应该自己包含 relative 和 w-full h-full
  // 外层容器提供 flex 确保子元素正确填满
  return (
    <div className={`flex ${className}`}>
      {result.element}
    </div>
  );
}

/**
 * 预览模式画布
 * 用于显示整个场景的预览效果
 */
interface PreviewCanvasProps {
  components: Array<{
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
  }>;
  renderComponents: Array<{
    id: string;
    name: string;
    renderCode: string;
    backRenderCode?: string;
    targetSchema: string;
  }>;
  instances: Record<string, Record<string, unknown>[]>;
  layoutGroups?: Array<{ id: string; name: string; hidden: boolean }>;
  schemaDefaults?: Record<string, string>;
  className?: string;
  interactive?: boolean;
  currentPlayerId?: string | null;
  playerIds?: string[];
  runtimeState?: UGCGameState | null;
  onAction?: (action: ZoneAction, context: Record<string, unknown>) => void;
  onPlayCard?: (cardId: string, context: Record<string, unknown>) => void;
  onSellCard?: (cardId: string, context: Record<string, unknown>) => void;
}

interface ComponentOutput {
  componentId: string;
  type: string;
  schemaId?: string;
  items: Record<string, unknown>[];
  itemCount: number;
  bindEntity?: string;
}

interface ZoneAction {
  id: string;
  label: string;
  scope?: 'current-player' | 'all';
  requirement?: string;
  hookCode?: string;
}

interface ActionBarRuntimeAction extends ZoneAction {
  description?: string;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'ghost';
}

export function PreviewCanvas({
  components,
  renderComponents,
  instances,
  layoutGroups = [],
  schemaDefaults,
  className = '',
  interactive = false,
  currentPlayerId,
  playerIds,
  runtimeState,
  onAction,
  onPlayCard,
  onSellCard,
}: PreviewCanvasProps) {
  const [showBack, setShowBack] = useState(false);
  const [selectedCardIdsByComponent, setSelectedCardIdsByComponent] = useState<Record<string, string[]>>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(entries => {
      const entry = entries[0];
      if (!entry) return;
      setContainerSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      });
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const handleSelectChange = useCallback((componentId: string, cardId: string, selected: boolean) => {
    setSelectedCardIdsByComponent(prev => {
      const current = prev[componentId] ?? [];
      const next = selected
        ? Array.from(new Set([...current, cardId]))
        : current.filter(id => id !== cardId);
      if (next.length === current.length && next.every((id, index) => id === current[index])) {
        return prev;
      }
      return {
        ...prev,
        [componentId]: next,
      };
    });
  }, []);

  const previewInstances = useMemo(() => {
    const map: Record<string, Record<string, unknown>[]> = {};
    const limit = interactive ? null : 10;
    Object.entries(instances).forEach(([schemaId, items]) => {
      map[schemaId] = limit ? items.slice(0, limit) : items.slice();
    });
    return map;
  }, [instances, interactive]);
  
  // 过滤隐藏分组的组件
  const hiddenGroupIds = new Set(layoutGroups.filter(g => g.hidden).map(g => g.id));
  const visibleComponents = components.filter(comp => {
    const groupId = (comp.data.groupId as string) || 'default';
    return !hiddenGroupIds.has(groupId);
  });

  const derivedPlayerCount = useMemo(() => {
    if (Array.isArray(playerIds) && playerIds.length > 0) return playerIds.length;
    const playerAreas = visibleComponents.filter(comp => comp.type === 'player-area');
    return playerAreas.length;
  }, [playerIds, visibleComponents]);

  const derivedPlayerIds = useMemo(() => {
    const normalizedPlayerIds = Array.isArray(playerIds)
      ? playerIds.map(id => String(id)).filter(Boolean)
      : [];
    if (normalizedPlayerIds.length > 0) return normalizedPlayerIds;
    if (!derivedPlayerCount) return [];
    return Array.from({ length: derivedPlayerCount }, (_, index) => `player-${index + 1}`);
  }, [playerIds, derivedPlayerCount]);

  const outputsByType = useMemo(() => {
    const outputMap: Record<string, ComponentOutput[]> = {};
    visibleComponents.forEach(comp => {
      const schemaId = (comp.data.bindSchema || comp.data.targetSchema) as string | undefined;
      if (!schemaId) return;
      const items = previewInstances[schemaId] || [];
      const output: ComponentOutput = {
        componentId: comp.id,
        type: comp.type,
        schemaId,
        items,
        itemCount: items.length,
        bindEntity: comp.data.bindEntity as string | undefined,
      };
      if (!outputMap[comp.type]) outputMap[comp.type] = [];
      outputMap[comp.type].push(output);
    });
    return outputMap;
  }, [visibleComponents, previewInstances]);

  const outputsById = useMemo(() => {
    const outputMap: Record<string, ComponentOutput> = {};
    Object.values(outputsByType).forEach(list => {
      list.forEach(output => {
        outputMap[output.componentId] = output;
      });
    });
    return outputMap;
  }, [outputsByType]);

  const renderComponentIndex = useMemo(() => {
    return renderComponents.map(rc => ({
      id: rc.id,
      name: rc.name,
      targetSchema: rc.targetSchema,
    }));
  }, [renderComponents]);

  const renderComponentInstances = useMemo(() => {
    return components.filter(comp => comp.type === 'render-component');
  }, [components]);

  const renderByComponentId = useCallback(
    (componentId: string, item: Record<string, unknown>, options?: { showBack?: boolean }) => {
      const rc = renderComponents.find(r => r.id === componentId);
      if (!rc) return null;
      return (
        <RenderPreview
          renderCode={rc.renderCode}
          backRenderCode={rc.backRenderCode}
          showBack={options?.showBack ?? showBack}
          data={item}
          className="w-full h-full"
        />
      );
    },
    [renderComponents, showBack]
  );
  
  return (
    <div
      ref={containerRef}
      data-testid="ugc-preview-canvas"
      className={`relative bg-slate-950 rounded-lg ${className}`}
    >
      {/* 背面切换按钮 */}
      <div className="absolute top-2 right-2 z-10">
        <button
          onClick={() => setShowBack(!showBack)}
          className={`px-2 py-1 rounded text-xs ${showBack ? 'bg-amber-600' : 'bg-slate-700 hover:bg-slate-600'}`}
        >
          {showBack ? '查看正面' : '查看背面'}
        </button>
      </div>
      {visibleComponents.map(comp => {
        if (!containerSize.width || !containerSize.height) return null;
        const resolved = resolveLayoutRect(
          {
            anchor: comp.anchor,
            pivot: comp.pivot,
            offset: comp.offset,
            width: comp.width,
            height: comp.height,
            rotation: comp.rotation,
          },
          containerSize
        );
        const style: React.CSSProperties = {
          position: 'absolute',
          left: resolved.x,
          top: resolved.y,
          width: resolved.width,
          height: resolved.height,
        };

        // 自定义渲染组件
        if (comp.type === 'render-component') {
          // 新模式：直接从 comp.data 获取渲染代码
          const renderCode = comp.data.renderCode as string | undefined;
          const backRenderCode = comp.data.backRenderCode as string | undefined;
          const targetSchema = comp.data.targetSchema as string | undefined;
          
          // 旧模式兼容：通过 renderComponentId 查找
          if (!renderCode && comp.data.renderComponentId) {
            const rc = renderComponents.find(r => r.id === comp.data.renderComponentId);
            if (rc) {
              const schemaData = previewInstances[rc.targetSchema]?.[0] || {};
              return (
                <div key={comp.id} style={style}>
                  <RenderPreview
                    renderCode={rc.renderCode}
                    backRenderCode={rc.backRenderCode}
                    data={schemaData}
                    showBack={showBack}
                    className="w-full h-full"
                  />
                </div>
              );
            }
          }
          
          // 新模式：直接使用 comp.data 中的配置
          if (renderCode) {
            const schemaData = targetSchema ? (previewInstances[targetSchema]?.[0] || {}) : {};
            // 使用 CSS 变量传递父容器尺寸，确保生成代码的 w-full h-full 能正确计算
            const containerStyle: React.CSSProperties = {
              ...style,
              display: 'flex',
            };
            return (
              <div key={comp.id} style={containerStyle}>
                <RenderPreview
                  renderCode={renderCode}
                  backRenderCode={backRenderCode}
                  data={schemaData}
                  showBack={showBack}
                  className="w-full h-full"
                />
              </div>
            );
          }
          
          // 无渲染代码时显示占位
          return (
            <div key={comp.id} style={style} className="border-2 border-dashed border-cyan-600/50 rounded flex items-center justify-center bg-cyan-900/20">
              <span className="text-cyan-400 text-xs">未配置渲染代码</span>
            </div>
          );
        }

        if (comp.type === 'action-bar') {
          const rawActions = Array.isArray(comp.data.actions)
            ? (comp.data.actions as ActionBarRuntimeAction[])
            : [];
          const showFrame = comp.data.showFrame !== false;
          const allowActionHooks = comp.data.allowActionHooks !== false;
          const visibleActions = getVisibleActions({
            actions: rawActions,
            allowActionHooks,
            isCurrentPlayer: true,
          });
          const layout = (comp.data.layout === 'column' ? 'column' : 'row') as 'row' | 'column';
          const align = (comp.data.align || 'center') as 'start' | 'center' | 'end' | 'space-between';
          const gap = typeof comp.data.gap === 'number' ? comp.data.gap : 8;
          const selectionSourceId = typeof comp.data.selectionSourceId === 'string'
            ? comp.data.selectionSourceId
            : undefined;
          const selectedCardIds = selectionSourceId
            ? (selectedCardIdsByComponent[selectionSourceId] ?? [])
            : [];
          const actionContext: Record<string, unknown> = {
            componentId: comp.id,
            componentType: comp.type,
            currentPlayerId: currentPlayerId ?? null,
            playerIds: derivedPlayerIds,
            selectionSourceId: selectionSourceId ?? null,
            selectedCardIds,
          };

          const containerClassName = showFrame
            ? 'relative border border-slate-600/50 rounded bg-slate-900/40 p-2'
            : 'relative p-1';
          return (
            <div key={comp.id} style={style} className={containerClassName}>
              {visibleActions.length === 0 ? (
                <div className="flex items-center justify-center h-full text-slate-500 text-xs">
                  {String(comp.data.name || '操作栏')} (无动作)
                </div>
              ) : (
                <ActionBarSkeleton
                  actions={visibleActions}
                  layout={layout}
                  align={align}
                  gap={gap}
                  renderAction={(action, onClick) => {
                    const variant = action.variant || 'secondary';
                    const disabled = Boolean(action.disabled);
                    const baseClass = 'px-3 py-1 rounded text-xs transition-colors';
                    const variantClass = variant === 'primary'
                      ? 'bg-amber-600/80 hover:bg-amber-500 text-white'
                      : variant === 'ghost'
                        ? 'bg-transparent border border-slate-500 text-slate-200 hover:border-amber-400'
                        : 'bg-slate-700 hover:bg-slate-600 text-slate-100';
                    return (
                      <button
                        type="button"
                        onClick={onClick}
                        disabled={disabled}
                        className={`${baseClass} ${variantClass} ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
                      >
                        {action.label || '动作'}
                      </button>
                    );
                  }}
                  onAction={(action) => onAction?.(action, actionContext)}
                />
              )}
            </div>
          );
        }

        if (comp.type === 'phase-hud') {
          const phases = Array.isArray(comp.data.phases)
            ? (comp.data.phases as Array<{ id: string; label: string }>)
            : [];
          const showFrame = comp.data.showFrame !== false;
          if (phases.length === 0) {
            const emptyClassName = showFrame
              ? 'border border-slate-600/50 rounded bg-slate-900/40 p-2'
              : 'p-1';
            return (
              <div key={comp.id} style={style} className={emptyClassName}>
                <span className="text-slate-400 text-xs">{String(comp.data.name || '阶段提示')} (无阶段)</span>
              </div>
            );
          }

          const useRuntimeState = comp.data.useRuntimeState !== false;
          const runtimePhaseId = useRuntimeState && typeof runtimeState?.phase === 'string'
            ? runtimeState.phase
            : undefined;
          const currentPhaseId = runtimePhaseId
            || (typeof comp.data.currentPhaseId === 'string'
              ? comp.data.currentPhaseId
              : phases[0]?.id);
          const statusText = typeof comp.data.statusText === 'string' ? comp.data.statusText : undefined;
          const runtimePlayerId = useRuntimeState && runtimeState?.activePlayerId
            ? String(runtimeState.activePlayerId)
            : undefined;
          const playerSchemaId = typeof comp.data.bindSchema === 'string'
            ? comp.data.bindSchema
            : undefined;
          const playerIdField = typeof comp.data.playerIdField === 'string' ? comp.data.playerIdField : 'id';
          const playerNameField = typeof comp.data.playerNameField === 'string' ? comp.data.playerNameField : 'name';
          const playerLabelPrefix = typeof comp.data.playerLabelPrefix === 'string' ? comp.data.playerLabelPrefix : '当前玩家: ';
          const resolvePlayerName = (schemaId?: string) => {
            if (!runtimePlayerId) return undefined;
            const items = schemaId ? previewInstances[schemaId] : undefined;
            if (items && items.length > 0) {
              const matched = items.find(item => String((item as Record<string, unknown>)[playerIdField] ?? '') === runtimePlayerId);
              if (matched) {
                const record = matched as Record<string, unknown>;
                const explicit = record[playerNameField];
                if (typeof explicit === 'string' && explicit.trim()) return explicit;
                const fallback = record.name || record.displayName || record.label;
                if (typeof fallback === 'string' && fallback.trim()) return fallback;
              }
            }
            return undefined;
          };
          let resolvedPlayerName = resolvePlayerName(playerSchemaId);
          if (!resolvedPlayerName && !playerSchemaId) {
            for (const [schemaId] of Object.entries(previewInstances)) {
              resolvedPlayerName = resolvePlayerName(schemaId);
              if (resolvedPlayerName) break;
            }
          }
          const runtimePlayerLabel = runtimePlayerId
            ? `${playerLabelPrefix}${resolvedPlayerName || runtimePlayerId}`
            : undefined;
          const currentPlayerLabel = runtimePlayerLabel
            || (typeof comp.data.currentPlayerLabel === 'string'
              ? comp.data.currentPlayerLabel
              : undefined);
          const orientation = (comp.data.orientation === 'vertical' ? 'vertical' : 'horizontal') as 'vertical' | 'horizontal';
          const alignMode = comp.data.align === 'right'
            ? 'right'
            : comp.data.align === 'center'
              ? 'center'
              : 'left';
          const alignClassName = alignMode === 'right'
            ? 'items-end text-right'
            : alignMode === 'center'
              ? 'items-center text-center'
              : 'items-start text-left';

          const frameClassName = showFrame
            ? 'border border-slate-600/50 rounded bg-slate-900/40 p-2'
            : 'p-1';
          return (
            <div key={comp.id} style={style} className={frameClassName}>
              <PhaseHudSkeleton
                phases={phases}
                currentPhaseId={currentPhaseId}
                statusText={statusText}
                currentPlayerLabel={currentPlayerLabel}
                orientation={orientation}
                renderPhaseItem={(phase, isActive) => (
                  <div
                    className={`px-2 py-0.5 rounded text-[10px] ${isActive ? 'bg-amber-500/80 text-white' : 'bg-slate-700 text-slate-200'}`}
                  >
                    {phase.label}
                  </div>
                )}
                renderStatus={(text) => text ? (
                  <div className="text-[10px] text-slate-300">{text}</div>
                ) : null}
                renderCurrentPlayer={(label) => label ? (
                  <div className="text-[10px] text-amber-200">{label}</div>
                ) : null}
                className={`flex flex-col gap-2 ${alignClassName}`}
              />
            </div>
          );
        }

        // 区域组件（hand-zone, play-zone 等）- 使用通用框架 HandAreaSkeleton
        if (['hand-zone', 'play-zone', 'deck-zone', 'discard-zone'].includes(comp.type)) {
          // 区域组件使用 bindSchema，渲染组件使用 targetSchema
          const targetSchemaId = (comp.data.bindSchema || comp.data.targetSchema) as string | undefined;
          const layoutCode = comp.data.layoutCode as string | undefined;
          const selectEffectCode = comp.data.selectEffectCode as string | undefined;
          const sortCode = comp.data.sortCode as string | undefined;
          const filterCode = comp.data.filterCode as string | undefined;
          const rawInteractionMode = comp.data.interactionMode as 'drag' | 'click' | 'both' | undefined;
          const interactionMode = rawInteractionMode === 'drag' || rawInteractionMode === 'click' || rawInteractionMode === 'both'
            ? rawInteractionMode
            : 'click';
          const bindEntity = comp.data.bindEntity as string | undefined;
          const zoneField = comp.data.zoneField as string | undefined;
          const zoneValue = typeof comp.data.zoneValue === 'string' ? comp.data.zoneValue : undefined;
          const schemaDefaultRenderComponentId = targetSchemaId && schemaDefaults
            ? schemaDefaults[targetSchemaId]
            : undefined;
          const fallbackRenderComponentId = (
            comp.data.itemRenderComponentId ||
            comp.data.renderComponentId ||
            comp.renderComponentId ||
            schemaDefaultRenderComponentId
          ) as string | undefined;
          const renderFaceMode = String(comp.data.renderFaceMode || 'auto') as 'auto' | 'front' | 'back';
          const allowActionHooks = comp.data.allowActionHooks !== false;
          const showFrame = comp.data.showFrame !== false;
          
          // 获取关联数据
          const items = targetSchemaId ? (previewInstances[targetSchemaId] || []) : [];
          let resolvedItems = items;
          let filterContext: {
            playerIds: string[];
            currentPlayerId: string | null;
            currentPlayerIndex: number;
            resolvedPlayerId: string | null;
            resolvedPlayerIndex: number;
            bindEntity?: string;
            zoneField?: string;
            zoneValue?: string;
          } | undefined;

          if (comp.type === 'hand-zone') {
            const targetPlayerRef = String(comp.data.targetPlayerRef || 'current') as
              | 'self'
              | 'other'
              | 'current'
              | 'next'
              | 'prev'
              | 'offset'
              | 'index'
              | 'id'
              | undefined;
            const targetPlayerIndex = typeof comp.data.targetPlayerIndex === 'number'
              ? comp.data.targetPlayerIndex
              : Number(comp.data.targetPlayerIndex ?? 0);
            const explicitPlayerIds = Array.isArray(comp.data.playerIds)
              ? (comp.data.playerIds as string[])
              : undefined;
            const runtimePlayerIds = Array.isArray(playerIds)
              ? playerIds.map(id => String(id)).filter(Boolean)
              : [];
            const normalizedCurrentPlayerId = typeof currentPlayerId === 'string' && currentPlayerId.trim()
              ? String(currentPlayerId)
              : undefined;
            const derivedPlayerIdsFromData = bindEntity
              ? Array.from(new Set(
                items
                  .map(item => {
                    const value = (item as Record<string, unknown>)[bindEntity];
                    if (typeof value === 'string' || typeof value === 'number') return String(value);
                    return null;
                  })
                  .filter((value): value is string => Boolean(value))
              ))
              : [];
            const hasRuntimeOverlap = runtimePlayerIds.some(id =>
              derivedPlayerIdsFromData.includes(id)
              || (explicitPlayerIds?.includes(id) ?? false)
              || derivedPlayerIds.includes(id)
            );
            const useRuntimePlayerIds = runtimePlayerIds.length > 0
              && (!normalizedCurrentPlayerId || runtimePlayerIds.includes(normalizedCurrentPlayerId))
              && hasRuntimeOverlap;
            const resolvedPlayerIds = useRuntimePlayerIds
              ? runtimePlayerIds
              : (explicitPlayerIds && explicitPlayerIds.length > 0)
                ? explicitPlayerIds
                : (derivedPlayerIds.length > 0 ? derivedPlayerIds : derivedPlayerIdsFromData);
            const resolvedCurrentPlayerId = normalizedCurrentPlayerId && resolvedPlayerIds.includes(normalizedCurrentPlayerId)
              ? normalizedCurrentPlayerId
              : (comp.data.currentPlayerId as string | undefined);
            const playerContext = resolvePlayerContext({
              items,
              playerRef: targetPlayerRef,
              index: targetPlayerIndex,
              currentPlayerId: resolvedCurrentPlayerId,
              playerIds: resolvedPlayerIds.length > 0 ? resolvedPlayerIds : undefined,
              idField: bindEntity,
            });
            const normalizedZoneValue = zoneValue?.trim() || '';
            filterContext = {
              ...playerContext,
              bindEntity,
              zoneField,
              zoneValue: normalizedZoneValue || undefined,
            };

            if (bindEntity && playerContext.resolvedPlayerId) {
              resolvedItems = resolvedItems.filter(item => {
                const value = (item as Record<string, unknown>)[bindEntity];
                if (typeof value === 'string' || typeof value === 'number') {
                  return String(value) === String(playerContext.resolvedPlayerId);
                }
                return false;
              });
            }

            if (zoneField && normalizedZoneValue) {
              resolvedItems = resolvedItems.filter(item => {
                const value = (item as Record<string, unknown>)[zoneField];
                if (typeof value === 'string' || typeof value === 'number') {
                  return String(value) === normalizedZoneValue;
                }
                return false;
              });
            }
          }
          
          // 如果没有数据，显示占位
          if (resolvedItems.length === 0) {
            const emptyClassName = showFrame
              ? 'border-2 border-dashed border-slate-600 rounded flex items-center justify-center'
              : 'flex items-center justify-center';
            return (
              <div key={comp.id} style={style} className={emptyClassName}>
                <span className="text-slate-400 text-xs">{String(comp.data.name || comp.type)} (无数据)</span>
              </div>
            );
          }
          
          // 使用通用框架 HandAreaSkeleton 渲染
          const resolvedShowBack = renderFaceMode === 'back'
            ? true
            : renderFaceMode === 'front'
              ? false
              : showBack;
          const actions = Array.isArray(comp.data.actions)
            ? (comp.data.actions as ZoneAction[])
            : [];
          const isCurrentPlayer = Boolean(
            filterContext?.currentPlayerId &&
            filterContext?.resolvedPlayerId &&
            filterContext.currentPlayerId === filterContext.resolvedPlayerId
          );
          const visibleActions = getVisibleActions({
            actions,
            allowActionHooks,
            isCurrentPlayer,
          });
          const selectedCardIds = selectedCardIdsByComponent[comp.id] ?? [];
          const actionContext: Record<string, unknown> = {
            componentId: comp.id,
            componentType: comp.type,
            currentPlayerId: filterContext?.currentPlayerId ?? null,
            resolvedPlayerId: filterContext?.resolvedPlayerId ?? null,
            resolvedPlayerIndex: filterContext?.resolvedPlayerIndex ?? -1,
            selectedCardIds,
          };
          const canInteract = interactive && isCurrentPlayer;
          const canSelect = canInteract && (interactionMode === 'click' || interactionMode === 'both');
          const canDrag = canInteract && (interactionMode === 'drag' || interactionMode === 'both');

          const zoneFrameClassName = showFrame
            ? 'border border-slate-600/50 rounded bg-slate-800/30'
            : '';
          return (
            <div
              key={comp.id}
              style={style}
              data-component-id={comp.id}
              className={`relative overflow-hidden ${zoneFrameClassName}`}
            >
              <HandAreaSkeleton
                cards={resolvedItems}
                canDrag={canDrag}
                canSelect={canSelect}
                interactionMode={interactionMode}
                selectedCardIds={selectedCardIds}
                onSelectChange={(cardId, selected) => handleSelectChange(comp.id, cardId, selected)}
                onPlayCard={onPlayCard ? cardId => onPlayCard(cardId, actionContext) : undefined}
                onSellCard={onSellCard ? cardId => onSellCard(cardId, actionContext) : undefined}
                layoutCode={layoutCode}
                selectEffectCode={selectEffectCode}
                sortCode={sortCode}
                filterCode={filterCode}
                filterContext={filterContext}
                className="h-full flex items-center justify-center"
                renderCard={(item, _index, _isSelected) => {
                  const itemRecord = item as Record<string, unknown>;
                  const itemRenderComponentId = (itemRecord.renderComponentId as string | undefined) || fallbackRenderComponentId;
                  const itemRenderInstance = itemRenderComponentId
                    ? renderComponentInstances.find(rc => rc.id === itemRenderComponentId)
                    : undefined;
                  const itemRenderComponent = !itemRenderInstance && itemRenderComponentId
                    ? renderComponents.find(rc => rc.id === itemRenderComponentId)
                    : undefined;
                  const itemRenderCode = (itemRenderInstance?.data.renderCode as string | undefined) || itemRenderComponent?.renderCode;
                  const itemBackRenderCode = (itemRenderInstance?.data.backRenderCode as string | undefined) || itemRenderComponent?.backRenderCode;

                  return (
                    <div className="w-16 h-24 bg-white rounded shadow-md border border-gray-300 flex items-center justify-center text-xs">
                      {itemRenderCode ? (
                        <RenderPreview
                          renderCode={itemRenderCode}
                          backRenderCode={itemBackRenderCode}
                          showBack={resolvedShowBack}
                          data={itemRecord}
                          className="w-full h-full"
                        />
                      ) : (
                        <span className="text-gray-600 text-center px-1">未绑定渲染组件</span>
                      )}
                    </div>
                  );
                }}
              />
              {onAction && comp.type === 'hand-zone' && visibleActions.length > 0 && (
                <div className="absolute bottom-2 right-2 flex flex-wrap gap-1">
                  {visibleActions.map(action => (
                    <button
                      key={action.id}
                      className="px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded text-[10px]"
                      onClick={() => onAction?.(action, actionContext)}
                    >
                      {action.label || '未命名动作'}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        }

        // 通用组件渲染：如果有 renderCode，使用它渲染
        const componentRenderCode = comp.data.renderCode as string | undefined;
        if (componentRenderCode) {
          // 组件上下文只包含通用字段 + 组件配置 + 绑定的Schema实例数据
          const bindSchemaId = (comp.data.bindSchema || comp.data.targetSchema) as string | undefined;
          const boundData = bindSchemaId ? (previewInstances[bindSchemaId] || []) : [];
          const resolvedCurrentPlayerId = typeof currentPlayerId === 'string' && currentPlayerId.trim()
            ? currentPlayerId
            : (comp.data.currentPlayerId as string | undefined);
          const resolvedPlayerIds = Array.isArray(playerIds) && playerIds.length > 0
            ? playerIds.map(id => String(id)).filter(Boolean)
            : (Array.isArray(comp.data.playerIds)
              ? (comp.data.playerIds as string[])
              : (derivedPlayerIds.length > 0 ? derivedPlayerIds : undefined));
          const playerContext = comp.type === 'player-area'
            ? resolvePlayerContext({
              items: boundData,
              playerRef: comp.data.playerRef as
                | 'self'
                | 'other'
                | 'current'
                | 'next'
                | 'prev'
                | 'offset'
                | 'index'
                | 'id'
                | undefined,
              offset: Number(comp.data.playerRefOffset || 0),
              index: typeof comp.data.playerRefIndex === 'number'
                ? comp.data.playerRefIndex
                : Number(comp.data.playerRefIndex ?? 0),
              playerRefId: comp.data.playerRefId as string | undefined,
              currentPlayerId: resolvedCurrentPlayerId,
              playerIds: resolvedPlayerIds,
              idField: comp.data.playerIdField as string | undefined,
            })
            : null;
          const isCurrentPlayer = playerContext
            ? Boolean(
              playerContext.currentPlayerId &&
              playerContext.resolvedPlayerId === playerContext.currentPlayerId
            )
            : false;
          const componentContext: Record<string, unknown> = {
            // 通用字段
            type: comp.type,
            name: comp.data.name,
            width: comp.width,
            height: comp.height,
            // 组件配置数据
            ...comp.data,
            // 绑定的Schema实例数据（用户可以通过Schema定义任意字段）
            items: boundData,
            itemCount: boundData.length,
            outputsByType,
            outputsById,
            renderComponentIndex,
            renderByComponentId,
            ...(playerContext
              ? {
                playerIds: playerContext.playerIds,
                currentPlayerId: playerContext.currentPlayerId,
                currentPlayerIndex: playerContext.currentPlayerIndex,
                resolvedPlayerId: playerContext.resolvedPlayerId,
                resolvedPlayerIndex: playerContext.resolvedPlayerIndex,
                resolvedPlayer: playerContext.resolvedPlayer,
                player: playerContext.resolvedPlayer,
                isCurrentPlayer,
                isCurrentTurn: isCurrentPlayer,
              }
              : {}),
          };
          
          return (
            <div key={comp.id} style={style}>
              <RenderPreview
                renderCode={componentRenderCode}
                data={componentContext}
                className="w-full h-full"
              />
            </div>
          );
        }

        // 无渲染代码时显示占位符
        return (
          <div
            key={comp.id}
            style={style}
            className="border-2 border-dashed border-slate-600 rounded flex items-center justify-center"
          >
            <span className="text-slate-400 text-xs">{String(comp.data.name || comp.type)}</span>
          </div>
        );
      })}
    </div>
  );
}
