"use client";

import { Moon, Sun } from "lucide-react";
import { useState, useSyncExternalStore } from "react";
import { toast } from "sonner";

function subscribe(onChange: () => void) {
  window.addEventListener("gg-theme-change", onChange);
  return () => window.removeEventListener("gg-theme-change", onChange);
}

function getTheme() {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

function getServerTheme() {
  return "light";
}

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, getTheme, getServerTheme);
  const [error, setError] = useState("");

  function toggleTheme() {
    const next = getTheme() === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    window.dispatchEvent(new Event("gg-theme-change"));
    try {
      localStorage.setItem("gg-cash-book-theme", next);
      setError("");
    } catch (cause) {
      console.error("Unable to save theme preference.", cause);
      const message = "Appearance changed, but could not be saved on this device.";
      setError(message);
      toast.error(message);
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={toggleTheme}
        aria-label="Dark mode"
        aria-pressed={theme === "dark"}
        className="flex min-h-11 items-center gap-2 rounded-full border border-border bg-surface px-4 text-sm font-medium"
      >
        {theme === "dark" ? <Sun size={17} aria-hidden="true" /> : <Moon size={17} aria-hidden="true" />}
        <span className="hidden sm:inline">Appearance</span>
      </button>
      {error && <p role="status" className="absolute right-0 top-14 z-10 w-64 rounded-xl border border-border bg-surface p-3 text-sm">{error}</p>}
    </div>
  );
}
