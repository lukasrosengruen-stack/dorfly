package de.dorfly.app;

import android.os.Bundle;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.JSExport;
import com.getcapacitor.Logger;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginHandle;
import com.getcapacitor.PluginManager;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;

public class MainActivity extends BridgeActivity {

    // Capacitor injiziert seine JS-Bridge nur fuer den Origin aus server.url (dorfly.de).
    // Die App laeuft pro Gemeinde auf einer Subdomain, wo dadurch cordova.js fehlt und
    // OneSignal nicht startet. iOS braucht das nicht: WKUserScript kennt keinen Origin-Filter.
    private static final String GEMEINDE_ORIGIN = "https://*.dorfly.de";

    // Plugins, die Capacitor selbst registriert (Bridge.registerAllPlugins), ohne Eintrag in
    // capacitor.plugins.json.
    private static final List<Class<? extends Plugin>> KERN_PLUGINS = Arrays.asList(
        com.getcapacitor.plugin.CapacitorCookies.class,
        com.getcapacitor.plugin.WebView.class,
        com.getcapacitor.plugin.CapacitorHttp.class,
        com.getcapacitor.plugin.SystemBars.class
    );

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        injiziereBridgeFuerGemeindeSubdomains();
    }

    // Baut dasselbe Skript nach wie Bridge.getJSInjector(). Fehlt dabei die Plugin-Liste
    // (getPluginJS), haelt @capacitor/core Camera, Geolocation usw. fuer nicht vorhanden und
    // nimmt die Web-Variante, die in der App scheitert. Bei jedem Capacitor-Update mit
    // Bridge.getJSInjector() und Bridge.registerAllPlugins() abgleichen.
    private void injiziereBridgeFuerGemeindeSubdomains() {
        if (!WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) {
            Logger.warn("DOCUMENT_START_SCRIPT nicht verfuegbar, native Plugins bleiben auf Gemeinde-Subdomains inaktiv");
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
                JSExport.getPluginJS(registriertePlugins()) +
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

    // Die Bridge gibt ihre Plugin-Liste nicht heraus, daher dieselben Quellen wie in
    // Bridge.registerAllPlugins() lesen und die Handles einzeln per ID holen.
    private List<PluginHandle> registriertePlugins() throws Exception {
        List<Class<? extends Plugin>> klassen = new ArrayList<>(KERN_PLUGINS);
        klassen.addAll(new PluginManager(getAssets()).loadPluginClasses());

        List<PluginHandle> handles = new ArrayList<>();
        for (Class<? extends Plugin> klasse : klassen) {
            PluginHandle handle = getBridge().getPlugin(pluginId(klasse));
            if (handle != null) {
                handles.add(handle);
            } else {
                Logger.warn("Plugin nicht registriert, fehlt auf Gemeinde-Subdomains: " + klasse.getName());
            }
        }
        return handles;
    }

    // Entspricht Bridge.pluginId() fuer Plugins mit @CapacitorPlugin.
    private static String pluginId(Class<? extends Plugin> klasse) {
        CapacitorPlugin annotation = klasse.getAnnotation(CapacitorPlugin.class);
        if (annotation != null && !annotation.name().isEmpty()) {
            return annotation.name();
        }
        return klasse.getSimpleName();
    }
}
