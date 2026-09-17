import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { formatApiErrorDetail } from "../lib/api";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { ShieldCheck, Loader2, LogIn } from "lucide-react";

export default function LoginPage() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) navigate("/", { replace: true });
  }, [user, navigate]);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      navigate("/", { replace: true });
    } catch (err) {
      setError(formatApiErrorDetail(err.response?.data?.detail) || err.message);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      {/* Brand panel */}
      <div className="relative hidden lg:flex flex-col justify-between p-12 bg-primary overflow-hidden">
        <div
          className="absolute inset-0 opacity-20 bg-cover bg-center"
          style={{
            backgroundImage:
              "url('https://images.unsplash.com/photo-1659718282409-203239812162?crop=entropy&cs=srgb&fm=jpg&q=85&w=1200')",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-primary via-primary/80 to-primary/40" />
        <div className="relative z-10 flex items-center gap-3 text-primary-foreground">
          <div className="w-11 h-11 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <span className="font-display font-bold text-lg">Pemerintah Provinsi Kalimantan Tengah</span>
        </div>
        <div className="relative z-10 text-primary-foreground max-w-md">
          <h1 className="font-display text-4xl font-extrabold leading-tight">
            Sistem Penilaian Kematangan Perangkat Daerah
          </h1>
          <p className="mt-4 text-white/80 leading-relaxed">
            Evaluasi kelembagaan berbasis Permendagri 99/2018. Alur terverifikasi:
            Pengajuan → Verifikasi → Penilaian → Hasil Kematangan.
          </p>
          <div className="mt-8 flex flex-wrap gap-2">
            {["Perangkat", "Verifikator", "Penilai", "Admin"].map((r) => (
              <span key={r} className="px-3 py-1 rounded-full bg-white/10 border border-white/20 text-xs font-medium text-white">
                {r}
              </span>
            ))}
          </div>
        </div>
        <div className="relative z-10 text-white/50 text-xs">© {new Date().getFullYear()} Si-Scoring Kalteng</div>
      </div>

      {/* Form */}
      <div className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-display font-extrabold text-lg">Si-Scoring Kalteng</span>
          </div>
          <h2 className="font-display text-3xl font-extrabold text-slate-900">Masuk</h2>
          <p className="text-muted-foreground mt-1 text-sm">Gunakan akun yang diberikan oleh administrator.</p>

          <form onSubmit={submit} className="mt-8 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                data-testid="login-email-input"
                placeholder="nama@kalteng.go.id"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Kata Sandi</Label>
              <Input
                id="password"
                type="password"
                data-testid="login-password-input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error && (
              <div data-testid="login-error" className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
                {error}
              </div>
            )}
            <Button data-testid="login-submit-button" type="submit" disabled={loading} className="w-full gap-2 h-11">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
              Masuk
            </Button>
          </form>

          <div className="mt-8 rounded-xl border border-border bg-muted/40 p-4 text-xs text-muted-foreground space-y-1">
            <div className="font-semibold text-slate-700">Akun demo:</div>
            <div>Perangkat: perangkat@kalteng.go.id / Kerja123!</div>
            <div>Verifikator: verifikator@kalteng.go.id / Verif123!</div>
            <div>Penilai: penilai@kalteng.go.id / Nilai123!</div>
          </div>
        </div>
      </div>
    </div>
  );
}
