import React, { useEffect, useState, useCallback } from "react";
import { api, API, formatApiErrorDetail } from "../lib/api";
import { AREAS, TIPE_META } from "../lib/constants";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import { Checkbox } from "./ui/checkbox";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "./ui/select";
import { toast } from "sonner";
import { FileSpreadsheet, Download, Trash2, Save, Eye } from "lucide-react";

function TipeBadge({ tipe }) {
  const m = TIPE_META[tipe?.key] || { label: tipe?.label, cls: "" };
  return <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${m.cls}`}>{m.label}</span>;
}

export function ReportsPanel({ canManage }) {
  const [pairs, setPairs] = useState([]);
  const [area, setArea] = useState("");
  const [device, setDevice] = useState("");
  const [multiplier, setMultiplier] = useState(false);
  const [preview, setPreview] = useState(null);
  const [reports, setReports] = useState([]);

  const loadReports = useCallback(async () => setReports((await api.get("/reports")).data), []);
  useEffect(() => {
    loadReports();
    if (canManage) api.get("/reports/perangkat-list").then((r) => setPairs(r.data)).catch(() => {});
  }, [canManage, loadReports]);

  const devices = pairs.filter((p) => p.area === area).map((p) => p.device_name);

  const doPreview = async () => {
    if (!area || !device) return toast.error("Pilih area & perangkat daerah");
    try {
      const { data } = await api.get("/reports/preview", { params: { area, device_name: device, apply_multiplier: multiplier } });
      setPreview(data);
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
  };
  const saveReport = async () => {
    try {
      await api.post("/reports", { area, device_name: device, apply_multiplier: multiplier });
      toast.success("Laporan tersimpan"); setPreview(null); await loadReports();
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
  };
  const del = async (id) => { await api.delete(`/reports/${id}`); await loadReports(); };
  const downloadExcel = (id) => {
    const token = localStorage.getItem("token");
    window.open(`${API}/reports/${id}/excel?auth=${token}`, "_blank");
  };

  return (
    <div className="space-y-6">
      {canManage && (
        <div className="rounded-2xl border border-border bg-white p-5">
          <div className="font-display font-bold text-slate-900 mb-4">Buat Laporan Hasil Penilaian</div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
            <div className="space-y-1.5">
              <Label>Area</Label>
              <Select value={area} onValueChange={(v) => { setArea(v); setDevice(""); setPreview(null); }}>
                <SelectTrigger data-testid="report-area-select"><SelectValue placeholder="Pilih area" /></SelectTrigger>
                <SelectContent>{AREAS.map((a) => <SelectItem key={a.name} value={a.name}>{a.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Nama Perangkat Daerah</Label>
              <Select value={device} onValueChange={(v) => { setDevice(v); setPreview(null); }} disabled={!area}>
                <SelectTrigger data-testid="report-device-select"><SelectValue placeholder="Pilih perangkat" /></SelectTrigger>
                <SelectContent>{[...new Set(devices)].map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2 pb-2">
              <Checkbox id="mult" checked={multiplier} onCheckedChange={(v) => { setMultiplier(!!v); setPreview(null); }} data-testid="report-multiplier-checkbox" />
              <Label htmlFor="mult" className="cursor-pointer">Kalikan 1,1</Label>
            </div>
            <Button className="gap-2" data-testid="report-preview-btn" onClick={doPreview}><Eye className="w-4 h-4" /> Tampilkan</Button>
          </div>

          {preview && (
            <div className="mt-5">
              <div className="rounded-xl border border-border overflow-x-auto">
                <table className="w-full text-sm" data-testid="report-preview-table">
                  <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                    <tr><th className="px-3 py-2">Urusan</th><th className="px-3 py-2 text-center">F. Umum (20%)</th><th className="px-3 py-2 text-center">F. Teknis (80%)</th><th className="px-3 py-2 text-center">Total</th><th className="px-3 py-2 text-center">Nilai Akhir{multiplier ? " ×1,1" : ""}</th><th className="px-3 py-2 text-center">Tipe</th></tr>
                  </thead>
                  <tbody>
                    {preview.rows.length === 0 && <tr><td colSpan={6} className="text-center py-6 text-muted-foreground">Belum ada urusan selesai dinilai.</td></tr>}
                    {preview.rows.map((r) => (
                      <tr key={r.submission_id} className="border-t border-slate-100">
                        <td className="px-3 py-2 text-slate-700">{r.urusan}{r.sub_urusan ? ` — ${r.sub_urusan}` : ""}</td>
                        <td className="px-3 py-2 text-center font-mono">{r.umum_avg}</td>
                        <td className="px-3 py-2 text-center font-mono">{r.teknis_avg}</td>
                        <td className="px-3 py-2 text-center font-mono">{r.total}</td>
                        <td className="px-3 py-2 text-center font-mono font-bold text-primary">{r.final}</td>
                        <td className="px-3 py-2 text-center"><TipeBadge tipe={r.tipe} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {preview.rows.length > 0 && (
                <Button className="gap-2 mt-4" data-testid="report-save-btn" onClick={saveReport}><Save className="w-4 h-4" /> Simpan Laporan</Button>
              )}
            </div>
          )}
        </div>
      )}

      <div>
        <div className="font-display font-bold text-slate-900 mb-3">Laporan Tersimpan</div>
        {reports.length === 0 ? (
          <div className="text-center py-12 rounded-2xl border border-dashed border-border text-muted-foreground text-sm">Belum ada laporan tersimpan.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {reports.map((r) => (
              <div key={r.id} data-testid={`report-card-${r.id}`} className="rounded-2xl border border-border bg-white p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-display font-bold text-slate-900 flex items-center gap-2"><FileSpreadsheet className="w-4 h-4 text-emerald-600" /> {r.device_name}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{r.area} · {r.rows.length} urusan · {r.apply_multiplier ? "×1,1" : "tanpa pengali"}</div>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {r.rows.map((row) => <TipeBadge key={row.submission_id} tipe={row.tipe} />)}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 mt-4">
                  <Button variant="outline" size="sm" className="gap-1.5 flex-1" data-testid={`download-excel-${r.id}`} onClick={() => downloadExcel(r.id)}><Download className="w-4 h-4" /> Unduh Excel</Button>
                  {canManage && <Button variant="ghost" size="icon" className="text-red-600" onClick={() => del(r.id)}><Trash2 className="w-4 h-4" /></Button>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
