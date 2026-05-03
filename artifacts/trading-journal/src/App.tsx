import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useEffect } from "react";
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
import Chart from "@/pages/Chart";
import Brokers from "@/pages/Brokers";
import Positions from "@/pages/Positions";
import NotFound from "@/pages/not-found";
import { useTradeStore } from "@/store/tradeStore";

const queryClient = new QueryClient();

function MT5BridgeGlobal() {
  useMT5Bridge();
  return null;
}

function AppRoutes() {
  const hydrate = useTradeStore((s) => s.hydrate);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  return (
    <>
      <Switch>
        <Route path="/" component={Landing} />
        <Route path="/dashboard">
          <AppLayout><Dashboard /></AppLayout>
        </Route>
        <Route path="/trades">
          <AppLayout><Trades /></AppLayout>
        </Route>
        <Route path="/journal">
          <AppLayout><Journal /></AppLayout>
        </Route>
        <Route path="/analytics">
          <AppLayout><Analytics /></AppLayout>
        </Route>
        <Route path="/calculator">
          <AppLayout><Calculator /></AppLayout>
        </Route>
        <Route path="/ai-coach">
          <AppLayout><AICoach /></AppLayout>
        </Route>
        <Route path="/news">
          <AppLayout><News /></AppLayout>
        </Route>
        <Route path="/chart">
          <AppLayout><Chart /></AppLayout>
        </Route>
        <Route path="/brokers">
          <AppLayout><Brokers /></AppLayout>
        </Route>
        <Route path="/positions">
          <AppLayout><Positions /></AppLayout>
        </Route>
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
