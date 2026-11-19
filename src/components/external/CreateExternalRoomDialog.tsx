import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createExternalRoom } from '../../api/external-games';
import { useAuth } from '../../contexts/AuthContext';
import { externalRoomPlayerLimits } from '../../shared/externalRoom';
import type { ExternalGame } from '../../shared/externalGames';
import { AuthModal } from '../auth/AuthModal';
import { DetailsPrimaryButton } from '../common/DetailsPrimaryButton';
import { ModalBase } from '../common/overlays/ModalBase';
import '../../pages/external-game-page.css';
import '../../pages/external-room-page.css';

export function CreateExternalRoomDialog({ game, onClose }: { game: ExternalGame; onClose: () => void }) {
    const { t } = useTranslation('lobby');
    const { token, user } = useAuth();
    const navigate = useNavigate();
    const query = useQueryClient();
    const { min, max } = externalRoomPlayerLimits(game.minPlayers, game.maxPlayers);
    const [capacity, setCapacity] = useState(min);
    const create = useMutation({
        mutationFn: () => createExternalRoom(token!, game.gameId, capacity),
        onSuccess: view => {
            query.setQueryData(['external-room', view.room.roomId, user?.id], view);
            navigate(`/external/rooms/${view.room.roomId}`);
        },
    });
    if (!token) return <AuthModal isOpen onClose={onClose} initialMode="login" visualStyle="platform" />;

    return <ModalBase onClose={onClose} closeOnBackdrop={!create.isPending} containerClassName="p-0">
        <form role="dialog" aria-label={t('actions.createRoom')} className="external-room-panel external-summary"
            onSubmit={event => { event.preventDefault(); if (!create.isPending) create.mutate(); }}>
            <h2>{t('actions.createRoom')}</h2>
            <p>{game.name}</p>
            <label>{t('createRoom.playerCount')}
                <select value={capacity} onChange={event => setCapacity(Number(event.target.value))}>
                    {Array.from({ length: max - min + 1 }, (_, index) => min + index).map(count =>
                        <option key={count} value={count}>{t('createRoom.playerCountUnit', { count })}</option>)}
                </select>
            </label>
            {create.error && <p role="alert">{create.error.message}</p>}
            <div className="external-actions">
                <DetailsPrimaryButton type="submit" className="external-primary" disabled={create.isPending}>
                    {t(create.isPending ? 'button.processing' : 'createRoom.confirm')}
                </DetailsPrimaryButton>
                <button type="button" onClick={onClose} disabled={create.isPending}>{t('common:button.cancel')}</button>
            </div>
        </form>
    </ModalBase>;
}
