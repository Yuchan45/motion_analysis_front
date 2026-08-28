import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { apiRequest } from "../../shared/api/apiClient";
import { User } from "../../shared/api/contracts";

type AuthContextValue = { user: User | null; loading: boolean; login(email: string, password: string): Promise<void>; register(email: string, password: string): Promise<void>; logout(): Promise<void> };
const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { apiRequest<User>("/users/me").then(setUser).catch(() => setUser(null)).finally(() => setLoading(false)); }, []);
  const value = useMemo<AuthContextValue>(() => ({
    user, loading,
    async login(email, password) { setUser(await apiRequest<User>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) })); },
    async register(email, password) { setUser(await apiRequest<User>("/auth/register", { method: "POST", body: JSON.stringify({ email, password }) })); },
    async logout() { await apiRequest<void>("/auth/logout", { method: "POST" }); setUser(null); },
  }), [loading, user]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
