import clsx from 'clsx';

interface ApprovalBarProps {
    positive: number;
    total: number;
    rate: number;
    className?: string;
}

export const ApprovalBar = ({ rate, total, className }: ApprovalBarProps) => {
    const isLowCount = total < 5; // 评价数阈值从 10 放宽到 5，提升反馈敏感度
    const barWidth = `${rate}%`;

    return (
        <div className={clsx("w-full", className)}>
            <div className="h-1.5 w-full bg-parchment-base-text/10 rounded-full overflow-hidden">
                {!isLowCount ? (
                    <div
                        className="h-full bg-green-600/80 rounded-full transition-all duration-700 ease-out shadow-[0_0_8px_rgba(22,163,74,0.2)]"
                        style={{ width: barWidth }}
                    />
                ) : (
                    <div
                        className="h-full bg-parchment-base-text/20 rounded-full"
                        style={{ width: '100%' }}
                    />
                )}
            </div>
        </div>
    );
};
