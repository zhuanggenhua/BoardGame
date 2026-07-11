import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
    AlertTriangle,
    CheckCircle2,
    Clock,
    FileText,
    PackageCheck,
    RefreshCcw,
    Rocket,
    RotateCcw,
    Server,
    ShieldCheck,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ADMIN_API_URL } from '../../config/server';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { getDeployProgressSnapshot, type DeployProgressSnapshot } from './mobileReleaseProgress';

type AndroidManifest = {
    version?: string;
    versionCode?: number;
    url?: string;
    checksum?: string;
    channel?: string;
    forceUpdate?: boolean;
    publishedAt?: string;
    size?: number;
    notes?: string;
};

type AndroidReleaseStatus = {
    packageVersion: string;
    androidVersionCode?: number;
    channel: string;
    manifestUrl: string;
    latest: AndroidManifest | null;
    ota: {
        manifestUrl: string;
        latest: AndroidManifest | null;
    };
    native: {
        manifestUrl: string;
        latest: AndroidManifest | null;
    };
    releaseReady: {
        script: boolean;
        nativeScript: boolean;
        packageScript: boolean;
        deployScript: boolean;
        deployRunner: boolean;
        otaWorkflow?: boolean;
        dist: boolean;
        releaseApk: boolean;
        serverAssetsReady: boolean;
    };
    deploy: {
        statusCommand: string;
        updateCommand: string;
        updateExecutionEnabled: boolean;
        rollbackLastCommand: string;
        rollbackExecutionEnabled: boolean;
        rollbackLastTarget?: DeployRollbackTarget;
    };
    running: boolean;
};

type DeployRollbackTarget = {
    action: 'rollback-last' | 'rollback';
    tag?: string;
    revision?: string;
    description: string;
    currentWebRef?: string;
    currentGameRef?: string;
    targetWebRef?: string;
    targetGameRef?: string;
    stateUpdatedAt?: string;
    stateAction?: string;
};

type PublishResponse = {
    ok: boolean;
    kind?: 'ota' | 'native' | 'packages';
    mode: 'dry-run' | 'publish' | 'preview' | 'execute';
    jobId?: string;
    status?: 'queued' | 'running' | 'succeeded' | 'failed';
    exitCode?: number | null;
    packageVersion?: string;
    command: string;
    target?: DeployRollbackTarget;
    parsed?: Record<string, string>;
    latest?: AndroidManifest | null;
    output: string;
};

const CHANNELS = ['stable', 'gray', 'edge'] as const;
const BUMP_OPTIONS = ['', 'patch', 'minor', 'major'] as const;
const DEPLOY_UPDATE_CONFIRM_TEXT = '确认部署';
const DEPLOY_ROLLBACK_CONFIRM_TEXT = '确认回滚';
const DEPLOY_JOB_POLL_INTERVAL_MS = 3000;
const DEPLOY_JOB_POLL_ATTEMPTS = 160;

const sleep = (ms: number) => new Promise((resolve) => {
    window.setTimeout(resolve, ms);
});

const isDeployJobDone = (result: PublishResponse) => result.status === 'succeeded' || result.status === 'failed';

const isFailedResult = (result: PublishResponse) => (
    result.ok === false
    || result.status === 'failed'
    || (typeof result.exitCode === 'number' && result.exitCode !== 0)
);

const formatSize = (bytes?: number) => {
    if (!bytes || !Number.isFinite(bytes)) return '-';
    if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${bytes} B`;
};

const formatTime = (value?: string) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString('zh-CN');
};

const readApiError = async (response: Response, fallback: string) => {
    const data = await response.json().catch(() => null) as null | { error?: string; message?: string };
    return data?.error || data?.message || fallback;
};

export default function MobileReleasePage() {
    const { t } = useTranslation('lobby');
    const pageT = useCallback(
        (key: string, options?: Record<string, unknown>) => t(`admin.mobileReleasePage.${key}`, options),
        [t],
    );
    const { token } = useAuth();
    const toast = useToast();
    const toastError = toast.error;
    const toastSuccess = toast.success;
    const statusFailedMessage = pageT('toast.status_failed');
    const publishFailedMessage = pageT('toast.publish_failed');
    const [channel, setChannel] = useState<typeof CHANNELS[number]>('stable');
    const [status, setStatus] = useState<AndroidReleaseStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [busyAction, setBusyAction] = useState<string | null>(null);
    const [lastResult, setLastResult] = useState<PublishResponse | null>(null);

    const [otaBundleVersion, setOtaBundleVersion] = useState('');
    const [otaVersionBase, setOtaVersionBase] = useState('6.0.0');

    const [nativeBump, setNativeBump] = useState<typeof BUMP_OPTIONS[number]>('');
    const [nativeForceUpdate, setNativeForceUpdate] = useState(true);
    const [nativeSkipBuild, setNativeSkipBuild] = useState(false);
    const [nativeNotes, setNativeNotes] = useState('');

    const [packageGameId, setPackageGameId] = useState('');
    const [packageManifestOnly, setPackageManifestOnly] = useState(false);

    const [deployUpdateTag, setDeployUpdateTag] = useState('');

    const [rollbackAction, setRollbackAction] = useState<'rollback-last' | 'rollback'>('rollback-last');
    const [rollbackTag, setRollbackTag] = useState('');

    const fetchStatus = useCallback(async () => {
        if (!token) {
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            const response = await fetch(`${ADMIN_API_URL}/mobile-release/android/status?channel=${channel}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (!response.ok) {
                throw new Error(await readApiError(response, statusFailedMessage));
            }
            const data = await response.json() as AndroidReleaseStatus;
            setStatus(data);
        } catch (error) {
            toastError(error instanceof Error ? error.message : statusFailedMessage);
        } finally {
            setLoading(false);
        }
    }, [channel, statusFailedMessage, toastError, token]);

    useEffect(() => {
        void fetchStatus();
    }, [fetchStatus]);

    const canRun = useMemo(() => Boolean(token && !busyAction && !status?.running), [busyAction, status, token]);
    const canRunOta = Boolean(canRun && (status?.releaseReady.script || status?.releaseReady.otaWorkflow));
    const nativeApkReady = !nativeSkipBuild || Boolean(status?.releaseReady.releaseApk);
    const canRunNative = Boolean(canRun && nativeApkReady && status?.releaseReady.script && status?.releaseReady.nativeScript);
    const canRunPackages = Boolean(canRun && status?.releaseReady.script && status?.releaseReady.packageScript);
    const canPublishOta = Boolean(canRunOta && (status?.releaseReady.serverAssetsReady || status?.releaseReady.otaWorkflow));
    const canPublishNative = Boolean(canRunNative && status?.releaseReady.serverAssetsReady);
    const canPublishPackages = Boolean(canRunPackages && status?.releaseReady.serverAssetsReady);
    const canPreviewDeployUpdate = Boolean(canRun && status?.releaseReady.deployScript);
    const canExecuteDeployUpdate = Boolean(
        canPreviewDeployUpdate
        && status?.deploy.updateExecutionEnabled
        && canPublishOta,
    );
    const canPreviewRollback = Boolean(canRun && status?.releaseReady.deployScript);
    const canExecuteRollback = Boolean(
        canPreviewRollback
        && status?.deploy.rollbackExecutionEnabled
        && (rollbackAction === 'rollback-last' || rollbackTag.trim()),
    );

    const postJson = async (path: string, body: Record<string, unknown>, fallback: string) => {
        if (!token) {
            return null;
        }
        const response = await fetch(`${ADMIN_API_URL}${path}`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });
        if (!response.ok) {
            throw new Error(await readApiError(response, fallback));
        }
        return await response.json() as PublishResponse;
    };

    const fetchDeployJob = async (jobId: string) => {
        if (!token) {
            return null;
        }
        const response = await fetch(`${ADMIN_API_URL}/mobile-release/deploy/jobs/${encodeURIComponent(jobId)}`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) {
            throw new Error(await readApiError(response, pageT('toast.status_failed')));
        }
        return await response.json() as PublishResponse;
    };

    const waitForDeployJob = async (initial: PublishResponse) => {
        let current = initial;
        for (let attempt = 0; attempt < DEPLOY_JOB_POLL_ATTEMPTS; attempt += 1) {
            if (!current.jobId || isDeployJobDone(current)) {
                return current;
            }
            await sleep(DEPLOY_JOB_POLL_INTERVAL_MS);
            const next = await fetchDeployJob(current.jobId);
            if (!next) {
                return current;
            }
            current = {
                ...current,
                ...next,
                jobId: current.jobId,
                command: next.command || current.command,
                output: next.output ?? current.output,
            };
            setLastResult(current);
        }
        return current;
    };

    const runAction = async (
        actionKey: string,
        path: string,
        body: Record<string, unknown>,
        successKey: string,
    ) => {
        setBusyAction(actionKey);
        setLastResult(null);
        try {
            const data = await postJson(path, body, publishFailedMessage);
            if (data) {
                setLastResult(data);
                const finalData = data.jobId ? await waitForDeployJob(data) : data;
                setLastResult(finalData);
                if (isFailedResult(finalData)) {
                    throw new Error(pageT('toast.job_failed'));
                }
                toastSuccess(pageT(successKey));
                await fetchStatus();
            }
        } catch (error) {
            toastError(error instanceof Error ? error.message : publishFailedMessage);
        } finally {
            setBusyAction(null);
        }
    };

    const runningText = busyAction ? pageT('actions.running') : null;
    const executionProgressSnapshot = getDeployProgressSnapshot(lastResult);

    return (
        <div className="h-full overflow-y-auto bg-zinc-50 p-6 lg:p-8">
            <div className="mx-auto max-w-[1440px] space-y-6 pb-10">
                <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-zinc-900">{pageT('title')}</h1>
                        <p className="mt-1 text-sm text-zinc-500">{pageT('description')}</p>
                    </div>
                    <button
                        type="button"
                        onClick={() => void fetchStatus()}
                        disabled={loading}
                        className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-50 disabled:opacity-60"
                    >
                        <RefreshCcw size={16} />
                        {pageT('actions.refresh')}
                    </button>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                    <MetricCard
                        icon={<Server size={18} className="text-zinc-500" />}
                        label={pageT('cards.product_version')}
                        value={status?.packageVersion ?? '-'}
                        badge={status?.channel ?? channel}
                    />
                    <MetricCard
                        icon={<PackageCheck size={18} className="text-emerald-600" />}
                        label={pageT('cards.latest_ota')}
                        value={status?.ota.latest?.version ?? '-'}
                    />
                    <MetricCard
                        icon={<Clock size={18} className="text-amber-600" />}
                        label={pageT('cards.latest_native')}
                        value={status?.native.latest?.version ?? '-'}
                    />
                    <MetricCard
                        icon={<ShieldCheck size={18} className={status?.releaseReady.serverAssetsReady ? 'text-emerald-600' : 'text-red-500'} />}
                        label={pageT('cards.release_ready')}
                        value={status?.releaseReady.serverAssetsReady ? pageT('status.ready') : pageT('status.not_ready')}
                    />
                </div>

                {lastResult ? (
                    <ExecutionLogPanel
                        pageT={pageT}
                        result={lastResult}
                        progress={executionProgressSnapshot}
                    />
                ) : null}

                <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
                    <div className="space-y-6">
                        <ReleaseSection icon={<Server size={18} className="text-emerald-600" />} title={pageT('deployUpdate.title')}>
                            <div className="grid gap-4 md:grid-cols-4">
                                <label className="space-y-1.5">
                                    <span className="text-sm font-medium text-zinc-600">{pageT('deployUpdate.tag')}</span>
                                    <input
                                        value={deployUpdateTag}
                                        onChange={(event) => setDeployUpdateTag(event.target.value)}
                                        className="w-full rounded-lg border border-zinc-200 px-3 py-2 font-mono text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                        placeholder={pageT('deployUpdate.tag_placeholder')}
                                    />
                                </label>
                                <ChannelSelect pageT={pageT} channel={channel} onChange={setChannel} />
                                <label className="space-y-1.5">
                                    <span className="text-sm font-medium text-zinc-600">{pageT('form.ota_bundle_version')}</span>
                                    <input
                                        value={otaBundleVersion}
                                        onChange={(event) => setOtaBundleVersion(event.target.value)}
                                        className="w-full rounded-lg border border-zinc-200 px-3 py-2 font-mono text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                        placeholder={pageT('form.ota_bundle_version_placeholder')}
                                    />
                                </label>
                                <label className="space-y-1.5">
                                    <span className="text-sm font-medium text-zinc-600">{pageT('form.ota_version_base')}</span>
                                    <input
                                        value={otaVersionBase}
                                        onChange={(event) => setOtaVersionBase(event.target.value)}
                                        className="w-full rounded-lg border border-zinc-200 px-3 py-2 font-mono text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                        placeholder="6.0.0"
                                    />
                                </label>
                            </div>
                            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                                {pageT('ota.force_update_required')}
                            </div>
                            <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-950">
                                {pageT('deployUpdate.description')}
                            </div>
                            <ActionRow>
                                <ActionButton
                                    icon={<CheckCircle2 size={16} />}
                                    disabled={!canPreviewDeployUpdate}
                                    onClick={() => void runAction('deploy-update-preview', '/mobile-release/deploy/update/preview', {
                                        tag: deployUpdateTag.trim() || undefined,
                                        channel,
                                        version: otaBundleVersion.trim() || undefined,
                                        otaVersionBase: otaVersionBase.trim() || undefined,
                                        forceUpdate: true,
                                    }, 'toast.preview_success')}
                                >
                                    {busyAction === 'deploy-update-preview' ? runningText : pageT('actions.preview_command')}
                                </ActionButton>
                                <ActionButton
                                    icon={<Rocket size={16} />}
                                    variant="primary"
                                    disabled={!canExecuteDeployUpdate}
                                    onClick={() => void runAction('deploy-update-execute', '/mobile-release/deploy/update/execute', {
                                        tag: deployUpdateTag.trim() || undefined,
                                        channel,
                                        version: otaBundleVersion.trim() || undefined,
                                        otaVersionBase: otaVersionBase.trim() || undefined,
                                        forceUpdate: true,
                                        confirmText: DEPLOY_UPDATE_CONFIRM_TEXT,
                                    }, 'toast.deploy_update_success')}
                                >
                                    {busyAction === 'deploy-update-execute' ? runningText : pageT('actions.execute_deploy_update')}
                                </ActionButton>
                            </ActionRow>
                        </ReleaseSection>

                        <ReleaseSection icon={<Rocket size={18} className="text-indigo-600" />} title={pageT('ota.title')}>
                            <div className="grid gap-4 md:grid-cols-3">
                                <ChannelSelect pageT={pageT} channel={channel} onChange={setChannel} />
                                <label className="space-y-1.5">
                                    <span className="text-sm font-medium text-zinc-600">{pageT('form.ota_bundle_version')}</span>
                                    <input
                                        value={otaBundleVersion}
                                        onChange={(event) => setOtaBundleVersion(event.target.value)}
                                        className="w-full rounded-lg border border-zinc-200 px-3 py-2 font-mono text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                        placeholder={pageT('form.ota_bundle_version_placeholder')}
                                    />
                                </label>
                                <label className="space-y-1.5">
                                    <span className="text-sm font-medium text-zinc-600">{pageT('form.ota_version_base')}</span>
                                    <input
                                        value={otaVersionBase}
                                        onChange={(event) => setOtaVersionBase(event.target.value)}
                                        className="w-full rounded-lg border border-zinc-200 px-3 py-2 font-mono text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                        placeholder="6.0.0"
                                    />
                                </label>
                            </div>
                            <ActionRow>
                                <ActionButton
                                    icon={<CheckCircle2 size={16} />}
                                    disabled={!canRunOta}
                                    onClick={() => void runAction('ota-dry-run', '/mobile-release/android/ota/publish', {
                                        channel,
                                        version: otaBundleVersion.trim() || undefined,
                                        otaVersionBase: otaVersionBase.trim() || undefined,
                                        forceUpdate: true,
                                        dryRun: true,
                                    }, 'toast.dry_run_success')}
                                >
                                    {busyAction === 'ota-dry-run' ? runningText : pageT('actions.dry_run')}
                                </ActionButton>
                                <ActionButton
                                    icon={<Rocket size={16} />}
                                    variant="primary"
                                    disabled={!canPublishOta}
                                    onClick={() => void runAction('ota-publish', '/mobile-release/android/ota/publish', {
                                        channel,
                                        version: otaBundleVersion.trim() || undefined,
                                        otaVersionBase: otaVersionBase.trim() || undefined,
                                        forceUpdate: true,
                                        dryRun: false,
                                    }, 'toast.publish_success')}
                                >
                                    {busyAction === 'ota-publish' ? runningText : pageT('actions.publish')}
                                </ActionButton>
                            </ActionRow>
                        </ReleaseSection>

                        <ReleaseSection icon={<PackageCheck size={18} className="text-emerald-600" />} title={pageT('native.title')}>
                            <div className="grid gap-4 md:grid-cols-3">
                                <ChannelSelect pageT={pageT} channel={channel} onChange={setChannel} />
                                <label className="space-y-1.5">
                                    <span className="text-sm font-medium text-zinc-600">{pageT('form.bump')}</span>
                                    <select
                                        value={nativeBump}
                                        onChange={(event) => setNativeBump(event.target.value as typeof BUMP_OPTIONS[number])}
                                        className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                    >
                                        {BUMP_OPTIONS.map((item) => (
                                            <option key={item || 'none'} value={item}>{pageT(`bump.${item || 'none'}`)}</option>
                                        ))}
                                    </select>
                                </label>
                                <label className="space-y-1.5">
                                    <span className="text-sm font-medium text-zinc-600">{pageT('form.notes')}</span>
                                    <input
                                        value={nativeNotes}
                                        onChange={(event) => setNativeNotes(event.target.value)}
                                        className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                        placeholder={pageT('form.notes_placeholder')}
                                    />
                                </label>
                            </div>
                            <CheckboxRow>
                                <Checkbox checked={nativeForceUpdate} onChange={setNativeForceUpdate} label={pageT('form.force_update')} />
                                <Checkbox checked={nativeSkipBuild} onChange={setNativeSkipBuild} label={pageT('form.skip_build')} />
                            </CheckboxRow>
                            <ActionRow>
                                <ActionButton
                                    icon={<CheckCircle2 size={16} />}
                                    disabled={!canRunNative || Boolean(nativeBump)}
                                    onClick={() => void runAction('native-dry-run', '/mobile-release/android/native/publish', {
                                        channel,
                                        dryRun: true,
                                        skipBuild: nativeSkipBuild,
                                        forceUpdate: nativeForceUpdate,
                                        notes: nativeNotes.trim() || undefined,
                                    }, 'toast.dry_run_success')}
                                >
                                    {busyAction === 'native-dry-run' ? runningText : pageT('actions.dry_run')}
                                </ActionButton>
                                <ActionButton
                                    icon={<Rocket size={16} />}
                                    variant="primary"
                                    disabled={!canPublishNative}
                                    onClick={() => void runAction('native-publish', '/mobile-release/android/native/publish', {
                                        channel,
                                        bump: nativeBump || undefined,
                                        dryRun: false,
                                        skipBuild: nativeSkipBuild,
                                        forceUpdate: nativeForceUpdate,
                                        notes: nativeNotes.trim() || undefined,
                                    }, 'toast.publish_success')}
                                >
                                    {busyAction === 'native-publish' ? runningText : pageT('actions.publish_native')}
                                </ActionButton>
                            </ActionRow>
                        </ReleaseSection>

                        <ReleaseSection icon={<FileText size={18} className="text-sky-600" />} title={pageT('packages.title')}>
                            <div className="grid gap-4 md:grid-cols-2">
                                <ChannelSelect pageT={pageT} channel={channel} onChange={setChannel} />
                                <label className="space-y-1.5">
                                    <span className="text-sm font-medium text-zinc-600">{pageT('form.game_id')}</span>
                                    <input
                                        value={packageGameId}
                                        onChange={(event) => setPackageGameId(event.target.value)}
                                        className="w-full rounded-lg border border-zinc-200 px-3 py-2 font-mono text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                        placeholder={pageT('form.game_id_placeholder')}
                                    />
                                </label>
                            </div>
                            <CheckboxRow>
                                <Checkbox checked={packageManifestOnly} onChange={setPackageManifestOnly} label={pageT('form.manifest_only')} />
                            </CheckboxRow>
                            <ActionRow>
                                <ActionButton
                                    icon={<CheckCircle2 size={16} />}
                                    disabled={!canRunPackages}
                                    onClick={() => void runAction('packages-dry-run', '/mobile-release/android/packages/publish', {
                                        channel,
                                        gameId: packageGameId.trim() || undefined,
                                        manifestOnly: packageManifestOnly,
                                        dryRun: true,
                                    }, 'toast.dry_run_success')}
                                >
                                    {busyAction === 'packages-dry-run' ? runningText : pageT('actions.dry_run')}
                                </ActionButton>
                                <ActionButton
                                    icon={<Rocket size={16} />}
                                    variant="primary"
                                    disabled={!canPublishPackages}
                                    onClick={() => void runAction('packages-publish', '/mobile-release/android/packages/publish', {
                                        channel,
                                        gameId: packageGameId.trim() || undefined,
                                        manifestOnly: packageManifestOnly,
                                        dryRun: false,
                                    }, 'toast.publish_success')}
                                >
                                    {busyAction === 'packages-publish' ? runningText : pageT('actions.publish_packages')}
                                </ActionButton>
                            </ActionRow>
                        </ReleaseSection>

                        <ReleaseSection icon={<RotateCcw size={18} className="text-amber-600" />} title={pageT('rollback.title')}>
                            <div className="grid gap-4 md:grid-cols-2">
                                <label className="space-y-1.5">
                                    <span className="text-sm font-medium text-zinc-600">{pageT('rollback.action')}</span>
                                    <select
                                        value={rollbackAction}
                                        onChange={(event) => {
                                            setRollbackAction(event.target.value as 'rollback-last' | 'rollback');
                                        }}
                                        className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                                    >
                                        <option value="rollback-last">{pageT('rollback.rollback_last')}</option>
                                        <option value="rollback">{pageT('rollback.rollback_tag')}</option>
                                    </select>
                                </label>
                                <label className="space-y-1.5">
                                    <span className="text-sm font-medium text-zinc-600">{pageT('rollback.tag')}</span>
                                    <input
                                        value={rollbackTag}
                                        onChange={(event) => setRollbackTag(event.target.value)}
                                        disabled={rollbackAction === 'rollback-last'}
                                        className="w-full rounded-lg border border-zinc-200 px-3 py-2 font-mono text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:bg-zinc-100"
                                        placeholder="v1.2.3"
                                    />
                                </label>
                            </div>
                            <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm">
                                <div className="mb-2 font-semibold text-zinc-800">{pageT('rollback.target_title')}</div>
                                <RollbackTargetSummary
                                    pageT={pageT}
                                    target={lastResult?.target ?? (rollbackAction === 'rollback-last' ? status?.deploy.rollbackLastTarget : undefined)}
                                    fallback={rollbackAction === 'rollback'
                                        ? pageT('rollback.tag_hint')
                                        : pageT('rollback.last_target_empty')}
                                />
                            </div>
                            <ActionRow>
                                <ActionButton
                                    icon={<RotateCcw size={16} />}
                                    disabled={!canPreviewRollback || (rollbackAction === 'rollback' && !rollbackTag.trim())}
                                    onClick={() => void runAction('rollback-preview', '/mobile-release/deploy/rollback/preview', {
                                        action: rollbackAction,
                                        tag: rollbackTag.trim() || undefined,
                                    }, 'toast.preview_success')}
                                >
                                    {busyAction === 'rollback-preview' ? runningText : pageT('actions.preview_command')}
                                </ActionButton>
                                <ActionButton
                                    icon={<AlertTriangle size={16} />}
                                    variant="danger"
                                    disabled={!canExecuteRollback}
                                    onClick={() => void runAction('rollback-execute', '/mobile-release/deploy/rollback/execute', {
                                        action: rollbackAction,
                                        tag: rollbackTag.trim() || undefined,
                                        confirmText: DEPLOY_ROLLBACK_CONFIRM_TEXT,
                                    }, 'toast.rollback_success')}
                                >
                                    {busyAction === 'rollback-execute' ? runningText : pageT('actions.execute_rollback')}
                                </ActionButton>
                            </ActionRow>
                        </ReleaseSection>
                    </div>

                    <aside className="space-y-4">
                        <ManifestCard pageT={pageT} title={pageT('manifest.ota_title')} manifestUrl={status?.ota.manifestUrl} latest={status?.ota.latest} />
                        <ManifestCard pageT={pageT} title={pageT('manifest.native_title')} manifestUrl={status?.native.manifestUrl} latest={status?.native.latest} />
                        <section className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-amber-900">
                            <h3 className="mb-2 flex items-center gap-2 text-sm font-bold">
                                <AlertTriangle size={16} />
                                {pageT('safety.title')}
                            </h3>
                            <p className="text-sm leading-6">{pageT('safety.description')}</p>
                        </section>
                    </aside>
                </div>

            </div>
        </div>
    );
}

function ExecutionLogPanel({
    pageT,
    result,
    progress,
}: {
    pageT: (key: string, options?: Record<string, unknown>) => string;
    result: PublishResponse;
    progress: DeployProgressSnapshot;
}) {
    const isFailed = isFailedResult(result);
    const progressLabel = pageT(progress.labelKey, progress.detail ? { detail: progress.detail } : undefined);
    return (
        <section className={`rounded-xl border p-6 shadow-sm ${isFailed ? 'border-red-200 bg-red-50' : 'border-zinc-200 bg-white'}`}>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-bold text-zinc-900">{pageT('result.title')}</h2>
                <span className="rounded-full bg-zinc-900 px-3 py-1 text-xs font-bold text-white">
                    {progress.percent}%
                </span>
            </div>
            <div className="mb-4 h-2 overflow-hidden rounded-full bg-zinc-200">
                <div
                    className={`h-full transition-all ${isFailed ? 'bg-red-600' : 'bg-emerald-600'}`}
                    style={{ width: `${progress.percent}%` }}
                />
            </div>
            <div className="mb-4 rounded-lg bg-zinc-50 px-3 py-2 text-sm font-medium text-zinc-700">
                {progressLabel}
            </div>
            <div className="grid gap-3 text-sm md:grid-cols-6">
                <ResultField label={pageT('result.kind')} value={result.kind ?? '-'} />
                <ResultField label={pageT('result.mode')} value={result.mode} />
                <ResultField label={pageT('result.job_status')} value={result.status ?? '-'} />
                <ResultField label={pageT('result.exit_code')} value={result.exitCode == null ? '-' : String(result.exitCode)} />
                <ResultField label={pageT('result.bundle_version')} value={result.parsed?.bundleVersion ?? result.parsed?.version ?? '-'} />
                <ResultField label={pageT('result.zip_bytes')} value={result.parsed?.zipBytes ?? result.parsed?.apkBytes ?? '-'} />
            </div>
            {result.target ? (
                <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
                    <div className="font-semibold">{pageT('rollback.target_title')}</div>
                    <div className="mt-1">{result.target.description}</div>
                    {result.target.tag ? (
                        <div className="mt-1 font-mono text-xs">{result.target.tag}{result.target.revision ? ` · ${result.target.revision}` : ''}</div>
                    ) : null}
                </div>
            ) : null}
            <div className="mt-4 break-all rounded-lg bg-zinc-50 p-3 font-mono text-xs text-zinc-700">{result.command}</div>
            <div className="mt-4 text-xs font-bold uppercase tracking-[0.16em] text-zinc-500">{pageT('result.server_log')}</div>
            <pre className="mt-2 max-h-[32rem] overflow-auto rounded-lg bg-zinc-950 p-4 text-xs leading-5 text-zinc-100">
                {result.output || pageT('result.no_output')}
            </pre>
        </section>
    );
}

function MetricCard({
    icon,
    label,
    value,
    badge,
}: {
    icon: ReactNode;
    label: string;
    value: string;
    badge?: string;
}) {
    return (
        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
                {icon}
                {badge ? <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600">{badge}</span> : null}
            </div>
            <div className="text-xs font-medium text-zinc-500">{label}</div>
            <div className="mt-1 truncate text-lg font-bold text-zinc-900">{value}</div>
        </div>
    );
}

function ReleaseSection({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
    return (
        <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
            <h2 className="mb-5 flex items-center gap-2 text-lg font-bold text-zinc-900">
                {icon}
                {title}
            </h2>
            {children}
        </section>
    );
}

function ChannelSelect({
    pageT,
    channel,
    onChange,
}: {
    pageT: (key: string, options?: Record<string, unknown>) => string;
    channel: typeof CHANNELS[number];
    onChange: (channel: typeof CHANNELS[number]) => void;
}) {
    return (
        <label className="space-y-1.5">
            <span className="text-sm font-medium text-zinc-600">{pageT('form.channel')}</span>
            <select
                value={channel}
                onChange={(event) => onChange(event.target.value as typeof CHANNELS[number])}
                className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
                {CHANNELS.map((item) => (
                    <option key={item} value={item}>{item}</option>
                ))}
            </select>
        </label>
    );
}

function CheckboxRow({ children }: { children: ReactNode }) {
    return <div className="mt-5 flex flex-wrap gap-3">{children}</div>;
}

function Checkbox({ checked, onChange, label }: { checked: boolean; onChange: (checked: boolean) => void; label: string }) {
    return (
        <label className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-700">
            <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
            {label}
        </label>
    );
}

function ActionRow({ children }: { children: ReactNode }) {
    return <div className="mt-6 flex flex-wrap gap-3">{children}</div>;
}

function ActionButton({
    icon,
    children,
    disabled,
    variant = 'secondary',
    onClick,
}: {
    icon: ReactNode;
    children: ReactNode;
    disabled: boolean;
    variant?: 'primary' | 'secondary' | 'danger';
    onClick: () => void;
}) {
    const className = variant === 'danger'
        ? 'inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-red-700 disabled:opacity-50'
        : variant === 'primary'
        ? 'inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-50'
        : 'inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-50';
    return (
        <button type="button" onClick={onClick} disabled={disabled} className={className}>
            {icon}
            {children}
        </button>
    );
}

function RollbackTargetSummary({
    pageT,
    target,
    fallback,
}: {
    pageT: (key: string, options?: Record<string, unknown>) => string;
    target?: DeployRollbackTarget;
    fallback: string;
}) {
    if (!target) {
        return <div className="text-zinc-500">{fallback}</div>;
    }
    return (
        <div className="space-y-2">
            <div className="text-zinc-800">{target.description}</div>
            {target.tag || target.revision ? (
                <div className="font-mono text-xs text-zinc-600">
                    {target.tag ?? '-'}{target.revision ? ` · ${target.revision}` : ''}
                </div>
            ) : null}
            {target.targetWebRef || target.targetGameRef ? (
                <div className="space-y-1 break-all rounded-md bg-white p-3 font-mono text-xs text-zinc-600">
                    <div>{pageT('rollback.target_web')}: {target.targetWebRef ?? '-'}</div>
                    <div>{pageT('rollback.target_game')}: {target.targetGameRef ?? '-'}</div>
                </div>
            ) : null}
        </div>
    );
}

function ManifestCard({
    pageT,
    title,
    manifestUrl,
    latest,
}: {
    pageT: (key: string, options?: Record<string, unknown>) => string;
    title: string;
    manifestUrl?: string;
    latest?: AndroidManifest | null;
}) {
    return (
        <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
            <h3 className="mb-3 text-sm font-bold text-zinc-900">{title}</h3>
            <div className="space-y-2 text-sm">
                <div className="flex justify-between gap-3">
                    <span className="text-zinc-500">{pageT('manifest.version')}</span>
                    <span className="font-mono text-zinc-900">{latest?.version ?? '-'}</span>
                </div>
                <div className="flex justify-between gap-3">
                    <span className="text-zinc-500">{pageT('manifest.published_at')}</span>
                    <span className="font-medium text-zinc-900">{formatTime(latest?.publishedAt)}</span>
                </div>
                <div className="flex justify-between gap-3">
                    <span className="text-zinc-500">{pageT('manifest.size')}</span>
                    <span className="font-mono text-zinc-900">{formatSize(latest?.size)}</span>
                </div>
                <div className="flex justify-between gap-3">
                    <span className="text-zinc-500">{pageT('manifest.force_update')}</span>
                    <span className="font-medium text-zinc-900">{latest?.forceUpdate ? pageT('status.yes') : pageT('status.no')}</span>
                </div>
                <div className="break-all rounded-lg bg-zinc-50 p-3 font-mono text-xs text-zinc-600">
                    {manifestUrl ?? '-'}
                </div>
            </div>
        </section>
    );
}

function ResultField({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <div className="text-zinc-500">{label}</div>
            <div className="truncate font-mono font-semibold text-zinc-900">{value}</div>
        </div>
    );
}
