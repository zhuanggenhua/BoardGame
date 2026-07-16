package top.easyboardgame.app;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.fail;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.InetAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;
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

    @Test
    public void incrementalFileRangeRejectedBadPartRetriesFreshDownloadAgainstHttpServer() throws Exception {
        byte[] expectedBytes = "expected-fresh-file".getBytes(StandardCharsets.UTF_8);
        String expectedHash = sha256(expectedBytes);
        List<String> observedRanges = Collections.synchronizedList(new ArrayList<>());
        AtomicInteger requestCount = new AtomicInteger(0);
        AtomicReference<Exception> serverError = new AtomicReference<>(null);

        try (ServerSocket server = new ServerSocket(0, 2, InetAddress.getLoopbackAddress())) {
            server.setSoTimeout(10_000);
            Thread serverThread = new Thread(() -> serveRangeRejectedThenFreshDownload(
                server,
                expectedBytes,
                observedRanges,
                requestCount,
                serverError
            ));
            serverThread.start();

            File tempDir = Files.createTempDirectory("game-package-http-range-reset-test").toFile();
            File targetFile = new File(tempDir, "asset.webp");
            File partFile = new File(tempDir, "asset.webp.part");
            try {
                writeUtf8(partFile, "old-corrupted-prefix");
                GamePackageForegroundRuntime.RemoteFileEntry entry = new GamePackageForegroundRuntime.RemoteFileEntry(
                    "i18n/zh-CN/dicethrone/images/common/compressed/asset.webp",
                    expectedHash,
                    expectedBytes.length
                );

                GamePackageForegroundRuntime.downloadIncrementalFileForTesting(
                    new AtomicBoolean(false),
                    "http://127.0.0.1:" + server.getLocalPort() + "/official",
                    entry,
                    targetFile
                );

                serverThread.join(5_000);
                if (serverError.get() != null) {
                    throw serverError.get();
                }

                assertEquals("Expected range rejection followed by fresh download", 2, requestCount.get());
                assertEquals("bytes=" + "old-corrupted-prefix".getBytes(StandardCharsets.UTF_8).length + "-", observedRanges.get(0));
                assertNull("Fresh retry should not send Range", observedRanges.get(1));
                assertFalse("Bad partial file should be removed after fresh retry", partFile.exists());
                assertTrue("Fresh retry should write target file", targetFile.exists());
                assertEquals(expectedHash, sha256(targetFile));
            } finally {
                GamePackageFs.deleteRecursively(tempDir);
            }
        }
    }

    @Test
    public void incrementalFileAcceptedRangeChecksumMismatchRetriesFreshDownloadAgainstHttpServer() throws Exception {
        byte[] expectedBytes = "expected-fresh-file-after-range".getBytes(StandardCharsets.UTF_8);
        byte[] corruptPrefix = "bad!".getBytes(StandardCharsets.UTF_8);
        String expectedHash = sha256(expectedBytes);
        List<String> observedRanges = Collections.synchronizedList(new ArrayList<>());
        AtomicInteger requestCount = new AtomicInteger(0);
        AtomicReference<Exception> serverError = new AtomicReference<>(null);

        try (ServerSocket server = new ServerSocket(0, 2, InetAddress.getLoopbackAddress())) {
            server.setSoTimeout(10_000);
            Thread serverThread = new Thread(() -> serveAcceptedRangeThenFreshDownload(
                server,
                expectedBytes,
                observedRanges,
                requestCount,
                serverError
            ));
            serverThread.start();

            File tempDir = Files.createTempDirectory("game-package-http-checksum-reset-test").toFile();
            File targetFile = new File(tempDir, "asset.webp");
            File partFile = new File(tempDir, "asset.webp.part");
            try {
                writeBytes(partFile, corruptPrefix);
                GamePackageForegroundRuntime.RemoteFileEntry entry = new GamePackageForegroundRuntime.RemoteFileEntry(
                    "i18n/zh-CN/dicethrone/images/common/compressed/asset.webp",
                    expectedHash,
                    expectedBytes.length
                );

                GamePackageForegroundRuntime.downloadIncrementalFileForTesting(
                    new AtomicBoolean(false),
                    "http://127.0.0.1:" + server.getLocalPort() + "/official",
                    entry,
                    targetFile
                );

                serverThread.join(5_000);
                if (serverError.get() != null) {
                    throw serverError.get();
                }

                assertEquals("Expected checksum-mismatched resumed download followed by fresh retry", 2, requestCount.get());
                assertEquals("bytes=" + corruptPrefix.length + "-", observedRanges.get(0));
                assertNull("Fresh retry after checksum mismatch should not send Range", observedRanges.get(1));
                assertFalse("Checksum-mismatched partial file should be removed before retry", partFile.exists());
                assertTrue("Fresh retry should write target file", targetFile.exists());
                assertEquals(expectedHash, sha256(targetFile));
            } finally {
                GamePackageFs.deleteRecursively(tempDir);
            }
        }
    }

    @Test
    public void archiveAcceptedRangeChecksumMismatchRetriesFreshDownloadAgainstHttpServer() throws Exception {
        byte[] expectedBytes = "expected-fresh-zip-after-range".getBytes(StandardCharsets.UTF_8);
        byte[] corruptPrefix = "bad!".getBytes(StandardCharsets.UTF_8);
        String expectedHash = sha256(expectedBytes);
        List<String> observedRanges = Collections.synchronizedList(new ArrayList<>());
        AtomicInteger requestCount = new AtomicInteger(0);
        AtomicReference<Exception> serverError = new AtomicReference<>(null);

        try (ServerSocket server = new ServerSocket(0, 2, InetAddress.getLoopbackAddress())) {
            server.setSoTimeout(10_000);
            Thread serverThread = new Thread(() -> serveAcceptedRangeThenFreshDownload(
                server,
                expectedBytes,
                observedRanges,
                requestCount,
                serverError
            ));
            serverThread.start();

            File tempDir = Files.createTempDirectory("game-package-archive-checksum-reset-test").toFile();
            File targetFile = new File(tempDir, "package.zip");
            File partFile = new File(tempDir, "package.zip.part");
            try {
                writeBytes(partFile, corruptPrefix);

                GamePackageForegroundRuntime.downloadArchiveForTesting(
                    new AtomicBoolean(false),
                    "http://127.0.0.1:" + server.getLocalPort() + "/package.zip",
                    expectedHash,
                    targetFile,
                    partFile
                );

                serverThread.join(5_000);
                if (serverError.get() != null) {
                    throw serverError.get();
                }

                assertEquals("Expected checksum-mismatched archive resume followed by fresh retry", 2, requestCount.get());
                assertEquals("bytes=" + corruptPrefix.length + "-", observedRanges.get(0));
                assertNull("Fresh archive retry after checksum mismatch should not send Range", observedRanges.get(1));
                assertFalse("Checksum-mismatched archive part file should be removed before retry", partFile.exists());
                assertTrue("Fresh retry should write archive file", targetFile.exists());
                assertEquals(expectedHash, sha256(targetFile));
            } finally {
                GamePackageFs.deleteRecursively(tempDir);
            }
        }
    }

    @Test
    public void retryableChecksumErrorsStayClassifiedAsChecksumMismatch() {
        assertEquals(
            "checksum-mismatch",
            GamePackageForegroundRuntime.classifyInstallErrorCode(
                new GamePackageForegroundRuntime.RetryableDownloadException("下载包校验失败，本地临时资源包已清理，将从头重试")
            )
        );
        assertEquals(
            "checksum-mismatch",
            GamePackageForegroundRuntime.classifyInstallErrorCode(
                new GamePackageForegroundRuntime.IncrementalRetryableDownloadException("增量文件校验失败: asset.webp")
            )
        );
    }

    private static void writeUtf8(File file, String value) throws Exception {
        writeBytes(file, value.getBytes(StandardCharsets.UTF_8));
    }

    private static void writeBytes(File file, byte[] value) throws Exception {
        try (FileOutputStream output = new FileOutputStream(file)) {
            output.write(value);
        }
    }

    private static String sha256(String value) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        return bytesToHex(digest.digest(value.getBytes(StandardCharsets.UTF_8)));
    }

    private static String sha256(byte[] value) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        return bytesToHex(digest.digest(value));
    }

    private static String sha256(File file) throws Exception {
        return sha256(Files.readAllBytes(file.toPath()));
    }

    private static void serveRangeRejectedThenFreshDownload(
        ServerSocket server,
        byte[] expectedBytes,
        List<String> observedRanges,
        AtomicInteger requestCount,
        AtomicReference<Exception> serverError
    ) {
        try {
            for (int index = 0; index < 2; index += 1) {
                try (Socket socket = server.accept()) {
                    socket.setSoTimeout(10_000);
                    String rangeHeader = readRangeHeader(socket);
                    observedRanges.add(rangeHeader);
                    requestCount.incrementAndGet();
                    if (rangeHeader != null) {
                        writeHttpResponse(socket, 416, new byte[0]);
                    } else {
                        writeHttpResponse(socket, 200, expectedBytes);
                        return;
                    }
                }
            }
        } catch (Exception error) {
            serverError.set(error);
        }
    }

    private static void serveAcceptedRangeThenFreshDownload(
        ServerSocket server,
        byte[] expectedBytes,
        List<String> observedRanges,
        AtomicInteger requestCount,
        AtomicReference<Exception> serverError
    ) {
        try {
            for (int index = 0; index < 2; index += 1) {
                try (Socket socket = server.accept()) {
                    socket.setSoTimeout(10_000);
                    String rangeHeader = readRangeHeader(socket);
                    observedRanges.add(rangeHeader);
                    requestCount.incrementAndGet();
                    if (rangeHeader != null) {
                        int offset = parseRangeOffset(rangeHeader);
                        writePartialHttpResponse(socket, expectedBytes, offset);
                    } else {
                        writeHttpResponse(socket, 200, expectedBytes);
                        return;
                    }
                }
            }
        } catch (Exception error) {
            serverError.set(error);
        }
    }

    private static int parseRangeOffset(String rangeHeader) {
        if (rangeHeader == null || !rangeHeader.startsWith("bytes=")) {
            return 0;
        }
        int dashIndex = rangeHeader.indexOf('-');
        String offsetText = dashIndex >= 0 ? rangeHeader.substring("bytes=".length(), dashIndex) : rangeHeader.substring("bytes=".length());
        return Integer.parseInt(offsetText);
    }

    private static String readRangeHeader(Socket socket) throws Exception {
        BufferedReader reader = new BufferedReader(new InputStreamReader(socket.getInputStream(), StandardCharsets.ISO_8859_1));
        String rangeHeader = null;
        String line;
        while ((line = reader.readLine()) != null && !line.isEmpty()) {
            if (line.regionMatches(true, 0, "Range:", 0, "Range:".length())) {
                rangeHeader = line.substring("Range:".length()).trim();
            }
        }
        return rangeHeader;
    }

    private static void writeHttpResponse(Socket socket, int statusCode, byte[] body) throws Exception {
        String reason = statusCode == 416 ? "Range Not Satisfiable" : "OK";
        String headers = "HTTP/1.1 " + statusCode + " " + reason + "\r\n"
            + "Content-Length: " + body.length + "\r\n"
            + "Connection: close\r\n"
            + "\r\n";
        OutputStream output = socket.getOutputStream();
        output.write(headers.getBytes(StandardCharsets.ISO_8859_1));
        output.write(body);
        output.flush();
    }

    private static void writePartialHttpResponse(Socket socket, byte[] source, int offset) throws Exception {
        byte[] body = new byte[Math.max(0, source.length - offset)];
        System.arraycopy(source, offset, body, 0, body.length);
        String headers = "HTTP/1.1 206 Partial Content\r\n"
            + "Content-Length: " + body.length + "\r\n"
            + "Content-Range: bytes " + offset + "-" + (source.length - 1) + "/" + source.length + "\r\n"
            + "Connection: close\r\n"
            + "\r\n";
        OutputStream output = socket.getOutputStream();
        output.write(headers.getBytes(StandardCharsets.ISO_8859_1));
        output.write(body);
        output.flush();
    }

    private static String bytesToHex(byte[] bytes) {
        StringBuilder builder = new StringBuilder(bytes.length * 2);
        for (byte value : bytes) {
            builder.append(String.format("%02x", value));
        }
        return builder.toString();
    }
}
