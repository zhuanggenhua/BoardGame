import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getExternalGame, getOwnedGame } from '../api/external-games';
import { useAuth } from '../contexts/AuthContext';
import { ExternalGameText } from '../components/external/ExternalGameText';
import { useExternalPlay } from '../components/external/useExternalPlay';
import { ExternalGameAuthor } from '../components/home/GameAuthorInfo';
import { resolveExternalEmbed } from '../shared/externalGames';
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
function formatTime(seconds: number, format: (hours: number, minutes: number) => string) {
    const minutes = Math.floor(seconds / 60);
    return format(Math.floor(minutes / 60), minutes % 60);
}
export default function ExternalGamePage() {
    const { t } = useTranslation('lobby');
    const { gameId = '' } = useParams();
    const [search] = useSearchParams();
    const navigate = useNavigate();
    const { token, user, isLoading: authLoading } = useAuth();
    const [playingGameId, setPlayingGameId] = useState<string | null>(null);
    const [menuOpen, setMenuOpen] = useState(false);
    const [showHelp, setShowHelp] = useState(false);
    const [frameKey, setFrameKey] = useState(0);
    const [fullScreenError, setFullScreenError] = useState('');
    const [fullscreen, setFullscreen] = useState(false);
    const container = useRef<HTMLDivElement>(null);
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
    const play = useExternalPlay(gameId, token ?? null, playing && !authLoading && game.isSuccess && canEmbed);
    const returnPath = safeReturnPath(search.get('from'));
    useEffect(() => {
        const update = () => setFullscreen(document.fullscreenElement === container.current);
        document.addEventListener('fullscreenchange', update);
        return () => document.removeEventListener('fullscreenchange', update);
    }, []);
    useEffect(() => {
        if (playing && (game.isError || (game.isSuccess && !canEmbed))) setPlayingGameId(null);
    }, [canEmbed, game.isError, game.isSuccess, playing]);
    useEffect(() => {
        if (preview || !game.isSuccess || !item || canEmbed) return;
        navigate(`/?game=${encodeURIComponent(gameId)}`, { replace: true });
    }, [canEmbed, game.isSuccess, gameId, item, navigate, preview]);
    const leave = () => {
        setPlayingGameId(null);
        if (document.fullscreenElement === container.current) void document.exitFullscreen().catch(() => undefined);
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
                    {item.rules && <details><summary>{t('platform.externalGamePage.rules')}</summary><p className="external-description"><ExternalGameText text={item.rules} /></p></details>}
                    <p className="external-meta">{item.minPlayers && item.maxPlayers ? t('platform.externalGamePage.playerRange', { min: item.minPlayers, max: item.maxPlayers }) : t('platform.externalGamePage.playersUnknown')}{item.durationMinutes ? ` · ${t('platform.externalGamePage.durationMinutes', { minutes: item.durationMinutes })}` : ''}</p>
                    {restricted && <p className="external-notice" role="status">{item.embedReason || t('platform.externalGamePage.embedRestricted')}</p>}
                    {!safeHttps && <p className="external-notice">{t('platform.externalGamePage.insecureHttp')}</p>}
                    {sameOrigin && <p className="external-notice">{t('platform.externalGamePage.sameOrigin')}</p>}
                    <div className="external-actions">
                        {canEmbed && <button className="external-primary" type="button" onClick={() => { setMenuOpen(false); setShowHelp(false); setPlayingGameId(gameId); }}>{t('platform.externalGamePage.start')}</button>}
                        <a className="external-secondary" href={item.url} target="_blank" rel="noopener noreferrer" onClick={() => setPlayingGameId(null)}>{t('platform.externalGamePage.openOriginal')} ↗</a>
                    </div>
                </section>
            </div>
        </div>}
        {playing && canEmbed && <div className="external-player" ref={container}>
            <iframe key={frameKey} title={t('platform.externalGamePage.iframeTitle', { name: item.name })} src={item.url} sandbox="allow-scripts allow-forms allow-popups" referrerPolicy="no-referrer" />
            <div className="external-player-menu">
                {menuOpen && <div className="external-player-panel">
                    <strong>{item.name}</strong><span>{t('platform.externalGamePage.playTime', { time: formatTime(play.seconds, (hours, minutes) => t('platform.externalGamePage.hoursMinutes', { hours, minutes })) })}</span>
                    {play.syncError && <small role="alert">{t('platform.externalGamePage.syncFailed')}</small>}
                    <button type="button" onClick={async () => {
                        try {
                            if (document.fullscreenElement === container.current) await document.exitFullscreen();
                            else await container.current?.requestFullscreen();
                            setFullScreenError('');
                    } catch { setFullScreenError(t('platform.externalGamePage.fullscreenFailed')); }
                    }}>{fullscreen ? t('platform.externalGamePage.exitFullscreen') : t('platform.externalGamePage.fullscreen')}</button>
                    {fullScreenError && <small role="alert">{fullScreenError}</small>}
                    <button type="button" onClick={() => setShowHelp(!showHelp)} aria-expanded={showHelp}>{t('platform.externalGamePage.notDisplayed')}</button>
                    {showHelp && <><small>{t('platform.externalGamePage.embedHelp')}</small><button type="button" onClick={() => setFrameKey(value => value + 1)}>{t('platform.externalGamePage.reload')}</button></>}
                    <button type="button" onClick={leave}>{t('platform.externalGamePage.endAndReturn')}</button>
                    <a href={item.url} target="_blank" rel="noopener noreferrer" onClick={() => setPlayingGameId(null)}>{t('platform.externalGamePage.openOriginal')} ↗</a>
                </div>}
                <button className="external-player-fab" type="button" aria-expanded={menuOpen} aria-label={menuOpen ? t('platform.externalGamePage.closeGameMenu') : t('platform.externalGamePage.openGameMenu')} onClick={() => setMenuOpen(!menuOpen)}>☰</button>
            </div>
        </div>}
    </main>;
}
