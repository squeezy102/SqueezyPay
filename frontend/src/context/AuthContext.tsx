import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { getAuthStatus, logoutAuth } from "../utils/api";

const TOKEN_KEY = "squeezypay_token";

interface AuthContextValue {
  token: string | null;
  isAuthenticated: boolean;
  isConfigured: boolean;
  login: (newToken: string) => void;
  logout: () => Promise<void>;
  loading: boolean;
  setIsConfigured: (val: boolean) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => sessionStorage.getItem(TOKEN_KEY));
  const [isConfigured, setIsConfigured] = useState(true);
  const [loading, setLoading] = useState(true);

  // Check auth status on mount
  useEffect(() => {
    let cancelled = false;
    getAuthStatus()
      .then((data) => {
        if (!cancelled) setIsConfigured(data.configured);
      })
      .catch(() => {
        // If status check fails, assume configured to avoid blocking the UI
        if (!cancelled) setIsConfigured(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  // Listen for 401 events dispatched by api.ts
  useEffect(() => {
    function handleUnauthorized() {
      setToken(null);
    }
    window.addEventListener("squeezypay:unauthorized", handleUnauthorized);
    return () => window.removeEventListener("squeezypay:unauthorized", handleUnauthorized);
  }, []);

  function login(newToken: string) {
    sessionStorage.setItem(TOKEN_KEY, newToken);
    setToken(newToken);
  }

  async function logout() {
    try {
      await logoutAuth();
    } catch {
      // Ignore logout errors — clear state regardless
    }
    sessionStorage.removeItem(TOKEN_KEY);
    setToken(null);
  }

  return (
    <AuthContext.Provider
      value={{
        token,
        isAuthenticated: !!token,
        isConfigured,
        login,
        logout,
        loading,
        setIsConfigured,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
