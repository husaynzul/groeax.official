import { Switch, Route, Router as WouterRouter, Redirect, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useEffect, ReactNode } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { useMT5Bridge } from "@/hooks/useMT5Bridge";
import Landing from "@/pages/Landing";
import Dashboard from "@/pages/Dashboard";
import Trades from "@/pages/Trades";
import Journal from "@/pages/Journal";
import Calculator from "@/pages/Calculator";
import Analytics from "@/pages/Analytics";
import AICoach from "@/pages/AICoach";
import News from "@/pages/News";
import Intelligence from "@/pages/Intelligence";
import Chart from "@/pages/Chart";
import Brokers from "@/pages/Brokers";
import Positions from "@/pages/Positions";
import NotFound from "@/pages/not-found";
import Login from "@/pages/Login";
import Signup from "@/pages/Signup";
import Pricing from "@/pages/Pricing";
import { useTradeStore } from "@/store/tradeStore";
import { useAuthStore } from "@/store/authStore";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { PremiumGate } from "@/components/auth/PremiumGate";

const queryClient = new QueryClient();

function MT5BridgeGlobal() {
  useMT5Bridge();
  return null;
}

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, ready } = useAuthStore();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (ready && !user) setLocation("/login");
  }, [ready, user]);

  if (!ready) {
    return (
      <div className="min-h-screen bg-[#030712] flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }
  if (!user) return null;
  return <>{children}</>;
}

function AppRoutes() {
  const hydrate = useTradeStore((s) => s.hydrate);
  const { user, clearAuth } = useAuthStore();

  useEffect(() => { hydrate(); }, [hydrate]);

  const layout = (children: ReactNode) => (
    <ProtectedRoute>
      <AppLayout onSignOut={clearAuth} userName={user?.name}>
        {children}
      </AppLayout>
    </ProtectedRoute>
  );

  const premiumLayout = (children: ReactNode, feature: string) => (
    <ProtectedRoute>
      <AppLayout onSignOut={clearAuth} userName={user?.name}>
        <PremiumGate feature={feature}>{children}</PremiumGate>
      </AppLayout>
    </ProtectedRoute>
  );

  return (
    <>
      <Switch>
        <Route path="/" component={Landing} />
        <Route path="/login" component={Login} />
        <Route path="/signup" component={Signup} />
        <Route path="/pricing" component={Pricing} />
        <Route path="/dashboard">{layout(<Dashboard />)}</Route>
        <Route path="/trades">{layout(<Trades />)}</Route>
        <Route path="/journal">{layout(<Journal />)}</Route>
        <Route path="/analytics">{layout(<Analytics />)}</Route>
        <Route path="/calculator">{layout(<Calculator />)}</Route>
        <Route path="/news">{layout(<News />)}</Route>
        <Route path="/ai-coach">{premiumLayout(<AICoach />, "AI Trading Coach")}</Route>
        <Route path="/intelligence">{premiumLayout(<Intelligence />, "Market Intelligence OS")}</Route>
        <Route path="/chart">{premiumLayout(<Chart />, "Live Chart")}</Route>
        <Route path="/brokers">{premiumLayout(<Brokers />, "Broker Sync")}</Route>
        <Route path="/positions">{premiumLayout(<Positions />, "Open Positions Tracker")}</Route>
        <Route component={NotFound} />
      </Switch>
      <MT5BridgeGlobal />
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
