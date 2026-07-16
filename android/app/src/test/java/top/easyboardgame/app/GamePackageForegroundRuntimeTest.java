package top.easyboardgame.app;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.fail;

import java.io.File;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.security.MessageDigest;
import org.junit.Test;

public class GamePackageForegroundRuntimeTest {

    @Test
    public void incrementalChecksumMismatchDeletesBadPartAndRetriesFromZero() throws Exception {
        File tempDir = Files.createTempDirectory("game-package-incremental-test").toFile();
        File partFile = new File(tempDir, "asset.webp.part");
        try {
            writeUtf8(partFile, "old-corrupted-prefix");
            GamePackageForegroundRuntime.RemoteFileEntry entry = new GamePackageForegroundRuntime.RemoteFileEntry(
                "i18n/zh-CN/dicethrone/images/common/compressed/asset.webp",
                sha256("expected-fresh-file"),
                "expected-fresh-file".getBytes(StandardCharsets.UTF_8).length
            );

            try {
                GamePackageForegroundRuntime.verifyDownloadedIncrementalPart(
                    partFile,
                    entry,
                    sha256("old-corrupted-prefix")
                );
                fail("Expected checksum mismatch to be retryable");
            } catch (GamePackageForegroundRuntime.IncrementalRetryableDownloadException error) {
                assertTrue(GamePackageForegroundRuntime.isRecoverableDownloadError(error));
            }

            assertFalse("Bad incremental part file should be discarded before retry", partFile.exists());
        } finally {
            GamePackageFs.deleteRecursively(tempDir);
        }
    }

    @Test
    public void incrementalSizeMismatchDeletesBadPartAndRetriesFromZero() throws Exception {
        File tempDir = Files.createTempDirectory("game-package-incremental-size-test").toFile();
        File partFile = new File(tempDir, "asset.webp.part");
        try {
            writeUtf8(partFile, "short");
            GamePackageForegroundRuntime.RemoteFileEntry entry = new GamePackageForegroundRuntime.RemoteFileEntry(
                "i18n/zh-CN/dicethrone/images/common/compressed/asset.webp",
                sha256("short"),
                99L
            );

            try {
                GamePackageForegroundRuntime.verifyDownloadedIncrementalPart(partFile, entry, sha256("short"));
                fail("Expected size mismatch to be retryable");
            } catch (GamePackageForegroundRuntime.IncrementalRetryableDownloadException error) {
                assertTrue(GamePackageForegroundRuntime.isRecoverableDownloadError(error));
            }

            assertFalse("Wrong-sized incremental part file should be discarded before retry", partFile.exists());
        } finally {
            GamePackageFs.deleteRecursively(tempDir);
        }
    }

    @Test
    public void rangeNotSatisfiableBadPartDeletesPartAndRetriesFromZero() throws Exception {
        File tempDir = Files.createTempDirectory("game-package-range-reset-test").toFile();
        File targetFile = new File(tempDir, "asset.webp");
        File partFile = new File(tempDir, "asset.webp.part");
        try {
            writeUtf8(partFile, "old-corrupted-prefix");

            try {
                GamePackageForegroundRuntime.handleRangeNotSatisfiablePartialDownload(
                    partFile,
                    targetFile,
                    sha256("expected-fresh-file"),
                    "expected-fresh-file".getBytes(StandardCharsets.UTF_8).length,
                    "清理旧增量文件失败",
                    "恢复已完成增量文件失败",
                    "重置不可续传增量文件失败",
                    "服务端拒绝增量续传，本地临时文件已清理，将从头重试"
                );
                fail("Expected invalid partial file to request a fresh retry");
            } catch (GamePackageForegroundRuntime.IncrementalRetryableDownloadException error) {
                assertTrue(GamePackageForegroundRuntime.isRecoverableDownloadError(error));
            }

            assertFalse("Invalid range partial file should be discarded before retry", partFile.exists());
            assertFalse("Invalid range partial file should not be promoted to target", targetFile.exists());
        } finally {
            GamePackageFs.deleteRecursively(tempDir);
        }
    }

    @Test
    public void rangeNotSatisfiableCompletePartRestoresTargetFile() throws Exception {
        File tempDir = Files.createTempDirectory("game-package-range-complete-test").toFile();
        File targetFile = new File(tempDir, "asset.webp");
        File partFile = new File(tempDir, "asset.webp.part");
        try {
            writeUtf8(partFile, "expected-fresh-file");

            boolean restored = GamePackageForegroundRuntime.handleRangeNotSatisfiablePartialDownload(
                partFile,
                targetFile,
                sha256("expected-fresh-file"),
                "expected-fresh-file".getBytes(StandardCharsets.UTF_8).length,
                "清理旧增量文件失败",
                "恢复已完成增量文件失败",
                "重置不可续传增量文件失败",
                "服务端拒绝增量续传，本地临时文件已清理，将从头重试"
            );

            assertTrue("Complete range partial file should be restored", restored);
            assertFalse("Restored partial file should be moved away", partFile.exists());
            assertTrue("Restored target file should exist", targetFile.exists());
        } finally {
            GamePackageFs.deleteRecursively(tempDir);
        }
    }

    private static void writeUtf8(File file, String value) throws Exception {
        try (FileOutputStream output = new FileOutputStream(file)) {
            output.write(value.getBytes(StandardCharsets.UTF_8));
        }
    }

    private static String sha256(String value) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        return bytesToHex(digest.digest(value.getBytes(StandardCharsets.UTF_8)));
    }

    private static String bytesToHex(byte[] bytes) {
        StringBuilder builder = new StringBuilder(bytes.length * 2);
        for (byte value : bytes) {
            builder.append(String.format("%02x", value));
        }
        return builder.toString();
    }
}
