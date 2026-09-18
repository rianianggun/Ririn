import React, { useEffect, useState, useCallback } from "react";
import { api, formatApiErrorDetail, openFile } from "../lib/api";
import { Navbar } from "../components/Navbar";
import { StatusPill } from "../components/StatusPill";
import { SubmissionScoreView } from "../components/SubmissionScoreView";
import { ReportsPanel } from "../components/ReportsPanel";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Checkbox } from "../components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "../components/ui/select";
import { toast } from "sonner";
import { ClipboardCheck, FileText, Eye, ArrowLeft } from "lucide-react";

export default function PenilaiDashboard() {
  const [subs, setSubs] = useState([]);
  const [period, setPeriod] = useState(null);
  const [activeId, setActiveId] = useState(null);
  const [inds, setInds] = useState({ umum: [], teknis: [] });
  const [rows, setRows] = useState({});
  const [overallNote, setOverallNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [yearFilter, setYearFilter] = useState("all");

  const active = subs.find((s) => s.id === activeId) || null;

  const load = useCallback(async () => {
    const [s, p] = await Promise.all([api.get("/submissions"), api.get("/periods/active")]);
    setSubs(s.data); setPeriod(p.data && p.data.id ? p.data : null);
    return s.data;
  }, []);
  useEffect(() => { load(); }, [load]);

  const openScore = async (s) => {
    setActiveId(s.id); setOverallNote("");
    const { data } = await api.get("/indicators/for-submission", { params: { level: s.level, urusan: s.urusan, sub_urusan: s.sub_urusan || undefined } });
    setInds(data);
    const init = {};
    [...data.umum, ...data.teknis].forEach((i) => { init[i.id] = { ok: true, note: "", data_validasi: "", score: "" }; });
    setRows(init);
  };

  const allInds = [...inds.umum, ...inds.teknis];
  const allScored = allInds.length > 0 && allInds.every((i) => Number(rows[i.id]?.score) > 0);
  const setRow = (id, patch) => setRows((r) => ({ ...r, [id]: { ...r[id], ...patch } }));

  const submitScore = async () => {
    if (!allScored) return toast.error("Isi skor akhir (>0) untuk semua indikator");
    setSaving(true);
    try {
      const items = allInds.map((i) => ({ indicator_id: i.id, ok: rows[i.id].ok, note: rows[i.id].note, data_validasi: rows[i.id].data_validasi, score: Number(rows[i.id].score) }));
      await api.post(`/submissions/${activeId}/score`, { items, overall_note: overallNote });
      toast.success("Penilaian selesai & dirilis"); setActiveId(null); await load();
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
    setSaving(false);
  };

  const years = [...new Set(subs.map((s) => s.year))].sort((a, b) => b - a);
  const byYear = (list) => yearFilter === "all" ? list : list.filter((s) => String(s.year) === String(yearFilter));
  const queue = byYear(subs.filter((s) => s.status === "menunggu_penilaian"));
  const done = byYear(subs.filter((s) => s.status === "selesai"));

  const Table = ({ list, action }) => (
    <div className="rounded-2xl border border-border bg-white overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left text-xs text-muted-foreground"><tr><th className="px-4 py-3">Perangkat Daerah</th><th className="px-4 py-3">Area</th><th className="px-4 py-3">Urusan</th><th className="px-4 py-3">Tahun</th><th className="px-4 py-3">Hasil</th><th className="px-4 py-3 text-right">Aksi</th></tr></thead>
        <tbody>
          {list.length === 0 && <tr><td colSpan={6} className="text-center py-12 text-muted-foreground">Tidak ada data.</td></tr>}
          {list.map((s) => {
            const sc = s.scoring; const total = sc ? (0.2 * sc.umum_avg + 0.8 * sc.teknis_avg).toFixed(1) : "-";
            return (
              <tr key={s.id} data-testid={`score-row-${s.id}`} className="border-t border-border">
                <td className="px-4 py-3 font-medium text-slate-800">{s.device_name}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{s.area}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{s.urusan}{s.sub_urusan ? ` — ${s.sub_urusan}` : ""}</td>
                <td className="px-4 py-3">{s.year}</td>
                <td className="px-4 py-3 font-mono text-xs">{sc ? `${total} (U${sc.umum_avg}/T${sc.teknis_avg})` : "-"}</td>
                <td className="px-4 py-3 text-right"><Button variant="outline" size="sm" className="gap-1.5" data-testid={`assess-btn-${s.id}`} onClick={() => openScore(s)}><Eye className="w-4 h-4" /> {action}</Button></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  const ScoreRow = ({ ind }) => {
    const r = rows[ind.id] || {};
    const up = (active.uploads || {})[ind.id];
    return (
      <div className="rounded-xl border border-border p-4 space-y-3 bg-white">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0"><div className="text-sm font-semibold text-slate-900">{ind.order}. {ind.name}{ind.weight && ind.weight !== 1 ? <span className="text-xs font-normal text-muted-foreground"> (bobot {ind.weight})</span> : null}</div>{ind.description && <div className="text-xs text-muted-foreground mt-0.5">{ind.description}</div>}</div>
          {up && <Button variant="ghost" size="sm" className="gap-1.5 shrink-0 text-emerald-700" data-testid={`penilai-view-file-${ind.id}`} onClick={() => openFile(up.file_id)}><FileText className="w-4 h-4" /> Berkas</Button>}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
          <label className="sm:col-span-2 flex items-center gap-2 cursor-pointer"><Checkbox checked={r.ok} onCheckedChange={(v) => setRow(ind.id, { ok: !!v })} data-testid={`ok-${ind.id}`} /><span className="text-xs font-medium text-slate-600">Oke</span></label>
          <Input className="sm:col-span-4" inputMode="numeric" maxLength={500} placeholder="Data Hasil Validasi (angka)" data-testid={`validasi-${ind.id}`} value={r.data_validasi} onChange={(e) => setRow(ind.id, { data_validasi: e.target.value.replace(/[^0-9.,]/g, "").slice(0, 500) })} />
          <Input className="sm:col-span-4" placeholder="Catatan (opsional)" data-testid={`note-${ind.id}`} value={r.note} onChange={(e) => setRow(ind.id, { note: e.target.value })} />
          <Input className="sm:col-span-2" type="number" min={0} max={1000} placeholder="Skor akhir" data-testid={`score-${ind.id}`} value={r.score} onChange={(e) => setRow(ind.id, { score: e.target.value })} />
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar period={period} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {!active ? (
          <>
            <div className="mb-8"><h1 className="font-display text-2xl sm:text-3xl font-extrabold text-slate-900 flex items-center gap-2"><ClipboardCheck className="w-7 h-7 text-emerald-600" /> Dashboard Penilai</h1><p className="text-muted-foreground text-sm mt-1">Validasi berkas & isi skor akhir tiap indikator, lalu susun Laporan Hasil Penilaian.</p></div>
            <Tabs defaultValue="penilaian">
              <TabsList><TabsTrigger value="penilaian" data-testid="tab-penilaian">Penilaian</TabsTrigger><TabsTrigger value="laporan" data-testid="tab-laporan">Laporan Hasil</TabsTrigger></TabsList>
              <TabsContent value="penilaian" className="mt-6">
                <div className="flex items-center gap-3 mb-4">
                  <Label className="text-xs text-muted-foreground">Filter Tahun</Label>
                  <Select value={yearFilter} onValueChange={setYearFilter}><SelectTrigger className="w-40" data-testid="year-filter"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Semua Tahun</SelectItem>{years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent></Select>
                </div>
                <Tabs defaultValue="queue">
                  <TabsList><TabsTrigger value="queue" data-testid="tab-queue">Menunggu ({queue.length})</TabsTrigger><TabsTrigger value="done" data-testid="tab-done">Selesai ({done.length})</TabsTrigger></TabsList>
                  <TabsContent value="queue" className="mt-4"><Table list={queue} action="Validasi & Nilai" /></TabsContent>
                  <TabsContent value="done" className="mt-4"><Table list={done} action="Lihat Hasil" /></TabsContent>
                </Tabs>
              </TabsContent>
              <TabsContent value="laporan" className="mt-6"><ReportsPanel canManage={true} /></TabsContent>
            </Tabs>
          </>
        ) : (
          <div>
            <button data-testid="back-to-list" onClick={() => setActiveId(null)} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-slate-900 mb-4"><ArrowLeft className="w-4 h-4" /> Kembali ke daftar</button>
            <div className="flex flex-wrap items-start justify-between gap-3 mb-4"><div><h2 className="font-display text-2xl font-extrabold text-slate-900">{active.device_name}</h2><div className="text-sm text-muted-foreground">{active.area} · {active.urusan}{active.sub_urusan ? ` — ${active.sub_urusan}` : ""} · {active.year}</div></div><StatusPill status={active.status} /></div>
            {active.status === "selesai" ? <SubmissionScoreView submission={active} /> : (
              <div className="space-y-3 max-w-4xl">
                <div className="text-sm font-semibold text-slate-900">Faktor Umum (20%)</div>
                {inds.umum.map((ind) => <ScoreRow key={ind.id} ind={ind} />)}
                <div className="text-sm font-semibold text-slate-900 pt-2">Faktor Teknis (80%)</div>
                {inds.teknis.map((ind) => <ScoreRow key={ind.id} ind={ind} />)}
                <Textarea data-testid="overall-note-input" placeholder="Catatan/rekomendasi keseluruhan (opsional)" value={overallNote} onChange={(e) => setOverallNote(e.target.value)} rows={2} />
                <div className="sticky bottom-0 bg-background py-3 border-t flex items-center justify-end"><Button className="gap-2 h-11" data-testid="submit-score-btn" onClick={submitScore} disabled={saving || !allScored}><ClipboardCheck className="w-4 h-4" /> Finalisasi Penilaian</Button></div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
