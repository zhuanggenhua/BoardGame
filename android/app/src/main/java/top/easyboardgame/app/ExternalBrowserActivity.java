package top.easyboardgame.app;

import android.app.Activity;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;

/** 独立的外站浏览器，不向外站暴露平台的 Capacitor 桥。 */
public class ExternalBrowserActivity extends Activity {
    private WebView webView;
    private boolean fullscreen;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        FrameLayout root = new FrameLayout(this);
        webView = new WebView(this);
        webView.getSettings().setJavaScriptEnabled(true);
        webView.getSettings().setDomStorageEnabled(true);
        webView.setWebViewClient(new WebViewClient());
        root.addView(webView, new FrameLayout.LayoutParams(-1, -1));
        LinearLayout controls = new LinearLayout(this);
        Button menu = new Button(this);
        menu.setText("☰");
        Button back = new Button(this);
        back.setText("返回平台");
        back.setOnClickListener(v -> finish());
        Button toggle = new Button(this);
        toggle.setText("全屏");
        toggle.setOnClickListener(v -> {
            fullscreen = !fullscreen;
            getWindow().getDecorView().setSystemUiVisibility(fullscreen
                ? View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY | View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                : View.SYSTEM_UI_FLAG_VISIBLE);
            toggle.setText(fullscreen ? "退出全屏" : "全屏");
        });
        back.setVisibility(View.GONE);
        toggle.setVisibility(View.GONE);
        menu.setOnClickListener(v -> {
            int visibility = back.getVisibility() == View.VISIBLE ? View.GONE : View.VISIBLE;
            back.setVisibility(visibility);
            toggle.setVisibility(visibility);
        });
        controls.addView(menu);
        controls.addView(back);
        controls.addView(toggle);
        FrameLayout.LayoutParams position = new FrameLayout.LayoutParams(-2, -2, Gravity.TOP | Gravity.END);
        root.addView(controls, position);
        setContentView(root);
        webView.loadUrl(getIntent().getStringExtra("url"));
    }

    @Override public void onBackPressed() {
        if (webView.canGoBack()) webView.goBack(); else finish();
    }

    @Override protected void onDestroy() {
        webView.destroy();
        super.onDestroy();
    }
}
