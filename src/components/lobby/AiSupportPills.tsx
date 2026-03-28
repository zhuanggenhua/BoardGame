import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import type { GameAiSupportProfile } from '../../games/manifest.types';

interface AiSupportPillsProps {
    ai: GameAiSupportProfile;
    compact?: boolean;
    className?: string;
}

const SUPPORT_KEYS = [
    { key: 'capture' as const, labelKey: 'ai.capture', tone: 'bg-slate-100 text-slate-700 border-slate-200' },
    { key: 'localAi' as const, labelKey: 'ai.local', tone: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
    { key: 'remoteAi' as const, labelKey: 'ai.remote', tone: 'bg-amber-100 text-amber-700 border-amber-200' },
];

export function AiSupportPills({ ai, compact = false, className }: AiSupportPillsProps) {
    const { t } = useTranslation('lobby');
    const items = SUPPORT_KEYS.filter((item) => ai[item.key]);

    if (items.length === 0) {
        return (
            <div className={clsx('flex flex-wrap gap-1.5', className)}>
                <span
                    className={clsx(
                        'inline-flex items-center rounded-full border px-2 py-0.5 font-bold tracking-[0.08em]',
                        compact ? 'text-[9px]' : 'text-[10px]',
                        'border-parchment-card-border/40 bg-parchment-base-bg/40 text-parchment-light-text',
                    )}
                >
                    {t('ai.unsupported')}
                </span>
            </div>
        );
    }

    return (
        <div className={clsx('flex flex-wrap gap-1.5', className)}>
            {items.map((item) => (
                <span
                    key={item.key}
                    className={clsx(
                        'inline-flex items-center rounded-full border px-2 py-0.5 font-bold tracking-[0.08em]',
                        compact ? 'text-[9px]' : 'text-[10px]',
                        item.tone,
                    )}
                >
                    {t(item.labelKey)}
                </span>
            ))}
        </div>
    );
}
