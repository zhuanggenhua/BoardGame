import type { ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
import type { ActionLogRow } from '../../utils/actionLogFormat';
import { ActionLogSegments } from './ActionLogSegments';

interface ActionLogPanelProps extends Pick<ComponentProps<typeof ActionLogSegments>, 'locale' | 'getCardPreviewRef' | 'cardPreviewMaxDim'> {
    rows: ActionLogRow[];
    getCharacterId?: (playerId: string | number) => string | undefined;
}

/** The shared, read-only action-log list used by HUD and result dialogs. */
export function ActionLogPanel({ rows: actionLogRows, locale, getCharacterId, getCardPreviewRef, cardPreviewMaxDim }: ActionLogPanelProps) {
    const { t } = useTranslation('game');
    return (
            <div className="flex flex-col gap-2 pr-0.5 sm:pr-1">
                {actionLogRows.length === 0 ? (
                    <div className="text-xs text-white/40 text-center py-6">
                        {t('hud.actionLog.empty')}
                    </div>
                ) : (
                    <div className="flex flex-col gap-2">
                        {actionLogRows.map((row) => (
                            <div key={row.id} className="rounded-lg border border-white/10 bg-white/5 px-3 py-2.5" data-testid="hud-action-log-row">
                                <div className="flex flex-col gap-1 text-[10px] text-white/50 sm:flex-row sm:items-center sm:justify-between" data-testid="hud-action-log-meta">
                                    <span className="font-mono leading-none">{row.timeLabel}</span>
                                    <span className="font-semibold leading-tight text-white/70 break-words sm:max-w-[10rem] sm:text-right">{row.playerLabel}</span>
                                </div>
                                <div className="mt-1.5 break-words text-xs leading-relaxed text-white/90">
                                    <ActionLogSegments
                                        segments={row.segments}
                                        locale={locale}
                                        playerId={row.actorId}
                                        characterId={getCharacterId?.(row.actorId)}
                                        getCardPreviewRef={getCardPreviewRef}
                                        cardPreviewMaxDim={cardPreviewMaxDim}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
    );
}
