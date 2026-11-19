import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { deleteGameSubmission, type GameSubmissionRecord } from '../../api/game-submissions';
import { ConfirmModal } from '../common/overlays/ConfirmModal';

export function SubmissionDeleteAction({ record, token, userId, className, onDeleted }: {
    record: GameSubmissionRecord;
    token: string;
    userId: string;
    className?: string;
    onDeleted?: () => void;
}) {
    const { t } = useTranslation('lobby');
    const client = useQueryClient();
    const [open, setOpen] = useState(false);
    const key = ['game-submissions', userId] as const;
    const remove = useMutation({
        mutationFn: () => deleteGameSubmission(token, record.submissionId),
        onSuccess: async () => {
            setOpen(false);
            onDeleted?.();
            await Promise.all([
                client.invalidateQueries({ queryKey: key }),
                client.invalidateQueries({ queryKey: ['external-games'] }),
                client.invalidateQueries({ queryKey: ['external-game', record.gameId] }),
                client.invalidateQueries({ queryKey: ['owned-external-games', userId] }),
            ]);
        },
    });
    const label = t('platform.creatorCenter.submissions.delete');
    return <>
        <button type="button" className={className} onClick={() => { remove.reset(); setOpen(true); }}>{label}</button>
        {open && <ConfirmModal title={label} confirmText={label} isLoading={remove.isPending}
            description={remove.error?.message || t(record.gameId ? 'platform.creatorCenter.submissions.deletePublishedConfirm' : 'platform.creatorCenter.submissions.deleteConfirm', { name: record.name })}
            onCancel={() => setOpen(false)} onConfirm={() => remove.mutate()} />}
    </>;
}
