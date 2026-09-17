import React, { useEffect, useState, useCallback } from "react";
import { api, formatApiErrorDetail, openFile } from "../lib/api";
import { Navbar } from "../components/Navbar";
import { StatusPill } from "../components/StatusPill";
import { Button } from "../components/ui/button";
import { Textarea } from "../components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "../components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import { toast } from "sonner";
import { ShieldCheck, CheckCircle2, XCircle, Eye, FileText, Inbox } from "lucide-react";

export default function VerifikatorDashboard() {
  const [subs, setSubs] = useState([]);
  const [indicators, setIndicators] = useState([]);
  const [period, setPeriod] = useState(null);
  const [detail, setDetail] = useState(null);
  const [rejectNote, setRejectNote] = useState("");
  const [rejectMode, setRejectMode] = useState(false);

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

  const act = async (action) => {
    if (action === "reject" && !rejectNote.trim()) return toast.error("Catatan perbaikan wajib diisi");
    try {
      await api.post(`/submissions/${detail.id}/verify`, { action, notes: rejectNote });
      toast.success(action === "approve" ? "Terverifikasi, diteruskan ke penilai" : "Dikembalikan ke perangkat");
      setDetail(null);
      setRejectNote("");
      setRejectMode(false);
      await load();
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    }
  };

  const queue = subs.filter((s) => s.status === "menunggu_verifikasi");
  const others = subs.filter((s) => s.status !== "menunggu_verifikasi");

  const Card = ({ s }) => (
    <div data-testid={`verif-card-${s.id}`} className="rounded-2xl border border-border bg-white p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-display font-bold text-slate-900 truncate">{s.device_name}</div>
          <div className="text-xs text-muted-foreground mt-0.5">{s.area} · {s.urusan} · {s.year}</div>
          <div className="text-xs text-muted-foreground mt-0.5">Pemohon: {s.perangkat_name}</div>
        </div>
        <StatusPill status={s.status} />
      </div>
      <Button variant="outline" size="sm" className="w-full gap-2 mt-4" data-testid={`review-btn-${s.id}`} onClick={() => { setDetail(s); setRejectMode(false); setRejectNote(""); }}>
        <Eye className="w-4 h-4" /> {s.status === "menunggu_verifikasi" ? "Tinjau & Verifikasi" : "Lihat Detail"}
      </Button>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <Navbar period={period} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-8">
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-slate-900 flex items-center gap-2">
            <ShieldCheck className="w-7 h-7 text-amber-600" /> Dashboard Verifikator
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Tinjau kelengkapan berkas sebelum diteruskan ke penilai.</p>
        </div>

        <Tabs defaultValue="queue">
          <TabsList>
            <TabsTrigger value="queue" data-testid="tab-queue">Antrean Verifikasi ({queue.length})</TabsTrigger>
            <TabsTrigger value="history" data-testid="tab-history">Riwayat ({others.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="queue" className="mt-6">
            {queue.length === 0 ? (
              <div className="text-center py-16 rounded-2xl border border-dashed border-border">
                <Inbox className="w-10 h-10 mx-auto text-muted-foreground/50" />
                <p className="text-muted-foreground mt-3">Tidak ada berkas menunggu verifikasi.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{queue.map((s) => <Card key={s.id} s={s} />)}</div>
            )}
          </TabsContent>
          <TabsContent value="history" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{others.map((s) => <Card key={s.id} s={s} />)}</div>
          </TabsContent>
        </Tabs>
      </main>

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {detail && (
            <>
              <DialogHeader><DialogTitle>{detail.device_name}</DialogTitle></DialogHeader>
              <div className="text-xs text-muted-foreground -mt-2">{detail.area} · {detail.urusan} · {detail.year} · {detail.perangkat_name}</div>

              <div className="space-y-2 mt-4">
                <div className="text-sm font-semibold text-slate-900">Berkas Pendukung</div>
                {indicators.map((ind) => {
                  const up = (detail.uploads || {})[ind.id];
                  return (
                    <div key={ind.id} className="rounded-lg border border-border p-3 flex items-center justify-between gap-3">
                      <div className="text-sm font-medium text-slate-800 min-w-0">
                        <span className="text-muted-foreground">{ind.order}.</span> {ind.name}
                      </div>
                      {up ? (
                        <Button variant="ghost" size="sm" className="gap-1.5 text-emerald-700 shrink-0" data-testid={`view-file-${ind.id}`} onClick={() => openFile(up.file_id)}>
                          <FileText className="w-4 h-4" /> Lihat
                        </Button>
                      ) : (
                        <span className="text-xs text-red-600 shrink-0">Tidak ada</span>
                      )}
                    </div>
                  );
                })}
              </div>

              {detail.status === "menunggu_verifikasi" && (
                <div className="mt-4 space-y-3">
                  {rejectMode && (
                    <Textarea data-testid="reject-note-input" placeholder="Tuliskan catatan perbaikan untuk perangkat daerah..." value={rejectNote} onChange={(e) => setRejectNote(e.target.value)} rows={3} />
                  )}
                  <div className="flex gap-3">
                    {!rejectMode ? (
                      <>
                        <Button className="flex-1 gap-2 bg-emerald-600 hover:bg-emerald-700" data-testid="verify-approve-btn" onClick={() => act("approve")}>
                          <CheckCircle2 className="w-4 h-4" /> Setujui & Teruskan
                        </Button>
                        <Button variant="outline" className="flex-1 gap-2 text-red-600 border-red-300 hover:bg-red-50 hover:text-red-700" data-testid="verify-reject-mode-btn" onClick={() => setRejectMode(true)}>
                          <XCircle className="w-4 h-4" /> Kembalikan
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button variant="destructive" className="flex-1 gap-2" data-testid="verify-reject-confirm-btn" onClick={() => act("reject")}>
                          <XCircle className="w-4 h-4" /> Kirim Perbaikan
                        </Button>
                        <Button variant="ghost" className="flex-1" onClick={() => setRejectMode(false)}>Batal</Button>
                      </>
                    )}
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
