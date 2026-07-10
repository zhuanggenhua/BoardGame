const sleep = (durationMs) => new Promise((resolve) => {
    setTimeout(resolve, durationMs);
});

const readPositiveInteger = (value, fallback) => {
    const parsed = Number.parseInt(value || '', 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export const DEFAULT_SERVER_PROPAGATION_TIMEOUT_MS = 3 * 60 * 60 * 1000;

export const waitForServerAssets = async (urls, options = {}) => {
    const pendingUrls = [...new Set(urls.filter(Boolean))];
    if (pendingUrls.length === 0) return;

    const timeoutMs = options.timeoutMs ?? readPositiveInteger(
        process.env.BG_ASSET_SERVER_PROPAGATION_TIMEOUT_MS,
        DEFAULT_SERVER_PROPAGATION_TIMEOUT_MS,
    );
    const intervalMs = options.intervalMs ?? readPositiveInteger(
        process.env.BG_ASSET_SERVER_PROPAGATION_INTERVAL_MS,
        10 * 1000,
    );
    const fetchImpl = options.fetchImpl ?? fetch;
    const deadline = Date.now() + timeoutMs;
    let lastFailure = '';

    while (Date.now() < deadline) {
        const failures = [];
        for (const url of pendingUrls) {
            try {
                const checkUrl = new URL(url);
                checkUrl.searchParams.set('server-primary-check', String(Date.now()));
                const response = await fetchImpl(checkUrl, {
                    method: 'HEAD',
                    cache: 'no-store',
                    redirect: 'follow',
                    signal: AbortSignal.timeout(30_000),
                });
                const source = response.headers.get('X-Asset-Source') || '(missing)';
                if (!response.ok || source !== 'server') {
                    failures.push(`${url} status=${response.status} source=${source}`);
                }
            } catch (error) {
                failures.push(`${url} ${error instanceof Error ? error.message : String(error)}`);
            }
        }

        if (failures.length === 0) {
            console.log(`serverPrimaryAssetsReady=${pendingUrls.length}`);
            return;
        }

        lastFailure = failures.join('; ');
        console.log(`[server-primary] 等待服务器活动版本同步：${lastFailure}`);
        await sleep(intervalMs);
    }

    throw new Error(`服务器主源在 ${timeoutMs}ms 内未完成同步：${lastFailure}`);
};
