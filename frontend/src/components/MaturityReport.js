import React from "react";
import {
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from "recharts";
import { MATURITY_META } from "../lib/constants";
import { Award } from "lucide-react";

export function MaturityReport({ submission }) {
  const sc = submission.scoring;
  if (!sc) return null;
  const cat = MATURITY_META[sc.category?.key] || { label: sc.category?.label, cls: "", hex: "#059669" };
  const radarData = (sc.scores || []).map((s) => ({
    subject: s.indicator_name?.length > 18 ? s.indicator_name.slice(0, 16) + "…" : s.indicator_name,
    full: s.indicator_name,
    score: s.score,
  }));

  return (
    <div className="space-y-5" data-testid="maturity-report">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className={`rounded-2xl border p-5 flex flex-col justify-center ${cat.cls}`}>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest opacity-80">
            <Award className="w-4 h-4" /> Tingkat Kematangan
          </div>
          <div className="text-3xl font-display font-extrabold mt-2" data-testid="report-category">{cat.label}</div>
          <div className="text-sm mt-1 opacity-80">Berdasarkan Permendagri 99/2018</div>
        </div>
        <div className="rounded-2xl border border-border bg-white p-5">
          <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Total Skor</div>
          <div className="text-3xl font-display font-extrabold text-slate-900 mt-2 font-mono">
            {sc.total} <span className="text-lg text-muted-foreground">/ {sc.max_total}</span>
          </div>
          <div className="mt-3 h-2 rounded-full bg-slate-100 overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${sc.percentage}%`, background: cat.hex }} />
          </div>
          <div className="text-sm mt-1 text-muted-foreground">{sc.percentage}% capaian · Rata-rata terbobot {sc.weighted_avg}</div>
        </div>
        <div className="rounded-2xl border border-border bg-white p-5">
          <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Penilai</div>
          <div className="text-base font-semibold text-slate-900 mt-2">{sc.penilai_name}</div>
          <div className="text-sm text-muted-foreground mt-1">
            {sc.scored_at ? new Date(sc.scored_at).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" }) : ""}
          </div>
          {sc.overall_note && <p className="text-sm mt-2 text-slate-600 italic">"{sc.overall_note}"</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-border bg-white p-4">
          <div className="text-sm font-semibold text-slate-900 mb-2">Radar 11 Variabel</div>
          <ResponsiveContainer width="100%" height={300}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="#e2e8f0" />
              <PolarAngleAxis dataKey="subject" tick={{ fontSize: 9, fill: "#475569" }} />
              <PolarRadiusAxis domain={[0, 5]} tick={{ fontSize: 9 }} />
              <Radar dataKey="score" stroke={cat.hex} fill={cat.hex} fillOpacity={0.35} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
        <div className="rounded-2xl border border-border bg-white p-4 overflow-auto">
          <div className="text-sm font-semibold text-slate-900 mb-2">Rincian Nilai per Variabel</div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground border-b">
                <th className="py-2 pr-2">Variabel</th>
                <th className="py-2 px-2 text-center">Skor</th>
              </tr>
            </thead>
            <tbody>
              {(sc.scores || []).map((s, i) => (
                <tr key={i} className="border-b border-slate-100">
                  <td className="py-2 pr-2 text-slate-700">{s.indicator_name}</td>
                  <td className="py-2 px-2 text-center font-mono font-semibold" style={{ color: cat.hex }}>{s.score}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
