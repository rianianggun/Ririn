import React, { useEffect, useState, useCallback } from "react";
import { api, formatApiErrorDetail } from "../lib/api";
import { Navbar } from "../components/Navbar";
import { AREAS, ROLE_META, URUSAN, SUB_URUSAN } from "../lib/constants";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Textarea } from "../components/ui/textarea";
import { Switch } from "../components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "../components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import { toast } from "sonner";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, LineChart, Line, Legend } from "recharts";
import { Users, ListChecks, CalendarRange, LayoutDashboard, Plus, Pencil, Trash2, KeyRound, Lock, Unlock, History } from "lucide-react";

export default function AdminDashboard() {
  const [period, setPeriod] = useState(null);
  return (
    <div className="min-h-screen bg-background">
      <Navbar period={period} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-8">
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-slate-900 flex items-center gap-2"><LayoutDashboard className="w-7 h-7 text-purple-600" /> Panel Administrator</h1>
          <p className="text-muted-foreground text-sm mt-1">Kelola pengguna, indikator PP 18/2016, periode evaluasi, dan jejak audit.</p>
        </div>
        <Tabs defaultValue="overview">
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="overview" data-testid="tab-overview" className="gap-1.5"><LayoutDashboard className="w-4 h-4" />Ikhtisar</TabsTrigger>
            <TabsTrigger value="users" data-testid="tab-users" className="gap-1.5"><Users className="w-4 h-4" />Pengguna</TabsTrigger>
            <TabsTrigger value="indicators" data-testid="tab-indicators" className="gap-1.5"><ListChecks className="w-4 h-4" />Indikator</TabsTrigger>
            <TabsTrigger value="periods" data-testid="tab-periods" className="gap-1.5"><CalendarRange className="w-4 h-4" />Periode</TabsTrigger>
            <TabsTrigger value="audit" data-testid="tab-audit" className="gap-1.5"><History className="w-4 h-4" />Audit</TabsTrigger>
          </TabsList>
          <TabsContent value="overview" className="mt-6"><Overview /></TabsContent>
          <TabsContent value="users" className="mt-6"><UsersTab /></TabsContent>
          <TabsContent value="indicators" className="mt-6"><IndicatorsTab /></TabsContent>
          <TabsContent value="periods" className="mt-6"><PeriodsTab onActive={setPeriod} /></TabsContent>
          <TabsContent value="audit" className="mt-6"><AuditTab /></TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function Overview() {
  const [stats, setStats] = useState({ counts: {} });
  const [yearly, setYearly] = useState([]);
  const [byArea, setByArea] = useState([]);
  useEffect(() => {
    (async () => {
      const [s, y, a] = await Promise.all([api.get("/stats/overview"), api.get("/stats/yearly"), api.get("/stats/by-area")]);
      setStats(s.data); setYearly(y.data); setByArea(a.data);
    })();
  }, []);
  const c = stats.counts || {};
  const cards = [
    { label: "Pengguna", value: stats.users || 0 }, { label: "Total Pengajuan", value: c.total || 0 },
    { label: "Menunggu Verifikasi", value: c.menunggu_verifikasi || 0 }, { label: "Menunggu Penilaian", value: c.menunggu_penilaian || 0 },
    { label: "Perbaikan", value: c.ditolak || 0 }, { label: "Selesai", value: c.selesai || 0 },
  ];
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {cards.map((x) => <div key={x.label} className="rounded-2xl border border-border bg-white p-4"><div className="text-3xl font-display font-extrabold text-slate-900">{x.value}</div><div className="text-xs text-muted-foreground mt-1">{x.label}</div></div>)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-border bg-white p-5">
          <div className="text-sm font-semibold text-slate-900 mb-4">Rata-rata Total Nilai per Tahun</div>
          {yearly.length === 0 ? <Empty /> : (
            <ResponsiveContainer width="100%" height={280}><LineChart data={yearly}><CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" /><XAxis dataKey="year" tick={{ fontSize: 12 }} /><YAxis domain={[0, 1000]} tick={{ fontSize: 12 }} /><Tooltip /><Legend /><Line type="monotone" dataKey="avg_total" name="Rata-rata" stroke="#059669" strokeWidth={2} /></LineChart></ResponsiveContainer>
          )}
        </div>
        <div className="rounded-2xl border border-border bg-white p-5">
          <div className="text-sm font-semibold text-slate-900 mb-4">Rata-rata Total Nilai per Area</div>
          {byArea.length === 0 ? <Empty /> : (
            <ResponsiveContainer width="100%" height={280}><BarChart data={byArea} layout="vertical" margin={{ left: 40 }}><CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" /><XAxis type="number" domain={[0, 1000]} tick={{ fontSize: 11 }} /><YAxis type="category" dataKey="area" tick={{ fontSize: 9 }} width={120} /><Tooltip /><Bar dataKey="avg_total" name="Rata-rata" fill="#D97706" radius={[0, 4, 4, 0]} /></BarChart></ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
const Empty = () => <div className="text-center py-16 text-sm text-muted-foreground">Belum ada data selesai dinilai.</div>;

function UsersTab() {
  const [users, setUsers] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [pwUser, setPwUser] = useState(null);
  const [newPw, setNewPw] = useState("");
  const empty = { email: "", password: "", name: "", role: "perangkat", area: "" };
  const [form, setForm] = useState(empty);
  const load = useCallback(async () => setUsers((await api.get("/users")).data), []);
  useEffect(() => { load(); }, [load]);
  const needArea = form.role === "perangkat" || form.role === "verifikator";

  const save = async () => {
    try {
      if (editing) { await api.put(`/users/${editing.id}`, { name: form.name, role: form.role, area: needArea ? form.area : null }); toast.success("Diperbarui"); }
      else { if (!form.email || !form.password || !form.name) return toast.error("Lengkapi data"); if (needArea && !form.area) return toast.error("Pilih area"); await api.post("/users", { ...form, area: needArea ? form.area : null }); toast.success("Dibuat"); }
      setOpen(false); setEditing(null); setForm(empty); await load();
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
  };
  const del = async (u) => { if (!window.confirm(`Hapus ${u.name}?`)) return; try { await api.delete(`/users/${u.id}`); toast.success("Dihapus"); await load(); } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); } };
  const toggleActive = async (u) => { await api.put(`/users/${u.id}`, { active: !u.active }); await load(); };
  const resetPw = async () => { if (!newPw) return toast.error("Isi kata sandi"); await api.post(`/users/${pwUser.id}/reset-password`, { password: newPw }); toast.success("Diperbarui"); setPwUser(null); setNewPw(""); };

  return (
    <div>
      <div className="flex justify-end mb-4"><Button className="gap-2" data-testid="add-user-btn" onClick={() => { setEditing(null); setForm(empty); setOpen(true); }}><Plus className="w-4 h-4" /> Tambah Pengguna</Button></div>
      <div className="rounded-2xl border border-border bg-white overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs text-muted-foreground"><tr><th className="px-4 py-3">Nama</th><th className="px-4 py-3">Email</th><th className="px-4 py-3">Peran</th><th className="px-4 py-3">Area</th><th className="px-4 py-3 text-center">Aktif</th><th className="px-4 py-3 text-right">Aksi</th></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} data-testid={`user-row-${u.id}`} className="border-t border-border">
                <td className="px-4 py-3 font-medium text-slate-800">{u.name}</td>
                <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                <td className="px-4 py-3"><span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${ROLE_META[u.role]?.cls}`}>{ROLE_META[u.role]?.label}</span></td>
                <td className="px-4 py-3 text-muted-foreground text-xs">{u.area || "-"}</td>
                <td className="px-4 py-3 text-center"><Switch checked={u.active !== false} onCheckedChange={() => toggleActive(u)} data-testid={`toggle-active-${u.id}`} /></td>
                <td className="px-4 py-3"><div className="flex justify-end gap-1">
                  <Button variant="ghost" size="icon" data-testid={`edit-user-${u.id}`} onClick={() => { setEditing(u); setForm({ ...empty, name: u.name, role: u.role, area: u.area || "" }); setOpen(true); }}><Pencil className="w-4 h-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => setPwUser(u)}><KeyRound className="w-4 h-4" /></Button>
                  <Button variant="ghost" size="icon" className="text-red-600" data-testid={`delete-user-${u.id}`} onClick={() => del(u)}><Trash2 className="w-4 h-4" /></Button>
                </div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Edit Pengguna" : "Tambah Pengguna"}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5"><Label>Nama</Label><Input data-testid="user-name-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            {!editing && (<>
              <div className="space-y-1.5"><Label>Email</Label><Input data-testid="user-email-input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Kata Sandi</Label><Input data-testid="user-password-input" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
            </>)}
            <div className="space-y-1.5"><Label>Peran</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                <SelectTrigger data-testid="user-role-select"><SelectValue /></SelectTrigger>
                <SelectContent>{["admin", "perangkat", "verifikator", "penilai"].map((r) => <SelectItem key={r} value={r}>{ROLE_META[r].label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {needArea && (
              <div className="space-y-1.5"><Label>Area</Label>
                <Select value={form.area} onValueChange={(v) => setForm({ ...form, area: v })}>
                  <SelectTrigger data-testid="user-area-select"><SelectValue placeholder="Pilih area" /></SelectTrigger>
                  <SelectContent>{AREAS.map((a) => <SelectItem key={a.name} value={a.name}>{a.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter><Button data-testid="save-user-btn" onClick={save}>Simpan</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={!!pwUser} onOpenChange={(o) => !o && setPwUser(null)}>
        <DialogContent><DialogHeader><DialogTitle>Reset Kata Sandi — {pwUser?.name}</DialogTitle></DialogHeader>
          <Input data-testid="reset-pw-input" placeholder="Kata sandi baru" value={newPw} onChange={(e) => setNewPw(e.target.value)} />
          <DialogFooter><Button data-testid="reset-pw-confirm" onClick={resetPw}>Perbarui</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function IndicatorsTab() {
  const [umum, setUmum] = useState([]);
  const [level, setLevel] = useState("kabupaten");
  const [urusan, setUrusan] = useState("Bidang Pendidikan");
  const [subUrusan, setSubUrusan] = useState("");
  const [teknis, setTeknis] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: "", description: "", order: 0 });
  const subOpts = SUB_URUSAN[urusan] || null;

  const loadUmum = useCallback(async () => setUmum((await api.get("/indicators", { params: { type: "umum" } })).data), []);
  const loadTeknis = useCallback(async () => {
    const { data } = await api.get("/indicators/for-submission", { params: { level, urusan, sub_urusan: subOpts ? (subUrusan || undefined) : undefined } });
    setTeknis(data.teknis);
  }, [level, urusan, subUrusan, subOpts]);
  useEffect(() => { loadUmum(); }, [loadUmum]);
  useEffect(() => { loadTeknis(); }, [loadTeknis]);

  const saveTeknis = async () => {
    if (!form.name) return toast.error("Nama indikator wajib");
    if (subOpts && !subUrusan) return toast.error("Pilih sub-urusan dahulu");
    const payload = { type: "teknis", name: form.name, description: form.description, level, urusan, sub_urusan: subOpts ? subUrusan : null, order: form.order };
    try {
      if (editing) await api.put(`/indicators/${editing.id}`, payload); else await api.post("/indicators", payload);
      toast.success("Tersimpan"); setOpen(false); setEditing(null); setForm({ name: "", description: "", order: 0 }); await loadTeknis();
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
  };
  const delTeknis = async (i) => { if (!window.confirm(`Hapus "${i.name}"?`)) return; await api.delete(`/indicators/${i.id}`); await loadTeknis(); };
  const saveUmum = async (i) => { await api.put(`/indicators/${i.id}`, { type: "umum", name: i.name, description: i.description, order: i.order }); toast.success("Faktor umum diperbarui"); await loadUmum(); };

  return (
    <div className="space-y-8">
      <div>
        <div className="font-display font-bold text-slate-900 mb-3">Faktor Umum (berlaku untuk semua urusan · bobot 20%)</div>
        <div className="space-y-2">
          {umum.map((i, idx) => (
            <div key={i.id} data-testid={`umum-row-${i.id}`} className="rounded-xl border border-border bg-white p-4 grid grid-cols-1 md:grid-cols-12 gap-2 items-center">
              <Input className="md:col-span-4" value={i.name} onChange={(e) => setUmum((u) => u.map((x, j) => j === idx ? { ...x, name: e.target.value } : x))} />
              <Input className="md:col-span-6" value={i.description} onChange={(e) => setUmum((u) => u.map((x, j) => j === idx ? { ...x, description: e.target.value } : x))} />
              <Button className="md:col-span-2" size="sm" variant="outline" data-testid={`save-umum-${i.id}`} onClick={() => saveUmum(i)}>Simpan</Button>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="font-display font-bold text-slate-900 mb-3">Faktor Teknis per Urusan & Level (bobot 80%)</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
          <div className="space-y-1.5"><Label>Level</Label>
            <Select value={level} onValueChange={setLevel}><SelectTrigger data-testid="ind-level-select"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="provinsi">Provinsi</SelectItem><SelectItem value="kabupaten">Kabupaten/Kota</SelectItem></SelectContent></Select>
          </div>
          <div className="space-y-1.5"><Label>Urusan</Label>
            <Select value={urusan} onValueChange={(v) => { setUrusan(v); setSubUrusan(""); }}><SelectTrigger data-testid="ind-urusan-select"><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-72">{URUSAN.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent></Select>
          </div>
          {subOpts && (
            <div className="space-y-1.5"><Label>Sub-Urusan</Label>
              <Select value={subUrusan} onValueChange={setSubUrusan}><SelectTrigger data-testid="ind-suburusan-select"><SelectValue placeholder="Pilih" /></SelectTrigger>
                <SelectContent>{subOpts.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent></Select>
            </div>
          )}
        </div>
        <div className="flex justify-end mb-3"><Button className="gap-2" data-testid="add-teknis-btn" onClick={() => { setEditing(null); setForm({ name: "", description: "", order: teknis.length + 1 }); setOpen(true); }}><Plus className="w-4 h-4" /> Tambah Indikator Teknis</Button></div>
        <div className="space-y-2">
          {teknis.length === 0 && <div className="text-sm text-muted-foreground rounded-xl border border-dashed border-border p-6 text-center">Belum ada indikator teknis untuk kombinasi ini.</div>}
          {teknis.map((i) => (
            <div key={i.id} data-testid={`teknis-row-${i.id}`} className="rounded-xl border border-border bg-white p-4 flex items-start justify-between gap-4">
              <div className="min-w-0"><div className="font-semibold text-slate-900">{i.order}. {i.name}</div>{i.description && <div className="text-sm text-muted-foreground mt-0.5">{i.description}</div>}</div>
              <div className="flex gap-1 shrink-0">
                <Button variant="ghost" size="icon" data-testid={`edit-teknis-${i.id}`} onClick={() => { setEditing(i); setForm({ name: i.name, description: i.description, order: i.order }); setOpen(true); }}><Pencil className="w-4 h-4" /></Button>
                <Button variant="ghost" size="icon" className="text-red-600" onClick={() => delTeknis(i)}><Trash2 className="w-4 h-4" /></Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Edit" : "Tambah"} Indikator Teknis</DialogTitle></DialogHeader>
          <div className="text-xs text-muted-foreground -mt-1">{level} · {urusan}{subOpts && subUrusan ? ` — ${subUrusan}` : ""}</div>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5"><Label>Nama Indikator</Label><Input data-testid="teknis-name-input" placeholder="mis. Jumlah satuan pendidikan..." value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Deskripsi</Label><Textarea data-testid="teknis-desc-input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} /></div>
            <div className="space-y-1.5"><Label>Urutan</Label><Input type="number" data-testid="teknis-order-input" value={form.order} onChange={(e) => setForm({ ...form, order: parseInt(e.target.value) || 0 })} /></div>
          </div>
          <DialogFooter><Button data-testid="save-teknis-btn" onClick={saveTeknis}>Simpan</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PeriodsTab({ onActive }) {
  const [periods, setPeriods] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const y = new Date().getFullYear();
  const empty = { year: y, name: `Evaluasi Perangkat Daerah ${y}`, start_date: `${y}-01-01`, end_date: `${y}-12-31`, upload_locked: false, active: true };
  const [form, setForm] = useState(empty);
  const load = useCallback(async () => { const d = (await api.get("/periods")).data; setPeriods(d); const act = d.find((p) => p.active); if (act) onActive(act); }, [onActive]);
  useEffect(() => { load(); }, [load]);
  const save = async () => { try { if (editing) await api.put(`/periods/${editing.id}`, form); else await api.post("/periods", form); toast.success("Tersimpan"); setOpen(false); setEditing(null); setForm(empty); await load(); } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); } };
  const toggleLock = async (p) => { await api.put(`/periods/${p.id}`, { ...p, upload_locked: !p.upload_locked }); toast.success(p.upload_locked ? "Unggahan dibuka" : "Unggahan dikunci"); await load(); };
  const del = async (p) => { if (!window.confirm(`Hapus ${p.name}?`)) return; await api.delete(`/periods/${p.id}`); await load(); };

  return (
    <div>
      <div className="flex items-center justify-between mb-4"><p className="text-sm text-muted-foreground">Evaluasi setahun sekali. Kunci unggahan untuk membatasi jendela waktu.</p><Button className="gap-2" data-testid="add-period-btn" onClick={() => { setEditing(null); setForm(empty); setOpen(true); }}><Plus className="w-4 h-4" /> Tambah Periode</Button></div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {periods.map((p) => (
          <div key={p.id} data-testid={`period-row-${p.id}`} className={`rounded-2xl border p-5 ${p.active ? "border-primary bg-primary/5" : "border-border bg-white"}`}>
            <div className="font-display font-bold text-slate-900">{p.name}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{p.start_date} s/d {p.end_date}</div>
            <div className="flex gap-2 mt-2">
              {p.active && <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-300">Aktif</span>}
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${p.upload_locked ? "bg-red-100 text-red-700 border-red-300" : "bg-slate-100 text-slate-600 border-slate-300"}`}>{p.upload_locked ? "Terkunci" : "Terbuka"}</span>
            </div>
            <div className="flex gap-2 mt-4">
              <Button variant="outline" size="sm" className="gap-1.5 flex-1" data-testid={`lock-period-${p.id}`} onClick={() => toggleLock(p)}>{p.upload_locked ? <><Unlock className="w-4 h-4" /> Buka</> : <><Lock className="w-4 h-4" /> Kunci</>}</Button>
              <Button variant="ghost" size="icon" data-testid={`edit-period-${p.id}`} onClick={() => { setEditing(p); setForm({ year: p.year, name: p.name, start_date: p.start_date, end_date: p.end_date, upload_locked: p.upload_locked, active: p.active }); setOpen(true); }}><Pencil className="w-4 h-4" /></Button>
              <Button variant="ghost" size="icon" className="text-red-600" onClick={() => del(p)}><Trash2 className="w-4 h-4" /></Button>
            </div>
          </div>
        ))}
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent><DialogHeader><DialogTitle>{editing ? "Edit Periode" : "Tambah Periode"}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5"><Label>Nama Periode</Label><Input data-testid="period-name-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5"><Label>Tahun</Label><Input type="number" data-testid="period-year-input" value={form.year} onChange={(e) => setForm({ ...form, year: parseInt(e.target.value) || y })} /></div>
              <div className="space-y-1.5"><Label>Mulai</Label><Input type="date" data-testid="period-start-input" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Selesai</Label><Input type="date" data-testid="period-end-input" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} /></div>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-3"><Label>Jadikan periode aktif</Label><Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} data-testid="period-active-switch" /></div>
            <div className="flex items-center justify-between rounded-lg border border-border p-3"><Label>Kunci unggahan berkas</Label><Switch checked={form.upload_locked} onCheckedChange={(v) => setForm({ ...form, upload_locked: v })} data-testid="period-lock-switch" /></div>
          </div>
          <DialogFooter><Button data-testid="save-period-btn" onClick={save}>Simpan</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AuditTab() {
  const [feed, setFeed] = useState([]);
  useEffect(() => { api.get("/audit").then((r) => setFeed(r.data)).catch(() => {}); }, []);
  return (
    <div className="rounded-2xl border border-border bg-white p-2 sm:p-4" data-testid="audit-feed">
      {feed.length === 0 ? <Empty /> : (
        <div className="divide-y divide-border">
          {feed.map((a, i) => (
            <div key={i} className="py-3 px-2 flex items-start gap-3">
              <div className="w-2 h-2 rounded-full bg-primary mt-2 shrink-0" />
              <div className="min-w-0">
                <div className="text-sm text-slate-800"><span className="font-semibold">{a.action}</span> — {a.device_name} <span className="text-muted-foreground">({a.urusan}, {a.area})</span></div>
                <div className="text-xs text-muted-foreground mt-0.5">oleh {a.by} · {ROLE_META[a.by_role]?.label || a.by_role} · {new Date(a.at).toLocaleString("id-ID")}{a.detail ? ` · ${a.detail}` : ""}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
