import React, { useEffect, useState } from "react";
import { api } from "../lib/api";
import { Bell, AlertTriangle, Info, AlertCircle } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "./ui/popover";

const ICON = { info: Info, warning: AlertTriangle, urgent: AlertCircle };
const CLS = {
  info: "text-blue-600 bg-blue-50 border-blue-200",
  warning: "text-amber-600 bg-amber-50 border-amber-200",
  urgent: "text-red-600 bg-red-50 border-red-200",
};

export function NotificationBell() {
  const [items, setItems] = useState([]);
  useEffect(() => {
    api.get("/notifications").then((r) => setItems(r.data)).catch(() => {});
  }, []);
  const urgent = items.some((i) => i.level === "urgent" || i.level === "warning");
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button data-testid="notification-bell" className="relative w-10 h-10 rounded-full hover:bg-muted flex items-center justify-center transition-colors">
          <Bell className="w-5 h-5 text-slate-600" />
          {items.length > 0 && (
            <span className={`absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full ${urgent ? "bg-red-500" : "bg-emerald-500"}`} />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-3">
        <div className="font-display font-bold text-sm mb-2 text-slate-900">Pemberitahuan Evaluasi</div>
        <div className="space-y-2">
          {items.length === 0 && <div className="text-sm text-muted-foreground py-4 text-center">Tidak ada pemberitahuan.</div>}
          {items.map((n, i) => {
            const Icon = ICON[n.level] || Info;
            return (
              <div key={i} data-testid={`notif-${n.level}`} className={`text-xs rounded-lg border px-3 py-2 flex gap-2 ${CLS[n.level] || CLS.info}`}>
                <Icon className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{n.message}</span>
              </div>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
