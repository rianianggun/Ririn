import React, { useEffect, useState, useCallback } from "react";
import { api, formatApiErrorDetail, openFile } from "../lib/api";
import { Navbar } from "../components/Navbar";
import { StatusPill } from "../components/StatusPill";
import { SubmissionScoreView } from "../components/SubmissionScoreView";
import { ReportsPanel } from "../components/ReportsPanel";
import { SKOR_KELAS } from "../lib/constants";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Checkbox } from "../components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "../components/ui/select";
import { toast } from "sonner";
import { ClipboardCheck, FileText, Inbox, Eye } from "lucide-react";

export default function PenilaiDashboard() {
  const [subs, setSubs] = useState([]);
  const [period, setPeriod] = useState(null);
  const [detail, setDetail] = useState(null);
  const [inds, setInds] = useState({ umum: [], teknis: [] });
  const [rows, setRows] = useState({}); // indicatorId -> {ok, note, data_validasi, score}
  const [overallNote, setOverallNote] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const [s, p] = await Promise.all([api.get("/submissions"), api.get("/periods/active")]);
    setSubs(s.data); setPeriod(p.data && p.data.id ? p.data : null);
  }, []);
  useEffect(() => { load(); }, [load]);

  const openScore = async (s) => {
    setDetail(s); setOverallNote("");
    const { data } = await api.get("/indicators/for-submission", { params: { level: s.level, urusan: s.urusan, sub_urusan: s.sub_urusan || undefined } });
    setInds(data);
    const init = {};
    [...data.umum, ...data.teknis].forEach((i) => { init[i.id] = { ok: true, note: "", data_validasi: "", score: 0 }; });
    setRows(init);
  };

  const allInds = [...inds.umum, ...inds.teknis];
  const allScored = allInds.length > 0 && allInds.every((i) => (rows[i.id]?.score || 0) > 0);

  const submitScore = async () => {
    if (!allScored) return toast.error("Beri skor (>0) untuk semua indikator");
    setSaving(true);
    try {
      const items = allInds.map((i) => ({ indicator_id: i.id, ...rows[i.id] }));
      await api.post(`/submissions/${detail.id}/score`, { items, overall_note: overallNote });
      toast.success("Penilaian selesai & dirilis"); setDetail(null); await load();
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
    setSaving(false);
  };

  const setRow = (id, patch) => setRows((r) => ({ ...r, [id]: { ...r[id], ...patch } }));
  const queue = subs.filter((s) => s.status === "menunggu_penilaian");
  const done = subs.filter((s) => s.status === "selesai");

  const Card = ({ s }) => {
    const sc = s.scoring;
    const total = sc ? (0.2 * sc.umum_avg + 0.8 * sc.teknis_avg).toFixed(1) : null;
    return (
      <div data-testid={`score-card-${s.id}`} className="rounded-2xl border border-border bg-white p-5 hover:shadow-md transition-shadow">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="font-display font-bold text-slate-900 truncate">{s.device_name}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{s.area} · {s.urusan}{s.sub_urusan ? ` — ${s.sub_urusan}` : ""}</div>
          </div>
          <StatusPill status={s.status} />
        </div>
        {sc && <div className="mt-3 text-sm font-mono font-semibold text-emerald-700">Total {total} (Umum {sc.umum_avg} / Teknis {sc.teknis_avg})</div>}
        <Button variant="outline" size="sm" className="w-full gap-2 mt-4" data-testid={`assess-btn-${s.id}`} onClick={() => openScore(s)}>
          <Eye className="w-4 h-4" /> {s.status === "menunggu_penilaian" ? "Validasi & Nilai" : "Lihat Hasil"}
        </Button>
      </div>
    );
  };

  const ScoreRow = ({ ind }) => {
    const r = rows[ind.id] || {};
    const up = (detail.uploads || {})[ind.id];
    return (
      <div className="rounded-xl border border-border p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-slate-900">{ind.order}. {ind.name}</div>
            {ind.description && <div className="text-xs text-muted-foreground mt-0.5">{ind.description}</div>}
          </div>
          {up && <Button variant="ghost" size="sm" className="gap-1.5 shrink-0 text-emerald-700" data-testid={`penilai-view-file-${ind.id}`} onClick={() => openFile(up.file_id)}><FileText className="w-4 h-4" /> Berkas</Button>}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
          <label className="sm:col-span-2 flex items-center gap-2 cursor-pointer">
            <Checkbox checked={r.ok} onCheckedChange={(v) => setRow(ind.id, { ok: !!v })} data-testid={`ok-${ind.id}`} />
            <span className="text-xs font-medium text-slate-600">Oke</span>
          </label>
          <Input className="sm:col-span-4" placeholder="Data Hasil Validasi" data-testid={`validasi-${ind.id}`} value={r.data_validasi} onChange={(e) => setRow(ind.id, { data_validasi: e.target.value })} />
          <Input className="sm:col-span-4" placeholder="Catatan (opsional)" data-testid={`note-${ind.id}`} value={r.note} onChange={(e) => setRow(ind.id, { note: e.target.value })} />
          <div className="sm:col-span-2">
            <Select value={String(r.score || "")} onValueChange={(v) => setRow(ind.id, { score: parseInt(v) })}>
              <SelectTrigger data-testid={`score-${ind.id}`}><SelectValue placeholder="Skor" /></SelectTrigger>
              <SelectContent>{SKOR_KELAS.filter((k) => k > 0).map((k) => <SelectItem key={k} value={String(k)}>{k}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar period={period} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-8">
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-slate-900 flex items-center gap-2"><ClipboardCheck className="w-7 h-7 text-emerald-600" /> Dashboard Penilai</h1>
          <p className="text-muted-foreground text-sm mt-1">Validasi berkas & beri skor (interval kelas PP 18/2016), lalu susun Laporan Hasil Penilaian.</p>
        </div>
        <Tabs defaultValue="penilaian">
          <TabsList>
            <TabsTrigger value="penilaian" data-testid="tab-penilaian">Penilaian</TabsTrigger>
            <TabsTrigger value="laporan" data-testid="tab-laporan">Laporan Hasil</TabsTrigger>
          </TabsList>
          <TabsContent value="penilaian" className="mt-6">
            <Tabs defaultValue="queue">
              <TabsList>
                <TabsTrigger value="queue" data-testid="tab-queue">Menunggu ({queue.length})</TabsTrigger>
                <TabsTrigger value="done" data-testid="tab-done">Selesai ({done.length})</TabsTrigger>
              </TabsList>
              <TabsContent value="queue" className="mt-6">
                {queue.length === 0 ? <div className="text-center py-16 rounded-2xl border border-dashed border-border"><Inbox className="w-10 h-10 mx-auto text-muted-foreground/50" /><p className="text-muted-foreground mt-3">Tidak ada pengajuan menunggu penilaian.</p></div>
                  : <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{queue.map((s) => <Card key={s.id} s={s} />)}</div>}
              </TabsContent>
              <TabsContent value="done" className="mt-6"><div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{done.map((s) => <Card key={s.id} s={s} />)}</div></TabsContent>
            </Tabs>
          </TabsContent>
          <TabsContent value="laporan" className="mt-6"><ReportsPanel canManage={true} /></TabsContent>
        </Tabs>
      </main>

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          {detail && (
            <>
              <DialogHeader><DialogTitle>{detail.device_name}</DialogTitle></DialogHeader>
              <div className="text-xs text-muted-foreground -mt-2">{detail.area} · {detail.urusan}{detail.sub_urusan ? ` — ${detail.sub_urusan}` : ""}</div>
              {detail.status === "selesai" ? (
                <div className="mt-4"><SubmissionScoreView submission={detail} /></div>
              ) : (
                <div className="mt-4 space-y-3">
                  <div className="text-sm font-semibold text-slate-900">Faktor Umum (20%)</div>
                  {inds.umum.map((ind) => <ScoreRow key={ind.id} ind={ind} />)}
                  <div className="text-sm font-semibold text-slate-900 pt-2">Faktor Teknis (80%)</div>
                  {inds.teknis.map((ind) => <ScoreRow key={ind.id} ind={ind} />)}
                  <Textarea data-testid="overall-note-input" placeholder="Catatan/rekomendasi keseluruhan (opsional)" value={overallNote} onChange={(e) => setOverallNote(e.target.value)} rows={2} />
                  <div className="sticky bottom-0 bg-white pt-3 border-t flex items-center justify-end">
                    <Button className="gap-2 h-11" data-testid="submit-score-btn" onClick={submitScore} disabled={saving || !allScored}><ClipboardCheck className="w-4 h-4" /> Finalisasi Penilaian</Button>
                  </div>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
