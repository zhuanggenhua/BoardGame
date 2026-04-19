import React from 'react';

export interface AuthorToolbarProps {
    overlayVisible: boolean;
    hierarchyOpen: boolean;
    inspectorOpen: boolean;
    yamlPanelOpen: boolean;
    saveDisabled?: boolean;
    isSaving?: boolean;
    onToggleOverlay: () => void;
    onToggleHierarchy: () => void;
    onToggleInspector: () => void;
    onToggleYamlPanel: () => void;
    onSave: () => void;
}

function ToolButton({
    active,
    children,
    onClick,
}: {
    active?: boolean;
    children: React.ReactNode;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`rounded-full border px-3 py-1.5 text-[12px] transition-colors ${
                active
                    ? 'border-amber-300/60 bg-amber-200/12 text-amber-50'
                    : 'border-white/10 bg-white/5 text-white/70 hover:bg-white/10'
            }`}
        >
            {children}
        </button>
    );
}

export function AuthorToolbar({
    overlayVisible,
    hierarchyOpen,
    inspectorOpen,
    yamlPanelOpen,
    saveDisabled = false,
    isSaving = false,
    onToggleOverlay,
    onToggleHierarchy,
    onToggleInspector,
    onToggleYamlPanel,
    onSave,
}: AuthorToolbarProps) {
    return (
        <div className="pointer-events-auto fixed bottom-4 left-1/2 z-[2200] flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/12 bg-[#130d09]/94 px-3 py-2 shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur-md">
            <span className="px-2 text-[11px] font-semibold tracking-[0.18em] text-amber-200/70">作者模式</span>
            <ToolButton active={overlayVisible} onClick={onToggleOverlay}>画布辅助</ToolButton>
            <ToolButton active={hierarchyOpen} onClick={onToggleHierarchy}>层级树</ToolButton>
            <ToolButton active={inspectorOpen} onClick={onToggleInspector}>属性</ToolButton>
            <ToolButton active={yamlPanelOpen} onClick={onToggleYamlPanel}>源码</ToolButton>
            <button
                type="button"
                onClick={onSave}
                disabled={saveDisabled || isSaving}
                className="rounded-full bg-amber-200 px-4 py-1.5 text-[12px] font-semibold text-[#3f2a17] transition-opacity disabled:cursor-not-allowed disabled:opacity-45"
            >
                {isSaving ? '保存中...' : '保存'}
            </button>
        </div>
    );
}
