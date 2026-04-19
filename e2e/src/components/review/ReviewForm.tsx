import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ThumbsUp, ThumbsDown, Loader2 } from 'lucide-react';
import clsx from 'clsx';

interface ReviewFormProps {
    onSubmit: (data: { isPositive: boolean; content: string }) => Promise<void>;
    initialData?: {
        isPositive: boolean;
        content?: string;
    };
    isSubmitting?: boolean;
}

export const ReviewForm = ({ onSubmit, initialData, isSubmitting }: ReviewFormProps) => {
    const { t } = useTranslation(['review']);
    const [isPositive, setIsPositive] = useState<boolean | null>(initialData?.isPositive ?? null);
    const [content, setContent] = useState(initialData?.content || '');
    const [error, setError] = useState<string | null>(null);

    // 初始数据可能稍后加载
    useEffect(() => {
        if (!initialData) return;
        queueMicrotask(() => {
            setIsPositive(initialData.isPositive);
            setContent(initialData.content || '');
        });
    }, [initialData]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (isPositive === null) {
            setError(t('errors.required'));
            return;
        }

        if (content.length > 500) {
            setError(t('errors.contentLength'));
            return;
        }

        try {
            await onSubmit({ isPositive, content });
        } catch (err) {
            // 错误处理通常由父组件或提示条完成
            console.error(err);
        }
    };

    return (
        <form
            onSubmit={handleSubmit}
            className="bg-parchment-card-bg border border-parchment-card-border/50 rounded flex h-full min-h-0 flex-col overflow-hidden"
        >
            <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-4">
                <div className="flex flex-col gap-2">
                    <label className="text-sm font-bold text-parchment-base-text">{t('form.label', '你的评价')}</label>
                    <div className="flex gap-4">
                        <button
                            type="button"
                            onClick={() => setIsPositive(true)}
                            className={clsx(
                                "flex-1 flex items-center justify-center gap-2 py-3 rounded border transition-all duration-200",
                                isPositive === true
                                    ? "bg-green-600 text-white border-green-700 shadow-sm"
                                    : "bg-white text-parchment-base-text border-parchment-card-border/50 hover:border-green-500/50 hover:text-green-600"
                            )}
                        >
                            <ThumbsUp size={18} className={clsx(isPositive === true ? "fill-current" : "")} />
                            <span className="font-bold">{t('form.positive')}</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setIsPositive(false)}
                            className={clsx(
                                "flex-1 flex items-center justify-center gap-2 py-3 rounded border transition-all duration-200",
                                isPositive === false
                                    ? "bg-orange-600 text-white border-orange-700 shadow-sm"
                                    : "bg-white text-parchment-base-text border-parchment-card-border/50 hover:border-orange-500/50 hover:text-orange-600"
                            )}
                        >
                            <ThumbsDown size={18} className={clsx(isPositive === false ? "fill-current" : "")} />
                            <span className="font-bold">{t('form.negative')}</span>
                        </button>
                    </div>
                </div>

                <div className="flex flex-col gap-2">
                    <textarea
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        placeholder={t('form.placeholder')}
                        className="w-full min-h-[100px] p-3 rounded border border-parchment-card-border/50 bg-white text-parchment-base-text placeholder:text-parchment-base-text/30 focus:outline-none focus:border-parchment-base-text focus:ring-1 focus:ring-parchment-base-text/20 resize-y font-serif text-base sm:text-sm"
                        maxLength={500}
                    />
                    <div className="flex justify-between items-center text-xs text-[#433422]/50">
                        <span>{error && <span className="text-red-500">{error}</span>}</span>
                        <span className={clsx(content.length > 500 ? "text-red-500" : "")}>{content.length}/500</span>
                    </div>
                </div>
            </div>

            <div className="shrink-0 flex justify-end border-t border-parchment-card-border/20 bg-parchment-card-bg px-4 py-3 sm:px-6 sm:py-4">
                <button
                    type="submit"
                    disabled={isSubmitting || isPositive === null}
                    className="px-6 py-2.5 bg-parchment-base-text text-parchment-card-bg font-bold rounded shadow-sm hover:bg-parchment-brown transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                    {isSubmitting && <Loader2 className="animate-spin" size={16} />}
                    {initialData ? t('form.update') : t('form.submit')}
                </button>
            </div>
        </form>
    );
};
