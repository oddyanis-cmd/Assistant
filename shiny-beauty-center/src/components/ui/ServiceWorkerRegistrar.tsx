"use client";

import { useEffect } from "react";

/**
 * Registers the service worker for PWA offline support.
 * Mount this once in the root locale layout.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    window.addEventListener("load", () => {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .then((registration) => {
          console.debug("[SW] Registered:", registration.scope);
        })
        .catch((err) => {
          console.warn("[SW] Registration failed:", err);
        });
    });
  }, []);

  return null; // renders nothing
}
