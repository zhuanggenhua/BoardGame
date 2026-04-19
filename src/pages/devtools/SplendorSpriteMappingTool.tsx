import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getLocalAssetPath } from '../../core';
import { SPLENDOR_CARD_DEFS, SPLENDOR_NOBLE_DEFS } from '../../games/splendor/domain/data';
import {
    SPLENDOR_SPRITE_ATLASES,
    SPLENDOR_SPRITE_ATLAS_BY_ID,
    serializeSplendorSpriteMapping,
    type SplendorSpriteAtlasId,
} from '../../games/splendor/spriteMapping';

type DraftMapping = Record<SplendorSpriteAtlasId, string[]>;

const STORAGE_KEY = 'splendor-sprite-mapping-draft-v1';

function createDefaultDraftMapping(): DraftMapping {
    return Object.fromEntries(
        SPLENDOR_SPRITE_ATLASES.map((atlas) => [atlas.id, [...atlas.frameIds]]),
    ) as DraftMapping;
}

function readDraftMappingFromStorage(): DraftMapping {
    const next = createDefaultDraftMapping();
    if (typeof window === 'undefined') {
        return next;
    }
    try {
        const saved = window.localStorage.getItem(STORAGE_KEY);
        if (!saved) return next;
        const parsed = JSON.parse(saved) as Partial<DraftMapping>;
        for (const atlas of SPLENDOR_SPRITE_ATLASES) {
            const candidate = parsed[atlas.id];
            if (Array.isArray(candidate) && candidate.length === atlas.frameIds.length) {
                next[atlas.id] = candidate.map((id) => String(id));
            }
        }
    } catch {
        // ignore invalid draft payload
    }
    return next;
}

function isSameDraftMapping(left: DraftMapping, right: DraftMapping): boolean {
    return SPLENDOR_SPRITE_ATLASES.every((atlas) =>
        left[atlas.id].length === right[atlas.id].length
        && left[atlas.id].every((id, index) => id === right[atlas.id][index]),
    );
}

function buildSpriteStyle(imagePath: string, cols: number, rows: number, index: number): React.CSSProperties {
    const col = index % cols;
    const row = Math.floor(index / cols);
    const x = cols <= 1 ? 0 : (col / (cols - 1)) * 100;
    const y = rows <= 1 ? 0 : (row / (rows - 1)) * 100;

    return {
        backgroundImage: `url(${getLocalAssetPath(imagePath)})`,
        backgroundRepeat: 'no-repeat',
        backgroundSize: `${cols * 100}% ${rows * 100}%`,
        backgroundPosition: `${x}% ${y}%`,
    };
}

const COST_COLOR_LABEL: Record<string, string> = {
    white: '白',
    blue: '蓝',
    green: '绿',
    red: '红',
    black: '黑',
};

function formatCardCostText(cardId: string): string {
    const card = SPLENDOR_CARD_DEFS.find((item) => item.id === cardId);
    if (!card) return '';

    return Object.entries(card.cost)
        .filter(([, count]) => count > 0)
        .map(([color, count]) => `${count}${COST_COLOR_LABEL[color] ?? color}`)
        .join(' ');
}

export default function SplendorSpriteMappingTool({
    onBackToSlicer,
}: {
    onBackToSlicer: () => void;
}) {
    const [activeAtlasId, setActiveAtlasId] = useState<SplendorSpriteAtlasId>('tier1');
    const [selectedFrameIndex, setSelectedFrameIndex] = useState(0);
    const [draftMapping, setDraftMapping] = useState<DraftMapping>(() => readDraftMappingFromStorage());
    const [copied, setCopied] = useState(false);
    const defaultDraftMapping = useMemo(() => createDefaultDraftMapping(), []);

    useEffect(() => {
        if (typeof window === 'undefined') {
            return;
        }
        if (isSameDraftMapping(draftMapping, defaultDraftMapping)) {
            window.localStorage.removeItem(STORAGE_KEY);
            return;
        }
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(draftMapping));
    }, [defaultDraftMapping, draftMapping]);

    const activeAtlas = SPLENDOR_SPRITE_ATLAS_BY_ID[activeAtlasId];
    const currentOrder = draftMapping[activeAtlasId];
    const selectedAssignedId = currentOrder[selectedFrameIndex] ?? '';

    const modelOptions = useMemo(() => {
        if (activeAtlas.modelKind === 'noble') {
            return SPLENDOR_NOBLE_DEFS.map((noble) => ({
                id: noble.id,
                label: `${noble.id} · ${noble.name}`,
            }));
        }
        return SPLENDOR_CARD_DEFS
            .filter((card) => card.tier === activeAtlas.tier)
            .map((card) => ({
                id: card.id,
                label: `${card.id} · ${card.name}`,
            }));
    }, [activeAtlas]);

    const diagnostics = useMemo(() => {
        const expected = new Set(modelOptions.map((option) => option.id));
        const usage = new Map<string, number[]>();
        const unmapped: number[] = [];

        currentOrder.forEach((id, index) => {
            if (!id) {
                unmapped.push(index);
                return;
            }
            const bucket = usage.get(id) ?? [];
            bucket.push(index);
            usage.set(id, bucket);
        });

        const duplicateIds = Array.from(usage.entries())
            .filter(([, indices]) => indices.length > 1)
            .map(([id]) => id);

        const missingIds = Array.from(expected).filter((id) => !usage.has(id));
        const unknownIds = Array.from(usage.keys()).filter((id) => !expected.has(id));

        return {
            unmapped,
            duplicateIds,
            missingIds,
            unknownIds,
        };
    }, [currentOrder, modelOptions]);

    const exportText = useMemo(() => serializeSplendorSpriteMapping(draftMapping), [draftMapping]);

    const updateSelectedFrame = (nextId: string) => {
        setDraftMapping((current) => {
            const next = {
                ...current,
                [activeAtlasId]: [...current[activeAtlasId]],
            };
            const atlasOrder = next[activeAtlasId];
            const currentId = atlasOrder[selectedFrameIndex] ?? '';

            if (!nextId) {
                atlasOrder[selectedFrameIndex] = '';
                return next;
            }

            const existingIndex = atlasOrder.findIndex((id, index) => id === nextId && index !== selectedFrameIndex);
            atlasOrder[selectedFrameIndex] = nextId;
            if (existingIndex >= 0) {
                atlasOrder[existingIndex] = currentId;
            }
            return next;
        });
    };

    const restoreActiveAtlas = () => {
        setDraftMapping((current) => ({
            ...current,
            [activeAtlasId]: [...SPLENDOR_SPRITE_ATLAS_BY_ID[activeAtlasId].frameIds],
        }));
    };

    const restoreAll = () => {
        setDraftMapping(createDefaultDraftMapping());
    };

    const clearLocalDraft = () => {
        if (typeof window !== 'undefined') {
            window.localStorage.removeItem(STORAGE_KEY);
        }
        setDraftMapping(createDefaultDraftMapping());
    };

    const copyExport = async () => {
        await navigator.clipboard.writeText(exportText);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
    };

    return (
        <div className="flex h-screen w-screen overflow-hidden bg-slate-950 text-slate-100">
            <aside className="flex w-[360px] flex-col border-r border-slate-800 bg-slate-900">
                <div className="border-b border-slate-800 p-5">
                    <div className="mb-2 flex items-center justify-between">
                        <Link to="/" className="text-[10px] font-bold uppercase tracking-[0.28em] text-slate-500 transition hover:text-amber-300">
                            返回首页
                        </Link>
                        <button
                            type="button"
                            onClick={onBackToSlicer}
                            className="rounded-full border border-slate-700 px-3 py-1 text-[11px] text-slate-300 transition hover:border-amber-400 hover:text-amber-200"
                        >
                            切回切片模式
                        </button>
                    </div>
                    <h1 className="text-2xl font-black text-amber-200">Splendor 映射校对</h1>
                    <p className="mt-2 text-sm leading-6 text-slate-400">
                        在同一页中同时查看雪碧图格子与对应的数据模型，校对发展卡与贵族的映射关系。
                    </p>
                </div>

                <div className="flex-1 space-y-6 overflow-y-auto p-5">
                    <section className="space-y-3">
                        <div className="text-xs font-black uppercase tracking-[0.28em] text-slate-500">图集</div>
                        <div className="grid grid-cols-2 gap-2">
                            {SPLENDOR_SPRITE_ATLASES.map((atlas) => (
                                <button
                                    key={atlas.id}
                                    type="button"
                                    data-testid={`splendor-mapping-atlas-${atlas.id}`}
                                    onClick={() => {
                                        setActiveAtlasId(atlas.id);
                                        setSelectedFrameIndex(0);
                                    }}
                                    className={`rounded-xl border px-3 py-3 text-left transition ${
                                        activeAtlasId === atlas.id
                                            ? 'border-amber-400 bg-amber-500/10 text-amber-100'
                                            : 'border-slate-700 bg-slate-800/80 text-slate-300 hover:border-slate-500'
                                    }`}
                                >
                                    <div className="text-sm font-semibold">{atlas.title}</div>
                                    <div className="mt-1 text-[11px] text-slate-400">{atlas.cols} x {atlas.rows}</div>
                                </button>
                            ))}
                        </div>
                    </section>

                    <section className="space-y-3">
                        <div className="text-xs font-black uppercase tracking-[0.28em] text-slate-500">当前格子</div>
                        <div className="rounded-2xl border border-slate-700 bg-slate-950/60 p-4">
                            <div className="text-sm font-semibold text-slate-200">
                                第 {selectedFrameIndex + 1} 格
                            </div>
                            <div className="mt-2 text-xs text-slate-400">
                                当前绑定：<span className="font-mono text-slate-200">{selectedAssignedId || '未映射'}</span>
                            </div>
                            <select
                                data-testid="splendor-mapping-model-select"
                                value={selectedAssignedId}
                                onChange={(event) => updateSelectedFrame(event.target.value)}
                                className="mt-3 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-amber-400"
                            >
                                <option value="">未映射</option>
                                {modelOptions.map((option) => (
                                    <option key={option.id} value={option.id}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                            <div className="mt-3 flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => updateSelectedFrame('')}
                                    className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300 transition hover:border-rose-400 hover:text-rose-200"
                                >
                                    清空此格
                                </button>
                                <button
                                    type="button"
                                    onClick={restoreActiveAtlas}
                                    className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300 transition hover:border-amber-400 hover:text-amber-200"
                                >
                                    恢复当前图集
                                </button>
                            </div>
                        </div>
                    </section>

                    <section className="space-y-3">
                        <div className="text-xs font-black uppercase tracking-[0.28em] text-slate-500">校验</div>
                        <div className="space-y-2 rounded-2xl border border-slate-700 bg-slate-950/60 p-4 text-xs">
                            <div className="flex justify-between">
                                <span className="text-slate-400">未映射格子</span>
                                <span className={diagnostics.unmapped.length ? 'text-rose-300' : 'text-emerald-300'}>
                                    {diagnostics.unmapped.length}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-400">重复映射模型</span>
                                <span className={diagnostics.duplicateIds.length ? 'text-rose-300' : 'text-emerald-300'}>
                                    {diagnostics.duplicateIds.length}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-400">缺失模型</span>
                                <span className={diagnostics.missingIds.length ? 'text-rose-300' : 'text-emerald-300'}>
                                    {diagnostics.missingIds.length}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-400">未知 ID</span>
                                <span className={diagnostics.unknownIds.length ? 'text-rose-300' : 'text-emerald-300'}>
                                    {diagnostics.unknownIds.length}
                                </span>
                            </div>
                        </div>
                        {(diagnostics.unmapped.length > 0 || diagnostics.duplicateIds.length > 0 || diagnostics.missingIds.length > 0 || diagnostics.unknownIds.length > 0) ? (
                            <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 p-4 text-xs leading-6 text-rose-100">
                                {diagnostics.unmapped.length > 0 ? <div>未映射格子：{diagnostics.unmapped.map((index) => index + 1).join('、')}</div> : null}
                                {diagnostics.duplicateIds.length > 0 ? <div>重复模型：{diagnostics.duplicateIds.join('、')}</div> : null}
                                {diagnostics.missingIds.length > 0 ? <div>缺失模型：{diagnostics.missingIds.join('、')}</div> : null}
                                {diagnostics.unknownIds.length > 0 ? <div>未知 ID：{diagnostics.unknownIds.join('、')}</div> : null}
                            </div>
                        ) : (
                            <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-xs text-emerald-100">
                                当前图集映射在结构上完整，可继续做人眼校对或导出回填。
                            </div>
                        )}
                    </section>

                    <section className="space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="text-xs font-black uppercase tracking-[0.28em] text-slate-500">导出</div>
                            <button
                                type="button"
                                data-testid="splendor-mapping-copy-export"
                                onClick={copyExport}
                                className="rounded-full border border-slate-700 px-3 py-1 text-[11px] text-slate-300 transition hover:border-amber-400 hover:text-amber-200"
                            >
                                {copied ? '已复制' : '复制配置'}
                            </button>
                        </div>
                        <textarea
                            readOnly
                            value={exportText}
                            className="min-h-[240px] w-full rounded-2xl border border-slate-700 bg-slate-950/60 p-4 font-mono text-[11px] leading-5 text-slate-200 outline-none"
                        />
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={restoreAll}
                                className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300 transition hover:border-amber-400 hover:text-amber-200"
                            >
                                恢复全部仓库配置
                            </button>
                            <button
                                type="button"
                                onClick={clearLocalDraft}
                                className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300 transition hover:border-rose-400 hover:text-rose-200"
                            >
                                清空本地草稿
                            </button>
                        </div>
                    </section>
                </div>
            </aside>

            <main className="flex min-w-0 flex-1 flex-col bg-slate-950">
                <div className="border-b border-slate-800 px-6 py-4">
                    <div className="text-sm text-slate-400">
                        当前图集：<span className="font-semibold text-slate-100">{activeAtlas.title}</span>
                    </div>
                </div>

                <div className="grid min-h-0 flex-1 gap-0 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,420px)]">
                    <section className="min-h-0 overflow-auto p-6">
                        <div
                            data-testid="splendor-mapping-frame-grid"
                            className={`grid gap-3`}
                            style={{ gridTemplateColumns: `repeat(${activeAtlas.cols}, minmax(0, 1fr))` }}
                        >
                            {currentOrder.map((assignedId, index) => {
                                const isSelected = index === selectedFrameIndex;
                                const isDuplicate = assignedId && diagnostics.duplicateIds.includes(assignedId);
                                const isUnknown = assignedId && diagnostics.unknownIds.includes(assignedId);
                                const isUnmapped = !assignedId;
                                const costText = activeAtlas.modelKind === 'card' && assignedId
                                    ? formatCardCostText(assignedId)
                                    : '';

                                return (
                                    <button
                                        key={`${activeAtlas.id}-${index}`}
                                        type="button"
                                        data-testid={`splendor-mapping-frame-${index}`}
                                        onClick={() => setSelectedFrameIndex(index)}
                                        className={`rounded-2xl border p-2 text-left transition ${
                                            isSelected
                                                ? 'border-amber-400 bg-amber-500/10 shadow-[0_0_0_1px_rgba(251,191,36,0.2)]'
                                                : 'border-slate-800 bg-slate-900 hover:border-slate-600'
                                        } ${isDuplicate || isUnknown ? 'border-rose-500/60' : ''}`}
                                    >
                                        <div className="mb-2 flex items-center justify-between text-[11px]">
                                            <span className="font-bold text-slate-300">#{index + 1}</span>
                                            <span className={`rounded-full px-2 py-0.5 ${
                                                isUnmapped
                                                    ? 'bg-slate-700 text-slate-300'
                                                    : isDuplicate || isUnknown
                                                        ? 'bg-rose-500/20 text-rose-200'
                                                        : 'bg-emerald-500/15 text-emerald-200'
                                            }`}>
                                                {isUnmapped ? '未映射' : assignedId}
                                            </span>
                                        </div>
                                        <div
                                            className={`overflow-hidden rounded-xl border border-slate-800 bg-black ${
                                                activeAtlas.modelKind === 'noble' ? 'aspect-square' : 'aspect-[0.7]'
                                            }`}
                                            style={buildSpriteStyle(activeAtlas.imagePath, activeAtlas.cols, activeAtlas.rows, index)}
                                        >
                                            {costText ? (
                                                <div className="pointer-events-none flex h-full w-full items-start justify-start p-2">
                                                    <div className="rounded bg-slate-950/72 px-2 py-1 text-left text-[9px] leading-tight text-slate-100 shadow-sm backdrop-blur-[1px]">
                                                        {costText}
                                                    </div>
                                                </div>
                                            ) : null}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </section>

                    <section className="min-h-0 border-l border-slate-800 bg-slate-900/70 p-6">
                        <div className="mb-4 text-xs font-black uppercase tracking-[0.28em] text-slate-500">模型列表</div>
                        <div className="h-full overflow-auto rounded-2xl border border-slate-800 bg-slate-950/50">
                            {modelOptions.map((option) => {
                                const frameIndex = currentOrder.findIndex((id) => id === option.id);
                                const selected = selectedAssignedId === option.id;
                                return (
                                    <button
                                        key={option.id}
                                        type="button"
                                        data-testid={`splendor-mapping-model-${option.id}`}
                                        onClick={() => updateSelectedFrame(option.id)}
                                        className={`flex w-full items-center justify-between gap-3 border-b border-slate-800 px-4 py-3 text-left transition last:border-b-0 ${
                                            selected ? 'bg-amber-500/10' : 'hover:bg-slate-900'
                                        }`}
                                    >
                                        <div className="min-w-0">
                                            <div className="font-mono text-xs text-slate-200">{option.id}</div>
                                            <div className="mt-1 text-xs text-slate-400">{option.label.split(' · ')[1]}</div>
                                        </div>
                                        <div className={`shrink-0 rounded-full px-2 py-1 text-[11px] ${
                                            frameIndex >= 0 ? 'bg-emerald-500/15 text-emerald-200' : 'bg-slate-700 text-slate-300'
                                        }`}>
                                            {frameIndex >= 0 ? `第 ${frameIndex + 1} 格` : '未分配'}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </section>
                </div>
            </main>
        </div>
    );
}
