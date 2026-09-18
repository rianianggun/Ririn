import React, { useEffect, useState, useCallback } from "react";
import { api, formatApiErrorDetail, openFile } from "../lib/api";
import { Navbar } from "../components/Navbar";
import { StatusPill } from "../components/StatusPill";
import { StatusStepper } from "../components/StatusStepper";
import { SubmissionScoreView } from "../components/SubmissionScoreView";
import { ReportsPanel } from "../components/ReportsPanel";
import { URUSAN, SUB_URUSAN, STATUS_META } from "../lib/constants";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "../components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "../components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import { toast } from "sonner";
import { Plus, FileUp, CheckCircle2, AlertTriangle, Eye, Loader2, Send, FileText, Building2, Layers } from "lucide-react";

export default function PerangkatDashboard() {
  const [subs, setSubs] = useState([]);
  const [period, setPeriod] = useState(null);
  const [stats, setStats] = useState({ counts: {} });
  const [me, setMe] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [detail, setDetail] = useState(null);
  const [detailIndicators, setDetailIndicators] = useState({ umum: [], teknis: [] });
  const [uploading, setUploading] = useState(null);
  const [form, setForm] = useState({ device_name: "", urusan: "", sub_urusan: "" });

  const load = useCallback(async () => {
    const [s, p, st, m] = await Promise.all([
      api.get("/submissions"), api.get("/periods/active"), api.get("/stats/overview"), api.get("/auth/me"),
    ]);
    setSubs(s.data); setPeriod(p.data && p.data.id ? p.data : null); setStats(st.data); setMe(m.data);
    return s.data;
  }, []);
  useEffect(() => { load(); }, [load]);

  const subUrusanOptions = SUB_URUSAN[form.urusan] || null;

  const createSubmission = async () => {
    if (!form.device_name || !form.urusan) return toast.error("Lengkapi nama perangkat & urusan");
    if (subUrusanOptions && !form.sub_urusan) return toast.error("Pilih sub-urusan");
    if (!period) return toast.error("Belum ada periode evaluasi aktif");
    try {
      const { data } = await api.post("/submissions", {
        device_name: form.device_name, urusan: form.urusan,
        sub_urusan: subUrusanOptions ? form.sub_urusan : null, period_id: period.id,
      });
      toast.success("Pengajuan dibuat, silakan unggah berkas");
      setCreateOpen(false); setForm({ device_name: "", urusan: "", sub_urusan: "" });
      const list = await load();
      openDetail(data.id ? data : list.find((x) => x.id === data.id) || data);
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
  };

  const openDetail = async (s) => {
    setDetail(s);
    const { data } = await api.get("/indicators/for-submission", { params: { level: s.level, urusan: s.urusan, sub_urusan: s.sub_urusan || undefined } });
    setDetailIndicators(data);
  };
  const refreshDetail = async (id) => {
    const list = await load();
    const found = list.find((x) => x.id === id);
    if (found) setDetail(found);
  };

  const uploadFor = async (indicatorId, file) => {
    if (!file) return;
    setUploading(indicatorId);
    const fd = new FormData();
    fd.append("indicator_id", String(indicatorId)); fd.append("file", file);
    try {
      await api.post(`/submissions/${detail.id}/upload`, fd, { headers: { "Content-Type": "multipart/form-data" } });
      toast.success("Berkas diunggah"); await refreshDetail(detail.id);
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
    setUploading(null);
  };
  const submitFinal = async () => {
    try { await api.post(`/submissions/${detail.id}/submit`); toast.success("Pengajuan dikirim untuk verifikasi"); await refreshDetail(detail.id); }
    catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
  };

  const c = stats.counts || {};
  const cards = [
    { label: "Total Pengajuan", value: c.total || 0, icon: FileText, color: "text-slate-700" },
    { label: "Perbaikan", value: c.ditolak || 0, icon: AlertTriangle, color: "text-red-600" },
    { label: "Diproses", value: (c.menunggu_verifikasi || 0) + (c.menunggu_penilaian || 0), icon: Loader2, color: "text-amber-600" },
    { label: "Selesai", value: c.selesai || 0, icon: CheckCircle2, color: "text-emerald-600" },
  ];
  const editable = detail && (detail.status === "draft" || detail.status === "ditolak");

  const UploadRow = ({ ind }) => {
    const up = (detail.uploads || {})[ind.id];
    return (
      <div className="rounded-lg border border-border p-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-medium text-slate-800">{ind.order}. {ind.name}</div>
          {up ? (
            <button className="text-xs text-emerald-700 hover:underline flex items-center gap-1 mt-0.5" onClick={() => openFile(up.file_id)}>
              <CheckCircle2 className="w-3 h-3" /> {up.original_filename}
            </button>
          ) : <div className="text-xs text-muted-foreground mt-0.5">Belum diunggah</div>}
        </div>
        {editable ? (
          <label className="shrink-0">
            <input type="file" className="hidden" data-testid={`upload-input-${ind.id}`} onChange={(e) => uploadFor(ind.id, e.target.files[0])} />
            <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg border cursor-pointer transition-colors ${up ? "border-slate-300 text-slate-600 hover:bg-slate-50" : "border-primary text-primary hover:bg-primary hover:text-white"}`}>
              {uploading === ind.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileUp className="w-3.5 h-3.5" />}{up ? "Ganti" : "Unggah"}
            </span>
          </label>
        ) : up ? <Button variant="ghost" size="sm" onClick={() => openFile(up.file_id)}><Eye className="w-4 h-4" /></Button> : null}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar period={period} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-slate-900">Dashboard Perangkat Daerah</h1>
            <p className="text-muted-foreground text-sm mt-1">Area: <span className="font-semibold text-slate-700">{me?.area}</span> ({me?.level}) · Unggah berkas per indikator PP 18/2016.</p>
          </div>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button data-testid="new-submission-btn" className="gap-2 h-11" disabled={period?.upload_locked}><Plus className="w-4 h-4" /> Ajukan Urusan Baru</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Pengajuan Urusan Baru</DialogTitle></DialogHeader>
              <div className="space-y-4 py-2">
                <div className="rounded-lg bg-muted/40 border border-border px-3 py-2 text-sm text-muted-foreground">Area otomatis: <span className="font-semibold text-slate-700">{me?.area}</span></div>
                <div className="space-y-2">
                  <Label>Nama Perangkat Daerah</Label>
                  <Input data-testid="submission-device-input" placeholder="mis. Dinas Pendidikan" value={form.device_name} onChange={(e) => setForm({ ...form, device_name: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Urusan</Label>
                  <Select value={form.urusan} onValueChange={(v) => setForm({ ...form, urusan: v, sub_urusan: "" })}>
                    <SelectTrigger data-testid="submission-urusan-select"><SelectValue placeholder="Pilih urusan" /></SelectTrigger>
                    <SelectContent className="max-h-72">{URUSAN.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                {subUrusanOptions && (
                  <div className="space-y-2">
                    <Label>Sub-Urusan</Label>
                    <Select value={form.sub_urusan} onValueChange={(v) => setForm({ ...form, sub_urusan: v })}>
                      <SelectTrigger data-testid="submission-suburusan-select"><SelectValue placeholder="Pilih sub-urusan" /></SelectTrigger>
                      <SelectContent>{subUrusanOptions.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                )}
              </div>
              <DialogFooter><Button data-testid="submission-create-confirm" onClick={createSubmission}>Buat Pengajuan</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {period?.upload_locked && (
          <div className="mb-6 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> Unggahan berkas sedang dikunci oleh administrator.
          </div>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {cards.map((s) => (
            <div key={s.label} className="rounded-2xl border border-border bg-white p-5">
              <s.icon className={`w-5 h-5 ${s.color}`} />
              <div className="text-3xl font-display font-extrabold text-slate-900 mt-3">{s.value}</div>
              <div className="text-xs text-muted-foreground mt-1">{s.label}</div>
            </div>
          ))}
        </div>

        <Tabs defaultValue="pengajuan">
          <TabsList>
            <TabsTrigger value="pengajuan" data-testid="tab-pengajuan">Pengajuan Saya</TabsTrigger>
            <TabsTrigger value="laporan" data-testid="tab-laporan">Laporan Hasil</TabsTrigger>
          </TabsList>
          <TabsContent value="pengajuan" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {subs.length === 0 && (
                <div className="col-span-full text-center py-16 rounded-2xl border border-dashed border-border">
                  <Building2 className="w-10 h-10 mx-auto text-muted-foreground/50" />
                  <p className="text-muted-foreground mt-3">Belum ada pengajuan. Klik "Ajukan Urusan Baru".</p>
                </div>
              )}
              {subs.map((s) => (
                <div key={s.id} data-testid={`submission-card-${s.id}`} className="rounded-2xl border border-border bg-white p-5 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-display font-bold text-slate-900 truncate">{s.device_name}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{s.urusan}{s.sub_urusan ? ` — ${s.sub_urusan}` : ""} · {s.year}</div>
                    </div>
                    <StatusPill status={s.status} />
                  </div>
                  <div className="my-5"><StatusStepper status={s.status} /></div>
                  {s.status === "ditolak" && s.rejection_note && (
                    <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700 mb-3"><span className="font-semibold">Catatan perbaikan: </span>{s.rejection_note}</div>
                  )}
                  <Button variant="outline" size="sm" className="w-full gap-2" data-testid={`open-submission-${s.id}`} onClick={() => openDetail(s)}>
                    <Eye className="w-4 h-4" /> {s.status === "selesai" ? "Lihat Hasil" : (s.status === "draft" || s.status === "ditolak") ? "Kelola & Unggah" : "Lihat Detail"}
                  </Button>
                </div>
              ))}
            </div>
          </TabsContent>
          <TabsContent value="laporan" className="mt-6"><ReportsPanel canManage={false} /></TabsContent>
        </Tabs>
      </main>

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {detail && (
            <>
              <DialogHeader><DialogTitle>{detail.device_name}</DialogTitle></DialogHeader>
              <div className="text-xs text-muted-foreground -mt-2">{detail.area} · {detail.urusan}{detail.sub_urusan ? ` — ${detail.sub_urusan}` : ""} · Tahun {detail.year}</div>
              <div className="my-4"><StatusStepper status={detail.status} /></div>

              {detail.status === "ditolak" && detail.rejection_note && (
                <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 mb-2">
                  <div className="font-semibold flex items-center gap-1.5"><AlertTriangle className="w-4 h-4" /> Perbaikan diperlukan</div>
                  <p className="mt-1">{detail.rejection_note}</p>
                </div>
              )}

              {detail.status === "selesai" && detail.scoring ? (
                <SubmissionScoreView submission={detail} />
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-900"><Layers className="w-4 h-4 text-accent" /> Faktor Umum (unggah sekali)</div>
                  {detailIndicators.umum.map((ind) => <UploadRow key={ind.id} ind={ind} />)}
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 pt-2"><Layers className="w-4 h-4 text-primary" /> Faktor Teknis — {detail.urusan}</div>
                  {detailIndicators.teknis.length === 0 && <div className="text-xs text-muted-foreground rounded-lg bg-muted/40 px-3 py-2">Indikator teknis untuk urusan ini belum dikonfigurasi admin.</div>}
                  {detailIndicators.teknis.map((ind) => <UploadRow key={ind.id} ind={ind} />)}
                  {editable && (
                    <Button className="w-full gap-2 mt-3 h-11" data-testid="submit-submission-btn" onClick={submitFinal}><Send className="w-4 h-4" /> Kirim untuk Verifikasi</Button>
                  )}
                  {(detail.status === "menunggu_verifikasi" || detail.status === "menunggu_penilaian") && (
                    <div className="rounded-lg bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-700 mt-2">Pengajuan sedang {STATUS_META[detail.status].label.toLowerCase()}. Mohon menunggu.</div>
                  )}
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
