package com.docflow.app;

import com.getcapacitor.BridgeActivity;

/**
 * Registers the plugins this app implements itself.
 *
 * `CapturePlugin` is the on-device speech and OCR bridge (v6 §N). It is
 * written here rather than pulled in as a dependency because the rule it has
 * to keep — recognition never leaves the phone — is not one any off-the-shelf
 * speech plugin enforces: they all fall back to the cloud, and most of them
 * treat that as a feature.
 */
public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(android.os.Bundle savedInstanceState) {
        registerPlugin(CapturePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
