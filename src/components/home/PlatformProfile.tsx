import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { AUTH_API_URL } from '../../config/server';
import { getGameById } from '../../config/games.config';
import { resolveGameDisplayName } from '../lobby/gameDetailsContent';
import './platform-profile.css';

interface GameActivity { totalPlays: number; games: { gameId: string; plays: number; lastPlayed: string }[]; }
export function PlatformProfile({ favoriteCount, onOpenGame, onLogin }: { favoriteCount: number; onOpenGame: (id: string) => void; onLogin: () => void }) {
    const { user, token, updateUsername, uploadAvatar } = useAuth();
    const { t } = useTranslation('lobby');
    const [editing, setEditing] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const activity = useQuery({ queryKey: ['user-game-activity', user?.id], enabled: Boolean(user && token), queryFn: async (): Promise<GameActivity> => {
        const response = await fetch(`${AUTH_API_URL}/profile/activity`, { headers: { Authorization: `Bearer ${token}` } });
        if (!response.ok) throw new Error('游玩记录加载失败');
        return response.json();
    } });
    if (!user) return <section className="platform-profile-login"><h2>个人中心</h2><button type="button" onClick={onLogin}>登录</button></section>;
    return <div className="platform-profile-backdrop">
      <div className="platform-profile-background" aria-hidden="true">{getGameById('smashup')?.thumbnail}</div>
      <section className="platform-profile" data-testid="profile-page">
        <header className="platform-profile-identity">
            <div className="platform-profile-avatar">{user.avatar ? <img src={user.avatar} alt={user.username} /> : user.username.slice(0, 1)}</div>
            {editing ? <form onSubmit={async event => {
                event.preventDefault(); if (busy) return;
                const fields = new FormData(event.currentTarget); const name = String(fields.get('name') ?? '').trim();
                const image = fields.get('avatar'); setBusy(true); setError('');
                try { if (name !== user.username) await updateUsername(name); if (image instanceof File && image.size) await uploadAvatar(image); setEditing(false); }
                catch (cause) { setError(cause instanceof Error ? cause.message : '保存失败'); } finally { setBusy(false); }
            }}>
                <label>昵称<input name="name" defaultValue={user.username} required maxLength={30} /></label>
                <label>头像<input name="avatar" type="file" accept="image/png,image/jpeg,image/webp" /></label>
                <button type="submit" disabled={busy}>{busy ? '正在保存…' : '保存资料'}</button>
                <button type="button" disabled={busy} onClick={() => setEditing(false)}>取消</button>
            </form> : <div><h1>{user.username}</h1><p>在线</p></div>}
            {error && <p role="alert">{error}</p>}
        </header>
        <section className="platform-profile-feed" data-testid="profile-plays"><h2>最新动态</h2>
            {activity.isPending ? <p role="status">正在加载游玩记录…</p> : activity.error ? <p role="alert">游玩记录加载失败<button type="button" onClick={() => void activity.refetch()}>重试</button></p> : <>
                {!activity.data?.games.length && <p>还没有已记录的对局</p>}
                {activity.data?.games.map(row => {
                    const game = getGameById(row.gameId);
                    return <button key={row.gameId} className="platform-profile-game" type="button" disabled={!game} onClick={() => onOpenGame(row.gameId)}>
                        <span className="platform-profile-game-art">{game?.thumbnail}</span>
                        <span className="platform-profile-game-info"><strong>{game ? resolveGameDisplayName(game, t) : row.gameId}</strong>
                            <span className="platform-profile-game-meta"><small>局数 {row.plays}</small><time dateTime={row.lastPlayed}>最后游玩 {new Date(row.lastPlayed).toLocaleDateString()}</time></span>
                        </span>
                    </button>;
                })}
            </>}
        </section>
        <aside className="platform-profile-stats" data-testid="profile-rail">
            {!editing && <button type="button" onClick={() => setEditing(true)}>编辑个人资料</button>}
            <dl><div><dt>游玩时长</dt><dd>未记录</dd></div><div><dt>局数</dt><dd>{activity.data?.totalPlays ?? '—'}</dd></div><div><dt>收藏</dt><dd>{favoriteCount}</dd></div></dl>
        </aside>
      </section>
    </div>;
}
