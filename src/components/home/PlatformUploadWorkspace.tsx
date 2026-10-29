import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { listGameSubmissions, saveGameSubmission, submitGameSubmission, uploadSubmissionCover, withdrawGameSubmission, type GameSubmissionDraft, type GameSubmissionRecord } from '../../api/game-submissions';
import { updateOwnedGame, uploadOwnedCover } from '../../api/external-games';
import type { ExternalGame } from '../../shared/externalGames';
import { useDocumentScrollLock } from '../../hooks/ui/useDocumentScrollLock';
import './platform-upload.css';

const statusLabelKeys = {
    draft: 'platform.uploadWorkspace.status.draft',
    pending: 'platform.uploadWorkspace.status.pending',
    approved: 'platform.uploadWorkspace.status.approved',
    rejected: 'platform.uploadWorkspace.status.rejected',
} as const;

export function GameSubmissionForm({ record, ownedGame, onSaved, headerAction }: { record?: GameSubmissionRecord; ownedGame?: ExternalGame; onSaved: (id: string) => void; headerAction?: ReactNode }) {
    const { token, user } = useAuth();
    const { t } = useTranslation(['lobby', 'common']);
    const [draftId, setDraftId] = useState(record?.submissionId);
    const source = ownedGame ?? record;
    const [url, setUrl] = useState(source?.url ?? '');
    const [file, setFile] = useState<File>();
    const [preview, setPreview] = useState(source?.coverUrl ?? '');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    useEffect(() => {
        if (!file) { setPreview(source?.coverUrl ?? ''); return; }
        const objectUrl = URL.createObjectURL(file); setPreview(objectUrl);
        return () => URL.revokeObjectURL(objectUrl);
    }, [file, source?.coverUrl]);
    let validUrl = false;
    try { const parsed = new URL(url); validUrl = ['http:', 'https:'].includes(parsed.protocol) && Boolean(parsed.hostname) && !parsed.username && !parsed.password; } catch { /* Empty or incomplete input is an editable form state. */ }
    return <form className="platform-upload-form" onSubmit={async event => {
        event.preventDefault();
        if (!token || busy) return;
        const action = (event.nativeEvent as SubmitEvent).submitter?.getAttribute('value') ?? 'submit';
        const form = new FormData(event.currentTarget);
        const minPlayers = form.get('minPlayers') ? Number(form.get('minPlayers')) : undefined;
        const maxPlayers = form.get('maxPlayers') ? Number(form.get('maxPlayers')) : undefined;
        const authorProfileUrl = String(form.get('authorProfileUrl') ?? '').trim();
        const data: GameSubmissionDraft = {
            name: String(form.get('name') ?? '').trim(), url: url.trim(), category: String(form.get('category')),
            minPlayers, maxPlayers, ...(authorProfileUrl ? { authorProfileUrl } : {}),
            author: String(form.get('author') ?? '').trim(), description: String(form.get('description') ?? '').trim(), rules: String(form.get('rules') ?? '').trim(),
            ...(form.get('durationMinutes') ? { durationMinutes: Number(form.get('durationMinutes')) } : {}),
        };
        if (!validUrl || ((minPlayers == null) !== (maxPlayers == null)) || (minPlayers != null && maxPlayers != null && minPlayers > maxPlayers)) { setError(t('platform.uploadWorkspace.invalidSubmission')); return; }
        if (!ownedGame && action === 'submit' && !file && !record?.coverUrl) { setError(t('platform.uploadWorkspace.coverRequired')); return; }
        setBusy(true); setError('');
        try {
            if (ownedGame) {
                await updateOwnedGame(token, ownedGame.gameId, { ...data, published: form.get('published') === 'on' });
                if (file) await uploadOwnedCover(token, ownedGame.gameId, file);
                onSaved(ownedGame.gameId);
            } else {
                const saved = await saveGameSubmission(token, data, draftId);
                setDraftId(saved.submissionId);
                if (file) await uploadSubmissionCover(token, saved.submissionId, file);
                if (action === 'submit') await submitGameSubmission(token, saved.submissionId);
                onSaved(saved.submissionId);
            }
        } catch (cause) { setError(cause instanceof Error ? cause.message : t('platform.uploadWorkspace.submitFailed')); }
        finally { setBusy(false); }
    }}>
        <header className="platform-upload-form-heading"><h2>{source ? source.name : t('platform.uploadWorkspace.title')}</h2>{headerAction}</header>
        <p>{ownedGame ? t('platform.uploadWorkspace.editDescription') : t('platform.uploadWorkspace.description')}</p>
        {record && <p role="status">{t(statusLabelKeys[record.status])}{record.reviewComment ? ` · ${record.reviewComment}` : ''}</p>}
        {record?.status === 'pending' && <p>{t('platform.uploadWorkspace.pendingLocked')}</p>}
        <fieldset disabled={record?.status === 'pending' || busy} className="platform-upload-fields">
            <label>{t('platform.uploadWorkspace.gameName')}<input name="name" required maxLength={100} defaultValue={source?.name} /></label>
            <label>{t('platform.uploadWorkspace.gameUrl')}<input name="url" type="url" required value={url} onChange={event => setUrl(event.target.value)} placeholder="https://" aria-label={t('platform.uploadWorkspace.gameUrl')} aria-describedby="submission-url-check" />
                <small id="submission-url-check">{!url ? t('platform.uploadWorkspace.urlEmptyHint') : validUrl ? t('platform.uploadWorkspace.urlValid') : t('platform.uploadWorkspace.urlInvalid')}</small>
            </label>
            <label>{t('platform.uploadWorkspace.category')}<select name="category" defaultValue={source?.category ?? 'card'}>
                <option value="uncategorized">{t('platform.uploadWorkspace.uncategorized')}</option>
                <option value="card">{t('common:category.card')}</option><option value="dice">{t('common:category.dice')}</option><option value="abstract">{t('common:category.abstract')}</option><option value="wargame">{t('common:category.wargame')}</option><option value="casual">{t('common:category.casual')}</option><option value="tools">{t('common:category.tools')}</option>
            </select></label>
            <fieldset><legend>{t('platform.uploadWorkspace.players')}</legend><div className="platform-player-range">
                <select name="minPlayers" aria-label={t('platform.uploadWorkspace.minPlayers')} defaultValue={source ? source.minPlayers ?? '' : 2}><option value="">{t('platform.uploadWorkspace.notProvided')}</option>{Array.from({ length: 16 }, (_, i) => <option key={i + 1}>{i + 1}</option>)}</select>
                <span>{t('platform.uploadWorkspace.rangeSeparator')}</span><select name="maxPlayers" aria-label={t('platform.uploadWorkspace.maxPlayers')} defaultValue={source ? source.maxPlayers ?? '' : 4}><option value="">{t('platform.uploadWorkspace.notProvided')}</option>{Array.from({ length: 16 }, (_, i) => <option key={i + 1}>{i + 1}</option>)}</select>
            </div></fieldset>
            <label>{t('platform.uploadWorkspace.duration')}<input name="durationMinutes" type="number" min={1} max={1440} defaultValue={source?.durationMinutes} /></label>
            <label>{t('platform.uploadWorkspace.author')}<input name="author" maxLength={100} defaultValue={source?.author ?? user?.username} /></label>
            <label>{t('platform.uploadWorkspace.authorProfile')}<input name="authorProfileUrl" type="url" maxLength={2048} defaultValue={source?.authorProfileUrl} placeholder="https://" /></label>
            <label>{t('platform.uploadWorkspace.introduction')}<textarea name="description" aria-label={t('platform.uploadWorkspace.introduction')} required maxLength={10000} defaultValue={source?.description} /></label>
            <label>{t('platform.uploadWorkspace.rules')}<textarea name="rules" aria-label={t('platform.uploadWorkspace.rules')} maxLength={50000} defaultValue={source?.rules} /></label>
            <label className="platform-cover-upload">{t('platform.uploadWorkspace.cover')}
                {preview && <img src={preview} alt={t('platform.uploadWorkspace.coverPreviewAlt')} onError={() => { setPreview(''); setError(t('platform.uploadWorkspace.coverUnreadable')); }} />}
                <input type="file" accept="image/png,image/jpeg,image/webp,image/avif" onChange={event => {
                    const selected = event.target.files?.[0];
                    if (selected && selected.size > 10 * 1024 * 1024) {
                        setFile(undefined); event.currentTarget.value = ''; setError(t('platform.uploadWorkspace.coverTooLarge')); return;
                    }
                    setError(''); setFile(selected);
                }} />
            </label>
            {ownedGame && <label><input type="checkbox" name="published" defaultChecked={ownedGame.published} /> {t('platform.uploadWorkspace.publishInDiscovery')}</label>}
        </fieldset>
        {error && <p role="alert">{error}</p>}
        {record?.status === 'pending' ? <button type="button" disabled={busy} onClick={async () => {
            if (!token) return; setBusy(true); setError('');
            try { await withdrawGameSubmission(token, record.submissionId); onSaved(record.submissionId); }
            catch (cause) { setError(cause instanceof Error ? cause.message : t('platform.uploadWorkspace.withdrawFailed')); } finally { setBusy(false); }
        }}>{t('platform.uploadWorkspace.withdraw')}</button> : <div className="platform-upload-actions">
            {!ownedGame && <button type="submit" value="draft" disabled={busy}>{t('platform.uploadWorkspace.saveDraft')}</button>}
            <button className="platform-submit" type="submit" value="submit" disabled={busy}>{busy ? t('platform.uploadWorkspace.submitting') : ownedGame ? t('platform.uploadWorkspace.saveWork') : t('platform.uploadWorkspace.submit')}</button>
        </div>}
    </form>;
}

export function PlatformUploadWorkspace({ onLogin, initialSubmissionId, onBack }: { onLogin: () => void; initialSubmissionId?: string; onBack?: () => void }) {
    const { token, user } = useAuth();
    const { t } = useTranslation(['lobby', 'common']);
    const client = useQueryClient();
    const [selectedId, setSelectedId] = useState<string | undefined>(initialSubmissionId);
    const [showList, setShowList] = useState(false);
    const listDialog = useRef<HTMLDialogElement>(null);
    useDocumentScrollLock(Boolean(user) && showList);
    useEffect(() => { if (!user) setShowList(false); }, [user]);
    useEffect(() => {
        if (showList && listDialog.current && !listDialog.current.open) listDialog.current.showModal();
        if (!showList && listDialog.current?.open) listDialog.current.close();
    }, [showList]);
    const queryKey = ['game-submissions', user?.id] as const;
    const records = useQuery({ queryKey, queryFn: () => listGameSubmissions(token!), enabled: Boolean(token && user) });
    if (!user) return <section className="platform-upload-login"><h2>{t('platform.uploadWorkspace.title')}</h2><p>{t('platform.uploadWorkspace.loginPrompt')}</p><button type="button" onClick={onLogin}>{t('platform.profile.login')}</button></section>;
    const selected = records.data?.items.find(record => record.submissionId === selectedId);
    const listContent = <>
        <button type="button" onClick={() => { setSelectedId(undefined); setShowList(false); }}>{t('platform.uploadWorkspace.title')}</button>
        {records.data?.items.map(record => <button key={record.submissionId} type="button" aria-current={record.submissionId === selectedId ? 'page' : undefined}
            onClick={() => { setSelectedId(record.submissionId); setShowList(false); }}>{record.name}<small>{t(statusLabelKeys[record.status])}</small></button>)}
        {records.isPending && <p role="status">{t('platform.uploadWorkspace.loading')}</p>}
        {records.isSuccess && records.data.items.length === 0 && <p className="platform-upload-empty" role="status">{t('platform.uploadWorkspace.empty')}</p>}
        {records.error && <p role="alert">{t('platform.uploadWorkspace.loadFailed')}<button type="button" onClick={() => void records.refetch()}>{t('platform.retry')}</button></p>}
    </>;
    return <section className="platform-upload-workspace">
        <aside className="platform-upload-list">{listContent}</aside>
        <dialog ref={listDialog} className="platform-upload-drawer" aria-label={t('platform.uploadWorkspace.list')} onCancel={() => setShowList(false)} onClose={() => setShowList(false)} onClick={event => {
            if (event.target === event.currentTarget) setShowList(false);
        }}>
            {showList && <div className="platform-upload-drawer-panel"><header><h2>{t('platform.uploadWorkspace.list')}</h2><button type="button" aria-label={t('platform.uploadWorkspace.closeList')} onClick={() => setShowList(false)}>×</button></header>{listContent}</div>}
        </dialog>
        <div>{onBack && <button type="button" className="platform-upload-back" onClick={onBack}>← {t('platform.uploadWorkspace.backToSubmissions')}</button>}
        {selectedId && !selected && records.isPending ? <p role="status">{t('platform.uploadWorkspace.loadingSelected')}</p>
            : selectedId && !selected && records.isSuccess ? <p role="alert">{t('platform.uploadWorkspace.submissionNotFound')} <button type="button" onClick={() => setSelectedId(undefined)}>{t('platform.uploadWorkspace.newSubmission')}</button></p>
            : <GameSubmissionForm key={selected?.submissionId ?? 'new'} record={selected} onSaved={id => {
            setSelectedId(id); void client.invalidateQueries({ queryKey });
        }} headerAction={<button className="platform-upload-list-toggle" type="button" aria-expanded={showList} onClick={() => setShowList(true)}>{t('platform.uploadWorkspace.list')}</button>} />}
        </div>
    </section>;
}
