"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function ServiceWorkerRegistrar() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (
      "serviceWorker" in navigator &&
      window.location.protocol !== "file:" &&
      process.env.NODE_ENV !== "test"
    ) {
      const register = () => {
        navigator.serviceWorker.register("/sw.js").catch(() => {
          // SW registration is best-effort.
        });
      };
      if (document.readyState === "complete") {
        register();
      } else {
        window.addEventListener("load", register, { once: true });
      }
    }

    if (window.matchMedia?.("(display-mode: standalone)").matches) {
      setIsStandalone(true);
    }

    const onPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstallPrompt(null);
      setIsStandalone(true);
    };

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!installPrompt || isStandalone) {
    return null;
  }

  return (
    <button
      type="button"
      className="button-secondary"
      onClick={async () => {
        try {
          await installPrompt.prompt();
          const choice = await installPrompt.userChoice;
          if (choice.outcome === "accepted") {
            setInstallPrompt(null);
          }
        } catch {
          setInstallPrompt(null);
        }
      }}
      aria-label="Install BurnRate as an app"
    >
      <Download aria-hidden="true" size={17} />
      Install
    </button>
  );
}
