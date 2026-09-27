const DEFAULT_RELEASE_RETENTION_COUNT = 5;

export const selectRetainedReleaseIds = (
    releaseIds,
    currentReleaseId,
    retentionCount = DEFAULT_RELEASE_RETENTION_COUNT,
) => {
    if (!Array.isArray(releaseIds)) {
        throw new Error('releaseIds 必须是数组');
    }
    if (typeof currentReleaseId !== 'string' || !currentReleaseId) {
        throw new Error('current release 必须存在');
    }
    if (!Number.isInteger(retentionCount) || retentionCount < 1) {
        throw new Error('release retention count 必须是正整数');
    }

    const uniqueReleaseIds = [...new Set(releaseIds)]
        .filter((releaseId) => typeof releaseId === 'string' && releaseId.length > 0)
        .sort();
    if (!uniqueReleaseIds.includes(currentReleaseId)) {
        throw new Error(`current release 不在 release 目录中: ${currentReleaseId}`);
    }

    return new Set([
        ...uniqueReleaseIds.slice(-retentionCount),
        currentReleaseId,
    ]);
};

export const selectExpiredReleaseIds = (
    releaseIds,
    currentReleaseId,
    retentionCount = DEFAULT_RELEASE_RETENTION_COUNT,
) => {
    const retainedReleaseIds = selectRetainedReleaseIds(
        releaseIds,
        currentReleaseId,
        retentionCount,
    );
    return [...new Set(releaseIds)]
        .filter((releaseId) => !retainedReleaseIds.has(releaseId))
        .sort();
};
