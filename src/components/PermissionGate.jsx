import { useState } from "react";
import { Camera, Mic, MapPin, Settings, RefreshCw, X, CheckCircle2, ShieldAlert } from "lucide-react";
import { usePermissions } from "@/hooks/usePermissions";

const PERM_META = {
  camera: {
    icon: Camera,
    color: "#6366f1",
    bg: "bg-indigo-50",
    border: "border-indigo-200",
    title: "Camera Access Blocked",
    description: "Camera permission was denied. To use this feature, you'll need to allow access in your browser settings.",
    steps: {
      chrome: ['Click the 🔒 or 📷 icon in the address bar', 'Select "Site settings"', 'Set Camera to "Allow"', 'Click "Retry" below'],
      safari: ['Tap "AA" or the 🔒 icon in the address bar', 'Select "Website Settings"', 'Set Camera to "Allow"', 'Tap "Retry" below'],
      android: ['Open your browser Settings → Site Settings → Camera', 'Find this site and set Camera to "Allow"', 'Return here and tap "Retry"'],
      default: ['Look for a camera/lock icon in your browser\'s address bar', 'Allow camera access for this site', 'Click "Retry" below'],
    },
  },
  microphone: {
    icon: Mic,
    color: "#8b5cf6",
    bg: "bg-violet-50",
    border: "border-violet-200",
    title: "Microphone Access Blocked",
    description: "Microphone permission was denied. Please allow access in your browser settings.",
    steps: {
      default: ['Look for a microphone icon in your browser\'s address bar', 'Allow microphone access for this site', 'Click "Retry" below'],
    },
  },
  location: {
    icon: MapPin,
    color: "#10b981",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    title: "Location Access Blocked",
    description: "Location permission was denied. Please allow access in your browser settings.",
    steps: {
      default: ['Allow location access when your browser asks', 'Or check your browser site settings', 'Click "Retry" below'],
    },
  },
};

function getSteps(meta) {
  const ua = navigator.userAgent;
  if (/Chrome/.test(ua) && !/Edg/.test(ua)) return meta.steps.chrome || meta.steps.default;
  if (/Safari/.test(ua) && !/Chrome/.test(ua)) return meta.steps.safari || meta.steps.default;
  if (/Android/.test(ua)) return meta.steps.android || meta.steps.default;
  return meta.steps.default;
}

// Directly calls getUserMedia — must be called from a user gesture for native popup to appear
async function requestCameraAccess() {
  const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
  // Stop the tracks immediately — caller will open its own stream
  stream.getTracks().forEach(t => t.stop());
  return "granted";
}

/**
 * PermissionGate — wraps camera buttons.
 * On click: immediately fires getUserMedia() to trigger the native OS permission popup.
 * Only shows a UI modal if permission was previously denied.
 */
export default function PermissionGate({ permission = "camera", onGranted, children }) {
  const { openSettings } = usePermissions();
  const [showDeniedModal, setShowDeniedModal] = useState(false);
  const [retrying, setRetrying] = useState(false);

  const meta = PERM_META[permission] || PERM_META.camera;
  const Icon = meta.icon;
  const steps = getSteps(meta);

  // This is called directly from a user click — browser will show native popup
  const handleClick = async () => {
    if (permission !== "camera") {
      // For non-camera permissions, just proceed
      onGranted?.();
      return;
    }

    try {
      await requestCameraAccess();
      // Permission granted — open the feature
      onGranted?.();
    } catch (err) {
      // NotAllowedError = denied; any other error = unavailable
      setShowDeniedModal(true);
    }
  };

  const handleRetry = async () => {
    setRetrying(true);
    try {
      await requestCameraAccess();
      setRetrying(false);
      setShowDeniedModal(false);
      onGranted?.();
    } catch {
      setRetrying(false);
      // still denied — modal stays open
    }
  };

  return (
    <>
      {children(handleClick)}

      {showDeniedModal && (
        <div
          className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
        >
          <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden">
            {/* Header */}
            <div
              className="px-6 pt-6 pb-5"
              style={{ background: `linear-gradient(135deg, ${meta.color}18, ${meta.color}08)`, borderBottom: `1px solid ${meta.color}22` }}
            >
              <div className="flex items-start justify-between mb-3">
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg"
                  style={{ background: `linear-gradient(135deg, ${meta.color}, ${meta.color}cc)` }}
                >
                  <ShieldAlert className="h-7 w-7 text-white" />
                </div>
                <button
                  onClick={() => setShowDeniedModal(false)}
                  className="p-2 rounded-xl hover:bg-black/5 text-gray-400 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <h2 className="font-bold text-lg text-gray-900">{meta.title}</h2>
              <p className="text-sm text-gray-500 mt-1 leading-relaxed">{meta.description}</p>
            </div>

            <div className="px-6 py-5 space-y-4">
              {/* Step-by-step instructions */}
              <div className={`rounded-2xl p-4 ${meta.bg} ${meta.border} border`}>
                <p className="text-xs font-bold mb-3" style={{ color: meta.color }}>
                  How to enable camera access:
                </p>
                <div className="space-y-2">
                  {steps.map((step, i) => (
                    <div key={i} className="flex items-start gap-2.5">
                      <span
                        className="w-5 h-5 rounded-full text-white text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5"
                        style={{ background: meta.color }}
                      >
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
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-bold text-white transition-all active:scale-95"
                  style={{ background: `linear-gradient(135deg, ${meta.color}, ${meta.color}cc)` }}
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

              <button
                onClick={() => setShowDeniedModal(false)}
                className="w-full text-center text-xs text-gray-400 hover:text-gray-600 transition-colors py-1"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}