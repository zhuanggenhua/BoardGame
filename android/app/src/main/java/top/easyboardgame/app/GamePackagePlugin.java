package top.easyboardgame.app;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.util.Log;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.io.BufferedInputStream;
import java.io.BufferedOutputStream;
import java.io.BufferedReader;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.ProtocolException;
import java.net.SocketException;
import java.net.SocketTimeoutException;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.StandardCopyOption;
import java.security.MessageDigest;
import java.util.Base64;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
import java.util.zip.ZipException;
import org.json.JSONException;
import org.json.JSONObject;

@CapacitorPlugin(
    name = "GamePackage",
    permissions = {
        @Permission(strings = { Manifest.permission.POST_NOTIFICATIONS }, alias = GamePackagePlugin.NOTIFICATION_PERMISSION_ALIAS),
    }
)
public class GamePackagePlugin extends Plugin {

    private static final String TAG = "GamePackagePlugin";
    static final String NOTIFICATION_PERMISSION_ALIAS = "notifications";
    private static final int HTTP_RANGE_NOT_SATISFIABLE = 416;
    private static final int BUFFER_SIZE = 16 * 1024;
    private static final int DOWNLOAD_MAX_ATTEMPTS = 4;
    private static final String ERROR_NETWORK_TIMEOUT = "network-timeout";
    private static final String ERROR_HTTP = "http-error";
    private static final String ERROR_RESUME_NOT_SUPPORTED = "resume-not-supported";
    private static final String ERROR_CHECKSUM = "checksum-mismatch";
    private static final String ERROR_INSUFFICIENT_STORAGE = "insufficient-storage";
    private static final String ERROR_ARCHIVE_INVALID = "archive-invalid";
    private static final String ERROR_FILE_IO = "file-io";
    private static final String ERROR_CANCELLED = "cancelled";
    private static final String ERROR_UNKNOWN = "unknown";
    private static final String STALE_IN_PROGRESS_ERROR_MESSAGE = "上次下载未完成，请重新发起。";
    private static final String NOTIFICATION_PERMISSION_REQUIRED_MESSAGE = "请先允许通知权限，否则后台下载通知不会显示。";
    private static final String NOTIFICATION_PERMISSION_DENIED_MESSAGE = "通知权限已被拒绝，请到系统设置中开启后再重试下载。";

    private final ExecutorService executor = Executors.newCachedThreadPool();
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private final GamePackageInstallEventHub.Listener installEventListener = payload -> mainHandler.post(() -> {
        JSObject result = new JSObject();
        copyJsonValue(payload, result, "gameId");
        copyJsonValue(payload, result, "status");
        copyJsonValue(payload, result, "progressPercent");
        copyJsonValue(payload, result, "progressMode");
        copyJsonValue(payload, result, "errorCode");
        copyJsonValue(payload, result, "errorMessage");
        copyJsonValue(payload, result, "assetPackVersion");
        copyJsonValue(payload, result, "assetRootPath");
        copyJsonValue(payload, result, "installedAt");
        copyJsonValue(payload, result, "updatedAt");
        notifyListeners("installStateChanged", result);
    });
    private AndroidDownloadTaskStore taskStore;

    @Override
    public void load() {
        super.load();
        taskStore = new AndroidDownloadTaskStore(getContext());
        GamePackageInstallEventHub.register(installEventListener);
        maybeRecoverPendingForegroundDownloads("plugin-load");
    }

    @Override
    protected void handleOnDestroy() {
        GamePackageInstallEventHub.unregister(installEventListener);
        super.handleOnDestroy();
    }

    @PluginMethod
    public void listInstalledPackages(PluginCall call) {
        try {
            JSArray packages = new JSArray();
            File rootDir = getRootDir();
            Log.i(TAG, "listInstalledPackages rootDir=" + rootDir.getAbsolutePath());
            File[] gameDirs = rootDir.listFiles(File::isDirectory);
            if (gameDirs != null) {
                for (File gameDir : gameDirs) {
                    File metadataFile = new File(new File(gameDir, GamePackageFs.CURRENT_DIR), GamePackageFs.METADATA_FILE);
                    if (!metadataFile.exists()) {
                        continue;
                    }

                    JSONObject metadata = readJsonFile(metadataFile);
                    File assetRootDir = new File(new File(gameDir, GamePackageFs.CURRENT_DIR), GamePackageFs.ASSETS_DIR);
                    if (metadata == null || !assetRootDir.isDirectory()) {
                        continue;
                    }

                    JSObject item = new JSObject();
                    item.put("gameId", metadata.optString("gameId", gameDir.getName()));
                    item.put("runtimeChannel", metadata.optString("runtimeChannel", "stable"));
                    item.put("installedAt", metadata.optLong("installedAt", 0L));
                    item.put("assetPackVersion", metadata.optString("assetPackVersion", ""));
                    item.put("assetRootPath", buildAssetRootPath(assetRootDir));
                    packages.put(item);
                }
            }

            JSObject result = new JSObject();
            result.put("packages", packages);
            Log.i(TAG, "listInstalledPackages success count=" + packages.length());
            call.resolve(result);
        } catch (Exception error) {
            Log.e(TAG, "listInstalledPackages failed", error);
            call.reject("读取已安装游戏包失败", error);
        }
    }

    @PluginMethod
    public void logDiagnostic(PluginCall call) {
        String message = call.getString("message", "");
        Log.i(TAG, "logDiagnostic invoked length=" + message.length());
        Log.i(TAG, "[JS-DIAG] " + message);
        call.resolve();
    }

    @PluginMethod
    public void getNotificationPermissionStatus(PluginCall call) {
        call.resolve(buildNotificationPermissionResult(false));
    }

    @PluginMethod
    public void ensureNotificationPermission(PluginCall call) {
        JSObject currentState = buildNotificationPermissionResult(false);
        if (currentState.optBoolean("granted", false) || !currentState.optBoolean("required", false)) {
            call.resolve(currentState);
            return;
        }

        Log.w(TAG, "ensureNotificationPermission requesting POST_NOTIFICATIONS");
        requestPermissionForAlias(NOTIFICATION_PERMISSION_ALIAS, call, "handleNotificationPermissionResult");
    }

    @PermissionCallback
    private void handleNotificationPermissionResult(PluginCall call) {
        JSObject result = buildNotificationPermissionResult(true);
        Log.i(TAG, "handleNotificationPermissionResult result=" + result);
        call.resolve(result);
    }

    @PluginMethod
    public void openNotificationSettings(PluginCall call) {
        try {
            Context context = getContext();
            Intent intent;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                intent = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS)
                    .putExtra(Settings.EXTRA_APP_PACKAGE, context.getPackageName());
            } else {
                intent = new Intent(
                    Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                    Uri.fromParts("package", context.getPackageName(), null)
                );
            }
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            context.startActivity(intent);
            call.resolve();
        } catch (Exception error) {
            Log.e(TAG, "openNotificationSettings failed", error);
            call.reject("打开通知设置失败", error);
        }
    }

    @PluginMethod
    public void fetchRemoteJson(PluginCall call) {
        String urlValue = normalizeNonEmpty(call.getString("url"));
        if (urlValue == null) {
            call.reject("缺少 url");
            return;
        }

        executor.execute(() -> {
            HttpURLConnection connection = null;
            try {
                connection = (HttpURLConnection) new URL(urlValue).openConnection();
                connection.setConnectTimeout(15000);
                connection.setReadTimeout(30000);
                connection.setRequestProperty("Accept", "application/json");

                int responseCode = connection.getResponseCode();
                InputStream inputStream = responseCode >= 200 && responseCode < 300
                    ? connection.getInputStream()
                    : connection.getErrorStream();

                JSObject result = new JSObject();
                result.put("status", responseCode);
                result.put("body", inputStream != null ? readInputStream(inputStream) : "");
                String contentType = normalizeNonEmpty(connection.getContentType());
                if (contentType != null) {
                    result.put("contentType", contentType);
                }

                Log.i(
                    TAG,
                    "fetchRemoteJson success url=" + urlValue
                        + " status=" + responseCode
                        + " contentType=" + (contentType != null ? contentType : "")
                );
                resolveOnMainThread(call, result);
            } catch (Exception error) {
                Log.e(TAG, "fetchRemoteJson failed url=" + urlValue, error);
                rejectOnMainThread(call, "拉取远程 JSON 失败", error);
            } finally {
                if (connection != null) {
                    connection.disconnect();
                }
            }
        });
    }

    @PluginMethod
    public void readInstalledAsset(PluginCall call) {
        String gameId = normalizeNonEmpty(call.getString("gameId"));
        String relativePath = normalizeNonEmpty(call.getString("relativePath"));
        if (gameId == null) {
            call.reject("缺少 gameId");
            return;
        }
        if (relativePath == null) {
            call.reject("缺少 relativePath");
            return;
        }

        executor.execute(() -> {
            try {
                String normalizedRelativePath = normalizeInstalledAssetRelativePath(relativePath);
                if (normalizedRelativePath == null) {
                    throw new IOException("非法素材相对路径: " + relativePath);
                }

                File assetFile = resolveInstalledAssetFile(gameId, normalizedRelativePath);
                if (assetFile == null || !assetFile.isFile()) {
                    throw new IOException("未找到已安装素材文件: " + normalizedRelativePath);
                }

                byte[] bytes = Files.readAllBytes(assetFile.toPath());
                JSObject result = new JSObject();
                result.put("gameId", gameId);
                result.put("relativePath", normalizedRelativePath);
                result.put("mimeType", detectInstalledAssetMimeType(assetFile, normalizedRelativePath));
                result.put("base64", Base64.getEncoder().encodeToString(bytes));
                result.put("size", bytes.length);
                Log.i(
                    TAG,
                    "readInstalledAsset success gameId=" + gameId
                        + " relativePath=" + normalizedRelativePath
                        + " size=" + bytes.length
                );
                resolveOnMainThread(call, result);
            } catch (Exception error) {
                Log.e(TAG, "readInstalledAsset failed gameId=" + gameId + " relativePath=" + relativePath, error);
                rejectOnMainThread(call, "读取已安装素材文件失败", error);
            }
        });
    }

    @PluginMethod
    public void cancelInstall(PluginCall call) {
        String gameId = normalizeNonEmpty(call.getString("gameId"));
        if (gameId == null) {
            call.reject("缺少 gameId");
            return;
        }

        AndroidDownloadTaskRecord record = taskStore.getLatestByTarget(AndroidDownloadTaskRecord.KIND_GAME_PACKAGE, gameId);
        if (record != null && !record.isTerminal()) {
            Log.w(TAG, "cancelInstall gameId=" + gameId + " taskId=" + record.taskId);
            AndroidDownloadForegroundService.startManagedIntent(
                getContext(),
                AndroidDownloadForegroundService.buildCancelIntent(getContext(), record.taskId)
            );
        }
        call.resolve();
    }

    @PluginMethod
    public void uninstallGamePackage(PluginCall call) {
        String gameId = normalizeNonEmpty(call.getString("gameId"));
        if (gameId == null) {
            call.reject("缺少 gameId");
            return;
        }

        List<AndroidDownloadTaskRecord> cancelledRecords = taskStore.cancelTasksForTarget(
            AndroidDownloadTaskRecord.KIND_GAME_PACKAGE,
            gameId,
            System.currentTimeMillis()
        );
        for (AndroidDownloadTaskRecord record : cancelledRecords) {
            Log.w(TAG, "uninstallGamePackage cancel-task gameId=" + gameId + " taskId=" + record.taskId);
            AndroidDownloadForegroundService.startManagedIntent(
                getContext(),
                AndroidDownloadForegroundService.buildCancelIntent(getContext(), record.taskId)
            );
        }

        executor.execute(() -> {
            try {
                File gameDir = GamePackageFs.resolveGameDir(getContext(), gameId);
                synchronized (GamePackageFs.packageMutationLock()) {
                    deleteRecursively(gameDir);
                }

                JSONObject payload = new JSONObject();
                long updatedAt = System.currentTimeMillis();
                payload.put("gameId", gameId);
                payload.put("status", "not-installed");
                payload.put("updatedAt", updatedAt);
                GamePackageInstallEventHub.dispatch(payload);

                JSObject result = new JSObject();
                result.put("gameId", gameId);
                result.put("status", "not-installed");
                result.put("updatedAt", updatedAt);
                Log.i(TAG, "uninstallGamePackage success gameId=" + gameId);
                resolveOnMainThread(call, result);
            } catch (Exception error) {
                Log.e(TAG, "uninstallGamePackage failed gameId=" + gameId, error);
                rejectOnMainThread(call, "卸载游戏素材包失败", error);
            }
        });
    }

    @PluginMethod
    public void getInstallState(PluginCall call) {
        String gameId = normalizeNonEmpty(call.getString("gameId"));
        if (gameId == null) {
            call.reject("缺少 gameId");
            return;
        }

        try {
            maybeRecoverPendingForegroundDownloads("get-install-state:" + gameId);
            JSONObject payload = readJsonFile(resolveStateFile(gameId));
            JSObject result = new JSObject();
            AndroidDownloadTaskRecord taskRecord = taskStore.getLatestByTarget(AndroidDownloadTaskRecord.KIND_GAME_PACKAGE, gameId);
            boolean taskRunning = taskRecord != null && taskRecord.isActive();
            result.put("taskRunning", taskRunning);
            if (payload == null) {
                payload = buildInstalledStatePayload(gameId);
            }
            if (payload == null) {
                if (GamePackageFs.cleanupBrokenCurrentInstall(getContext(), gameId)) {
                    Log.w(TAG, "getInstallState cleaned-broken-current gameId=" + gameId);
                }
                cleanupInactivePackageArtifacts(gameId, resolveStagingVersionToKeep(payload, taskRecord), taskRunning);
                Log.i(TAG, "getInstallState empty gameId=" + gameId + " taskRunning=" + taskRunning);
                result.put("exists", false);
                call.resolve(result);
                return;
            }

            payload = normalizeStaleInstallState(gameId, payload, taskRunning, taskRecord);
            payload = normalizeInstalledStateAgainstFiles(gameId, payload, taskRunning);
            cleanupInactivePackageArtifacts(gameId, resolveStagingVersionToKeep(payload, taskRecord), taskRunning);

            result.put("exists", true);
            copyJsonValue(payload, result, "gameId");
            copyJsonValue(payload, result, "status");
            copyJsonValue(payload, result, "progressPercent");
            copyJsonValue(payload, result, "progressMode");
            copyJsonValue(payload, result, "errorCode");
            copyJsonValue(payload, result, "errorMessage");
            copyJsonValue(payload, result, "assetPackVersion");
            copyJsonValue(payload, result, "assetRootPath");
            copyJsonValue(payload, result, "installedAt");
            copyJsonValue(payload, result, "updatedAt");
            Log.i(TAG, "getInstallState success gameId=" + gameId + " taskRunning=" + taskRunning + " payload=" + payload);
            call.resolve(result);
        } catch (Exception error) {
            Log.e(TAG, "getInstallState failed gameId=" + gameId, error);
            call.reject("读取安装任务状态失败", error);
        }
    }

    private JSONObject buildInstalledStatePayload(String gameId) {
        return GamePackageFs.buildInstalledStatePayload(getContext(), gameId);
    }

    private JSONObject normalizeStaleInstallState(String gameId, JSONObject payload, boolean taskRunning, AndroidDownloadTaskRecord taskRecord) {
        if (payload == null || taskRunning) {
            return payload;
        }

        String status = normalizeNonEmpty(payload.optString("status", null));
        if (!isInProgressStatus(status)) {
            return payload;
        }

        if (taskRecord != null && !taskRecord.isTerminal()) {
            return payload;
        }

        try {
            JSONObject normalizedPayload = new JSONObject(payload.toString());
            normalizedPayload.put("status", "failed");
            normalizedPayload.remove("progressPercent");
            normalizedPayload.remove("progressMode");
            normalizedPayload.put("errorCode", ERROR_UNKNOWN);
            normalizedPayload.put("errorMessage", STALE_IN_PROGRESS_ERROR_MESSAGE);
            normalizedPayload.put("updatedAt", System.currentTimeMillis());
            persistInstallState(gameId, normalizedPayload);
            Log.w(TAG, "normalizeStaleInstallState gameId=" + gameId + " previousStatus=" + status + " normalizedPayload=" + normalizedPayload);
            return normalizedPayload;
        } catch (Exception error) {
            Log.w(TAG, "normalizeStaleInstallState failed gameId=" + gameId + " status=" + status, error);
            return payload;
        }
    }

    private JSONObject normalizeInstalledStateAgainstFiles(String gameId, JSONObject payload, boolean taskRunning) {
        if (payload == null) {
            return null;
        }

        String status = normalizeNonEmpty(payload.optString("status", null));
        JSONObject installedPayload = buildInstalledStatePayload(gameId);
        if (!"installed".equals(status)) {
            if (taskRunning) {
                return payload;
            }
            if (installedPayload == null) {
                return payload;
            }

            try {
                persistInstallState(gameId, installedPayload);
            } catch (Exception error) {
                Log.w(TAG, "normalizeInstalledStateAgainstFiles persist-recovered-installed-state-failed gameId=" + gameId, error);
            }
            Log.w(
                TAG,
                "normalizeInstalledStateAgainstFiles recovered-installed-state gameId=" + gameId
                    + " previousPayload=" + payload
                    + " normalizedPayload=" + installedPayload
            );
            return installedPayload;
        }

        if (installedPayload == null) {
            try {
                if (GamePackageFs.cleanupBrokenCurrentInstall(getContext(), gameId)) {
                    Log.w(TAG, "normalizeInstalledStateAgainstFiles removed-broken-current gameId=" + gameId);
                }
                JSONObject normalizedPayload = new JSONObject();
                normalizedPayload.put("gameId", gameId);
                normalizedPayload.put("status", "not-installed");
                normalizedPayload.put("updatedAt", System.currentTimeMillis());
                persistInstallState(gameId, normalizedPayload);
                Log.w(TAG, "normalizeInstalledStateAgainstFiles missing-assets gameId=" + gameId + " previousPayload=" + payload);
                return normalizedPayload;
            } catch (Exception error) {
                Log.w(TAG, "normalizeInstalledStateAgainstFiles missing-assets-normalize-failed gameId=" + gameId, error);
                return payload;
            }
        }

        String payloadAssetRootPath = normalizeNonEmpty(payload.optString("assetRootPath", null));
        String expectedAssetRootPath = normalizeNonEmpty(installedPayload.optString("assetRootPath", null));
        String payloadAssetPackVersion = normalizeNonEmpty(payload.optString("assetPackVersion", null));
        String expectedAssetPackVersion = normalizeNonEmpty(installedPayload.optString("assetPackVersion", null));
        if (
            safeEquals(payloadAssetRootPath, expectedAssetRootPath)
            && safeEquals(payloadAssetPackVersion, expectedAssetPackVersion)
        ) {
            return payload;
        }

        try {
            persistInstallState(gameId, installedPayload);
        } catch (Exception error) {
            Log.w(TAG, "normalizeInstalledStateAgainstFiles persist-repaired-state-failed gameId=" + gameId, error);
        }
        Log.w(TAG, "normalizeInstalledStateAgainstFiles repaired-installed-state gameId=" + gameId + " previousPayload=" + payload + " normalizedPayload=" + installedPayload);
        return installedPayload;
    }

    @PluginMethod
    public void installGamePackage(PluginCall call) {
        JSObject notificationPermission = buildNotificationPermissionResult(false);
        if (notificationPermission.optBoolean("required", false) && !notificationPermission.optBoolean("granted", false)) {
            Log.w(TAG, "installGamePackage missing notification permission gameId=" + call.getString("gameId", ""));
            requestPermissionForAlias(NOTIFICATION_PERMISSION_ALIAS, call, "handleInstallNotificationPermissionResult");
            return;
        }

        enqueueInstallGamePackage(call, false);
    }

    @PluginMethod
    public void installGamePackageIncremental(PluginCall call) {
        JSObject notificationPermission = buildNotificationPermissionResult(false);
        if (notificationPermission.optBoolean("required", false) && !notificationPermission.optBoolean("granted", false)) {
            Log.w(TAG, "installGamePackageIncremental missing notification permission gameId=" + call.getString("gameId", ""));
            requestPermissionForAlias(NOTIFICATION_PERMISSION_ALIAS, call, "handleInstallNotificationPermissionResult");
            return;
        }

        enqueueInstallGamePackage(call, true);
    }

    @PermissionCallback
    private void handleInstallNotificationPermissionResult(PluginCall call) {
        JSObject permissionState = buildNotificationPermissionResult(true);
        if (!permissionState.optBoolean("granted", false)) {
            String message = permissionState.optString("message", NOTIFICATION_PERMISSION_REQUIRED_MESSAGE);
            Log.w(TAG, "installGamePackage notification permission denied message=" + message);
            call.reject(message);
            return;
        }

        enqueueInstallGamePackage(call, normalizeNonEmpty(call.getString("fileIndexUrl")) != null);
    }

    private void enqueueInstallGamePackage(PluginCall call, boolean incrementalMode) {
        String gameId = normalizeNonEmpty(call.getString("gameId"));
        String runtimeChannel = normalizeNonEmpty(call.getString("runtimeChannel"));
        String assetPackId = normalizeNonEmpty(call.getString("assetPackId"));
        String assetPackVersion = normalizeNonEmpty(call.getString("assetPackVersion"));
        String assetPackUrl = normalizeNonEmpty(call.getString("assetPackUrl"));
        String assetPackChecksum = normalizeChecksum(call.getString("assetPackChecksum"));
        String assetBaseUrl = normalizeNonEmpty(call.getString("assetBaseUrl"));
        String fileIndexUrl = normalizeNonEmpty(call.getString("fileIndexUrl"));
        String fileIndexChecksum = normalizeChecksum(call.getString("fileIndexChecksum"));
        Boolean allowFullFallbackValue = call.getBoolean("allowFullFallback");
        boolean allowFullFallback = allowFullFallbackValue == null || allowFullFallbackValue;
        Log.i(
            TAG,
            "installGamePackage requested gameId=" + gameId
                + " runtimeChannel=" + runtimeChannel
                + " assetPackId=" + assetPackId
                + " assetPackVersion=" + assetPackVersion
                + " assetPackUrl=" + assetPackUrl
                + " assetPackChecksum=" + (assetPackChecksum != null ? assetPackChecksum : "")
                + " incrementalMode=" + incrementalMode
                + " fileIndexUrl=" + (fileIndexUrl != null ? fileIndexUrl : "")
        );

        if (gameId == null) {
            call.reject("缺少 gameId");
            return;
        }
        final String resolvedRuntimeChannel = runtimeChannel != null ? runtimeChannel : "stable";
        if (assetPackUrl == null && (!incrementalMode || allowFullFallback)) {
            call.reject("缺少 assetPackUrl");
            return;
        }
        if (incrementalMode && (assetBaseUrl == null || fileIndexUrl == null)) {
            call.reject("缺少增量安装所需的 assetBaseUrl 或 fileIndexUrl");
            return;
        }
        String resolvedAssetPackId = assetPackId != null ? assetPackId : gameId;
        String resolvedAssetPackVersion = assetPackVersion != null ? assetPackVersion : "unknown";
        String installMode = incrementalMode ? "incremental" : "full";
        AndroidDownloadTaskRecord existingRecord = taskStore.getLatestByTarget(AndroidDownloadTaskRecord.KIND_GAME_PACKAGE, gameId);
        if (existingRecord == null || existingRecord.isTerminal()) {
            if (GamePackageFs.cleanupBrokenCurrentInstall(getContext(), gameId)) {
                Log.w(TAG, "enqueueInstallGamePackage cleaned-broken-current gameId=" + gameId);
            }
            cleanupInactivePackageArtifacts(gameId, resolvedAssetPackVersion, false);
        }
        File stagingDir = GamePackageFs.resolveVersionedStagingDir(getContext(), gameId, resolvedAssetPackVersion);
        File archiveFile = new File(stagingDir, GamePackageFs.ARCHIVE_FILE);
        File archivePartFile = new File(stagingDir, GamePackageFs.ARCHIVE_PART_FILE);
        AndroidDownloadTaskRecord record = taskStore.enqueueOrReuse(
            AndroidDownloadTaskRecord.KIND_GAME_PACKAGE,
            gameId,
            gameId,
            resolvedRuntimeChannel,
            resolvedAssetPackId,
            resolvedAssetPackVersion,
            assetPackUrl,
            assetPackChecksum,
            installMode,
            assetBaseUrl,
            fileIndexUrl,
            fileIndexChecksum,
            allowFullFallback,
            archiveFile.getAbsolutePath(),
            archivePartFile.getAbsolutePath()
        );
        AndroidDownloadForegroundService.startManagedIntent(
            getContext(),
            AndroidDownloadForegroundService.buildEnqueueIntent(
                getContext(),
                AndroidDownloadTaskRecord.KIND_GAME_PACKAGE,
                gameId,
                gameId,
                resolvedRuntimeChannel,
                resolvedAssetPackId,
                resolvedAssetPackVersion,
                assetPackUrl,
                assetPackChecksum,
                installMode,
                assetBaseUrl,
                fileIndexUrl,
                fileIndexChecksum,
                allowFullFallback,
                archiveFile.getAbsolutePath(),
                archivePartFile.getAbsolutePath()
            )
        );
        JSObject result = new JSObject();
        result.put("accepted", true);
        result.put("taskId", record.taskId);
        result.put("status", record.status);
        result.put("gameId", gameId);
        result.put("runtimeChannel", resolvedRuntimeChannel);
        result.put("assetPackVersion", resolvedAssetPackVersion);
        call.resolve(result);
    }

    private File getRootDir() {
        return GamePackageFs.getRootDir(getContext());
    }

    private String buildAssetRootPath(File assetRootDir) {
        return GamePackageFs.buildAssetRootPath(assetRootDir);
    }

    private void downloadArchive(
        String urlValue,
        File targetFile,
        File partFile,
        String expectedChecksum,
        AtomicBoolean cancelFlag,
        String gameId,
        String assetPackVersion
    ) throws Exception {
        if (targetFile.exists() && isChecksumMatch(targetFile, expectedChecksum)) {
            emitInstallState(gameId, "downloading", 100, "determinate", null, assetPackVersion, null, null);
            return;
        }

        Exception lastError = null;
        for (int attempt = 1; attempt <= DOWNLOAD_MAX_ATTEMPTS; attempt += 1) {
            try {
                downloadArchiveOnce(urlValue, targetFile, partFile, expectedChecksum, cancelFlag, gameId, assetPackVersion, attempt);
                return;
            } catch (Exception error) {
                lastError = error;
                boolean recoverable = isRecoverableDownloadError(error);
                long partBytes = partFile.exists() ? partFile.length() : 0L;
                Log.w(
                    TAG,
                    "downloadArchive attempt-failed gameId=" + gameId
                        + " version=" + assetPackVersion
                        + " attempt=" + attempt
                        + " maxAttempts=" + DOWNLOAD_MAX_ATTEMPTS
                        + " recoverable=" + recoverable
                        + " cancelRequested=" + cancelFlag.get()
                        + " partExists=" + partFile.exists()
                        + " partBytes=" + partBytes
                        + " errorChain=" + summarizeThrowableChain(error),
                    error
                );
                if (cancelFlag.get() || !recoverable || attempt >= DOWNLOAD_MAX_ATTEMPTS) {
                    throw error;
                }
                Log.w(
                    TAG,
                    "downloadArchive retry gameId=" + gameId
                        + " version=" + assetPackVersion
                        + " attempt=" + attempt
                        + " nextAttempt=" + (attempt + 1)
                        + " partBytes=" + partBytes,
                    error
                );
                try {
                    Thread.sleep(1000L * attempt);
                } catch (InterruptedException interrupted) {
                    Thread.currentThread().interrupt();
                    throw interrupted;
                }
            }
        }
        if (lastError != null) {
            throw lastError;
        }
    }

    private void downloadArchiveOnce(
        String urlValue,
        File targetFile,
        File partFile,
        String expectedChecksum,
        AtomicBoolean cancelFlag,
        String gameId,
        String assetPackVersion,
        int attempt
    ) throws Exception {
        HttpURLConnection connection = (HttpURLConnection) new URL(urlValue).openConnection();
        connection.setConnectTimeout(15000);
        connection.setReadTimeout(30000);
        connection.setRequestProperty("Accept", "application/zip,application/octet-stream");
        long resumedBytes = partFile.exists() ? partFile.length() : 0L;
        if (resumedBytes > 0) {
            connection.setRequestProperty("Range", "bytes=" + resumedBytes + "-");
        }
        Log.i(
            TAG,
            "downloadArchive start gameId=" + gameId
                + " version=" + assetPackVersion
                + " attempt=" + attempt
                + " url=" + urlValue
                + " resumedBytes=" + resumedBytes
                + " partExists=" + partFile.exists()
        );

        try {
            int responseCode = connection.getResponseCode();
            boolean appendMode = false;
            if (resumedBytes > 0 && responseCode == HttpURLConnection.HTTP_PARTIAL) {
                appendMode = true;
                Log.i(TAG, "downloadArchive resume-accepted gameId=" + gameId + " resumedBytes=" + resumedBytes);
            } else if (resumedBytes > 0 && responseCode == HttpURLConnection.HTTP_OK) {
                Log.w(TAG, "downloadArchive resume-reset gameId=" + gameId + " resumedBytes=" + resumedBytes);
                if (!partFile.delete() && partFile.exists()) {
                    throw new IOException("重置续传文件失败");
                }
                resumedBytes = 0L;
            } else if (resumedBytes > 0 && responseCode == HTTP_RANGE_NOT_SATISFIABLE) {
                Log.w(TAG, "downloadArchive resume-range-not-satisfiable gameId=" + gameId + " resumedBytes=" + resumedBytes);
                if (isChecksumMatch(partFile, expectedChecksum)) {
                    if (targetFile.exists() && !targetFile.delete()) {
                        throw new IOException("清理旧安装包失败");
                    }
                    if (!partFile.renameTo(targetFile)) {
                        throw new IOException("恢复已完成资源包失败");
                    }
                    emitInstallState(gameId, "downloading", 100, "determinate", null, assetPackVersion, null, null);
                    return;
                }
                if (!partFile.delete() && partFile.exists()) {
                    throw new IOException("重置不可续传文件失败");
                }
                throw new IOException("服务端拒绝续传，且本地临时资源包校验失败");
            }
            Log.i(
                TAG,
                "downloadArchive response gameId=" + gameId
                    + " version=" + assetPackVersion
                    + " attempt=" + attempt
                    + " code=" + responseCode
                    + " contentLength=" + connection.getContentLengthLong()
                    + " contentRange=" + connection.getHeaderField("Content-Range")
                    + " resumedBytes=" + resumedBytes
                    + " appendMode=" + appendMode
            );
            if (responseCode < 200 || responseCode >= 300) {
                throw new IOException("下载失败，HTTP " + responseCode);
            }

            long totalBytes = resolveTotalBytes(connection, resumedBytes, responseCode);
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            if (appendMode) {
                try (InputStream existingInput = new BufferedInputStream(new FileInputStream(partFile))) {
                    byte[] existingBuffer = new byte[BUFFER_SIZE];
                    int existingRead;
                    while ((existingRead = existingInput.read(existingBuffer)) != -1) {
                        digest.update(existingBuffer, 0, existingRead);
                    }
                }
            }
            long downloadedBytes = resumedBytes;
            int lastPercent = -1;
            int lastLoggedBucket = -1;

            try (
                InputStream rawInput = new BufferedInputStream(connection.getInputStream());
                BufferedOutputStream output = new BufferedOutputStream(new FileOutputStream(partFile, appendMode))
            ) {
                byte[] buffer = new byte[BUFFER_SIZE];
                int read;
                while ((read = rawInput.read(buffer)) != -1) {
                    if (cancelFlag.get()) {
                        throw new IOException("安装已取消");
                    }

                    output.write(buffer, 0, read);
                    digest.update(buffer, 0, read);
                    downloadedBytes += read;

                    if (totalBytes > 0) {
                        int percent = (int) Math.max(0, Math.min(100, Math.round((downloadedBytes * 100f) / totalBytes)));
                        if (percent != lastPercent) {
                            lastPercent = percent;
                            emitInstallState(gameId, "downloading", percent, "determinate", null, assetPackVersion, null, null);
                            int currentBucket = percent / 10;
                            if (currentBucket != lastLoggedBucket || percent == 100) {
                                lastLoggedBucket = currentBucket;
                                Log.i(
                                    TAG,
                                    "downloadArchive progress gameId=" + gameId
                                        + " version=" + assetPackVersion
                                        + " percent=" + percent
                                        + " downloadedBytes=" + downloadedBytes
                                        + " totalBytes=" + totalBytes
                                );
                            }
                        }
                    } else {
                        emitInstallState(gameId, "downloading", null, "indeterminate", null, assetPackVersion, null, null);
                    }
                }
            }

            String actualChecksum = bytesToHex(digest.digest());
            if (expectedChecksum != null && !expectedChecksum.equalsIgnoreCase(actualChecksum)) {
                throw new IOException("下载包校验失败");
            }
            if (targetFile.exists() && !targetFile.delete()) {
                throw new IOException("清理旧安装包失败");
            }
            if (!partFile.renameTo(targetFile)) {
                throw new IOException("写入安装包失败");
            }
            Log.i(
                TAG,
                "downloadArchive finished gameId=" + gameId
                    + " version=" + assetPackVersion
                    + " attempt=" + attempt
                    + " checksumOk=" + (expectedChecksum == null || expectedChecksum.equalsIgnoreCase(actualChecksum))
                    + " actualChecksum=" + actualChecksum
            );
        } finally {
            connection.disconnect();
        }
    }

    private boolean isRecoverableDownloadError(Throwable error) {
        Throwable current = error;
        while (current != null) {
            if (
                current instanceof SocketTimeoutException
                || current instanceof ProtocolException
                || current instanceof SocketException
            ) {
                return true;
            }

            String message = current.getMessage();
            if (message != null) {
                String lowerMessage = message.toLowerCase();
                if (
                    lowerMessage.contains("unexpected end of stream")
                    || lowerMessage.contains("timeout")
                    || lowerMessage.contains("connection abort")
                    || lowerMessage.contains("connection reset")
                    || lowerMessage.contains("broken pipe")
                    || lowerMessage.contains("stream was reset")
                ) {
                    return true;
                }
            }
            current = current.getCause();
        }
        return false;
    }

    private String summarizeThrowableChain(Throwable error) {
        if (error == null) {
            return "none";
        }

        StringBuilder builder = new StringBuilder();
        Throwable current = error;
        int depth = 0;
        while (current != null && depth < 8) {
            if (depth > 0) {
                builder.append(" <- ");
            }
            builder.append(current.getClass().getName());
            String message = current.getMessage();
            if (message != null && !message.trim().isEmpty()) {
                builder.append(": ").append(message.trim());
            }
            current = current.getCause();
            depth += 1;
        }
        if (current != null) {
            builder.append(" <- ...");
        }
        return builder.toString();
    }

    private void extractArchive(File archiveFile, File outputDir, AtomicBoolean cancelFlag) throws IOException {
        String outputRoot = outputDir.getCanonicalPath();
        Log.i(TAG, "extractArchive start archive=" + archiveFile.getAbsolutePath() + " outputDir=" + outputRoot);
        try (ZipInputStream zipInputStream = new ZipInputStream(new BufferedInputStream(new FileInputStream(archiveFile)))) {
            ZipEntry entry;
            int fileCount = 0;
            while ((entry = zipInputStream.getNextEntry()) != null) {
                if (cancelFlag.get()) {
                    throw new IOException("安装已取消");
                }

                File targetFile = new File(outputDir, entry.getName());
                String canonicalTargetPath = targetFile.getCanonicalPath();
                if (!canonicalTargetPath.startsWith(outputRoot + File.separator) && !canonicalTargetPath.equals(outputRoot)) {
                    throw new IOException("压缩包路径非法: " + entry.getName());
                }

                if (entry.isDirectory()) {
                    if (!targetFile.mkdirs() && !targetFile.exists()) {
                        throw new IOException("创建目录失败: " + targetFile.getAbsolutePath());
                    }
                    continue;
                }

                File parent = targetFile.getParentFile();
                if (parent != null && !parent.mkdirs() && !parent.exists()) {
                    throw new IOException("创建目录失败: " + parent.getAbsolutePath());
                }

                try (BufferedOutputStream output = new BufferedOutputStream(new FileOutputStream(targetFile))) {
                    byte[] buffer = new byte[BUFFER_SIZE];
                    int read;
                    while ((read = zipInputStream.read(buffer)) != -1) {
                        if (cancelFlag.get()) {
                            throw new IOException("安装已取消");
                        }
                        output.write(buffer, 0, read);
                    }
                }
                fileCount += 1;
            }
            Log.i(TAG, "extractArchive finished outputDir=" + outputRoot + " fileCount=" + fileCount);
        }
    }

    private void writeMetadata(
        File targetFile,
        String gameId,
        String runtimeChannel,
        String assetPackId,
        String assetPackVersion,
        long installedAt
    ) throws IOException, JSONException {
        GamePackageFs.writeMetadata(targetFile, gameId, runtimeChannel, assetPackId, assetPackVersion, installedAt);
    }

    private JSONObject readJsonFile(File file) throws IOException, JSONException {
        return GamePackageFs.readJsonFile(file);
    }

    private String readInputStream(InputStream inputStream) throws IOException {
        StringBuilder builder = new StringBuilder();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(inputStream, StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) {
                builder.append(line);
            }
        }
        return builder.toString();
    }

    private void emitInstallState(
        String gameId,
        String status,
        Integer progressPercent,
        String progressMode,
        String errorCode,
        String errorMessage,
        String assetPackVersion,
        String assetRootPath,
        Long installedAt
    ) {
        JSObject payload = new JSObject();
        payload.put("gameId", gameId);
        payload.put("status", status);
        if (progressPercent != null) {
            payload.put("progressPercent", progressPercent);
        }
        if (progressMode != null) {
            payload.put("progressMode", progressMode);
        }
        if (errorCode != null && !errorCode.isEmpty()) {
            payload.put("errorCode", errorCode);
        }
        if (errorMessage != null && !errorMessage.isEmpty()) {
            payload.put("errorMessage", errorMessage);
        }
        if (assetPackVersion != null && !assetPackVersion.isEmpty()) {
            payload.put("assetPackVersion", assetPackVersion);
        }
        if (assetRootPath != null && !assetRootPath.isEmpty()) {
            payload.put("assetRootPath", assetRootPath);
        }
        if (installedAt != null) {
            payload.put("installedAt", installedAt);
        }

        payload.put("updatedAt", System.currentTimeMillis());
        persistInstallState(gameId, payload);
        Log.i(TAG, "emitInstallState payload=" + payload.toString());
        mainHandler.post(() -> notifyListeners("installStateChanged", payload));
    }

    private void emitInstallState(
        String gameId,
        String status,
        Integer progressPercent,
        String progressMode,
        String errorMessage,
        String assetPackVersion,
        String assetRootPath,
        Long installedAt
    ) {
        emitInstallState(gameId, status, progressPercent, progressMode, null, errorMessage, assetPackVersion, assetRootPath, installedAt);
    }

    private void resolveOnMainThread(PluginCall call, JSObject result) {
        mainHandler.post(() -> call.resolve(result));
    }

    private void rejectOnMainThread(PluginCall call, String message, Exception error) {
        mainHandler.post(() -> call.reject(message, error));
    }

    private String normalizeInstalledAssetRelativePath(String relativePath) {
        if (relativePath == null) {
            return null;
        }

        String normalized = relativePath.trim().replace('\\', '/');
        while (normalized.startsWith("/")) {
            normalized = normalized.substring(1);
        }
        while (normalized.contains("//")) {
            normalized = normalized.replace("//", "/");
        }
        if (normalized.isEmpty()) {
            return null;
        }

        String[] segments = normalized.split("/");
        for (String segment : segments) {
            if (segment == null || segment.isEmpty() || ".".equals(segment) || "..".equals(segment)) {
                return null;
            }
        }
        return normalized;
    }

    private File resolveInstalledAssetFile(String gameId, String normalizedRelativePath) throws IOException {
        File assetRootDir = GamePackageFs.resolveCurrentAssetsDir(getContext(), gameId);
        if (!assetRootDir.isDirectory()) {
            return null;
        }

        File assetFile = new File(assetRootDir, normalizedRelativePath.replace("/", File.separator));
        String assetRootPath = assetRootDir.getCanonicalPath();
        String assetFilePath = assetFile.getCanonicalPath();
        String allowedPrefix = assetRootPath.endsWith(File.separator)
            ? assetRootPath
            : assetRootPath + File.separator;
        if (!assetFilePath.startsWith(allowedPrefix)) {
            throw new IOException("素材路径越界: " + normalizedRelativePath);
        }
        return assetFile;
    }

    private String detectInstalledAssetMimeType(File assetFile, String normalizedRelativePath) throws IOException {
        String mimeType = normalizeNonEmpty(Files.probeContentType(assetFile.toPath()));
        if (mimeType != null) {
            return mimeType;
        }

        String lowerPath = normalizedRelativePath.toLowerCase();
        if (lowerPath.endsWith(".webp")) return "image/webp";
        if (lowerPath.endsWith(".png")) return "image/png";
        if (lowerPath.endsWith(".jpg") || lowerPath.endsWith(".jpeg")) return "image/jpeg";
        if (lowerPath.endsWith(".json")) return "application/json";
        return "application/octet-stream";
    }

    private String normalizeNonEmpty(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private String normalizeChecksum(String value) {
        String normalized = normalizeNonEmpty(value);
        if (normalized == null) {
            return null;
        }
        if (normalized.startsWith("sha256-")) {
            return normalized.substring("sha256-".length());
        }
        return normalized;
    }

    private String bytesToHex(byte[] bytes) {
        StringBuilder builder = new StringBuilder(bytes.length * 2);
        for (byte value : bytes) {
            builder.append(String.format("%02x", value));
        }
        return builder.toString();
    }

    private boolean safeEquals(String left, String right) {
        return GamePackageFs.safeEquals(left, right);
    }

    private boolean isChecksumMatch(File file, String checksum) throws Exception {
        if (!file.exists()) {
            return false;
        }
        if (checksum == null || checksum.isEmpty()) {
            return true;
        }

        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        try (InputStream inputStream = new BufferedInputStream(new FileInputStream(file))) {
            byte[] buffer = new byte[BUFFER_SIZE];
            int read;
            while ((read = inputStream.read(buffer)) != -1) {
                digest.update(buffer, 0, read);
            }
        }
        return checksum.equalsIgnoreCase(bytesToHex(digest.digest()));
    }

    private long resolveTotalBytes(HttpURLConnection connection, long resumedBytes, int responseCode) {
        long contentLength = connection.getContentLengthLong();
        if (responseCode != HttpURLConnection.HTTP_PARTIAL) {
            return contentLength;
        }

        String contentRange = connection.getHeaderField("Content-Range");
        if (contentRange != null) {
            int slashIndex = contentRange.lastIndexOf('/');
            if (slashIndex >= 0 && slashIndex + 1 < contentRange.length()) {
                String totalText = contentRange.substring(slashIndex + 1).trim();
                try {
                    long parsed = Long.parseLong(totalText);
                    if (parsed > 0) {
                        return parsed;
                    }
                } catch (NumberFormatException ignored) {
                    // fallback below
                }
            }
        }

        return contentLength > 0 ? resumedBytes + contentLength : contentLength;
    }

    private File resolveStateFile(String gameId) {
        return GamePackageFs.resolveStateFile(getContext(), gameId);
    }

    private boolean isTaskRunning(String gameId) {
        AndroidDownloadTaskRecord record = taskStore.getLatestByTarget(AndroidDownloadTaskRecord.KIND_GAME_PACKAGE, gameId);
        return record != null && record.isActive();
    }

    private boolean isInProgressStatus(String status) {
        return "queued".equals(status)
            || "manifest".equals(status)
            || "downloading".equals(status)
            || "verifying".equals(status);
    }

    private void persistInstallState(String gameId, JSONObject payload) {
        try {
            GamePackageFs.writeJsonFile(resolveStateFile(gameId), payload);
        } catch (Exception error) {
            Log.w(TAG, "persistInstallState failed gameId=" + gameId, error);
        }
    }

    private void cleanupInactivePackageArtifacts(String gameId, String keepPackageVersion, boolean taskRunning) {
        if (taskRunning) {
            return;
        }

        int deletedCount = GamePackageFs.cleanupStagingDirectories(getContext(), gameId, keepPackageVersion);
        if (deletedCount > 0) {
            Log.i(
                TAG,
                "cleanupInactivePackageArtifacts gameId=" + gameId
                    + " deletedCount=" + deletedCount
                    + " keepPackageVersion=" + (keepPackageVersion != null ? keepPackageVersion : "")
            );
        }
    }

    private String resolveStagingVersionToKeep(JSONObject payload, AndroidDownloadTaskRecord taskRecord) {
        if (taskRecord != null && !taskRecord.isTerminal()) {
            return taskRecord.packageVersion;
        }

        String status = payload != null ? normalizeNonEmpty(payload.optString("status", null)) : null;
        if (!"failed".equals(status)) {
            return null;
        }

        String errorCode = normalizeNonEmpty(payload.optString("errorCode", null));
        if (
            ERROR_CANCELLED.equals(errorCode)
            || ERROR_NETWORK_TIMEOUT.equals(errorCode)
            || ERROR_FILE_IO.equals(errorCode)
            || ERROR_UNKNOWN.equals(errorCode)
        ) {
            return normalizeNonEmpty(payload.optString("assetPackVersion", null));
        }

        return null;
    }

    private void copyJsonValue(JSONObject source, JSObject target, String key) {
        if (!source.has(key) || source.isNull(key)) {
            return;
        }
        target.put(key, source.opt(key));
    }

    private JSObject buildNotificationPermissionResult(boolean requested) {
        JSObject result = new JSObject();
        boolean required = Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU;
        result.put("required", required);
        result.put("requested", requested);
        if (!required) {
            result.put("granted", true);
            result.put("state", PermissionState.GRANTED.toString());
            result.put("canPrompt", false);
            return result;
        }

        PermissionState permissionState = getPermissionState(NOTIFICATION_PERMISSION_ALIAS);
        if (permissionState == null) {
            permissionState = PermissionState.PROMPT;
        }
        boolean granted = permissionState == PermissionState.GRANTED;
        boolean canPrompt = permissionState == PermissionState.PROMPT
            || permissionState == PermissionState.PROMPT_WITH_RATIONALE;
        result.put("granted", granted);
        result.put("state", permissionState.toString());
        result.put("canPrompt", canPrompt);
        if (!granted) {
            result.put("message", canPrompt ? NOTIFICATION_PERMISSION_REQUIRED_MESSAGE : NOTIFICATION_PERMISSION_DENIED_MESSAGE);
        }
        return result;
    }

    private void maybeRecoverPendingForegroundDownloads(String reason) {
        if (taskStore == null || !taskStore.hasUnfinishedTasks()) {
            return;
        }

        Log.i(TAG, "maybeRecoverPendingForegroundDownloads reason=" + reason);
        AndroidDownloadForegroundService.startManagedIntent(
            getContext(),
            AndroidDownloadForegroundService.buildReconcileIntent(getContext())
        );
    }

    private String sanitizeFileSegment(String value) {
        return GamePackageFs.sanitizeFileSegment(value);
    }

    private String classifyInstallErrorCode(Exception error) {
        if (error == null) {
            return ERROR_UNKNOWN;
        }

        if (error instanceof SocketTimeoutException) {
            return ERROR_NETWORK_TIMEOUT;
        }
        if (error instanceof ZipException) {
            return ERROR_ARCHIVE_INVALID;
        }

        String message = error.getMessage() != null ? error.getMessage() : "";
        String lowerMessage = message.toLowerCase();

        if (lowerMessage.contains("http ")) {
            return ERROR_HTTP;
        }
        if (message.contains("续传")) {
            return ERROR_RESUME_NOT_SUPPORTED;
        }
        if (message.contains("校验")) {
            return ERROR_CHECKSUM;
        }
        if (
            lowerMessage.contains("enospc")
            || lowerMessage.contains("no space left")
            || message.contains("空间不足")
        ) {
            return ERROR_INSUFFICIENT_STORAGE;
        }
        if (message.contains("取消")) {
            return ERROR_CANCELLED;
        }
        if (message.contains("压缩包") || message.contains("路径非法")) {
            return ERROR_ARCHIVE_INVALID;
        }
        if (error instanceof IOException) {
            return ERROR_FILE_IO;
        }

        return ERROR_UNKNOWN;
    }

    private void deleteRecursively(File target) {
        GamePackageFs.deleteRecursively(target);
    }
}
