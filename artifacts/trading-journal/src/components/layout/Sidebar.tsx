import { Link, useLocation } from "wouter";
import { useState } from "react";
import {
  LayoutDashboard,
  BookOpen,
  CalendarDays,
  Calculator,
  ChevronLeft,
  ChevronRight,
  Plus,
  BarChart2,
  Bot,
  Newspaper,
  Link2,
  Brain,
  LogOut,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useMT5Store } from "@/store/mt5Store";
import { useAuthStore } from "@/store/authStore";
import groeaxLogo from "@assets/WhatsApp_Image_2026-05-03_at_12.44.10_PM_1777794284426.jpeg";

const NAV_ITEMS = [
  { href: "/dashboard",    label: "Dashboard",    icon: LayoutDashboard },
  { href: "/trades",       label: "Trades",       icon: BookOpen },
  { href: "/journal",      label: "Journal",      icon: CalendarDays },
  { href: "/analytics",    label: "Analytics",    icon: BarChart2 },
  { href: "/calculator",   label: "Risk Calc",    icon: Calculator },
  { href: "/news",         label: "Market News",  icon: Newspaper },
  { href: "/ai-coach",     label: "AI Coach",     icon: Bot },
  { href: "/intelligence", label: "Intelligence", icon: Brain },
  { href: "/brokers",      label: "Brokers",      icon: Link2 },
];

const STATUS_DOT: Record<string, string> = {
  connected:    "bg-emerald-400 shadow-[0_0_6px_2px_rgba(52,211,153,0.5)]",
  connecting:   "bg-yellow-400 animate-pulse",
  error:        "bg-red-500",
  disconnected: "bg-zinc-600",
};

const STATUS_LABEL: Record<string, string> = {
  connected:    "MT5 Connected",
  connecting:   "MT5 Connecting…",
  error:        "MT5 Error",
  disconnected: "MT5 Offline",
};

interface SidebarProps {
  onSignOut?: () => void;
  userName?: string;
  onAddTrade?: () => void;
}

export default function Sidebar({ onSignOut, userName, onAddTrade }: SidebarProps) {
  const [location] = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const mt5Status = useMT5Store((s) => s.status);
  const { user } = useAuthStore();

  return (
    <aside
      className={cn(
        "hidden md:flex flex-col h-full border-r border-sidebar-border bg-sidebar transition-all duration-300 shrink-0",
        collapsed ? "w-[60px]" : "w-[220px]"
      )}
    >
      <Link
        href="/dashboard"
        className="flex items-center gap-2 px-4 py-5 border-b border-sidebar-border min-h-[64px] hover:opacity-80 transition-opacity"
      >
        <img src={groeaxLogo} alt="Groeax logo" className="w-8 h-8 object-contain shrink-0 rounded" />
        {!collapsed && (
          <span className="font-semibold text-sm tracking-wide text-foreground">Groeax</span>
        )}
      </Link>

      {!collapsed && user && (
        <div className="px-3 pt-3 pb-1 text-xs text-muted-foreground flex items-center gap-1.5">
          <span className="truncate">
            <span className="text-foreground font-medium">{user.name}</span>
          </span>
        </div>
      )}

      <div className="flex-1 flex flex-col gap-1 p-2 pt-3 overflow-y-auto">
        <button
          data-testid="button-add-trade"
          onClick={onAddTrade}
          className={cn(
            "flex items-center gap-2 rounded-lg px-3 py-2.5 mb-2 text-sm font-medium bg-primary hover:bg-primary/90 text-primary-foreground transition-colors",
            collapsed ? "justify-center px-2" : ""
          )}
        >
          <Plus className="w-4 h-4 shrink-0" />
          {!collapsed && <span>Add Trade</span>}
        </button>

        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const isActive = location === href;
          return (
            <Link
              key={href}
              href={href}
              data-testid={`nav-${label.toLowerCase().replace(/\s+/, "-")}`}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
                collapsed ? "justify-center px-2" : "",
                isActive
                  ? "bg-sidebar-accent text-foreground font-medium"
                  : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {!collapsed && <span>{label}</span>}
            </Link>
          );
        })}
      </div>

      <div className={cn(
        "px-3 py-2.5 mx-2 mb-1 rounded-lg bg-sidebar-accent/50 border border-sidebar-border flex items-center gap-2.5 transition-all duration-300",
        collapsed ? "justify-center px-0 bg-transparent border-transparent" : ""
      )}>
        <span className={cn("w-2 h-2 rounded-full shrink-0", STATUS_DOT[mt5Status])} />
        {!collapsed && (
          <span className="text-[11px] text-muted-foreground font-medium truncate">
            {STATUS_LABEL[mt5Status]}
          </span>
        )}
      </div>

      <div className="p-2 border-t border-sidebar-border space-y-1">
        <Link
          href="/account"
          className={cn(
            "flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm transition-colors",
            collapsed ? "justify-center px-2" : "",
            location === "/account"
              ? "bg-sidebar-accent text-foreground font-medium"
              : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
          )}
        >
          <Settings className="w-4 h-4 shrink-0" />
          {!collapsed && <span>Account</span>}
        </Link>

        {onSignOut && !collapsed && (
          <button
            onClick={onSignOut}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-sidebar-accent hover:text-foreground transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        )}

        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center justify-center w-full py-2 rounded-lg text-muted-foreground hover:bg-sidebar-accent hover:text-foreground transition-colors"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>
    </aside>
  );
}
