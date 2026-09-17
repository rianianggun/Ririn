import React from "react";
import { STATUS_META } from "../lib/constants";

export function StatusPill({ status, className = "" }) {
  const meta = STATUS_META[status] || { label: status, cls: "bg-slate-100 text-slate-700 border-slate-300" };
  return (
    <span
      data-testid={`status-pill-${status}`}
      className={`px-3 py-1 rounded-full text-xs font-semibold tracking-wide inline-flex items-center gap-1.5 border ${meta.cls} ${className}`}
    >
      {meta.label}
    </span>
  );
}
