import { useState } from "react";
import { Camera, Mic, MapPin, ShieldAlert, Settings, RefreshCw, X, CheckCircle2 } from "lucide-react";
import { usePermissions } from "@/hooks/usePermissions";

const PERM_META = {
  camera: {
    icon: Camera,
    color: "#6366f1",
    bg: "bg-indigo-50",
    border: "border-indigo-200",
    title: "Camera Access Required",
    description: "This feature needs access to your camera to scan documents, receipts, and other business records.",
    steps: {
      chrome: ['Tap the 🔒 or 📷 icon in the address bar', 'Select "Site settings"', 'Set Camera to "Allow"', 'Tap "Retry" below'],
      safari: ['Tap "AA" or the 🔒 icon in the address bar', 'Select "Website Settings"', 'Set Camera to "Allow"', 'Tap "Retry" below'],
      android: ['Open your browser Settings → Site Settings → Camera', 'Find this site and set Camera to "Allow"', 'Return here and tap "Retry"'],
      default: ['Look for a camera/lock icon in your browser\'s address bar', 'Allow camera access for this site', 'Tap "Retry" below'],
    },
  },
  microphone: {
    icon: Mic,
    color: "#8b5cf6",
    bg: "bg-violet-50",
    border: "border-violet-200",
    title: "Microphone Access Required",
    description: "This feature needs microphone access to record audio.",
    steps: {
      default: ['Look for a microphone icon in your browser\'s address bar', 'Allow microphone access for this site', 'Tap "Retry" below'],
    },
  },
  location: {
    icon: MapPin,
    color: "#10b981",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    title: "Location Access Required",
    description: "This feature uses your location.",
    steps: {
      default: ['Allow location access when your browser asks', 'Or check your browser site settings', 'Tap "Retry" below'],
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

/**
 * PermissionGate wraps any action that requires a device permission.
 * 
 * Usage:
 *   <PermissionGate permission="camera" onGranted={() => setShowCamera(true)}>
 *     {(handleClick) => <button onClick={handleClick}>Scan Document</button>}
 *   </PermissionGate>
 */
export default function PermissionGate({ permission = "camera", onGranted, children }) {
  const { statuses, requestCamera, requestMicrophone, requestLocation, openSettings, refresh } = usePermissions();
  const [showModal, setShowModal] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [result, setResult] = useState(null); // "granted" | "denied" | "error" | null

  const meta = PERM_META[permission] || PERM_META.camera;
  const Icon = meta.icon;
  const currentStatus = statuses[permission];

  const requestFn = { camera: requestCamera, microphone: requestMicrophone, location: requestLocation }[permission];

  const handleClick = async () => {
    // Already granted — proceed directly
    if (currentStatus === "granted") {
      onGranted?.();
      return;
    }

    // Status is "prompt" or "unknown" — try requesting directly (triggers native popup)
    if (currentStatus === "prompt" || currentStatus === "unknown") {
      setRequesting(true);
      setShowModal(true);
      setResult(null);
      const res = await requestFn();
      setRequesting(false);
      setResult(res);
      if (res === "granted") {
        setTimeout(() => { setShowModal(false); onGranted?.(); }, 600);
      }
      return;
    }

    // Already denied — show instructions modal
    setResult("denied");
    setShowModal(true);
  };

  const handleRetry = async () => {
    setRequesting(true);
    setResult(null);
    await refresh();
    const res = await requestFn();
    setRequesting(false);
    setResult(res);
    if (res === "granted") {
      setTimeout(() => { setShowModal(false); onGranted?.(); }, 600);
    }
  };

  const steps = getSteps(meta);

  return (
    <>
      {children(handleClick)}

      {showModal && (
        <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}>
          <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="px-6 pt-6 pb-5" style={{ background: `linear-gradient(135deg, ${meta.color}18, ${meta.color}08)`, borderBottom: `1px solid ${meta.color}22` }}>
              <div className="flex items-start justify-between mb-3">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg" style={{ background: `linear-gradient(135deg, ${meta.color}, ${meta.color}cc)` }}>
                  <Icon className="h-7 w-7 text-white" />
                </div>
                <button onClick={() => setShowModal(false)} className="p-2 rounded-xl hover:bg-black/5 text-gray-400 transition-colors">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <h2 className="font-bold text-lg text-gray-900">{meta.title}</h2>
              <p className="text-sm text-gray-500 mt-1 leading-relaxed">{meta.description}</p>
            </div>

            <div className="px-6 py-5 space-y-4">
              {/* Requesting state */}
              {requesting && (
                <div className="flex flex-col items-center gap-3 py-4">
                  <div className="w-12 h-12 rounded-full border-4 border-gray-100 animate-spin" style={{ borderTopColor: meta.color }} />
                  <p className="text-sm text-gray-500 font-medium">Waiting for permission…</p>
                  <p className="text-xs text-gray-400 text-center">Your browser should be showing a permission popup. Please select "Allow".</p>
                </div>
              )}

              {/* Granted */}
              {result === "granted" && !requesting && (
                <div className="flex flex-col items-center gap-2 py-4">
                  <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
                    <CheckCircle2 className="h-7 w-7 text-emerald-500" />
                  </div>
                  <p className="text-sm font-bold text-emerald-700">Access Granted!</p>
                  <p className="text-xs text-gray-400">Opening now…</p>
                </div>
              )}

              {/* Denied — show step-by-step instructions */}
              {(result === "denied" || result === "error") && !requesting && (
                <>
                  <div className={`rounded-2xl p-4 ${meta.bg} ${meta.border} border`}>
                    <p className="text-sm font-bold mb-3" style={{ color: meta.color }}>
                      {result === "denied" ? "⛔ Permission Blocked" : "⚠️ Access Unavailable"}
                    </p>
                    <p className="text-xs text-gray-600 mb-3 leading-relaxed">
                      {result === "denied"
                        ? "Your browser has blocked access. Follow these steps to enable it:"
                        : "Could not access this feature. Please check your browser settings."}
                    </p>
                    <div className="space-y-2">
                      {steps.map((step, i) => (
                        <div key={i} className="flex items-start gap-2.5">
                          <span className="w-5 h-5 rounded-full text-white text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5"
                            style={{ background: meta.color }}>{i + 1}</span>
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
                      className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-bold border border-gray-200 text-gray-700 hover:bg-gray-50 transition-all"
                    >
                      <RefreshCw className="h-4 w-4" /> Retry
                    </button>
                  </div>
                </>
              )}

              {/* Initial state — hasn't requested yet, show prompt */}
              {!requesting && !result && (
                <div className="space-y-2">
                  <button
                    onClick={handleRetry}
                    className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl text-sm font-bold text-white transition-all active:scale-95"
                    style={{ background: `linear-gradient(135deg, ${meta.color}, ${meta.color}cc)` }}
                  >
                    <Icon className="h-4 w-4" /> Allow Access
                  </button>
                </div>
              )}

              <button onClick={() => setShowModal(false)} className="w-full text-center text-xs text-gray-400 hover:text-gray-600 transition-colors py-1">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}