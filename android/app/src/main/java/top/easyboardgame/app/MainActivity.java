package top.easyboardgame.app;

import android.content.pm.ActivityInfo;
import android.content.res.Configuration;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.WebView;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.WebViewListener;
import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import org.json.JSONException;
import org.json.JSONObject;
import top.easyboardgame.app.AppUpdatePlugin;
import top.easyboardgame.app.GamePackagePlugin;

public class MainActivity extends BridgeActivity {

    private static final String ORIENTATION_MAP_ASSET = "game-orientation-map.json";
    private static final String ANDROID_BUILD_META_ASSET = "public/android-build-meta.json";
    private static final String TAG = "MainActivity";
    private static final long URL_POLL_INTERVAL_MS = 400L;
    private static final String PLAY_SEGMENT = "play";
    private static final String ORIENTATION_LANDSCAPE = GameOrientationPolicy.LANDSCAPE;
    private static final String ORIENTATION_PORTRAIT = GameOrientationPolicy.PORTRAIT;
    private static final String HOME_STYLE_BOOK = "book";
    private static final String HOME_STYLE_CLASSIC = "classic";
    private static final String HOME_STYLE_QUERY_VERSION_KEY = "homeStyleVersion";
    private static final String HOME_STYLE_QUERY_VERSION = "classic-default-v1";
    private static final String CAPGO_NEXT_VERSION_PREF = "nextVersion";
    private static final String CAPGO_FALLBACK_VERSION_PREF = "pastVersion";
    private static final String CAPGO_BUILTIN_BUNDLE_ID = "builtin";
    private static final long[] WINDOW_MODE_REAPPLY_DELAYS_MS = new long[] { 80L, 240L, 600L };
    private static final String APP_HIDDEN_EVENT_SCRIPT =
        "(function(){try{" +
        "window.dispatchEvent(new CustomEvent('bg-shell-app-hidden'));" +
        "document.dispatchEvent(new CustomEvent('bg-shell-app-hidden'));" +
        "document.querySelectorAll('audio,video').forEach(function(media){" +
        "try{media.pause();}catch(_error){}" +
        "});" +
        "}catch(_error){}})();";
    private static final String APP_VISIBLE_EVENT_SCRIPT =
        "(function(){try{" +
        "window.dispatchEvent(new CustomEvent('bg-shell-app-visible'));" +
        "document.dispatchEvent(new CustomEvent('bg-shell-app-visible'));" +
        "}catch(_error){}})();";

    private final Handler orientationHandler = new Handler(Looper.getMainLooper());
    private final Map<String, String> gameOrientations = new HashMap<>();
    private final Runnable windowModeReapply = new Runnable() {
        @Override
        public void run() {
            applyWindowMode(lastNeedsImmersiveWindow);
        }
    };
    private final Runnable orientationPoller = new Runnable() {
        @Override
        public void run() {
            syncOrientationFromWebView();
            orientationHandler.postDelayed(this, URL_POLL_INTERVAL_MS);
        }
    };

    private int lastRequestedOrientation = ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED;
    private boolean lastNeedsImmersiveWindow = false;
    private boolean orientationPolling = false;
    private boolean forceBuiltinBundleByBuild = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        WebView.setWebContentsDebuggingEnabled(true);
        // App 启动阶段还拿不到 WebView 真实路由；默认先保持横屏，避免 /play/:gameId/tutorial
        // 这类游戏教程页在原生壳里先闪到竖屏。路由上报后仍由 game-orientation-map 决定最终方向。
        lastRequestedOrientation = ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE;
        lastNeedsImmersiveWindow = true;
        setRequestedOrientation(lastRequestedOrientation);
        gameOrientations.putAll(loadOrientationMap());
        forceBuiltinBundleByBuild = loadForceBuiltinBundleFlag();
        if (forceBuiltinBundleByBuild) {
            forceBuiltinCapgoBundleSelection();
        }
        registerPlugin(GamePackagePlugin.class);
        registerPlugin(AppUpdatePlugin.class);
        bridgeBuilder.addWebViewListener(
            new WebViewListener() {
                @Override
                public void onPageStarted(WebView webView) {
                    syncOrientation(webView.getUrl());
                }

                @Override
                public void onPageCommitVisible(WebView view, String url) {
                    syncOrientation(url);
                }

                @Override
                public void onPageLoaded(WebView webView) {
                    syncOrientation(webView.getUrl());
                }
            }
        );
        super.onCreate(savedInstanceState);
        applyWindowMode(true);
        scheduleWindowModeReapply();
    }

    @Override
    public void onResume() {
        super.onResume();
        startOrientationPolling();
        syncOrientationFromWebView();
        scheduleWindowModeReapply();
        dispatchLifecycleScript(APP_VISIBLE_EVENT_SCRIPT);
    }

    @Override
    public void onPause() {
        stopOrientationPolling();
        clearScheduledWindowModeReapply();
        dispatchLifecycleScript(APP_HIDDEN_EVENT_SCRIPT);
        super.onPause();
    }

    @Override
    public void onDestroy() {
        stopOrientationPolling();
        clearScheduledWindowModeReapply();
        super.onDestroy();
    }

    @Override
    public void onConfigurationChanged(Configuration newConfig) {
        super.onConfigurationChanged(newConfig);
        applyWindowMode(lastNeedsImmersiveWindow);
        scheduleWindowModeReapply();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            applyWindowMode(lastNeedsImmersiveWindow);
            scheduleWindowModeReapply();
        }
    }

    private void startOrientationPolling() {
        if (orientationPolling) {
            return;
        }
        orientationPolling = true;
        orientationHandler.post(orientationPoller);
    }

    private void stopOrientationPolling() {
        orientationPolling = false;
        orientationHandler.removeCallbacks(orientationPoller);
    }

    private void syncOrientationFromWebView() {
        if (getBridge() == null) {
            return;
        }
        WebView webView = getBridge().getWebView();
        if (webView == null) {
            return;
        }
        syncOrientation(webView.getUrl());
    }

    private void syncOrientation(String url) {
        if (url == null || url.isEmpty()) {
            return;
        }
        final boolean isGamePage = extractGameId(url) != null;
        final boolean isHomeV2Page = isHomeV2Route(url);
        final boolean needsImmersiveWindow = isGamePage || isHomeV2Page;
        final int requestedOrientation = resolveRequestedOrientation(url);
        if (requestedOrientation == lastRequestedOrientation && needsImmersiveWindow == lastNeedsImmersiveWindow) {
            return;
        }
        lastRequestedOrientation = requestedOrientation;
        lastNeedsImmersiveWindow = needsImmersiveWindow;
        runOnUiThread(() -> {
            setRequestedOrientation(requestedOrientation);
            applyWindowMode(needsImmersiveWindow);
            scheduleWindowModeReapply();
        });
    }

    private int resolveRequestedOrientation(String url) {
        String gameId = extractGameId(url);
        if (gameId != null) {
            String orientation = GameOrientationPolicy.resolve(gameOrientations, gameId);
            if (ORIENTATION_LANDSCAPE.equals(orientation)) {
                return ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE;
            }
            return ActivityInfo.SCREEN_ORIENTATION_PORTRAIT;
        }

        if (isHomeV2Route(url)) {
            return ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE;
        }

        if (isHomeEntryRoute(url)) {
            return ActivityInfo.SCREEN_ORIENTATION_PORTRAIT;
        }

        return ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED;
    }

    private boolean isHomeV2Route(String url) {
        if (url == null || url.isEmpty()) {
            return false;
        }

        android.net.Uri uri = android.net.Uri.parse(url);
        if (!isHomeEntryRoute(uri)) {
            return false;
        }

        String explicitHomeStyle = readHomeEntryStyle(uri);
        if (HOME_STYLE_CLASSIC.equals(explicitHomeStyle)) {
            return false;
        }
        if (HOME_STYLE_BOOK.equals(explicitHomeStyle)) {
            return true;
        }

        return false;
    }
    private String readHomeEntryStyle(android.net.Uri uri) {
        if (uri == null) {
            return null;
        }

        String style = uri.getQueryParameter("homeStyle");
        if (HOME_STYLE_CLASSIC.equals(style)) {
            return style;
        }
        if (HOME_STYLE_BOOK.equals(style) && hasCurrentHomeStyleVersion(uri)) {
            return style;
        }

        String fragment = uri.getFragment();
        if (fragment == null || fragment.isEmpty()) {
            return null;
        }

        android.net.Uri fragmentUri = android.net.Uri.parse("https://localhost/?" + fragment);
        String fragmentStyle = fragmentUri.getQueryParameter("homeStyle");
        if (HOME_STYLE_CLASSIC.equals(fragmentStyle)) {
            return fragmentStyle;
        }
        if (HOME_STYLE_BOOK.equals(fragmentStyle) && hasCurrentHomeStyleVersion(fragmentUri)) {
            return fragmentStyle;
        }

        return null;
    }

    private boolean hasCurrentHomeStyleVersion(android.net.Uri uri) {
        if (uri == null) {
            return false;
        }
        return HOME_STYLE_QUERY_VERSION.equals(uri.getQueryParameter(HOME_STYLE_QUERY_VERSION_KEY));
    }
    private boolean isHomeEntryRoute(String url) {
        if (url == null || url.isEmpty()) {
            return false;
        }

        return isHomeEntryRoute(android.net.Uri.parse(url));
    }

    private boolean isHomeEntryRoute(android.net.Uri uri) {
        if (uri == null) {
            return false;
        }

        List<String> segments = uri.getPathSegments();
        boolean isRootPath = segments.isEmpty() || (segments.size() == 1 && "index.html".equals(segments.get(0)));
        return isRootPath;
    }

    private String extractGameId(String url) {
        if (url == null || url.isEmpty()) {
            return null;
        }

        List<String> segments = android.net.Uri.parse(url).getPathSegments();
        if (segments.size() < 2) {
            return null;
        }
        if (!PLAY_SEGMENT.equals(segments.get(0))) {
            return null;
        }
        return segments.get(1);
    }

    private Map<String, String> loadOrientationMap() {
        Map<String, String> map = new HashMap<>();
        try (InputStream inputStream = getAssets().open(ORIENTATION_MAP_ASSET)) {
            String raw = readAll(inputStream);
            JSONObject json = new JSONObject(raw);
            Iterator<String> keys = json.keys();
            while (keys.hasNext()) {
                String key = keys.next();
                map.put(key, json.optString(key, ORIENTATION_LANDSCAPE));
            }
        } catch (IOException | JSONException ignored) {
            // Game routes default to landscape when the generated map is unavailable.
        }
        return map;
    }

    private boolean loadForceBuiltinBundleFlag() {
        try (InputStream inputStream = getAssets().open(ANDROID_BUILD_META_ASSET)) {
            String raw = readAll(inputStream);
            JSONObject json = new JSONObject(raw);
            return json.optBoolean("forceBuiltinBundle", false);
        } catch (IOException | JSONException ignored) {
            return false;
        }
    }

    private void forceBuiltinCapgoBundleSelection() {
        try {
            SharedPreferences prefs = getSharedPreferences(
                com.getcapacitor.plugin.WebView.WEBVIEW_PREFS_NAME,
                MODE_PRIVATE
            );
            prefs.edit()
                .putString(com.getcapacitor.plugin.WebView.CAP_SERVER_PATH, "public")
                .putString(CAPGO_FALLBACK_VERSION_PREF, CAPGO_BUILTIN_BUNDLE_ID)
                .remove(CAPGO_NEXT_VERSION_PREF)
                .apply();
            Log.i(TAG, "forceBuiltinCapgoBundleSelection applied");
        } catch (Exception error) {
            Log.w(TAG, "forceBuiltinCapgoBundleSelection failed", error);
        }
    }

    private String readAll(InputStream inputStream) throws IOException {
        StringBuilder builder = new StringBuilder();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(inputStream, StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) {
                builder.append(line);
            }
        }
        return builder.toString();
    }

    private void scheduleWindowModeReapply() {
        clearScheduledWindowModeReapply();
        if (!lastNeedsImmersiveWindow) {
            return;
        }
        for (long delayMs : WINDOW_MODE_REAPPLY_DELAYS_MS) {
            orientationHandler.postDelayed(windowModeReapply, delayMs);
        }
    }

    private void clearScheduledWindowModeReapply() {
        orientationHandler.removeCallbacks(windowModeReapply);
    }

    private void applyWindowMode(boolean isGamePage) {
        Window window = getWindow();
        if (window == null) {
            return;
        }

        hideActionBarIfPresent();

        WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(window, window.getDecorView());
        if (controller == null) {
            return;
        }

        WindowCompat.setDecorFitsSystemWindows(window, !isGamePage);
        window.clearFlags(WindowManager.LayoutParams.FLAG_FORCE_NOT_FULLSCREEN);
        window.setSoftInputMode(
            WindowManager.LayoutParams.SOFT_INPUT_STATE_UNSPECIFIED
                | (isGamePage
                    ? WindowManager.LayoutParams.SOFT_INPUT_ADJUST_NOTHING
                    : WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE)
        );
        if (isGamePage) {
            // 游戏页必须进入真正的沉浸式全屏。
            // 之前只隐藏了 status bar，底部 navigation/gesture bar 仍会占用 inset，
            // WebView 读到的 viewport 高度被压缩，safe-area-bottom 也会继续生效，
            // 最终表现为页面底部被“系统条”往上挤。
            window.addFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN);
            window.getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                    | View.SYSTEM_UI_FLAG_FULLSCREEN
                    | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                    | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                    | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                    | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
            );
            controller.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
            controller.hide(WindowInsetsCompat.Type.systemBars());
            return;
        }

        window.clearFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN);
        window.getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LAYOUT_STABLE);
        controller.show(WindowInsetsCompat.Type.systemBars());
    }

    private void hideActionBarIfPresent() {
        if (getSupportActionBar() != null) {
            getSupportActionBar().hide();
        }
    }

    private void dispatchLifecycleScript(String script) {
        if (getBridge() == null) {
            return;
        }
        WebView webView = getBridge().getWebView();
        if (webView == null) {
            return;
        }
        webView.post(() -> webView.evaluateJavascript(script, null));
    }
}
