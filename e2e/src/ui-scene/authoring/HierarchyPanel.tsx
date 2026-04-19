import React from 'react';
import type { UISceneSourceDocument } from '../types';
import type { UISceneAuthoringMeta } from './authoringMeta';
import { flattenNodeTree } from './sceneGraph';
import type { UISceneNodeMovePosition } from './sceneGraph';

export interface HierarchyPanelProps {
    open: boolean;
    sceneDocument: UISceneSourceDocument;
    meta?: UISceneAuthoringMeta;
    selectedNodeId?: string | null;
    selectedNodeIds?: string[];
    onSelectNode: (nodeId: string, options?: { additive?: boolean; toggle?: boolean }) => void;
    onMoveNode?: (nodeId: string, targetId: string, position: UISceneNodeMovePosition) => void;
    onToggle: () => void;
    embedded?: boolean;
}

type DropTarget = {
    targetId: string;
    position: UISceneNodeMovePosition;
};

export function HierarchyPanel({
    open,
    sceneDocument,
    meta,
    selectedNodeId,
    selectedNodeIds = [],
    onSelectNode,
    onMoveNode,
    onToggle,
    embedded = false,
}: HierarchyPanelProps) {
    const items = React.useMemo(() => flattenNodeTree(sceneDocument.scene.root), [sceneDocument]);
    const selectedIdSet = React.useMemo(
        () => new Set(selectedNodeIds.length > 0 ? selectedNodeIds : selectedNodeId ? [selectedNodeId] : []),
        [selectedNodeId, selectedNodeIds],
    );
    const itemRefs = React.useRef<Record<string, HTMLButtonElement | null>>({});
    const [draggingNodeId, setDraggingNodeId] = React.useState<string | null>(null);
    const [dropTarget, setDropTarget] = React.useState<DropTarget | null>(null);

    const resolveDropPosition = React.useCallback((item: typeof items[number], clientY: number) => {
        const element = itemRefs.current[item.id];
        if (!element) {
            return null;
        }

        const rect = element.getBoundingClientRect();
        const relativeY = clientY - rect.top;
        const upperBoundary = rect.height * 0.3;
        const lowerBoundary = rect.height * 0.7;

        if (item.isContainer && relativeY >= upperBoundary && relativeY <= lowerBoundary) {
            return 'inside';
        }

        return relativeY < rect.height / 2 ? 'before' : 'after';
    }, [items]);

    React.useEffect(() => {
        if (!open || !selectedNodeId) {
            return;
        }

        itemRefs.current[selectedNodeId]?.scrollIntoView({
            block: 'nearest',
            inline: 'nearest',
        });
    }, [open, selectedNodeId]);

    return (
        <aside
            data-testid="home-v2-hierarchy-panel"
            className={`${embedded
                ? 'pointer-events-auto flex h-full w-full flex-col overflow-hidden rounded-[18px] border border-white/10 bg-[#17110e]/98 shadow-[0_18px_48px_rgba(0,0,0,0.24)]'
                : 'pointer-events-auto fixed left-4 top-4 z-[2100] flex max-h-[calc(100vh-2rem)] w-[min(320px,calc(100vw-2rem))] flex-col overflow-hidden rounded-[18px] border border-white/10 bg-[#17110e]/98 shadow-[0_18px_48px_rgba(0,0,0,0.32)]'}`}
            style={{ display: open ? 'flex' : 'none' }}
        >
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                <div>
                    <div className="text-[11px] font-semibold tracking-[0.22em] text-amber-200/70">层级树</div>
                    <div className="mt-1 text-sm font-semibold text-amber-50">
                        {selectedIdSet.size > 1
                            ? `已选 ${selectedIdSet.size} 个节点`
                            : selectedNodeId
                                ? (meta?.nodes?.[selectedNodeId]?.名称 ?? selectedNodeId)
                                : '未选中节点'}
                    </div>
                </div>
                {!embedded ? (
                    <button
                        type="button"
                        onClick={onToggle}
                        className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/75 transition-colors hover:bg-white/10"
                    >
                        收起
                    </button>
                ) : null}
            </div>
            <div className="flex-1 overflow-y-auto px-3 py-3">
                <div className="space-y-1">
                    {items.map((item) => (
                        <div
                            key={item.id}
                            className={`relative rounded-[12px] ${
                                dropTarget?.targetId === item.id && dropTarget.position === 'before'
                                    ? 'before:absolute before:inset-x-3 before:top-0 before:h-[2px] before:rounded-full before:bg-amber-300 before:content-[""]'
                                    : ''
                            } ${
                                dropTarget?.targetId === item.id && dropTarget.position === 'after'
                                    ? 'after:absolute after:inset-x-3 after:bottom-0 after:h-[2px] after:rounded-full after:bg-amber-300 after:content-[""]'
                                    : ''
                            }`}
                        >
                            <button
                                type="button"
                                ref={(element) => {
                                    itemRefs.current[item.id] = element;
                                }}
                                draggable={Boolean(onMoveNode)}
                                data-testid={`home-v2-hierarchy-item-${item.id}`}
                                data-selected={selectedIdSet.has(item.id) ? 'true' : 'false'}
                                data-dragging={item.id === draggingNodeId ? 'true' : 'false'}
                                data-drop-position={dropTarget?.targetId === item.id ? dropTarget.position : ''}
                                onClick={(event) => onSelectNode(item.id, event.shiftKey ? { additive: true, toggle: true } : undefined)}
                                onDragStart={(event) => {
                                    if (!onMoveNode) {
                                        return;
                                    }
                                    event.dataTransfer.effectAllowed = 'move';
                                    event.dataTransfer.setData('text/plain', item.id);
                                    setDraggingNodeId(item.id);
                                }}
                                onDragEnd={() => {
                                    setDraggingNodeId(null);
                                    setDropTarget(null);
                                }}
                                onDragOver={(event) => {
                                    if (!onMoveNode || !draggingNodeId || draggingNodeId === item.id) {
                                        return;
                                    }
                                    event.preventDefault();
                                    const position = resolveDropPosition(item, event.clientY);
                                    if (!position) {
                                        return;
                                    }
                                    setDropTarget({
                                        targetId: item.id,
                                        position,
                                    });
                                }}
                                onDrop={(event) => {
                                    if (!onMoveNode || !draggingNodeId) {
                                        return;
                                    }
                                    event.preventDefault();
                                    const position = resolveDropPosition(item, event.clientY) ?? (item.isContainer ? 'inside' : 'after');
                                    onMoveNode(draggingNodeId, item.id, position);
                                    setDraggingNodeId(null);
                                    setDropTarget(null);
                                }}
                                className={`relative flex w-full items-center gap-2 rounded-[12px] border px-3 py-2 text-left text-[12px] transition-colors ${
                                    selectedIdSet.has(item.id)
                                        ? 'border-amber-300/60 bg-amber-200/10 text-amber-50'
                                        : 'border-white/8 bg-white/5 text-white/70 hover:bg-white/10'
                                } ${
                                    dropTarget?.targetId === item.id && dropTarget.position === 'inside'
                                        ? 'border-cyan-300/70 bg-cyan-400/10'
                                        : ''
                                } ${
                                    item.id === draggingNodeId ? 'opacity-45' : ''
                                }`}
                                style={{ paddingLeft: `${12 + item.depth * 18}px` }}
                            >
                                <span className="rounded-full border border-white/10 bg-black/20 px-2 py-0.5 text-[10px] text-white/55">
                                    {item.label}
                                </span>
                                <span className="truncate">{meta?.nodes?.[item.id]?.名称 ?? item.id}</span>
                                {dropTarget?.targetId === item.id && dropTarget.position === 'inside' ? (
                                    <span className="ml-auto rounded-full border border-cyan-300/35 bg-cyan-400/10 px-2 py-0.5 text-[10px] text-cyan-100">
                                        放入容器
                                    </span>
                                ) : null}
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        </aside>
    );
}
