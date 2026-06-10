import { useState, useRef, useEffect } from "react";
import { Camera, Mic, MapPin, FolderOpen, RefreshCw, Settings, ChevronRight, CheckCircle2, XCircle, HelpCircle, AlertCircle } from "lucide-react";
import { usePermissions } from "@/hooks/usePermissions";

const PERMISSIONS = [
  {
    key: "camera",
    label: "Camera",
    icon: Camera,
    color: "#6366f1",
    description: "Required for scanning documents, receipts and QR codes.",
    request: "requestCamera",
  },
  {
    key: "microphone",
    label: "Microphone",
    icon: Mic,
    color: "#8b5cf6",
    description: "Used for voice input features.",
    request: "requestMicrophone",
  },
  {
    key: "location",
    label: "Location",
    icon: MapPin,
    color: "#10b981",
    description: "Used to auto-fill business address and geotag documents.",
    request: "requestLocation",
  },
];

const STATUS_CONFIG = {
  granted:  { label: "Granted",  icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50",  border: "border-emerald-200" },
  denied:   { label: "Denied",   icon: XCircle,      color: "text-red-500",     bg: "bg-red-50",      border: "border-red-200" },
  prompt:   { label: "Not asked yet", icon: HelpCircle,   color: "text-amber-600",  bg: "bg-amber-50",    border: "border-amber-200" },
  unknown:  { label: "Unknown",  icon: AlertCircle,  color: "text-gray-400",    bg: "bg-gray-50",     border: "border-gray-200" },
};

function PermissionRow({ perm, status, onRequest, refresh, openSettings }) {
  const [loading, setLoading] = useState(false);
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.unknown;
  const StatusIcon = cfg.icon;
  const Icon = perm.icon;

  const cameraBtnRef = useRef(null);

  useEffect(() => {
    if (perm.key !== "camera" || !cameraBtnRef.current) return;
    const btn = cameraBtnRef.current;
    const handler = function () {
      if (!navigator.mediaDevices?.getUserMedia) return;
      btn.disabled = true;
      btn.textContent = "…";
      navigator.mediaDevices.getUserMedia({ video: true, audio: false })
        .then((stream) => {
          stream.getTracks().forEach((t) => t.stop());
          refresh();
          btn.disabled = false;
          btn.textContent = "Allow";
        })
        .catch(() => {
          refresh();
          btn.disabled = false;
          btn.textContent = "Allow";
        });
    };
    btn.addEventListener("click", handler);
    return () => btn.removeEventListener("click", handler);
  }, [perm.key, refresh]);

  const handleRequest = async () => {
    setLoading(true);
    await onRequest();
    setLoading(false);
  };

  return (
    <div className="flex items-center gap-4 p-4 rounded-2xl border border-border bg-white hover:shadow-sm transition-shadow">
      {/* Icon */}
      <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: `${perm.color}18` }}>
        <Icon className="h-5 w-5" style={{ color: perm.color }} />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-semibold text-sm text-foreground">{perm.label}</p>
          <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full border ${cfg.color} ${cfg.bg} ${cfg.border}`}>
            <StatusIcon className="h-3 w-3" />
            {cfg.label}
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">{perm.description}</p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 shrink-0">
        {status !== "granted" && (
          perm.key === "camera" ? (
            <button
              ref={cameraBtnRef}
              className="text-xs font-bold px-3 py-1.5 rounded-xl text-white transition-all active:scale-95"
              style={{ background: `linear-gradient(135deg, ${perm.color}, ${perm.color}cc)` }}
            >
              Allow
            </button>
          ) : (
          <button
            onClick={handleRequest}
            disabled={loading}
            className="text-xs font-bold px-3 py-1.5 rounded-xl text-white transition-all active:scale-95 disabled:opacity-60"
            style={{ background: `linear-gradient(135deg, ${perm.color}, ${perm.color}cc)` }}
          >
            {loading ? "…" : "Allow"}
          </button>
          )
        )}
        {status === "denied" && (
          <button
            onClick={openSettings}
            className="text-xs font-semibold px-3 py-1.5 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors flex items-center gap-1"
          >
            <Settings className="h-3 w-3" /> Settings
          </button>
        )}
        {status === "granted" && (
          <CheckCircle2 className="h-5 w-5 text-emerald-500" />
        )}
      </div>
    </div>
  );
}

export default function PermissionsPanel() {
  const { statuses, refresh, requestCamera, requestMicrophone, requestLocation, openSettings } = usePermissions();

  const [refreshing, setRefreshing] = useState(false);

  const requestMap = { camera: requestCamera, microphone: requestMicrophone, location: requestLocation };

  const handleRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setTimeout(() => setRefreshing(false), 600);
  };

  const ua = navigator.userAgent;
  const isIOS = /iPhone|iPad|iPod/.test(ua);
  const isAndroid = /Android/.test(ua);
  const browser = /Chrome/.test(ua) && !/Edg/.test(ua) ? "Chrome"
    : /Edg/.test(ua) ? "Edge"
    : /Firefox/.test(ua) ? "Firefox"
    : /Safari/.test(ua) ? "Safari"
    : "your browser";

  return (
    <div className="space-y-5">
      {/* Status cards */}
      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between" style={{ borderLeft: "3px solid #6366f1" }}>
          <div className="flex items-center gap-2.5">
            <span className="text-lg">🔐</span>
            <h2 className="font-bold text-sm uppercase tracking-wider text-indigo-600">Device Permissions</h2>
          </div>
          <button
            onClick={handleRefresh}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
        <div className="p-4 space-y-3">
          {PERMISSIONS.map((perm) => (
            <PermissionRow
              key={perm.key}
              perm={perm}
              status={statuses[perm.key]}
              onRequest={requestMap[perm.key]}
              refresh={refresh}
              openSettings={openSettings}
            />
          ))}
        </div>
      </div>

      {/* Browser-specific help */}
      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-border" style={{ borderLeft: "3px solid #6366f1" }}>
          <div className="flex items-center gap-2.5">
            <span className="text-lg">💡</span>
            <h2 className="font-bold text-sm uppercase tracking-wider text-indigo-600">
              How to Enable Permissions in {browser}
            </h2>
          </div>
        </div>
        <div className="p-6 space-y-4">
          {isIOS && (
            <div>
              <p className="font-semibold text-sm mb-2">📱 iPhone / iPad (Safari)</p>
              <ol className="space-y-1.5 text-sm text-muted-foreground list-decimal list-inside">
                <li>Go to <strong>Settings → Safari → Camera</strong></li>
                <li>Select <strong>"Allow"</strong></li>
                <li>Return to this page and tap <strong>"Allow"</strong> on any permission above</li>
              </ol>
              <button onClick={openSettings} className="mt-3 flex items-center gap-2 text-sm font-bold text-indigo-600 hover:underline">
                <Settings className="h-4 w-4" /> Open iOS Settings <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {isAndroid && (
            <div>
              <p className="font-semibold text-sm mb-2">🤖 Android</p>
              <ol className="space-y-1.5 text-sm text-muted-foreground list-decimal list-inside">
                <li>Tap the 🔒 icon in the browser address bar</li>
                <li>Tap <strong>Permissions</strong> or <strong>Site settings</strong></li>
                <li>Set <strong>Camera</strong> (and others) to <strong>"Allow"</strong></li>
                <li>Reload the page</li>
              </ol>
            </div>
          )}

          {!isIOS && !isAndroid && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { name: "Chrome / Edge", steps: ['Click 🔒 in address bar', 'Click "Site settings"', 'Set Camera to "Allow"'] },
                { name: "Firefox", steps: ['Click 🔒 in address bar', 'Click "Connection Secure → More Info"', 'Under Permissions set Camera to Allow'] },
                { name: "Safari (Mac)", steps: ['Safari menu → Settings for This Website', 'Set Camera to "Allow"'] },
                { name: "Samsung Browser", steps: ['Tap ⋮ menu → Settings', 'Sites and Downloads → Site permissions', 'Set Camera to Allow'] },
              ].map(({ name, steps }) => (
                <div key={name} className="bg-muted/40 rounded-xl p-4">
                  <p className="font-semibold text-sm mb-2">{name}</p>
                  <ol className="space-y-1 text-xs text-muted-foreground list-decimal list-inside">
                    {steps.map((s, i) => <li key={i}>{s}</li>)}
                  </ol>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}