import { useState, type ReactNode } from "react";

interface SectionProps {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
  rightAction?: ReactNode;
}

export function Section({ title, children, defaultOpen = true, rightAction }: SectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="bg-ksp-panel border border-ksp-border rounded-lg overflow-hidden">
      <div
        className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-ksp-border/30"
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-center gap-2">
          <span className="text-xs text-ksp-muted">{open ? "▼" : "▶"}</span>
          <h3 className="text-xs font-semibold uppercase tracking-wider">{title}</h3>
        </div>
        {rightAction && <div onClick={(e) => e.stopPropagation()}>{rightAction}</div>}
      </div>
      {open && <div className="p-3 pt-0 space-y-2">{children}</div>}
    </div>
  );
}
