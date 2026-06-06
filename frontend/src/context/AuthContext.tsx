/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { getAuthStatus, logoutAuth } from "../utils/api";

const TOKEN_STORAGE_KEY = "squeezypay_token";
const UNAUTHORIZED_EVENT = "squeezypay:unauthorized";

interface AuthContextValue {
  token: string | null;
  isAuthenticated: boolean;
  isConfigured: boolean;
  statusError: boolean;
  login: (newToken: string) => void;
  logout: () => Promise<void>;
  loading: boolean;
  setIsConfigured: (val: boolean) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => sessionStorage.getItem(TOKEN_STORAGE_KEY));
  const [isConfigured, setIsConfigured] = useState(true);
  const [statusError, setStatusError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getAuthStatus()
      .then((data) => {
        if (!cancelled) {
          setIsConfigured(data.configured);
          setStatusError(false);
        }
      })
      .catch(() => {
        if (!cancelled) setStatusError(true);
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
    window.addEventListener(UNAUTHORIZED_EVENT, handleUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, handleUnauthorized);
  }, []);

  function login(newToken: string) {
    sessionStorage.setItem(TOKEN_STORAGE_KEY, newToken);
    setToken(newToken);
  }

  async function logout() {
    try {
      await logoutAuth();
    } catch {
      // Ignore logout errors — clear state regardless
    }
    sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    setToken(null);
  }

  return (
    <AuthContext.Provider
      value={{
        token,
        isAuthenticated: !!token,
        isConfigured,
        statusError,
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
