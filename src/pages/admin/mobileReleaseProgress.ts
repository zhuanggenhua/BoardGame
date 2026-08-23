export type DeployProgressSource = {
    ok: boolean;
    mode: 'dry-run' | 'publish' | 'preview' | 'execute';
    status?: 'queued' | 'running' | 'succeeded' | 'failed';
    output?: string;
};

export type DeployProgressSnapshot = {
    percent: number;
    labelKey: string;
    detail?: string;
};

const clampProgressPercent = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

const parseByteSize = (rawValue: string, rawUnit: string) => {
    const value = Number.parseFloat(rawValue);
    if (!Number.isFinite(value)) return null;
    const unit = rawUnit.toLowerCase();
    const multiplier = unit === 'b'
        ? 1
        : unit === 'kb'
            ? 1024
            : unit === 'mb'
                ? 1024 * 1024
                : unit === 'gb'
                    ? 1024 * 1024 * 1024
                    : null;
    return multiplier == null ? null : value * multiplier;
};

const parseDockerDownloadRatio = (line: string) => {
    const match = /Downloading\s+\[[^\]]+\]\s+([0-9.]+)\s*([kmg]?b)\/([0-9.]+)\s*([kmg]?b)/i.exec(line);
    if (!match) return null;
    const downloaded = parseByteSize(match[1], match[2]);
    const total = parseByteSize(match[3], match[4]);
    if (downloaded == null || total == null || total <= 0) return null;
    return Math.max(0, Math.min(1, downloaded / total));
};

export const getDeployProgressSnapshot = (result: DeployProgressSource | null): DeployProgressSnapshot => {
    if (!result) {
        return { percent: 0, labelKey: 'result.progress_idle' };
    }
    if (result.status === 'succeeded') {
        return { percent: 100, labelKey: 'result.progress_succeeded' };
    }
    if (result.status === 'failed') {
        return { percent: 100, labelKey: 'result.progress_failed' };
    }
    if (result.mode === 'preview' || result.mode === 'dry-run') {
        return { percent: 100, labelKey: 'result.progress_done' };
    }
    if (result.status === 'queued') {
        return { percent: 12, labelKey: 'result.progress_queued' };
    }

    const output = result.output || '';
    const pullSummaryMatches = [...output.matchAll(/Pulling\s+(\d+)\/(\d+)/g)];
    const latestPullSummary = pullSummaryMatches[pullSummaryMatches.length - 1];
    if (latestPullSummary) {
        const completed = Number.parseInt(latestPullSummary[1], 10);
        const total = Number.parseInt(latestPullSummary[2], 10);
        if (Number.isFinite(completed) && Number.isFinite(total) && total > 0) {
            return {
                percent: clampProgressPercent(15 + (completed / total) * 70),
                labelKey: 'result.progress_pulling',
                detail: `${completed}/${total}`,
            };
        }
    }

    const lines = output.split(/\r?\n/).filter(Boolean);
    const downloadRatios = lines.map(parseDockerDownloadRatio).filter((ratio): ratio is number => ratio != null);
    if (downloadRatios.length > 0) {
        const activeRatio = Math.max(...downloadRatios);
        return {
            percent: clampProgressPercent(20 + activeRatio * 55),
            labelKey: 'result.progress_downloading',
        };
    }

    const completedLayers = lines.filter((line) => /\b(Already exists|Pull complete|Pulled)\b/.test(line)).length;
    if (completedLayers > 0) {
        return {
            percent: clampProgressPercent(Math.min(80, 18 + completedLayers * 4)),
            labelKey: 'result.progress_pulling',
            detail: `${completedLayers}`,
        };
    }

    if (/启动|重启|up -d|Started|Running|healthy|smoke|health/i.test(output)) {
        return { percent: 88, labelKey: 'result.progress_starting' };
    }

    if (result.status === 'running') {
        return { percent: 25, labelKey: 'result.progress_running' };
    }
    return { percent: result.ok ? 100 : 0, labelKey: result.ok ? 'result.progress_done' : 'result.progress_idle' };
};
