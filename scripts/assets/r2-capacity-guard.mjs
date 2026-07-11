const retired = () => {
    throw new Error('r2-capacity-guard.mjs 已退役：当前素材发布不再写入对象存储，不需要对象存储容量预检。');
};

export const DEFAULT_R2_CAPACITY_LIMIT_BYTES = 0;
export const formatBytes = (bytes) => String(bytes);
export const resolveR2CapacityLimitBytes = retired;
export const listR2ObjectInventory = retired;
export const evaluateR2Capacity = retired;
export const assertR2CapacityForUploads = retired;

const invokedPath = process.argv[1]?.replace(/\\/g, '/');
if (invokedPath && new URL(import.meta.url).pathname.endsWith(invokedPath)) {
    retired();
}
