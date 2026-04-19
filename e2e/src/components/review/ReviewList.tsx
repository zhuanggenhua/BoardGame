import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import type { Review } from '../../api/review';
import { ReviewItem } from './ReviewItem';

interface ReviewListProps {
    reviews: Review[];
    loading: boolean;
    hasMore: boolean;
    onLoadMore: () => void;
    currentUserId?: string;
    onDeleteReview: (gameId: string) => Promise<void>;
}

export const ReviewList = ({
    reviews,
    loading,
    hasMore,
    onLoadMore,
    currentUserId,
    onDeleteReview
}: ReviewListProps) => {
    const { t } = useTranslation(['review']);

    const reviewItems = reviews || [];

    if (loading && reviewItems.length === 0) {
        return (
            <div className="flex justify-center py-12">
                <Loader2 className="animate-spin text-parchment-light-text/50" size={24} />
            </div>
        );
    }

    if (!loading && reviewItems.length === 0) {
        return (
            <div className="text-center py-12 text-parchment-light-text italic font-serif opacity-60">
                {t('list.empty')}
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-4 w-full">
            <div className="flex flex-col gap-4">
                {reviewItems.map((review, index) => (
                    <ReviewItem
                        key={review._id || `${review.gameId}-${index}`}
                        review={review}
                        isMine={!!(currentUserId && review.user?._id === currentUserId)}
                        onDelete={() => onDeleteReview(review.gameId)}
                    />
                ))}
            </div>

            {hasMore && (
                <div className="flex justify-center pt-4">
                    <button
                        onClick={onLoadMore}
                        disabled={loading}
                        className="px-6 py-2 bg-parchment-base-text/5 hover:bg-parchment-base-text/10 text-parchment-base-text text-sm font-bold rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {loading && <Loader2 className="animate-spin" size={14} />}
                        {t('list.loadMore')}
                    </button>
                </div>
            )}
        </div>
    );
};
