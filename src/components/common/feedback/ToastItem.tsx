import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { X, CheckCircle2, AlertCircle, Info, AlertTriangle } from 'lucide-react';
import { useToast, type Toast, type ToastContent, type ToastTone } from '../../../contexts/ToastContext';
import clsx from 'clsx';

const ToneIcons: Record<ToastTone, React.ReactNode> = {
    success: <CheckCircle2 className="w-5 h-5 text-[#2f855a]" />,
    info: <Info className="w-5 h-5 text-[#433422]" />,
    warning: <AlertTriangle className="w-5 h-5 text-[#b7791f]" />,
    error: <AlertCircle className="w-5 h-5 text-[#c53030]" />,
};

const ToneStyles: Record<ToastTone, string> = {
    success: 'border-l-4 border-l-[#2f855a]',
    info: 'border-l-4 border-l-[#433422]',
    warning: 'border-l-4 border-l-[#b7791f]',
    error: 'border-l-4 border-l-[#c53030]',
};

export const ToastItem: React.FC<{ toast: Toast }> = ({ toast }) => {
    const { t } = useTranslation();
    const { dismiss } = useToast();

    const renderContent = (content: ToastContent) => {
        if (content.kind === 'text') {
            return content.text;
        }
        return t(content.key, { ns: content.ns, ...content.params });
    };

    return (
        <motion.div
            layout
            initial={{ opacity: 0, x: 50, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
            className={clsx(
                'relative bg-[#fcfbf9] w-80 shadow-[0_8px_30px_rgba(67,52,34,0.12)] border border-[#e5e0d0] rounded-sm p-4 flex gap-3 pointer-events-auto',
                ToneStyles[toast.tone]
            )}
        >
            <div className="flex-shrink-0 mt-0.5">
                {ToneIcons[toast.tone]}
            </div>

            <div className="flex-1 min-w-0">
                {toast.title && (
                    <h4 className="text-sm font-bold text-[#433422] mb-1 font-serif">
                        {renderContent(toast.title)}
                    </h4>
                )}
                <p className="text-xs text-[#8c7b64] leading-relaxed font-serif">
                    {renderContent(toast.message)}
                </p>
            </div>

            <button
                onClick={() => dismiss(toast.id)}
                className="flex-shrink-0 self-start p-1 -mt-1 -mr-1 text-[#8c7b64] hover:text-[#433422] hover:bg-[#efede6] rounded-full transition-colors cursor-pointer"
                aria-label={t('common:toast.close')}
            >
                <X className="w-4 h-4" />
            </button>

            {/* Decorative corners to match the parchment style */}
            <div className="absolute top-1 left-1 w-1.5 h-1.5 border-t border-l border-[#c0a080]/30" />
            <div className="absolute bottom-1 right-1 w-1.5 h-1.5 border-b border-r border-[#c0a080]/30" />
        </motion.div>
    );
};
