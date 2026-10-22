"use client";

import { Toaster } from "sonner";
import { PwaInstall } from "@/components/PwaInstall";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <PwaInstall />
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: "var(--surface)",
            color: "var(--foreground)",
            borderColor: "var(--border)",
          },
        }}
      />
    </>
  );
}
