import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { ApprovalBar } from './ApprovalBar';
import { ReviewForm } from './ReviewForm';
import { ReviewList } from './ReviewList';
import { fetchReviewStats, fetchReviews, fetchMyReview, createReview, deleteReview } from '../../api/review';
import { useToast } from '../../contexts/ToastContext';
import { useModalStack } from '../../contexts/ModalStackContext';
import { ModalBase } from '../common/overlays/ModalBase';
import { X } from 'lucide-react';

export const GameReviews = ({ gameId }: { gameId: string }) => {
    const { t } = useTranslation(['review', 'common']);
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const { success, error } = useToast();
    const { openModal } = useModalStack();

    // 获取统计数据
    const { data: stats, isError: isStatsError } = useQuery({
        queryKey: ['reviewStats', gameId],
        queryFn: () => fetchReviewStats(gameId),
        enabled: !!gameId,
    });

    // 获取我的评价
    const { data: myReview } = useQuery({
        queryKey: ['myReview', gameId],
        queryFn: () => fetchMyReview(gameId),
        enabled: !!gameId && !!user,
        retry: false,
    });

    const refreshData = () => {
        queryClient.invalidateQueries({ queryKey: ['reviewStats', gameId] });
        queryClient.invalidateQueries({ queryKey: ['reviews', gameId] });
        queryClient.invalidateQueries({ queryKey: ['myReview', gameId] });
    };

    const handleOpenReviewModal = () => {
        if (!user) return;

        openModal({
            closeOnBackdrop: true,
            render: ({ close }) => (
                <ModalBase onClose={close}>
                    <div className="bg-parchment-card-bg w-full max-w-lg max-h-[var(--runtime-modal-max-height)] rounded-sm shadow-parchment-card border border-parchment-card-border/30 overflow-hidden pointer-events-auto flex flex-col">
                        {/* 弹窗头部 */}
                        <div className="shrink-0 flex items-center justify-between px-4 py-4 sm:px-6 border-b border-parchment-card-border/10">
                            <span className="text-lg font-bold text-parchment-base-text uppercase tracking-widest">
                                {myReview ? t('form.editTitle', '修改我的评价') : t('form.newTitle', '撰写评价')}
                            </span>
                            <button onClick={close} className="p-1 hover:bg-parchment-base-bg rounded-full text-parchment-light-text transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        {/* 弹窗内容 */}
                        <div className="flex-1 min-h-0 overflow-hidden p-4 sm:p-6">
                            <ReviewForm
                                onSubmit={async (data) => {
                                    try {
                                        await createReview(gameId, data.isPositive, data.content);
                                        success(t('form.success', '评价已发布'));
                                        refreshData();
                                        close();
                                    } catch (err) {
                                        const message = err instanceof Error ? err.message : t('common:unknownError', '发生未知错误');
                                        error(message);
                                    }
                                }}
                                initialData={myReview ? { isPositive: myReview.isPositive, content: myReview.content } : undefined}
                            />
                        </div>
                    </div>
                </ModalBase>
            )
        });
    };

    const deleteMutation = useMutation({
        mutationFn: (gid: string) => deleteReview(gid),
        onSuccess: () => {
            refreshData();
            success(t('form.deleted', '评价已删除'));
        },
        onError: (err: Error) => {
            error(err.message);
        }
    });

    return (
        <div className="flex flex-col gap-2.5 h-full px-0.5">
            {/* 顶部紧凑统计区 */}
            <div className="shrink-0 flex flex-col gap-2">
                {stats ? (
                    <div className="flex flex-col gap-1.5">
                        <ApprovalBar
                            total={stats.total}
                            rate={stats.rate}
                            positive={stats.positive}
                        />
                        <div className="flex items-center justify-between px-0.5">
                            <span className="text-[10px] font-bold text-parchment-base-text uppercase tracking-widest">
                                {stats.total > 10 ? t('stats.positive', { rate: stats.rate }) : t('stats.fewReviews')}
                                <span className="ml-2 font-normal text-parchment-light-text/60 italic lowercase">
                                    ({t('section.ratingCount', { count: stats.total })})
                                </span>
                            </span>

                            {user && (
                                <button
                                    onClick={handleOpenReviewModal}
                                    className="flex items-center gap-1.5 px-3 py-1 text-[11px] font-bold text-parchment-card-bg bg-parchment-brown hover:bg-parchment-brown/80 rounded transition-colors uppercase tracking-widest shadow-sm"
                                >
                                    {myReview ? t('form.edit', '修改') : t('form.writeReview', '写评价')}
                                </button>
                            )}
                        </div>
                    </div>
                ) : isStatsError ? (
                    <div className="text-[10px] text-parchment-light-text italic opacity-60">
                        {t('section.statsError', '暂时无法加载统计信息')}
                    </div>
                ) : (
                    <div className="h-1.5 w-full bg-parchment-base-bg/30 animate-pulse rounded-full" />
                )}
            </div>

            {!user && (
                <div className="text-center py-0.5 text-[9px] text-parchment-light-text italic opacity-50 font-serif">
                    {t('form.loginToReview')}
                </div>
            )}

            {/* 评价列表 - 可滚动 */}
            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar pr-1 mt-0.5">
                <ReviewListWrapper
                    gameId={gameId}
                    currentUserId={user?.id}
                    onDeleteReview={async (gid) => { await deleteMutation.mutateAsync(gid); }}
                />
            </div>
        </div>
    );
};



const ReviewListWrapper = ({
    gameId,
    currentUserId,
    onDeleteReview
}: {
    gameId: string,
    currentUserId?: string,
    onDeleteReview: (id: string) => Promise<void>
}) => {
    const {
        data,
        fetchNextPage,
        hasNextPage,
        isLoading,
        isError
    } = useInfiniteQuery({
        queryKey: ['reviews', gameId],
        queryFn: ({ pageParam }) => fetchReviews(gameId, pageParam as number, 10),
        initialPageParam: 1,
        getNextPageParam: (lastPage) => lastPage.hasMore ? lastPage.page + 1 : undefined,
    });

    const { t } = useTranslation(['review']);
    const reviews = useMemo(() => data?.pages.flatMap(p => p.items) || [], [data]);

    if (isError) {
        return (
            <div className="text-center py-10 text-parchment-light-text italic text-sm">
                {t('list.error', '加载评价失败，请稍后重试')}
            </div>
        );
    }

    return (
        <ReviewList
            reviews={reviews}
            loading={isLoading}
            hasMore={!!hasNextPage}
            onLoadMore={() => fetchNextPage()}
            currentUserId={currentUserId}
            onDeleteReview={onDeleteReview}
        />
    );
};
