package live.kalasutra.app;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.provider.MediaStore;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.activity.OnBackPressedCallback;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.content.FileProvider;
import androidx.webkit.WebViewAssetLoader;

import java.io.File;
import java.io.IOException;
import java.util.Locale;

/**
 * KalaSutra for Android.
 *
 * The complete site (web/) ships inside the APK as assets, including the on-device
 * background-removal model, so browsing, the seller flow and the photo studio all work
 * with no network. The API (api.kalasutra.live) is used when reachable; otherwise the
 * site's own demo mode takes over, exactly as on kalasutra.live.
 */
public class MainActivity extends AppCompatActivity {

    private static final String APP_HOST = "appassets.androidplatform.net";
    private static final String HOME = "https://" + APP_HOST + "/web/index.html";

    private WebView web;
    private ValueCallback<Uri[]> pendingChooser;
    private Uri cameraUri;

    private final ActivityResultLauncher<Intent> chooserLauncher =
            registerForActivityResult(new ActivityResultContracts.StartActivityForResult(), r -> {
                if (pendingChooser == null) return;
                Uri[] out = null;
                if (r.getResultCode() == RESULT_OK) {
                    Intent d = r.getData();
                    if (d != null && d.getData() != null) out = new Uri[]{d.getData()};
                    else if (cameraUri != null) out = new Uri[]{cameraUri};
                }
                pendingChooser.onReceiveValue(out);
                pendingChooser = null;
                cameraUri = null;
            });

    @Override
    protected void onCreate(Bundle saved) {
        super.onCreate(saved);
        web = new WebView(this);
        setContentView(web);

        WebSettings st = web.getSettings();
        st.setJavaScriptEnabled(true);
        st.setDomStorageEnabled(true);
        st.setDatabaseEnabled(true);
        st.setAllowFileAccess(false);
        st.setAllowContentAccess(true);
        st.setMediaPlaybackRequiresUserGesture(false);
        st.setUseWideViewPort(true);
        st.setLoadWithOverviewMode(true);
        st.setTextZoom(100);
        st.setCacheMode(WebSettings.LOAD_DEFAULT);

        final WebViewAssetLoader.AssetsPathHandler assets = new WebViewAssetLoader.AssetsPathHandler(this);
        final WebViewAssetLoader loader = new WebViewAssetLoader.Builder()
                .addPathHandler("/", path -> {
                    WebResourceResponse r = assets.handle(path);
                    if (r != null) {
                        String mime = mimeFor(path);
                        if (mime != null) r.setMimeType(mime);
                    }
                    return r;
                })
                .build();

        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView v, WebResourceRequest req) {
                return loader.shouldInterceptRequest(req.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest req) {
                Uri u = req.getUrl();
                if (APP_HOST.equals(u.getHost())) return false;
                try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (Exception ignored) { }
                return true;
            }
        });

        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView v, ValueCallback<Uri[]> cb, FileChooserParams p) {
                if (pendingChooser != null) pendingChooser.onReceiveValue(null);
                pendingChooser = cb;
                Intent pick = new Intent(Intent.ACTION_GET_CONTENT)
                        .addCategory(Intent.CATEGORY_OPENABLE)
                        .setType("image/*");
                Intent chooser = Intent.createChooser(pick, getString(R.string.choose_photo));
                Intent cam = cameraIntent();
                if (cam != null) chooser.putExtra(Intent.EXTRA_INITIAL_INTENTS, new Intent[]{cam});
                try {
                    chooserLauncher.launch(chooser);
                } catch (Exception e) {
                    pendingChooser = null;
                    cb.onReceiveValue(null);
                }
                return true;
            }
        });

        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (web.canGoBack()) {
                    web.goBack();
                } else {
                    setEnabled(false);
                    getOnBackPressedDispatcher().onBackPressed();
                }
            }
        });

        if (saved == null) web.loadUrl(HOME); else web.restoreState(saved);
    }

    /** Camera capture into the app cache, handed to the page through the file chooser. */
    private Intent cameraIntent() {
        try {
            File dir = new File(getCacheDir(), "camera");
            if (!dir.isDirectory() && !dir.mkdirs()) return null;
            File f = File.createTempFile("shot-", ".jpg", dir);
            cameraUri = FileProvider.getUriForFile(this, getPackageName() + ".files", f);
            return new Intent(MediaStore.ACTION_IMAGE_CAPTURE)
                    .putExtra(MediaStore.EXTRA_OUTPUT, cameraUri)
                    .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
        } catch (IOException e) {
            cameraUri = null;
            return null;
        }
    }

    /** Asset MIME types the default guesser gets wrong (module scripts must be text/javascript). */
    private static String mimeFor(String path) {
        String p = path.toLowerCase(Locale.ROOT);
        if (p.endsWith(".mjs") || p.endsWith(".js")) return "text/javascript";
        if (p.endsWith(".json")) return "application/json";
        if (p.endsWith(".wasm")) return "application/wasm";
        if (p.endsWith(".css")) return "text/css";
        if (p.endsWith(".html")) return "text/html";
        if (p.endsWith(".svg")) return "image/svg+xml";
        if (p.endsWith(".webp")) return "image/webp";
        return null;
    }

    @Override
    protected void onSaveInstanceState(@NonNull Bundle out) {
        super.onSaveInstanceState(out);
        web.saveState(out);
    }

    @Override protected void onPause() { super.onPause(); web.onPause(); }
    @Override protected void onResume() { super.onResume(); web.onResume(); }
}
