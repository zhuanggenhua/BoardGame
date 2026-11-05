import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { useModalStack } from '../../contexts/ModalStackContext';
import { Camera } from 'lucide-react';
import { AvatarUpdateModal } from '../auth/AvatarUpdateModal';
import { AUTH_API_URL } from '../../config/server';
import { getGameById } from '../../config/games.config';
import { MatchHistoryList } from '../social/MatchHistoryList';
import { getExternalHistory } from '../../api/external-games';
import { MySubmissions, MyWorks } from './CreatorCenter';
import './platform-profile.css';

interface GameActivity { totalPlays: number; }
export function PlatformProfile({ favoriteCount, onLogin, tab = 'overview', submissionFilter = 'all', onSubmissionFilterChange = () => {}, onTabChange = () => {}, onOpenSubmission = () => {}, onOpenGame = () => {} }: {
    favoriteCount: number; onLogin: () => void; tab?: string;
    submissionFilter?: string; onSubmissionFilterChange?: (filter: string) => void;
    onTabChange?: (tab: string) => void; onOpenSubmission?: (id?: string) => void; onOpenGame?: (id: string, preview?: boolean) => void;
}) {
    const { user, token, updateUsername } = useAuth();
    const { openModal } = useModalStack();
    const { t } = useTranslation(['lobby', 'common', 'social']);
    const [editing, setEditing] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const activity = useQuery({ queryKey: ['user-game-activity', user?.id], enabled: Boolean(user && token), queryFn: async (): Promise<GameActivity> => {
        const response = await fetch(`${AUTH_API_URL}/profile/activity`, { headers: { Authorization: `Bearer ${token}` } });
        if (!response.ok) throw new Error('platform.profile.activityLoadFailed');
        return response.json();
    } });
    const history = useQuery({ queryKey: ['external-play-history', user?.id], enabled: Boolean(user && token), queryFn: () => getExternalHistory(token!) });
    const activeTab = ['overview', 'submissions', 'works'].includes(tab) ? tab : 'overview';
    if (!user) return <section className="platform-profile-login"><h2>{t('platform.profile.title')}</h2><button type="button" onClick={onLogin}>{t('platform.profile.login')}</button></section>;
    return <div className="platform-profile-backdrop">
      <div className="platform-profile-background" aria-hidden="true">{getGameById('smashup')?.thumbnail}</div>
      <section className="platform-profile" data-testid="profile-page">
        <header className="platform-profile-identity">
            <button type="button" className="platform-profile-avatar" aria-label={t('platform.profile.editAvatar')} title={t('platform.profile.editAvatar')}
                onClick={() => openModal({ closeOnEsc: true, closeOnBackdrop: true,
                    render: ({ close, closeOnBackdrop }) => <AvatarUpdateModal isOpen onClose={close} closeOnBackdrop={closeOnBackdrop} /> })}>
                {user.avatar ? <img src={user.avatar} alt={user.username} /> : user.username.slice(0, 1)}
                <span className="platform-profile-avatar-edit" aria-hidden="true"><Camera size={16} /></span>
            </button>
            {editing ? <form onSubmit={async event => {
                event.preventDefault(); if (busy) return;
                const fields = new FormData(event.currentTarget); const name = String(fields.get('name') ?? '').trim();
                setBusy(true); setError('');
                try { if (name !== user.username) await updateUsername(name); setEditing(false); }
                catch (cause) { setError(cause instanceof Error ? cause.message : t('platform.profile.saveFailed')); } finally { setBusy(false); }
            }}>
                <label>{t('platform.profile.nickname')}<input name="name" defaultValue={user.username} required maxLength={30} /></label>
                <button type="submit" disabled={busy}>{busy ? t('platform.profile.saving') : t('platform.profile.save')}</button>
                <button type="button" disabled={busy} onClick={() => setEditing(false)}>{t('platform.profile.cancel')}</button>
            </form> : <div><h1>{user.username}</h1><p>{t('platform.profile.online')}</p></div>}
            {error && <p role="alert">{error}</p>}
        </header>
        <nav className="platform-profile-tabs" aria-label={t('platform.profile.sections')}>
            {[
                ['overview', t('platform.profile.overview')],
                ['submissions', t('platform.profile.submissions')],
                ['works', t('platform.profile.works')],
            ].map(([id, label]) => <button key={id} type="button" aria-current={activeTab === id ? 'page' : undefined} onClick={() => onTabChange(id)}>{label}</button>)}
        </nav>
        <section className="platform-profile-feed" data-testid="profile-plays">
            {activeTab === 'overview' && <><h2>{t('social:matchHistory.title')}</h2><MatchHistoryList />
                <div className="platform-external-history"><h2>{t('platform.profile.externalHistory')}</h2>
                    {history.isPending && <p role="status">{t('platform.profile.loadingExternalHistory')}</p>}
                    {history.isError && <p role="alert">{t('platform.profile.externalHistoryLoadFailed')} <button onClick={() => void history.refetch()}>{t('platform.retry')}</button></p>}
                    {history.isSuccess && !history.data?.items?.length && <p>{t('platform.profile.noExternalHistory')}</p>}
                    {history.data?.items?.map(item => <button type="button" className="platform-external-history-row" key={item.gameId} onClick={() => onOpenGame(item.gameId)}><strong>{item.name}</strong><span>{t('platform.profile.foregroundPlayTime', { minutes: Math.floor(item.seconds / 60) })}</span></button>)}
                </div></>}
            {activeTab === 'submissions' && token && <MySubmissions token={token} userId={user.id} onOpen={onOpenSubmission} filter={submissionFilter} onFilterChange={onSubmissionFilterChange} />}
            {activeTab === 'works' && token && <MyWorks token={token} userId={user.id} onOpenGame={onOpenGame} />}
        </section>
        <aside className="platform-profile-stats" data-testid="profile-rail">
            {!editing && <button type="button" onClick={() => setEditing(true)}>{t('platform.profile.editProfile')}</button>}
            {activity.isError && <p role="alert">{t('platform.profile.activityLoadFailed')} <button type="button" onClick={() => void activity.refetch()}>{t('platform.retry')}</button></p>}
            <dl><div><dt>{t('platform.profile.externalLinkTime')}</dt><dd>{typeof history.data?.totalSeconds === 'number' ? t('platform.profile.minutes', { minutes: Math.floor(history.data.totalSeconds / 60) }) : '—'}</dd></div><div><dt>{t('platform.profile.plays')}</dt><dd>{activity.data?.totalPlays ?? '—'}</dd></div><div><dt>{t('platform.profile.favorites')}</dt><dd>{favoriteCount}</dd></div></dl>
        </aside>
      </section>
    </div>;
}
