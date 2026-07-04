package top.easyboardgame.app;

import org.json.JSONException;
import org.json.JSONObject;

final class AndroidDownloadTaskRecord {

    static final String KIND_APP_UPDATE = "apk-update";
    static final String KIND_GAME_PACKAGE = "game-asset-pack";

    static final String STATUS_QUEUED = "queued";
    static final String STATUS_RUNNING = "running";
    static final String STATUS_VERIFYING = "verifying";
    static final String STATUS_COMPLETED = "completed";
    static final String STATUS_FAILED = "failed";
    static final String STATUS_CANCELLED = "cancelled";

    String taskId;
    String kind;
    String logicalId;
    String displayName;
    String runtimeChannel;
    String packageId;
    String packageVersion;
    String sourceUrl;
    String checksum;
    String installMode;
    String assetBaseUrl;
    String fileIndexUrl;
    String fileIndexChecksum;
    boolean allowFullFallback;
    String destinationPath;
    String partialPath;
    String status;
    long downloadedBytes;
    long totalBytes;
    int attemptCount;
    String errorCode;
    String errorMessage;
    long createdAt;
    long updatedAt;

    static AndroidDownloadTaskRecord create(
        String taskId,
        String kind,
        String logicalId,
        String displayName,
        String runtimeChannel,
        String packageId,
        String packageVersion,
        String sourceUrl,
        String checksum,
        String installMode,
        String assetBaseUrl,
        String fileIndexUrl,
        String fileIndexChecksum,
        boolean allowFullFallback,
        String destinationPath,
        String partialPath,
        long now
    ) {
        AndroidDownloadTaskRecord record = new AndroidDownloadTaskRecord();
        record.taskId = taskId;
        record.kind = kind;
        record.logicalId = logicalId;
        record.displayName = displayName;
        record.runtimeChannel = runtimeChannel;
        record.packageId = packageId;
        record.packageVersion = packageVersion;
        record.sourceUrl = sourceUrl;
        record.checksum = checksum;
        record.installMode = installMode;
        record.assetBaseUrl = assetBaseUrl;
        record.fileIndexUrl = fileIndexUrl;
        record.fileIndexChecksum = fileIndexChecksum;
        record.allowFullFallback = allowFullFallback;
        record.destinationPath = destinationPath;
        record.partialPath = partialPath;
        record.status = STATUS_QUEUED;
        record.downloadedBytes = 0L;
        record.totalBytes = 0L;
        record.attemptCount = 0;
        record.errorCode = null;
        record.errorMessage = null;
        record.createdAt = now;
        record.updatedAt = now;
        return record;
    }

    static AndroidDownloadTaskRecord fromJson(JSONObject payload) {
        AndroidDownloadTaskRecord record = new AndroidDownloadTaskRecord();
        record.taskId = payload.optString("taskId", "");
        record.kind = payload.optString("kind", "");
        record.logicalId = payload.optString("logicalId", "");
        record.displayName = payload.optString("displayName", "");
        record.runtimeChannel = optNullableString(payload, "runtimeChannel");
        record.packageId = optNullableString(payload, "packageId");
        record.packageVersion = optNullableString(payload, "packageVersion");
        record.sourceUrl = payload.optString("sourceUrl", "");
        record.checksum = optNullableString(payload, "checksum");
        record.installMode = optNullableString(payload, "installMode");
        record.assetBaseUrl = optNullableString(payload, "assetBaseUrl");
        record.fileIndexUrl = optNullableString(payload, "fileIndexUrl");
        record.fileIndexChecksum = optNullableString(payload, "fileIndexChecksum");
        record.allowFullFallback = !payload.has("allowFullFallback") || payload.optBoolean("allowFullFallback", true);
        record.destinationPath = optNullableString(payload, "destinationPath");
        record.partialPath = optNullableString(payload, "partialPath");
        record.status = payload.optString("status", STATUS_QUEUED);
        record.downloadedBytes = payload.optLong("downloadedBytes", 0L);
        record.totalBytes = payload.optLong("totalBytes", 0L);
        record.attemptCount = payload.optInt("attemptCount", 0);
        record.errorCode = optNullableString(payload, "errorCode");
        record.errorMessage = optNullableString(payload, "errorMessage");
        record.createdAt = payload.optLong("createdAt", 0L);
        record.updatedAt = payload.optLong("updatedAt", 0L);
        return record;
    }

    JSONObject toJson() throws JSONException {
        JSONObject payload = new JSONObject();
        payload.put("taskId", safeString(taskId));
        payload.put("kind", safeString(kind));
        payload.put("logicalId", safeString(logicalId));
        payload.put("displayName", safeString(displayName));
        putNullable(payload, "runtimeChannel", runtimeChannel);
        putNullable(payload, "packageId", packageId);
        putNullable(payload, "packageVersion", packageVersion);
        payload.put("sourceUrl", safeString(sourceUrl));
        putNullable(payload, "checksum", checksum);
        putNullable(payload, "installMode", installMode);
        putNullable(payload, "assetBaseUrl", assetBaseUrl);
        putNullable(payload, "fileIndexUrl", fileIndexUrl);
        putNullable(payload, "fileIndexChecksum", fileIndexChecksum);
        payload.put("allowFullFallback", allowFullFallback);
        putNullable(payload, "destinationPath", destinationPath);
        putNullable(payload, "partialPath", partialPath);
        payload.put("status", safeString(status));
        payload.put("downloadedBytes", downloadedBytes);
        payload.put("totalBytes", totalBytes);
        payload.put("attemptCount", attemptCount);
        putNullable(payload, "errorCode", errorCode);
        putNullable(payload, "errorMessage", errorMessage);
        payload.put("createdAt", createdAt);
        payload.put("updatedAt", updatedAt);
        return payload;
    }

    boolean isTerminal() {
        return STATUS_COMPLETED.equals(status)
            || STATUS_FAILED.equals(status)
            || STATUS_CANCELLED.equals(status);
    }

    boolean isActive() {
        return STATUS_RUNNING.equals(status) || STATUS_VERIFYING.equals(status);
    }

    boolean isIncrementalInstall() {
        return "incremental".equals(installMode);
    }

    boolean matchesTarget(String targetKind, String targetLogicalId) {
        return safeString(kind).equals(targetKind) && safeString(logicalId).equals(targetLogicalId);
    }

    void markQueued(long now) {
        status = STATUS_QUEUED;
        updatedAt = now;
    }

    void markRunning(long now) {
        status = STATUS_RUNNING;
        attemptCount += 1;
        errorCode = null;
        errorMessage = null;
        updatedAt = now;
    }

    void markCancelled(long now) {
        status = STATUS_CANCELLED;
        updatedAt = now;
    }

    private static String optNullableString(JSONObject payload, String key) {
        if (!payload.has(key) || payload.isNull(key)) {
            return null;
        }
        String value = payload.optString(key, null);
        return value == null || value.trim().isEmpty() ? null : value;
    }

    private static void putNullable(JSONObject payload, String key, String value) throws JSONException {
        if (value == null || value.trim().isEmpty()) {
            payload.put(key, JSONObject.NULL);
            return;
        }
        payload.put(key, value);
    }

    private static String safeString(String value) {
        return value == null ? "" : value;
    }
}
