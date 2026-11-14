package top.easyboardgame.app;

import android.app.Activity;
import android.os.Bundle;
import android.view.View;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;

/** 独立的外站浏览器，不向外站暴露平台的 Capacitor 桥。 */
public class ExternalBrowserActivity extends Activity {
    private WebView webView;
    private void applyFullscreen() {
        getWindow().getDecorView().setSystemUiVisibility(
            View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY | View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION);
    }

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        applyFullscreen();
        FrameLayout root = new FrameLayout(this);
        webView = new WebView(this);
        webView.getSettings().setJavaScriptEnabled(true);
        webView.getSettings().setDomStorageEnabled(true);
        webView.setWebViewClient(new WebViewClient());
        root.addView(webView, new FrameLayout.LayoutParams(-1, -1));
        setContentView(root);
        webView.loadUrl(getIntent().getStringExtra("url"));
    }

    @Override public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) applyFullscreen();
    }

    @Override public void onBackPressed() {
        if (webView.canGoBack()) webView.goBack(); else finish();
    }

    @Override protected void onDestroy() {
        webView.destroy();
        super.onDestroy();
    }
}
