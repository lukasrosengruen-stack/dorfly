import UIKit
import WebKit
import Capacitor

// Capacitor's WebViewDelegationHandler installs itself as the WKWebView's
// scrollView.delegate and disables the pinch gesture in
// scrollViewWillBeginZooming whenever ios.zoomEnabled is not set in
// capacitor.config.ts (see WebViewDelegationHandler.swift). We don't want to
// change the shared Capacitor config for this, so this subclass takes over
// the scrollView delegate after Capacitor sets it up and restores native
// pinch-to-zoom instead.
class DorflyWebViewController: CAPBridgeViewController, UIScrollViewDelegate {
    override func capacitorDidLoad() {
        super.capacitorDidLoad()

        guard let scrollView = webView?.scrollView else { return }
        scrollView.delegate = self
        scrollView.pinchGestureRecognizer?.isEnabled = true
        scrollView.minimumZoomScale = 1.0
        scrollView.maximumZoomScale = 5.0
    }

    func viewForZooming(in scrollView: UIScrollView) -> UIView? {
        return webView
    }
}
