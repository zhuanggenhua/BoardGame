import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { HomeEntryStyle } from '../../lib/homeV2Routing';
import './home-style-settings.css';

interface HomeStyleSettingsProps {
    currentStyle: HomeEntryStyle;
    onSelectStyle: (style: HomeEntryStyle) => void;
}

/** 首页外观是浮球设置中的一组选择项，面板开合由浮球持有。 */
export function HomeStyleSettings({ currentStyle, onSelectStyle }: HomeStyleSettingsProps) {
    const { t } = useTranslation('lobby');
    const root = useRef<HTMLDivElement>(null);
    useEffect(() => { root.current?.querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus(); }, []);
    return <div ref={root} className="home-style-options" role="radiogroup" aria-label={t('homeAppearance.style', { defaultValue: '首页风格' })}
        onKeyDown={event => {
            if (!['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
            event.preventDefault();
            onSelectStyle(event.key === 'Home' ? 'modern' : event.key === 'End' ? 'classic' : currentStyle === 'modern' ? 'classic' : 'modern');
        }}>
        <p>{t('homeAppearance.title', { defaultValue: '首页外观' })}</p>
        <div className="home-style-options-row">
            {(['modern', 'classic'] as const).map(style => <button key={style} type="button" role="radio"
                aria-checked={currentStyle === style} tabIndex={currentStyle === style ? 0 : -1}
                data-testid={'home-style-' + style} onClick={() => onSelectStyle(style)}>
                {style === 'modern' ? t('homeAppearance.modern', { defaultValue: '现代' }) : t('homeAppearance.classic', { defaultValue: '经典' })}
            </button>)}
        </div>
    </div>;
}
