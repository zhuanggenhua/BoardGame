import { useId, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { useUndo } from '../../contexts/UndoContext';
import { useSyncedModalStackEntry } from '../../hooks/ui/useSyncedModalStackEntry';
import { ModalBase } from '../../components/common/overlays/ModalBase';
import { ActionLogPanel } from '../../components/game/framework/widgets/ActionLogPanel';
import { buildActionLogRows, createStateBackedActionLogPlayerLabel } from '../../components/game/utils/actionLogFormat';
import { getCardPreviewGetter, getCardPreviewMaxDim } from '../../components/game/registry/cardPreviewRegistry';
import type { MatchPlayerInfo } from '../../engine/transport/protocol';

/** Reads the same projected log as GameHUD; never reconstructs it from private core/events. */
export function EndgameActionLog({ matchData, locale, onClose }: {
    matchData?: MatchPlayerInfo[];
    locale: string;
    onClose: () => void;
}) {
    const { t } = useTranslation('game');
    const { t: tCommon } = useTranslation('common');
    const undoState = useUndo();
    const entryId = `game_betrayal_endgame_log_${useId()}`;
    const rows = useMemo(() => {
        const fallback = createStateBackedActionLogPlayerLabel(undoState?.G, id => t('hud.status.player', { id }));
        return buildActionLogRows(undoState?.G?.sys?.actionLog?.entries ?? [], {
            getPlayerLabel: id => matchData?.find(player => String(player.id) === String(id))?.name || fallback(id),
        });
    }, [matchData, t, undoState?.G]);
    useSyncedModalStackEntry({
        enabled: true,
        entryId,
        entry: {
            onClose,
            render: ({ close, closeOnBackdrop }) => <ModalBase onClose={close} closeOnBackdrop={closeOnBackdrop} overlayClassName="betrayal-endgame-log-backdrop" containerClassName="p-4">
                <section role="dialog" aria-modal="true" aria-labelledby={`${entryId}_title`} className="pointer-events-auto flex max-h-[80vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-white/15 bg-slate-950 p-4 text-white shadow-2xl">
                    <header className="mb-4 flex shrink-0 items-center justify-between gap-3">
                        <h2 id={`${entryId}_title`} className="text-lg font-semibold">{t('hud.actions.actionLog')}</h2>
                        <button type="button" autoFocus onClick={close} aria-label={tCommon('button.close')} className="rounded p-2 hover:bg-white/10"><X size={20} /></button>
                    </header>
                    <div className="min-h-0 overflow-y-auto overscroll-contain">
                        <ActionLogPanel rows={rows} locale={locale} getCardPreviewRef={getCardPreviewGetter('betrayal')} cardPreviewMaxDim={getCardPreviewMaxDim('betrayal')} />
                    </div>
                </section>
            </ModalBase>,
        },
    });
    return null;
}
