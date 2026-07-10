import { ListObjectsV2Command } from '@aws-sdk/client-s3';

export const DEFAULT_R2_CAPACITY_LIMIT_BYTES = 9 * 1024 * 1024 * 1024;

export const formatBytes = (bytes) => {
    if (!Number.isFinite(bytes) || bytes < 0) {
        return String(bytes);
    }
    const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB'];
    let value = bytes;
    let unitIndex = 0;
    while (value >= 1024 && unitIndex < units.length - 1) {
        value /= 1024;
        unitIndex += 1;
    }
    return `${value.toFixed(unitIndex === 0 ? 0 : 2)} ${units[unitIndex]}`;
};

export const resolveR2CapacityLimitBytes = (env = process.env) => {
    const configured = env.R2_CAPACITY_LIMIT_BYTES?.trim();
    if (!configured) {
        return DEFAULT_R2_CAPACITY_LIMIT_BYTES;
    }
    const parsed = Number(configured);
    if (!Number.isSafeInteger(parsed) || parsed <= 0) {
        throw new Error(`R2_CAPACITY_LIMIT_BYTES 必须是正整数，当前值为 ${configured}`);
    }
    return parsed;
};

export const listR2ObjectInventory = async ({ s3Client, bucketName }) => {
    if (!s3Client) {
        throw new Error('缺少 R2 S3 客户端，无法执行容量预检');
    }
    if (!bucketName) {
        throw new Error('缺少 R2_BUCKET_NAME，无法执行容量预检');
    }

    const objects = new Map();
    let continuationToken;

    do {
        const response = await s3Client.send(new ListObjectsV2Command({
            Bucket: bucketName,
            ContinuationToken: continuationToken,
        }));

        for (const object of response.Contents ?? []) {
            if (!object.Key) continue;
            const size = Number(object.Size ?? 0);
            if (!Number.isSafeInteger(size) || size < 0) {
                throw new Error(`R2 对象大小异常: key=${object.Key}, size=${object.Size}`);
            }
            objects.set(object.Key, {
                size,
                etag: object.ETag?.replaceAll('"', '') ?? null,
            });
        }

        continuationToken = response.IsTruncated
            ? response.NextContinuationToken
            : undefined;
    } while (continuationToken);

    return objects;
};

const normalizeUploads = (uploads) => {
    const normalized = new Map();
    for (const upload of uploads ?? []) {
        const key = upload?.key;
        const size = Number(upload?.size);
        if (typeof key !== 'string' || key.length === 0) {
            throw new Error('R2 容量预检发现空对象 key');
        }
        if (!Number.isSafeInteger(size) || size < 0) {
            throw new Error(`R2 上传对象大小异常: key=${key}, size=${upload?.size}`);
        }
        normalized.set(key, size);
    }
    return normalized;
};

export const evaluateR2Capacity = ({
    currentObjects,
    uploads,
    limitBytes = DEFAULT_R2_CAPACITY_LIMIT_BYTES,
}) => {
    if (!(currentObjects instanceof Map)) {
        throw new Error('currentObjects 必须是 R2 对象 Map');
    }
    if (!Number.isSafeInteger(limitBytes) || limitBytes <= 0) {
        throw new Error(`R2 容量上限异常: ${limitBytes}`);
    }

    const plannedUploads = normalizeUploads(uploads);
    let currentBytes = 0;
    for (const object of currentObjects.values()) {
        const size = Number(object?.size ?? 0);
        if (!Number.isSafeInteger(size) || size < 0) {
            throw new Error(`R2 当前对象大小异常: ${object?.size}`);
        }
        currentBytes += size;
    }

    let replacedBytes = 0;
    let uploadBytes = 0;
    for (const [key, size] of plannedUploads) {
        replacedBytes += currentObjects.get(key)?.size ?? 0;
        uploadBytes += size;
    }

    const netIncreaseBytes = uploadBytes - replacedBytes;
    const projectedBytes = currentBytes + netIncreaseBytes;
    const remainingBytes = limitBytes - projectedBytes;

    return {
        allowed: projectedBytes <= limitBytes,
        currentBytes,
        replacedBytes,
        uploadBytes,
        netIncreaseBytes,
        projectedBytes,
        remainingBytes,
        limitBytes,
        objectCount: currentObjects.size,
        uploadObjectCount: plannedUploads.size,
    };
};

export const assertR2CapacityForUploads = async ({
    s3Client,
    bucketName,
    uploads,
    limitBytes = resolveR2CapacityLimitBytes(),
    currentObjects,
    logger = console.log,
}) => {
    const inventory = currentObjects ?? await listR2ObjectInventory({
        s3Client,
        bucketName,
    });
    const result = evaluateR2Capacity({
        currentObjects: inventory,
        uploads,
        limitBytes,
    });

    logger(
        `[R2 容量预检] 当前 ${formatBytes(result.currentBytes)}，`
        + `本批 ${formatBytes(result.uploadBytes)}，覆盖旧对象 ${formatBytes(result.replacedBytes)}，`
        + `净增 ${formatBytes(result.netIncreaseBytes)}，预计 ${formatBytes(result.projectedBytes)}，`
        + `上限 ${formatBytes(result.limitBytes)}`,
    );

    if (!result.allowed) {
        const shortageBytes = Math.abs(result.remainingBytes);
        const error = new Error(
            `R2 容量预检失败：预计用量 ${formatBytes(result.projectedBytes)} `
            + `超过安全上限 ${formatBytes(result.limitBytes)}，至少还需清理 ${formatBytes(shortageBytes)}。`
            + ' 本批未上传任何对象。',
        );
        error.code = 'R2_CAPACITY_LIMIT_EXCEEDED';
        error.capacity = result;
        throw error;
    }

    return {
        ...result,
        currentObjects: inventory,
    };
};
