import { useTranslation } from 'react-i18next';
import { ThumbsUp, ThumbsDown, Trash2 } from 'lucide-react';
import type { Review } from '../../api/review';

interface ReviewItemProps {
    review: Review;
    isMine?: boolean;
    onDelete?: () => void;
}

export const ReviewItem = ({ review, isMine, onDelete }: ReviewItemProps) => {
    const { t, i18n } = useTranslation(['review']);

    const formatDate = (dateString: string) => {
        try {
            return new Intl.DateTimeFormat(i18n.language, {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            }).format(new Date(dateString));
        } catch (e) {
            return dateString;
        }
    };

    return (
        <div className="bg-parchment-card-bg border border-parchment-card-border/15 rounded p-2.5 flex flex-col gap-1.5 shadow-sm hover:shadow-md transition-shadow">
            {/* 顶部：头像（可选）+ 昵称 | 日期 + 操作 */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    {review.user?.avatar && (
                        <div className="w-6 h-6 rounded-full bg-parchment-base-bg overflow-hidden border border-parchment-card-border/20 shrink-0">
                            <img src={review.user.avatar} alt={review.user.username} className="w-full h-full object-cover" />
                        </div>
                    )}
                    <span className="font-bold text-parchment-base-text text-xs tracking-tight">
                        {review.user?.username || t('common.unknownUser', '未知用户')}
                    </span>
                </div>

                <div className="flex items-center gap-2">
                    <span className="text-[9px] text-parchment-light-text/50 uppercase tracking-tighter tabular-nums">
                        {formatDate(review.createdAt)}
                    </span>
                    {isMine && onDelete && (
                        <button
                            onClick={onDelete}
                            className="p-1 text-parchment-light-text/30 hover:text-red-500/70 transition-colors"
                            title={t('form.delete')}
                        >
                            <Trash2 size={12} />
                        </button>
                    )}
                </div>
            </div>

            {/* 内容：好评/差评图标 + 文本 */}
            <div className="flex items-start gap-2 pl-0.5">
                <div className="mt-0.5 shrink-0" title={review.isPositive ? t('form.positive') : t('form.negative')}>
                    {review.isPositive ? (
                        <ThumbsUp size={13} className="text-green-600/60" />
                    ) : (
                        <ThumbsDown size={13} className="text-orange-500/60" />
                    )}
                </div>
                {review.content && (
                    <div className="text-[13px] text-parchment-base-text/90 leading-[1.4] break-words whitespace-pre-wrap font-serif">
                        {review.content}
                    </div>
                )}
            </div>
        </div>
    );
};
