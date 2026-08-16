import React from 'react';
import type {
    UISceneCompiledArtifact,
    UISceneFlowAlign,
    UISceneInsets,
    UISceneNodeSource,
    UISceneRect,
    UISceneSourceDocument,
} from '../types';
import type { UISceneAuthoringMeta } from './authoringMeta';
import {
    getAuthoringActionName,
    getAuthoringNodeDescription,
    getAuthoringNodeName,
    getAuthoringSlotName,
} from './authoringMeta';
import {
    findCompiledNodeById,
    findNodeById,
    findParentNodeById,
    getNodeKindLabel,
    isFlowContainerNode,
} from './sceneGraph';

const ZERO_INSETS: UISceneInsets = {
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
};

type ContainerAlignValue = 'start' | 'center' | 'end' | 'stretch';
type ContainerJustifyValue = 'start' | 'center' | 'end' | 'space-between';

export interface InspectorPanelProps {
    open: boolean;
    scene: UISceneCompiledArtifact;
    sceneDocument: UISceneSourceDocument;
    meta?: UISceneAuthoringMeta;
    selectedNodeId?: string | null;
    selectedNodeIds?: string[];
    onAlignSelection?: (
        mode:
        | 'left'
        | 'horizontalCenter'
        | 'right'
        | 'top'
        | 'verticalCenter'
        | 'bottom'
        | 'distributeHorizontal'
        | 'distributeVertical'
        | 'sameWidth'
        | 'sameHeight'
        | 'sameSize'
    ) => void;
    onPromoteSelectionPrimary?: (nodeId: string) => void;
    onSelectNode: (nodeId: string, options?: { additive?: boolean; toggle?: boolean }) => void;
    onChangeNodeRect: (nodeId: string, rect: UISceneRect) => void;
    onChangeNodeLayout: (nodeId: string, layout: {
        width?: number;
        height?: number;
        grow?: number;
        shrink?: number;
        alignSelf?: UISceneFlowAlign;
        justifySelf?: UISceneFlowAlign;
    }) => void;
    onChangeStackDirection: (nodeId: string, direction: 'absolute' | 'horizontal' | 'vertical') => void;
    onChangeStackGap: (nodeId: string, gap: number) => void;
    onChangeGridGap: (nodeId: string, gap: number) => void;
    onChangeGridColumns: (nodeId: string, columns: number) => void;
    onChangeGridRows: (nodeId: string, rows: number) => void;
    onChangeContainerAlign: (nodeId: string, align?: string) => void;
    onChangeContainerJustify: (nodeId: string, justify?: string) => void;
    onChangeContainerPadding: (nodeId: string, padding: UISceneInsets) => void;
    onChangeContainerClip: (nodeId: string, clipContent: boolean) => void;
    onChangeNineSliceSlice: (nodeId: string, slice: UISceneInsets) => void;
    onChangeNineSliceContentPadding: (nodeId: string, padding: UISceneInsets) => void;
    onToggle: () => void;
    embedded?: boolean;
}

function ActionButton({
    testId,
    children,
    onClick,
}: {
    testId: string;
    children: React.ReactNode;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            data-testid={testId}
            onClick={onClick}
            className="rounded-[12px] border border-cyan-300/20 bg-cyan-300/10 px-3 py-2 text-[12px] font-semibold text-cyan-50 transition-colors hover:bg-cyan-300/16"
        >
            {children}
        </button>
    );
}

function NumberField({
    label,
    value,
    onChange,
    min,
}: {
    label: string;
    value: number | undefined;
    onChange: (value: number) => void;
    min?: number;
}) {
    return (
        <label className="flex flex-col gap-1 text-[11px] text-white/70">
            <span>{label}</span>
            <input
                type="number"
                min={min}
                value={Number.isFinite(value) ? value : 0}
                onChange={(event) => onChange(Number(event.target.value))}
                className="rounded-[10px] border border-white/10 bg-black/20 px-3 py-2 text-[12px] text-amber-50 outline-none"
            />
        </label>
    );
}

function ToggleField({
    label,
    checked,
    onChange,
}: {
    label: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
}) {
    return (
        <label className="flex items-center justify-between gap-3 rounded-[12px] border border-white/8 bg-black/15 px-3 py-2 text-[12px] text-white/72">
            <span>{label}</span>
            <input
                type="checkbox"
                checked={checked}
                onChange={(event) => onChange(event.target.checked)}
            />
        </label>
    );
}

function SelectField<T extends string>({
    label,
    value,
    options,
    onChange,
}: {
    label: string;
    value: T;
    options: Array<{ value: T; label: string }>;
    onChange: (value: T) => void;
}) {
    return (
        <label className="flex flex-col gap-1 text-[11px] text-white/70">
            <span>{label}</span>
            <select
                value={value}
                onChange={(event) => onChange(event.target.value as T)}
                className="rounded-[10px] border border-white/10 bg-black/20 px-3 py-2 text-[12px] text-amber-50 outline-none"
            >
                {options.map((option) => (
                    <option key={option.value} value={option.value}>
                        {option.label}
                    </option>
                ))}
            </select>
        </label>
    );
}

function InsetsEditor({
    title,
    value,
    onChange,
}: {
    title: string;
    value: UISceneInsets;
    onChange: (value: UISceneInsets) => void;
}) {
    return (
        <div className="space-y-2">
            <div className="text-[11px] font-semibold tracking-[0.08em] text-white/50">{title}</div>
            <div className="grid grid-cols-2 gap-3">
                <NumberField label="上" value={value.top} onChange={(next) => onChange({ ...value, top: next })} />
                <NumberField label="右" value={value.right} onChange={(next) => onChange({ ...value, right: next })} />
                <NumberField label="下" value={value.bottom} onChange={(next) => onChange({ ...value, bottom: next })} />
                <NumberField label="左" value={value.left} onChange={(next) => onChange({ ...value, left: next })} />
            </div>
        </div>
    );
}

function FieldGroup({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
    return (
        <section className="grid gap-3 rounded-[16px] border border-white/8 bg-white/5 px-3 py-3">
            <div>
                <div className="text-[11px] font-semibold tracking-[0.12em] text-white/45">{title}</div>
                {description ? (
                    <div className="mt-1 text-[11px] leading-[1.6] text-white/40">{description}</div>
                ) : null}
            </div>
            {children}
        </section>
    );
}

function resolveSelectedNode(
    sceneDocument: UISceneSourceDocument,
    scene: UISceneCompiledArtifact,
    selectedNodeId?: string | null,
) {
    if (!selectedNodeId) {
        return {
            sourceNode: null,
            compiledNode: null,
            parentNode: null,
        };
    }

    return {
        sourceNode: findNodeById(sceneDocument.scene.root, selectedNodeId),
        compiledNode: findCompiledNodeById(scene.root, selectedNodeId),
        parentNode: findParentNodeById(sceneDocument.scene.root, selectedNodeId),
    };
}

function buildRect(sourceNode: UISceneNodeSource | null, compiledRect?: UISceneRect): UISceneRect | null {
    if (sourceNode?.rect) {
        return sourceNode.rect;
    }
    if (compiledRect) {
        return compiledRect;
    }
    return null;
}

function normalizeInsets(value?: UISceneInsets): UISceneInsets {
    return value ?? ZERO_INSETS;
}

export function InspectorPanel({
    open,
    scene,
    sceneDocument,
    meta,
    selectedNodeId,
    selectedNodeIds = [],
    onAlignSelection,
    onPromoteSelectionPrimary,
    onSelectNode,
    onChangeNodeRect,
    onChangeNodeLayout,
    onChangeStackDirection,
    onChangeStackGap,
    onChangeGridGap,
    onChangeGridColumns,
    onChangeGridRows,
    onChangeContainerAlign,
    onChangeContainerJustify,
    onChangeContainerPadding,
    onChangeContainerClip,
    onChangeNineSliceSlice,
    onChangeNineSliceContentPadding,
    onToggle,
    embedded = false,
}: InspectorPanelProps) {
    const { sourceNode, compiledNode, parentNode } = React.useMemo(
        () => resolveSelectedNode(sceneDocument, scene, selectedNodeId),
        [scene, sceneDocument, selectedNodeId],
    );
    const resolvedSelectedNodeIds = React.useMemo(
        () => (selectedNodeIds.length > 0 ? selectedNodeIds : selectedNodeId ? [selectedNodeId] : []),
        [selectedNodeId, selectedNodeIds],
    );
    const selectedCount = resolvedSelectedNodeIds.length;
    const isMultiSelected = selectedCount > 1;
    const primarySelectedNodeId = resolvedSelectedNodeIds[0] ?? null;
    const selectedRect = buildRect(sourceNode, compiledNode?.rect);
    const nodeLabel = sourceNode ? getNodeKindLabel(sourceNode) : null;
    const nodeName = isMultiSelected
        ? `已选 ${selectedCount} 个节点`
        : selectedNodeId
            ? getAuthoringNodeName(meta, selectedNodeId)
            : '未选中节点';
    const nodeDescription = selectedNodeId ? getAuthoringNodeDescription(meta, selectedNodeId) : '';
    const parentIsFlowContainer = Boolean(parentNode && isFlowContainerNode(parentNode));
    const skin = sourceNode?.skin ? sceneDocument && scene.skins[sourceNode.skin] : undefined;
    const childLayout = sourceNode?.layout ?? {};

    return (
        <aside
            data-testid="home-v2-inspector-panel"
            data-selected-node={selectedNodeId ?? ''}
            data-selected-count={String(selectedCount)}
            className={`${embedded
                ? 'pointer-events-auto flex h-full w-full flex-col overflow-hidden rounded-[18px] border border-white/10 bg-[#17110e]/98 shadow-[0_18px_48px_rgba(0,0,0,0.24)]'
                : 'pointer-events-auto fixed right-4 top-4 z-[2100] flex max-h-[calc(100vh-2rem)] w-[min(360px,calc(100vw-2rem))] flex-col overflow-hidden rounded-[18px] border border-white/10 bg-[#17110e]/98 shadow-[0_18px_48px_rgba(0,0,0,0.32)]'}`}
            style={{ display: open ? 'flex' : 'none' }}
        >
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                <div>
                    <div className="text-[11px] font-semibold tracking-[0.22em] text-amber-200/70">属性</div>
                    <div className="mt-1 text-sm font-semibold text-amber-50">{nodeName}</div>
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
            <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
                {isMultiSelected ? (
                    <FieldGroup title="多选" description="以首个选中节点为主参考，可做对齐、分布和统一尺寸。">
                        <div className="rounded-[12px] border border-[#0d99ff]/20 bg-[#0d99ff]/8 px-3 py-2 text-[12px] text-[#d6efff]">
                            当前主参考：{primarySelectedNodeId ? getAuthoringNodeName(meta, primarySelectedNodeId) : '未设置'}
                        </div>
                        <div className="grid gap-2">
                            {resolvedSelectedNodeIds.map((nodeId) => {
                                const isPrimary = nodeId === primarySelectedNodeId;
                                return (
                                    <div
                                        key={nodeId}
                                        className={`flex items-center justify-between gap-3 rounded-[12px] border px-3 py-2 ${
                                            isPrimary
                                                ? 'border-[#0d99ff]/35 bg-[#0d99ff]/10'
                                                : 'border-white/8 bg-white/4'
                                        }`}
                                    >
                                        <button
                                            type="button"
                                            onClick={() => onSelectNode(nodeId)}
                                            className="min-w-0 flex-1 truncate text-left text-[12px] text-white/78"
                                        >
                                            {getAuthoringNodeName(meta, nodeId)}
                                        </button>
                                        {isPrimary ? (
                                            <span
                                                data-testid={`home-v2-selection-primary-${nodeId}`}
                                                className="rounded-[8px] border border-[#0d99ff]/30 bg-[#0d99ff]/12 px-2 py-1 text-[10px] font-semibold text-[#d6efff]"
                                            >
                                                主参考
                                            </span>
                                        ) : (
                                            <button
                                                type="button"
                                                data-testid={`home-v2-promote-selection-${nodeId}`}
                                                onClick={() => onPromoteSelectionPrimary?.(nodeId)}
                                                className="rounded-[8px] border border-white/10 bg-white/6 px-2 py-1 text-[10px] font-semibold text-white/72 transition-colors hover:bg-white/10"
                                            >
                                                设为主参考
                                            </button>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                        <div className="text-[12px] leading-[1.7] text-white/55">
                            在画布上拖动任一选中节点，可以整体移动这一组。按住 Shift 再点节点，能继续增减选择；对齐和统一尺寸默认跟随主参考。
                        </div>
                        <div className="grid gap-3">
                            <div>
                                <div className="mb-2 text-[11px] font-semibold tracking-[0.08em] text-white/45">对齐</div>
                                <div className="grid grid-cols-3 gap-2">
                                    <ActionButton testId="home-v2-align-left" onClick={() => onAlignSelection?.('left')}>左对齐</ActionButton>
                                    <ActionButton testId="home-v2-align-horizontal-center" onClick={() => onAlignSelection?.('horizontalCenter')}>水平居中</ActionButton>
                                    <ActionButton testId="home-v2-align-right" onClick={() => onAlignSelection?.('right')}>右对齐</ActionButton>
                                    <ActionButton testId="home-v2-align-top" onClick={() => onAlignSelection?.('top')}>顶对齐</ActionButton>
                                    <ActionButton testId="home-v2-align-vertical-center" onClick={() => onAlignSelection?.('verticalCenter')}>垂直居中</ActionButton>
                                    <ActionButton testId="home-v2-align-bottom" onClick={() => onAlignSelection?.('bottom')}>底对齐</ActionButton>
                                </div>
                            </div>
                            <div>
                                <div className="mb-2 text-[11px] font-semibold tracking-[0.08em] text-white/45">分布</div>
                                <div className="grid grid-cols-2 gap-2">
                                    <ActionButton testId="home-v2-distribute-horizontal" onClick={() => onAlignSelection?.('distributeHorizontal')}>水平分布</ActionButton>
                                    <ActionButton testId="home-v2-distribute-vertical" onClick={() => onAlignSelection?.('distributeVertical')}>垂直分布</ActionButton>
                                </div>
                            </div>
                            <div>
                                <div className="mb-2 text-[11px] font-semibold tracking-[0.08em] text-white/45">尺寸</div>
                                <div className="grid grid-cols-3 gap-2">
                                    <ActionButton testId="home-v2-same-width" onClick={() => onAlignSelection?.('sameWidth')}>同宽</ActionButton>
                                    <ActionButton testId="home-v2-same-height" onClick={() => onAlignSelection?.('sameHeight')}>同高</ActionButton>
                                    <ActionButton testId="home-v2-same-size" onClick={() => onAlignSelection?.('sameSize')}>同尺寸</ActionButton>
                                </div>
                            </div>
                        </div>
                    </FieldGroup>
                ) : sourceNode && compiledNode ? (
                    <>
                        <FieldGroup title="节点信息">
                            <div className="grid gap-2 text-[12px] text-white/75">
                                <div>节点类型：{nodeLabel}</div>
                                <div>配置名称：{nodeName}</div>
                                <div>节点 ID：{sourceNode.id}</div>
                                {nodeDescription ? <div>说明：{nodeDescription}</div> : null}
                                {parentNode ? <div>父容器：{getAuthoringNodeName(meta, parentNode.id)}</div> : null}
                                {compiledNode.children.length > 0 ? <div>子节点数：{compiledNode.children.length}</div> : null}
                                {sourceNode.type === 'button' && sourceNode.actionId ? (
                                    <div>点击动作：{getAuthoringActionName(meta, sourceNode.actionId)}</div>
                                ) : null}
                                {sourceNode.type === 'slot' ? (
                                    <div>插槽内容：{getAuthoringSlotName(meta, sourceNode.slotId)}</div>
                                ) : null}
                                {sourceNode.children?.length ? (
                                    <div className="flex flex-wrap gap-2">
                                        {sourceNode.children.map((child) => (
                                            <button
                                                key={child.id}
                                                type="button"
                                                onClick={() => onSelectNode(child.id)}
                                                className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-white/70 hover:bg-white/10"
                                            >
                                                {getAuthoringNodeName(meta, child.id)}
                                            </button>
                                        ))}
                                    </div>
                                ) : null}
                            </div>
                        </FieldGroup>

                        {selectedRect ? (
                            <FieldGroup title="位置与尺寸" description="绝对定位节点可以直接拖拽，也可以在这里精确输入。">
                                <div className="grid grid-cols-4 gap-3">
                                    <NumberField
                                        label="X"
                                        value={selectedRect.x}
                                        onChange={(value) => onChangeNodeRect(sourceNode.id, { ...selectedRect, x: value })}
                                    />
                                    <NumberField
                                        label="Y"
                                        value={selectedRect.y}
                                        onChange={(value) => onChangeNodeRect(sourceNode.id, { ...selectedRect, y: value })}
                                    />
                                    <NumberField
                                        label="宽度"
                                        value={selectedRect.width}
                                        onChange={(value) => onChangeNodeRect(sourceNode.id, { ...selectedRect, width: value })}
                                        min={24}
                                    />
                                    <NumberField
                                        label="高度"
                                        value={selectedRect.height}
                                        onChange={(value) => onChangeNodeRect(sourceNode.id, { ...selectedRect, height: value })}
                                        min={24}
                                    />
                                </div>
                            </FieldGroup>
                        ) : null}

                        {parentIsFlowContainer ? (
                            <FieldGroup title="子项排布" description="当前节点位于自动排布容器内，这里控制它在容器里的占位方式。">
                                <div className="grid grid-cols-2 gap-3">
                                    <NumberField
                                        label="固定宽度"
                                        value={childLayout.width}
                                        onChange={(value) => onChangeNodeLayout(sourceNode.id, { ...childLayout, width: value <= 0 ? undefined : value })}
                                    />
                                    <NumberField
                                        label="固定高度"
                                        value={childLayout.height}
                                        onChange={(value) => onChangeNodeLayout(sourceNode.id, { ...childLayout, height: value <= 0 ? undefined : value })}
                                    />
                                    <NumberField
                                        label="拉伸权重"
                                        value={childLayout.grow}
                                        onChange={(value) => onChangeNodeLayout(sourceNode.id, { ...childLayout, grow: value })}
                                    />
                                    <NumberField
                                        label="压缩权重"
                                        value={childLayout.shrink}
                                        onChange={(value) => onChangeNodeLayout(sourceNode.id, { ...childLayout, shrink: value })}
                                    />
                                </div>
                                <SelectField<UISceneFlowAlign>
                                    label="横向自对齐"
                                    value={childLayout.alignSelf ?? 'stretch'}
                                    options={[
                                        { value: 'stretch', label: '拉伸铺满' },
                                        { value: 'start', label: '靠起点' },
                                        { value: 'center', label: '居中' },
                                        { value: 'end', label: '靠终点' },
                                        { value: 'auto', label: '跟随容器' },
                                    ]}
                                    onChange={(value) => onChangeNodeLayout(sourceNode.id, { ...childLayout, alignSelf: value })}
                                />
                            </FieldGroup>
                        ) : null}

                        {sourceNode.type === 'stack' ? (
                            <FieldGroup title="容器布局" description="控制子节点在容器内的排列方向、间距和留白。">
                                <SelectField<'absolute' | 'horizontal' | 'vertical'>
                                    label="排列方式"
                                    value={sourceNode.direction}
                                    options={[
                                        { value: 'absolute', label: '自由摆放' },
                                        { value: 'vertical', label: '纵向排列' },
                                        { value: 'horizontal', label: '横向排列' },
                                    ]}
                                    onChange={(value) => onChangeStackDirection(sourceNode.id, value)}
                                />
                                <div className="grid grid-cols-2 gap-3">
                                    <NumberField
                                        label="子项间距"
                                        value={sourceNode.gap ?? 0}
                                        onChange={(value) => onChangeStackGap(sourceNode.id, value)}
                                    />
                                </div>
                                {sourceNode.direction !== 'absolute' ? (
                                    <>
                                        <SelectField<ContainerAlignValue>
                                            label="交叉轴对齐"
                                            value={(sourceNode.align as ContainerAlignValue) ?? 'stretch'}
                                            options={[
                                                { value: 'stretch', label: '拉伸铺满' },
                                                { value: 'start', label: '靠起点' },
                                                { value: 'center', label: '居中' },
                                                { value: 'end', label: '靠终点' },
                                            ]}
                                            onChange={(value) => onChangeContainerAlign(sourceNode.id, value)}
                                        />
                                        <SelectField<ContainerJustifyValue>
                                            label="主轴分布"
                                            value={(sourceNode.justify as ContainerJustifyValue) ?? 'start'}
                                            options={[
                                                { value: 'start', label: '贴起点' },
                                                { value: 'center', label: '整体居中' },
                                                { value: 'end', label: '贴终点' },
                                                { value: 'space-between', label: '两端分布' },
                                            ]}
                                            onChange={(value) => onChangeContainerJustify(sourceNode.id, value)}
                                        />
                                    </>
                                ) : null}
                                <InsetsEditor
                                    title="容器内边距"
                                    value={normalizeInsets(sourceNode.padding)}
                                    onChange={(value) => onChangeContainerPadding(sourceNode.id, value)}
                                />
                                <ToggleField
                                    label="裁切溢出内容"
                                    checked={sourceNode.clipContent ?? false}
                                    onChange={(checked) => onChangeContainerClip(sourceNode.id, checked)}
                                />
                            </FieldGroup>
                        ) : null}

                        {sourceNode.type === 'grid' ? (
                            <FieldGroup title="网格布局" description="控制列数、间距和网格单元内的对齐方式。">
                                <div className="grid grid-cols-2 gap-3">
                                    <NumberField
                                        label="列数"
                                        value={sourceNode.columns ?? 1}
                                        onChange={(value) => onChangeGridColumns(sourceNode.id, value)}
                                        min={1}
                                    />
                                    <NumberField
                                        label="行数"
                                        value={sourceNode.rows}
                                        onChange={(value) => onChangeGridRows(sourceNode.id, value)}
                                        min={1}
                                    />
                                    <NumberField
                                        label="宫格间距"
                                        value={sourceNode.gap ?? 0}
                                        onChange={(value) => onChangeGridGap(sourceNode.id, value)}
                                    />
                                </div>
                                <SelectField<ContainerAlignValue>
                                    label="单元格纵向对齐"
                                    value={(sourceNode.align as ContainerAlignValue) ?? 'stretch'}
                                    options={[
                                        { value: 'stretch', label: '拉伸铺满' },
                                        { value: 'start', label: '靠顶部' },
                                        { value: 'center', label: '居中' },
                                        { value: 'end', label: '靠底部' },
                                    ]}
                                    onChange={(value) => onChangeContainerAlign(sourceNode.id, value)}
                                />
                                <SelectField<ContainerAlignValue>
                                    label="单元格横向对齐"
                                    value={(sourceNode.justify as ContainerAlignValue) ?? 'stretch'}
                                    options={[
                                        { value: 'stretch', label: '拉伸铺满' },
                                        { value: 'start', label: '靠左' },
                                        { value: 'center', label: '居中' },
                                        { value: 'end', label: '靠右' },
                                    ]}
                                    onChange={(value) => onChangeContainerJustify(sourceNode.id, value)}
                                />
                                <InsetsEditor
                                    title="网格内边距"
                                    value={normalizeInsets(sourceNode.padding)}
                                    onChange={(value) => onChangeContainerPadding(sourceNode.id, value)}
                                />
                                <ToggleField
                                    label="裁切溢出内容"
                                    checked={sourceNode.clipContent ?? false}
                                    onChange={(checked) => onChangeContainerClip(sourceNode.id, checked)}
                                />
                            </FieldGroup>
                        ) : null}

                        {sourceNode.skin && skin?.kind === 'nineSlice' ? (
                            <FieldGroup title="九宫格皮肤" description="切边决定角与边的保护范围，内容留白决定内部可放内容的安全区。">
                                <div className="rounded-[12px] border border-white/8 bg-black/15 px-3 py-2 text-[12px] text-white/72">
                                    当前皮肤：{sourceNode.skin}
                                </div>
                                <InsetsEditor
                                    title="切边厚度"
                                    value={normalizeInsets(skin.slice)}
                                    onChange={(value) => onChangeNineSliceSlice(sourceNode.id, value)}
                                />
                                <InsetsEditor
                                    title="内容留白"
                                    value={normalizeInsets(skin.contentPadding)}
                                    onChange={(value) => onChangeNineSliceContentPadding(sourceNode.id, value)}
                                />
                            </FieldGroup>
                        ) : null}
                    </>
                ) : (
                    <div className="rounded-[16px] border border-white/8 bg-white/5 px-4 py-4 text-[12px] leading-[1.7] text-white/55">
                        在页面上点一个节点，或者在左侧层级树里选一个节点，这里会显示它的中文属性。
                    </div>
                )}
            </div>
        </aside>
    );
}
