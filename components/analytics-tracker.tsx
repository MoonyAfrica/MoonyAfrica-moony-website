"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

function deviceType() {
  if (window.innerWidth < 768) return "mobile";
  if (window.innerWidth < 1100) return "tablet";
  return "desktop";
}

export function AnalyticsTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname.startsWith("/admin")) return;
    void fetch("/api/analytics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({ eventName: "page_view", path: pathname, device: deviceType(), referrer: document.referrer || null }),
    }).catch(() => undefined);
  }, [pathname]);

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (pathname.startsWith("/admin")) return;
      const element = event.target as HTMLElement | null;
      const anchor = element?.closest("a") as HTMLAnchorElement | null;
      if (!anchor) return;
      const appUrl = process.env.NEXT_PUBLIC_MOONY_APP_URL || "https://application.moony-africa.com";
      const eventName = anchor.href.startsWith(appUrl) ? "app_click" : anchor.dataset.analytics === "cta" ? "cta_click" : null;
      if (!eventName) return;
      void fetch("/api/analytics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        keepalive: true,
        body: JSON.stringify({ eventName, path: pathname, device: deviceType(), metadata: { label: anchor.textContent?.trim().slice(0, 120) || null } }),
      }).catch(() => undefined);
    }
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [pathname]);

  return null;
}
