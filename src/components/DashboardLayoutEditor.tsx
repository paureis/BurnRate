"use client";

import { useMemo } from "react";
import { ArrowDown, ArrowUp, Eye, EyeOff, LayoutDashboard, RotateCcw } from "lucide-react";
import {
  DASHBOARD_MODULES,
  defaultDashboardLayout,
  moveLayoutEntry,
  resolveDashboardLayout,
  toggleLayoutVisibility,
  type DashboardLayoutEntry,
} from "@/lib/dashboard-layout";

interface DashboardLayoutEditorProps {
  layout: DashboardLayoutEntry[] | undefined;
  onChange: (next: DashboardLayoutEntry[]) => void;
}

export function DashboardLayoutEditor({ layout, onChange }: DashboardLayoutEditorProps) {
  const resolved = useMemo(() => resolveDashboardLayout(layout), [layout]);

  return (
    <section className="panel p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <LayoutDashboard aria-hidden="true" className="text-[color:var(--accent-2)]" size={20} />
          <h2 className="text-xl font-extrabold">Dashboard layout</h2>
        </div>
        <button
          type="button"
          className="button-ghost text-xs"
          onClick={() => onChange(defaultDashboardLayout())}
        >
          <RotateCcw aria-hidden="true" size={13} />
          Reset
        </button>
      </div>
      <p className="mb-3 text-xs text-[color:var(--muted)]">
        Reorder or hide dashboard modules. Hidden modules disappear from the dashboard but stay tracked.
      </p>
      <ul className="grid gap-2">
        {resolved.map((entry, index) => {
          const meta = DASHBOARD_MODULES.find((m) => m.id === entry.moduleId);
          if (!meta) return null;
          return (
            <li
              key={entry.moduleId}
              className="flex items-center justify-between gap-2 rounded-panel border border-[color:var(--line)] bg-[color:var(--panel-strong)] p-3"
            >
              <div className="min-w-0">
                <p className="font-extrabold">{meta.label}</p>
                <p className="text-xs text-[color:var(--muted)]">{meta.description}</p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  className="icon-button"
                  aria-label={`Move ${meta.label} up`}
                  disabled={index === 0}
                  onClick={() => onChange(moveLayoutEntry(resolved, entry.moduleId, -1))}
                >
                  <ArrowUp aria-hidden="true" size={14} />
                </button>
                <button
                  type="button"
                  className="icon-button"
                  aria-label={`Move ${meta.label} down`}
                  disabled={index === resolved.length - 1}
                  onClick={() => onChange(moveLayoutEntry(resolved, entry.moduleId, 1))}
                >
                  <ArrowDown aria-hidden="true" size={14} />
                </button>
                <button
                  type="button"
                  className="icon-button"
                  aria-label={entry.visible ? `Hide ${meta.label}` : `Show ${meta.label}`}
                  onClick={() => onChange(toggleLayoutVisibility(resolved, entry.moduleId))}
                >
                  {entry.visible ? (
                    <Eye aria-hidden="true" size={14} />
                  ) : (
                    <EyeOff aria-hidden="true" size={14} className="text-[color:var(--muted)]" />
                  )}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
