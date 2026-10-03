import React, { type CSSProperties, type ReactNode } from 'react';
import { UI_Z_INDEX, type CardPreviewRef } from '../../../core';
import { CardPreview } from '../../common/media/CardPreview';

export interface CardChoiceOption {
    id: string;
    previewRef?: CardPreviewRef | null;
    aspectRatio?: number | string;
    ariaLabel: string;
    fallbackLabel?: string;
    disabled?: boolean;
    selected?: boolean;
    testId?: string;
    previewTestId?: string;
    dataAttributes?: Record<string, string | number | boolean | undefined>;
}

export interface CardChoiceOverlayProps {
    isOpen: boolean;
    title: ReactNode;
    subtitle?: ReactNode;
    options: readonly CardChoiceOption[];
    onSelect: (id: string) => void;
    onCancel: () => void;
    cancelLabel: string;
    confirmLabel?: string;
    confirmDisabled?: boolean;
    onConfirm?: () => void;
    selectedCount?: ReactNode;
    selectionMode?: 'single' | 'multi';
    cardHeightClassName?: string;
    choiceMaxWidth?: string;
    gridMaxHeightClassName?: string;
    /**
     * 显式高度只能描述候选浮层自己的窗口。
     * 不得用下层 UI 的高度反推或扣除候选窗口空间。
     */
    gridHeightStyle?: CSSProperties;
    tone?: 'sky' | 'amber';
    testId?: string;
}

const TONE_CLASSES = {
    sky: {
        hoverCard: 'hover:drop-shadow-[0_0_16px_rgba(125,211,252,0.34)]',
        selectedCard: '-translate-y-1 scale-[1.03] drop-shadow-[0_0_18px_rgba(125,211,252,0.52)]',
        fallbackText: 'text-sky-100',
    },
    amber: {
        hoverCard: 'hover:drop-shadow-[0_0_16px_rgba(251,191,36,0.34)]',
        selectedCard: '-translate-y-1 scale-[1.03] drop-shadow-[0_0_18px_rgba(251,191,36,0.52)]',
        fallbackText: 'text-amber-100',
    },
} as const;

export function CardChoiceOverlay({
    isOpen,
    title,
    subtitle,
    options,
    onSelect,
    onCancel,
    cancelLabel,
    confirmLabel = '确认',
    confirmDisabled = false,
    onConfirm,
    selectedCount,
    selectionMode = 'single',
    cardHeightClassName = 'h-[8.25rem]',
    choiceMaxWidth = 'min(92rem, 96vw)',
    gridMaxHeightClassName = 'max-h-[min(42rem,calc(100dvh-12rem))]',
    gridHeightStyle,
    tone = 'sky',
    testId = 'card-choice-overlay',
}: CardChoiceOverlayProps) {
    if (!isOpen || options.length === 0) return null;

    const colors = TONE_CLASSES[tone];

    return (
        <aside
            className="pointer-events-none absolute inset-x-0 top-[8.5rem] z-50 flex justify-center px-4"
            data-testid={testId}
            data-choice-overlay-layer="independent"
            style={{ zIndex: UI_Z_INDEX.overlayRaised }}
        >
            <section
                className="pointer-events-auto mx-auto w-full max-w-full"
                style={{ maxWidth: choiceMaxWidth }}
            >
                <div className="mx-auto mb-3 inline-flex max-w-full items-start justify-between gap-4 rounded-md bg-stone-950/55 px-3 py-2 backdrop-blur-sm">
                    <div className="min-w-0">
                        <div className="text-sm font-bold text-stone-100">{title}</div>
                        {selectedCount !== undefined ? (
                            <div className="mt-0.5 text-xs font-semibold text-stone-300">{selectedCount}</div>
                        ) : subtitle ? (
                            <div className="mt-0.5 truncate text-xs font-semibold text-stone-300">{subtitle}</div>
                        ) : null}
                    </div>
                    {selectionMode === 'single' ? (
                        <button
                            type="button"
                            className="shrink-0 rounded-[0.25rem] border border-stone-500/60 px-2.5 py-1 text-xs font-bold text-stone-200 transition hover:border-stone-300 hover:bg-stone-800"
                            data-testid={`${testId}-cancel`}
                            onClick={onCancel}
                        >
                            {cancelLabel}
                        </button>
                    ) : null}
                </div>

                <div
                    className={`flex w-full max-w-full ${gridMaxHeightClassName} flex-wrap items-start justify-center gap-4 overflow-y-auto px-1 py-1`}
                    style={gridHeightStyle}
                    data-choice-layout="wrap"
                    data-choice-scroll-window={gridHeightStyle || gridMaxHeightClassName !== 'max-h-none' ? 'true' : 'false'}
                    data-choice-scroll-policy="overlay-owned"
                >
                    {options.map((option) => (
                        <button
                            key={option.id}
                            type="button"
                            className={[
                                'group relative flex shrink-0 items-center justify-center bg-transparent p-0 text-left transition-transform duration-200',
                                colors.hoverCard,
                                option.disabled ? 'cursor-not-allowed opacity-45' : 'cursor-pointer',
                                option.selected ? colors.selectedCard : 'hover:-translate-y-1',
                            ].join(' ')}
                            aria-label={option.ariaLabel}
                            aria-pressed={option.selected}
                            disabled={option.disabled}
                            data-testid={option.testId ?? `${testId}-option`}
                            data-choice-id={option.id}
                            data-choice-card-preview={option.previewRef ? 'true' : 'false'}
                            data-choice-selected={option.selected ? 'true' : 'false'}
                            {...option.dataAttributes}
                            onClick={() => onSelect(option.id)}
                        >
                            {option.selected ? (
                                <span
                                    aria-hidden="true"
                                    className="absolute right-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-white/70 bg-stone-950/85 text-sm font-black text-white shadow-lg"
                                    data-testid={`${option.testId ?? `${testId}-option`}-selected-indicator`}
                                >
                                    ✓
                                </span>
                            ) : null}
                            {option.previewRef ? (
                                <span
                                    className={`block shrink-0 ${cardHeightClassName} overflow-hidden`}
                                    style={{ aspectRatio: option.aspectRatio ?? 0.714 }}
                                    data-testid={option.previewTestId ?? `${option.testId ?? testId}-card-preview`}
                                >
                                    <CardPreview
                                        previewRef={option.previewRef}
                                        className="h-full w-full"
                                        alt={option.ariaLabel}
                                    />
                                </span>
                            ) : (
                                <span className={`flex ${cardHeightClassName} w-full items-center justify-center px-3 text-center text-xs font-bold leading-tight ${colors.fallbackText}`}>
                                    {option.fallbackLabel ?? option.ariaLabel}
                                </span>
                            )}
                        </button>
                    ))}
                </div>

                {selectionMode === 'multi' ? (
                    <div
                        className="mt-3 flex items-center justify-center gap-2"
                        data-testid={`${testId}-actions`}
                    >
                        <button
                            type="button"
                            className="rounded-[0.25rem] border border-stone-500/60 px-2.5 py-1 text-xs font-bold text-stone-200 transition hover:border-stone-300 hover:bg-stone-800"
                            data-testid={`${testId}-cancel`}
                            onClick={onCancel}
                        >
                            {cancelLabel}
                        </button>
                        {onConfirm ? (
                            <button
                                type="button"
                                className="rounded-[0.25rem] border border-amber-300/70 bg-amber-300 px-2.5 py-1 text-xs font-black text-stone-950 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-45"
                                data-testid={`${testId}-confirm`}
                                disabled={confirmDisabled}
                                onClick={onConfirm}
                            >
                                {confirmLabel}
                            </button>
                        ) : null}
                    </div>
                ) : null}
            </section>
        </aside>
    );
}
