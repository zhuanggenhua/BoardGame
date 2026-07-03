package top.easyboardgame.app;

import android.content.Context;
import android.util.Log;
import java.io.BufferedReader;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.StandardCopyOption;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.UUID;
import org.json.JSONArray;
import org.json.JSONObject;

final class AndroidDownloadTaskStore {

    private static final String TAG = "AndroidDownloadStore";
    private static final String ROOT_DIR = "android-download-runtime";
    private static final String REGISTRY_FILE = "task-registry.json";

    private final Context appContext;
    private final Object lock = new Object();

    AndroidDownloadTaskStore(Context context) {
        this.appContext = context.getApplicationContext();
    }

    boolean hasUnfinishedTasks() {
        synchronized (lock) {
            for (AndroidDownloadTaskRecord record : readAllLocked()) {
                if (!record.isTerminal()) {
                    return true;
                }
            }
            return false;
        }
    }

    List<AndroidDownloadTaskRecord> readAll() {
        synchronized (lock) {
            return readAllLocked();
        }
    }

    AndroidDownloadTaskRecord enqueueOrReuse(
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
        String destinationPath,
        String partialPath
    ) {
        synchronized (lock) {
            long now = System.currentTimeMillis();
            List<AndroidDownloadTaskRecord> records = readAllLocked();
            for (AndroidDownloadTaskRecord record : records) {
                if (record.matchesTarget(kind, logicalId) && !record.isTerminal()) {
                    Log.i(TAG, "enqueueOrReuse reuse taskId=" + record.taskId + " status=" + record.status);
                    return record;
                }
            }

            AndroidDownloadTaskRecord record = AndroidDownloadTaskRecord.create(
                UUID.randomUUID().toString(),
                kind,
                logicalId,
                displayName,
                runtimeChannel,
                packageId,
                packageVersion,
                sourceUrl,
                checksum,
                installMode,
                assetBaseUrl,
                fileIndexUrl,
                fileIndexChecksum,
                destinationPath,
                partialPath,
                now
            );
            records.add(record);

            if (!hasActiveTask(records)) {
                record.markRunning(now);
            }

            writeAllLocked(records);
            Log.i(TAG, "enqueueOrReuse created taskId=" + record.taskId + " status=" + record.status + " logicalId=" + logicalId);
            return record;
        }
    }

    AndroidDownloadTaskRecord cancelTask(String taskId) {
        synchronized (lock) {
            long now = System.currentTimeMillis();
            List<AndroidDownloadTaskRecord> records = readAllLocked();
            AndroidDownloadTaskRecord cancelled = null;
            boolean wasActive = false;
            for (AndroidDownloadTaskRecord record : records) {
                if (!safeEquals(record.taskId, taskId)) {
                    continue;
                }
                wasActive = record.isActive();
                record.markCancelled(now);
                cancelled = record;
                break;
            }

            if (cancelled != null && wasActive) {
                promoteNextQueuedLocked(records, now);
            }

            writeAllLocked(records);
            return cancelled;
        }
    }

    AndroidDownloadTaskRecord getActiveTask() {
        synchronized (lock) {
            List<AndroidDownloadTaskRecord> records = readAllLocked();
            for (AndroidDownloadTaskRecord record : records) {
                if (record.isActive()) {
                    return record;
                }
            }
            return null;
        }
    }

    AndroidDownloadTaskRecord getByTaskId(String taskId) {
        synchronized (lock) {
            for (AndroidDownloadTaskRecord record : readAllLocked()) {
                if (safeEquals(record.taskId, taskId)) {
                    return record;
                }
            }
            return null;
        }
    }

    AndroidDownloadTaskRecord getLatestByTarget(String kind, String logicalId) {
        synchronized (lock) {
            AndroidDownloadTaskRecord latest = null;
            for (AndroidDownloadTaskRecord record : readAllLocked()) {
                if (!record.matchesTarget(kind, logicalId)) {
                    continue;
                }
                if (latest == null || record.updatedAt > latest.updatedAt) {
                    latest = record;
                }
            }
            return latest;
        }
    }

    boolean hasActiveTaskForTarget(String kind, String logicalId) {
        synchronized (lock) {
            for (AndroidDownloadTaskRecord record : readAllLocked()) {
                if (record.matchesTarget(kind, logicalId) && record.isActive()) {
                    return true;
                }
            }
            return false;
        }
    }

    int countQueuedTasks() {
        synchronized (lock) {
            int count = 0;
            for (AndroidDownloadTaskRecord record : readAllLocked()) {
                if (AndroidDownloadTaskRecord.STATUS_QUEUED.equals(record.status)) {
                    count += 1;
                }
            }
            return count;
        }
    }

    void reconcileTransientTasks() {
        synchronized (lock) {
            long now = System.currentTimeMillis();
            List<AndroidDownloadTaskRecord> records = readAllLocked();
            boolean changed = false;
            for (AndroidDownloadTaskRecord record : records) {
                if (!record.isActive()) {
                    continue;
                }
                record.markQueued(now);
                changed = true;
            }

            if (changed) {
                promoteNextQueuedLocked(records, now);
                writeAllLocked(records);
            }
        }
    }

    AndroidDownloadTaskRecord updateRunningProgress(
        String taskId,
        long downloadedBytes,
        long totalBytes,
        String status,
        long now
    ) {
        synchronized (lock) {
            List<AndroidDownloadTaskRecord> records = readAllLocked();
            AndroidDownloadTaskRecord updated = null;
            for (AndroidDownloadTaskRecord record : records) {
                if (!safeEquals(record.taskId, taskId)) {
                    continue;
                }
                record.status = status;
                record.downloadedBytes = downloadedBytes;
                record.totalBytes = totalBytes;
                record.updatedAt = now;
                updated = record;
                break;
            }
            writeAllLocked(records);
            return updated;
        }
    }

    AndroidDownloadTaskRecord markVerifying(String taskId, long now) {
        synchronized (lock) {
            List<AndroidDownloadTaskRecord> records = readAllLocked();
            AndroidDownloadTaskRecord updated = null;
            for (AndroidDownloadTaskRecord record : records) {
                if (!safeEquals(record.taskId, taskId)) {
                    continue;
                }
                record.status = AndroidDownloadTaskRecord.STATUS_VERIFYING;
                record.updatedAt = now;
                updated = record;
                break;
            }
            writeAllLocked(records);
            return updated;
        }
    }

    AndroidDownloadTaskRecord markCompleted(String taskId, long totalBytes, long now) {
        synchronized (lock) {
            List<AndroidDownloadTaskRecord> records = readAllLocked();
            AndroidDownloadTaskRecord updated = null;
            for (AndroidDownloadTaskRecord record : records) {
                if (!safeEquals(record.taskId, taskId)) {
                    continue;
                }
                record.status = AndroidDownloadTaskRecord.STATUS_COMPLETED;
                record.downloadedBytes = totalBytes;
                record.totalBytes = totalBytes;
                record.errorCode = null;
                record.errorMessage = null;
                record.updatedAt = now;
                updated = record;
                break;
            }
            promoteNextQueuedLocked(records, now);
            writeAllLocked(records);
            return updated;
        }
    }

    AndroidDownloadTaskRecord markFailed(String taskId, String errorCode, String errorMessage, long now) {
        synchronized (lock) {
            List<AndroidDownloadTaskRecord> records = readAllLocked();
            AndroidDownloadTaskRecord updated = null;
            for (AndroidDownloadTaskRecord record : records) {
                if (!safeEquals(record.taskId, taskId)) {
                    continue;
                }
                record.status = AndroidDownloadTaskRecord.STATUS_FAILED;
                record.errorCode = errorCode;
                record.errorMessage = errorMessage;
                record.updatedAt = now;
                updated = record;
                break;
            }
            promoteNextQueuedLocked(records, now);
            writeAllLocked(records);
            return updated;
        }
    }

    private List<AndroidDownloadTaskRecord> readAllLocked() {
        List<AndroidDownloadTaskRecord> records = new ArrayList<>();
        File registryFile = resolveRegistryFile();
        if (!registryFile.exists()) {
            return records;
        }

        try {
            String rawText = readText(registryFile);
            if (rawText.trim().isEmpty()) {
                Log.w(TAG, "readAllLocked ignored empty registry file path=" + registryFile.getAbsolutePath());
                return records;
            }
            JSONObject root = new JSONObject(rawText);
            JSONArray tasks = root.optJSONArray("tasks");
            if (tasks == null) {
                return records;
            }
            for (int index = 0; index < tasks.length(); index += 1) {
                JSONObject payload = tasks.optJSONObject(index);
                if (payload == null) {
                    continue;
                }
                records.add(AndroidDownloadTaskRecord.fromJson(payload));
            }
        } catch (Exception error) {
            Log.w(TAG, "readAllLocked failed", error);
        }
        return records;
    }

    private void writeAllLocked(List<AndroidDownloadTaskRecord> records) {
        try {
            File registryFile = resolveRegistryFile();
            File parent = registryFile.getParentFile();
            if (parent != null && !parent.exists() && !parent.mkdirs()) {
                throw new IOException("创建下载注册表目录失败");
            }

            JSONArray tasks = new JSONArray();
            for (AndroidDownloadTaskRecord record : records) {
                tasks.put(record.toJson());
            }

            JSONObject root = new JSONObject();
            root.put("tasks", tasks);
            writeTextAtomically(registryFile, root.toString(2) + "\n");
        } catch (Exception error) {
            Log.w(TAG, "writeAllLocked failed", error);
        }
    }

    private void writeTextAtomically(File targetFile, String text) throws IOException {
        File parent = targetFile.getParentFile();
        if (parent != null && !parent.exists() && !parent.mkdirs()) {
            throw new IOException("创建下载注册表目录失败");
        }

        File tempFile = new File(targetFile.getAbsolutePath() + ".tmp");
        try (FileOutputStream output = new FileOutputStream(tempFile)) {
            output.write(text.getBytes(StandardCharsets.UTF_8));
            output.getFD().sync();
        }
        Files.move(
            tempFile.toPath(),
            targetFile.toPath(),
            StandardCopyOption.REPLACE_EXISTING,
            StandardCopyOption.ATOMIC_MOVE
        );
    }

    private void promoteNextQueuedLocked(List<AndroidDownloadTaskRecord> records, long now) {
        if (hasActiveTask(records)) {
            return;
        }
        for (AndroidDownloadTaskRecord record : records) {
            if (!AndroidDownloadTaskRecord.STATUS_QUEUED.equals(record.status)) {
                continue;
            }
            record.markRunning(now);
            Log.i(TAG, "promoteNextQueuedLocked taskId=" + record.taskId + " logicalId=" + record.logicalId);
            return;
        }
    }

    private boolean hasActiveTask(List<AndroidDownloadTaskRecord> records) {
        for (AndroidDownloadTaskRecord record : records) {
            if (record.isActive()) {
                return true;
            }
        }
        return false;
    }

    private File resolveRegistryFile() {
        return new File(new File(appContext.getFilesDir(), ROOT_DIR), REGISTRY_FILE);
    }

    private String readText(File file) throws IOException {
        StringBuilder builder = new StringBuilder();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(new FileInputStream(file), StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) {
                builder.append(line);
            }
        }
        return builder.toString();
    }

    private boolean safeEquals(String left, String right) {
        if (left == null) {
            return right == null;
        }
        return left.equals(right);
    }
}
