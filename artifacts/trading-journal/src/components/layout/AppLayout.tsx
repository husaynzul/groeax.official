import { ReactNode, useState } from "react";
import { useLocation } from "wouter";
import Sidebar from "./Sidebar";
import MobileBottomNav from "./MobileBottomNav";
import AddTradeModal from "@/components/trades/AddTradeModal";
import { Plus, Menu } from "lucide-react";
import groeaxLogo from "@assets/WhatsApp_Image_2026-05-03_at_12.44.10_PM_1777794284426.jpeg";

interface AppLayoutProps {
  children: ReactNode;
  onSignOut?: () => void;
  userName?: string;
}

const PAGE_TITLES: Record<string, string> = {
  "/dashboard":   "Dashboard",
  "/trades":      "Trades",
  "/journal":     "Journal",
  "/analytics":   "Analytics",
  "/calculator":  "Risk Calculator",
  "/news":        "Market News",
  "/ai-coach":    "AI Coach",
  "/intelligence":"Intelligence",
  "/brokers":     "Brokers",
  "/account":     "Account",
};

export default function AppLayout({ children, onSignOut, userName }: AppLayoutProps) {
  const [location] = useLocation();
  const [addOpen, setAddOpen] = useState(false);
  const pageTitle = PAGE_TITLES[location] ?? "Groeax";

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#F0F0F0]">
      <Sidebar onSignOut={onSignOut} userName={userName} onAddTrade={() => setAddOpen(true)} />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile top header */}
        <header className="md:hidden flex items-center justify-between px-4 h-14 border-b border-border bg-sidebar shrink-0">
          <div className="flex items-center gap-2">
            <img src={groeaxLogo} alt="Groeax" className="w-7 h-7 object-contain rounded" />
            <span className="font-semibold text-sm text-foreground">{pageTitle}</span>
          </div>
          <button
            onClick={() => setAddOpen(true)}
            className="flex items-center gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-medium px-3 py-2 rounded-lg transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Trade
          </button>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto pb-16 md:pb-0">
          {children}
        </main>
      </div>

      {/* Mobile bottom navigation */}
      <MobileBottomNav onSignOut={onSignOut} />

      <AddTradeModal open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  );
}
