import React from 'react';

export interface EditorHeaderBarProps {
    sceneName: string;
    leftTab: '图层' | '组件' | '资源';
    leftDrawerOpen: boolean;
    inspectorOpen: boolean;
    sourceOpen: boolean;
    overlayVisible: boolean;
    canUndo?: boolean;
    canRedo?: boolean;
    canDeleteSelection?: boolean;
    isSaving?: boolean;
    saveDisabled?: boolean;
    onToggleLeftTab: (tab: '图层' | '组件' | '资源') => void;
    onToggleInspector: () => void;
    onToggleOverlay: () => void;
    onToggleSource: () => void;
    onUndo: () => void;
    onRedo: () => void;
    onDeleteSelection: () => void;
    onSave: () => void;
}

function TabButton({
    active,
    children,
    testId,
    onClick,
}: {
    active: boolean;
    children: React.ReactNode;
    testId: string;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            data-testid={testId}
            onClick={onClick}
            className={`rounded-[10px] border px-3 py-1.5 text-[12px] font-medium transition-colors ${
                active
                    ? 'border-[#0d99ff]/55 bg-[#0d99ff]/16 text-white'
                    : 'border-white/10 bg-white/4 text-white/72 hover:bg-white/8'
            }`}
        >
            {children}
        </button>
    );
}

export function EditorHeaderBar({
    sceneName,
    leftTab,
    leftDrawerOpen,
    inspectorOpen,
    sourceOpen,
    overlayVisible,
    canUndo = false,
    canRedo = false,
    canDeleteSelection = false,
    isSaving = false,
    saveDisabled = false,
    onToggleLeftTab,
    onToggleInspector,
    onToggleOverlay,
    onToggleSource,
    onUndo,
    onRedo,
    onDeleteSelection,
    onSave,
}: EditorHeaderBarProps) {
    return (
        <div className="flex items-center justify-between gap-4 rounded-[18px] border border-white/10 bg-[#17110e]/96 px-4 py-3 shadow-[0_18px_42px_rgba(0,0,0,0.28)]">
            <div className="min-w-0">
                <div className="text-[11px] font-semibold tracking-[0.18em] text-[#c9b696]">页面编辑器</div>
                <div className="truncate text-[15px] font-semibold text-[#fff4e6]">{sceneName}</div>
                <div className="mt-1 text-[11px] text-white/46">撤销 Ctrl+Z · 重做 Ctrl+Shift+Z · 删除 Delete · 取消 Esc · 微移 方向键 · 快移 Shift+方向键</div>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
                <button
                    type="button"
                    data-testid="home-v2-editor-undo"
                    disabled={!canUndo}
                    onClick={onUndo}
                    className="rounded-[10px] border border-white/10 bg-white/4 px-3 py-1.5 text-[12px] text-white/74 transition-colors hover:bg-white/8 disabled:cursor-not-allowed disabled:opacity-35"
                >
                    撤销
                </button>
                <button
                    type="button"
                    data-testid="home-v2-editor-redo"
                    disabled={!canRedo}
                    onClick={onRedo}
                    className="rounded-[10px] border border-white/10 bg-white/4 px-3 py-1.5 text-[12px] text-white/74 transition-colors hover:bg-white/8 disabled:cursor-not-allowed disabled:opacity-35"
                >
                    重做
                </button>
                <button
                    type="button"
                    data-testid="home-v2-editor-delete"
                    disabled={!canDeleteSelection}
                    onClick={onDeleteSelection}
                    className="rounded-[10px] border border-red-300/18 bg-red-500/10 px-3 py-1.5 text-[12px] text-red-100 transition-colors hover:bg-red-500/16 disabled:cursor-not-allowed disabled:opacity-35"
                >
                    删除所选
                </button>
                <TabButton testId="home-v2-editor-tab-layers" active={leftDrawerOpen && leftTab === '图层'} onClick={() => onToggleLeftTab('图层')}>图层</TabButton>
                <TabButton testId="home-v2-editor-tab-components" active={leftDrawerOpen && leftTab === '组件'} onClick={() => onToggleLeftTab('组件')}>组件</TabButton>
                <TabButton testId="home-v2-editor-tab-assets" active={leftDrawerOpen && leftTab === '资源'} onClick={() => onToggleLeftTab('资源')}>资源</TabButton>
                <TabButton testId="home-v2-editor-tab-inspector" active={inspectorOpen} onClick={onToggleInspector}>属性</TabButton>
                <TabButton testId="home-v2-editor-tab-overlay" active={overlayVisible} onClick={onToggleOverlay}>画布辅助</TabButton>
                <TabButton testId="home-v2-editor-tab-source" active={sourceOpen} onClick={onToggleSource}>高级源码</TabButton>
                <button
                    type="button"
                    data-testid="home-v2-editor-save"
                    disabled={saveDisabled || isSaving}
                    onClick={onSave}
                    className="rounded-[10px] bg-[#ffe0a6] px-4 py-1.5 text-[12px] font-semibold text-[#3f2a17] disabled:cursor-not-allowed disabled:opacity-45"
                >
                    {isSaving ? '保存中...' : '保存'}
                </button>
            </div>
        </div>
    );
}
