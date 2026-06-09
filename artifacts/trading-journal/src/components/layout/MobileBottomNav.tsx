import { Link, useLocation } from "wouter";
import {
  LayoutDashboard, BookOpen, CalendarDays, BarChart2,
  MoreHorizontal, Calculator, Newspaper, Bot, Brain,
  Link2, Settings, LogOut,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const PRIMARY_NAV = [
  { href: "/dashboard",  label: "Home",     icon: LayoutDashboard },
  { href: "/trades",     label: "Trades",   icon: BookOpen },
  { href: "/journal",    label: "Journal",  icon: CalendarDays },
  { href: "/analytics",  label: "Stats",    icon: BarChart2 },
];

const MORE_NAV = [
  { href: "/calculator",   label: "Risk Calc",    icon: Calculator },
  { href: "/news",         label: "News",         icon: Newspaper },
  { href: "/ai-coach",     label: "AI Coach",     icon: Bot },
  { href: "/intelligence", label: "Intelligence", icon: Brain },
  { href: "/brokers",      label: "Brokers",      icon: Link2 },
  { href: "/account",      label: "Account",      icon: Settings },
];

interface Props {
  onSignOut?: () => void;
}

export default function MobileBottomNav({ onSignOut }: Props) {
  const [location] = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);

  return (
    <>
      {moreOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          onClick={() => setMoreOpen(false)}
        >
          <div
            className="absolute bottom-16 left-0 right-0 bg-sidebar border-t border-sidebar-border rounded-t-2xl p-4 pb-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-sidebar-border rounded-full mx-auto mb-4" />
            <div className="grid grid-cols-3 gap-2 mb-3">
              {MORE_NAV.map(({ href, label, icon: Icon }) => {
                const active = location === href;
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setMoreOpen(false)}
                    className={cn(
                      "flex flex-col items-center justify-center gap-1.5 py-3 rounded-xl text-xs transition-all",
                      active
                        ? "text-primary bg-primary/10 ring-1 ring-primary/30"
                        : "text-muted-foreground bg-sidebar-accent hover:text-foreground"
                    )}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="font-medium">{label}</span>
                  </Link>
                );
              })}
            </div>
            {onSignOut && (
              <button
                onClick={() => { onSignOut(); setMoreOpen(false); }}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm text-red-400 bg-red-400/10 mt-1"
              >
                <LogOut className="w-4 h-4" />
                <span className="font-medium">Sign out</span>
              </button>
            )}
          </div>
        </div>
      )}

      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-sidebar border-t border-sidebar-border flex items-stretch h-16">
        {PRIMARY_NAV.map(({ href, label, icon: Icon }) => {
          const active = location === href;
          return (
            <Link
              key={href}
              href={href}
              onClick={() => setMoreOpen(false)}
              className={cn(
                "flex-1 flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors",
                active ? "text-primary" : "text-muted-foreground"
              )}
            >
              <Icon className={cn("w-5 h-5 transition-transform", active && "scale-110")} />
              <span>{label}</span>
            </Link>
          );
        })}

        <button
          onClick={() => setMoreOpen((v) => !v)}
          className={cn(
            "flex-1 flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors",
            moreOpen ? "text-primary" : "text-muted-foreground"
          )}
        >
          <MoreHorizontal className={cn("w-5 h-5 transition-transform", moreOpen && "scale-110")} />
          <span>More</span>
        </button>
      </nav>
    </>
  );
}
