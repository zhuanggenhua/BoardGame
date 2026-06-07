/**
 * 架构可视化工具 v9 — 单主视图 + 子视图
 *
 * 主视图: 事件驱动分层架构全景 — 节点 + 跨层连线 + 流动动画
 * 子视图: 管线 / 系统 / 测试双轨 / 用户故事
 * 路由: /dev/arch
 */
import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useRuntimeViewport } from '../../hooks/ui/useRuntimeViewport';
import {
  type ArchNode,
  NODES, EDGES, LAYER_BANDS, NODE_MAP,
  SVG_W, SVG_H, nodeRect, bandRect, edgePath,
  TRUNK_EDGE_IDS, STORY_EDGE_IDS, storyEdgeColor,
  PRIMITIVE_ITEMS, PIPELINE_STEPS, SYSTEM_ITEMS,
  TEST_FLOW_STEPS, E2E_TEST_STEPS, INTEGRITY_TEST_STEPS,
  INTERACTION_AUDIT_STEPS,
  AI_AUDIT_STEPS,
  USER_STORY_STEPS,
  C4_CONTEXT, C4_CONTEXT_LINKS, CONTAINER_LINKS, LAYER_SUMMARIES,
  OVERVIEW_LAYERS, OVERVIEW_FLOW, OVERVIEW_CROSS_LINKS,
} from './arch/archData';

// ============================================================================
// 缩放/平移容器 — 滚轮缩放 + 拖拽平移 + 控制按钮
// ============================================================================

interface ZoomableSvgProps {
  viewBox: string;
  maxHeight?: string;
  className?: string;
  children: React.ReactNode;
}

type ArchitectureViewTranslate = (key: string, options?: Record<string, unknown>) => string;

const getArchitectureViewStoryLayerLabel = (t: ArchitectureViewTranslate, layer: string): string => {
  switch (layer) {
    case 'game':
      return t('devtools.architectureView.story.layer_game');
    case 'engine':
      return t('devtools.architectureView.story.layer_engine');
    case 'core':
      return t('devtools.architectureView.story.layer_core');
    case 'ui':
      return t('devtools.architectureView.story.layer_ui');
    case 'server':
      return t('devtools.architectureView.story.layer_server');
    default:
      return layer;
  }
};

const getArchitectureViewHookLabel = (t: ArchitectureViewTranslate, hook: string): string => {
  switch (hook) {
    case '前置':
      return t('devtools.architectureView.systems.hook_before_short');
    case '后置':
      return t('devtools.architectureView.systems.hook_after_short');
    case '前置+后置':
      return t('devtools.architectureView.systems.hook_both_short');
    default:
      return hook;
  }
};

function ZoomableSvg({ viewBox, maxHeight = 'calc(100vh - 120px)', className = 'w-full', children }: ZoomableSvgProps) {
  const { t } = useTranslation('lobby');
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, tx: 0, ty: 0 });

  // 非 passive 的 wheel 监听（React 合成事件默认 passive，无法 preventDefault）
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      setScale(s => Math.min(5, Math.max(0.3, s * delta)));
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // 中键或 Ctrl+左键 开始拖拽
    if (e.button === 1 || (e.button === 0 && e.ctrlKey)) {
      e.preventDefault();
      setIsDragging(true);
      dragStart.current = { x: e.clientX, y: e.clientY, tx: translate.x, ty: translate.y };
    }
  }, [translate]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    setTranslate({ x: dragStart.current.tx + dx, y: dragStart.current.ty + dy });
  }, [isDragging]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // 全局 mouseup 防止拖出容器后卡住
  useEffect(() => {
    if (!isDragging) return;
    const up = () => setIsDragging(false);
    window.addEventListener('mouseup', up);
    return () => window.removeEventListener('mouseup', up);
  }, [isDragging]);

  const resetZoom = useCallback(() => {
    setScale(1);
    setTranslate({ x: 0, y: 0 });
  }, []);

  return (
    <div ref={containerRef} style={{ position: 'relative', overflow: 'hidden', maxHeight, cursor: isDragging ? 'grabbing' : undefined }}>
      {/* 缩放控制按钮 */}
      <div style={{ position: 'absolute', top: 8, right: 8, zIndex: 10, display: 'flex', gap: 4 }}>
        <button
          onClick={() => setScale(s => Math.min(5, s * 1.2))}
          style={{ width: 28, height: 28, borderRadius: 6, background: '#21262d', border: '1px solid #30363d', color: '#c9d1d9', fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          title={t('devtools.architectureView.zoom.zoom_in')}
        >+</button>
        <button
          onClick={() => setScale(s => Math.max(0.3, s * 0.8))}
          style={{ width: 28, height: 28, borderRadius: 6, background: '#21262d', border: '1px solid #30363d', color: '#c9d1d9', fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          title={t('devtools.architectureView.zoom.zoom_out')}
        >−</button>
        <button
          onClick={resetZoom}
          style={{ height: 28, borderRadius: 6, background: '#21262d', border: '1px solid #30363d', color: '#8b949e', fontSize: 10, cursor: 'pointer', padding: '0 8px' }}
          title={t('devtools.architectureView.zoom.reset')}
        >{Math.round(scale * 100)}%</button>
      </div>
      <svg
        viewBox={viewBox}
        className={className}
        style={{
          maxHeight,
          transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
          transformOrigin: 'center top',
          transition: isDragging ? 'none' : 'transform 0.15s ease-out',
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      >
        {children}
      </svg>
    </div>
  );
}

// ============================================================================
// 视图模式
// ============================================================================

type ViewMode = 'overview' | 'full' | 'sub-pipeline' | 'sub-systems' | 'sub-testing' | 'story' | 'c4-context' | 'c4-container' | 'layer-detail';

// ============================================================================
// 主组件
// ============================================================================

const ArchitectureView: React.FC = () => {
  const { t } = useTranslation('lobby');
  const viewport = useRuntimeViewport();
  const isCompactViewport = viewport.width > 0 && viewport.width <= 900;
  const [viewMode, setViewMode] = useState<ViewMode>('overview');
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<ArchNode | null>(null);
  const [detailLayer, setDetailLayer] = useState<string>('core');

  // 选中节点的上下游
  const selectedDeps = useMemo(() => {
    if (!selectedNode) return null;
    return {
      upstream: EDGES.filter(e => e.to === selectedNode.id).map(e => ({ ...e, node: NODE_MAP.get(e.from)! })),
      downstream: EDGES.filter(e => e.from === selectedNode.id).map(e => ({ ...e, node: NODE_MAP.get(e.to)! })),
    };
  }, [selectedNode]);

  const handleNodeClick = useCallback((n: ArchNode, evt: React.MouseEvent) => {
    evt.stopPropagation();
    if (n.expandable === 'pipeline') { setViewMode('sub-pipeline'); return; }
    if (n.expandable === 'systems') { setViewMode('sub-systems'); return; }
    if (n.expandable === 'testing') { setViewMode('sub-testing'); return; }
    setSelectedNode(prev => prev?.id === n.id ? null : n);
  }, []);

  const closePop = useCallback(() => setSelectedNode(null), []);

  // ========================================================================
  // 主视图: 简化5层 + 主线流动 + 跨层弧线
  // ========================================================================
  if (viewMode === 'overview') {
    const layers = OVERVIEW_LAYERS;
    const flow = OVERVIEW_FLOW;
    const crossLinks = OVERVIEW_CROSS_LINKS;

    // 布局参数
    const vw = 860, cardW = 500, cardH = 100, gap = 52;
    const cardX = 180, startY = 70;
    const vh = startY + layers.length * (cardH + gap) + 40;
    // 流动步骤映射到层间的箭头位置
    const flowLayerMap = [0, 0, 1, 2, 3, 4]; // 每个 flow step 关联的层索引
    const layerY = (idx: number) => startY + idx * (cardH + gap);

    // 钻取处理
    const handleLayerClick = (layerId: string) => {
      if (layerId === 'engine') { setViewMode('sub-pipeline'); return; }
      if (layerId === 'game') { setViewMode('story'); return; }
      setDetailLayer(layerId);
      setViewMode('layer-detail');
    };

    return (
      <div className="min-h-screen bg-[#0d1117] text-slate-200 p-4">
        <div className="mb-3 flex items-center gap-3 flex-wrap">
          <h1 className="text-lg font-bold text-white">{t('devtools.architectureView.overview.title')}</h1>
          <span className="text-xs text-slate-500">{t('devtools.architectureView.overview.subtitle')}</span>
          <div className="ml-auto flex gap-2">
            <button className="text-sm px-3 py-1 rounded bg-orange-900/40 text-orange-400 border border-orange-700/40 hover:bg-orange-900/60"
              onClick={() => setViewMode('full')}>{t('devtools.architectureView.overview.full_button')}</button>
            <button className="text-sm px-3 py-1 rounded bg-blue-900/40 text-blue-400 border border-blue-700/40 hover:bg-blue-900/60"
              onClick={() => setViewMode('c4-context')}>{t('devtools.architectureView.overview.c4_context_button')}</button>
            <button className="text-sm px-3 py-1 rounded bg-purple-900/40 text-purple-400 border border-purple-700/40 hover:bg-purple-900/60"
              onClick={() => setViewMode('c4-container')}>{t('devtools.architectureView.overview.c4_container_button')}</button>
            <button className="text-sm px-3 py-1 rounded bg-green-900/40 text-green-400 border border-green-700/40 hover:bg-green-900/60"
              onClick={() => setViewMode('story')}>{t('devtools.architectureView.overview.story_button')}</button>
          </div>
        </div>
        <ZoomableSvg viewBox={`0 0 ${vw} ${vh}`} maxHeight="calc(100vh - 80px)">
          <style>{`
            @keyframes archFadeIn { from { opacity: 0 } }
            @keyframes flowDot { 0% { offset-distance: 0% } 100% { offset-distance: 100% } }
          `}</style>
          <defs>
            <marker id="ov-arr" viewBox="0 0 10 10" markerWidth="7" markerHeight="7" refX="9" refY="5" orient="auto" markerUnits="userSpaceOnUse">
              <path d="M2,2 L8,5 L2,8" fill="none" stroke="#e3b341" strokeWidth="1.5" strokeLinecap="round" />
            </marker>
            <marker id="ov-cross" viewBox="0 0 10 10" markerWidth="7" markerHeight="7" refX="9" refY="5" orient="auto" markerUnits="userSpaceOnUse">
              <path d="M2,2 L8,5 L2,8" fill="none" stroke="#6e7681" strokeWidth="1.5" strokeLinecap="round" />
            </marker>
          </defs>

          {/* ── 左侧：主线流动箭头 + 步骤标签 ── */}
          {flow.map((step, i) => {
            const li = flowLayerMap[i];
            // 箭头起点：层卡片中间偏左
            const arrowX = cardX - 40;
            const y = layerY(li) + (i === 0 ? 20 : cardH / 2);
            // 下一步的 y
            const nextLi = flowLayerMap[i + 1] ?? li;
            const nextY = i < flow.length - 1
              ? layerY(nextLi) + (i + 1 === 0 ? 20 : cardH / 2)
              : y + 40;
            const labelX = 16;
            return (
              <g key={`flow-${i}`} style={{ animation: `archFadeIn 0.4s ease ${0.2 + i * 0.12}s both` }}>
                {/* 步骤标签 */}
                <text x={labelX} y={y + 4} fontSize={12}>{step.emoji}</text>
                <text x={labelX + 18} y={y} fontSize={10} fontWeight={700} fill="#e3b341">{step.label}</text>
                <text x={labelX + 18} y={y + 14} fontSize={8} fill="#8b949e">{step.detail}</text>
                {/* 弧线箭头（连到下一步） */}
                {i < flow.length - 1 && (() => {
                  const sy = y + 20, ey = nextY - 14;
                  const midY = (sy + ey) / 2;
                  const curveX = arrowX + 16;
                  const pathD = `M${arrowX},${sy} C${curveX},${midY - 10} ${curveX},${midY + 10} ${arrowX},${ey}`;
                  return (
                    <>
                      <path d={pathD} fill="none" stroke="#e3b341" strokeWidth={1.5} strokeOpacity={0.5} markerEnd="url(#ov-arr)" />
                      <circle r={2.5} fill="#e3b341" fillOpacity={0.9}>
                        <animateMotion dur="2s" repeatCount="indefinite" path={pathD} />
                      </circle>
                    </>
                  );
                })()}
              </g>
            );
          })}

          {/* ── 中间：5 层卡片 ── */}
          {layers.map((layer, i) => {
            const y = layerY(i);
            return (
              <g key={layer.id}
                style={{ cursor: 'pointer', animation: `archFadeIn 0.4s ease ${i * 0.1}s both` }}
                onClick={() => handleLayerClick(layer.id)}>
                {/* 卡片背景 */}
                <rect x={cardX} y={y} width={cardW} height={cardH} rx={12}
                  fill="#161b22" stroke={layer.color} strokeWidth={2}
                  style={{ transition: 'fill 0.2s' }} />
                {/* 顶部色带 */}
                <rect x={cardX + 1} y={y + 1} width={cardW - 2} height={5} rx={2}
                  fill={layer.color} fillOpacity={0.7} />
                {/* 序号 + 层名 */}
                <text x={cardX + 16} y={y + 30} fontSize={18}>{layer.emoji}</text>
                <text x={cardX + 44} y={y + 30} fontSize={15} fontWeight={700} fill={layer.color}>
                  {'①②③④⑤'[i]} {layer.label}
                </text>
                <text x={cardX + cardW - 14} y={y + 18} textAnchor="end" fontSize={8} fill={layer.color} opacity={0.5}>
                  {t('devtools.architectureView.overview.click_expand')}
                </text>
                {/* 做什么 */}
                <text x={cardX + 44} y={y + 50} fontSize={11} fill="#c9d1d9">{layer.whatItDoes}</text>
                {/* 没有它会怎样 */}
                <text x={cardX + 44} y={y + 66} fontSize={9} fill="#6e7681" fontStyle="italic">⚠ {layer.whyItExists}</text>
                {/* 标签 */}
                {layer.tags.map((tag, ti) => {
                  const tagX = cardX + 44 + ti * (tag.length * 8 + 20);
                  // 引擎层标签可直接钻取到子视图
                  const tagDrillMap: Record<string, ViewMode> = {
                    '8步管线': 'sub-pipeline',
                    '11个系统插件': 'sub-systems',
                    '5轨测试+AI审计': 'sub-testing',
                  };
                  const drillTarget = tagDrillMap[tag];
                  return (
                    <g key={ti}
                      style={drillTarget ? { cursor: 'pointer' } : undefined}
                      onClick={drillTarget ? (e) => { e.stopPropagation(); setViewMode(drillTarget); } : undefined}>
                      <rect x={tagX} y={y + 74} width={tag.length * 8 + 12} height={18} rx={4}
                        fill={drillTarget ? layer.color + '20' : layer.color + '12'}
                        stroke={drillTarget ? layer.color + '60' : layer.color + '30'} strokeWidth={0.8} />
                      <text x={tagX + 6} y={y + 86} fontSize={8} fill={layer.color}>{tag}</text>
                    </g>
                  );
                })}
              </g>
            );
          })}

          {/* ── 右侧：跨层弧线 ── */}
          {crossLinks.map((link, i) => {
            const fromIdx = layers.findIndex(l => l.id === link.from);
            const toIdx = layers.findIndex(l => l.id === link.to);
            if (fromIdx < 0 || toIdx < 0) return null;
            const fromY = layerY(fromIdx) + cardH / 2;
            const toY = layerY(toIdx) + cardH / 2;
            const arcX = cardX + cardW + 30 + i * 40;
            const pathD = `M${cardX + cardW},${fromY} C${arcX},${fromY} ${arcX},${toY} ${cardX + cardW},${toY}`;
            return (
              <g key={`cross-${i}`} style={{ animation: `archFadeIn 0.5s ease ${0.6 + i * 0.15}s both` }}>
                <path d={pathD} fill="none" stroke={link.color} strokeWidth={1.5}
                  strokeDasharray="6,4" strokeOpacity={0.6} markerEnd="url(#ov-cross)" />
                {/* 标签 */}
                <text x={arcX + 6} y={(fromY + toY) / 2 + 4} fontSize={8} fill={link.color} fontStyle="italic">
                  {link.label}
                </text>
                {/* 流动小球 */}
                <circle r={2} fill={link.color} fillOpacity={0.7}>
                  <animateMotion dur="3s" repeatCount="indefinite" path={pathD} />
                </circle>
              </g>
            );
          })}

          {/* ── 底部说明 ── */}
          <g style={{ animation: 'archFadeIn 0.5s ease 1s both' }}>
            <text x={cardX} y={vh - 14} fontSize={9} fill="#6e7681">
              {t('devtools.architectureView.overview.legend')}
            </text>
          </g>
        </ZoomableSvg>
      </div>
    );
  }

  // ========================================================================
  // 完整架构图: 所有节点 + 层级布局 + 流动动画（无箭头简洁版）
  // ========================================================================
  if (viewMode === 'full') {
    return (
      <div className="min-h-screen bg-[#0d1117] text-slate-200 p-4" onClick={() => { if (selectedNode) closePop(); else setViewMode('overview'); }}>
        <div className="mb-3 flex items-center gap-3">
          <button className="text-sm text-slate-400 hover:text-white" onClick={e => { e.stopPropagation(); setViewMode('overview'); }}>{t('devtools.architectureView.common.back')}</button>
          <h1 className="text-lg font-bold text-white">{t('devtools.architectureView.full.title')}</h1>
          <span className="text-xs text-slate-500">{t('devtools.architectureView.full.subtitle')}</span>
        </div>
        <ZoomableSvg viewBox={`0 0 ${SVG_W} ${SVG_H}`} maxHeight="calc(100vh - 80px)">
          <style>{`
            @keyframes flowPulse {
              0%, 100% { stroke-opacity: 0.2; }
              50% { stroke-opacity: 0.9; }
            }
            .flow-line { 
              animation: flowPulse 2.5s ease-in-out infinite;
            }
          `}</style>

          <defs>
            <linearGradient id="flowGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#e3b341" stopOpacity="0.1" />
              <stop offset="50%" stopColor="#e3b341" stopOpacity="1" />
              <stop offset="100%" stopColor="#e3b341" stopOpacity="0.1" />
            </linearGradient>
          </defs>

          {/* 层色带 */}
          {LAYER_BANDS.map(band => {
            const r = bandRect(band);
            return (
              <g key={band.id}>
                <rect x={r.x} y={r.y} width={r.w} height={r.h} fill={band.color + '08'} stroke={band.color + '30'} strokeWidth={1} rx={8} />
                <text x={r.x - 12} y={r.y + 18} fontSize={11} fill={band.color} fontWeight="600" textAnchor="end">{band.label}</text>
                <text x={r.x - 12} y={r.y + 32} fontSize={9} fill="#6e7681" textAnchor="end">{band.note}</text>
              </g>
            );
          })}

          {/* 主故事线流动动画（无箭头） */}
          {EDGES.filter((_, i) => STORY_EDGE_IDS.has(i)).map((edge, idx) => {
            const path = edgePath(edge);
            if (!path) return null;
            return (
              <path
                key={`story-${idx}`}
                d={path}
                stroke="#e3b341"
                strokeWidth={2.5}
                fill="none"
                className="flow-line"
                style={{ animationDelay: `${idx * 0.3}s` }}
              />
            );
          })}

          {/* 所有节点 */}
          {NODES.map(node => {
            const r = nodeRect(node);
            const hasDetail = node.details || node.iface || node.dataFlow || node.realExample;
            const hasExpand = node.expandable;
            const isHovered = hoveredNode === node.id;
            const isSelected = selectedNode?.id === node.id;

            return (
              <g
                key={node.id}
                onMouseEnter={() => setHoveredNode(node.id)}
                onMouseLeave={() => setHoveredNode(null)}
                onClick={(e) => handleNodeClick(node, e)}
                style={{ cursor: hasDetail || hasExpand ? 'pointer' : 'default' }}
              >
                <rect
                  x={r.x}
                  y={r.y}
                  width={r.w}
                  height={r.h}
                  fill={node.color + (isSelected ? '40' : isHovered ? '25' : '18')}
                  stroke={node.color + (isSelected ? 'cc' : isHovered ? '80' : '50')}
                  strokeWidth={isSelected ? 2.5 : isHovered ? 2 : 1.5}
                  strokeDasharray={node.dashed ? '5 3' : undefined}
                  rx={6}
                />
                <text x={r.x + r.w / 2} y={r.y + 18} fontSize={12} fill="white" fontWeight="600" textAnchor="middle">
                  {node.label}
                </text>
                <text x={r.x + r.w / 2} y={r.y + 34} fontSize={9} fill="#8b949e" textAnchor="middle">
                  {node.desc}
                </text>
                {hasExpand && (
                  <text x={r.x + r.w - 8} y={r.y + 14} fontSize={10} fill={node.color} textAnchor="end">🔍</text>
                )}
                {node.storyIndex && (
                  <>
                    <circle cx={r.x + 10} cy={r.y + 10} r={8} fill="#e3b341" />
                    <text x={r.x + 10} y={r.y + 14} fontSize={10} fill="#0d1117" fontWeight="700" textAnchor="middle">{node.storyIndex}</text>
                  </>
                )}
              </g>
            );
          })}
        </ZoomableSvg>

        {/* 节点详情弹窗 */}
        {selectedNode && selectedDeps && (
          <div
            style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              maxWidth: 700,
              maxHeight: '80vh',
              overflow: 'auto',
              background: '#161b22',
              border: '1px solid #30363d',
              borderRadius: 8,
              padding: 20,
              zIndex: 100,
              boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 12 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: 'white', margin: 0 }}>{selectedNode.label}</h3>
              <button onClick={closePop} style={{ background: 'none', border: 'none', color: '#8b949e', fontSize: 20, cursor: 'pointer', padding: 0, lineHeight: 1 }}>×</button>
            </div>
            <p style={{ fontSize: 12, color: '#8b949e', marginBottom: 16 }}>{selectedNode.desc}</p>

            {selectedNode.details && (
              <div style={{ marginBottom: 16 }}>
                <h4 style={{ fontSize: 13, fontWeight: 600, color: '#58a6ff', marginBottom: 8 }}>{t('devtools.architectureView.popup.details')}</h4>
                {selectedNode.details.map((d, i) => (
                  <p key={i} style={{ fontSize: 11, color: '#c9d1d9', marginBottom: 6, lineHeight: 1.5 }}>{d}</p>
                ))}
              </div>
            )}

            {selectedNode.iface && (
              <div style={{ marginBottom: 16 }}>
                <h4 style={{ fontSize: 13, fontWeight: 600, color: '#bc8cff', marginBottom: 8 }}>{t('devtools.architectureView.popup.interface_signature')}</h4>
                <pre style={{ fontSize: 10, color: '#c9d1d9', background: '#0d1117', padding: 10, borderRadius: 4, overflow: 'auto' }}>
                  {selectedNode.iface.join('\n')}
                </pre>
              </div>
            )}

            {selectedNode.dataFlow && (
              <div style={{ marginBottom: 16 }}>
                <h4 style={{ fontSize: 13, fontWeight: 600, color: '#3fb950', marginBottom: 8 }}>{t('devtools.architectureView.popup.data_flow')}</h4>
                {selectedNode.dataFlow.map((d, i) => (
                  <p key={i} style={{ fontSize: 11, color: '#c9d1d9', marginBottom: 6, lineHeight: 1.5 }}>→ {d}</p>
                ))}
              </div>
            )}

            {selectedNode.realExample && (
              <div style={{ marginBottom: 16 }}>
                <h4 style={{ fontSize: 13, fontWeight: 600, color: '#f0883e', marginBottom: 8 }}>{t('devtools.architectureView.popup.example')}</h4>
                <pre style={{ fontSize: 10, color: '#c9d1d9', background: '#0d1117', padding: 10, borderRadius: 4, overflow: 'auto' }}>
                  {selectedNode.realExample.join('\n')}
                </pre>
              </div>
            )}

            {selectedDeps.upstream.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <h4 style={{ fontSize: 13, fontWeight: 600, color: '#58a6ff', marginBottom: 8 }}>
                  {t('devtools.architectureView.popup.upstream', { count: selectedDeps.upstream.length })}
                </h4>
                {selectedDeps.upstream.map((e, i) => (
                  <div key={i} style={{ fontSize: 11, color: '#8b949e', marginBottom: 4 }}>
                    ← {e.node.label} {e.label && `(${e.label})`}
                  </div>
                ))}
              </div>
            )}

            {selectedDeps.downstream.length > 0 && (
              <div>
                <h4 style={{ fontSize: 13, fontWeight: 600, color: '#3fb950', marginBottom: 8 }}>
                  {t('devtools.architectureView.popup.downstream', { count: selectedDeps.downstream.length })}
                </h4>
                {selectedDeps.downstream.map((e, i) => (
                  <div key={i} style={{ fontSize: 11, color: '#8b949e', marginBottom: 4 }}>
                    → {e.node.label} {e.label && `(${e.label})`}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // ========================================================================
  // 深层: 管线 8 步流水线
  // ========================================================================
  if (viewMode === 'sub-pipeline') {
    const stepH = 72, stepW = 380, gap = 14, sysW = 260;
    const totalH = PIPELINE_STEPS.length * (stepH + gap) + 120;
    const vw = stepW + sysW + 180, vh = totalH;
    const sx = 80, sy = 70;
    return (
      <div className="min-h-screen bg-[#0d1117] text-slate-200 p-4" onClick={() => setViewMode('overview')}>
        <button className="mb-3 text-sm text-slate-400 hover:text-white" onClick={e => { e.stopPropagation(); setViewMode('overview'); }}>{t('devtools.architectureView.common.back')}</button>
        <h2 className="text-lg font-bold text-white mb-2">{t('devtools.architectureView.pipeline.title')}</h2>
        <p className="text-xs text-slate-500 mb-2">{t('devtools.architectureView.common.click_anywhere_back')}</p>
        <ZoomableSvg viewBox={`0 0 ${vw} ${vh}`}>
          <style>{`
            @keyframes archFadeIn { from { opacity: 0 } }
            @keyframes archDraw { to { stroke-dashoffset: 0 } }
          `}</style>
          <defs>
            <marker id="pa" viewBox="0 0 10 10" markerWidth="8" markerHeight="8" refX="9" refY="5" orient="auto" markerUnits="userSpaceOnUse">
              <path d="M2,2 L8,5 L2,8" fill="none" stroke="#f0883e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </marker>
            <marker id="ph" viewBox="0 0 10 10" markerWidth="8" markerHeight="8" refX="9" refY="5" orient="auto" markerUnits="userSpaceOnUse">
              <path d="M2,2 L8,5 L2,8" fill="none" stroke="#f778ba" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </marker>
          </defs>
          <text x={sx} y={sy - 24} fontSize={11} fontWeight={600} fill="#e3b341">{t('devtools.architectureView.pipeline.example_scenario')}</text>
          {PIPELINE_STEPS.map((step, i) => {
            const x = sx, y = sy + i * (stepH + gap);
            return (
              <g key={i} style={{ animation: `archFadeIn 0.4s ease ${i * 0.07}s both` }}>
                <rect x={x} y={y} width={stepW} height={stepH} rx={10} fill="#161b22" stroke="#f0883e" strokeWidth={1.2} />
                <text x={x + 14} y={y + 22} fontSize={18} fill="#f0883e">{step.emoji}</text>
                <text x={x + 42} y={y + 22} fontSize={13} fontWeight={700} fill="#f0883e">
                  {`${'\u24ea\u2460\u2461\u2462\u2463\u2464\u2465\u2466\u2467'[i + 1] ?? ''} ${step.label}`}
                </text>
                <text x={x + 42} y={y + 40} fontSize={10} fill="#8b949e">{step.desc}</text>
                {step.example && (
                  <text x={x + 42} y={y + 56} fontSize={9} fill="#e3b341">🎲 {step.example}</text>
                )}
                {i < PIPELINE_STEPS.length - 1 && (
                  <line x1={x + stepW / 2} y1={y + stepH} x2={x + stepW / 2} y2={y + stepH + gap}
                    stroke="#f0883e" strokeWidth={2.5} markerEnd="url(#pa)"
                    style={{ strokeDasharray: 20, strokeDashoffset: 20, animation: `archDraw 0.3s ease ${i * 0.07 + 0.3}s forwards` }} />
                )}
                {step.systems && step.systems.length > 0 && (
                  <g>
                    <line x1={x + stepW} y1={y + stepH / 2} x2={x + stepW + 20} y2={y + stepH / 2} stroke="#58a6ff" strokeWidth={1} strokeDasharray="4,3" />
                    <rect x={x + stepW + 22} y={y + 2} width={sysW} height={stepH - 4} rx={6} fill="#161b22" stroke="#58a6ff" strokeWidth={0.8} strokeOpacity={0.5} />
                    <text x={x + stepW + 32} y={y + 18} fontSize={10} fontWeight={600} fill="#58a6ff">{t('devtools.architectureView.pipeline.involved_systems')}</text>
                    {step.systems.map((s, si) => (
                      <text key={si} x={x + stepW + 32 + (si % 2) * 125} y={y + 34 + Math.floor(si / 2) * 13} fontSize={9} fill="#8b949e">{s}</text>
                    ))}
                  </g>
                )}
              </g>
            );
          })}
          {(() => {
            const haltFromY = sy + 1 * (stepH + gap) + stepH / 2;
            const haltToY = sy + 5 * (stepH + gap) + stepH / 2;
            const hx = sx - 44;
            return (
              <g style={{ animation: 'archFadeIn 0.6s ease 0.5s both' }}>
                <path d={`M${sx},${haltFromY} C${hx},${haltFromY} ${hx},${haltToY} ${sx},${haltToY}`} fill="none" stroke="#f778ba" strokeWidth={1.5} strokeDasharray="6,4" markerEnd="url(#ph)" />
                <text x={hx - 2} y={(haltFromY + haltToY) / 2 - 6} textAnchor="middle" fontSize={8} fill="#f778ba">{t('devtools.architectureView.pipeline.halt_intercept')}</text>
                <text x={hx - 2} y={(haltFromY + haltToY) / 2 + 6} textAnchor="middle" fontSize={8} fill="#f778ba">{t('devtools.architectureView.pipeline.halt_skip')}</text>
              </g>
            );
          })()}
        </ZoomableSvg>
      </div>
    );
  }

  // ========================================================================
  // 深层: 系统插件矩阵
  // ========================================================================
  if (viewMode === 'sub-systems') {
    const defaults = SYSTEM_ITEMS.filter(s => s.isDefault);
    const optional = SYSTEM_ITEMS.filter(s => !s.isDefault);
    const rowH = 40, colW = 520, padX = 40, padY = 50;
    const vw = colW + padX * 2 + 20;
    const vh = padY + (defaults.length + optional.length + 3) * (rowH + 4) + 60;
    const hookColor = (h: string) => h === '前置' ? '#58a6ff' : h === '后置' ? '#3fb950' : '#f0883e';
    const renderRow = (item: typeof SYSTEM_ITEMS[number], i: number, y: number, dashed: boolean) => (
      <g key={i}>
        <rect x={padX} y={y} width={colW} height={rowH} rx={6}
          fill="#161b22" stroke={dashed ? '#6e7681' : '#30363d'} strokeWidth={1}
          strokeDasharray={dashed ? '6,3' : undefined} />
        <text x={padX + 14} y={y + 25} fontSize={16}>{item.emoji}</text>
        <text x={padX + 38} y={y + 25} fontSize={12} fontWeight={600} fill="#e6edf3">{item.name}</text>
        <text x={padX + 150} y={y + 25} fontSize={10} fill="#8b949e">{item.desc}</text>
        <rect x={padX + colW - 80} y={y + 10} width={68} height={20} rx={4} fill={hookColor(item.hook)} fillOpacity={0.15} />
        <text x={padX + colW - 46} y={y + 24} textAnchor="middle" fontSize={9} fontWeight={600} fill={hookColor(item.hook)}>
          {getArchitectureViewHookLabel(t, item.hook)}
        </text>
      </g>
    );
    return (
      <div className="min-h-screen bg-[#0d1117] text-slate-200 p-4" onClick={() => setViewMode('overview')}>
        <button className="mb-3 text-sm text-slate-400 hover:text-white" onClick={e => { e.stopPropagation(); setViewMode('overview'); }}>{t('devtools.architectureView.common.back')}</button>
        <h2 className="text-lg font-bold text-white mb-2">{t('devtools.architectureView.systems.title')}</h2>
        <p className="text-xs text-slate-500 mb-2">{t('devtools.architectureView.common.click_anywhere_back')}</p>
        <ZoomableSvg viewBox={`0 0 ${vw} ${vh}`} maxHeight="calc(100vh - 100px)">
          <style>{`@keyframes archFadeIn { from { opacity: 0 } }`}</style>
          <text x={padX} y={padY - 8} fontSize={12} fontWeight={700} fill="#3fb950">{t('devtools.architectureView.systems.defaults_title')}</text>
          {defaults.map((item, i) => renderRow(item, i, padY + i * (rowH + 4), false))}
          {(() => {
            const optY = padY + defaults.length * (rowH + 4) + 30;
            return (
              <>
                <text x={padX} y={optY - 8} fontSize={12} fontWeight={700} fill="#8b949e">{t('devtools.architectureView.systems.optional_title')}</text>
                {optional.map((item, i) => renderRow(item, i, optY + i * (rowH + 4), true))}
              </>
            );
          })()}
          {(() => {
            const legY = padY + (defaults.length + optional.length + 1) * (rowH + 4) + 40;
            return (
              <g>
                <text x={padX} y={legY} fontSize={10} fill="#6e7681">{t('devtools.architectureView.systems.hook_position')}</text>
                <rect x={padX + 60} y={legY - 11} width={10} height={10} rx={2} fill="#58a6ff" fillOpacity={0.3} />
                <text x={padX + 74} y={legY} fontSize={9} fill="#58a6ff">{t('devtools.architectureView.systems.hook_before')}</text>
                <rect x={padX + 210} y={legY - 11} width={10} height={10} rx={2} fill="#3fb950" fillOpacity={0.3} />
                <text x={padX + 224} y={legY} fontSize={9} fill="#3fb950">{t('devtools.architectureView.systems.hook_after')}</text>
                <rect x={padX + 350} y={legY - 11} width={10} height={10} rx={2} fill="#f0883e" fillOpacity={0.3} />
                <text x={padX + 364} y={legY} fontSize={9} fill="#f0883e">{t('devtools.architectureView.systems.hook_both')}</text>
              </g>
            );
          })()}
        </ZoomableSvg>
      </div>
    );
  }

  // ========================================================================
  // L3: 测试框架 — 四轨并列
  // ========================================================================
  if (viewMode === 'sub-testing') {
    const vitestRec = TEST_FLOW_STEPS.filter(s => s.phase === 'record');
    const vitestVer = TEST_FLOW_STEPS.filter(s => s.phase === 'verify');
    const e2eSteps = E2E_TEST_STEPS;
    const integritySteps = INTEGRITY_TEST_STEPS;
    const interactionSteps = INTERACTION_AUDIT_STEPS;
    const aiAuditSteps = AI_AUDIT_STEPS;
    const stepH = 60, stepW = 220, gap = 10;
    const trackGap = 10;
    const allVitest = [...vitestRec, ...vitestVer];
    const maxSteps = Math.max(allVitest.length, integritySteps.length, interactionSteps.length, e2eSteps.length, aiAuditSteps.length);
    const sx = 12, sy = 90;
    const trackW = stepW + 12;
    const vw = sx + trackW * 5 + trackGap * 4 + 16;
    const vh = sy + maxSteps * (stepH + gap) + 200;
    const vitestColor = '#3fb950';
    const integrityColor = '#bc8cff';
    const interactionColor = '#f778ba';
    const e2eColor = '#58a6ff';
    const aiColor = '#e3b341';

    const renderStepBox = (emoji: string, label: string, desc: string, example: string | undefined,
      i: number, x: number, y: number, color: string, circled: string, delay: number, total: number) => (
      <g key={`${label}-${i}`} style={{ animation: `archFadeIn 0.4s ease ${delay}s both` }}>
        <rect x={x} y={y} width={stepW} height={stepH} rx={8}
          fill="#161b22" stroke={color} strokeWidth={1.2} />
        <text x={x + 10} y={y + 17} fontSize={13} fill={color}>{emoji}</text>
        <text x={x + 30} y={y + 17} fontSize={9.5} fontWeight={700} fill={color}>{circled} {label}</text>
        <text x={x + 10} y={y + 33} fontSize={8} fill="#8b949e">{desc.length > 30 ? desc.slice(0, 30) + '…' : desc}</text>
        {example && <text x={x + 10} y={y + 47} fontSize={7} fill="#e3b341">{example.length > 36 ? example.slice(0, 36) + '…' : example}</text>}
        {i < total - 1 && (
          <line x1={x + stepW / 2} y1={y + stepH} x2={x + stepW / 2} y2={y + stepH + gap}
            stroke={color} strokeWidth={2}
            style={{ strokeDasharray: 16, strokeDashoffset: 16, animation: `archDraw 0.3s ease ${delay + 0.2}s forwards` }} />
        )}
      </g>
    );

    const circledNums = '\u2460\u2461\u2462\u2463\u2464\u2465\u2466\u2467';
    const trackX = (idx: number) => sx + idx * (trackW + trackGap);

    const renderTrackTitle = (x: number, label: string, color: string, delay: number) => (
      <g style={{ animation: `archFadeIn 0.3s ease ${delay}s both` }}>
        <rect x={x - 4} y={sy - 42} width={trackW} height={28} rx={6}
          fill={color} fillOpacity={0.1} stroke={color} strokeOpacity={0.3} strokeWidth={1} />
        <text x={x + trackW / 2 - 4} y={sy - 22} textAnchor="middle" fontSize={10} fontWeight={700} fill={color}>
          {label}
        </text>
      </g>
    );

    return (
      <div className="min-h-screen bg-[#0d1117] text-slate-200 p-4" onClick={() => setViewMode('overview')}>
        <button className="mb-3 text-sm text-slate-400 hover:text-white" onClick={e => { e.stopPropagation(); setViewMode('overview'); }}>{t('devtools.architectureView.common.back')}</button>
        <h2 className="text-lg font-bold text-white mb-2">{t('devtools.architectureView.testing.title')}</h2>
        <p className="text-xs text-slate-500 mb-2">{t('devtools.architectureView.testing.subtitle')}</p>
        <ZoomableSvg viewBox={`0 0 ${vw} ${vh}`}>
          <style>{`
            @keyframes archFadeIn { from { opacity: 0 } }
            @keyframes archDraw { to { stroke-dashoffset: 0 } }
          `}</style>

          {/* 五列标题 */}
          {renderTrackTitle(trackX(0), t('devtools.architectureView.testing.track_vitest'), vitestColor, 0)}
          {renderTrackTitle(trackX(1), t('devtools.architectureView.testing.track_integrity'), integrityColor, 0.05)}
          {renderTrackTitle(trackX(2), t('devtools.architectureView.testing.track_interaction'), interactionColor, 0.1)}
          {renderTrackTitle(trackX(3), t('devtools.architectureView.testing.track_e2e'), e2eColor, 0.15)}
          {renderTrackTitle(trackX(4), t('devtools.architectureView.testing.track_ai'), aiColor, 0.2)}

          {/* 第1列: Vitest 步骤 */}
          {allVitest.map((step, i) => {
            const y = sy + i * (stepH + gap);
            const isBoundary = i === vitestRec.length;
            return (
              <React.Fragment key={`vt${i}`}>
                {isBoundary && (
                  <g style={{ animation: `archFadeIn 0.3s ease ${i * 0.08 + 0.1}s both` }}>
                    <line x1={trackX(0)} y1={y - gap / 2} x2={trackX(0) + stepW} y2={y - gap / 2}
                      stroke={vitestColor} strokeWidth={1} strokeDasharray="4,3" strokeOpacity={0.4} />
                    <text x={trackX(0) + stepW / 2} y={y - gap / 2 - 4} textAnchor="middle" fontSize={7} fill={vitestColor} opacity={0.6}>
                      {t('devtools.architectureView.testing.modified_boundary')}
                    </text>
                  </g>
                )}
                {renderStepBox(step.emoji, step.label, step.desc, step.example,
                  i, trackX(0), y, vitestColor, circledNums[i] ?? '', i * 0.08, allVitest.length)}
              </React.Fragment>
            );
          })}

          {/* 第2列: 实体链完整性 */}
          {integritySteps.map((step, i) => {
            const y = sy + i * (stepH + gap);
            return renderStepBox(step.emoji, step.label, step.desc, step.example,
              i, trackX(1), y, integrityColor, circledNums[i] ?? '', 0.05 + i * 0.08, integritySteps.length);
          })}

          {/* 第3列: 交互完整性 */}
          {interactionSteps.map((step, i) => {
            const y = sy + i * (stepH + gap);
            return renderStepBox(step.emoji, step.label, step.desc, step.example,
              i, trackX(2), y, interactionColor, circledNums[i] ?? '', 0.1 + i * 0.08, interactionSteps.length);
          })}

          {/* 第4列: E2E 步骤 */}
          {e2eSteps.map((step, i) => {
            const y = sy + i * (stepH + gap);
            return renderStepBox(step.emoji, step.label, step.desc, step.example,
              i, trackX(3), y, e2eColor, circledNums[i] ?? '', 0.15 + i * 0.08, e2eSteps.length);
          })}

          {/* 第5列: AI 逻辑审计 */}
          {aiAuditSteps.map((step, i) => {
            const y = sy + i * (stepH + gap);
            return renderStepBox(step.emoji, step.label, step.desc, step.example,
              i, trackX(4), y, aiColor, circledNums[i] ?? '', 0.2 + i * 0.08, aiAuditSteps.length);
          })}

          {/* 底部总结 */}
          {(() => {
            const bottomY = sy + maxSteps * (stepH + gap) + 10;
            return (
              <g style={{ animation: 'archFadeIn 0.5s ease 0.8s both' }}>
                <rect x={sx - 4} y={bottomY} width={vw - sx * 2 + 8} height={146} rx={8}
                  fill="#161b22" stroke="#30363d" strokeWidth={1} />
                <text x={sx + 10} y={bottomY + 18} fontSize={9} fill={vitestColor} fontWeight={600}>
                  {t('devtools.architectureView.testing.summary_vitest')}
                </text>
                <text x={sx + 10} y={bottomY + 36} fontSize={9} fill={integrityColor} fontWeight={600}>
                  {t('devtools.architectureView.testing.summary_integrity')}
                </text>
                <text x={sx + 10} y={bottomY + 54} fontSize={9} fill={interactionColor} fontWeight={600}>
                  {t('devtools.architectureView.testing.summary_interaction')}
                </text>
                <text x={sx + 10} y={bottomY + 72} fontSize={9} fill={e2eColor} fontWeight={600}>
                  {t('devtools.architectureView.testing.summary_e2e')}
                </text>
                <text x={sx + 10} y={bottomY + 90} fontSize={9} fill={aiColor} fontWeight={600}>
                  {t('devtools.architectureView.testing.summary_ai')}
                </text>
                {/* Bug 覆盖率估算 */}
                <line x1={sx + 6} y1={bottomY + 100} x2={vw - sx - 6} y2={bottomY + 100} stroke="#21262d" strokeWidth={1} />
                <text x={sx + 10} y={bottomY + 116} fontSize={8} fill="#6e7681" fontWeight={600}>
                  {t('devtools.architectureView.testing.coverage_title')}
                </text>
                <text x={sx + 110} y={bottomY + 116} fontSize={8} fill={vitestColor}>{t('devtools.architectureView.testing.coverage_vitest')}</text>
                <text x={sx + 240} y={bottomY + 116} fontSize={8} fill={integrityColor}>{t('devtools.architectureView.testing.coverage_integrity')}</text>
                <text x={sx + 370} y={bottomY + 116} fontSize={8} fill={interactionColor}>{t('devtools.architectureView.testing.coverage_interaction')}</text>
                <text x={sx + 500} y={bottomY + 116} fontSize={8} fill={e2eColor}>{t('devtools.architectureView.testing.coverage_e2e')}</text>
                <text x={sx + 620} y={bottomY + 116} fontSize={8} fill={aiColor}>{t('devtools.architectureView.testing.coverage_ai')}</text>
                <text x={sx + 740} y={bottomY + 116} fontSize={8} fill="#6e7681">{t('devtools.architectureView.testing.coverage_other')}</text>
                <text x={sx + 10} y={bottomY + 134} fontSize={7} fill="#484f58">
                  {t('devtools.architectureView.testing.coverage_note')}
                </text>
              </g>
            );
          })()}
        </ZoomableSvg>
      </div>
    );
  }

  // ========================================================================
  // L3: 用户故事 — 如何用框架开发一个游戏
  // ========================================================================
  if (viewMode === 'story') {
    const steps = USER_STORY_STEPS;
    const stepH = isCompactViewport ? 96 : 80;
    const stepW = isCompactViewport ? 360 : 460;
    const gap = isCompactViewport ? 12 : 16;
    const sx = isCompactViewport ? 20 : 60;
    const sy = isCompactViewport ? 56 : 80;
    const showRelatedTags = !isCompactViewport;
    const showWorkflowSummary = !isCompactViewport;
    const vw = showRelatedTags ? sx + stepW + 120 : sx + stepW + 28;
    const vh = sy + steps.length * (stepH + gap) + (isCompactViewport ? 44 : 60);
    const layerColorMap: Record<string, string> = { core: '#bc8cff', engine: '#f0883e', ui: '#58a6ff', server: '#8b949e' };
    const circled = '\u2460\u2461\u2462\u2463\u2464\u2465\u2466';

    return (
      <div className="min-h-screen bg-[#0d1117] text-slate-200 p-4" onClick={() => setViewMode('overview')}>
        <div className={`mb-3 ${isCompactViewport ? 'flex flex-col items-start gap-2' : 'flex items-center gap-3'}`}>
          <button
            data-testid="arch-story-back-button"
            className="inline-flex shrink-0 whitespace-nowrap text-sm text-slate-400 hover:text-white"
            onClick={e => { e.stopPropagation(); setViewMode('overview'); }}
          >
            {t('devtools.architectureView.common.back')}
          </button>
          <h1 className={`${isCompactViewport ? 'text-base leading-tight' : 'text-lg'} font-bold text-white`}>{t('devtools.architectureView.story.title')}</h1>
        </div>
        <p className="text-xs text-slate-500 mb-2">{t('devtools.architectureView.story.subtitle')}</p>
        <ZoomableSvg
          viewBox={`0 0 ${vw} ${vh}`}
          maxHeight={isCompactViewport ? 'none' : 'calc(100vh - 120px)'}
          className={isCompactViewport ? 'w-full h-auto' : 'w-full'}
        >
          <style>{`
            @keyframes archFadeIn { from { opacity:0 } }
            @keyframes archDraw { to { stroke-dashoffset: 0 } }
            @keyframes storyPulse { 0%,100%{ opacity:.4 } 50%{ opacity:1 } }
          `}</style>
          <defs>
            <marker id="story-arr" viewBox="0 0 10 10" markerWidth="8" markerHeight="8" refX="9" refY="5" orient="auto" markerUnits="userSpaceOnUse">
              <path d="M2,2 L8,5 L2,8" fill="none" stroke="#3fb950" strokeWidth="1.5" strokeLinecap="round" />
            </marker>
          </defs>

          {/* 标题装饰 */}
          {showWorkflowSummary && (
            <text x={sx} y={sy - 30} fontSize={11} fontWeight={600} fill="#e3b341">
              {t('devtools.architectureView.story.workflow')}
            </text>
          )}

          {steps.map((step, i) => {
            const y = sy + i * (stepH + gap);
            const lc = layerColorMap[step.layer] ?? '#6e7681';
            return (
              <g key={i} style={{ animation: `archFadeIn 0.4s ease ${i * 0.1}s both` }}>
                {/* 卡片 */}
                <rect
                  data-testid={`arch-story-step-${i}`}
                  x={sx}
                  y={y}
                  width={stepW}
                  height={stepH}
                  rx={12}
                  fill="#161b22" stroke={lc} strokeWidth={1.5} strokeOpacity={0.6} />
                {/* 左侧层色带 */}
                <rect x={sx + 1} y={y + 10} width={4} height={stepH - 20} rx={2}
                  fill={lc} fillOpacity={0.7} />
                {/* 序号 + emoji + 标题 */}
                <text x={sx + 16} y={y + 28} fontSize={isCompactViewport ? 17 : 15} fill={lc}>{step.emoji}</text>
                <text x={sx + (isCompactViewport ? 44 : 42)} y={y + 28} fontSize={isCompactViewport ? 15 : 14} fontWeight={700} fill={lc}>
                  {circled[i] ?? ''} {step.label}
                </text>
                {/* 层标签 */}
                <rect x={sx + stepW - (isCompactViewport ? 74 : 70)} y={y + 8} width={isCompactViewport ? 60 : 56} height={18} rx={4}
                  fill={lc} fillOpacity={0.12} stroke={lc} strokeOpacity={0.25} strokeWidth={0.8} />
                <text x={sx + stepW - (isCompactViewport ? 44 : 42)} y={y + 20} textAnchor="middle" fontSize={isCompactViewport ? 9 : 8} fontWeight={600} fill={lc}>
                  {getArchitectureViewStoryLayerLabel(t, step.layer)}
                </text>
                {/* 描述 */}
                <text x={sx + 18} y={y + (isCompactViewport ? 52 : 46)} fontSize={isCompactViewport ? 11 : 10} fill="#8b949e">{step.desc}</text>
                {/* 示例 */}
                {step.example && (
                  <text x={sx + 18} y={y + (isCompactViewport ? 74 : 64)} fontSize={isCompactViewport ? 10 : 9} fill="#e3b341">🎲 {step.example}</text>
                )}
                {/* 关联组件 */}
                {showRelatedTags && step.relatedIds.length > 0 && (() => {
                  const tagX = sx + stepW + 14;
                  return step.relatedIds.map((rid, ri) => {
                    const rn = NODE_MAP.get(rid);
                    if (!rn) return null;
                    return (
                      <g key={ri}>
                        <rect x={tagX} y={y + 8 + ri * 22} width={80} height={18} rx={4}
                          fill={rn.color + '15'} stroke={rn.color + '40'} strokeWidth={0.8} />
                        <text x={tagX + 40} y={y + 20 + ri * 22} textAnchor="middle" fontSize={8} fill={rn.color}>{rn.label.slice(2)}</text>
                      </g>
                    );
                  });
                })()}
                {/* 步骤间连线 */}
                {i < steps.length - 1 && (
                  <g>
                    <line x1={sx + stepW / 2} y1={y + stepH} x2={sx + stepW / 2} y2={y + stepH + gap}
                      stroke="#3fb950" strokeWidth={2.5} markerEnd="url(#story-arr)"
                      style={{ strokeDasharray: 20, strokeDashoffset: 20, animation: `archDraw 0.3s ease ${i * 0.1 + 0.3}s forwards` }} />
                    <circle r="3" fill="#3fb950" fillOpacity={0.8}>
                      <animateMotion dur="1.5s" repeatCount="indefinite"
                        path={`M${sx + stepW / 2},${y + stepH} L${sx + stepW / 2},${y + stepH + gap}`} />
                    </circle>
                  </g>
                )}
              </g>
            );
          })}

          {/* 底部总结 */}
          {(() => {
            const bottomY = sy + steps.length * (stepH + gap) + 6;
            return (
              <g style={{ animation: 'archFadeIn 0.5s ease 0.9s both' }}>
                <text x={sx} y={bottomY} fontSize={10} fill="#6e7681">
                  {t('devtools.architectureView.story.principle')}
                </text>
              </g>
            );
          })()}
        </ZoomableSvg>
      </div>
    );
  }

  // ========================================================================
  // C4 L1: System Context — 系统上下文全景
  // ========================================================================
  if (viewMode === 'c4-context') {
    const entities = C4_CONTEXT;
    const links = C4_CONTEXT_LINKS;
    const vw = 900, vh = 560;
    const centerX = vw / 2;

    // 手动布局每个实体的位置
    const positions: Record<string, { x: number; y: number }> = {
      user: { x: centerX, y: 70 },
      story: { x: centerX - 160, y: 220 },
      platform: { x: centerX + 160, y: 220 },
      'ext-db': { x: centerX - 160, y: 420 },
      'ext-cdn': { x: centerX + 160, y: 420 },
    };
    const boxW = 200, boxH = 80;

    return (
      <div className="min-h-screen bg-[#0d1117] text-slate-200 p-4" onClick={() => setViewMode('overview')}>
        <div className="mb-3 flex items-center gap-3">
          <button className="text-sm text-slate-400 hover:text-white" onClick={e => { e.stopPropagation(); setViewMode('overview'); }}>{t('devtools.architectureView.common.back')}</button>
          <h1 className="text-lg font-bold text-white">{t('devtools.architectureView.c4Context.title')}</h1>
          <button className="ml-auto text-sm px-3 py-1 rounded bg-purple-900/40 text-purple-400 border border-purple-700/40 hover:bg-purple-900/60"
            onClick={e => { e.stopPropagation(); setViewMode('c4-container'); }}>{t('devtools.architectureView.c4Context.container_button')}</button>
        </div>
        <p className="text-xs text-slate-500 mb-2">{t('devtools.architectureView.c4Context.subtitle')}</p>
        <ZoomableSvg viewBox={`0 0 ${vw} ${vh}`}>
          <style>{`@keyframes archFadeIn { from { opacity: 0 } }`}</style>
          <defs>
            <marker id="c4-arr" viewBox="0 0 10 10" markerWidth="8" markerHeight="8" refX="9" refY="5" orient="auto" markerUnits="userSpaceOnUse">
              <path d="M2,2 L8,5 L2,8" fill="none" stroke="#6e7681" strokeWidth="1.5" strokeLinecap="round" />
            </marker>
          </defs>

          {/* 连线 */}
          {links.map((link, i) => {
            const from = positions[link.from];
            const to = positions[link.to];
            if (!from || !to) return null;
            const midY = (from.y + to.y) / 2;
            return (
              <g key={`link-${i}`} style={{ animation: `archFadeIn 0.5s ease ${0.3 + i * 0.1}s both` }}>
                <path d={`M${from.x},${from.y + boxH / 2} C${from.x},${midY} ${to.x},${midY} ${to.x},${to.y - boxH / 2}`}
                  fill="none" stroke="#6e7681" strokeWidth={1.5} strokeDasharray="6,3"
                  markerEnd="url(#c4-arr)" />
                <text x={(from.x + to.x) / 2 + (from.x === to.x ? 8 : 0)}
                  y={midY + (from.x === to.x ? 0 : -6)}
                  textAnchor="middle" fontSize={9} fill="#8b949e" fontStyle="italic">
                  {link.label}
                </text>
              </g>
            );
          })}

          {/* 实体 */}
          {entities.map((ent, i) => {
            const pos = positions[ent.id];
            if (!pos) return null;
            const x = pos.x - boxW / 2, y = pos.y - boxH / 2;
            const isPerson = ent.type === 'person';
            const isExternal = ent.type === 'external';
            return (
              <g key={ent.id} style={{ animation: `archFadeIn 0.4s ease ${i * 0.1}s both` }}>
                {isPerson ? (
                  <>
                    <circle cx={pos.x} cy={y + 16} r={14} fill={ent.color + '20'} stroke={ent.color} strokeWidth={2} />
                    <text x={pos.x} y={y + 20} textAnchor="middle" fontSize={14}>👤</text>
                    <rect x={x} y={y + 34} width={boxW} height={boxH - 34} rx={8}
                      fill="#161b22" stroke={ent.color} strokeWidth={1.5} />
                    <text x={pos.x} y={y + 54} textAnchor="middle" fontSize={13} fontWeight={700} fill={ent.color}>{ent.label.replace(/^..\s/, '')}</text>
                    <text x={pos.x} y={y + 70} textAnchor="middle" fontSize={9} fill="#8b949e">{ent.desc}</text>
                  </>
                ) : (
                  <>
                    <rect x={x} y={y} width={boxW} height={boxH} rx={isExternal ? 4 : 10}
                      fill={isExternal ? '#1c2128' : '#161b22'}
                      stroke={ent.color} strokeWidth={isExternal ? 1 : 2}
                      strokeDasharray={isExternal ? '8,4' : undefined} />
                    <rect x={x + 1} y={y + 1} width={boxW - 2} height={4} rx={2}
                      fill={ent.color} fillOpacity={0.6} />
                    <rect x={x + boxW - 68} y={y + 8} width={60} height={16} rx={3}
                      fill={ent.color + '18'} stroke={ent.color + '30'} strokeWidth={0.8} />
                    <text x={x + boxW - 38} y={y + 19} textAnchor="middle" fontSize={7} fill={ent.color} fontWeight={600}>
                      {isExternal
                        ? t('devtools.architectureView.c4Context.type_external')
                        : ent.type === 'story'
                          ? t('devtools.architectureView.c4Context.type_story')
                          : t('devtools.architectureView.c4Context.type_core')}
                    </text>
                    <text x={pos.x} y={y + 38} textAnchor="middle" fontSize={13} fontWeight={700} fill={ent.color}>{ent.label}</text>
                    <text x={pos.x} y={y + 56} textAnchor="middle" fontSize={9} fill="#8b949e">{ent.desc}</text>
                  </>
                )}
              </g>
            );
          })}

          {/* 底部图例 */}
          <g style={{ animation: 'archFadeIn 0.5s ease 0.8s both' }}>
            <text x={30} y={vh - 20} fontSize={9} fill="#6e7681">
              {t('devtools.architectureView.c4Context.legend')}
            </text>
          </g>
        </ZoomableSvg>
      </div>
    );
  }

  // ========================================================================
  // C4 L2: Container — 容器视图（按层展开）
  // ========================================================================
  if (viewMode === 'c4-container') {
    const layers = ['game', 'engine', 'core', 'ui', 'server'] as const;
    const layerColors: Record<string, string> = {
      game: '#3fb950', engine: '#f0883e', core: '#bc8cff', ui: '#58a6ff', server: '#8b949e',
    };
    const layerLabels: Record<string, string> = {
      game: t('devtools.architectureView.c4Container.layer_game'),
      engine: t('devtools.architectureView.c4Container.layer_engine'),
      core: t('devtools.architectureView.c4Container.layer_core'),
      ui: t('devtools.architectureView.c4Container.layer_ui'),
      server: t('devtools.architectureView.c4Container.layer_server'),
    };
    const cLinks = CONTAINER_LINKS;
    const vw = 960, padX = 60, padY = 70;
    const containerW = (vw - padX * 2 - 40) / layers.length;
    const containerH = 180;
    const vh = padY + containerH + 200;

    const containerPos = (idx: number) => ({
      x: padX + idx * (containerW + 10),
      cx: padX + idx * (containerW + 10) + containerW / 2,
      y: padY + 40,
    });

    return (
      <div className="min-h-screen bg-[#0d1117] text-slate-200 p-4" onClick={() => setViewMode('overview')}>
        <div className="mb-3 flex items-center gap-3">
          <button className="text-sm text-slate-400 hover:text-white" onClick={e => { e.stopPropagation(); setViewMode('overview'); }}>{t('devtools.architectureView.common.back')}</button>
          <h1 className="text-lg font-bold text-white">{t('devtools.architectureView.c4Container.title')}</h1>
          <button className="ml-auto text-sm px-3 py-1 rounded bg-blue-900/40 text-blue-400 border border-blue-700/40 hover:bg-blue-900/60"
            onClick={e => { e.stopPropagation(); setViewMode('c4-context'); }}>{t('devtools.architectureView.c4Container.context_button')}</button>
        </div>
        <p className="text-xs text-slate-500 mb-2">{t('devtools.architectureView.c4Container.subtitle')}</p>
        <ZoomableSvg viewBox={`0 0 ${vw} ${vh}`}>
          <style>{`@keyframes archFadeIn { from { opacity: 0 } }`}</style>
          <defs>
            <marker id="c4c-arr" viewBox="0 0 10 10" markerWidth="7" markerHeight="7" refX="9" refY="5" orient="auto" markerUnits="userSpaceOnUse">
              <path d="M2,2 L8,5 L2,8" fill="none" stroke="#6e7681" strokeWidth="1.5" strokeLinecap="round" />
            </marker>
          </defs>

          {/* 容器卡片 */}
          {layers.map((layerId, i) => {
            const pos = containerPos(i);
            const color = layerColors[layerId];
            const summary = LAYER_SUMMARIES[layerId] ?? '';
            const label = layerLabels[layerId] ?? layerId;
            const summaryParts = summary.split(' · ');
            return (
              <g key={layerId} style={{ animation: `archFadeIn 0.4s ease ${i * 0.08}s both` }}>
                <rect x={pos.x} y={pos.y} width={containerW} height={containerH} rx={10}
                  fill="#161b22" stroke={color} strokeWidth={2} />
                <rect x={pos.x + 1} y={pos.y + 1} width={containerW - 2} height={5} rx={2}
                  fill={color} fillOpacity={0.7} />
                <text x={pos.cx} y={pos.y + 30} textAnchor="middle" fontSize={14} fontWeight={700} fill={color}>
                  {label}
                </text>
                <rect x={pos.cx - 28} y={pos.y + 36} width={56} height={16} rx={4}
                  fill={color + '15'} stroke={color + '30'} strokeWidth={0.8} />
                <text x={pos.cx} y={pos.y + 47} textAnchor="middle" fontSize={7} fontWeight={600} fill={color}>{t('devtools.architectureView.c4Container.container_badge')}</text>
                {summaryParts.map((part, pi) => (
                  <text key={pi} x={pos.x + 10} y={pos.y + 68 + pi * 16} fontSize={8.5} fill="#8b949e">
                    {part.length > 22 ? part.slice(0, 22) + '…' : part}
                  </text>
                ))}
              </g>
            );
          })}

          {/* 层间连线 */}
          {cLinks.map((link, i) => {
            const fromIdx = layers.indexOf(link.from as typeof layers[number]);
            const toIdx = layers.indexOf(link.to as typeof layers[number]);
            if (fromIdx < 0 || toIdx < 0) return null;
            const from = containerPos(fromIdx);
            const to = containerPos(toIdx);
            const y1 = from.y + containerH;
            const y2 = to.y + containerH;
            const midY = Math.max(y1, y2) + 30 + i * 18;
            const pathD = `M${from.cx},${y1} C${from.cx},${midY} ${to.cx},${midY} ${to.cx},${y2}`;
            return (
              <g key={`clink-${i}`} style={{ animation: `archFadeIn 0.5s ease ${0.4 + i * 0.08}s both` }}>
                <path d={pathD} fill="none" stroke={link.color} strokeWidth={1.5}
                  strokeDasharray={link.dashed ? '6,3' : undefined}
                  strokeOpacity={0.7} markerEnd="url(#c4c-arr)" />
                <text x={(from.cx + to.cx) / 2} y={midY + 4}
                  textAnchor="middle" fontSize={8} fill={link.color} fontStyle="italic">
                  {link.label}
                </text>
              </g>
            );
          })}

          {/* 底部图例 */}
          <g style={{ animation: 'archFadeIn 0.5s ease 0.9s both' }}>
            <text x={padX} y={vh - 30} fontSize={9} fill="#6e7681">
              {t('devtools.architectureView.c4Container.legend')}
            </text>
            <g>
              {layers.map((layerId, i) => (
                <g key={layerId}>
                  <rect x={padX + i * 150} y={vh - 18} width={10} height={10} rx={2}
                    fill={layerColors[layerId]} fillOpacity={0.4} />
                  <text x={padX + i * 150 + 14} y={vh - 9} fontSize={8} fill={layerColors[layerId]}>
                    {layerLabels[layerId]}
                  </text>
                </g>
              ))}
            </g>
          </g>
        </ZoomableSvg>
      </div>
    );
  }

  // ========================================================================
  // 层详情: SVG 布局 — 节点 + 内部弧线 + 跨层接口 + 点击弹窗
  // ========================================================================
  if (viewMode === 'layer-detail') {
    const layerNodes = NODES.filter(n => n.layer === detailLayer);
    const internalEdges = EDGES.filter(e => {
      const fn = NODE_MAP.get(e.from);
      const tn = NODE_MAP.get(e.to);
      return fn && tn && fn.layer === detailLayer && tn.layer === detailLayer;
    });
    const externalEdges = EDGES.filter(e => {
      const fn = NODE_MAP.get(e.from);
      const tn = NODE_MAP.get(e.to);
      return fn && tn && (fn.layer === detailLayer || tn.layer === detailLayer)
        && (fn.layer !== detailLayer || tn.layer !== detailLayer);
    });

    const layerInfo = OVERVIEW_LAYERS.find(l => l.id === detailLayer);
    const color = layerInfo?.color ?? '#6e7681';
    const padX = 60, padY = 80;
    const nodeW = 420, nodeH = 56, nodeGap = 16;
    const vw = nodeW + padX * 2 + 300;
    const vh = padY + layerNodes.length * (nodeH + nodeGap) + 120;

    // 弹窗内容计算
    const popNode = selectedNode?.layer === detailLayer ? selectedNode : null;
    const popDetails = popNode?.details ?? [];
    const popIface = popNode?.iface ?? [];
    const popFlow = popNode?.dataFlow ?? [];
    const popExample = popNode?.realExample ?? [];
    const popSections = (popDetails.length > 0 ? 1 : 0) + (popIface.length > 0 ? 1 : 0)
      + (popFlow.length > 0 ? 1 : 0) + (popExample.length > 0 ? 1 : 0);
    const popH = popNode ? Math.max(140, 60
      + popDetails.length * 15
      + (popIface.length > 0 ? 24 + popIface.length * 13 : 0)
      + (popFlow.length > 0 ? 24 + popFlow.length * 15 : 0)
      + (popExample.length > 0 ? 24 + popExample.length * 13 : 0)
      + popSections * 12
    ) : 0;
    const popW = 460;

    return (
      <div className="min-h-screen bg-[#0d1117] text-slate-200 p-4" onClick={() => { if (selectedNode) closePop(); else setViewMode('overview'); }}>
        <div className="mb-3 flex items-center gap-3">
          <button className="text-sm text-slate-400 hover:text-white" onClick={e => { e.stopPropagation(); setViewMode('overview'); }}>{t('devtools.architectureView.common.back')}</button>
          <h1 className="text-lg font-bold text-white">{layerInfo?.emoji} {layerInfo?.label} {t('devtools.architectureView.layerDetail.title_suffix')}</h1>
          <span className="text-xs text-slate-500">{t('devtools.architectureView.layerDetail.subtitle', { count: layerNodes.length })}</span>
        </div>
        <ZoomableSvg viewBox={`0 0 ${vw} ${vh}`} maxHeight="calc(100vh - 80px)">
          <style>{`@keyframes archFadeIn { from { opacity: 0 } }`}</style>

          {/* 层背景 */}
          <rect x={padX - 10} y={padY - 30} width={nodeW + 20} height={layerNodes.length * (nodeH + nodeGap) + 40} rx={12}
            fill={color} fillOpacity={0.04} stroke={color} strokeOpacity={0.2} strokeWidth={1.5} />
          <text x={padX} y={padY - 12} fontSize={12} fontWeight={700} fill={color} opacity={0.6}>
            {layerInfo?.emoji} {layerInfo?.label}
          </text>

          {/* 内部弧线 */}
          {internalEdges.map((edge, ei) => {
            const fromIdx = layerNodes.findIndex(n => n.id === edge.from);
            const toIdx = layerNodes.findIndex(n => n.id === edge.to);
            if (fromIdx < 0 || toIdx < 0) return null;
            const fromY = padY + fromIdx * (nodeH + nodeGap) + nodeH / 2;
            const toY = padY + toIdx * (nodeH + nodeGap) + nodeH / 2;
            const arcX = padX - 20 - ei * 14;
            const pathD = `M${padX},${fromY} C${arcX},${fromY} ${arcX},${toY} ${padX},${toY}`;
            return (
              <g key={`ie-${ei}`} style={{ animation: `archFadeIn 0.5s ease ${0.3 + ei * 0.06}s both` }}>
                <path d={pathD} fill="none" stroke={edge.color} strokeWidth={1.2}
                  strokeOpacity={0.4} strokeDasharray={edge.type === 'event' ? '5,3' : undefined} />
                {edge.label && (
                  <text x={arcX - 4} y={(fromY + toY) / 2 + 4} textAnchor="end" fontSize={7} fill={edge.color} opacity={0.6} fontStyle="italic">
                    {edge.label}
                  </text>
                )}
                <circle r={1.8} fill={edge.color} fillOpacity={0.6}>
                  <animateMotion dur="2.5s" repeatCount="indefinite" path={pathD} />
                </circle>
              </g>
            );
          })}

          {/* 节点卡片 */}
          {layerNodes.map((node, i) => {
            const x = padX, y = padY + i * (nodeH + nodeGap);
            const hasExpand = !!node.expandable;
            const hasDetail = !!(node.iface || node.dataFlow || node.realExample || (node.details && node.details.length > 0));
            return (
              <g key={node.id}
                style={{ cursor: hasExpand || hasDetail ? 'pointer' : 'default', animation: `archFadeIn 0.4s ease ${i * 0.08}s both` }}
                onClick={e => {
                  e.stopPropagation();
                  if (hasExpand) {
                    if (node.expandable === 'pipeline') setViewMode('sub-pipeline');
                    else if (node.expandable === 'systems') setViewMode('sub-systems');
                    else if (node.expandable === 'testing') setViewMode('sub-testing');
                  } else if (hasDetail) {
                    setSelectedNode(prev => prev?.id === node.id ? null : node);
                  }
                }}>
                <rect x={x} y={y} width={nodeW} height={nodeH} rx={8}
                  fill={selectedNode?.id === node.id ? node.color + '18' : '#161b22'}
                  stroke={node.color} strokeWidth={selectedNode?.id === node.id ? 2 : 1.5} />
                <rect x={x + 1} y={y + 8} width={4} height={nodeH - 16} rx={2}
                  fill={node.color} fillOpacity={0.7} />
                <text x={x + 16} y={y + 22} fontSize={12} fontWeight={700} fill={node.color}>{node.label}</text>
                <text x={x + 16} y={y + 40} fontSize={9} fill="#8b949e">{node.desc}</text>
                {hasExpand && (
                  <text x={x + nodeW - 10} y={y + 16} textAnchor="end" fontSize={8} fill={node.color} opacity={0.5}>{t('devtools.architectureView.layerDetail.expand')}</text>
                )}
                {hasDetail && !hasExpand && (
                  <text x={x + nodeW - 10} y={y + 16} textAnchor="end" fontSize={8} fill={node.color} opacity={0.4}>{t('devtools.architectureView.layerDetail.click_detail')}</text>
                )}
              </g>
            );
          })}

          {/* 跨层接口 */}
          {externalEdges.length > 0 && (() => {
            const extX = padX + nodeW + 60;
            return (
              <g style={{ animation: 'archFadeIn 0.5s ease 0.5s both' }}>
                <text x={extX} y={padY - 12} fontSize={11} fontWeight={600} fill="#6e7681">{t('devtools.architectureView.layerDetail.cross_layer')}</text>
                {externalEdges.map((edge, i) => {
                  const fn = NODE_MAP.get(edge.from);
                  const tn = NODE_MAP.get(edge.to);
                  if (!fn || !tn) return null;
                  const isOut = fn.layer === detailLayer;
                  const otherNode = isOut ? tn : fn;
                  const y = padY + i * 28;
                  return (
                    <g key={i}>
                      <text x={extX} y={y + 10} fontSize={9} fill={isOut ? '#3fb950' : '#58a6ff'}>
                        {isOut ? t('devtools.architectureView.layerDetail.direction_out') : t('devtools.architectureView.layerDetail.direction_in')}
                      </text>
                      <rect x={extX + 28} y={y - 2} width={otherNode.label.length * 8 + 16} height={18} rx={4}
                        fill={otherNode.color + '12'} stroke={otherNode.color + '30'} strokeWidth={0.8} />
                      <text x={extX + 36} y={y + 10} fontSize={8} fill={otherNode.color}>{otherNode.label}</text>
                      {edge.label && (
                        <text x={extX + 36 + otherNode.label.length * 8 + 20} y={y + 10} fontSize={8} fill="#6e7681">{edge.label}</text>
                      )}
                    </g>
                  );
                })}
              </g>
            );
          })()}

          {/* 详情弹窗 */}
          {popNode && popSections > 0 && (() => {
            const popX = (vw - popW) / 2;
            const popY = Math.max(10, (vh - popH) / 2);
            let cy = popY + 16;
            return (
              <g onClick={(e: React.MouseEvent) => e.stopPropagation()} style={{ animation: 'archFadeIn 0.15s ease' }}>
                <rect x={0} y={0} width={vw} height={vh} fill="#000" fillOpacity={0.5} style={{ cursor: 'pointer' }} onClick={closePop} />
                <rect x={popX} y={popY} width={popW} height={popH} rx={12}
                  fill="#161b22" stroke={popNode.color + '40'} strokeWidth={1.5} />
                <rect x={popX + 1} y={popY + 1} width={popW - 2} height={4} rx={2} fill={popNode.color} fillOpacity={0.6} />
                <text x={popX + popW - 16} y={popY + 18} textAnchor="middle" fill="#6e7681" fontSize={14}
                  style={{ cursor: 'pointer' }} onClick={closePop}>{'\u2715'}</text>
                <text x={popX + 16} y={(cy += 14, cy)} fill={popNode.color} fontSize={13} fontWeight={700}>{popNode.label}</text>
                <text x={popX + 16} y={(cy += 16, cy)} fill="#8b949e" fontSize={9}>{popNode.desc}</text>
                {(cy += 8, null)}
                <line x1={popX + 14} y1={cy} x2={popX + popW - 14} y2={cy} stroke="#21262d" />

                {/* 说明 */}
                {popDetails.length > 0 && popDetails.map((d, i) => (
                  <text key={`d${i}`} x={popX + 16} y={(cy += 15, cy)} fill="#c9d1d9" fontSize={9}>{d}</text>
                ))}

                {/* 接口 */}
                {popIface.length > 0 && (() => {
                  cy += 12;
                  return (
                    <>
                      <text x={popX + 16} y={(cy += 12, cy)} fill={popNode.color} fontSize={9} fontWeight={700}>{t('devtools.architectureView.layerDetail.interface_definition')}</text>
                      <rect x={popX + 14} y={cy + 4} width={popW - 28} height={popIface.length * 13 + 8} rx={4}
                        fill="#0d1117" stroke="#21262d" strokeWidth={0.8} />
                      {popIface.map((line, i) => (
                        <text key={`if${i}`} x={popX + 22} y={(cy += 13, cy + 4)} fill="#7ee787" fontSize={8}
                          fontFamily="monospace">{line}</text>
                      ))}
                      {(cy += 8, null)}
                    </>
                  );
                })()}

                {/* 链路 */}
                {popFlow.length > 0 && (() => {
                  cy += 12;
                  return (
                    <>
                      <text x={popX + 16} y={(cy += 12, cy)} fill={popNode.color} fontSize={9} fontWeight={700}>{t('devtools.architectureView.layerDetail.data_chain')}</text>
                      {popFlow.map((step, i) => (
                        <g key={`fl${i}`}>
                          <text x={popX + 22} y={(cy += 15, cy)} fill="#e3b341" fontSize={8} fontFamily="monospace">{i + 1}.</text>
                          <text x={popX + 38} y={cy} fill="#c9d1d9" fontSize={8}>{step}</text>
                        </g>
                      ))}
                    </>
                  );
                })()}

                {/* 案例 */}
                {popExample.length > 0 && (() => {
                  cy += 12;
                  return (
                    <>
                      <text x={popX + 16} y={(cy += 12, cy)} fill={popNode.color} fontSize={9} fontWeight={700}>{t('devtools.architectureView.layerDetail.example')}</text>
                      <rect x={popX + 14} y={cy + 4} width={popW - 28} height={popExample.length * 13 + 8} rx={4}
                        fill="#0d1117" stroke="#e3b34130" strokeWidth={0.8} />
                      {popExample.map((line, i) => (
                        <text key={`ex${i}`} x={popX + 22} y={(cy += 13, cy + 4)} fill="#e3b341" fontSize={8}
                          fontFamily="monospace">{line}</text>
                      ))}
                    </>
                  );
                })()}
              </g>
            );
          })()}
        </ZoomableSvg>
      </div>
    );
  }

  return null;
};

export default ArchitectureView;
