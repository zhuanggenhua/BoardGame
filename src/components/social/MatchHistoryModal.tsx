import { motion } from 'framer-motion';
import { X, Trophy, Calendar, Clock } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';

interface MatchHistoryModalProps {
    isOpen: boolean;
    onClose: () => void;
}

// 模拟数据
const MOCK_HISTORY = [
    { id: '1', gameKey: 'tictactoe', result: 'win', opponent: 'Alice', date: '2024-03-10', duration: '5m' },
    { id: '2', gameKey: 'chess', result: 'loss', opponent: 'Bob', date: '2024-03-09', duration: '25m' },
    { id: '3', gameKey: 'gomoku', result: 'draw', opponent: 'Charlie', date: '2024-03-08', duration: '12m' },
];

export const MatchHistoryModal = ({ isOpen, onClose }: MatchHistoryModalProps) => {
    const { t } = useTranslation(['social', 'common']);

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
            >
                {/* 标题区域 */}
                <div className="flex items-center justify-between p-4 border-b border-parchment-card-border/30 bg-parchment-base-bg">
                    <div className="flex items-center gap-2 text-parchment-base-text">
                        <Trophy size={20} />
                        <h2 className="font-bold text-lg">{t('social:matchHistory.title')}</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-full hover:bg-parchment-card-border/20 transition-colors text-parchment-base-text"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* 内容区域 */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                    {MOCK_HISTORY.length === 0 ? (
                        <div className="text-center text-parchment-light-text py-12 italic">
                            {t('social:matchHistory.empty')}
                        </div>
                    ) : (
                        MOCK_HISTORY.map(match => (
                            <div key={match.id} className="bg-white border border-parchment-card-border/20 rounded p-4 flex items-center justify-between shadow-sm">
                                <div className="flex items-center gap-4">
                                    <div className={clsx(
                                        "w-10 h-10 rounded-full flex items-center justify-center font-bold text-white",
                                        match.result === 'win' ? "bg-green-500" : match.result === 'loss' ? "bg-red-500" : "bg-gray-400"
                                    )}>
                                        {t(`social:matchHistory.resultShort.${match.result}`)}
                                    </div>
                                    <div>
                                        <div className="font-bold text-parchment-base-text">{t(`social:matchHistory.games.${match.gameKey}`)}</div>
                                        <div className="text-xs text-parchment-light-text flex items-center gap-2">
                                            <span>{t('social:matchHistory.vs', { name: match.opponent })}</span>
                                            <span className="w-1 h-1 rounded-full bg-parchment-light-text" />
                                            <span className="flex items-center gap-1"><Calendar size={10} /> {match.date}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className={clsx(
                                        "font-bold text-sm uppercase tracking-wider",
                                        match.result === 'win' ? "text-green-600" : match.result === 'loss' ? "text-red-500" : "text-gray-500"
                                    )}>
                                        {t(`social:matchHistory.result.${match.result}`)}
                                    </div>
                                    <div className="text-xs text-parchment-light-text flex items-center justify-end gap-1 mt-1">
                                        <Clock size={10} /> {match.duration}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </motion.div>
        </div>
    );
};
