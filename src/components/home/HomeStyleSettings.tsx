import { useId, useState } from 'react';
import { Settings } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { HomeEntryStyle } from '../../lib/homeV2Routing';

interface HomeStyleSettingsProps {
    currentStyle: HomeEntryStyle;
    onSelectStyle: (style: HomeEntryStyle) => void;
    visualStyle: HomeEntryStyle;
}

export function HomeStyleSettings({ currentStyle, onSelectStyle, visualStyle }: HomeStyleSettingsProps) {
    const { t } = useTranslation('lobby');
    const [isOpen, setIsOpen] = useState(false);
    const panelId = useId();
    const modern = visualStyle === 'modern';
    const settingsLabel = t('homeAppearance.settings', { defaultValue: 'Home settings' });
    const panelLabel = t('homeAppearance.title', { defaultValue: 'Home appearance' });

    return (
        <div className="relative z-50" data-testid="home-style-settings">
            <button
                type="button"
                aria-label={settingsLabel}
                aria-expanded={isOpen}
                aria-controls={panelId}
                title={settingsLabel}
                data-testid="home-style-settings-trigger"
                className={modern
                    ? 'inline-flex items-center gap-1.5 rounded-md border border-white/15 bg-white/5 px-2.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60'
                    : 'inline-flex items-center gap-1.5 rounded-sm border border-parchment-card-border/60 bg-parchment-card-bg/80 px-2.5 py-2 text-xs font-bold text-parchment-base-text transition-colors hover:bg-parchment-base-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-700/60'}
                onClick={() => setIsOpen((open) => !open)}
            >
                <Settings size={16} aria-hidden="true" />
                <span>{settingsLabel}</span>
            </button>
            {isOpen && (
                <div
                    id={panelId}
                    role="radiogroup"
                    aria-label={t('homeAppearance.style', { defaultValue: 'Home style' })}
                    className={modern
                        ? 'absolute right-0 top-full mt-2 w-56 rounded-lg border border-white/15 bg-[#151b24] p-3 text-white shadow-xl'
                        : 'absolute right-0 top-full mt-2 w-56 rounded-sm border border-parchment-card-border/60 bg-parchment-card-bg p-3 text-parchment-base-text shadow-lg'}
                >
                    <p className="mb-2 text-sm font-bold" id={`${panelId}-label`}>{panelLabel}</p>
                    <button
                        type="button"
                        role="radio"
                        aria-checked={currentStyle === 'modern'}
                        data-testid="home-style-modern"
                        className="flex w-full items-center justify-between rounded px-2 py-2 text-left text-sm hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current/50"
                        onClick={() => { onSelectStyle('modern'); setIsOpen(false); }}
                    >
                        {t('homeAppearance.modern', { defaultValue: 'Modern' })}
                    </button>
                    <button
                        type="button"
                        role="radio"
                        aria-checked={currentStyle === 'classic'}
                        data-testid="home-style-classic"
                        className="flex w-full items-center justify-between rounded px-2 py-2 text-left text-sm hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current/50"
                        onClick={() => { onSelectStyle('classic'); setIsOpen(false); }}
                    >
                        {t('homeAppearance.classic', { defaultValue: 'Classic' })}
                    </button>
                </div>
            )}
        </div>
    );
}
