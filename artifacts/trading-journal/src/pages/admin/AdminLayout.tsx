import { ReactNode, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { useAdminStore } from "@/store/adminStore";
import {
  LayoutDashboard, Users, CreditCard, Star, Image, BarChart2,
  Settings, LogOut, Bell, Shield, ChevronRight,
} from "lucide-react";

const navItems = [
  { label: "Dashboard", icon: LayoutDashboard, href: "/admin" },
  { label: "Users", icon: Users, href: "/admin/users" },
  { label: "Subscriptions", icon: CreditCard, href: "/admin/subscriptions" },
  { label: "Premium Users", icon: Star, href: "/admin/premium" },
  { label: "Media", icon: Image, href: "/admin/media" },
  { label: "Analytics", icon: BarChart2, href: "/admin/analytics" },
  { label: "Settings", icon: Settings, href: "/admin/settings" },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { token, ready, init, clearToken } = useAdminStore();
  const [location, nav] = useLocation();

  useEffect(() => { init(); }, [init]);

  useEffect(() => {
    if (ready && !token) nav("/admin/login");
  }, [ready, token]);

  if (!ready || !token) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex">
      {/* Sidebar */}
      <aside className="w-56 bg-[#0d0d14] border-r border-white/5 flex flex-col shrink-0">
        <div className="px-5 py-5 border-b border-white/5">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-blue-400" />
            <span className="font-bold text-white text-sm">Groeax Admin</span>
          </div>
        </div>
        <nav className="flex-1 py-4 px-3 space-y-0.5">
          {navItems.map((item) => {
            const active = location === item.href || (item.href !== "/admin" && location.startsWith(item.href));
            return (
              <Link key={item.href} href={item.href}>
                <a className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? "bg-blue-600/20 text-blue-400"
                    : "text-gray-400 hover:text-white hover:bg-white/5"
                }`}>
                  <item.icon className="w-4 h-4" />
                  {item.label}
                  {active && <ChevronRight className="w-3 h-3 ml-auto" />}
                </a>
              </Link>
            );
          })}
        </nav>
        <div className="px-3 py-4 border-t border-white/5">
          <button
            onClick={() => { clearToken(); nav("/admin/login"); }}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-400 hover:text-red-400 hover:bg-red-500/10 w-full transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-14 bg-[#0d0d14] border-b border-white/5 flex items-center justify-between px-6">
          <div className="text-sm text-gray-400 capitalize">
            {navItems.find((i) => location === i.href || (i.href !== "/admin" && location.startsWith(i.href)))?.label ?? "Admin"}
          </div>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 text-xs text-green-400 bg-green-400/10 px-3 py-1 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
              System Online
            </span>
            <Bell className="w-4 h-4 text-gray-400" />
            <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold">
              A
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  );
}
