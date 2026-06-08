import { ReactNode } from "react";

interface PremiumGateProps {
  children: ReactNode;
  feature?: string;
}

export function PremiumGate({ children }: PremiumGateProps) {
  return <>{children}</>;
}

export function PremiumBadge() {
  return null;
}

export function UpgradeBanner() {
  return null;
}
