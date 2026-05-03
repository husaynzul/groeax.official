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
import Intelligence from "@/pages/Intelligence";
import Chart from "@/pages/Chart";
import Brokers from "@/pages/Brokers";
import Positions from "@/pages/Positions";
import NotFound from "@/pages/not-found";
import { useTradeStore } from "@/store/tradeStore";
import { AuthGate, useAuthState } from "@/components/auth/AuthGate";

const queryClient = new QueryClient();

function MT5BridgeGlobal() {
  useMT5Bridge();
  return null;
}

function AppRoutes() {
  const hydrate = useTradeStore((s) => s.hydrate);
  const auth = useAuthState();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  return (
    <AuthGate user={auth.user} onSignIn={auth.signIn}>
      <>
        <Switch>
          <Route path="/" component={Landing} />
          <Route path="/dashboard">
            <AppLayout onSignOut={auth.signOut} userName={auth.user?.name}><Dashboard /></AppLayout>
          </Route>
          <Route path="/trades">
            <AppLayout onSignOut={auth.signOut} userName={auth.user?.name}><Trades /></AppLayout>
          </Route>
          <Route path="/journal">
            <AppLayout onSignOut={auth.signOut} userName={auth.user?.name}><Journal /></AppLayout>
          </Route>
          <Route path="/analytics">
            <AppLayout onSignOut={auth.signOut} userName={auth.user?.name}><Analytics /></AppLayout>
          </Route>
          <Route path="/calculator">
            <AppLayout onSignOut={auth.signOut} userName={auth.user?.name}><Calculator /></AppLayout>
          </Route>
          <Route path="/ai-coach">
            <AppLayout onSignOut={auth.signOut} userName={auth.user?.name}><AICoach /></AppLayout>
          </Route>
          <Route path="/news">
            <AppLayout onSignOut={auth.signOut} userName={auth.user?.name}><News /></AppLayout>
          </Route>
          <Route path="/intelligence">
            <AppLayout onSignOut={auth.signOut} userName={auth.user?.name}><Intelligence /></AppLayout>
          </Route>
          <Route path="/chart">
            <AppLayout onSignOut={auth.signOut} userName={auth.user?.name}><Chart /></AppLayout>
          </Route>
          <Route path="/brokers">
            <AppLayout onSignOut={auth.signOut} userName={auth.user?.name}><Brokers /></AppLayout>
          </Route>
          <Route path="/positions">
            <AppLayout onSignOut={auth.signOut} userName={auth.user?.name}><Positions /></AppLayout>
          </Route>
          <Route component={NotFound} />
        </Switch>
        <MT5BridgeGlobal />
      </>
    </AuthGate>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "") }>
          <AppRoutes />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
