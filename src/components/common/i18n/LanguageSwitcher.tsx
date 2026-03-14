import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { LANGUAGE_OPTIONS } from '../../../lib/i18n/types';
import { motion, AnimatePresence } from 'framer-motion';
import clsx from 'clsx';
import { UI_Z_INDEX } from '../../../core';

interface LanguageSwitcherProps {
    className?: string;
}

export const LanguageSwitcher = ({ className = '' }: LanguageSwitcherProps) => {
    const { i18n, t } = useTranslation('common');
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const currentLanguage = i18n.resolvedLanguage ?? i18n.language;

    const currentOption = LANGUAGE_OPTIONS.find(opt => opt.code === currentLanguage) || LANGUAGE_OPTIONS[0];

    // 点击外部关闭下拉菜单
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleLanguageChange = (code: string) => {
        void i18n.changeLanguage(code);
        setIsOpen(false);
    };

    const languageFlags: Record<string, string> = {
        'zh-CN': '🇨🇳',
        en: '🇺🇸'
    };

    return (
        <div ref={containerRef} className={clsx('relative flex h-8 items-center', className)}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={clsx(
                    'group relative inline-flex h-8 items-center border-0 bg-transparent p-0 text-sm font-bold leading-none tracking-tight text-parchment-base-text transition-colors hover:text-parchment-brown cursor-pointer'
                )}
                title={currentOption.label}
            >
                <span>{t('language.label')}</span>
                <span className="underline-center" />
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -4, scale: 0.95 }}
                        animate={{ opacity: 1, y: 4, scale: 1 }}
                        exit={{ opacity: 0, y: -4, scale: 0.95 }}
                        transition={{ duration: 0.15, ease: 'easeOut' }}
                        className={clsx(
                            'absolute top-full right-0 mt-1 min-w-[120px]',
                            'bg-[#fefcf7] border border-[#d3ccba] shadow-[0_4px_12px_rgba(67,52,34,0.15)] rounded overflow-hidden',
                            'py-1'
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
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
