package top.easyboardgame.app;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNull;

import java.io.File;
import java.nio.file.Files;
import org.junit.Test;

public class AndroidDownloadTaskStoreTest {

    @Test
    public void cancelledTaskCannotBeRevivedByStaleWorkerWrites() throws Exception {
        File filesDir = Files.createTempDirectory("android-download-store-test").toFile();
        try {
            AndroidDownloadTaskStore store = new AndroidDownloadTaskStore(filesDir);
            AndroidDownloadTaskRecord record = store.enqueueOrReuse(
                AndroidDownloadTaskRecord.KIND_GAME_PACKAGE,
                "dicethrone",
                "DiceThrone",
                "stable",
                "dicethrone",
                "0.6.4-dicethrone-pkg",
                "https://assets.example/dicethrone.zip",
                "checksum",
                "full",
                null,
                null,
                null,
                true,
                "/tmp/package.zip",
                "/tmp/package.zip.part"
            );

            store.cancelTasksForTarget(AndroidDownloadTaskRecord.KIND_GAME_PACKAGE, "dicethrone", System.currentTimeMillis());

            assertNull(store.updateRunningProgress(record.taskId, 10L, 100L, AndroidDownloadTaskRecord.STATUS_RUNNING, System.currentTimeMillis()));
            assertNull(store.markVerifying(record.taskId, System.currentTimeMillis()));
            assertNull(store.markFailed(record.taskId, "checksum-mismatch", "增量文件校验失败", System.currentTimeMillis()));
            assertNull(store.markCompleted(record.taskId, 100L, System.currentTimeMillis()));

            AndroidDownloadTaskRecord latest = store.getLatestByTarget(AndroidDownloadTaskRecord.KIND_GAME_PACKAGE, "dicethrone");
            assertEquals(AndroidDownloadTaskRecord.STATUS_CANCELLED, latest.status);
        } finally {
            GamePackageFs.deleteRecursively(filesDir);
        }
    }

    @Test
    public void changedInstallRequestReplacesUnfinishedIncrementalTask() throws Exception {
        File filesDir = Files.createTempDirectory("android-download-store-replace-test").toFile();
        try {
            AndroidDownloadTaskStore store = new AndroidDownloadTaskStore(filesDir);
            AndroidDownloadTaskRecord incremental = store.enqueueOrReuse(
                AndroidDownloadTaskRecord.KIND_GAME_PACKAGE,
                "dicethrone",
                "DiceThrone",
                "stable",
                "dicethrone",
                "0.6.4-dicethrone-pkg",
                "https://assets.example/dicethrone.zip",
                "checksum",
                "incremental",
                "https://assets.example/official",
                "https://assets.example/file-index.json",
                "file-index-checksum",
                true,
                "/tmp/package.zip",
                "/tmp/package.zip.part"
            );

            AndroidDownloadTaskRecord full = store.enqueueOrReuse(
                AndroidDownloadTaskRecord.KIND_GAME_PACKAGE,
                "dicethrone",
                "DiceThrone",
                "stable",
                "dicethrone",
                "0.6.4-dicethrone-pkg",
                "https://assets.example/dicethrone.zip",
                "checksum",
                "full",
                null,
                null,
                null,
                true,
                "/tmp/package.zip",
                "/tmp/package.zip.part"
            );

            assertFalse("Full reinstall must not reuse the stale incremental task", incremental.taskId.equals(full.taskId));
            assertEquals(AndroidDownloadTaskRecord.STATUS_CANCELLED, store.getByTaskId(incremental.taskId).status);
            assertEquals(AndroidDownloadTaskRecord.STATUS_RUNNING, full.status);
            assertEquals("full", full.installMode);
            assertEquals(full.taskId, store.getLatestByTarget(AndroidDownloadTaskRecord.KIND_GAME_PACKAGE, "dicethrone").taskId);
        } finally {
            GamePackageFs.deleteRecursively(filesDir);
        }
    }

    @Test
    public void sameFullInstallRequestReusesExistingTask() throws Exception {
        File filesDir = Files.createTempDirectory("android-download-store-reuse-test").toFile();
        try {
            AndroidDownloadTaskStore store = new AndroidDownloadTaskStore(filesDir);
            AndroidDownloadTaskRecord created = enqueueFullDicethroneTask(store);

            AndroidDownloadTaskRecord reused = enqueueFullDicethroneTask(store);

            assertEquals("Foreground service enqueue must reuse the task created by the plugin call", created.taskId, reused.taskId);
            assertEquals(AndroidDownloadTaskRecord.STATUS_RUNNING, reused.status);
            assertEquals(1, store.readAll().size());
        } finally {
            GamePackageFs.deleteRecursively(filesDir);
        }
    }

    @Test
    public void replacementFullTaskIsReusedBySubsequentSameRequest() throws Exception {
        File filesDir = Files.createTempDirectory("android-download-store-replace-reuse-test").toFile();
        try {
            AndroidDownloadTaskStore store = new AndroidDownloadTaskStore(filesDir);
            AndroidDownloadTaskRecord incremental = store.enqueueOrReuse(
                AndroidDownloadTaskRecord.KIND_GAME_PACKAGE,
                "dicethrone",
                "DiceThrone",
                "stable",
                "dicethrone",
                "0.6.4-dicethrone-pkg",
                "https://assets.example/dicethrone.zip",
                "checksum",
                "incremental",
                "https://assets.example/official",
                "https://assets.example/file-index.json",
                "file-index-checksum",
                true,
                "/tmp/package.zip",
                "/tmp/package.zip.part"
            );

            AndroidDownloadTaskRecord full = enqueueFullDicethroneTask(store);
            AndroidDownloadTaskRecord reused = enqueueFullDicethroneTask(store);

            assertFalse("Full reinstall must replace the stale incremental task", incremental.taskId.equals(full.taskId));
            assertEquals(AndroidDownloadTaskRecord.STATUS_CANCELLED, store.getByTaskId(incremental.taskId).status);
            assertEquals(full.taskId, reused.taskId);
            assertEquals(AndroidDownloadTaskRecord.STATUS_RUNNING, reused.status);
            assertEquals(2, store.readAll().size());
        } finally {
            GamePackageFs.deleteRecursively(filesDir);
        }
    }

    private AndroidDownloadTaskRecord enqueueFullDicethroneTask(AndroidDownloadTaskStore store) {
        return store.enqueueOrReuse(
            AndroidDownloadTaskRecord.KIND_GAME_PACKAGE,
            "dicethrone",
            "DiceThrone",
            "stable",
            "dicethrone",
            "0.6.4-dicethrone-pkg",
            "https://assets.example/dicethrone.zip",
            "checksum",
            "full",
            null,
            null,
            null,
            true,
            "/tmp/package.zip",
            "/tmp/package.zip.part"
        );
    }
}
