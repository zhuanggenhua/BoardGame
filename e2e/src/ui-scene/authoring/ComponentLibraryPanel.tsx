import React from 'react';

export type UISceneTemplateKind =
    | 'panel'
    | 'stack-vertical'
    | 'stack-horizontal'
    | 'grid'
    | 'text'
    | 'button'
    | 'image';

export interface ComponentLibraryPanelProps {
    selectedParentLabel: string;
    onInsert: (kind: UISceneTemplateKind) => void;
}

const TEMPLATE_ITEMS: Array<{
    kind: UISceneTemplateKind;
    title: string;
    description: string;
}> = [
    { kind: 'panel', title: '面板', description: '自由放置一个基础容器，用来承接局部内容。' },
    { kind: 'stack-vertical', title: '纵向容器', description: '自动按上下顺序摆放子项，适合列表和标题区。' },
    { kind: 'stack-horizontal', title: '横向容器', description: '自动按左右顺序摆放子项，适合工具条和按钮组。' },
    { kind: 'grid', title: '网格容器', description: '按列数摆放子项，适合卡片入口和宫格布局。' },
    { kind: 'text', title: '文字', description: '插入一段可编辑文案，后续可再挂国际化。' },
    { kind: 'button', title: '按钮', description: '插入一个基础按钮，后续可绑定中文动作。' },
    { kind: 'image', title: '图片', description: '插入一个图片节点，再从资源面板挑选素材。' },
];

export function ComponentLibraryPanel({ selectedParentLabel, onInsert }: ComponentLibraryPanelProps) {
    return (
        <div
            data-testid="home-v2-component-panel"
            className="flex h-full flex-col overflow-hidden rounded-[18px] border border-white/10 bg-[#17110e]/98 shadow-[0_18px_48px_rgba(0,0,0,0.24)]"
        >
            <div className="border-b border-white/10 px-4 py-3">
                <div className="text-[11px] font-semibold tracking-[0.22em] text-amber-200/70">组件</div>
                <div className="mt-1 text-sm font-semibold text-amber-50">添加到 {selectedParentLabel}</div>
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto px-3 py-3">
                {TEMPLATE_ITEMS.map((item) => (
                    <div
                        key={item.kind}
                        data-testid={`home-v2-component-card-${item.kind}`}
                        className="rounded-[16px] border border-white/8 bg-white/5 px-3 py-3"
                    >
                        <div className="text-sm font-semibold text-amber-50">{item.title}</div>
                        <div className="mt-1 text-[12px] leading-[1.6] text-white/55">{item.description}</div>
                        <button
                            type="button"
                            data-testid={`home-v2-component-insert-${item.kind}`}
                            onClick={() => onInsert(item.kind)}
                            className="mt-3 rounded-full bg-amber-200 px-3 py-1.5 text-[12px] font-semibold text-[#3f2a17]"
                        >
                            添加
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
}
