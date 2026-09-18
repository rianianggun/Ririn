import React from "react";
import { openFile } from "../lib/api";
import { CheckCircle2, XCircle, FileText } from "lucide-react";

// Read-only view of a completed submission's validation & scoring
export function SubmissionScoreView({ submission }) {
  const sc = submission.scoring;
  if (!sc) return null;
  const total = (0.2 * (sc.umum_avg || 0) + 0.8 * (sc.teknis_avg || 0)).toFixed(2);
  const vals = sc.validations || {};
  return (
    <div className="space-y-4" data-testid="submission-score-view">
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-border bg-white p-4">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Faktor Umum (20%)</div>
          <div className="text-2xl font-display font-extrabold text-slate-900 mt-1 font-mono">{sc.umum_avg}</div>
        </div>
        <div className="rounded-xl border border-border bg-white p-4">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Faktor Teknis (80%)</div>
          <div className="text-2xl font-display font-extrabold text-slate-900 mt-1 font-mono">{sc.teknis_avg}</div>
        </div>
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
          <div className="text-xs uppercase tracking-widest text-primary/70">Total Nilai Urusan</div>
          <div className="text-2xl font-display font-extrabold text-primary mt-1 font-mono">{total}</div>
        </div>
      </div>
      {sc.overall_note && <p className="text-sm text-slate-600 italic bg-muted/40 rounded-lg px-3 py-2">Catatan penilai: "{sc.overall_note}"</p>}
      <div className="rounded-xl border border-border bg-white overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
            <tr><th className="px-3 py-2">Indikator</th><th className="px-3 py-2 text-center">Valid</th><th className="px-3 py-2">Hasil Validasi</th><th className="px-3 py-2 text-center">Skor</th><th className="px-3 py-2">Berkas</th></tr>
          </thead>
          <tbody>
            {Object.entries(vals).map(([iid, v]) => {
              const up = (submission.uploads || {})[iid];
              return (
                <tr key={iid} className="border-t border-slate-100">
                  <td className="px-3 py-2 text-slate-700">{v.indicator_name}{v.note ? <div className="text-xs text-muted-foreground italic">{v.note}</div> : null}</td>
                  <td className="px-3 py-2 text-center">{v.ok ? <CheckCircle2 className="w-4 h-4 text-emerald-600 inline" /> : <XCircle className="w-4 h-4 text-red-500 inline" />}</td>
                  <td className="px-3 py-2 text-muted-foreground text-xs">{v.data_validasi || "-"}</td>
                  <td className="px-3 py-2 text-center font-mono font-semibold text-primary">{v.score}</td>
                  <td className="px-3 py-2">{up && <button className="text-emerald-700 hover:underline text-xs inline-flex items-center gap-1" onClick={() => openFile(up.file_id)}><FileText className="w-3.5 h-3.5" />Lihat</button>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
