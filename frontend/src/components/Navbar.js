import React from "react";
import { useAuth } from "../context/AuthContext";
import { ROLE_META } from "../lib/constants";
import { LogOut, ShieldCheck, CalendarClock, MapPin } from "lucide-react";
import { Button } from "./ui/button";
import { NotificationBell } from "./NotificationBell";

function daysLeft(endDate) {
  if (!endDate) return null;
  const end = new Date(endDate + "T23:59:59");
  return Math.ceil((end - new Date()) / (1000 * 60 * 60 * 24));
}

export function Navbar({ period }) {
  const { user, logout } = useAuth();
  const role = ROLE_META[user?.role] || { label: user?.role, cls: "" };
  const dl = period ? daysLeft(period.end_date) : null;

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-white/85 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shrink-0 shadow-sm">
            <ShieldCheck className="w-5 h-5 text-primary-foreground" />
          </div>
          <div className="min-w-0">
            <div className="font-display font-extrabold text-sm sm:text-base leading-tight text-slate-900 truncate">Si-Scoring Kalteng</div>
            <div className="text-[10px] sm:text-xs text-muted-foreground truncate">Penilaian Tipologi Perangkat Daerah · PP 18/2016</div>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {period && period.name && (
            <div data-testid="period-banner" className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/10 border border-accent/30 text-accent">
              <CalendarClock className="w-4 h-4" />
              <span className="text-xs font-semibold">
                {period.name}
                {period.upload_locked ? " · Terkunci" : dl != null ? (dl >= 0 ? ` · ${dl} hari lagi` : " · Berakhir") : ""}
              </span>
            </div>
          )}
          <NotificationBell />
          <div className="text-right hidden sm:block">
            <div className="text-sm font-semibold text-slate-900 leading-tight max-w-[180px] truncate">{user?.name}</div>
            <div className="flex items-center gap-1.5 justify-end">
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${role.cls}`}>{role.label}</span>
              {user?.area && <span className="text-[10px] text-muted-foreground flex items-center gap-0.5"><MapPin className="w-2.5 h-2.5" />{user.area.replace("Kabupaten ", "Kab. ").replace("Provinsi ", "Prov. ")}</span>}
            </div>
          </div>
          <Button data-testid="logout-btn" variant="outline" size="sm" onClick={logout} className="gap-2">
            <LogOut className="w-4 h-4" /><span className="hidden sm:inline">Keluar</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
