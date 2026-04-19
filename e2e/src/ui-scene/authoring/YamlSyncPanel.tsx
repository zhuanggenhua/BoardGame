import React from 'react';

export type YamlSyncDocumentId = 'scene' | 'skin' | 'assetRegistry';

export interface YamlSyncPanelProps {
    open: boolean;
    documents: Record<YamlSyncDocumentId, string>;
    activeDocument: YamlSyncDocumentId;
    error?: string | null;
    isSaving?: boolean;
    saveMessage?: string | null;
    onChangeDocument: (documentId: YamlSyncDocumentId, value: string) => void;
    onChangeActiveDocument: (documentId: YamlSyncDocumentId) => void;
    onSave: () => void;
    onToggle: () => void;
    embedded?: boolean;
}

const DOCUMENT_TABS: Array<{
    id: YamlSyncDocumentId;
    title: string;
    fileName: string;
}> = [
    { id: 'scene', title: '场景', fileName: 'home-v2.ui.yaml' },
    { id: 'skin', title: '皮肤', fileName: 'home-v2.skin.yaml' },
    { id: 'assetRegistry', title: '资源', fileName: 'asset-registry.yaml' },
];

export function YamlSyncPanel({
    open,
    documents,
    activeDocument,
    error,
    isSaving = false,
    saveMessage,
    onChangeDocument,
    onChangeActiveDocument,
    onSave,
    onToggle,
    embedded = false,
}: YamlSyncPanelProps) {
    const currentDocument = DOCUMENT_TABS.find((item) => item.id === activeDocument) ?? DOCUMENT_TABS[0];

    return (
        <aside
            data-testid="home-v2-source-panel"
            className={`${embedded
                ? 'pointer-events-auto flex h-full w-full flex-col overflow-hidden rounded-[18px] border border-white/10 bg-[#17110e]/98 shadow-[0_18px_48px_rgba(0,0,0,0.24)]'
                : 'pointer-events-auto fixed right-4 top-4 z-[2100] flex max-h-[calc(100vh-2rem)] w-[min(520px,calc(100vw-2rem))] flex-col overflow-hidden rounded-[18px] border border-white/10 bg-[#17110e]/98 shadow-[0_18px_48px_rgba(0,0,0,0.32)]'}`}
            style={{ display: open ? 'flex' : 'none' }}
        >
            <div className="border-b border-white/10 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                    <div>
                        <div className="text-[11px] font-semibold tracking-[0.22em] text-amber-200/70">高级源码</div>
                        <div className="mt-1 text-sm font-semibold text-amber-50">{currentDocument.fileName}</div>
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
                <div className="mt-3 flex flex-wrap gap-2">
                    {DOCUMENT_TABS.map((item) => (
                        <button
                            key={item.id}
                            type="button"
                            data-testid={`home-v2-source-tab-${item.id}`}
                            onClick={() => onChangeActiveDocument(item.id)}
                            className={`rounded-full px-3 py-1.5 text-[12px] font-semibold transition-colors ${
                                item.id === activeDocument
                                    ? 'bg-amber-200 text-[#3f2a17]'
                                    : 'border border-white/10 bg-white/5 text-white/70 hover:bg-white/10'
                            }`}
                        >
                            {item.title}
                        </button>
                    ))}
                </div>
            </div>
            <textarea
                value={documents[activeDocument]}
                onChange={(event) => onChangeDocument(activeDocument, event.target.value)}
                spellCheck={false}
                className="min-h-[360px] flex-1 resize-none border-0 bg-transparent px-4 py-4 font-mono text-[12px] leading-[1.55] text-[#f5e7d3] outline-none"
            />
            <div className="border-t border-white/10 px-4 py-3">
                {error ? (
                    <div className="mb-3 rounded-[14px] border border-red-400/25 bg-red-500/10 px-3 py-2 text-[12px] text-red-100">
                        {error}
                    </div>
                ) : null}
                {saveMessage ? (
                    <div className="mb-3 rounded-[14px] border border-emerald-400/20 bg-emerald-500/10 px-3 py-2 text-[12px] text-emerald-100">
                        {saveMessage}
                    </div>
                ) : null}
                <div className="flex items-center justify-between gap-3">
                    <div className="text-[11px] text-white/45">常用编辑优先走图层、画布和属性面板；这里只有在你需要直接改 YAML 真源时才打开。</div>
                    <button
                        type="button"
                        onClick={onSave}
                        disabled={Boolean(error) || isSaving}
                        className="rounded-full bg-amber-200 px-4 py-2 text-[12px] font-semibold text-[#3f2a17] transition-opacity disabled:cursor-not-allowed disabled:opacity-45"
                    >
                        {isSaving ? '保存中...' : '保存'}
                    </button>
                </div>
            </div>
        </aside>
    );
}
