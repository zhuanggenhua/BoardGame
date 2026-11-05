import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { UI_Z_INDEX } from '../../core';
import { createCreatorClaim, getClaimEvidence, listCreatorClaims, listOwnedGames, submitCreatorClaim, uploadClaimEvidence, withdrawCreatorClaim } from '../../api/external-games';
import { listGameSubmissions } from '../../api/game-submissions';
import type { CreatorClaim } from '../../shared/externalGames';
import { GameSubmissionForm } from './PlatformUploadWorkspace';
import { getSessionStorage, readSessionStorageItem } from '../../lib/browserStorage';
import './platform-upload.css';
import './creator-center.css';

type OpenSubmission = (id?: string) => void;

export function MySubmissions({ token, userId, onOpen, filter = 'all', onFilterChange = () => {} }: { token: string; userId: string; onOpen: OpenSubmission; filter?: string; onFilterChange?: (filter: string) => void }) {
    const { t } = useTranslation('lobby');
    const records = useQuery({ queryKey: ['game-submissions', userId], queryFn: () => listGameSubmissions(token) });
    useEffect(() => {
        if (!records.isSuccess) return;
        const raw = readSessionStorageItem('bg-submission-return');
        if (!raw) return;
        try {
            const previous = JSON.parse(raw) as { userId?: unknown; filter?: unknown; scroll?: unknown };
            if (previous.userId === userId && previous.filter === filter && typeof previous.scroll === 'number') {
                window.requestAnimationFrame(() => window.scrollTo({ top: previous.scroll as number, behavior: 'instant' }));
                getSessionStorage()?.removeItem('bg-submission-return');
            }
        } catch { /* 列表仍可浏览，只放弃不可用的本次滚动位置。 */ }
    }, [filter, records.isSuccess, userId]);
    const items = records.data?.items.filter(record => filter === 'all' || record.status === filter) ?? [];
    const empty = records.isSuccess && !items.length;
    const statusLabels = {
        draft: t('platform.uploadWorkspace.status.draft'),
        pending: t('platform.uploadWorkspace.status.pending'),
        approved: t('platform.uploadWorkspace.status.approved'),
        rejected: t('platform.uploadWorkspace.status.rejected'),
    };
    return <section className="creator-center"><header className="creator-heading"><h2>{t('platform.creatorCenter.submissions.title')}</h2>{!empty && <button type="button" className="creator-primary" onClick={() => onOpen()}>＋ {t('platform.creatorCenter.submissions.submit')}</button>}</header>
        <label className="creator-filter">{t('platform.creatorCenter.submissions.filter')}<select value={filter} onChange={event => onFilterChange(event.target.value)}><option value="all">{t('platform.creatorCenter.submissions.all')}</option>{Object.entries(statusLabels).map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
        {records.isPending && <p role="status">{t('platform.creatorCenter.submissions.loading')}</p>}
        {records.isError && <p role="alert">{t('platform.creatorCenter.submissions.loadFailed')} <button type="button" onClick={() => void records.refetch()}>{t('platform.retry')}</button></p>}
        {empty && <div className="creator-empty"><strong>{t('platform.creatorCenter.submissions.emptyTitle')}</strong><p>{t('platform.creatorCenter.submissions.emptyDescription')}</p><button type="button" className="creator-primary" onClick={() => onOpen()}>＋ {t('platform.creatorCenter.submissions.submit')}</button></div>}
        <div className="creator-list">{items.map(record => <article className="creator-row" key={record.submissionId}>
            {record.coverUrl ? <img className="creator-thumb" src={record.coverUrl} alt="" /> : <span className="creator-thumb creator-thumb-placeholder">{record.name.slice(0, 1)}</span>}
            <div className="creator-row-main"><strong>{record.name}</strong><span className="creator-row-meta"><span className={`creator-status is-${record.status}`}>{record.status === 'approved' && !record.gameId ? t('platform.creatorCenter.submissions.processing') : statusLabels[record.status]}</span><span>{t('platform.creatorCenter.updatedAt', { date: new Date(record.updatedAt).toLocaleDateString() })}</span></span>{record.reviewComment && <small>{record.reviewComment}</small>}</div>
            <div className="creator-row-actions"><button type="button" onClick={() => onOpen(record.submissionId)}>{record.status === 'pending' ? t('platform.creatorCenter.submissions.view') : t('platform.creatorCenter.submissions.edit')}</button></div>
        </article>)}</div>
    </section>;
}

export function MyWorks({ token, userId, onOpenGame }: { token: string; userId: string; onOpenGame: (id: string, preview?: boolean) => void }) {
    const { t } = useTranslation('lobby');
    const client = useQueryClient();
    const games = useQuery({ queryKey: ['owned-external-games', userId], queryFn: () => listOwnedGames(token) });
    const [editingId, setEditingId] = useState('');
    const game = games.data?.items.find(item => item.gameId === editingId);
    const empty = games.isSuccess && !games.data.items.length;
    if (game) return <section className="creator-center"><button type="button" onClick={() => setEditingId('')}>← {t('platform.creatorCenter.works.back')}</button><GameSubmissionForm key={game.gameId} ownedGame={game} onSaved={() => {
        setEditingId(''); void client.invalidateQueries({ queryKey: ['owned-external-games', userId] });
        void client.invalidateQueries({ queryKey: ['external-games'] }); void client.invalidateQueries({ queryKey: ['external-game', game.gameId] });
    }} /></section>;
    return <section className="creator-center"><header className="creator-heading"><h2>{t('platform.creatorCenter.works.title')}</h2></header>
        {games.isPending && <p role="status">{t('platform.creatorCenter.works.loading')}</p>}
        {games.isError && <p role="alert">{t('platform.creatorCenter.works.loadFailed')} <button type="button" onClick={() => void games.refetch()}>{t('platform.retry')}</button></p>}
        {empty && <div className="creator-empty"><strong>{t('platform.creatorCenter.works.emptyTitle')}</strong><p>{t('platform.creatorCenter.works.emptyDescription')}</p></div>}
        <div className="creator-list">{games.data?.items.map(item => <article className="creator-row" key={item.gameId}>
            {item.coverUrl ? <img className="creator-thumb" src={item.coverUrl} alt="" /> : <span className="creator-thumb creator-thumb-placeholder">{item.name.slice(0, 1)}</span>}
            <div className="creator-row-main"><strong>{item.name}</strong><span className="creator-row-meta"><span className={`creator-status ${item.published ? 'is-approved' : 'is-draft'}`}>{item.published ? t('platform.creatorCenter.works.published') : t('platform.creatorCenter.works.unpublished')}</span><span>{item.author}</span></span></div>
            <div className="creator-row-actions"><button type="button" onClick={() => setEditingId(item.gameId)}>{t('platform.creatorCenter.works.edit')}</button><button type="button" onClick={() => onOpenGame(item.gameId, true)}>{t('platform.creatorCenter.works.preview')}</button></div>
        </article>)}</div>
    </section>;
}

export function PrivateEvidence({ token, claimId, admin = false }: { token: string; claimId: string; admin?: boolean }) {
    const { t } = useTranslation('lobby');
    const [url, setUrl] = useState('');
    const [error, setError] = useState('');
    useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
    return <div className="creator-evidence">{url ? <><img src={url} alt={t('platform.creatorCenter.claim.evidenceAlt')} /><button type="button" onClick={() => setUrl('')}>{t('platform.creatorCenter.claim.hideEvidence')}</button></> : <button type="button" onClick={async () => {
        setError(''); try { setUrl(URL.createObjectURL(await getClaimEvidence(token, claimId, admin))); } catch (cause) { setError(cause instanceof Error ? cause.message : t('platform.creatorCenter.claim.evidenceLoadFailed')); }
    }}>{t('platform.creatorCenter.claim.viewEvidence')}</button>}{error && <p role="alert">{error}</p>}</div>;
}

function CreatorClaimForm({ claim, token, gameId, gameName, profileUrl = '', onSaved }: {
    claim?: CreatorClaim; token: string; gameId: string; gameName: string; profileUrl?: string; onSaved: () => void;
}) {
    const { t } = useTranslation('lobby');
    const [file, setFile] = useState<File>();
    const [preview, setPreview] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const pending = claim?.status === 'pending';
    const locked = pending || busy;
    const claimStatusLabels = {
        draft: t('platform.creatorCenter.claim.status.draft'),
        pending: t('platform.creatorCenter.claim.status.pending'),
        approved: t('platform.creatorCenter.claim.status.approved'),
        rejected: t('platform.creatorCenter.claim.status.rejected'),
    };
    useEffect(() => {
        if (file) {
            const objectUrl = URL.createObjectURL(file); setPreview(objectUrl);
            return () => URL.revokeObjectURL(objectUrl);
        }
        if (!claim?.hasEvidence) { setPreview(''); return; }
        let cancelled = false;
        let objectUrl = '';
        void getClaimEvidence(token, claim.claimId).then(blob => {
            if (cancelled) return;
            objectUrl = URL.createObjectURL(blob); setPreview(objectUrl);
        }).catch(() => { if (!cancelled) setPreview(''); });
        return () => { cancelled = true; if (objectUrl) URL.revokeObjectURL(objectUrl); };
    }, [file, claim?.claimId, claim?.hasEvidence, token]);
    return <form className="platform-upload-form" onSubmit={async event => {
        event.preventDefault();
        if (busy || pending) return;
        const action = (event.nativeEvent as SubmitEvent).submitter?.getAttribute('value') ?? 'submit';
        const data = new FormData(event.currentTarget);
        const nextUrl = claim ? claim.profileUrl : String(data.get('profileUrl') ?? '').trim();
        const nextExplanation = claim ? claim.explanation : String(data.get('explanation') ?? '').trim();
        if (action === 'submit' && !file && !claim?.hasEvidence) { setError(t('platform.creatorCenter.claim.evidenceRequired')); return; }
        setBusy(true); setError('');
        try {
            let claimId = claim?.claimId;
            if (!claimId) {
                const created = await createCreatorClaim(token, { gameId, profileUrl: nextUrl, explanation: nextExplanation });
                claimId = created.claimId;
            }
            if (file) await uploadClaimEvidence(token, claimId, file);
            if (action === 'submit') await submitCreatorClaim(token, claimId);
            onSaved();
        } catch (cause) { setError(cause instanceof Error ? cause.message : t('platform.creatorCenter.claim.submitFailed')); }
        finally { setBusy(false); }
    }}>
        <header className="platform-upload-form-heading"><h2>{t('platform.creatorCenter.claim.title')}</h2></header>
        <p>{t('platform.creatorCenter.claim.description')}</p>
        <p className="creator-claim-target">{t('platform.creatorCenter.claim.currentGame', { name: gameName })}</p>
        {claim && <p role="status"><span className={`creator-status is-${claim.status}`}>{claimStatusLabels[claim.status]}</span>{claim.reviewComment ? ` · ${claim.reviewComment}` : ''}</p>}
        {pending && <p>{t('platform.creatorCenter.claim.pendingLocked')}</p>}
        {claim && (claim.status === 'draft' || claim.status === 'pending') && <p className="creator-code">{t('platform.creatorCenter.claim.verificationInstructions', { code: claim.verificationCode, deadline: new Date(claim.verificationExpiresAt).toLocaleString() })}</p>}
        <fieldset disabled={locked} className="platform-upload-fields">
            <label>{t('platform.creatorCenter.claim.authorProfile')}<input name="profileUrl" required type="url" placeholder="https://" maxLength={2048} defaultValue={claim?.profileUrl ?? profileUrl} readOnly={Boolean(claim)} /></label>
            <label className="platform-cover-upload">{t('platform.creatorCenter.claim.evidence')}
                {preview && <img src={preview} alt={t('platform.creatorCenter.claim.evidencePreviewAlt')} onError={() => { setPreview(''); setError(t('platform.creatorCenter.claim.previewFailed')); }} />}
                <input type="file" aria-label={t('platform.creatorCenter.claim.evidenceUpload')} accept="image/png,image/jpeg,image/webp,image/avif" onChange={event => {
                    const selected = event.target.files?.[0];
                    if (selected && selected.size > 5 * 1024 * 1024) {
                        setFile(undefined); event.currentTarget.value = ''; setError(t('platform.creatorCenter.claim.evidenceTooLarge')); return;
                    }
                    setError(''); setFile(selected);
                }} />
                <small>{t('platform.creatorCenter.claim.evidenceRequirement')}</small>
            </label>
            <label className="creator-claim-explanation">{t('platform.creatorCenter.claim.relationship')}<textarea name="explanation" required minLength={10} maxLength={4000} placeholder={t('platform.creatorCenter.claim.relationshipPlaceholder')} defaultValue={claim?.explanation} readOnly={Boolean(claim)} /></label>
        </fieldset>
        {error && <p role="alert">{error}</p>}
        {pending ? <button type="button" disabled={busy} onClick={async () => {
            setBusy(true); setError('');
            try { await withdrawCreatorClaim(token, claim.claimId); onSaved(); }
            catch (cause) { setError(cause instanceof Error ? cause.message : '撤回失败'); } finally { setBusy(false); }
        }}>{t('platform.creatorCenter.claim.withdraw')}</button> : <div className="platform-upload-actions">
            <button type="submit" value="draft" disabled={busy}>{t('platform.creatorCenter.claim.saveDraft')}</button>
            <button className="platform-submit" type="submit" value="submit" disabled={busy}>{busy ? t('platform.creatorCenter.claim.submitting') : t('platform.creatorCenter.claim.submitReview')}</button>
        </div>}
    </form>;
}

export function CreatorClaimPanel({ token, userId, gameId, gameName, profileUrl = '', onClose }: {
    token: string; userId: string; gameId: string; gameName: string; profileUrl?: string; onClose: () => void;
}) {
    const { t } = useTranslation('lobby');
    const client = useQueryClient();
    const claims = useQuery({ queryKey: ['creator-claims', userId], queryFn: () => listCreatorClaims(token) });
    const mine = claims.data?.items.filter(item => item.gameId === gameId) ?? [];
    const active = mine.find(item => item.status === 'draft' || item.status === 'pending');
    const previous = mine.find(item => item.status === 'rejected');
    const refresh = () => { void client.invalidateQueries({ queryKey: ['creator-claims', userId] }); void client.invalidateQueries({ queryKey: ['owned-external-games', userId] }); };
    return <section className="creator-claim-overlay" data-testid="creator-claim-panel" style={{ zIndex: UI_Z_INDEX.modalContent }}>
        <div className="creator-claim-sheet">
            <button type="button" className="platform-upload-back" onClick={onClose}>← {t('platform.creatorCenter.claim.backToGame')}</button>
            {claims.isPending && <p role="status">{t('platform.creatorCenter.claim.loading')}</p>}
            {claims.isError && <p role="alert">{t('platform.creatorCenter.claim.loadFailed')} <button type="button" onClick={() => void claims.refetch()}>{t('platform.retry')}</button></p>}
            {claims.isSuccess && <>
                {!active && previous && <p role="status">{t('platform.creatorCenter.claim.previousRejected', { comment: previous.reviewComment ? `：${previous.reviewComment}` : '' })}</p>}
                <CreatorClaimForm key={active?.claimId ?? 'new'} claim={active} token={token} gameId={gameId} gameName={gameName} profileUrl={profileUrl} onSaved={refresh} />
            </>}
        </div>
    </section>;
}
