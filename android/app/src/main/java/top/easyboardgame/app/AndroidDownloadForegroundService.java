package top.easyboardgame.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.IBinder;
import androidx.core.app.NotificationCompat;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;

public class AndroidDownloadForegroundService extends Service {

    static final String ACTION_ENQUEUE = "top.easyboardgame.app.action.DOWNLOAD_ENQUEUE";
    static final String ACTION_CANCEL = "top.easyboardgame.app.action.DOWNLOAD_CANCEL";
    static final String ACTION_RECONCILE = "top.easyboardgame.app.action.DOWNLOAD_RECONCILE";

    static final String EXTRA_KIND = "kind";
    static final String EXTRA_LOGICAL_ID = "logicalId";
    static final String EXTRA_DISPLAY_NAME = "displayName";
    static final String EXTRA_RUNTIME_CHANNEL = "runtimeChannel";
    static final String EXTRA_PACKAGE_ID = "packageId";
    static final String EXTRA_PACKAGE_VERSION = "packageVersion";
    static final String EXTRA_SOURCE_URL = "sourceUrl";
    static final String EXTRA_CHECKSUM = "checksum";
    static final String EXTRA_INSTALL_MODE = "installMode";
    static final String EXTRA_ASSET_BASE_URL = "assetBaseUrl";
    static final String EXTRA_FILE_INDEX_URL = "fileIndexUrl";
    static final String EXTRA_FILE_INDEX_CHECKSUM = "fileIndexChecksum";
    static final String EXTRA_ALLOW_FULL_FALLBACK = "allowFullFallback";
    static final String EXTRA_DESTINATION_PATH = "destinationPath";
    static final String EXTRA_PARTIAL_PATH = "partialPath";
    static final String EXTRA_TASK_ID = "taskId";

    private static final String CHANNEL_ID = "boardgame-downloads";
    private static final int NOTIFICATION_ID = 41001;

    private final ExecutorService workerExecutor = Executors.newSingleThreadExecutor();
    private final Map<String, AtomicBoolean> cancelRegistry = new ConcurrentHashMap<>();
    private AndroidDownloadTaskStore taskStore;
    private volatile String runningTaskId;

    public static Intent buildEnqueueIntent(
        Context context,
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
        String partialPath
    ) {
        Intent intent = new Intent(context, AndroidDownloadForegroundService.class);
        intent.setAction(ACTION_ENQUEUE);
        intent.putExtra(EXTRA_KIND, kind);
        intent.putExtra(EXTRA_LOGICAL_ID, logicalId);
        intent.putExtra(EXTRA_DISPLAY_NAME, displayName);
        intent.putExtra(EXTRA_RUNTIME_CHANNEL, runtimeChannel);
        intent.putExtra(EXTRA_PACKAGE_ID, packageId);
        intent.putExtra(EXTRA_PACKAGE_VERSION, packageVersion);
        intent.putExtra(EXTRA_SOURCE_URL, sourceUrl);
        intent.putExtra(EXTRA_CHECKSUM, checksum);
        intent.putExtra(EXTRA_INSTALL_MODE, installMode);
        intent.putExtra(EXTRA_ASSET_BASE_URL, assetBaseUrl);
        intent.putExtra(EXTRA_FILE_INDEX_URL, fileIndexUrl);
        intent.putExtra(EXTRA_FILE_INDEX_CHECKSUM, fileIndexChecksum);
        intent.putExtra(EXTRA_ALLOW_FULL_FALLBACK, allowFullFallback);
        intent.putExtra(EXTRA_DESTINATION_PATH, destinationPath);
        intent.putExtra(EXTRA_PARTIAL_PATH, partialPath);
        return intent;
    }

    public static Intent buildCancelIntent(Context context, String taskId) {
        Intent intent = new Intent(context, AndroidDownloadForegroundService.class);
        intent.setAction(ACTION_CANCEL);
        intent.putExtra(EXTRA_TASK_ID, taskId);
        return intent;
    }

    public static Intent buildReconcileIntent(Context context) {
        Intent intent = new Intent(context, AndroidDownloadForegroundService.class);
        intent.setAction(ACTION_RECONCILE);
        return intent;
    }

    public static void startManagedIntent(Context context, Intent intent) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(intent);
            return;
        }
        context.startService(intent);
    }

    @Override
    public void onCreate() {
        super.onCreate();
        taskStore = new AndroidDownloadTaskStore(getApplicationContext());
        taskStore.reconcileTransientTasks();
        ensureNotificationChannel();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        startForeground(NOTIFICATION_ID, buildNotification());
        if (intent != null) {
            String action = intent.getAction();
            if (ACTION_ENQUEUE.equals(action)) {
                handleEnqueue(intent);
            } else if (ACTION_CANCEL.equals(action)) {
                handleCancel(intent);
            } else if (ACTION_RECONCILE.equals(action)) {
                taskStore.reconcileTransientTasks();
            }
        }
        maybeStartActiveTask();
        refreshForegroundState();
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        workerExecutor.shutdownNow();
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    private void handleEnqueue(Intent intent) {
        AndroidDownloadTaskRecord record = taskStore.enqueueOrReuse(
            safe(intent.getStringExtra(EXTRA_KIND), AndroidDownloadTaskRecord.KIND_GAME_PACKAGE),
            safe(intent.getStringExtra(EXTRA_LOGICAL_ID), ""),
            safe(intent.getStringExtra(EXTRA_DISPLAY_NAME), ""),
            nullable(intent.getStringExtra(EXTRA_RUNTIME_CHANNEL)),
            nullable(intent.getStringExtra(EXTRA_PACKAGE_ID)),
            nullable(intent.getStringExtra(EXTRA_PACKAGE_VERSION)),
            safe(intent.getStringExtra(EXTRA_SOURCE_URL), ""),
            nullable(intent.getStringExtra(EXTRA_CHECKSUM)),
            nullable(intent.getStringExtra(EXTRA_INSTALL_MODE)),
            nullable(intent.getStringExtra(EXTRA_ASSET_BASE_URL)),
            nullable(intent.getStringExtra(EXTRA_FILE_INDEX_URL)),
            nullable(intent.getStringExtra(EXTRA_FILE_INDEX_CHECKSUM)),
            intent.getBooleanExtra(EXTRA_ALLOW_FULL_FALLBACK, true),
            nullable(intent.getStringExtra(EXTRA_DESTINATION_PATH)),
            nullable(intent.getStringExtra(EXTRA_PARTIAL_PATH))
        );
        GamePackageForegroundRuntime.emitQueuedOrRunningState(getApplicationContext(), record);
    }

    private void handleCancel(Intent intent) {
        String taskId = nullable(intent.getStringExtra(EXTRA_TASK_ID));
        if (taskId == null) {
            return;
        }
        AtomicBoolean cancelled = cancelRegistry.get(taskId);
        if (cancelled != null) {
            cancelled.set(true);
        }
        AndroidDownloadTaskRecord record = taskStore.cancelTask(taskId);
        GamePackageForegroundRuntime.emitCancelledState(getApplicationContext(), record);
    }

    private void maybeStartActiveTask() {
        if (runningTaskId != null) {
            return;
        }
        AndroidDownloadTaskRecord task = taskStore.getActiveTask();
        if (task == null) {
            return;
        }
        runningTaskId = task.taskId;
        AtomicBoolean cancelFlag = new AtomicBoolean(false);
        cancelRegistry.put(task.taskId, cancelFlag);
        workerExecutor.execute(() -> {
            try {
                GamePackageForegroundRuntime.runTask(getApplicationContext(), taskStore, task, cancelFlag, this::refreshForegroundState);
            } finally {
                cancelRegistry.remove(task.taskId);
                runningTaskId = null;
                refreshForegroundState();
                maybeStartActiveTask();
            }
        });
    }

    private void refreshForegroundState() {
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager == null) {
            return;
        }
        AndroidDownloadTaskRecord activeTask = taskStore.getActiveTask();
        int queuedCount = taskStore.countQueuedTasks();
        if (activeTask == null && queuedCount == 0) {
            stopForeground(STOP_FOREGROUND_REMOVE);
            stopSelf();
            return;
        }
        manager.notify(NOTIFICATION_ID, createNotificationBuilder(activeTask, queuedCount).build());
    }

    private android.app.Notification buildNotification() {
        return createNotificationBuilder(taskStore.getActiveTask(), taskStore.countQueuedTasks()).build();
    }

    private NotificationCompat.Builder createNotificationBuilder(AndroidDownloadTaskRecord activeTask, int queuedCount) {
        PendingIntent contentIntent = PendingIntent.getActivity(
            this,
            0,
            new Intent(this, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP),
            PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0)
        );
        String title = activeTask == null ? "下载队列待处理" : String.format(Locale.ROOT, "下载中：%s", safe(activeTask.displayName, activeTask.logicalId));
        String text = GamePackageForegroundRuntime.buildNotificationText(activeTask, queuedCount);
        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.stat_sys_download)
            .setContentTitle(title)
            .setContentText(text)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(text))
            .setOnlyAlertOnce(true)
            .setOngoing(true)
            .setContentIntent(contentIntent);
    }

    private void ensureNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            return;
        }
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager == null) {
            return;
        }
        NotificationChannel channel = new NotificationChannel(CHANNEL_ID, "下载任务", NotificationManager.IMPORTANCE_LOW);
        channel.setDescription("用于托管 Android 原生下载任务与队列状态。");
        manager.createNotificationChannel(channel);
    }

    private String safe(String value, String fallback) {
        return value == null || value.trim().isEmpty() ? fallback : value.trim();
    }

    private String nullable(String value) {
        return value == null || value.trim().isEmpty() ? null : value.trim();
    }
}
