import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
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
function formatTime(seconds: number) {
    const minutes = Math.floor(seconds / 60);
    return `${Math.floor(minutes / 60)}小时${minutes % 60}分钟`;
}
export default function ExternalGamePage() {
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
    if (game.isPending) return <main className="external-game-message" role="status">正在加载游戏…</main>;
    if (game.isError || !item) return <main className="external-game-message"><p role="alert">游戏加载失败：{game.error instanceof Error ? game.error.message : '请重试'}</p><button onClick={() => void game.refetch()}>重试</button><button onClick={leave}>返回</button></main>;
    if (!preview && !canEmbed) return <main className="external-game-message" role="status">正在打开游戏详情…</main>;
    return <main className="external-page">
        {!playing && <div className="external-details">
            <button className="external-back" type="button" onClick={leave}>← 返回</button>
            <div className="external-details-grid">
                <div className="external-cover">{item.coverUrl ? <img src={item.coverUrl} alt={`${item.name}封面`} /> : <div className="external-cover-placeholder"><span>外部游戏</span><strong>{item.name}</strong><small>{item.author}</small></div>}</div>
                <section className="external-summary">
                    <span className="external-eyebrow">外部游戏</span><h1>{item.name}</h1>
                    {preview && !item.published && <p className="external-notice">作品尚未公开，当前为作者预览。</p>}
                    <p className="external-author"><ExternalGameAuthor author={item.author} authorProfileUrl={item.authorProfileUrl} gameId={item.gameId} gameName={item.name}
                        isOwner={Boolean(user && item.ownerUserId === user.id)} onManageWorks={() => navigate('/?section=profile&tab=works')} /></p>
                    <p className="external-description"><ExternalGameText text={item.description} /></p>
                    {item.rules && <details><summary>游戏规则</summary><p className="external-description"><ExternalGameText text={item.rules} /></p></details>}
                    <p className="external-meta">{item.minPlayers && item.maxPlayers ? `${item.minPlayers}–${item.maxPlayers} 人` : '人数待补充'}{item.durationMinutes ? ` · 约 ${item.durationMinutes} 分钟` : ''}</p>
                    {restricted && <p className="external-notice" role="status">{item.embedReason || '游戏网站暂不允许在本站内嵌。你仍可前往原网站游玩。'}</p>}
                    {!safeHttps && <p className="external-notice">当前网页不能内嵌不安全的 HTTP 网站，请前往原网站。</p>}
                    {sameOrigin && <p className="external-notice">该网址无法作为外部游戏内嵌，请联系管理员核对。</p>}
                    <div className="external-actions">
                        {canEmbed && <button className="external-primary" type="button" onClick={() => { setMenuOpen(false); setShowHelp(false); setPlayingGameId(gameId); }}>开始游玩</button>}
                        <a className="external-secondary" href={item.url} target="_blank" rel="noopener noreferrer" onClick={() => setPlayingGameId(null)}>前往原网站 ↗</a>
                    </div>
                </section>
            </div>
        </div>}
        {playing && canEmbed && <div className="external-player" ref={container}>
            <iframe key={frameKey} title={`${item.name} 游戏`} src={item.url} sandbox="allow-scripts allow-forms allow-popups" referrerPolicy="no-referrer" />
            <div className="external-player-menu">
                {menuOpen && <div className="external-player-panel">
                    <strong>{item.name}</strong><span>本站前台停留：{formatTime(play.seconds)}（估算）</span>
                    {play.syncError && <small role="alert">时长同步失败，联网后将继续尝试。</small>}
                    <button type="button" onClick={async () => {
                        try {
                            if (document.fullscreenElement === container.current) await document.exitFullscreen();
                            else await container.current?.requestFullscreen();
                            setFullScreenError('');
                        } catch { setFullScreenError('浏览器未能进入全屏，可继续在页面内游玩。'); }
                    }}>{fullscreen ? '退出全屏' : '全屏'}</button>
                    {fullScreenError && <small role="alert">{fullScreenError}</small>}
                    <button type="button" onClick={() => setShowHelp(!showHelp)} aria-expanded={showHelp}>页面未显示？</button>
                    {showHelp && <><small>部分网站限制内嵌或需要独立登录，可重新加载或前往原网站。</small><button type="button" onClick={() => setFrameKey(value => value + 1)}>重新加载</button></>}
                    <button type="button" onClick={leave}>结束并返回</button>
                    <a href={item.url} target="_blank" rel="noopener noreferrer" onClick={() => setPlayingGameId(null)}>前往原网站 ↗</a>
                </div>}
                <button className="external-player-fab" type="button" aria-expanded={menuOpen} aria-label={menuOpen ? '收起游戏菜单' : '打开游戏菜单'} onClick={() => setMenuOpen(!menuOpen)}>☰</button>
            </div>
        </div>}
    </main>;
}
