package com.scanmaster.ai;

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebView;

import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.core.content.ContextCompat;

import com.getcapacitor.BridgeActivity;

/**
 * MainActivity for ScanMaster.
 *
 * Overrides default Capacitor BridgeActivity to:
 * 1. Handle camera/microphone permission requests from WebView (getUserMedia)
 * 2. Request Android runtime permissions on first launch
 * 3. Enable file input (for PDF upload, image pick)
 */
public class MainActivity extends BridgeActivity {

    // Pending WebView permission request (held until Android permission is granted)
    private PermissionRequest pendingPermissionRequest;

    // Runtime permission launcher
    private final ActivityResultLauncher<String[]> permissionLauncher =
        registerForActivityResult(new ActivityResultContracts.RequestMultiplePermissions(), result -> {
            // After Android permission dialog, grant the pending WebView request
            if (pendingPermissionRequest != null) {
                pendingPermissionRequest.grant(pendingPermissionRequest.getResources());
                pendingPermissionRequest = null;
            }
        });

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
    }

    @Override
    public void onBackPressed() {
        // DO NOT call super.onBackPressed() â€” that would immediately exit the app.
        // The JavaScript layer (App.addListener('backButton', ...)) handles all
        // navigation: stack-based view history, double-tap-to-exit on home, etc.
        // When JS decides to exit, it calls CapacitorApp.exitApp() which finishes
        // this activity natively.
    }

    @Override
    public void onStart() {
        super.onStart();

        // Override WebChromeClient to handle getUserMedia permission requests
        WebView webView = getBridge().getWebView();
        if (webView != null) {
            webView.setWebChromeClient(new WebChromeClient() {
                @Override
                public void onPermissionRequest(PermissionRequest request) {
                    // Check if we have Android-level camera permission
                    boolean hasCameraPermission = ContextCompat.checkSelfPermission(
                        MainActivity.this, Manifest.permission.CAMERA
                    ) == PackageManager.PERMISSION_GRANTED;

                    boolean hasAudioPermission = ContextCompat.checkSelfPermission(
                        MainActivity.this, Manifest.permission.RECORD_AUDIO
                    ) == PackageManager.PERMISSION_GRANTED;

                    if (hasCameraPermission && hasAudioPermission) {
                        // Already have permissions â€” grant the WebView request
                        request.grant(request.getResources());
                    } else {
                        // Need to request Android permissions first
                        pendingPermissionRequest = request;
                        permissionLauncher.launch(new String[]{
                            Manifest.permission.CAMERA,
                            Manifest.permission.RECORD_AUDIO
                        });
                    }
                }
            });
        }
    }
}
