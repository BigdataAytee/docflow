import { useState, useEffect, useCallback } from "react";

/**
 * Unified permission hook using the Permissions API with getUserMedia fallback.
 * Tracks: camera, microphone, geolocation
 */

const PERMISSION_NAMES = {
  camera: "camera",
  microphone: "microphone",
  location: "geolocation",
};

// Query a single permission status via the Permissions API
async function queryPermission(name) {
  if (!navigator.permissions) return "unknown";
  try {
    const result = await navigator.permissions.query({ name });
    return result.state; // "granted" | "denied" | "prompt"
  } catch {
    return "unknown";
  }
}

export function usePermissions() {
  const [statuses, setStatuses] = useState({
    camera: "unknown",
    microphone: "unknown",
    location: "unknown",
  });

  const refresh = useCallback(async () => {
    const [camera, microphone, location] = await Promise.all([
      queryPermission("camera"),
      queryPermission("microphone"),
      queryPermission("geolocation"),
    ]);
    setStatuses({ camera, microphone, location });
  }, []);

  useEffect(() => {
    refresh();

    // Subscribe to live changes where supported
    const watchers = [];
    if (navigator.permissions) {
      ["camera", "microphone", "geolocation"].forEach(async (name) => {
        try {
          const result = await navigator.permissions.query({ name });
          const handler = () => refresh();
          result.addEventListener("change", handler);
          watchers.push({ result, handler });
        } catch {}
      });
    }
    return () => watchers.forEach(({ result, handler }) => result.removeEventListener("change", handler));
  }, [refresh]);

  /**
   * Request camera permission by actually calling getUserMedia.
   * This is the ONLY reliable way to trigger the native browser popup.
   * Returns "granted" | "denied" | "error"
   */
  const requestCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      stream.getTracks().forEach((t) => t.stop()); // release immediately
      await refresh();
      return "granted";
    } catch (err) {
      await refresh();
      return err.name === "NotAllowedError" || err.name === "PermissionDeniedError" ? "denied" : "error";
    }
  }, [refresh]);

  /**
   * Request microphone permission.
   */
  const requestMicrophone = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      stream.getTracks().forEach((t) => t.stop());
      await refresh();
      return "granted";
    } catch (err) {
      await refresh();
      return err.name === "NotAllowedError" || err.name === "PermissionDeniedError" ? "denied" : "error";
    }
  }, [refresh]);

  /**
   * Request geolocation permission.
   */
  const requestLocation = useCallback(async () => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) { resolve("error"); return; }
      navigator.geolocation.getCurrentPosition(
        async () => { await refresh(); resolve("granted"); },
        async (err) => {
          await refresh();
          resolve(err.code === 1 ? "denied" : "error");
        },
        { timeout: 8000 }
      );
    });
  }, [refresh]);

  /**
   * Open the device/browser settings page for permissions.
   * Works natively on iOS Safari (app-settings:) and hints on other platforms.
   */
  const openSettings = useCallback(() => {
    const ua = navigator.userAgent;
    if (/iPhone|iPad|iPod/.test(ua)) {
      window.location.href = "app-settings:";
    } else {
      // For Android/Desktop — no universal deep-link; UI guidance is shown instead
    }
  }, []);

  return { statuses, refresh, requestCamera, requestMicrophone, requestLocation, openSettings };
}