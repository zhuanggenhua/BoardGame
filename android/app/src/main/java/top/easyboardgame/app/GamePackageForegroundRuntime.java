package top.easyboardgame.app;

import android.content.Context;
import android.net.Uri;
import android.util.Log;
import java.io.BufferedInputStream;
import java.io.BufferedOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.ProtocolException;
import java.net.SocketException;
import java.net.SocketTimeoutException;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.StandardCopyOption;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.zip.ZipEntry;
import java.util.zip.ZipException;
import java.util.zip.ZipInputStream;
import org.json.JSONArray;
import org.json.JSONObject;

final class GamePackageForegroundRuntime {

    private static final String TAG = "GamePkgFgRuntime";
    private static final int HTTP_RANGE_NOT_SATISFIABLE = 416;
    private static final int BUFFER_SIZE = 16 * 1024;
    private static final int DOWNLOAD_MAX_ATTEMPTS = 4;

    private GamePackageForegroundRuntime() {}

    private static final class IncrementalFallbackException extends IOException {
        IncrementalFallbackException(String message) {
            super(message);
        }
    }

    static class RetryableDownloadException extends IOException {
        RetryableDownloadException(String message) {
            super(message);
        }
    }

    static final class IncrementalRetryableDownloadException extends RetryableDownloadException {
        IncrementalRetryableDownloadException(String message) {
            super(message);
        }
    }

    static final class RemoteFileEntry {
        final String path;
        final String hash;
        final long size;

        RemoteFileEntry(String path, String hash, long size) {
            this.path = path;
            this.hash = hash;
            this.size = size;
        }
    }

    private interface IncrementalFileProgressListener {
        void onProgress(long fileDownloadedBytes);
    }

    static void runTask(
        Context context,
        AndroidDownloadTaskStore taskStore,
        AndroidDownloadTaskRecord task,
        AtomicBoolean cancelFlag,
        Runnable onProgress
    ) {
        try {
            executeGamePackageTask(context, taskStore, task, cancelFlag, onProgress);
        } catch (Exception error) {
            logError("runTask failed taskId=" + task.taskId + " logicalId=" + task.logicalId, error);
            taskStore.markFailed(task.taskId, classifyInstallErrorCode(error), error.getMessage(), System.currentTimeMillis());
            emitInstallState(context, task.logicalId, "failed", null, null, classifyInstallErrorCode(error), error.getMessage(), task.packageVersion, null, null);
        }
    }

    static void emitQueuedOrRunningState(Context context, AndroidDownloadTaskRecord record) {
        if (record == null) {
            return;
        }
        boolean active = AndroidDownloadTaskRecord.STATUS_RUNNING.equals(record.status) || AndroidDownloadTaskRecord.STATUS_VERIFYING.equals(record.status);
        emitInstallState(context, record.logicalId, active ? "manifest" : "queued", null, "indeterminate", null, null, record.packageVersion, null, null);
    }

    static void emitCancelledState(Context context, AndroidDownloadTaskRecord record) {
        if (record == null) {
            return;
        }
        emitInstallState(context, record.logicalId, "failed", null, null, "cancelled", "下载已取消", record.packageVersion, null, null);
    }

    static String buildNotificationText(AndroidDownloadTaskRecord activeTask, int queuedCount) {
        if (activeTask == null) {
            return String.format(Locale.ROOT, "队列中还有 %d 个任务等待执行", queuedCount);
        }
        int percent = activeTask.totalBytes > 0
            ? (int) Math.max(0, Math.min(100, Math.round((activeTask.downloadedBytes * 100f) / activeTask.totalBytes)))
            : -1;
        if (percent < 0) {
            return queuedCount > 0 ? String.format(Locale.ROOT, "正在准备下载，后面还有 %d 个任务排队", queuedCount) : "正在准备下载";
        }
        return queuedCount > 0
            ? String.format(Locale.ROOT, "当前 %d%%，后面还有 %d 个任务排队", percent, queuedCount)
            : String.format(Locale.ROOT, "当前 %d%%", percent);
    }

    private static void executeGamePackageTask(
        Context context,
        AndroidDownloadTaskStore taskStore,
        AndroidDownloadTaskRecord task,
        AtomicBoolean cancelFlag,
        Runnable onProgress
    ) throws Exception {
        if (!AndroidDownloadTaskRecord.KIND_GAME_PACKAGE.equals(task.kind)) {
            throw new IOException("当前仅支持游戏包下载任务");
        }

        if (!task.isIncrementalInstall()) {
            executeFullGamePackageTask(context, taskStore, task, cancelFlag, onProgress);
            return;
        }

        try {
            executeIncrementalGamePackageTask(context, taskStore, task, cancelFlag, onProgress);
        } catch (IncrementalFallbackException error) {
            if (!task.allowFullFallback) {
                logWarn("incremental install failed without full fallback taskId=" + task.taskId + " reason=" + error.getMessage());
                throw error;
            }
            logWarn("incremental install fallback taskId=" + task.taskId + " reason=" + error.getMessage());
            executeFullGamePackageTask(context, taskStore, task, cancelFlag, onProgress);
        }
    }

    private static void executeFullGamePackageTask(
        Context context,
        AndroidDownloadTaskStore taskStore,
        AndroidDownloadTaskRecord task,
        AtomicBoolean cancelFlag,
        Runnable onProgress
    ) throws Exception {
        String gameId = task.logicalId;
        String resolvedPackageVersion = safe(task.packageVersion, "unknown");
        File stagingDir = GamePackageFs.resolveVersionedStagingDir(context, gameId, resolvedPackageVersion);
        File archiveFile = new File(task.destinationPath != null ? task.destinationPath : GamePackageFs.resolveArchiveFile(context, gameId, resolvedPackageVersion).getAbsolutePath());
        File archivePartFile = new File(task.partialPath != null ? task.partialPath : GamePackageFs.resolveArchivePartFile(context, gameId, resolvedPackageVersion).getAbsolutePath());
        File stagingAssetsDir = GamePackageFs.resolveStagingAssetsDir(context, gameId, resolvedPackageVersion);
        File currentDir = GamePackageFs.resolveCurrentDir(context, gameId);
        File currentAssetsDir = GamePackageFs.resolveCurrentAssetsDir(context, gameId);
        long installedAt = System.currentTimeMillis();

        GamePackageFs.cleanupBrokenCurrentInstall(context, gameId);
        GamePackageFs.cleanupStagingDirectories(context, gameId, resolvedPackageVersion);
        if (!stagingDir.exists() && !stagingDir.mkdirs()) throw new IOException("创建临时目录失败");
        if (!stagingAssetsDir.exists() && !stagingAssetsDir.mkdirs()) throw new IOException("创建临时目录失败");

        emitInstallState(context, gameId, "manifest", null, "indeterminate", null, null, task.packageVersion, null, null);
        downloadArchive(context, taskStore, task, archiveFile, archivePartFile, cancelFlag, onProgress);
        taskStore.markVerifying(task.taskId, System.currentTimeMillis());
        emitInstallState(context, gameId, "verifying", 100, "indeterminate", null, null, task.packageVersion, null, null);

        GamePackageFs.deleteRecursively(stagingAssetsDir);
        if (!stagingAssetsDir.mkdirs() && !stagingAssetsDir.exists()) throw new IOException("创建解压目录失败");
        extractArchive(archiveFile, stagingAssetsDir, cancelFlag);
        if (cancelFlag.get()) throw new IOException("安装已取消");

        JSONObject installedFilesIndex = GamePackageFs.buildInstalledFilesIndex(stagingAssetsDir, resolvedPackageVersion);
        GamePackageFs.writeJsonFile(GamePackageFs.resolveStagingInstalledFilesIndexFile(context, gameId, resolvedPackageVersion), installedFilesIndex);
        GamePackageFs.writeMetadata(GamePackageFs.resolveStagingMetadataFile(context, gameId, resolvedPackageVersion), gameId, safe(task.runtimeChannel, "stable"), safe(task.packageId, gameId), resolvedPackageVersion, installedAt);
        switchStagingToCurrent(context, gameId, resolvedPackageVersion, currentDir, currentAssetsDir);

        taskStore.markCompleted(task.taskId, archiveFile.length(), System.currentTimeMillis());
        emitInstallState(context, gameId, "installed", null, null, null, null, task.packageVersion, currentAssetsDir.getAbsolutePath(), installedAt);
        GamePackageFs.cleanupStagingDirectories(context, gameId, null);
        onProgress.run();
    }

    private static void executeIncrementalGamePackageTask(
        Context context,
        AndroidDownloadTaskStore taskStore,
        AndroidDownloadTaskRecord task,
        AtomicBoolean cancelFlag,
        Runnable onProgress
    ) throws Exception {
        String gameId = task.logicalId;
        String resolvedPackageVersion = safe(task.packageVersion, "unknown");
        String assetBaseUrl = GamePackageFs.normalizeNonEmpty(task.assetBaseUrl);
        String fileIndexUrl = GamePackageFs.normalizeNonEmpty(task.fileIndexUrl);
        File currentAssetsDir = GamePackageFs.resolveCurrentAssetsDir(context, gameId);
        File currentMetadataFile = GamePackageFs.resolveCurrentMetadataFile(context, gameId);
        File currentInstalledFilesIndexFile = GamePackageFs.resolveCurrentInstalledFilesIndexFile(context, gameId);
        long installedAt = System.currentTimeMillis();

        if (assetBaseUrl == null || fileIndexUrl == null) throw new IncrementalFallbackException("增量安装缺少索引或资源根地址");

        boolean hasReusableLocalInstall = currentAssetsDir.isDirectory() && currentMetadataFile.exists();
        JSONObject localFiles = new JSONObject();
        if (hasReusableLocalInstall) {
            JSONObject localInstalledFilesIndex = GamePackageFs.readJsonFile(currentInstalledFilesIndexFile);
            localFiles = localInstalledFilesIndex == null ? null : localInstalledFilesIndex.optJSONObject("files");
            if (localFiles == null) throw new IncrementalFallbackException("本地已安装文件索引缺失");
        } else if (task.allowFullFallback) {
            throw new IncrementalFallbackException("本地未安装可复用资源");
        } else {
            logInfo("incremental-bootstrap-without-local gameId=" + gameId
                    + " version=" + resolvedPackageVersion
                    + " mode=file-index-only"
            );
        }

        emitInstallState(context, gameId, "manifest", null, "indeterminate", null, null, task.packageVersion, null, null);
        JSONObject remoteIndex = downloadJson(fileIndexUrl, task.fileIndexChecksum, cancelFlag);
        List<RemoteFileEntry> remoteEntries = parseRemoteFileIndex(remoteIndex);
        if (remoteEntries.isEmpty()) throw new IncrementalFallbackException("远端文件索引为空");

        List<RemoteFileEntry> changedEntries = hasReusableLocalInstall
            ? computeChangedEntries(currentAssetsDir, localFiles, remoteEntries)
            : new ArrayList<>(remoteEntries);
        Set<String> remotePaths = buildRemotePathSet(remoteEntries);
        addIncrementalPartPaths(remotePaths, changedEntries);
        logInfo("incremental-plan gameId=" + gameId
                + " version=" + resolvedPackageVersion
                + " totalFiles=" + remoteEntries.size()
                + " changedFiles=" + changedEntries.size()
                + " reusableLocalInstall=" + hasReusableLocalInstall
                + " allowFullFallback=" + task.allowFullFallback
        );

        File stagingDir = GamePackageFs.resolveVersionedStagingDir(context, gameId, resolvedPackageVersion);
        File stagingAssetsDir = GamePackageFs.resolveStagingAssetsDir(context, gameId, resolvedPackageVersion);
        try {
            GamePackageFs.cleanupStagingDirectories(context, gameId, resolvedPackageVersion);
            if (!stagingAssetsDir.mkdirs() && !stagingAssetsDir.exists()) throw new IOException("创建增量暂存目录失败");

            if (hasReusableLocalInstall) {
                GamePackageFs.copyDirectoryContents(currentAssetsDir, stagingAssetsDir);
            }
            GamePackageFs.pruneDirectoryContents(stagingAssetsDir, remotePaths);
            long totalBytes = 0L;
            for (RemoteFileEntry entry : changedEntries) totalBytes += Math.max(0L, entry.size);
            logInfo("incremental-download-start gameId=" + gameId
                    + " version=" + resolvedPackageVersion
                    + " changedFiles=" + changedEntries.size()
                    + " totalBytes=" + totalBytes
            );
            long downloadedBytes = estimateExistingIncrementalBytes(stagingAssetsDir, changedEntries);
            taskStore.updateRunningProgress(task.taskId, downloadedBytes, totalBytes, AndroidDownloadTaskRecord.STATUS_RUNNING, System.currentTimeMillis());
            emitIncrementalDownloadProgress(context, gameId, task.packageVersion, downloadedBytes, totalBytes);
            final long progressTotalBytes = totalBytes;

            for (RemoteFileEntry entry : changedEntries) {
                if (cancelFlag.get()) throw new IOException("安装已取消");
                File targetFile = resolveFileWithinRoot(stagingAssetsDir, entry.path);
                downloadedBytes -= estimateExistingIncrementalEntryBytes(targetFile, entry);
                if (downloadedBytes < 0L) downloadedBytes = 0L;
                final long completedBeforeEntry = downloadedBytes;
                downloadIncrementalFile(cancelFlag, assetBaseUrl, entry, targetFile, fileDownloadedBytes -> {
                    long currentDownloadedBytes = completedBeforeEntry + clampIncrementalEntryBytes(fileDownloadedBytes, entry);
                    taskStore.updateRunningProgress(task.taskId, currentDownloadedBytes, progressTotalBytes, AndroidDownloadTaskRecord.STATUS_RUNNING, System.currentTimeMillis());
                    emitIncrementalDownloadProgress(context, gameId, task.packageVersion, currentDownloadedBytes, progressTotalBytes);
                    onProgress.run();
                });
                downloadedBytes = completedBeforeEntry + clampIncrementalEntryBytes(targetFile.length(), entry);
                taskStore.updateRunningProgress(task.taskId, downloadedBytes, totalBytes, AndroidDownloadTaskRecord.STATUS_RUNNING, System.currentTimeMillis());
                emitIncrementalDownloadProgress(context, gameId, task.packageVersion, downloadedBytes, totalBytes);
                onProgress.run();
            }

            taskStore.markVerifying(task.taskId, System.currentTimeMillis());
            emitInstallState(context, gameId, "verifying", 100, "indeterminate", null, null, task.packageVersion, null, null);
            verifyMergedFiles(stagingAssetsDir, remoteEntries);

            JSONObject installedFilesIndex = buildInstalledFilesIndexFromRemote(remoteEntries, resolvedPackageVersion);
            GamePackageFs.writeJsonFile(GamePackageFs.resolveStagingInstalledFilesIndexFile(context, gameId, resolvedPackageVersion), installedFilesIndex);
            GamePackageFs.writeMetadata(GamePackageFs.resolveStagingMetadataFile(context, gameId, resolvedPackageVersion), gameId, safe(task.runtimeChannel, "stable"), safe(task.packageId, gameId), resolvedPackageVersion, installedAt);
            switchStagingToCurrent(context, gameId, resolvedPackageVersion, GamePackageFs.resolveCurrentDir(context, gameId), currentAssetsDir);

            taskStore.markCompleted(task.taskId, totalBytes, System.currentTimeMillis());
            logInfo("incremental-install-finished gameId=" + gameId
                    + " version=" + resolvedPackageVersion
                    + " downloadedBytes=" + totalBytes
            );
            emitInstallState(context, gameId, "installed", 100, "determinate", null, null, task.packageVersion, currentAssetsDir.getAbsolutePath(), installedAt);
            GamePackageFs.cleanupStagingDirectories(context, gameId, null);
            onProgress.run();
        } catch (Exception error) {
            logWarn("incremental-install failed-keep-staging gameId=" + gameId
                    + " version=" + resolvedPackageVersion
                    + " stagingDir=" + stagingDir.getAbsolutePath()
                    + " errorChain=" + summarizeThrowableChain(error),
                error
            );
            throw new IncrementalFallbackException(error.getMessage() != null ? error.getMessage() : "增量安装失败");
        }
    }

    private static void switchStagingToCurrent(
        Context context,
        String gameId,
        String packageVersion,
        File currentDir,
        File currentAssetsDir
    ) throws Exception {
        GamePackageFs.deleteRecursively(currentDir);
        if (!currentDir.mkdirs() && !currentDir.exists()) throw new IOException("创建安装目录失败");
        Files.move(GamePackageFs.resolveStagingAssetsDir(context, gameId, packageVersion).toPath(), currentAssetsDir.toPath(), StandardCopyOption.REPLACE_EXISTING);
        Files.move(GamePackageFs.resolveStagingMetadataFile(context, gameId, packageVersion).toPath(), GamePackageFs.resolveCurrentMetadataFile(context, gameId).toPath(), StandardCopyOption.REPLACE_EXISTING);
        Files.move(GamePackageFs.resolveStagingInstalledFilesIndexFile(context, gameId, packageVersion).toPath(), GamePackageFs.resolveCurrentInstalledFilesIndexFile(context, gameId).toPath(), StandardCopyOption.REPLACE_EXISTING);
    }

    private static JSONObject downloadJson(String urlValue, String expectedChecksum, AtomicBoolean cancelFlag) throws Exception {
        HttpURLConnection connection = (HttpURLConnection) new URL(urlValue).openConnection();
        connection.setConnectTimeout(15000);
        connection.setReadTimeout(30000);
        connection.setRequestProperty("Accept", "application/json");
        try {
            int responseCode = connection.getResponseCode();
            if (responseCode < 200 || responseCode >= 300) throw new IncrementalFallbackException("下载文件索引失败，HTTP " + responseCode);
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            StringBuilder builder = new StringBuilder();
            try (InputStream input = new BufferedInputStream(connection.getInputStream())) {
                byte[] buffer = new byte[BUFFER_SIZE];
                int read;
                while ((read = input.read(buffer)) != -1) {
                    if (cancelFlag.get()) throw new IOException("安装已取消");
                    digest.update(buffer, 0, read);
                    builder.append(new String(buffer, 0, read, StandardCharsets.UTF_8));
                }
            }
            String actualChecksum = bytesToHex(digest.digest());
            if (expectedChecksum != null && !expectedChecksum.equalsIgnoreCase(actualChecksum)) throw new IncrementalFallbackException("文件索引校验失败");
            return new JSONObject(builder.toString());
        } finally {
            connection.disconnect();
        }
    }

    private static List<RemoteFileEntry> parseRemoteFileIndex(JSONObject payload) throws Exception {
        JSONArray files = payload.optJSONArray("files");
        List<RemoteFileEntry> entries = new ArrayList<>();
        if (files == null) return entries;
        for (int index = 0; index < files.length(); index += 1) {
            JSONObject item = files.optJSONObject(index);
            if (item == null) continue;
            String path = GamePackageFs.normalizeNonEmpty(item.optString("path", null));
            String hash = GamePackageFs.normalizeNonEmpty(item.optString("hash", null));
            long size = item.optLong("size", 0L);
            if (path == null || hash == null) throw new IncrementalFallbackException("文件索引项不完整");
            entries.add(new RemoteFileEntry(path, hash, size));
        }
        return entries;
    }

    private static List<RemoteFileEntry> computeChangedEntries(File currentAssetsDir, JSONObject localFiles, List<RemoteFileEntry> remoteEntries) throws Exception {
        List<RemoteFileEntry> changedEntries = new ArrayList<>();
        for (RemoteFileEntry entry : remoteEntries) {
            String localHash = GamePackageFs.normalizeNonEmpty(localFiles.optString(entry.path, null));
            File localFile = resolveFileWithinRoot(currentAssetsDir, entry.path);
            if (!localFile.isFile() || !entry.hash.equalsIgnoreCase(localHash)) changedEntries.add(entry);
        }
        return changedEntries;
    }

    private static void downloadIncrementalFile(
        AtomicBoolean cancelFlag,
        String assetBaseUrl,
        RemoteFileEntry entry,
        File targetFile,
        IncrementalFileProgressListener progressListener
    ) throws Exception {
        File parent = targetFile.getParentFile();
        if (parent != null && !parent.exists() && !parent.mkdirs()) throw new IOException("创建目录失败");

        if (targetFile.isFile() && targetFile.length() == entry.size && isChecksumMatch(targetFile, entry.hash)) {
            logInfo("incremental-file already-complete path=" + entry.path + " bytes=" + targetFile.length());
            return;
        }

        File partFile = new File(targetFile.getAbsolutePath() + ".part");
        if (targetFile.exists() && !targetFile.delete()) throw new IOException("清理旧增量文件失败");

        Exception lastError = null;
        for (int attempt = 1; attempt <= DOWNLOAD_MAX_ATTEMPTS; attempt += 1) {
            try {
                downloadIncrementalFileOnce(cancelFlag, assetBaseUrl, entry, targetFile, partFile, attempt, progressListener);
                return;
            } catch (Exception error) {
                lastError = error;
                boolean recoverable = isRecoverableDownloadError(error);
                long partBytes = partFile.exists() ? partFile.length() : 0L;
                logWarn("incremental-file attempt-failed path=" + entry.path
                        + " attempt=" + attempt
                        + " maxAttempts=" + DOWNLOAD_MAX_ATTEMPTS
                        + " recoverable=" + recoverable
                        + " cancelRequested=" + cancelFlag.get()
                        + " partExists=" + partFile.exists()
                        + " partBytes=" + partBytes
                        + " expectedBytes=" + entry.size
                        + " errorChain=" + summarizeThrowableChain(error),
                    error
                );
                if (cancelFlag.get() || !recoverable || attempt >= DOWNLOAD_MAX_ATTEMPTS) {
                    throw error;
                }
                try {
                    Thread.sleep(1000L * attempt);
                } catch (InterruptedException interrupted) {
                    Thread.currentThread().interrupt();
                    throw interrupted;
                }
            }
        }

        throw lastError != null ? lastError : new IncrementalFallbackException("增量文件连续下载失败");
    }

    static void downloadIncrementalFileForTesting(
        AtomicBoolean cancelFlag,
        String assetBaseUrl,
        RemoteFileEntry entry,
        File targetFile
    ) throws Exception {
        downloadIncrementalFile(cancelFlag, assetBaseUrl, entry, targetFile, ignored -> {});
    }

    static void downloadArchiveForTesting(
        AtomicBoolean cancelFlag,
        String sourceUrl,
        String expectedChecksum,
        File targetFile,
        File partFile
    ) throws Exception {
        Exception lastError = null;
        for (int attempt = 1; attempt <= DOWNLOAD_MAX_ATTEMPTS; attempt += 1) {
            try {
                downloadArchiveFileOnce(
                    sourceUrl,
                    expectedChecksum,
                    "test-game",
                    "test-version",
                    targetFile,
                    partFile,
                    cancelFlag,
                    attempt,
                    (downloadedBytes, totalBytes, shouldEmitState) -> {}
                );
                return;
            } catch (Exception error) {
                lastError = error;
                boolean recoverable = isRecoverableDownloadError(error);
                if (cancelFlag.get() || !recoverable || attempt >= DOWNLOAD_MAX_ATTEMPTS) {
                    throw error;
                }
            }
        }
        if (lastError != null) {
            throw lastError;
        }
    }

    private static void downloadIncrementalFileOnce(
        AtomicBoolean cancelFlag,
        String assetBaseUrl,
        RemoteFileEntry entry,
        File targetFile,
        File partFile,
        int attempt,
        IncrementalFileProgressListener progressListener
    ) throws Exception {
        HttpURLConnection connection = (HttpURLConnection) new URL(buildRemoteAssetFileUrl(assetBaseUrl, entry)).openConnection();
        connection.setConnectTimeout(15000);
        connection.setReadTimeout(30000);
        long resumedBytes = partFile.exists() ? partFile.length() : 0L;
        if (resumedBytes > 0L) connection.setRequestProperty("Range", "bytes=" + resumedBytes + "-");
        logInfo("incremental-file start path=" + entry.path
                + " attempt=" + attempt
                + " resumedBytes=" + resumedBytes
                + " expectedBytes=" + entry.size
        );

        try {
            int responseCode = connection.getResponseCode();
            boolean appendMode = false;
            if (resumedBytes > 0L && responseCode == HttpURLConnection.HTTP_PARTIAL) {
                appendMode = true;
                logInfo("incremental-file resume-accepted path=" + entry.path + " resumedBytes=" + resumedBytes);
            } else if (resumedBytes > 0L && responseCode == HttpURLConnection.HTTP_OK) {
                logWarn("incremental-file resume-reset path=" + entry.path + " resumedBytes=" + resumedBytes);
                if (!partFile.delete() && partFile.exists()) throw new IOException("重置增量续传文件失败");
                resumedBytes = 0L;
            } else if (resumedBytes > 0L && responseCode == HTTP_RANGE_NOT_SATISFIABLE) {
                logWarn("incremental-file resume-range-not-satisfiable path=" + entry.path + " resumedBytes=" + resumedBytes);
                if (handleRangeNotSatisfiablePartialDownload(
                    partFile,
                    targetFile,
                    entry.hash,
                    entry.size,
                    "清理旧增量文件失败",
                    "恢复已完成增量文件失败",
                    "重置不可续传增量文件失败",
                    "服务端拒绝增量续传，本地临时文件已清理，将从头重试: " + entry.path
                )) {
                    return;
                }
            }

            logInfo("incremental-file response path=" + entry.path
                    + " attempt=" + attempt
                    + " code=" + responseCode
                    + " contentLength=" + connection.getContentLengthLong()
                    + " contentRange=" + connection.getHeaderField("Content-Range")
                    + " resumedBytes=" + resumedBytes
                    + " appendMode=" + appendMode
            );
            if (responseCode < 200 || responseCode >= 300) throw new IOException("增量文件下载失败，HTTP " + responseCode);

            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            if (appendMode) {
                try (InputStream existingInput = new BufferedInputStream(new FileInputStream(partFile))) {
                    byte[] existingBuffer = new byte[BUFFER_SIZE];
                    int existingRead;
                    while ((existingRead = existingInput.read(existingBuffer)) != -1) digest.update(existingBuffer, 0, existingRead);
                }
            }

            try (
                InputStream input = new BufferedInputStream(connection.getInputStream());
                BufferedOutputStream output = new BufferedOutputStream(new FileOutputStream(partFile, appendMode))
            ) {
                byte[] buffer = new byte[BUFFER_SIZE];
                int read;
                long downloadedBytes = resumedBytes;
                int lastPercent = entry.size > 0L
                    ? (int) Math.max(0, Math.min(100, Math.round((downloadedBytes * 100f) / entry.size)))
                    : -1;
                progressListener.onProgress(downloadedBytes);
                while ((read = input.read(buffer)) != -1) {
                    if (cancelFlag.get()) throw new IOException("安装已取消");
                    output.write(buffer, 0, read);
                    digest.update(buffer, 0, read);
                    downloadedBytes += read;
                    if (entry.size > 0L) {
                        int percent = (int) Math.max(0, Math.min(100, Math.round((downloadedBytes * 100f) / entry.size)));
                        if (percent != lastPercent) {
                            lastPercent = percent;
                            progressListener.onProgress(downloadedBytes);
                        }
                    } else {
                        progressListener.onProgress(downloadedBytes);
                    }
                }
            }

            String actualChecksum = bytesToHex(digest.digest());
            verifyDownloadedIncrementalPart(partFile, entry, actualChecksum);
            if (targetFile.exists() && !targetFile.delete()) throw new IOException("清理旧增量文件失败");
            if (!partFile.renameTo(targetFile)) throw new IOException("写入增量文件失败");
            progressListener.onProgress(targetFile.length());
            logInfo("incremental-file finished path=" + entry.path
                    + " attempt=" + attempt
                    + " bytes=" + targetFile.length()
                    + " checksumOk=true"
            );
        } finally {
            connection.disconnect();
        }
    }

    static void verifyDownloadedIncrementalPart(File partFile, RemoteFileEntry entry, String actualChecksum) throws Exception {
        if (!entry.hash.equalsIgnoreCase(actualChecksum)) {
            discardInvalidIncrementalPart(partFile, "增量文件校验失败", entry);
            throw new IncrementalRetryableDownloadException("增量文件校验失败: " + entry.path);
        }
        if (entry.size > 0L && partFile.length() != entry.size) {
            discardInvalidIncrementalPart(partFile, "增量文件大小不符", entry);
            throw new IncrementalRetryableDownloadException("增量文件大小不符: " + entry.path);
        }
    }

    static boolean handleRangeNotSatisfiablePartialDownload(
        File partFile,
        File targetFile,
        String expectedChecksum,
        long expectedBytes,
        String cleanupOldTargetMessage,
        String restoreMessage,
        String resetPartialMessage,
        String retryMessage
    ) throws Exception {
        boolean sizeMatches = expectedBytes <= 0L || partFile.length() == expectedBytes;
        if (sizeMatches && isChecksumMatch(partFile, expectedChecksum)) {
            if (targetFile.exists() && !targetFile.delete()) throw new IOException(cleanupOldTargetMessage);
            if (!partFile.renameTo(targetFile)) throw new IOException(restoreMessage);
            return true;
        }

        if (!partFile.delete() && partFile.exists()) throw new IOException(resetPartialMessage);
        throw new IncrementalRetryableDownloadException(retryMessage);
    }

    private static void discardInvalidIncrementalPart(File partFile, String reason, RemoteFileEntry entry) throws IOException {
        if (partFile.exists() && !partFile.delete()) {
            throw new IOException(reason + "，且清理临时文件失败: " + entry.path);
        }
    }

    private static long estimateExistingIncrementalBytes(File stagingAssetsDir, List<RemoteFileEntry> changedEntries) throws Exception {
        long bytes = 0L;
        for (RemoteFileEntry entry : changedEntries) {
            File targetFile = resolveFileWithinRoot(stagingAssetsDir, entry.path);
            bytes += estimateExistingIncrementalEntryBytes(targetFile, entry);
        }
        return bytes;
    }

    private static long estimateExistingIncrementalEntryBytes(File targetFile, RemoteFileEntry entry) throws Exception {
        File partFile = new File(targetFile.getAbsolutePath() + ".part");
        long bytes = partFile.isFile() ? partFile.length() : 0L;
        if (bytes <= 0L && targetFile.isFile() && targetFile.length() == entry.size && isChecksumMatch(targetFile, entry.hash)) {
            bytes = targetFile.length();
        }
        return clampIncrementalEntryBytes(bytes, entry);
    }

    private static long clampIncrementalEntryBytes(long bytes, RemoteFileEntry entry) {
        if (entry.size > 0L) return Math.max(0L, Math.min(bytes, entry.size));
        return Math.max(0L, bytes);
    }

    private static void emitIncrementalDownloadProgress(
        Context context,
        String gameId,
        String packageVersion,
        long downloadedBytes,
        long totalBytes
    ) {
        if (totalBytes > 0L) {
            int percent = (int) Math.max(0, Math.min(100, Math.round((downloadedBytes * 100f) / totalBytes)));
            emitInstallState(context, gameId, "downloading", percent, "determinate", null, null, packageVersion, null, null);
        } else {
            emitInstallState(context, gameId, "downloading", null, "indeterminate", null, null, packageVersion, null, null);
        }
    }

    private static void verifyMergedFiles(File stagingAssetsDir, List<RemoteFileEntry> remoteEntries) throws Exception {
        for (RemoteFileEntry entry : remoteEntries) {
            File file = resolveFileWithinRoot(stagingAssetsDir, entry.path);
            if (!file.isFile()) throw new IncrementalFallbackException("增量合并后缺少文件: " + entry.path);
            String actualHash = GamePackageFs.hashFile(file);
            if (!entry.hash.equalsIgnoreCase(actualHash)) throw new IncrementalFallbackException("增量合并后校验失败: " + entry.path);
        }
    }

    private static JSONObject buildInstalledFilesIndexFromRemote(List<RemoteFileEntry> remoteEntries, String assetPackVersion) throws Exception {
        JSONObject files = new JSONObject();
        for (RemoteFileEntry entry : remoteEntries) files.put(entry.path, entry.hash);
        JSONObject payload = new JSONObject();
        payload.put("assetPackVersion", assetPackVersion);
        payload.put("files", files);
        payload.put("updatedAt", System.currentTimeMillis());
        return payload;
    }

    private static Set<String> buildRemotePathSet(List<RemoteFileEntry> remoteEntries) {
        Set<String> paths = new HashSet<>();
        for (RemoteFileEntry entry : remoteEntries) {
            paths.add(entry.path);
        }
        return paths;
    }

    private static void addIncrementalPartPaths(Set<String> remotePaths, List<RemoteFileEntry> changedEntries) {
        for (RemoteFileEntry entry : changedEntries) {
            remotePaths.add(entry.path + ".part");
        }
    }

    private static String buildRemoteAssetFileUrl(String assetBaseUrl, RemoteFileEntry entry) {
        String normalizedBase = assetBaseUrl.replaceAll("/+$", "");
        String[] segments = entry.path.replace('\\', '/').split("/");
        StringBuilder builder = new StringBuilder(normalizedBase);
        for (String segment : segments) {
            if (segment == null || segment.isEmpty()) continue;
            builder.append('/').append(encodeUriComponent(segment));
        }
        builder.append("?v=").append(encodeUriComponent(entry.hash));
        return builder.toString();
    }

    private static File resolveFileWithinRoot(File rootDir, String relativePath) throws Exception {
        File targetFile = new File(rootDir, relativePath.replace('/', File.separatorChar));
        String canonicalRootPath = rootDir.getCanonicalPath();
        String canonicalTargetPath = targetFile.getCanonicalPath();
        if (!canonicalTargetPath.startsWith(canonicalRootPath + File.separator) && !canonicalTargetPath.equals(canonicalRootPath)) {
            throw new IOException("非法文件路径: " + relativePath);
        }
        return targetFile;
    }

    private static void downloadArchive(
        Context context,
        AndroidDownloadTaskStore taskStore,
        AndroidDownloadTaskRecord task,
        File targetFile,
        File partFile,
        AtomicBoolean cancelFlag,
        Runnable onProgress
    ) throws Exception {
        if (targetFile.exists() && isChecksumMatch(targetFile, task.checksum)) {
            taskStore.updateRunningProgress(task.taskId, targetFile.length(), targetFile.length(), AndroidDownloadTaskRecord.STATUS_RUNNING, System.currentTimeMillis());
            emitInstallState(context, task.logicalId, "downloading", 100, "determinate", null, null, task.packageVersion, null, null);
            return;
        }

        Exception lastError = null;
        for (int attempt = 1; attempt <= DOWNLOAD_MAX_ATTEMPTS; attempt += 1) {
            try {
                downloadArchiveOnce(context, taskStore, task, targetFile, partFile, cancelFlag, onProgress, attempt);
                return;
            } catch (Exception error) {
                lastError = error;
                boolean recoverable = isRecoverableDownloadError(error);
                long partBytes = partFile.exists() ? partFile.length() : 0L;
                logWarn("downloadArchive attempt-failed gameId=" + task.logicalId
                        + " version=" + task.packageVersion
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
                logWarn("downloadArchive retry gameId=" + task.logicalId
                        + " version=" + task.packageVersion
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

    private static void downloadArchiveOnce(
        Context context,
        AndroidDownloadTaskStore taskStore,
        AndroidDownloadTaskRecord task,
        File targetFile,
        File partFile,
        AtomicBoolean cancelFlag,
        Runnable onProgress,
        int attempt
    ) throws Exception {
        downloadArchiveFileOnce(
            task.sourceUrl,
            task.checksum,
            task.logicalId,
            task.packageVersion,
            targetFile,
            partFile,
            cancelFlag,
            attempt,
            (downloadedBytes, totalBytes, shouldEmitState) -> {
                taskStore.updateRunningProgress(task.taskId, downloadedBytes, totalBytes, AndroidDownloadTaskRecord.STATUS_RUNNING, System.currentTimeMillis());
                if (!shouldEmitState) {
                    return;
                }
                if (totalBytes > 0) {
                    int percent = (int) Math.max(0, Math.min(100, Math.round((downloadedBytes * 100f) / totalBytes)));
                    emitInstallState(context, task.logicalId, "downloading", percent, "determinate", null, null, task.packageVersion, null, null);
                } else {
                    emitInstallState(context, task.logicalId, "downloading", null, "indeterminate", null, null, task.packageVersion, null, null);
                }
                onProgress.run();
            }
        );
    }

    private interface ArchiveFileProgressListener {
        void onProgress(long downloadedBytes, long totalBytes, boolean shouldEmitState) throws Exception;
    }

    private static void downloadArchiveFileOnce(
        String sourceUrl,
        String expectedChecksum,
        String gameId,
        String packageVersion,
        File targetFile,
        File partFile,
        AtomicBoolean cancelFlag,
        int attempt,
        ArchiveFileProgressListener progressListener
    ) throws Exception {
        HttpURLConnection connection = (HttpURLConnection) new URL(sourceUrl).openConnection();
        connection.setConnectTimeout(15000);
        connection.setReadTimeout(30000);
        connection.setRequestProperty("Accept", "application/zip,application/octet-stream");
        long resumedBytes = partFile.exists() ? partFile.length() : 0L;
        if (resumedBytes > 0) connection.setRequestProperty("Range", "bytes=" + resumedBytes + "-");
        logInfo("downloadArchive start gameId=" + gameId
                + " version=" + packageVersion
                + " attempt=" + attempt
                + " url=" + sourceUrl
                + " resumedBytes=" + resumedBytes
                + " partExists=" + partFile.exists()
        );

        try {
            int responseCode = connection.getResponseCode();
            boolean appendMode = false;
            if (resumedBytes > 0 && responseCode == HttpURLConnection.HTTP_PARTIAL) {
                appendMode = true;
                logInfo("downloadArchive resume-accepted gameId=" + gameId + " resumedBytes=" + resumedBytes);
            } else if (resumedBytes > 0 && responseCode == HttpURLConnection.HTTP_OK) {
                logWarn("downloadArchive resume-reset gameId=" + gameId + " resumedBytes=" + resumedBytes);
                if (!partFile.delete() && partFile.exists()) throw new IOException("重置续传文件失败");
                resumedBytes = 0L;
            } else if (resumedBytes > 0 && responseCode == HTTP_RANGE_NOT_SATISFIABLE) {
                logWarn("downloadArchive resume-range-not-satisfiable gameId=" + gameId + " resumedBytes=" + resumedBytes);
                if (handleRangeNotSatisfiablePartialDownload(
                    partFile,
                    targetFile,
                    expectedChecksum,
                    0L,
                    "清理旧安装包失败",
                    "恢复已完成资源包失败",
                    "重置不可续传文件失败",
                    "服务端拒绝续传，本地临时资源包已清理，将从头重试"
                )) {
                    progressListener.onProgress(targetFile.length(), targetFile.length(), true);
                    return;
                }
            }
            logInfo("downloadArchive response gameId=" + gameId
                    + " version=" + packageVersion
                    + " attempt=" + attempt
                    + " code=" + responseCode
                    + " contentLength=" + connection.getContentLengthLong()
                    + " contentRange=" + connection.getHeaderField("Content-Range")
                    + " resumedBytes=" + resumedBytes
                    + " appendMode=" + appendMode
            );
            if (responseCode < 200 || responseCode >= 300) throw new IOException("下载失败，HTTP " + responseCode);

            long totalBytes = resolveTotalBytes(connection, resumedBytes, responseCode);
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            if (appendMode) {
                try (InputStream existingInput = new BufferedInputStream(new FileInputStream(partFile))) {
                    byte[] existingBuffer = new byte[BUFFER_SIZE];
                    int existingRead;
                    while ((existingRead = existingInput.read(existingBuffer)) != -1) digest.update(existingBuffer, 0, existingRead);
                }
            }

            long downloadedBytes = resumedBytes;
            int lastPercent = -1;
            try (
                InputStream rawInput = new BufferedInputStream(connection.getInputStream());
                BufferedOutputStream output = new BufferedOutputStream(new FileOutputStream(partFile, appendMode))
            ) {
                byte[] buffer = new byte[BUFFER_SIZE];
                int read;
                while ((read = rawInput.read(buffer)) != -1) {
                    if (cancelFlag.get()) throw new IOException("安装已取消");
                    output.write(buffer, 0, read);
                    digest.update(buffer, 0, read);
                    downloadedBytes += read;
                    boolean shouldEmitState = true;
                    if (totalBytes > 0) {
                        int percent = (int) Math.max(0, Math.min(100, Math.round((downloadedBytes * 100f) / totalBytes)));
                        if (percent == lastPercent) {
                            shouldEmitState = false;
                        } else {
                            lastPercent = percent;
                        }
                    }
                    progressListener.onProgress(downloadedBytes, totalBytes, shouldEmitState);
                }
            }

            String actualChecksum = bytesToHex(digest.digest());
            if (expectedChecksum != null && !expectedChecksum.equalsIgnoreCase(actualChecksum)) {
                discardInvalidArchivePart(partFile, "下载包校验失败");
                throw new RetryableDownloadException("下载包校验失败，本地临时资源包已清理，将从头重试");
            }
            if (targetFile.exists() && !targetFile.delete()) throw new IOException("清理旧安装包失败");
            if (!partFile.renameTo(targetFile)) throw new IOException("写入安装包失败");
            logInfo("downloadArchive finished gameId=" + gameId
                    + " version=" + packageVersion
                    + " attempt=" + attempt
                    + " checksumOk=" + (expectedChecksum == null || expectedChecksum.equalsIgnoreCase(actualChecksum))
                    + " actualChecksum=" + actualChecksum
            );
        } finally {
            connection.disconnect();
        }
    }

    private static void discardInvalidArchivePart(File partFile, String reason) throws IOException {
        if (partFile.exists() && !partFile.delete()) {
            throw new IOException(reason + "，且清理临时资源包失败");
        }
    }

    private static void emitInstallState(
        Context context,
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
        try {
            JSONObject payload = new JSONObject();
            payload.put("gameId", gameId);
            payload.put("status", status);
            if (progressPercent != null) payload.put("progressPercent", progressPercent.intValue());
            if (progressMode != null) payload.put("progressMode", progressMode);
            if (errorCode != null && !errorCode.isEmpty()) payload.put("errorCode", errorCode);
            if (errorMessage != null && !errorMessage.isEmpty()) payload.put("errorMessage", errorMessage);
            if (assetPackVersion != null && !assetPackVersion.isEmpty()) payload.put("assetPackVersion", assetPackVersion);
            if (assetRootPath != null && !assetRootPath.isEmpty()) payload.put("assetRootPath", assetRootPath);
            if (installedAt != null) payload.put("installedAt", installedAt.longValue());
            payload.put("updatedAt", System.currentTimeMillis());
            persistInstallState(context, gameId, payload);
            GamePackageInstallEventHub.dispatch(payload);
        } catch (Exception error) {
            logWarn("emitInstallState failed gameId=" + gameId, error);
        }
    }

    private static void persistInstallState(Context context, String gameId, JSONObject payload) throws IOException {
        GamePackageFs.writeJsonFile(GamePackageFs.resolveStateFile(context, gameId), payload);
    }

    private static void extractArchive(File archiveFile, File outputDir, AtomicBoolean cancelFlag) throws IOException {
        String outputRoot = outputDir.getCanonicalPath();
        try (ZipInputStream zipInputStream = new ZipInputStream(new BufferedInputStream(new FileInputStream(archiveFile)))) {
            ZipEntry entry;
            while ((entry = zipInputStream.getNextEntry()) != null) {
                if (cancelFlag.get()) throw new IOException("安装已取消");
                File targetFile = new File(outputDir, entry.getName());
                String canonicalTargetPath = targetFile.getCanonicalPath();
                if (!canonicalTargetPath.startsWith(outputRoot + File.separator) && !canonicalTargetPath.equals(outputRoot)) throw new IOException("压缩包路径非法: " + entry.getName());
                if (entry.isDirectory()) {
                    if (!targetFile.mkdirs() && !targetFile.exists()) throw new IOException("创建目录失败: " + targetFile.getAbsolutePath());
                    continue;
                }
                File parent = targetFile.getParentFile();
                if (parent != null && !parent.mkdirs() && !parent.exists()) throw new IOException("创建目录失败: " + parent.getAbsolutePath());
                try (BufferedOutputStream output = new BufferedOutputStream(new FileOutputStream(targetFile))) {
                    byte[] buffer = new byte[BUFFER_SIZE];
                    int read;
                    while ((read = zipInputStream.read(buffer)) != -1) {
                        if (cancelFlag.get()) throw new IOException("安装已取消");
                        output.write(buffer, 0, read);
                    }
                }
            }
        }
    }

    private static long resolveTotalBytes(HttpURLConnection connection, long resumedBytes, int responseCode) {
        long contentLength = connection.getContentLengthLong();
        if (responseCode != HttpURLConnection.HTTP_PARTIAL) return contentLength;
        String contentRange = connection.getHeaderField("Content-Range");
        if (contentRange != null) {
            int slashIndex = contentRange.lastIndexOf('/');
            if (slashIndex >= 0 && slashIndex + 1 < contentRange.length()) {
                try {
                    long parsed = Long.parseLong(contentRange.substring(slashIndex + 1).trim());
                    if (parsed > 0) return parsed;
                } catch (NumberFormatException ignored) {}
            }
        }
        return contentLength > 0 ? resumedBytes + contentLength : contentLength;
    }

    private static boolean isChecksumMatch(File file, String checksum) throws Exception {
        if (!file.exists()) return false;
        if (checksum == null || checksum.isEmpty()) return true;
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        try (InputStream inputStream = new BufferedInputStream(new FileInputStream(file))) {
            byte[] buffer = new byte[BUFFER_SIZE];
            int read;
            while ((read = inputStream.read(buffer)) != -1) digest.update(buffer, 0, read);
        }
        return checksum.equalsIgnoreCase(bytesToHex(digest.digest()));
    }

    private static String bytesToHex(byte[] bytes) {
        StringBuilder builder = new StringBuilder(bytes.length * 2);
        for (byte value : bytes) builder.append(String.format("%02x", value));
        return builder.toString();
    }

    static String classifyInstallErrorCode(Exception error) {
        if (error == null) return "unknown";
        if (hasCause(error, ZipException.class)) return "archive-invalid";
        String message = collectThrowableMessages(error);
        String lower = message.toLowerCase(Locale.ROOT);
        if (lower.contains("http ")) return "http-error";
        if (message.contains("续传")) return "resume-not-supported";
        if (message.contains("校验")) return "checksum-mismatch";
        if (lower.contains("enospc") || lower.contains("no space left") || message.contains("空间不足")) return "insufficient-storage";
        if (message.contains("取消")) return "cancelled";
        if (message.contains("压缩包") || message.contains("路径非法")) return "archive-invalid";
        if (isRecoverableDownloadError(error)) return "network-timeout";
        if (error instanceof IOException) return "file-io";
        return "unknown";
    }

    static boolean isRecoverableDownloadError(Throwable error) {
        Throwable current = error;
        while (current != null) {
            if (
                current instanceof SocketTimeoutException
                    || current instanceof ProtocolException
                    || current instanceof SocketException
                    || current instanceof RetryableDownloadException
                    || current instanceof IncrementalRetryableDownloadException
            ) {
                return true;
            }

            String message = current.getMessage();
            if (message != null) {
                String lowerMessage = message.toLowerCase(Locale.ROOT);
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

    private static boolean hasCause(Throwable error, Class<?> errorClass) {
        Throwable current = error;
        while (current != null) {
            if (errorClass.isInstance(current)) return true;
            current = current.getCause();
        }
        return false;
    }

    private static String collectThrowableMessages(Throwable error) {
        if (error == null) return "";
        StringBuilder builder = new StringBuilder();
        Throwable current = error;
        int depth = 0;
        while (current != null && depth < 8) {
            String message = current.getMessage();
            if (message != null && !message.trim().isEmpty()) {
                if (builder.length() > 0) builder.append(" <- ");
                builder.append(message.trim());
            }
            current = current.getCause();
            depth += 1;
        }
        return builder.toString();
    }

    private static String summarizeThrowableChain(Throwable error) {
        if (error == null) return "none";
        StringBuilder builder = new StringBuilder();
        Throwable current = error;
        int depth = 0;
        while (current != null && depth < 8) {
            if (depth > 0) builder.append(" <- ");
            builder.append(current.getClass().getName());
            String message = current.getMessage();
            if (message != null && !message.trim().isEmpty()) {
                builder.append(": ").append(message.trim());
            }
            current = current.getCause();
            depth += 1;
        }
        if (current != null) builder.append(" <- ...");
        return builder.toString();
    }

    private static void logInfo(String message) {
        try {
            Log.i(TAG, message);
        } catch (RuntimeException error) {
            if (!isAndroidLogNotMocked(error)) throw error;
        }
    }

    private static void logWarn(String message) {
        try {
            Log.w(TAG, message);
        } catch (RuntimeException error) {
            if (!isAndroidLogNotMocked(error)) throw error;
        }
    }

    private static void logWarn(String message, Throwable error) {
        try {
            Log.w(TAG, message, error);
        } catch (RuntimeException logError) {
            if (!isAndroidLogNotMocked(logError)) throw logError;
        }
    }

    private static void logError(String message, Throwable error) {
        try {
            Log.e(TAG, message, error);
        } catch (RuntimeException logError) {
            if (!isAndroidLogNotMocked(logError)) throw logError;
        }
    }

    private static boolean isAndroidLogNotMocked(RuntimeException error) {
        String message = error.getMessage();
        return message != null && message.contains("not mocked");
    }

    private static String encodeUriComponent(String value) {
        try {
            return Uri.encode(value);
        } catch (RuntimeException error) {
            if (!isAndroidLogNotMocked(error)) throw error;
        }

        try {
            return URLEncoder.encode(value, StandardCharsets.UTF_8.name()).replace("+", "%20");
        } catch (Exception error) {
            throw new IllegalStateException("URL 编码失败", error);
        }
    }

    private static String safe(String value, String fallback) {
        return value == null || value.trim().isEmpty() ? fallback : value.trim();
    }
}
