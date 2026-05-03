import { ReactNode } from "react";
import Sidebar from "./Sidebar";

interface AppLayoutProps {
  children: ReactNode;
  onSignOut?: () => void;
  userName?: string;
}

export default function AppLayout({ children, onSignOut, userName }: AppLayoutProps) {
  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <Sidebar onSignOut={onSignOut} userName={userName} />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
