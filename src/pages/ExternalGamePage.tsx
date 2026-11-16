import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getExternalGame, getOwnedGame } from '../api/external-games';
import { useAuth } from '../contexts/AuthContext';
import { ExternalGameText } from '../components/external/ExternalGameText';
import { GameRulesDocumentLink } from '../components/external/GameRulesDocumentLink';
import { useExternalPlay } from '../components/external/useExternalPlay';
import { ExternalGameAuthor } from '../components/home/GameAuthorInfo';
import { resolveExternalEmbed } from '../shared/externalGames';
import { GameHUD } from '../components/game/framework/widgets/GameHUD';
import './external-game-page.css';

function hasControlCharacters(value: string) {
    for (let index = 0; index < value.length; index += 1) {
        if (value.charCodeAt(index) <= 0x1f) return true;
    }
    return false;
}
function safeReturnPath(value: string | null) {
    if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\') || hasControlCharacters(value)) return '/';
    try { return new URL(value, window.location.origin).origin === window.location.origin ? value : '/'; }
    catch { return '/'; }
}
// 已核验的游戏依赖原站来源；网址改变后不再授予额外权限。
function externalFrame(gameId: string, url: string) {
    const verifiedAlice = gameId === 'external-queen-alice' && url === 'https://queen-alice.onwardtool.com/';
    const verifiedMageKnight = gameId === 'external-mage-knight-web' && url === 'http://e7-auto.7skyun.com:41956/';
    return {
        src: verifiedAlice ? 'https://onwardtool.com/queen-alice/' : url,
        sandbox: `allow-scripts allow-forms allow-popups${verifiedAlice || verifiedMageKnight ? ' allow-same-origin' : ''}`,
    };
}
export default function ExternalGamePage() {
    const { t } = useTranslation('lobby');
    const { gameId = '' } = useParams();
    const [search] = useSearchParams();
    const navigate = useNavigate();
    const { token, user, isLoading: authLoading } = useAuth();
    const [playingGameId, setPlayingGameId] = useState<string | null>(null);
    const preview = search.get('preview') === '1';
    const game = useQuery({ queryKey: ['external-game', gameId, preview ? token : null],
        queryFn: () => preview && token ? getOwnedGame(token, gameId) : getExternalGame(gameId), enabled: Boolean(gameId) && !authLoading });
    const item = game.data;
    const embed = item ? resolveExternalEmbed(item, window.location.origin, window.location.protocol) : null;
    const restricted = Boolean(embed?.restricted);
    const safeHttps = embed?.safeHttps ?? true;
    const sameOrigin = embed?.sameOrigin ?? false;
    const canEmbed = Boolean(embed?.canEmbed);
    const autoPlay = Boolean(item && canEmbed && !preview && game.isSuccess);
    const playing = playingGameId === gameId || autoPlay;
    useExternalPlay(gameId, token ?? null, playing && !authLoading && game.isSuccess && canEmbed);
    const returnPath = safeReturnPath(search.get('from'));
    useEffect(() => {
        if (playing && (game.isError || (game.isSuccess && !canEmbed))) setPlayingGameId(null);
    }, [canEmbed, game.isError, game.isSuccess, playing]);
    useEffect(() => {
        if (preview || !game.isSuccess || !item || canEmbed) return;
        navigate(`/?game=${encodeURIComponent(gameId)}`, { replace: true });
    }, [canEmbed, game.isSuccess, gameId, item, navigate, preview]);
    const leave = () => {
        setPlayingGameId(null);
        navigate(returnPath);
    };
    if (game.isPending) return <main className="external-game-message" role="status">{t('platform.externalGamePage.loading')}</main>;
    if (game.isError || !item) return <main className="external-game-message"><p role="alert">{t('platform.externalGamePage.loadFailed', { message: game.error instanceof Error ? game.error.message : t('platform.retry') })}</p><button onClick={() => void game.refetch()}>{t('platform.retry')}</button><button onClick={leave}>{t('platform.externalGamePage.back')}</button></main>;
    if (!preview && !canEmbed) return <main className="external-game-message" role="status">{t('platform.externalGamePage.openingDetails')}</main>;
    return <main className="external-page">
        {!playing && <div className="external-details">
            <button className="external-back" type="button" onClick={leave}>← {t('platform.externalGamePage.back')}</button>
            <div className="external-details-grid">
                <div className="external-cover">{item.coverUrl ? <img src={item.coverUrl} alt={t('platform.externalGamePage.coverAlt', { name: item.name })} /> : <div className="external-cover-placeholder"><span>{t('platform.externalGamePage.externalGame')}</span><strong>{item.name}</strong><small>{item.author}</small></div>}</div>
                <section className="external-summary">
                    <span className="external-eyebrow">{t('platform.externalGamePage.externalGame')}</span><h1>{item.name}</h1>
                    {preview && !item.published && <p className="external-notice">{t('platform.externalGamePage.unpublishedPreview')}</p>}
                    <p className="external-author"><ExternalGameAuthor author={item.author} authorProfileUrl={item.authorProfileUrl} gameId={item.gameId} gameName={item.name}
                        isOwner={Boolean(user && item.ownerUserId === user.id)} onManageWorks={() => navigate('/?section=profile&tab=works')} /></p>
                    <p className="external-description"><ExternalGameText text={item.description} /></p>
                    <GameRulesDocumentLink document={item.rulesDocument} />
                    {item.rules && <details><summary>{t('platform.externalGamePage.rules')}</summary><p className="external-description"><ExternalGameText text={item.rules} /></p></details>}
                    <p className="external-meta">{item.minPlayers && item.maxPlayers ? t('platform.externalGamePage.playerRange', { min: item.minPlayers, max: item.maxPlayers }) : t('platform.externalGamePage.playersUnknown')}{item.durationMinutes ? ` · ${t('platform.externalGamePage.durationMinutes', { minutes: item.durationMinutes })}` : ''}</p>
                    {restricted && <p className="external-notice" role="status">{item.embedReason || t('platform.externalGamePage.embedRestricted')}</p>}
                    {!safeHttps && <p className="external-notice">{t('platform.externalGamePage.insecureHttp')}</p>}
                    {sameOrigin && <p className="external-notice">{t('platform.externalGamePage.sameOrigin')}</p>}
                    <div className="external-actions">
                        {canEmbed && <button className="external-primary" type="button" onClick={() => setPlayingGameId(gameId)}>{t('platform.externalGamePage.start')}</button>}
                    </div>
                </section>
            </div>
        </div>}
        {playing && canEmbed && <div className="external-player">
            <iframe title={t('platform.externalGamePage.iframeTitle', { name: item.name })} {...externalFrame(item.gameId, item.url)} referrerPolicy="no-referrer" />
            <GameHUD mode="external" gameId={gameId} onLeave={leave} />
        </div>}
    </main>;
}
