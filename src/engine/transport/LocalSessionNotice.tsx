import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import type { LocalSessionStatus } from './useLocalProviderSession';

export function LocalSessionNotice({ status, onRestart }: { status?: LocalSessionStatus; onRestart?: () => void }) {
    const { t } = useTranslation('common');
    const [dismissedExpiry, setDismissedExpiry] = useState(false);
    if (status?.restoreError)
        return (
            <div
                role="alert"
                className="fixed inset-0 z-[10000] flex flex-col items-center justify-center gap-4 bg-slate-950 p-6 text-white"
            >
                <p>
                    {t('localSession.restoreBlocked', {
                        defaultValue:
                            'This saved game cannot be restored. It has been kept unchanged. Start a new game to replace it.',
                    })}
                </p>
                <button type="button" onClick={onRestart} className="rounded bg-amber-600 px-4 py-2">
                    {t('localSession.restart', { defaultValue: 'Start a new game' })}
                </button>
            </div>
        );
    if (status?.saveResult?.ok === false)
        return (
            <div
                role="status"
                className="fixed bottom-2 left-1/2 z-[10000] max-w-lg -translate-x-1/2 rounded bg-amber-950 px-4 py-2 text-amber-100"
            >
                {t('localSession.saveFailed', {
                    defaultValue:
                        'This game could not be saved on this device. Keep this page open to continue playing.',
                })}
            </div>
        );
    if (status?.expired && !dismissedExpiry)
        return (
            <div
                role="status"
                className="fixed bottom-2 left-1/2 z-[10000] max-w-lg -translate-x-1/2 rounded bg-slate-900 px-4 py-2 text-white"
            >
                {t('localSession.expired', {
                    defaultValue: 'The previous saved game expired after 30 days. A new game has started.',
                })}
                <button type="button" onClick={() => setDismissedExpiry(true)} className="ml-3 underline">
                    {t('localSession.dismiss', { defaultValue: 'Dismiss' })}
                </button>
            </div>
        );
    return null;
}
