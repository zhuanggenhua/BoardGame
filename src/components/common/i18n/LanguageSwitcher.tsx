import './platform-language.css';
import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown } from 'lucide-react';
import { LANGUAGE_OPTIONS } from '../../../lib/i18n/types';
import clsx from 'clsx';
import { UI_Z_INDEX } from '../../../core';

interface LanguageSwitcherProps {
    visualStyle?: 'classic' | 'platform';
    className?: string;
}

export const LanguageSwitcher = ({ className = '', visualStyle = 'classic' }: LanguageSwitcherProps) => {
    const { i18n, t } = useTranslation('common');
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const currentLanguage = i18n.resolvedLanguage ?? i18n.language;

    const currentOption = LANGUAGE_OPTIONS.find(opt => opt.code === currentLanguage) || LANGUAGE_OPTIONS[0];

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        const handleKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setIsOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleKey);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleKey);
        };
    }, []);

    const handleLanguageChange = (code: string) => {
        try {
            localStorage.setItem('bg_locale_preference', code);
        } catch {
            // ignore storage failures
        }
        void i18n.changeLanguage(code);
        setIsOpen(false);
    };

    const languageFlags: Record<string, string> = {
        'zh-CN': '🇨🇳',
        en: '🇺🇸'
    };

    const isPlatform = visualStyle === 'platform';

    return (
        <div data-language-style={visualStyle} ref={containerRef} className={clsx('relative flex h-8 items-center', className)}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                aria-label={t('language.label')}
                aria-expanded={isOpen}
                aria-haspopup="true"
                className={clsx(
                    'group relative inline-flex h-8 items-center border-0 bg-transparent p-0 text-sm font-bold leading-none tracking-tight cursor-pointer',
                    isPlatform ? undefined : 'text-parchment-base-text transition-colors hover:text-parchment-brown'
                )}
                title={currentOption.label}
            >
                <span>{isPlatform ? currentOption.label : t('language.label')}</span>
                {isPlatform ? <ChevronDown aria-hidden="true" size={14} /> : <span className="underline-center" />}
            </button>

            {isOpen && (isPlatform
                ? <div className="platform-language-menu" style={{ zIndex: UI_Z_INDEX.tooltip }}>
                    {LANGUAGE_OPTIONS.map((option) => (
                        <button
                            key={option.code}
                            type="button"
                            aria-pressed={currentLanguage === option.code}
                            onClick={() => handleLanguageChange(option.code)}
                        >
                            <span>{option.label}</span>
                            {currentLanguage === option.code ? <span aria-hidden="true">✓</span> : null}
                        </button>
                    ))}
                </div>
                : <div
                    className={clsx(
                        'absolute top-full right-0 mt-1 min-w-[120px]',
                        'bg-[#fefcf7] border border-[#d3ccba] shadow-[0_4px_12px_rgba(67,52,34,0.15)] rounded overflow-hidden',
                        'py-1 animate-in fade-in zoom-in-95 slide-in-from-top-1 duration-150'
                    )}
                    style={{ zIndex: UI_Z_INDEX.tooltip }}
                >
                    <div className="absolute -top-1.5 right-3 w-2.5 h-2.5 bg-[#fefcf7] border-l border-t border-[#d3ccba] rotate-45" />

                    {LANGUAGE_OPTIONS.map((option) => (
                        <button
                            key={option.code}
                            onClick={() => handleLanguageChange(option.code)}
                            className={clsx(
                                'group relative w-full flex items-center gap-3 px-4 py-3 text-left cursor-pointer transition-colors',
                                'text-[#433422] font-serif font-bold text-xs tracking-wider',
                                currentLanguage === option.code ? 'bg-[#f3f0e6]/50' : ''
                            )}
                        >
                            <span className="text-sm">{languageFlags[option.code]}</span>
                            <span className="relative z-10">{option.label}</span>
                            <span className="underline-center h-[1px] w-[60%] left-[20%] group-hover:w-[60%] group-hover:left-[20%]" />
                            {currentLanguage === option.code && (
                                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[#433422]" />
                            )}
                        </button>
                    ))}
                </div>)}
        </div>
    );
};
