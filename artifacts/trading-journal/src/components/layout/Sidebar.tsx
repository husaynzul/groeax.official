import { Link, useLocation } from "wouter";
import { useState } from "react";
import {
  LayoutDashboard,
  BookOpen,
  CalendarDays,
  Calculator,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import AddTradeModal from "@/components/trades/AddTradeModal";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/trades", label: "Trades", icon: BookOpen },
  { href: "/journal", label: "Journal", icon: CalendarDays },
  { href: "/calculator", label: "Risk Calc", icon: Calculator },
];

export default function Sidebar() {
  const [location] = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  return (
    <>
      <aside
        className={cn(
          "flex flex-col h-full border-r border-sidebar-border bg-sidebar transition-all duration-300",
          collapsed ? "w-[60px]" : "w-[220px]"
        )}
      >
        <div className="flex items-center gap-2 px-4 py-5 border-b border-sidebar-border min-h-[64px]">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/20 shrink-0">
            <TrendingUp className="w-4 h-4 text-primary" />
          </div>
          {!collapsed && (
            <span className="font-semibold text-sm tracking-wide text-foreground">
              TradeLog
            </span>
          )}
        </div>

        <div className="flex-1 flex flex-col gap-1 p-2 pt-3">
          <button
            data-testid="button-add-trade"
            onClick={() => setAddOpen(true)}
            className={cn(
              "flex items-center gap-2 rounded-lg px-3 py-2.5 mb-2 text-sm font-medium bg-primary hover:bg-primary/90 text-primary-foreground transition-colors",
              collapsed ? "justify-center px-2" : ""
            )}
          >
            <Plus className="w-4 h-4 shrink-0" />
            {!collapsed && <span>Add Trade</span>}
          </button>

          {navItems.map(({ href, label, icon: Icon }) => {
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

        <div className="p-2 border-t border-sidebar-border">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="flex items-center justify-center w-full py-2 rounded-lg text-muted-foreground hover:bg-sidebar-accent hover:text-foreground transition-colors"
          >
            {collapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <ChevronLeft className="w-4 h-4" />
            )}
          </button>
        </div>
      </aside>

      <AddTradeModal open={addOpen} onClose={() => setAddOpen(false)} />
    </>
  );
}
