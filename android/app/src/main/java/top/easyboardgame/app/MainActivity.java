package top.easyboardgame.app;

import android.content.pm.ActivityInfo;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.webkit.WebView;
import android.view.Window;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.WebViewListener;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
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

public class MainActivity extends BridgeActivity {

    private static final String ORIENTATION_MAP_ASSET = "game-orientation-map.json";
    private static final long URL_POLL_INTERVAL_MS = 400L;
    private static final String PLAY_SEGMENT = "play";
    private static final String ORIENTATION_LANDSCAPE = "landscape";
    private static final String ORIENTATION_PORTRAIT = "portrait";
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
    private final Runnable orientationPoller = new Runnable() {
        @Override
        public void run() {
            syncOrientationFromWebView();
            orientationHandler.postDelayed(this, URL_POLL_INTERVAL_MS);
        }
    };

    private int lastRequestedOrientation = ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED;
    private boolean lastIsGamePage = false;
    private boolean orientationPolling = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        gameOrientations.putAll(loadOrientationMap());
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
    }

    @Override
    public void onResume() {
        super.onResume();
        startOrientationPolling();
        syncOrientationFromWebView();
        dispatchLifecycleScript(APP_VISIBLE_EVENT_SCRIPT);
    }

    @Override
    public void onPause() {
        stopOrientationPolling();
        dispatchLifecycleScript(APP_HIDDEN_EVENT_SCRIPT);
        super.onPause();
    }

    @Override
    public void onDestroy() {
        stopOrientationPolling();
        super.onDestroy();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            applyWindowMode(lastIsGamePage);
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
        final boolean isGamePage = extractGameId(url) != null;
        final int requestedOrientation = resolveRequestedOrientation(url);
        if (requestedOrientation == lastRequestedOrientation && isGamePage == lastIsGamePage) {
            return;
        }
        lastRequestedOrientation = requestedOrientation;
        lastIsGamePage = isGamePage;
        runOnUiThread(() -> {
            setRequestedOrientation(requestedOrientation);
            applyWindowMode(isGamePage);
        });
    }

    private int resolveRequestedOrientation(String url) {
        String gameId = extractGameId(url);
        if (gameId == null) {
            return ActivityInfo.SCREEN_ORIENTATION_PORTRAIT;
        }

        String orientation = gameOrientations.getOrDefault(gameId, ORIENTATION_PORTRAIT);
        if (ORIENTATION_LANDSCAPE.equals(orientation)) {
            return ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE;
        }
        return ActivityInfo.SCREEN_ORIENTATION_PORTRAIT;
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
                map.put(key, json.optString(key, ORIENTATION_PORTRAIT));
            }
        } catch (IOException | JSONException ignored) {
            // Fallback to portrait when the generated map is unavailable.
        }
        return map;
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

    private void applyWindowMode(boolean isGamePage) {
        Window window = getWindow();
        if (window == null) {
            return;
        }

        WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(window, window.getDecorView());
        if (controller == null) {
            return;
        }

        WindowCompat.setDecorFitsSystemWindows(window, !isGamePage);
        if (isGamePage) {
            controller.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
            controller.hide(WindowInsetsCompat.Type.statusBars());
            return;
        }

        controller.show(WindowInsetsCompat.Type.statusBars());
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
