import { motion } from 'framer-motion';
import { X, Trophy } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuthModalSession } from '../../hooks/ui/useAuthModalSession';
import { MatchHistoryList } from './MatchHistoryList';

interface MatchHistoryModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const MatchHistoryModal = ({ isOpen, onClose }: MatchHistoryModalProps) => {
    useAuthModalSession(isOpen, onClose);
    const { t } = useTranslation(['lobby', 'social', 'common']);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* 背景遮罩 */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
                className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />

            {/* 弹窗内容 */}
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                className="relative bg-parchment-card-bg w-full max-w-2xl max-h-[80vh] rounded-lg shadow-2xl overflow-hidden flex flex-col border border-parchment-card-border/30"
                data-platform-dialog="history"
            >
                {/* 标题区域 */}
                <div className="flex items-center justify-between p-4 border-b border-parchment-card-border/30 bg-parchment-base-bg">
                    <div className="flex items-center gap-2 text-parchment-base-text">
                        <Trophy size={20} />
                        <h2 className="font-bold text-lg">{t('social:matchHistory.title')}</h2>
                    </div>
                    <button
                        onClick={onClose}
                        aria-label={t('common:close')}
                        className="platform-dialog-close p-1.5 rounded-full hover:bg-parchment-card-border/20 transition-colors text-parchment-base-text"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* 内容区域 */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                    <MatchHistoryList />
                </div>
            </motion.div>
        </div>
    );
};
