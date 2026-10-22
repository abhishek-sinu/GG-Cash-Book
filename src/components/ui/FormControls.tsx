"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

export function Modal({ title, close, children }: { title: string; close: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);
  return (
    <dialog ref={ref} aria-labelledby={titleId} onCancel={event => { event.preventDefault(); close(); }} onKeyDown={event => { if (event.key === "Escape") { event.preventDefault(); close(); } }} className="editor-dialog">
      <div className="flex items-center justify-between gap-4 border-b border-border pb-5">
        <h2 id={titleId} className="font-display text-3xl">{title}</h2>
        <button type="button" className="icon-button" onClick={close} aria-label="Close dialog"><X size={20} /></button>
      </div>
      {children}
    </dialog>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="field"><span>{label}</span>{children}</label>;
}
