import { useState } from "react";
import { ShieldAlert, Settings, RefreshCw, X } from "lucide-react";
import { usePermissions } from "@/hooks/usePermissions";

const STEPS = {
  chrome:  ['Click the 🔒 icon in the address bar', 'Select "Site settings"', 'Set Camera to "Allow"', 'Click "Retry" below'],
  safari:  ['Tap "AA" in the address bar', 'Select "Website Settings"', 'Set Camera to "Allow"', 'Tap "Retry" below'],
  android: ['Open browser Settings → Site Settings → Camera', 'Find this site and set Camera to "Allow"', 'Return here and tap "Retry"'],
  default: ['Look for a lock/camera icon in your browser address bar', 'Allow camera access for this site', 'Click "Retry" below'],
};

function getSteps() {
  const ua = navigator.userAgent;
  if (/Android/.test(ua)) return STEPS.android;
  if (/Safari/.test(ua) && !/Chrome/.test(ua)) return STEPS.safari;
  if (/Chrome/.test(ua)) return STEPS.chrome;
  return STEPS.default;
}

/**
 * PermissionGate — camera permission wrapper.
 *
 * The ONLY job of handleClick is to call getUserMedia() immediately
 * as the first synchronous action inside the user gesture, so every
 * browser (iOS Safari, Android Chrome, Desktop) shows its native popup.
 *
 * A denial modal is shown ONLY after the browser has already rejected access.
 */
export default function PermissionGate({ permission = "camera", onGranted, children }) {
  const { openSettings } = usePermissions();
  const [denied, setDenied] = useState(false);
  const [retrying, setRetrying] = useState(false);

  // Called directly by the button — NO awaits before getUserMedia
  const handleClick = () => {
    if (permission !== "camera") {
      onGranted?.();
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      console.error("[PermissionGate] navigator.mediaDevices.getUserMedia is not available");
      setDenied(true);
      return;
    }

    console.log("[PermissionGate] Requesting camera — triggering native permission popup");

    // getUserMedia called synchronously within the click event — this is what triggers the OS popup
    navigator.mediaDevices.getUserMedia({ video: true, audio: false })
      .then((stream) => {
        console.log("[PermissionGate] Camera permission granted");
        // Stop the probe stream immediately — the real camera will be opened by onGranted
        stream.getTracks().forEach(t => t.stop());
        onGranted?.();
      })
      .catch((err) => {
        console.warn("[PermissionGate] Camera permission denied or error:", err.name, err.message);
        setDenied(true);
      });
  };

  const handleRetry = () => {
    setRetrying(true);
    navigator.mediaDevices.getUserMedia({ video: true, audio: false })
      .then((stream) => {
        stream.getTracks().forEach(t => t.stop());
        setRetrying(false);
        setDenied(false);
        onGranted?.();
      })
      .catch((err) => {
        console.warn("[PermissionGate] Retry denied:", err.name);
        setRetrying(false);
      });
  };

  return (
    <>
      {children(handleClick)}

      {denied && (
        <div
          className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
        >
          <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden">
            <div className="px-6 pt-6 pb-5 bg-indigo-50 border-b border-indigo-100">
              <div className="flex items-start justify-between mb-3">
                <div className="w-14 h-14 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-lg">
                  <ShieldAlert className="h-7 w-7 text-white" />
                </div>
                <button onClick={() => setDenied(false)} className="p-2 rounded-xl hover:bg-black/5 text-gray-400">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <h2 className="font-bold text-lg text-gray-900">Camera Access Blocked</h2>
              <p className="text-sm text-gray-500 mt-1 leading-relaxed">
                Your browser has blocked camera access. Follow these steps to enable it:
              </p>
            </div>

            <div className="px-6 py-5 space-y-4">
              <div className="rounded-2xl p-4 bg-indigo-50 border border-indigo-200">
                <div className="space-y-2">
                  {getSteps().map((step, i) => (
                    <div key={i} className="flex items-start gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5">
                        {i + 1}
                      </span>
                      <p className="text-xs text-gray-700 leading-relaxed">{step}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <button
                  onClick={openSettings}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-500 transition-all active:scale-95"
                >
                  <Settings className="h-4 w-4" /> Open Device Settings
                </button>
                <button
                  onClick={handleRetry}
                  disabled={retrying}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-bold border border-gray-200 text-gray-700 hover:bg-gray-50 transition-all disabled:opacity-60"
                >
                  <RefreshCw className={`h-4 w-4 ${retrying ? "animate-spin" : ""}`} />
                  {retrying ? "Checking…" : "Retry"}
                </button>
              </div>

              <button onClick={() => setDenied(false)} className="w-full text-center text-xs text-gray-400 hover:text-gray-600 py-1">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}