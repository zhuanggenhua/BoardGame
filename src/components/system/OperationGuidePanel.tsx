import { useMemo, useRef } from 'react';
import type { CSSProperties } from 'react';
import type { TFunction } from 'i18next';
import { HelpCircle, Maximize2, Move, MousePointerClick, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useModalStack } from '../../contexts/ModalStackContext';

export type OperationGuideSurface = 'web' | 'app';

export interface OperationGuideFabEntry {
    id: string;
    label: string;
    description: string;
}

type OperationGuideActionInput = {
    id: string;
    label: string;
};

type OperationGuideButtonVariant = 'classic' | 'book';

const commonOperationKeys = [
    'fabMenu',
    'mobileLongPress',
    'desktopInspect',
    'boardZoom',
    'closeLayer',
] as const;

const globalWebFloatingActionIds = [
    'settings',
    'display-theme',
    'fullscreen',
    'download-app',
    'about',
    'feedback',
    'social',
] as const;

const globalAppFloatingActionIds = [
    'settings',
    'display-theme',
    'check-update',
    'about',
    'feedback',
    'social',
] as const;

const gameFloatingActionIds = [
    'exit',
    'chat',
    'emotes',
    'action-log',
    'undo',
    'seat-swap',
    'force-actions',
    'settings',
    'feedback',
] as const;

const operationGuideScreenshots = {
    web: '/images/operation-guide/home-web-fab-annotated.png',
    app: '/images/operation-guide/home-app-fab-annotated.png',
    longPress: '/images/operation-guide/mobile-long-press-annotated.png',
} as const;

const operationGuideScreenshotAltKeys: Record<OperationGuideSurface, string> = {
    web: 'hud.operationGuide.visual.webFabImageAlt',
    app: 'hud.operationGuide.visual.appFabImageAlt',
};

const resolveFabDescriptionKey = (id: string) => {
    if (id.startsWith('undo-') || id === 'undo') return 'undo';

    switch (id) {
        case 'action-log':
            return 'actionLog';
        case 'display-theme':
            return 'displayTheme';
        case 'download-app':
            return 'downloadApp';
        case 'check-update':
            return 'checkUpdate';
        case 'force-actions':
            return 'forceActions';
        case 'seat-swap':
            return 'seatSwap';
        default:
            return id;
    }
};

const resolveFabLabel = (t: TFunction, id: string) => {
    const descriptionKey = resolveFabDescriptionKey(id);
    return String(t(`hud.operationGuide.fabLabels.${descriptionKey}`, {
        defaultValue: t(`hud.actions.${descriptionKey}`, {
            defaultValue: id,
        }),
    }));
};

export const buildOperationGuideFabEntries = (
    t: TFunction,
    actions: OperationGuideActionInput[],
): OperationGuideFabEntry[] => actions
    .filter((action) => action.id !== 'operation-guide')
    .map((action) => ({
        id: action.id,
        label: action.label,
        description: String(t(`hud.operationGuide.fab.${resolveFabDescriptionKey(action.id)}`, {
            defaultValue: t('hud.operationGuide.fab.custom'),
        })),
    }));

const buildDefaultOperationGuideFabEntries = (
    t: TFunction,
    surface: OperationGuideSurface,
) => {
    const globalIds = surface === 'app' ? globalAppFloatingActionIds : globalWebFloatingActionIds;
    return {
        global: buildOperationGuideFabEntries(
            t,
            globalIds.map((id) => ({ id, label: resolveFabLabel(t, id) })),
        ),
        game: buildOperationGuideFabEntries(
            t,
            gameFloatingActionIds.map((id) => ({ id, label: resolveFabLabel(t, id) })),
        ),
    };
};

interface OperationGuideScreenshotFigureProps {
    t: TFunction;
    surface: OperationGuideSurface;
}

const OperationGuideScreenshotFigure = ({ t, surface }: OperationGuideScreenshotFigureProps) => (
    <div
        className="overflow-hidden rounded-xl border border-[#c9ad75]/55 bg-[#1c2430] p-3 text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]"
        data-testid="operation-guide-annotated-screenshot"
    >
        <div className="mb-3 rounded-lg bg-[#f8ecd2] px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-[#4b311b]">
            {t('hud.operationGuide.visual.realScreenshotsTitle')}
        </div>

        <div className="grid gap-3">
            <figure
                className="overflow-hidden rounded-xl border border-white/12 bg-black/30"
                data-testid="operation-guide-home-fab-screenshot"
            >
                <img
                    className="block max-h-[16rem] w-full bg-[#22180f] object-contain"
                    src={operationGuideScreenshots[surface]}
                    alt={String(t(operationGuideScreenshotAltKeys[surface]))}
                    loading="lazy"
                    data-testid="operation-guide-real-screenshot-home-fab"
                />
                <figcaption className="grid gap-2 border-t border-white/10 bg-black/45 p-3 text-xs leading-relaxed text-white/88 sm:grid-cols-2">
                    <span data-testid="operation-guide-callout-main-fab">
                        {t('hud.operationGuide.visual.dragCallout')}
                    </span>
                    <span data-testid="operation-guide-callout-satellite-buttons">
                        {t('hud.operationGuide.visual.expandCallout')}
                    </span>
                </figcaption>
            </figure>

            <figure
                className="overflow-hidden rounded-xl border border-white/12 bg-black/30"
                data-testid="operation-guide-long-press-figure"
            >
                <img
                    className="block max-h-[16rem] w-full bg-[#22180f] object-contain"
                    src={operationGuideScreenshots.longPress}
                    alt={String(t('hud.operationGuide.visual.longPressImageAlt'))}
                    loading="lazy"
                    data-testid="operation-guide-real-screenshot-long-press"
                />
                <figcaption className="border-t border-white/10 bg-black/45 p-3 text-xs leading-relaxed text-white/88">
                    <strong className="mb-1 block text-white" data-testid="operation-guide-callout-long-press">
                        {t('hud.operationGuide.visual.longPressTitle')}
                    </strong>
                    {t('hud.operationGuide.visual.longPressDescription')}
                </figcaption>
            </figure>
        </div>
    </div>
);

interface OperationGuideModalProps {
    t: TFunction;
    close: () => void;
    closeOnBackdrop: boolean;
    entries: {
        global: readonly OperationGuideFabEntry[];
        game: readonly OperationGuideFabEntry[];
    };
    surface: OperationGuideSurface;
}

const OperationGuideModal = ({
    t,
    close,
    closeOnBackdrop,
    entries,
    surface,
}: OperationGuideModalProps) => (
    <>
        <div
            className="fixed inset-0 bg-black/55 backdrop-blur-sm"
            data-testid="operation-guide-backdrop"
            onClick={closeOnBackdrop ? close : undefined}
        />
        <div className="pointer-events-none fixed inset-0 flex items-center justify-center px-3 py-[max(1rem,env(safe-area-inset-top))]">
            <section
                role="dialog"
                aria-modal="true"
                aria-labelledby="operation-guide-title"
                className="pointer-events-auto flex max-h-[min(88vh,46rem)] w-[min(66rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-2xl border border-[#d4b36f]/70 bg-[#f8efdb] text-[#3f2c1c] shadow-[0_24px_70px_rgba(0,0,0,0.42)]"
                data-testid="operation-guide-modal"
            >
                <header className="flex items-start justify-between gap-4 border-b border-[#c7aa76]/45 bg-[#4b311f] px-4 py-4 text-[#fff4dc] sm:px-5">
                    <div className="min-w-0">
                        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#e8c982]">
                            {t('hud.operationGuide.eyebrow')}
                        </p>
                        <h2 id="operation-guide-title" className="mt-1 text-xl font-black tracking-wide sm:text-2xl">
                            {t('hud.operationGuide.title')}
                        </h2>
                        <p className="mt-1 max-w-3xl text-sm leading-relaxed text-[#f4dfb8]/88">
                            {t(`hud.operationGuide.surface.${surface}`)}
                        </p>
                    </div>
                    <button
                        type="button"
                        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#f4dfb8]/30 bg-white/8 text-[#fff4dc] transition hover:bg-white/16 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f4dfb8]"
                        aria-label={String(t('hud.actions.close'))}
                        data-testid="operation-guide-close"
                        onClick={close}
                    >
                        <X size={20} />
                    </button>
                </header>

                <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
                    <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
                        <OperationGuideScreenshotFigure t={t} surface={surface} />
                        <section className="rounded-xl border border-[#cfb27f]/60 bg-[#fff9ea]/80 p-4">
                            <h3 className="flex items-center gap-2 text-base font-black text-[#4d321d]">
                                <MousePointerClick size={18} />
                                {t('hud.operationGuide.common.title')}
                            </h3>
                            <ul className="mt-3 space-y-2" data-testid="operation-guide-common-list">
                                {commonOperationKeys.map((key) => (
                                    <li
                                        key={key}
                                        className="rounded-lg border border-[#dcc69e] bg-white/65 px-3 py-2 text-sm leading-relaxed text-[#5d4229]"
                                    >
                                        {t(`hud.operationGuide.common.${key}`)}
                                    </li>
                                ))}
                            </ul>
                        </section>
                    </div>

                    <section className="mt-4 rounded-xl border border-[#cfb27f]/60 bg-[#fff9ea]/80 p-4">
                        <h3 className="flex items-center gap-2 text-base font-black text-[#4d321d]">
                            <Move size={18} />
                            {t('hud.operationGuide.fab.title')}
                        </h3>
                        <div className="mt-3 grid gap-3 lg:grid-cols-2" data-testid="operation-guide-fab-list">
                            <OperationGuideFabGroup
                                title={String(t(surface === 'app'
                                    ? 'hud.operationGuide.fab.appTitle'
                                    : 'hud.operationGuide.fab.webTitle'))}
                                entries={entries.global}
                            />
                            <OperationGuideFabGroup
                                title={String(t('hud.operationGuide.fab.gameTitle'))}
                                entries={entries.game}
                            />
                        </div>
                    </section>
                </div>
            </section>
        </div>
    </>
);

interface OperationGuideFabGroupProps {
    title: string;
    entries: readonly OperationGuideFabEntry[];
}

const OperationGuideFabGroup = ({ title, entries }: OperationGuideFabGroupProps) => (
    <div className="rounded-lg border border-[#dcc69e] bg-white/65 p-3" data-testid="operation-guide-fab-group">
        <div className="text-sm font-black text-[#4d321d]">{title}</div>
        <div className="mt-2 space-y-2">
            {entries.map((entry) => (
                <div
                    key={entry.id}
                    className="rounded-md border border-[#e3d0aa] bg-[#fffdf6] px-3 py-2"
                    data-testid={`operation-guide-fab-item-${entry.id}`}
                >
                    <div className="text-sm font-bold text-[#3f2c1c]">{entry.label}</div>
                    <div className="mt-0.5 text-xs leading-relaxed text-[#76593a]">{entry.description}</div>
                </div>
            ))}
        </div>
    </div>
);

interface OperationGuideButtonProps {
    surface: OperationGuideSurface;
    variant?: OperationGuideButtonVariant;
    className?: string;
    style?: CSSProperties;
    iconSize?: number | string;
    dataTestId?: string;
}

export const OperationGuideButton = ({
    surface,
    variant = 'classic',
    className = '',
    style,
    iconSize,
    dataTestId = 'operation-guide-entry',
}: OperationGuideButtonProps) => {
    const { t } = useTranslation('game');
    const { openModal, closeModal } = useModalStack();
    const modalIdRef = useRef<string | null>(null);
    const entries = useMemo(() => buildDefaultOperationGuideFabEntries(t, surface), [surface, t]);
    const label = String(t('hud.actions.operationGuide'));
    const resolvedIconSize = iconSize ?? (variant === 'book' ? 18 : 16);
    const variantClassName = variant === 'book'
        ? 'group flex h-full w-full items-center justify-end border-0 bg-transparent p-0 font-serif font-bold text-[#2f2116] transition-colors hover:text-[#6d3d20] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e1c36c]/70'
        : 'group relative inline-flex h-8 items-center gap-1.5 whitespace-nowrap text-parchment-base-text hover:text-[#2c2216] cursor-pointer font-bold text-sm tracking-wider transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-parchment-brown/50';

    const handleOpen = () => {
        if (modalIdRef.current) {
            closeModal(modalIdRef.current);
            modalIdRef.current = null;
        }

        modalIdRef.current = openModal({
            id: 'operation-guide-modal',
            closeOnBackdrop: true,
            closeOnEsc: true,
            lockScroll: true,
            onClose: () => {
                modalIdRef.current = null;
            },
            render: ({ close, closeOnBackdrop }) => (
                <OperationGuideModal
                    t={t}
                    close={close}
                    closeOnBackdrop={closeOnBackdrop}
                    entries={entries}
                    surface={surface}
                />
            ),
        });
    };

    return (
        <button
            type="button"
            className={`${variantClassName} ${className}`.trim()}
            style={style}
            data-testid={dataTestId}
            aria-label={label}
            title={label}
            onClick={handleOpen}
        >
            {variant === 'classic'
                ? <Maximize2 size={resolvedIconSize} aria-hidden="true" />
                : <HelpCircle size={resolvedIconSize} aria-hidden="true" />}
            <span className="relative z-10">{label}</span>
            {variant === 'classic' ? <span className="underline-center" /> : null}
        </button>
    );
};
