package top.easyboardgame.app;

import android.content.Context;
import android.util.Log;
import java.io.BufferedInputStream;
import java.io.BufferedOutputStream;
import java.io.BufferedReader;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.StandardCopyOption;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import org.json.JSONException;
import org.json.JSONObject;

final class GamePackageFs {

    private static final String TAG = "GamePackageFs";
    private static final int BUFFER_SIZE = 16 * 1024;
    static final String ROOT_DIR = "game-packages";
    static final String CURRENT_DIR = "current";
    static final String STAGING_DIR = "staging";
    static final String ASSETS_DIR = "assets";
    static final String ARCHIVE_FILE = "package.zip";
    static final String ARCHIVE_PART_FILE = "package.zip.part";
    static final String METADATA_FILE = "metadata.json";
    static final String STATE_FILE = "install-state.json";
    static final String INSTALLED_FILES_INDEX_FILE = "installed-files-index.json";
    private static final Object PACKAGE_MUTATION_LOCK = new Object();

    private GamePackageFs() {}

    static Object packageMutationLock() {
        return PACKAGE_MUTATION_LOCK;
    }

    static final class FileHashEntry {
        final String path;
        final String hash;
        final long size;

        FileHashEntry(String path, String hash, long size) {
            this.path = path;
            this.hash = hash;
            this.size = size;
        }
    }

    static File getRootDir(Context context) {
        File rootDir = new File(context.getFilesDir(), ROOT_DIR);
        if (!rootDir.exists()) {
            rootDir.mkdirs();
        }
        return rootDir;
    }

    static File resolveGameDir(Context context, String gameId) {
        return new File(getRootDir(context), gameId);
    }

    static File resolveCurrentDir(Context context, String gameId) {
        return new File(resolveGameDir(context, gameId), CURRENT_DIR);
    }

    static File resolveCurrentAssetsDir(Context context, String gameId) {
        return new File(resolveCurrentDir(context, gameId), ASSETS_DIR);
    }

    static File resolveCurrentMetadataFile(Context context, String gameId) {
        return new File(resolveCurrentDir(context, gameId), METADATA_FILE);
    }

    static File resolveCurrentInstalledFilesIndexFile(Context context, String gameId) {
        return new File(resolveCurrentDir(context, gameId), INSTALLED_FILES_INDEX_FILE);
    }

    static File resolveStateFile(Context context, String gameId) {
        return new File(resolveGameDir(context, gameId), STATE_FILE);
    }

    static File resolveStagingRootDir(Context context, String gameId) {
        return new File(resolveGameDir(context, gameId), STAGING_DIR);
    }

    static File resolveVersionedStagingDir(Context context, String gameId, String packageVersion) {
        return new File(resolveStagingRootDir(context, gameId), sanitizeFileSegment(packageVersion));
    }

    static File resolveArchiveFile(Context context, String gameId, String packageVersion) {
        return new File(resolveVersionedStagingDir(context, gameId, packageVersion), ARCHIVE_FILE);
    }

    static File resolveArchivePartFile(Context context, String gameId, String packageVersion) {
        return new File(resolveVersionedStagingDir(context, gameId, packageVersion), ARCHIVE_PART_FILE);
    }

    static File resolveStagingAssetsDir(Context context, String gameId, String packageVersion) {
        return new File(resolveVersionedStagingDir(context, gameId, packageVersion), ASSETS_DIR);
    }

    static File resolveStagingMetadataFile(Context context, String gameId, String packageVersion) {
        return new File(resolveVersionedStagingDir(context, gameId, packageVersion), METADATA_FILE);
    }

    static File resolveStagingInstalledFilesIndexFile(Context context, String gameId, String packageVersion) {
        return new File(resolveVersionedStagingDir(context, gameId, packageVersion), INSTALLED_FILES_INDEX_FILE);
    }

    static String buildAssetRootPath(File assetRootDir) {
        return assetRootDir.getAbsolutePath();
    }

    static JSONObject readJsonFile(File file) throws IOException, JSONException {
        if (file == null || !file.exists()) {
            return null;
        }
        StringBuilder builder = new StringBuilder();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(new FileInputStream(file), StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) {
                builder.append(line);
            }
        }
        return new JSONObject(builder.toString());
    }

    static void writeJsonFile(File file, JSONObject payload) throws IOException {
        File parent = file.getParentFile();
        if (parent != null && !parent.exists() && !parent.mkdirs()) {
            throw new IOException("创建目录失败");
        }
        writeTextAtomically(file, payload.toString() + "\n");
    }

    static void writeTextAtomically(File file, String text) throws IOException {
        File parent = file.getParentFile();
        if (parent != null && !parent.exists() && !parent.mkdirs()) {
            throw new IOException("创建目录失败");
        }

        File tempFile = new File(file.getAbsolutePath() + ".tmp");
        try (FileOutputStream output = new FileOutputStream(tempFile)) {
            output.write(text.getBytes(StandardCharsets.UTF_8));
            output.getFD().sync();
        }
        Files.move(
            tempFile.toPath(),
            file.toPath(),
            StandardCopyOption.REPLACE_EXISTING,
            StandardCopyOption.ATOMIC_MOVE
        );
    }

    static void writeMetadata(
        File targetFile,
        String gameId,
        String runtimeChannel,
        String assetPackId,
        String assetPackVersion,
        long installedAt
    ) throws IOException, JSONException {
        JSONObject metadata = new JSONObject();
        metadata.put("gameId", gameId);
        metadata.put("runtimeChannel", runtimeChannel);
        metadata.put("assetPackId", assetPackId);
        metadata.put("assetPackVersion", assetPackVersion);
        metadata.put("installedAt", installedAt);
        writeJsonFile(targetFile, metadata);
    }

    static JSONObject buildInstalledStatePayload(Context context, String gameId) {
        try {
            File metadataFile = resolveCurrentMetadataFile(context, gameId);
            File assetRootDir = resolveCurrentAssetsDir(context, gameId);
            if (!metadataFile.exists() || !assetRootDir.isDirectory()) {
                return null;
            }

            JSONObject metadata = readJsonFile(metadataFile);
            if (metadata == null) {
                return null;
            }

            JSONObject payload = new JSONObject();
            payload.put("gameId", metadata.optString("gameId", gameId));
            payload.put("status", "installed");
            String assetPackVersion = normalizeNonEmpty(metadata.optString("assetPackVersion", null));
            if (assetPackVersion != null) {
                payload.put("assetPackVersion", assetPackVersion);
            }
            payload.put("assetRootPath", buildAssetRootPath(assetRootDir));
            long installedAt = metadata.optLong("installedAt", 0L);
            if (installedAt > 0L) {
                payload.put("installedAt", installedAt);
                payload.put("updatedAt", installedAt);
            } else {
                payload.put("updatedAt", System.currentTimeMillis());
            }
            return payload;
        } catch (Exception error) {
            Log.w(TAG, "buildInstalledStatePayload failed gameId=" + gameId, error);
            return null;
        }
    }

    static boolean cleanupBrokenCurrentInstall(Context context, String gameId) {
        File currentDir = resolveCurrentDir(context, gameId);
        if (!currentDir.exists()) {
            return false;
        }

        File metadataFile = resolveCurrentMetadataFile(context, gameId);
        File assetRootDir = resolveCurrentAssetsDir(context, gameId);
        if (metadataFile.exists() && assetRootDir.isDirectory()) {
            return false;
        }

        deleteRecursively(currentDir);
        return true;
    }

    static int cleanupStagingDirectories(Context context, String gameId, String keepPackageVersion) {
        File stagingRootDir = resolveStagingRootDir(context, gameId);
        if (!stagingRootDir.exists()) {
            return 0;
        }

        File[] children = stagingRootDir.listFiles();
        if (children == null || children.length == 0) {
            deleteRecursively(stagingRootDir);
            return 0;
        }

        String keepDirName = keepPackageVersion == null ? null : sanitizeFileSegment(keepPackageVersion);
        int deletedCount = 0;
        for (File child : children) {
            if (keepDirName != null && keepDirName.equals(child.getName())) {
                continue;
            }
            deleteRecursively(child);
            deletedCount += 1;
        }

        File[] remainingChildren = stagingRootDir.listFiles();
        if (remainingChildren == null || remainingChildren.length == 0) {
            deleteRecursively(stagingRootDir);
        }
        return deletedCount;
    }

    static JSONObject buildInstalledFilesIndex(File assetRootDir, String assetPackVersion) throws Exception {
        List<FileHashEntry> entries = collectFileHashes(assetRootDir);
        JSONObject filesObject = new JSONObject();
        for (FileHashEntry entry : entries) {
            filesObject.put(entry.path, entry.hash);
        }
        JSONObject payload = new JSONObject();
        payload.put("assetPackVersion", assetPackVersion);
        payload.put("files", filesObject);
        payload.put("updatedAt", System.currentTimeMillis());
        return payload;
    }

    static void copyDirectoryContents(File sourceDir, File targetDir) throws IOException {
        if (!sourceDir.exists()) {
            return;
        }
        if (!targetDir.exists() && !targetDir.mkdirs()) {
            throw new IOException("创建目录失败: " + targetDir.getAbsolutePath());
        }
        File[] children = sourceDir.listFiles();
        if (children == null) {
            return;
        }
        for (File child : children) {
            File targetChild = new File(targetDir, child.getName());
            if (child.isDirectory()) {
                copyDirectoryContents(child, targetChild);
                continue;
            }
            copyFile(child, targetChild);
        }
    }

    static void pruneDirectoryContents(File rootDir, List<String> keepRelativePaths) throws IOException {
        pruneDirectoryContents(rootDir, new HashSet<>(keepRelativePaths));
    }

    static void pruneDirectoryContents(File rootDir, Set<String> keepRelativePaths) throws IOException {
        if (rootDir == null || !rootDir.exists()) {
            return;
        }
        pruneDirectoryContentsRecursive(rootDir, rootDir, keepRelativePaths);
    }

    static List<FileHashEntry> collectFileHashes(File assetRootDir) throws Exception {
        if (!assetRootDir.isDirectory()) {
            return Collections.emptyList();
        }
        List<FileHashEntry> entries = new ArrayList<>();
        collectFileHashesRecursive(assetRootDir, assetRootDir, entries);
        Collections.sort(entries, (left, right) -> left.path.compareTo(right.path));
        return entries;
    }

    static String hashFile(File file) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        try (InputStream inputStream = new BufferedInputStream(new FileInputStream(file))) {
            byte[] buffer = new byte[BUFFER_SIZE];
            int read;
            while ((read = inputStream.read(buffer)) != -1) {
                digest.update(buffer, 0, read);
            }
        }
        return bytesToHex(digest.digest());
    }

    static String sanitizeFileSegment(String value) {
        return value.replaceAll("[^a-zA-Z0-9._-]", "_");
    }

    static String normalizeNonEmpty(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    static boolean safeEquals(String left, String right) {
        if (left == null) {
            return right == null;
        }
        return left.equals(right);
    }

    static void deleteRecursively(File target) {
        if (target == null || !target.exists()) {
            return;
        }

        File[] children = target.listFiles();
        if (children != null) {
            for (File child : children) {
                deleteRecursively(child);
            }
        }

        if (!target.delete() && target.exists()) {
            Log.w(TAG, "deleteRecursively failed: " + target.getAbsolutePath());
        }
    }

    private static void collectFileHashesRecursive(File rootDir, File current, List<FileHashEntry> entries) throws Exception {
        File[] children = current.listFiles();
        if (children == null) {
            return;
        }
        for (File child : children) {
            if (child.isDirectory()) {
                collectFileHashesRecursive(rootDir, child, entries);
                continue;
            }
            String relativePath = rootDir.toPath().relativize(child.toPath()).toString().replace('\\', '/');
            entries.add(new FileHashEntry(relativePath, hashFile(child), child.length()));
        }
    }

    private static void pruneDirectoryContentsRecursive(File rootDir, File current, Set<String> keepRelativePaths) throws IOException {
        File[] children = current.listFiles();
        if (children == null) {
            return;
        }

        for (File child : children) {
            if (child.isDirectory()) {
                pruneDirectoryContentsRecursive(rootDir, child, keepRelativePaths);
                File[] remaining = child.listFiles();
                if ((remaining == null || remaining.length == 0) && !child.delete() && child.exists()) {
                    throw new IOException("清理空目录失败: " + child.getAbsolutePath());
                }
                continue;
            }

            String relativePath = rootDir.toPath().relativize(child.toPath()).toString().replace('\\', '/');
            if (keepRelativePaths.contains(relativePath)) {
                continue;
            }
            if (!child.delete() && child.exists()) {
                throw new IOException("删除旧文件失败: " + relativePath);
            }
        }
    }

    private static void copyFile(File source, File target) throws IOException {
        File parent = target.getParentFile();
        if (parent != null && !parent.exists() && !parent.mkdirs()) {
            throw new IOException("创建目录失败: " + parent.getAbsolutePath());
        }
        try (
            InputStream input = new BufferedInputStream(new FileInputStream(source));
            BufferedOutputStream output = new BufferedOutputStream(new FileOutputStream(target))
        ) {
            byte[] buffer = new byte[BUFFER_SIZE];
            int read;
            while ((read = input.read(buffer)) != -1) {
                output.write(buffer, 0, read);
            }
        }
    }

    private static String bytesToHex(byte[] bytes) {
        StringBuilder builder = new StringBuilder(bytes.length * 2);
        for (byte value : bytes) {
            builder.append(String.format("%02x", value));
        }
        return builder.toString();
    }
}
