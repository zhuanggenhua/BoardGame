import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getExternalGame } from '../../api/external-games';
import { useAuth } from '../../contexts/AuthContext';
import { ExternalGameText } from '../external/ExternalGameText';
import { playerOptionsFromRange, resolveExternalEmbed } from '../../shared/externalGames';
import { HomeGameDetailsPresentation } from './HomeGameDetailsPresentation';
import { PlatformGameDetails } from './PlatformGameDetails';
import { PlatformFavoriteButton } from './PlatformFavoriteButton';
import { PlatformExternalCover } from './PlatformExternalCover';
import { ExternalGameAuthor } from './GameAuthorInfo';
import { writeSessionStorageItem } from '../../lib/browserStorage';

interface ExternalGameDetailsProps {
    gameId: string;
    onClose: () => void;
    closeOnBackdrop?: boolean;
    presentation?: 'modal' | 'inline';
}

/** 外站目录复用原生详情抽屉；开始游玩才进入试玩页，不走建房。 */
export function ExternalGameDetails({ gameId, onClose, closeOnBackdrop = true, presentation = 'modal' }: ExternalGameDetailsProps) {
    const { t } = useTranslation('lobby');
    const navigate = useNavigate();
    const { user } = useAuth();
    const [tab, setTab] = useState<'about'>('about');
    const game = useQuery({ queryKey: ['external-game', gameId], queryFn: () => getExternalGame(gameId), enabled: Boolean(gameId) });
    const item = game.data;
    const embed = item ? resolveExternalEmbed(item, window.location.origin, window.location.protocol) : null;
    const startPlay = () => {
        const from = `${window.location.pathname}${window.location.search}`;
        writeSessionStorageItem('bg-external-return', JSON.stringify({ url: from, scroll: window.scrollY }));
        navigate(`/external/${encodeURIComponent(gameId)}?from=${encodeURIComponent(from)}`);
    };
    const thumbnail = item && <PlatformExternalCover name={item.name} coverUrl={item.coverUrl} />;
    return <HomeGameDetailsPresentation presentation={presentation} onClose={onClose} closeOnBackdrop={closeOnBackdrop} containerClassName="p-0 home-game-details-layer">
        {game.isPending || !item ? <div className="platform-game-details" role="status">{t('platform.externalGamePage.loading')}</div>
            : game.isError ? <div className="platform-game-details" role="alert">{t('platform.externalGamePage.loadFailed', { message: game.error instanceof Error ? game.error.message : t('platform.retry') })}
                <button type="button" onClick={onClose}>{t('common:close')}</button></div>
            : <PlatformGameDetails presentation={presentation} title={item.name} description={<ExternalGameText text={item.description} />}
                thumbnail={thumbnail} playerOptions={playerOptionsFromRange(item.minPlayers, item.maxPlayers)} bestPlayers={[]}
                onClose={onClose} tabs={[{ id: 'about' as const, label: t('platform.externalGamePage.about') }]} selectedTab={tab} onTab={setTab}
                primaryActions={embed?.canEmbed
                    ? <button type="button" data-testid="external-game-play" onClick={startPlay}>{t('platform.externalGamePage.start')}</button>
                    : <a data-testid="external-game-open-site" className="platform-details-open-site" href={item.url} target="_blank" rel="noopener noreferrer">{t('platform.externalGamePage.openOriginal')} ↗</a>}
                secondaryActions={<>
                    {embed?.canEmbed && <a href={item.url} target="_blank" rel="noopener noreferrer">{t('platform.externalGamePage.openOriginal')} ↗</a>}
                    <PlatformFavoriteButton gameId={item.gameId} title={item.name} />
                </>}
                author={<ExternalGameAuthor author={item.author} authorProfileUrl={item.authorProfileUrl} gameId={item.gameId} gameName={item.name}
                    isOwner={Boolean(user && item.ownerUserId === user.id)} onManageWorks={() => navigate('/?section=profile&tab=works')} />}>
                {embed?.restricted && <p className="platform-details-notice" role="status">{item.embedReason || t('platform.externalGamePage.embedRestricted')}</p>}
                {embed && !embed.safeHttps && <p className="platform-details-notice">{t('platform.externalGamePage.insecureHttp')}</p>}
                {embed?.sameOrigin && <p className="platform-details-notice">{t('platform.externalGamePage.sameOrigin')}</p>}
                {item.rules && <p><ExternalGameText text={item.rules} /></p>}
            </PlatformGameDetails>}
    </HomeGameDetailsPresentation>;
}
