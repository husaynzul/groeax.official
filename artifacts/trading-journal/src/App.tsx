import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useEffect, ReactNode } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { useMT5Bridge } from "@/hooks/useMT5Bridge";
import Dashboard from "@/pages/Dashboard";
import Trades from "@/pages/Trades";
import Journal from "@/pages/Journal";
import Calculator from "@/pages/Calculator";
import Analytics from "@/pages/Analytics";
import AICoach from "@/pages/AICoach";
import News from "@/pages/News";
import Intelligence from "@/pages/Intelligence";
import Brokers from "@/pages/Brokers";
import CalendarPage from "@/pages/Calendar";
import NotFound from "@/pages/not-found";
import Account from "@/pages/Account";
import { useTradeStore } from "@/store/tradeStore";

const queryClient = new QueryClient();

function MT5BridgeGlobal() {
  useMT5Bridge();
  return null;
}

function AppRoutes() {
  const hydrate = useTradeStore((s) => s.hydrate);
  useEffect(() => { hydrate(); }, [hydrate]);

  const layout = (children: ReactNode) => (
    <AppLayout>
      {children}
    </AppLayout>
  );

  return (
    <>
      <Switch>
        <Route path="/">{() => <Redirect to="/dashboard" />}</Route>
        <Route path="/dashboard">{layout(<Dashboard />)}</Route>
        <Route path="/trades">{layout(<Trades />)}</Route>
        <Route path="/journal">{layout(<Journal />)}</Route>
        <Route path="/analytics">{layout(<Analytics />)}</Route>
        <Route path="/calculator">{layout(<Calculator />)}</Route>
        <Route path="/news">{layout(<News />)}</Route>
        <Route path="/ai-coach">{layout(<AICoach />)}</Route>
        <Route path="/intelligence">{layout(<Intelligence />)}</Route>
        <Route path="/brokers">{layout(<Brokers />)}</Route>
        <Route path="/calendar">{layout(<CalendarPage />)}</Route>
        <Route path="/account">{layout(<Account />)}</Route>
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
          <AppRoutes />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
