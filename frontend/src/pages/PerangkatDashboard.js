import React, { useEffect, useState, useCallback } from "react";
import { api, formatApiErrorDetail, openFile } from "../lib/api";
import { Navbar } from "../components/Navbar";
import { StatusPill } from "../components/StatusPill";
import { StatusStepper } from "../components/StatusStepper";
import { SubmissionScoreView } from "../components/SubmissionScoreView";
import { ReportsPanel } from "../components/ReportsPanel";
import { URUSAN, SUB_URUSAN } from "../lib/constants";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger, DialogDescription } from "../components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "../components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import { toast } from "sonner";
import { Plus, FileUp, CheckCircle2, AlertTriangle, Eye, Loader2, Send, ArrowLeft, Trash2, Layers } from "lucide-react";

export default function PerangkatDashboard() {
  const [subs, setSubs] = useState([]);
  const [period, setPeriod] = useState(null);
  const [me, setMe] = useState(null);
  const [urusanList, setUrusanList] = useState(URUSAN);
  const [subMap, setSubMap] = useState(SUB_URUSAN);
  const [createOpen, setCreateOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [activeId, setActiveId] = useState(null);
  const [detailIndicators, setDetailIndicators] = useState({ umum: [], teknis: [] });
  const [uploading, setUploading] = useState(null);
  const [yearFilter, setYearFilter] = useState("all");
  const [form, setForm] = useState({ device_name: "", urusan: "", sub_urusan: "" });

  const active = subs.find((s) => s.id === activeId) || null;
  const editable = active && (active.status === "draft" || active.status === "ditolak");

  const load = useCallback(async () => {
    const [s, p, m] = await Promise.all([api.get("/submissions"), api.get("/periods/active"), api.get("/auth/me")]);
    setSubs(s.data); setPeriod(p.data && p.data.id ? p.data : null); setMe(m.data);
    return s.data;
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { api.get("/reference/urusan").then((r) => { setUrusanList(r.data.urusan); setSubMap(r.data.sub_urusan); }).catch(() => {}); }, []);

  const subUrusanOptions = subMap[form.urusan] || null;

  const openDetail = async (s) => {
    setActiveId(s.id);
    const { data } = await api.get("/indicators/for-submission", { params: { level: s.level, urusan: s.urusan, sub_urusan: s.sub_urusan || undefined } });
    setDetailIndicators(data);
  };

  const createSubmission = async () => {
    if (!form.device_name || !form.urusan) return toast.error("Lengkapi nama perangkat & urusan");
    if (subUrusanOptions && !form.sub_urusan) return toast.error("Pilih sub-urusan");
    if (!period) return toast.error("Belum ada periode evaluasi aktif");
    try {
      const { data } = await api.post("/submissions", { device_name: form.device_name, urusan: form.urusan, sub_urusan: subUrusanOptions ? form.sub_urusan : null, period_id: period.id });
      toast.success("Pengajuan dibuat, silakan unggah berkas");
      setCreateOpen(false); setForm({ device_name: "", urusan: "", sub_urusan: "" });
      await load(); await openDetail(data);
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
  };

  const uploadFor = async (indicatorId, file) => {
    if (!file) return;
    setUploading(indicatorId);
    const fd = new FormData(); fd.append("indicator_id", String(indicatorId)); fd.append("file", file);
    try { await api.post(`/submissions/${activeId}/upload`, fd, { headers: { "Content-Type": "multipart/form-data" } }); toast.success("Berkas diunggah"); await load(); }
    catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
    setUploading(null);
  };
  const deleteUpload = async (indicatorId) => {
    try { await api.delete(`/submissions/${activeId}/upload/${indicatorId}`); toast.success("Berkas dihapus"); await load(); }
    catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
  };
  const submitFinal = async () => {
    setConfirmOpen(false);
    try { await api.post(`/submissions/${activeId}/submit`); toast.success("Pengajuan dikirim untuk verifikasi"); await load(); }
    catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
  };

  const years = [...new Set(subs.map((s) => s.year))].sort((a, b) => b - a);
  const filtered = yearFilter === "all" ? subs : subs.filter((s) => String(s.year) === String(yearFilter));

  const UploadRow = ({ ind }) => {
    const up = (active.uploads || {})[ind.id];
    return (
      <div className="rounded-lg border border-border p-3 flex items-center justify-between gap-3 bg-white">
        <div className="min-w-0">
          <div className="text-sm font-medium text-slate-800">{ind.order}. {ind.name}</div>
          {up ? <button className="text-xs text-emerald-700 hover:underline flex items-center gap-1 mt-0.5" onClick={() => openFile(up.file_id)}><CheckCircle2 className="w-3 h-3" /> {up.original_filename}</button>
            : <div className="text-xs text-muted-foreground mt-0.5">Belum diunggah</div>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {up && <Button variant="ghost" size="icon" onClick={() => openFile(up.file_id)}><Eye className="w-4 h-4" /></Button>}
          {editable && (
            <>
              <label>
                <input type="file" className="hidden" data-testid={`upload-input-${ind.id}`} onChange={(e) => uploadFor(ind.id, e.target.files[0])} />
                <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg border cursor-pointer transition-colors ${up ? "border-slate-300 text-slate-600 hover:bg-slate-50" : "border-primary text-primary hover:bg-primary hover:text-white"}`}>
                  {uploading === ind.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileUp className="w-3.5 h-3.5" />}{up ? "Ganti" : "Unggah"}
                </span>
              </label>
              {up && <Button variant="ghost" size="icon" className="text-red-600" data-testid={`delete-upload-${ind.id}`} onClick={() => deleteUpload(ind.id)}><Trash2 className="w-4 h-4" /></Button>}
            </>
          )}
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
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
              <div>
                <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-slate-900">Dashboard Perangkat Daerah</h1>
                <p className="text-muted-foreground text-sm mt-1">Area: <span className="font-semibold text-slate-700">{me?.area}</span> ({me?.level}) · unggah berkas per indikator PP 18/2016.</p>
              </div>
              <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogTrigger asChild><Button data-testid="new-submission-btn" className="gap-2 h-11" disabled={period?.upload_locked}><Plus className="w-4 h-4" /> Ajukan Urusan Baru</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Pengajuan Urusan Baru</DialogTitle></DialogHeader>
                  <div className="space-y-4 py-2">
                    <div className="rounded-lg bg-muted/40 border border-border px-3 py-2 text-sm text-muted-foreground">Area otomatis: <span className="font-semibold text-slate-700">{me?.area}</span></div>
                    <div className="space-y-2"><Label>Nama Perangkat Daerah</Label><Input data-testid="submission-device-input" placeholder="mis. Dinas Pendidikan" value={form.device_name} onChange={(e) => setForm({ ...form, device_name: e.target.value })} /></div>
                    <div className="space-y-2"><Label>Urusan</Label>
                      <Select value={form.urusan} onValueChange={(v) => setForm({ ...form, urusan: v, sub_urusan: "" })}>
                        <SelectTrigger data-testid="submission-urusan-select"><SelectValue placeholder="Pilih urusan" /></SelectTrigger>
                        <SelectContent className="max-h-72">{urusanList.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    {subUrusanOptions && (
                      <div className="space-y-2"><Label>Sub-Urusan</Label>
                        <Select value={form.sub_urusan} onValueChange={(v) => setForm({ ...form, sub_urusan: v })}>
                          <SelectTrigger data-testid="submission-suburusan-select"><SelectValue placeholder="Pilih sub-urusan" /></SelectTrigger>
                          <SelectContent>{subUrusanOptions.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                  <DialogFooter><Button data-testid="submission-create-confirm" onClick={createSubmission}>Buat & Lanjut Unggah</Button></DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            {period?.upload_locked && <div className="mb-6 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> Unggahan berkas sedang dikunci oleh administrator.</div>}

            <Tabs defaultValue="pengajuan">
              <TabsList>
                <TabsTrigger value="pengajuan" data-testid="tab-pengajuan">Pengajuan Saya</TabsTrigger>
                <TabsTrigger value="laporan" data-testid="tab-laporan">Laporan Hasil</TabsTrigger>
              </TabsList>
              <TabsContent value="pengajuan" className="mt-6">
                <div className="flex items-center gap-3 mb-4">
                  <Label className="text-xs text-muted-foreground">Filter Tahun</Label>
                  <Select value={yearFilter} onValueChange={setYearFilter}>
                    <SelectTrigger className="w-40" data-testid="year-filter"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="all">Semua Tahun</SelectItem>{years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="rounded-2xl border border-border bg-white overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 text-left text-xs text-muted-foreground"><tr><th className="px-4 py-3">Perangkat Daerah</th><th className="px-4 py-3">Urusan</th><th className="px-4 py-3">Tahun</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Aksi</th></tr></thead>
                    <tbody>
                      {filtered.length === 0 && <tr><td colSpan={5} className="text-center py-12 text-muted-foreground">Belum ada pengajuan.</td></tr>}
                      {filtered.map((s) => (
                        <tr key={s.id} data-testid={`submission-row-${s.id}`} className="border-t border-border">
                          <td className="px-4 py-3 font-medium text-slate-800">{s.device_name}</td>
                          <td className="px-4 py-3 text-muted-foreground text-xs">{s.urusan}{s.sub_urusan ? ` — ${s.sub_urusan}` : ""}</td>
                          <td className="px-4 py-3">{s.year}</td>
                          <td className="px-4 py-3"><StatusPill status={s.status} /></td>
                          <td className="px-4 py-3 text-right"><Button variant="outline" size="sm" className="gap-1.5" data-testid={`open-submission-${s.id}`} onClick={() => openDetail(s)}><Eye className="w-4 h-4" /> {s.status === "selesai" ? "Hasil" : editableStatus(s) ? "Kelola" : "Detail"}</Button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </TabsContent>
              <TabsContent value="laporan" className="mt-6"><ReportsPanel canManage={false} /></TabsContent>
            </Tabs>
          </>
        ) : (
          <div>
            <button data-testid="back-to-list" onClick={() => setActiveId(null)} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-slate-900 mb-4"><ArrowLeft className="w-4 h-4" /> Kembali ke daftar</button>
            <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
              <div><h2 className="font-display text-2xl font-extrabold text-slate-900">{active.device_name}</h2><div className="text-sm text-muted-foreground">{active.area} · {active.urusan}{active.sub_urusan ? ` — ${active.sub_urusan}` : ""} · Tahun {active.year}</div></div>
              <StatusPill status={active.status} />
            </div>
            <div className="mb-6 max-w-2xl"><StatusStepper status={active.status} /></div>

            {active.status === "ditolak" && active.rejection_note && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 mb-4 max-w-3xl"><div className="font-semibold flex items-center gap-1.5"><AlertTriangle className="w-4 h-4" /> Perbaikan diperlukan</div><p className="mt-1">{active.rejection_note}</p><p className="mt-1 text-xs">Hapus & unggah ulang berkas terkait, lalu kirim kembali.</p></div>
            )}

            {active.status === "selesai" && active.scoring ? <SubmissionScoreView submission={active} /> : (
              <div className="space-y-3 max-w-3xl">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900"><Layers className="w-4 h-4 text-accent" /> Faktor Umum (unggah sekali)</div>
                {detailIndicators.umum.map((ind) => <UploadRow key={ind.id} ind={ind} />)}
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 pt-2"><Layers className="w-4 h-4 text-primary" /> Faktor Teknis — {active.urusan}</div>
                {detailIndicators.teknis.length === 0 && <div className="text-xs text-muted-foreground rounded-lg bg-muted/40 px-3 py-2">Indikator teknis untuk urusan ini belum dikonfigurasi admin.</div>}
                {detailIndicators.teknis.map((ind) => <UploadRow key={ind.id} ind={ind} />)}
                {editable && <Button className="w-full gap-2 mt-3 h-11" data-testid="submit-submission-btn" onClick={() => setConfirmOpen(true)}><Send className="w-4 h-4" /> Kirim untuk Verifikasi</Button>}
                {(active.status === "menunggu_verifikasi" || active.status === "menunggu_penilaian") && <div className="rounded-lg bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-700 mt-2">Pengajuan sedang diproses. Mohon menunggu.</div>}
              </div>
            )}
          </div>
        )}
      </main>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Kirim Pengajuan?</DialogTitle><DialogDescription>Apakah Anda sudah yakin dengan berkas yang dikirimkan? Setelah dikirim, berkas menunggu verifikasi.</DialogDescription></DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" data-testid="confirm-submit-back" onClick={() => setConfirmOpen(false)}>Cek Kembali</Button>
            <Button data-testid="confirm-submit-yes" onClick={submitFinal}>Ya, Lanjutkan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function editableStatus(s) { return s.status === "draft" || s.status === "ditolak"; }
