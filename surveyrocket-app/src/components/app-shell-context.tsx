import { createContext, useContext } from "react";

export type AppPortal = {
  slug: string;
  name: string;
  logoUrl?: string | null;
};

export type AppShellData = {
  slug: string;
  clientName: string;
  current: string;
  isSuperadmin?: boolean;
  email?: string | null;
  fullName?: string | null;
  avatarUrl?: string | null;
  portals?: AppPortal[];
};

const AppShellContext = createContext<AppShellData | null>(null);

export function useAppShell() {
  const ctx = useContext(AppShellContext);
  if (!ctx) {
    throw new Error("useAppShell must be used within AppShell");
  }
  return ctx;
}

export { AppShellContext };
