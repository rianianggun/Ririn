import React from "react";
import { FileText, ShieldCheck, ClipboardCheck, Award } from "lucide-react";
import { STATUS_META } from "../lib/constants";

const STEPS = [
  { label: "Pengajuan", icon: FileText },
  { label: "Verifikasi", icon: ShieldCheck },
  { label: "Penilaian", icon: ClipboardCheck },
  { label: "Hasil", icon: Award },
];

export function StatusStepper({ status }) {
  const current = STATUS_META[status]?.step ?? 0;
  const rejected = status === "ditolak";
  return (
    <div className="flex items-center w-full" data-testid="status-stepper">
      {STEPS.map((s, i) => {
        const Icon = s.icon;
        const done = i < current || status === "selesai";
        const active = i === current;
        const isRejectStep = rejected && i === 1;
        let circle = "bg-slate-200 text-slate-500 border-slate-300";
        if (done) circle = "bg-emerald-600 text-white border-emerald-600";
        else if (isRejectStep) circle = "bg-red-600 text-white border-red-600";
        else if (active) circle = "bg-amber-500 text-white border-amber-500";
        return (
          <React.Fragment key={s.label}>
            <div className="flex flex-col items-center gap-1 shrink-0">
              <div className={`w-9 h-9 rounded-full border-2 flex items-center justify-center transition-colors ${circle}`}>
                <Icon className="w-4 h-4" />
              </div>
              <span className="text-[10px] sm:text-xs font-medium text-slate-600 whitespace-nowrap">{s.label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`flex-1 h-0.5 mx-1 sm:mx-2 ${i < current ? "bg-emerald-500" : "bg-slate-200"}`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}
