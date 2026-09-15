package de.dorfly.app;

import android.os.Bundle;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.JSExport;
import com.getcapacitor.Logger;
import java.util.Collections;

public class MainActivity extends BridgeActivity {

    // Capacitor injiziert seine JS-Bridge nur fuer den Origin aus server.url (dorfly.de).
    // Die App laeuft pro Gemeinde auf einer Subdomain, wo dadurch cordova.js fehlt und
    // OneSignal nicht startet. iOS braucht das nicht: WKUserScript kennt keinen Origin-Filter.
    private static final String GEMEINDE_ORIGIN = "https://*.dorfly.de";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        injiziereBridgeFuerGemeindeSubdomains();
    }

    private void injiziereBridgeFuerGemeindeSubdomains() {
        if (!WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) {
            Logger.warn("DOCUMENT_START_SCRIPT nicht verfuegbar, Push bleibt auf Gemeinde-Subdomains inaktiv");
            return;
        }

        try {
            String script =
                JSExport.getGlobalJS(this, getBridge().getConfig().isLoggingEnabled(), getBridge().isDevMode()) +
                "\n\n" +
                "window.WEBVIEW_SERVER_URL = '" + getBridge().getLocalUrl() + "';" +
                "\n\n" +
                JSExport.getBridgeJS(this) +
                "\n\n" +
                JSExport.getCordovaJS(this) +
                "\n\n" +
                JSExport.getCordovaPluginsFileJS(this) +
                "\n\n" +
                JSExport.getCordovaPluginJS(this);

            WebViewCompat.addDocumentStartJavaScript(getBridge().getWebView(), script, Collections.singleton(GEMEINDE_ORIGIN));
        } catch (Exception e) {
            Logger.error("Bridge-Injektion fuer Gemeinde-Subdomains fehlgeschlagen", e);
        }
    }
}
