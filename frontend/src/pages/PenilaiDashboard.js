import React, { useEffect, useState, useCallback } from "react";
import { api, formatApiErrorDetail, openFile } from "../lib/api";
import { Navbar } from "../components/Navbar";
import { StatusPill } from "../components/StatusPill";
import { MaturityReport } from "../components/MaturityReport";
import { Button } from "../components/ui/button";
import { Textarea } from "../components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import { toast } from "sonner";
import { ClipboardCheck, FileText, Inbox, Eye } from "lucide-react";

export default function PenilaiDashboard() {
  const [subs, setSubs] = useState([]);
  const [indicators, setIndicators] = useState([]);
  const [period, setPeriod] = useState(null);
  const [detail, setDetail] = useState(null);
  const [scores, setScores] = useState({});
  const [overallNote, setOverallNote] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const [s, i, p] = await Promise.all([
      api.get("/submissions"),
      api.get("/indicators"),
      api.get("/periods/active"),
    ]);
    setSubs(s.data);
    setIndicators(i.data);
    setPeriod(p.data && p.data.id ? p.data : null);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openScore = (s) => {
    setDetail(s);
    setOverallNote("");
    if (s.scoring) {
      const m = {};
      (s.scoring.scores || []).forEach((x) => (m[x.indicator_id] = x.score));
      setScores(m);
    } else {
      setScores({});
    }
  };

  const total = indicators.reduce((acc, ind) => acc + (scores[ind.id] || 0), 0);
  const allScored = indicators.every((ind) => scores[ind.id] >= 1);

  const submitScore = async () => {
    if (!allScored) return toast.error("Semua variabel harus dinilai (1-5)");
    setSaving(true);
    try {
      const payload = {
        scores: indicators.map((ind) => ({ indicator_id: ind.id, score: scores[ind.id], note: "" })),
        overall_note: overallNote,
      };
      await api.post(`/submissions/${detail.id}/score`, payload);
      toast.success("Penilaian selesai & dirilis ke perangkat");
      setDetail(null);
      await load();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    }
    setSaving(false);
  };

  const queue = subs.filter((s) => s.status === "menunggu_penilaian");
  const done = subs.filter((s) => s.status === "selesai");

  const Card = ({ s }) => (
    <div data-testid={`score-card-${s.id}`} className="rounded-2xl border border-border bg-white p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-display font-bold text-slate-900 truncate">{s.device_name}</div>
          <div className="text-xs text-muted-foreground mt-0.5">{s.area} · {s.urusan} · {s.year}</div>
        </div>
        <StatusPill status={s.status} />
      </div>
      {s.scoring && (
        <div className="mt-3 text-sm font-mono font-semibold text-emerald-700">
          Skor {s.scoring.total}/{s.scoring.max_total} · {s.scoring.category?.label}
        </div>
      )}
      <Button variant="outline" size="sm" className="w-full gap-2 mt-4" data-testid={`assess-btn-${s.id}`} onClick={() => openScore(s)}>
        <Eye className="w-4 h-4" /> {s.status === "menunggu_penilaian" ? "Nilai Sekarang" : "Lihat Hasil"}
      </Button>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <Navbar period={period} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-8">
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-slate-900 flex items-center gap-2">
            <ClipboardCheck className="w-7 h-7 text-emerald-600" /> Dashboard Penilai
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Beri skor 1-5 pada 11 variabel kematangan yang telah terverifikasi.</p>
        </div>

        <Tabs defaultValue="queue">
          <TabsList>
            <TabsTrigger value="queue" data-testid="tab-queue">Menunggu Penilaian ({queue.length})</TabsTrigger>
            <TabsTrigger value="done" data-testid="tab-done">Selesai ({done.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="queue" className="mt-6">
            {queue.length === 0 ? (
              <div className="text-center py-16 rounded-2xl border border-dashed border-border">
                <Inbox className="w-10 h-10 mx-auto text-muted-foreground/50" />
                <p className="text-muted-foreground mt-3">Tidak ada pengajuan menunggu penilaian.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{queue.map((s) => <Card key={s.id} s={s} />)}</div>
            )}
          </TabsContent>
          <TabsContent value="done" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{done.map((s) => <Card key={s.id} s={s} />)}</div>
          </TabsContent>
        </Tabs>
      </main>

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {detail && (
            <>
              <DialogHeader><DialogTitle>{detail.device_name}</DialogTitle></DialogHeader>
              <div className="text-xs text-muted-foreground -mt-2">{detail.area} · {detail.urusan} · {detail.year}</div>

              {detail.status === "selesai" ? (
                <div className="mt-4"><MaturityReport submission={detail} /></div>
              ) : (
                <div className="mt-4 space-y-3">
                  {indicators.map((ind) => {
                    const up = (detail.uploads || {})[ind.id];
                    return (
                      <div key={ind.id} className="rounded-xl border border-border p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-slate-900">{ind.order}. {ind.name}</div>
                            <div className="text-xs text-muted-foreground mt-0.5">{ind.description}</div>
                          </div>
                          {up && (
                            <Button variant="ghost" size="sm" className="gap-1.5 shrink-0 text-emerald-700" onClick={() => openFile(up.file_id)}>
                              <FileText className="w-4 h-4" /> Bukti
                            </Button>
                          )}
                        </div>
                        <div className="flex gap-2 mt-3">
                          {[1, 2, 3, 4, 5].map((n) => (
                            <button
                              key={n}
                              data-testid={`score-${ind.id}-${n}`}
                              onClick={() => setScores({ ...scores, [ind.id]: n })}
                              className={`w-10 h-10 rounded-lg border font-mono font-bold text-sm transition-colors ${scores[ind.id] === n ? "bg-primary text-white border-primary" : "bg-white text-slate-600 border-slate-300 hover:border-primary hover:text-primary"}`}
                            >
                              {n}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}

                  <Textarea data-testid="overall-note-input" placeholder="Catatan/rekomendasi keseluruhan (opsional)" value={overallNote} onChange={(e) => setOverallNote(e.target.value)} rows={2} />

                  <div className="sticky bottom-0 bg-white pt-2 border-t flex items-center justify-between gap-4">
                    <div className="text-sm">
                      <span className="text-muted-foreground">Total sementara: </span>
                      <span className="font-mono font-bold text-lg text-primary">{total}</span>
                      <span className="text-muted-foreground">/{indicators.length * 5}</span>
                    </div>
                    <Button className="gap-2 h-11" data-testid="submit-score-btn" onClick={submitScore} disabled={saving || !allScored}>
                      <ClipboardCheck className="w-4 h-4" /> Finalisasi Penilaian
                    </Button>
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
